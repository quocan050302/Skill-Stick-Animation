/**
 * Three.js 0.160.0 2-step Toon + Normal/Depth Ink + 48-tap DOF renderer for Plaza Courier 10s.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-02).
 */

import * as THREE from 'three';
import * as P from './paint_plaza.js';
import * as Cast from './cast_plaza.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, worldAt, actorsAt, fxAt } from './story_plaza.js';
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
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 400);
const rx = (a) => (a * Math.PI) / 180;

const grad = (() => {
  const d = new Uint8Array([102, 102, 102, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 2, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });

const MAT = {
  ground: toon({ map: P.makeTex(P.cobbleGround(201), 16, 16) }),
  wall: toon({ map: P.makeTex(P.stoneWall(202), 2, 1) }),
  roof: toon({ map: P.makeTex(P.roofTiles(203), 2, 2) }),
  awning: toon({ map: P.makeTex(P.awningStripes(), 2, 1) }),
  sign: toon({ map: P.makeTex(P.plazaSign('SUNNY PLAZA', 'EXPRESS POST'), 1, 1, true) }),
  clock: toon({ map: P.makeTex(P.clockFace(), 1, 1, true) }),
  parcel: toon({ map: P.makeTex(P.parcelBox('#e66e4e'), 1, 1, true) }),
  wood: toon({ color: '#7a5233' }),
  trim: toon({ color: '#394b57' }),
  gold: toon({ color: '#eab444' }),
  water: toon({ color: '#4da3c4' }),
  leaf: toon({ color: '#4d8a42' }),
  hill: toon({ color: '#7da852' }),
};

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

// Sky & lights
const skyU = { top: { value: new THREE.Color('#4e8ed8') }, hor: { value: new THREE.Color('#d4eafc') } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(280, 24, 14),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.,1.); gl_FragColor = vec4(mix(hor, top, pow(h,.55)),1.); }`,
  })
);
sky.userData.sky = true;
scene.add(sky);

const hemi = new THREE.HemisphereLight('#d8ecff', '#8c8872', 1.28);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4de', 2.35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);
scene.fog = new THREE.Fog('#d7eaf8', 35, 220);

const world = new THREE.Group();
scene.add(world);

// Ground
const ground = add(new THREE.PlaneGeometry(80, 80), MAT.ground, 0, 0, 0, world, { cast: false });
ground.rotation.x = -Math.PI / 2;

// Distant rolling hills & trees
for (const [hx, hz, rad] of [[-26, -32, 18], [18, -38, 22], [44, -26, 16]]) {
  const h = add(new THREE.SphereGeometry(rad, 18, 12), MAT.hill, hx, -6, hz, world, { cast: false });
  h.scale.set(1.2, 0.55, 0.8);
}

// Left station arch
const arch = new THREE.Group();
arch.position.set(-4.2, 0, -1.2);
world.add(arch);
add(new THREE.BoxGeometry(0.9, 4.0, 0.9), MAT.wall, 0, 2.0, -1.6, arch);
add(new THREE.BoxGeometry(0.9, 4.0, 0.9), MAT.wall, 0, 2.0, 1.6, arch);
add(new THREE.BoxGeometry(1.1, 0.9, 4.4), MAT.wall, 0, 4.3, 0, arch);

// Prominent plaza sign banner on cafe/tower facade facing camera (+Z) so signTitle edits are clearly visible!
add(new THREE.BoxGeometry(2.6, 0.86, 0.16), MAT.sign, -2.6, 2.95, -3.1, world, { cast: false });

// Clock Tower in background (x=1.2, z=-4.5)
const tower = new THREE.Group();
tower.position.set(1.2, 0, -4.6);
world.add(tower);
add(new THREE.BoxGeometry(2.4, 6.2, 2.4), MAT.wall, 0, 3.1, 0, tower);
const spire = add(new THREE.ConeGeometry(2.1, 2.4, 4), MAT.roof, 0, 7.4, 0, tower);
spire.rotation.y = Math.PI / 4;
add(new THREE.CircleGeometry(0.85, 24), MAT.clock, 0, 4.6, 1.22, tower, { cast: false });
add(new THREE.BoxGeometry(2.3, 0.76, 0.14), MAT.sign, 0, 2.7, 1.24, tower, { cast: false });
const handMin = add(new THREE.BoxGeometry(0.08, 0.62, 0.05), MAT.trim, 0, 4.6, 1.26, tower, { cast: false });
handMin.geometry.translate(0, 0.22, 0);
const handHour = add(new THREE.BoxGeometry(0.10, 0.42, 0.05), MAT.gold, 0, 4.6, 1.25, tower, { cast: false });
handHour.geometry.translate(0, 0.14, 0);

// Cafe shopfront with striped awning (x=-2.2, z=-4.4)
const cafe = new THREE.Group();
cafe.position.set(-2.6, 0, -4.4);
world.add(cafe);
add(new THREE.BoxGeometry(3.4, 3.2, 2.4), MAT.wall, 0, 1.6, 0, cafe);
const aw = add(new THREE.BoxGeometry(3.5, 0.14, 1.3), MAT.awning, 0, 2.45, 1.55, cafe);
aw.rotation.x = rx(22);

// Plaza fountain / low curb & stylized cypress trees
const fountain = new THREE.Group();
fountain.position.set(5.4, 0, -3.4);
world.add(fountain);
add(new THREE.CylinderGeometry(1.4, 1.5, 0.5, 16), MAT.wall, 0, 0.25, 0, fountain);
add(new THREE.CylinderGeometry(1.15, 1.15, 0.35, 16), MAT.water, 0, 0.35, 0, fountain, { cast: false });
add(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 12), MAT.wall, 0, 0.75, 0, fountain);

for (const [tx, tz, h] of [[-5.6, -4.5, 4.2], [5.8, -5.6, 4.8], [6.5, 1.4, 3.8]]) {
  add(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 6), MAT.wood, tx, 0.6, tz, world);
  const cr = add(new THREE.SphereGeometry(0.95, 10, 10), MAT.leaf, tx, 1.0 + h * 0.45, tz, world);
  cr.scale.set(0.9, h * 0.42, 0.9);
}

// Golden Delivery Pedestal on right (x=3.8, z=-0.1)
const pedestal = new THREE.Group();
pedestal.position.set(3.8, 0, -0.1);
world.add(pedestal);
add(new THREE.BoxGeometry(1.1, 0.95, 1.1), MAT.wall, 0, 0.475, 0, pedestal);
const pedTop = add(new THREE.BoxGeometry(1.22, 0.14, 1.22), MAT.gold, 0, 1.02, 0, pedestal);

// Stack of 3 parcel crates near delivery lane (topple on wind gust at f=175, hero box lands on pedestal at f=256!)
const stackCrates = [];
for (let i = 0; i < 3; i++) {
  const c = add(new THREE.BoxGeometry(0.56, 0.48, 0.56), MAT.parcel, 2.55, 0.24 + i * 0.49, 0.35, world);
  c.userData.base = c.position.clone();
  stackCrates.push(c);
}

// ---------- 2D billboard actor cards ----------
const CW = 1200;
const CH = 2000;
const CM = 2.1;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM);
cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.makeTex(P.radialShadow('24,20,34', 0.52), 1, 1, true);

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

// ---------- render targets & postprocess ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };

const inkU = {
  col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) },
  px: { value: 2.3 }, sat: { value: 1.12 }, lift: { value: new THREE.Color(0, 0, 0) },
  gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.16 }, flash: { value: 0 },
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
      return e * (1. - smoothstep(60., 180., d)*.7);
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

const enhInkPass = Visual.createInkGradePass(W, H, { colorTexture: rtColor.texture, ndTexture: rtNd.texture, basePx: 2.3, farFadeStart: 60, farFadeEnd: 180, grainAmount: 0.012 });
const enhDofPass = Visual.createDofPass(W, H, { srcTexture: rtInk.texture, ndTexture: rtNd.texture });
const isEnhancedMode = () => globalThis.__STUDIO_OVERRIDES__?.scene?.visualFoundation === 'enhanced';
const ENH_PROFILE_MAP = {
  morningSun: 'daylightPlaza',
  goldenHour: 'daylightPlaza',
  nightPlaza: 'coolDramatic',
};

let appliedSignTitle = 'SUNNY PLAZA';
let appliedParcelColor = 'coral';
const PARCEL_HEX = { coral: '#e66e4e', teal: '#369a94', gold: '#e6b13c' };

function syncSceneOverrides() {
  const ov = typeof globalThis !== 'undefined' ? globalThis.__STUDIO_OVERRIDES__ : null;
  const nextSign = (ov?.scene?.signTitle ? String(ov.scene.signTitle).slice(0, 18).trim() : '') || 'SUNNY PLAZA';
  if (nextSign !== appliedSignTitle) {
    appliedSignTitle = nextSign;
    const prev = MAT.sign.map;
    MAT.sign.map = P.makeTex(P.plazaSign(nextSign, 'EXPRESS POST'), 1, 1, true);
    MAT.sign.needsUpdate = true;
    prev?.dispose?.();
  }
  const nextCol = ov?.scene?.parcelColor && PARCEL_HEX[ov.scene.parcelColor] ? ov.scene.parcelColor : 'coral';
  if (nextCol !== appliedParcelColor) {
    appliedParcelColor = nextCol;
    const prev = MAT.parcel.map;
    MAT.parcel.map = P.makeTex(P.parcelBox(PARCEL_HEX[nextCol]), 1, 1, true);
    MAT.parcel.needsUpdate = true;
    prev?.dispose?.();
  }
}

window.setStudioOverrides = (overrides) => {
  globalThis.__STUDIO_OVERRIDES__ = overrides && typeof overrides === 'object' ? overrides : null;
  syncSceneOverrides();
  return true;
};

const tmpV = new THREE.Vector3();

function updateWorld(W_) {
  handMin.rotation.z = W_.clockMinAngle;
  handHour.rotation.z = W_.clockHourAngle;
  pedTop.material.color.set(W_.delivered ? '#ffd85e' : '#eab444');

  stackCrates.forEach((c, idx) => {
    c.position.copy(c.userData.base);
    c.rotation.set(0, 0, 0);
    if (W_.toppleT > 0) {
      if (idx === 2) {
        // Hero top parcel leaps onto pedestal smoothly!
        const u = Math.min(1, W_.toppleT / 2.8);
        const smoothU = u * u * (3 - 2 * u);
        c.position.set(
          2.55 + (3.8 - 2.55) * smoothU,
          1.22 + 1.15 * Math.sin(smoothU * Math.PI) + (1.33 - 1.22) * smoothU,
          0.35 + (-0.1 - 0.35) * smoothU
        );
        c.rotation.y = smoothU * Math.PI * 0.5;
      } else if (idx === 1) {
        const t = Math.min(1.2, W_.toppleT);
        c.position.x += 0.65 * t;
        c.position.z += 0.45 * t;
        c.position.y = Math.max(0.24, c.userData.base.y - 0.5 * 4.5 * t * t);
        c.rotation.z = -t * 1.1;
      } else {
        c.rotation.y = Math.min(0.25, W_.toppleT * 0.25);
      }
    }
  });
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
      if (o.userData.ndSkip || o.userData.sky || o === sky) {
        o.userData.vis0 = o.visible;
        o.visible = false;
        return;
      }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0;
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  syncSceneOverrides();
  const enh = isEnhancedMode();
  const S = shotAt(f);
  const L = enh ? Visual.getLookProfile({ ...Visual.LOOK_PROFILES[ENH_PROFILE_MAP[S.light] || 'daylightPlaza'], ...lightFor(S) }) : lightFor(S);
  const C = camAt(f);
  const W_ = worldAt(f);

  hemi.color.set(L.sky);
  hemi.groundColor.set(L.ground);
  hemi.intensity = L.hemi;
  sun.color.set(L.sun);
  sun.intensity = L.sunI;
  scene.fog.color.set(L.fog);
  scene.fog.near = L.fogNear;
  scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop);
  skyU.hor.value.set(L.skyHor);
  inkU.sat.value = L.sat;
  inkU.gain.value.set(L.gain || '#ffffff');
  inkU.lift.value.set(L.lift || '#000000');
  inkU.vig.value = L.vig ?? 0.16;

  camera.position.set(...C.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...C.look);
  camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);

  updateWorld(W_);
  const az = rx(L.az);
  const el = rx(L.el);
  tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const focus = new THREE.Vector3(...C.shadowAt);
  sun.position.copy(focus).addScaledVector(tmpV, 32);
  sun.target.position.copy(focus);
  const ext = L.shadowExt || 16;
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80;
  sc.updateProjectionMatrix();

  drawActors([...actorsAt(f, Cast), ...fxAt(f, Cast)], L, enh);

  renderer.setRenderTarget(rtColor);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);

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

  if (enh || SCALE !== 1) {
    Visual.updateInkGradeUniforms(enhInkPass, {
      sat: L.sat,
      lift: L.lift || '#000000',
      gain: L.gain || '#ffffff',
      vig: L.vig ?? 0.16,
      flash: C.flash || 0,
      grainSeed: f,
      grainAmount: enh ? 0.012 : 0.0,
    });
    renderer.setRenderTarget(rtInk);
    renderer.render(enhInkPass.scene, fsCam);
  } else {
    inkU.flash.value = C.flash || 0;
    renderer.setRenderTarget(rtInk);
    renderer.render(inkScene, fsCam);
  }

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

if (globalThis.__STUDIO_OVERRIDES__) {
  syncSceneOverrides();
}

window.TOTAL = TOTAL;
window.ready = true;
