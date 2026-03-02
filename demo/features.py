#!/usr/bin/env python3
"""Add missing features: Settings modal, chart export, Scanner tab, backtest templates, Export."""
import re

path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
html = open(path, encoding='utf-8').read()

# ── 1. Settings icon: make it open settings modal ─────────────────────
html = html.replace(
    '<div class="tb-icon-btn" title="Settings">',
    '<div class="tb-icon-btn" title="Settings" onclick="openSettings()">'
)

# ── 2. Add Settings modal HTML + Chart export button ───────────────────
# Insert Settings modal before COMMAND PALETTE
settings_modal = '''
<!-- SETTINGS MODAL -->
<div id="settings-overlay" class="modal-overlay" onclick="if(event.target===this)closeSettings()">
  <div class="modal-box settings-modal">
    <div class="modal-hdr"><span>Settings</span><button class="btn-g" onclick="closeSettings()">Close</button></div>
    <div class="modal-body">
      <div class="set-section">
        <div class="set-title">Appearance</div>
        <div class="set-row">
          <span>Theme</span>
          <div class="theme-toggle">
            <button class="theme-btn active" data-theme="dark" onclick="setTheme('dark')">Dark</button>
            <button class="theme-btn" data-theme="light" onclick="setTheme('light')">Light</button>
            <button class="theme-btn" data-theme="system" onclick="setTheme('system')">System</button>
          </div>
        </div>
        <div class="set-row"><span>Chart font size</span><select><option>Default</option><option>Large</option><option>Compact</option></select></div>
      </div>
      <div class="set-section">
        <div class="set-title">Export</div>
        <div class="set-row"><button class="btn-g" style="width:100%" onclick="closeSettings();showToast('Export','Portfolio CSV exported','success')">Export Portfolio CSV</button></div>
        <div class="set-row"><button class="btn-g" style="width:100%" onclick="closeSettings();showToast('Export','Orders exported to Excel','success')">Export Orders</button></div>
        <div class="set-row"><button class="btn-g" style="width:100%" onclick="closeSettings();showToast('Export','Screener results exported','success')">Export Screener Results</button></div>
        <div class="set-row"><button class="btn-g" style="width:100%" onclick="closeSettings();exportChart()">Export Chart (PNG)</button></div>
        <div class="set-row"><button class="btn-g" style="width:100%" onclick="closeSettings();showToast('Report','PDF report generated','success')">Generate PDF Report</button></div>
      </div>
      <div class="set-section">
        <div class="set-title">Keyboard Shortcuts</div>
        <div class="shortcut-list">
          <div class="shortcut-row"><span>Open command palette</span><kbd>⌘K</kbd></div>
          <div class="shortcut-row"><span>Open Settings</span><kbd>⌘,</kbd></div>
          <div class="shortcut-row"><span>Trading view</span><kbd>F1</kbd></div>
          <div class="shortcut-row"><span>Backtest</span><kbd>⌘B</kbd></div>
          <div class="shortcut-row"><span>Portfolio</span><kbd>⌘P</kbd></div>
          <div class="shortcut-row"><span>Autopilot</span><kbd>⌘A</kbd></div>
        </div>
      </div>
    </div>
  </div>
</div>
'''
html = html.replace('<!-- COMMAND PALETTE -->', settings_modal + '\n<!-- COMMAND PALETTE -->')

# ── 3. Chart toolbar: add Export button (after Replay) ───────────────────
html = html.replace(
    '''<div class="ch-ctrl" onclick="toggleReplayBar()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="6" r="5"/><polyline points="4,8 4,4 9,6z"/></svg>
        Replay
      </div>
    </div>
  </div>''',
    '''<div class="ch-ctrl" onclick="toggleReplayBar()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="6" r="5"/><polyline points="4,8 4,4 9,6z"/></svg>
        Replay
      </div>
      <div class="ch-ctrl" onclick="exportChart()" title="Export chart as PNG">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="1" width="12" height="10" rx="1"/><path d="M4 5h6M4 7h4"/></svg>
        Export
      </div>
    </div>
  </div>'''
)

# ── 4. Backtest: expand strategy dropdown ──────────────────────────────
html = html.replace(
    '<div class="field"><label>Strategy</label><select><option>Momentum Cross</option><option>Mean Reversion</option><option>Trend Follow</option></select></div>',
    '<div class="field"><label>Strategy</label><select><option>Momentum Cross</option><option>Mean Reversion</option><option>Trend Follow</option><option>EMA Crossover</option><option>RSI Oversold</option><option>Bollinger Bounce</option><option>Breakout</option><option>Pairs Trade</option><option>MACD Signal</option><option>Ichimoku Cloud</option></select></div>'
)

