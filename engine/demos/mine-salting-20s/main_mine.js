/**
 * Originally authored 3D Gold Mine + 2D Stick Cast renderer for How Mine Salting Worked (20s / 600f).
 *
 * Provenance: NEW IMPLEMENTATION (SHORT-03A), consuming ALL 7 reusable `/visual/` foundation
 * modules + MIT `/toonbase/toonbase.js`. Supports both 1080x1920 standard and native 2160x3840 4K.
 */

import * as THREE from 'three';
import * as P from './paint_mine.js';
import * as Cast from './cast_mine.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, worldAt, actorsAt, fxAt } from './story_mine.js';
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

// ProceduralToon & Custom Sign Materials (via Visual.createMaterialRecipe)
const MAT = {
  floorDirt: P.recipe('soil', { seed: 201, repeatX: 5, repeatY: 8, base: '#453e38' }),
  bedrockWall: P.recipe('rock', { seed: 202, repeatX: 4, repeatY: 2, base: '#51525a' }),
  rawGreyCore: P.recipe('rock', { seed: 203, repeatX: 2, repeatY: 2, base: '#6a6e77' }),
  oreSeamBase: P.recipe('ore', { seed: 204, repeatX: 2, repeatY: 2, base: '#49474e' }),
  goldVein: P.recipe('ore', { seed: 205, repeatX: 2, repeatY: 2, base: '#c99728', veinColor: '#ffea64' }),
  timber: P.recipe('wood', { seed: 206, repeatX: 1, repeatY: 3, base: '#6b472b' }),
  workbenchWood: P.recipe('wood', { seed: 207, repeatX: 2, repeatY: 1, base: '#7d5232' }),
  ironRail: P.recipe('metal', { seed: 208, repeatX: 3, repeatY: 1, base: '#4d525c' }),
  brassMetal: P.recipe('metal', { seed: 209, repeatX: 1, repeatY: 1, base: '#cfa03c' }),
  sackCloth: P.recipe('fabric', { seed: 210, repeatX: 1, repeatY: 1, base: '#cfb98c' }),
  goldNugget: new THREE.MeshToonMaterial({ gradientMap: Visual.getSharedToonGradient(), color: '#ffd942' }),
  lanternGlow: new THREE.MeshBasicMaterial({ color: '#ffdf76' }),
  canyonRock: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.canyonWallCanvas(802), 2, 2, false),
  }),
  claimBoard: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.claimBoardCanvas('CLAIM #4 · SALTED ORE', 'TEST vs REALITY', '#e2b13c'), 1, 1, true),
  }),
  zeroBoard: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.claimBoardCanvas('BEDROCK CORE: 0.00%', 'EMPTY HOST ROCK', '#c93b2b'), 1, 1, true),
  }),
  tagRigged: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.sampleTagCanvas('SAMPLE #1', 'GOLD DUST', '#f8edd2', '#d49a2a'), 1, 1, true),
  }),
  tagControl: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.sampleTagCanvas('CORE #2', '0.00% AU', '#e3e7ed', '#68717e'), 1, 1, true),
  }),
  scaleDial: new THREE.MeshToonMaterial({
    gradientMap: Visual.getSharedToonGradient(),
    map: P.wrapTex(P.scaleDialCanvas(), 1, 1, true),
  }),
};

