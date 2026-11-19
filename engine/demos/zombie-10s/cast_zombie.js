/**
 * Freshly authored cartoon zombie character ("Bloop") and 2D comic FX cards.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01 Phase 7).
 * Uses ONLY exported Pen / headBlob / blobPts / thickAngle helpers from MIT-licensed toonbase.js
 * (github.com/mromidev/claude-animated-shorts, commit e3b817b6).
 * Strictly cartoonish, friendly, non-graphic (zero gore).
 */

import { Pen, blobPts, headBlob, thickAngle, INK } from '/toonbase/toonbase.js';

export { Pen };

const ZOMBIE_SKIN = '#9dd991';
const ZOMBIE_SKIN_SH = '#75b56c';
const HOODIE = '#6b4ba6';
const HOODIE_SH = '#4a317a';
const TIE_COL = '#e4524a';
const HAIR_COL = '#382a4f';
const SHOE_COL = '#e85d4a';

const rad = (deg) => (deg * Math.PI) / 180;

function curve(p0, p1, p2, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return pts;
}

function rrect(x0, y0, x1, y1, r) {
  const pts = [];
  const corners = [
    [x1 - r, y0 + r, -Math.PI / 2, 0],
    [x1 - r, y1 - r, 0, Math.PI / 2],
    [x0 + r, y1 - r, Math.PI / 2, Math.PI],
    [x0 + r, y0 + r, Math.PI, (Math.PI * 3) / 2],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + ((a1 - a0) * i) / 5;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

function rotAbout(pt, ang, pivot) {
  const dx = pt[0] - pivot[0];
  const dy = pt[1] - pivot[1];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
}

function drawZombieFace(p, cx, hc, W, expr, facing, look, blink) {
  const u = W / 100;
  const fx = cx + 6 * u * facing + 4 * u * look;
  const ey = hc - 3 * u;
  const sep = 17 * u;

  // Expressive eyes
  for (const side of [-1, 1]) {
    const ex = fx + side * sep;
    const isShock = expr === 'shock';
    const isLaugh = expr === 'laugh';
    const isSquint = expr === 'squint';
    const rx = (isShock ? 12 : 9.5) * u;
    const ry = (isShock ? 14 : 10.5) * u;

    if (blink >= 0.9 || isLaugh) {
      // Happy curved arc or closed blink
      const arcY = isLaugh ? ey + 2 * u : ey;
      const ctrlY = isLaugh ? ey - 10 * u : ey + 4 * u;
      p.stroke(curve([ex - rx, arcY], [ex, ctrlY], [ex + rx, arcY]), 3.8 * u, INK);
    } else if (isSquint) {
      p.ell(ex, ey, rx, ry * 0.45, '#ffffff', 2.4 * u);
      p.dot(ex + 2.5 * u * look, ey, 3.2 * u, INK);
      p.stroke([[ex - rx * 1.15, ey - ry * 0.45], [ex + rx * 1.15, ey - ry * 0.45]], 3.2 * u, INK);
    } else {
      p.ell(ex, ey, rx, ry, '#ffffff', 2.6 * u);
      const pr = (isShock ? 3.2 : 4.2) * u;
      p.dot(ex + 3.0 * u * look, ey + (isShock ? 0 : 1 * u), pr, INK);
      p.dot(ex + 3.0 * u * look - 1.6 * u, ey - 2.2 * u, 1.6 * u, '#ffffff');
      if (blink >= 0.4) {
        p.stroke([[ex - rx, ey - ry * 0.3], [ex + rx, ey - ry * 0.3]], 3.4 * u, INK);
      }
    }

    // Eyebrows
    const by = ey - ry - 6 * u;
    let dyIn = 0;
    let dyOut = 0;
    if (expr === 'stern') { dyIn = 5 * u; dyOut = -3 * u; }
    else if (expr === 'shock') { dyIn = -6 * u; dyOut = -2 * u; }
    else if (expr === 'squint') { dyIn = 3 * u; dyOut = 1 * u; }
    else if (expr === 'grin' || expr === 'laugh') { dyIn = -3 * u; dyOut = -1 * u; }

    p.stroke(
      [[ex - side * 8 * u, by + dyIn], [ex + side * 9 * u, by + dyOut]],
      3.4 * u,
      HAIR_COL
    );
  }

  // Expressive mouth
  const my = hc + 22 * u;
  if (expr === 'grin' || expr === 'laugh') {
    const mw = (expr === 'laugh' ? 23 : 18) * u;
    const mh = (expr === 'laugh' ? 18 : 12) * u;
    const mpts = [
      ...curve([fx - mw, my - 2 * u], [fx, my + 2 * u], [fx + mw, my - 2 * u], 10),
      ...curve([fx + mw, my - 2 * u], [fx, my + mh * 1.6], [fx - mw, my - 2 * u], 10),
    ];
    p.poly(mpts, '#591e2c', 2.8 * u);
    // Cute goofy single cartoon tooth!
    p.poly(rrect(fx - 7 * u, my - 1 * u, fx + 2 * u, my + 6.5 * u, 2 * u), '#fffdf6', 1.6 * u);
    if (expr === 'laugh') {
      p.ell(fx, my + mh * 0.72, 10 * u, 4.5 * u, '#e86f7c', 0);
    }
  } else if (expr === 'shock') {
    p.ell(fx, my + 4 * u, 13 * u, 17 * u, '#591e2c', 3.0 * u);
    p.ell(fx, my + 12 * u, 7.5 * u, 4.5 * u, '#e86f7c', 0);
  } else if (expr === 'stern') {
    p.stroke(curve([fx - 14 * u, my + 5 * u], [fx, my - 3 * u], [fx + 14 * u, my + 5 * u]), 3.6 * u, INK);
  } else if (expr === 'squint') {
    p.stroke([[fx - 12 * u, my + 2 * u], [fx + 12 * u, my - 2 * u]], 3.4 * u, INK);
  } else {
    p.stroke(curve([fx - 11 * u, my], [fx, my + 5 * u], [fx + 11 * u, my]), 3.2 * u, INK);
  }
}

export function zombieFront(p, opts = {}) {
  const {
    expr = 'grin',
    blink = 0,
    look = 0,
    facing = 0,
    seed = 7,
    L = 'hang',
    R = 'hang',
    tilt = 0,
    headTilt = 0,
    bob = 0,
    step = 0,
    wavePhase = 0,
    holdingChips = false,
  } = opts;

  const H = headBlob(seed, 118, facing);
  const W = 2 * H.a;
  const HH = 2 * H.b;
  const u = W / 100;
  const sole = 975;
  const legsL = 1.36;
  const torsoL = 1.06;
  const torsoBot = sole - legsL * HH - bob * HH;
  const chin = torsoBot - torsoL * HH;
  const hc = chin - H.b;
  const hipY = torsoBot - 0.12 * HH;
  const light = rad(-115);
  const thick = thickAngle(light);
  const ow = 5 * u;
  const cx = 300;

  p.rot = null;

  // ---- legs & cartoon sneakers ----
  for (const side of [-1, 1]) {
    const stride = step ? Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0))) : 0;
    const up = Math.max(0, stride) * 32;
    const fwd = stride * 12 * u;
    const hx = cx + side * 16 * u;
    const fx = cx + side * 22 * u + fwd;
    const fy = sole - 6 * u - up;
    p.stroke(curve([hx, hipY], [(hx + fx) / 2 + side * 3 * u, (hipY + fy) / 2], [fx, fy]), 6.2 * u, '#3e3352');
    p.stroke([[fx - side * 4 * u, fy], [fx + side * 15 * u, fy + 1 * u]], 9 * u + 3, INK);
    p.stroke([[fx - side * 4 * u, fy], [fx + side * 15 * u, fy + 1 * u]], 9 * u, SHOE_COL);
    p.stroke([[fx - side * 4 * u, fy + 3.5 * u], [fx + side * 15 * u, fy + 4.5 * u]], 2.5 * u, '#ffffff');
  }

  // ---- upper body (purple hoodie + crooked tie) ----
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const T = {
    a: (0.42 * W) / 1.04,
    b: 0.5 * (torsoBot - (chin - 0.22 * HH)),
    nTop: 2.2,
    nBot: 2.7,
    egg: 0.14,
    asym: 0.04 * facing,
    rot: 0,
    noise: 0.006,
    seed: seed + 13,
  };
  const tcx = cx + 3 * u * facing;
  const tcy = torsoBot - T.b;
  const tp = blobPts(tcx, tcy, T);
  const shoulder = (side) => [tcx + side * 0.86 * T.a, chin + 0.14 * HH];

  const makeArm = (side, pose) => {
    const s = shoulder(side);
    const X = (k) => tcx + side * (T.a * 1.08 + k * u);
    switch (pose) {
      case 'wave':
        return { pts: [s, [X(18), s[1] - 0.22 * HH], [X(32 + 12 * Math.sin(wavePhase)), s[1] - 0.68 * HH]], front: false };
      case 'up':
        return { pts: [s, [X(16), s[1] - 0.34 * HH], [X(20), s[1] - 0.84 * HH]], front: false };
      case 'celebrate':
        return { pts: [s, [X(22), s[1] - 0.48 * HH], [tcx + side * 0.72 * T.a, hc - 0.96 * H.b]], front: true };
      case 'cheek':
        return { pts: [s, [X(22), s[1] + 0.06 * HH], [cx + side * (H.a + 3 * u), hc + 0.22 * H.b]], front: true };
      case 'point':
        return { pts: [s, [X(30), s[1] - 0.04 * HH], [X(64), s[1] - 0.12 * HH]], front: false };
      case 'bump':
        return { pts: [s, [X(36), s[1] + 0.14 * HH], [X(66), s[1] + 0.26 * HH]], front: true };
      case 'zombieWalk':
        return { pts: [s, [X(24), s[1] + 0.08 * HH], [X(50), s[1] + 0.12 * HH + Math.sin(wavePhase + side) * 14]], front: false };
      default:
        return { pts: [s, [X(6), s[1] + 0.46 * HH], [X(4), chin + 1.02 * HH]], front: false };
    }
  };

  const arms = [makeArm(-1, L), makeArm(1, R)];
  const drawArm = (a) => {
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 7.6 * u, INK);
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 4.4 * u, HOODIE);
    const [hx, hy] = a.pts[2];
    p.ell(hx, hy, 7.6 * u, 7.6 * u, ZOMBIE_SKIN, 2.4 * u);
  };

  for (const a of arms) if (!a.front) drawArm(a);

  // Hoodie body
  p.gradFill(tp, HOODIE, HOODIE_SH, light);
  p.clip(tp, () => {
    const pkt = rrect(tcx - 0.56 * T.a, torsoBot - 0.42 * HH, tcx + 0.56 * T.a, torsoBot - 0.08 * HH, 10 * u);
    p.poly(pkt, '#593c90', 2.0 * u);
    for (const s of [-1, 1]) {
      p.stroke([[tcx + s * 10 * u, chin + 0.06 * HH], [tcx + s * 12 * u, chin + 0.42 * HH]], 2.2 * u, '#f8f3e6');
    }
    // Crooked polka-dot tie
    const tie = [
      [tcx - 4 * u, chin + 0.04 * HH],
      [tcx + 5 * u, chin + 0.04 * HH],
      [tcx + 14 * u, chin + 0.52 * HH],
      [tcx + 6 * u, chin + 0.64 * HH],
      [tcx - 4 * u, chin + 0.50 * HH],
    ];
    p.poly(tie, TIE_COL, 1.8 * u);
    p.dot(tcx + 4 * u, chin + 0.28 * HH, 2.8 * u, '#ffe078');
    p.dot(tcx + 6 * u, chin + 0.46 * HH, 2.8 * u, '#ffe078');
  });
  p.inkRing(tp, ow, thick);

  for (const a of arms) if (a.front) drawArm(a);

  // ---- head ----
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  p.rot = Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null;

  for (const s of [-1, 1]) {
    p.ell(cx + s * (H.a + 5 * u), hc + 4 * u, 9 * u, 13 * u, ZOMBIE_SKIN, 2.6 * u);
  }

  const hp = blobPts(cx, hc, H);
  p.shadedFill(hp, ZOMBIE_SKIN, ZOMBIE_SKIN_SH, light, H.a);
  p.inkRing(hp, ow, thick);

  // Messy cartoon hair tufts
  for (const [dx, dy, rx, ry] of [
    [-22, -H.b * 0.92, 16, 10],
    [0, -H.b * 0.98, 18, 12],
    [24, -H.b * 0.88, 15, 9],
  ]) {
    p.ell(cx + dx * u, hc + dy, rx * u, ry * u, HAIR_COL, 2.6 * u);
  }

  // Friendly cartoon band-aid on forehead (non-graphic)
  const bx = cx + 22 * u;
  const by = hc - 30 * u;
  p.poly(rrect(bx - 16 * u, by - 6 * u, bx + 16 * u, by + 6 * u, 3 * u), '#f6d59e', 1.8 * u);
  p.dot(bx - 7 * u, by, 1.4 * u, '#b88a55');
  p.dot(bx + 7 * u, by, 1.4 * u, '#b88a55');

  drawZombieFace(p, cx, hc, W, expr, facing, look, blink);

  if (expr === 'grin' || expr === 'laugh') {
    for (const s of [-1, 1]) {
      p.ell(cx + s * 28 * u, hc + 12 * u, 8 * u, 4.5 * u, 'rgba(235,110,120,0.45)', 0);
    }
  }

  // Held MEGA CHIPS bag triumphantly lifted above head in payoff!
  if (holdingChips) {
    const bag = rrect(cx - 44 * u, hc - H.b - 86 * u, cx + 44 * u, hc - H.b - 2 * u, 8 * u);
    p.poly(bag, '#6f32a8', 3.4 * u);
    p.ell(cx, hc - H.b - 44 * u, 28 * u, 26 * u, '#f8c838', 2.2 * u);
    const g = p.g;
    g.save();
    g.fillStyle = '#c82b34';
    g.font = `900 ${Math.round(15 * u)}px Arial Black, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CHIPS', cx, hc - H.b - 44 * u);
    g.restore();
  }

  p.rot = null;
}

export function fxSparkle(p, t) {
  const g = p.g;
  g.save();
  for (let i = 0; i < 4; i++) {
    const ph = (t + i * 0.25) % 1;
    const x = 150 + i * 100 + Math.sin(ph * 6.28 + i) * 28;
    const y = 620 - ph * 340;
    const s = 18 + 26 * Math.sin(ph * Math.PI);
    g.globalAlpha = Math.sin(ph * Math.PI);
    const pts = [
      [x, y - s],
      [x + s * 0.28, y - s * 0.28],
      [x + s, y],
      [x + s * 0.28, y + s * 0.28],
      [x, y + s],
      [x - s * 0.28, y + s * 0.28],
      [x - s, y],
      [x - s * 0.28, y - s * 0.28],
    ];
    p.poly(pts, '#ffe055', 6);
  }
  g.restore();
}

export function fxSweat(p, t) {
  const g = p.g;
  g.save();
  for (const [bx, delay] of [[180, 0], [430, 0.45]]) {
    const ph = (t + delay) % 1;
    const y = 260 + ph * 320;
    g.globalAlpha = 1 - ph * 0.6;
    p.poly([[bx, y - 48], [bx + 32, y + 18], [bx, y + 48], [bx - 32, y + 18]], '#7bd3ff', 10);
  }
  g.restore();
}

export function fxImpactBurst(p, k, text = 'BONK!') {
  const g = p.g;
  g.save();
  g.globalAlpha = Math.max(0, 1 - k * 0.9);
  const spikes = 10;
  const rOut = 140 + k * 140;
  const rIn = 75 + k * 70;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + k * 0.5;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([300 + Math.cos(a) * r, 500 + Math.sin(a) * r]);
  }
  p.poly(pts, '#ffe04b', 14);
  g.font = '900 72px Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = INK;
  g.strokeText(text, 300, 500);
  g.fillStyle = '#ffffff';
  g.fillText(text, 300, 500);
  g.restore();
}
