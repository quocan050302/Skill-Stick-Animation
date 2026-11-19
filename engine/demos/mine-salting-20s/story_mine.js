/**
 * Pure frame-driven 20-second (600 frames @ 30fps) storyboard for How Mine Salting Worked.
 *
 * Provenance: NEW IMPLEMENTATION (SHORT-03A), synchronized frame-for-frame to real local
 * Windows SAPI5 English narration (`workspace/cache/mine_audio/mine_audio_manifest.json`)
 * and powered by reusable `/visual/camera_director.js` + `/visual/look_profiles.js`.
 */

import * as Visual from '/visual/index.js';

export const FPS = 30;
export const TOTAL = 600;

export const SHOTS = [
  { id: 'hook', a: 0, b: 93, light: 'mineLantern' },
  { id: 'secret', a: 94, b: 204, light: 'mineLantern' },
  { id: 'test', a: 205, b: 292, light: 'mineLantern' },
  { id: 'belief', a: 293, b: 383, light: 'warmInterior' },
  { id: 'check', a: 384, b: 478, light: 'mineLantern' },
  { id: 'payoff', a: 479, b: 599, light: 'mineExitDaylight' },
];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (f, a, b) => clamp((f - a) / Math.max(1e-4, b - a));
const smooth = (t) => {
  const c = clamp(t);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const blinkAt = (f, seed = 9) => {
  const per = 44 + (seed * 11) % 21;
  const ph = (f + seed * 5) % per;
  return ph < 2 ? 0.5 : ph < 4 ? 1 : 0;
};

function activeOverrides() {
  const ov = typeof globalThis !== 'undefined' ? globalThis.__STUDIO_OVERRIDES__ : null;
  return ov && typeof ov === 'object' ? ov : null;
}

function shotOverrideFor(id) {
  const ov = activeOverrides();
  const s = ov?.shots && typeof ov.shots === 'object' ? ov.shots[id] : null;
  return s && typeof s === 'object' ? s : null;
}

export function shotAt(f) {
  return SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
}

export function lightFor(S) {
  const ov = activeOverrides();
  const scenePreset = ov?.scene?.lightingPreset;
  const shotLight = shotOverrideFor(S.id)?.lightingPreset;
  const key =
    shotLight && shotLight !== 'default'
      ? shotLight
      : scenePreset && scenePreset !== 'auto'
        ? scenePreset
        : S.light;
  return Visual.getLookProfile(key);
}

const CAMERA_KEYS = [
  // Shot 1: Hook (both Investor & Swindler + gold vein completely inside 9:16 margins)
  { f: 0, pos: [-0.05, 1.62, 5.45], look: [0.05, 1.25, 0.25], fov: 44, shadowAt: [0, 1.0, 0.4] },
  { f: 93, pos: [0.02, 1.56, 4.95], look: [0.05, 1.22, 0.20], fov: 42, shadowAt: [0, 1.0, 0.4] },

  // Shot 2: Secret brushing gold flakes onto barren right wall
  { f: 94, cut: true, pos: [-0.15, 1.52, 2.55], look: [1.75, 1.25, -1.55], fov: 42, shadowAt: [1.5, 1.0, -1.5] },
  { f: 204, pos: [0.15, 1.48, 2.05], look: [1.85, 1.25, -1.55], fov: 40, shadowAt: [1.6, 1.0, -1.6] },

  // Shot 3: Test sample sack doctoring at bench (frames bench scale/sack left + Swindler pouring right)
  { f: 205, cut: true, pos: [0.15, 1.58, 3.35], look: [-0.45, 1.18, -0.25], fov: 42, shadowAt: [-0.5, 0.9, -0.3] },
  { f: 292, pos: [-0.05, 1.54, 2.85], look: [-0.55, 1.15, -0.22], fov: 40, shadowAt: [-0.6, 0.9, -0.3] },

  // Shot 4: Belief — brass assay scale spikes HIGH GRADE + Investor celebrates
  { f: 293, cut: true, pos: [-0.08, 1.60, 4.45], look: [-0.15, 1.22, -0.35], fov: 46, shadowAt: [-0.2, 1.0, -0.3] },
  { f: 383, pos: [-0.12, 1.56, 3.95], look: [-0.18, 1.22, -0.35], fov: 44, shadowAt: [-0.2, 1.0, -0.3] },

  // Shot 5: Check — blind deep bedrock chisel check exposes empty rock
  { f: 384, cut: true, pos: [-0.02, 1.56, 0.75], look: [0.05, 1.22, -4.35], fov: 46, shadowAt: [0.1, 1.0, -4.3] },
  { f: 478, pos: [0.02, 1.52, 0.25], look: [0.08, 1.22, -4.35], fov: 44, shadowAt: [0.1, 1.0, -4.3] },

  // Shot 6: Payoff — gold was real, mine was empty (wide chiaroscuro contrast inside safe margins)
  { f: 479, cut: true, pos: [0.02, 1.66, 4.65], look: [0.0, 1.26, -0.55], fov: 45, shadowAt: [0.0, 1.0, 0.0] },
  { f: 599, pos: [0.08, 1.72, 5.15], look: [0.0, 1.26, -0.65], fov: 47, shadowAt: [0.0, 1.0, 0.0] },
];

const MINE_BOUNDS = { min: [-2.2, 0.95, -5.0], max: [2.2, 2.9, 5.65] };

export function camAt(f) {
  const S = shotAt(f);
  const t = (f - S.a) / Math.max(1, S.b - S.a);
  let cam = Visual.evaluateCameraKeys(CAMERA_KEYS, f, MINE_BOUNDS);
  cam = Visual.applyPushIn(cam, t, S.id === 'payoff' ? -0.15 : 0.18);

  // Timed physical camera impact kicks synced directly to audio transient events
  if (f >= 217 && f <= 245) {
    // 3 nugget drops at 7.25s, 7.53s, 7.81s (f = 218, 226, 234)
    for (const kickF of [218, 226, 234]) {
      if (f >= kickF && f <= kickF + 8) {
        cam = Visual.applyImpactKick(cam, (f - kickF) / FPS, 0.25);
      }
    }
  } else if (f >= 319 && f <= 345) {
    // Assay scale beam slam (f = 319)
    cam = Visual.applyImpactKick(cam, (f - 319) / FPS, 0.72);
  } else if (f >= 411 && f <= 450) {
    // Chisel blows on deep bedrock (f = 411, f = 430)
    for (const kickF of [411, 430]) {
      if (f >= kickF && f <= kickF + 14) {
        cam = Visual.applyImpactKick(cam, (f - kickF) / FPS, 0.55);
      }
    }
  }

  // Studio cameraPreset override support
  const preset = shotOverrideFor(S.id)?.cameraPreset;
  if (preset === 'closeup') {
    cam = Visual.applyPushIn(cam, 1.0, 0.72);
    cam.fov = Math.max(29, cam.fov - 5);
  } else if (preset === 'wide') {
    cam = Visual.applyPushIn(cam, 1.0, -0.65);
    cam.fov = Math.min(50, cam.fov + 5);
  } else if (preset === 'dutchTilt') {
    cam.roll = (cam.roll || 0) + 6.0;
  }

  cam.shadowAt = S.id === 'check' ? [0.4, 1.0, -4.5] : S.id === 'secret' ? [1.6, 1.0, -1.6] : S.id === 'test' || S.id === 'belief' ? [-1.0, 0.9, -0.3] : [0, 1.0, 0.4];
  return cam;
}

export function dofAt(f) {
  const S = shotAt(f);
  const ov = activeOverrides();
  const str = ov?.scene?.dofStrength;
  const mul = str === 'off' ? 0 : str === 'soft' ? 0.55 : str === 'strong' ? 1.65 : 1.0;

  let base = { focus: 4.75, cinf: 4.0, near: 0.85 };
  if (S.id === 'hook') base = { focus: 4.72, cinf: 4.2, near: 0.85 };
  else if (S.id === 'secret') base = { focus: 3.85, cinf: 5.5, near: 0.95 };
  else if (S.id === 'test') base = { focus: 3.35, cinf: 6.2, near: 0.95 };
  else if (S.id === 'belief') base = { focus: 4.65, cinf: 4.8, near: 0.90 };
  else if (S.id === 'check') base = { focus: 4.92, cinf: 5.0, near: 0.90 };
  else if (S.id === 'payoff') base = { focus: 4.15, cinf: 4.0, near: 0.85 };

  return { focus: base.focus, cinf: base.cinf * mul, near: base.near };
}

export function worldAt(f) {
  // Gold dust painted onto secret rock wall builds in Shot 2 and stays visible afterward
  const secretBrushProgress = f < 108 ? 0 : f <= 176 ? smooth(ramp(f, 108, 176)) : 1.0;
  // Hook displays an already-dusted rock glint before flashing back to "Earlier..."
  const wallGoldVisible = f <= 93 ? 1.0 : secretBrushProgress;

  // Rigged pouch nugget count / bulge (builds during Shot 3)
  const pouchGoldLevel = f <= 93 ? 1.0 : f < 214 ? 0.15 : f <= 265 ? lerp(0.15, 1.0, smooth(ramp(f, 214, 265))) : 1.0;

  // Assay balance scale tilt: positive = left (SAMPLE #1 rigged side) drops heavy/RICH!
  let scaleTilt = 0.0;
  let dialValue = 0.0;
  if (f <= 93) {
    scaleTilt = 0.25;
    dialValue = 0.35;
  } else if (f >= 312 && f <= 383) {
    const impact = ramp(f, 312, 326);
    const bounce = f > 319 && f < 345 ? Math.sin((f - 319) * 0.6) * Math.exp(-(f - 319) * 0.12) * 0.18 : 0;
    scaleTilt = smooth(impact) * 0.85 + bounce;
    dialValue = smooth(impact) * 0.94 + bounce * 0.2;
  } else if (f >= 445 && f <= 478) {
    // Check core sits level near zero!
    scaleTilt = -0.18 * smooth(ramp(f, 445, 465));
    dialValue = 0.02;
  } else if (f >= 479) {
    scaleTilt = lerp(0.45, 0.0, smooth(ramp(f, 479, 535)));
    dialValue = 0.04;
  }

  // Lantern subtle warm flicker (seeded smooth wave, zero erratic strobe)
  const lanternFlicker = 0.95 + 0.05 * Math.sin(f * 0.28) + 0.025 * Math.sin(f * 0.73);
  const lanternSwing = Math.sin(f * 0.09) * 0.08 + (f >= 319 && f <= 355 ? Math.sin((f - 319) * 0.4) * Math.exp(-(f - 319) * 0.08) * 0.22 : 0);

  return {
    wallGoldVisible,
    pouchGoldLevel,
    scaleTilt,
    dialValue,
    flicker: lanternFlicker,
    lanternSwing,
    showRawWallCoreHole: f >= 411,
  };
}

export function actorsAt(f, Cast) {
  const S = shotAt(f);
  const ov = shotOverrideFor(S.id) || {};
  const exprOv = ov.expression && ov.expression !== 'default' ? ov.expression : null;
  const poseOv = ov.pose && ov.pose !== 'default' ? ov.pose : null;
  const list = [];

  if (S.id === 'hook') {
    const u = ramp(f, 0, 93);
    const phase = (f * 0.025) % 1;
    const bounce = Math.abs(Math.sin(f * 0.14)) * 0.04;
    list.push({
      id: 'investor',
      key: `inv:hook:${Math.round(u * 20)}:${blinkAt(f, 3)}:${exprOv || 'laugh'}:${poseOv || ''}`,
      x: -0.52,
      y: bounce,
      z: 0.72,
      s: 1.0,
      role: 'investor',
      facePointOffset: [0, 1.62, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'investor', {
          mode: 'stand',
          facing: 1,
          expr: exprOv || (f < 25 ? 'shock' : 'laugh'),
          studioPose: poseOv,
          handProp: 'lantern',
          wave: poseOv ? undefined : 0.45 + 0.25 * Math.sin(f * 0.18),
          phase,
          blink: blinkAt(f, 3),
          tilt: 3 * Math.sin(f * 0.12),
        }),
    });
    list.push({
      id: 'swindler',
      key: `swi:hook:${Math.round(u * 20)}:${blinkAt(f, 7)}:${exprOv || 'grin'}:${poseOv || ''}`,
      x: 0.56,
      y: 0,
      z: 0.55,
      s: 1.0,
      role: 'swindler',
      facePointOffset: [0, 1.60, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: -1,
          expr: exprOv || 'grin',
          studioPose: poseOv,
          handProp: 'point',
          reachX: 0.35,
          reachY: -0.2,
          phase,
          blink: blinkAt(f, 7),
          tilt: -4,
        }),
    });
  } else if (S.id === 'secret') {
    // Antic f=94..108: look nervously left -> Action f=109..178: brush gold -> Follow-through f=179..204
    const phase = (f * 0.03) % 1;
    const isAntic = f < 109;
    const isStroke = f >= 109 && f <= 178;
    const brushT = isStroke ? (f - 109) / 14 : 0;
    const reachX = isStroke ? 0.55 + 0.32 * Math.sin(brushT * Math.PI * 2) : isAntic ? 0.15 : 0.1;
    const reachY = isStroke ? -0.45 + 0.35 * Math.cos(brushT * Math.PI * 2) : -0.1;
    const look = isAntic ? -0.8 : f > 180 ? -0.6 : 0.7;
    const expr = exprOv || (isAntic || f > 182 ? 'nervous' : 'smile');

    list.push({
      id: 'swindler',
      key: `swi:secret:${Math.round(f / 2)}:${expr}:${poseOv || ''}`,
      x: 1.24,
      y: 0,
      z: -1.45,
      s: 1.02,
      role: 'swindler',
      facePointOffset: [0, 1.56, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: 1,
          expr,
          studioPose: poseOv,
          handProp: 'brush',
          actionT: brushT,
          reachX,
          reachY,
          look,
          phase,
          blink: blinkAt(f, 11),
          tilt: isStroke ? 10 : -5,
          headTilt: isAntic ? -10 : 6,
          sweat: isAntic || f > 180,
        }),
    });
  } else if (S.id === 'test') {
    const phase = (f * 0.03) % 1;
    const pourProg = smooth(ramp(f, 212, 272));
    list.push({
      id: 'swindler',
      key: `swi:test:${Math.round(f / 2)}:${exprOv || 'smile'}:${poseOv || ''}`,
      x: -0.18,
      y: 0,
      z: -0.45,
      s: 1.04,
      role: 'swindler',
      facePointOffset: [0, 1.58, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: -1,
          expr: exprOv || (f < 218 ? 'nervous' : 'smile'),
          studioPose: poseOv,
          handProp: 'nuggetPour',
          actionT: pourProg,
          reachX: -0.42,
          reachY: -0.05,
          look: -0.4,
          phase,
          blink: blinkAt(f, 13),
          tilt: -9,
          headTilt: -6,
        }),
    });
  } else if (S.id === 'belief') {
    const phase = (f * 0.025) % 1;
    const reactJump = f >= 319 ? Math.abs(Math.sin((f - 319) * 0.25)) * Math.exp(-(f - 319) * 0.04) * 0.14 : 0;
    list.push({
      id: 'investor',
      key: `inv:belief:${Math.round(f / 2)}:${exprOv || ''}:${poseOv || ''}`,
      x: -0.02,
      y: reactJump,
      z: -0.82,
      s: 1.0,
      role: 'investor',
      facePointOffset: [0, 1.62, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'investor', {
          mode: 'stand',
          facing: -1,
          expr: exprOv || (f < 316 ? 'neutral' : 'laugh'),
          studioPose: poseOv,
          handProp: f < 318 ? 'magnifier' : null,
          wave: poseOv ? undefined : f >= 318 ? 0.65 + 0.3 * Math.sin(f * 0.35) : undefined,
          phase,
          blink: blinkAt(f, 19),
          tilt: f >= 319 ? -5 : 4,
        }),
    });
    list.push({
      id: 'swindler',
      key: `swi:belief:${Math.round(f / 3)}:${exprOv || ''}:${poseOv || ''}`,
      x: 0.56,
      y: 0,
      z: -0.62,
      s: 1.0,
      role: 'swindler',
      facePointOffset: [0, 1.58, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: -1,
          expr: exprOv || 'grin',
          studioPose: poseOv,
          handProp: 'point',
          reachX: -0.25,
          reachY: -0.15,
          phase,
          blink: blinkAt(f, 23),
        }),
    });
  } else if (S.id === 'check') {
    const phase = (f * 0.035) % 1;
    // Strike chisel TWICE: f=395..420 & f=420..442, then inspect with magnifier (443..478)
    let strikeT = 0;
    let handProp = 'chisel';
    let expr = 'stern';
    if (f <= 418) strikeT = clamp((f - 398) / 14);
    else if (f <= 440) strikeT = clamp((f - 420) / 11);
    else {
      handProp = 'magnifier';
      expr = f > 452 ? 'stern' : 'shock';
    }
    const moveX = f < 402 ? lerp(0.18, 0.45, smooth(ramp(f, 384, 402))) : 0.45;
    const mode = f < 400 ? 'stroll' : 'stand';

    list.push({
      id: 'investor',
      key: `inv:check:${Math.round(f / 2)}:${exprOv || expr}:${poseOv || ''}`,
      x: moveX,
      y: 0,
      z: -4.25,
      s: 1.0,
      role: 'investor',
      facePointOffset: [0, 1.62, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'investor', {
          mode,
          facing: 1,
          expr: exprOv || expr,
          studioPose: poseOv,
          handProp,
          actionT: strikeT,
          reachX: 0.35,
          reachY: -0.35 + strikeT * 0.4,
          phase,
          blink: blinkAt(f, 29),
          tilt: 8 * strikeT,
        }),
    });
    list.push({
      id: 'swindler',
      key: `swi:check:${Math.round(f / 3)}:${exprOv || ''}:${poseOv || ''}`,
      x: -0.45,
      y: 0,
      z: -4.05,
      s: 1.0,
      role: 'swindler',
      facePointOffset: [0, 1.56, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: 1,
          expr: exprOv || 'nervous',
          studioPose: poseOv,
          phase,
          blink: f > 430 ? 0.5 : blinkAt(f, 31),
          tilt: -6,
          sweat: true,
        }),
    });
  } else {
    // Payoff: f=479..599 dramatic framing around rigged gold vs barren gray tunnel
    const phase = (f * 0.02) % 1;
    list.push({
      id: 'investor',
      key: `inv:payoff:${Math.round(f / 4)}:${exprOv || ''}:${poseOv || ''}`,
      x: -0.22,
      y: 0,
      z: 0.65,
      s: 1.0,
      role: 'investor',
      facePointOffset: [0, 1.62, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'investor', {
          mode: 'stand',
          facing: 1,
          expr: exprOv || 'stern',
          studioPose: poseOv,
          handProp: 'point',
          reachX: 0.45,
          reachY: -0.25,
          phase,
          blink: blinkAt(f, 37),
          tilt: -3,
        }),
    });
    list.push({
      id: 'swindler',
      key: `swi:payoff:${Math.round(f / 4)}:${exprOv || ''}:${poseOv || ''}`,
      x: 0.68,
      y: 0,
      z: 0.48,
      s: 0.98,
      role: 'swindler',
      facePointOffset: [0, 1.55, 0],
      draw: (p) =>
        Cast.drawMineCharacter(p, 'swindler', {
          mode: 'stand',
          facing: -1,
          expr: exprOv || 'nervous',
          studioPose: poseOv,
          phase,
          blink: 0.5,
          tilt: 8,
          headTilt: 5,
          sweat: true,
        }),
    });
  }

  return list;
}

