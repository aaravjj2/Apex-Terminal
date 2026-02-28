#!/usr/bin/env python3
"""
W90 Scanner: Detect forbidden patterns in Playwright hardening specs.
Forbidden: getByText, getByRole, waitForTimeout (fragile selectors).
Scans: frontend/tests/e2e/hardening/*.spec.ts only (wave-specific tests).
Exit code 0 = clean. Exit code 1 = violations found.
"""
import sys
import re
from pathlib import Path

# Patterns that indicate fragile tests
FORBIDDEN = [
    (r'\.getByText\s*\(', 'getByText()  use data-testid selector instead'),
    (r'\.getByRole\s*\(', 'getByRole()  use data-testid selector instead'),
    (r'\.getByLabel\s*\(', 'getByLabel()  use data-testid selector instead'),
    (r'\.getByPlaceholder\s*\(', 'getByPlaceholder()  use data-testid selector instead'),
    (r'waitForTimeout\s*\(', 'waitForTimeout()  use waitForSelector or waitForURL instead'),
]


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_number, matched_pattern_description, line_text)."""
    violations = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        # Skip comment lines
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue
        for pattern, description in FORBIDDEN:
            if re.search(pattern, line):
                violations.append((i, description, stripped[:80]))
    return violations


def main() -> int:
    root = Path(__file__).parent.parent
    hardening_dir = root / "frontend" / "tests" / "e2e" / "hardening"

    if not hardening_dir.exists():
        print(f"ERROR: hardening dir not found: {hardening_dir}", file=sys.stderr)
        return 1

    spec_files = sorted(hardening_dir.glob("*.spec.ts"))
    if not spec_files:
        print("ERROR: no hardening spec files found", file=sys.stderr)
        return 1

    all_violations: list[tuple[Path, int, str, str]] = []
    for f in spec_files:
        for line_no, desc, text in scan_file(f):
            all_violations.append((f, line_no, desc, text))

    if all_violations:
        print(f"FAIL: {len(all_violations)} forbidden pattern(s) found in hardening specs:")
        for path, line, desc, text in all_violations:
            rel = path.relative_to(root)
            print(f"  {rel}:{line}  [{desc}]")
            print(f"    {text}")
        return 1

    print(f"OK: {len(spec_files)} hardening specs scanned, 0 violations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
