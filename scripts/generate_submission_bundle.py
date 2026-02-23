#!/usr/bin/env python3
"""
generate_submission_bundle.py
=============================
Creates artifacts/submission_bundle.zip from the staging directory.

After creation, runs a mandatory verification step:
  - Lists all archive members
  - Asserts required paths are present (screenshots/*.png >= 10, TOUR.webm >= 1 MB, etc.)
  - Exits non-zero if any requirement is missing

Usage:
    python scripts/generate_submission_bundle.py
    python scripts/generate_submission_bundle.py --staging-dir artifacts/submission_bundle_staging
    python scripts/generate_submission_bundle.py --verify-only
"""
from __future__ import annotations

import argparse
import fnmatch
import sys
import zipfile
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Paths (all relative to repo root)
# ──────────────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
STAGING_DIR = REPO_ROOT / "artifacts" / "submission_bundle_staging"
OUTPUT_ZIP = REPO_ROOT / "artifacts" / "submission_bundle.zip"

# ──────────────────────────────────────────────────────────────────────────────
# Required entries in the final zip
# ──────────────────────────────────────────────────────────────────────────────
REQUIRED_ENTRIES = [
    "TOUR.webm",
    "MANIFEST.md",
    "proof/determinism-run1.json",
    "proof/determinism-run2.json",
    "proof/determinism-diff.txt",
    "docs/submission/CHECKLIST.md",
    "docs/submission/TERRACODE_DEMO_SCRIPT.md",
    "docs/submission/ELASTIHACK_DEMO_SCRIPT.md",
]

MIN_SCREENSHOTS = 10
SCREENSHOT_GLOB = "screenshots/*.png"
TOUR_MIN_BYTES = 1 * 1024 * 1024  # 1 MB


def build_zip(staging_dir: Path, output_zip: Path) -> None:
    """Walk staging_dir and add every file into output_zip."""
    if not staging_dir.exists():
        print(f"ERROR: Staging directory not found: {staging_dir}", file=sys.stderr)
        sys.exit(1)

    output_zip.parent.mkdir(parents=True, exist_ok=True)

    file_count = 0
    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for abs_path in sorted(staging_dir.rglob("*")):
            if abs_path.is_file():
                # Archive name = path relative to staging_dir, using forward slashes
                arc_name = abs_path.relative_to(staging_dir).as_posix()
                zf.write(abs_path, arc_name)
                size_kb = abs_path.stat().st_size / 1024
                print(f"  + {arc_name}  ({size_kb:.1f} KB)")
                file_count += 1

    total_mb = output_zip.stat().st_size / (1024 * 1024)
    print(f"\n✓ Archive created: {output_zip}")
    print(f"  {file_count} files, {total_mb:.2f} MB total")


def verify_zip(output_zip: Path) -> bool:
    """
    Open the zip and assert all required entries are present.
    Returns True if all checks pass; prints errors and returns False otherwise.
    """
    if not output_zip.exists():
        print(f"ERROR: Archive not found: {output_zip}", file=sys.stderr)
        return False

    with zipfile.ZipFile(output_zip, "r") as zf:
        members = set(zf.namelist())
        info_map = {i.filename: i for i in zf.infolist()}

        print("\n── Archive contents ───────────────────────────────────────")
        for name in sorted(members):
            size_kb = info_map[name].file_size / 1024
            print(f"  {name}  ({size_kb:.1f} KB)")
        print("─────────────────────────────────────────────────────────\n")

        errors: list[str] = []

        # 1. Check each required entry
        for req in REQUIRED_ENTRIES:
            if req not in members:
                errors.append(f"MISSING required entry: {req}")
            else:
                print(f"  ✓ {req}")

        # 2. Check screenshots count
        screenshot_files = [
            m for m in members if fnmatch.fnmatch(m, SCREENSHOT_GLOB)
        ]
        if len(screenshot_files) < MIN_SCREENSHOTS:
            errors.append(
                f"INSUFFICIENT screenshots: found {len(screenshot_files)}, "
                f"need >= {MIN_SCREENSHOTS}. Found: {screenshot_files}"
            )
        else:
            print(f"  ✓ screenshots/ count = {len(screenshot_files)} (>= {MIN_SCREENSHOTS})")

        # 3. Check TOUR.webm size
        if "TOUR.webm" in members:
            tour_bytes = info_map["TOUR.webm"].file_size
            if tour_bytes < TOUR_MIN_BYTES:
                errors.append(
                    f"TOUR.webm too small: {tour_bytes} bytes "
                    f"(need >= {TOUR_MIN_BYTES} bytes / 1 MB)"
                )
            else:
                print(f"  ✓ TOUR.webm size = {tour_bytes / (1024 * 1024):.2f} MB")

        if errors:
            print("\n── VERIFICATION FAILED ────────────────────────────────────")
            for e in errors:
                print(f"  ✗ {e}", file=sys.stderr)
            print("─────────────────────────────────────────────────────────")
            return False

        print("\n── VERIFICATION PASSED ────────────────────────────────────")
        print("  All required entries present and size checks pass.")
        print("─────────────────────────────────────────────────────────")
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and verify submission_bundle.zip")
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=STAGING_DIR,
        help="Path to staging directory (default: artifacts/submission_bundle_staging)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_ZIP,
        help="Output zip path (default: artifacts/submission_bundle.zip)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Skip build; only run verification on an existing zip",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Apex Terminal — Submission Bundle Generator")
    print("=" * 60)

    if not args.verify_only:
        print(f"\nBuilding archive from: {args.staging_dir}")
        build_zip(args.staging_dir, args.output)

    print(f"\nVerifying archive: {args.output}")
    ok = verify_zip(args.output)

    if not ok:
        sys.exit(1)

    print("\n✓ Bundle generation complete — archive is Devpost-ready.")
    sys.exit(0)


if __name__ == "__main__":
    main()