export function fxAt(f, Cast) {
  const out = [];
  // Hook golden glint burst right on gold-dusted boulder!
  if (f >= 8 && f <= 52) {
    const t = ramp(f, 8, 52);
    out.push({
      key: `fx:glint:${Math.round(t * 25)}`,
      x: 1.02,
      y: 0.95,
      z: 1.28,
      s: 0.58,
      order: 6,
      shadow: false,
      blob: false,
      draw: (p) => Cast.drawGlintFx(p, t),
    });
  }
  // Belief celebration coins bursting over brass scale!
  if (f >= 319 && f <= 372) {
    const t = ramp(f, 319, 372);
    out.push({
      key: `fx:profit:${Math.round(t * 25)}`,
      x: -0.78,
      y: 1.72,
      z: -0.15,
      s: 0.65,
      order: 6,
      shadow: false,
      blob: false,
      draw: (p) => Cast.drawProfitFx(p, t),
    });
  }
  // Check chisel impact dust puffs!
  if (f >= 411 && f <= 448) {
    const t = ramp(f, 411, 448);
    out.push({
      key: `fx:puff:${Math.round(t * 18)}`,
      x: 0.68,
      y: 1.05,
      z: -4.45,
      s: 0.7,
      order: 6,
      shadow: false,
      blob: false,
      draw: (p) => Cast.fxPuff(p, t),
    });
  }
  // Check crisp "0% ORE" visual punch centered above Investor!
  if (f >= 446 && f <= 478) {
    const t = ramp(f, 446, 478);
    out.push({
      key: `fx:zero:${Math.round(t * 16)}`,
      x: 0.25,
      y: 2.02,
      z: -4.2,
      s: 0.68,
      order: 6,
      shadow: false,
      blob: false,
      draw: (p) => Cast.drawZeroPercentFx(p, t),
    });
  }
  return out;
}
