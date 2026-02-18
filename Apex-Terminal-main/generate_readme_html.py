#!/usr/bin/env python3
"""Generate a professional HTML README with enhanced styling."""

import sys
import markdown
from pathlib import Path

def generate_professional_html(md_file_path, output_html_path=None):
    """Convert markdown to professionally styled HTML."""
    
    # Read markdown file
    with open(md_file_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Pre-process: Convert badge markdown syntax BEFORE markdown conversion
    # This ensures badges work even inside HTML blocks
    import re
    
    def convert_badge_markdown(text):
        """Convert [![text](image_url)](link_url) to HTML before markdown processing"""
        def replace_badge(match):
            alt_text = match.group(1)
            img_url = match.group(2)
            link_url = match.group(3)
            # Return HTML that will pass through markdown
            return f'<a href="{link_url}"><img src="{img_url}" alt="{alt_text}" /></a>'
        
        # Pattern: [![alt](img_url)](link_url)
        pattern = r'\[!\[([^\]]+)\]\(([^\)]+)\)\]\(([^\)]+)\)'
        return re.sub(pattern, replace_badge, text)
    
    # Convert badges in the markdown BEFORE processing
    md_content = convert_badge_markdown(md_content)
    
    # Convert markdown to HTML
    md = markdown.Markdown(extensions=['extra', 'codehilite', 'tables', 'toc'])
    html_content = md.convert(md_content)
    
    # Professional HTML with modern fonts and styling
    html_document = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TradingView Recreation - Market Workstation Platform</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        /* Dark mode as default */
        :root {{
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #cbd5e1;
            --text-tertiary: #94a3b8;
            --border-color: #334155;
            --code-bg: #1e293b;
            --code-border: #475569;
            --pre-bg: #0a0e27;
            --pre-text: #e2e8f0;
            --link-color: #818cf8;
            --link-hover: #6366f1;
            --accent-primary: #818cf8;
        }}
        
        @media (prefers-color-scheme: light) {{
            :root {{
                --bg-primary: #ffffff;
                --bg-secondary: #f8fafc;
                --bg-tertiary: #f1f5f9;
                --text-primary: #0a0e27;
                --text-secondary: #4a5568;
                --text-tertiary: #718096;
                --border-color: #e2e8f0;
                --code-bg: #f8fafc;
                --code-border: #e2e8f0;
                --pre-bg: #1a202c;
                --pre-text: #e2e8f0;
                --link-color: #6366f1;
                --link-hover: #4f46e5;
                --accent-primary: #6366f1;
            }}
        }}
        
        body {{
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.75;
            color: var(--text-primary);
            background: var(--bg-primary);
            font-size: 17px;
            font-weight: 400;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            letter-spacing: -0.01em;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 24px;
        }}
        
        /* Headings */
        h1 {{
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-size: 4rem;
            font-weight: 700;
            line-height: 1.1;
            margin: 0 0 24px 0;
            color: var(--text-primary);
            letter-spacing: -0.03em;
            background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}
        
        h2 {{
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-size: 2.5rem;
            font-weight: 700;
            line-height: 1.25;
            margin: 56px 0 28px 0;
            color: var(--text-primary);
            padding-bottom: 16px;
            border-bottom: 3px solid var(--accent-primary);
            letter-spacing: -0.02em;
        }}
        
        h3 {{
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-size: 1.75rem;
            font-weight: 600;
            line-height: 1.35;
            margin: 40px 0 20px 0;
            color: var(--text-primary);
            letter-spacing: -0.01em;
        }}
        
        h4 {{
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-size: 1.375rem;
            font-weight: 600;
            line-height: 1.4;
            margin: 32px 0 16px 0;
            color: var(--accent-primary);
            letter-spacing: -0.005em;
        }}
        
        h5, h6 {{
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-weight: 600;
            margin: 24px 0 12px 0;
            color: var(--text-primary);
        }}
        
        /* Paragraphs */
        p {{
            margin: 20px 0;
            color: var(--text-secondary);
            font-size: 1.125rem;
            font-weight: 400;
            line-height: 1.8;
        }}
        
        /* Links */
        a {{
            color: var(--link-color);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }}
        
        a:hover {{
            color: var(--link-hover);
            text-decoration: underline;
        }}
        
        /* Lists */
        ul, ol {{
            margin: 20px 0;
            padding-left: 28px;
            color: var(--text-secondary);
        }}
        
        li {{
            margin: 12px 0;
            line-height: 1.75;
            font-size: 1.0625rem;
        }}
        
        ul ul, ol ol, ul ol, ol ul {{
            margin: 8px 0;
        }}
        
        /* Code */
        code {{
            font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
            font-size: 0.95em;
            background: linear-gradient(135deg, var(--code-bg) 0%, var(--bg-secondary) 100%);
            border: 1.5px solid var(--code-border);
            border-radius: 6px;
            padding: 3px 8px;
            color: var(--accent-secondary);
            font-weight: 500;
            letter-spacing: 0.01em;
        }}
        
        pre {{
            font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
            background: linear-gradient(135deg, var(--pre-bg) 0%, #1a202c 100%);
            color: var(--pre-text);
            border-radius: 12px;
            padding: 24px;
            overflow-x: auto;
            margin: 28px 0;
            font-size: 0.95rem;
            line-height: 1.7;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }}
        
        pre code {{
            background: transparent;
            border: none;
            padding: 0;
            color: inherit;
            font-weight: 400;
        }}
        
        /* Tables */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
        }}
        
        th {{
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
            font-weight: 600;
            padding: 16px 20px;
            text-align: left;
            color: var(--text-primary);
            border-bottom: 2px solid var(--accent-primary);
            font-family: 'Space Grotesk', 'Poppins', sans-serif;
            font-size: 1rem;
        }}
        
        td {{
            padding: 14px 20px;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-secondary);
            font-size: 1rem;
        }}
        
        tr:last-child td {{
            border-bottom: none;
        }}
        
        tr:hover {{
            background: var(--bg-secondary);
        }}
        
        /* Blockquotes */
        blockquote {{
            border-left: 5px solid var(--accent-primary);
            padding: 20px 24px;
            margin: 28px 0;
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
            border-radius: 0 12px 12px 0;
            color: var(--text-secondary);
            font-style: italic;
            font-size: 1.125rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }}
        
        blockquote p {{
            margin: 0;
        }}
        
        /* Horizontal rules */
        hr {{
            border: none;
            border-top: 2px solid var(--border-color);
            margin: 48px 0;
        }}
        
        /* Center alignment for headers */
        div[align="center"] {{
            text-align: center;
            margin: 32px 0;
        }}
        
        /* Images */
        img {{
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 16px 0;
        }}
        
        /* Badges (shields.io style) */
        img[src*="shields.io"],
        img[src*="badge"],
        img[alt="Python"],
        img[alt="TypeScript"],
        img[alt="React"],
        img[alt="FastAPI"] {{
            display: inline-block !important;
            margin: 4px 6px !important;
            vertical-align: middle !important;
            height: auto !important;
            max-height: 28px !important;
            width: auto !important;
            border: none !important;
            border-radius: 4px;
            opacity: 1 !important;
            visibility: visible !important;
        }}
        
        /* Links containing badges */
        a[href*="python.org"],
        a[href*="typescriptlang.org"],
        a[href*="react.dev"],
        a[href*="fastapi.tiangolo.com"] {{
            display: inline-block !important;
            margin: 0 4px !important;
            text-decoration: none !important;
            border: none !important;
        }}
        
        a[href*="python.org"]:hover,
        a[href*="typescriptlang.org"]:hover,
        a[href*="react.dev"]:hover,
        a[href*="fastapi.tiangolo.com"]:hover {{
            text-decoration: none !important;
            opacity: 0.9;
        }}
        
        /* Center-aligned content with badges */
        div[align="center"] {{
            line-height: 2;
        }}
        
        div[align="center"] p {{
            margin: 12px 0;
        }}
        
        /* Feature lists with icons */
        .features-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin: 32px 0;
        }}
        
        .feature-card {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }}
        
        .feature-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }}
        
        .feature-card h4 {{
            margin-top: 0;
            color: var(--accent-primary);
        }}
        
        /* Code blocks in lists */
        li code {{
            font-size: 0.85em;
        }}
        
        /* Syntax highlighting adjustments */
        .hljs {{
            background: var(--pre-bg) !important;
            color: var(--pre-text) !important;
        }}
        
        /* Responsive */
        @media (max-width: 768px) {{
            .container {{
                padding: 24px 16px;
            }}
            
            h1 {{
                font-size: 2.5rem;
            }}
            
            h2 {{
                font-size: 1.75rem;
            }}
            
            table {{
                font-size: 0.9rem;
            }}
            
            th, td {{
                padding: 8px 12px;
            }}
        }}
        
        /* Print styles */
        @media print {{
            body {{
                background: white;
                color: black;
            }}
            
            .container {{
                max-width: 100%;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        {html_content}
    </div>
</body>
</html>"""
    
    # Write HTML file
    if output_html_path is None:
        output_html_path = Path(md_file_path).with_suffix('.html')
    
    with open(output_html_path, 'w', encoding='utf-8') as f:
        f.write(html_document)
    
    return output_html_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 generate_readme_html.py <markdown_file>")
        sys.exit(1)
    
    md_file = sys.argv[1]
    
    if not Path(md_file).exists():
        print(f"Error: File '{md_file}' not found!")
        sys.exit(1)
    
    print(f"Generating professional HTML from {md_file}...")
    html_file = generate_professional_html(md_file)
    print(f"✓ HTML file created: {html_file}")
    print(f"  Open in browser: file://{Path(html_file).absolute()}")