# ── 5. Screener: add Scanner tab with real-time scan presets ────────────
html = html.replace(
    '''<!-- ===== SCREENER VIEW ===== -->
<div class="view" id="view-screener">
  <div class="scr-filters">''',
    '''<!-- ===== SCREENER VIEW ===== -->
<div class="view" id="view-screener">
  <div class="scr-tabs">
    <div class="scr-tab active" onclick="switchScrTab(this,'scr-screener')">Screener</div>
    <div class="scr-tab" onclick="switchScrTab(this,'scr-scanner')">Real-Time Scanner</div>
  </div>
  <div class="scr-panel active" id="scr-screener">
  <div class="scr-filters">'''
)
# Close the screener panel and add scanner panel before the filters end... 
# Actually the structure is: scr-filters, presets row, table. I need to wrap all of that in scr-panel and add scanner panel.
# Let me do it differently - add the scanner as a second panel after the table.
html = html.replace(
    '''<table id="screener-table">
      <thead><tr>
        <th>Symbol</th><th>Company</th><th>Price</th><th>Chg%</th><th>Volume</th><th>Mkt Cap</th><th>P/E</th><th>RSI</th><th>ATR%</th><th>52W%</th><th>Score</th><th>Signal</th>
      </tr></thead>
      <tbody id="screener-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ===== ALERTS VIEW ===== -->''',
    '''<table id="screener-table">
      <thead><tr>
        <th>Symbol</th><th>Company</th><th>Price</th><th>Chg%</th><th>Volume</th><th>Mkt Cap</th><th>P/E</th><th>RSI</th><th>ATR%</th><th>52W%</th><th>Score</th><th>Signal</th>
      </tr></thead>
      <tbody id="screener-tbody"></tbody>
    </table>
  </div>
  </div>
  <div class="scr-panel" id="scr-scanner">
    <div class="scr-scanner-presets">
      <div class="filter-pill active" onclick="runScan(this,'breakout')">Price Breakout</div>
      <div class="filter-pill" onclick="runScan(this,'volume')">Volume Spike</div>
      <div class="filter-pill" onclick="runScan(this,'52whigh')">52W Highs</div>
      <div class="filter-pill" onclick="runScan(this,'52wlow')">52W Lows</div>
      <div class="filter-pill" onclick="runScan(this,'gap')">Gap Up &gt;2%</div>
      <div class="filter-pill" onclick="runScan(this,'unusual')">Unusual Options</div>
      <div class="filter-pill" onclick="runScan(this,'relative')">Relative Strength</div>
    </div>
    <div style="padding:5px 12px;border-bottom:1px solid var(--bdr);font-size:10px;color:var(--tx3)">Live scan · Updates every 30s</div>
    <div class="tbl-wrap">
      <table><thead><tr><th>Symbol</th><th>Signal</th><th>Price</th><th>Chg%</th><th>Volume</th><th>Vol vs Avg</th><th>Score</th><th>Time</th></tr></thead>
      <tbody id="scanner-tbody"></tbody></table>
    </div>
  </div>
</div>

<!-- ===== ALERTS VIEW ===== -->'''
)

# ── 6. Add CSS for new elements ───────────────────────────────────────
add_css = '''
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:300}
.modal-overlay.open{display:flex}
.modal-box{background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--r8);box-shadow:var(--sh4);max-width:420px;width:90%;max-height:85vh;overflow:hidden;display:flex;flex-direction:column}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bdr);font-weight:700;font-size:14px}
.modal-body{overflow-y:auto;padding:16px}
.set-section{margin-bottom:20px}
.set-section:last-child{margin-bottom:0}
.set-title{font-size:11px;font-weight:700;color:var(--tx3);letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
.set-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.theme-toggle{display:flex;gap:3px}
.theme-btn{padding:5px 12px;font-size:11px;font-weight:500;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);cursor:pointer;color:var(--tx2);transition:all .1s}
.theme-btn:hover{color:var(--tx)}.theme-btn.active{background:var(--brand-m);color:var(--brand);border-color:rgba(41,98,255,.3)}
.shortcut-list{display:flex;flex-direction:column;gap:6px}
.shortcut-row{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--tx2)}
.shortcut-row kbd{background:var(--bg2);border:1px solid var(--bdr);border-radius:3px;padding:2px 6px;font-size:10px;font-family:var(--mono)}
.scr-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0}
.scr-tab{padding:8px 16px;font-size:12px;font-weight:500;color:var(--tx2);cursor:pointer;position:relative}
.scr-tab:hover{color:var(--tx)}.scr-tab.active{color:var(--tx)}
.scr-tab.active::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--brand)}
.scr-panel{display:none;flex:1;flex-direction:column;overflow:hidden}
.scr-panel.active{display:flex}
.scr-scanner-presets{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid var(--bdr)}
'''

