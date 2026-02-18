#!/usr/bin/env python3
"""
README Generator using Google Colab's Free AI Models

This script generates a comprehensive README.md and README.html for the 
TradingView Recreation project using google.colab.ai (no API key required).

Usage in Google Colab:
1. Upload this script to Colab or copy the contents
2. Upload your project files (or mount Google Drive)
3. Run: !python colab_readme_generator.py --project-path /path/to/project

Or run cells directly in a notebook.
"""

import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Optional

# Check if running in Colab
try:
    from google.colab import ai
    IN_COLAB = True
    print("✓ Running in Google Colab with AI access")
except ImportError:
    IN_COLAB = False
    print("⚠ Not in Colab - will use mock AI responses")

# Configuration
CONFIG = {
    "model": "gemini-2.5-flash-lite",  # Fastest free model
    "max_files_to_summarize": 50,       # Limit to avoid rate limits
    "rate_limit_delay": 0.5,            # Seconds between API calls
    "project_name": "TradingView Recreation",
    "description": "Production-grade market analysis and trading platform",
}

# Files/directories to ignore
IGNORE_PATTERNS = [
    "node_modules", "venv", "__pycache__", ".git", "build", "dist",
    "test-results", "playwright-report", ".pytest_cache", "artifacts",
    "*.pyc", "*.log", "*.lock", "package-lock.json", ".env", "*.db",
]

# Priority files to always summarize
PRIORITY_FILES = [
    "README.md", "package.json", "requirements.txt", "main.py", "main.tsx",
    "App.tsx", "index.ts", "config.py", "settings.py", "api/main.py",
]


def should_ignore(path: str) -> bool:
    """Check if a path should be ignored."""
    for pattern in IGNORE_PATTERNS:
        if pattern.startswith("*"):
            if path.endswith(pattern[1:]):
                return True
        elif pattern in path:
            return True
    return False


def get_project_files(project_path: str, max_depth: int = 4) -> list[dict]:
    """Scan project and return list of important files."""
    files = []
    project_root = Path(project_path)
    
    for root, dirs, filenames in os.walk(project_root):
        # Filter directories
        dirs[:] = [d for d in dirs if not should_ignore(d)]
        
        # Check depth
        rel_path = Path(root).relative_to(project_root)
        depth = len(rel_path.parts)
        if depth > max_depth:
            continue
        
        for filename in filenames:
            full_path = Path(root) / filename
            rel_file_path = full_path.relative_to(project_root)
            
            if should_ignore(str(rel_file_path)):
                continue
            
            # Only include code files
            ext = full_path.suffix.lower()
            if ext in ['.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.md', '.sh']:
                try:
                    size = full_path.stat().st_size
                    if size < 100000:  # Skip files > 100KB
                        files.append({
                            "path": str(rel_file_path),
                            "name": filename,
                            "ext": ext,
                            "size": size,
                            "priority": filename in PRIORITY_FILES or any(p in str(rel_file_path) for p in PRIORITY_FILES)
                        })
                except:
                    pass
    
    # Sort: priority files first, then by extension
    files.sort(key=lambda x: (not x["priority"], x["ext"], x["path"]))
    return files


def read_file_content(project_path: str, file_path: str, max_chars: int = 3000) -> str:
    """Read file content (truncated)."""
    try:
        full_path = Path(project_path) / file_path
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(max_chars)
            if len(content) == max_chars:
                content += "\n... [truncated]"
            return content
    except:
        return ""


def generate_summary_with_ai(file_path: str, content: str, model: str = None) -> str:
    """Generate file summary using Colab AI."""
    if not IN_COLAB:
        return f"[Mock summary for {file_path}]"
    
    model = model or CONFIG["model"]
    
    prompt = f"""Summarize this code file in 1-2 sentences. Focus on its purpose and key functionality.

File: {file_path}

```
{content[:2000]}
```

Summary:"""
    
    try:
        response = ai.generate_text(prompt, model=model)
        time.sleep(CONFIG["rate_limit_delay"])  # Rate limiting
        return response.strip()
    except Exception as e:
        return f"[Error generating summary: {e}]"


