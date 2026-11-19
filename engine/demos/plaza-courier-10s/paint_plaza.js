/**
 * Freshly authored deterministic Canvas2D textures for Plaza Courier 10s template.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
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

export function cobbleGround(seed = 201) {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#c8c0b0';
  g.fillRect(0, 0, 512, 512);
  const bw = 64;
  const bh = 48;
  for (let row = 0; row < 12; row++) {
    for (let col = -1; col < 10; col++) {
      const x = col * bw + (row % 2) * (bw / 2);
      const y = row * bh;
      const l = 74 + Math.round(r() * 12);
      g.fillStyle = `hsl(38, 22%, ${l}%)`;
      g.beginPath();
      g.roundRect(x + 3, y + 3, bw - 6, bh - 6, 10);
      g.fill();
      g.strokeStyle = '#756f64';
      g.lineWidth = 2;
      g.stroke();
    }
  }
  return c;
}

export function stoneWall(seed = 202) {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#f3e7d1';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = 'rgba(218, 200, 174, 0.45)';
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 16 + r() * 34, 8 + r() * 18, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#d48252';
  g.fillRect(0, 466, 512, 46);
  return c;
}

export function roofTiles(seed = 203) {
  const [c, g] = makeCanvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#b64935';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 32 + (row % 2) * 16;
      const y = row * 32;
      g.fillStyle = `hsl(12, 56%, ${44 + Math.round(r() * 10)}%)`;
      g.beginPath();
      g.ellipse(x + 16, y + 16, 14, 16, 0, 0, Math.PI);
      g.fill();
    }
  }
  return c;
}

export function awningStripes() {
  const [c, g] = makeCanvas(256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? '#e35d4b' : '#fff8ec';
    g.fillRect(i * 32, 0, 32, 256);
  }
  return c;
}

export function plazaSign(title = 'SUNNY PLAZA', subtitle = 'EXPRESS POST') {
  const [c, g] = makeCanvas(1024, 320);
  g.fillStyle = '#244b6e';
  g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#f5c452';
  g.lineWidth = 18;
  g.strokeRect(18, 18, 988, 284);
  g.fillStyle = '#fff9ec';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const titleTxt = String(title).slice(0, 18);
  let fontPx = 98;
  while (fontPx > 46) {
    g.font = `900 ${fontPx}px Arial Black, sans-serif`;
    if (g.measureText(titleTxt).width <= 880) break;
    fontPx -= 4;
  }
  g.fillText(titleTxt, 512, 118);
  g.fillStyle = '#f5c452';
  g.font = '800 54px Arial, sans-serif';
  g.fillText(String(subtitle).slice(0, 24), 512, 228, 880);
  return c;
}

export function clockFace() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#fff9ec';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2c2533';
  g.lineWidth = 14;
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84);
    g.lineTo(128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98);
    g.lineWidth = 6;
    g.stroke();
  }
  return c;
}

export function parcelBox(colorHex = '#e66e4e') {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = colorHex;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#f7d568';
  g.fillRect(108, 0, 40, 256);
  g.fillRect(0, 108, 256, 40);
  g.strokeStyle = '#281d2b';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 246);
  g.fillStyle = '#fffdf7';
  g.fillRect(26, 26, 68, 50);
  g.strokeStyle = '#281d2b';
  g.lineWidth = 4;
  g.strokeRect(26, 26, 68, 50);
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
