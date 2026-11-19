/**
 * Resolution-Scaled World-Only Ink Pass + Grade + Deterministic Grain (SHORT-03A).
 *
 * Provenance: Edge-depth 2nd-difference + normal-crease + anti-double-card-ink algorithm
 * selectively adapted from MIT github.com/mromidev/claude-animated-shorts (templates/bridge/ink.ts, e3b817b6).
 * Grain cell sizing scales cleanly by (res.y / 1920.0) so 1080p and native 4K (2160x3840) share exact visual line weight.
 */

import * as THREE from 'three';

export function createWorldNdMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vN;
      varying float vD;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vN;
      varying float vD;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n * 0.5 + 0.5, vD);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export function swapMaterialsForNd(scene, ndMat, on) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData._ndMat0 = o.material;
      if (o.userData.ndSkip || o.userData.sky) {
        o.userData._ndVis0 = o.visible;
        o.visible = false;
        return;
      }
      o.material = o.userData.nd || ndMat;
    } else {
      if (o.userData._ndMat0 !== undefined) {
        o.material = o.userData._ndMat0;
        delete o.userData._ndMat0;
      }
      if (o.userData._ndVis0 !== undefined) {
        o.visible = o.userData._ndVis0;
        delete o.userData._ndVis0;
      }
    }
  });
}

export function createInkGradePass(width, height, opts = {}) {
  const uniforms = {
    col: { value: opts.colorTexture || null },
    nd: { value: opts.ndTexture || null },
    res: { value: new THREE.Vector2(width, height) },
    px: { value: opts.px ?? 2.35 },
    sat: { value: opts.sat ?? 1.1 },
    lift: { value: new THREE.Color(opts.lift || '#000000') },
    gain: { value: new THREE.Color(opts.gain || '#ffffff') },
    vig: { value: opts.vig ?? 0.18 },
    flash: { value: 0 },
    inkColor: { value: new THREE.Color(opts.inkColor || '#08050a') },
    grainSeed: { value: 0.0 },
    grainAmount: { value: opts.grainAmount ?? 0.016 },
    fadeNear: { value: opts.fadeNear ?? 45.0 },
    fadeFar: { value: opts.fadeFar ?? 160.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D col;
      uniform sampler2D nd;
      uniform vec2 res;
      uniform float px, sat, vig, flash, grainSeed, grainAmount, fadeNear, fadeFar;
      uniform vec3 lift, gain, inkColor;
      varying vec2 vUv;

      float hash21(vec2 p, float seed) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031 + seed * 0.0137);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z) - 0.5;
      }

      float edgeAt(vec2 uv, float basePx) {
        vec4 c = texture2D(nd, uv);
        if (dot(c.rgb, c.rgb) < 0.01) return 0.0; // skip sky & character card interiors
        float d = c.a;
        vec3 n = c.rgb * 2.0 - 1.0;
        float pxScale = max(1.0, res.y / 1920.0);
        float rr = basePx * pxScale * clamp(6.0 / max(d, 0.5), 0.65, 1.25);

        float e = 0.0;
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.785398 + (i > 7 ? 0.39 : 0.0);
          float k = i > 7 ? 0.5 : 1.0;
          vec2 off = vec2(cos(a), sin(a)) * rr * k / res;
          vec4 s = texture2D(nd, uv + off);
          float ds = s.a;
          bool card = dot(s.rgb, s.rgb) < 0.01;
          if (card && ds > 0.0) continue; // character billboard occludes world outline behind it
          if (card) ds = 1e4;
          vec3 ns = s.rgb * 2.0 - 1.0;

          // Near-side depth silhouette band
          e = max(e, smoothstep(0.010, 0.028, (ds - d) / max(d, 0.12)));

          // Concave / corner crease (same depth band)
          if (!card && abs(ds - d) / max(d, 0.1) < 0.055) {
            e = max(e, smoothstep(0.84, 0.66, dot(n, ns)) * 0.85);
          }
        }
        return e * (1.0 - smoothstep(fadeNear, fadeFar, d) * 0.72);
      }

      void main() {
        vec3 c = texture2D(col, vUv).rgb;
        float e = edgeAt(vUv, px);
        c = mix(c, inkColor, e);

        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat);
        c = max(c * gain + lift, vec3(0.0));

        vec2 q = vUv - 0.5;
        c *= 1.0 - vig * dot(q * vec2(1.0, 0.75), q * vec2(1.0, 0.75)) * 2.0;

        if (grainAmount > 0.001) {
          float pxScale = max(1.0, res.y / 1920.0);
          vec2 cell = floor((vUv * res) / (1.5 * pxScale));
          float n = hash21(cell, grainSeed);
          float gw = 0.25 + 0.75 * clamp(4.0 * l * (1.0 - l), 0.0, 1.0);
          c = max(c + n * grainAmount * gw, vec3(0.0));
        }

        c = mix(c, vec3(1.0), flash);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(mesh);
  return { scene, material: mat, uniforms };
}

export function setInkResolution(pass, width, height) {
  pass.uniforms.res.value.set(width, height);
}

export function updateInkGradeUniforms(pass, opts = {}) {
  const u = pass.uniforms;
  if (opts.colorTexture) u.col.value = opts.colorTexture;
  if (opts.ndTexture) u.nd.value = opts.ndTexture;
  if (typeof opts.px === 'number') u.px.value = opts.px;
  if (typeof opts.sat === 'number') u.sat.value = opts.sat;
  if (opts.lift) u.lift.value.set(opts.lift);
  if (opts.gain) u.gain.value.set(opts.gain);
  if (typeof opts.vig === 'number') u.vig.value = opts.vig;
  if (typeof opts.flash === 'number') u.flash.value = opts.flash;
  if (typeof opts.grainSeed === 'number') u.grainSeed.value = opts.grainSeed;
  if (typeof opts.grainAmount === 'number') u.grainAmount.value = opts.grainAmount;
}
