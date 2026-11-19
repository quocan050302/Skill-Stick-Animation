"""Bounded-concurrency async DAG test runner for SHORT-01.

Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
Execution DAG:
  Stage 1 (parallel, bounded to <=3 workers based on CPU/RAM):
    - unit: audit_kit (ZIP integrity/security + INPUT_BLOCKED)
    - unit: safe_path & disk preflight
    - unit: timing_contract
    - unit: audio_mix (linear -6 dB gated-RMS + negative tests)
    - unit: node contract, loopback server, adapter negative tests, local API
  Stage 2 (sequential heavy stage — single Chromium + FFmpeg instance):
    - env verify: tools/setup/safe_setup.mjs
    - integration: Playwright Chromium WebGL2 1080x1920 + Pillow QA + resume/cancel + FFmpeg/FFprobe
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


async def run_job(job: dict[str, Any], sem: asyncio.Semaphore) -> dict[str, Any]:
    async with sem:
        t0 = time.perf_counter()
        proc = await asyncio.create_subprocess_exec(
            *job["cmd"],
            cwd=str(ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_b, stderr_b = await proc.communicate()
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        stdout = stdout_b.decode("utf-8", errors="replace")
        stderr = stderr_b.decode("utf-8", errors="replace")
        passed = proc.returncode == job.get("expected_exit", 0)
        return {
            "id": job["id"],
            "category": job["category"],
            "stage": job["stage"],
            "cmd": job["cmd"],
            "exit_code": proc.returncode,
            "expected_exit": job.get("expected_exit", 0),
            "status": "PASS" if passed else "FAIL",
            "elapsed_ms": elapsed_ms,
            "stdout_tail": stdout[-2000:],
            "stderr_tail": stderr[-2000:],
        }


async def run_dag(max_parallel: int) -> dict[str, Any]:
    (ROOT / "workspace" / "cache").mkdir(parents=True, exist_ok=True)
    py = sys.executable

    stage1_jobs = [
        {
            "id": "unit_audit_kit",
            "category": "unit+negative",
            "stage": 1,
            "cmd": [py, "-m", "unittest", "-v", "tests/unit/test_audit_kit.py"],
        },
        {
            "id": "unit_safe_path_disk",
            "category": "unit+negative",
            "stage": 1,
            "cmd": [py, "-m", "unittest", "-v", "tests/unit/test_safe_path_and_disk.py"],
        },
        {
            "id": "unit_timing_contract",
            "category": "unit+negative",
            "stage": 1,
            "cmd": [py, "-m", "unittest", "-v", "tests/unit/test_timing_contract.py"],
        },
        {
            "id": "unit_audio_mix",
            "category": "unit+integration+negative",
            "stage": 1,
            "cmd": [py, "-m", "unittest", "-v", "tests/unit/test_audio_mix.py"],
        },
        {
            "id": "unit_node_contract_adapter",
            "category": "unit+negative",
            "stage": 1,
            "cmd": ["node", "--test", "tests/unit/test_contract_and_adapter.mjs"],
        },
        {
            "id": "unit_motion_story_modules",
            "category": "unit",
            "stage": 1,
            "cmd": ["node", "--test", "tests/unit/test_original_kit_modules.mjs"],
        },
    ]

    stage2_jobs = [
        {
            "id": "env_safe_setup_verify",
            "category": "preflight",
            "stage": 2,
            "cmd": ["node", "tools/setup/safe_setup.mjs"],
        },
        {
            "id": "regression_original_engine_parity",
            "category": "regression+backtest",
            "stage": 2,
            "cmd": [py, "-m", "unittest", "-v", "tests/regression/test_original_engine_parity.py"],
        },
        {
            "id": "integration_webgl_and_ffmpeg",
            "category": "integration+negative",
            "stage": 2,
            "cmd": [py, "-m", "unittest", "-v", "tests/integration/test_webgl_and_ffmpeg.py"],
        },
    ]

    t_start = time.perf_counter()
    sem_parallel = asyncio.Semaphore(max_parallel)
    stage1_results = await asyncio.gather(*(run_job(j, sem_parallel) for j in stage1_jobs))

    sem_serial = asyncio.Semaphore(1)
    stage2_results = []
    for job in stage2_jobs:
        stage2_results.append(await run_job(job, sem_serial))

    all_results = list(stage1_results) + stage2_results
    total_ms = round((time.perf_counter() - t_start) * 1000, 1)

    passed = sum(1 for r in all_results if r["status"] == "PASS")
    failed = sum(1 for r in all_results if r["status"] != "PASS")

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "cpu_count": os.cpu_count() or 1,
        "bounded_stage1_concurrency": max_parallel,
        "stage2_heavy_concurrency": 1,
        "total_suites": len(all_results),
        "passed_suites": passed,
        "failed_suites": failed,
        "overall_status": "PASS" if failed == 0 else "FAIL",
        "elapsed_total_ms": total_ms,
        "blocked_suites_missing_kit": (
            []
            if (ROOT / "vendor" / "cartoon-short-kit").exists()
            else [
                "regression_original_soldier_baseline (BLOCKED: local vendor/cartoon-short-kit absent)",
            ]
        ),
        "suites": all_results,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bounded async DAG test runner for SHORT-01")
    parser.add_argument("--out", default=None, help="Optional JSON output path")
    parser.add_argument(
        "--max-parallel",
        type=int,
        default=min(3, max(1, (os.cpu_count() or 2) // 2)),
        help="Bounded parallelism for Stage 1 lightweight unit suites (default: <=3)",
    )
    args = parser.parse_args(argv)

    summary = asyncio.run(run_dag(max(1, min(4, args.max_parallel))))
    text = json.dumps(summary, indent=2) + "\n"
    if args.out:
        out_p = Path(args.out)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(text, encoding="utf-8")
    print(text)
    return 0 if summary["failed_suites"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
