
import os
import sys

OUTPUT_FILE = "quarter_02.py"
HEADER = """
# ══════════════════════════════════════════════════════════════════════════════
# V4 CONTENT: QUARTER 2 (DAYS 91-180)
# Theme: HARDENING, EXECUTION & MULTI-BROKER
# ══════════════════════════════════════════════════════════════════════════════

DAYS = {}

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
def add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    week_num = (day_num - 1) // 7 + 1
    weekday_idx = (day_num - 1) % 7
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    if weekday_idx >= 5: # Weekend Work
        title = f"[WEEKEND] {title}"
        outcome = f"Research & Cleanup: {outcome}"
    
    DAYS[day_num] = {
        'day_global': day_num,
        'weekday': weekdays[weekday_idx],
        'title': title,
        'outcome': outcome,
        'commands': commands,
        'files': files,
        'arch': arch,
        'autopilot': autopilot,
        'risk': risk,
        'metrics': metrics
    }

def _d(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics)

# ─── POPULATE CONTENT ────────────────────────────────────────────────────────
"""

def extract_content(filename):
    if not os.path.exists(filename):
        print(f"Warning: {filename} not found")
        return ""
    
    with open(filename, "r") as f:
        lines = f.readlines()
        
    content = []
    start_capture = False
    
    for line in lines:
        if "add_day(" in line:
            start_capture = True
        
        if start_capture:
            # Check for imports or redefine that ruin things
            if line.startswith("from quarter_02"):
                continue
                
            content.append(line)
            
    return "".join(content)

FILES = [
    "q2_days_91_120.py",
    "q2_days_121_150.py",
    "q2_days_151_180.py"
]

print(f"Assembling {OUTPUT_FILE}...")
with open(OUTPUT_FILE, "w") as f:
    f.write(HEADER)
    
    for filename in FILES:
        print(f"Processing {filename}...")
        chunk = extract_content(filename)
        if chunk:
            f.write(f"\n# Source: {filename}\n")
            f.write(chunk)
            f.write("\n")

print(f"Checking for syntax errors in {OUTPUT_FILE}...")
import py_compile
try:
    py_compile.compile(OUTPUT_FILE, doraise=True)
    print("Syntax OK")
except Exception as e:
    print(f"Syntax Error: {e}")
    sys.exit(1)
    
print("Done!")
