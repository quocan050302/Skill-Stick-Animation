# Regression, Backtest & Cross-Niche Generalization Summary (`SHORT-03A`)

## 1. Preserved Legacy & Baseline Behavior
- **`short01_regression_suite` (`tests/run_all.py`):** **9 / 9 suites PASS** (`9.42s`). Zero modifications broke ZIP ingestion audit, path/disk confinement, timing math, `-6 dB` linear audio mixer, or Three.js smoke WebGL -> FFmpeg encode. *(Note: 2 optional Soldier pixel backtests in `test_original_engine_parity.py` skipped gracefully as pre-rendered external reference tiles were absent, identical to `QA` baseline).*
- **`short02_unit_tests` (`4 / 4 PASS`), `short02_api_integration` (`2 / 2 PASS`), `short02_playwright_e2e` (`PASS`), `unified_dev_smoke` (`PASS`):** Zero regressions in React dark Studio, project CRUD, preview coalescing, warm LRU cache, voiceover upload/sync blocking, job cancellation, or localhost FE+BE unified startup.
- **Control Baseline Invariance (`zombie-10s` & `plaza-courier-10s`):** Under `visualFoundation: 'baseline'`, pixel diffs vs `QA` reference control stills are near-zero JPEG recompression variance only (`meanAbsDiff = 0.30 / 255`, zero shader errors), while `enhanced` introduces directional `getShadowMask()` character light/shadow response (`visual-ab-comparison.jpg`).

## 2. Cross-Niche Visual Generalization (4 Distinct Niches, All Passing with 0 Console/Page Errors)
Verified directly through headless Chromium (`renderer_adapter.mjs` via `tests/integration/test_short03a_cross_niche_and_e2e.mjs`):
1. **Historic Gold Mine Cavern (`engine/demos/mine-salting-20s/`):** Dark stratified cavern rock, timber framing, sunlit exit portal contrast (`mineLantern`, `warmInterior`, `mineExitDaylight`). `5` representative shot frames rendered (`0` errors) + full 600-frame Native 4K proof (`2160×3840`).
2. **Modern Convenience Store (`engine/demos/zombie-10s/`, `visualFoundation: 'enhanced'`):** Bright tiled aisle lighting + cool `dramaticBlue` beat, verifying card lighting & DOF parity across existing demo assets (`2` frames, `0` errors).
3. **Twilight Samurai Dojo Courtyard (`tests/fixtures/niche-samurai-test/`):** Warm `samuraiDusk` orange-purple gradient sky, wood/plaster materials, impact camera kick (`2` frames, `0` errors).
4. **Sterile Science Laboratory (`tests/fixtures/niche-lab-test/`):** Crisp `modernLab` sterile white/cyan tiles, concrete wall, brushed metal table, and refractive `glass` vessel (`2` frames, `0` errors).
