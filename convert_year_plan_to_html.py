
import markdown
import os

TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Apex Terminal - Year 1 Roadmap (V14 Bible Edition)</title>
    <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333; }}
        h1 {{ border-bottom: 3px solid #333; padding-bottom: 10px; margin-top: 60px; page-break-before: always; }}
        h1:first-of-type {{ margin-top: 0; page-break-before: auto; }}
        h2 {{ border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-top: 40px; color: #444; }}
        h3 {{ color: #2c3e50; margin-top: 30px; font-weight: bold; }}
        p, li {{ font-size: 16px; }}
        code {{ background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: 'Fira Code', monospace; font-size: 0.9em; }}
        pre {{ background-color: #f8f8f8; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #ddd; page-break-inside: avoid; }}
        blockquote {{ border-left: 4px solid #3498db; padding-left: 15px; color: #555; background: #eefecf; padding: 10px; margin: 20px 0; border-radius: 0 5px 5px 0; }}
        hr {{ border: 0; height: 1px; background: #ddd; margin: 40px 0; }}
        .toc {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 40px; }}
        .toc ul {{ list-style-type: none; padding-left: 20px; }}
        .toc a {{ text-decoration: none; color: #2980b9; }}
        .toc a:hover {{ text-decoration: underline; }}
        
        /* Specific quarter colors */
        h1[id^="quarter-1"] {{ border-color: #3498db; color: #2980b9; }}
        h1[id^="quarter-2"] {{ border-color: #e67e22; color: #d35400; }}
        h1[id^="quarter-3"] {{ border-color: #9b59b6; color: #8e44ad; }}
        h1[id^="quarter-4"] {{ border-color: #27ae60; color: #16a085; }}
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 60px;">
        <h1 style="border: none; page-break-before: auto; font-size: 3em; margin-bottom: 10px;">Apex Terminal</h1>
        <h2 style="border: none; margin-top: 0; color: #666;">Year 1 Master Plan (Bible Edition V14)</h2>
        <p><strong>Days 1-365 Detailed Execution Roadmap</strong></p>
        <p>Generated on February 19, 2026</p>
    </div>

    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>
            <li><a href="#quarter-1-foundation-data-backtesting-days-1-90">Quarter 1: Foundation (Days 1-90)</a></li>
            <li><a href="#quarter-2-execution-resilience-days-91-180">Quarter 2: Execution (Days 91-180)</a></li>
            <li><a href="#quarter-3-intelligence-optimization-days-181-270">Quarter 3: Intelligence (Days 181-270)</a></li>
            <li><a href="#quarter-4-ecosystem-endgame-days-271-365">Quarter 4: Endgame (Days 271-365)</a></li>
        </ul>
    </div>

    {CONTENT}
</body>
</html>
"""

INPUT_FILE = "Apex_Terminal_Year_1_Detailed_Plan.md"
OUTPUT_FILE = "Apex_Terminal_Year_1_Detailed_Plan.html"

if not os.path.exists(INPUT_FILE):
    print(f"Error: {INPUT_FILE} not found.")
    exit(1)

print(f"Reading {INPUT_FILE}...")
with open(INPUT_FILE, "r") as f:
    md_content = f.read()

# Add explicit IDs for TOC links manually (simple string replace for the headers)
# Assuming standard header format from previous scripts
md_content = md_content.replace("# Quarter 1", "# Quarter 1: Foundation (Days 1-90)\n\n<a name='quarter-1-foundation-data-backtesting-days-1-90'></a>")
md_content = md_content.replace("# Quarter 2", "# Quarter 2: Execution (Days 91-180)\n\n<a name='quarter-2-execution-resilience-days-91-180'></a>")
md_content = md_content.replace("# Quarter 3", "# Quarter 3: Intelligence (Days 181-270)\n\n<a name='quarter-3-intelligence-optimization-days-181-270'></a>")
md_content = md_content.replace("# Quarter 4", "# Quarter 4: Endgame (Days 271-365)\n\n<a name='quarter-4-ecosystem-endgame-days-271-365'></a>")

print("Converting to HTML...")
html_body = markdown.markdown(md_content, extensions=['fenced_code', 'tables', 'toc'])
full_html = TEMPLATE.format(CONTENT=html_body)

with open(OUTPUT_FILE, "w") as f:
    f.write(full_html)
    
print(f"Success! Generated {OUTPUT_FILE}")
