
# Part 7: Compliance, Platform/Observability, Right sidebar, overlays, statusbar, closing tags
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')
f.write("""
<!-- ===== COMPLIANCE VIEW ===== -->
<div class="view" id="view-compliance">
  <div class="kpi-strip">
    <div class="kpi-item"><div class="kpi-label">Compliance Score</div><div class="kpi-val up">94/100</div></div>
    <div class="kpi-item"><div class="kpi-label">Open Issues</div><div class="kpi-val warn">3</div></div>
    <div class="kpi-item"><div class="kpi-label">Last Audit</div><div class="kpi-val">Today 06:00</div></div>
    <div class="kpi-item"><div class="kpi-label">Violations (30d)</div><div class="kpi-val up">0</div></div>
  </div>
  <div class="comp-layout">
    <div class="comp-panel">
      <div class="ph"><div class="ph-title"><span>Pre-Trade Checks</span><span class="badge up">18/18 Pass</span></div></div>
      <div class="check-row"><div class="check-ico ok"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg></div><div><div class="check-title">Position Limits</div><div class="check-desc">All positions within 10% max per symbol limit</div></div><span class="badge up">PASS</span></div>
      <div class="check-row"><div class="check-ico ok"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg></div><div><div class="check-title">Sector Concentration</div><div class="check-desc">Tech sector at 38% (limit 40%)</div></div><span class="badge up">PASS</span></div>
      <div class="check-row"><div class="check-ico warn"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="2" x2="5" y2="6"/><circle cx="5" cy="8" r=".8" fill="currentColor"/></svg></div><div><div class="check-title">Leverage Limit</div><div class="check-desc">Current: 1.8x (warning threshold: 1.75x)</div></div><span class="badge warn">WARN</span></div>
      <div class="check-row"><div class="check-ico ok"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg></div><div><div class="check-title">Wash Sale Detection</div><div class="check-desc">No wash sale violations detected</div></div><span class="badge up">PASS</span></div>
      <div class="check-row"><div class="check-ico ok"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg></div><div><div class="check-title">Short Sale Rules</div><div class="check-desc">All short positions have borrow confirmed</div></div><span class="badge up">PASS</span></div>
      <div class="check-row"><div class="check-ico warn"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="2" x2="5" y2="6"/><circle cx="5" cy="8" r=".8" fill="currentColor"/></svg></div><div><div class="check-title">Pattern Day Trading</div><div class="check-desc">4 day trades this week (limit 4 for non-PDT)</div></div><span class="badge warn">WARN</span></div>
      <div class="check-row"><div class="check-ico ok"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg></div><div><div class="check-title">Restricted Securities</div><div class="check-desc">No trades in restricted securities list</div></div><span class="badge up">PASS</span></div>
      <div class="ph" style="margin-top:4px"><div class="ph-title"><span>Audit Trail</span></div><button class="btn-g">Export</button></div>
      <div class="tbl-wrap" style="max-height:180px">
        <table><thead><tr><th>Time</th><th>Event</th><th>Symbol</th><th>User</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td class="td-mono" style="color:var(--tx3)">09:32:14</td><td>Pre-trade check</td><td>AAPL</td><td>System</td><td><span class="badge up">PASS</span></td></tr>
          <tr><td class="td-mono" style="color:var(--tx3)">09:18:44</td><td>Order submitted</td><td>TSLA</td><td>Aarav</td><td><span class="badge up">PASS</span></td></tr>
          <tr><td class="td-mono" style="color:var(--tx3)">09:10:02</td><td>Leverage check</td><td>NVDA</td><td>System</td><td><span class="badge warn">WARN</span></td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="comp-panel comp-r">
      <div class="ph"><div class="ph-title"><span>Surveillance</span></div></div>
      <div class="surv-row"><div style="width:8px;height:8px;border-radius:50%;background:var(--up);flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--tx)">No unusual activity detected</div><div style="font-size:10px;color:var(--tx3)">Market manipulation scan: clear</div></div></div>
      <div class="surv-row"><div style="width:8px;height:8px;border-radius:50%;background:var(--up);flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--tx)">Insider trading screen: clear</div><div style="font-size:10px;color:var(--tx3)">No proximity to MNPI events</div></div></div>
      <div class="surv-row"><div style="width:8px;height:8px;border-radius:50%;background:var(--warn);flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--tx)">Front-running alert</div><div style="font-size:10px;color:var(--tx3)">Review TSLA order timing (09:18 vs news 09:15)</div></div></div>
      <div class="ph" style="margin-top:4px"><div class="ph-title"><span>Regulatory Reporting</span></div></div>
      <div style="padding:8px 12px;display:flex;flex-direction:column;gap:4px">
        <div class="fund-row"><span class="fund-lbl">Form 13F</span><span class="fund-val" style="color:var(--up)">Filed Apr 15</span></div>
        <div class="fund-row"><span class="fund-lbl">Form ADV</span><span class="fund-val" style="color:var(--up)">Current</span></div>
        <div class="fund-row"><span class="fund-lbl">FINRA Rule 4511</span><span class="fund-val" style="color:var(--up)">Compliant</span></div>
        <div class="fund-row"><span class="fund-lbl">Best Execution</span><span class="fund-val" style="color:var(--up)">99.2% score</span></div>
        <div class="fund-row"><span class="fund-lbl">MiFID II</span><span class="fund-val" style="color:var(--up)">Compliant</span></div>
      </div>
    </div>
  </div>
</div>

<!-- ===== PLATFORM / OBSERVABILITY VIEW ===== -->
<div class="view" id="view-platform">
  <div class="kpi-strip">
    <div class="kpi-item"><div class="kpi-label">System Status</div><div class="kpi-val up">HEALTHY</div></div>
    <div class="kpi-item"><div class="kpi-label">Order Latency (p99)</div><div class="kpi-val">2.4ms</div></div>
    <div class="kpi-item"><div class="kpi-label">Data Feed Lag</div><div class="kpi-val up">0.8ms</div></div>
    <div class="kpi-item"><div class="kpi-label">API Uptime</div><div class="kpi-val up">99.98%</div></div>
    <div class="kpi-item"><div class="kpi-label">Active Strategies</div><div class="kpi-val">2</div></div>
  </div>
  <div class="plat-layout">
    <div class="plat-panel">
      <div class="ph"><div class="ph-title"><span>Services</span></div></div>
      <div class="svc-card"><div class="svc-ico ok"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h10M3 10h10M6 2v12M10 2v12"/></svg></div><div><div class="svc-name">Market Data Feed</div><div class="svc-status">Polygon.io · 12,847 symbols · 0.8ms lag</div></div><span class="svc-lat" style="color:var(--up)">0.8ms</span></div>
      <div class="svc-card"><div class="svc-ico ok"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="12" height="9" rx="1"/><line x1="6" y1="8" x2="10" y2="8"/></svg></div><div><div class="svc-name">Order Router</div><div class="svc-status">Alpaca · FIX 4.4 · Connected</div></div><span class="svc-lat" style="color:var(--up)">1.2ms</span></div>
      <div class="svc-card"><div class="svc-ico ok"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="8" cy="8" rx="6" ry="4"/><path d="M2 8c0 2.2 2.7 4 6 4s6-1.8 6-4M2 8c0-2.2 2.7-4 6-4s6 1.8 6 4"/></svg></div><div><div class="svc-name">Strategy Engine</div><div class="svc-status">2 strategies running · 342 bars/s</div></div><span class="svc-lat" style="color:var(--up)">4.1ms</span></div>
      <div class="svc-card"><div class="svc-ico warn"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1L1.5 14h13z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg></div><div><div class="svc-name">Risk Manager</div><div class="svc-status">High CPU usage · 84% utilization</div></div><span class="svc-lat" style="color:var(--warn)">12ms</span></div>
      <div class="svc-card"><div class="svc-ico ok"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 11v2M1 8h2M11 8h2"/></svg></div><div><div class="svc-name">News Aggregator</div><div class="svc-status">42 sources · 1,240 articles/hr</div></div><span class="svc-lat" style="color:var(--up)">8ms</span></div>
      <div class="svc-card"><div class="svc-ico ok"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 11V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M2 5V3h12v2"/></svg></div><div><div class="svc-name">Database</div><div class="svc-status">TimescaleDB · 2.4TB · 99.98% uptime</div></div><span class="svc-lat" style="color:var(--up)">0.4ms</span></div>
      <div class="ph" style="margin-top:4px"><div class="ph-title"><span>Latency Chart</span></div></div>
      <canvas id="plat-latency" style="height:100px;width:100%"></canvas>
    </div>
    <div class="plat-panel plat-r">
      <div class="ph"><div class="ph-title"><span>Run History</span></div></div>
      <div style="overflow-y:auto;flex:0 0 200px">
        <div class="run-row"><span class="run-name">Momentum Cross · Backtest</span><span class="badge up">SUCCESS</span><span class="run-time">09:28:41</span></div>
        <div class="run-row"><span class="run-name">Walk-Forward Optimization</span><span class="badge up">SUCCESS</span><span class="run-time">09:15:02</span></div>
        <div class="run-row"><span class="run-name">Monte Carlo · 10k sims</span><span class="badge up">SUCCESS</span><span class="run-time">08:54:17</span></div>
        <div class="run-row"><span class="run-name">Risk Recalculation</span><span class="badge warn">WARN</span><span class="run-time">08:30:00</span></div>
        <div class="run-row"><span class="run-name">ML Model Retrain</span><span class="badge bt">RUNNING</span><span class="run-time">08:00:00</span></div>
        <div class="run-row"><span class="run-name">Data Pipeline Sync</span><span class="badge up">SUCCESS</span><span class="run-time">07:45:11</span></div>
      </div>
      <div class="ph"><div class="ph-title"><span>Logs</span></div></div>
      <div style="flex:1;overflow-y:auto;background:#0d1117;padding:8px;font-family:var(--mono);font-size:10px;line-height:1.8;color:#c9d1d9">
        <div><span style="color:#7ee787">2026-03-01 09:34:21</span> <span style="color:#79c0ff">[INFO]</span> Market open · 12,847 symbols active</div>
        <div><span style="color:#7ee787">2026-03-01 09:34:19</span> <span style="color:#79c0ff">[INFO]</span> Order #ORD-4821 placed · AAPL LIMIT 100@179.50</div>
        <div><span style="color:#7ee787">2026-03-01 09:32:14</span> <span style="color:#ffa657">[WARN]</span> Leverage approaching limit: 1.8x/2.0x</div>
        <div><span style="color:#7ee787">2026-03-01 09:32:14</span> <span style="color:#79c0ff">[INFO]</span> Signal: AAPL BUY · EMA cross confirmed</div>
        <div><span style="color:#7ee787">2026-03-01 09:31:00</span> <span style="color:#79c0ff">[INFO]</span> Strategy tick: 342 bars processed</div>
        <div><span style="color:#7ee787">2026-03-01 09:30:00</span> <span style="color:#7ee787">[SUCCESS]</span> Market data connected · Latency: 0.8ms</div>
        <div><span style="color:#7ee787">2026-03-01 09:29:41</span> <span style="color:#79c0ff">[INFO]</span> Pre-market scan complete · 48 signals found</div>
        <div><span style="color:#7ee787">2026-03-01 09:28:41</span> <span style="color:#7ee787">[SUCCESS]</span> Backtest complete · Sharpe: 2.14 Return: +184.3%</div>
      </div>
    </div>
  </div>
</div>

</div><!-- #content -->

<!-- ===== RIGHT SIDEBAR ===== -->
<div id="rightsidebar">
  <div class="s-tabs">
    <div class="s-tab active" onclick="switchSidebarTab(this,'order')">Order</div>
    <div class="s-tab" onclick="switchSidebarTab(this,'watchlist')">Watch</div>
    <div class="s-tab" onclick="switchSidebarTab(this,'positions')">Pos</div>
    <div class="s-tab" onclick="switchSidebarTab(this,'news')">News</div>
  </div>
  
  <!-- ORDER TICKET -->
  <div class="s-content active" id="sc-order">
    <div class="ot">
      <div class="ot-sym-bar">
        <div><div class="ot-sym" id="ot-sym">AAPL</div><div class="ot-exch">NASDAQ · Equity</div></div>
        <div style="text-align:right"><div class="ot-price up" id="ot-price">$182.43</div><div class="ot-chg up" id="ot-chg">+1.21%</div></div>
      </div>
      <div class="dir-grp">
        <div class="dir-btn buy active" id="dir-buy" onclick="setDir('buy')">BUY</div>
        <div class="dir-btn sell" id="dir-sell" onclick="setDir('sell')">SELL</div>
      </div>
      <div>
        <div class="ot-lbl">Order Type</div>
        <select class="ot-sel" onchange="updateOrderType(this.value)" id="ord-type">
          <option>Market</option><option>Limit</option><option>Stop</option><option>Stop Limit</option><option>Trailing Stop</option><option>TWAP</option><option>VWAP</option><option>MOC</option><option>LOC</option>
        </select>
      </div>
      <div>
        <div class="ot-lbl">Quantity</div>
        <input class="ot-inp" type="number" value="100" id="ord-qty" oninput="updateSummary()">
      </div>
      <div id="limit-price-wrap">
        <div class="ot-lbl">Limit Price</div>
        <input class="ot-inp" type="number" value="182.00" id="ord-limit" oninput="updateSummary()">
      </div>
      <div>
        <div class="ot-lbl">Time in Force</div>
        <select class="ot-sel"><option>DAY</option><option>GTC</option><option>GTD</option><option>IOC</option><option>FOK</option></select>
      </div>
      <div>
        <div class="ot-lbl">Stop Loss</div>
        <input class="ot-inp" type="number" placeholder="Optional" id="ord-sl">
      </div>
      <div>
        <div class="ot-lbl">Take Profit</div>
        <input class="ot-inp" type="number" placeholder="Optional" id="ord-tp">
      </div>
      <div class="ot-summary">
        <div class="ot-sum-row"><span class="ot-sum-lbl">Est. Value</span><span class="ot-sum-val" id="ord-val">$18,200</span></div>
        <div class="ot-sum-row"><span class="ot-sum-lbl">Commission</span><span class="ot-sum-val">$1.00</span></div>
        <div class="ot-sum-row"><span class="ot-sum-lbl">Buying Power</span><span class="ot-sum-val">$34,630</span></div>
        <div class="ot-sum-row"><span class="ot-sum-lbl">Portfolio %</span><span class="ot-sum-val" id="ord-pct">4.76%</span></div>
      </div>
      <div class="ot-risk"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1.5,5 4,8 8.5,2"/></svg>Risk check: OK · Max loss $455</div>
      <button class="ot-submit buy" id="ot-submit-btn" onclick="submitOrder()">BUY 100 AAPL</button>
    </div>
  </div>
  
  <!-- WATCHLIST -->
  <div class="s-content" id="sc-watchlist">
    <div class="wl-hdr"><span>Watchlist</span><button class="btn-g" onclick="showToast('Added','Symbol added to watchlist','success')">+ Add</button></div>
    <div id="wl-content" style="overflow-y:auto;flex:1"></div>
  </div>

  <!-- POSITIONS MINI -->
  <div class="s-content" id="sc-positions">
    <div class="ph"><div class="ph-title"><span>Open Positions</span></div></div>
    <div style="overflow-y:auto;flex:1" id="mini-positions"></div>
  </div>

  <!-- NEWS -->
  <div class="s-content" id="sc-news">
    <div style="padding:5px 8px;border-bottom:1px solid var(--bdr);flex-shrink:0">
      <input style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:4px 8px;font-size:11px;color:var(--tx);outline:none;width:100%" placeholder="Filter news...">
    </div>
    <div style="overflow-y:auto;flex:1;padding:4px 0" id="sidebar-news"></div>
  </div>
</div>

</div><!-- #layout -->

<!-- STATUS BAR -->
<div id="statusbar">
  <div class="sb-item"><div class="sb-dot ok"></div>Live</div>
  <div class="sb-item"><div class="sb-dot ok"></div>Market Open</div>
  <div class="sb-item" style="color:var(--up);font-family:var(--mono)">NAV $382,450</div>
  <div class="sb-item"><div class="sb-dot warn"></div>Leverage 1.8x</div>
  <div class="sb-ticker">
    <div class="sb-tape" id="sb-tape"></div>
  </div>
  <div class="sb-item" style="margin-left:auto">Apex Terminal v2.0</div>
  <div class="sb-item"><div class="sb-dot ok"></div>All systems operational</div>
</div>

</div><!-- #app -->

<!-- COMMAND PALETTE -->
<div id="cmd-overlay" onclick="if(event.target===this)closeCmd()">
  <div id="cmd-box">
    <div class="cmd-in-wrap">
      <svg width="14" height="14" fill="none" stroke="#787B86" stroke-width="2"><circle cx="6" cy="6" r="5"/><path d="m10 10 3 3"/></svg>
      <input class="cmd-in" id="cmd-in" placeholder="Type a command or search..." oninput="filterCmd(this.value)">
      <span class="cmd-hint">ESC to close</span>
    </div>
    <div class="cmd-results" id="cmd-results"></div>
  </div>
</div>

<!-- TOAST -->
<div id="toast-wrap"></div>
""")
f.close()
print("Part 7 done")
