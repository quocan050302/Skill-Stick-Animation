# Release & Publication Checklist (`SHORT-01`)

## 1. Repository & Branch Hygiene
- [x] Target remote verified: `https://github.com/quocan050302/Skill-Stick-Animation.git` (PUBLIC)
- [x] One-time bootstrap `master` pushed (`f1428c7465f0fba75923892d76025cce6d3a3626`)
- [x] Feature branch created from `master`: `feat/short-01-original-engine-fidelity`
- [x] No auto-merge into `master`; no force-push; no history rewrite
- [x] Old `Skill-B6` (`D:\Project_github\Agent-Skill`) completely untouched (clean working tree at `6b1c42c`)

## 2. Security & Publication Gate (G05 / G19)
- [x] Zero secrets, tokens, `.env` files, or credential logs staged
- [x] Zero large generated frames, MP4s, `node_modules/`, or caches staged (`.gitignore` enforced)
- [x] `_inputs/` and `vendor/cartoon-short-kit/` excluded from public git tracking while **G05 = BLOCKED**
- [x] Only 100% independently authored scaffolding, safe tooling, tests, and honest documentation committed to public feature branch
- [x] Third-party license notices (`three@0.160.0` MIT, `playwright@1.65.1` Apache-2.0) documented in `vendor/README.md` and `docs/DEPENDENCIES.md`

## 3. Technical Verification Completed (Independently Authored Scope)
- [x] `node tools/setup/safe_setup.mjs` — `local_tooling_ready: true`
- [x] `node tools/render/webgl_smoke.mjs` — G07 real Chromium + WebGL2 + Three.js 0.160.0 1080×1920 PASS
- [x] `python tests/run_all.py` — Bounded async DAG suite (unit + integration + negative) PASS
- [x] Per-run audit directory created: `docs/agent-runs/SHORT-01-20261119-01/`

## 4. Remaining Gates Blocking Full SHORT-01 Completion
- [ ] **G03 / G04:** Place `cartoon-short-kit.zip` and `Pasted markdown.md` into `_inputs/` and run `python tools/setup/audit_kit.py --preserve --write-manifest`
- [ ] **G05:** Resolve public redistribution authorization for kit source (or keep kit local-only / switch repo private)
- [ ] **G06 (upstream `toon.ts`):** Inspect `tools/setup.sh`, pin `mromidev/claude-animated-shorts` commit + MIT notice
- [ ] **G08–G11:** Restore original `engine/web/*`, render Soldier reference frames & contact sheet, compare against `example/soldier/stills.jpg`
- [ ] **G12–G14:** Audit original `timing.py`, `audio.py`, `finish.sh` and render verified Soldier preview MP4
- [ ] **G15:** Author and render original 10-second (300-frame, 1080×1920 @ 30fps) convenience-store zombie proof on top of the original engine
