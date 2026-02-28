"""
Fix corrupted UI2 page files.
Pattern: Each file has:
  1. Old Bloomberg-style code (constants, interfaces, helper funcs)
  2. `import React, { useState, ... } from 'react'` in the middle
  3. `export function XXX() { ... }` - the main component
  4. ORPHANED trailing code after the main component's closing `}`

Fix:
  - Truncate file right after the main exported component's closing `}`
  - Move the `import React` line to the top (before interfaces)
"""

import os
import re
import sys

PAGES_DIR = r"C:\Tradingview\Tradingview recreation\frontend\src\ui2\pages"

FAILING_FILES = [
    "GlobalReadinessUI2.tsx",
    "IncidentComplianceUI2.tsx",
    "KriScoringUI2.tsx",
    "JurisdictionUI2.tsx",
    "AppSandboxUI2.tsx",
    "MarketplaceUI2.tsx",
    "BillingEventsUI2.tsx",
    "ExtObservabilityUI2.tsx",
    "DevPortalUI2.tsx",
    "MarketplaceTrustUI2.tsx",
    "LatencyBudgetUI2.tsx",
    "MultiRegionUI2.tsx",
    "DataResidencyUI2.tsx",
    "HotPathUI2.tsx",
]


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
            # Handle strings
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
        print(f"  SKIP: No 'import React' found")
        return False
    
    # Find ALL `export function` or `export default function` lines (0-based)
    export_idxs = []
    for i, line in enumerate(lines):
        if re.match(r'^export\s+(default\s+)?function\s+', line):
            export_idxs.append(i)
    
    if not export_idxs:
        print(f"  SKIP: No export function found")
        return False
    
    # Use the FIRST export function (the real component)
    first_export_idx = export_idxs[0]
    
    # Find where this component ends
    component_end_idx = find_component_end(lines, first_export_idx)
    
    print(f"  import@{import_react_idx+1}, firstExport@{first_export_idx+1}, componentEnd@{component_end_idx+1}, total={len(lines)}")
    
    # Check if there's orphaned code after the component end
    has_orphaned = component_end_idx < len(lines) - 2  # more than just trailing newline
    
    # Build new file:
    # 1. The import React line
    import_line = lines[import_react_idx]
    
    # 2. Everything from line 0 to import_react_idx (exclusive) - pre-import code
    pre_import = lines[:import_react_idx]
    
    # 3. Everything from import_react_idx+1 to component_end_idx (inclusive)
    post_import_to_end = lines[import_react_idx+1:component_end_idx+1]
    
    # New order: import first, then pre-import code, then post-import to component end
    # Actually: move import to top
    new_lines = [import_line] + pre_import + post_import_to_end
    
    # Add a trailing newline if needed
    if new_lines and not new_lines[-1].endswith('\n'):
        new_lines[-1] = new_lines[-1] + '\n'
    
    new_content = ''.join(new_lines)
    
    if has_orphaned or import_react_idx > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  FIXED: removed {len(lines) - component_end_idx - 1} orphaned lines, moved import to top")
        return True
    else:
        print(f"  OK: no changes needed")
        return False


def main():
    fixed = 0
    for fname in FAILING_FILES:
        fpath = os.path.join(PAGES_DIR, fname)
        if not os.path.exists(fpath):
            print(f"{fname}: FILE NOT FOUND")
            continue
        print(f"{fname}:")
        changed = fix_file(fpath)
        if changed:
            fixed += 1
    
    print(f"\nDone. Fixed {fixed}/{len(FAILING_FILES)} files.")


if __name__ == '__main__':
    main()
