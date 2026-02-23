#!/usr/bin/env python3
"""
W90 Scanner: Detect interactive elements missing data-testid in UI2 TSX files.
Handles multi-line JSX by tracking quote/brace depth to find tag boundaries.
Exit code 0 = clean. Exit code 1 = violations found.
"""
import sys
import re
from pathlib import Path

INTERACTIVE_TAGS = frozenset(("button", "input", "select", "textarea"))
EXEMPT_ATTRS = ('type="hidden"', "type='hidden'")


def extract_opening_tag(text: str, start: int) -> str | None:
    i = start
    n = len(text)
    in_double = False
    in_single = False
    brace_depth = 0
    limit = start + 4096
    while i < min(n, limit):
        ch = text[i]
        if in_double:
            if ch == '"':
                in_double = False
        elif in_single:
            if ch == "'":
                in_single = False
        elif brace_depth > 0:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
        else:
            if ch == '"':
                in_double = True
            elif ch == "'":
                in_single = True
            elif ch == '{':
                brace_depth += 1
            elif ch == '/' and i + 1 < n and text[i+1] == '>':
                return text[start:i+2]
            elif ch == '>':
                return text[start:i+1]
        i += 1
    return None


def scan_file(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    violations = []
    line_starts = [0]
    for j, ch in enumerate(text):
        if ch == '\n':
            line_starts.append(j + 1)

    def char_to_line(pos: int) -> int:
        lo, hi = 0, len(line_starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if line_starts[mid] <= pos:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    tag_pattern = re.compile(r'<(' + '|'.join(INTERACTIVE_TAGS) + r')[\s\n/>]')
    for m in tag_pattern.finditer(text):
        tag_text = extract_opening_tag(text, m.start())
        if tag_text is None:
            continue
        if any(ex in tag_text for ex in EXEMPT_ATTRS):
            continue
        if 'data-testid' not in tag_text:
            line_no = char_to_line(m.start())
            snippet = tag_text.split('\n')[0].strip()[:80]
            violations.append((line_no, snippet))
    return violations


def main() -> int:
    root = Path(__file__).parent.parent
    scan_dir = root / "frontend" / "src" / "ui2"
    tsx_files = [
        f for f in sorted(scan_dir.rglob("*.tsx"))
        if "__tests__" not in str(f) and ".test." not in f.name
    ]
    if not tsx_files:
        print("ERROR: no .tsx files found", file=sys.stderr)
        return 1
    all_violations: list[tuple[Path, int, str]] = []
    for f in tsx_files:
        for line_no, snippet in scan_file(f):
            all_violations.append((f, line_no, snippet))
    if all_violations:
        print(f"FAIL: {len(all_violations)} interactive element(s) missing data-testid:")
        for path, line, snippet in all_violations:
            rel = path.relative_to(root)
            print(f"  {rel}:{line}  {snippet}")
        return 1
    print(f"OK: {len(tsx_files)} files scanned, 0 violations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
