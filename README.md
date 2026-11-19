# Skill-Stick-Animation (`SHORT-01`)

Independent 2D-character + 3D-world, **9:16 portrait (1080×1920, 30 FPS)** short video rendering project built around a Three.js + Playwright + FFmpeg pipeline.

> [!WARNING]
> **Current Status: PARTIAL COMPLETION (`INPUT_BLOCKED` on Original Kit Source).**
> Local tooling, pinned `three@0.160.0` + `playwright@1.65.1`, real Chromium WebGL2 1080×1920 rendering smoke (G07), forensic ZIP ingestion/preservation tooling, disk/cancellation/resume guardrails (G17), SKILL-spec linear `-6.02 dB` gated-RMS audio mixer (`tools/audio/mix.py`), FFmpeg/FFprobe media verification, and bounded async tests (G16) are implemented and verified.
> Original kit baseline rendering (`G03–G05`, `G08–G15`) remains **BLOCKED** until `cartoon-short-kit.zip` and `Pasted markdown.md` are supplied locally under `_inputs/`.

---

## Repository Layout

- `vendor/` — Third-party license governance & `source-manifest.json` (`vendor/cartoon-short-kit/` is `.gitignored` until G05 licensing is resolved)
- `engine/adapters/` — Target Engine Adapter (`renderer_adapter.mjs`) & WebGL2 technical smoke scene (`smoke_webgl_scene.html`)
- `tools/setup/` — Forensic ZIP auditor (`audit_kit.py`), safe path/disk guards (`safe_path.py`), cross-platform setup verifier (`safe_setup.mjs`)
- `tools/render/` — Loopback `127.0.0.1` server (`server.mjs`), atomic/resume frame runner (`frame_runner.mjs`), G07 WebGL2 smoke CLI (`webgl_smoke.mjs`)
- `tools/timing/` — Duration-to-frame & segment timing validators (`timing_contract.py`)
- `tools/audio/` — **NEW** SKILL-spec linear `-6.02 dB` gated-RMS mixer without dynamic ducking (`mix.py`)
- `tools/qa/` — Pillow image decoder QA + FFprobe/FFmpeg validator (`verify_media.py`) & safe MP4 exporter (`export_mp4.py`)
- `app/shared/` & `app/server/` — Strict 9:16 contract (`contract.mjs`) & loopback verification API (`api_server.mjs`)
- `tests/` — Unit, integration, negative tests & bounded async DAG runner (`run_all.py`)
- `docs/` — Audit, dependencies, architecture, parity, SHORT-02 contract, QA report, and immutable per-run folders (`docs/agent-runs/`)

---

## Reproducible Commands

Only verified, working commands are documented below.

### 1. Install Pinned Dependencies

**Windows (PowerShell):**
```powershell
npm ci
node tools/setup/safe_setup.mjs
```

**macOS / Linux (bash):**
```bash
npm ci
node tools/setup/safe_setup.mjs
```

### 2. Audit & Preserve Original Kit Archive (once supplied locally)

Place `cartoon-short-kit.zip` and `Pasted markdown.md` in `_inputs/`, then run:

**Windows (PowerShell) & bash:**
```bash
python tools/setup/audit_kit.py --preserve --write-manifest
```
*(Returns exit code `2` with `status: "INPUT_BLOCKED"` when inputs are absent.)*

### 3. Run Real Chromium WebGL2 1080×1920 Technical Smoke (G07)

**Windows (PowerShell) & bash:**
```bash
npm run smoke:webgl
```

### 4. Run Full Bounded Async Test Suite (Unit + Integration + Negative)

**Windows (PowerShell) & bash:**
```bash
npm run test:all
```

Or run Node contract/adapter tests standalone:
```bash
npm run test:node
```

### 5. Run Linear -6 dB Gated-RMS Audio Mixer (NEW SKILL-Spec CLI)

```bash
python tools/audio/mix.py --narration <vo.wav> --music <music.wav> --sfx <sfx.wav> --out <mixed.wav>
```

### 6. Verify Any Exported MP4 with FFprobe

**Windows (PowerShell) & bash:**
```bash
ffprobe -v error -print_format json -show_format -show_streams <video.mp4>
```

---

## Documentation

See [docs/README.md](docs/README.md) for the complete index, [docs/QA_REPORT.md](docs/QA_REPORT.md) for the G01–G20 matrix, and [docs/ENGINE_API_CONTRACT.md](docs/ENGINE_API_CONTRACT.md) for the SHORT-02 Studio UI contract.
