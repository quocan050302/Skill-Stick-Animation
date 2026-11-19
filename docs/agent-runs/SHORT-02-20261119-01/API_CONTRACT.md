# SHORT-02 HTTP & SSE API Contract

**Binding:** Strictly `127.0.0.1` (`PORT`/`API_PORT` configurable; defaults `8787` API, `5173` FE).  
**Security Guards:**
- Rejects non-loopback `Host` (`403 HOST_NOT_ALLOWED`) and non-loopback `Origin` (`403 ORIGIN_NOT_ALLOWED`).
- Sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and Content-Security-Policy on static HTML.
- Enforces `workspace/projects/<projectId>/` and `workspace/jobs/<jobId>.json` canonical confinement.
- Never executes user-provided JavaScript/Python expressions; only declarative schema keys validated by `app/shared/project_schema.mjs`.

## Endpoints Summary

| Method | Path | Purpose | Error / Status Guarantees |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Tool readiness & original kit status | `200`; `originalEngine.ready`, `tools`, `allToolsReady` |
| `GET` | `/api/contract` | Render invariants | `200`; `1080×1920`, `9:16`, `30fps`, forbidden engines |
| `GET` | `/api/templates` | Template catalog & capabilities | `200`; marks `soldier-original` unavailable if kit missing |
| `GET` | `/api/projects` | List persistent projects | `200` |
| `POST` | `/api/projects` | Create project from template | `201`, or `409 INPUT_BLOCKED` / `400 INVALID_PROJECT` |
| `GET` | `/api/projects/:id` | Read project JSON + timing + renderHash | `200` or `404 PROJECT_NOT_FOUND` |
| `PATCH` | `/api/projects/:id` | Update title, script, scene/shot overrides | `200` or `409 REVISION_CONFLICT` |
| `DELETE` | `/api/projects/:id` | Delete project directory cleanly | `200` (`confirmProjectId` required) |
| `POST` | `/api/projects/:id/assets/voiceover` | Upload `.wav`/`.mp3`/`.m4a` (`<=32MB`) | `200` + `ffprobe` metadata; `400 MEDIA_INVALID` / `413` |
| `DELETE` | `/api/projects/:id/assets/voiceover` | Remove attached voiceover | `200` |
| `GET` | `/api/projects/:id/preview/frame?f=<n>` | Warm Three.js JPEG frame (`1080×1920`) | `200` binary JPEG / `304 ETag` / `409 PREVIEW_SUPERSEDED` |
| `POST/DELETE` | `/api/projects/:id/preview/session` | Warm or dispose Chromium session | `200` / `409 INPUT_BLOCKED` |
| `POST` | `/api/projects/:id/jobs` | Enqueue `full` or `bounded` MP4 job | `202` or `409 TIMING_DURATION_MISMATCH` / `JOB_ALREADY_RUNNING` / `507 DISK_FULL` |
| `GET` | `/api/projects/:id/jobs` | List project render jobs | `200` |
| `GET` | `/api/jobs/:jobId` | Poll job status | `200` or `404 JOB_NOT_FOUND` |
| `GET` | `/api/jobs/:jobId/events` | SSE `snapshot/progress/completed/failed/canceled` | `200 text/event-stream` |
| `POST` | `/api/jobs/:jobId/cancel` | Cancel & kill worker process tree | `200` (`canceling` -> `canceled`) |
| `GET` | `/api/projects/:id/exports/:exportId/file` | Stream exported MP4 (`Range` / `?download=1`) | `200` / `206 Partial Content` / `404` |
| `GET` | `/api/projects/:id/exports/:exportId/qa` | Fetch persisted `qa.json` gates | `200` / `404 QA_NOT_FOUND` |
| `POST` | `/api/render/frame` | SHORT-01 backward-compatible frame check | `200` / `400` / `409 INPUT_BLOCKED` |
