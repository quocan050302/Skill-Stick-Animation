# Skill-Stick-Animation (`SHORT-01`)

Independent 2D-character + 3D-world, **9:16 portrait (1080×1920, 30 FPS)** short video rendering project preserving the original Three.js + Playwright + FFmpeg pipeline architecture.

> [!IMPORTANT]
> **Publication / Licensing Status (G05):** This public repository contains ONLY independently authored scaffolding, safe installers, adapters, QA verifiers, tests, documentation, preserved MIT dependency notices (`three@0.160.0`, `mromidev/claude-animated-shorts`), and our freshly authored 10-second test fixture (`engine/demos/zombie-10s/`).
> Original third-party `cartoon-short-kit.zip` files have no package-level `LICENSE` and are preserved **locally only** under `.gitignored` `vendor/cartoon-short-kit/` and `engine/web/`.

---

## Repository Layout

- `vendor/` — Third-party MIT notices (`vendor/licenses/`), pinned dependency lock (`upstream-deps-lock.json`), and SHA-256 manifest (`source-manifest.json`)
- `engine/adapters/` — 6-method Engine Adapter (`renderer_adapter.mjs`) & WebGL2 smoke scene (`smoke_webgl_scene.html`)
- `engine/demos/zombie-10s/` — Freshly authored 10-second (300-frame, 9:16) convenience-store zombie proof (test fixture only, not niche-locked)
- `tools/setup/` — Forensic ZIP auditor (`audit_kit.py`), safe path/disk guards (`safe_path.py`), cross-platform engine restorer (`install_engine.mjs`), environment verifier (`safe_setup.mjs`)
- `tools/render/` — Loopback `127.0.0.1` server (`server.mjs`), atomic/resume utilities (`frame_runner.mjs`), single & bounded-parallel frame capture CLIs (`render_original.mjs`, `render_parallel.mjs`), G07 smoke (`webgl_smoke.mjs`)
- `tools/timing/` — Timing & frame-count validators (`timing_contract.py`)
- `tools/audio/` — **NEW** SKILL-spec linear `-6.02 dB` gated-RMS mixer (`mix.py`), Soldier Config A vs B auditor (`soldier_audio_audit.py`), zombie demo synth (`zombie_audio.py`)
- `tools/qa/` — Pillow frame/motion QA + FFprobe/FFmpeg validator (`verify_media.py`), strict TV-range `yuv420p` MP4 exporter (`export_mp4.py`), contact-sheet builder (`contact_sheet.py`)
- `app/shared/`, `app/server/`, `app/frontend/` — Cartoon Short Studio (`SHORT-02`) dark React+TypeScript+Vite UI, 9:16 strict contract (`contract.mjs`, `project_schema.mjs`), modular loopback API + SSE job runner (`api_server.mjs`, `services/`)
- `engine/demos/lib/`, `engine/demos/zombie-10s/`, `engine/demos/plaza-courier-10s/` — Portable MIT-licensed toon base + two 10s (300-frame, 9:16) editable 3D studio templates
- `tools/dev.mjs` — Unified FE+BE runner (`npm run dev` starts API + Vite dev proxy; `npm run start` serves built FE + BE on one loopback origin)
- `tests/` — Unit, integration, regression/backtest, negative tests & bounded async DAG runner (`run_all.py`)
- `docs/` — Forensic audit, dependencies, architecture, parity, SHORT-02 contract, QA reports, and immutable per-run logs (`docs/agent-runs/`)

---

## Reproducible Commands

### 1. Install Pinned Dependencies & Verify Local Environment

**Windows (PowerShell) & bash:**
```bash
npm ci
npm run setup:verify
```

### 2. Audit, Preserve, and Restore Original Kit Locally

Place `cartoon-short-kit.zip` and `SKILL.md` locally, then run:

**Windows (PowerShell):**
```powershell
python tools/setup/audit_kit.py --zip "<path>\cartoon-short-kit.zip" --skill-md "<path>\SKILL.md" --preserve --write-manifest
npm run setup:restore
npm run setup:verify
```

**macOS / Linux (bash):**
```bash
python3 tools/setup/audit_kit.py --zip "<path>/cartoon-short-kit.zip" --skill-md "<path>/SKILL.md" --preserve --write-manifest
npm run setup:restore
npm run setup:verify
```

### 3. Render Original Soldier Reference Stills & Contact Sheet

```bash
node tools/render/render_original.mjs --project-id soldier-reference-stills --out-dir workspace/cache/soldier-stills --frames "0,40,80,115,175,215,250,290,335,370,430,470,530,570,591" --format jpeg --quality 95 --repeat-check 0
python tools/qa/contact_sheet.py workspace/cache/soldier-stills out/reference-contact-sheet.jpg --cols 7
```

### 4. Render Full Preview Sequences (Bounded 2-Worker Parallel) & Encode MP4

```bash
# Original Soldier 6-second continuous preview (frames 0..179)
node tools/render/render_parallel.mjs --project-id soldier-reference-preview --out-dir workspace/cache/soldier-preview-frames --start 0 --end 179 --format jpeg --quality 94 --workers 2

# New Original 10-second Zombie Proof (exact 300 frames, 0..299)
node tools/render/render_parallel.mjs --project-id new-zombie-10s --web-dir engine/demos/zombie-10s --out-dir workspace/cache/zombie-10s-frames --start 0 --end 299 --format jpeg --quality 94 --workers 2
```

### 5. Run Linear -6 dB Gated-RMS Audio Mixer (NEW SKILL-Spec CLI)

```bash
python tools/audio/mix.py --narration <vo.wav> --music <music.wav> --sfx <sfx.wav> --out <mixed.wav>
```

### 6. Launch Cartoon Short Studio UI (`SHORT-02` FE + BE Unified)

```bash
# Development mode (starts API on 127.0.0.1:8787 + Vite dev server on 127.0.0.1:5173)
npm run dev

# Build production frontend & serve FE + BE from a single loopback origin
npm run build
npm run start
```

### 7. Run Full Verification Suites

```bash
npm run test:all      # SHORT-01 bounded async regression + integration suite
npm run test          # Node unit + live API integration tests (SHORT-01 + SHORT-02)
npm run test:e2e      # Playwright Studio UI E2E + responsive/a11y audit
npm run verify:all    # Master verification: build + SHORT-01 + SHORT-02 + dev smoke
```

### 8. Verify Exported MP4 with FFprobe

```bash
ffprobe -v error -print_format json -show_format -show_streams out/short02_plaza_ui_demo_10s.mp4
```

---

## Documentation

See [docs/README.md](docs/README.md), [docs/QA_REPORT.md](docs/QA_REPORT.md), [docs/ENGINE_PARITY.md](docs/ENGINE_PARITY.md), [docs/ENGINE_API_CONTRACT.md](docs/ENGINE_API_CONTRACT.md), and the latest run dossier at [docs/agent-runs/SHORT-02-20261119-01/README.md](docs/agent-runs/SHORT-02-20261119-01/README.md).
