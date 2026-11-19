/**
 * Pure frame-driven 10-second (300 frames @ 30fps) story for the Convenience Store Zombie proof.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored test fixture for SHORT-01 Phase 7).
 * Not niche-locked; demonstrates clean extensibility of the 2D-card + 3D-world 9:16 architecture.
 */

export const FPS = 30;
export const TOTAL = 300; // Exact 10.00 seconds at 30 fps

export const SHOTS = [
  { id: 'enter', a: 0, b: 74, light: 'storeBright' },
  { id: 'empty', a: 75, b: 154, light: 'storeBright' },
  { id: 'react', a: 155, b: 219, light: 'dramaticBlue' },
  { id: 'bump', a: 220, b: 299, light: 'storePayoff' },
];

function activeOverrides() {
  const ov = typeof globalThis !== 'undefined' ? globalThis.__STUDIO_OVERRIDES__ : null;
  return ov && typeof ov === 'object' ? ov : null;
}

function shotOverrideFor(shotId) {
  const ov = activeOverrides();
  const s = ov?.shots && typeof ov.shots === 'object' ? ov.shots[shotId] : null;
  return s && typeof s === 'object' ? s : null;
}

export const shotAt = (f) => {
  const base = SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
  const ov = activeOverrides();
  const so = shotOverrideFor(base.id);
  const candidate =
    (so?.lightingPreset && so.lightingPreset !== 'default' && LIGHTS[so.lightingPreset]
      ? so.lightingPreset
      : null) ||
    (ov?.scene?.lightingPreset && ov.scene.lightingPreset !== 'auto' && LIGHTS[ov.scene.lightingPreset]
      ? ov.scene.lightingPreset
      : null);
  return candidate ? { ...base, light: candidate } : base;
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));
const smooth = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const blinkAt = (f, seed = 7) => {
  const per = 42 + (seed * 13) % 23;
  const ph = (f + seed * 9) % per;
  return ph < 2 ? 0.5 : ph < 4 ? 1 : 0;
};

export const LIGHTS = {
  storeBright: {
    az: 130, el: 58, sky: '#f4f9ff', ground: '#b6c4ba', hemi: 1.35, sun: '#fff9ed', sunI: 2.1,
    fog: '#eef5f4', fogNear: 18, fogFar: 65, skyTop: '#9cd6f0', skyHor: '#eef7fb',
    sat: 1.12, gain: '#ffffff', lift: '#000000', vig: 0.16, shadowExt: 14,
  },
  dramaticBlue: {
    az: 45, el: 40, sky: '#9ab9e6', ground: '#5e5370', hemi: 1.0, sun: '#ffd399', sunI: 2.4,
    fog: '#c9d7ea', fogNear: 14, fogFar: 55, skyTop: '#4e6c9e', skyHor: '#a4b9d9',
    sat: 1.18, gain: '#f5f2ff', lift: '#020208', vig: 0.28, shadowExt: 12,
  },
  storePayoff: {
    az: 120, el: 55, sky: '#fff6e8', ground: '#c2bca4', hemi: 1.32, sun: '#fff3d6', sunI: 2.25,
    fog: '#f4f5ee', fogNear: 18, fogFar: 65, skyTop: '#a8dcf2', skyHor: '#f7f7eb',
    sat: 1.15, gain: '#fffdf7', lift: '#000000', vig: 0.18, shadowExt: 14,
  },
};

export const lightFor = (S) => ({ ...LIGHTS[S.light] });

