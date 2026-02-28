"""
v4_renderer.py — FPDF2-based daily page renderer.
Uses explicit x positioning to avoid layout errors.
"""
from fpdf import FPDF
import re

def _clean(txt):
    """Strip characters that Helvetica/latin-1 can't encode."""
    return re.sub(r'[^\x00-\xff]', '', str(txt))

# Colors (R, G, B)
TEAL       = (13, 148, 136)
TEAL_DARK  = (17, 94, 89)
AMBER      = (180, 83, 9)
RED        = (220, 38, 38)
DARK       = (30, 41, 59)
MID        = (71, 85, 105)
BLUE       = (30, 64, 175)
LIGHT_GRAY = (241, 245, 249)


class BiblePDF(FPDF):

    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MID)
        self.cell(0, 10, f"Apex Terminal  |  Page {self.page_no()}", align="C",
                  new_x="LMARGIN", new_y="NEXT")

    def _w(self):
        """Usable text width."""
        return self.w - self.l_margin - self.r_margin

    def _reset_x(self):
        self.set_x(self.l_margin)


def build_day_page(pdf, day_data, week_num, quarter):
    pdf.add_page()
    w = pdf._w()

    # ── Header ────────────────────────────────────────────────────────────────
    pdf._reset_x()
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*TEAL)
    pdf.cell(w, 12, _clean(f"DAY {day_data['day_global']}  |  {day_data['weekday']}"),
             align="C", new_x="LMARGIN", new_y="NEXT")

    pdf._reset_x()
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(*MID)
    pdf.cell(w, 8, _clean(f"Week {week_num} - Q{quarter} - {day_data['title']}"),
             align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_draw_color(*TEAL)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(6)

    # ── Objective ─────────────────────────────────────────────────────────────
    pdf._reset_x()
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(w, 5, _clean(f"OBJECTIVE: {day_data['outcome']}"))
    pdf.ln(3)

    # ── Section: Technology & Commands ────────────────────────────────────────
    _section(pdf, w, "TECHNOLOGY & COMMANDS", AMBER)
    for c in (day_data.get('commands') or []):
        pdf._reset_x()
        pdf.set_font("Courier", "", 9)
        pdf.set_text_color(*BLUE)
        pdf.set_fill_color(*LIGHT_GRAY)
        pdf.multi_cell(w, 5, _clean(f"  $ {c}"), fill=True)
        pdf.ln(1)

    if day_data.get('files'):
        pdf._reset_x()
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(w, 5, "Files to Create / Edit:")
        for f in day_data['files']:
            pdf._reset_x()
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*DARK)
            pdf.multi_cell(w, 5, _clean(f"  -  {f}"))

    # ── Section: Architecture & Logic ─────────────────────────────────────────
    _section(pdf, w, "ARCHITECTURE & LOGIC", AMBER)
    for a in (day_data.get('arch') or []):
        pdf._reset_x()
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(w, 5, _clean(f"  -  {a}"))

    # ── Section: Autopilot & AI Prompts ───────────────────────────────────────
    _section(pdf, w, "AUTOPILOT & AI PROMPTS", TEAL)
    for a in (day_data.get('autopilot') or []):
        pdf._reset_x()
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEAL_DARK)
        pdf.multi_cell(w, 5, _clean(f"  >  {a}"))
        pdf.ln(1)

    # ── Section: Risk & Validation ────────────────────────────────────────────
    _section(pdf, w, "RISK & VALIDATION", RED)
    if day_data.get('risk'):
        pdf._reset_x()
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*RED)
        pdf.multi_cell(w, 5, _clean(f"Risk: {day_data['risk']}"))
    if day_data.get('metrics'):
        pdf._reset_x()
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*TEAL_DARK)
        pdf.multi_cell(w, 5, _clean(f"Success Metric: {day_data['metrics']}"))


def _section(pdf, w, label, color):
    pdf.ln(4)
    pdf._reset_x()
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*color)
    pdf.multi_cell(w, 7, label)
    pdf.set_draw_color(*color)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)