def generate_project_overview(files: list[dict], model: str = None) -> str:
    """Generate project overview using AI."""
    if not IN_COLAB:
        return "A comprehensive market analysis and trading platform with React frontend and FastAPI backend."
    
    model = model or CONFIG["model"]
    
    # Create file list summary
    file_types = {}
    for f in files:
        ext = f["ext"]
        file_types[ext] = file_types.get(ext, 0) + 1
    
    file_summary = ", ".join([f"{count} {ext} files" for ext, count in sorted(file_types.items(), key=lambda x: -x[1])[:5]])
    
    sample_files = "\n".join([f"- {f['path']}" for f in files[:20]])
    
    prompt = f"""Based on this project structure, write a compelling 2-3 paragraph overview for a README.

Project: {CONFIG['project_name']}
Files: {file_summary}

Sample files:
{sample_files}

Write a professional project overview that explains what this project does, its key features, and technology stack. Be specific and technical."""

    try:
        response = ai.generate_text(prompt, model=model)
        time.sleep(CONFIG["rate_limit_delay"])
        return response.strip()
    except Exception as e:
        return f"[Error generating overview: {e}]"


def generate_features_table(files: list[dict], model: str = None) -> str:
    """Generate features table using AI."""
    if not IN_COLAB:
        return """| Feature | Description |
|---------|-------------|
| Real-time Charts | Interactive candlestick charts with 35+ indicators |
| Trading Dashboard | Bloomberg-style tile-based workspace |
| AI Analysis | LLM-powered market insights |
| Broker Integration | Alpaca and Tradier support |"""
    
    model = model or CONFIG["model"]
    
    sample_files = "\n".join([f['path'] for f in files[:30]])
    
    prompt = f"""Based on these project files, create a markdown features table with 6-8 key features.

Files:
{sample_files}

Format as:
| Feature | Description |
|---------|-------------|
| ... | ... |

Be specific about technical capabilities."""

    try:
        response = ai.generate_text(prompt, model=model)
        time.sleep(CONFIG["rate_limit_delay"])
        return response.strip()
    except Exception as e:
        return "[Error generating features]"


def build_project_tree(project_path: str, max_depth: int = 2) -> str:
    """Build project directory tree."""
    tree_lines = [f"└── {Path(project_path).name}/"]
    project_root = Path(project_path)
    
    def add_to_tree(path: Path, prefix: str, depth: int):
        if depth > max_depth:
            return
        
        items = []
        try:
            for item in sorted(path.iterdir()):
                if not should_ignore(item.name):
                    items.append(item)
        except:
            return
        
        for i, item in enumerate(items[:15]):  # Limit items per directory
            is_last = i == len(items) - 1 or i == 14
            connector = "└── " if is_last else "├── "
            
            if item.is_dir():
                tree_lines.append(f"{prefix}{connector}{item.name}/")
                if depth < max_depth:
                    new_prefix = prefix + ("    " if is_last else "│   ")
                    add_to_tree(item, new_prefix, depth + 1)
            else:
                tree_lines.append(f"{prefix}{connector}{item.name}")
        
        if len(items) > 15:
            tree_lines.append(f"{prefix}└── ... ({len(items) - 15} more)")
    
    add_to_tree(project_root, "    ", 0)
    return "\n".join(tree_lines)


