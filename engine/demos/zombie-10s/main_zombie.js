/**
 * Freshly authored 3D Convenience Store + 2D Cartoon Zombie renderer (10s / 300 frames, 1080x1920).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01 Phase 7).
 * Uses the same Three.js 0.160.0 2-step Toon + Normal/Depth Ink + 48-tap DOF + 2D alpha-tested
 * billboard card architecture without reusing the Soldier environment or story assets.
 */

import * as THREE from 'three';
import * as P from './paint_store.js';
import * as Cast from './cast_zombie.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, worldAt, actorsAt, fxAt } from './story_zombie.js';
import * as Visual from '/visual/index.js';

const outCfg = (typeof globalThis !== 'undefined' && globalThis.__RENDER_OUTPUT_CONFIG__) || {};
const W = outCfg.width || 1080;
const H = outCfg.height || 1920;
const SCALE = H / 1920;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 250);
const rx = (a) => (a * Math.PI) / 180;

// ---------- 2-step toon materials ----------
const grad = (() => {
  const d = new Uint8Array([105, 105, 105, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 2, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });

const MAT = {
  floor: toon({ map: P.makeTex(P.tileFloor(101), 7, 7) }),
  wall: toon({ map: P.makeTex(P.storeWall(102), 3, 1) }),
  ceiling: toon({ color: '#eef2f5' }),
  peg: toon({ map: P.makeTex(P.pegboard(103), 2, 1) }),
  shelfMetal: toon({ color: '#d7dce2' }),
  shelfTrim: toon({ color: '#e4524a' }),
  shelfTrimTeal: toon({ color: '#2d938e' }),
  doorFrame: toon({ color: '#394b57' }),
  glass: new THREE.MeshBasicMaterial({ color: '#bfe8f8', transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
  sign247: toon({ map: P.makeTex(P.diegeticSign('24/7 SNACKS', 'OPEN ALL NIGHT', '#237a75', '#fff9eb', '#f6c343'), 1, 1, true) }),
  signAisle: toon({ map: P.makeTex(P.diegeticSign('CRUNCH AISLE', 'MEGA CHIPS', '#c93832', '#ffffff', '#ffd954'), 1, 1, true) }),
  soldOut: toon({ map: P.makeTex(P.soldOutTag(), 1, 1, true), side: THREE.DoubleSide }),
  cooler: toon({ map: P.makeTex(P.coolerFront(104), 1, 1, true) }),
  counter: toon({ color: '#458b84' }),
  counterTop: toon({ color: '#f2e8d5' }),
  lampTube: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  basketRed: toon({ map: P.makeTex(P.basketWeave('#e0483e'), 1, 1) }),
  basketYel: toon({ map: P.makeTex(P.basketWeave('#f2be35'), 1, 1) }),
  handle: toon({ color: '#2e343b' }),
  chipBag: toon({ map: P.makeTex(P.chipBagTexture(), 1, 1, true) }),
  crumpled: toon({ color: '#e26a3f' }),
  fanBlade: toon({ color: '#5c6d78' }),
};

// ---------- normal + depth shaders (for world ink & DOF) ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.recv ?? true;
  parent.add(m);
  return m;
};

// ---------- lights & sky ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#cccccc', 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff8eb', 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);
scene.fog = new THREE.Fog('#eef5f4', 18, 65);
scene.background = new THREE.Color('#a4d8f0');

// ---------- convenience store 3D world ----------
const world = new THREE.Group();
scene.add(world);

// Floor & ceiling
const floor = add(new THREE.PlaneGeometry(18, 16), MAT.floor, 1, 0, 0, world, { cast: false });
floor.rotation.x = -Math.PI / 2;
const ceil = add(new THREE.PlaneGeometry(18, 16), MAT.ceiling, 1, 4.4, 0, world, { cast: false, recv: false });
ceil.rotation.x = Math.PI / 2;

// Back wall (z=-5.2), right wall (x=7.5), left entrance wall (x=-5.2)
add(new THREE.BoxGeometry(16, 4.4, 0.3), MAT.wall, 1, 2.2, -5.2, world, { cast: false });
add(new THREE.BoxGeometry(0.3, 4.4, 14), MAT.wall, 7.6, 2.2, 0.5, world, { cast: false });
// Entrance wall segments framing the sliding glass door at x=-4.4, z=0
add(new THREE.BoxGeometry(0.3, 4.4, 4.0), MAT.wall, -4.4, 2.2, -3.5, world, { cast: false });
add(new THREE.BoxGeometry(0.3, 4.4, 4.4), MAT.wall, -4.4, 2.2, 3.8, world, { cast: false });
add(new THREE.BoxGeometry(0.3, 1.3, 3.2), MAT.wall, -4.4, 3.75, 0.1, world, { cast: false });

// Glowing "24/7 SNACKS" header sign above entrance (facing inward +X toward camera!)
const sign247 = add(new THREE.BoxGeometry(0.14, 0.72, 2.4), MAT.sign247, -4.2, 3.35, 0.1, world, { cast: false });

// Sliding glass entrance doors (animated by worldAt.doorOpen)
const doorL = new THREE.Group();
const doorR = new THREE.Group();
world.add(doorL);
world.add(doorR);
for (const [grp, zBase] of [[doorL, -0.68], [doorR, 0.88]]) {
  add(new THREE.BoxGeometry(0.08, 2.9, 1.45), MAT.doorFrame, -4.4, 1.45, zBase, grp);
  const pane = add(new THREE.BoxGeometry(0.10, 2.55, 1.2), MAT.glass, -4.4, 1.48, zBase, grp, { cast: false, recv: false });
  pane.userData.ndSkip = true;
}

// Refrigerated drink coolers along back wall (x=-2.2 to 2.2, z=-4.7)
for (const cx of [-1.8, 0.2, 2.2]) {
  add(new THREE.BoxGeometry(1.75, 3.1, 0.85), MAT.doorFrame, cx, 1.55, -4.65, world);
  add(new THREE.PlaneGeometry(1.55, 2.65), MAT.cooler, cx, 1.62, -4.21, world, { cast: false });
}

// Checkout counter in left-background
add(new THREE.BoxGeometry(2.6, 1.02, 0.9), MAT.counter, -2.1, 0.51, -2.5, world);
add(new THREE.BoxGeometry(2.75, 0.1, 1.0), MAT.counterTop, -2.1, 1.06, -2.5, world);
add(new THREE.BoxGeometry(0.55, 0.42, 0.45), MAT.doorFrame, -2.3, 1.31, -2.5, world); // cash register

// Fluorescent ceiling fixtures & rotating ceiling fan (secondary motion!)
const lamps = [];
for (const lx of [-1.6, 2.2, 5.2]) {
  add(new THREE.BoxGeometry(0.32, 0.12, 2.6), MAT.doorFrame, lx, 4.26, -0.4, world, { cast: false });
  lamps.push(add(new THREE.BoxGeometry(0.24, 0.08, 2.4), MAT.lampTube, lx, 4.18, -0.4, world, { cast: false, recv: false }));
}
const fanGroup = new THREE.Group();
fanGroup.position.set(1.2, 4.1, -0.8);
world.add(fanGroup);
add(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 10), MAT.doorFrame, 0, 0.18, 0, fanGroup, { cast: false });
for (let i = 0; i < 4; i++) {
  const b = add(new THREE.BoxGeometry(1.4, 0.04, 0.22), MAT.fanBlade, 0, 0, 0, fanGroup, { cast: false });
  b.rotation.y = (i * Math.PI) / 2;
  b.position.set(Math.cos(b.rotation.y) * 0.68, 0, -Math.sin(b.rotation.y) * 0.68);
}

// ---------- HERO EMPTY SNACK GONDOLA ("CRUNCH AISLE") at x=5.2, z=-2.1 ----------
const shelfG = new THREE.Group();
shelfG.position.set(5.2, 0, -2.1);
shelfG.rotation.y = rx(-22);
world.add(shelfG);

add(new THREE.BoxGeometry(0.22, 3.25, 3.6), MAT.peg, 0.35, 1.62, 0, shelfG);
add(new THREE.BoxGeometry(0.95, 0.22, 3.65), MAT.shelfTrim, 0, 0.11, 0, shelfG);
for (const sy of [0.85, 1.55, 2.25, 2.95]) {
  add(new THREE.BoxGeometry(0.86, 0.08, 3.55), MAT.shelfMetal, 0, sy, 0, shelfG);
  add(new THREE.BoxGeometry(0.06, 0.12, 3.55), MAT.shelfTrimTeal, -0.42, sy, 0, shelfG);
}
// Overhead aisle banner (readable planar UVs facing -X toward viewer!)
const aisleSign = add(new THREE.BoxGeometry(0.14, 0.68, 2.6), MAT.signAisle, -0.1, 3.6, 0, shelfG);

// Tiny lone crumpled chip wrapper on middle shelf (comedic emptiness)
const crumb = add(new THREE.DodecahedronGeometry(0.11, 0), MAT.crumpled, -0.15, 1.68, 0.35, shelfG);
crumb.scale.set(1.2, 0.65, 0.9);

// Swinging "SOLD OUT!" cardboard tag hung on shelf front
const tagPivot = new THREE.Group();
tagPivot.position.set(-0.46, 2.22, -0.25);
shelfG.add(tagPivot);
const tagCard = add(new THREE.PlaneGeometry(0.92, 0.46), MAT.soldOut, 0, -0.26, 0, tagPivot);
tagCard.rotation.y = -Math.PI / 2;

// ---------- SHOPPING BASKET TOWER (at x=3.1, z=0.45) — BUMPED AT FRAME 235! ----------
function makeBasket(mat) {
  const g = new THREE.Group();
  add(new THREE.BoxGeometry(0.76, 0.06, 0.52), mat, 0, 0.03, 0, g);
  add(new THREE.BoxGeometry(0.76, 0.34, 0.06), mat, 0, 0.20, 0.23, g);
  add(new THREE.BoxGeometry(0.76, 0.34, 0.06), mat, 0, 0.20, -0.23, g);
  add(new THREE.BoxGeometry(0.06, 0.34, 0.52), mat, 0.35, 0.20, 0, g);
  add(new THREE.BoxGeometry(0.06, 0.34, 0.52), mat, -0.35, 0.20, 0, g);
  add(new THREE.BoxGeometry(0.78, 0.05, 0.05), MAT.handle, 0, 0.39, 0.22, g);
  add(new THREE.BoxGeometry(0.78, 0.05, 0.05), MAT.handle, 0, 0.39, -0.22, g);
  return g;
}

const baskets = [];
const basketBasePos = [
  [3.15, 0.00, 0.45],
  [3.15, 0.36, 0.45],
  [3.15, 0.72, 0.45],
  [3.15, 1.08, 0.45],
];
basketBasePos.forEach((p, idx) => {
  const b = makeBasket(idx % 2 === 0 ? MAT.basketRed : MAT.basketYel);
  b.position.set(...p);
  b.userData.base = new THREE.Vector3(...p);
  world.add(b);
  baskets.push(b);
});

// 5 colorful soda cans inside top basket that spill & roll on impact!
const canColors = ['#e65540', '#3d99d6', '#58b368', '#f2b830', '#9859b6'];
const cans = canColors.map((col, idx) => {
  const m = add(
    new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12),
    toon({ color: col }),
    3.15 + (idx - 2) * 0.11,
    1.22,
    0.45 + ((idx % 2) - 0.5) * 0.12,
    world
  );
  m.userData.base = m.position.clone();
  return m;
});

// Forgotten jumbo "MEGA CHIPS" bag perched on left end of top rack (unobstructed sign!) -> tumbles down at f=248..268!
const fallingBag = add(new THREE.BoxGeometry(0.46, 0.60, 0.20), MAT.chipBag, 4.55, 3.25, -0.85, world);
fallingBag.rotation.y = rx(-25);

// ---------- 2D billboard actor cards ----------
const CW = 1200;
const CH = 2000;
const CM = 2.15;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM);
cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.makeTex(P.radialShadow('24,20,34', 0.55), 1, 1, true);

