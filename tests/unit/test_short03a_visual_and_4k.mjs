/**
 * Unit & Negative QA tests for SHORT-03A (Universal Visual Foundation + Native 4K + Audio QA).
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

import {
  OUTPUT_PRESETS,
  resolveOutputPreset,
  validateProjectSpec,
  framesFromDurationSeconds,
  ContractValidationError,
} from '../../app/shared/contract.mjs';
import { TEMPLATES, computeRenderHash, validateProjectPatch } from '../../app/shared/project_schema.mjs';
import {
  evaluateAudioMixGate,
  evaluateNative4kGate,
  summarizeQAGates,
} from '../../app/server/services/qa_service.mjs';
import {
  evaluateCameraKeys,
  applyPushIn,
  applyImpactKick,
  screenProjectBounds,
} from '../../engine/visual/camera_director.js';
import { detectOcclusion, resolveStagingConflict } from '../../engine/visual/occlusion_guard.js';
import { LOOK_PROFILES, getLookProfile } from '../../engine/visual/look_profiles.js';
import { checkDiskPreflight } from '../../tools/render/frame_runner.mjs';

const ROOT = process.cwd();

test('contract supports standard 1080x1920 and native_4k 2160x3840 presets cleanly and rejects invalid aspect', () => {
  const std = resolveOutputPreset('standard');
  const uhd = resolveOutputPreset('native_4k');
  assert.equal(std.width, 1080);
  assert.equal(std.height, 1920);
  assert.equal(uhd.width, 2160);
  assert.equal(uhd.height, 3840);
  assert.equal(OUTPUT_PRESETS.native_4k.width, 2160);

  const spec4k = validateProjectSpec({
    projectId: 'p4k',
    mode: 'original_engine',
    outputPreset: 'native_4k',
  });
  assert.equal(spec4k.width, 2160);
  assert.equal(spec4k.height, 3840);
  assert.equal(framesFromDurationSeconds(20), 600);

  assert.throws(
    () => validateProjectSpec({ projectId: 'bad', mode: 'original_engine', width: 1280, height: 720 }),
    ContractValidationError
  );
});

test('project_schema includes mine-salting-20s and separates baseline vs enhanced visualFoundation renderHash', () => {
  const tpl = TEMPLATES['mine-salting-20s'];
  assert.ok(tpl);
  assert.equal(tpl.defaultDurationFrames, 600);
  assert.equal(tpl.shots.length, 6);

  const pBase = {
    projectId: 'z1',
    templateId: 'zombie-store-10s',
    durationFrames: 300,
    sceneOverrides: { visualFoundation: 'baseline' },
    shotOverrides: {},
  };
  const pEnh = {
    ...pBase,
    sceneOverrides: { visualFoundation: 'enhanced' },
  };
  assert.notEqual(computeRenderHash(pBase), computeRenderHash(pEnh));

  const patch = validateProjectPatch(
    {
      templateId: 'zombie-store-10s',
      revision: 1,
      title: 'Z',
      durationFrames: 300,
      sceneOverrides: { visualFoundation: 'baseline' },
      shotOverrides: {},
    },
    {
      revision: 1,
      sceneOverrides: { visualFoundation: 'enhanced' },
    }
  );
  assert.equal(patch.sceneOverrides.visualFoundation, 'enhanced');
});

test('Phase H negative audio QA strictly rejects fallback PASS on invalid ratio, NaN, zero RMS, or missing metrics', () => {
  // Invalid ratio (0.8 violates 0.50 +- 0.025) even with hasAudioTrack: true
  const gBadRatio = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: {
      music_measured_ratio: 0.8,
      music_measured_db_rel_narration: -1.94,
      narration_gated_rms: 0.12,
      all_samples_finite: true,
    },
  });
  assert.equal(gBadRatio.status, 'FAIL');

  // NaN metric
  const gNaN = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: {
      music_measured_ratio: Number.NaN,
      narration_gated_rms: 0.1,
    },
  });
  assert.equal(gNaN.status, 'FAIL');

  // Zero-RMS silence posing as voiceover
  const gZero = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: {
      music_measured_ratio: 0.5,
      narration_gated_rms: 0,
      all_samples_finite: true,
    },
  });
  assert.equal(gZero.status, 'FAIL');

  // Missing audioMetrics entirely when hasVoiceover is true
  const gMissing = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: null,
  });
  assert.equal(gMissing.status, 'FAIL');

  // Missing AAC track when hasVoiceover is true
  const gNoTrack = evaluateAudioMixGate({
    hasAudioTrack: false,
    hasVoiceover: true,
    audioMetrics: { music_measured_ratio: 0.5, narration_gated_rms: 0.1 },
  });
  assert.equal(gNoTrack.status, 'FAIL');

  // Synthetic no-voiceover bed -> UNVERIFIED (never misleading PASS)
  const gNoVo = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: false,
    audioMetrics: null,
  });
  assert.equal(gNoVo.status, 'UNVERIFIED');

  // Genuine valid mix -> PASS
  const gPass = evaluateAudioMixGate({
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: {
      music_measured_ratio: 0.5006,
      music_measured_db_rel_narration: -6.01,
      narration_gated_rms: 0.1016,
      all_samples_finite: true,
    },
  });
  assert.equal(gPass.status, 'PASS');

  // Check summarizeQAGates refuses overall PASS when audio_track fails
  const gates = summarizeQAGates({
    ffprobe: { ok: true, video_codec: 'h264', width: 1080, height: 1920, fps: 30, pix_fmt: 'yuv420p', faststart: true, duration_seconds: 10 },
    frame_count_on_disk: 300,
    expectedFrameCount: 300,
    frame0_qa: { ok: true, width: 1080, height: 1920, dims_ok: true, mean_luma: 0.45 },
    motion: { freeze_threshold_exceeded: false, mean_mad: 0.05 },
    freeze_black_hits: [],
    hasAudioTrack: true,
    hasVoiceover: true,
    audioMetrics: { music_measured_ratio: 0.85, narration_gated_rms: 0.1 },
  });
  assert.equal(gates.find((g) => g.id === 'audio_track').status, 'FAIL');
});

test('Native 4K QA gate rejects 1080p frames/webglProof and Python export_mp4/verify_media reject upscaled 4K', () => {
  // 1) JS evaluateNative4kGate rejects lower WebGL drawingBuffer or upscaled optical check
  const failWebgl = evaluateNative4kGate({
    outputPreset: 'native_4k',
    expectedWidth: 2160,
    expectedHeight: 3840,
    ffprobe: { width: 2160, height: 3840 },
    frame0_qa: { width: 2160, height: 3840 },
    webglProof: { nativeDrawingBufferWidth: 1080, nativeDrawingBufferHeight: 1920, upscaledFromLowerRes: false },
    detail_4k: { is_native_detail_ok: true, hf_residual_p99: 8.5 },
  });
  assert.equal(failWebgl.status, 'FAIL');

  const failOptical = evaluateNative4kGate({
    outputPreset: 'native_4k',
    expectedWidth: 2160,
    expectedHeight: 3840,
    ffprobe: { width: 2160, height: 3840 },
    frame0_qa: { width: 2160, height: 3840 },
    webglProof: { nativeDrawingBufferWidth: 2160, nativeDrawingBufferHeight: 3840, upscaledFromLowerRes: false },
    detail_4k: { is_native_detail_ok: false, hf_residual_p99: 4.0 },
  });
  assert.equal(failOptical.status, 'FAIL');

  const pass4k = evaluateNative4kGate({
    outputPreset: 'native_4k',
    expectedWidth: 2160,
    expectedHeight: 3840,
    ffprobe: { width: 2160, height: 3840 },
    frame0_qa: { width: 2160, height: 3840 },
    webglProof: { nativeDrawingBufferWidth: 2160, nativeDrawingBufferHeight: 3840, upscaledFromLowerRes: false },
    detail_4k: { is_native_detail_ok: true, hf_residual_p99: 9.2 },
  });
  assert.equal(pass4k.status, 'PASS');

  // 2) Python negative tests: export_mp4 rejects 1080p frames under 4K expectation & check_native_4k_detail fails bicubic upscale
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short03a-4k-neg-'));
  try {
    const pyCheck = `
import json, sys, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'tools', 'qa'))})
import export_mp4, verify_media

tmp = Path(${JSON.stringify(tmpDir)})
fdir = tmp / 'f1080'
fdir.mkdir(exist_ok=True)
# Create crisp 1080x1920 synthetic edge image
im1080 = Image.new('RGB', (1080, 1920), (35, 45, 60))
d = ImageDraw.Draw(im1080)
for k in range(0, 1080, 16):
    d.line([(k, 0), (k, 1920)], fill=(235, 220, 190), width=2)
im1080.save(fdir / 'frame_000000.png')

# Attempt export expecting 2160x3840 -> must raise ExportError
rejected_export = False
try:
    export_mp4.export_frames_to_mp4(fdir, tmp / 'bad.mp4', expected_width=2160, expected_height=3840)
except export_mp4.ExportError:
    rejected_export = True

# Upscale 1080 -> 2160 with bicubic -> check_native_4k_detail MUST detect upscaling (is_native_detail_ok == False)
up_path = tmp / 'upscaled_4k.png'
im1080.resize((2160, 3840), Image.Resampling.BICUBIC).save(up_path)
up_metrics = verify_media.check_native_4k_detail(up_path)

# Genuine crisp 4K single-pixel detail -> check_native_4k_detail MUST pass
nat_path = tmp / 'native_4k.png'
im4k = Image.new('RGB', (2160, 3840), (35, 45, 60))
d4 = ImageDraw.Draw(im4k)
for k in range(0, 2160, 12):
    d4.line([(k, 0), (k, 3840)], fill=(245, 235, 200), width=1)
im4k.save(nat_path)
nat_metrics = verify_media.check_native_4k_detail(nat_path)

print(json.dumps({
    'rejected_export': rejected_export,
    'up_ok': up_metrics['is_native_detail_ok'],
    'nat_ok': nat_metrics['is_native_detail_ok'],
    'up_p99': up_metrics['hf_residual_p99'],
    'nat_p99': nat_metrics['hf_residual_p99'],
}))
`;
    const out = JSON.parse(execFileSync('python', ['-c', pyCheck], { cwd: ROOT }).toString());
    assert.equal(out.rejected_export, true);
    assert.equal(out.up_ok, false);
    assert.equal(out.nat_ok, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('disk preflight guard rejects insufficient headroom for large 4K renders', () => {
  assert.throws(
    () =>
      checkDiskPreflight(ROOT, {
        estimatedBytes: 250 * 1024 * 1024,
        lowWatermarkBytes: 999999 * 1024 * 1024 * 1024,
      }),
    /disk space/i
  );
});

test('camera_director & occlusion_guard detect and resolve blocking foreground geometry cleanly', () => {
  assert.ok(LOOK_PROFILES.mineLantern);
  assert.equal(getLookProfile('mineLantern').id, 'mineLantern');

  const keys = [
    { f: 0, pos: [0, 1.5, 4.0], look: [0, 1.4, 0], fov: 40 },
    { f: 30, pos: [0, 1.5, 3.0], look: [0, 1.4, 0], fov: 38 },
  ];
  const mid = evaluateCameraKeys(keys, 15);
  assert.equal(Math.round(mid.pos[2] * 100), 350);
  const pushed = applyPushIn(mid, 1.0, 0.5);
  assert.ok(pushed.pos[2] < mid.pos[2]);
  const kicked = applyImpactKick(mid, 0.04, 1.0);
  assert.notEqual(kicked.roll, mid.roll);

  // Synthetic Three.js scene with a pillar blocking camera-to-face ray
  const cam = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.05, 100);
  cam.position.set(0, 1.5, 4.0);
  cam.lookAt(0, 1.5, 0);
  cam.updateMatrixWorld();

  const blocker = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.5), new THREE.MeshBasicMaterial());
  blocker.position.set(0, 1.5, 2.0);
  blocker.name = 'testTimberPillar';
  blocker.userData.nonEssentialProp = true;
  blocker.updateMatrixWorld();

  const targets = [{ id: 'hero', role: 'face', point: [0, 1.5, 0] }];
  const occ1 = detectOcclusion(cam, targets, [blocker]);
  assert.equal(occ1.anyOccluded, true);
  assert.deepEqual(occ1.blockedIds, ['hero']);

  const res = resolveStagingConflict(cam, { pos: [0, 1.5, 4.0], look: [0, 1.5, 0], fov: 42 }, targets, [blocker]);
  assert.equal(res.resolved, true);
  assert.equal(blocker.visible, false);

  const bounds = screenProjectBounds({ min: [-0.5, 0, -0.1], max: [0.5, 2.0, 0.1] }, cam, { width: 1080, height: 1920 });
  assert.equal(bounds.onScreen, true);
  assert.equal(bounds.headClipped, false);
});