def detect_tech_stack(files: list[dict], project_path: str) -> dict:
    """Detect technology stack from project files."""
    stack = {
        "languages": set(),
        "frameworks": set(),
        "tools": set(),
    }
    
    ext_map = {
        ".py": "Python",
        ".ts": "TypeScript",
        ".tsx": "TypeScript/React",
        ".js": "JavaScript",
        ".jsx": "JavaScript/React",
    }
    
    for f in files:
        if f["ext"] in ext_map:
            stack["languages"].add(ext_map[f["ext"]])
    
    # Check package.json
    pkg_path = Path(project_path) / "frontend" / "package.json"
    if pkg_path.exists():
        try:
            with open(pkg_path) as f:
                pkg = json.load(f)
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                if "react" in deps:
                    stack["frameworks"].add("React")
                if "vite" in deps:
                    stack["tools"].add("Vite")
                if "tailwindcss" in deps:
                    stack["tools"].add("Tailwind CSS")
                if "zustand" in deps:
                    stack["frameworks"].add("Zustand")
                if "playwright" in deps:
                    stack["tools"].add("Playwright")
        except:
            pass
    
    # Check requirements.txt
    req_path = Path(project_path) / "phase1" / "requirements.txt"
    if req_path.exists():
        try:
            with open(req_path) as f:
                reqs = f.read().lower()
                if "fastapi" in reqs:
                    stack["frameworks"].add("FastAPI")
                if "sqlalchemy" in reqs:
                    stack["frameworks"].add("SQLAlchemy")
                if "pandas" in reqs:
                    stack["tools"].add("Pandas")
                if "alpaca" in reqs:
                    stack["tools"].add("Alpaca Trading API")
        except:
            pass
    
    return {k: list(v) for k, v in stack.items()}


def generate_badges(stack: dict) -> str:
    """Generate shield.io badges."""
    badges = []
    
    badge_map = {
        "Python": ("Python", "3776AB", "python"),
        "TypeScript": ("TypeScript", "3178C6", "typescript"),
        "TypeScript/React": ("React", "61DAFB", "react"),
        "React": ("React", "61DAFB", "react"),
        "FastAPI": ("FastAPI", "009688", "fastapi"),
        "Vite": ("Vite", "646CFF", "vite"),
        "Tailwind CSS": ("Tailwind", "06B6D4", "tailwindcss"),
        "Docker": ("Docker", "2496ED", "docker"),
        "Playwright": ("Playwright", "2EAD33", "playwright"),
    }
    
    for lang in stack.get("languages", []):
        if lang in badge_map:
            name, color, logo = badge_map[lang]
            badges.append(f'![{name}](https://img.shields.io/badge/{name}-{color}?style=flat-square&logo={logo}&logoColor=white)')
    
    for fw in stack.get("frameworks", []):
        if fw in badge_map:
            name, color, logo = badge_map[fw]
            badges.append(f'![{name}](https://img.shields.io/badge/{name}-{color}?style=flat-square&logo={logo}&logoColor=white)')
    
    for tool in stack.get("tools", []):
        if tool in badge_map:
            name, color, logo = badge_map[tool]
            badges.append(f'![{name}](https://img.shields.io/badge/{name}-{color}?style=flat-square&logo={logo}&logoColor=white)')
    
    return " ".join(badges)