class Card {
  constructor() {
    this.c = document.createElement('canvas');
    this.c.width = CW;
    this.c.height = CH;
    this.g = this.c.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c);
    this.t.colorSpace = THREE.SRGBColorSpace;
    this.t.anisotropy = 4;
    this.basicMat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.litMat = Visual.createLitCardMaterial(this.t, { pxScale: SCALE }, { charTint: '#fff5ec', charShade: 0.85, rimStrength: 0.14 });
    this.mat = this.basicMat;
    this.mesh = new THREE.Mesh(cardGeo, this.mat);
    this.mesh.userData.nd = cardNd(this.t);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.userData.ndSkip = true;
    this.blob.renderOrder = 1;
    scene.add(this.mesh);
    scene.add(this.blob);
    this.key = '';
    this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return;
    this.key = key;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CW, CH);
    g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    fn(new Cast.Pen(g));
    this.t.needsUpdate = true;
  }
}
const cards = [];
const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & Ink + 48-tap DOF postprocess ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };

const inkU = {
  col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) },
  px: { value: 2.4 }, sat: { value: 1.12 }, lift: { value: new THREE.Color(0, 0, 0) },
  gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.18 }, flash: { value: 0 },
};
const inkScene = fs(new THREE.ShaderMaterial({
  uniforms: inkU,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 lift, gain; varying vec2 vUv;
    float edgeAt(vec2 uv, float r){
      vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
      float e = 0.; float rr = r * clamp(6./max(d,0.5), .65, 1.25);
      for (int i=0;i<16;i++){
        float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
        vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
        float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
        if (card && ds > 0.) continue;
        if (card) ds = 1e4;
        vec3 ns = s.rgb*2.-1.;
        e = max(e, smoothstep(.008, .025, (ds - d)/max(d,0.1)));
        if (!card && abs(ds-d)/max(d,0.1) < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .88);
      }
      return e * (1. - smoothstep(40., 120., d)*.7);
    }
    void main(){
      vec3 c = texture2D(col, vUv).rgb;
      float e = edgeAt(vUv, px);
      c = mix(c, vec3(.018,.012,.024), e);
      float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
      c = c*gain + lift;
      vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.0;
      c = mix(c, vec3(1.), flash);
      gl_FragColor = vec4(c,1.);
    }`,
}));

const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({
  uniforms: dofU,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
    float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 500.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
    void main(){
      float c0 = coc(vUv);
      if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
      vec3 acc = vec3(0.); float wsum = 0.;
      for (int i=0;i<48;i++){
        float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
        vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
        float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
        acc += texture2D(src, vUv+o).rgb*w; wsum += w;
      }
      gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.));
    }`,
}));
dofScene.children[0].material.toneMapped = false;

