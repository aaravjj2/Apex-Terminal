
import re
import os

game_file = "quarter_01.py"
if not os.path.exists(game_file):
    print(f"Error: {game_file} not found")
    exit(1)

with open(game_file, "r") as f:
    lines = f.readlines()

new_lines = []
fixed_count = 0

for line in lines:
    # Look for lines that look like: "python3 -c \"...\"" (possibly with trailing comma)
    # The regex handles:
    # ^\s*  : leading whitespace
    # "     : start outer quote
    # python3 -c \\"  : literal start of command with escaped inner quote
    # (.*?) : content
    # \\"   : end escaped inner quote
    # "     : end outer quote
    # ,?    : optional comma
    # \s*$  : trailing whitespace
    
    # We need to match the specific escaping we saw in view_file: \\"
    # In the file viewed, it was shown as \\". In python string it might be one backslash.
    # Let's try to match purely on the problematic pattern.
    
    if 'python3 -c \\"' in line:
        # It's likely one of the problematic lines
        # clean it up
        
        # Strip whitespace for processing
        stripped = line.strip()
        indent = line[:line.find(stripped)]
        
        # Check if it ends with comma
        has_comma = stripped.endswith(',')
        if has_comma:
            content = stripped[:-1] # remove comma
        else:
            content = stripped
            
        # Remove outer quotes
        if content.startswith('"') and content.endswith('"'):
            inner = content[1:-1]
            
            # Now inner is: python3 -c \"import ... \"
            # We want to convert to: python3 -c "import ... "
            # wrapped in single quotes
            
            # Replace \" with "
            clean_inner = inner.replace('\\"', '"')
            
            # Now we have: python3 -c "import ... "
            # We need to wrap this in single quotes: 'python3 -c "import ... "'
            # So we must escape any single quotes inside clean_inner
            clean_inner_escaped = clean_inner.replace("'", "\\'")
            
            new_line = f"{indent}'{clean_inner_escaped}'"
            if has_comma:
                new_line += ","
            new_line += "\n"
            
            new_lines.append(new_line)
            fixed_count += 1
            # print(f"Fixed line {len(new_lines)}")
        else:
            # unexpected format, keep original
            new_lines.append(line)
    else:
        new_lines.append(line)

print(f"Fixed {fixed_count} lines.")

with open(game_file, "w") as f:
    f.writelines(new_lines)
