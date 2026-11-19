# Run `SHORT-01-20261119-01` — Blockers

## Active Blockers Preventing Full SHORT-01 Sign-Off

### Blocker 1: Missing Original Input Files (`G03`, `G04`, `G08`–`G11`, `G14` prod, `G15`)
- **Status:** `INPUT_BLOCKED`
- **Missing files:**
  1. `cartoon-short-kit.zip`
  2. `Pasted markdown.md` (`cartoon-audio-short` `SKILL.md`)
- **Impact:** Cannot compute original kit SHA-256 hashes, audit original functions (`main.js`, `motion.js`, `paint.js`, `roman.js`, `story.js`, `audio.py`, `timing.py`, `render.mjs`, `sheet.py`, `finish.sh`, `setup.sh`), restore original `engine/web/`, render original Soldier reference stills/MP4, or build the new 10-second zombie proof on top of the original engine.
- **Unblock action:** Copy both files into `D:\Project_github\Stick-Animation\_inputs\` and run `python tools/setup/audit_kit.py --preserve --write-manifest`.

### Blocker 2: Public Repository Licensing Gate (`G05`)
- **Status:** `BLOCKED`
- **Detail:** `https://github.com/quocan050302/Skill-Stick-Animation` is a **PUBLIC** repository (`private: False`), and the upstream kit ZIP lacks an identifiable package-level `LICENSE` file.
- **Impact:** Third-party kit files must NOT be committed or pushed to the public remote until redistribution authorization is confirmed (or repo is switched to Private, or kit files remain local-only under `.gitignore`).

### Blocker 3: Upstream `toon.ts` Pinning (`G06` partial)
- **Status:** `BLOCKED`
- **Detail:** `mromidev/claude-animated-shorts` (`Pen`/`toon.ts`) commit/path cannot be pinned accurately until original `cartoon-short-kit/tools/setup.sh` and `engine/roman.js` are audited.

### Blocker 4: Real Voiceover Input & ASR (`G12`, `G13` real speech)
- **Status:** `UNVERIFIED`
- **Detail:** No genuine narrated voiceover WAV was provided, and neither `whisper` nor `faster_whisper` is installed locally. Synthetic fixtures verified only the technical math of `tools/timing/timing_contract.py` and `tools/audio/mix.py`.