const enhInkPass = Visual.createInkGradePass(W, H, { colorTexture: rtColor.texture, ndTexture: rtNd.texture, grainAmount: 0.014 });
const enhDofPass = Visual.createDofPass(W, H, { srcTexture: rtInk.texture, ndTexture: rtNd.texture });
const isEnhancedMode = () => globalThis.__STUDIO_OVERRIDES__?.scene?.visualFoundation === 'enhanced';
const ENH_PROFILE_MAP = {
  storeBright: 'warmInterior',
  dramaticBlue: 'coolDramatic',
  storePayoff: 'warmInterior',
};

const tmpV = new THREE.Vector3();
function applyLight(L, W_) {
  hemi.color.set(L.sky);
  hemi.groundColor.set(L.ground);
  hemi.intensity = L.hemi * W_.flicker;
  sun.color.set(L.sun);
  sun.intensity = L.sunI * W_.flicker;
  scene.fog.color.set(L.fog);
  scene.fog.near = L.fogNear;
  scene.fog.far = L.fogFar;
  inkU.sat.value = L.sat;
  inkU.gain.value.set(L.gain || '#ffffff');
  inkU.lift.value.set(L.lift || '#000000');
  inkU.vig.value = L.vig ?? 0.18;
  for (const lm of lamps) lm.material.color.setScalar(W_.flicker);
}

