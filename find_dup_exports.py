"""
Find all tsx files with duplicate export function declarations.
Also find files where the dup exports problem escaped the previous fixer
because they don't have misplaced import React.
"""
import os, re

PAGES_DIR = r"C:\Tradingview\Tradingview recreation\frontend\src\ui2\pages"
files = sorted(f for f in os.listdir(PAGES_DIR) if f.endswith('.tsx'))

problems = []
for fname in files:
    path = os.path.join(PAGES_DIR, fname)
    lines = open(path, encoding='utf-8', errors='replace').readlines()
    
    # Find all export function names and positions
    export_names = []
    export_lines = []
    for i, l in enumerate(lines):
        m = re.match(r'^export\s+(default\s+)?function\s+(\w+)', l)
        if m:
            export_names.append(m.group(2))
            export_lines.append(i+1)
    
    dups = [n for n in set(export_names) if export_names.count(n) > 1]
    if dups:
        problems.append((fname, dups, export_lines))
        print(f"{fname}: duplicate {dups} at lines {export_lines}")

print(f"\nTotal files with duplicate exports: {len(problems)}")
