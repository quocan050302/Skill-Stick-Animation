# Run `SHORT-01-20261119-01` — Implementation Record

## Provenance Classification
- **COPIED ORIGINAL:** `0` files (`INPUT_BLOCKED` — `cartoon-short-kit.zip` not present locally).
- **PATCHED ORIGINAL:** `0` files (`INPUT_BLOCKED`).
- **NEW IMPLEMENTATION:** All files committed on `feat/short-01-original-engine-fidelity` are 100% independently authored infrastructure, adapters, QA verifiers, tests, and documentation:
  1. **Safe Setup & Forensic Ingestion (`tools/setup/`):** `safe_path.py`, `audit_kit.py`, `safe_setup.mjs` — replaces hazardous `/tmp` cleanup patterns, audits ZIP traversal/symlinks/duplicates/zip-bombs, verifies SHA-256 byte-for-byte preservation, and checks pinned local runtime dependencies.
  2. **Engine Adapter & WebGL2 Runner (`engine/adapters/`, `tools/render/`):** `renderer_adapter.mjs`, `smoke_webgl_scene.html`, `server.mjs`, `frame_runner.mjs`, `webgl_smoke.mjs` — implements the 6-method SHORT-02 adapter contract, loopback `127.0.0.1` server with raw-path traversal rejection (`403`), atomic writes, disk low-watermark preflight, hash+dimension RESUME validation, finite transient retries, and real G07 Chromium WebGL2 verification.
  3. **Timing, Audio & Media QA (`tools/timing/`, `tools/audio/`, `tools/qa/`):** `timing_contract.py`, `mix.py` (NEW SKILL-spec linear `-6.02 dB` gated-RMS mixer without dynamic ducking), `verify_media.py` (Pillow frame/motion QA + FFprobe/FFmpeg null-decode verifier), `export_mp4.py` (argument-array FFmpeg H.264/yuv420p/+faststart exporter).
  4. **Contract & Local API (`app/shared/`, `app/server/`):** `contract.mjs` (enforces 9:16 1080×1920 30fps; rejects 16:9 / Skia / ReachMora / AI-video) and `api_server.mjs` (127.0.0.1-only verification server returning honest `409 INPUT_BLOCKED` for missing original engine).
  5. **Automated Test Suite (`tests/`):** Unit, integration, negative tests + bounded async DAG runner `tests/run_all.py`.

## Bugs Caught & Fixed During Execution
1. `tools/setup/safe_setup.mjs`: Fixed multiline Python `-c` import-probe snippet so `python.packages` reports exact versions (`numpy 2.5.4`, `PIL 13.0.0`, `scipy 1.18.1`, `soundfile 0.14.0`).
2. `tools/render/server.mjs`: Added raw `req.url` traversal/backslash check prior to `new URL(...)` normalization so direct HTTP requests containing `/../`, `/%2e%2e/`, or `%5c` deterministically return `403 Forbidden`.