function updateWorld(W_) {
  doorL.position.z = -W_.doorOpen * 1.15;
  doorR.position.z = W_.doorOpen * 1.15;
  fanGroup.rotation.y = W_.fanAngle;
  tagPivot.rotation.z = W_.tagSwing;

  // Basket tower physics on bump (top 3 baskets scatter & bounce)
  baskets.forEach((b, idx) => {
    b.position.copy(b.userData.base);
    b.rotation.set(0, 0, 0);
    if (W_.bumpT > 0) {
      if (idx === 0) {
        // Bottom basket slides slightly
        const slide = Math.min(1, W_.bumpT * 2.2);
        b.position.x += slide * 0.25;
        b.rotation.y = slide * 0.22;
      } else {
        const delay = (3 - idx) * 0.08;
        const t = Math.max(0, W_.bumpT - delay);
        if (t > 0) {
          const vx = [0.6, 1.35, 1.85, 2.35][idx];
          const vz = [0.0, 1.05, -0.85, 1.55][idx];
          const y0 = b.userData.base.y;
          const rawY = y0 + 1.4 * t - 4.9 * t * t;
          const bouncedY = rawY >= 0.18 ? rawY : 0.18 + Math.abs(Math.sin((t - 0.3) * 9)) * Math.exp(-t * 2.2) * 0.28;
          b.position.x = b.userData.base.x + vx * Math.min(t, 1.15);
          b.position.z = b.userData.base.z + vz * Math.min(t, 1.15);
          b.position.y = bouncedY;
          b.rotation.z = -Math.min(1.55, t * (2.6 + idx * 0.5));
          b.rotation.x = Math.min(1.2, t * (1.2 * (idx % 2 ? 1 : -1)));
        }
      }
    }
  });

  // Rolling soda cans spill out onto tiled floor
  cans.forEach((c, idx) => {
    c.position.copy(c.userData.base);
    c.rotation.set(0, 0, 0);
    if (W_.bumpT > 0) {
      const t = Math.max(0, W_.bumpT - idx * 0.04);
      const ang = -0.9 + idx * 0.45;
      const spd = 1.6 + (idx % 3) * 0.55;
      const y = Math.max(0.08, c.userData.base.y + 1.9 * t - 5.4 * t * t);
      c.position.x = c.userData.base.x + Math.cos(ang) * spd * Math.min(t, 1.4);
      c.position.z = c.userData.base.z + Math.sin(ang) * spd * Math.min(t, 1.4);
      c.position.y = y;
      c.rotation.z = Math.PI / 2;
      c.rotation.x = t * 14;
    }
  });

  // Forgotten jumbo MEGA CHIPS bag tumbles down onto Bloop's head then caught!
  fallingBag.visible = !W_.chipCaught;
  if (!W_.chipCaught) {
    const t = W_.chipDropT;
    fallingBag.position.set(
      4.55 + (2.05 - 4.55) * t,
      3.25 + 0.55 * Math.sin(t * Math.PI) - 1.35 * t * t,
      -0.85 + (-0.05 + 0.85) * t
    );
    fallingBag.rotation.set(t * Math.PI * 2.2, rx(-25) + t * 1.4, t * 2.8);
  }
}

