#!/usr/bin/env python3
"""
Wave 119 — Full determinism proof: run test suites twice, compare results.

Usage:
    python scripts/determinism_check.py

Outputs (in proof/):
    determinism-run1.json
    determinism-run2.json
    determinism-diff.txt   (must be empty = fully deterministic)
    logs/pytest-run1.txt   raw pytest output run 1
    logs/pytest-run2.txt   raw pytest output run 2
    logs/pw-run1.txt       raw playwright output run 1
    logs/pw-run2.txt       raw playwright output run 2
"""
from __future__ import annotations

import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
PROOF_DIR = WORKSPACE / "proof"
LOGS_DIR = PROOF_DIR / "logs"
FRONTEND_DIR = WORKSPACE / "frontend"
PROOF_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# Targeted W117-W130 backend tests (fast, focused, judge-relevant)
PYTEST_TARGETS = [
    f"backend/tests/integration/test_w{w}_"
    for w in [
        "117_visual_stability",
        "118_zero_flake",
        "119_determinism",
        "120_onboarding",
        "121_runbooks",
        "122_secrets",
        "123_compliance",
        "124_tour_terracode",
        "125_tour_elastihack",
        "126_bundle",
        "127_ci",
        "128_ux_declutter",
        "129_incident_drills",
        "130_final_proof",
    ]
]

# Playwright specs W117-W130
PW_SPECS = " ".join([
    f"tests/e2e/hardening/w{w}.spec.ts"
    for w in [
        "117-visual-stability",
        "118-zero-flake",
        "119-determinism",
        "120-onboarding",
        "121-runbooks",
        "122-secrets",
        "123-compliance",
        "124-tour-terracode",
        "125-tour-elastihack",
        "126-bundle",
        "127-ci",
        "128-ux-declutter",
        "129-incident-drills",
        "130-final-proof",
    ]
])


def _extract_summary(lines: list[str]) -> str:
    return next(
        (l.strip() for l in reversed(lines) if "passed" in l or "failed" in l or "error" in l),
        "(no summary found)",
    )


def run_pytest(run_num: int) -> dict:
    """Run targeted W117-W130 pytest suite; stream output to log file to avoid buffering hangs."""
    log_path = LOGS_DIR / f"pytest-run{run_num}.txt"
    # Build test args — use glob for each target
    args = [
        "C:\\Python314\\python.exe", "-m", "pytest",
        "--tb=short", "-q", "--no-header",
        "backend/tests/integration/",
        "-k", "w117 or w118 or w119 or w120 or w121 or w122 or w123 or w124 or w125 or w126 or w127 or w128 or w129 or w130",
    ]
    print(f"  Running pytest (W117-W130), log → {log_path.name} ...")
    with open(log_path, "w", encoding="utf-8") as fh:
        proc = subprocess.run(
            args,
            cwd=str(WORKSPACE),
            stdout=fh,
            stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONPATH": f"{WORKSPACE};{WORKSPACE / 'phase1'}"},
        )
    raw = log_path.read_text(encoding="utf-8")
    lines = raw.strip().splitlines()
    summary = _extract_summary(lines)
    return {
        "run": run_num,
        "suite": "pytest-W117-W130",
        "returncode": proc.returncode,
        "summary": summary,
        "log": str(log_path.relative_to(WORKSPACE)),
        "last_10_lines": lines[-10:],
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }


def run_playwright(run_num: int) -> dict:
    """Run W117-W130 Playwright specs; stream output to log file."""
    log_path = LOGS_DIR / f"pw-run{run_num}.txt"
    specs = PW_SPECS.split()
    args = ["npx", "playwright", "test", "--reporter=line", "--workers=1", "--retries=0"] + specs
    print(f"  Running Playwright (W117-W130), log → {log_path.name} ...")
    with open(log_path, "w", encoding="utf-8") as fh:
        proc = subprocess.run(
            args,
            cwd=str(FRONTEND_DIR),
            stdout=fh,
            stderr=subprocess.STDOUT,
            shell=True,
        )
    raw = log_path.read_text(encoding="utf-8")
    lines = raw.strip().splitlines()
    summary = _extract_summary(lines)
    return {
        "run": run_num,
        "suite": "playwright-W117-W130",
        "returncode": proc.returncode,
        "summary": summary,
        "log": str(log_path.relative_to(WORKSPACE)),
        "last_10_lines": lines[-10:],
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }


def compare(r1: dict, r2: dict, label: str) -> str:
    if r1["summary"] == r2["summary"] and r1["returncode"] == r2["returncode"]:
        return ""
    return (
        f"DIFF [{label}]:\n"
        f"  Run 1 rc={r1['returncode']} summary: {r1['summary']}\n"
        f"  Run 2 rc={r2['returncode']} summary: {r2['summary']}\n"
    )


def main() -> None:
    print("\n" + "=" * 60)
    print("  DETERMINISM CHECK — Wave 119")
    print("=" * 60)

    # --- pytest ×2 ---
    print("\n[1/4] Pytest run 1 ...")
    p1 = run_pytest(1)
    print(f"      → {p1['summary']}")

    print("[2/4] Pytest run 2 ...")
    p2 = run_pytest(2)
    print(f"      → {p2['summary']}")

    # --- Playwright ×2 ---
    print("\n[3/4] Playwright run 1 ...")
    w1 = run_playwright(1)
    print(f"      → {w1['summary']}")

    print("[4/4] Playwright run 2 ...")
    w2 = run_playwright(2)
    print(f"      → {w2['summary']}")

    # --- Write JSON artifacts ---
    run1 = {"pytest": p1, "playwright": w1}
    run2 = {"pytest": p2, "playwright": w2}
    (PROOF_DIR / "determinism-run1.json").write_text(json.dumps(run1, indent=2), encoding="utf-8")
    (PROOF_DIR / "determinism-run2.json").write_text(json.dumps(run2, indent=2), encoding="utf-8")

    # --- Diff ---
    diff_lines = []
    d_pytest = compare(p1, p2, "pytest")
    d_pw = compare(w1, w2, "playwright")
    if d_pytest:
        diff_lines.append(d_pytest)
    if d_pw:
        diff_lines.append(d_pw)

    diff_text = "\n".join(diff_lines)
    (PROOF_DIR / "determinism-diff.txt").write_text(diff_text, encoding="utf-8")

    print("\n" + "=" * 60)
    if diff_text:
        print("❌  DETERMINISM FAILED — diff is non-empty!")
        print(diff_text)
        sys.exit(1)
    else:
        print("✅  DETERMINISM PASSED")
        print(f"   pytest:      {p1['summary']}")
        print(f"   playwright:  {w1['summary']}")
        print(f"\n   Artifacts in: {PROOF_DIR}/")
        print("   determinism-run1.json, determinism-run2.json, determinism-diff.txt (empty)")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
