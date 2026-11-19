/**
 * Cartoon Courier cast & 2D comic FX cards for Plaza Courier 10s template.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 * Built on MIT-licensed Pen, bodyFront, KID, PARENT, RIFLEMAN, fxSparkle/fxPuff/fxBurst
 * helpers from engine/demos/lib/toonbase.js (github.com/mromidev/claude-animated-shorts).
 */

import * as TB from '/toonbase/toonbase.js';

export const Pen = TB.Pen;

const CHARACTER_PRESETS = {
  courierKid: {
    ...TB.KID,
    skin: TB.SKIN,
    jacket: '#f08a2c',
    cap: '#e2453c',
    pants: '#3b5b9a',
  },
  townParent: {
    ...TB.PARENT,
    skin: '#f5c9a0',
    jacket: '#4f7fb8',
    hair: '#4a3020',
    pants: '#333b4d',
  },
  guardCap: {
    jacket: '#2d938e',
    pants: '#34404a',
    boots: TB.INK,
    hat: 'cap',
    cap: '#f2b830',
    skin: '#ecd0b6',
    belt: '#f4f1ea',
  },
};

const VALID_TB_EXPR = new Set([
  'neutral',
  'stern',
  'grin',
  'laugh',
  'whistle',
  'nervous',
  'shock',
  'relief',
  'relief_open',
  'dazed',
  'pained',
  'smile',
  'smile_closed',
  'lick',
]);

export function drawCourier(p, opts = {}) {
  const {
    characterStyle = 'courierKid',
    expr = 'grin',
    blink = 0,
    look = 0,
    facing = 1,
    seed = 5,
    L = 'hang',
    R = 'wave',
    tilt = 0,
    headTilt = 0,
    bob = 0,
    step = 0,
    wv = 0,
    carryingParcel = false,
    parcelHex = '#e66e4e',
  } = opts;

  const mappedExpr = expr === 'smug' ? 'smile' : expr;
  const safeExpr = VALID_TB_EXPR.has(mappedExpr) ? mappedExpr : 'grin';
  const mode =
    R === 'up' || R === 'cheek' || L === 'up' || L === 'cheek'
      ? 'fall'
      : step > 0.01 || Math.abs(bob) > 0.005
        ? 'march'
        : 'stand';

  const outfit = CHARACTER_PRESETS[characterStyle] || CHARACTER_PRESETS.courierKid;
  const bodyOpts = {
    expr: safeExpr,
    blink,
    look,
    facing,
    seed,
    mode,
    phase: step / (Math.PI * 2),
    wave: R === 'wave' ? Math.sin(wv || 1.2) : R === 'point' ? 0.9 : undefined,
    tilt,
    headTilt,
    light: (-115 * Math.PI) / 180,
  };

  TB.bodyFront(p, outfit, bodyOpts);

  if (carryingParcel) {
    // Hold parcel cleanly at waist/side so it NEVER covers the character's face!
    const g = p.g;
    g.save();
    const bx = 375;
    const by = 680;
    g.fillStyle = parcelHex;
    g.strokeStyle = TB.INK;
    g.lineWidth = 9;
    g.beginPath();
    g.roundRect(bx - 52, by - 40, 104, 80, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#f7d568';
    g.fillRect(bx - 12, by - 38, 24, 76);
    g.fillRect(bx - 50, by - 10, 100, 20);
    g.restore();
  }
}

export function fxWind(p, t) {
  const g = p.g;
  g.save();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.globalAlpha = 0.78;
  for (let i = 0; i < 3; i++) {
    const y = 340 + i * 110;
    const x0 = 120 + ((t * 420 + i * 90) % 240) - 80;
    g.beginPath();
    g.moveTo(x0, y);
    g.bezierCurveTo(x0 + 90, y - 28, x0 + 170, y + 28, x0 + 260, y);
    g.stroke();
  }
  g.restore();
}

export function fxDeliveryStar(p, t) {
  TB.fxBurst(p, t, '#ffe47a', 10, 45, 220);
}

export function fxStepPuff(p, t) {
  TB.fxPuff(p, t);
}

export function fxBumpText(p, k, text = 'WHOA!') {
  const g = p.g;
  g.save();
  g.globalAlpha = Math.max(0, 1 - k * 0.85);
  const spikes = 10;
  const rOut = 135 + k * 130;
  const rIn = 72 + k * 65;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + k * 0.4;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([300 + Math.cos(a) * r, 500 + Math.sin(a) * r]);
  }
  p.poly(pts, '#ffdf5e', 14);
  g.font = '900 72px Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = TB.INK;
  g.strokeText(text, 300, 500);
  g.fillStyle = '#ffffff';
  g.fillText(text, 300, 500);
  g.restore();
}