function drawActors(list, L, enh) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true;
    c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1;
    c.mesh.scale.set(s, s, s);
    c.mesh.rotation.set(0, Math.atan2(camera.position.x - a.x, camera.position.z - a.z), a.roll || 0);
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (enh && a.order !== 6) {
      c.mesh.material = c.litMat;
      c.mesh.receiveShadow = true;
      Visual.updateCardLight(c.litMat, L, { pxScale: SCALE });
    } else {
      c.mesh.material = c.basicMat;
      c.mesh.receiveShadow = false;
      c.basicMat.color.set(a.tint || '#ffffff');
    }
    if (a.blob !== false) {
      c.blob.visible = true;
      if (enh) {
        Visual.makeContactShadow(c.blob, a, L);
      } else {
        c.blob.position.set(a.x, 0.02, a.z);
        c.blob.scale.set(0.95 * s, 0.6 * s, 1);
      }
    }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0;
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  syncSceneTextOverrides();
  const enh = isEnhancedMode();
  const S = shotAt(f);
  const L = enh ? Visual.getLookProfile({ ...Visual.LOOK_PROFILES[ENH_PROFILE_MAP[S.light] || 'warmInterior'], ...lightFor(S) }) : lightFor(S);
  const C = camAt(f);
  const W_ = worldAt(f);

  applyLight(L, W_);
  camera.position.set(...C.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...C.look);
  camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  updateWorld(W_);
  const az = rx(L.az);
  const el = rx(L.el);
  tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const focus = new THREE.Vector3(...C.shadowAt);
  sun.position.copy(focus).addScaledVector(tmpV, 24);
  sun.target.position.copy(focus);
  const ext = L.shadowExt || 14;
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 60;
  sc.updateProjectionMatrix();

  drawActors([...actorsAt(f, Cast), ...fxAt(f, Cast)], L, enh);

  // Pass A: color
  renderer.setRenderTarget(rtColor);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);

  // Pass B: normal + depth
  const fog = scene.fog;
  scene.fog = null;
  const sm = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.autoUpdate = false;
  swapForNd(true);
  renderer.setRenderTarget(rtNd);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  swapForNd(false);
  scene.fog = fog;
  renderer.shadowMap.enabled = sm;
  renderer.shadowMap.autoUpdate = true;

  // Pass C: ink + grade
  if (enh || SCALE !== 1) {
    Visual.updateInkGradeUniforms(enhInkPass, {
      sat: L.sat,
      lift: L.lift || '#000000',
      gain: L.gain || '#ffffff',
      vig: L.vig ?? 0.18,
      flash: C.flash || 0,
      grainSeed: f,
      grainAmount: enh ? 0.015 : 0.0,
    });
    renderer.setRenderTarget(rtInk);
    renderer.render(enhInkPass.scene, fsCam);
  } else {
    inkU.flash.value = C.flash || 0;
    renderer.setRenderTarget(rtInk);
    renderer.render(inkScene, fsCam);
  }

  // Pass D: 48-tap DOF -> screen
  const D = dofAt(f);
  if (enh || SCALE !== 1) {
    Visual.updateDofUniforms(enhDofPass, {
      focus: D.focus,
      cinf: D.cinf,
      near: D.near ?? 1,
    });
    renderer.setRenderTarget(null);
    renderer.render(enhDofPass.scene, fsCam);
  } else {
    dofU.focus.value = D.focus;
    dofU.cinf.value = D.cinf;
    dofU.near.value = D.near ?? 1;
    renderer.setRenderTarget(null);
    renderer.render(dofScene, fsCam);
  }
  return true;
};

