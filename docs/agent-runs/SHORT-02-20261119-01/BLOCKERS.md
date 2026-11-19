# Blockers, Risks & Mitigations (`SHORT-02`)

## Active Blockers
- **None for Studio workflow or standalone templates (`zombie-store-10s`, `plaza-courier-10s`).**
- **Conditional Local Input Dependency (`G05`):** The `soldier-original` template requires locally restored `.gitignored` `engine/web/` files from `cartoon-short-kit.zip`. In clean checkouts without the local kit, `GET /api/templates` marks `soldier-original` unavailable (`requiresOriginalKit: true`) and `POST /api/projects` returns HTTP `409 INPUT_BLOCKED` cleanly without blocking the rest of the Studio.

## Resolved Engineering Blockers During Implementation
1. **`toonbase.js` Expression Key Mismatch (`TypeError` reading `'eye'`):** Mapped `smug` cleanly to `smile` and enforced a strict `VALID_TB_EXPR` + `mode`/`wave`/`phase` binding to `TB.bodyFront` in `cast_plaza.js` & `project_schema.mjs`.
2. **`validateFrameRange` Bound Off-by-One (`400 FRAME_RANGE_EXCEEDED`):** Fixed `job_manager.mjs` to pass `project.durationFrames` (total frame count limit) rather than `durationFrames - 1`.
3. **SSE-vs-REST Job Cancellation Race (`canceling` overwriting `canceled`):** Added `mergeMonotonicJob` in `app/frontend/src/App.tsx` so delayed REST snapshots can never downgrade terminal job statuses (`canceled`, `completed`, `failed`, `interrupted`).
4. **Sticky Header `backdrop-filter` Trapping Fixed Modals:** Portaled `EngineStatus` dialog directly to `document.body` via `createPortal`.
5. **Volatile Runtime Leakage (`G05`):** Expanded `.gitignore` with `workspace/projects/` and `app/frontend/dist/` alongside `workspace/jobs/`, `workspace/cache/`, `engine/web/`, `vendor/cartoon-short-kit/`, and `out/`.
