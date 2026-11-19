# Run `SHORT-01-20261119-02` — QA Report

See full gate matrix in [../../QA_REPORT.md](../../QA_REPORT.md), raw subprocess results in [TEST_RESULTS.json](TEST_RESULTS.json), and complete render/FFprobe/backtest metrics in [RENDER_METRICS.json](RENDER_METRICS.json).

## Key Verified Results
- **Async DAG Suite (`python tests/run_all.py`):** **9/9 suites PASS** (`36` test cases + `1` env preflight, `0` fail, `0` skip, `9,196.6 ms`).
- **Original Soldier Baseline:**
  - 15 key stills (`0..591`, `out/reference-contact-sheet.jpg`, `458,800` bytes) — `0` console/page errors, Frame 0 repeat SHA-256 bit-identical (`2654857f...`), backtest vs `example/soldier/stills.jpg` Tile 0: `MAE=12.619/255`, `histogram_correlation=0.9785`.
  - 180-frame continuous preview (`out/soldier-reference-preview.mp4`, `6.00s`, `5,909,591` bytes, `173.7s` on 2 workers = `965.2 ms/frame`) — FFprobe `h264`, `1080x1920`, `30.0 fps`, `yuv420p`, `aac`, `+faststart`, `0` decode errors, `0` freeze/black hits, `mean_mad=10.0266`.
- **New Original 10-Second Convenience Store Zombie Proof:**
  - 300 continuous frames (`out/new-zombie-10s-preview.mp4`, `10.00s`, `10,329,436` bytes, `263.8s` on 2 workers = `879.4 ms/frame`) + `out/new-zombie-contact-sheet.jpg` (`421,564` bytes) — FFprobe `h264`, `1080x1920`, `30.0 fps`, `yuv420p`, `aac`, `+faststart`, `0` decode errors, `0` freeze/black hits, `mean_mad=16.3077`, `max_consecutive_frozen_pairs=0`.
- **Audio & Timing:** Config A (`example/soldier/audio.py`) vs Config B (`tools/audio/mix.py`, exact `-6.0206 dB` / `0.500` ratio, no ducking) measured objectively; `tools/timing.py` verified on 6.00s synthetic cadence fixture; real human narration honestly marked `UNVERIFIED`.
- **G05 Public Push Guard:** Zero unlicensed kit files staged or pushed to the public repository.
