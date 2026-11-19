# Regression Report (`SHORT-01` Compatibility & Baseline Parity)

1. **`SHORT-01` Master Suite (`python tests/run_all.py`):**
   - Executed clean inside `npm run verify:all`: **9/9 test suites PASSED** (`0` failed, `0` blocked, `9.49s` total), including `unit_audit_kit`, `unit_safe_path_disk`, `unit_timing_contract`, `unit_node_contract_adapter`, `unit_audio_mix_mixer`, `regression_soldier_and_audio_parity`, and `integration_webgl_and_ffmpeg`.
2. **Existing `zombie-10s` Demo Invariance:**
   - Added safe `window.setStudioOverrides` parameter support (`cast_zombie.js`, `story_zombie.js`, `main_zombie.js`) while preserving `default` / unset paths 100% untouched.
   - Verified post-edit baseline render (`node tools/render/render_original.mjs --web-dir engine/demos/zombie-10s --frames "0" --format jpeg --quality 94`):
     - `frame_000000.jpg`: `211,798` bytes, SHA-256 `C7BB6937F16F5AD058A4A65D25C199C57E109F88C965BC61F0CA262FFA54AF98` — **exact match** to SHORT-01 baseline.
3. **Existing Scripts & Adapter Contract Preserved:**
   - Legacy `POST /api/render/frame`, `GET /api/contract`, and `GET /api/health` (`originalEngine.ready` field) remain backward-compatible and pass `tests/unit/test_contract_and_adapter.mjs`.
   - `npm run setup:verify`, `npm run setup:restore`, `npm run audit:kit`, `npm run smoke:webgl`, `npm run render:original`, `npm run render:parallel`, `npm run test:node`, `npm run test:all`, and `npm run serve:api` all remain intact in `package.json`.
