"""
Check ALL .tsx files in ui2/pages for syntax errors by attempting to parse them
with the Python AST or by checking key structural issues.
"""
import os
import re

PAGES_DIR = r"C:\Tradingview\Tradingview recreation\frontend\src\ui2\pages"

def check_file(filepath):
    issues = []
    with open(filepath, encoding='utf-8', errors='replace') as f:
        content = f.read()
        lines = content.splitlines()
    
    total = len(lines)
    
    # Check 1: Multiple export function with same name
    export_names = []
    for line in lines:
        m = re.match(r'^export\s+(default\s+)?function\s+(\w+)', line)
        if m:
            export_names.append(m.group(2))
    dups = [n for n in set(export_names) if export_names.count(n) > 1]
    if dups:
        issues.append(f"Duplicate export: {dups}")
    
    # Check 2: import React somewhere that's not at the top (after code)
    first_real_idx = None
    for i, line in enumerate(lines):
        s = line.strip()
        if s and not s.startswith('//') and not s.startswith('*') and not s.startswith('/*'):
            first_real_idx = i
            break
    
    for i, line in enumerate(lines):
        if re.match(r'^import React', line.strip()):
            if first_real_idx is not None and i > first_real_idx + 5:
                issues.append(f"import React at line {i+1} (first real code at {first_real_idx+1})")
            break
    
    # Check 3: Unexpected token - look for orphaned array/object literals at module level
    # Look for lines that start with `[` or with `{` that look like orphaned const blocks
    # after a closing `}` of a component
    # Find the last export function and see if there's non-function code after it
    last_close_brace_idx = None
    for i in range(total - 1, -1, -1):
        if lines[i].strip() == '}':
            last_close_brace_idx = i
            break
    
    if last_close_brace_idx is not None and last_close_brace_idx < total - 2:
        remaining = [l for l in lines[last_close_brace_idx+1:] if l.strip()]
        if remaining:
            issues.append(f"Code after last closing brace (line {last_close_brace_idx+1}): {remaining[0][:60]!r}")
    
    # Check 4: File ends mid-function (unclosed braces)
    depth = 0
    in_str = False
    sc = None
    for ch in content:
        if in_str:
            if ch == '\\': continue
            if ch == sc: in_str = False
        else:
            if ch in ('"', "'", '`'):
                in_str = True; sc = ch
            elif ch == '{': depth += 1
            elif ch == '}': depth -= 1
    
    if depth != 0:
        issues.append(f"Unbalanced braces: depth={depth}")
    
    return issues


def main():
    files = sorted(f for f in os.listdir(PAGES_DIR) if f.endswith('.tsx'))
    print(f"Checking {len(files)} files...\n")
    
    broken = []
    for fname in files:
        fpath = os.path.join(PAGES_DIR, fname)
        issues = check_file(fpath)
        if issues:
            broken.append((fname, issues))
            print(f"  {fname}:")
            for issue in issues:
                print(f"    - {issue}")
    
    print(f"\nTotal broken: {len(broken)}/{len(files)}")
    if not broken:
        print("All files look clean!")


if __name__ == '__main__':
    main()