const CAMS = {
  // Frame 0: immediate hook MCU of happy zombie bursting through sliding glass doors under "24/7 SNACKS"
  enter: [
    { f: 0, pos: [-2.1, 1.48, 3.2], look: [-3.2, 1.35, 0.2], fov: 36, roll: 0 },
    { f: 16, pos: [-1.8, 1.56, 3.6], look: [-2.5, 1.38, 0.0], fov: 38, roll: 0 },
    { f: 74, pos: [-3.9, 2.35, 5.4], look: [0.8, 1.35, -0.4], fov: 44, roll: 0 },
  ],
  // Shot 2: wide aisle reveal showing Bloop + empty "SOLD OUT!" snack shelf together -> push in
  empty: [
    { f: 75, pos: [-2.0, 2.05, 5.2], look: [2.7, 1.45, -1.4], fov: 44, roll: 0 },
    { f: 118, pos: [-0.8, 1.85, 4.4], look: [3.0, 1.48, -1.5], fov: 42, roll: 0 },
    { f: 154, pos: [0.3, 1.72, 3.6], look: [3.3, 1.52, -1.6], fov: 38, roll: -1.5 },
  ],
  // Shot 3: dramatic reaction close-up with roll and shallow DOF
  react: [
    { f: 155, pos: [0.65, 1.52, 2.65], look: [1.65, 1.40, -0.35], fov: 31, roll: -2.0 },
    { f: 192, pos: [0.95, 1.48, 2.15], look: [1.65, 1.42, -0.35], fov: 28, roll: -4.2 },
    { f: 219, pos: [0.55, 1.55, 2.75], look: [1.95, 1.35, -0.2], fov: 33, roll: -1.5 },
  ],
  // Shot 4: physical cause/effect basket bump -> tumbling baskets & rolling cans -> falling MEGA CHIPS payoff!
  bump: [
    { f: 220, pos: [-0.8, 1.95, 4.4], look: [2.4, 1.15, -0.2], fov: 42, roll: 0 },
    { f: 248, pos: [-0.2, 1.65, 4.1], look: [2.8, 1.10, 0.2], fov: 40, roll: 1.5 },
    { f: 274, pos: [0.3, 1.58, 3.4], look: [2.1, 1.42, -0.1], fov: 36, roll: 0 },
    { f: 299, pos: [0.7, 1.52, 2.9], look: [2.05, 1.52, -0.1], fov: 33, roll: 0 },
  ],
};

const KICKS = [
  { f: 235, a: 0.055 }, // basket tower bump impact
  { f: 268, a: 0.045 }, // MEGA CHIPS bag bonks zombie's head!
];

export const camAt = (f) => {
  const S = shotAt(f);
  const K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else {
    for (let i = 0; i < K.length - 1; i++) {
      if (f >= K[i].f && f <= K[i + 1].f) {
        const t = smooth((f - K[i].f) / (K[i + 1].f - K[i].f));
        const a = K[i];
        const b = K[i + 1];
        c = {
          pos: lerp3(a.pos, b.pos, t),
          look: lerp3(a.look, b.look, t),
          fov: lerp(a.fov, b.fov, t),
          roll: lerp(a.roll || 0, b.roll || 0, t),
        };
      }
    }
  }
  for (const k of KICKS) {
    const d = f - k.f;
    if (d >= 0 && d < 7) {
      const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7);
      c.look = [c.look[0], c.look[1] + s * 2.4, c.look[2] + s * 1.6];
      c.roll = (c.roll || 0) + s * 18;
    }
  }
  // Brief comic flash on dramatic lighting cut
  c.flash = f >= 155 && f < 158 ? 0.25 * (1 - (f - 155) / 3) : 0;
  c.shadowAt = [1.5, 1.0, 0];

  const so = shotOverrideFor(S.id);
  if (so?.cameraPreset === 'closeup') {
    c.pos = lerp3(c.pos, c.look, 0.24);
    c.fov = Math.max(20, c.fov * 0.78);
  } else if (so?.cameraPreset === 'wide') {
    c.pos = lerp3(c.pos, c.look, -0.26);
    c.fov = Math.min(62, c.fov * 1.18);
  } else if (so?.cameraPreset === 'dutchTilt') {
    c.roll = (c.roll || 0) + 7.5;
  }

  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const dofAt = (f) => {
  const S = shotAt(f);
  const C = camAt(f);
  let base;
  switch (S.id) {
    case 'enter':
      base = { focus: dist(C.pos, [-3.0, 1.35, 0.2]), cinf: lerp(9, 0, smooth(ramp(f, 12, 42))), near: 1 };
      break;
    case 'empty':
      base = { focus: dist(C.pos, [4.6, 1.5, -2.0]), cinf: lerp(0, 6, smooth(ramp(f, 115, 150))), near: 1 };
      break;
    case 'react':
      base = { focus: dist(C.pos, [1.65, 1.4, -0.35]), cinf: 12, near: 1 };
      break;
    case 'bump':
      base = { focus: dist(C.pos, [2.1, 1.3, 0.0]), cinf: lerp(2, 7, smooth(ramp(f, 265, 295))), near: 1 };
      break;
    default:
      base = { focus: 6, cinf: 0, near: 1 };
  }
  const so = shotOverrideFor(S.id);
  if (so?.dofStrength === 'off') return { ...base, cinf: 0 };
  if (so?.dofStrength === 'soft') return { ...base, cinf: 5 };
  if (so?.dofStrength === 'strong') return { ...base, cinf: 14 };
  return base;
};

