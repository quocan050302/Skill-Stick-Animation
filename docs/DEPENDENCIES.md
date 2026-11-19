# Dependencies & Cross-Platform Safe Setup (`SHORT-01`)

## 1. Verified Local Runtime & Pinned Packages

All dependencies are pinned without global Playwright symlinks or hazardous `/tmp/_three`, `/tmp/_t3`, `/tmp/_cas` paths. Full hashes are locked in `package-lock.json` and [../vendor/upstream-deps-lock.json](../vendor/upstream-deps-lock.json).

| Component | Pinned Version / Commit | License | SHA-256 / Verification |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v26.13.1` (`>=22.6.0`; `module.stripTypeScriptTypes` uses `mode: 'strip'` on v26) | MIT | `node tools/setup/safe_setup.mjs` |
| **Three.js (`three`)** | `0.160.0` (REVISION `160`) | MIT (`vendor/licenses/THREE-0.160.0-LICENSE.txt`) | `three.module.js` SHA-256 `76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495` (`1,272,972` bytes) |
| **`mromidev/claude-animated-shorts`** (`templates/bridge/toon.ts`) | Commit `e3b817b6afc6cd413466d43f11ba31209e034bbf` | MIT (`vendor/licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt`) | `toon.ts` SHA-256 `524f6dfa0c41d4976268636ce2c3ff910ca65a7bec04648f88d2588e803b9aa5` (`55,412` bytes) |
| **Playwright (`playwright`)** | `1.65.1` | Apache-2.0 | `package.json` + `package-lock.json` |
| **Chromium (Playwright)** | `159.0.8154.6` (revision `1255`) | BSD-3-Clause | `%LOCALAPPDATA%\ms-playwright\chromium-1255\chrome-win64\chrome.exe` |
| **Python** | `3.12.10` | PSF-2.0 | `python --version` |
| **NumPy / Pillow / SciPy / SoundFile** | `2.5.4` / `13.0.0` / `1.18.1` / `0.14.0` | BSD-3-Clause / MIT-CMU | `safe_setup.mjs` import verification |
| **FFmpeg / FFprobe** | `9.0.2-full_build-www.gyan.dev` | GPL/LGPL (external binary) | `ffmpeg -version` / `ffprobe -version` |

## 2. Optional Dependencies Not Installed

- `whisper` / `faster_whisper`: Not installed locally; original `tools/timing.py` falls back cleanly to FFmpeg `silencedetect` + syllable DP phrase alignment when script text is supplied. Real human speech alignment remains `UNVERIFIED` because no recorded voiceover was supplied.

## 3. Compatibility Patch Recorded (`tools/setup/install_engine.mjs`)

- **Original `tools/setup.sh` failure on Node v26:** Line 18 invoked `module.stripTypeScriptTypes(src, { mode: 'transform' })`, which throws `TypeError [ERR_INVALID_ARG_VALUE]: The property 'options.mode' must be one of: 'strip'` on Node.js v26.13.1.
- **Safe Fix:** `tools/setup/install_engine.mjs` uses `{ mode: 'strip' }` first (falling back to `'transform'` only on older Node 22 runtimes), operates inside isolated project-owned `workspace/cache/cas-<hex>` temp directories (never `/tmp/_cas`), preserves upstream MIT `LICENSE` files, and never modifies `vendor/cartoon-short-kit/`.
- **Exact `toon.js` rebuild record:** `module.stripTypeScriptTypes(toon.ts, { mode: 'strip' })` → `engine/web/toonbase.js` (`55,412` bytes, SHA-256 `afc0c1e8...`), concatenated with `engine/web/roman.js` (`18,980` bytes) → `engine/web/toon.js` (`74,393` bytes, SHA-256 `823360b9...`).
