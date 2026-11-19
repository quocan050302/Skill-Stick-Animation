/**
 * Unit tests for SHORT-02 backend modules:
 * - Project CRUD, serialized locking, REVISION_CONFLICT, delete confirmation
 * - Path traversal / canonical confinement
 * - Voiceover magic-byte sniffing, extension/size limits, real FFprobe validation
 * - Timing derivation (round(duration * 30)) & conflict blocking
 * - PreviewManager LRU cache eviction, renderHash invalidation, burst coalescing, warm reuse
 * - JobManager persistence & interrupted job recovery
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  computeRenderHash,
  deriveFrameCount,
} from '../../app/shared/project_schema.mjs';
import { ContractValidationError } from '../../app/shared/contract.mjs';
import { createProjectStore, StoreError } from '../../app/server/services/project_store.mjs';
import { createMediaStore } from '../../app/server/services/media_store.mjs';
import { createPreviewManager } from '../../app/server/services/preview_manager.mjs';
import { createJobManager } from '../../app/server/services/job_manager.mjs';
import { createQaService } from '../../app/server/services/qa_service.mjs';

function makePcm16WavBuffer(durationSec, sampleRate = 48000, freqHz = 330) {
  const nSamples = Math.round(durationSec * sampleRate);
  const dataBytes = nSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM
  buf.writeUInt16LE(1, 20); // linear PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < nSamples; i += 1) {
    const val = Math.round(0.35 * 32767 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
    buf.writeInt16LE(val, 44 + i * 2);
  }
  return buf;
}

test('project store handles CRUD, concurrent serialized updates, REVISION_CONFLICT, and path traversal', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-store-'));
  try {
    const store = createProjectStore(tmpRoot);
    assert.deepEqual(store.listProjects(), []);

    const created = await store.createProject(
      { title: 'Dự án Test 01', templateId: 'plaza-courier-10s' },
      false
    );
    assert.equal(created.revision, 1);
    assert.equal(created.durationFrames, 300);
    assert.equal(created.width, 1080);
    assert.equal(created.height, 1920);

    // Concurrency test: 6 parallel updates must serialize cleanly to revision 7
    const signs = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'];
    const results = await Promise.all(
      signs.map((s) =>
        store.updateProject(created.projectId, { sceneOverrides: { signTitle: s } })
      )
    );
    assert.equal(results.length, 6);
    const reloaded = store.readProject(created.projectId);
    assert.equal(reloaded.revision, 7);

    // REVISION_CONFLICT guard
    await assert.rejects(
      () =>
        store.updateProject(created.projectId, {
          expectedRevision: 3,
          title: 'Stale write',
        }),
      (err) => err instanceof ContractValidationError && err.code === 'REVISION_CONFLICT'
    );

    // Path traversal rejection
    assert.throws(
      () => store.resolveProjectDir('../outside-secret'),
      (err) => err instanceof ContractValidationError && err.code === 'INVALID_PROJECT_ID'
    );

    // Delete confirmation guard & cleanup
    await assert.rejects(
      () => store.removeProject(created.projectId, { confirmProjectId: 'wrong-id' }),
      (err) => err instanceof StoreError && err.code === 'CONFIRMATION_REQUIRED'
    );
    await store.removeProject(created.projectId, { confirmProjectId: created.projectId });
    assert.deepEqual(store.listProjects(), []);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('media store rejects spoofed/corrupt audio uploads and verifies real WAV with ffprobe', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-media-'));
  try {
    const store = createProjectStore(tmpRoot);
    const media = createMediaStore(store);
    const proj = await store.createProject({ title: 'Audio Check', templateId: 'zombie-store-10s' }, false);

    // Empty / disallowed extensions / spoofed HTML in .wav
    await assert.rejects(
      () => media.importVoiceover(proj.projectId, { filename: 'empty.wav', buffer: Buffer.alloc(0) }),
      (err) => err instanceof StoreError && err.code === 'MEDIA_INVALID'
    );
    await assert.rejects(
      () =>
        media.importVoiceover(proj.projectId, {
          filename: 'payload.svg',
          buffer: Buffer.from('<svg onload="alert(1)"/>'),
        }),
      (err) => err instanceof StoreError && err.code === 'MEDIA_INVALID'
    );
    await assert.rejects(
      () =>
        media.importVoiceover(proj.projectId, {
          filename: 'fake.wav',
          buffer: Buffer.from('<html><script>alert(1)</script></html>'),
        }),
      (err) => err instanceof StoreError && err.code === 'MEDIA_INVALID'
    );

    // Path confinement on voiceover and exports
    assert.equal(media.resolveVoiceoverPath(proj.projectId, 'assets/../../../etc/passwd'), null);
    assert.throws(
      () => media.getSafeExportFile(proj.projectId, '../escape'),
      (err) => err instanceof StoreError && err.code === 'INVALID_EXPORT_ID'
    );

    // Real 2.5s WAV passes FFprobe
    const wavBuf = makePcm16WavBuffer(2.5);
    const imported = await media.importVoiceover(proj.projectId, {
      filename: 'narration.wav',
      mimeType: 'audio/wav',
      buffer: wavBuf,
    });
    assert.ok(Math.abs(imported.voiceover.durationSeconds - 2.5) < 0.05);
    assert.equal(imported.voiceover.codec, 'pcm_s16le');

    // Timing derivation checks
    const updated = await store.updateProjectSystemFields(proj.projectId, (p) => {
      p.voiceover = imported.voiceover;
      return p;
    });
    assert.equal(updated.durationFrames, 75); // round(2.5 * 30)
    assert.equal(updated.timing.syncMode, 'matched_voiceover');

    const tooLongTiming = deriveFrameCount({
      ...updated,
      voiceover: { ...imported.voiceover, durationSeconds: 12.2 },
    });
    assert.equal(tooLongTiming.syncMode, 'conflict');
    assert.equal(tooLongTiming.conflict.code, 'TIMING_DURATION_MISMATCH');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('preview manager maintains warm session across override changes, coalesces bursts, and bounds LRU cache', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-prev-'));
  let setOverrideCalls = 0;
  let renderCalls = 0;

  const mockFactory = () => {
    let curOverrides = null;
    return {
      async initializeRenderer({ overrides }) {
        curOverrides = overrides;
      },
      async setOverrides(ov) {
        setOverrideCalls += 1;
        curOverrides = ov;
      },
      async renderFrame(frameIndex) {
        renderCalls += 1;
        await new Promise((r) => setTimeout(r, 25));
        const tag = JSON.stringify({ frameIndex, curOverrides });
        return {
          frameIndex,
          width: 1080,
          height: 1920,
          bytes: Buffer.byteLength(tag),
          buffer: Buffer.from(tag, 'utf8'),
          elapsedMs: 25,
        };
      },
      async disposeRenderer() {},
    };
  };

  try {
    const store = createProjectStore(tmpRoot);
    const pm = createPreviewManager(tmpRoot, {
      maxEntries: 2,
      maxBytes: 1024 * 1024,
      adapterFactory: mockFactory,
    });

    try {
      const p = await store.createProject({ title: 'Warm Scrub', templateId: 'plaza-courier-10s' }, false);

      // Warm start + cache hit
      const f0 = await pm.getPreviewFrame(p, 0);
      assert.equal(f0.cached, false);
      const f0Cached = await pm.getPreviewFrame(p, 0);
      assert.equal(f0Cached.cached, true);
      assert.equal(pm.getStats().sessionSpawns, 1);

      // Update overrides -> changes renderHash -> calls setOverrides without respawning Chromium!
      const p2 = await store.updateProject(p.projectId, {
        sceneOverrides: { signTitle: 'NEW SIGN' },
      });
      assert.notEqual(computeRenderHash(p), computeRenderHash(p2));
      const f0Updated = await pm.getPreviewFrame(p2, 0);
      assert.equal(f0Updated.cached, false);
      assert.equal(setOverrideCalls, 1);
      assert.equal(pm.getStats().sessionSpawns, 1);

      // Burst scrub coalescing: 3 concurrent calls on same project
      const burst = await Promise.allSettled([
        pm.getPreviewFrame(p2, 10),
        pm.getPreviewFrame(p2, 20),
        pm.getPreviewFrame(p2, 30),
      ]);
      assert.equal(burst[2].status, 'fulfilled');
      assert.equal(burst[2].value.frameIndex, 30);
      assert.ok(pm.getStats().coalescedSuperseded >= 1);

      // LRU eviction check (maxEntries = 2: frame 30 + frame 40 fit, evicting frame 0)
      await pm.getPreviewFrame(p2, 40);
      const beforeRecheck = renderCalls;
      const recheckF0 = await pm.getPreviewFrame(p2, 0);
      assert.equal(recheckF0.cached, false);
      assert.equal(renderCalls, beforeRecheck + 1);
    } finally {
      await pm.disposeAllSessions();
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('job manager recovers orphaned active jobs as interrupted on startup', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-jobs-'));
  try {
    const jobsDir = path.join(tmpRoot, 'workspace', 'jobs');
    fs.mkdirSync(jobsDir, { recursive: true });
    fs.writeFileSync(
      path.join(jobsDir, 'job_orphan_1.json'),
      JSON.stringify({
        jobId: 'job_orphan_1',
        projectId: 'proj-a',
        status: 'frames',
        stage: 'frames',
        progress: 40,
      })
    );

    const projectStore = createProjectStore(tmpRoot);
    const mediaStore = createMediaStore(projectStore);
    const previewManager = createPreviewManager(tmpRoot);
    const qaService = createQaService(tmpRoot);
    const jm = createJobManager(tmpRoot, { projectStore, mediaStore, previewManager, qaService });

    try {
      const recovered = jm.getJob('job_orphan_1');
      assert.equal(recovered.status, 'interrupted');
      assert.equal(recovered.error.code, 'JOB_INTERRUPTED');
      assert.ok(recovered.finishedAtUtc);
    } finally {
      await jm.disposeAllJobs();
      await previewManager.disposeAllSessions();
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
