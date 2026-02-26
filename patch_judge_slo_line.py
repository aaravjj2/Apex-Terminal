from pathlib import Path

p = Path("judge_server.py")
lines = p.read_text(encoding="utf-8").splitlines()

# Find the start of the broken proof assignment
start = None
for i, line in enumerate(lines):
    if 'result["proof"]' in line and 'SLO met:' in line:
        start = i
        break

if start is None:
    raise SystemExit("Couldn't find the SLO met proof assignment in judge_server.py")

# Find the end of that assignment block by scanning forward until we hit a line that ends the string/paren
end = start
while end < len(lines):
    if lines[end].strip().endswith('")') or lines[end].strip().endswith('") )') or lines[end].strip().endswith('")') or lines[end].strip().endswith('")'):
        break
    # Common: the original ended with a line containing just a closing parenthesis or quote
    if lines[end].strip() in (")", '")', '")', '")', '")', ')'):
        break
    # If we see a line that clearly terminates the old f-string chunk
    if 'lats.items()' in lines[end] and ('"' in lines[end] or "')" in lines[end] or '")' in lines[end]):
        break
    end += 1

# Replace the whole block with a single safe line
replacement = 'result["proof"] = ("SLO met: {" + ",".join(f"{k}:{v.get(\\'p99\\')}ms" for k, v in lats.items()) + "}")'

# Remove old block lines and insert the replacement
# end is inclusive if it contains part of the old assignment, so delete through end
del lines[start:end+1]
lines.insert(start, replacement)

p.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"patched SLO proof block at lines {start+1}-{end+1}")
