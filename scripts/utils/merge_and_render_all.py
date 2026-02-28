
import markdown
import os

# Define input files
FILES = [
    "Quarter_01_Detailed_Plan.md",
    "content/Quarter_02_Detailed_Plan.md",
    "content/Quarter_03_Detailed_Plan.md",
    "content/Quarter_04_Detailed_Plan.md"
]

OUTPUT_MD = "Apex_Terminal_Year_1_Detailed_Plan.md"
OUTPUT_HTML = "Apex_Terminal_Year_1_Detailed_Plan.html"

def read_file(path):
    if not os.path.exists(path):
        print(f"ERROR: {path} not found!")
        return f"\n\n# ERROR: Missing {path}\n\n"
    with open(path, "r") as f:
        return f.read()

print("Merging Markdown files...")
merged_content = []

# Add overall Title
merged_content.append("# Apex Terminal: Year 1 Detailed Execution Plan (Days 1-365)")
merged_content.append("> **Bible-Scale V14 Edition**")
merged_content.append("")
merged_content.append("[TOC]") # Let the markdown extension generate the TOC
merged_content.append("")

for i, file_path in enumerate(FILES):
    print(f"Processing {file_path}...")
    content = read_file(file_path)
    
    # Ensure content starts on a new line and verify header level
    # We strip the existing [TOC] from sub-files to avoid clutter
    content = content.replace("[TOC]", "")
    
    merged_content.append(f"\n\n---\n\n") # Distinct separator
    merged_content.append(content)

full_md = "\n".join(merged_content)

# Write merged MD
with open(OUTPUT_MD, "w") as f:
    f.write(full_md)
print(f"Saved {OUTPUT_MD} ({len(full_md)} bytes)")

# Convert to HTML
print("Converting to HTML...")

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Apex Terminal - Year 1 Master Plan</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333; }}
        h1 {{ border-bottom: 3px solid #333; padding-bottom: 10px; margin-top: 60px; }}
        h2 {{ border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-top: 40px; }}
        h3 {{ color: #2c3e50; margin-top: 30px; }}
        code {{ background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }}
        pre {{ background-color: #f8f8f8; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #ddd; }}
        blockquote {{ border-left: 4px solid #3498db; padding-left: 15px; color: #555; background: #eefecf; padding: 10px; margin: 20px 0; }}
        .toc {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 40px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
    </style>
</head>
<body>
    {CONTENT}
</body>
</html>
"""

html_body = markdown.markdown(full_md, extensions=['fenced_code', 'tables', 'toc'])
final_html = HTML_TEMPLATE.format(CONTENT=html_body)

with open(OUTPUT_HTML, "w") as f:
    f.write(final_html)
print(f"Saved {OUTPUT_HTML} ({len(final_html)} bytes)")
print("Done!")
