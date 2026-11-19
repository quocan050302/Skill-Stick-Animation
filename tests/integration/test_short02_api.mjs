/**
 * Live API integration tests for SHORT-02 (Real Three.js Chromium + FFmpeg + FFprobe + QA).
 * Tests HTTP security headers, Host/Origin blocks, missing-kit INPUT_BLOCKED behavior,
 * real warm JPEG preview + edit pixel diff proof, voiceover upload/conflict block,
 * active render cancellation, and real MP4 + Range streaming + QA gate verification.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { startApiServer } from '../../app/server/api_server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function makeActivePcm16Wav(durationSec, sampleRate = 48000, freqHz = 280) {
  const nSamples = Math.round(durationSec * sampleRate);
  const dataBytes = nSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < nSamples; i += 1) {
    // Amplitude bursts so mix.py gated-RMS sees clear active speech windows
    const env = (i % sampleRate) < sampleRate * 0.7 ? 0.35 : 0.0;
    const val = Math.round(env * 32767 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
    buf.writeInt16LE(val, 44 + i * 2);
  }
  return buf;
}

function rawRequestWithCustomHost(port, pathname, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c.toString('utf8');
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('API enforces Host/Origin security headers and honest missing-kit INPUT_BLOCKED state', async () => {
  const noKitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-nokit-'));
  fs.mkdirSync(path.join(noKitRoot, 'node_modules', 'three', 'build'), { recursive: true });
  fs.writeFileSync(path.join(noKitRoot, 'node_modules', 'three', 'build', 'three.module.js'), '// stub\n');

  const api = await startApiServer({ port: 0, projectRoot: noKitRoot });
  try {
    // Host & Origin checks
    const badHost = await rawRequestWithCustomHost(api.port, '/api/health', { Host: 'evil.example:8787' });
    assert.equal(badHost.status, 403);
    assert.match(badHost.body, /HOST_NOT_ALLOWED/);

    const badOrigin = await rawRequestWithCustomHost(api.port, '/api/health', {
      Host: `127.0.0.1:${api.port}`,
      Origin: 'https://evil.example',
    });
    assert.equal(badOrigin.status, 403);
    assert.match(badOrigin.body, /ORIGIN_NOT_ALLOWED/);

    // Security headers check
    const healthRes = await fetch(`${api.baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(healthRes.headers.get('access-control-allow-origin'), null);

    // Templates reflect missing original kit honestly while keeping standalone templates available
    const tplRes = await fetch(`${api.baseUrl}/api/templates`);
    assert.equal(tplRes.status, 200);
    const tplJson = await tplRes.json();
    assert.equal(tplJson.originalKitReady, false);
    const soldierTpl = tplJson.templates.find((t) => t.templateId === 'soldier-original');
    const plazaTpl = tplJson.templates.find((t) => t.templateId === 'plaza-courier-10s');
    assert.equal(soldierTpl.available, false);
    assert.equal(plazaTpl.available, true);

    // Creating a soldier-original project without original kit must reject with 409 INPUT_BLOCKED
    const createBlocked = await fetch(`${api.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Blocked Soldier', templateId: 'soldier-original' }),
    });
    assert.equal(createBlocked.status, 409);
    const blockedBody = await createBlocked.json();
    assert.equal(blockedBody.code, 'INPUT_BLOCKED');
  } finally {
    await api.close();
    fs.rmSync(noKitRoot, { recursive: true, force: true });
  }
});

test('Live Studio API renders warm JPEG preview, alters pixels on edits, blocks long voiceover, cancels job, and completes verified MP4 export', async () => {
  const api = await startApiServer({ port: 0, projectRoot: ROOT });
  const createdIds = [];
  const createdJobIds = [];

  try {
    // 1. Create plaza-courier-10s project
    const createRes = await fetch(`${api.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plaza API Integration Test',
        templateId: 'plaza-courier-10s',
      }),
    });
    assert.equal(createRes.status, 201);
    const { project } = await createRes.json();
    createdIds.push(project.projectId);
    assert.equal(project.durationFrames, 300);

    // 2. Real warm JPEG preview at frame 270 (deliver shot) + cache verification
    const p1Res = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/preview/frame?f=270`);
    assert.equal(p1Res.status, 200);
    assert.equal(p1Res.headers.get('content-type'), 'image/jpeg');
    const bufBefore = Buffer.from(await p1Res.arrayBuffer());
    assert.equal(bufBefore[0], 0xff);
    assert.equal(bufBefore[1], 0xd8);
    assert.ok(bufBefore.length > 15000);
    const shaBefore = crypto.createHash('sha256').update(bufBefore).digest('hex');

    const p1CachedRes = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/preview/frame?f=270`);
    assert.equal(p1CachedRes.status, 200);
    assert.equal(p1CachedRes.headers.get('x-preview-cached'), '1');

    // 3. Edit scene + shot parameter -> warm update -> frame 270 pixel SHA-256 MUST change!
    const patchRes = await fetch(`${api.baseUrl}/api/projects/${project.projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneOverrides: {
          signTitle: 'QUANG TRUONG',
          lightingPreset: 'nightPlaza',
          parcelColor: 'teal',
        },
        shotOverrides: [
          {
            shotId: 'deliver',
            cameraPreset: 'closeup',
            lightingPreset: 'nightPlaza',
            expression: 'smile',
            pose: 'wave',
          },
        ],
      }),
    });
    assert.equal(patchRes.status, 200);
    const { project: patched } = await patchRes.json();
    assert.notEqual(patched.renderHash, project.renderHash);

    const p2Res = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/preview/frame?f=270`);
    assert.equal(p2Res.status, 200);
    const bufAfter = Buffer.from(await p2Res.arrayBuffer());
    const shaAfter = crypto.createHash('sha256').update(bufAfter).digest('hex');
    assert.notEqual(shaAfter, shaBefore, 'Real UI/API parameter edit must change rendered pixel SHA-256');
    assert.equal(api.services.previewManager.getStats().sessionSpawns, 1, 'Preview session must stay warm across edits');

    // 4. Upload 12s voiceover -> TIMING_DURATION_MISMATCH must block job enqueue
    const longWav = makeActivePcm16Wav(11.5);
    const upLong = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/assets/voiceover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'X-Filename': 'too_long.wav',
      },
      body: longWav,
    });
    assert.equal(upLong.status, 200);
    const upLongBody = await upLong.json();
    assert.equal(upLongBody.timing.syncMode, 'conflict');

    const blockedJobRes = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full' }),
    });
    assert.equal(blockedJobRes.status, 409);
    const blockedJobJson = await blockedJobRes.json();
    assert.equal(blockedJobJson.code, 'TIMING_DURATION_MISMATCH');

    // 5. Upload valid 1.5s voiceover (45 frames @ 30fps)
    const validWav = makeActivePcm16Wav(1.5);
    const upOk = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/assets/voiceover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'X-Filename': 'voice_1500ms.wav',
      },
      body: validWav,
    });
    assert.equal(upOk.status, 200);
    const upOkBody = await upOk.json();
    assert.equal(upOkBody.project.durationFrames, 45);
    assert.equal(upOkBody.timing.syncMode, 'matched_voiceover');

    // 6. Test job cancellation cleanly on active full render
    const cancelEnqueue = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full', workers: 2 }),
    });
    assert.equal(cancelEnqueue.status, 202);
    const { job: jobToCancel } = await cancelEnqueue.json();
    createdJobIds.push(jobToCancel.jobId);

    // Wait briefly so render_parallel enters frames stage, then cancel
    let cancelPolls = 0;
    while (cancelPolls < 40) {
      await new Promise((r) => setTimeout(r, 250));
      const jState = await (await fetch(`${api.baseUrl}/api/jobs/${jobToCancel.jobId}`)).json();
      if (jState.job.stage === 'frames') break;
      cancelPolls += 1;
    }

    const cancelRes = await fetch(`${api.baseUrl}/api/jobs/${jobToCancel.jobId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(cancelRes.status, 200);

    let canceledFinal = null;
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, 250));
      const s = await (await fetch(`${api.baseUrl}/api/jobs/${jobToCancel.jobId}`)).json();
      if (s.job.status === 'canceled') {
        canceledFinal = s.job;
        break;
      }
    }
    assert.ok(canceledFinal, 'Canceled job should settle to canceled state promptly');

    // 7. Run bounded 10-frame render job with real voiceover mix -> MP4 + Range + FFprobe QA PASS
    const realEnqueue = await fetch(`${api.baseUrl}/api/projects/${project.projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bounded', startFrame: 0, endFrame: 9, workers: 1 }),
    });
    assert.equal(realEnqueue.status, 202);
    const { job: realJob } = await realEnqueue.json();
    createdJobIds.push(realJob.jobId);

    let doneJob = null;
    for (let i = 0; i < 180; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
      const poll = await (await fetch(`${api.baseUrl}/api/jobs/${realJob.jobId}`)).json();
      if (['completed', 'failed', 'canceled'].includes(poll.job.status)) {
        doneJob = poll.job;
        break;
      }
    }
    assert.ok(doneJob, 'Bounded render job must reach terminal state');
    assert.equal(doneJob.status, 'completed', `Job failed: ${doneJob.error?.message}`);
    assert.equal(doneJob.completedFrames, 10);
    assert.ok(doneJob.exportSummary);

    // Verify MP4 HTTP Range streaming (206 Partial Content) + full fetch + QA report
    const mp4Url = `${api.baseUrl}${doneJob.exportSummary.videoUrl}`;
    const rangeRes = await fetch(mp4Url, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(rangeRes.status, 206);
    assert.equal((await rangeRes.arrayBuffer()).byteLength, 1024);

    const qaRes = await fetch(`${api.baseUrl}${doneJob.exportSummary.qaUrl}`);
    assert.equal(qaRes.status, 200);
    const { qa } = await qaRes.json();
    assert.equal(qa.overallStatus, 'PASS');
    assert.equal(qa.ffprobe.width, 1080);
    assert.equal(qa.ffprobe.height, 1920);
    assert.equal(qa.ffprobe.pix_fmt, 'yuv420p');
    assert.equal(qa.ffprobe.audio_codec, 'aac');
    const humanGate = qa.gates.find((g) => g.id === 'human_visual_review');
    assert.equal(humanGate.status, 'UNVERIFIED');
  } finally {
    await api.close();
    for (const id of createdIds) {
      const pDir = path.join(ROOT, 'workspace', 'projects', id);
      if (fs.existsSync(pDir)) {
        fs.rmSync(pDir, { recursive: true, force: true });
      }
    }
    for (const jid of createdJobIds) {
      const jFile = path.join(ROOT, 'workspace', 'jobs', `${jid}.json`);
      if (fs.existsSync(jFile)) {
        fs.unlinkSync(jFile);
      }
    }
  }
});
