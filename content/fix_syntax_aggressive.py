
import sys
import os

game_file = "content/quarter_01.py"
if not os.path.exists(game_file):
    print(f"Error: {game_file} not found")
    exit(1)

with open(game_file, "r") as f:
    lines = f.readlines()

new_lines = []
fixed_count = 0

for line in lines:
    stripped = line.strip()
    
    # Check if line contains double-quoted python3 -c command
    if '"python3 -c' in line:
        # Find start quote index
        start_q = line.find('"python3 -c')
        if start_q == -1:
            new_lines.append(line)
            continue
            
        # Find end quote index
        # Search backwards from end of line for quote
        # We need to handle trailing commas, list brackets, whitespace
        search_end = len(line.rstrip())
        
        # Find the last " in the line before search_end
        last_quote = line.rfind('"', start_q + 1, search_end)
        
        if last_quote > start_q:
            # Extract content including outer quotes
            # "python3 -c \"...\""
            original = line[start_q:last_quote+1]
            content = original[1:-1] # remove outer quotes
            
            # Unescape \" -> "
            fixed = content.replace('\\"', '"')
            # Escape ' -> \'
            fixed = fixed.replace("'", "\\'")
            
            # Reconstruct with single quotes
            new_segment = f"'{fixed}'"
            
            new_line = line[:start_q] + new_segment + line[last_quote+1:]
            new_lines.append(new_line)
            fixed_count += 1
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

print(f"Fixed {fixed_count} lines.")
with open(game_file, "w") as f:
    f.writelines(new_lines)
