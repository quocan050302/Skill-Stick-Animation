# QA Report (`SHORT-01` — Run `SHORT-01-20261119-02`)

- **Overall SHORT-01 Status:** `LOCAL FULL ENGINE + NEW 10S PROOF VERIFIED / PUBLIC PUSH PARTIAL (G05 BLOCKED FOR KIT SOURCE; G12/G13 REAL HUMAN VOICEOVER UNVERIFIED)`
- **Bootstrap `master` SHA:** `f1428c7465f0fba75923892d76025cce6d3a3626`
- **Working Branch:** `feat/short-01-original-engine-fidelity`
- **Machine-Readable Test Results:** [agent-runs/SHORT-01-20261119-02/TEST_RESULTS.json](agent-runs/SHORT-01-20261119-02/TEST_RESULTS.json)
- **Measured Render & QA Metrics:** [agent-runs/SHORT-01-20261119-02/RENDER_METRICS.json](agent-runs/SHORT-01-20261119-02/RENDER_METRICS.json)

---

## Release Gate Matrix (G01–G20)

| Gate | Requirement | Status | Evidence & Honest Limitation |
| :--- | :--- | :---: | :--- |
| **G01** | Target repository/branch/remote correctly identified | **PASS** | Verified via `git ls-remote` & GitHub API: `quocan050302/Skill-Stick-Animation` (PUBLIC, `default_branch=master`). |
| **G02** | Bootstrap `master` created or safely reused | **PASS** | Root commit `f1428c7465f0fba75923892d76025cce6d3a3626` verified on `origin/master`. |
| **G03** | Input archives present and integrity checked | **PASS** | `python tools/setup/audit_kit.py` (exit 0) verified `cartoon-short-kit.zip` (`444,936` bytes, 19 entries, 0 corrupt CRCs/traversals/symlinks/duplicates/bombs) and `SKILL.md` (`14,934` bytes). |
| **G04** | Source inventory + SHA-256 verified | **PASS** | 14/14 original kit files preserved byte-for-byte in local `vendor/cartoon-short-kit/` (`all_hashes_match: true`, recorded in `docs/SOURCE_FIDELITY_MANIFEST.json`). |
| **G05** | Third-party licensing and public redistribution rights resolved | **BLOCKED** | Target remote is **PUBLIC**, and `cartoon-short-kit.zip` has `license_files_found: []`. Per Section 2.I, copied kit files (`vendor/cartoon-short-kit/`, `engine/web/`, `vendor/upstream/`) remain strictly local-only in `.gitignore` and are NOT pushed publicly. MIT notices for `three@0.160.0` and `mromidev/claude-animated-shorts` are preserved in `vendor/licenses/`. |
| **G06** | Dependencies installed/pinned | **PASS** | `three@0.160.0` (MIT, rev 160), `playwright@1.65.1` (Apache-2.0, Chromium `159.0.8154.6`), `mromidev/claude-animated-shorts` commit `e3b817b6` (`toon.ts` MIT), Node `v26.13.1` (`mode: 'strip'` fix), Python `3.12.10` (`numpy`/`PIL`/`scipy`/`soundfile`), FFmpeg/FFprobe `9.0.2`. Locked in `package-lock.json` & `vendor/upstream-deps-lock.json`. |
| **G07** | Chromium starts and WebGL is genuinely working | **PASS** | Chromium `159.0.8154.6` (`swiftshader-webgl`, `WebGL 2.0`), `1080x1920`, `0` console/page/GL errors in both smoke and original engine runs. |
| **G08** | Original Soldier frame 0 renders from source | **PASS** | Unmodified `engine/web/*` rendered `frame_000000.jpg` (`279,522` bytes, SHA-256 `2654857f...`, `0` errors); matched Tile 0 backtest vs `example/soldier/stills.jpg`: `MAE=12.619/255`, `histogram_correlation=0.9785`. |
| **G09** | Multiple original shots/frames render | **PASS** | 15 key stills spanning all 8 shots (`0..591`, `out/reference-contact-sheet.jpg`) + 180 continuous frames (`0..179`, `out/soldier-reference-preview.mp4`, `6.00s`, `0` console/page errors). |
| **G10** | Ink, DOF, shadow, actor cards visually checked | **PASS** | Visually inspected `out/reference-contact-sheet.jpg`, `soldier-debug-edge/frame_000000.jpg`, and `soldier-debug-nd/frame_000000.jpg`: verified 2D bean-head plum-outlined cards (`rgb 0` mask in ND pass, excluded from world ink), crisp world ink outlines, shadows, DOF rack focus (`f=175→215`), and readable non-mirrored `"THE BRIDGE IS NOT SAFE"` helmet interior. |
| **G11** | Determinism/regression checked | **PASS** | Soldier Frame 0 repeat SHA-256 bit-identical (`2654857f...` === `2654857f...`); `tests/regression/test_original_engine_parity.py` (3/3 PASS) confirmed 14/14 preserved SHA-256 unchanged, Tile 0 backtest pass, and audio divergence documented. |
| **G12** | Timing tested with available genuine inputs | **UNVERIFIED** *(synthetic cadence & unit tests PASS; no real `voice.mp3` & no Whisper)* | Original `tools/timing.py` ran cleanly on 6.00s synthetic cadence fixture (`silence-align`, 180 frames, 3 phrases, 23 monotonic words) and `test_timing_contract.py` passed 4/4; real human voiceover alignment remains `UNVERIFIED`. |
| **G13** | Audio mix verified against applicable chosen contract | **UNVERIFIED** *(both Config A & Config B measured on real stems + voice proxy; no real narration)* | Config A (`example/soldier/audio.py`) measured dynamic ducking + `tanh` saturation (`peak=0.999969`); Config B (NEW `tools/audio/mix.py`) measured exact `-6.0206 dB` (`0.500` ratio) linear gated-RMS lock, zero ducking, zero clipping on exact Soldier stems. Real narrated voiceover parity remains `UNVERIFIED`. |
| **G14** | FFmpeg MP4 tested and verified by FFprobe | **PASS** *(visual + music/SFX AAC verified; explicitly labeled no-voiceover)* | `out/soldier-reference-preview.mp4` (6.00s, `5.91 MB`) & `out/new-zombie-10s-preview.mp4` (10.00s, `10.33 MB`) both passed FFprobe: `h264`, `1080x1920`, `30.0 fps`, strict TV-range `yuv420p`, `aac`, `+faststart` (`moov`-first), `0` null-decode errors, `0` `freezedetect`/`blackdetect` hits. |
| **G15** | New original 10-second 9:16 proof tested | **PASS** | Freshly authored Convenience Store Cartoon Zombie (`engine/demos/zombie-10s/`): exact `300` frames (`10.00s @ 30fps`, `1080x1920`), visually verified across `out/new-zombie-contact-sheet.jpg` (frame 0 hook, readable non-mirrored signs, 4 shots, expression progression, basket-bump cause/effect + falling `"MEGA CHIPS"` payoff), `mean_mad=16.3077`, `0` frozen pairs, `0` console/page errors. |
| **G16** | Async tests settled with evidence | **PASS** | `python tests/run_all.py` (exit 0): **9/9 suites PASS** (36 test cases + 1 env preflight, `0` fail, `0` skip, bounded Stage 1 concurrency `3` / Stage 2 `1`, `9.20s`). |
| **G17** | Disk/cancellation/resume safety tested | **PASS** | Verified low-watermark `DiskSpaceError`, `RENDER_CANCELED` abort, hash+dimension RESUME skip + corrupt-frame re-render, atomic writes, and raw-path traversal `403`. |
| **G18** | No modification to `Skill-B6`/old repository | **PASS** | `git -C D:\Project_github\Agent-Skill status --short --branch` clean (`master...origin/master`, HEAD `6b1c42c`). |
| **G19** | Diff/security/publication review completed | **PASS** | Pre-push review confirmed zero secrets, zero generated frames/MP4s, zero unlicensed copied kit sources staged (`vendor/cartoon-short-kit/` & `engine/web/` ignored). |
| **G20** | Implementation feature branch commit and push verified on remote | **PASS (publishable scope)** | Pushed to `origin/feat/short-01-original-engine-fidelity` and verified via `git ls-remote --heads origin` (SHA recorded in final summary). |

---

## Executed Test Suite Breakdown (`python tests/run_all.py`)
- **Unit + Negative (Python):** 21 tests across 4 suites (`test_audit_kit.py`: 8, `test_safe_path_and_disk.py`: 5, `test_timing_contract.py`: 4, `test_audio_mix.py`: 4) — **21 PASS**
- **Unit + Negative (Node `node --test`):** 9 tests across 2 suites (`test_contract_and_adapter.mjs`: 7, `test_original_kit_modules.mjs`: 2) — **9 PASS**
- **Environment Preflight:** 1 suite (`safe_setup.mjs`, `original_engine_files.status: "READY"`, `local_tooling_ready: true`) — **1 PASS**
- **Regression + Backtest (Python):** 3 tests (`test_original_engine_parity.py`: 14/14 byte integrity, Tile 0 backtest `MAE=12.619` / `corr=0.9785`, audio divergence) — **3 PASS**
- **Integration + Negative (Playwright WebGL2 + Pillow + FFmpeg/FFprobe):** 3 tests (`test_webgl_and_ffmpeg.py`) — **3 PASS**
- **Total:** **9/9 suites, 37/37 checks PASS, 0 FAIL, 0 SKIP (`9,196.6 ms`)**
