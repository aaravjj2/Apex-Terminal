
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from v4_renderer import BiblePDF, build_day_page
from content import quarter_01, quarter_02, quarter_03, quarter_04

def generate_pdf():
    output = "Apex_Terminal_Master_Plan_365_Day_Bible.pdf"

    # Collect all days
    all_days = {}
    all_days.update(quarter_01.DAYS)
    all_days.update(quarter_02.DAYS)
    all_days.update(quarter_03.DAYS)
    all_days.update(quarter_04.DAYS)

    # Create PDF
    pdf = BiblePDF(orientation="P", unit="mm", format="letter")
    pdf.set_auto_page_break(auto=True, margin=20)

    # Render pages
    sorted_days = sorted(all_days.keys())
    for day_num in sorted_days:
        day_data = all_days[day_num]
        week_num = (day_num - 1) // 5 + 1
        quarter_num = (week_num - 1) // 13 + 1
        build_day_page(pdf, day_data, week_num, quarter_num)

    # Output
    pdf.output(output)
    print(f"Generated: {output}")
    print(f"Total Days: {len(sorted_days)}")
    print(f"File Size: {os.path.getsize(output) / 1024:.0f} KB")

if __name__ == "__main__":
    generate_pdf()
