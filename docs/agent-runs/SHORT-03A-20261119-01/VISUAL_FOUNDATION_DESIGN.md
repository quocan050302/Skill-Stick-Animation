# Universal Visual Foundation Design (`engine/visual/*`, `SHORT-03A`)

## Architecture Overview
All visual upgrades live as reusable, scene-independent Three.js r160 + 2D Canvas ES modules inside `engine/visual/`, leaving legacy `baseline` behavior intact when requested:

1. **`look_profiles.js`** (`LOOK_PROFILES`, `getLookProfile`, `applyLookProfile`, `createVisualFoundationConfig`):
   - Parameterizes lighting azimuth/elevation, hemisphere/directional bounce, fog falloff, sky dome gradient colors, color saturation/lift/gain/vignette, and character shading parameters across unrelated palettes (`daylightPlaza`, `warmInterior`, `coolDramatic`, `mineLantern`, `mineExitDaylight`, `modernLab`, `samuraiDusk`).
2. **`card_shading.js`** (`createLitCardMaterial`, `updateCardLight`, `createCardNdMaterial`, `makeContactShadow`, `setCardWorldScale`):
   - Extends `THREE.MeshLambertMaterial` via `onBeforeCompile`, explicitly injecting Three.js `#include <shadowmask_pars_fragment>` so 2D billboard characters receive real `PCFSoftShadowMap` shadows (`getShadowMask()`), directional head/torso shading roll-off, luminance-preserving skin tint, and subtle sun/key rim highlights without double-darkening.
3. **`camera_director.js`** (`evaluateCameraKeys`, `applyPushIn`, `applyImpactKick`, `resolveFocusTarget`, `screenProjectBounds`):
   - Evaluates smoothstep camera keyframes with hard `cut` boundaries, world clamping bounds, subtle push-in drift, damped rotational impact kicks, and pixel-space bounding projection to detect cropped heads or edge clipping.
4. **`occlusion_guard.js`** (`detectOcclusion`, `resolveStagingConflict`):
   - Raycasts from the active camera toward named hero face/hand/prop world coordinates against registered occluders, hiding only `userData.nonEssentialProp === true` clutter or applying bounded deterministic camera nudges while never removing `storyCritical` geometry.
5. **`procedural_materials.js`** (`createMaterialRecipe`, `getProceduralMaterialStats`, `disposeMaterialCache`, `seededRng`):
   - Deterministic seeded procedural `CanvasTexture` + `MeshToonMaterial` cache supporting `rock`, `ore`, `wood`, `metal`, `plaster`, `concrete`, `soil`, `fabric`, `tiles`, `grass`, `water`, and `glass`.
6. **`ink_quality.js`** (`createWorldNdMaterial`, `swapMaterialsForNd`, `createInkGradePass`, `setInkResolution`, `updateInkGradeUniforms`):
   - World-only 16-tap depth + normal edge crease detector skipping billboard characters cleanly (`card && ds > 0`), with stroke width strictly normalized by `max(1.0, res.y / 1920.0)` and ESSL-1.00 compatible luminance hash film grain.
7. **`depth_of_field.js`** (`createDofPass`, `setDofResolution`, `updateDofUniforms`):
   - 48-tap Poisson bokeh gather scaled strictly by `(res.y / 1920.0)` with foreground bleed suppression (`ds < d0 * 0.97`) keeping sharp foreground heads clean against blurred backdrops at both `1080×1920` and native `2160×3840`.
