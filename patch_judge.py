import re
from pathlib import Path

p = Path("judge_server.py")
t = p.read_text(encoding="utf-8")

pattern = r'result\["proof"\]\s*=\s*\(f"SLO met:.*?\)\s*'
replacement = 'result["proof"] = ("SLO met: {" + ",".join(f"{k}:{v.get(\'p99\')}ms" for k, v in lats.items()) + "}")\n'

new_t, n = re.subn(pattern, replacement, t, flags=re.DOTALL)

if n == 0:
    raise SystemExit("No match found (file may already be patched or pattern changed).")

p.write_text(new_t, encoding="utf-8")
print(f"patched ({n} replacement)")
