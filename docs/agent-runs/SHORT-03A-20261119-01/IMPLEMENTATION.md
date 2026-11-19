# Implementation Summary (`SHORT-03A`: Universal Visual Foundation + Native Vertical 4K)

## Key Architectural Changes
1. **Reusable Rendering Modules (`engine/visual/*`):**
   - `look_profiles.js`, `card_shading.js`, `camera_director.js`, `occlusion_guard.js`, `procedural_materials.js`, `ink_quality.js`, `depth_of_field.js`, and `index.js`.
   - Solves flat unlit card appearance (`MeshBasicMaterial` -> `MeshLambertMaterial` + real `PCFSoftShadowMap` `getShadowMask()`), camera cut/push/impact grammar, raycast occlusion guarding, seeded cached materials, and resolution-scaled (`scaleFactor = res.y / 1920`) ink contours + foreground-bleed-safe DOF.
2. **Native Vertical 4K Contract & Pipeline (`2160×3840`, 30fps):**
   - `app/shared/contract.mjs`: Added `OUTPUT_PRESETS` (`standard: 1080×1920`, `native_4k: 2160×3840`) & `resolveOutputPreset`.
   - `app/shared/project_schema.mjs`: Registered `'mine-salting-20s'` (600 frames, 6 beats) and `visualFoundation: 'baseline' | 'enhanced'`.
   - `engine/adapters/renderer_adapter.mjs`: Mounts `/visual`, injects `__RENDER_OUTPUT_CONFIG__`, enforces Chromium `gl.drawingBufferWidth === project.width` & `height === project.height`, verifies `MAX_RENDERBUFFER_SIZE` before capture, checks physical image headers on every frame, and validates preset/dimensions cleanly on resume manifests.
   - `tools/render/{frame_runner, render_original, render_parallel}.mjs` & `app/server/services/job_manager.mjs`: Safe single-worker clamping (`workers=1`) & dynamic disk headroom preflight for 4K renders, preserving `baseline` 1080p determinism.
   - `tools/qa/{export_mp4, verify_media, shot_qa}.py` & `app/server/services/qa_service.mjs`: Rejects lower-res inputs without spatial upscaling, adds native 4K frequency/acuity verification (`check_native_4k_detail` combining sharpest-tile 2D FFT outer-band ratio & bicubic roundtrip `p999`), adds shot-level optical/pop/freeze QA, and fixes `audio_track` fallback false-PASS behavior.
3. **Existing Demo Preservation + Integration:**
   - `engine/demos/zombie-10s/` and `engine/demos/plaza-courier-10s/` integrate `/visual/*` cleanly under `visualFoundation === 'enhanced'` and `SCALE !== 1`, preserving `baseline` mode without breaking existing Studio overrides.
4. **Compact Dark React Studio UI (`app/frontend/`):**
   - `RenderDialog.tsx`: Added compact resolution preset selector (`1080×1920` vs `2160×3840 4K Dọc Gốc`) with disk/RAM advisory.
   - `ShotInspector.tsx`: Added `visualFoundation` mode selector cleanly inside the existing Scene tab without altering the minimal dark theme.
5. **Original 20s 4K Proof (`engine/demos/mine-salting-20s/`):**
   - Independently authored 3D frontier gold mine tunnel, articulated brass assay balance, diesel/lantern lights, sunlit canyon exit vista, custom 2D cast (`Prospector Investor` + `Swindler Miner`), synced frame-for-frame to real `20.00s` local SAPI5 audio & SFX stems.
