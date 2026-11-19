# Engine API Contract (SHORT-01 → SHORT-02 Studio UI)

This document defines the authoritative contract between the real 9:16 Three.js short rendering engine (`SHORT-01`) and the future **Cartoon Short Studio** UI (`SHORT-02`).

> [!IMPORTANT]
> **Hard Scope Lock:** Only **1080×1920 portrait (9:16), 30 FPS** rendering via the Three.js 2D-character + 3D-world pipeline is permitted. Long Renderer 2D Skia, ReachMora, 16:9 editing mode, Remotion/MoviePy slideshows, and AI video generation APIs are explicitly prohibited and rejected by `app/shared/contract.mjs`.

---

## 1. Core Adapter Interface (`engine/adapters/renderer_adapter.mjs`)

Implemented in **NEW CODE** as a thin adapter over the real browser Three.js engine (`window.renderFrame(f)` & `window.ready`):

| Method | Signature | Behavior & Guarantees |
| :--- | :--- | :--- |
| `initializeRenderer` | `(projectSpec) => Promise<RenderMetadata>` | Validates 1080×1920 30fps contract, verifies `node_modules/three` & `engine/web/*` (or custom `webDir` fixture), starts loopback `127.0.0.1` server, launches Playwright Chromium (`swiftshader-webgl`), waits for `window.ready === true && typeof window.renderFrame === 'function'`, verifies 1080×1920 canvas. |
| `renderFrame` | `(frameIndex, opts?) => Promise<FrameResult>` | Invokes `window.renderFrame(frameIndex)` (supporting optional `debugMode: 'edge' \| 'nd'`), asserts zero `pageerror`, captures via `canvas.toDataURL` or screenshot, validates image header dimensions (`1080x1920`), returns `{ frameIndex, width, height, bytes, sha256, format, buffer }`. |
| `renderFrameRange` | `(startFrame, endFrame, opts?) => Promise<RangeResult>` | Validates integer bounds, enforces disk-space low-watermark preflight, writes canonical `frame_000000.jpg/png` atomically, supports hash+dimension-validated `resume: true`, finite transient retries, and `AbortSignal` cancellation. |
| `renderStill` | `(frameIndex, outPath, opts?) => Promise<StillResult>` | Renders a single frame and atomically writes to `outPath`. |
| `getRenderMetadata` | `() => RenderMetadata` | Returns browser version, launch profile, loopback URL, canvas dimensions, `totalFrames`, and console/page error counts. |
| `disposeRenderer` | `() => Promise<void>` | Cleanly closes page, context, Chromium, loopback server, and signal handlers. |

---

## 2. Local Verification HTTP API (`app/server/api_server.mjs`)

Strictly bound to `127.0.0.1` (no `0.0.0.0`, no arbitrary user script/shell execution):
- `GET /api/health` — Returns service status & `originalEngine.ready`.
- `GET /api/contract` — Returns `RENDER_CONTRACT` (1080×1920, 30fps, 9:16).
- `POST /api/render/frame` — Validates contract, returns `409 INPUT_BLOCKED` if original kit absent, `400` on 16:9 or prohibited engine, or `200` with verified frame metadata & SHA-256.

---

## 3. Domain Capabilities: Audited Original JS vs SHORT-02 Adapter/Schema Required

| Domain | Actually Represented in Original Kit JS (Audited) | Required New Adapter / Schema for SHORT-02 UI |
| :--- | :--- | :--- |
| **Projects** | Single `web/story.js` + `audio.py` directory per short (no multi-project registry). | Validated `workspace/projects/<id>/project.json` registry & asset confinement. |
| **Story / Shots** | Pure JS functions in `story.js`: `SHOTS`, `shotAt`, `camAt`, `dofAt`, `lightFor`, `worldAt`, `actorsAt`, `fxAt`. | Declarative JSON shot-list schema compiled into validated story parameters (never eval arbitrary untrusted JS/Python). |
| **Voiceover & Timing** | `tools/timing.py`: `duration`, `speech_segments`, `whisper_words`, `align` → `words.json` & `phrases.json`. | WAV/MP3 import, optional local Whisper setup, interactive phrase boundary review before locking `TOTAL = round(duration * 30)`. |
| **Characters / Expressions / Poses** | `engine/roman.js` + MIT `toonbase.js`: `OUTFITS` (8 presets), 14 arm poses (`hang`, `spear`, `point`, `up`, `wave`, `hip`, `belly`, `temple`, `lift`, `reach`, `cheek`, `shield`, `cross`, `thumb`), `FACE` expressions + `snore`/`stubborn`/`squint`, `headCenter`. | Cast catalog metadata JSON exposing available outfits, poses, expressions, and custom cast modules (as proven by `engine/demos/zombie-10s/cast_zombie.js`). |
| **Camera / 3D World / Lighting / DOF** | `engine/motion.js` (`camFromKeys`, `spline`, `M.*`, `idle`, `blinkAt`, `walk`, `q`), `LIGHTS` presets (`day`, `golden`), `dofAt` (`focus`, `cinf`, `near`), `main.js` 3D world & postprocess. | Structured preset picker & keyframe curve editor validated against finite numeric bounds; world-builder templates separated cleanly from core ink/DOF postprocess. |
| **Frame Preview & Render Jobs** | **Implemented in SHORT-01:** `renderer_adapter.mjs`, `render_original.mjs`, `render_parallel.mjs` (bounded 2-worker), `frame_runner.mjs` (atomic, RESUME, disk preflight, cancel). | Persistent job queue under `workspace/jobs/`, live progress stream over `127.0.0.1`, frame scrubber & contact-sheet preview viewer. |
| **Audio Mix** | Original `example/soldier/audio.py` (dynamic ducking + `tanh`) vs **NEW** `tools/audio/mix.py` (SKILL-spec linear `-6.02 dB` gated-RMS, zero ducking). | UI selector between `skill_linear_minus6db` (default) and `original_kit_baseline`, displaying measured gated-RMS & peak headroom. |
| **QA & Export** | **Implemented in SHORT-01:** `tools/qa/export_mp4.py` (strict `yuv420p` H.264/AAC `+faststart`), `verify_media.py` (Pillow + FFprobe + null decode + motion MAD), `contact_sheet.py`. | One-click QA summary panel surfacing FFprobe checks, `freezedetect`/`blackdetect`, and contact-sheet inspection. |

> [!NOTE]
> Arbitrary no-code 3D scene editing via JSON is **not** implemented in SHORT-01; SHORT-02 will introduce validated scene templates on top of the audited adapters above.
