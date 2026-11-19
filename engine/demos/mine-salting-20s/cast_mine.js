/**
 * Original 1870s Frontier Mine Cast & 2D Expressive Props for How Mine Salting Worked (20s).
 *
 * Provenance: Uses MIT `toonbase.js` geometry primitives (`Pen`, `blobPts`, `headBlob`,
 * `thickAngle`, `fxBurst`, `fxPuff`, `fxStars`, `fxCreak`) paired with a clean 2-arm
 * articulated character drawer ensuring zero duplicate limbs and centered eyewear.
 */

import {
  Pen,
  INK,
  SKIN,
  mul,
  shade,
  mix,
  blobPts,
  headBlob,
  thickAngle,
  fxBurst,
  fxPuff,
  fxStars,
  fxCreak,
} from '/toonbase/toonbase.js';

export { Pen, INK, SKIN, fxBurst, fxPuff, fxStars, fxCreak };

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const rad = (d) => (d * Math.PI) / 180;

export const PROSPECTOR_INVESTOR = {
  jacket: '#2f496b',
  pants: '#282e3d',
  boots: '#1e1612',
  hat: 'tophat',
  buttons: '#ecc35c',
  sash: '#b83c36',
  skin: '#f6d1ad',
  moustache: '#4b3324',
  stout: true,
};

export const SWINDLER_MINER = {
  jacket: '#70492e',
  pants: '#3a322c',
  boots: '#241a14',
  hat: 'slouch',
  cap: '#563c27',
  buttons: '#b89464',
  skin: '#e9c097',
  moustache: '#352216',
  stout: false,
};

function drawHandBrush(p, hx, hy, angleRad, paintPhase = 0) {
  const g = p.g;
  g.save();
  g.translate(hx, hy);
  g.rotate(angleRad);
  p.poly([[-7, 14], [7, 14], [9, -46], [-9, -46]], '#8c5a32', 4);
  p.poly([[-11, -46], [11, -46], [12, -62], [-12, -62]], '#c99c38', 4);
  p.poly([[-15, -62], [15, -62], [19, -100], [-19, -100]], '#e5c158', 5);
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(paintPhase * 8 + i * 1.7);
    p.ell(10 + i * 11 + s * 5, -108 - i * 8, 5, 4, '#ffd94a', 2);
  }
  g.restore();
}

function drawNuggetPour(p, hx, hy, dropProg = 0.5) {
  const g = p.g;
  g.save();
  g.translate(hx, hy);
  g.rotate(-0.42);
  p.poly([[-22, -16], [24, -16], [28, 32], [-26, 32]], '#8c2f32', 5);
  p.poly([[-14, -26], [14, -26], [18, -12], [-18, -12]], '#b64a46', 4);
  g.restore();

  for (let i = 0; i < 3; i++) {
    const u = (dropProg * 2.4 + i * 0.28) % 1;
    const nx = hx - 14 - u * 26;
    const ny = hy + 34 + u * 125;
    if (ny < 955) {
      p.ell(nx, ny, 12, 9, '#ffd845', 4);
      p.dot(nx - 2, ny - 2, 3, '#fff6bd');
    }
  }
}

function drawLanternProp(p, hx, hy, swing = 0) {
  const g = p.g;
  g.save();
  g.translate(hx, hy + 8);
  g.rotate(swing * 0.22);
  p.arc(0, 12, 14, 16, 180, 360, 5, '#2b2420');
  p.poly([[-20, 24], [20, 24], [24, 38], [-24, 38]], '#8c6528', 4);
  p.poly([[-16, 38], [16, 38], [16, 86], [-16, 86]], '#ffe382', 4);
  p.ell(0, 62, 9, 14, '#fff8d4', 0);
  p.poly([[-22, 86], [22, 86], [24, 102], [-24, 102]], '#6e4e1e', 4);
  g.restore();
}

function drawMagnifierProp(p, hx, hy) {
  const g = p.g;
  g.save();
  g.translate(hx, hy - 10);
  p.band([[0, 20], [0, -16]], '#704422', 10, 3, 'round');
  p.ell(0, -46, 28, 28, 'rgba(205,238,255,0.68)', 7);
  p.arc(-6, -52, 15, 13, 195, 290, 5, '#ffffff');
  g.restore();
}

function drawChiselProp(p, hx, hy, strikeT = 0) {
  const g = p.g;
  const ang = -0.85 + clamp(strikeT, 0, 1) * 1.45;
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  p.band([[0, 14], [0, -76]], '#7d502d', 10, 3, 'round');
  p.poly([[-22, -90], [28, -90], [28, -66], [-22, -66]], '#5c646e', 5);
  p.poly([[20, -88], [36, -78], [20, -68]], '#a2aab4', 3);
  g.restore();
}

