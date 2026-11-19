/**
 * Atomic, serialized JSON project registry under workspace/projects/<projectId>/.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Enforces strict path confinement, optimistic revision concurrency, and immutable render snapshots.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ContractValidationError, validateProjectId } from '../../shared/contract.mjs';
import {
  buildEngineOverrides,
  computeRenderHash,
  deriveFrameCount,
  TEMPLATES,
  validateCreateProject,
  validateProjectPatch,
} from '../../shared/project_schema.mjs';
import { atomicWriteFileSync } from '../../../tools/render/frame_runner.mjs';

export class StoreError extends Error {
  constructor(message, code = 'STORE_ERROR', statusCode = 400, details = {}) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function createProjectStore(projectRoot) {
  const projectsRoot = path.resolve(projectRoot, 'workspace', 'projects');
  const writeLocks = new Map();

  function ensureRoot() {
    fs.mkdirSync(projectsRoot, { recursive: true });
  }

  function resolveProjectDir(projectId) {
    const safeId = validateProjectId(projectId);
    const dir = path.resolve(projectsRoot, safeId);
    const rel = path.relative(projectsRoot, dir);
    if (!rel || rel.includes('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
      throw new ContractValidationError(`Unsafe project directory: ${projectId}`, 'INVALID_PROJECT_ID');
    }
    return { safeId, dir, file: path.join(dir, 'project.json') };
  }

  async function withProjectLock(projectId, fn) {
    const safeId = validateProjectId(projectId);
    const prev = writeLocks.get(safeId) || Promise.resolve();
    const run = prev.then(() => fn(), () => fn());
    const tail = run.catch(() => {});
    writeLocks.set(safeId, tail);
    try {
      return await run;
    } finally {
      if (writeLocks.get(safeId) === tail) {
        writeLocks.delete(safeId);
      }
    }
  }

  function decorateProject(raw) {
    const tpl = TEMPLATES[raw.templateId];
    const timing = deriveFrameCount(raw);
    const renderHash = computeRenderHash({ ...raw, durationFrames: timing.durationFrames });
    return {
      ...raw,
      durationFrames: timing.durationFrames,
      timing,
      renderHash,
      template: tpl
        ? {
            templateId: tpl.templateId,
            name: tpl.name,
            requiresOriginalKit: tpl.requiresOriginalKit,
            capabilities: tpl.capabilities,
            shots: tpl.shots,
            supportedOptions: tpl.supportedOptions,
          }
        : null,
    };
  }

  function readRawProject(projectId) {
    const { safeId, file } = resolveProjectDir(projectId);
    if (!fs.existsSync(file)) {
      throw new StoreError(`Không tìm thấy dự án "${safeId}".`, 'PROJECT_NOT_FOUND', 404, { projectId: safeId });
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new StoreError(`Tệp dự án bị hỏng: ${err.message}`, 'INVALID_PROJECT', 500, { projectId: safeId });
    }
  }

  function listProjects() {
    ensureRoot();
    const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    const items = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pFile = path.join(projectsRoot, ent.name, 'project.json');
      if (!fs.existsSync(pFile)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(pFile, 'utf8'));
        const dec = decorateProject(raw);
        items.push({
          projectId: dec.projectId,
          title: dec.title,
          templateId: dec.templateId,
          templateName: dec.template?.name || dec.templateId,
          requiresOriginalKit: Boolean(dec.template?.requiresOriginalKit),
          revision: dec.revision,
          renderHash: dec.renderHash,
          durationFrames: dec.durationFrames,
          durationSeconds: dec.timing.durationSeconds,
          fps: dec.fps,
          aspectRatio: dec.aspectRatio,
          hasVoiceover: Boolean(dec.voiceover),
          latestExport: dec.latestExport || null,
          updatedAt: dec.updatedAt,
          createdAt: dec.createdAt,
        });
      } catch {
        // Ignore corrupt folder rather than crashing whole list
      }
    }
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return items;
  }

  async function createProject(input, originalKitReady) {
    ensureRoot();
    const project = validateCreateProject(input, originalKitReady);
    const { safeId, dir, file } = resolveProjectDir(project.projectId);
    return withProjectLock(safeId, async () => {
      if (fs.existsSync(file)) {
        throw new StoreError(`Dự án "${safeId}" đã tồn tại.`, 'DUPLICATE_PROJECT', 409, { projectId: safeId });
      }
      fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'snapshots'), { recursive: true });
      atomicWriteFileSync(file, Buffer.from(JSON.stringify(project, null, 2) + '\n', 'utf8'));
      return decorateProject(project);
    });
  }

  function readProject(projectId) {
    return decorateProject(readRawProject(projectId));
  }

  async function updateProject(projectId, patch) {
    const { safeId, file } = resolveProjectDir(projectId);
    return withProjectLock(safeId, async () => {
      const existing = readRawProject(safeId);
      const next = validateProjectPatch(existing, patch);
      atomicWriteFileSync(file, Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8'));
      return decorateProject(next);
    });
  }

  async function updateProjectSystemFields(projectId, mutatorFn) {
    const { safeId, file } = resolveProjectDir(projectId);
    return withProjectLock(safeId, async () => {
      const existing = readRawProject(safeId);
      const next = mutatorFn(structuredClone(existing));
      next.updatedAt = new Date().toISOString();
      next.revision = existing.revision + 1;
      const timing = deriveFrameCount(next);
      next.durationFrames = timing.durationFrames;
      atomicWriteFileSync(file, Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8'));
      return decorateProject(next);
    });
  }

  async function removeProject(projectId, { confirmProjectId } = {}) {
    const { safeId, dir, file } = resolveProjectDir(projectId);
    if (confirmProjectId !== undefined && confirmProjectId !== safeId) {
      throw new StoreError('Mã xác nhận xóa dự án không khớp.', 'CONFIRMATION_REQUIRED', 400);
    }
    return withProjectLock(safeId, async () => {
      if (!fs.existsSync(file)) {
        throw new StoreError(`Không tìm thấy dự án "${safeId}".`, 'PROJECT_NOT_FOUND', 404);
      }
      fs.rmSync(dir, { recursive: true, force: true });
      return { deleted: true, projectId: safeId };
    });
  }

  async function snapshotProjectRevision(projectId) {
    const { safeId, dir } = resolveProjectDir(projectId);
    return withProjectLock(safeId, async () => {
      const dec = decorateProject(readRawProject(safeId));
      const snapDir = path.join(dir, 'snapshots');
      fs.mkdirSync(snapDir, { recursive: true });
      const snapPath = path.join(snapDir, `rev_${dec.revision}_${dec.renderHash}.json`);
      const overrides = buildEngineOverrides(dec);
      const overridesPath = path.join(snapDir, `overrides_${dec.revision}_${dec.renderHash}.json`);
      atomicWriteFileSync(snapPath, Buffer.from(JSON.stringify(dec, null, 2) + '\n', 'utf8'));
      if (overrides) {
        atomicWriteFileSync(overridesPath, Buffer.from(JSON.stringify(overrides, null, 2) + '\n', 'utf8'));
      }
      return {
        project: dec,
        snapshotPath: snapPath,
        overrides,
        overridesPath: overrides ? overridesPath : null,
      };
    });
  }

  return {
    projectsRoot,
    resolveProjectDir,
    listProjects,
    createProject,
    readProject,
    updateProject,
    updateProjectSystemFields,
    removeProject,
    snapshotProjectRevision,
  };
}
