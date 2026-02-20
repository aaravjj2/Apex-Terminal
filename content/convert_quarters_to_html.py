
import markdown
import os

TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{TITLE}</title>
    <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; color: #333; }}
        h1 {{ border-bottom: 2px solid #333; padding-bottom: 10px; }}
        h2 {{ border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; }}
        h3 {{ color: #2c3e50; margin-top: 25px; }}
        code {{ background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }}
        pre {{ background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #ddd; }}
        blockquote {{ border-left: 4px solid #3498db; padding-left: 15px; color: #7f8c8d; margin-left: 0; }}
        hr {{ border: 0; height: 1px; background: #ddd; margin: 40px 0; }}
        .toc {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 30px; }}
    </style>
</head>
<body>
    {CONTENT}
</body>
</html>
"""

FILES = [
    ("Quarter two", "Quarter_02_Detailed_Plan.md", "Quarter_02_Detailed_Plan.html"),
    ("Quarter three", "Quarter_03_Detailed_Plan.md", "Quarter_03_Detailed_Plan.html"),
    ("Quarter four", "Quarter_04_Detailed_Plan.md", "Quarter_04_Detailed_Plan.html")
]

for title, md_file, html_file in FILES:
    if os.path.exists(md_file):
        print(f"Converting {md_file}...")
        with open(md_file, "r") as f:
            md_content = f.read()
            
        html_body = markdown.markdown(md_content, extensions=['fenced_code', 'tables', 'toc'])
        full_html = TEMPLATE.format(TITLE=title, CONTENT=html_body)
        
        with open(html_file, "w") as f:
            f.write(full_html)
        print(f"Created {html_file}")
    else:
        print(f"Skipping {md_file} (Not Found)")
