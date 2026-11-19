/**
 * Reusable Camera Director & Screen-Space Projection Utilities (SHORT-03A).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-03A).
 * Pure math & Three.js framing utilities (safe in both Node tests and Chromium runtime).
 */

import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  const c = clamp(t);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/**
 * Evaluates keyframed camera tracks with explicit cut boundaries and world bounding safety.
 * keys item: { f, pos: [x,y,z], look: [x,y,z], fov, roll?, cut? }
 */
export function evaluateCameraKeys(keys, frame, bounds = null) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('evaluateCameraKeys requires a non-empty keyframe array.');
  }
  const f = Number(frame);
  if (f <= keys[0].f) {
    return clampCameraToBounds({ roll: 0, ...keys[0] }, bounds);
  }
  const last = keys[keys.length - 1];
  if (f >= last.f) {
    return clampCameraToBounds({ roll: 0, ...last }, bounds);
  }

  let idx = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    if (f >= keys[i].f && f <= keys[i + 1].f) {
      idx = i;
      break;
    }
  }
  const A = keys[idx];
  const B = keys[idx + 1];
  if (B.cut === true && f < B.f) {
    return clampCameraToBounds({ roll: 0, ...A }, bounds);
  }
  const span = Math.max(1e-4, B.f - A.f);
  const t = A.linear ? clamp((f - A.f) / span) : smoothstep((f - A.f) / span);

  const out = {
    pos: [lerp(A.pos[0], B.pos[0], t), lerp(A.pos[1], B.pos[1], t), lerp(A.pos[2], B.pos[2], t)],
    look: [lerp(A.look[0], B.look[0], t), lerp(A.look[1], B.look[1], t), lerp(A.look[2], B.look[2], t)],
    fov: lerp(A.fov ?? 40, B.fov ?? 40, t),
    roll: lerp(A.roll ?? 0, B.roll ?? 0, t),
    flash: lerp(A.flash ?? 0, B.flash ?? 0, t),
  };
  return clampCameraToBounds(out, bounds);
}

function clampCameraToBounds(camState, bounds) {
  if (!bounds) return camState;
  const min = bounds.min || [-100, 0.25, -100];
  const max = bounds.max || [100, 40, 100];
  return {
    ...camState,
    pos: [
      clamp(camState.pos[0], min[0], max[0]),
      clamp(camState.pos[1], min[1], max[1]),
      clamp(camState.pos[2], min[2], max[2]),
    ],
  };
}

/**
 * Applies gentle dolly push-in toward the camera's look target while keeping sightline fixed.
 */
export function applyPushIn(camState, beatProgress, distanceMeters = 0.35) {
  const u = smoothstep(beatProgress);
  const dx = camState.look[0] - camState.pos[0];
  const dy = camState.look[1] - camState.pos[1];
  const dz = camState.look[2] - camState.pos[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const shift = clamp(distanceMeters * u, -len * 0.35, len * 0.45);
  return {
    ...camState,
    pos: [
      camState.pos[0] + (dx / len) * shift,
      camState.pos[1] + (dy / len) * shift,
      camState.pos[2] + (dz / len) * shift,
    ],
  };
}

/**
 * Adds damped physical camera shake/roll & optional micro-flash after a story impact event.
 */
export function applyImpactKick(camState, elapsedSeconds, intensity = 1.0) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > 1.2) {
    return camState;
  }
  const env = Math.exp(-elapsedSeconds * 8.5) * intensity;
  const shakeX = Math.sin(elapsedSeconds * 34.0) * 0.055 * env;
  const shakeY = Math.cos(elapsedSeconds * 42.0) * 0.045 * env;
  const rollKick = Math.sin(elapsedSeconds * 26.0) * 1.4 * env;
  return {
    ...camState,
    pos: [camState.pos[0] + shakeX, camState.pos[1] + shakeY, camState.pos[2]],
    look: [camState.look[0] + shakeX * 0.5, camState.look[1] + shakeY * 0.5, camState.look[2]],
    roll: (camState.roll || 0) + rollKick,
  };
}

/**
 * Computes physical DOF focus distance from camera position to a subject/prop world point.
 */
export function resolveFocusTarget(camPos, subjectCenter, storyBeat = {}) {
  const target = storyBeat.focusPoint || subjectCenter || [0, 1.3, 0];
  const dist = Math.hypot(
    camPos[0] - target[0],
    camPos[1] - target[1],
    camPos[2] - target[2]
  );
  return {
    focus: Math.max(0.5, Number(dist.toFixed(3))),
    cinf: storyBeat.cinf ?? 6.5,
    near: storyBeat.near ?? 1.0,
    target,
  };
}

/**
 * Projects an axis-aligned 3D bounding box into 2D screen space and checks framing crops.
 */
export function screenProjectBounds(worldBounds, camera, renderSize = { width: 1080, height: 1920 }) {
  const min = worldBounds.min;
  const max = worldBounds.max;
  const W = renderSize.width || 1080;
  const H = renderSize.height || 1920;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let behindCameraCount = 0;

  const v = new THREE.Vector3();
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        v.set(x, y, z).project(camera);
        if (v.z > 1) behindCameraCount += 1;
        const px = (v.x * 0.5 + 0.5) * W;
        const py = (-v.y * 0.5 + 0.5) * H;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
    }
  }

  const clampedW = Math.max(0, Math.min(x1, W) - Math.max(x0, 0));
  const clampedH = Math.max(0, Math.min(y1, H) - Math.max(y0, 0));
  const totalW = Math.max(1e-3, x1 - x0);
  const totalH = Math.max(1e-3, y1 - y0);

  return {
    x0: Math.round(x0),
    y0: Math.round(y0),
    x1: Math.round(x1),
    y1: Math.round(y1),
    widthPx: Math.round(x1 - x0),
    heightPx: Math.round(y1 - y0),
    heightFrac: Number((clampedH / H).toFixed(3)),
    visibleFrac: behindCameraCount === 8 ? 0 : Number(((clampedW * clampedH) / (totalW * totalH)).toFixed(3)),
    headClipped: y0 < 0,
    feetClipped: y1 > H,
    sideClipped: x0 < 0 || x1 > W,
    onScreen: behindCameraCount < 8 && clampedW > 4 && clampedH > 4,
  };
}
