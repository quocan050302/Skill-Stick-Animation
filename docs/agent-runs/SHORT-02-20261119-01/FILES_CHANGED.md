# Files Changed Manifest (`feat/short-02-compact-dark-studio`)

## Root & Tooling
- `package.json`, `package-lock.json` — Added FE toolchain (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`) and scripts (`dev`, `build`, `start`, `typecheck`, `test`, `test:integration`, `test:e2e`, `verify:all`), preserving all SHORT-01 scripts.
- `.gitignore` — Added `workspace/projects/` and `app/frontend/dist/` to protect volatile user media, renders, and built bundles.
- `tools/dev.mjs` — Unified `--mode dev` (BE + Vite proxy + Ctrl+C process-tree teardown) and `--mode start` (built static FE + API single origin).
- `tools/audio/template_audio.py` — 48kHz stereo music + SFX stem synthesizer supporting `zombie-store-10s`, `plaza-courier-10s`, and generic beds.
- `tools/render/render_original.mjs`, `tools/render/render_parallel.mjs` — Added `--overrides-file` parameter support.

## Engine & Starter Templates
- `engine/adapters/renderer_adapter.mjs` — Mounted `/toonbase`, injected `projectInput.overrides`, and added warm `setOverrides` method.
- `engine/demos/lib/toonbase.js` — Portable MIT-licensed 2D character library from `vendor/upstream/claude-animated-shorts/toon.ts`.
- `engine/demos/zombie-10s/{cast_zombie.js,story_zombie.js,main_zombie.js}` — Added safe override support (`setStudioOverrides`) preserving bit-exact default frame 0 (`sha256: c7bb6937...`).
- `engine/demos/plaza-courier-10s/{index.html,paint_plaza.js,cast_plaza.js,story_plaza.js,main_plaza.js}` — New 10-second (300-frame, 9:16) editable template.

## Backend (`app/shared/` & `app/server/`)
- `app/shared/project_schema.mjs` — Template definitions, capabilities, `validateCreateProject`, `validateProjectPatch`, `REVISION_CONFLICT`, `deriveFrameCount`, `buildEngineOverrides`, `computeRenderHash`.
- `app/server/api_server.mjs` — Refactored & extended loopback API server, security headers, static serving, HTTP `Range` MP4 streaming.
- `app/server/services/{project_store.mjs,media_store.mjs,preview_manager.mjs,job_manager.mjs,qa_service.mjs}` — Modular stores, warm preview LRU/coalescing, persistent render job pipeline, QA verifier.

## Frontend (`app/frontend/`)
- `app/frontend/{index.html,tsconfig.json,vite.config.ts}`
- `app/frontend/src/{main.tsx,App.tsx,types.ts,vite-env.d.ts}`
- `app/frontend/src/api/client.ts`
- `app/frontend/src/styles/{tokens.css,app.css}`
- `app/frontend/src/components/{EngineStatus.tsx,ProjectsPage.tsx,ProjectHeader.tsx,ShortPreview.tsx,ShotList.tsx,ShotInspector.tsx,RenderDialog.tsx,JobDrawer.tsx}`

## Tests & Documentation
- `tests/unit/test_short02_backend.mjs`
- `tests/integration/test_short02_api.mjs`
- `tests/e2e/test_studio_e2e.mjs`
- `tests/verify_all.py`
- `README.md`, `docs/ENGINE_API_CONTRACT.md`
- `docs/agent-runs/SHORT-02-20261119-01/*` (12 report files + screenshots + 9-tile demo contact sheet)
