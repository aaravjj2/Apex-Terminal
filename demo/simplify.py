
# Simplify: collapsible nav + complete command palette for discoverability
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
html = open(path, encoding='utf-8').read()

# 1. Make nav-group labels clickable with chevron for collapse
html = html.replace(
    '<div class="nav-group-label">TRADE</div>',
    '<div class="nav-group-label" onclick="toggleNavGroup(this.parentElement)" role="button" title="Click to expand/collapse">TRADE <span class="nav-chevron">▼</span></div>'
)
html = html.replace(
    '<div class="nav-group-label">STRAT</div>',
    '<div class="nav-group-label" onclick="toggleNavGroup(this.parentElement)" role="button" title="Click to expand/collapse">STRAT <span class="nav-chevron">▶</span></div>'
)
html = html.replace(
    '<div class="nav-group-label">MKTS</div>',
    '<div class="nav-group-label" onclick="toggleNavGroup(this.parentElement)" role="button" title="Click to expand/collapse">MKTS <span class="nav-chevron">▶</span></div>'
)
html = html.replace(
    '<div class="nav-group-label">ASSET</div>',
    '<div class="nav-group-label" onclick="toggleNavGroup(this.parentElement)" role="button" title="Click to expand/collapse">ASSET <span class="nav-chevron">▶</span></div>'
)

# 2. Add data-group to each nav-group for JS
html = html.replace(
    '  <!-- GROUP: TRADE -->\n  <div class="nav-group">',
    '  <!-- GROUP: TRADE -->\n  <div class="nav-group nav-group-expanded" data-group="trade">'
)
html = html.replace(
    '  <!-- GROUP: STRATEGY -->\n  <div class="nav-group">',
    '  <!-- GROUP: STRATEGY -->\n  <div class="nav-group nav-group-collapsed" data-group="strat">'
)
html = html.replace(
    '  <!-- GROUP: MARKETS -->\n  <div class="nav-group">',
    '  <!-- GROUP: MARKETS -->\n  <div class="nav-group nav-group-collapsed" data-group="mkts">'
)
html = html.replace(
    '  <!-- GROUP: ASSET CLASSES -->\n  <div class="nav-group">',
    '  <!-- GROUP: ASSET CLASSES -->\n  <div class="nav-group nav-group-collapsed" data-group="asset">'
)

# 3. Replace CMD_LIST with complete list - every view discoverable
old_cmd = r"""const CMD_LIST = [
  {cat:'Navigate',name:'Trading View',desc:'Chart & order entry',key:'T',action:'switchView("trading")'},
  {cat:'Navigate',name:'Dashboard',desc:'Market overview',key:'D',action:'switchView("dashboard")'},
  {cat:'Navigate',name:'Portfolio',desc:'Positions & P&L',key:'P',action:'switchView("portfolio")'},
  {cat:'Navigate',name:'Backtest',desc:'Strategy testing',key:'B',action:'switchView("backtest")'},
  {cat:'Navigate',name:'Options Chain',desc:'Options analytics',key:'O',action:'switchView("options")'},
  {cat:'Navigate',name:'Screener',desc:'Stock screener',key:'S',action:'switchView("screener")'},
  {cat:'Navigate',name:'Autopilot / AI',desc:'AI trading agents',key:'A',action:'switchView("autopilot")'},
  {cat:'Navigate',name:'Risk',desc:'Risk management',key:'R',action:'switchView("risk")'},
  {cat:'Navigate',name:'Economic Calendar',desc:'Macro events',key:'',action:'switchView("macro")'},
  {cat:'Navigate',name:'Research',desc:'News & fundamentals',key:'',action:'switchView("research")'},
  {cat:'Navigate',name:'Compliance',desc:'Compliance checks',key:'',action:'switchView("compliance")'},
  {cat:'Navigate',name:'Platform',desc:'Observability & logs',key:'',action:'switchView("platform")'},
  {cat:'Trading',name:'Buy AAPL',desc:'Long 100 @ market',key:'',action:'showToast("Order","Buy AAPL 100 @ market","success")'},
  {cat:'Trading',name:'Sell AAPL',desc:'Short 100 @ market',key:'',action:'showToast("Order","Sell AAPL 100 @ market","warn")'},
  {cat:'Trading',name:'Close All Positions',desc:'Market close all',key:'',action:'showToast("Warning","Close all? Confirm first","warn")'},
  {cat:'Chart',name:'Toggle Candlestick/Line',desc:'Chart type',key:'',action:'toggleChartType()'},
  {cat:'Chart',name:'Add RSI Indicator',desc:'RSI(14)',key:'',action:'addIndicator()'},
  {cat:'Chart',name:'Start Market Replay',desc:'Historical replay mode',key:'',action:'toggleReplayBar()'},
  {cat:'Workspace',name:'Save Layout',desc:'Save current workspace',key:'',action:'showToast("Saved","Layout saved","success")'},
  {cat:'Workspace',name:'New Alert',desc:'Create price alert',key:'',action:'switchView("alerts")'},
];"""

