/**
 * Reusable Character Card Lighting & Contact Shadow Integration (SHORT-03A).
 *
 * Provenance: Selectively adapts zone-based card shading math from MIT-licensed
 * github.com/mromidev/claude-animated-shorts (templates/bridge/cardshade.ts, commit e3b817b6)
 * onto Three.js MeshLambertMaterial with real directional shadow masking, plus NEW
 * makeContactShadow & setCardWorldScale utilities.
 */

import * as THREE from 'three';

const DEFAULT_GRAD_K = 5.2;
const DEFAULT_GRAD_KB = 1.65;
const DEFAULT_TINT_K = 0.52;

const CARD_OUTGOING_GLSL = /* glsl */ `
vec3 cTintK = mix(vec3(1.0), uCharTint, uTintK);
cTintK /= pow(max(dot(cTintK, vec3(0.2126, 0.7152, 0.0722)), 0.25), uNorm);
vec3 outgoingLight = diffuseColor.rgb * cTintK;
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = normalize(directionalLights[0].direction);
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float sunVis = 1.0;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
  if (receiveShadow) {
    sunVis = getShadowMask();
  }
  #endif
  float side = sign(sunV.x) * smoothstep(0.0, 0.35, abs(sunV.x));
  float head = smoothstep(0.56, 0.60, vMapUv.y);
  float hw = mix(0.15, 0.20, head);
  float uu = clamp((vMapUv.x - 0.5) / hw, -1.0, 1.0) * sign(dFdx(vMapUv.x) + 1e-7);
  float t = uu * side;
  float g = mix(uBodyGrad * uGradKB, min(uGrad * uGradK, 0.38), head);
  float dark = smoothstep(-0.15, 0.9, -t);
  vec3 sideK = mix(vec3(1.0), uSideTint, dark * clamp(g / max(min(uGrad * uGradK, 0.38), 1e-3), 0.0, 1.4) * 0.5);
  float top = 1.0 + 0.05 * clamp((vMapUv.y - 0.69) / 0.11, -1.0, 1.0) * clamp(dot(sunV, upV) * 2.0, 0.0, 1.0) * head;
  float lift = 1.0 + 0.04 * smoothstep(0.0, 0.9, t);
  outgoingLight *= mix(uCharShade, 1.0, sunVis) * (1.0 - g * dark) * sideK * top * lift * uCardGain;
  #ifdef USE_MAP
  if (uRimStrength > 0.005) {
    float sl = length(sunV.xy);
    vec2 d2 = sunV.xy / max(sl, 1e-4);
    vec2 duv = 2.0 * uPx * (d2.x * dFdx(vMapUv) + d2.y * dFdy(vMapUv));
    float edge = step(texture2D(map, vMapUv + duv).a, 0.5);
    vec2 dirU = normalize(duv + vec2(1e-9));
    vec4 c1 = texture2D(map, vMapUv - dirU * vec2(0.027, 0.016));
    vec4 c2 = texture2D(map, vMapUv - dirU * vec2(0.067, 0.04));
    float skin = step(0.5, c1.a) * step(0.3, c1.r) * step(c1.b + 0.10, c1.r);
    float torso = step(0.27, vMapUv.y) * step(vMapUv.y, 0.57) * step(0.5, c1.a) * step(0.5, c2.a) * step(0.04, max(c1.r, max(c1.g, c1.b)));
    float rim = uRimStrength * smoothstep(0.1, 0.4, sl) * edge * max(skin * head, torso) * mix(0.55, 1.0, sunVis);
    outgoingLight += uRimColor * rim;
  }
  #endif
}
#endif
`;

const UNIFORM_DECL = /* glsl */ `
uniform vec3 uCharTint;
uniform float uCharShade;
uniform float uGrad;
uniform float uBodyGrad;
uniform vec3 uSideTint;
uniform float uGradK;
uniform float uGradKB;
uniform float uTintK;
uniform float uNorm;
uniform float uCardGain;
uniform float uPx;
uniform float uRimStrength;
uniform vec3 uRimColor;
`;

function hexOrColor(val, fallback) {
  return new THREE.Color(val || fallback);
}

