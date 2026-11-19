/**
 * Reusable Look Profiles & Visual Foundation Config for 9:16 2D+3D rendering (SHORT-03A).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-03A).
 * Generic scene-independent lighting, atmosphere, grade, and character-shading profiles.
 */

export const VISUAL_FOUNDATION_MODES = Object.freeze({
  BASELINE: 'baseline',
  ENHANCED: 'enhanced',
});

export function createVisualFoundationConfig(mode = VISUAL_FOUNDATION_MODES.BASELINE, overrides = {}) {
  return {
    mode: mode === VISUAL_FOUNDATION_MODES.ENHANCED ? VISUAL_FOUNDATION_MODES.ENHANCED : VISUAL_FOUNDATION_MODES.BASELINE,
    profileId: overrides.profileId || null,
    enableCardLitShader: mode === VISUAL_FOUNDATION_MODES.ENHANCED,
    enableContactShadowTrack: mode === VISUAL_FOUNDATION_MODES.ENHANCED,
    enableResolutionScaledInk: mode === VISUAL_FOUNDATION_MODES.ENHANCED,
    enableNearSafeDof: mode === VISUAL_FOUNDATION_MODES.ENHANCED,
    enableFilmGrain: Boolean(overrides.enableFilmGrain ?? mode === VISUAL_FOUNDATION_MODES.ENHANCED),
    grainAmount: typeof overrides.grainAmount === 'number' ? overrides.grainAmount : 0.018,
  };
}

export const LOOK_PROFILES = Object.freeze({
  daylightPlaza: Object.freeze({
    id: 'daylightPlaza',
    az: 132,
    el: 48,
    sky: '#d8ecff',
    ground: '#8f8872',
    hemi: 1.25,
    sun: '#fff4de',
    sunI: 2.3,
    fog: '#d7eaf8',
    fogNear: 36,
    fogFar: 220,
    skyTop: '#4e8ed8',
    skyHor: '#d4eafc',
    charTint: '#f7f4f1',
    charShade: 0.84,
    charGrad: 0.065,
    bodyGrad: 0.095,
    sideTint: '#8e98be',
    rimStrength: 0.14,
    sat: 1.12,
    gain: '#ffffff',
    lift: '#000000',
    vig: 0.16,
    shadowExt: 16,
  }),

  warmInterior: Object.freeze({
    id: 'warmInterior',
    az: 120,
    el: 54,
    sky: '#f8fbff',
    ground: '#b9c6cb',
    hemi: 1.28,
    sun: '#fff8ec',
    sunI: 2.05,
    fog: '#eaf2f2',
    fogNear: 20,
    fogFar: 68,
    skyTop: '#9cd2ea',
    skyHor: '#e8f5f8',
    charTint: '#fff5ec',
    charShade: 0.85,
    charGrad: 0.055,
    bodyGrad: 0.085,
    sideTint: '#9ea8c4',
    rimStrength: 0.12,
    sat: 1.1,
    gain: '#ffffff',
    lift: '#000000',
    vig: 0.18,
    shadowExt: 14,
  }),

  coolDramatic: Object.freeze({
    id: 'coolDramatic',
    az: 148,
    el: 34,
    sky: '#7f9fd4',
    ground: '#394664',
    hemi: 0.88,
    sun: '#cfe2ff',
    sunI: 1.9,
    fog: '#55698f',
    fogNear: 12,
    fogFar: 46,
    skyTop: '#1d2d4e',
    skyHor: '#4f6592',
    charTint: '#dce6ff',
    charShade: 0.72,
    charGrad: 0.075,
    bodyGrad: 0.11,
    sideTint: '#55658e',
    rimStrength: 0.22,
    sat: 1.04,
    gain: '#d7e5ff',
    lift: '#02040a',
    vig: 0.3,
    shadowExt: 12,
  }),

  mineLantern: Object.freeze({
    id: 'mineLantern',
    az: 112,
    el: 42,
    sky: '#9c92a4',
    ground: '#4a3931',
    hemi: 1.24,
    sun: '#ffd08e',
    sunI: 2.35,
    fog: '#2c2229',
    fogNear: 14,
    fogFar: 54,
    skyTop: '#1a1520',
    skyHor: '#483838',
    charTint: '#ffe8cb',
    charShade: 0.78,
    charGrad: 0.075,
    bodyGrad: 0.11,
    sideTint: '#635b82',
    rimStrength: 0.42,
    sat: 1.1,
    gain: '#fff2e2',
    lift: '#030203',
    vig: 0.25,
    shadowExt: 14,
  }),

  mineExitDaylight: Object.freeze({
    id: 'mineExitDaylight',
    az: 136,
    el: 46,
    sky: '#cfe5f7',
    ground: '#7e705c',
    hemi: 1.18,
    sun: '#ffebc7',
    sunI: 2.4,
    fog: '#c9d7e0',
    fogNear: 20,
    fogFar: 95,
    skyTop: '#568bc4',
    skyHor: '#dcebf7',
    charTint: '#fff2df',
    charShade: 0.82,
    charGrad: 0.068,
    bodyGrad: 0.1,
    sideTint: '#7984a8',
    rimStrength: 0.26,
    sat: 1.12,
    gain: '#fffbf4',
    lift: '#000000',
    vig: 0.19,
    shadowExt: 15,
  }),

  modernLab: Object.freeze({
    id: 'modernLab',
    az: 128,
    el: 58,
    sky: '#e6f4ff',
    ground: '#7d8a96',
    hemi: 1.32,
    sun: '#ffffff',
    sunI: 2.15,
    fog: '#dbe7ef',
    fogNear: 24,
    fogFar: 80,
    skyTop: '#92b6d9',
    skyHor: '#e2eef7',
    charTint: '#f5f9ff',
    charShade: 0.86,
    charGrad: 0.055,
    bodyGrad: 0.085,
    sideTint: '#7f93b8',
    rimStrength: 0.18,
    sat: 1.06,
    gain: '#f9fcff',
    lift: '#000000',
    vig: 0.14,
    shadowExt: 15,
  }),

  samuraiDusk: Object.freeze({
    id: 'samuraiDusk',
    az: 28,
    el: 20,
    sky: '#c9a6cf',
    ground: '#6a5248',
    hemi: 1.05,
    sun: '#ffba73',
    sunI: 2.55,
    fog: '#e4b79a',
    fogNear: 26,
    fogFar: 170,
    skyTop: '#4e4d82',
    skyHor: '#ffb87d',
    charTint: '#ffe4c8',
    charShade: 0.8,
    charGrad: 0.072,
    bodyGrad: 0.105,
    sideTint: '#726596',
    rimStrength: 0.45,
    sat: 1.14,
    gain: '#fff6ea',
    lift: '#030205',
    vig: 0.23,
    shadowExt: 16,
  }),
});