export const worldAt = (f) => {
  // Sliding entrance doors open smoothly as Bloop arrives
  const doorOpen = f < 30 ? easeOut(ramp(f, 0, 22)) : 1 - 0.7 * smooth(ramp(f, 45, 74));
  // Secondary motion: ceiling fan rotates continuously, SOLD OUT tag sways
  const fanAngle = f * 0.14;
  const tagSwing = Math.sin(f * 0.16) * 0.22 + (f >= 235 ? Math.exp(-(f - 235) * 0.08) * Math.sin((f - 235) * 0.6) * 0.55 : 0);
  // Basket tower bump physics (cause at f=235)
  const bumpT = f >= 235 ? (f - 235) / 30 : 0;
  // Forgotten MEGA CHIPS bag tumbles off the top shelf (f=248..268) then caught by Bloop!
  const chipDropT = f >= 248 ? clamp((f - 248) / 20) : 0;
  const chipCaught = f >= 274;
  // Fluorescent ceiling flicker during dramatic beat
  const flicker = f >= 168 && f <= 178 && f % 3 === 0 ? 0.72 : 1.0;

  return {
    doorOpen,
    fanAngle,
    tagSwing,
    bumpT,
    chipDropT,
    chipCaught,
    flicker,
  };
};

export const actorsAt = (f, cast) => {
  const S = shotAt(f);
  const tint = S.light === 'dramaticBlue' ? '#e7ecff' : '#ffffff';
  const idleBob = 0.008 * Math.sin(f * 0.15);
  const idleTilt = 1.4 * Math.sin(f * 0.08);
  const out = [];

  let x = -3.2;
  let z = 0.2;
  let opts = {
    seed: 7,
    expr: 'grin',
    blink: blinkAt(f, 7),
    look: 0.3,
    facing: 1,
    L: 'zombieWalk',
    R: 'wave',
    bob: q(idleBob, 3),
    tilt: q(idleTilt, 1),
    headTilt: q(2.5 * Math.sin(f * 0.12), 1),
    step: 0,
    wavePhase: q(f * 0.28, 1),
    holdingChips: false,
  };

  if (S.id === 'enter') {
    const walkT = smooth(ramp(f, 8, 74));
    x = lerp(-3.2, 0.2, walkT);
    z = lerp(0.2, -0.35, walkT);
    opts.step = f >= 8 ? q(((f - 8) % 18) / 18, 2) : 0;
    opts.bob = q(idleBob + (f >= 8 ? Math.abs(Math.sin(f * 0.35)) * 0.02 : 0), 3);
    opts.expr = 'grin';
    opts.L = 'zombieWalk';
    opts.R = 'wave';
  } else if (S.id === 'empty') {
    const approach = smooth(ramp(f, 75, 102));
    x = lerp(0.2, 1.65, approach);
    z = -0.35;
    opts.step = f < 102 ? q(((f - 75) % 18) / 18, 2) : 0;
    if (f < 102) {
      opts.expr = 'grin';
      opts.L = 'zombieWalk';
      opts.R = 'point';
    } else if (f < 126) {
      opts.expr = 'squint';
      opts.L = 'hang';
      opts.R = 'point';
      opts.tilt = q(4 + Math.sin(f * 0.2) * 1.5, 1);
      opts.headTilt = q(-6, 1);
    } else {
      opts.expr = 'shock';
      opts.L = 'cheek';
      opts.R = 'cheek';
      opts.blink = 0;
      opts.tilt = q(-5 + Math.sin(f * 0.6) * 2.0, 1);
    }
  } else if (S.id === 'react') {
    x = 1.65;
    z = -0.35;
    const shake = f >= 170 && f <= 200 ? Math.sin((f - 170) * 1.1) * 5.5 : 0;
    opts.expr = f < 195 ? 'shock' : 'stern';
    opts.blink = f < 195 ? 0 : blinkAt(f, 7);
    opts.L = f < 185 ? 'cheek' : 'up';
    opts.R = f < 185 ? 'cheek' : 'up';
    opts.tilt = q(shake + idleTilt, 1);
    opts.headTilt = q(-shake * 1.1, 1);
    opts.bob = q(idleBob + (f >= 185 ? Math.abs(Math.sin(f * 0.5)) * 0.025 : 0), 3);
  } else {
    // Shot 4: dramatic turn -> bump basket stack at f=235 -> bonked at f=268 -> victorious laugh!
    const stepIntoBump = smooth(ramp(f, 220, 236));
    const recoil = smooth(ramp(f, 236, 254));
    x = lerp(1.65, 2.35, stepIntoBump) - 0.3 * recoil;
    z = lerp(-0.35, 0.05, stepIntoBump) - 0.15 * recoil;
    opts.step = f < 236 ? q(((f - 220) % 14) / 14, 2) : 0;
    if (f < 235) {
      opts.expr = 'stern';
      opts.L = 'up';
      opts.R = 'bump';
      opts.tilt = q(8 * stepIntoBump, 1);
    } else if (f < 268) {
      opts.expr = 'shock';
      opts.blink = 0;
      opts.L = 'cheek';
      opts.R = 'bump';
      opts.tilt = q(-7 + Math.sin(f * 0.55) * 3, 1);
    } else if (f < 276) {
      // Bonk squash!
      opts.expr = 'shock';
      opts.blink = 1;
      opts.L = 'up';
      opts.R = 'up';
      opts.bob = -0.04;
      opts.headTilt = q(12 * Math.sin((f - 268) * 1.2), 1);
    } else {
      // Triumphant payoff holding MEGA CHIPS!
      opts.expr = 'laugh';
      opts.L = 'celebrate';
      opts.R = 'celebrate';
      opts.holdingChips = true;
      opts.bob = q(Math.abs(Math.sin((f - 276) * 0.45)) * 0.035, 3);
      opts.tilt = q(3.5 * Math.sin((f - 276) * 0.35), 1);
    }
  }

  const ov = activeOverrides();
  const so = shotOverrideFor(S.id);
  if (so?.expression && so.expression !== 'default') {
    opts.expr = so.expression;
  }
  if (so?.pose && so.pose !== 'default') {
    if (so.pose === 'celebrate' || so.pose === 'cheek' || so.pose === 'up') {
      opts.L = so.pose;
      opts.R = so.pose;
    } else {
      opts.R = so.pose;
    }
  }
  if (ov?.scene?.hoodieColor && /^#[0-9a-f]{6}$/i.test(ov.scene.hoodieColor)) {
    opts.hoodieColor = ov.scene.hoodieColor;
  }

  out.push({
    key: 'bloop:' + JSON.stringify(opts),
    draw: (p) => cast.zombieFront(p, opts),
    x,
    y: 0,
    z,
    s: 1,
    tint,
    order: 2,
  });

  return out;
};

