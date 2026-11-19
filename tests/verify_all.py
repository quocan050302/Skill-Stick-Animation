"""Master bounded verification runner for Cartoon Short Studio (SHORT-01 + SHORT-02).

Runs stages sequentially to guarantee headless Chromium (SwiftShader) and Vite never
oversubscribe CPU/memory, and exits non-zero immediately if any check fails.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_step(name: str, cmd: list[str], timeout_s: int = 300) -> dict:
    t0 = time.time()
    print(f"\n==> [{name}] {' '.join(cmd)}", flush=True)
    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        timeout=timeout_s,
        shell=False,
    )
    elapsed = round(time.time() - t0, 2)
    ok = proc.returncode == 0
    print(f"<== [{name}] exit={proc.returncode} ({elapsed}s)", flush=True)
    return {
        "name": name,
        "command": " ".join(cmd),
        "returncode": proc.returncode,
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


def main() -> int:
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    results = []

    steps = [
        ("frontend_typecheck_and_build", [npm_cmd, "run", "build"], 120),
        ("short01_regression_suite", [sys.executable, "tests/run_all.py"], 300),
        ("short02_unit_tests", ["node", "--test", "tests/unit/test_short02_backend.mjs"], 120),
        ("short02_api_integration", ["node", "--test", "tests/integration/test_short02_api.mjs"], 240),
        ("short02_playwright_e2e", ["node", "tests/e2e/test_studio_e2e.mjs"], 240),
    ]

    for name, cmd, timeout_s in steps:
        res = run_step(name, cmd, timeout_s=timeout_s)
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


if __name__ == "__main__":
    sys.exit(main())
