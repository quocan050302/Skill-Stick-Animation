import * as THREE from 'three';
import { Pen, townsfolk, bodyFront } from '/toonbase/toonbase.js';
import * as Visual from '/visual/index.js';

const outCfg = globalThis.__RENDER_OUTPUT_CONFIG__ || {};
const W = outCfg.width || 1080;
const H = outCfg.height || 1920;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#dbe7ef', 24, 80);
const camera = new THREE.PerspectiveCamera(42, W / H, 0.08, 200);
const hemi = new THREE.HemisphereLight('#e6f4ff', '#7d8a96', 1.32);
const sun = new THREE.DirectionalLight('#ffffff', 2.15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(hemi, sun, sun.target);

const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), Visual.createMaterialRecipe('tiles', { seed: 401, repeatX: 4, repeatY: 4, base: '#e2edf5', grout: '#a2b4c2' }));
floor.position.set(0, -0.2, 0); floor.receiveShadow = true;
const backWall = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 0.3), Visual.createMaterialRecipe('concrete', { seed: 402, base: '#cbd6df' }));
backWall.position.set(0, 2, -3.5); backWall.receiveShadow = true;
const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 0.7), Visual.createMaterialRecipe('metal', { seed: 403, base: '#6f7c8a' }));
bench.position.set(-1.1, 0.425, -0.4); bench.castShadow = bench.receiveShadow = true;
const glassTank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.65, 16), Visual.createMaterialRecipe('glass', { seed: 404, base: '#8ce2ff' }));
glassTank.position.set(-1.1, 1.18, -0.4);
scene.add(floor, backWall, bench, glassTank);
const occluders = [backWall, bench];

const cardC = document.createElement('canvas'); cardC.width = 900; cardC.height = 1500;
const g = cardC.getContext('2d'); g.setTransform(900 / 600, 0, 0, 1500 / 1000, 0, 0);
bodyFront(new Pen(g), { ...townsfolk(2), jacket: '#eef5fa', pants: '#3b4b5c', hat: 'hair', hair: '#3b2d22' }, { expr: 'shock', wave: -0.2, facing: -1, seed: 55 });
const tex = new THREE.CanvasTexture(cardC); tex.colorSpace = THREE.SRGBColorSpace;
const geo = new THREE.PlaneGeometry(1.25, 2.08); geo.translate(0, 1.01, 0);
const cardMat = Visual.createLitCardMaterial(tex, { pxScale: H / 1920 }, Visual.LOOK_PROFILES.modernLab);
const actor = new THREE.Mesh(geo, cardMat); actor.position.set(0.25, 0, 0); actor.castShadow = actor.receiveShadow = true;
scene.add(actor);

const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 2, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const ndMat = Visual.createWorldNdMaterial();
const inkPass = Visual.createInkGradePass(W, H, { colorTexture: rtColor.texture, ndTexture: rtNd.texture, grainAmount: 0.012 });
const dofPass = Visual.createDofPass(W, H, { srcTexture: rtInk.texture, ndTexture: rtNd.texture });
const KEYS = [
  { f: 0, pos: [0.1, 1.5, 4.4], look: [-0.2, 1.15, -0.2], fov: 42 },
  { f: 30, pos: [0.3, 1.48, 3.0], look: [0.15, 1.25, 0], fov: 37 },
];

let lastStats = null;
window.renderFrame = (f) => {
  const L = Visual.applyLookProfile(scene, hemi, sun, 'modernLab', { inkUniforms: inkPass.uniforms });
  Visual.updateCardLight(cardMat, L, { pxScale: H / 1920 });
  const cam = Visual.evaluateCameraKeys(KEYS, f);
  camera.position.set(...cam.pos); camera.lookAt(...cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sun.position.set(-8, 16, 10);
  actor.rotation.y = Math.atan2(camera.position.x - 0.25, camera.position.z);

  const targets = [{ id: 'scientist', role: 'face', point: [0.25, 1.62, 0] }];
  const occ = Visual.detectOcclusion(camera, targets, occluders);
  const bounds = Visual.screenProjectBounds({ min: [-0.3, 0, -0.1], max: [0.8, 2.05, 0.1] }, camera, { width: W, height: H });
  lastStats = { occlusion: occ, bounds };

  renderer.setRenderTarget(rtColor); renderer.setClearColor('#d9eaf5', 1); renderer.clear(); renderer.render(scene, camera);
  const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  Visual.swapMaterialsForNd(scene, ndMat, true);
  renderer.setRenderTarget(rtNd); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera);
  Visual.swapMaterialsForNd(scene, ndMat, false); renderer.shadowMap.enabled = sm;

  Visual.updateInkGradeUniforms(inkPass, { sat: L.sat, lift: L.lift, gain: L.gain, vig: L.vig, grainSeed: f });
  renderer.setRenderTarget(rtInk); renderer.render(inkPass.scene, fsCam);
  Visual.updateDofUniforms(dofPass, { focus: camera.position.distanceTo(actor.position), cinf: 4.0, near: 0.9 });
  renderer.setRenderTarget(null); renderer.render(dofPass.scene, fsCam);
  return true;
};
window.getVisualQAFrameStats = () => lastStats;
window.TOTAL = 60;
window.ready = true;
