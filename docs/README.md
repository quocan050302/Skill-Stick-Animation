# SHORT-01 Documentation Index

This directory contains forensic audit records, dependency pinning, architecture, engine parity tracking, the SHORT-02 Engine API contract, QA reports, and immutable per-run execution logs.

## Core Documents

- [SOURCE_AUDIT.md](SOURCE_AUDIT.md) — Phase 0 forensic inventory & function-level responsibility map (currently `INPUT_BLOCKED` for missing kit archive)
- [SOURCE_FIDELITY_MANIFEST.json](SOURCE_FIDELITY_MANIFEST.json) — Machine-readable SHA-256 & byte-preservation manifest
- [DEPENDENCIES.md](DEPENDENCIES.md) — Pinned versions, licenses, checksums/lockfiles, and cross-platform setup rules
- [ARCHITECTURE.md](ARCHITECTURE.md) — Pipeline call graph & function-level accountability table
- [ENGINE_PARITY.md](ENGINE_PARITY.md) — Separate evaluation of A (Source Byte Fidelity), B (Dependency Reconstruction), C (Rendered Output Parity), D (Audio Contract Parity), and E (Video/Export Contract Parity)
- [ENGINE_API_CONTRACT.md](ENGINE_API_CONTRACT.md) — Authoritative 9:16 renderer contract for SHORT-02 Studio UI
- [QA_REPORT.md](QA_REPORT.md) — Objective QA evidence, gate matrix G01–G20, and known blockers
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) — Release & publication verification checklist

## Per-Run Logs

- [agent-runs/SHORT-01-20261119-01/README.md](agent-runs/SHORT-01-20261119-01/README.md) — Immutable audit folder for the initial SHORT-01 execution run
