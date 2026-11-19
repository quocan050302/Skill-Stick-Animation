/**
 * CLI runner for G07 real Chromium + WebGL2 + Three.js 0.160.0 1080x1920 smoke check.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Explicitly labeled TECHNICAL_WEBGL_SMOKE_ONLY — does NOT substitute for original Soldier renders.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRendererAdapter } from '../../engine/adapters/renderer_adapter.mjs';
import { atomicWriteFileSync } from './frame_runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const opts = {
    outDir: path.join(ROOT, 'workspace', 'cache', 'webgl-smoke'),
    frames: 15,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir' && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
    if (argv[i] === '--frames' && argv[i + 1]) opts.frames = Number(argv[++i]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const adapter = createRendererAdapter(ROOT);

try {
  const t0 = Date.now();
  const meta = await adapter.initializeRenderer({
    projectId: 'webgl-smoke-g07',
    mode: 'technical_webgl_smoke',
  });

  const rangeRes = await adapter.renderFrameRange(0, opts.frames - 1, {
    outDir: opts.outDir,
    format: 'png',
    resume: false,
  });

  // Repeat frame 0 for same-environment determinism check
  const repeat0 = await adapter.renderFrame(0, { format: 'png' });
  const frame0Hash = rangeRes.frames[0].sha256;
  const deterministicMatch = repeat0.sha256 === frame0Hash;

  // Verify resume path reuses validated frames cleanly
  const resumeRes = await adapter.renderFrameRange(0, opts.frames - 1, {
    outDir: opts.outDir,
    format: 'png',
    resume: true,
  });

  const summary = {
    label: 'TECHNICAL_WEBGL_SMOKE_ONLY',
    notOriginalKitBaseline: true,
    metadata: meta,
    elapsedTotalMs: Date.now() - t0,
    renderedFrames: rangeRes.renderedCount,
    frame0Hash,
    repeatFrame0Hash: repeat0.sha256,
    deterministicRepeatMatch: deterministicMatch,
    resumeSkippedCount: resumeRes.skippedViaResume,
    resumeRenderedCount: resumeRes.renderedCount,
    consoleErrors: rangeRes.consoleErrors,
    pageErrors: rangeRes.pageErrors,
    outDir: opts.outDir,
    frames: rangeRes.frames.map((f) => ({
      frameIndex: f.frameIndex,
      fileName: f.fileName,
      bytes: f.bytes,
      sha256: f.sha256,
    })),
  };

  fs.mkdirSync(opts.outDir, { recursive: true });
  atomicWriteFileSync(
    path.join(opts.outDir, 'smoke-report.json'),
    Buffer.from(JSON.stringify(summary, null, 2) + '\n', 'utf8')
  );

  console.log(JSON.stringify(summary, null, 2));
  const ok =
    meta.webgl?.isWebGL2 === true &&
    rangeRes.consoleErrors.length === 0 &&
    rangeRes.pageErrors.length === 0 &&
    deterministicMatch &&
    resumeRes.skippedViaResume === opts.frames &&
    resumeRes.renderedCount === 0;
  process.exit(ok ? 0 : 1);
} finally {
  await adapter.disposeRenderer();
}
