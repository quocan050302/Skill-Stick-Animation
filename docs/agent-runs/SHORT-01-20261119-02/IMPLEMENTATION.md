# Run `SHORT-01-20261119-02` — Implementation Record

## Provenance Breakdown
- **COPIED ORIGINAL (local-only under `.gitignore`, G05 respected):** 14 files in `vendor/cartoon-short-kit/` + restored runtime copies in `engine/web/` (`index.html`, `main.js`, `motion.js`, `paint.js`, `roman.js`, `story.js`). Zero modifications made to original source files.
- **PATCHED / COMPATIBILITY WRAPPERS (NEW CODE):**
  1. `tools/setup/install_engine.mjs` — Safe replacement for hazardous `/tmp` `tools/setup.sh`; fixes Node v26 `module.stripTypeScriptTypes` (`mode: 'strip'` instead of removed `'transform'`), pins `three@0.160.0` + `mromidev/claude-animated-shorts@e3b817b6`, preserves MIT LICENSE files.
  2. `engine/adapters/renderer_adapter.mjs` — Added fast `canvas.toDataURL` capture path matching original `tools/render.mjs`, optional `#e`/`#nd` debug pass flags, and custom `webDir` mounting (with `/three` and `/toonbase` MIT helpers).
  3. `tools/qa/export_mp4.py` — Fixed FFmpeg 9.0.2 JPEG-to-MP4 pixel format handling (`scale=in_range=full:out_range=tv,format=yuv420p` + `-color_range tv -pix_fmt yuv420p`) so FFprobe confirms strict TV-range `yuv420p` rather than `yuvj420p`.
- **NEW IMPLEMENTATION (independently authored & committed):**
  1. `tools/render/render_original.mjs` & `tools/render/render_parallel.mjs` — Safe single & bounded 2-worker parallel render CLIs with disk preflight, atomic writes, hash+dimension RESUME, repeat-frame determinism checks, and `SIGINT`/`SIGTERM` cleanup.
  2. `tools/qa/contact_sheet.py` — Atomic 270×480 contact-sheet builder matching `tools/sheet.py`.
  3. `tools/audio/soldier_audio_audit.py` & `tools/audio/zombie_audio.py` — Non-mutating Config A vs B audio comparison harness and 10-second comedy music+SFX synthesizer.
  4. `engine/demos/zombie-10s/` (`index.html`, `paint_store.js`, `cast_zombie.js`, `story_zombie.js`, `main_zombie.js`) — Freshly authored 10-second (300-frame, 1080×1920 @ 30fps) Convenience Store Cartoon Zombie proof built on the 2D-card + 3D-world Toon/Ink/48-tap DOF architecture (zero gore, zero Soldier assets reused).
  5. `tests/unit/test_original_kit_modules.mjs` & `tests/regression/test_original_engine_parity.py` — Motion/story/RNG unit tests + byte-integrity regression + matched-tile Soldier backtest vs `example/soldier/stills.jpg`.
