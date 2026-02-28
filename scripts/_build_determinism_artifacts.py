#!/usr/bin/env python3
"""Build determinism JSON artifacts from actual run log files."""
import datetime
import json
import pathlib
import re

WORKSPACE = pathlib.Path(__file__).resolve().parent.parent
PROOF = WORKSPACE / "proof"
LOGS = PROOF / "logs"
ts = datetime.datetime.now(datetime.timezone.utc).isoformat()


def parse_log(f: pathlib.Path) -> tuple[str, list[str]]:
    # PowerShell Tee-Object writes UTF-16LE; try multiple encodings
    for enc in ("utf-16", "utf-16-le", "utf-8"):
        try:
            text = f.read_text(encoding=enc, errors="replace").strip()
            if text and "\x00" not in text[:20]:
                break
        except Exception:
            continue
    # Strip ANSI escape codes
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    # Collapse wrapped lines into one paragraph for regex search
    flat = " ".join(text.split())
    # Find summary like "121 passed in 79.93s" or "100 passed (31.8s)"
    m = re.search(r'(\d+ passed(?:\s+in\s+[\d.s():/]+)?)', flat)
    full_summary = m.group(1).strip() if m else "(no summary found)"
    # For determinism comparison, use only counts (not timing)
    count_m = re.search(r'(\d+) passed', flat)
    count_summary = f"{count_m.group(1)} passed" if count_m else full_summary
    return full_summary, count_summary, text.splitlines()[-10:]


p1_full, p1_sum, p1_tail = parse_log(LOGS / "pytest-run1.txt")
p2_full, p2_sum, p2_tail = parse_log(LOGS / "pytest-run2.txt")
w1_full, w1_sum, w1_tail = parse_log(LOGS / "pw-run1.txt")
w2_full, w2_sum, w2_tail = parse_log(LOGS / "pw-run2.txt")

run1 = {
    "generated_at": ts,
    "pytest":      {"run": 1, "count_summary": p1_sum, "full_summary": p1_full, "last_10": p1_tail, "log": "proof/logs/pytest-run1.txt"},
    "playwright":  {"run": 1, "count_summary": w1_sum, "full_summary": w1_full, "last_10": w1_tail, "log": "proof/logs/pw-run1.txt"},
}
run2 = {
    "generated_at": ts,
    "pytest":      {"run": 2, "count_summary": p2_sum, "full_summary": p2_full, "last_10": p2_tail, "log": "proof/logs/pytest-run2.txt"},
    "playwright":  {"run": 2, "count_summary": w2_sum, "full_summary": w2_full, "last_10": w2_tail, "log": "proof/logs/pw-run2.txt"},
}

(PROOF / "determinism-run1.json").write_text(json.dumps(run1, indent=2), encoding="utf-8")
(PROOF / "determinism-run2.json").write_text(json.dumps(run2, indent=2), encoding="utf-8")

diffs: list[str] = []
# Compare only counts (timing legitimately differs)
if p1_sum != p2_sum:
    diffs.append(f"PYTEST COUNT DIFF:\n  run1: {p1_sum}\n  run2: {p2_sum}")
if w1_sum != w2_sum:
    diffs.append(f"PLAYWRIGHT COUNT DIFF:\n  run1: {w1_sum}\n  run2: {w2_sum}")

diff_text = "\n".join(diffs)
(PROOF / "determinism-diff.txt").write_text(diff_text, encoding="utf-8")

print("=" * 60)
if diff_text:
    print("DETERMINISM FAIL — diff is non-empty!")
    print(diff_text)
else:
    print("DETERMINISM PASS")
    print(f"  pytest run1:      {p1_full}")
    print(f"  pytest run2:      {p2_full}")
    print(f"  playwright run1:  {w1_full}")
    print(f"  playwright run2:  {w2_full}")
    print()
    print(f"  count comparison: pytest={p1_sum} == {p2_sum}")
    print(f"  count comparison: playwright={w1_sum} == {w2_sum}")
    print()
    print("  proof/determinism-run1.json  written")
    print("  proof/determinism-run2.json  written")
    print("  proof/determinism-diff.txt   written (empty = PASS)")
print("=" * 60)
