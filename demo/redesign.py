
# Redesign: grouped collapsible nav + breathing room throughout
import re

path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
html = open(path, encoding='utf-8').read()

# ──────────────────────────────────────────────────────────────
# 1. REPLACE THE ENTIRE #leftnav HTML
# ──────────────────────────────────────────────────────────────
old_nav_start = '<!-- LEFT NAV -->\n<div id="leftnav">'
old_nav_end = '</div>\n\n<!-- CONTENT AREA -->'

new_nav = '''<!-- LEFT NAV -->
<div id="leftnav">

  <!-- Logo icon at top -->
  <div class="nav-logo">
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><polygon points="10,2 18,7 18,13 10,18 2,13 2,7" fill="#2962FF" opacity=".9"/><polyline points="5,11 8,7 11,9 15,5" stroke="white" stroke-width="1.6" fill="none"/></svg>
  </div>

  <!-- GROUP: TRADE -->
  <div class="nav-group">
    <div class="nav-group-label">TRADE</div>
    <div class="nav-item active" data-view="trading" onclick="switchView('trading')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="1,12 5,7 9,9 13,3 14,3"/><polyline points="13,3 14,3 14,5"/></svg>
      <span class="nav-tip">Trading</span>
    </div>
    <div class="nav-item" data-view="dashboard" onclick="switchView('dashboard')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>
      <span class="nav-tip">Dashboard</span>
    </div>
    <div class="nav-item" data-view="portfolio" onclick="switchView('portfolio')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 14 L2 8 L5 5 L8 8 L11 4 L14 8 L14 14z"/></svg>
      <span class="nav-tip">Portfolio</span>
    </div>
    <div class="nav-item" data-view="orders" onclick="switchView('orders')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="11" height="11" rx="1"/><line x1="4.5" y1="6" x2="10.5" y2="6"/><line x1="4.5" y1="8.5" x2="8" y2="8.5"/></svg>
      <span class="nav-tip">Orders / Blotter</span>
    </div>
    <div class="nav-item" data-view="risk" onclick="switchView('risk')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7.5 1.5L1 13.5h13z"/><line x1="7.5" y1="6.5" x2="7.5" y2="9.5"/><circle cx="7.5" cy="11.5" r=".7" fill="currentColor"/></svg>
      <span class="nav-tip">Risk Management</span>
    </div>
    <div class="nav-item" data-view="heatmap" onclick="switchView('heatmap')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1.5" y="1.5" width="4.5" height="4.5" rx=".8"/><rect x="9" y="1.5" width="4.5" height="4.5" rx=".8"/><rect x="1.5" y="9" width="4.5" height="4.5" rx=".8"/><rect x="9" y="9" width="4.5" height="4.5" rx=".8"/></svg>
      <span class="nav-tip">Market Heatmap</span>
    </div>
  </div>

  <!-- GROUP: STRATEGY -->
  <div class="nav-group">
    <div class="nav-group-label">STRATEGY</div>
    <div class="nav-item" data-view="backtest" onclick="switchView('backtest')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7.5" cy="7.5" r="6"/><polyline points="4.5,7.5 7.5,4.5 10.5,9"/></svg>
      <span class="nav-tip">Backtest</span>
    </div>
    <div class="nav-item" data-view="walkforward" onclick="switchView('walkforward')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="1.5,12 4.5,7.5 7.5,9.5 10.5,4.5 13.5,6.5"/><line x1="13.5" y1="6.5" x2="13.5" y2="12"/></svg>
      <span class="nav-tip">Walk-Forward</span>
    </div>
    <div class="nav-item" data-view="montecarlo" onclick="switchView('montecarlo')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 11.5 Q5 4 7.5 7.5 Q10 11 13 2.5"/></svg>
      <span class="nav-tip">Monte Carlo</span>
    </div>
    <div class="nav-item" data-view="strategy" onclick="switchView('strategy')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3.5,11.5 6.5,5.5 9.5,8.5 12.5,3.5"/><circle cx="3.5" cy="11.5" r="1.5" fill="currentColor"/><circle cx="12.5" cy="3.5" r="1.5" fill="currentColor"/></svg>
      <span class="nav-tip">Strategy Studio</span>
    </div>
  </div>

  <!-- GROUP: MARKETS -->
  <div class="nav-group">
    <div class="nav-group-label">MARKETS</div>
    <div class="nav-item" data-view="options" onclick="switchView('options')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12.5 C3 6.5 6.5 2.5 12.5 2.5"/><circle cx="7.5" cy="7.5" r="2.5"/></svg>
      <span class="nav-tip">Options Chain</span>
    </div>
    <div class="nav-item" data-view="screener" onclick="switchView('screener')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="13.5" y2="13.5"/><line x1="4.5" y1="6.5" x2="8.5" y2="6.5"/><line x1="6.5" y1="4.5" x2="6.5" y2="8.5"/></svg>
      <span class="nav-tip">Screener</span>
    </div>
    <div class="nav-item" data-view="alerts" onclick="switchView('alerts')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9.5 3A4 4 0 0 0 3.5 7v3l-1 1.5h10l-1-1.5V7M6.5 13a2 2 0 0 0 2-2H4.5a2 2 0 0 0 2 2z"/></svg>
      <span class="nav-tip">Alerts</span>
    </div>
    <div class="nav-item" data-view="macro" onclick="switchView('macro')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1.5" y="2.5" width="12" height="10.5" rx="1"/><line x1="1.5" y1="6" x2="13.5" y2="6"/><line x1="5.5" y1="2.5" x2="5.5" y2="6"/><line x1="9.5" y1="2.5" x2="9.5" y2="6"/></svg>
      <span class="nav-tip">Economic Calendar</span>
    </div>
    <div class="nav-item" data-view="research" onclick="switchView('research')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11.5 1.5H3.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1z"/><line x1="4.5" y1="5.5" x2="10.5" y2="5.5"/><line x1="4.5" y1="8" x2="8.5" y2="8"/></svg>
      <span class="nav-tip">Research / Sentiment</span>
    </div>
    <div class="nav-item" data-view="social" onclick="switchView('social')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5.5" r="2.2"/><circle cx="10" cy="5.5" r="2.2"/><path d="M1 13c0-2 1.8-3.5 4-3.5h5c2.2 0 4 1.5 4 3.5"/></svg>
      <span class="nav-tip">Ideas / Social</span>
    </div>
  </div>

  <!-- GROUP: ASSET CLASSES -->
  <div class="nav-group">
    <div class="nav-group-label">ASSETS</div>
    <div class="nav-item" data-view="fixedincome" onclick="switchView('fixedincome')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12.5 C2 6.5 6.5 2.5 13.5 2.5"/><line x1="2" y1="9.5" x2="13.5" y2="9.5" stroke-dasharray="2,2"/></svg>
      <span class="nav-tip">Fixed Income</span>
    </div>
    <div class="nav-item" data-view="fx" onclick="switchView('fx')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7.5" cy="7.5" r="6"/><path d="M1.5 7.5h12M7.5 1.5c-2.3 1.8-3.5 3.5-3.5 6s1.2 4.2 3.5 6M7.5 1.5c2.3 1.8 3.5 3.5 3.5 6s-1.2 4.2-3.5 6"/></svg>
      <span class="nav-tip">FX Analytics</span>
    </div>
    <div class="nav-item" data-view="commodities" onclick="switchView('commodities')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13V7l4.5-5 4.5 5v6H3z"/><rect x="5.5" y="10" width="4" height="3"/></svg>
      <span class="nav-tip">Commodities</span>
    </div>
    <div class="nav-item" data-view="crypto" onclick="switchView('crypto')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5.5 2.5h4a2 2 0 0 1 0 4H4.5m5 0h1a2 2 0 0 1 0 4H4.5M5.5 6.5h4M6.5 2.5v10"/></svg>
      <span class="nav-tip">Crypto Analytics</span>
    </div>
  </div>

  <!-- Spacer pushes bottom items down -->
  <div class="nav-spacer"></div>

  <!-- GROUP: SYSTEM -->
  <div class="nav-group nav-group-bottom">
    <div class="nav-item" data-view="autopilot" onclick="switchView('autopilot')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7.5" cy="7.5" r="2.8"/><path d="M7.5 1v1.8M7.5 12.2v1.8M1 7.5h1.8M12.2 7.5H14M3 3l1.2 1.2M10.8 10.8L12 12M3 12l1.2-1.2M10.8 4.2L12 3"/></svg>
      <span class="nav-tip">Autopilot / AI</span>
    </div>
    <div class="nav-item" data-view="compliance" onclick="switchView('compliance')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7.5 1L1.5 3.8v4.7c0 3.2 2.3 5.5 6 6.5 3.7-1 6-3.3 6-6.5V3.8z"/><polyline points="5,7.5 7,9.5 11,5.5"/></svg>
      <span class="nav-tip">Compliance</span>
    </div>
    <div class="nav-item" data-view="platform" onclick="switchView('platform')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="2.5" width="13" height="9" rx="1"/><line x1="4.5" y1="11.5" x2="4.5" y2="13.5"/><line x1="10.5" y1="11.5" x2="10.5" y2="13.5"/><line x1="2.5" y1="13.5" x2="12.5" y2="13.5"/></svg>
      <span class="nav-tip">Platform</span>
    </div>
  </div>

</div>

<!-- CONTENT AREA -->'''

