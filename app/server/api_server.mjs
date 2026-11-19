/**
 * Localhost-only modular HTTP API & static production server for Cartoon Short Studio (SHORT-02).
 *
 * Provenance: Extended from SHORT-01 api_server.mjs (NEW IMPLEMENTATION).
 * Security: Strictly binds to 127.0.0.1, rejects non-loopback Host/Origin headers,
 * sets safe response security headers, and enforces canonical path confinement.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ContractValidationError,
  RENDER_CONTRACT,
  validateProjectSpec,
} from '../shared/contract.mjs';
import { listTemplates } from '../shared/project_schema.mjs';
import {
  checkOriginalEngineFiles,
  createRendererAdapter,
  EngineInputBlockedError,
} from '../../engine/adapters/renderer_adapter.mjs';
import { verifyEnvironment } from '../../tools/setup/safe_setup.mjs';
import { createJobManager } from './services/job_manager.mjs';
import { createMediaStore } from './services/media_store.mjs';
import { createPreviewManager } from './services/preview_manager.mjs';
import { createProjectStore, StoreError } from './services/project_store.mjs';
import { createQaService } from './services/qa_service.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const STATIC_MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
});

function extractHostWithoutPort(hostHeader) {
  const raw = String(hostHeader || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end >= 0 ? raw.slice(0, end + 1) : raw;
  }
  const idx = raw.lastIndexOf(':');
  return idx > 0 ? raw.slice(0, idx) : raw;
}

function validateLoopbackHeaders(req) {
  const hostHeader = req.headers.host;
  if (hostHeader) {
    const hostname = extractHostWithoutPort(hostHeader);
    if (!LOOPBACK_HOSTS.has(hostname)) {
      return {
        ok: false,
        status: 403,
        code: 'HOST_NOT_ALLOWED',
        message: 'Host không thuộc địa chỉ loopback nội bộ.',
      };
    }
  }

  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      if (parsed.protocol !== 'http:' || !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
        return {
          ok: false,
          status: 403,
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Origin không thuộc địa chỉ loopback được phép.',
        };
      }
      return { ok: true, allowedOrigin: originHeader };
    } catch {
      return {
        ok: false,
        status: 403,
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Origin header không hợp lệ.',
      };
    }
  }

  return { ok: true, allowedOrigin: null };
}

function baseSecurityHeaders(allowedOrigin = null) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Filename, If-None-Match';
  }
  return headers;
}

function sendJson(res, statusCode, payload, { allowedOrigin = null, extraHeaders = {} } = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    ...baseSecurityHeaders(allowedOrigin),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendBinary(res, statusCode, buffer, contentType, { allowedOrigin = null, extraHeaders = {} } = {}) {
  res.writeHead(statusCode, {
    ...baseSecurityHeaders(allowedOrigin),
    'Content-Type': contentType,
    'Content-Length': buffer.length,
    ...extraHeaders,
  });
  res.end(buffer);
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(new StoreError(`Dữ liệu gửi lên vượt giới hạn ${Math.round(maxBytes / (1024 * 1024))} MB.`, 'PAYLOAD_TOO_LARGE', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (!settled) reject(err);
    });
  });
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const rawBuf = await readRawBody(req, maxBytes);
  const text = rawBuf.toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new StoreError('Nội dung JSON không hợp lệ.', 'INVALID_JSON', 400);
  }
}

async function parseVoiceoverUpload(req) {
  const maxBytes = 32 * 1024 * 1024 + 128 * 1024;
  const contentType = String(req.headers['content-type'] || '');
  const buf = await readRawBody(req, maxBytes);

  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await new Response(buf, { headers: { 'content-type': contentType } }).formData();
    const entry = form.get('file') || form.get('voiceover');
    if (!entry || typeof entry === 'string') {
      throw new StoreError('Không tìm thấy tệp trong biểu mẫu tải lên.', 'MEDIA_INVALID', 400);
    }
    const arrBuf = await entry.arrayBuffer();
    return {
      filename: entry.name || 'voiceover.wav',
      mimeType: entry.type || 'application/octet-stream',
      buffer: Buffer.from(arrBuf),
    };
  }

  const rawName = req.headers['x-filename'];
  let decodedName = 'voiceover.wav';
  if (rawName) {
    try {
      decodedName = decodeURIComponent(String(rawName));
    } catch {
      decodedName = String(rawName);
    }
  }
  return {
    filename: decodedName,
    mimeType: contentType || 'application/octet-stream',
    buffer: buf,
  };
}

function sendErrorResponse(res, err, allowedOrigin = null) {
  if (err instanceof EngineInputBlockedError) {
    return sendJson(
      res,
      409,
      {
        ok: false,
        status: 'INPUT_BLOCKED',
        code: err.code,
        error: err.message,
        message: err.message,
        missingFiles: err.missingFiles,
        details: { missingFiles: err.missingFiles },
        retryable: false,
      },
      { allowedOrigin }
    );
  }
  if (err instanceof ContractValidationError) {
    const status = err.code === 'REVISION_CONFLICT' || err.code === 'INPUT_BLOCKED' ? 409 : 400;
    return sendJson(
      res,
      status,
      {
        ok: false,
        code: err.code,
        error: err.message,
        message: err.message,
        details: err.details || null,
        retryable: err.code === 'REVISION_CONFLICT',
      },
      { allowedOrigin }
    );
  }
  if (err instanceof StoreError) {
    const status = err.statusCode || err.httpStatus || 400;
    return sendJson(
      res,
      status,
      {
        ok: false,
        code: err.code,
        error: err.message,
        message: err.message,
        details: err.details || null,
        retryable: status >= 500 || err.code === 'PREVIEW_SUPERSEDED',
      },
      { allowedOrigin }
    );
  }
  return sendJson(
    res,
    500,
    {
      ok: false,
      code: 'INTERNAL_SERVER_ERROR',
      error: err?.message || String(err),
      message: err?.message || 'Lỗi máy chủ nội bộ.',
      retryable: true,
    },
    { allowedOrigin }
  );
}

function streamMp4WithRange(req, res, fileInfo, download, allowedOrigin) {
  const total = fileInfo.bytes;
  const headers = {
    ...baseSecurityHeaders(allowedOrigin),
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
  };
  if (download) {
    const safeDownload = `${fileInfo.projectId}_${fileInfo.exportId}.mp4`;
    headers['Content-Disposition'] = `attachment; filename="${safeDownload}"`;
  }

  const rangeHeader = req.headers.range;
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace('bytes=', '').split('-');
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : total - 1;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end >= total ||
      start > end
    ) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${total}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(fileInfo.filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    ...headers,
    'Content-Length': total,
  });
  fs.createReadStream(fileInfo.filePath).pipe(res);
}

function tryServeStaticAsset(res, staticDir, pathname, allowedOrigin) {
  if (!staticDir || !fs.existsSync(staticDir)) return false;
  const rootAbs = path.resolve(staticDir);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname || '/');
  } catch {
    return false;
  }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.includes('..')) {
    return false;
  }

  const cleanRel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  let target = path.resolve(rootAbs, cleanRel);
  const rel = path.relative(rootAbs, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    // SPA client-side route fallback for /projects and /studio/:id
    if (!path.extname(cleanRel)) {
      target = path.join(rootAbs, 'index.html');
    } else {
      return false;
    }
  }
  if (!fs.existsSync(target)) return false;

  const ext = path.extname(target).toLowerCase();
  const mime = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
  const extraHeaders =
    ext === '.html'
      ? {
          'Cache-Control': 'no-cache',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
        }
      : { 'Cache-Control': 'public, max-age=300' };

  const buf = fs.readFileSync(target);
  sendBinary(res, 200, buf, mime, { allowedOrigin, extraHeaders });
  return true;
}

export async function startApiServer({
  port = 0,
  projectRoot = ROOT,
  staticDir = null,
  projectStore: providedProjectStore = null,
  mediaStore: providedMediaStore = null,
  previewManager: providedPreviewManager = null,
  qaService: providedQaService = null,
  jobManager: providedJobManager = null,
} = {}) {
  const projectStore = providedProjectStore || createProjectStore(projectRoot);
  const mediaStore = providedMediaStore || createMediaStore(projectStore);
  const previewManager = providedPreviewManager || createPreviewManager(projectRoot);
  const qaService = providedQaService || createQaService(projectRoot);
  const jobManager =
    providedJobManager ||
    createJobManager(projectRoot, {
      projectStore,
      mediaStore,
      previewManager,
      qaService,
    });

  let cachedToolVerify = null;
  let cachedToolVerifyAt = 0;

  async function getCachedToolVerify(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedToolVerify && now - cachedToolVerifyAt < 60_000) {
      return cachedToolVerify;
    }
    const env = await verifyEnvironment(projectRoot);
    cachedToolVerify = env;
    cachedToolVerifyAt = now;
    return env;
  }

  let actualPort = port;

  const server = http.createServer(async (req, res) => {
    const hostCheck = validateLoopbackHeaders(req);
    if (!hostCheck.ok) {
      return sendJson(res, hostCheck.status, {
        ok: false,
        code: hostCheck.code,
        error: hostCheck.message,
        message: hostCheck.message,
      });
    }
    const allowedOrigin = hostCheck.allowedOrigin;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...baseSecurityHeaders(allowedOrigin) });
      res.end();
      return;
    }

    try {
      const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${actualPort || 80}`);
      const pathname = reqUrl.pathname;

      if (req.method === 'GET' && pathname === '/api/health') {
        const originalEngine = checkOriginalEngineFiles(projectRoot);
        const forceRefresh = reqUrl.searchParams.get('refresh') === '1';
        const env = await getCachedToolVerify(forceRefresh);
        const templates = listTemplates(originalEngine.ready);
        return sendJson(
          res,
          200,
          {
            ok: true,
            service: 'stick-animation-api',
            host: '127.0.0.1',
            port: actualPort,
            originalKitReady: originalEngine.ready,
            originalEngine,
            tools: {
              node: { ok: Boolean(env.node?.meets_min_22_6), version: env.node?.version || null },
              three: { ok: Boolean(env.three?.installed), version: env.three?.version || null },
              playwright: {
                ok: Boolean(env.playwright?.installed && env.playwright?.chromium_exists),
                version: env.playwright?.version || null,
              },
              python: { ok: Boolean(env.python?.ok), version: env.python?.version || null },
              ffmpeg: {
                ok: Boolean(env.ffmpeg?.ok),
                version: env.ffmpeg?.banner ? env.ffmpeg.banner.split('Copyright')[0].trim() : null,
              },
              ffprobe: {
                ok: Boolean(env.ffprobe?.ok),
                version: env.ffprobe?.banner ? env.ffprobe.banner.split('Copyright')[0].trim() : null,
              },
            },
            allToolsReady: Boolean(env.local_tooling_ready),
            templatesCount: templates.length,
            previewStats: previewManager.getStats(),
          },
          { allowedOrigin }
        );
      }

      if (req.method === 'GET' && pathname === '/api/contract') {
        return sendJson(
          res,
          200,
          { ok: true, contract: RENDER_CONTRACT },
          { allowedOrigin }
        );
      }

      if (req.method === 'GET' && pathname === '/api/templates') {
        const kit = checkOriginalEngineFiles(projectRoot);
        const templates = listTemplates(kit.ready);
        return sendJson(
          res,
          200,
          { ok: true, originalKitReady: kit.ready, templates },
          { allowedOrigin }
        );
      }

      // SHORT-01 legacy direct frame render endpoint (preserved verbatim)
      if (req.method === 'POST' && pathname === '/api/render/frame') {
        const payload = await readJsonBody(req);
        const spec = validateProjectSpec(payload);
        const adapter = createRendererAdapter(projectRoot);
        try {
          await adapter.initializeRenderer({
            projectId: spec.projectId,
            mode: spec.mode,
            webDir: payload.webDir,
            overrides: payload.overrides,
          });
          const frame = await adapter.renderFrame(spec.frameIndex, {
            format: payload.format || 'png',
            quality: payload.quality ?? 95,
          });
          const metadata = adapter.getMetadata();
          return sendJson(
            res,
            200,
            {
              ok: true,
              metadata,
              frame: {
                frameIndex: frame.frameIndex,
                width: frame.width,
                height: frame.height,
                bytes: frame.bytes,
                sha256: frame.sha256,
                elapsedMs: frame.elapsedMs,
              },
            },
            { allowedOrigin }
          );
        } finally {
          await adapter.disposeRenderer().catch(() => {});
        }
      }

      // --- Projects CRUD ---
      if (req.method === 'GET' && pathname === '/api/projects') {
        const projects = projectStore.listProjects();
        return sendJson(res, 200, { ok: true, projects }, { allowedOrigin });
      }

      if (req.method === 'POST' && pathname === '/api/projects') {
        const body = await readJsonBody(req);
        const kit = checkOriginalEngineFiles(projectRoot);
        const project = await projectStore.createProject(body, kit.ready);
        return sendJson(res, 201, { ok: true, project }, { allowedOrigin });
      }

      const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch) {
        const projectId = decodeURIComponent(projectMatch[1]);
        if (req.method === 'GET') {
          const project = projectStore.readProject(projectId);
          return sendJson(res, 200, { ok: true, project }, { allowedOrigin });
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req);
          const project = await projectStore.updateProject(projectId, body);
          return sendJson(res, 200, { ok: true, project }, { allowedOrigin });
        }
        if (req.method === 'DELETE') {
          const body = await readJsonBody(req).catch(() => ({}));
          await previewManager.disposeProjectSession(projectId);
          previewManager.invalidateProjectCache(projectId);
          const removed = await projectStore.removeProject(projectId, {
            confirmProjectId: body.confirmProjectId ?? reqUrl.searchParams.get('confirmProjectId') ?? undefined,
          });
          return sendJson(res, 200, { ok: true, ...removed }, { allowedOrigin });
        }
      }

      // --- Voiceover Asset Upload / Delete ---
      const voiceoverMatch = pathname.match(/^\/api\/projects\/([^/]+)\/assets\/voiceover$/);
      if (voiceoverMatch) {
        const projectId = decodeURIComponent(voiceoverMatch[1]);
        if (req.method === 'POST') {
          projectStore.readProject(projectId); // ensure exists
          const upload = await parseVoiceoverUpload(req);
          const imported = await mediaStore.importVoiceover(projectId, upload);
          const updated = await projectStore.updateProjectSystemFields(projectId, (p) => {
            p.voiceover = imported.voiceover;
            return p;
          });
          return sendJson(
            res,
            200,
            {
              ok: true,
              project: updated,
              voiceover: imported.voiceover,
              timing: updated.timing,
            },
            { allowedOrigin }
          );
        }
        if (req.method === 'DELETE') {
          const updated = await projectStore.updateProjectSystemFields(projectId, (p) => {
            p.voiceover = null;
            return p;
          });
          return sendJson(res, 200, { ok: true, project: updated, timing: updated.timing }, { allowedOrigin });
        }
      }

      // --- Warm Preview ---
      const previewFrameMatch = pathname.match(/^\/api\/projects\/([^/]+)\/preview\/frame$/);
      if (previewFrameMatch && req.method === 'GET') {
        const projectId = decodeURIComponent(previewFrameMatch[1]);
        const project = projectStore.readProject(projectId);
        const rawFrame = reqUrl.searchParams.get('f') ?? reqUrl.searchParams.get('frameIndex') ?? '0';
        const frameIndex = Number.parseInt(rawFrame, 10);
        if (!Number.isInteger(frameIndex) || String(frameIndex) !== rawFrame.trim()) {
          throw new ContractValidationError(`Chỉ số khung hình không hợp lệ: ${rawFrame}`, 'INVALID_FRAME_INDEX');
        }
        const expectedEtag = `"${project.renderHash}-f${frameIndex}"`;
        if (req.headers['if-none-match'] === expectedEtag) {
          res.writeHead(304, {
            ...baseSecurityHeaders(allowedOrigin),
            ETag: expectedEtag,
            'Cache-Control': 'private, max-age=60',
          });
          res.end();
          return;
        }
        const result = await previewManager.getPreviewFrame(project, frameIndex);
        return sendBinary(res, 200, result.buffer, result.mimeType, {
          allowedOrigin,
          extraHeaders: {
            ETag: result.etag,
            'Cache-Control': 'private, max-age=60',
            'X-Frame-Index': String(result.frameIndex),
            'X-Render-Hash': result.renderHash,
            'X-Preview-Cached': result.cached ? '1' : '0',
            'X-Render-Ms': String(result.elapsedMs),
          },
        });
      }

      const previewSessionMatch = pathname.match(/^\/api\/projects\/([^/]+)\/preview\/session$/);
      if (previewSessionMatch) {
        const projectId = decodeURIComponent(previewSessionMatch[1]);
        if (req.method === 'POST') {
          const project = projectStore.readProject(projectId);
          await previewManager.getOrStartRendererSession(project);
          return sendJson(
            res,
            200,
            {
              ok: true,
              warm: true,
              projectId: project.projectId,
              templateId: project.templateId,
              renderHash: project.renderHash,
            },
            { allowedOrigin }
          );
        }
        if (req.method === 'DELETE') {
          await previewManager.disposeProjectSession(projectId);
          return sendJson(res, 200, { ok: true, disposed: true, projectId }, { allowedOrigin });
        }
      }

      // --- Render Jobs ---
      const projectJobsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/jobs$/);
      if (projectJobsMatch) {
        const projectId = decodeURIComponent(projectJobsMatch[1]);
        if (req.method === 'GET') {
          projectStore.readProject(projectId);
          const jobs = jobManager.listJobs(projectId);
          return sendJson(res, 200, { ok: true, jobs }, { allowedOrigin });
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const job = await jobManager.enqueueRenderJob(projectId, body);
          return sendJson(res, 202, { ok: true, job }, { allowedOrigin });
        }
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (jobMatch && req.method === 'GET') {
        const jobId = decodeURIComponent(jobMatch[1]);
        const job = jobManager.getJob(jobId);
        return sendJson(res, 200, { ok: true, job }, { allowedOrigin });
      }

      const jobCancelMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
      if (jobCancelMatch && req.method === 'POST') {
        const jobId = decodeURIComponent(jobCancelMatch[1]);
        const job = await jobManager.cancelJob(jobId);
        return sendJson(res, 200, { ok: true, job }, { allowedOrigin });
      }

      const jobEventsMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/events$/);
      if (jobEventsMatch && req.method === 'GET') {
        const jobId = decodeURIComponent(jobEventsMatch[1]);
        jobManager.getJob(jobId); // validate jobId + existence before switching to SSE headers
        res.writeHead(200, {
          ...baseSecurityHeaders(allowedOrigin),
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        });

        const unsubscribe = jobManager.subscribeJob(jobId, (eventName, payload) => {
          res.write(`event: ${eventName}\n`);
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        });
        const heartbeat = setInterval(() => {
          res.write(': keepalive\n\n');
        }, 15_000);
        heartbeat.unref();

        req.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }

      // --- Exported MP4 & QA ---
      const exportFileMatch = pathname.match(/^\/api\/projects\/([^/]+)\/exports\/([^/]+)\/file$/);
      if (exportFileMatch && req.method === 'GET') {
        const projectId = decodeURIComponent(exportFileMatch[1]);
        const exportId = decodeURIComponent(exportFileMatch[2]);
        const fileInfo = mediaStore.getSafeExportFile(projectId, exportId);
        const download = reqUrl.searchParams.get('download') === '1';
        streamMp4WithRange(req, res, fileInfo, download, allowedOrigin);
        return;
      }

      const exportQaMatch = pathname.match(/^\/api\/projects\/([^/]+)\/exports\/([^/]+)\/qa$/);
      if (exportQaMatch && req.method === 'GET') {
        const projectId = decodeURIComponent(exportQaMatch[1]);
        const exportId = decodeURIComponent(exportQaMatch[2]);
        const qa = jobManager.getExportQa(projectId, exportId);
        return sendJson(res, 200, { ok: true, qa }, { allowedOrigin });
      }

      if (pathname.startsWith('/api/')) {
        return sendJson(
          res,
          404,
          { ok: false, code: 'NOT_FOUND', error: `Không tìm thấy endpoint: ${pathname}` },
          { allowedOrigin }
        );
      }

      if (req.method === 'GET' && tryServeStaticAsset(res, staticDir, pathname, allowedOrigin)) {
        return;
      }

      return sendJson(
        res,
        404,
        { ok: false, code: 'NOT_FOUND', error: 'Not found' },
        { allowedOrigin }
      );
    } catch (err) {
      return sendErrorResponse(res, err, allowedOrigin);
    }
  });

  await new Promise((resolve, reject) => {
    const onErr = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onErr);
      resolve();
    };
    server.once('error', onErr);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
  const address = server.address();
  actualPort = address.port;

  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await jobManager.disposeAllJobs();
    await previewManager.disposeAllSessions();
    await new Promise((resolve) => server.close(resolve));
  }

  return {
    host: '127.0.0.1',
    port: actualPort,
    baseUrl: `http://127.0.0.1:${actualPort}`,
    services: {
      projectStore,
      mediaStore,
      previewManager,
      qaService,
      jobManager,
    },
    close,
  };
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  const port = Number(process.env.API_PORT || process.env.PORT || 8787);
  const staticDir = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
  const started = await startApiServer({ port, projectRoot: ROOT, staticDir });
  console.log(`Cartoon Short Studio API ready at ${started.baseUrl} (static=${staticDir || 'disabled'})`);

  const shutdown = async () => {
    await started.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
