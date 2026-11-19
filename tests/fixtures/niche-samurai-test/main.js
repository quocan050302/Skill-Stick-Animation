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
scene.fog = new THREE.Fog('#e4b79a', 26, 170);
const camera = new THREE.PerspectiveCamera(42, W / H, 0.08, 200);
const hemi = new THREE.HemisphereLight('#c9a6cf', '#6a5248', 1.05);
const sun = new THREE.DirectionalLight('#ffba73', 2.55);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(hemi, sun, sun.target);

const skyU = { top: { value: new THREE.Color('#4e4d82') }, hor: { value: new THREE.Color('#ffb87d') } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(120, 16, 12),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: `varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vD = normalize(w.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 top, hor; varying vec3 vD; void main(){ gl_FragColor = vec4(mix(hor, top, clamp(vD.y * 1.3, 0.0, 1.0)), 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  })
);
sky.userData.ndSkip = true;
scene.add(sky);

const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), Visual.createMaterialRecipe('wood', { seed: 301, repeatX: 3, repeatY: 3, base: '#6e4930' }));
deck.position.set(0, -0.2, 0); deck.receiveShadow = true;
const backScreen = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 0.25), Visual.createMaterialRecipe('plaster', { seed: 302, base: '#dfd2b8' }));
backScreen.position.set(0, 1.8, -3.2); backScreen.castShadow = backScreen.receiveShadow = true;
const postL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), Visual.createMaterialRecipe('wood', { seed: 303, base: '#4a2e1d' }));
postL.position.set(-1.8, 1.8, -1.6); postL.castShadow = true;
scene.add(deck, backScreen, postL);
const occluders = [backScreen, postL];

const cardC = document.createElement('canvas'); cardC.width = 900; cardC.height = 1500;
const g = cardC.getContext('2d'); g.setTransform(900 / 600, 0, 0, 1500 / 1000, 0, 0);
bodyFront(new Pen(g), { ...townsfolk(0), hat: 'tophat', jacket: '#2d3748', sash: '#c53030' }, { expr: 'stern', wave: 0.25, facing: 1, seed: 31 });
const tex = new THREE.CanvasTexture(cardC); tex.colorSpace = THREE.SRGBColorSpace;
const geo = new THREE.PlaneGeometry(1.25, 2.08); geo.translate(0, 1.01, 0);
const cardMat = Visual.createLitCardMaterial(tex, { pxScale: H / 1920 }, Visual.LOOK_PROFILES.samuraiDusk);
const actor = new THREE.Mesh(geo, cardMat); actor.castShadow = actor.receiveShadow = true;
scene.add(actor);

const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 2, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const ndMat = Visual.createWorldNdMaterial();
const inkPass = Visual.createInkGradePass(W, H, { colorTexture: rtColor.texture, ndTexture: rtNd.texture, grainAmount: 0.015 });
const dofPass = Visual.createDofPass(W, H, { srcTexture: rtInk.texture, ndTexture: rtNd.texture });
const KEYS = [
  { f: 0, pos: [-0.25, 1.5, 4.6], look: [0, 1.18, 0], fov: 42 },
  { f: 45, pos: [0.15, 1.45, 3.2], look: [0, 1.24, 0], fov: 38 },
];

let lastStats = null;
window.renderFrame = (f) => {
  const L = Visual.applyLookProfile(scene, hemi, sun, 'samuraiDusk', { skyUniforms: skyU, inkUniforms: inkPass.uniforms });
  Visual.updateCardLight(cardMat, L, { pxScale: H / 1920 });
  let cam = Visual.evaluateCameraKeys(KEYS, f);
  if (f >= 45) cam = Visual.applyImpactKick(cam, (f - 45) / 30, 0.5);
  camera.position.set(...cam.pos); camera.lookAt(...cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sky.position.copy(camera.position);
  sun.position.set(10, 12, 8);
  actor.rotation.y = Math.atan2(camera.position.x, camera.position.z);

  const targets = [{ id: 'duelist', role: 'face', point: [0, 1.62, 0] }];
  const occ = Visual.detectOcclusion(camera, targets, occluders);
  const bounds = Visual.screenProjectBounds({ min: [-0.55, 0, -0.1], max: [0.55, 2.05, 0.1] }, camera, { width: W, height: H });
  lastStats = { occlusion: occ, bounds };

  renderer.setRenderTarget(rtColor); renderer.clear(); renderer.render(scene, camera);
  const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  Visual.swapMaterialsForNd(scene, ndMat, true);
  renderer.setRenderTarget(rtNd); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera);
  Visual.swapMaterialsForNd(scene, ndMat, false); renderer.shadowMap.enabled = sm;

  Visual.updateInkGradeUniforms(inkPass, { sat: L.sat, lift: L.lift, gain: L.gain, vig: L.vig, grainSeed: f });
  renderer.setRenderTarget(rtInk); renderer.render(inkPass.scene, fsCam);
  Visual.updateDofUniforms(dofPass, { focus: camera.position.length(), cinf: 4.5, near: 0.9 });
  renderer.setRenderTarget(null); renderer.render(dofPass.scene, fsCam);
  return true;
};
window.getVisualQAFrameStats = () => lastStats;
window.TOTAL = 60;
window.ready = true;