function drawFaceFeatures(p, cx, cy, u, expr, facing, look, blink, skin, moustache, hasGlasses) {
  const fx = cx + 7 * u * facing;
  const ey = cy;
  const lid = blink >= 1 ? 1 : blink > 0 ? 0.5 : 0;

  for (const side of [-1, 1]) {
    const x = fx + side * 13 * u;
    const lx = x + look * 2.5 * u;
    if (expr === 'shock') {
      p.ell(x, ey, 11 * u, 11 * u, '#ffffff', 2.6 * u);
      p.dot(lx - side * 1.4 * u, ey + 1.2 * u, 3 * u, INK);
    } else if (expr === 'laugh' || expr === 'grin') {
      p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, 3.8 * u, INK);
    } else if (lid >= 1) {
      p.stroke([[x - 8 * u, ey], [x + 8 * u, ey]], 3.6 * u, INK);
    } else if (expr === 'stern' || lid > 0) {
      p.ell(lx, ey - u, 7 * u, 5 * u, '#ffffff', 0);
      p.ell(lx, ey - u, 7 * u, 5.5 * u, INK, 0, 0, 180);
      p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], 3.8 * u, INK);
    } else {
      p.ell(lx, ey, 3.8 * u, 5.2 * u, INK, 0);
    }

    const browInner = expr === 'stern' ? 4 : expr === 'nervous' ? -4 : expr === 'shock' ? -7 : -1;
    const browOuter = expr === 'stern' ? -3 : expr === 'nervous' ? 3 : expr === 'shock' ? -6 : -2;
    const by = ey - 18 * u;
    p.stroke([[x - side * 8 * u, by + browInner * u], [x + side * 8 * u, by + browOuter * u]], 3.8 * u, INK);
  }

  if (hasGlasses) {
    p.ell(fx - 13 * u, ey, 12.5 * u, 12.5 * u, null, 2.8 * u, 0, 360);
    p.ell(fx + 13 * u, ey, 12.5 * u, 12.5 * u, null, 2.8 * u, 0, 360);
    p.stroke([[fx - 2 * u, ey - 1 * u], [fx + 2 * u, ey - 1 * u]], 2.6 * u, INK);
  }

  const mx = cx + 8 * u * facing;
  const my = cy + 20 * u;
  if (expr === 'laugh' || expr === 'grin') {
    p.ell(mx, my - 1 * u, 13 * u, 9 * u, '#5a1e28', 2.8 * u, 0, 180);
    p.ell(mx, my - 1 * u, 11 * u, 3 * u, '#ffffff', 0, 0, 180);
  } else if (expr === 'shock') {
    p.ell(mx, my + 2 * u, 8 * u, 10 * u, '#5a1e28', 3.0 * u);
  } else if (expr === 'stern') {
    p.arc(mx, my + 4 * u, 7.5 * u, 3.5 * u, 200, 340, 3.8 * u, INK);
  } else if (expr === 'nervous') {
    const wave = [];
    for (let i = 0; i <= 8; i++) wave.push([mx - 8 * u + i * 2 * u, my + 2 * u * Math.sin(i * 1.4)]);
    p.stroke(wave, 3.2 * u, INK);
  } else {
    p.arc(mx, my - 2 * u, 8 * u, 4.5 * u, 15, 160, 3.8 * u, INK);
  }

  if (moustache) {
    for (const s of [-1, 1]) {
      p.stroke([[mx + s * 2 * u, cy + 12.5 * u], [mx + s * 16 * u, cy + 14.5 * u]], 3.6 * u, moustache);
    }
  }
}

/**
 * Clean 2-arm articulated frontier character renderer in 600x1000 Pen space.
 */
