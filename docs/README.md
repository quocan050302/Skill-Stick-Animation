# SHORT-01 Documentation Index

- [SOURCE_AUDIT.md](SOURCE_AUDIT.md) — Phase 0 forensic inventory, SKILL vs kit inconsistencies, & audited function responsibility table
- [SOURCE_FIDELITY_MANIFEST.json](SOURCE_FIDELITY_MANIFEST.json) — Machine-readable CRC32 + SHA-256 byte-preservation manifest (14/14 verified)
- [DEPENDENCIES.md](DEPENDENCIES.md) — Pinned versions, commit SHAs (`three@0.160.0`, `claude-animated-shorts@e3b817b6`, `playwright@1.65.1`), licenses, and Node v26 compatibility fix
- [ARCHITECTURE.md](ARCHITECTURE.md) — Pipeline call graph & function-level accountability table
- [ENGINE_PARITY.md](ENGINE_PARITY.md) — Separate tracks A–E parity evaluation
- [ENGINE_API_CONTRACT.md](ENGINE_API_CONTRACT.md) — Authoritative 9:16 renderer contract for SHORT-02 Studio UI
- [QA_REPORT.md](QA_REPORT.md) — Objective QA evidence & G01–G20 release gate matrix
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — Publication & release verification checklist

## Immutable Per-Run Audit Folders
- [agent-runs/SHORT-01-20261119-01/README.md](agent-runs/SHORT-01-20261119-01/README.md) — Run 1 (initial infrastructure & WebGL2 smoke while original kit ZIP was missing)
- [agent-runs/SHORT-01-20261119-02/README.md](agent-runs/SHORT-01-20261119-02/README.md) — Run 2 (full ingestion of `cartoon-short-kit.zip` + `SKILL.md`, original Soldier baseline + preview MP4, audio/timing audit, and new 10s 300-frame zombie proof)
