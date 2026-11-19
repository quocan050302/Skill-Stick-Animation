# Engine API Contract (SHORT-01 → SHORT-02 Studio UI)

This document defines the authoritative contract between the real 9:16 Three.js short rendering engine (`SHORT-01`) and the future **Cartoon Short Studio** UI (`SHORT-02`).

> [!IMPORTANT]
> **Hard Scope Lock:** Only **1080×1920 portrait (9:16), 30 FPS** rendering via the Three.js 2D-character + 3D-world pipeline is permitted. Long Renderer 2D Skia, ReachMora, 16:9 editing mode, Remotion/MoviePy slideshows, and AI video generation APIs are explicitly prohibited and rejected by `app/shared/contract.mjs`.

---

## 1. Core Adapter Interface (`engine/adapters/renderer_adapter.mjs`)

Implemented in **NEW CODE** as a thin adapter over the browser WebGL engine:

| Method | Signature | Behavior & Guarantees |
| :--- | :--- | :--- |
| `initializeRenderer` | `(projectSpec) => Promise<RenderMetadata>` | Validates 1080×1920 30fps contract, checks `node_modules/three` & required `engine/web/*` files (throws `EngineInputBlockedError` when kit missing), starts `127.0.0.1` loopback server, launches Chromium, waits for `window.ready === true && typeof window.renderFrame === 'function'`, probes canvas dimensions and WebGL2 capabilities. |
| `renderFrame` | `(frameIndex, opts?) => Promise<FrameResult>` | Calls `window.renderFrame(frameIndex)`, asserts zero `pageerror` and `gl.NO_ERROR`, captures canvas PNG/JPEG, validates image header dimensions (`1080x1920`), returns `{ frameIndex, width, height, bytes, sha256, format, buffer }`. |
| `renderFrameRange` | `(startFrame, endFrame, opts?) => Promise<RangeResult>` | Validates integer bounds, runs disk-space preflight low-watermark check, renders zero-based canonical frames `frame_000000.png`, writes atomically via sibling `.tmp` + rename, supports hash+dimension-validated `resume: true`, finite transient retries, and `AbortSignal` cancellation. |
| `renderStill` | `(frameIndex, outPath, opts?) => Promise<StillResult>` | Renders a single frame and atomically writes to `outPath` after disk preflight. |
| `getRenderMetadata` | `() => RenderMetadata` | Returns live WebGL vendor/renderer, Three.js revision, browser version, console/page error counts, or honest `originalEngineStatus` if uninitialized. |
| `disposeRenderer` | `() => Promise<void>` | Tears down page, browser context, Chromium process, loopback server, and removes `SIGINT`/`SIGTERM` handlers cleanly. |

---

## 2. Local Verification HTTP API (`app/server/api_server.mjs`)

Strictly bound to `127.0.0.1` (never `0.0.0.0`, no remote unauthenticated execution, never runs arbitrary user Python/shell scripts):

- `GET /api/health` — Returns service health and `originalEngine.ready` (`false` while kit files are absent).
- `GET /api/contract` — Returns `RENDER_CONTRACT` constants and current engine readiness.
- `POST /api/render/frame` — Validates request JSON via `validateProjectSpec`, returns `409 INPUT_BLOCKED` for `mode: "original_engine"` while kit files are absent, `400` on 16:9 / prohibited engines, or `200` with real frame metadata for explicit `mode: "technical_webgl_smoke"`.

---

## 3. Domain Capabilities: Original JS vs New Adapter/Schema Required

| Domain | Status in Original Kit JS | Required for SHORT-02 UI |
| :--- | :--- | :--- |
| **Projects** | *Unverified (`INPUT_BLOCKED`)* — Soldier example is a single `story.js` file, not a multi-project store. | New project registry schema under `workspace/projects/<id>/project.json`. |
| **Story / Shots** | *Unverified (`INPUT_BLOCKED`)* — `example/soldier/story.js` uses JS code (`SHOTS`, `shotAt`, etc.), not a generic JSON scene schema. | Adapter layer to map validated JSON shot descriptors to JS story module without executing arbitrary untrusted JS/Python. |
| **Voiceover & Timing** | *Unverified (`INPUT_BLOCKED`)* — `tools/timing.py` absent; ASR Whisper not installed. | Upload/select WAV + validated `timing_contract.py` + optional ASR integration. |
| **Characters / Expressions / Poses** | *Unverified (`INPUT_BLOCKED`)* — `engine/roman.js` + `toon.ts` pending ingestion. | Read-only catalog exposed from audited `OUTFITS`/pose/expression symbols once ingested. |
| **Camera / 3D World / Lighting / DOF** | *Unverified (`INPUT_BLOCKED`)* — `engine/main.js` & `engine/motion.js` pending ingestion. | Structured parameter inspection & keyframe editing validated against finite bounds. |
| **Frame Preview & Render Jobs** | **Adapter implemented** (`renderer_adapter.mjs`, `frame_runner.mjs`, `api_server.mjs`). | Job queue persistence, progress streaming (SSE/WebSocket on `127.0.0.1`), cancel/resume UI controls. |
| **Audio Mix** | **New SKILL-spec mixer implemented** (`tools/audio/mix.py`, linear -6.02 dB gated-RMS, no ducking). Original `audio.py` pending ingestion. | Mode selector between original kit baseline and SKILL-spec linear mixer once `audio.py` is audited. |
| **QA & Export** | **Implemented** (`tools/qa/verify_media.py`, `tools/qa/export_mp4.py`). | Contact-sheet preview (`sheet.py` pending kit audit) + FFprobe/motion QA summary panel. |

> [!CAUTION]
> Arbitrary JSON scene editing is **NOT** yet implemented or claimed complete. SHORT-02 must only expose controls backed by audited, validated runtime adapters.
