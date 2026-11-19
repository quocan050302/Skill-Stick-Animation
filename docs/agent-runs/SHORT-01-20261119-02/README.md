# Run Log: `SHORT-01-20261119-02`

- **Run ID:** `SHORT-01-20261119-02` *(new run folder; Run 1 `SHORT-01-20261119-01` preserved untouched)*
- **Date:** `2026-11-19`
- **Starting Commit:** `9b7303d375f1ea7abb345873f4d35b1970d57762` (`feat/short-01-original-engine-fidelity`)
- **Bootstrap `master` Commit:** `f1428c7465f0fba75923892d76025cce6d3a3626`
- **Remote:** `https://github.com/quocan050302/Skill-Stick-Animation.git` (PUBLIC)

## What This Run Executed
1. Forensic ZIP audit & 14/14 byte-identical local preservation of `C:\Users\QuocAn\Downloads\cartoon-short-kit.zip` (SHA-256 `784c07e3...`) and `C:\Users\QuocAn\Downloads\SKILL.md` (SHA-256 `2ac0bf5f...`).
2. Safe dependency pinning & original engine restoration (`tools/setup/install_engine.mjs`): pinned `three@0.160.0` (MIT) and `mromidev/claude-animated-shorts` commit `e3b817b6afc6cd413466d43f11ba31209e034bbf` (`templates/bridge/toon.ts`, MIT LICENSE preserved); fixed Node v26 `module.stripTypeScriptTypes(..., { mode: 'strip' })` incompatibility from original `setup.sh`.
3. Original Soldier baseline verification from unmodified original `engine/web/*`:
   - 15 key stills across all 8 shots (`0..591`) + repeat frame 0 bit-identical SHA-256 check + Ink (`#e`) & Normal/Depth (`#nd`) debug passes → `out/reference-contact-sheet.jpg`
   - 180-frame (6.00s @ 30fps) continuous Soldier preview → `out/soldier-reference-preview.mp4` (strict TV-range `yuv420p` H.264/AAC `+faststart`)
4. Phase 5 audio & timing audit:
   - Executed original `example/soldier/audio.py` (Config A) vs NEW `tools/audio/mix.py` (Config B) on identical Soldier music+SFX stems + synthetic voice proxy, proving exact divergence (`audio.py` dynamic ducking + `tanh` vs `mix.py` linear `-6.0206 dB` / `0.500` ratio, zero ducking).
   - Executed original `tools/timing.py` on a 6.00s synthetic cadence fixture (`duration=6.0s`, `frames30=180`, 3 segments/phrases, 23 monotonic words).
5. Phase 7 new original 10-second (300-frame, 1080×1920 @ 30fps) Convenience Store Zombie proof (`engine/demos/zombie-10s/`):
   - Visual look-check contact sheet + 3 framing/sign/FX polish fixes
   - Full 300-frame bounded 2-worker parallel render → `out/new-zombie-10s-preview.mp4` & `out/new-zombie-contact-sheet.jpg`
6. Full bounded async DAG test suite (`python tests/run_all.py`) including unit, integration, regression, backtest, and negative tests, followed by safe public-repo-compliant push (G05 honored: zero unlicensed kit files staged/pushed).

## Local Outputs Generated (`out/`, `.gitignored`)
- `out/reference-contact-sheet.jpg`
- `out/soldier-reference-preview.mp4`
- `out/new-zombie-10s-preview.mp4`
- `out/new-zombie-contact-sheet.jpg`
- `out/technical-qa.json`
- `out/render-metadata.json`
