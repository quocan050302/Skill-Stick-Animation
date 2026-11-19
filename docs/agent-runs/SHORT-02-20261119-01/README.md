# Run Dossier: SHORT-02 (`SHORT-02-20261119-01`)

**Branch:** `feat/short-02-compact-dark-studio` (branched from `feat/short-01-original-engine-fidelity` at `47eb92188c393cc53b049b73b12922889e14c7a1`)  
**Goal:** Deliver **Cartoon Short Studio** — a compact, dark-neutral (`#0E1116`), high-contrast, Vietnamese-first local web Studio UI + loopback HTTP/SSE backend (`127.0.0.1`) wired to the real 9:16 (`1080×1920`, `30 fps`) Three.js 2D-character + 3D-world pipeline.

## Quick Verification
- Master verification (`npm run verify:all`): **PASS** (`overall_ok: true`, all 6 pipeline stages exited 0)
- Full 300-frame UI-authored custom demo export: [RENDER_METRICS.json](./RENDER_METRICS.json) & [demo_plaza_ui_300f_sheet.jpg](./demo_plaza_ui_300f_sheet.jpg)
- Multi-viewport responsive + workflow screenshots: [SCREENSHOTS.md](./SCREENSHOTS.md) & `screenshots/`

## Contents
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — Architecture, warm Chromium preview, bounded job pipeline, unified runner
- [UX_DECISIONS.md](./UX_DECISIONS.md) — Dark tokens, restrained 2-view IA, Vietnamese copy, fixed overlay & contrast fixes
- [API_CONTRACT.md](./API_CONTRACT.md) — Endpoint catalog, status codes, timing/voiceover rules, security model
- [TEST_RESULTS.json](./TEST_RESULTS.json) — Machine-readable suite summary from `npm run verify:all` & node tests
- [QA_REPORT.md](./QA_REPORT.md) — FFprobe, frame completeness, freeze/blackdetect, audio, and human-gate reporting
- [REGRESSION_REPORT.md](./REGRESSION_REPORT.md) — SHORT-01 baseline parity & SHA-256 bit-exact invariance
- [SCREENSHOTS.md](./SCREENSHOTS.md) — Visual verification ledger (`1440×900`, `1280×800`, `1024×768`, `390×844`, `320×720`, missing kit, before/after edit proof)
- [RENDER_METRICS.json](./RENDER_METRICS.json) — Metrics for the UI-authored 300-frame `plaza-courier-10s` custom export
- [BLOCKERS.md](./BLOCKERS.md) — Environment / kit readiness notes & resolved UI/runtime issues
- [FILES_CHANGED.md](./FILES_CHANGED.md) — Complete file manifest and `.gitignore` protections (`G05`)
- [FINAL_STATUS.md](./FINAL_STATUS.md) — Overall acceptance matrix (`F01`–`F20`)
