# Phase A Baseline Measurement Report (`SHORT-03A-20261119-01`)

**Base Branch & Verified Commit:** `QA` @ `00c559ba2802e0809d02926df437ccdc584c8086`  
**Work Branch:** `feat/short-03a-universal-visual-foundation`  
**Host Environment:** Windows x64, Node `v26.13.1`, Python `3.12.10` (`numpy`, `PIL`, `scipy`, `soundfile`), Chromium `159.0.8154.6` (`swiftshader-webgl`, `MAX_TEXTURE_SIZE=8192`, `MAX_RENDERBUFFER_SIZE=8192`), FFmpeg/FFprobe `9.0.2`, Local English TTS (`Microsoft David Desktop`, `Microsoft Zira Desktop`), Free Disk `~48,215 MB`.

## 1. Control Stills & Baseline Determinism (1080×1920 @ 30fps)

| Template / Niche | Kit State | Sampled Frames | Mean Render ms/frame (incl. launch) | Repeat Check (`f=0`) SHA-256 Match | Sampled Frame Stats (`luma_mean` / `sat_mean`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `zombie-store-10s` | Ready (`engine/demos/zombie-10s`) | `0, 115, 178, 244` (total `300`) | `1970.3 ms` (`7881 ms / 4`) | **YES** (`c7bb6937f16f5ad058a4a65d25c199c57e109f88c965bc61f0ca262ffa54af98`) | `0.3878..0.6986` / `0.2626..0.4751` |
| `plaza-courier-10s` | Ready (`engine/demos/plaza-courier-10s`) | `0, 112, 185, 270` (total `300`) | `2034.8 ms` (`8139 ms / 4`) | **YES** (`3bd4a3ceca9e9b8402f16aa62228106517dbf86ca0048105d1d5a6c703265c8b`) | `0.3890..0.6382` / `0.2693..0.6334` |
| `soldier-original` | Ready (`engine/web/` restored locally) | `0, 250, 425` (total `592`) | `2659.0 ms` (`7977 ms / 3`) | **YES** (`69df8f6db0af7f57f42026c1453402949294104ce41ed288f88be4ab2be6afcc`) | `0.4006..0.4593` / `0.4684..0.6749` |

## 2. Visual Audit Findings Driving Phase B–D Upgrades
1. **Unlit Character Cards (`MeshBasicMaterial`):** Directly confirmed in `zombie/frame_000178.jpg` (`dramaticBlue` reaction shot) and `plaza/frame_000112.jpg` (`morningSun` cast-shadow lane): characters do not respond to cast scene shadows or directional key gradients, producing a flat sticker effect.
2. **Audio QA Fallback Defect:** `app/server/services/qa_service.mjs::summarizeQAGates` lines 135–140 fall back to `PASS` via `hasAudioTrack` even when `music_measured_ratio` violates `-6 dB` (`0.50 ± 0.02`).
3. **Hardlocked 1080p Contract:** `contract.mjs`, `renderer_adapter.mjs`, `frame_runner.mjs`, `render_original.mjs`, `render_parallel.mjs`, and demo entrypoints hardcode `1080×1920`, lacking verified native `2160×3840` drawing-buffer allocation and resolution-scaled (`scaleFactor = H / 1920`) world ink & DOF taps.

## 3. Side-by-Side A/B Plan & Mode Compatibility
- Add `visualFoundation: 'baseline' | 'enhanced'` preserving `baseline` outputs 1:1 (exact legacy behavior & checksums under `baseline`), while `enhanced` enables `engine/visual/*` (`card_shading`, `camera_director`, `occlusion_guard`, `procedural_materials`, `look_profiles`, `ink_quality`, `depth_of_field`).
- Promote visual improvements only after 1080p A/B stils pass side-by-side clarity/contrast/silhouette checks before running expensive native 4K (`2160×3840`, 600 frames).
