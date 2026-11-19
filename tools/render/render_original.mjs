/**
 * Production frame-capture CLI wrapping the real original Three.js engine via renderer_adapter.
 *
 * Provenance: NEW IMPLEMENTATION (preserving original tools/render.mjs frame/quality contract
 * while adding loopback 127.0.0.1 binding, disk preflight, atomic writes, hash+dimension RESUME,
 * determinism verification, and clean SIGINT/SIGTERM process teardown).
 *
 * Usage:
 *   node tools/render/render_original.mjs --out-dir <dir> --frames "0,40,87,..." [--format jpeg|png] [--quality 95] [--resume] [--web-dir <dir>] [--repeat-check 0] [--debug edge|nd]
 *   node tools/render/render_original.mjs --out-dir <dir> --frames "0-591" --format jpeg --quality 95 --resume
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOutputPreset } from '../../app/shared/contract.mjs';
import { createRendererAdapter } from '../../engine/adapters/renderer_adapter.mjs';
import {
  atomicWriteFileSync,
  canonicalFrameName,
  checkDiskPreflight,
  validateExistingResumeFrame,
  withFiniteRetry,
} from './frame_runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

export function parseFrameSpec(spec) {
  const frames = [];
  for (const rawPart of String(spec).split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    if (part.includes('-')) {
      const [aStr, bStr] = part.split('-');
      const a = Number(aStr);
      const b = Number(bStr);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a) {
        throw new Error(`Invalid frame range segment: ${part}`);
      }
      for (let f = a; f <= b; f++) frames.push(f);
    } else {
      const f = Number(part);
      if (!Number.isInteger(f) || f < 0) {
        throw new Error(`Invalid frame index: ${part}`);
      }
      frames.push(f);
    }
  }
  if (frames.length === 0) throw new Error('Empty frame specification');
  return frames;
}

function parseCli(argv) {
  const opts = {
    outDir: path.join(ROOT, 'workspace', 'cache', 'soldier-stills'),
    framesSpec: '0',
    format: 'jpeg',
    quality: 95,
    resume: false,
    webDir: null,
    repeatCheck: null,
    debugMode: null,
    projectId: 'soldier-baseline',
    reportPath: null,
    overridesFile: null,
    outputPreset: 'standard',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--out-dir') opts.outDir = path.resolve(argv[++i]);
    else if (k === '--frames') opts.framesSpec = argv[++i];
    else if (k === '--format') opts.format = argv[++i];
    else if (k === '--quality') opts.quality = Number(argv[++i]);
    else if (k === '--resume') opts.resume = true;
    else if (k === '--web-dir') opts.webDir = path.resolve(argv[++i]);
    else if (k === '--repeat-check') opts.repeatCheck = Number(argv[++i]);
    else if (k === '--debug') opts.debugMode = argv[++i];
    else if (k === '--project-id') opts.projectId = argv[++i];
    else if (k === '--report') opts.reportPath = path.resolve(argv[++i]);
    else if (k === '--overrides-file') opts.overridesFile = path.resolve(argv[++i]);
    else if (k === '--output-preset') opts.outputPreset = argv[++i];
  }
  return opts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const opts = parseCli(process.argv.slice(2));
  const preset = resolveOutputPreset(opts.outputPreset);
  const frames = parseFrameSpec(opts.framesSpec);
  const ext = opts.format === 'png' ? 'png' : 'jpg';
  const manifestPath = path.join(opts.outDir, 'resume-manifest.json');
  const perFrameEst = preset.id === 'native_4k' ? 2400 * 1024 : 512 * 1024;

  const disk = checkDiskPreflight(opts.outDir, {
    estimatedBytes: frames.length * perFrameEst,
  });
  fs.mkdirSync(opts.outDir, { recursive: true });

  const overrides = opts.overridesFile
    ? JSON.parse(fs.readFileSync(opts.overridesFile, 'utf8'))
    : undefined;
  const visualFoundation = overrides?.scene?.visualFoundation || 'baseline';

  let prevManifest = null;
  let priorHashes = {};
  if (opts.resume && fs.existsSync(manifestPath)) {
    try {
      prevManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (
        prevManifest.width === preset.width &&
        prevManifest.height === preset.height &&
        (!prevManifest.outputPreset || prevManifest.outputPreset === preset.id) &&
        (!prevManifest.visualFoundation || prevManifest.visualFoundation === visualFoundation)
      ) {
        priorHashes = prevManifest.frames || {};
      }
    } catch {
      priorHashes = {};
    }
  }

  const adapter = createRendererAdapter(ROOT);
  const t0 = Date.now();
  try {
    const meta = await adapter.initializeRenderer({
      projectId: opts.projectId,
      mode: 'original_engine',
      outputPreset: preset.id,
      webDir: opts.webDir || undefined,
      overrides,
    });

    const rendered = [];
    let skippedViaResume = 0;
    let renderedCount = 0;

    for (let idx = 0; idx < frames.length; idx++) {
      const f = frames[idx];
      const fileName = canonicalFrameName(f, ext);
      const outPath = path.join(opts.outDir, fileName);

      if (opts.resume && priorHashes[fileName]) {
        const chk = validateExistingResumeFrame(
          outPath,
          priorHashes[fileName],
          preset.width,
          preset.height,
          prevManifest,
          { outputPreset: preset.id, visualFoundation }
        );
        if (chk.valid) {
          skippedViaResume += 1;
          rendered.push({ frameIndex: f, fileName, bytes: chk.bytes, sha256: chk.sha256, resumed: true });
          continue;
        }
      }

      const fr = await withFiniteRetry(
        async () => {
          const r = await adapter.renderFrame(f, {
            format: opts.format,
            jpegQuality: opts.quality,
            captureMethod: 'canvas_dataurl',
            debugMode: opts.debugMode,
          });
          atomicWriteFileSync(outPath, r.buffer);
          return r;
        },
        { maxRetries: 2 }
      );

      renderedCount += 1;
      priorHashes[fileName] = fr.sha256;
      rendered.push({ frameIndex: f, fileName, bytes: fr.bytes, sha256: fr.sha256, resumed: false });

      if (renderedCount % 25 === 0 || idx === frames.length - 1) {
        atomicWriteFileSync(
          manifestPath,
          Buffer.from(
            JSON.stringify(
              {
                projectId: opts.projectId,
                outputPreset: preset.id,
                visualFoundation,
                width: preset.width,
                height: preset.height,
                fps: 30,
                frames: priorHashes,
                updatedAtUtc: new Date().toISOString(),
              },
              null,
              2
            ) + '\n',
            'utf8'
          )
        );
      }
    }

    let repeatCheckResult = null;
    if (opts.repeatCheck !== null && Number.isInteger(opts.repeatCheck)) {
      const rep = await adapter.renderFrame(opts.repeatCheck, {
        format: opts.format,
        jpegQuality: opts.quality,
        captureMethod: 'canvas_dataurl',
        debugMode: opts.debugMode,
      });
      const orig = rendered.find((x) => x.frameIndex === opts.repeatCheck);
      repeatCheckResult = {
        frameIndex: opts.repeatCheck,
        firstSha256: orig?.sha256 ?? null,
        repeatSha256: rep.sha256,
        deterministicMatch: Boolean(orig && orig.sha256 === rep.sha256),
      };
    }

    const elapsedMs = Date.now() - t0;
    const finalMeta = adapter.getRenderMetadata();
    const report = {
      projectId: opts.projectId,
      metadata: finalMeta,
      diskPreflight: disk,
      requestedCount: frames.length,
      renderedCount,
      skippedViaResume,
      elapsedMs,
      avgMsPerFrame: Number((elapsedMs / Math.max(1, frames.length)).toFixed(1)),
      repeatCheck: repeatCheckResult,
      outDir: opts.outDir,
      frames: rendered,
    };

    const rp = opts.reportPath || path.join(opts.outDir, 'render-report.json');
    atomicWriteFileSync(rp, Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8'));
    console.log(JSON.stringify({ ...report, frames: `[${rendered.length} frames; see ${rp}]` }, null, 2));
    process.exit(finalMeta.consoleErrorCount === 0 && finalMeta.pageErrorCount === 0 ? 0 : 1);
  } finally {
    await adapter.disposeRenderer();
  }
}
