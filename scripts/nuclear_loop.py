#!/usr/bin/env python3
"""
nuclear_loop.py — Autonomous Nuclear Judge Loop

Runs evaluate_apex_brutal.py in a loop, tracking scores across runs.
Stops after N consecutive passes (all hackathons >= threshold) or K total runs.

Usage:
    python scripts/nuclear_loop.py                    # 5 runs, threshold 9.5
    python scripts/nuclear_loop.py --runs 10          # 10 total runs
    python scripts/nuclear_loop.py --threshold 10.0   # require perfect 10s
    python scripts/nuclear_loop.py --consecutive 5    # 5 consecutive passes needed
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JUDGE_SCRIPT = ROOT / "evaluate_apex_brutal.py"
RESULTS_FILE = ROOT / "nuclear_evaluation.json"
LOOP_LOG = ROOT / "nuclear_loop_results.json"

HACKATHONS = ["elasticsearch", "terracode", "dsoc"]


def run_judge() -> dict:
    """Run the brutal judge and return parsed results."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / "phase1")
    
    result = subprocess.run(
        [sys.executable, str(JUDGE_SCRIPT)],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    
    if not RESULTS_FILE.exists():
        return {"error": "No results file produced", "returncode": result.returncode}
    
    with open(RESULTS_FILE) as f:
        return json.load(f)


def check_pass(results: dict, threshold: float) -> bool:
    """Check if all target hackathons meet the threshold."""
    scores = results.get("scores", {})
    for h in HACKATHONS:
        entry = scores.get(h, {})
        if entry.get("dealbreaker", False):
            return False
        if entry.get("score", 0) < threshold:
            return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Nuclear Judge Loop")
    parser.add_argument("--runs", type=int, default=5, help="Max total runs (default: 5)")
    parser.add_argument("--threshold", type=float, default=9.5, help="Min score threshold (default: 9.5)")
    parser.add_argument("--consecutive", type=int, default=3, help="Consecutive passes needed (default: 3)")
    args = parser.parse_args()

    print("=" * 70)
    print("  NUCLEAR LOOP — Autonomous Judge Runner")
    print("=" * 70)
    print(f"  Max runs:          {args.runs}")
    print(f"  Threshold:         {args.threshold}")
    print(f"  Consecutive needed: {args.consecutive}")
    print("=" * 70)

    all_results = []
    consecutive_passes = 0
    
    for run_num in range(1, args.runs + 1):
        print(f"\n{'─' * 50}")
        print(f"  RUN {run_num}/{args.runs}  (consecutive passes: {consecutive_passes}/{args.consecutive})")
        print(f"{'─' * 50}")
        
        start = time.time()
        try:
            results = run_judge()
        except subprocess.TimeoutExpired:
            print("  ✗ TIMEOUT — judge took >600s")
            results = {"error": "timeout"}
            consecutive_passes = 0
            all_results.append({"run": run_num, "error": "timeout", "ts": datetime.now().isoformat()})
            continue
        except Exception as e:
            print(f"  ✗ ERROR — {e}")
            results = {"error": str(e)}
            consecutive_passes = 0
            all_results.append({"run": run_num, "error": str(e), "ts": datetime.now().isoformat()})
            continue
        
        elapsed = time.time() - start
        scores = results.get("scores", {})
        
        run_entry = {
            "run": run_num,
            "ts": datetime.now().isoformat(),
            "elapsed_s": round(elapsed, 1),
            "scores": {},
            "passed": False,
        }
        
        print(f"  Time: {elapsed:.1f}s")
        all_pass = True
        for h in HACKATHONS:
            entry = scores.get(h, {})
            score = entry.get("score", 0)
            dealbreaker = entry.get("dealbreaker", False)
            status = "✓" if score >= args.threshold and not dealbreaker else "✗"
            print(f"  {status} {h}: {score}/10{' DEALBREAKER' if dealbreaker else ''}")
            run_entry["scores"][h] = {"score": score, "dealbreaker": dealbreaker}
            if score < args.threshold or dealbreaker:
                all_pass = False
        
        if all_pass:
            consecutive_passes += 1
            run_entry["passed"] = True
            print(f"  ✓ PASS ({consecutive_passes}/{args.consecutive} consecutive)")
        else:
            consecutive_passes = 0
            print(f"  ✗ FAIL — reset consecutive counter")
        
        all_results.append(run_entry)
        
        # Save progress
        loop_data = {
            "threshold": args.threshold,
            "consecutive_needed": args.consecutive,
            "total_runs": run_num,
            "consecutive_passes": consecutive_passes,
            "achieved": consecutive_passes >= args.consecutive,
            "runs": all_results,
        }
        with open(LOOP_LOG, "w") as f:
            json.dump(loop_data, f, indent=2)
        
        if consecutive_passes >= args.consecutive:
            print(f"\n{'=' * 70}")
            print(f"  VICTORY — {args.consecutive} consecutive passes at {args.threshold}+ threshold")
            print(f"{'=' * 70}")
            print(f"  Runs: {run_num}")
            print(f"  Log:  {LOOP_LOG}")
            return 0
    
    print(f"\n{'=' * 70}")
    total_passes = sum(1 for r in all_results if r.get("passed"))
    if consecutive_passes >= args.consecutive:
        print(f"  VICTORY — {args.consecutive} consecutive passes achieved")
    else:
        print(f"  INCOMPLETE — {consecutive_passes}/{args.consecutive} consecutive (best streak)")
        print(f"  Total passes: {total_passes}/{len(all_results)}")
    print(f"  Log: {LOOP_LOG}")
    print(f"{'=' * 70}")
    return 0 if consecutive_passes >= args.consecutive else 1


if __name__ == "__main__":
    sys.exit(main())
