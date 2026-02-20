
import os
import sys

# Import Days
from quarter_04 import DAYS as Q4_DAYS

# ─── MARKDOWN GENERATION ─────────────────────────────────────────────────────

def generate_markdown():
    lines = []
    lines.append("# Quarter 4: Ecosystem & Endgame (Days 271-365)")
    lines.append("")
    lines.append("> **Theme**: White Label, Fund Administration, Quantum & IPO")
    lines.append("")
    lines.append("[TOC]")
    lines.append("")
    
    # Sort days
    sorted_days = sorted(Q4_DAYS.keys())
    
    current_week = -1
    
    for day_num in sorted_days:
        day = Q4_DAYS[day_num]
        week_num = (day_num - 1) // 7 + 1
        
        if week_num != current_week:
            current_week = week_num
            lines.append(f"## Week {week_num}")
            lines.append("")
            
        lines.append(f"### Day {day_num}: {day['title']}")
        lines.append(f"**{day['weekday']}** | *Outcome: {day['outcome']}*")
        lines.append("")
        
        lines.append("#### 1. Tech & Commands")
        lines.append("```bash")
        for cmd in day['commands']:
            lines.append(cmd)
        lines.append("```")
        lines.append("")
        
        lines.append("#### 2. Files")
        for f in day['files']:
            lines.append(f"- `{f}`")
        lines.append("")
        
        lines.append("#### 3. Architecture")
        for a in day['arch']:
            lines.append(f"- {a}")
        lines.append("")
        
        lines.append("#### 4. Autopilot Prompts")
        for p in day['autopilot']:
            lines.append(f"- {p}")
        lines.append("")
        
        lines.append("#### 5. Risk & Metrics")
        lines.append(f"- **Risk**: {day['risk']}")
        lines.append(f"- **Metric**: {day['metrics']}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
    return "\n".join(lines)

if __name__ == "__main__":
    md_content = generate_markdown()
    with open("Quarter_04_Detailed_Plan.md", "w") as f:
        f.write(md_content)
    print("Generated Quarter_04_Detailed_Plan.md")
