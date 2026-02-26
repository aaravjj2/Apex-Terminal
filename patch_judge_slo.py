from pathlib import Path
import re

p = Path("judge_server.py")
t = p.read_text(encoding="utf-8")

# Replace ANY result["proof"] assignment that starts with SLO met: ... (even if it's split across lines)
pattern = r'result\["proof"\]\s*=\s*\(?(?:f)?"SLO met:.*?(?:\)\s*)?\n'
# That pattern might not catch the whole multi-line mess with braces, so we do a broader targeted block replace:
pattern_block = r'result\["proof"\]\s*=\s*\(f"SLO met:.*?\n.*?lats\.items\(\)\)\}\}\}"\s*\)?'

replacement = 'result["proof"] = ("SLO met: {" + ",".join(f"{k}:{v.get(\'p99\')}ms" for k, v in lats.items()) + "}")'

new_t, n = re.subn(pattern_block, replacement, t, flags=re.DOTALL)

if n == 0:
    # Fallback: replace just the line that starts result["proof"] = (f"SLO met:
    new_t, n2 = re.subn(r'result\["proof"\]\s*=\s*\(f"SLO met:.*', replacement, t)
    if n2 == 0:
        raise SystemExit("No matching SLO proof block found to patch. We'll need to print lines 398-410.")
    new_t = new_t
    n = n2

p.write_text(new_t, encoding="utf-8")
print(f"patched SLO proof ({n} replacement)")