export function createLitCardMaterial(texture, styleConfig = {}, lightState = {}) {
  const uniforms = {
    uCharTint: { value: hexOrColor(lightState.charTint, '#f7f4f1') },
    uCharShade: { value: lightState.charShade ?? 0.84 },
    uGrad: { value: lightState.charGrad ?? 0.065 },
    uBodyGrad: { value: lightState.bodyGrad ?? 0.095 },
    uSideTint: { value: hexOrColor(lightState.sideTint, '#8e98be') },
    uGradK: { value: styleConfig.gradK ?? DEFAULT_GRAD_K },
    uGradKB: { value: styleConfig.gradKB ?? DEFAULT_GRAD_KB },
    uTintK: { value: styleConfig.tintK ?? DEFAULT_TINT_K },
    uNorm: { value: styleConfig.norm ?? 0.85 },
    uCardGain: { value: styleConfig.cardGain ?? 1.0 },
    uPx: { value: styleConfig.pxScale ?? 1.0 },
    uRimStrength: { value: lightState.rimStrength ?? 0.2 },
    uRimColor: { value: hexOrColor(lightState.sun || lightState.rimColor, '#ffbb77') },
  };

  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    alphaTest: styleConfig.alphaTest ?? 0.02,
    side: THREE.DoubleSide,
    fog: styleConfig.fog !== false,
  });

  mat.userData.cardUniforms = uniforms;
  mat.userData.isLitCard = true;
  mat.customProgramCacheKey = () => 'studio-lit-card-v1';

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${UNIFORM_DECL}`)
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        CARD_OUTGOING_GLSL
      );
  };

  return mat;
}

export function updateCardLight(material, lightState = {}, opts = {}) {
  const u = material?.userData?.cardUniforms;
  if (!u) {
    if (material?.color && opts.tintFallback) {
      material.color.set(opts.tintFallback);
    }
    return material;
  }
  u.uCharTint.value.set(lightState.charTint || '#f7f4f1');
  u.uCharShade.value = lightState.charShade ?? 0.84;
  u.uGrad.value = lightState.charGrad ?? 0.065;
  u.uBodyGrad.value = lightState.bodyGrad ?? 0.095;
  u.uSideTint.value.set(lightState.sideTint || '#8e98be');
  u.uRimStrength.value = lightState.rimStrength ?? 0.2;
  u.uRimColor.value.set(lightState.rimColor || lightState.sun || '#ffbb77');
  if (typeof opts.pxScale === 'number') {
    u.uPx.value = opts.pxScale;
  }
  if (typeof opts.cardGain === 'number') {
    u.uCardGain.value = opts.cardGain;
  }
  return material;
}

export function createCardNdMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: texture } },
    vertexShader: `
      varying vec2 vUv;
      varying float vD;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying vec2 vUv;
      varying float vD;
      void main() {
        if (texture2D(map, vUv).a < 0.5) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, vD);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export function setCardWorldScale(mesh, scale = 1, footOffsetY = 0) {
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  mesh.scale.set(s, s, s);
  mesh.position.y = Math.max(0, mesh.position.y) + footOffsetY;
  return mesh;
}

export function makeContactShadow(blobMesh, actorState, lightState = {}) {
  if (!blobMesh) return null;
  const s = actorState?.s || 1;
  const groundY = actorState?.groundY ?? 0.018;
  const heightAboveGround = Math.max(0, (actorState?.y ?? 0) - groundY);
  const azRad = ((lightState.az ?? 130) * Math.PI) / 180;
  const elRad = ((lightState.el ?? 45) * Math.PI) / 180;
  const stretch = Math.min(0.65, 0.14 / Math.max(0.28, Math.tan(elRad)));

  // Offset slightly away from sun direction along ground plane
  const offX = -Math.cos(azRad) * stretch * 0.55 * s;
  const offZ = -Math.sin(azRad) * stretch * 0.55 * s;
  const fade = Math.max(0.25, 1.0 - heightAboveGround * 0.65);

  blobMesh.position.set((actorState?.x ?? 0) + offX, groundY, (actorState?.z ?? 0) + offZ);
  blobMesh.scale.set((0.92 + stretch * 0.55) * s, (0.58 + stretch * 0.25) * s, 1);
  if (blobMesh.material) {
    blobMesh.material.opacity = fade;
    blobMesh.material.transparent = true;
  }
  return {
    x: blobMesh.position.x,
    y: blobMesh.position.y,
    z: blobMesh.position.z,
    opacity: fade,
  };
}
