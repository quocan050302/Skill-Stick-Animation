# Run `SHORT-01-20261119-02` — Files Changed

All committed files below are **NEW IMPLEMENTATION**, **GENERATED METADATA**, or **PRESERVED MIT LICENSE NOTICES**. Zero copied original `cartoon-short-kit.zip` files are staged or pushed (`G05 BLOCKED` for public repo; preserved locally under `.gitignored` `vendor/cartoon-short-kit/` and `engine/web/`).

| Path | Action | Provenance | Purpose |
| :--- | :---: | :---: | :--- |
| `.gitignore` | Modified | NEW | Also ignores `vendor/upstream/` and `engine/web/` to enforce G05 |
| `README.md` | Modified | NEW | Updated reproducible commands for kit audit, restore, renders, and tests |
| `package.json` | Modified | NEW | Added `setup:restore`, `render:original`, `render:parallel`, updated `test:node` |
| `vendor/README.md` | Modified | NEW | Updated verified local preservation & MIT notice pointers |
| `vendor/source-manifest.json` | Modified | GENERATED | Real 14/14 CRC32 + SHA-256 manifest from `cartoon-short-kit.zip` |
| `vendor/upstream-deps-lock.json` | Added | GENERATED | Pinned `three@0.160.0` + `claude-animated-shorts@e3b817b6` hashes |
| `vendor/licenses/THREE-0.160.0-LICENSE.txt` | Added | MIT NOTICE | Preserved Three.js MIT license notice |
| `vendor/licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt` | Added | MIT NOTICE | Preserved `mromidev/claude-animated-shorts` MIT license notice |
| `tools/setup/install_engine.mjs` | Added | NEW | Safe engine restorer replacing `/tmp` `setup.sh` + Node v26 `strip` fix |
| `tools/render/render_original.mjs` | Added | NEW | Production frame capture CLI wrapping real engine via adapter |
| `tools/render/render_parallel.mjs` | Added | NEW | Bounded 2-worker parallel shard coordinator with signal cleanup |
| `tools/audio/soldier_audio_audit.py` | Added | NEW | Non-mutating Config A (`audio.py`) vs Config B (`mix.py`) auditor |
| `tools/audio/zombie_audio.py` | Added | NEW | 10.00s convenience-store comedy music + SFX synthesizer |
| `tools/qa/contact_sheet.py` | Added | NEW | Atomic 270×480 contact-sheet builder matching `sheet.py` |
| `tools/qa/export_mp4.py` | Modified | PATCHED NEW | Enforced strict TV-range `yuv420p` (`scale=in_range=full:out_range=tv,format=yuv420p`) |
| `tools/qa/collect_metrics.py` | Added | NEW | Aggregates verified deliverables, FFprobe QA, and Tile 0 backtest |
| `engine/adapters/renderer_adapter.mjs` | Modified | NEW | Added `canvas_dataurl` capture, `#e`/`#nd` debug pass flags, custom `webDir` mount |
| `engine/demos/zombie-10s/index.html` | Added | NEW | Host page for freshly authored 10s Convenience Store Zombie proof |
| `engine/demos/zombie-10s/paint_store.js` | Added | NEW | Fresh deterministic Canvas2D convenience-store & signage textures |
| `engine/demos/zombie-10s/cast_zombie.js` | Added | NEW | Fresh cartoon zombie ("Bloop") & 2D comic FX cards on MIT `Pen` |
| `engine/demos/zombie-10s/story_zombie.js` | Added | NEW | Pure frame-driven 300-frame (10.00s) 4-shot storyboard & physics |
| `engine/demos/zombie-10s/main_zombie.js` | Added | NEW | Three.js 0.160.0 3D store world + Ink + 48-tap DOF + 2D cards |
| `tests/unit/test_contract_and_adapter.mjs` | Modified | NEW | Isolated temp root for missing-kit negative test (works locally & in CI) |
| `tests/unit/test_original_kit_modules.mjs` | Added | NEW | Unit tests for `motion.js`, `story.js`, and `story_zombie.js` |
| `tests/regression/test_original_engine_parity.py` | Added | NEW | Byte-integrity regression, Tile 0 backtest, and audio divergence verification |
| `tests/run_all.py` | Modified | NEW | Added `unit_motion_story_modules` & `regression_original_engine_parity` to DAG |
| `docs/*.md`, `docs/SOURCE_FIDELITY_MANIFEST.json` | Modified | NEW | Updated with complete Phase 0–8 audited evidence |
| `docs/agent-runs/SHORT-01-20261119-02/*` | Added | NEW | Immutable Run 2 evidence directory (9 mandatory files) |
