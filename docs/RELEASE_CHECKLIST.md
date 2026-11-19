# Release & Publication Checklist (`SHORT-01` — Run `SHORT-01-20261119-02`)

## 1. Repository & Branch Hygiene
- [x] Target remote verified: `https://github.com/quocan050302/Skill-Stick-Animation.git` (PUBLIC)
- [x] One-time bootstrap `master` verified (`f1428c7465f0fba75923892d76025cce6d3a3626`)
- [x] All implementation committed on feature branch `feat/short-01-original-engine-fidelity`
- [x] No auto-merge into `master`; no force-push; no history rewrite
- [x] Old `Skill-B6` (`D:\Project_github\Agent-Skill`) completely untouched (`master...origin/master`, `6b1c42c`)

## 2. Public Repository Licensing & Security Gate (G05 / G19)
- [x] Zero secrets, tokens, `.env` values, or credential logs staged
- [x] Zero large generated frames, MP4s, `node_modules/`, or caches staged (`.gitignore` enforced)
- [x] **G05 strictly honored:** `vendor/cartoon-short-kit/`, `vendor/upstream/`, `engine/web/`, and `_inputs/` excluded via `.gitignore` because `cartoon-short-kit.zip` has no identifiable package-level `LICENSE`
- [x] Preserved MIT notices committed in `vendor/licenses/THREE-0.160.0-LICENSE.txt` and `vendor/licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt`
- [x] Exact dependency hashes/commits locked in `package-lock.json` and `vendor/upstream-deps-lock.json`

## 3. Original Engine & New 10s Proof Verification (Local Full Execution)
- [x] Forensic ZIP audit & 14/14 byte-identical preservation verified (`docs/SOURCE_FIDELITY_MANIFEST.json`)
- [x] Original Soldier baseline 15 key frames (`0..591`), `#e`/`#nd` debug passes, repeat-frame determinism, and `out/reference-contact-sheet.jpg` visually verified against `example/soldier/stills.jpg`
- [x] Original Soldier 180-frame continuous preview (`out/soldier-reference-preview.mp4`) verified by FFprobe (`h264`, `1080x1920`, `30 fps`, strict `yuv420p`, `aac`, `+faststart`, `0` freeze/black hits)
- [x] Phase 5 audio & timing audits completed (Config A original `audio.py` vs Config B NEW `mix.py` `-6.02 dB` gated-RMS; `timing.py` synthetic cadence test; real human voiceover honestly marked `UNVERIFIED`)
- [x] New original 10-second (300-frame) Convenience Store Zombie proof (`out/new-zombie-10s-preview.mp4` + `out/new-zombie-contact-sheet.jpg`) rendered and verified by FFprobe + motion QA
- [x] Bounded async DAG test suite (`python tests/run_all.py`) settled with 0 failures & 0 skips
- [x] New immutable per-run audit directory created: `docs/agent-runs/SHORT-01-20261119-02/` (without modifying Run 1)
