
# Patch: inject new views + nav items + sidebar tabs + enhanced JS
import re

path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
html = open(path, encoding='utf-8').read()

# ──────────────────────────────────────────────────────────────
# 1. NEW CSS to inject (before </style>)
# ──────────────────────────────────────────────────────────────
new_css = """
.l2-grid{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden}
.l2-panel{overflow-y:auto;display:flex;flex-direction:column}
.l2-r{border-left:1px solid var(--bdr)}
.depth-row{display:flex;align-items:center;gap:0;position:relative;height:20px;cursor:pointer}
.depth-row:hover{background:rgba(255,255,255,.03)}
.depth-bar{position:absolute;top:0;bottom:0;opacity:.18;pointer-events:none}
.depth-bar.bid{right:0;background:var(--up)}.depth-bar.ask{left:0;background:var(--dn)}
.depth-price{font-family:var(--mono);font-size:11px;font-weight:600;padding:0 8px;z-index:1}
.depth-price.bid{color:var(--up)}.depth-price.ask{color:var(--dn)}
.depth-size{font-family:var(--mono);font-size:10px;color:var(--tx2);padding:0 6px;z-index:1;flex:1;text-align:right}
.depth-total{font-family:var(--mono);font-size:10px;color:var(--tx3);padding:0 6px;z-index:1;width:58px;text-align:right}
.ts-row{display:flex;align-items:center;gap:0;padding:2px 8px;border-bottom:1px solid rgba(42,46,57,.3);font-family:var(--mono);font-size:10px}
.ts-time{color:var(--tx3);width:52px;flex-shrink:0}
.ts-price{font-weight:600;width:58px}
.ts-price.buy{color:var(--up)}.ts-price.sell{color:var(--dn)}
.ts-size{color:var(--tx2);width:44px;text-align:right}
.ts-exch{color:var(--tx3);width:30px;text-align:right;font-size:9px}
.fi-layout{display:grid;grid-template-columns:220px 1fr;flex:1;min-height:0;overflow:hidden}
.fi-left{border-right:1px solid var(--bdr);overflow-y:auto;background:var(--bg0);padding:10px;display:flex;flex-direction:column;gap:8px}
.fi-right{overflow-y:auto;display:flex;flex-direction:column}
.yc-tab-bar{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0}
.yc-tab{padding:6px 14px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;position:relative}
.yc-tab:hover{color:var(--tx)}.yc-tab.active{color:var(--tx)}
.yc-tab.active::after{content:'';position:absolute;bottom:0;left:4px;right:4px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}
.bond-table-wrap{overflow:auto;flex:1}
.fx-layout{display:grid;grid-template-columns:1fr 280px;flex:1;min-height:0;overflow:hidden}
.fx-right{border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
.fx-matrix{overflow:auto;flex:1}
.cross-cell{padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right;border-bottom:1px solid rgba(42,46,57,.3);border-right:1px solid rgba(42,46,57,.3)}
.cross-cell.diagonal{background:var(--bg2);color:var(--brand);font-weight:700}
.cross-cell.up{color:var(--up)}.cross-cell.dn{color:var(--dn)}
.cross-hdr{padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;background:var(--bg2);position:sticky;top:0;z-index:2;text-align:right;border-bottom:1px solid var(--bdr)}
.cmdt-layout{display:grid;grid-template-columns:1fr 240px;flex:1;min-height:0;overflow:hidden}
.cmdt-right{border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
.futures-curve-wrap{overflow:hidden;display:flex;flex-direction:column}
.crypto-layout{display:grid;grid-template-columns:1fr 240px;flex:1;min-height:0;overflow:hidden}
.crypto-right{border-left:1px solid var(--bdr);overflow-y:auto}
.heatmap-grid{display:grid;gap:3px;padding:10px;overflow:auto;flex:1}
.hm-cell{border-radius:var(--r4);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:opacity .1s;padding:4px}
.hm-cell:hover{opacity:.8}
.hm-sym{font-weight:700;font-size:11px;color:#fff}
.hm-chg{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.85)}
.ef-layout{display:grid;grid-template-columns:1fr 260px;flex:1;min-height:0;overflow:hidden}
.ef-right{border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column}
.social-layout{display:grid;grid-template-columns:220px 1fr 220px;flex:1;min-height:0;overflow:hidden}
.social-panel{overflow-y:auto;display:flex;flex-direction:column}
.s-r{border-left:1px solid var(--bdr)}.s-l{border-right:1px solid var(--bdr)}
.idea-card{padding:10px 12px;border-bottom:1px solid var(--bdr);cursor:pointer;transition:background .08s}
.idea-card:hover{background:var(--bg2)}
.idea-hdr{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.idea-author{font-size:11px;font-weight:600;color:var(--tx)}
.idea-sym{font-family:var(--mono);font-size:10px;color:var(--brand);font-weight:600}
.idea-dir{font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px}
.idea-dir.bull{background:var(--live-bg);color:var(--up)}.idea-dir.bear{background:rgba(242,54,69,.1);color:var(--dn)}
.idea-body{font-size:11px;color:var(--tx2);line-height:1.5;margin-bottom:5px}
.idea-meta{display:flex;gap:10px;font-size:10px;color:var(--tx3)}
.iv-surface-wrap{overflow:hidden;display:flex;flex-direction:column;flex:1}
.payoff-wrap{overflow:hidden;display:flex;flex-direction:column;flex:1}
.opt-view-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0}
.opt-vt{padding:6px 14px;font-size:11px;font-weight:500;color:var(--tx2);cursor:pointer;position:relative}
.opt-vt:hover{color:var(--tx)}.opt-vt.active{color:var(--tx)}
.opt-vt.active::after{content:'';position:absolute;bottom:0;left:4px;right:4px;height:2px;background:var(--brand);border-radius:2px 2px 0 0}
.opt-tab-content{display:none;flex:1;flex-direction:column;overflow:hidden}.opt-tab-content.active{display:flex}
.attr-layout{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--bdr)}
.attr-col{padding:12px;border-right:1px solid var(--bdr)}.attr-col:last-child{border-right:none}
.attr-row{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.attr-lbl{font-size:11px;color:var(--tx2);flex:1}.attr-bar-wrap{width:80px;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden}
.attr-bar-fill{height:100%;border-radius:3px}.attr-val{font-family:var(--mono);font-size:11px;width:44px;text-align:right}
"""
html = html.replace('canvas{display:block}\n</style>', 'canvas{display:block}\n' + new_css + '\n</style>')

