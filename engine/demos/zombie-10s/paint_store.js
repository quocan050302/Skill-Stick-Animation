/**
 * Freshly authored deterministic Canvas2D textures for the 10s Convenience Store proof.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01 Phase 7).
 * Zero textures copied from the Soldier bridge world.
 */

import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function makeTex(canvas, rx = 1, ry = 1, clamp = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function tileFloor(seed = 101) {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(seed);
  const n = 4;
  const step = 512 / n;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const alt = (row + col) % 2 === 0;
      g.fillStyle = alt ? '#f4efe2' : '#d6eae2';
      g.fillRect(col * step, row * step, step, step);
      // Subtle floor speckles
      for (let k = 0; k < 14; k++) {
        g.fillStyle = alt ? 'rgba(180,170,150,0.28)' : 'rgba(120,165,150,0.24)';
        g.beginPath();
        g.ellipse(col * step + r() * step, row * step + r() * step, 2 + r() * 5, 1 + r() * 3, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#9aa8a2';
      g.lineWidth = 4;
      g.strokeRect(col * step, row * step, step, step);
    }
  }
  return c;
}

export function storeWall(seed = 102) {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#fbf7ee';
  g.fillRect(0, 0, 512, 512);
  // Subtle paint texture
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(225,216,198,0.35)';
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 18 + r() * 40, 8 + r() * 18, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Cheerful retro convenience-store horizontal stripes
  g.fillStyle = '#e85d4a';
  g.fillRect(0, 120, 512, 26);
  g.fillStyle = '#f2b84b';
  g.fillRect(0, 146, 512, 18);
  g.fillStyle = '#2d938e';
  g.fillRect(0, 164, 512, 26);
  // Baseboard
  g.fillStyle = '#53626e';
  g.fillRect(0, 474, 512, 38);
  return c;
}

export function pegboard(seed = 103) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#ebe6d9';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#a5a196';
  for (let y = 16; y < 256; y += 24) {
    for (let x = 16; x < 256; x += 24) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = '#6c6a64';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 250);
  return c;
}

export function diegeticSign(topText, bottomText, bg = '#237a75', fg = '#fff9eb', accent = '#f6c343') {
  const [c, g] = makeCanvas(1024, 320);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = accent;
  g.lineWidth = 18;
  g.strokeRect(18, 18, 988, 284);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 112px Arial Black, sans-serif';
  g.fillText(topText, 512, bottomText ? 120 : 164);
  if (bottomText) {
    g.fillStyle = accent;
    g.font = '800 66px Arial, sans-serif';
    g.fillText(bottomText, 512, 232);
  }
  return c;
}

export function soldOutTag() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#fff1b8';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#c8342d';
  g.lineWidth = 16;
  g.strokeRect(12, 12, 488, 232);
  g.fillStyle = '#c8342d';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 84px Arial Black, sans-serif';
  g.fillText('SOLD OUT!', 256, 104);
  g.fillStyle = '#3a2b28';
  g.font = 'bold 42px Arial, sans-serif';
  g.fillText('NO CHIPS LEFT', 256, 188);
  return c;
}

export function coolerFront(seed = 104) {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#d7eef6';
  g.fillRect(0, 0, 512, 512);
  const palette = ['#e65540', '#3d99d6', '#f2b830', '#58b368', '#9859b6'];
  for (let row = 0; row < 4; row++) {
    const sy = 108 + row * 112;
    g.fillStyle = '#48606e';
    g.fillRect(16, sy, 480, 14);
    for (let col = 0; col < 7; col++) {
      const bx = 34 + col * 66;
      const colr = palette[(row * 3 + col) % palette.length];
      g.fillStyle = colr;
      g.fillRect(bx, sy - 68, 44, 68);
      g.strokeStyle = '#241b28';
      g.lineWidth = 4;
      g.strokeRect(bx, sy - 68, 44, 68);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(bx + 6, sy - 62, 10, 54);
    }
  }
  // Diagonal glass reflection streaks
  g.strokeStyle = 'rgba(255,255,255,0.42)';
  g.lineWidth = 22;
  g.beginPath();
  g.moveTo(60, 480);
  g.lineTo(310, 40);
  g.moveTo(150, 480);
  g.lineTo(395, 40);
  g.stroke();
  g.strokeStyle = '#344954';
  g.lineWidth = 18;
  g.strokeRect(9, 9, 494, 494);
  return c;
}

export function basketWeave(baseColor = '#e0483e') {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#3a1a1d';
  for (let y = 26; y < 236; y += 34) {
    for (let x = 20; x < 236; x += 38) {
      g.fillRect(x, y, 22, 16);
    }
  }
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 256, 24);
  g.fillRect(0, 232, 256, 24);
  return c;
}

export function chipBagTexture() {
  const [c, g] = makeCanvas(512, 640);
  g.fillStyle = '#6f32a8';
  g.fillRect(0, 0, 512, 640);
  g.fillStyle = '#f8c838';
  g.fillRect(0, 0, 512, 54);
  g.fillRect(0, 586, 512, 54);
  g.beginPath();
  g.arc(256, 320, 188, 0, Math.PI * 2);
  g.fillStyle = '#f8c838';
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = '#25182e';
  g.stroke();
  g.fillStyle = '#c82b34';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 94px Arial Black, sans-serif';
  g.fillText('MEGA', 256, 275);
  g.fillStyle = '#25182e';
  g.font = '900 84px Arial Black, sans-serif';
  g.fillText('CHIPS', 256, 372);
  return c;
}

export function radialShadow(col = '24,20,34', a = 0.5) {
  const [c, g] = makeCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(0.55, `rgba(${col},${a * 0.55})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
}
