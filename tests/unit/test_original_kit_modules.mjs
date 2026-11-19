/**
 * Unit tests for motion/camera/easing/shot boundaries & deterministic RNG
 * across both the freshly authored 10s zombie story and (when locally restored)
 * the original cartoon-short-kit motion.js & story.js modules.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as ZombieStory from '../../engine/demos/zombie-10s/story_zombie.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function assertFiniteCam(cam, label) {
  assert.ok(Array.isArray(cam.pos) && cam.pos.length === 3, `${label}: pos length`);
  assert.ok(Array.isArray(cam.look) && cam.look.length === 3, `${label}: look length`);
  for (const v of [...cam.pos, ...cam.look, cam.fov, cam.roll || 0]) {
    assert.ok(Number.isFinite(v), `${label}: non-finite camera value ${v}`);
  }
  assert.ok(cam.fov > 5 && cam.fov < 120, `${label}: fov out of bounds ${cam.fov}`);
}

test('new zombie-10s story covers exact 300 frames (10.00s @ 30fps) with finite, deterministic pure state', () => {
  assert.equal(ZombieStory.FPS, 30);
  assert.equal(ZombieStory.TOTAL, 300);
  assert.equal(ZombieStory.SHOTS[0].a, 0);
  assert.equal(ZombieStory.SHOTS[ZombieStory.SHOTS.length - 1].b, 299);

  // Verify contiguous non-overlapping shot boundaries
  for (let i = 1; i < ZombieStory.SHOTS.length; i++) {
    assert.equal(ZombieStory.SHOTS[i].a, ZombieStory.SHOTS[i - 1].b + 1);
  }

  for (let f = 0; f < ZombieStory.TOTAL; f++) {
    const s = ZombieStory.shotAt(f);
    assert.ok(s && f >= s.a && f <= s.b);
    const c1 = ZombieStory.camAt(f);
    const c2 = ZombieStory.camAt(f);
    assertFiniteCam(c1, `zombie f=${f}`);
    assert.deepEqual(c1, c2, `zombie camAt(${f}) must be pure/deterministic`);
    const d = ZombieStory.dofAt(f);
    assert.ok(Number.isFinite(d.focus) && Number.isFinite(d.cinf));
    const w = ZombieStory.worldAt(f);
    assert.ok(Number.isFinite(w.doorOpen) && Number.isFinite(w.fanAngle) && Number.isFinite(w.bumpT));
  }
});

test('original kit motion.js & soldier story.js pass continuity, clamping, and determinism checks when restored locally', async () => {
  const motionPath = path.join(ROOT, 'engine', 'web', 'motion.js');
  const storyPath = path.join(ROOT, 'engine', 'web', 'story.js');
  if (!fs.existsSync(motionPath) || !fs.existsSync(storyPath)) {
    // Public repo without unlicensed kit: assert explicit local-only guard and pass cleanly
    assert.ok(!fs.existsSync(motionPath), 'local kit not restored in this environment');
    return;
  }

  const motion = await import(pathToFileURL(motionPath).href);
  const story = await import(pathToFileURL(storyPath).href);

  // Test camFromKeys clamping, smoothness, kicks, repeatability
  const keys = [
    { f: 0, pos: [0, 2, 5], look: [0, 1, 0], fov: 40, roll: 0 },
    { f: 30, pos: [4, 3, 2], look: [1, 1, 0], fov: 34, roll: 3, path: [[2, 2.5, 4]] },
  ];
  const k0 = motion.camFromKeys(keys, -5);
  assertFiniteCam(k0, 'motion clamp low');
  const kMid1 = motion.camFromKeys(keys, 15, { kicks: [{ f: 14, a: 0.05 }] });
  const kMid2 = motion.camFromKeys(keys, 15, { kicks: [{ f: 14, a: 0.05 }] });
  assertFiniteCam(kMid1, 'motion mid kick');
  assert.deepEqual(kMid1, kMid2);

  // Test idle, blinkAt, walk, q
  const id1 = motion.idle(42, 3);
  const id2 = motion.idle(42, 3);
  assert.deepEqual(id1, id2);
  assert.ok([0, 0.5, 1].includes(motion.blinkAt(12, 3)));
  const wk = motion.walk(30, 0, 1.2, 0.8);
  assert.ok(Math.abs(wk.dist - 1.2) < 1e-9);
  assert.equal(motion.q(1.23456, 2), 1.23);

  // Test Soldier story.js across all 592 frames (0..591)
  assert.equal(story.FPS, 30);
  assert.equal(story.TOTAL, 592);
  assert.equal(story.SHOTS.length, 8);
  for (let i = 1; i < story.SHOTS.length; i++) {
    assert.equal(story.SHOTS[i].a, story.SHOTS[i - 1].b + 1);
  }
  for (let f = 0; f < story.TOTAL; f++) {
    const s = story.shotAt(f);
    const cam = story.camAt(f);
    assertFiniteCam(cam, `soldier f=${f}`);
    const dof = story.dofAt(f);
    assert.ok(Number.isFinite(dof.focus) && Number.isFinite(dof.cinf));
    const lt = story.lightFor(s, f);
    assert.ok(Number.isFinite(lt.sunI) && Number.isFinite(lt.shadowExt));
    const w = story.worldAt(f);
    assert.ok(Number.isFinite(w.collapse) && Number.isFinite(w.braceFall));
  }
});