export function getLookProfile(idOrOverrides = 'daylightPlaza') {
  if (typeof idOrOverrides === 'string') {
    return { ...(LOOK_PROFILES[idOrOverrides] || LOOK_PROFILES.daylightPlaza) };
  }
  const baseId = idOrOverrides?.id && LOOK_PROFILES[idOrOverrides.id] ? idOrOverrides.id : 'daylightPlaza';
  return { ...LOOK_PROFILES[baseId], ...(idOrOverrides || {}) };
}

export function applyLookProfile(scene, hemiLight, sunLight, profileInput, opts = {}) {
  const L = getLookProfile(profileInput);
  const flicker = typeof opts.flicker === 'number' ? opts.flicker : 1.0;

  if (hemiLight) {
    hemiLight.color.set(L.sky);
    hemiLight.groundColor.set(L.ground);
    hemiLight.intensity = L.hemi * flicker;
  }
  if (sunLight) {
    sunLight.color.set(L.sun);
    sunLight.intensity = L.sunI * flicker;
  }
  if (scene?.fog) {
    scene.fog.color.set(L.fog);
    scene.fog.near = L.fogNear;
    scene.fog.far = L.fogFar;
  }
  if (opts.skyUniforms) {
    if (opts.skyUniforms.top) opts.skyUniforms.top.value.set(L.skyTop);
    if (opts.skyUniforms.hor) opts.skyUniforms.hor.value.set(L.skyHor);
  }
  if (opts.inkUniforms) {
    if (opts.inkUniforms.sat) opts.inkUniforms.sat.value = L.sat;
    if (opts.inkUniforms.gain) opts.inkUniforms.gain.value.set(L.gain || '#ffffff');
    if (opts.inkUniforms.lift) opts.inkUniforms.lift.value.set(L.lift || '#000000');
    if (opts.inkUniforms.vig) opts.inkUniforms.vig.value = L.vig ?? 0.18;
  }
  return L;
}
