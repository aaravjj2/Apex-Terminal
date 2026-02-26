#!/usr/bin/env python3
"""
W01 Judge Loop Driver
=====================
Autonomous loop that:
1. Verifies services are running (ES, Backend, Frontend preview)
2. Runs preflight probes against all ops endpoints
3. Runs the W01 judge (evaluate_apex_w01.py)
4. Captures all outputs into artifacts/proof/w01/
5. Iterates up to 25 times until 3 consecutive passes
"""

import subprocess
import requests
import json
import sys
import os
import shutil
import time
from pathlib import Path
from datetime import datetime, timezone

# ── CONFIG ────────────────────────────────────────────────────
REPO      = Path(r"C:\Tradingview\Tradingview recreation")
PYTHON    = os.getenv("PYTHON_EXE", r"C:\Python314\python.exe")
BE_URL    = os.getenv("APEX_BACKEND_URL",  "http://localhost:8000")
FE_URL    = os.getenv("APEX_FRONTEND_URL", "http://localhost:5100")
ES_URL    = os.getenv("APEX_ES_URL",       "http://localhost:9200")
MAX_ITERS = 25
REQUIRED_CONSECUTIVE = 3

PROOF_DIR = REPO / "artifacts" / "proof" / "w01"


def ts():
    return datetime.now().strftime("%Y%m%dT%H%M%S")


def probe(name, url, timeout=5):
    """Check if a service is reachable."""
    try:
        r = requests.get(url, timeout=timeout)
        print(f"  ✓ {name}: {r.status_code}")
        return True
    except Exception as e:
        print(f"  ✗ {name}: {e}")
        return False


def preflight():
    """Run preflight probes against all W01 endpoints."""
    print("\n━━━ PREFLIGHT PROBES ━━━")
    results = {}
    
    probes = [
        ("Elasticsearch",       f"{ES_URL}/_cluster/health"),
        ("Backend /docs",       f"{BE_URL}/docs"),
        ("Frontend",            FE_URL),
        ("/api/ops/version",    f"{BE_URL}/api/ops/version"),
        ("/api/ops/elastic",    f"{BE_URL}/api/ops/elastic/health"),
        ("/api/ops/broker",     f"{BE_URL}/api/ops/broker/health"),
        ("/api/ops/ws",         f"{BE_URL}/api/ops/ws/health"),
        ("/api/ops/market_sess",f"{BE_URL}/api/ops/market_session"),
        ("/api/v1/market/quote",f"{BE_URL}/api/v1/market/quote?symbol=AAPL"),
    ]
    
    all_ok = True
    for name, url in probes:
        ok = probe(name, url)
        results[name] = ok
        if not ok:
            all_ok = False
    
    return all_ok, results


def run_judge(iter_dir):
    """Run evaluate_apex_w01.py and capture output."""
    print("\n━━━ RUNNING W01 JUDGE ━━━")
    judge_script = REPO / "evaluate_apex_w01.py"
    
    try:
        result = subprocess.run(
            [PYTHON, str(judge_script)],
            cwd=str(REPO),
            capture_output=True,
            text=True,
            timeout=120,
            env={**os.environ,
                 "APEX_REPO_PATH": str(REPO),
                 "APEX_BACKEND_URL": BE_URL,
                 "APEX_FRONTEND_URL": FE_URL,
                 "APEX_ES_URL": ES_URL}
        )
        
        stdout = result.stdout
        stderr = result.stderr
        exit_code = result.returncode
        
        # Save stdout
        (iter_dir / "judge_stdout.txt").write_text(stdout + "\n---STDERR---\n" + stderr,
                                                     encoding="utf-8")
        
        # Copy judge result JSON if it exists
        judge_json = REPO / "w01_judge_result.json"
        if judge_json.exists():
            shutil.copy2(judge_json, iter_dir / "judge_result.json")
            data = json.loads(judge_json.read_text(encoding="utf-8"))
            return data, exit_code
        
        return None, exit_code
        
    except subprocess.TimeoutExpired:
        print("  ✗ Judge timed out (>120s)")
        (iter_dir / "judge_stdout.txt").write_text("TIMEOUT", encoding="utf-8")
        return None, -1
    except Exception as e:
        print(f"  ✗ Judge error: {e}")
        return None, -2


def print_judge_summary(data):
    """Print a summary of judge results."""
    if not data:
        print("  No judge data available")
        return
    
    score = data.get("score", 0)
    passed = data.get("gates_passed", 0)
    total = data.get("total_gates", 0)
    all_green = data.get("all_green", False)
    criticisms = data.get("criticisms", [])
    
    status = "✓ ALL GREEN" if all_green else f"✗ {len(criticisms)} criticisms"
    print(f"\n  Score: {score}/10  ({passed}/{total} gates)  {status}")
    
    if criticisms:
        print("  Criticisms:")
        for c in criticisms[:10]:
            print(f"    • [{c.get('gate', '?')}] {c.get('name', '?')}")
    
    return all_green


