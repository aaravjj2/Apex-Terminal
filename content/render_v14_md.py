#!/usr/bin/env python3
"""
V14 Renderer: Generates High-Quality Markdown from Quarter 1 Content.
"""

import os
import sys
import datetime

# Ensure we can import quarter_01
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from quarter_01 import DAYS

OUTPUT_FILE = "Quarter_01_Detailed_Plan.md"

def generate_markdown():
    """Generates the markdown content."""
    md = []
    
    # Title and Header
    md.append(f"# Apex Terminal: Quarter 1 Detailed Plan (Days 1-90)")
    md.append(f"**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    md.append(f"**Focus:** Hardening, Extending, and Industrializing the Platform")
    md.append(f"\n---\n")

    # Table of Contents
    md.append("## Table of Contents")
    for day_num in sorted(DAYS.keys()):
        day = DAYS[day_num]
        md.append(f"- [Day {day_num}: {day['title']}](#day-{day_num}-{day['title'].lower().replace(' ', '-')})")
    md.append(f"\n---\n")

    current_week = 0
    
    # Iterate through days
    for day_num in sorted(DAYS.keys()):
        day = DAYS[day_num]
        
        # Determine Week
        week_num = (day_num - 1) // 7 + 1
        if week_num > current_week:
            current_week = week_num
            md.append(f"\n# 📅 Week {current_week}\n")
            md.append(f"**Focus:** {day['title'].split(':')[0] if ':' in day['title'] else 'Weekly Objectives'}\n")
            md.append(f"---\n")
        
        # Day Header
        md.append(f"## Day {day_num}: {day['title']}")
        md.append(f"**Outcome:** {day['outcome']}\n")
        
        # Commands Section
        if day.get('commands'):
            md.append("### 🛠️ Commands")
            md.append("```bash")
            for cmd in day['commands']:
                md.append(cmd)
            md.append("```\n")
            
        # Files Section
        if day.get('files'):
            md.append("### 📂 Files & Code")
            for file_path in day['files']:
                md.append(f"- `{file_path}`")
            md.append("")
            
        # Architecture Section
        if day.get('arch'):
            md.append("### 🏗️ Architecture & Design")
            for point in day['arch']:
                md.append(f"- {point}")
            md.append("")
            
        # Autopilot/AI Section
        if day.get('autopilot'):
            md.append("### 🤖 Autopilot & AI Prompts")
            for prompt in day['autopilot']:
                md.append(f"- {prompt}")
            md.append("")
            
        # Risk & Metrics
        md.append("### 🛡️ Risk & Metrics")
        if day.get('risk'):
            md.append(f"- **Risk:** {day['risk']}")
        if day.get('metrics'):
            md.append(f"- **Metric:** {day['metrics']}")
            
        md.append(f"\n---\n")

    return "\n".join(md)

if __name__ == "__main__":
    print(f"Generating {OUTPUT_FILE}...")
    content = generate_markdown()
    with open(OUTPUT_FILE, "w") as f:
        f.write(content)
    print(f"Done! ({len(content)} bytes)")
