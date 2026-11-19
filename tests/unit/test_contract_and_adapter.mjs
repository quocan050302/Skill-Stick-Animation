/**
 * Node unit & negative tests for Engine API contract, loopback server security,
 * frame_runner guardrails, renderer_adapter INPUT_BLOCKED enforcement, and local API server.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ContractValidationError,
  framesFromDurationSeconds,
  RENDER_CONTRACT,
  validateFrameRange,
  validateProjectSpec,
} from '../../app/shared/contract.mjs';
import { startApiServer } from '../../app/server/api_server.mjs';
import {
  createRendererAdapter,
  EngineInputBlockedError,
  REQUIRED_ORIGINAL_ENGINE_FILES,
} from '../../engine/adapters/renderer_adapter.mjs';
import {
  atomicWriteFileSync,
  checkDiskPreflight,
  DiskPreflightError,
  validateExistingResumeFrame,
  withFiniteRetry,
} from '../../tools/render/frame_runner.mjs';
import { resolveSafeStaticPath, startLoopbackServer } from '../../tools/render/server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

test('contract accepts 9:16 1080x1920 30fps and rejects 16:9 or prohibited engines', () => {
  const ok = validateProjectSpec({ projectId: 'soldier-ref' });
  assert.equal(ok.width, 1080);
  assert.equal(ok.height, 1920);
  assert.equal(ok.fps, 30);

  assert.throws(
    () => validateProjectSpec({ width: 1920, height: 1080 }),
    (err) => err instanceof ContractValidationError && err.code === 'INVALID_DIMENSIONS'
  );
  assert.throws(
    () => validateProjectSpec({ fps: 60 }),
    (err) => err instanceof ContractValidationError && err.code === 'INVALID_FPS'
  );
  for (const banned of ['skia-long', 'reachmora-2d', 'remotion', 'moviepy', 'ai-video']) {
    assert.throws(
      () => validateProjectSpec({ engine: banned }),
      (err) => err instanceof ContractValidationError && err.code === 'PROHIBITED_ENGINE'
    );
  }
});

test('frame range and duration validators reject invalid inputs', () => {
  assert.deepEqual(validateFrameRange(0, 299), { startFrame: 0, endFrame: 299, count: 300 });
  assert.equal(framesFromDurationSeconds(10), 300);

  assert.throws(() => validateFrameRange(-1, 10), ContractValidationError);
  assert.throws(() => validateFrameRange(10, 5), ContractValidationError);
  assert.throws(() => validateFrameRange(0.5, 10), ContractValidationError);
  assert.throws(() => framesFromDurationSeconds(0), ContractValidationError);
  assert.throws(() => framesFromDurationSeconds(-5), ContractValidationError);
  assert.throws(() => framesFromDurationSeconds(Number.NaN), ContractValidationError);
});

function rawHttpStatus(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

test('loopback server enforces 127.0.0.1 and rejects path traversal', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssa-srv-'));
  fs.writeFileSync(path.join(tmpDir, 'ok.txt'), 'hello-safe', 'utf8');
  const srv = await startLoopbackServer([{ prefix: '', dir: tmpDir }], 0);
  try {
    assert.equal(srv.host, '127.0.0.1');
    assert.equal(resolveSafeStaticPath([{ prefix: '', dir: tmpDir }], '/../package.json'), null);
    assert.equal(resolveSafeStaticPath([{ prefix: '', dir: tmpDir }], '/..\\package.json'), null);

    const rOk = await fetch(`${srv.baseUrl}/ok.txt`);
    assert.equal(rOk.status, 200);
    assert.equal(await rOk.text(), 'hello-safe');

    assert.equal(await rawHttpStatus(srv.port, '/../package.json'), 403);
    assert.equal(await rawHttpStatus(srv.port, '/%2e%2e/package.json'), 403);
    assert.equal(await rawHttpStatus(srv.port, '/..%5cpackage.json'), 403);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderer_adapter rejects original_engine with INPUT_BLOCKED when kit files absent', async () => {
  const missingKitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssa-nokit-'));
  fs.mkdirSync(path.join(missingKitRoot, 'node_modules', 'three', 'build'), { recursive: true });
  fs.writeFileSync(path.join(missingKitRoot, 'node_modules', 'three', 'build', 'three.module.js'), '// stub\n');
  const adapter = createRendererAdapter(missingKitRoot);
  try {
    await assert.rejects(
      () => adapter.initializeRenderer({ projectId: 'soldier-baseline', mode: 'original_engine' }),
      (err) =>
        err instanceof EngineInputBlockedError &&
        err.code === 'INPUT_BLOCKED' &&
        err.missingFiles.length === REQUIRED_ORIGINAL_ENGINE_FILES.length
    );
  } finally {
    await adapter.disposeRenderer();
    fs.rmSync(missingKitRoot, { recursive: true, force: true });
  }
});

test('renderer_adapter detects missing Three.js dependency cleanly', async () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssa-nothree-'));
  const adapter = createRendererAdapter(emptyRoot);
  try {
    await assert.rejects(
      () => adapter.initializeRenderer({ projectId: 'no-three', mode: 'technical_webgl_smoke' }),
      (err) => err instanceof EngineInputBlockedError && err.missingFiles.includes('node_modules/three/build/three.module.js')
    );
  } finally {
    await adapter.disposeRenderer();
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test('disk preflight, resume validator, and finite retry enforce safety boundaries', async () => {
  const okDisk = checkDiskPreflight(ROOT, { estimatedBytes: 1024, lowWatermarkBytes: 1024 * 1024 });
  assert.equal(okDisk.ok, true);

  assert.throws(
    () => checkDiskPreflight(ROOT, { estimatedBytes: 10 ** 16, lowWatermarkBytes: 1024 }),
    (err) => err instanceof DiskPreflightError && err.code === 'LOW_DISK_SPACE'
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssa-resume-'));
  try {
    const corruptPath = path.join(tmpDir, 'frame_000000.png');
    atomicWriteFileSync(corruptPath, Buffer.from('not-a-png'));
    const res = validateExistingResumeFrame(corruptPath, 'deadbeef', 1080, 1920);
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'invalid_dimensions_or_corrupt');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  let attempts = 0;
  await assert.rejects(
    () =>
      withFiniteRetry(
        async () => {
          attempts += 1;
          throw new Error('persistent failure');
        },
        { maxRetries: 2, delayMs: 5 }
      ),
    /persistent failure/
  );
  assert.equal(attempts, 3);
});

test('local API server enforces loopback, contract validation, and honest INPUT_BLOCKED status', async () => {
  const noKitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ssa-api-nokit-'));
  fs.mkdirSync(path.join(noKitRoot, 'node_modules', 'three', 'build'), { recursive: true });
  fs.writeFileSync(path.join(noKitRoot, 'node_modules', 'three', 'build', 'three.module.js'), '// stub\n');
  const api = await startApiServer({ port: 0, projectRoot: noKitRoot });
  try {
    assert.equal(api.host, '127.0.0.1');

    const healthRes = await fetch(`${api.baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.originalEngine.ready, false);

    const contractRes = await fetch(`${api.baseUrl}/api/contract`);
    assert.equal(contractRes.status, 200);
    const cBody = await contractRes.json();
    assert.equal(cBody.contract.aspectRatio, RENDER_CONTRACT.aspectRatio);

    // Original engine request must return 409 INPUT_BLOCKED when kit missing (never fake render)
    const origRes = await fetch(`${api.baseUrl}/api/render/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'soldier', mode: 'original_engine', frameIndex: 0 }),
    });
    assert.equal(origRes.status, 409);
    const origBody = await origRes.json();
    assert.equal(origBody.status, 'INPUT_BLOCKED');

    // 16:9 request must be rejected with 400
    const badRes = await fetch(`${api.baseUrl}/api/render/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: 1920, height: 1080, mode: 'technical_webgl_smoke' }),
    });
    assert.equal(badRes.status, 400);
  } finally {
    await api.close();
    fs.rmSync(noKitRoot, { recursive: true, force: true });
  }
});