# Find and replace the nav section
nav_pattern = r'<!-- LEFT NAV -->\n<div id="leftnav">.*?</div>\n\n<!-- CONTENT AREA -->'
html = re.sub(nav_pattern, new_nav, html, flags=re.DOTALL)

# ──────────────────────────────────────────────────────────────
# 2. OVERRIDE CSS - append at end of </style>
# ──────────────────────────────────────────────────────────────
override_css = """
/* ===== REDESIGNED NAV ===== */
#layout{grid-template-columns:56px 1fr 290px}
#leftnav{width:56px;padding:0;gap:0;overflow-y:auto;overflow-x:hidden;background:var(--bg0);border-right:1px solid var(--bdr)}
#leftnav::-webkit-scrollbar{width:0}
.nav-logo{width:56px;height:48px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--bdr);flex-shrink:0}
.nav-group{display:flex;flex-direction:column;align-items:center;padding:6px 0;border-bottom:1px solid rgba(42,46,57,0.6)}
.nav-group-bottom{border-bottom:none;border-top:1px solid rgba(42,46,57,0.6);padding:6px 0}
.nav-group-label{font-size:8px;font-weight:700;color:var(--tx3);letter-spacing:.1em;text-transform:uppercase;padding:2px 0 4px;user-select:none}
.nav-spacer{flex:1;min-height:8px}
.nav-item{width:40px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--tx3);cursor:pointer;transition:background .12s,color .12s;position:relative;flex-shrink:0;margin-bottom:1px}
.nav-item:hover{color:var(--tx);background:var(--bg2)}
.nav-item.active{color:var(--brand);background:var(--brand-m)}
.nav-item.active::before{content:'';position:absolute;left:-8px;top:6px;bottom:6px;width:2.5px;background:var(--brand);border-radius:0 2px 2px 0}
.nav-tip{position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);background:var(--bg4);border:1px solid var(--bdr-a);padding:5px 11px;border-radius:5px;font-size:11px;font-weight:500;color:var(--tx);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:100;box-shadow:0 4px 16px rgba(0,0,0,.5)}
.nav-item:hover .nav-tip{opacity:1}
/* Remove old navd dividers */
.navd{display:none}

/* ===== BREATHING ROOM ===== */
/* Topbar */
#topbar{padding:0 14px;gap:8px}
.tb-logo{font-size:15px;gap:6px}

/* KPI strip */
.kpi-strip{flex-shrink:0;overflow-x:auto}
.kpi-item{padding:10px 16px;min-width:115px}
.kpi-label{font-size:10px;margin-bottom:3px}
.kpi-val{font-size:18px}

/* Panel headers */
.ph{padding:8px 14px;min-height:32px}
.ph-title span{font-size:11px}

/* Tables */
table{width:100%;border-collapse:collapse}
th{padding:7px 12px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.05em;text-transform:uppercase;background:var(--bg2);border-bottom:1px solid var(--bdr);text-align:left;white-space:nowrap;position:sticky;top:0;z-index:1}
td{padding:7px 12px;font-size:12px;border-bottom:1px solid rgba(42,46,57,.5);white-space:nowrap}
tr:hover td{background:rgba(255,255,255,.02)}
.tbl-wrap{overflow:auto;flex:1}

/* Fields */
.field label{font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px;display:block}
.field input,.field select,.field textarea{background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:7px 10px;font-size:12px;color:var(--tx);outline:none;width:100%;transition:border-color .15s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--brand)}

/* Buttons */
.btn-pri{display:flex;align-items:center;gap:5px;padding:7px 14px;background:var(--brand);color:#fff;border-radius:var(--r4);font-size:12px;font-weight:600;cursor:pointer;transition:background .12s,transform .08s}
.btn-pri:hover{background:var(--brand-h)}
.btn-pri:active{transform:scale(.97)}
.btn-g{display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);font-size:12px;font-weight:500;cursor:pointer;transition:background .12s}
.btn-g:hover{background:var(--bg4);border-color:var(--bdr-a)}
.btn-sm{padding:4px 10px;font-size:11px;font-weight:500;border-radius:var(--r2);cursor:pointer;transition:background .1s}
.btn-sm.neutral{background:var(--bg2);border:1px solid var(--bdr);color:var(--tx2)}
.btn-sm.neutral:hover{background:var(--bg4)}

/* Chart header */
.chart-header{padding:0 10px;height:36px;gap:7px}
.ch-sym{font-size:14px}
.ch-price{font-size:16px}

/* Chart body */
.chart-body{grid-template-rows:1fr 90px}

/* View transition */
.view{opacity:0;transition:opacity .12s ease}
.view.active{opacity:1}

/* Sidebar content */
.s-content{flex:1;overflow:hidden;display:none;flex-direction:column}
.s-content.active{display:flex}

/* Fund rows */
.fund-row{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid rgba(42,46,57,.3)}
.fund-lbl{font-size:11px;color:var(--tx2);flex:1}
.fund-val{font-family:var(--mono);font-size:11px;font-weight:500;text-align:right}

/* Td helpers */
.td-sym{font-weight:600;font-size:12px;color:var(--tx)}
.td-name{font-size:10px;color:var(--tx3);margin-top:1px}
.td-mono{font-family:var(--mono);font-size:11px;color:var(--tx)}
.td-up{font-family:var(--mono);font-size:11px;color:var(--up)}
.td-dn{font-family:var(--mono);font-size:11px;color:var(--dn)}
.badge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.04em}
.badge.up{background:rgba(8,153,129,.15);color:var(--up)}
.badge.dn{background:rgba(242,54,69,.15);color:var(--dn)}
.badge.warn{background:rgba(247,147,26,.15);color:var(--warn)}
.badge.neutral{background:var(--bg2);color:var(--tx2);border:1px solid var(--bdr)}
.badge.info{background:rgba(41,98,255,.15);color:var(--brand)}

/* Order/filter tabs */
.order-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;padding:0 4px;overflow-x:auto}
.o-tab{padding:7px 14px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;white-space:nowrap;position:relative;transition:color .1s;flex-shrink:0}
.o-tab:hover{color:var(--tx)}
.o-tab.active{color:var(--tx)}
.o-tab.active::after{content:'';position:absolute;bottom:0;left:6px;right:6px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}
.order-tc{display:none;flex:1;flex-direction:column;overflow:hidden}
.order-tc.active{display:flex}

/* Filter pills */
.filter-pill{padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;background:var(--bg2);border:1px solid var(--bdr);transition:all .1s}
.filter-pill:hover{color:var(--tx);border-color:var(--bdr-a)}
.filter-pill.active{background:var(--brand-m);color:var(--brand);border-color:rgba(41,98,255,.3)}

/* Alloc bars */
.alloc-row{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.alloc-lbl{font-size:11px;color:var(--tx2);width:70px;flex-shrink:0}
.alloc-track{flex:1;height:5px;background:var(--bg2);border-radius:3px;overflow:hidden}
.alloc-fill{height:100%;border-radius:3px;transition:width .4s}
.alloc-pct{font-family:var(--mono);font-size:10px;color:var(--tx3);width:32px;text-align:right}

/* Exp btn */
.exp-btn{padding:3px 9px;border-radius:3px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;background:var(--bg2);border:1px solid var(--bdr);transition:all .1s;white-space:nowrap}
.exp-btn:hover{color:var(--tx)}.exp-btn.active{background:var(--brand-m);color:var(--brand);border-color:rgba(41,98,255,.3)}

/* Port grid */
.port-grid{display:grid;grid-template-columns:1fr 220px;flex:1;min-height:0;overflow:hidden}

/* Right sidebar */
#rightsidebar{width:290px;background:var(--bg0);border-left:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden}
.s-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;overflow-x:auto}
.s-tab{padding:8px 12px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;white-space:nowrap;position:relative;transition:color .1s}
.s-tab:hover{color:var(--tx)}
.s-tab.active{color:var(--tx)}
.s-tab.active::after{content:'';position:absolute;bottom:0;left:4px;right:4px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}

/* Toast */
#toast-wrap{position:fixed;bottom:30px;right:10px;display:flex;flex-direction:column;gap:6px;z-index:200;pointer-events:none}
.toast{padding:9px 14px;background:var(--bg4);border:1px solid var(--bdr-a);border-radius:var(--r6);font-size:12px;color:var(--tx);box-shadow:var(--sh3);animation:toastIn .2s ease;pointer-events:none;max-width:240px}
.toast.success{border-color:rgba(8,153,129,.4)}
.toast.error{border-color:rgba(242,54,69,.4)}
.toast.info{border-color:rgba(41,98,255,.4)}
@keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

/* Status bar */
#statusbar{background:var(--bg0);border-top:1px solid var(--bdr);display:flex;align-items:center;padding:0 12px;gap:12px;font-size:10px;color:var(--tx3);overflow:hidden;flex-shrink:0}

/* Scrollbar */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}
"""

html = html.replace('canvas{display:block}\n</style>', 'canvas{display:block}\n</style>\n<style>\n' + override_css + '\n</style>')

open(path, 'w', encoding='utf-8').write(html)
print(f"Redesign complete. File: {len(html)} bytes")
