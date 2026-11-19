# Phase 0 Source Forensic Audit (`SHORT-01`)

- **Audit Status:** `INPUT_BLOCKED`
- **Audit Date (UTC):** `2026-11-19`
- **Machine-Readable Manifest:** [SOURCE_FIDELITY_MANIFEST.json](SOURCE_FIDELITY_MANIFEST.json)

## 1. Input Search & Integrity Verification

Required user-supplied inputs from prior conversation:
1. `cartoon-short-kit.zip` — **MISSING** on local filesystem
2. `Pasted markdown.md` (`cartoon-audio-short` `SKILL.md`) — **MISSING** on local filesystem

Read-only filesystem scan verified zero matches across:
- Active workspace `D:\Project_github\Stick-Animation`
- `C:\Users\QuocAn\Downloads`, `Desktop`, `Documents`, `OneDrive`, `WPS Cloud`, `.codex`, `.gemini`, `AppData\Local\Temp`, `Recent`
- All drives/directories on `D:\` (including ZIP entry inspection of existing `.zip` archives for `roman.js`, `paint.js`, `stills.jpg`, `cartoon-short-kit`)

Per Section 3 of SHORT-01, no unrelated local repository (`Skill-B6`, `QA-Unified-Video-Studio`, `short-director`, `animation-skills`) was substituted for the missing inputs.

## 2. Public Repository Licensing Gate (G05)

- Target remote `https://github.com/quocan050302/Skill-Stick-Animation` was verified **PUBLIC** (`private: False`).
- Because `cartoon-short-kit.zip` is missing and has no identifiable package-level `LICENSE` file, **G05 = `BLOCKED`**.
- `.gitignore` explicitly excludes `_inputs/` and `vendor/cartoon-short-kit/` so restricted or unverified third-party source cannot be accidentally pushed to the public remote.

## 3. Source-of-Truth Function Responsibility Map

All original kit symbols below are marked **`BLOCKED_MISSING_INPUT`** (never guessed or fabricated). Once `cartoon-short-kit.zip` is placed in `_inputs/` and audited via `python tools/setup/audit_kit.py --preserve --write-manifest`, each row must be populated from real file inspection before any refactoring.

| Original Kit File | Expected Capabilities / Symbols (Checklist) | Actual Status | Caller / Purpose | Input / Output | Confidence | Test Evidence |
| :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| `engine/index.html` | Host page, importmap, canvas bootstrap | `BLOCKED_MISSING_INPUT` | Browser entry | DOM / WebGL canvas | N/A | None (`INPUT_BLOCKED`) |
| `engine/main.js` | `applyLight`, `placeSun`, `worldState`, `drawActors`, `swapForNd`, `window.renderFrame(f)`, `window.ready`, color/depth+normal/ink/grade/DOF pipeline | `BLOCKED_MISSING_INPUT` | Playwright capture (`render.mjs`) | Frame `f` → WebGL canvas | N/A | None (`INPUT_BLOCKED`) |
| `engine/motion.js` | `camFromKeys`, `idle`, `blinkAt`, `walk`, `q`, easing/interpolation helpers | `BLOCKED_MISSING_INPUT` | `story.js` / `main.js` | Keyframes, `f`, seed → pose/camera | N/A | None (`INPUT_BLOCKED`) |
| `engine/paint.js` | Seeded procedural textures (`rng`, `tex`, `planks`, `beam`, `rotten`, `stone`, `mossy`, `grass`, `dirt`, `plaster`, `roof`, `marble`) | `BLOCKED_MISSING_INPUT` | `main.js` materials | Seed/dims → CanvasTexture | N/A | None (`INPUT_BLOCKED`) |
| `engine/roman.js` | Pen-based character drawing (`romanFront`, `OUTFITS`, `headCenter`, expressions, arm poses, card helpers) | `BLOCKED_MISSING_INPUT` | `main.js` actor cards | Pose/outfit/expr → 2D canvas | N/A | None (`INPUT_BLOCKED`) |
| `example/soldier/story.js` | `SHOTS`, `shotAt`, `camAt`, `dofAt`, `lightFor`, `worldAt`, `actorsAt`, `fxAt` | `BLOCKED_MISSING_INPUT` | `main.js` | Frame `f` → story state | N/A | None (`INPUT_BLOCKED`) |
| `example/soldier/stills.jpg` | Reference contact sheet | `BLOCKED_MISSING_INPUT` | Visual backtest | Static reference image | N/A | None (`INPUT_BLOCKED`) |
| `example/soldier/audio.py` | Synthesized music/SFX cues & any baseline mixing | `BLOCKED_MISSING_INPUT` | Audio build step | Script → WAV audio | N/A | None (`INPUT_BLOCKED`) |
| `tools/timing.py` | `duration`, `speech_segments`, `whisper_words`, `align` | `BLOCKED_MISSING_INPUT` | Timing pipeline | Voiceover WAV → timing JSON | N/A | None (`INPUT_BLOCKED`) |
| `tools/render.mjs` | Playwright browser frame capture | `BLOCKED_MISSING_INPUT` | CLI render | Story + engine → frames | N/A | None (`INPUT_BLOCKED`) |
| `tools/sheet.py` | Contact sheet generator | `BLOCKED_MISSING_INPUT` | Visual QA | Frames → contact sheet JPG | N/A | None (`INPUT_BLOCKED`) |
| `tools/finish.sh` | FFmpeg encoding, postprocessing, visual QA | `BLOCKED_MISSING_INPUT` | Final export | Frames + audio → MP4 | N/A | None (`INPUT_BLOCKED`) |
| `tools/setup.sh` | External Three.js / `toon.ts` fetch & Playwright symlink setup | `BLOCKED_MISSING_INPUT` | Environment setup | Network → local libs *(known `/tmp` hazards)* | N/A | Replaced by `tools/setup/safe_setup.mjs` |
| `tools/mix.py` | Linear -6 dB gated-RMS mixer claimed by SKILL | **MISSING IN UPSTREAM ZIP** | Audio mix | Narration + music + SFX → WAV | Confirmed absent from ZIP | **NEW IMPLEMENTATION** in `tools/audio/mix.py`, verified by `tests/unit/test_audio_mix.py` |
