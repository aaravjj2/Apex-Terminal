#!/usr/bin/env python3
"""
Wave 122 — Secret scan: fail if secrets are detected in repo files.

Scans all non-ignored files for known secret patterns.
Excludes keys.env, keys.env.example, and .git directory.

Usage:
    python scripts/check_secrets.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent

# Patterns that indicate hard-coded secrets
SECRET_PATTERNS = [
    (r'APCA-API-KEY-ID\s*=\s*PK[A-Z0-9]{18,}', "Alpaca live API key"),
    (r'APCA-API-SECRET-KEY\s*=\s*[A-Za-z0-9/+]{40,}', "Alpaca secret key"),
    (r'sk-[A-Za-z0-9]{32,}', "OpenAI API key"),
    (r'ghp_[A-Za-z0-9]{36}', "GitHub personal access token"),
    (r'password\s*=\s*[\'"][^\'"\s]{8,}[\'"]', "Hard-coded password"),
]

# Files/directories to skip
SKIP_PATHS = {
    "keys.env",
    "keys.env.example",
    ".git",
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    "playwright-report",
    "test-results",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webm", ".mp4",
    ".zip", ".pyc", ".lock", ".bin", ".db",
}


def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_PATHS:
            return True
    return path.suffix.lower() in SKIP_EXTENSIONS


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    violations = []
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(content.splitlines(), 1):
            for pattern, label in SECRET_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    violations.append((lineno, label, line.strip()[:80]))
    except Exception:
        pass
    return violations


def main() -> int:
    all_violations: list[tuple[Path, int, str, str]] = []

    for root, dirs, files in os.walk(WORKSPACE):
        root_path = Path(root)
        # Skip hidden and ignored directories in-place
        dirs[:] = [d for d in dirs if d not in SKIP_PATHS and not d.startswith(".")]
        for fname in files:
            fpath = root_path / fname
            rel = fpath.relative_to(WORKSPACE)
            if should_skip(rel):
                continue
            for lineno, label, snippet in scan_file(fpath):
                all_violations.append((rel, lineno, label, snippet))

    if all_violations:
        print(f"❌ {len(all_violations)} secret(s) detected:\n")
        for path, lineno, label, snippet in all_violations:
            print(f"  {path}:{lineno} — {label}")
            print(f"    {snippet}")
        return 1
    else:
        print("✅ No secrets detected.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