new_cmd = r"""const CMD_LIST = [
  {cat:'Trade',name:'Trading',desc:'Chart & order entry',key:'',action:'switchView("trading")'},
  {cat:'Trade',name:'Dashboard',desc:'Market overview',key:'',action:'switchView("dashboard")'},
  {cat:'Trade',name:'Portfolio',desc:'Positions & P&L',key:'',action:'switchView("portfolio")'},
  {cat:'Trade',name:'Orders / Blotter',desc:'Open & filled orders',key:'',action:'switchView("orders")'},
  {cat:'Trade',name:'Risk',desc:'VaR, stress, exposure',key:'',action:'switchView("risk")'},
  {cat:'Trade',name:'Market Heatmap',desc:'Sector performance',key:'',action:'switchView("heatmap")'},
  {cat:'Strategy',name:'Backtest',desc:'Strategy testing',key:'',action:'switchView("backtest")'},
  {cat:'Strategy',name:'Walk-Forward',desc:'Walk-forward analysis',key:'',action:'switchView("walkforward")'},
  {cat:'Strategy',name:'Monte Carlo',desc:'Monte Carlo simulation',key:'',action:'switchView("montecarlo")'},
  {cat:'Strategy',name:'Strategy Studio',desc:'Code strategy editor',key:'',action:'switchView("strategy")'},
  {cat:'Markets',name:'Options Chain',desc:'Options analytics',key:'',action:'switchView("options")'},
  {cat:'Markets',name:'Screener',desc:'Stock screener',key:'',action:'switchView("screener")'},
  {cat:'Markets',name:'Alerts',desc:'Price & condition alerts',key:'',action:'switchView("alerts")'},
  {cat:'Markets',name:'Economic Calendar',desc:'Macro events',key:'',action:'switchView("macro")'},
  {cat:'Markets',name:'Research',desc:'News & sentiment',key:'',action:'switchView("research")'},
  {cat:'Markets',name:'Ideas / Social',desc:'Trading ideas feed',key:'',action:'switchView("social")'},
  {cat:'Assets',name:'Fixed Income',desc:'Bonds & yield curve',key:'',action:'switchView("fixedincome")'},
  {cat:'Assets',name:'FX Analytics',desc:'Currencies & forwards',key:'',action:'switchView("fx")'},
  {cat:'Assets',name:'Commodities',desc:'Futures & spreads',key:'',action:'switchView("commodities")'},
  {cat:'Assets',name:'Crypto',desc:'On-chain & funding',key:'',action:'switchView("crypto")'},
  {cat:'System',name:'Autopilot / AI',desc:'AI trading agents',key:'',action:'switchView("autopilot")'},
  {cat:'System',name:'Compliance',desc:'Compliance checks',key:'',action:'switchView("compliance")'},
  {cat:'System',name:'Platform',desc:'Observability & logs',key:'',action:'switchView("platform")'},
  {cat:'Actions',name:'New Alert',desc:'Create price alert',key:'',action:'switchView("alerts")'},
  {cat:'Actions',name:'Add RSI',desc:'Add RSI indicator',key:'',action:'addIndicator()'},
  {cat:'Actions',name:'Market Replay',desc:'Historical replay',key:'',action:'toggleReplayBar()'},
];"""

html = html.replace(old_cmd, new_cmd)

# 4. Update search placeholder
html = html.replace(
    'placeholder="Search symbols, commands... (K)"',
    'placeholder="Jump to any view... ⌘K"'
)
html = html.replace(
    'placeholder="Search symbols, commands..."',
    'placeholder="Jump to any view... ⌘K"'
)

# 5. Add toggleNavGroup + CSS for collapsed groups
# Insert right after filterCmd function
toggle_js = r"""
function toggleNavGroup(grp) {
  if (!grp) return;
  const collapsed = grp.classList.contains('nav-group-collapsed');
  const chevron = grp.querySelector('.nav-chevron');
  if (collapsed) {
    grp.classList.remove('nav-group-collapsed');
    grp.classList.add('nav-group-expanded');
    if (chevron) chevron.textContent = '\u25BC';
  } else {
    grp.classList.add('nav-group-collapsed');
    grp.classList.remove('nav-group-expanded');
    if (chevron) chevron.textContent = '\u25B6';
  }
}
"""

# Find "function filterCmd" and insert after it (before the closing of filterCmd's block)
# Actually we need to add toggleNavGroup as a new function. Let me add it before openCmd.
html = html.replace(
    'function openCmd() {',
    toggle_js + '\nfunction openCmd() {'
)

# 6. Add CSS for collapsed groups
collapse_css = """
<style>
/* Collapsible nav groups */
.nav-group-collapsed .nav-item { display: none !important; }
.nav-group-expanded .nav-item { display: flex !important; }
.nav-group-label { cursor: pointer; user-select: none; padding: 6px 0 8px; display: flex; align-items: center; justify-content: center; gap: 2px; transition: background .1s; }
.nav-group-label:hover { background: rgba(255,255,255,.04); color: var(--tx); }
.nav-chevron { font-size: 6px; opacity: .7; }
</style>
"""
html = html.replace('</body>\n</html>', collapse_css + '\n</body>\n</html>')

open(path, 'w', encoding='utf-8').write(html)
print(f"Simplify done. File: {len(html)} bytes")
