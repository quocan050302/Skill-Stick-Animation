# Phase 0 Source Forensic Audit (`SHORT-01`)

- **Audit Status:** `PRESERVED_VERIFIED` (local byte-identical snapshot verified 14/14 SHA-256 matches; G05 public repo push gate remains `BLOCKED` for third-party kit source)
- **Audit Date (UTC):** `2026-11-19`
- **Machine-Readable Manifest:** [SOURCE_FIDELITY_MANIFEST.json](SOURCE_FIDELITY_MANIFEST.json)
- **Upstream Dependency Lock:** [../vendor/upstream-deps-lock.json](../vendor/upstream-deps-lock.json)

## 1. Input Archives Verified

| Input | Local Source Path | Size (bytes) | SHA-256 | Integrity / Security |
| :--- | :--- | :---: | :--- | :--- |
| `cartoon-short-kit.zip` | `C:\Users\QuocAn\Downloads\cartoon-short-kit.zip` | `444,936` | `784c07e36df5e91ddf93c78a1dde6b98b3aa3e3c37cadff03c5603d3971ce788` | PASS: 19 entries (14 files, 5 dirs), 0 traversal/symlink/duplicate/zip-bomb issues, 0 corrupt CRCs, 14/14 byte-identical SHA-256 match |
| `SKILL.md` (`cartoon-audio-short`) | `C:\Users\QuocAn\Downloads\SKILL.md` | `14,934` | `2ac0bf5f2ab7a689b3751050df664920d7763392a9287b0ce8d7254ea4cfc2ed` | PASS: Readable UTF-8 markdown (`name: cartoon-audio-short`) |

## 2. Public Repository Licensing Gate (G05)

- Target remote `https://github.com/quocan050302/Skill-Stick-Animation` is **PUBLIC** (`private: False`).
- Forensic scan of `cartoon-short-kit.zip` confirmed **`license_files_found: []`** (`package_license_verified: false`). Only `README.md` notes `"Built on github.com/mromidev/claude-animated-shorts (MIT)"`.
- Per Section 2.I (**ABSOLUTE**): **G05 = `BLOCKED`** for publishing copied kit sources to the public repository.
  - Complete original kit is preserved locally byte-for-byte in `.gitignored` `vendor/cartoon-short-kit/` and restored locally in `.gitignored` `engine/web/` for full rendering & regression QA.
  - Third-party MIT notices for `three@0.160.0` and `mromidev/claude-animated-shorts` (`e3b817b6`) are preserved in `vendor/licenses/`.
  - Public branch pushes contain ONLY independently authored scaffolding, adapters, new demo code, tests, manifests, and audit reports.

## 3. Confirmed Inconsistencies Between `SKILL.md` and Original Kit Code

1. **`mix.py` is MISSING from `cartoon-short-kit.zip`:** `SKILL.md` requires mixing stems with `mix.py` (music at 50% / `-6 dB` gated RMS, no dynamic ducking), but the ZIP contains no `mix.py`. Implemented as **NEW CODE** in `tools/audio/mix.py`.
2. **`example/soldier/audio.py` contradicts `SKILL.md`:** Actual `audio.py` (lines 171–180) does NOT emit separate `music.wav`/`sfx.wav` stems; instead it loads `voice.mp3`, runs an envelope-follower dynamic ducker (`duck = 1 - 0.45 * clip(ve / (ve.max() * 0.25), 0, 1)`), mixes `voice + music * duck * 1.4 + sfx * 0.5`, applies `tanh` saturation, and writes mono `mix_raw.wav`.
3. **`tools/finish.sh` vs `SKILL.md`:** `SKILL.md` describes one linear gain + `-1 dBFS` peak limiter; actual `tools/finish.sh` line 4 applies FFmpeg `loudnorm=I=-14:TP=-1.5:LRA=7`.
4. **`tools/setup.sh` platform & safety hazards:** Uses global `/tmp/_three`, `/tmp/_t3`, `/tmp/_cas` with `rm -rf`; uses global Playwright symlink; calls `module.stripTypeScriptTypes(..., { mode: 'transform' })` which fails on Node v26.13.1 (`ERR_INVALID_ARG_VALUE`, only `'strip'` accepted). Replaced safely by `tools/setup/install_engine.mjs`.
5. **No `voice.mp3` in ZIP:** `example/soldier/` ships only `story.js`, `audio.py`, and `stills.jpg` — no recorded narration file.
6. **Soldier-specific `story.js`:** Hardcoded JS story module, not a generic JSON scene schema for a UI.

## 4. Source-of-Truth Function Responsibility Map

