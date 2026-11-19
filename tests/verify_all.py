"""Master bounded async DAG verification runner for Cartoon Short Studio (SHORT-01 + SHORT-02 + SHORT-03A).

Stage 1 runs CPU/build/unit suites under a bounded asyncio semaphore (max 2 concurrent workers).
Stage 2 runs Chromium / live API / dev-server checks sequentially so headless WebGL never oversubscribes.
Exits non-zero immediately if any stage fails.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


async def run_step_async(name: str, cmd: list[str], sem: asyncio.Semaphore, timeout_s: int = 300) -> dict:
    async with sem:
        t0 = time.time()
        print(f"\n==> [{name}] {' '.join(cmd)}", flush=True)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(ROOT),
        )
        try:
            rc = await asyncio.wait_for(proc.wait(), timeout=timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            rc = -1
        elapsed = round(time.time() - t0, 2)
        ok = rc == 0
        print(f"<== [{name}] exit={rc} ({elapsed}s)", flush=True)
        return {
            "name": name,
            "command": " ".join(cmd),
            "returncode": rc,
            "elapsed_seconds": elapsed,
            "ok": ok,
        }


def verify_unified_dev_smoke() -> dict:
    """Starts `node tools/dev.mjs --mode dev` on clean loopback ports, verifies FE+BE 200, then tears down cleanly."""
    t0 = time.time()
    name = "unified_dev_smoke"
    api_port = 18787
    vite_port = 15173
    env = os.environ.copy()
    env["API_PORT"] = str(api_port)
    env["VITE_PORT"] = str(vite_port)

    print(f"\n==> [{name}] Launching tools/dev.mjs --mode dev (API={api_port}, FE={vite_port})", flush=True)
    proc = subprocess.Popen(
        ["node", "tools/dev.mjs", "--mode", "dev"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    ok = False
    detail = ""
    try:
        deadline = time.time() + 25.0
        fe_ok = False
        be_ok = False
        while time.time() < deadline:
            if proc.poll() is not None:
                detail = f"dev runner exited early with code {proc.returncode}"
                break
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{vite_port}/", timeout=2) as r:
                    fe_ok = r.status == 200
                with urllib.request.urlopen(f"http://127.0.0.1:{vite_port}/api/health", timeout=2) as r2:
                    payload = json.loads(r2.read().decode("utf-8"))
                    be_ok = bool(payload.get("ok"))
                if fe_ok and be_ok:
                    ok = True
                    detail = "Unified FE+BE proxy returned HTTP 200 on both / and /api/health"
                    break
            except Exception:
                time.sleep(0.4)
        if not ok and not detail:
            detail = f"Timeout waiting for FE+BE (fe_ok={fe_ok}, be_ok={be_ok})"
    finally:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True, check=False)
        else:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    elapsed = round(time.time() - t0, 2)
    print(f"<== [{name}] ok={ok} ({elapsed}s) {detail}", flush=True)
    return {
        "name": name,
        "command": "node tools/dev.mjs --mode dev (smoke)",
        "returncode": 0 if ok else 1,
        "elapsed_seconds": elapsed,
        "ok": ok,
        "detail": detail,
    }


async def run_dag() -> int:
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    results = []

    # Stage 1: bounded parallel pure-CPU / build / unit stages (max 3 workers)
    cpu_sem = asyncio.Semaphore(3)
    stage1_tasks = [
        run_step_async("frontend_typecheck_and_build", [npm_cmd, "run", "build"], cpu_sem, 120),
        run_step_async("short02_unit_tests", ["node", "--test", "tests/unit/test_short02_backend.mjs"], cpu_sem, 120),
        run_step_async("short03a_unit_and_negative_qa", ["node", "--test", "tests/unit/test_short03a_visual_and_4k.mjs"], cpu_sem, 120),
    ]
    stage1_res = await asyncio.gather(*stage1_tasks)
    results.extend(stage1_res)
    if not all(r["ok"] for r in stage1_res):
        print(json.dumps({"overall_ok": False, "steps": results}, indent=2))
        return 1

    # Stage 2: browser / Chromium / loopback server integration checks (max 1 at a time)
    gpu_sem = asyncio.Semaphore(1)
    stage2_steps = [
        ("short01_regression_suite", [sys.executable, "tests/run_all.py"], 300),
        ("short02_api_integration", ["node", "--test", "tests/integration/test_short02_api.mjs"], 240),
        ("short03a_cross_niche_and_4k_e2e", ["node", "tests/integration/test_short03a_cross_niche_and_e2e.mjs"], 300),
        ("short02_playwright_e2e", ["node", "tests/e2e/test_studio_e2e.mjs"], 240),
    ]
    for name, cmd, timeout_s in stage2_steps:
        res = await run_step_async(name, cmd, gpu_sem, timeout_s)
        results.append(res)
        if not res["ok"]:
            print(json.dumps({"overall_ok": False, "steps": results}, indent=2))
            return 1

    smoke = verify_unified_dev_smoke()
    results.append(smoke)

    overall_ok = all(r["ok"] for r in results)
    summary_path = ROOT / "workspace" / "cache" / "verify_all_results.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps({"overall_ok": overall_ok, "steps": results}, indent=2), encoding="utf-8")

    print("\n=== VERIFY_ALL SUMMARY ===")
    print(json.dumps({"overall_ok": overall_ok, "steps": results}, indent=2))
    return 0 if overall_ok else 1


def main() -> int:
    return asyncio.run(run_dag())


if __name__ == "__main__":
    sys.exit(main())