def generate_readme(project_path: str, output_path: str = None) -> str:
    """Generate complete README.md."""
    print(f"\n{'='*60}")
    print(f"  README Generator for {CONFIG['project_name']}")
    print(f"{'='*60}\n")
    
    # Step 1: Scan project
    print("📁 Scanning project files...")
    files = get_project_files(project_path)
    print(f"   Found {len(files)} relevant files")
    
    # Step 2: Detect tech stack
    print("🔍 Detecting technology stack...")
    stack = detect_tech_stack(files, project_path)
    print(f"   Languages: {', '.join(stack['languages'])}")
    print(f"   Frameworks: {', '.join(stack['frameworks'])}")
    
    # Step 3: Build tree
    print("🌲 Building project tree...")
    tree = build_project_tree(project_path)
    
    # Step 4: Generate badges
    print("🏷️  Generating badges...")
    badges = generate_badges(stack)
    
    # Step 5: Generate AI content
    print("🤖 Generating AI content...")
    
    print("   → Project overview...")
    overview = generate_project_overview(files)
    
    print("   → Features table...")
    features = generate_features_table(files)
    
    # Step 6: Generate file summaries (limited)
    print(f"   → File summaries (up to {CONFIG['max_files_to_summarize']} files)...")
    file_summaries = []
    files_to_summarize = files[:CONFIG["max_files_to_summarize"]]
    
    for i, f in enumerate(files_to_summarize):
        print(f"      [{i+1}/{len(files_to_summarize)}] {f['path'][:50]}...")
        content = read_file_content(project_path, f["path"])
        if content:
            summary = generate_summary_with_ai(f["path"], content)
            file_summaries.append({"path": f["path"], "summary": summary})
    
    # Step 7: Build README
    print("\n📝 Building README.md...")
    
    readme = f"""<div align="center">

# 🚀 {CONFIG['project_name']}

**{CONFIG['description']}**

{badges}

</div>

---

## 📖 Overview

{overview}

---

## ✨ Features

{features}

---

## 🏗️ Project Structure

```
{tree}
```

---

## 📦 Key Components

| File | Description |
|------|-------------|
"""
    
    for fs in file_summaries[:25]:
        readme += f"| `{fs['path']}` | {fs['summary'][:100]}... |\n"
    
    readme += f"""
---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** (backend)
- **Node.js 18+** (frontend)
- **Docker** (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tradingview-recreation.git
cd tradingview-recreation

# Backend setup
cd phase1
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

### Running

```bash
# Terminal 1 - Backend
cd phase1
uvicorn services.api.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing

```bash
# Backend tests
cd phase1
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} using Colab AI**

</div>
"""
    
    # Save README
    output_path = output_path or str(Path(project_path) / "README_GENERATED.md")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(readme)
    
    print(f"\n✅ README saved to: {output_path}")
    return readme


def generate_html(md_path: str) -> str:
    """Generate HTML from markdown."""
    try:
        import markdown
    except ImportError:
        print("Installing markdown library...")
        os.system("pip install markdown")
        import markdown
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    md = markdown.Markdown(extensions=['extra', 'tables', 'toc'])
    html_content = md.convert(md_content)
    
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{CONFIG['project_name']}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            line-height: 1.7;
            color: #e2e8f0;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }}
        .container {{ max-width: 900px; margin: 0 auto; }}
        h1 {{ font-size: 2.5rem; margin-bottom: 1rem; color: #f1f5f9; }}
        h2 {{ font-size: 1.75rem; margin: 2rem 0 1rem; color: #818cf8; border-bottom: 2px solid #334155; padding-bottom: 0.5rem; }}
        h3 {{ font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #94a3b8; }}
        p {{ margin: 1rem 0; color: #cbd5e1; }}
        a {{ color: #818cf8; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        code {{ background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }}
        pre {{ background: #0f172a; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; border: 1px solid #334155; }}
        pre code {{ background: none; padding: 0; }}
        table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
        th, td {{ padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }}
        th {{ background: #1e293b; color: #f1f5f9; }}
        tr:hover {{ background: #1e293b; }}
        img {{ max-height: 28px; margin: 4px; vertical-align: middle; }}
        hr {{ border: none; border-top: 1px solid #334155; margin: 2rem 0; }}
        ul, ol {{ margin: 1rem 0; padding-left: 1.5rem; }}
        li {{ margin: 0.5rem 0; }}
    </style>
</head>
<body>
    <div class="container">
        {html_content}
    </div>
</body>
</html>"""
    
    html_path = md_path.replace('.md', '.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_doc)
    
    print(f"✅ HTML saved to: {html_path}")
    return html_path


# Main execution
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate README using Colab AI")
    parser.add_argument("--project-path", type=str, default=".", help="Path to project")
    parser.add_argument("--output", type=str, default=None, help="Output path for README.md")
    parser.add_argument("--model", type=str, default="gemini-2.5-flash-lite", help="Model to use")
    parser.add_argument("--max-files", type=int, default=50, help="Max files to summarize")
    
    args = parser.parse_args()
    
    CONFIG["model"] = args.model
    CONFIG["max_files_to_summarize"] = args.max_files
    
    # Generate README
    readme = generate_readme(args.project_path, args.output)
    
    # Generate HTML
    output_path = args.output or str(Path(args.project_path) / "README_GENERATED.md")
    generate_html(output_path)
    
    print("\n🎉 Done! README.md and README.html generated successfully.")
