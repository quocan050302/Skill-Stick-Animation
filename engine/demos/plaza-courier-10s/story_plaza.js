/**
 * Pure frame-driven 10-second (300 frames @ 30fps) storyboard for Plaza Courier 10s.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Supports safe JSON parameter overrides via globalThis.__STUDIO_OVERRIDES__.
 */

export const FPS = 30;
export const TOTAL = 300;

export const SHOTS = [
  { id: 'arrive', a: 0, b: 74, light: 'morningSun' },
  { id: 'inspect', a: 75, b: 149, light: 'morningSun' },
  { id: 'hurdle', a: 150, b: 224, light: 'goldenHour' },
  { id: 'deliver', a: 225, b: 299, light: 'morningSun' },
];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));
const smooth = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const blinkAt = (f, seed = 5) => {
  const per = 40 + (seed * 13) % 23;
  const ph = (f + seed * 7) % per;
  return ph < 2 ? 0.5 : ph < 4 ? 1 : 0;
};

export const LIGHTS = {
  morningSun: {
    az: 135, el: 48, sky: '#d8ecff', ground: '#8c8872', hemi: 1.28, sun: '#fff4de', sunI: 2.35,
    fog: '#d7eaf8', fogNear: 35, fogFar: 220, skyTop: '#4e8ed8', skyHor: '#d4eafc',
    sat: 1.12, gain: '#ffffff', lift: '#000000', vig: 0.16, shadowExt: 16,
  },
  goldenHour: {
    az: 24, el: 18, sky: '#b6a3d6', ground: '#785a4a', hemi: 1.08, sun: '#ffba72', sunI: 2.65,
    fog: '#f2c59f', fogNear: 30, fogFar: 200, skyTop: '#6c68ab', skyHor: '#ffc98d',
    sat: 1.15, gain: '#fff6e9', lift: '#000000', vig: 0.24, shadowExt: 16,
  },
  nightPlaza: {
    az: 70, el: 34, sky: '#5f7bb8', ground: '#373b4f', hemi: 0.92, sun: '#b5d2ff', sunI: 1.75,
    fog: '#3d5178', fogNear: 25, fogFar: 180, skyTop: '#1c2a4d', skyHor: '#4d6599',
    sat: 1.05, gain: '#dce8ff', lift: '#04060d', vig: 0.28, shadowExt: 14,
  },
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

export const lightFor = (S) => ({ ...LIGHTS[S.light] });

const CAMS = {
  arrive: [
    { f: 0, pos: [-2.95, 1.48, 3.6], look: [-3.55, 1.45, -1.2], fov: 42, roll: 0 },
    { f: 18, pos: [-2.55, 1.56, 3.8], look: [-2.9, 1.48, -1.2], fov: 42, roll: 0 },
    { f: 74, pos: [-3.5, 2.45, 6.2], look: [0.4, 1.60, -1.2], fov: 44, roll: 0 },
  ],
  inspect: [
    { f: 75, pos: [-1.4, 2.05, 5.2], look: [1.6, 1.35, -0.4], fov: 42, roll: 0 },
    { f: 149, pos: [0.3, 1.72, 3.9], look: [2.2, 1.35, -0.4], fov: 37, roll: 0 },
  ],
  hurdle: [
    { f: 150, pos: [0.2, 1.65, 3.8], look: [2.4, 1.28, 0.1], fov: 38, roll: -1.5 },
    { f: 188, pos: [0.8, 1.52, 2.9], look: [2.3, 1.28, 0.1], fov: 34, roll: -3.8 },
    { f: 224, pos: [-0.2, 1.85, 4.4], look: [2.6, 1.25, 0.0], fov: 41, roll: 0 },
  ],
  deliver: [
    { f: 225, pos: [-0.1, 1.80, 4.3], look: [2.8, 1.30, -0.1], fov: 40, roll: 0 },
    { f: 265, pos: [0.8, 1.60, 3.5], look: [2.8, 1.40, -0.1], fov: 36, roll: 2.0 },
    { f: 299, pos: [1.2, 1.55, 3.1], look: [2.8, 1.46, -0.1], fov: 33, roll: 0 },
  ],
};

const KICKS = [{ f: 175, a: 0.05 }, { f: 256, a: 0.04 }];

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
      c.look = [c.look[0], c.look[1] + s * 2.2, c.look[2] + s * 1.4];
      c.roll = (c.roll || 0) + s * 16;
    }
  }
  c.flash = f >= 150 && f < 154 ? 0.25 * (1 - (f - 150) / 4) : 0;
  c.shadowAt = [1.0, 0.8, 0];

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
    case 'arrive':
      base = { focus: dist(C.pos, [-3.0, 1.3, 0]), cinf: lerp(8, 0, smooth(ramp(f, 15, 45))), near: 1 };
      break;
    case 'inspect':
      base = { focus: dist(C.pos, [1.5, 1.3, -0.2]), cinf: 6, near: 1 };
      break;
    case 'hurdle':
      base = { focus: dist(C.pos, [2.1, 1.3, 0]), cinf: 11, near: 1 };
      break;
    case 'deliver':
      base = { focus: dist(C.pos, [2.8, 1.4, -0.1]), cinf: lerp(3, 8, smooth(ramp(f, 250, 290))), near: 1 };
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