window.getRenderBufferMetrics = () => ({
  canvasW: canvas.width,
  canvasH: canvas.height,
  rtColorW: rtColor.width,
  rtColorH: rtColor.height,
  rtNdW: rtNd.width,
  rtNdH: rtNd.height,
  scaleFactor: SCALE,
  visualFoundation: isEnhancedMode() ? 'enhanced' : 'baseline',
});

let appliedSignTitle = '24/7 SNACKS';
let appliedAisleLabel = 'CRUNCH AISLE';

function syncSceneTextOverrides() {
  const ov = typeof globalThis !== 'undefined' ? globalThis.__STUDIO_OVERRIDES__ : null;
  const rawSign = ov?.scene?.signTitle ? String(ov.scene.signTitle).slice(0, 18).trim() : '24/7 SNACKS';
  const nextSign = rawSign || '24/7 SNACKS';
  if (nextSign !== appliedSignTitle) {
    appliedSignTitle = nextSign;
    const prevMap = MAT.sign247.map;
    MAT.sign247.map = P.makeTex(P.diegeticSign(nextSign, 'OPEN ALL NIGHT', '#237a75', '#fff9eb', '#f6c343'), 1, 1, true);
    MAT.sign247.needsUpdate = true;
    prevMap?.dispose?.();
  }
  const rawAisle = ov?.scene?.aisleLabel ? String(ov.scene.aisleLabel).slice(0, 18).trim() : 'CRUNCH AISLE';
  const nextAisle = rawAisle || 'CRUNCH AISLE';
  if (nextAisle !== appliedAisleLabel) {
    appliedAisleLabel = nextAisle;
    const prevMap = MAT.signAisle.map;
    MAT.signAisle.map = P.makeTex(P.diegeticSign(nextAisle, 'MEGA CHIPS', '#c93832', '#ffffff', '#ffd954'), 1, 1, true);
    MAT.signAisle.needsUpdate = true;
    prevMap?.dispose?.();
  }
}

window.setStudioOverrides = (overrides) => {
  globalThis.__STUDIO_OVERRIDES__ = overrides && typeof overrides === 'object' ? overrides : null;
  syncSceneTextOverrides();
  return true;
};

if (globalThis.__STUDIO_OVERRIDES__) {
  syncSceneTextOverrides();
}

window.TOTAL = TOTAL;
window.ready = true;
