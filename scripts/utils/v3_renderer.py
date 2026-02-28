from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle, Spacer, KeepTogether, ListFlowable, ListItem
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY

# High-Fidelity Colors
APEX_DARK   = colors.HexColor("#0D1117")  # GitHub Dark / Midnight
APEX_PANEL  = colors.HexColor("#161B22")  # Slightly Lighter Panel
APEX_BORDER = colors.HexColor("#30363D")  # Subtle Order Border
APEX_TEXT   = colors.HexColor("#C9D1D9")  # Soft White
APEX_DIM    = colors.HexColor("#8B949E")  # Dimmed Grey

# Accents
APEX_TEAL   = colors.HexColor("#2ec4b6")
APEX_BLUE   = colors.HexColor("#3a86ff")
APEX_PURPLE = colors.HexColor("#8338ec")
APEX_RED    = colors.HexColor("#ff006e")
APEX_AMBER  = colors.HexColor("#fb5607")
APEX_GREEN  = colors.HexColor("#06d6a0")

WHITE       = colors.white

FONT_MAIN   = "Helvetica"
FONT_BOLD   = "Helvetica-Bold"
FONT_CODE   = "Courier"

def make_styles():
    styles = getSampleStyleSheet()
    
    # Base Text Style
    styles.add(ParagraphStyle(name='ApexBody',
        fontName=FONT_MAIN, fontSize=9, leading=13,
        textColor=APEX_TEXT, spaceAfter=6))
        
    styles.add(ParagraphStyle(name='ApexBodySmall',
        fontName=FONT_MAIN, fontSize=8, leading=11,
        textColor=APEX_DIM, spaceAfter=4))
        
    # Headers
    styles.add(ParagraphStyle(name='ApexH1',
        fontName=FONT_BOLD, fontSize=24, leading=28,
        textColor=APEX_TEAL, spaceAfter=12))
        
    styles.add(ParagraphStyle(name='ApexH2',
        fontName=FONT_BOLD, fontSize=16, leading=20,
        textColor=WHITE, spaceAfter=8, spaceBefore=12,
        borderPadding=(0, 0, 4, 0),  # Bottom border padding
        borderColor=APEX_BORDER, borderWidth=0.5))

    styles.add(ParagraphStyle(name='ApexH3',
        fontName=FONT_BOLD, fontSize=12, leading=14,
        textColor=APEX_BLUE, spaceAfter=6, spaceBefore=8))

    # Special Block Styles
    styles.add(ParagraphStyle(name='ApexAlertTitle',
        fontName=FONT_BOLD, fontSize=10, leading=12,
        textColor=APEX_AMBER, spaceAfter=2))
        
    styles.add(ParagraphStyle(name='ApexAlertBody',
        fontName=FONT_MAIN, fontSize=9, leading=11,
        textColor=APEX_TEXT, leftIndent=8))

    # Code Block
    styles.add(ParagraphStyle(name='ApexCode',
        fontName=FONT_CODE, fontSize=8, leading=10,
        textColor=APEX_GREEN, backColor=APEX_PANEL,
        borderPadding=6, spaceAfter=8, spaceBefore=4))

    return styles

STYLES = make_styles()

def section_box(title, content_list, style=STYLES['ApexBody'], color=APEX_PANEL):
    """Creates a styled box with a title and content."""
    elements = []
    # Title
    elements.append(Paragraph(title, STYLES['ApexH3']))
    # Content
    for item in content_list:
        if isinstance(item, str):
            elements.append(Paragraph(f"• {item}", style))
        else:
            elements.append(item)
    return elements

def build_week_page(story, week_data):
    """
    Renders a single week's page.
    week_data structure:
    {
        'week_num': 1,
        'quarter': 1,
        'title': '...',
        'subtitle': '...',
        'kpis': [('KPI', 'Value'), ...],
        'architecture': ['Point 1', 'Point 2'],
        'autopilot': ['Logic 1', 'Logic 2'],
        'operational': ['Step 1', 'Step 2'],
        'risk': ['Risk 1', 'Mitigation 1'],
        'day_by_day': ['Mon: ...', 'Tue: ...'],
    }
    """
    wd = week_data
    
    # 1. Header
    story.append(Paragraph(f"WEEK {wd['week_num']:02d} • Q{wd['quarter']}", 
                           ParagraphStyle('WeekMeta', fontName=FONT_BOLD, fontSize=10, textColor=APEX_DIM)))
    story.append(Paragraph(wd['title'], STYLES['ApexH1']))
    story.append(Paragraph(wd['subtitle'], ParagraphStyle('WeekSub', fontName=FONT_MAIN, fontSize=12, textColor=WHITE, spaceAfter=16)))
    
    # 2. KPI Bar (Grid)
    kpi_data = [[Paragraph(f"<b>{k}</b><br/><font size=10 color={APEX_TEAL.hexval()}>{v}</font>", 
                           ParagraphStyle('KPI', alignment=TA_CENTER, textColor=APEX_DIM)) for k, v in wd.get('kpis', [])]]
    
    if kpi_data:
        t = Table(kpi_data, colWidths=[1.5*inch]*len(kpi_data[0]))
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), APEX_PANEL),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOX', (0,0), (-1,-1), 1, APEX_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 16))

    # 3. Main Grid Layout (2 Columns)
    # Left Column: Architecture, Autopilot
    # Right Column: Operational, Risk
    
    left_col = []
    if 'architecture' in wd:
        left_col.extend(section_box("Technical Architecture", wd['architecture']))
        left_col.append(Spacer(1, 12))
        
    if 'autopilot' in wd:
        left_col.extend(section_box("🤖 Autopilot AI Logic", wd['autopilot'], color=APEX_PURPLE))
        left_col.append(Spacer(1, 12))

    right_col = []
    if 'operational' in wd:
        right_col.extend(section_box("⚙️ Operational Playbook", wd['operational']))
        right_col.append(Spacer(1, 12))
        
    if 'risk' in wd:
        right_col.extend(section_box("⚠️ Risk & Contingency", wd['risk'], color=APEX_RED))
        right_col.append(Spacer(1, 12))

    # Compute max height or flow
    # Since ReportLab tables are rigid, we can put flowables inside cells.
    
    # Using a 2-column table for layout
    col_width = 3.65 * inch 
    layout_data = [[left_col, right_col]]
    t_layout = Table(layout_data, colWidths=[col_width, col_width])
    t_layout.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_layout)
    story.append(Spacer(1, 16))

    # 4. Day-by-Day (Full Width)
    if 'day_by_day' in wd:
        story.append(Paragraph("📅 Day-by-Day Schedule", STYLES['ApexH3']))
        # Render as a list or table
        day_rows = []
        for day_entry in wd['day_by_day']:
            # Assume format "Mon: Task"
            if ":" in day_entry:
                day, task = day_entry.split(":", 1)
                day_rows.append([
                    Paragraph(f"<b>{day}</b>", STYLES['ApexBody']),
                    Paragraph(task.strip(), STYLES['ApexBody'])
                ])
            else:
                day_rows.append([Paragraph("•", STYLES['ApexBody']), Paragraph(day_entry, STYLES['ApexBody'])])
        
        t_days = Table(day_rows, colWidths=[0.6*inch, 6.7*inch])
        t_days.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, APEX_BORDER),
            ('BACKGROUND', (0,0), (0,-1), APEX_PANEL), # Highlight Day Column
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_days)

    story.append(Spacer(1, 24)) # End of Week Spacer