def main():
    print("═" * 68)
    print("  APEX TERMINAL — W01 JUDGE LOOP DRIVER")
    print(f"  Max iterations: {MAX_ITERS}")
    print(f"  Required consecutive passes: {REQUIRED_CONSECUTIVE}")
    print("═" * 68)
    
    # Create proof directory
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    
    consecutive_passes = 0
    all_results = []
    
    for iteration in range(1, MAX_ITERS + 1):
        print(f"\n{'━' * 68}")
        print(f"  ITERATION {iteration}/{MAX_ITERS}  "
              f"(consecutive passes: {consecutive_passes}/{REQUIRED_CONSECUTIVE})")
        print(f"{'━' * 68}")
        
        # Create iteration directory
        iter_dir = PROOF_DIR / f"{ts()}-iter{iteration:02d}"
        iter_dir.mkdir(parents=True, exist_ok=True)
        (iter_dir / "gates_logs").mkdir(exist_ok=True)
        
        # Preflight
        pf_ok, pf_results = preflight()
        (iter_dir / "gates_logs" / "preflight.json").write_text(
            json.dumps(pf_results, indent=2), encoding="utf-8")
        
        if not pf_ok:
            print("\n  ⚠ Some preflight probes failed — judge may fail on connectivity gates")
        
        # Run judge
        data, exit_code = run_judge(iter_dir)
        
        if data:
            all_green = print_judge_summary(data)
            all_results.append({
                "iteration": iteration,
                "score": data.get("score", 0),
                "all_green": all_green,
                "criticisms_count": len(data.get("criticisms", [])),
                "timestamp": ts()
            })
            
            if all_green:
                consecutive_passes += 1
                print(f"\n  ✓ PASS #{consecutive_passes}/{REQUIRED_CONSECUTIVE}")
                
                if consecutive_passes >= REQUIRED_CONSECUTIVE:
                    print(f"\n{'═' * 68}")
                    print(f"  ✓ {REQUIRED_CONSECUTIVE} CONSECUTIVE PASSES — W01 COMPLETE!")
                    print(f"{'═' * 68}")
                    
                    # Create FINAL proof directory
                    final_dir = PROOF_DIR / f"{ts()}-FINAL"
                    final_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Copy last judge result
                    if (REPO / "w01_judge_result.json").exists():
                        shutil.copy2(REPO / "w01_judge_result.json",
                                     final_dir / "judge_result.json")
                    
                    # Write manifest
                    manifest = {
                        "week": 1,
                        "objective": "Terminal shell refactor",
                        "iterations_total": iteration,
                        "consecutive_passes": consecutive_passes,
                        "final_score": data.get("score", 0),
                        "all_results": all_results,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    (final_dir / "manifest.json").write_text(
                        json.dumps(manifest, indent=2), encoding="utf-8")
                    
                    (final_dir / "MANIFEST.md").write_text(
                        f"# W01 Proof Pack — FINAL\n\n"
                        f"**Objective:** Terminal shell refactor\n"
                        f"**Score:** {data.get('score', 0)}/10\n"
                        f"**Gates:** {data.get('gates_passed', 0)}/{data.get('total_gates', 0)} PASS\n"
                        f"**Iterations:** {iteration}\n"
                        f"**Consecutive passes:** {consecutive_passes}\n"
                        f"**Timestamp:** {datetime.now(timezone.utc).isoformat()}\n\n"
                        f"## Gate Results\n\n"
                        + "\n".join(
                            f"- {'✓' if g.get('pass') else '✗'} **{gid}**: {g.get('name', '')}"
                            for gid, g in data.get("gates", {}).items()
                        )
                        + "\n", encoding="utf-8")
                    
                    print(f"  Proof pack: {final_dir}")
                    sys.exit(0)
            else:
                consecutive_passes = 0
                
                # Write fix plan for next iteration
                criticisms = data.get("criticisms", [])
                if criticisms:
                    plan = "# Loop Plan — Criticisms → Fixes\n\n"
                    for c in criticisms:
                        plan += f"- [{c.get('gate')}] {c.get('name')}\n"
                        plan += f"  Proof: {c.get('proof', 'N/A')}\n\n"
                    (iter_dir / "loop_plan.md").write_text(plan, encoding="utf-8")
        else:
            print("  ✗ Judge returned no data")
            consecutive_passes = 0
            all_results.append({
                "iteration": iteration,
                "score": 0,
                "all_green": False,
                "error": f"exit_code={exit_code}",
                "timestamp": ts()
            })
    
    # If we get here, we exceeded MAX_ITERS
    print(f"\n{'═' * 68}")
    print(f"  ✗ FAILED — Did not reach {REQUIRED_CONSECUTIVE} consecutive passes in {MAX_ITERS} iterations")
    print(f"{'═' * 68}")
    
    # Save summary
    summary = PROOF_DIR / "loop_summary.json"
    summary.write_text(json.dumps({
        "completed": False,
        "iterations": MAX_ITERS,
        "max_consecutive": max((r.get("score", 0) for r in all_results), default=0),
        "results": all_results
    }, indent=2), encoding="utf-8")
    
    sys.exit(1)


if __name__ == "__main__":
    main()
