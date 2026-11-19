# Run `SHORT-01-20261119-01` — Files Changed

All files below are **NEW IMPLEMENTATION** (independently authored for SHORT-01) or updates to the bootstrap `README.md`. Zero original third-party kit files were copied or committed (`INPUT_BLOCKED` & `G05 BLOCKED`).

| Path | Action | Provenance | Purpose |
| :--- | :---: | :---: | :--- |
| `README.md` | Modified | NEW | Reproducible Windows/bash commands and honest status |
| `.gitignore` | Added | NEW | Excludes `node_modules/`, `_inputs/`, `vendor/cartoon-short-kit/`, frames, MP4s, caches, `.env` |
| `.env.example` | Added | NEW | Loopback host, disk watermark, timeout/concurrency defaults |
| `package.json` | Added | NEW | Pinned `three@0.160.0` & `playwright@1.65.1` + verified scripts |
| `package-lock.json` | Added | GENERATED | Deterministic npm lockfile for `three@0.160.0` & `playwright@1.65.1` |
| `vendor/README.md` | Added | NEW | Third-party license notices & G05 public repo governance |
| `vendor/source-manifest.json` | Added | GENERATED | Machine-readable kit manifest (`status: INPUT_BLOCKED`) |
| `app/shared/contract.mjs` | Added | NEW | Strict 9:16 1080×1920 30fps contract & prohibited engine rejection |
| `app/server/api_server.mjs` | Added | NEW | 127.0.0.1-only verification HTTP API preparing SHORT-02 |
| `engine/adapters/renderer_adapter.mjs` | Added | NEW | 6-method Engine Adapter (`initializeRenderer`..`disposeRenderer`) |
| `engine/adapters/smoke_webgl_scene.html` | Added | NEW | Strictly labeled G07 WebGL2 + Three.js 0.160.0 technical smoke scene |
| `tools/setup/safe_path.py` | Added | NEW | Confined paths, `safe_rmtree`, atomic write, disk watermark preflight |
| `tools/setup/audit_kit.py` | Added | NEW | Forensic ZIP integrity/security auditor & SHA-256 byte preserver |
| `tools/setup/safe_setup.mjs` | Added | NEW | Cross-platform dependency & environment verifier |
| `tools/render/server.mjs` | Added | NEW | Loopback `127.0.0.1` HTTP static server with traversal rejection (`403`) |
| `tools/render/frame_runner.mjs` | Added | NEW | Atomic write, disk preflight, hash+dim RESUME, finite retry, signal cleanup |
| `tools/render/webgl_smoke.mjs` | Added | NEW | G07 Chromium WebGL2 1080×1920 smoke & determinism CLI |
| `tools/timing/timing_contract.py` | Added | NEW | Duration-to-frame (`round(d*30)`) & monotonic segment/pause validators |
| `tools/audio/mix.py` | Added | NEW | SKILL-spec linear `-6.02 dB` gated-RMS mixer (no ducking) & QA metrics |
| `tools/qa/export_mp4.py` | Added | NEW | Safe argument-array FFmpeg H.264/yuv420p/+faststart exporter |
| `tools/qa/verify_media.py` | Added | NEW | Pillow frame/motion QA + FFprobe/FFmpeg null-decode MP4 validator |
| `tests/run_all.py` | Added | NEW | Bounded-concurrency async DAG test orchestrator |
| `tests/unit/test_audit_kit.py` | Added | NEW | Unit & negative tests for ZIP auditor & `INPUT_BLOCKED` |
| `tests/unit/test_safe_path_and_disk.py` | Added | NEW | Unit & negative tests for path confinement, atomic writes, disk watermark |
| `tests/unit/test_timing_contract.py` | Added | NEW | Unit & negative tests for timing/frame contracts |
| `tests/unit/test_audio_mix.py` | Added | NEW | Unit, signal & negative tests for linear `-6.02 dB` mixer |
| `tests/unit/test_contract_and_adapter.mjs` | Added | NEW | Node unit & negative tests for contract, loopback server, adapter, API |
| `tests/integration/test_webgl_and_ffmpeg.py` | Added | NEW | Real Playwright WebGL2 + Pillow + motion + cancel/resume + FFmpeg/FFprobe tests |
| `docs/README.md` | Added | NEW | Documentation index |
| `docs/SOURCE_AUDIT.md` | Added | NEW | Phase 0 audit & source-of-truth responsibility map (`INPUT_BLOCKED`) |
| `docs/SOURCE_FIDELITY_MANIFEST.json` | Added | GENERATED | Machine-readable manifest (`status: INPUT_BLOCKED`) |
| `docs/DEPENDENCIES.md` | Added | NEW | Pinned runtime/package versions, licenses, safe setup rules |
| `docs/ARCHITECTURE.md` | Added | NEW | Pipeline call graph & function-level accountability table |
| `docs/ENGINE_PARITY.md` | Added | NEW | Separate A/B/C/D/E parity tracking table |
| `docs/ENGINE_API_CONTRACT.md` | Added | NEW | SHORT-02 Studio UI API contract |
| `docs/QA_REPORT.md` | Added | NEW | Objective QA report & G01–G20 matrix |
| `docs/RELEASE_CHECKLIST.md` | Added | NEW | Release & publication checklist |
| `docs/agent-runs/SHORT-01-20261119-01/*` | Added | NEW | Mandatory immutable per-run evidence directory (9 files) |