# ──────────────────────────────────────────────────────────────
# 2. NEW NAV ITEMS (inject before .nav-spacer)
# ──────────────────────────────────────────────────────────────
new_nav = """  <div class="navd"></div>
  <div class="nav-item" data-view="fixedincome" onclick="switchView('fixedincome')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 13 C2 7 7 3 14 3"/><line x1="2" y1="10" x2="14" y2="10" stroke-dasharray="2,2"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/></svg>
    <span class="nav-tip">Fixed Income</span>
  </div>
  <div class="nav-item" data-view="fx" onclick="switchView('fx')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M2 8h12M8 2c-2.5 2-4 3.8-4 6s1.5 4 4 6M8 2c2.5 2 4 3.8 4 6s-1.5 4-4 6"/></svg>
    <span class="nav-tip">FX Analytics</span>
  </div>
  <div class="nav-item" data-view="commodities" onclick="switchView('commodities')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13V7l5-5 5 5v6H3z"/><rect x="6" y="10" width="4" height="3"/></svg>
    <span class="nav-tip">Commodities</span>
  </div>
  <div class="nav-item" data-view="crypto" onclick="switchView('crypto')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h4a2 2 0 0 1 0 4H5m5 0h1a2 2 0 0 1 0 4H5M6 7h4M7 3v10"/></svg>
    <span class="nav-tip">Crypto Analytics</span>
  </div>
  <div class="navd"></div>
  <div class="nav-item" data-view="heatmap" onclick="switchView('heatmap')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
    <span class="nav-tip">Market Heatmap</span>
  </div>
  <div class="nav-item" data-view="social" onclick="switchView('social')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="6" r="2.5"/><circle cx="11" cy="6" r="2.5"/><path d="M1 14c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4"/></svg>
    <span class="nav-tip">Ideas / Social</span>
  </div>"""

