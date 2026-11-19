/**
 * Warm Chromium Three.js preview session manager + coalescing + bounded LRU frame cache.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Avoids launching a new Chromium instance on every timeline scrub event while
 * guaranteeing strict 9:16 1080x1920 binary JPEG verification and revision safety.
 */

import path from 'node:path';
import {
  checkOriginalEngineFiles,
  createRendererAdapter,
  EngineInputBlockedError,
} from '../../../engine/adapters/renderer_adapter.mjs';
import { buildEngineOverrides, TEMPLATES } from '../../shared/project_schema.mjs';
import { StoreError } from './project_store.mjs';

export const DEFAULT_CACHE_MAX_ENTRIES = 48;
export const DEFAULT_CACHE_MAX_BYTES = 24 * 1024 * 1024; // 24 MiB
export const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;      // 10 min
export const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;        // 5 min

export function createPreviewManager(
  projectRoot,
  {
    maxEntries = DEFAULT_CACHE_MAX_ENTRIES,
    maxBytes = DEFAULT_CACHE_MAX_BYTES,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    idleTtlMs = DEFAULT_IDLE_TTL_MS,
    adapterFactory = (root) => createRendererAdapter(root),
  } = {}
) {
  const cache = new Map(); // key -> { buffer, etag, width, height, createdAt, bytes, projectId }
  let totalCacheBytes = 0;

  let activeSession = null; // { projectId, templateId, webDir, appliedRenderHash, adapter, lastUsedAt }
  let sessionQueue = Promise.resolve();
  const pendingWaiters = new Map(); // projectId -> { resolve, reject, frameIndex, project }
  let activeRenderAbortHint = false;

  const stats = {
    sessionSpawns: 0,
    cacheHits: 0,
    cacheMisses: 0,
    coalescedSuperseded: 0,
  };

  const idleTimer = setInterval(() => {
    void disposeIdleSessions();
  }, 60_000);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();

  function evictIfNeeded() {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.createdAt > cacheTtlMs) {
        totalCacheBytes -= v.bytes;
        cache.delete(k);
      }
    }
    while (cache.size > maxEntries || totalCacheBytes > maxBytes) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      const old = cache.get(oldestKey);
      totalCacheBytes -= old.bytes;
      cache.delete(oldestKey);
    }
  }

  function touchCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > cacheTtlMs) {
      totalCacheBytes -= entry.bytes;
      cache.delete(key);
      return null;
    }
    // Refresh LRU position
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  function putCache(key, projectId, frameData, etag) {
    if (cache.has(key)) {
      totalCacheBytes -= cache.get(key).bytes;
      cache.delete(key);
    }
    const bytes = frameData.buffer.length;
    cache.set(key, {
      projectId,
      buffer: frameData.buffer,
      etag,
      width: frameData.width,
      height: frameData.height,
      bytes,
      createdAt: Date.now(),
    });
    totalCacheBytes += bytes;
    evictIfNeeded();
  }

  function invalidateProjectCache(projectId) {
    for (const [k, v] of cache.entries()) {
      if (v.projectId === projectId) {
        totalCacheBytes -= v.bytes;
        cache.delete(k);
      }
    }
  }

  async function disposeActiveSession() {
    if (!activeSession) return;
    const prev = activeSession;
    activeSession = null;
    await prev.adapter.disposeRenderer().catch(() => {});
  }

  async function disposeProjectSession(projectId) {
    if (activeSession?.projectId === projectId) {
      await disposeActiveSession();
    }
    const waiter = pendingWaiters.get(projectId);
    if (waiter) {
      pendingWaiters.delete(projectId);
      waiter.reject(new StoreError('Phiên xem trước đã bị đóng.', 'PREVIEW_DISPOSED', 409));
    }
  }

  async function disposeIdleSessions(now = Date.now()) {
    if (activeSession && now - activeSession.lastUsedAt > idleTtlMs) {
      await disposeActiveSession();
    }
  }

  async function disposeAllSessions() {
    clearInterval(idleTimer);
    for (const [pid, waiter] of pendingWaiters.entries()) {
      pendingWaiters.delete(pid);
      waiter.reject(new StoreError('Máy chủ đang tắt.', 'PREVIEW_DISPOSED', 503));
    }
    await disposeActiveSession();
    cache.clear();
    totalCacheBytes = 0;
  }

  async function getOrStartRendererSession(project) {
    const tpl = TEMPLATES[project.templateId];
    if (!tpl) {
      throw new StoreError(`Template không hợp lệ: ${project.templateId}`, 'INVALID_TEMPLATE', 400);
    }
    if (tpl.requiresOriginalKit) {
      const kitCheck = checkOriginalEngineFiles(projectRoot);
      if (!kitCheck.ready) {
        throw new EngineInputBlockedError(
          'Thiếu bộ kit gốc trên máy (engine/web/). Chạy `npm run setup:restore` sau khi đặt cartoon-short-kit.zip.',
          kitCheck.missing
        );
      }
    }

    const webDir = path.resolve(projectRoot, tpl.webDirRel);
    const overrides = buildEngineOverrides(project);

    if (
      activeSession &&
      activeSession.projectId === project.projectId &&
      activeSession.templateId === project.templateId
    ) {
      activeSession.lastUsedAt = Date.now();
      if (activeSession.appliedRenderHash !== project.renderHash) {
        await activeSession.adapter.setOverrides(overrides);
        activeSession.appliedRenderHash = project.renderHash;
      }
      return activeSession;
    }

    await disposeActiveSession();
    const adapter = adapterFactory(projectRoot);
    stats.sessionSpawns += 1;
    await adapter.initializeRenderer({
      projectId: project.projectId,
      mode: 'original_engine',
      webDir,
      overrides,
    });

    activeSession = {
      projectId: project.projectId,
      templateId: project.templateId,
      webDir,
      appliedRenderHash: project.renderHash,
      adapter,
      lastUsedAt: Date.now(),
    };
    return activeSession;
  }

  function runSerialized(taskFn) {
    const next = sessionQueue.then(taskFn, taskFn);
    sessionQueue = next.catch(() => {});
    return next;
  }

  async function coalescePreviewRequests(project, frameIndex, taskFn) {
    const existing = pendingWaiters.get(project.projectId);
    if (existing) {
      stats.coalescedSuperseded += 1;
      pendingWaiters.delete(project.projectId);
      existing.reject(
        new StoreError(
          `Yêu cầu khung ${existing.frameIndex} đã được thay thế bởi khung ${frameIndex}.`,
          'PREVIEW_SUPERSEDED',
          409
        )
      );
    }

    return new Promise((resolve, reject) => {
      pendingWaiters.set(project.projectId, { resolve, reject, frameIndex, project });
      void runSerialized(async () => {
        const current = pendingWaiters.get(project.projectId);
        if (!current || current.resolve !== resolve) {
          return;
        }
        pendingWaiters.delete(project.projectId);
        try {
          const res = await taskFn(current.project, current.frameIndex);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async function getPreviewFrame(project, frameIndex) {
    if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= project.durationFrames) {
      throw new StoreError(
        `Khung hình ${frameIndex} nằm ngoài phạm vi 0..${project.durationFrames - 1}.`,
        'INVALID_FRAME_INDEX',
        400
      );
    }

    const cacheKey = `${project.projectId}:${project.renderHash}:${frameIndex}`;
    const etag = `"${project.renderHash}-f${frameIndex}"`;
    const cached = touchCache(cacheKey);
    if (cached) {
      stats.cacheHits += 1;
      return {
        frameIndex,
        renderHash: project.renderHash,
        etag: cached.etag,
        width: cached.width,
        height: cached.height,
        mimeType: 'image/jpeg',
        bytes: cached.bytes,
        buffer: cached.buffer,
        cached: true,
        elapsedMs: 0,
      };
    }

    stats.cacheMisses += 1;
    const t0 = Date.now();

    return coalescePreviewRequests(project, frameIndex, async (latestProject, latestFrame) => {
      const latestKey = `${latestProject.projectId}:${latestProject.renderHash}:${latestFrame}`;
      const latestEtag = `"${latestProject.renderHash}-f${latestFrame}"`;
      const hit = touchCache(latestKey);
      if (hit) {
        return {
          frameIndex: latestFrame,
          renderHash: latestProject.renderHash,
          etag: hit.etag,
          width: hit.width,
          height: hit.height,
          mimeType: 'image/jpeg',
          bytes: hit.bytes,
          buffer: hit.buffer,
          cached: true,
          elapsedMs: 0,
        };
      }

      let session;
      try {
        session = await getOrStartRendererSession(latestProject);
        const fr = await session.adapter.renderFrame(latestFrame, {
          format: 'jpeg',
          jpegQuality: 92,
          captureMethod: 'canvas_dataurl',
        });
        session.lastUsedAt = Date.now();
        putCache(latestKey, latestProject.projectId, fr, latestEtag);
        return {
          frameIndex: latestFrame,
          renderHash: latestProject.renderHash,
          etag: latestEtag,
          width: fr.width,
          height: fr.height,
          mimeType: 'image/jpeg',
          bytes: fr.bytes,
          buffer: fr.buffer,
          cached: false,
          elapsedMs: Date.now() - t0,
        };
      } catch (err) {
        if (err instanceof EngineInputBlockedError) throw err;
        // Tear down broken browser session cleanly so next request recovers
        if (activeSession?.projectId === latestProject.projectId) {
          await disposeActiveSession();
        }
        throw err;
      }
    });
  }

  function getStats() {
    return {
      ...stats,
      activeSession: activeSession
        ? {
            projectId: activeSession.projectId,
            templateId: activeSession.templateId,
            appliedRenderHash: activeSession.appliedRenderHash,
            lastUsedAt: new Date(activeSession.lastUsedAt).toISOString(),
          }
        : null,
      cacheEntries: cache.size,
      cacheBytes: totalCacheBytes,
      maxEntries,
      maxBytes,
    };
  }

  return {
    getOrStartRendererSession,
    getPreviewFrame,
    coalescePreviewRequests,
    invalidateProjectCache,
    disposeProjectSession,
    disposeIdleSessions,
    disposeAllSessions,
    getStats,
  };
}
