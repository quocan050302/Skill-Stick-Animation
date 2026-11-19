# Files Changed on `feat/short-03a-universal-visual-foundation`

*(Diff base: `QA` @ `00c559ba2802e0809d02926df437ccdc584c8086`)*

## New Modules & Original Demo (`SHORT-03A`)
- `engine/visual/look_profiles.js` — Scene-independent 3D lighting, atmosphere, sky, grade & card shading profiles
- `engine/visual/card_shading.js` — `MeshLambertMaterial` + Three.js `getShadowMask()` character lighting & dynamic contact shadows
- `engine/visual/camera_director.js` — Keyframe camera evaluation, cuts, push-in, impact kicks, focus distance, screen-space bounds
- `engine/visual/occlusion_guard.js` — Raycast sightline occlusion detection & deterministic non-essential prop hiding / camera nudge
- `engine/visual/procedural_materials.js` — Cached deterministic procedural `CanvasTexture` + `MeshToonMaterial` generators
- `engine/visual/ink_quality.js` — Resolution-scaled world-only normal/depth ink outline + ESSL-1.00 safe hash film grain
- `engine/visual/depth_of_field.js` — Resolution-scaled 48-tap Poisson DOF with foreground bleed suppression
- `engine/visual/index.js` — Barrel export module
- `engine/demos/mine-salting-20s/{index.html, paint_mine.js, cast_mine.js, story_mine.js, main_mine.js}` — Original 20s (600f) Native 4K proof
- `tools/qa/shot_qa.py` — Shot-level optical luma/sat/pop/freeze & EBU-R128/silence audio QA verifier
- `tools/audio/generate_mine_narration.ps1`, `tools/audio/build_mine_audio.py` — Offline local Windows SAPI5 beat narration synthesizer & 48kHz assembler
- `tests/fixtures/niche-samurai-test/{index.html, main.js}` & `tests/fixtures/niche-lab-test/{index.html, main.js}` — Cross-niche generalization fixtures
- `tests/unit/test_short03a_visual_and_4k.mjs` — Contract, schema, Phase H audio QA negative matrix, Native 4K upscale rejection, occlusion & disk guard tests
- `tests/integration/test_short03a_cross_niche_and_e2e.mjs` — 4-niche Chromium suite + live compact dark Studio 4K render E2E
- `docs/agent-runs/SHORT-03A-20261119-01/*` — Full run report & lightweight JPEG/PNG screenshots

## Modified Existing Source
- `app/shared/contract.mjs` — Added `OUTPUT_PRESETS` (`standard: 1080×1920`, `native_4k: 2160×3840`) & `resolveOutputPreset`
- `app/shared/project_schema.mjs` — Added `visualFoundation` (`baseline | enhanced`), `outputPreset`, and `'mine-salting-20s'` template
- `engine/adapters/renderer_adapter.mjs` — Mounted `/visual`, injected `__RENDER_OUTPUT_CONFIG__`, verified WebGL drawing buffer & `MAX_RENDERBUFFER_SIZE`
- `engine/demos/zombie-10s/{index.html, main_zombie.js}` & `engine/demos/plaza-courier-10s/{index.html, main_plaza.js}` — Integrated `/visual/` under `enhanced` / `SCALE !== 1`, preserving `baseline`
- `app/server/services/qa_service.mjs` — Fixed Phase H audio fallback false-PASS (`evaluateAudioMixGate`) & added `evaluateNative4kGate`
- `app/server/services/job_manager.mjs` — Added `native_4k` disk headroom preflight, safe worker bounds, WebGL proof forwarding, & expected dimension validation
- `app/frontend/src/{types.ts, api/client.ts, App.tsx, components/RenderDialog.tsx, components/ShotInspector.tsx}` — Added compact resolution preset (`1080p` vs `4K dọc gốc 2160×3840`) & `visualFoundation` control preserving minimal dark UI
- `tools/render/{frame_runner, render_original, render_parallel}.mjs` — Added `--output-preset`, strict manifest preset validation, & 4K multi-worker scaling bounds
- `tools/qa/{export_mp4, verify_media}.py` — Strict non-upscaling dimension assertion + 2D FFT/bicubic-roundtrip `check_native_4k_detail`
- `tools/audio/template_audio.py` — Added `mine-salting-20s` frontier acoustic bed + mine SFX stem generator
- `tests/verify_all.py` — Bounded 2-stage async DAG (`Stage 1` parallel `Semaphore(3)`, `Stage 2` serialized Chromium `Semaphore(1)`)
