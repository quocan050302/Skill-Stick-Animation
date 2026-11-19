# Run `SHORT-01-20261119-01` — QA Report

See canonical gate matrix and test counts in [../../QA_REPORT.md](../../QA_REPORT.md), raw subprocess results in [TEST_RESULTS.json](TEST_RESULTS.json), and measured WebGL2 smoke outputs in [RENDER_METRICS.json](RENDER_METRICS.json).

## Verified Evidence Summary
- **Bounded Async Test Suite (`python tests/run_all.py`):** `7/7` suites PASS (`31` test cases + `1` environment check, `0` failed, `0` skipped, `10,326.7 ms` total).
- **WebGL2 Technical Smoke (G07):** Chromium `159.0.8154.6` (`swiftshader-webgl`), `WebGL 2.0`, `three@0.160.0` (rev `160`), `1080x1920`, `15` frames rendered in `4,523 ms`, repeat-frame-0 SHA-256 deterministic (`fcf20224276b0613c2a8a4f75965cd95152727262f7facf18436bebac98b7ef3`), Pillow frame-0 QA `mean_luma=139.189` / `std_luma=39.559`, sequence motion `mean_mad=6.7068` (`0` frozen frames), `0` console/page/GL errors.
- **FFmpeg / FFprobe Technical Export:** Both silent and synthetic-AAC-muxed H.264 `1080x1920` `30fps` `yuv420p` `+faststart` (`moov` before `mdat`) passed FFprobe + `ffmpeg -v error -f null -` decode verification.
- **Audio Mixer (`tools/audio/mix.py`):** Measured music-to-narration gated-RMS ratio `0.500` (`-6.02 dB`), zero dynamic ducking, peak caps enforced, zero NaN/Inf/clipping.
- **Old Repo Safety (G18):** `D:\Project_github\Agent-Skill` (`Skill-B6`) untouched (`master...origin/master`, `6b1c42c`).
- **Explicitly Blocked / Unverified:** Original kit byte parity (G03–G04), public licensing (G05), `toon.ts` (G06 partial), Soldier renders & regression (G08–G11, G14 prod), real voiceover timing/narration (G12–G13), and 10-second zombie proof on original engine (G15).