export const worldAt = (f) => ({
  clockMinAngle: -f * 0.06,
  clockHourAngle: -f * 0.008,
  buntingWave: f * 0.18,
  toppleT: f >= 175 ? (f - 175) / 28 : 0,
  delivered: f >= 256,
  pedestalGlow: f >= 256 ? Math.min(1, (f - 256) / 18) : 0,
});

const PARCEL_HEX = {
  coral: '#e66e4e',
  teal: '#369a94',
  gold: '#e6b13c',
};

export const actorsAt = (f, cast) => {
  const ov = activeOverrides();
  const S = shotAt(f);
  const so = shotOverrideFor(S.id);
  const tint = S.light === 'goldenHour' ? '#ffe6cb' : S.light === 'nightPlaza' ? '#cfdcff' : '#ffffff';
  const charStyle = ov?.scene?.characterStyle || 'courierKid';
  const parcelHex = PARCEL_HEX[ov?.scene?.parcelColor] || PARCEL_HEX.coral;
  const idleBob = 0.007 * Math.sin(f * 0.14);
  const idleTilt = 1.2 * Math.sin(f * 0.07);

  let x = -3.3;
  let z = 0.0;
  let opts = {
    characterStyle: charStyle,
    parcelHex,
    seed: 5,
    expr: 'grin',
    blink: blinkAt(f, 5),
    look: 0.35,
    facing: 1,
    L: 'hang',
    R: 'wave',
    bob: q(idleBob, 3),
    tilt: q(idleTilt, 1),
    headTilt: q(2.0 * Math.sin(f * 0.1), 1),
    step: 0,
    wv: q(f * 0.3, 1),
    carryingParcel: false,
  };

  if (S.id === 'arrive') {
    const t = smooth(ramp(f, 12, 74));
    x = lerp(-3.3, 0.2, t);
    z = lerp(0.0, -0.2, t);
    opts.step = f >= 12 ? q(((f - 12) % 18) / 18, 2) : 0;
    opts.bob = q(idleBob + (f >= 12 ? Math.abs(Math.sin(f * 0.35)) * 0.02 : 0), 3);
    opts.carryingParcel = true;
  } else if (S.id === 'inspect') {
    const t = smooth(ramp(f, 75, 130));
    x = lerp(0.2, 1.8, t);
    z = -0.2;
    opts.step = f < 130 ? q(((f - 75) % 18) / 18, 2) : 0;
    opts.expr = f < 120 ? 'neutral' : 'smug';
    opts.L = 'hang';
    opts.R = 'point';
    opts.carryingParcel = true;
  } else if (S.id === 'hurdle') {
    x = lerp(1.8, 2.2, smooth(ramp(f, 150, 175)));
    z = -0.2;
    opts.expr = f < 175 ? 'neutral' : 'shock';
    opts.L = f < 175 ? 'up' : 'cheek';
    opts.R = f < 175 ? 'point' : 'cheek';
    opts.tilt = q(f >= 175 ? -6 + Math.sin(f * 0.5) * 2.5 : idleTilt, 1);
    opts.carryingParcel = f < 175;
  } else {
    const t = smooth(ramp(f, 225, 256));
    x = lerp(2.2, 2.8, t);
    z = lerp(-0.2, -0.1, t);
    opts.step = f < 256 ? q(((f - 225) % 14) / 14, 2) : 0;
    if (f < 256) {
      opts.expr = 'stern';
      opts.L = 'up';
      opts.R = 'up';
    } else {
      opts.expr = 'grin';
      opts.L = 'up';
      opts.R = 'wave';
      opts.bob = q(Math.abs(Math.sin((f - 256) * 0.4)) * 0.03, 3);
    }
  }

  if (so?.expression && so.expression !== 'default') {
    opts.expr = so.expression;
  }
  if (so?.pose && so.pose !== 'default') {
    if (so.pose === 'up' || so.pose === 'cheek' || so.pose === 'celebrate') {
      const mapped = so.pose === 'celebrate' ? 'up' : so.pose;
      opts.L = mapped;
      opts.R = mapped;
    } else {
      opts.R = so.pose;
    }
  }

  return [
    {
      key: 'courier:' + JSON.stringify(opts),
      draw: (p) => cast.drawCourier(p, opts),
      x,
      y: 0,
      z,
      s: 1,
      tint,
      order: 2,
    },
  ];
};

export const fxAt = (f, cast) => {
  const out = [];
  if (f >= 150 && f < 195) {
    const t = q(((f - 150) / 30) % 1, 2);
    out.push({
      key: 'wind:' + t,
      draw: (p) => cast.fxWind(p, t),
      x: 1.9,
      y: 1.4,
      z: 0.35,
      s: 0.85,
      blob: false,
      shadow: false,
      order: 5,
    });
  }
  if (f >= 175 && f < 192) {
    const k = q((f - 175) / 17, 2);
    out.push({
      key: 'whoa:' + k,
      draw: (p) => cast.fxBumpText(p, k, 'WHOA!'),
      x: 2.35,
      y: 1.25,
      z: 0.45,
      s: 0.56,
      blob: false,
      shadow: false,
      order: 6,
    });
  }
  if (f >= 256) {
    const t = q(((f - 256) / 28) % 1, 2);
    out.push({
      key: 'star:' + t,
      draw: (p) => cast.fxDeliveryStar(p, t),
      x: 3.45,
      y: 1.15,
      z: 0.1,
      s: 0.72,
      blob: false,
      shadow: false,
      order: 6,
    });
  }
  return out;
};
