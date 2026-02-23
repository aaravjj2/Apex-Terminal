#!/usr/bin/env python3
"""
Wave 123 — Submission compliance check.

Validates that all Devpost submission requirements are met.

Usage:
    python scripts/check_submission_compliance.py
"""
from __future__ import annotations

import sys
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent

CHECKS = [
    # (description, path_or_condition)
    ("LICENSE file exists", "LICENSE"),
    ("README.md exists", "README.md"),
    ("docs/ARCHITECTURE.md exists", "docs/ARCHITECTURE.md"),
    ("docs/submission/CHECKLIST.md exists", "docs/submission/CHECKLIST.md"),
    ("docs/submission/TERRACODE.md exists", "docs/submission/TERRACODE.md"),
    ("docs/submission/ELASTIHACK.md exists", "docs/submission/ELASTIHACK.md"),
    ("docs/submission/TERRACODE_DEMO_SCRIPT.md exists", "docs/submission/TERRACODE_DEMO_SCRIPT.md"),
    ("docs/submission/ELASTIHACK_DEMO_SCRIPT.md exists", "docs/submission/ELASTIHACK_DEMO_SCRIPT.md"),
    ("docs/RUN_LOCAL.md exists", "docs/RUN_LOCAL.md"),
    ("docker-compose.judge.yml exists", "docker-compose.judge.yml"),
    ("scripts/bootstrap_keys_example.sh exists", "scripts/bootstrap_keys_example.sh"),
    ("docs/ops/SLO.md exists", "docs/ops/SLO.md"),
    ("docs/ops/TROUBLESHOOTING.md exists", "docs/ops/TROUBLESHOOTING.md"),
    ("docs/ops/JUDGE_MODE.md exists", "docs/ops/JUDGE_MODE.md"),
    ("docs/ONBOARDING.md exists", "docs/ONBOARDING.md"),
    ("proof/determinism-run1.json exists", "proof/determinism-run1.json"),
    ("proof/determinism-run2.json exists", "proof/determinism-run2.json"),
    ("proof/determinism-diff.txt exists", "proof/determinism-diff.txt"),
]


def check_architecture_has_mermaid(workspace: Path) -> tuple[bool, str]:
    arch_path = workspace / "docs" / "ARCHITECTURE.md"
    if not arch_path.exists():
        return False, "docs/ARCHITECTURE.md not found"
    content = arch_path.read_text()
    if "```mermaid" not in content:
        return False, "docs/ARCHITECTURE.md has no Mermaid diagram"
    return True, "docs/ARCHITECTURE.md has Mermaid diagram"


def check_license_is_osi(workspace: Path) -> tuple[bool, str]:
    lic_path = workspace / "LICENSE"
    if not lic_path.exists():
        return False, "LICENSE not found"
    content = lic_path.read_text()
    if "MIT" in content or "Apache" in content or "GPL" in content:
        return True, "LICENSE is OSI-approved"
    return False, "LICENSE may not be OSI-approved (check content)"


def main() -> int:
    failures: list[str] = []
    passes: list[str] = []

    # File existence checks
    for description, rel_path in CHECKS:
        full_path = WORKSPACE / rel_path
        if full_path.exists():
            passes.append(f"✅ {description}")
        else:
            failures.append(f"❌ {description} — missing: {rel_path}")

    # Content checks
    ok, msg = check_architecture_has_mermaid(WORKSPACE)
    (passes if ok else failures).append(("✅ " if ok else "❌ ") + msg)

    ok, msg = check_license_is_osi(WORKSPACE)
    (passes if ok else failures).append(("✅ " if ok else "❌ ") + msg)

    # Print results
    for p in passes:
        print(p)
    if failures:
        print()
        for f in failures:
            print(f)
        print(f"\n❌ {len(failures)} compliance check(s) failed.")
        return 1
    else:
        print(f"\n✅ All {len(passes)} compliance checks passed.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
