/**
 * Scene-specific CanvasTextures & procedural material helpers for How Mine Salting Worked (20s).
 *
 * Provenance: NEW IMPLEMENTATION (SHORT-03A), delegating core procedural textures
 * (rock, ore, wood, metal, soil, fabric, glass) to reusable `/visual/procedural_materials.js`.
 */

import * as THREE from 'three';
import * as Visual from '/visual/index.js';

export const recipe = Visual.createMaterialRecipe;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function wrapTex(canvas, rx = 1, ry = 1, clamp = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Diegetic wooden assay placard / claim ledger texture (sharp at native 4K). */
export function claimBoardCanvas(topText, subText, accentHex = '#e6b83a', darkInk = '#1d1612') {
  const [c, g] = makeCanvas(1024, 512);
  g.fillStyle = '#d9c39b';
  g.fillRect(0, 0, 1024, 512);

  // Subtle parchment/aged plank grain
  for (let i = 0; i < 24; i++) {
    g.fillStyle = i % 2 ? 'rgba(92,68,42,0.06)' : 'rgba(255,248,230,0.08)';
    g.fillRect(0, i * 22, 1024, 12);
  }

  g.strokeStyle = darkInk;
  g.lineWidth = 18;
  g.strokeRect(20, 20, 984, 472);

  g.fillStyle = accentHex;
  g.fillRect(40, 40, 944, 24);

  g.fillStyle = darkInk;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 74px Georgia, serif';
  g.fillText(topText, 512, 208);

  g.fillStyle = '#6f231e';
  g.font = 'bold 48px "Courier New", monospace';
  g.fillText(subText, 512, 340);
  return c;
}

/** Linen bag sample tag ("SAMPLE #1" vs "CORE #2 · 0%"). */
export function sampleTagCanvas(code, detail, tagFill = '#f4ebd4', stripe = '#c9932c') {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = tagFill;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = stripe;
  g.fillRect(0, 0, 512, 76);
  g.strokeStyle = '#241726';
  g.lineWidth = 14;
  g.strokeRect(10, 10, 492, 492);
  g.fillStyle = '#241726';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 82px "Arial Black", sans-serif';
  g.fillText(code, 256, 232);
  g.font = 'bold 46px "Courier New", monospace';
  g.fillText(detail, 256, 354);
  return c;
}

/** Brass assay scale dial face showing LOW <-> HIGH grade arc. */
export function scaleDialCanvas() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#efe3c6';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#755320';
  g.lineWidth = 22;
  g.beginPath();
  g.arc(256, 286, 200, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();

  g.lineWidth = 10;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (1.1 + 0.8 * (i / 8));
    g.strokeStyle = i >= 6 ? '#c88c1a' : i <= 2 ? '#6d6b66' : '#3a2d24';
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * 165, 286 + Math.sin(a) * 165);
    g.lineTo(256 + Math.cos(a) * 195, 286 + Math.sin(a) * 195);
    g.stroke();
  }
  g.fillStyle = '#3a2818';
  g.font = 'bold 44px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.fillText('0%', 92, 342);
  g.fillStyle = '#a86f00';
  g.fillText('RICH!', 406, 342);
  g.fillStyle = '#2b2016';
  g.font = 'bold 42px Georgia, serif';
  g.fillText('ASSAY', 256, 422);
  return c;
}

/** Sunlit canyon vista for mine portal exit backdrop (sky + distant red-rock buttes). */
export function canyonWallCanvas(seed = 801) {
  const [c, g] = makeCanvas(512, 512);
  const r = Visual.seededRng(seed);
  const skyGrad = g.createLinearGradient(0, 0, 0, 320);
  skyGrad.addColorStop(0, '#6ba4d9');
  skyGrad.addColorStop(1, '#f7dfb8');
  g.fillStyle = skyGrad;
  g.fillRect(0, 0, 512, 512);

  // Distant silhouettes of flat-top mesas & sunlit cliff floor
  g.fillStyle = '#c47b4a';
  g.beginPath();
  g.moveTo(0, 340);
  g.lineTo(0, 220);
  g.lineTo(95, 220);
  g.lineTo(135, 290);
  g.lineTo(270, 290);
  g.lineTo(315, 200);
  g.lineTo(445, 200);
  g.lineTo(512, 275);
  g.lineTo(512, 512);
  g.lineTo(0, 512);
  g.closePath();
  g.fill();

  g.fillStyle = '#d99862';
  g.fillRect(0, 340, 512, 172);
  for (let i = 0; i < 24; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(90,46,24,0.16)' : 'rgba(255,232,190,0.16)';
    g.fillRect(r() * 440, 345 + r() * 155, 28 + r() * 65, 6);
  }
  return c;
}
