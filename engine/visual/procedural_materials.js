/**
 * Deterministic Seeded Procedural CanvasTexture & Toon Material Recipes (SHORT-03A).
 *
 * Provenance: Selectively builds upon hand-painted canvas material idioms from MIT
 * github.com/mromidev/claude-animated-shorts (templates/bridge/paint.ts, commit e3b817b6)
 * with NEW recipe cache, mineral/ore strata, glass, metal, soil, fabric, and disposal.
 */

import * as THREE from 'three';

const materialCache = new Map();
const textureCache = new Map();
let sharedToonGrad = null;

export function getSharedToonGradient() {
  if (!sharedToonGrad) {
    const d = new Uint8Array([98, 98, 98, 255, 255, 255, 255, 255]);
    sharedToonGrad = new THREE.DataTexture(d, 2, 1);
    sharedToonGrad.minFilter = THREE.NearestFilter;
    sharedToonGrad.magFilter = THREE.NearestFilter;
    sharedToonGrad.needsUpdate = true;
  }
  return sharedToonGrad;
}

export function seededRng(seed = 1) {
  let s = (Number(seed) >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function wrapTex(canvas, rx = 1, ry = 1, clamp = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function paintRock(seed, opts = {}) {
  const [c, g] = makeCanvas(512, 512);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#5b565c';
  g.fillRect(0, 0, 512, 512);
  // Stratified sedimentary bands
  for (let y = 0; y < 512; y += 36) {
    const shade = 28 + Math.round((r() - 0.5) * 14);
    g.fillStyle = opts.strataColor || `hsl(${opts.hue ?? 28}, ${opts.sat ?? 12}%, ${shade}%)`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 64) {
      g.lineTo(x, y + (r() - 0.5) * 12);
    }
    g.lineTo(512, y + 36);
    g.lineTo(0, y + 36);
    g.closePath();
    g.fill();
  }
  // Angular rock fractures & pebbles (static seeded, zero frame shimmer)
  for (let i = 0; i < 65; i++) {
    const x = r() * 512;
    const y = r() * 512;
    g.fillStyle = r() < 0.5 ? 'rgba(20,16,22,0.22)' : 'rgba(220,210,198,0.10)';
    g.beginPath();
    g.ellipse(x, y, 8 + r() * 24, 5 + r() * 14, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(24,18,24,0.34)';
  g.lineWidth = 2.2;
  for (let k = 0; k < 18; k++) {
    let x = r() * 512;
    let y = r() * 512;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += (r() - 0.5) * 65;
      y += 14 + r() * 28;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

function paintOre(seed, opts = {}) {
  const c = paintRock(seed, { base: opts.base || '#4d484f', hue: opts.hue ?? 26, sat: 10 });
  const g = c.getContext('2d');
  const r = seededRng(seed + 77);
  // Quartz veins
  g.strokeStyle = opts.veinColor || 'rgba(235,230,220,0.45)';
  g.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    let x = r() * 512;
    let y = 0;
    g.beginPath();
    g.moveTo(x, y);
    while (y < 512) {
      x += (r() - 0.5) * 56;
      y += 40 + r() * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const specks = opts.goldDensity ?? 22;
  for (let i = 0; i < specks; i++) {
    const x = 16 + r() * 480;
    const y = 16 + r() * 480;
    const rad = 5 + r() * 11;
    g.fillStyle = opts.oreColor || '#f5c23e';
    g.strokeStyle = '#33200a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff3b0';
    g.beginPath();
    g.arc(x - rad * 0.25, y - rad * 0.25, rad * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function paintWood(seed, opts = {}) {
  const [c, g] = makeCanvas(512, 512);
  const r = seededRng(seed);
  const colors = opts.planks || ['#8b5a34', '#9e693e', '#7a4d2b', '#8f603a'];
  const rows = 8;
  const rh = 512 / rows;
  for (let i = 0; i < rows; i++) {
    g.fillStyle = colors[(i + Math.floor(r() * 2)) % colors.length];
    g.fillRect(0, i * rh, 512, rh);
    g.strokeStyle = 'rgba(42,24,14,0.34)';
    g.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const y = i * rh + 8 + r() * (rh - 16);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + 5, 340, y - 5, 512, y + (r() - 0.5) * 5);
      g.stroke();
    }
    g.fillStyle = '#3c2414';
    g.fillRect(0, i * rh, 512, 3);
    const seamX = 40 + r() * 420;
    g.fillRect(seamX, i * rh, 3, rh);
    g.fillStyle = '#25262c';
    g.beginPath();
    g.arc(seamX - 10, i * rh + rh * 0.35, 3, 0, Math.PI * 2);
    g.arc(seamX + 12, i * rh + rh * 0.65, 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function paintMetal(seed, opts = {}) {
  const [c, g] = makeCanvas(256, 256);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#7b8794';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(20,25,32,0.14)';
    g.lineWidth = 1.5;
    const y = r() * 256;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y + (r() - 0.5) * 4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(22,26,34,0.45)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 252);
  if (opts.rivets !== false) {
    g.fillStyle = '#404854';
    for (const [rx, ry] of [[16, 16], [240, 16], [16, 240], [240, 240]]) {
      g.beginPath();
      g.arc(rx, ry, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function paintPlaster(seed, opts = {}) {
  const [c, g] = makeCanvas(512, 512);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#efe5d2';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 85; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(180,165,140,0.14)' : 'rgba(255,252,245,0.18)';
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 16 + r() * 44, 10 + r() * 28, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function paintSoil(seed, opts = {}) {
  const [c, g] = makeCanvas(512, 512);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#6f5c49';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(42,32,24,0.28)' : 'rgba(165,140,115,0.20)';
    g.beginPath();
    g.arc(r() * 512, r() * 512, 3 + r() * 12, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function paintFabric(seed, opts = {}) {
  const [c, g] = makeCanvas(256, 256);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#c8b28e';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = opts.weaveColor || 'rgba(85,65,45,0.22)';
  g.lineWidth = 2;
  for (let i = 0; i < 256; i += 12) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  for (let k = 0; k < 20; k++) {
    g.fillStyle = 'rgba(70,52,35,0.10)';
    g.fillRect(r() * 256, r() * 256, 20, 6);
  }
  return c;
}

function paintTiles(seed, opts = {}) {
  const [c, g] = makeCanvas(512, 512);
  const r = seededRng(seed);
  g.fillStyle = opts.grout || '#9ca8ad';
  g.fillRect(0, 0, 512, 512);
  const step = 64;
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 512; x += step) {
      const shade = (opts.lightness ?? 86) + Math.round((r() - 0.5) * 6);
      g.fillStyle = opts.hue ? `hsl(${opts.hue}, 18%, ${shade}%)` : `hsl(190, 12%, ${shade}%)`;
      g.fillRect(x + 3, y + 3, step - 6, step - 6);
    }
  }
  return c;
}

function paintConcrete(seed, opts = {}) {
  return paintPlaster(seed, { base: opts.base || '#bfc6cc' });
}

function paintGrass(seed, opts = {}) {
  const [c, g] = makeCanvas(256, 256);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#669d49';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = r() < 0.5 ? '#518539' : '#80b95f';
    g.lineWidth = 3;
    const x = r() * 256;
    const y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 10, y - 12 - r() * 10);
    g.stroke();
  }
  return c;
}

function paintWater(seed, opts = {}) {
  const [c, g] = makeCanvas(256, 256);
  const r = seededRng(seed);
  g.fillStyle = opts.base || '#4f9fd6';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(220,245,255,0.42)';
  g.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const x = r() * 220;
    const y = r() * 256;
    g.beginPath();
    g.arc(x + 18, y, 18, 0.1 * Math.PI, 0.9 * Math.PI);
    g.stroke();
  }
  return c;
}

const PAINTERS = {
  rock: paintRock,
  ore: paintOre,
  wood: paintWood,
  metal: paintMetal,
  plaster: paintPlaster,
  concrete: paintConcrete,
  soil: paintSoil,
  fabric: paintFabric,
  tiles: paintTiles,
  grass: paintGrass,
  water: paintWater,
};

export function createMaterialRecipe(type, opts = {}) {
  const seed = opts.seed ?? 101;
  const rx = opts.repeatX ?? 1;
  const ry = opts.repeatY ?? 1;
  const clamp = Boolean(opts.clamp);
  const cacheKey = JSON.stringify({ type, seed, rx, ry, clamp, ...opts });

  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey);
  }

  let mat;
  if (type === 'glass') {
    mat = new THREE.MeshBasicMaterial({
      color: opts.base || '#cbe9fa',
      transparent: true,
      opacity: opts.opacity ?? 0.38,
      side: THREE.DoubleSide,
    });
  } else {
    const painter = PAINTERS[type] || paintPlaster;
    const texKey = `${type}:${seed}:${rx}:${ry}:${clamp}:${JSON.stringify(opts)}`;
    let tex = textureCache.get(texKey);
    if (!tex) {
      tex = wrapTex(painter(seed, opts), rx, ry, clamp);
      textureCache.set(texKey, tex);
    }
    mat = new THREE.MeshToonMaterial({
      gradientMap: getSharedToonGradient(),
      map: tex,
      color: opts.tint || '#ffffff',
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  mat.userData.recipeType = type;
  mat.userData.recipeSeed = seed;
  materialCache.set(cacheKey, mat);
  return mat;
}

export function getProceduralMaterialStats() {
  return {
    cachedMaterials: materialCache.size,
    cachedTextures: textureCache.size,
  };
}

export function disposeMaterialCache() {
  for (const m of materialCache.values()) {
    m?.dispose?.();
  }
  for (const t of textureCache.values()) {
    t?.dispose?.();
  }
  materialCache.clear();
  textureCache.clear();
  sharedToonGrad?.dispose?.();
  sharedToonGrad = null;
}