export function drawMineCharacter(p, role, opts = {}) {
  const isInvestor = role === 'investor';
  const charDef = isInvestor ? PROSPECTOR_INVESTOR : SWINDLER_MINER;
  const seed = isInvestor ? 41 : 83;
  const facing = opts.facing ?? (isInvestor ? 1 : -1);
  const expr = opts.expr || 'neutral';
  const handProp = opts.handProp || null;
  const phase = opts.phase || 0;
  const tilt = opts.tilt || 0;
  const headTilt = opts.headTilt || 0;
  const blink = opts.blink || 0;
  const light = opts.light ?? -2.1;

  const H = headBlob(seed, 118, facing);
  const W = 2 * H.a;
  const HH = 2 * H.b;
  const u = W / 100;
  const sole = 975;
  const torsoH = (charDef.stout ? 1.15 : 1.08) * HH;
  const legH = (charDef.stout ? 1.30 : 1.38) * HH;
  const walkY = opts.mode === 'stroll' ? Math.abs(Math.sin(phase * Math.PI * 2)) * 8 : 0;
  const torsoBot = sole - legH - walkY;
  const chin = torsoBot - torsoH;
  const hc = chin - H.b;
  const crown = hc - H.b;
  const hipY = torsoBot - 0.12 * HH;
  const ow = 5 * u;
  const thick = thickAngle(light);

  // Legs
  p.rot = null;
  const legCol = mix(charDef.pants, INK, 0.55);
  for (const [side, ph] of [[-1, 0], [1, 0.5]]) {
    const stepUp = opts.mode === 'stroll' ? Math.max(0, Math.sin((phase + ph) * Math.PI * 2)) * 26 : 0;
    const lx = 300 + side * 16 * u;
    const fx = 300 + side * 22 * u;
    const fy = sole - 6 - stepUp;
    p.stroke([[lx, hipY], [(lx + fx) / 2 + side * 6, (hipY + fy) / 2], [fx, fy]], 5.6 * u, legCol);
    p.stroke([[fx - side * 4 * u, fy], [fx + side * 12 * u, fy + 1]], 7.5 * u, charDef.boots);
  }

  // Torso (rotated slightly about hipY)
  p.rot = tilt ? [rad(tilt), 300, hipY] : null;
  const T = {
    a: ((charDef.stout ? 0.92 : 0.80) * W) / 2.12,
    b: 0.5 * torsoH,
    nTop: 2.2,
    nBot: 2.6,
    egg: charDef.stout ? 0.17 : 0.12,
    asym: 0.04 * facing,
    rot: 0,
    noise: 0.006,
    seed: seed + 7,
  };
  const tcx = 300 + 3 * u * facing;
  const tcy = torsoBot - T.b;
  const tp = blobPts(tcx, tcy, T);
  const armCol = mix(charDef.jacket, INK, 0.5);
  const shY = chin + 0.12 * HH;
  const activeSide = handProp || opts.wave !== undefined || opts.studioPose ? (facing >= 0 ? 1 : -1) : null;

  const drawLimb = (s0, e0, h0) => {
    p.stroke([s0, e0, h0], 5.2 * u, armCol);
    p.dot(h0[0], h0[1], 5.6 * u, INK);
  };

  // Inactive hanging arm(s) behind torso
  for (const side of [-1, 1]) {
    if (side === activeSide) continue;
    const sPt = [tcx + side * 0.84 * T.a, shY];
    const ePt = [tcx + side * (1.12 * T.a + 4 * u), shY + 0.45 * HH];
    const hPt = [tcx + side * (1.14 * T.a + 2 * u), chin + 1.02 * HH];
    drawLimb(sPt, ePt, hPt);
  }

  // Shaded torso fill + sash + buttons + red bandana
  p.gradFill(tp, charDef.jacket, mul(charDef.jacket, [0.64, 0.66, 0.74]), light);
  p.clip(tp, () => {
    if (charDef.sash) {
      p.band([[tcx - 1.3 * T.a, torsoBot - 0.30 * HH], [tcx + 1.3 * T.a, torsoBot - 0.30 * HH]], charDef.sash, 0.12 * HH, 1.8 * u);
    }
    for (let i = 0; i < 4; i++) {
      const y = chin + 0.14 * HH + i * 0.19 * HH;
      if (charDef.sash && Math.abs(y - (torsoBot - 0.30 * HH)) < 0.08 * HH) continue;
      p.dot(tcx + 2 * u * facing, y, 2.5 * u, INK);
      p.dot(tcx + 2 * u * facing, y, 1.9 * u, charDef.buttons);
    }
  });
  if (!isInvestor) {
    p.poly([[tcx - 42, shY - 12], [tcx + 42, shY - 12], [tcx + 4 * facing, shY + 54]], '#b6392c', 6);
  }
  p.inkRing(tp, ow, thick);

  // Active prop arm IN FRONT (strictly 1 active arm -> exact 2 total arms!)
  if (activeSide !== null) {
    const sPt = [tcx + activeSide * 0.84 * T.a, shY];
    let ePt;
    let hPt;
    if (opts.studioPose === 'wave' || opts.studioPose === 'up' || opts.wave !== undefined) {
      const wv = opts.wave ?? 0.6;
      ePt = [tcx + activeSide * (1.15 * T.a + 14 * u), shY - 0.18 * HH];
      hPt = [tcx + activeSide * (1.28 * T.a + 22 * u + 10 * u * wv), shY - 0.60 * HH];
      drawLimb(sPt, ePt, hPt);
    } else if (handProp === 'point') {
      ePt = [tcx + activeSide * (1.15 * T.a + 28 * u), shY + 0.05 * HH];
      hPt = [tcx + activeSide * (1.58 * T.a + 68 * u), shY - 0.22 * HH];
      drawLimb(sPt, ePt, hPt);
    } else {
      const rxOff = (opts.reachX || 0) * 65 * activeSide;
      const ryOff = (opts.reachY || 0) * 85;
      ePt = [tcx + activeSide * (1.16 * T.a + 18 * u) + rxOff * 0.45, shY + 0.24 * HH + ryOff * 0.35];
      hPt = [tcx + activeSide * (1.35 * T.a + 32 * u) + rxOff, shY + 0.18 * HH + ryOff];
      drawLimb(sPt, ePt, hPt);

      if (handProp === 'brush') drawHandBrush(p, hPt[0], hPt[1], (opts.actionT || 0) * 0.75 - 0.3, opts.actionT || 0);
      else if (handProp === 'nuggetPour') drawNuggetPour(p, hPt[0], hPt[1], opts.actionT || 0);
      else if (handProp === 'lantern') drawLanternProp(p, hPt[0], hPt[1], Math.sin(phase * Math.PI * 2));
      else if (handProp === 'magnifier') drawMagnifierProp(p, hPt[0], hPt[1]);
      else if (handProp === 'chisel') drawChiselProp(p, hPt[0], hPt[1], opts.actionT || 0);
    }
  }

  // Head + Hat + Centered Spectacles + Expression
  const aTilt = tilt + headTilt;
  const cxRot = 300 + (tilt ? Math.sin(rad(tilt)) * (hipY - chin) : 0);
  const cyRot = chin - (tilt ? (1 - Math.cos(rad(tilt))) * (hipY - chin) : 0);
  p.rot = aTilt ? [rad(aTilt), 300, chin, cxRot - 300, cyRot - chin] : null;

  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, charDef.skin, mul(charDef.skin, [0.96, 0.86, 0.84]), light, H.a);
  p.inkRing(hp, ow, thick);

  if (charDef.hat === 'tophat') {
    const yb = crown + 0.20 * HH;
    const ht = 0.72 * HH;
    const wt = 0.32 * W;
    p.poly([[300 - wt, yb - ht], [300 + wt, yb - ht], [300 + wt * 0.94, yb], [300 - wt * 0.94, yb]], '#2b2833', ow);
    p.poly([[300 - wt * 0.95, yb - 24], [300 + wt * 0.95, yb - 24], [300 + wt * 0.94, yb], [300 - wt * 0.94, yb]], '#3a5f8c', ow * 0.5);
    p.ell(300, yb + 2, 0.46 * W, 0.055 * HH, '#1e1b24', ow);
  } else {
    const yc = crown + 0.28 * HH;
    p.poly([[300 - 0.44 * W, yc], [300 - 0.32 * W, crown - 12], [300 + 0.32 * W, crown - 8], [300 + 0.44 * W, yc]], charDef.cap, ow);
    p.ell(300 + facing * 14, yc + 4, 0.48 * W, 0.06 * HH, shade(charDef.cap, 0.82), ow);
  }

  drawFaceFeatures(p, 300, hc + 4, u, expr, facing, opts.look ?? 0, blink, charDef.skin, charDef.moustache, isInvestor);
  if (opts.sweat) {
    const dy = (phase * 45) % 24;
    const sx = 300 - facing * 96;
    p.poly([[sx, hc - 72 + dy], [sx - 8, hc - 54 + dy], [sx + 8, hc - 54 + dy]], '#8fd6ff', 3);
    p.ell(sx, hc - 54 + dy, 8, 9, '#8fd6ff', 3);
  }
  p.rot = null;
}

