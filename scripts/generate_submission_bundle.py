#!/usr/bin/env python3
"""
Wave 126 — Submission bundle generator.

Creates submission_bundle.zip containing:
  - README.md
  - LICENSE
  - docs/ARCHITECTURE.md
  - docs/submission/ (all files)
  - docs/RUN_LOCAL.md
  - docs/ops/ (SLO.md + JUDGE_MODE.md)
  - proof/ (determinism JSON + diff)
  - docs/ONBOARDING.md

Usage:
    python scripts/generate_submission_bundle.py
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent

BUNDLE_FILES = [
    "README.md",
    "LICENSE",
    "docs/ARCHITECTURE.md",
    "docs/RUN_LOCAL.md",
    "docs/ONBOARDING.md",
    "docs/ops/SLO.md",
    "docs/ops/JUDGE_MODE.md",
    "docs/ops/TROUBLESHOOTING.md",
    "docs/ops/RESET.md",
    "docs/submission/CHECKLIST.md",
    "docs/submission/TERRACODE.md",
    "docs/submission/ELASTIHACK.md",
    "docs/submission/TERRACODE_DEMO_SCRIPT.md",
    "docs/submission/ELASTIHACK_DEMO_SCRIPT.md",
    "proof/determinism-run1.json",
    "proof/determinism-run2.json",
    "proof/determinism-diff.txt",
]

OUTPUT_ZIP = WORKSPACE / "submission_bundle.zip"


def main() -> int:
    missing: list[str] = []
    included: list[str] = []

    with zipfile.ZipFile(OUTPUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel in BUNDLE_FILES:
            src = WORKSPACE / rel
            if src.exists():
                zf.write(src, rel)
                included.append(rel)
            else:
                missing.append(rel)

    print(f"✅ Bundle created: {OUTPUT_ZIP}")
    print(f"   Included {len(included)} files")

    if missing:
        print(f"\n⚠️  {len(missing)} file(s) not found (skipped):")
        for m in missing:
            print(f"   - {m}")

    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
