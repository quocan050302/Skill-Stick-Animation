# Dependencies & Cross-Platform Safe Setup (`SHORT-01`)

## 1. Verified Local Runtime & Pinned Packages

All local dependencies are pinned without relying on global Playwright symlinks or hazardous `/tmp/_three`, `/tmp/_t3`, `/tmp/_cas` shell paths.

| Component | Verified Version | License | Verification Source |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v26.13.1` (`>=22.6.0` required; `module.stripTypeScriptTypes` = `function`) | MIT | `node tools/setup/safe_setup.mjs` |
| **Three.js (`three`)** | `0.160.0` (REVISION `160`) | MIT | `package.json` + `package-lock.json` |
| **Playwright (`playwright`)** | `1.65.1` | Apache-2.0 | `package.json` + `package-lock.json` |
| **Chromium (Playwright)** | `159.0.8154.6` (revision `1255`) | BSD-3-Clause | Local Playwright browser cache (`ms-playwright/chromium-1255`) |
| **Python** | `3.12.10` | PSF-2.0 | `python --version` |
| **NumPy** | `2.5.4` | BSD-3-Clause | Python runtime import check |
| **Pillow (`PIL`)** | `13.0.0` | MIT-CMU | Python runtime import check |
| **SciPy** | `1.18.1` | BSD-3-Clause | Python runtime import check |
| **SoundFile** | `0.14.0` | BSD-3-Clause | Python runtime import check |
| **FFmpeg / FFprobe** | `9.0.2-full_build-www.gyan.dev` | GPL/LGPL (external binary, not bundled) | `ffmpeg -version` / `ffprobe -version` |

## 2. Pending / Missing Dependencies (Blocked on Kit Audit)

| Component | Status | Reason |
| :--- | :---: | :--- |
| `mromidev/claude-animated-shorts` (`Pen` / `toon.ts`) | **BLOCKED** | Must first inspect original `cartoon-short-kit/tools/setup.sh` and `engine/roman.js` to pin exact upstream commit/path and preserve MIT notice. |
| `whisper` / `faster_whisper` | **NOT INSTALLED** | Optional ASR dependency; because neither is installed and no genuine voiceover input was supplied, real speech-word alignment remains `UNVERIFIED`. |
| Additional imports from `cartoon-short-kit` | **BLOCKED** | Cannot audit until `cartoon-short-kit.zip` is supplied locally. |

## 3. Safe Setup Policy (Replacing `tools/setup.sh` Hazards)

Original `tools/setup.sh` issues noted in specification:
- Global `/tmp/_three`, `/tmp/_t3`, `/tmp/_cas` paths with destructive `rm -rf`.
- Reliance on global Playwright symlink.
- Unpinned network fetches without hash verification.

Replacement behavior implemented in `tools/setup/safe_setup.mjs` and `tools/setup/audit_kit.py`:
- Uses project-owned `node_modules/` + deterministic `package-lock.json` and isolated `workspace/cache/kit-extract-<uuid>` temporary directories.
- Enforces path confinement via `tools/setup/safe_path.py` (`safe_rmtree` refuses to delete workspace root or external directories).
- Never modifies preserved snapshots under `vendor/cartoon-short-kit/`.
- Never disables TLS or bypasses proxy restrictions.
- Launches Chromium on CPU/headless Windows with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` and verifies real WebGL2 capability (`isWebGL2 === true`) rather than assuming flags suffice.
