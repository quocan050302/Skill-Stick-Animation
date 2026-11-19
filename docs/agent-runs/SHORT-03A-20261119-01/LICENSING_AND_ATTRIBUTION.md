# Licensing & Third-Party Attribution (`SHORT-03A`)

## Repository Licensing Discipline
- **Proprietary / Unlicensed Baseline Assets Excluded:** `.gitignore` continues to exclude `vendor/cartoon-short-kit/` and restored `engine/web/`. Nothing from `cartoon-short-kit.zip` is committed to Git.
- **Original / Newly Authored Implementations:**
  - `engine/visual/{camera_director.js, occlusion_guard.js, look_profiles.js}`
  - `engine/demos/mine-salting-20s/{index.html, main_mine.js, paint_mine.js, cast_mine.js, story_mine.js}`
  - `tools/audio/{generate_mine_narration.ps1, build_mine_audio.py}` & `mine-salting-20s` branch in `tools/audio/template_audio.py`
  - `tests/fixtures/{niche-samurai-test, niche-lab-test}/*`, `tests/unit/test_short03a_visual_and_4k.mjs`, `tests/integration/test_short03a_cross_niche_and_e2e.mjs`
  - Updates across `app/shared/`, `app/server/`, `app/frontend/`, `tools/render/`, `tools/qa/`, and `engine/demos/{zombie-10s, plaza-courier-10s}/`
- **Selectively Adapted MIT Code (`github.com/mromidev/claude-animated-shorts`, commit `e3b817b6afc6cd413466d43f11ba31209e034bbf`):**
  - Preserves existing MIT license copy at `vendor/licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt`.
  - Attributed inline in module headers:
    - `engine/demos/lib/toonbase.js` (ported under MIT from `templates/bridge/toon.ts`)
    - `engine/visual/card_shading.js` (zone/rim card shader math inspired by `templates/bridge/cardshade.ts`, rebuilt on Three.js r160 `MeshLambertMaterial` + `getShadowMask()`)
    - `engine/visual/ink_quality.js` (world-only normal/depth crease & anti-card-double-ink check adapted from `templates/bridge/ink.ts`)
    - `engine/visual/depth_of_field.js` (48-tap Poisson gather & foreground-bleed guard adapted from `templates/bridge/lensblur.ts`)
    - `engine/visual/procedural_materials.js` (canvas surface painting idiom inspired by `templates/bridge/paint.ts`)
    - `tools/qa/shot_qa.py` (shot luma/sat/pop/freeze logic adapted from `templates/scripts/short_qa.py`)
- **Voice Narration Provenance:**
  - Synthesized strictly offline via Microsoft Windows SAPI5 `System.Speech` (`Microsoft David Desktop`, `en-US`, un-accelerated `Rate = 0`). Zero external paid TTS/video APIs used; zero stock audio imported; historical explanation sourced & fact-checked against AZGS, Mindat, and American Heritage.
