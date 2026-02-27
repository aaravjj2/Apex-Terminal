"""
Comprehensive fix for ALL UI2 page files with corruption issues.
Scans all .tsx files for:
1. Import statements NOT at the top (appear after other module-level code)
2. Multiple exports of the same component name (duplicate declarations)
3. Orphaned code after main component ends

For each affected file:
- Move import React to top
- Truncate at end of first exported component function
"""

import os
import re
import sys

PAGES_DIR = r"C:\Tradingview\Tradingview recreation\frontend\src\ui2\pages"


def find_component_end(lines, export_line_idx):
    """
    Given 0-based index of the `export function XXX() {` line,
    count braces to find the matching closing `}` at depth 0.
    Returns 0-based index of the closing line.
    """
    depth = 0
    in_string = False
    string_char = None
    
    for i, line in enumerate(lines[export_line_idx:]):
        actual_idx = export_line_idx + i
        j = 0
        while j < len(line):
            ch = line[j]
            # Skip single-line comments
            if not in_string and j + 1 < len(line) and line[j:j+2] == '//':
                break  # rest of line is comment
            # Handle template literals (simplified - no nested)
            if in_string:
                if ch == '\\':
                    j += 1  # skip next char
                elif ch == string_char:
                    in_string = False
            else:
                if ch in ('"', "'", '`'):
                    in_string = True
                    string_char = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        return actual_idx
            j += 1
    
    return len(lines) - 1


def needs_fix(filepath):
    """
    Check if file needs fixing. Returns (needs_fix, reason)
    """
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.read().splitlines(keepends=True)
    
    total = len(lines)
    
    # Find first non-empty, non-comment line
    first_real_line = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith('//') and not stripped.startswith('/*'):
            first_real_line = i
            break
    
    # Check 1: import React not at top
    import_react_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^import React', line.strip()):
            import_react_idx = i
            break
    
    if import_react_idx is None:
        return False, "no import React"
    
    # If import is not near the top (after only comments/blank lines)
    import_not_at_top = import_react_idx > (first_real_line or 0) + 5
    
    # Check 2: Multiple exports of same name
    export_names = []
    export_idxs = []
    for i, line in enumerate(lines):
        m = re.match(r'^export\s+(default\s+)?function\s+(\w+)', line)
        if m:
            export_names.append(m.group(2))
            export_idxs.append(i)
    
    has_duplicate_export = len(export_names) != len(set(export_names))
    
    # Check 3: Orphaned code after first component  
    if not export_idxs:
        return False, "no exports"
    
    first_export_idx = export_idxs[0]
    component_end_idx = find_component_end(lines, first_export_idx)
    
    # Check if there's orphaned content after component end
    remaining_lines = lines[component_end_idx+1:]
    has_orphaned = any(line.strip() for line in remaining_lines)
    
    if import_not_at_top or has_duplicate_export or has_orphaned:
        reasons = []
        if import_not_at_top:
            reasons.append(f"import@{import_react_idx+1}")
        if has_duplicate_export:
            reasons.append(f"dup_export:{export_names}")
        if has_orphaned:
            non_empty = sum(1 for l in remaining_lines if l.strip())
            reasons.append(f"orphaned:{non_empty}lines")
        return True, ", ".join(reasons)
    
    return False, "ok"


def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    lines = content.splitlines(keepends=True)
    
    # Find the `import React` line (0-based)
    import_react_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^import React', line.strip()):
            import_react_idx = i
            break
    
    if import_react_idx is None:
        return False, "no import React"
    
    # Find first export function (0-based)
    first_export_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^export\s+(default\s+)?function\s+', line):
            first_export_idx = i
            break
    
    if first_export_idx is None:
        return False, "no export function"
    
    # Find where the first component ends
    component_end_idx = find_component_end(lines, first_export_idx)
    
    # Build new file content
    import_line = lines[import_react_idx]
    pre_import = lines[:import_react_idx]
    # Include lines from after import up to and including component end
    post_import_to_end = lines[import_react_idx+1:component_end_idx+1]
    
    new_lines = [import_line] + pre_import + post_import_to_end
    
    # Add trailing newline
    if new_lines and not new_lines[-1].endswith('\n'):
        new_lines[-1] = new_lines[-1] + '\n'
    
    new_content = ''.join(new_lines)
    
    removed = len(lines) - component_end_idx - 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True, f"removed {removed} orphaned lines"


def main():
    files = [f for f in os.listdir(PAGES_DIR) if f.endswith('.tsx')]
    files.sort()
    
    print(f"Scanning {len(files)} files...\n")
    
    to_fix = []
    for fname in files:
        fpath = os.path.join(PAGES_DIR, fname)
        fix_needed, reason = needs_fix(fpath)
        if fix_needed:
            to_fix.append((fname, fpath, reason))
    
    print(f"Found {len(to_fix)} files needing fixes:")
    for fname, fpath, reason in to_fix:
        print(f"  {fname}: {reason}")
    
    print(f"\nFixing...")
    fixed = 0
    failed = 0
    for fname, fpath, reason in to_fix:
        success, msg = fix_file(fpath)
        if success:
            fixed += 1
            print(f"  FIXED {fname}: {msg}")
        else:
            failed += 1
            print(f"  FAILED {fname}: {msg}")
    
    print(f"\nDone. Fixed {fixed}, failed {failed} out of {len(to_fix)} files needing fixes.")


if __name__ == '__main__':
    main()