// Lights & Sky Dome
const hemi = new THREE.HemisphereLight('#ffc684', '#2c2220', 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffbe6b', 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

// Interior warm lantern fill Light (bright enough to articulate mine texture cleanly)
const lanternPt = new THREE.PointLight('#ffd28e', 2.4, 15, 1.2);
lanternPt.position.set(1.25, 2.35, -1.0);
scene.add(lanternPt);

scene.fog = new THREE.Fog('#1f1a24', 10, 40);

const skyU = { top: { value: new THREE.Color('#273e6a') }, hor: { value: new THREE.Color('#ffdfb3') } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(140, 24, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: `varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vD = normalize(w.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 top, hor; varying vec3 vD; void main(){ float h = clamp(vD.y * 1.15, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.7)), 1.0); }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
);
sky.userData.sky = true;
sky.userData.ndSkip = true;
scene.add(sky);

const world = new THREE.Group();
scene.add(world);
const occluders = [];

const add = (geo, mat, x = 0, y = 0, z = 0, parent = world, opts = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.recv ?? true;
  if (opts.name) m.name = opts.name;
  if (opts.nonEssentialProp) m.userData.nonEssentialProp = true;
  if (opts.ignoreOcclusion) m.userData.ignoreOcclusion = true;
  parent.add(m);
  if (opts.occluder !== false && !opts.ignoreOcclusion) occluders.push(m);
  return m;
};

// ---------- 3D GOLD MINE TUNNEL ARCHITECTURE ----------
// Floor extending through mine and out canyon portal (z = +7 to -18)
const floor = add(new THREE.BoxGeometry(11, 0.4, 28), MAT.floorDirt, 0, -0.2, -4, world, { cast: false, occluder: false });
floor.userData.ignoreOcclusion = true;

// Steel ore-cart track running left-of-center (x = -2.2..-1.35) cleanly away from camera axis
for (const rxPos of [-2.22, -1.42]) {
  add(new THREE.BoxGeometry(0.08, 0.09, 17), MAT.ironRail, rxPos, 0.045, -1.5, world, { name: 'mineRail', ignoreOcclusion: true });
}
for (let tz = -9.2; tz <= 6.0; tz += 0.65) {
  add(new THREE.BoxGeometry(1.18, 0.07, 0.16), MAT.timber, -1.82, 0.02, tz, world, { name: 'railSleeper', ignoreOcclusion: true });
}

// Left & Right jagged tunnel rock walls (`x = -3.4` left, `x = +3.1` right, z from +6.5 to -7.5)
add(new THREE.BoxGeometry(1.4, 5.2, 15.5), MAT.bedrockWall, -3.95, 2.5, -0.8, world, { name: 'leftTunnelWall' });
add(new THREE.BoxGeometry(1.4, 5.2, 15.5), MAT.bedrockWall, 3.65, 2.5, -0.8, world, { name: 'rightTunnelWall' });
// Ceiling rock slab cast:false so key directional sun/lantern shafts illuminate cavern cleanly
add(new THREE.BoxGeometry(8.8, 1.2, 15.0), MAT.bedrockWall, 0, 4.95, -0.8, world, { name: 'tunnelRoof', cast: false, ignoreOcclusion: true });

// Back raw gray bedrock drift alcove right wall (`check` location around x = +0.55, z = -5.65)
const coreWall = add(new THREE.BoxGeometry(3.4, 4.1, 1.1), MAT.rawGreyCore, 0.55, 1.95, -5.65, world, { name: 'deepCoreWall' });
const coreCrackHole = add(new THREE.DodecahedronGeometry(0.26, 0), new THREE.MeshToonMaterial({ color: '#27292e' }), 0.96, 1.05, -5.08, world, { name: 'chiselCoreCrater', ignoreOcclusion: true });
coreCrackHole.scale.set(1.25, 0.95, 0.45);
coreCrackHole.visible = false;

// Sunlit outer canyon mesa visible far outside exit arch (`z = -15.5`)
add(new THREE.BoxGeometry(16, 10, 1.2), MAT.canyonRock, -1.2, 4.5, -15.5, world, { name: 'farCanyonMesa', cast: false, ignoreOcclusion: true });
add(new THREE.BoxGeometry(24, 1.0, 12), P.recipe('soil', { seed: 255, base: '#c68d53' }), 0, -0.45, -13.0, world, { cast: false, ignoreOcclusion: true });

// Heavy square timber shoring arches along tunnel (posts at x = +-2.88 so center lane x in [-2.4..2.4] stays wide open)
const lanternGroups = [];
for (const [idx, zPos] of [-6.8, -3.8, -0.9, 2.1, 5.0].entries()) {
  add(new THREE.BoxGeometry(0.28, 4.1, 0.28), MAT.timber, -2.92, 2.05, zPos, world, { name: `postL_${idx}` });
  add(new THREE.BoxGeometry(0.28, 4.1, 0.28), MAT.timber, 2.75, 2.05, zPos, world, { name: `postR_${idx}` });
  add(new THREE.BoxGeometry(6.1, 0.30, 0.30), MAT.timber, -0.08, 4.08, zPos, world, { name: `capBeam_${idx}`, ignoreOcclusion: true });

  // Swinging brass oil lanterns mounted along posts on right/left alternating
  if (idx <= 3) {
    const lg = new THREE.Group();
    const sideX = idx % 2 === 0 ? 2.48 : -2.62;
    lg.position.set(sideX, 3.05, zPos + 0.14);
    const arm = add(new THREE.BoxGeometry(0.32, 0.08, 0.08), MAT.ironRail, sideX > 0 ? 0.14 : -0.14, 0, 0, lg, { ignoreOcclusion: true });
    arm.castShadow = false;
    const pivot = new THREE.Group();
    lg.add(pivot);
    const cap = add(new THREE.CylinderGeometry(0.08, 0.14, 0.10, 8), MAT.brassMetal, 0, -0.22, 0, pivot, { ignoreOcclusion: true });
    cap.castShadow = false;
    const globe = add(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 10), MAT.lanternGlow, 0, -0.35, 0, pivot, { ignoreOcclusion: true });
    globe.castShadow = false;
    world.add(lg);
    lanternGroups.push({ pivot, globe });
  }
}

// ---------- HERO STORYTELLING PROPS ----------
// 1. Right wall salient rock vein ("secret" salting face at x = +2.35, z = -1.65 & hook face x = +1.72, z = +0.25)
const secretRockOutcrop = add(new THREE.DodecahedronGeometry(0.92, 1), MAT.oreSeamBase, 2.55, 1.15, -1.65, world, { name: 'secretRockFace' });
secretRockOutcrop.scale.set(0.85, 1.35, 1.3);

const goldDustPatches = [];
const patchOffsets = [
  [1.92, 1.48, -1.55, 0.16],
  [1.98, 1.18, -1.35, 0.19],
  [1.95, 1.32, -1.85, 0.15],
  [1.90, 0.96, -1.62, 0.17],
  // Hook seam glint patch on right side boulder
  [1.08, 0.72, 1.32, 0.14],
];
for (const [px, py, pz, r] of patchOffsets) {
  const gp = add(new THREE.DodecahedronGeometry(r, 0), MAT.goldNugget, px, py, pz, world, { name: 'saltedGoldPatch', ignoreOcclusion: true });
  gp.scale.set(0.55, 1.1, 1.2);
  goldDustPatches.push({ mesh: gp, baseS: gp.scale.clone() });
}
const hookBoulder = add(new THREE.DodecahedronGeometry(0.42, 1), MAT.oreSeamBase, 1.18, 0.42, 1.28, world, { name: 'hookSampleBoulder', nonEssentialProp: false });

// 2. Iron Ore Cart on tracks carrying barren gray rubble (`x = -1.82, z = -3.15`)
const oreCart = new THREE.Group();
oreCart.position.set(-1.82, 0, -3.15);
add(new THREE.BoxGeometry(0.88, 0.62, 1.18), MAT.ironRail, 0, 0.56, 0, oreCart, { name: 'oreCartTub' });
for (const wx of [-0.46, 0.46]) {
  for (const wz of [-0.40, 0.40]) {
    const wh = add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), MAT.ironRail, wx, 0.16, wz, oreCart, { ignoreOcclusion: true });
    wh.rotation.z = Math.PI / 2;
  }
}
// Barren gray rocks piled inside cart
for (let r = 0; r < 5; r++) {
  const rk = add(new THREE.DodecahedronGeometry(0.22, 0), MAT.rawGreyCore, (r % 2 - 0.5) * 0.28, 0.92 + (r % 3) * 0.08, (r - 2) * 0.20, oreCart, { ignoreOcclusion: true });
  rk.rotation.set(r, r * 0.7, 0);
}
world.add(oreCart);

// 3. Foreground Assay Workbench + Articulated 3D Brass Balance Scale (`x = -0.78, z = -0.22`)
const bench = new THREE.Group();
bench.position.set(-0.78, 0, -0.22);
add(new THREE.BoxGeometry(1.38, 0.10, 0.78), MAT.workbenchWood, 0, 0.80, 0, bench, { name: 'assayBenchTop' });
for (const lx of [-0.58, 0.58]) {
  for (const lz of [-0.30, 0.30]) {
    add(new THREE.BoxGeometry(0.10, 0.76, 0.10), MAT.timber, lx, 0.38, lz, bench, { ignoreOcclusion: true });
  }
}

// Brass Balance Scale mounted on left half of bench top (`x = -0.22, y = 0.85`)
const scaleGroup = new THREE.Group();
scaleGroup.position.set(-0.22, 0.85, 0.02);
add(new THREE.CylinderGeometry(0.14, 0.18, 0.06, 12), MAT.brassMetal, 0, 0.03, 0, scaleGroup, { ignoreOcclusion: true });
add(new THREE.CylinderGeometry(0.035, 0.045, 0.58, 10), MAT.brassMetal, 0, 0.32, 0, scaleGroup, { ignoreOcclusion: true });

// Dial gauge face right at beam fulcrum (CircleGeometry in XY facing +Z so text stays upright)
add(new THREE.CylinderGeometry(0.138, 0.138, 0.024, 20), MAT.brassMetal, 0, 0.52, 0.032, scaleGroup, { ignoreOcclusion: true }).rotation.x = Math.PI / 2;
const dialFace = add(new THREE.CircleGeometry(0.13, 24), MAT.scaleDial, 0, 0.52, 0.047, scaleGroup, { ignoreOcclusion: true });
const dialNeedle = add(new THREE.BoxGeometry(0.02, 0.10, 0.02), new THREE.MeshBasicMaterial({ color: '#c42b23' }), 0, 0.53, 0.062, scaleGroup, { ignoreOcclusion: true });

const beamPivot = new THREE.Group();
beamPivot.position.set(0, 0.60, 0);
add(new THREE.BoxGeometry(0.74, 0.04, 0.04), MAT.brassMetal, 0, 0, 0, beamPivot, { ignoreOcclusion: true });

// Left hanging pan holds rigged SAMPLE #1 gold rock
const panL = new THREE.Group();
panL.position.set(-0.33, -0.18, 0);
add(new THREE.CylinderGeometry(0.12, 0.09, 0.04, 12), MAT.brassMetal, 0, 0, 0, panL, { ignoreOcclusion: true });
add(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), MAT.ironRail, 0, 0.09, 0, panL, { ignoreOcclusion: true });
const riggedPanOre = add(new THREE.DodecahedronGeometry(0.085, 0), MAT.goldNugget, 0, 0.06, 0, panL, { ignoreOcclusion: true });
beamPivot.add(panL);

// Right hanging pan holds gray counterweight / bare core check
const panR = new THREE.Group();
panR.position.set(0.33, -0.18, 0);
add(new THREE.CylinderGeometry(0.12, 0.09, 0.04, 12), MAT.brassMetal, 0, 0, 0, panR, { ignoreOcclusion: true });
add(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), MAT.ironRail, 0, 0.09, 0, panR, { ignoreOcclusion: true });
const barrenPanOre = add(new THREE.DodecahedronGeometry(0.075, 0), MAT.rawGreyCore, 0, 0.055, 0, panR, { ignoreOcclusion: true });
beamPivot.add(panR);
scaleGroup.add(beamPivot);
bench.add(scaleGroup);

// Rigged SAMPLE #1 Sack right next to scale on bench (`x = +0.44`)
const riggedSack = add(new THREE.DodecahedronGeometry(0.17, 1), MAT.sackCloth, 0.44, 0.98, 0.14, bench, { name: 'sampleSack1', ignoreOcclusion: true });
riggedSack.scale.set(0.95, 1.15, 0.85);
const sackTag = add(new THREE.BoxGeometry(0.24, 0.24, 0.02), MAT.tagRigged, 0.44, 0.98, 0.29, bench, { ignoreOcclusion: true });
const sackNuggetPile = add(new THREE.DodecahedronGeometry(0.07, 0), MAT.goldNugget, 0.44, 1.14, 0.14, bench, { ignoreOcclusion: true });
world.add(bench);

// Diegetic Assay Signboards positioned clearly inside upper safe zones
const payoffZeroSign = add(new THREE.BoxGeometry(1.18, 0.58, 0.06), MAT.zeroBoard, 0.45, 2.48, -1.25, world, { name: 'zeroBoard', ignoreOcclusion: true });
payoffZeroSign.rotation.y = rx(-8);
const hookClaimSign = add(new THREE.BoxGeometry(1.10, 0.54, 0.06), MAT.claimBoard, -0.15, 2.52, -0.95, world, { name: 'claimBoard', ignoreOcclusion: true });
hookClaimSign.rotation.y = rx(4);

// ---------- 2D BILLBOARD ACTOR CARDS ----------
const CW = 1200;
const CH = 2000;
const CM = 2.15;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM);
cardGeo.translate(0, CM / 2 - CM * 0.025, 0);

const blobCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,14,18,0.56)');
  gr.addColorStop(0.55, 'rgba(20,14,18,0.28)');
  gr.addColorStop(1, 'rgba(20,14,18,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
})();
const blobTex = P.wrapTex(blobCanvas, 1, 1, true);

const cardNd = (map) =>
  Visual.createCardNdMaterial ? Visual.createCardNdMaterial(map) : new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
    side: THREE.DoubleSide,
  });

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
    this.litMat = Visual.createLitCardMaterial(this.t, { pxScale: SCALE }, { charTint: '#ffe8ce', charShade: 0.74, rimStrength: 0.30 });
    this.mat = this.litMat;
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

// ---------- RESOLUTION-SCALED RENDER TARGETS & PASSES ----------
const ndMat = Visual.createWorldNdMaterial();
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const inkPass = Visual.createInkGradePass(W, H, {
  colorTexture: rtColor.texture,
  ndTexture: rtNd.texture,
  basePx: 2.3,
  farFadeStart: 42,
  farFadeEnd: 150,
  grainAmount: 0.016,
});
const dofPass = Visual.createDofPass(W, H, {
  srcTexture: rtInk.texture,
  ndTexture: rtNd.texture,
});

const isEnhancedMode = () => globalThis.__STUDIO_OVERRIDES__?.scene?.visualFoundation !== 'baseline';

function updateWorld(W_, S) {
  for (const [idx, lg] of lanternGroups.entries()) {
    lg.pivot.rotation.z = W_.lanternSwing * (idx % 2 ? -1 : 1);
    lg.globe.material.color.set('#ffdf76').multiplyScalar(W_.flicker);
  }
  lanternPt.intensity = (S.id === 'secret' ? 2.2 : 1.45) * W_.flicker;

  // Reveal dusted gold spots on secret outcrop & hook seam
  for (const [idx, gp] of goldDustPatches.entries()) {
    const level = idx === goldDustPatches.length - 1 ? 1.0 : W_.wallGoldVisible;
    gp.mesh.visible = level > 0.04;
    if (gp.mesh.visible) {
      gp.mesh.scale.set(gp.baseS.x * level, gp.baseS.y * level, gp.baseS.z * level);
    }
  }

  // Rigged pouch gold swelling
  sackNuggetPile.visible = W_.pouchGoldLevel > 0.08;
  sackNuggetPile.scale.setScalar(0.45 + 0.75 * W_.pouchGoldLevel);
  riggedSack.scale.set(0.92 + 0.14 * W_.pouchGoldLevel, 1.10 + 0.12 * W_.pouchGoldLevel, 0.85);

  // Brass balance beam tilt & needle dial deflection
  beamPivot.rotation.z = W_.scaleTilt * 0.38;
  panL.rotation.z = -beamPivot.rotation.z;
  panR.rotation.z = -beamPivot.rotation.z;
  dialNeedle.rotation.z = rx(48 - W_.dialValue * 96);

  // Chisel bedrock hole & Zero-grade board highlight
  coreCrackHole.visible = W_.showRawWallCoreHole;
  payoffZeroSign.visible = S.id === 'payoff';
  hookClaimSign.visible = S.id === 'hook';
  hookBoulder.visible = S.id === 'hook';
  if (goldDustPatches.length > 0) {
    goldDustPatches[goldDustPatches.length - 1].mesh.visible = S.id === 'hook';
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

let lastQAStats = null;
const tmpV = new THREE.Vector3();

window.renderFrame = (f) => {
  const enh = isEnhancedMode();
  const S = shotAt(f);
  const L = Visual.applyLookProfile(scene, hemi, sun, lightFor(S), {
    flicker: worldAt(f).flicker,
    skyUniforms: skyU,
    inkUniforms: inkPass.uniforms,
  });

  const C = camAt(f);
  camera.position.set(...C.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...C.look);
  camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);

  const W_ = worldAt(f);
  updateWorld(W_, S);

  const actors = actorsAt(f, Cast);
  // Check sightline occlusion across active hero faces & story props
  const qaTargets = actors.map((a) => ({
    id: a.id,
    role: 'face',
    point: [a.x + (a.facePointOffset?.[0] || 0), a.y + (a.facePointOffset?.[1] || 1.6), a.z + (a.facePointOffset?.[2] || 0)],
  }));
  const occ = Visual.detectOcclusion(camera, qaTargets, occluders);
  if (occ.anyOccluded && enh) {
    Visual.resolveStagingConflict(camera, C, qaTargets, occluders, { nudgeStep: 0.14 });
    camera.position.set(...C.pos);
    camera.lookAt(...C.look);
    camera.updateMatrixWorld();
  }

  const az = rx(L.az);
  const el = rx(L.el);
  tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const focus = new THREE.Vector3(...C.shadowAt);
  sun.position.copy(focus).addScaledVector(tmpV, 24);
  sun.target.position.copy(focus);
  const ext = L.shadowExt || 14;
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 65;
  sc.updateProjectionMatrix();

  drawActors([...actors, ...fxAt(f, Cast)], L, enh);

  // Measure screen-space bounds for character headroom / framing telemetry
  const boundsReport = actors.map((a) => {
    const b = Visual.screenProjectBounds(
      { min: [a.x - 0.55, a.y, a.z - 0.1], max: [a.x + 0.55, a.y + 2.08, a.z + 0.1] },
      camera,
      { width: W, height: H }
    );
    return { id: a.id, ...b };
  });

  // Pass A: Color
  renderer.setRenderTarget(rtColor);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);

  // Pass B: Normal + Depth
  const fog = scene.fog;
  scene.fog = null;
  const sm = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.autoUpdate = false;
  Visual.swapMaterialsForNd(scene, ndMat, true);
  renderer.setRenderTarget(rtNd);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  Visual.swapMaterialsForNd(scene, ndMat, false);
  scene.fog = fog;
  renderer.shadowMap.enabled = sm;
  renderer.shadowMap.autoUpdate = true;

  // Pass C: Resolution-scaled world-only ink + color grade + grain
  Visual.updateInkGradeUniforms(inkPass, {
    sat: L.sat,
    lift: L.lift || '#000000',
    gain: L.gain || '#ffffff',
    vig: L.vig ?? 0.24,
    flash: C.flash || 0,
    grainSeed: f,
    grainAmount: enh ? 0.015 : 0.0,
  });
  renderer.setRenderTarget(rtInk);
  renderer.render(inkPass.scene, fsCam);

  // Pass D: Foreground-safe 48-tap DOF -> canvas
  const D = dofAt(f);
  Visual.updateDofUniforms(dofPass, {
    focus: D.focus,
    cinf: enh ? D.cinf : 0,
    near: D.near ?? 0.9,
  });
  renderer.setRenderTarget(null);
  renderer.render(dofPass.scene, fsCam);

  lastQAStats = {
    frame: f,
    shotId: S.id,
    occlusion: occ,
    actorBounds: boundsReport,
  };
  return true;
};

window.getVisualQAFrameStats = () => lastQAStats;

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

window.setStudioOverrides = (overrides) => {
  globalThis.__STUDIO_OVERRIDES__ = overrides && typeof overrides === 'object' ? overrides : null;
  return true;
};

window.TOTAL = TOTAL;
window.ready = true;