# Insert before </style> in the last style block - find a good insertion point
# We'll append to the polish style block
html = html.replace(
    '.nav-item-autopilot.active, .nav-item[data-view="autopilot"].active { background: var(--brand-m); border-color: var(--brand); }\n</style>',
    '.nav-item-autopilot.active, .nav-item[data-view="autopilot"].active { background: var(--brand-m); border-color: var(--brand); }\n' + add_css + '\n</style>'
)

# ── 7. Add JavaScript for new features ──────────────────────────────────
add_js = '''
function openSettings(){document.getElementById('settings-overlay').classList.add('open')}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open')}
function setTheme(t){document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));document.querySelector('.theme-btn[data-theme="'+t+'"]')?.classList.add('active');showToast('Theme','Theme set to '+t,'info')}
function exportChart(){const c=document.getElementById('chart-main');if(!c){showToast('Export','No chart to export','warn');return}const url=c.toDataURL('image/png');const a=document.createElement('a');a.href=url;a.download='apex-chart-'+new Date().toISOString().slice(0,10)+'.png';a.click();showToast('Export','Chart exported as PNG','success')}
function switchScrTab(el,id){document.querySelectorAll('.scr-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.scr-panel').forEach(p=>p.classList.remove('active'));el.classList.add('active');const p=document.getElementById(id);if(p)p.classList.add('active');if(id==='scr-scanner')initScanner()}
function runScan(el,type){document.querySelectorAll('.scr-scanner-presets .filter-pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');initScanner(type)}
function initScanner(type){type=type||'breakout';const names={breakout:'Price Breakout',volume:'Volume Spike','52whigh':'52W Highs','52wlow':'52W Lows',gap:'Gap Up',unusual:'Unusual Options',relative:'Relative Strength'};const rows=[['NVDA',names[type],'$142.80','+4.82%','82.4M','3.2x','92','09:34'],['AMD','Breakout','$138.24','+4.14%','48.2M','2.8x','88','09:33'],['TSLA','Volume','$215.80','+2.12%','124M','4.1x','85','09:32'],['PLTR','52W High','$48.42','+6.24%','28.4M','2.2x','82','09:31'],['META','Relative Str','$512.30','+2.64%','18.2M','1.8x','79','09:30']];const el=document.getElementById('scanner-tbody');if(el)el.innerHTML=rows.map(r=>'<tr onclick="setSymbol(\\''+r[0]+'\\')"><td><div class="td-sym">'+r[0]+'</div></td><td><span class="badge up">'+r[1]+'</span></td><td class="td-mono">'+r[2]+'</td><td class="td-up">'+r[3]+'</td><td class="td-mono">'+r[4]+'</td><td class="td-mono">'+r[5]+'</td><td class="td-mono">'+r[6]+'</td><td class="td-mono" style="color:var(--tx3)">'+r[7]+'</td></tr>').join('')}
'''

# Insert before "document.addEventListener('DOMContentLoaded'" - find a good spot
# Actually we need to add to the main script. Find "function showToast" and add before it? Or add at end of script before </script>.
# Let me find where to inject - after the toggleNavGroup or filterCmd
html = html.replace(
    "function openCmd() {",
    add_js + "\nfunction openCmd() {"
)

# Add ⌘, shortcut for settings
html = html.replace(
    "if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openCmd(); }",
    "if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openCmd(); }\n  if ((e.metaKey||e.ctrlKey) && e.key===',') { e.preventDefault(); openSettings(); }"
)

# Add Export to command palette
html = html.replace(
    "{cat:'Actions',name:'Market Replay',desc:'Historical replay',key:'',action:'toggleReplayBar()'},\n];",
    "{cat:'Actions',name:'Market Replay',desc:'Historical replay',key:'',action:'toggleReplayBar()'},\n  {cat:'Actions',name:'Export Chart',desc:'Download chart as PNG',key:'',action:'exportChart()'},\n  {cat:'Actions',name:'Settings',desc:'Theme, export, shortcuts',key:'⌘,',action:'openSettings()'},\n  {cat:'Actions',name:'Export Portfolio',desc:'CSV download',key:'',action:'showToast(\\'Export\\',\\'Portfolio CSV exported\\',\\'success\\')'},\n];"
)

open(path, 'w', encoding='utf-8').write(html)
print(f"Features added. File: {len(html)} bytes")
