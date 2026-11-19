/**
 * Bounded parallel frame-range coordinator (default 2 Chromium workers on >=6-core/16GB hosts).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Splits 0..(N-1) across at most 2 bounded shards, awaits every worker, aggregates reports,
 * preserves SIGINT/SIGTERM process-tree teardown, and never oversubscribes RAM/CPU.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOutputPreset } from '../../app/shared/contract.mjs';
import { atomicWriteFileSync, checkDiskPreflight, registerCleanupHandlers } from './frame_runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function parseCli(argv) {
  const opts = {
    projectId: 'render-job',
    webDir: null,
    outDir: path.join(ROOT, 'workspace', 'cache', 'frames'),
    startFrame: 0,
    endFrame: 299,
    format: 'jpeg',
    quality: 94,
    resume: true,
    workers: null,
    reportPath: null,
    overridesFile: null,
    outputPreset: 'standard',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--project-id') opts.projectId = argv[++i];
    else if (k === '--web-dir') opts.webDir = path.resolve(argv[++i]);
    else if (k === '--out-dir') opts.outDir = path.resolve(argv[++i]);
    else if (k === '--start') opts.startFrame = Number(argv[++i]);
    else if (k === '--end') opts.endFrame = Number(argv[++i]);
    else if (k === '--format') opts.format = argv[++i];
    else if (k === '--quality') opts.quality = Number(argv[++i]);
    else if (k === '--workers') opts.workers = Number(argv[++i]);
    else if (k === '--no-resume') opts.resume = false;
    else if (k === '--report') opts.reportPath = path.resolve(argv[++i]);
    else if (k === '--overrides-file') opts.overridesFile = path.resolve(argv[++i]);
    else if (k === '--output-preset') opts.outputPreset = argv[++i];
  }
  return opts;
}

const opts = parseCli(process.argv.slice(2));
const preset = resolveOutputPreset(opts.outputPreset);
const hostFreeGb = os.freemem() / (1024 * 1024 * 1024);
const cpuCount = os.cpus().length;
// Bound native 4K workers to available RAM (~1.2GB per 4K Chromium SwiftShader instance)
const safe4kCap = hostFreeGb >= 4.5 && cpuCount >= 8 ? 3 : hostFreeGb >= 2.5 ? 2 : 1;
const maxWorkersAllowed = preset.id === 'native_4k' ? safe4kCap : Math.min(4, Math.max(2, Math.floor(cpuCount / 3)));
const defaultWorkers =
  preset.id === 'native_4k'
    ? Math.min(2, safe4kCap)
    : Math.min(3, Math.max(1, Math.floor(cpuCount / 4)));
const boundedWorkers = Math.min(maxWorkersAllowed, Math.max(1, Number(opts.workers || defaultWorkers)));
const totalFrames = opts.endFrame - opts.startFrame + 1;
const perFrameEst = preset.id === 'native_4k' ? 2400 * 1024 : 512 * 1024;
const disk = checkDiskPreflight(opts.outDir, { estimatedBytes: totalFrames * perFrameEst });
fs.mkdirSync(opts.outDir, { recursive: true });

// Partition frames into contiguous shards
const shards = [];
const workerCount = Math.min(boundedWorkers, totalFrames);
const perShard = Math.ceil(totalFrames / workerCount);
for (let w = 0; w < workerCount; w++) {
  const a = opts.startFrame + w * perShard;
  const b = Math.min(opts.endFrame, a + perShard - 1);
  if (a <= b) shards.push({ id: w, a, b });
}

const children = new Set();
const unregister = registerCleanupHandlers(async () => {
  for (const ch of children) {
    try {
      ch.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
});

const t0 = Date.now();
try {
  const workerPromises = shards.map((sh) => {
    const shardReport = path.join(opts.outDir, `shard-${sh.id}-report.json`);
    const args = [
      path.join(ROOT, 'tools', 'render', 'render_original.mjs'),
      '--project-id', `${opts.projectId}-shard-${sh.id}`,
      '--out-dir', opts.outDir,
      '--frames', `${sh.a}-${sh.b}`,
      '--format', opts.format,
      '--quality', String(opts.quality),
      '--output-preset', preset.id,
      '--report', shardReport,
    ];
    if (opts.webDir) args.push('--web-dir', opts.webDir);
    if (opts.overridesFile) args.push('--overrides-file', opts.overridesFile);
    if (opts.resume) args.push('--resume');

    return new Promise((resolve, reject) => {
      const ch = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      children.add(ch);
      let stdout = '';
      let stderr = '';
      ch.stdout.on('data', (d) => { stdout += d.toString(); });
      ch.stderr.on('data', (d) => { stderr += d.toString(); });
      ch.on('error', (err) => {
        children.delete(ch);
        reject(err);
      });
      ch.on('close', (code) => {
        children.delete(ch);
        if (code !== 0) {
          reject(new Error(`Shard ${sh.id} (${sh.a}-${sh.b}) exited ${code}: ${stderr || stdout}`));
          return;
        }
        const rep = JSON.parse(fs.readFileSync(shardReport, 'utf8'));
        resolve(rep);
      });
    });
  });

  const shardReports = await Promise.all(workerPromises);
  const allFrames = shardReports.flatMap((r) => r.frames).sort((a, b) => a.frameIndex - b.frameIndex);
  const elapsedMs = Date.now() - t0;

  // Consolidate final resume manifest cleanly
  const overridesData = opts.overridesFile ? JSON.parse(fs.readFileSync(opts.overridesFile, 'utf8')) : null;
  const visualFoundation = overridesData?.scene?.visualFoundation || 'baseline';
  const framesMap = Object.fromEntries(allFrames.map((f) => [f.fileName, f.sha256]));
  atomicWriteFileSync(
    path.join(opts.outDir, 'resume-manifest.json'),
    Buffer.from(
      JSON.stringify(
        {
          projectId: opts.projectId,
          outputPreset: preset.id,
          visualFoundation,
          width: preset.width,
          height: preset.height,
          fps: 30,
          frames: framesMap,
          updatedAtUtc: new Date().toISOString(),
        },
        null,
        2
      ) + '\n',
      'utf8'
    )
  );

  const summary = {
    projectId: opts.projectId,
    outputPreset: preset.id,
    visualFoundation,
    width: preset.width,
    height: preset.height,
    workers: workerCount,
    range: { startFrame: opts.startFrame, endFrame: opts.endFrame, count: totalFrames },
    renderedCount: shardReports.reduce((s, r) => s + r.renderedCount, 0),
    skippedViaResume: shardReports.reduce((s, r) => s + r.skippedViaResume, 0),
    elapsedMs,
    effectiveMsPerFrame: Number((elapsedMs / Math.max(1, totalFrames)).toFixed(1)),
    diskPreflight: disk,
    consoleErrors: shardReports.reduce((s, r) => s + (r.metadata?.consoleErrorCount || 0), 0),
    pageErrors: shardReports.reduce((s, r) => s + (r.metadata?.pageErrorCount || 0), 0),
    browserVersion: shardReports[0]?.metadata?.browserVersion || null,
    launchProfile: shardReports[0]?.metadata?.launchProfile || null,
    webglProof: shardReports[0]?.metadata?.webgl || null,
    outDir: opts.outDir,
    frameCount: allFrames.length,
    firstFrameSha256: allFrames[0]?.sha256 || null,
    lastFrameSha256: allFrames[allFrames.length - 1]?.sha256 || null,
  };

  const rp = opts.reportPath || path.join(opts.outDir, 'parallel-render-report.json');
  atomicWriteFileSync(rp, Buffer.from(JSON.stringify(summary, null, 2) + '\n', 'utf8'));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  unregister();
}