html = html.replace('  <div class="nav-spacer"></div>', new_nav + '\n  <div class="nav-spacer"></div>')

# ──────────────────────────────────────────────────────────────
# 3. NEW SIDEBAR TABS (Level 2 + Time & Sales)
# ──────────────────────────────────────────────────────────────
html = html.replace(
    '<div class="s-tab" onclick="switchSidebarTab(this,\'news\')">News</div>',
    '<div class="s-tab" onclick="switchSidebarTab(this,\'news\')">News</div>\n    <div class="s-tab" onclick="switchSidebarTab(this,\'depth\')">L2</div>\n    <div class="s-tab" onclick="switchSidebarTab(this,\'ts\')">T&S</div>'
)

# ──────────────────────────────────────────────────────────────
# 4. NEW SIDEBAR CONTENT (Level 2 + Time & Sales)
# ──────────────────────────────────────────────────────────────
new_sidebar_content = """
  <!-- LEVEL 2 -->
  <div class="s-content" id="sc-depth">
    <div style="padding:4px 8px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;align-items:center;flex-shrink:0">
      <span style="font-weight:700;font-size:12px" id="l2-sym">AAPL</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--up)" id="l2-price">$182.43</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--tx3);margin-left:auto">Spread: <span style="color:var(--warn)">0.01</span></span>
    </div>
    <div class="l2-grid">
      <div class="l2-panel">
        <div style="padding:3px 8px;font-size:9px;font-weight:600;color:var(--up);letter-spacing:.06em;background:var(--bg2);border-bottom:1px solid var(--bdr)">BIDS</div>
        <div id="l2-bids" style="overflow-y:auto;flex:1"></div>
      </div>
      <div class="l2-panel l2-r">
        <div style="padding:3px 8px;font-size:9px;font-weight:600;color:var(--dn);letter-spacing:.06em;background:var(--bg2);border-bottom:1px solid var(--bdr)">ASKS</div>
        <div id="l2-asks" style="overflow-y:auto;flex:1"></div>
      </div>
    </div>
    <div style="border-top:1px solid var(--bdr);padding:3px 8px;font-size:9px;color:var(--tx3);display:flex;gap:8px;flex-shrink:0">
      <span>Bid Sz: <span style="color:var(--up);font-family:var(--mono)" id="total-bid-sz">48,200</span></span>
      <span>Ask Sz: <span style="color:var(--dn);font-family:var(--mono)" id="total-ask-sz">41,500</span></span>
      <span style="margin-left:auto">Imb: <span style="color:var(--up);font-family:var(--mono)">+14%</span></span>
    </div>
  </div>

  <!-- TIME & SALES -->
  <div class="s-content" id="sc-ts">
    <div style="padding:4px 8px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;align-items:center;font-size:9px;font-weight:600;color:var(--tx3);flex-shrink:0">
      <span style="width:52px">TIME</span><span style="width:58px">PRICE</span><span style="width:44px;text-align:right">SIZE</span><span style="width:30px;text-align:right">EXCH</span>
    </div>
    <div style="overflow-y:auto;flex:1" id="ts-feed"></div>
  </div>"""

html = html.replace('</div>\n\n</div><!-- #layout -->', new_sidebar_content + '\n</div>\n\n</div><!-- #layout -->')

print("CSS, nav, sidebar patched")
open(path, 'w', encoding='utf-8').write(html)
print(f"File: {len(html)} bytes")
