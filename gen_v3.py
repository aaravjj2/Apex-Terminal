
import os
import sys
from reportlab.platypus import SimpleDocTemplate, PageBreak
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

# Add local directory to path to import renderer/content
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from v3_renderer import build_week_page
from content import (
    weeks_01_13,
    weeks_14_26,
    weeks_27_39,
    weeks_40_52,
    weeks_53_65,
    weeks_66_78,
    weeks_79_91,
    weeks_92_104
)

def generate_pdf():
    # Final Output Name
    output_filename = "Apex_Terminal_Master_Plan_Bible_Edition.pdf"
    
    doc = SimpleDocTemplate(
        output_filename, pagesize=letter,
        leftMargin=0.5*inch, rightMargin=0.5*inch,
        topMargin=0.5*inch, bottomMargin=0.5*inch
    )

    story = []

    # 1. Collect all weeks
    all_weeks = {}
    
    # Merge content modules
    all_weeks.update(weeks_01_13.WEEKS)
    all_weeks.update(weeks_14_26.WEEKS)
    all_weeks.update(weeks_27_39.WEEKS)
    all_weeks.update(weeks_40_52.WEEKS)
    all_weeks.update(weeks_53_65.WEEKS)
    all_weeks.update(weeks_66_78.WEEKS)
    all_weeks.update(weeks_79_91.WEEKS)
    all_weeks.update(weeks_92_104.WEEKS)

    # 2. Render pages
    sorted_weeks = sorted(all_weeks.keys())
    
    # Add Title Page? (Optional, skipping for now to focus on week content)
    
    for i, week_num in enumerate(sorted_weeks):
        week_data = all_weeks[week_num]
        
        # Build the page for this week
        build_week_page(story, week_data)
        
        # Page break after every week
        story.append(PageBreak())

    # 3. Build PDF
    doc.build(story)
    print(f"✅ Generated V3 Bible Edition: {output_filename}")
    print(f"   Total Pages: {len(sorted_weeks)}")

if __name__ == "__main__":
    generate_pdf()
