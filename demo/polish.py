
# Polish: fix nav label clipping, improve group headers, smoother layout
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
html = open(path, encoding='utf-8').read()

# 1. Shorten nav-group labels in HTML
labels = {
    '<div class="nav-group-label">TRADE</div>': '<div class="nav-group-label">TRADE</div>',
    '<div class="nav-group-label">STRATEGY</div>': '<div class="nav-group-label">STRAT</div>',
    '<div class="nav-group-label">MARKETS</div>': '<div class="nav-group-label">MKTS</div>',
    '<div class="nav-group-label">ASSET CLASSES</div>': '<div class="nav-group-label">ASSET</div>',
    '<div class="nav-group-label">ASSETS</div>': '<div class="nav-group-label">ASSET</div>',
}
for old, new in labels.items():
    html = html.replace(old, new)

# 2. Inject final polish CSS at the very end of the last </style> block
polish_css = """
<style>
/* ===== FINAL POLISH ===== */

/* Nav group labels: properly sized */
.nav-group-label {
  font-size: 7.5px;
  font-weight: 700;
  color: var(--tx3);
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 2px 0 5px;
  user-select: none;
  width: 100%;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  opacity: .7;
}

/* Nav group: no overflow leak */
.nav-group { overflow: hidden; width: 100%; }

/* Active bar: inside, not outside */
.nav-item.active::before {
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5px;
  height: 16px;
  border-radius: 2px;
}

/* Nav item: smooth */
.nav-item {
  width: 42px;
  height: 34px;
  margin: 0 auto 2px;
  border-radius: 8px;
}

/* Wider nav */
#leftnav { width: 60px; }
#layout { grid-template-columns: 60px 1fr 292px; }

/* Chart: more space from drawing strip */
#cmw { padding-left: 30px; }
.draw-strip { width: 30px; }

/* View fade in smoothly */
.view { opacity: 0; pointer-events: none; transition: opacity .15s ease; }
.view.active { opacity: 1; pointer-events: auto; }

/* KPI strip: scrollbar hidden */
.kpi-strip::-webkit-scrollbar { height: 0; }
.kpi-strip { scroll-behavior: smooth; }

/* Better chart header spacing */
.chart-header { gap: 8px; padding: 0 12px; }
.tf-btn { padding: 3px 7px; font-size: 11px; }

/* Order book depth rows slightly taller */
.depth-row { height: 21px; }

/* All canvases: crisp */
canvas { image-rendering: pixelated; }

/* Section group separator line */
.nav-group { border-bottom: 1px solid rgba(42,46,57,0.5); }
.nav-group:last-child { border-bottom: none; }
.nav-group-bottom { border-top: 1px solid rgba(42,46,57,0.5); border-bottom: none !important; }

/* Logo area */
.nav-logo { 
  border-bottom: 1px solid var(--bdr); 
  height: 42px;
  cursor: pointer;
}
.nav-logo:hover svg polygon { fill: var(--brand-h); }

/* Topbar more refined */
#topbar { height: 42px; }
#app { grid-template-rows: 42px 1fr 22px; }

/* Smooth scrollbars everywhere */
* { scrollbar-width: thin; scrollbar-color: var(--bg4) transparent; }

/* Grid views: smoother gaps */
.attr-layout { gap: 0; }
.attr-col { padding: 14px 16px; }

/* Tables: row highlight transition */
tr { transition: background .06s; }

/* KPI item hover */
.kpi-item { cursor: default; transition: background .1s; border-right: 1px solid var(--bdr); }
.kpi-item:hover { background: rgba(255,255,255,.02); }

/* Right sidebar tabs: cleaner */
.s-tab { padding: 9px 13px; font-size: 11px; }

/* Status bar */
#statusbar { height: 22px; font-size: 10px; letter-spacing: .02em; }
</style>
"""

# Append before </body>
html = html.replace('</body>\n</html>', polish_css + '\n</body>\n</html>')

open(path, 'w', encoding='utf-8').write(html)
print(f"Polish done. File: {len(html)} bytes")
