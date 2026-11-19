# Run `SHORT-01-20261119-02` — Source Audit Snapshot

Full function responsibility table & inconsistencies documented in [../../SOURCE_AUDIT.md](../../SOURCE_AUDIT.md), byte hashes in [../../SOURCE_FIDELITY_MANIFEST.json](../../SOURCE_FIDELITY_MANIFEST.json), and upstream locks in [../../../vendor/upstream-deps-lock.json](../../../vendor/upstream-deps-lock.json).

## Verified Input Checksums
- `cartoon-short-kit.zip`: `444,936` bytes, SHA-256 `784c07e36df5e91ddf93c78a1dde6b98b3aa3e3c37cadff03c5603d3971ce788`, 19 entries (14 files, 5 dirs), `14/14` byte-identical match in local `vendor/cartoon-short-kit/`.
- `SKILL.md` (`cartoon-audio-short`): `14,934` bytes, SHA-256 `2ac0bf5f2ab7a689b3751050df664920d7763392a9287b0ce8d7254ea4cfc2ed`.
- `mromidev/claude-animated-shorts` `templates/bridge/toon.ts` (MIT): commit `e3b817b6afc6cd413466d43f11ba31209e034bbf`, `55,412` bytes, SHA-256 `524f6dfa0c41d4976268636ce2c3ff910ca65a7bec04648f88d2588e803b9aa5`.
- **G05 Licensing Status:** `cartoon-short-kit.zip` contains `0` package-level LICENSE files (`package_license_verified: false`). Because target repo `quocan050302/Skill-Stick-Animation` is PUBLIC, all copied kit files (`vendor/cartoon-short-kit/`, `engine/web/`, `vendor/upstream/`) remain strictly local-only via `.gitignore` and are excluded from public git commits.
