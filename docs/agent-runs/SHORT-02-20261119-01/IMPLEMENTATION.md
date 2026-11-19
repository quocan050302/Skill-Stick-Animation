# SHORT-02 Implementation Summary

## 1. Architecture Overview
- **Frontend (`app/frontend/`):** React 19 + TypeScript 7 + Vite 8 dark Studio application built strictly to the design-restraint rules:
  - Only **2** top-level routes/views (`Dự án` & `Studio`) plus a slim, collapsible bottom `JobDrawer`.
  - Typed REST + `AbortController` binary JPEG fetch client + `EventSource` SSE stream with automatic polling fallback (`src/api/client.ts`).
  - Real monotonic undo stack (`App.tsx`) restoring prior project revisions via `PATCH /api/projects/:id`.
- **Backend (`app/server/` & `app/shared/project_schema.mjs`):**
  - `project_store.mjs`: Atomic JSON registry under `workspace/projects/<projectId>/project.json` with serialized per-project write locks and `REVISION_CONFLICT` guard.
  - `media_store.mjs`: 32 MB bounded voiceover upload validator (`.wav`/`.mp3`/`.m4a`, magic-byte sniffing, HTML/SVG/JS rejection, real `ffprobe` probe, canonical confinement).
  - `preview_manager.mjs`: Warm single-session Playwright+Chromium manager applying data-only `window.setStudioOverrides` on `renderHash` changes without relaunching Chromium, coalescing burst scrub requests (`409 PREVIEW_SUPERSEDED`), and caching 48 JPEG frames (24 MiB / 10 min TTL).
  - `job_manager.mjs`: Bounded queue executing `render_parallel.mjs` + `tools/audio/template_audio.py` + `tools/audio/mix.py` + `tools/qa/export_mp4.py` + `qa_service.mjs`, with live frame-count polling, SSE progress, process-tree cancellation (`taskkill /PID /T /F` on Windows), disk preflight, and startup `interrupted` recovery.
  - `api_server.mjs`: Loopback `127.0.0.1` server enforcing strict Host/Origin headers, security response headers, HTTP byte-range MP4 streaming (`206`), and SPA static asset serving (`staticDir`).
- **Unified Runner (`tools/dev.mjs`):**
  - `npm run dev` spawns both API Server and Vite Dev Server with `/api` proxy, cleanly tearing down Vite process trees and Chromium sessions on `SIGINT`/`SIGTERM`.
  - `npm run build` + `npm run start` compiles TypeScript + Vite bundle and serves frontend + backend from a single loopback origin.
- **Templates (`engine/demos/`):**
  - `engine/demos/lib/toonbase.js`: Portable MIT-licensed 2D character library extracted with license header from `vendor/upstream/claude-animated-shorts/toon.ts`.
  - `engine/demos/zombie-10s/`: Parameterized safely (`signTitle`, `aisleLabel`, `hoodieColor`, `lightingPreset`, per-shot `cameraPreset`, `expression`, `pose`, `dofStrength`) while preserving exact bit-identical baseline output (`frame_000000.jpg` SHA-256 `c7bb6937...`).
  - `engine/demos/plaza-courier-10s/`: Newly authored 10-second (300-frame, 9:16) outdoor plaza courier template with auto-fitting marquee textures, character presets (`courierKid`, `townParent`, `guardCap`), parcel swatches (`coral`, `teal`, `gold`), lighting presets (`morningSun`, `goldenHour`, `nightPlaza`), and per-shot camera/pose/expression controls.