export function drawGlintFx(p, t = 0) {
  const sc = 0.5 + 0.5 * Math.sin(t * Math.PI);
  const g = p.g;
  g.save();
  g.translate(300, 500);
  g.scale(sc, sc);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 185 : 44;
    const a = (i * Math.PI) / 4;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  p.poly(pts, '#ffe359', 10);
  p.dot(0, 0, 28, '#ffffff');
  g.restore();
}

export function drawProfitFx(p, t = 0) {
  const yOff = -Math.sin(clamp(t) * Math.PI) * 90;
  const g = p.g;
  g.save();
  g.translate(300, 520 + yOff);
  for (const [cx, cy, r] of [[-120, -40, 44], [0, -110, 56], [125, -35, 42]]) {
    p.ell(cx, cy, r, r, '#ffd43b', 9);
    p.ell(cx, cy, r * 0.62, r * 0.62, null, 5);
    p.stroke([[cx, cy - r * 0.4], [cx, cy + r * 0.4]], 7, '#754e04');
  }
  g.restore();
}

export function drawZeroPercentFx(p, t = 0) {
  const s = 0.65 + 0.35 * clamp(t * 3);
  const g = p.g;
  g.save();
  g.translate(300, 500);
  g.scale(s, s);
  p.ell(0, 0, 175, 118, '#fff4e6', 14);
  p.ell(0, 0, 152, 95, null, 7);
  g.fillStyle = '#c92a2a';
  g.font = 'bold 68px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('0% ORE', 0, 5);
  g.restore();
}
