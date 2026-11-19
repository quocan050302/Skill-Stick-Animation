# QA Report: UI-Authored 10s Plaza Courier Export (`SHORT-02`)

**Exported Artifact:** `out/short02_plaza_ui_demo_10s.mp4` (`6,958,877` bytes, SHA-256 `428370e574863596847f784287e3d0ff8694826625b17f67dccfd29a4590855a`)  
**Workspace Export:** `workspace/projects/chuyen-giao-hang-hoang-hon-303276/renders/exp_20261119031356_d23e06/output.mp4`  
**Contact Sheet:** [demo_plaza_ui_300f_sheet.jpg](./demo_plaza_ui_300f_sheet.jpg) (`810×1440`, 9 keyframes inspected directly via `read_file`)

## Automated QA Gates (`qa.json` — Overall `PASS`)

| Gate ID | Description | Status | Verified Output |
| :--- | :--- | :--- | :--- |
| `mp4_format` | H.264 1080×1920 @ 30fps, TV-range `yuv420p`, `+faststart` | **PASS** | `h264 1080x1920 @ 30.0 fps (yuv420p), faststart=true, duration=10.0s, decode_stderr=""` |
| `frame_completeness` | Output frame count & non-black first frame check | **PASS** | `300/300` rendered JPEG frames, frame 0 `mean_luma=133.95, std_luma=48.791` |
| `motion_continuity` | Pairwise frame MAD & `ffmpeg freezedetect/blackdetect` | **PASS** | `mean_mad=10.6223` (`min=0.1621, max=81.0885`), `freeze_black_hits=[]` (`0` hits) |
| `audio_track` | Voiceover linear gated-RMS `-6.0 dB` mix check | **UNVERIFIED** | Demo was exported with synthetic music/SFX bed (`no real voiceover`), accurately marked `UNVERIFIED` rather than faking PASS. Real voiceover `-6 dB` mixing path was verified separately in `test_short02_api.mjs` (1.5s active WAV + `mix.py`). |
| `human_visual_review` | Final human playback sign-off | **UNVERIFIED** | Automated checks & AI contact-sheet inspection complete; human playback confirmation stays explicitly `UNVERIFIED` until user reviews video. |

## Frame Edit Proof (UI Controls Altered Real WebGL Output)
- **Before UI Edits (`proof_before_edit_f270.png`):** Frame 270 default `plaza-courier-10s` (`courierKid`, `morningSun`, `coral` parcel, `"SUNNY PLAZA"`) -> SHA-256 `175542947d676080305996eff999b19982811347ad9c20a5833b7f719fb694e7` (`172,048` bytes).
- **After UI Edits (`proof_after_edit_f270.png`):** Scene overrides (`signTitle: "HOANG HON PLAZA"`, `lightingPreset: "goldenHour"`, `characterStyle: "guardCap"`, `parcelColor: "gold"`) + Shot 4 overrides (`cameraPreset: "closeup"`, `expression: "smile"`, `pose: "wave"`) -> SHA-256 `9622985b39d4aac8b7770605878045bda219e3aa5a79f2e55aa804c5852c16` (`160,940` bytes).
