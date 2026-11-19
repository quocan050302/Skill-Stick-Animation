# Verification & Bounded Async DAG Design (`tests/verify_all.py`)

`tests/verify_all.py` orchestrates all build, regression, unit, negative QA, cross-niche, and E2E stages inside a deterministic two-stage bounded DAG so SwiftShader headless Chromium never oversubscribes host memory/CPU:

```mermaid
flowchart LR
  subgraph Stage1["Stage 1: Parallel CPU/Build Pool (asyncio.Semaphore(3))"]
    B["frontend_typecheck_and_build (tsc + vite)"]
    U2["short02_unit_tests (test_short02_backend.mjs)"]
    U3["short03a_unit_and_negative_qa (test_short03a_visual_and_4k.mjs)"]
  end

  subgraph Stage2["Stage 2: Sequential Browser/HTTP Pool (asyncio.Semaphore(1))"]
    R1["short01_regression_suite (tests/run_all.py)"]
    I2["short02_api_integration"]
    CN["short03a_cross_niche_and_4k_e2e"]
    E2["short02_playwright_e2e"]
    DV["unified_dev_smoke (127.0.0.1:18787 / 15173)"]
  end

  B --> R1
  U2 --> R1
  U3 --> R1
  R1 --> I2 --> CN --> E2 --> DV
```

## Resource & Cleanliness Safeguards
- **Stage 1 max concurrency = 3:** Pure CPU/TypeScript/Vite/unit suites run concurrently with zero headless browser conflicts.
- **Stage 2 max concurrency = 1:** Strictly serializes headless Chromium + FFmpeg sub-runs (`tests/run_all.py`, `api_integration`, `cross_niche_and_4k_e2e`, `studio_e2e`, `unified_dev_smoke`) using isolated loopback `port: 0` servers (or explicit dev smoke ports `18787`/`15173`) and teardown handlers so no Chromium processes or temp project records leak.
- **Native 4K Multi-Shard Acceleration:** Updated `tools/render/render_parallel.mjs` safely scales up to `3` workers on hosts with `>= 4.5 GB` free RAM and `>= 8` CPU cores (`2` default when spacious) instead of hardlocking single-threaded execution.