export const fxAt = (f, cast) => {
  const out = [];
  if (f < 70) {
    const t = q((f / 35) % 1, 2);
    const x = lerp(-3.0, 0.1, smooth(ramp(f, 8, 70)));
    out.push({
      key: 'sparkle:' + t,
      draw: (p) => cast.fxSparkle(p, t),
      x,
      y: 1.45,
      z: 0.1,
      s: 0.65,
      blob: false,
      shadow: false,
      order: 5,
    });
  }
  if (f >= 132 && f <= 212) {
    const t = q(((f - 132) / 28) % 1, 2);
    out.push({
      key: 'sweat:' + t,
      draw: (p) => cast.fxSweat(p, t),
      x: 1.65,
      y: 1.35,
      z: -0.1,
      s: 0.55,
      blob: false,
      shadow: false,
      order: 5,
    });
  }
  if (f >= 235 && f < 252) {
    const k = q((f - 235) / 17, 2);
    out.push({
      key: 'bump:' + k,
      draw: (p) => cast.fxImpactBurst(p, k, 'BUMP!'),
      x: 2.95,
      y: 0.95,
      z: 0.35,
      s: 0.72,
      blob: false,
      shadow: false,
      order: 6,
    });
  }
  if (f >= 268 && f < 284) {
    const k = q((f - 268) / 16, 2);
    out.push({
      key: 'bonk:' + k,
      draw: (p) => cast.fxImpactBurst(p, k, 'BONK!'),
      x: 2.05,
      y: 1.52,
      z: 0.25,
      s: 0.56,
      blob: false,
      shadow: false,
      order: 6,
    });
  }
  if (f >= 278) {
    const t = q(((f - 278) / 22) % 1, 2);
    out.push({
      key: 'winspark:' + t,
      draw: (p) => cast.fxSparkle(p, t),
      x: 2.05,
      y: 1.85,
      z: 0.2,
      s: 0.78,
      blob: false,
      shadow: false,
      order: 6,
    });
  }
  return out;
};
