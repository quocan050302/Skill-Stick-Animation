/**
 * Resolution-Scaled Depth of Field Pass with Foreground Bleed Prevention (SHORT-03A).
 *
 * Provenance: Selectively adapted 48-tap Poisson gather + near-bleed CoC guard from MIT
 * github.com/mromidev/claude-animated-shorts (templates/bridge/lensblur.ts, commit e3b817b6).
 * Scales circle-of-confusion radius strictly by (res.y / 1920.0) for crisp 1080p & 4K parity.
 */

import * as THREE from 'three';

export function createDofPass(width, height, opts = {}) {
  const uniforms = {
    src: { value: opts.srcTexture || null },
    nd: { value: opts.ndTexture || null },
    res: { value: new THREE.Vector2(width, height) },
    focus: { value: opts.focus ?? 5.0 },
    cinf: { value: opts.cinf ?? 0.0 },
    near: { value: opts.near ?? 1.0 },
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
      uniform sampler2D src;
      uniform sampler2D nd;
      uniform vec2 res;
      uniform float focus, cinf, near;
      varying vec2 vUv;

      float cocRadius(float d) {
        if (d <= 0.0) d = 500.0;
        float k = 1.0 - focus / d;
        float scaledCinf = cinf * max(1.0, res.y / 1920.0);
        return k > 0.0 ? scaledCinf * k : min(-k * scaledCinf * near, scaledCinf * 1.35);
      }

      void main() {
        float d0 = texture2D(nd, vUv).a;
        if (d0 <= 0.0) d0 = 500.0;
        float c0 = cocRadius(d0);

        if (cinf < 0.45 || c0 < 0.55) {
          gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.0));
          return;
        }

        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        float pxScale = max(1.0, res.y / 1920.0);

        for (int i = 0; i < 48; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 48.0);
          float a = fi * 2.39996;
          vec2 off = vec2(cos(a), sin(a)) * r * c0 / res;
          float ds = texture2D(nd, vUv + off).a;
          if (ds <= 0.0) ds = 500.0;
          float cs = cocRadius(ds);
          // Foreground-bleed prevention: sharp foreground never washes background halos unevenly,
          // while genuine out-of-focus foreground overlaps smoothly.
          float edgeGuard = (ds < d0 * 0.97)
            ? smoothstep(r * c0 - 1.2 * pxScale, r * c0 + 0.6 * pxScale, cs + 0.6 * pxScale)
            : (c0 > 1.2 * pxScale && ds >= d0 * 0.97 ? smoothstep(0.3, 1.0, cs / max(c0, 0.5)) : 1.0);
          float w = max(0.05, edgeGuard);
          acc += texture2D(src, vUv + off).rgb * w;
          wsum += w;
        }
        gl_FragColor = linearToOutputTexel(vec4(acc / max(wsum, 1e-3), 1.0));
      }
    `,
  });
  mat.toneMapped = false;

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return { scene, material: mat, uniforms };
}

export function setDofResolution(pass, width, height) {
  pass.uniforms.res.value.set(width, height);
}

export function updateDofUniforms(pass, opts = {}) {
  const u = pass.uniforms;
  if (opts.srcTexture) u.src.value = opts.srcTexture;
  if (opts.ndTexture) u.nd.value = opts.ndTexture;
  if (typeof opts.focus === 'number') u.focus.value = opts.focus;
  if (typeof opts.cinf === 'number') u.cinf.value = opts.cinf;
  if (typeof opts.near === 'number') u.near.value = opts.near;
}
