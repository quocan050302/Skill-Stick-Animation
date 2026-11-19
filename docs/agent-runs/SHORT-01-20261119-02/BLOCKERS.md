# Run `SHORT-01-20261119-02` — Blockers & Honest Limitations

## 1. G05 Public Repository Licensing Gate — `BLOCKED` (Strict Enforcement)
- **Detail:** `cartoon-short-kit.zip` contains no identifiable package-level `LICENSE` file (`license_files_found: []`), and target remote `https://github.com/quocan050302/Skill-Stick-Animation` is **PUBLIC** (`private: False`).
- **Action Taken:** Complete original kit is preserved and fully verified locally (`vendor/cartoon-short-kit/`, `engine/web/`), while `.gitignore` strictly blocks committing/pushing copied kit files to the public remote. Only independently authored code, preserved MIT dependency notices (`three@0.160.0`, `claude-animated-shorts`), tests, manifests, and audit reports are committed & pushed.
- **How to Resolve:** Either (A) provide written confirmation of public redistribution rights + license text for `cartoon-short-kit`, (B) keep kit local-only as currently configured, or (C) switch `Skill-Stick-Animation` to Private.

## 2. Missing Real Voiceover (`voice.mp3`) & Whisper ASR — `UNVERIFIED` (G12 / G13 Real Human Narration)
- **Detail:** `cartoon-short-kit.zip` does not include `example/soldier/voice.mp3`, and neither `whisper` nor `faster_whisper` is installed locally.
- **Impact:**
  - `tools/timing.py` was verified functionally on a 6.00s synthetic cadence fixture (`silence-align`, 180 frames, 3 phrases, 23 monotonic words), NOT on real human speech (`G12` speech ASR = `UNVERIFIED`).
  - `tools/audio/mix.py` (SKILL-spec linear `-6.02 dB`) and original `example/soldier/audio.py` (dynamic ducking + `tanh`) were both measured objectively on real synthesized stems + a synthetic voice proxy; final narrated voiceover mix parity remains `UNVERIFIED` until a real voiceover WAV/MP3 is supplied.
  - Both rendered preview MP4s (`out/soldier-reference-preview.mp4` and `out/new-zombie-10s-preview.mp4`) carry real synthesized music + SFX AAC audio tracks and are explicitly labeled as **no-voiceover previews** (no fake TTS/silent voiceover claims).
