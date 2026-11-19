# Vendor & Third-Party Source Governance

## 1. Original Kit Snapshot (`vendor/cartoon-short-kit/`)

- **Current status:** `INPUT_BLOCKED` — `cartoon-short-kit.zip` and `Pasted markdown.md` (`cartoon-audio-short` `SKILL.md`) were not present on the local filesystem during this run.
- **Public Repository Licensing Gate (G05):** This repository (`https://github.com/quocan050302/Skill-Stick-Animation`) is **PUBLIC**. Because the upstream kit ZIP does not contain an identifiable package-level `LICENSE` file, `vendor/cartoon-short-kit/` and `_inputs/` are explicitly listed in `.gitignore`.
- **Rule:** Do NOT commit or push third-party kit source files to this public repository unless provenance and redistribution authorization are explicitly verified and documented.
- **Byte-identical preservation:** Once `cartoon-short-kit.zip` is supplied locally under `_inputs/`, run:
  ```bash
  python tools/setup/audit_kit.py --preserve --write-manifest
  ```
  This audits ZIP security/CRC/SHA-256, preserves original bytes untouched in `vendor/cartoon-short-kit/`, and records SHA-256 parity in `vendor/source-manifest.json` and `docs/SOURCE_FIDELITY_MANIFEST.json`.

## 2. Third-Party Runtime Dependencies & License Notices

| Dependency | Pinned Version | License | Provenance / Source |
| :--- | :--- | :--- | :--- |
| `three` | `0.160.0` | MIT | npm registry (`node_modules/three`, Copyright © 2010-2024 three.js authors) |
| `playwright` | `1.65.1` | Apache-2.0 | npm registry (`node_modules/playwright`, Copyright © Microsoft Corporation) |
| `mromidev/claude-animated-shorts` (`Pen` / `toon.ts`) | *Pending `tools/setup.sh` inspection* | MIT *(upstream notice to be preserved on fetch)* | Not fetched yet because original `tools/setup.sh` is `INPUT_BLOCKED` |

No blanket MIT license is applied to third-party or unverified material in this repository.
