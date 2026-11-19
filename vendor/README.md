# Vendor & Third-Party Source Governance

## 1. Original Kit Snapshot (`vendor/cartoon-short-kit/`)

- **Local Status:** `PRESERVED_VERIFIED` — All 14 original files from `cartoon-short-kit.zip` (SHA-256 `784c07e36df5e91ddf93c78a1dde6b98b3aa3e3c37cadff03c5603d3971ce788`) were audited, extracted in an isolated project-owned temp workspace, and preserved byte-for-byte in `vendor/cartoon-short-kit/` with **14/14 SHA-256 matches** recorded in [source-manifest.json](source-manifest.json).
- **Public Repository Licensing Gate (G05 = `BLOCKED`):**
  - Target remote `https://github.com/quocan050302/Skill-Stick-Animation` is **PUBLIC**.
  - Forensic scan confirmed `license_files_found: []` (`package_license_verified: false`) inside `cartoon-short-kit.zip`.
  - Therefore `vendor/cartoon-short-kit/`, `vendor/upstream/`, `engine/web/`, and `_inputs/` remain strictly `.gitignored` and are **NOT** pushed to the public repository until public redistribution authorization is verified.

## 2. Third-Party Runtime Dependencies & Preserved MIT / Apache Notices

Exact hashes and commits are pinned in [upstream-deps-lock.json](upstream-deps-lock.json) and `package-lock.json`.

| Dependency | Pinned Version / Commit | License | Preserved Notice Path |
| :--- | :--- | :--- | :--- |
| `three` | `0.160.0` (REVISION `160`) | MIT | [licenses/THREE-0.160.0-LICENSE.txt](licenses/THREE-0.160.0-LICENSE.txt) |
| `mromidev/claude-animated-shorts` (`templates/bridge/toon.ts`) | `e3b817b6afc6cd413466d43f11ba31209e034bbf` | MIT | [licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt](licenses/CLAUDE-ANIMATED-SHORTS-LICENSE.txt) |
| `playwright` | `1.65.1` | Apache-2.0 | Installed via npm (`node_modules/playwright`) |

No blanket MIT license is added to third-party or unverified source material in this repository.
