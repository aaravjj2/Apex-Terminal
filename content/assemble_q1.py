#!/usr/bin/env python3
"""Assemble all chunk files into the final quarter_01.py with Days 1-90."""

import os, re, sys

CONTENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Read the base quarter_01.py to get the header (DAYS dict + _d function) and Days 1-7
with open(os.path.join(CONTENT_DIR, "quarter_01.py"), "r") as f:
    base = f.read()

# Extract header: everything before _d(1, ...)
lines = base.split('\n')

# Find the line where _d(8, ...) starts — that's where chunk data begins
# For Days 1-7 we keep the existing content from quarter_01.py
# Find where Day 8 starts (if it exists)
day8_start = None
for i, line in enumerate(lines):
    if line.strip().startswith("_d(8,"):
        day8_start = i
        break

if day8_start:
    # Keep everything up to but not including Day 8
    header_content = '\n'.join(lines[:day8_start])
else:
    # Keep everything (Days 1-7 only, no Day 8+)
    header_content = base.rstrip()

# Chunk files in order with their day ranges
chunk_files = [
    "_days_08_20.py",   # Days 8-20
    "_days_21_30.py",   # Days 21-30
    "_days_31_41.py",   # Days 31-41
    "_days_42_55.py",   # Days 42-55
    "_days_56_60.py",   # Days 56-60
    "_days_61_65.py",   # Days 61-65
    "_days_66_70.py",   # Days 66-70
    "_days_71_75.py",   # Days 71-75
    "_days_76_90.py",   # Days 76-90
]

def extract_day_calls(chunk_path):
    """Extract the _d(...) calls from a chunk file's CHUNK string."""
    with open(chunk_path, "r") as f:
        content = f.read()
    
    # The chunk files store content in a CHUNK = '''...''' variable
    # Extract the content between triple quotes
    match = re.search(r"CHUNK\s*=\s*'''(.*?)'''", content, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Try double quotes
    match = re.search(r'CHUNK\s*=\s*"""(.*?)"""', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    print(f"WARNING: Could not extract CHUNK from {chunk_path}")
    return ""

# Build the final file
output_parts = [header_content.rstrip()]

# Add section comments and chunk content
section_comments = {
    "_days_08_20.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 8-20: DATABASE, CACHING, INTELLIGENCE & SIMULATION\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_21_30.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 21-30: FRONTEND V2, CI/CD, TESTING & DOCUMENTATION\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_31_41.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 31-41: ADVANCED AI, TASK QUEUES, BOTS & MICROSERVICES\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_42_55.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 42-55: EVENT SOURCING, SECURITY, GRAPHQL, K8S & LOAD TESTING\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_56_60.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 56-60: DEPLOYMENT, COMPLIANCE, PERFORMANCE & ACCESSIBILITY\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_61_65.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 61-65: ML PIPELINE, KAFKA, CHAOS ENGINEERING & API GATEWAY\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_66_70.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 66-70: CONTAINER SECURITY, DR, SLOs, MULTI-BROKER & REGRESSION\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_71_75.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 71-75: SECRETS, CDN, ELK, EARNINGS PROTECTION & REPORTS\n# ══════════════════════════════════════════════════════════════════════════════\n",
    "_days_76_90.py": "\n# ══════════════════════════════════════════════════════════════════════════════\n# DAYS 76-90: PWA, API VERSIONING, PRIVACY, SOCIAL, QUALITY & GRADUATION\n# ══════════════════════════════════════════════════════════════════════════════\n",
}

for chunk_file in chunk_files:
    chunk_path = os.path.join(CONTENT_DIR, chunk_file)
    if not os.path.exists(chunk_path):
        print(f"WARNING: {chunk_file} not found, skipping")
        continue
    
    comment = section_comments.get(chunk_file, "")
    day_calls = extract_day_calls(chunk_path)
    
    if day_calls:
        output_parts.append(comment)
        output_parts.append(day_calls)
        print(f"✓ Added {chunk_file}")
    else:
        print(f"✗ Empty content from {chunk_file}")

# Join and write
final_content = '\n'.join(output_parts) + '\n'

# Count _d() calls to verify
day_count = len(re.findall(r'^_d\(\d+,', final_content, re.MULTILINE))
print(f"\n{'='*60}")
print(f"Total days in final quarter_01.py: {day_count}")
print(f"Total lines: {final_content.count(chr(10))}")
print(f"Total bytes: {len(final_content)}")

# Write the assembled file
output_path = os.path.join(CONTENT_DIR, "quarter_01.py")
with open(output_path, "w") as f:
    f.write(final_content)

print(f"\n✅ Wrote assembled quarter_01.py to {output_path}")

if day_count < 86:
    print(f"⚠️  Only {day_count} days found, expected ~86-90 (some weekends may be combined)")
elif day_count >= 86:
    print(f"✅ All {day_count} days present. Quarter 1 content complete!")