| File (in `cartoon-short-kit/`) | Symbols Audited | Caller | Purpose | Input / Output | Confidence | Test / Runtime Evidence |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `engine/index.html` | `<canvas id="c" width="1080" height="1920">`, global `error` listener | Playwright host | Loads ES module `main.js` and captures runtime errors in `window.err` | DOM → WebGL canvas | High | Verified in G08/G09 renders (`0` errors) |
| `engine/main.js` | `toon`, `texM`, `ndMat`, `cardNd`, `waterNd`, `add`, `tbox`, `Card`, `getCard`, `applyLight`, `placeSun`, `worldState`, `drawActors`, `helmetState`, `swapForNd`, `window.renderFrame(f)`, `window.TOTAL`, `window.ready` | `tools/render.mjs` / `renderer_adapter.mjs` | Full 3D Three.js r160 world (river, banks, bridge, rotting piles, gate, hut, collapsing temple, village, clouds, 3D helmet), 2D 1200×2000 billboard cards, 4x-MSAA HalfFloat color pass → normal+depth pass → 16-tap ink+grade pass → 48-tap CoC DOF pass | Frame `f` → `1080x1920` canvas + `true` | High | 15 key stills (`0..591`), `#e`/`#nd` debug passes, 180-frame continuous preview, repeat-frame SHA-256 match |
| `engine/motion.js` | `clamp`, `lerp`, `lerp3`, `ramp`, `M` (`smooth`, `easeOut`, `easeIn`, `back`, `anticip`, `spring`), `spline`, `camFromKeys`, `idle`, `blinkAt`, `walk`, `q` | New story modules (`story.js` defines local copies of `smooth`/`blinkAt`/`q`) | Frame-pure deterministic camera splines, easing, kicks, breathing idle, blinks, walk cycles, key quantization | Frame `f`, keys, seed → camera/pose numbers | High | Verified by `tests/unit/test_original_kit_modules.mjs` |
| `engine/paint.js` | `rng`, `tex`, `planks`, `beam`, `rotten`, `stone`, `mossy`, `grass`, `dirt`, `plaster`, `roof`, `marble`, `banner`, `helmetInside`, `radial` | `engine/main.js` | Seeded LCG deterministic Canvas2D painted textures including non-mirrored carved `"THE BRIDGE IS NOT SAFE"` helmet interior | Seed/dims → `HTMLCanvasElement` / `THREE.CanvasTexture` | High | Visually verified across all 15 Soldier tiles (`out/reference-contact-sheet.jpg`) |
| `engine/roman.js` | `FACE` extensions (`snore`, `stubborn`, `squint`), `OUTFITS` (8 outfits), `galea`, `cheeks`, `cobweb`, `romanFront`, `helmetCard`, `fxZ`, `fxLeaf`, `fxDust`, `fxDrip`, `fxWood`, `headCenter` | Concatenated after `toonbase.js` into `toon.js`; called by `story.js` | Pen-based 600×1000 bean-head Roman characters, detached helmet card, 2D comic effects | `(Pen, outfitKey, opts)` → draws to card canvas | High | Visually verified across all 8 Soldier shots & detached helmet alignment (`f=335`) |
| `example/soldier/story.js` | `FPS=30`, `TOTAL=592`, `DECK=6`, `SHOTS` (8 shots), `shotAt`, `LIGHTS`, `lightFor`, `camAt`, `dofAt`, `worldAt`, `actorsAt`, `fxAt` | `engine/main.js` | Pure frame-indexed storyboard for "The Soldier Who Never Left" (19.73s) | Frame `f` → lights, camera, DOF, world state, actor/FX lists | High | All 592 frames verified finite/contiguous in `test_original_kit_modules.mjs` + real WebGL renders |
| `example/soldier/audio.py` | `load_voice`, `env`, `lp`, `lp_fast`, `hp_fast`, `place`, `pluck`, `brass`, `drum`, `thunk`, `rumble`, `crash`, `cuckoo`, `scrape`, `ting`, `sting`, `creak`, `snap`, `splash`, `whoosh`, `snore`, `leaves`, `water` | Standalone Python script | Synthesizes 19.73s march loop + tension drone + 18 SFX cues and mixes with dynamic ducking + `tanh` into mono `mix_raw.wav` | `voice.mp3` → `mix_raw.wav` | High | Audited via `tools/audio/soldier_audio_audit.py` on synthetic voice proxy |
| `tools/timing.py` | `syll`, `duration`, `speech_segments`, `whisper_words`, `align` | Standalone Python CLI | Whisper ASR word timing if installed; fallback FFmpeg `silencedetect` + syllable DP phrase alignment | `voice.mp3` + `script.txt` → `words.json`, `phrases.json` | High | Executed on 6s synthetic cadence fixture (`duration=6.0s`, `frames30=180`, 3 phrases, 23 monotonic words) |
| `tools/render.mjs` | Inline CLI (HTTP server, Chromium SwiftShader, `window.renderFrame(f)`, `toDataURL('image/jpeg', q)`, `RESUME`) | Standalone Node CLI | Renders `f0000.jpg` frames from `web/index.html` | Frame spec → `f*.jpg` | High | Wrapped safely by `renderer_adapter.mjs` + `tools/render/render_original.mjs` |
| `tools/sheet.py` | Inline CLI | Standalone Python CLI | Builds 270×480 contact sheets (`cols=7`) | `f*.jpg` dir → JPG sheet | High | Matched by `tools/qa/contact_sheet.py` (`out/reference-contact-sheet.jpg`) |
| `tools/finish.sh` | Bash script | Standalone shell | FFmpeg `loudnorm` + H.264 CRF 17 + AAC + `freezedetect`/`blackdetect` + `qa_sheet.jpg` | `frames/` + `mix_raw.wav` → `out/*.mp4` | High | Audited; Windows-safe equivalent in `tools/qa/export_mp4.py` + `verify_media.py` |
| `tools/setup.sh` | Bash script | Project bootstrap | Copies kit, fetches Three.js r160 & `toon.ts`, runs `stripTypeScriptTypes`, symlinks Playwright | Network + kit → project dir | High | Replaced safely by `tools/setup/install_engine.mjs` (fixes `/tmp` & Node v26 `strip` mode) |
| `tools/mix.py` | **MISSING** | Referenced by `SKILL.md` | Linear `-6 dB` gated-RMS mixer (no ducking) | Voice + stems → mixed WAV | Confirmed absent | **NEW IMPLEMENTATION** in `tools/audio/mix.py` |
