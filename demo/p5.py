
# Part 5: Options Chain, Screener, Alerts views
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')
f.write("""
<!-- ===== OPTIONS CHAIN VIEW ===== -->
<div class="view" id="view-options">
  <div class="opt-header">
    <span style="font-weight:700;font-size:13px;color:#fff">AAPL</span>
    <span style="font-size:11px;color:var(--tx3)">Underlying: <span style="color:var(--tx);font-family:var(--mono)">$182.43</span></span>
    <span style="font-size:11px;color:var(--tx3)">IV Rank: <span style="color:var(--warn);font-family:var(--mono)">34.2</span></span>
    <span style="font-size:11px;color:var(--tx3)">30D IV: <span style="color:var(--tx);font-family:var(--mono)">28.4%</span></span>
    <div style="width:1px;height:16px;background:var(--bdr)"></div>
    <span style="font-size:10px;color:var(--tx3)">Expiry:</span>
    <div class="exp-btn active" onclick="setExp(this,'2025-01-17')">Jan 17</div>
    <div class="exp-btn" onclick="setExp(this,'2025-02-21')">Feb 21</div>
    <div class="exp-btn" onclick="setExp(this,'2025-03-21')">Mar 21</div>
    <div class="exp-btn" onclick="setExp(this,'2025-06-20')">Jun 20</div>
    <div class="exp-btn" onclick="setExp(this,'2026-01-16')">Jan 26 LEAPS</div>
    <div style="margin-left:auto;display:flex;gap:5px;align-items:center">
      <button class="btn-sm neutral" onclick="showToast('Greeks','Showing portfolio greeks','info')">Portfolio Greeks</button>
      <button class="btn-sm bt" onclick="showToast('Payoff','Opening payoff diagram','info')">Payoff Diagram</button>
      <button class="btn-sm up" onclick="showToast('Builder','Strategy builder opened','info')">Strategy Builder</button>
    </div>
  </div>
  <div style="display:flex;gap:8px;padding:6px 12px;border-bottom:1px solid var(--bdr);font-size:10px;flex-shrink:0">
    <span style="color:var(--tx2)">Portfolio Greeks:</span>
    <span style="color:var(--tx2)">Delta <span style="font-family:var(--mono);color:var(--tx)">+142</span></span>
    <span style="color:var(--tx2)">Gamma <span style="font-family:var(--mono);color:var(--tx)">+8.4</span></span>
    <span style="color:var(--tx2)">Theta <span style="font-family:var(--mono);color:var(--dn)">-$82/day</span></span>
    <span style="color:var(--tx2)">Vega <span style="font-family:var(--mono);color:var(--up)">+$240/vol%</span></span>
  </div>
  <div style="flex:1;overflow-y:auto">
    <div class="chain-hdr">
      <div class="ch-c call">Ask</div><div class="ch-c call">Bid</div><div class="ch-c call">IV</div><div class="ch-c call">Delta</div><div class="ch-c call">Gamma</div><div class="ch-c call">OI</div><div class="ch-c call">Vol</div>
      <div class="ch-c" style="background:var(--bg3);color:var(--brand)">STRIKE</div>
      <div class="ch-c put">Vol</div><div class="ch-c put">OI</div><div class="ch-c put">Gamma</div><div class="ch-c put">Delta</div><div class="ch-c put">IV</div><div class="ch-c put">Bid</div><div class="ch-c put">Ask</div>
    </div>
    <div id="options-chain"></div>
  </div>
</div>

<!-- ===== SCREENER VIEW ===== -->
<div class="view" id="view-screener">
  <div class="scr-filters">
    <span style="font-size:11px;font-weight:600;color:var(--tx3)">Market:</span>
    <div class="filter-pill active" onclick="togglePill(this)">US Stocks</div>
    <div class="filter-pill" onclick="togglePill(this)">ETFs</div>
    <div class="filter-pill" onclick="togglePill(this)">Crypto</div>
    <div class="filter-pill" onclick="togglePill(this)">Forex</div>
    <div style="width:1px;height:16px;background:var(--bdr)"></div>
    <span style="font-size:11px;font-weight:600;color:var(--tx3)">Filters:</span>
    <div class="filter-pill" onclick="togglePill(this)">Mkt Cap &gt; $10B</div>
    <div class="filter-pill" onclick="togglePill(this)">Vol &gt; 5M</div>
    <div class="filter-pill" onclick="togglePill(this)">RSI 30-70</div>
    <div class="filter-pill" onclick="togglePill(this)">P/E &lt; 25</div>
    <div class="filter-pill" onclick="togglePill(this)">52W High</div>
    <div class="filter-pill" onclick="togglePill(this)">Gap Up &gt;2%</div>
    <div style="margin-left:auto;display:flex;gap:4px">
      <button class="btn-g" onclick="showToast('Saved','Screener saved','success')">Save Screen</button>
      <button class="btn-g" onclick="showToast('Export','Results exported','success')">Export</button>
    </div>
  </div>
  <div style="padding:5px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:5px;flex-shrink:0;align-items:center">
    <span style="font-size:11px;font-weight:600;color:var(--tx3)">Presets:</span>
    <div class="preset-btn active" onclick="activatePreset(this)">Momentum</div>
    <div class="preset-btn" onclick="activatePreset(this)">Value</div>
    <div class="preset-btn" onclick="activatePreset(this)">Breakout</div>
    <div class="preset-btn" onclick="activatePreset(this)">Oversold</div>
    <div class="preset-btn" onclick="activatePreset(this)">High IV</div>
    <div class="preset-btn" onclick="activatePreset(this)">Earnings</div>
    <div class="preset-btn" onclick="activatePreset(this)">Insider Buy</div>
    <span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--tx3)" id="scr-count">Showing 48 results</span>
  </div>
  <div class="tbl-wrap">
    <table id="screener-table">
      <thead><tr>
        <th>Symbol</th><th>Company</th><th>Price</th><th>Chg%</th><th>Volume</th><th>Mkt Cap</th><th>P/E</th><th>RSI</th><th>ATR%</th><th>52W%</th><th>Score</th><th>Signal</th>
      </tr></thead>
      <tbody id="screener-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ===== ALERTS VIEW ===== -->
<div class="view" id="view-alerts">
  <div style="display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;padding:6px 12px;gap:8px;align-items:center">
    <span style="font-size:12px;font-weight:600;color:var(--tx)">Alerts</span>
    <span class="badge info">12 active</span>
    <span class="badge warn">3 triggered</span>
    <button class="btn-pri" style="margin-left:auto" onclick="showToast('Alert Created','New price alert set for AAPL','success')">
      <svg width="12" height="12" fill="currentColor"><polygon points="6,2 10,9 2,9"/></svg> New Alert
    </button>
  </div>
  <div style="flex:1;display:grid;grid-template-columns:1fr 280px;overflow:hidden">
    <div style="overflow-y:auto">
      <div style="padding:5px 12px;font-size:10px;font-weight:600;color:var(--dn);letter-spacing:.04em;text-transform:uppercase;background:rgba(242,54,69,.05)">TRIGGERED</div>
      <div class="alert-row" onclick="showToast('Alert','AAPL crossed $185 (up)','warn')">
        <div class="alert-ico price"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="1" x2="6" y2="11"/><polyline points="1,6 6,1 11,6"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">AAPL &gt; $185</div><div class="alert-cond">Price crossed above $185.00</div></div>
        <span class="badge dn">TRIGGERED</span>
        <span class="alert-time">09:32:14</span>
      </div>
      <div class="alert-row">
        <div class="alert-ico vol"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="2" height="4"/><rect x="5" y="4" width="2" height="7"/><rect x="9" y="1" width="2" height="10"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">TSLA Volume Spike</div><div class="alert-cond">Volume exceeded 3x 20D average</div></div>
        <span class="badge dn">TRIGGERED</span>
        <span class="alert-time">09:18:07</span>
      </div>
      <div class="alert-row">
        <div class="alert-ico news"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2h8v8H2z"/><line x1="4" y1="5" x2="8" y2="5"/><line x1="4" y1="7" x2="7" y2="7"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">NVDA Earnings</div><div class="alert-cond">Earnings announcement detected</div></div>
        <span class="badge dn">TRIGGERED</span>
        <span class="alert-time">09:00:00</span>
      </div>
      <div style="padding:5px 12px;font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:.04em;text-transform:uppercase;margin-top:4px">ACTIVE</div>
      <div class="alert-row">
        <div class="alert-ico price"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="1" x2="6" y2="11"/><polyline points="11,6 6,11 1,6"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">SPY &lt; $510</div><div class="alert-cond">Price crosses below $510.00</div></div>
        <div class="pulse-dot"></div>
        <span class="alert-time">Active</span>
      </div>
      <div class="alert-row">
        <div class="alert-ico ind"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 10 Q4 2 7 6 Q10 10 11 3"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">MSFT RSI &gt; 75</div><div class="alert-cond">RSI(14) crosses above 75</div></div>
        <div class="pulse-dot"></div>
        <span class="alert-time">Active</span>
      </div>
      <div class="alert-row">
        <div class="alert-ico price"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="1" x2="6" y2="11"/><polyline points="1,6 6,1 11,6"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">BTC &gt; $100,000</div><div class="alert-cond">Bitcoin crosses $100k milestone</div></div>
        <div class="pulse-dot"></div>
        <span class="alert-time">Active</span>
      </div>
      <div class="alert-row">
        <div class="alert-ico ind"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="4.5"/></svg></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">AAPL Bollinger Band Upper</div><div class="alert-cond">Price touches upper BB(20,2)</div></div>
        <div class="pulse-dot"></div>
        <span class="alert-time">Active</span>
      </div>
    </div>
    <div style="border-left:1px solid var(--bdr);display:flex;flex-direction:column;overflow-y:auto;padding:10px;gap:8px">
      <div style="font-size:11px;font-weight:700;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase">Create Alert</div>
      <div class="field"><label>Symbol</label><input placeholder="AAPL, TSLA, BTC..."></div>
      <div class="field"><label>Alert Type</label><select><option>Price Cross</option><option>% Change</option><option>Volume Spike</option><option>RSI Level</option><option>Moving Average Cross</option><option>Bollinger Band</option><option>MACD Signal</option><option>News Event</option><option>Earnings</option></select></div>
      <div class="field"><label>Condition</label><select><option>Crosses above</option><option>Crosses below</option><option>Is greater than</option><option>Is less than</option></select></div>
      <div class="field"><label>Value</label><input placeholder="185.00"></div>
      <div class="field"><label>Notify via</label><select><option>In-app</option><option>Email</option><option>Webhook</option><option>All channels</option></select></div>
      <div class="field"><label>Repeat</label><select><option>Once</option><option>Every trigger</option><option>Daily max</option></select></div>
      <button class="btn-pri" style="width:100%;justify-content:center" onclick="showToast('Alert Created','Alert created successfully','success')">Create Alert</button>
    </div>
  </div>
</div>
""")
f.close()
print("Part 5 done")
