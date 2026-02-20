
import markdown
import sys
import os

try:
    from weasyprint import HTML
except ImportError:
    HTML = None
    print("Warning: weasyprint not installed. PDF generation will be skipped, but HTML will be generated.")

INPUT_MD = "Quarter_01_Detailed_Plan.md"
OUTPUT_PDF = "Quarter_01_Detailed_Plan.pdf"

if not os.path.exists(INPUT_MD):
    print(f"Error: {INPUT_MD} not found!")
    sys.exit(1)

print(f"Reading {INPUT_MD}...")
with open(INPUT_MD, "r", encoding="utf-8") as f:
    text = f.read()

print("Converting Markdown to HTML...")
# 'extra' enables tables, fenced code blocks, etc.
# 'toc' generates Table of Contents if [TOC] is present (not used here but good to have)
# 'codehilite' syntax highlighting if pygments installed
extensions = ['extra', 'toc']
try:
    import pygments
    extensions.append('codehilite')
except ImportError:
    pass

html_body = markdown.markdown(text, extensions=extensions)

# CSS for PDF styling
css = """
@page {
    size: letter;
    margin: 1in;
    @bottom-center {
        content: "Page " counter(page);
        font-family: sans-serif;
        font-size: 9pt;
        color: #777;
    }
}
body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-size: 11pt;
    color: #333;
}
h1 { font-size: 24pt; color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5em; margin-top: 0; }
h2 { font-size: 18pt; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; margin-top: 1.5em; page-break-after: avoid; }
h3 { font-size: 14pt; color: #4a5568; margin-top: 1.2em; margin-bottom: 0.5em; page-break-after: avoid; }
p { margin-bottom: 1em; text-align: justify; }
ul, ol { margin-bottom: 1em; padding-left: 1.5em; }
li { margin-bottom: 0.3em; }
code { font-family: "Consolas", "Monaco", monospace; background-color: #f7fafc; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; border: 1px solid #edf2f7; }
pre { background-color: #f7fafc; padding: 1em; border-radius: 5px; overflow-x: auto; border: 1px solid #edf2f7; font-size: 0.85em; break-inside: avoid; }
pre code { background-color: transparent; padding: 0; border: none; }
blockquote { border-left: 4px solid #cbd5e0; padding-left: 1em; margin-left: 0; color: #4a5568; font-style: italic; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1em; break-inside: avoid; }
th, td { border: 1px solid #e2e8f0; padding: 0.5em; text-align: left; font-size: 0.9em; }
th { background-color: #f7fafc; font-weight: bold; color: #2d3748; }
tr:nth-child(even) { background-color: #fcfcfc; }
a { color: #3182ce; text-decoration: none; }
hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2em 0; }
.toc { background: #fdfdfd; border: 1px solid #eee; padding: 1em; border-radius: 5px; margin-bottom: 2em; }
"""

full_html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Apex Terminal: Quarter 1 Detailed Plan</title>
<style>{css}</style>
</head>
<body>
{html_body}
</body>
</html>
"""

OUTPUT_HTML = "Quarter_01_Detailed_Plan.html"

print(f"Saving HTML: {OUTPUT_HTML}...")
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(full_html)

print(f"Generating PDF: {OUTPUT_PDF}...")
if HTML:
    try:
        HTML(string=full_html).write_pdf(OUTPUT_PDF)
        print(f"Success! PDF generated at {OUTPUT_PDF}")
    except Exception as e:
        print(f"pdf_generation_failed: {e}")
else:
    print("Skipping PDF generation (weasyprint missing). Open HTML file instead.")
