
# Part 3: Portfolio, Orders, Risk views
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')
f.write("""
<!-- ===== PORTFOLIO VIEW ===== -->
<div class="view" id="view-portfolio">
  <div class="kpi-strip">
    <div class="kpi-item"><div class="kpi-label">NAV</div><div class="kpi-val" id="port-nav">$382,450</div><div class="kpi-sub">Cash: $34,630</div></div>
    <div class="kpi-item"><div class="kpi-label">Unrealized P&amp;L</div><div class="kpi-val up">+$18,240</div><div class="kpi-sub up">+5.01%</div></div>
    <div class="kpi-item"><div class="kpi-label">Realized P&amp;L</div><div class="kpi-val up">+$42,118</div><div class="kpi-sub">YTD</div></div>
    <div class="kpi-item"><div class="kpi-label">Win Rate</div><div class="kpi-val">64.3%</div><div class="kpi-sub">89 trades</div></div>
    <div class="kpi-item"><div class="kpi-label">Avg Win/Loss</div><div class="kpi-val">2.4x</div><div class="kpi-sub">Profit factor</div></div>
    <div class="kpi-item"><div class="kpi-label">Max Drawdown</div><div class="kpi-val dn">-7.2%</div><div class="kpi-sub">Peak: $412,100</div></div>
  </div>
  <div class="port-grid">
    <div style="display:flex;flex-direction:column;overflow:hidden">
      <div class="ph"><div class="ph-title"><span>Positions</span><span class="badge info">12 Open</span></div><div style="display:flex;gap:4px"><button class="btn-g" onclick="showToast('Export','Positions exported to CSV','success')">Export</button></div></div>
      <div class="tbl-wrap">
        <table id="port-table">
          <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Avg Entry</th><th>Last</th><th>Mkt Value</th><th>Unreal P&amp;L</th><th>Real P&amp;L</th><th>%Chg</th><th>Beta</th><th>Weight</th><th>Action</th></tr></thead>
          <tbody id="port-tbody"></tbody>
        </table>
      </div>
    </div>
    <div class="port-side">
      <div class="ph"><div class="ph-title"><span>Allocation</span></div></div>
      <div style="padding:10px 12px" id="port-alloc"></div>
      <div style="height:1px;background:var(--bdr)"></div>
      <div class="ph"><div class="ph-title"><span>Equity Curve</span></div></div>
      <canvas id="port-equity" style="height:110px;width:100%"></canvas>
      <div style="height:1px;background:var(--bdr)"></div>
      <div class="ph"><div class="ph-title"><span>P&amp;L Attribution</span></div></div>
      <div style="padding:8px 12px;display:flex;flex-direction:column;gap:4px">
        <div class="alloc-row"><span class="alloc-lbl">Tech</span><div class="alloc-track"><div class="alloc-fill" style="width:62%;background:var(--up)"></div></div><span class="alloc-pct td-up">+62%</span></div>
        <div class="alloc-row"><span class="alloc-lbl">Finance</span><div class="alloc-track"><div class="alloc-fill" style="width:18%;background:var(--up)"></div></div><span class="alloc-pct td-up">+18%</span></div>
        <div class="alloc-row"><span class="alloc-lbl">Energy</span><div class="alloc-track"><div class="alloc-fill" style="width:10%;background:var(--dn)"></div></div><span class="alloc-pct td-dn">-10%</span></div>
        <div class="alloc-row"><span class="alloc-lbl">Healthcare</span><div class="alloc-track"><div class="alloc-fill" style="width:8%;background:var(--warn)"></div></div><span class="alloc-pct" style="color:var(--warn)">+8%</span></div>
        <div class="alloc-row"><span class="alloc-lbl">Other</span><div class="alloc-track"><div class="alloc-fill" style="width:12%;background:var(--tx3)"></div></div><span class="alloc-pct">+12%</span></div>
      </div>
    </div>
  </div>
</div>

<!-- ===== ORDERS / BLOTTER VIEW ===== -->
<div class="view" id="view-orders">
  <div class="order-tabs">
    <div class="o-tab active" onclick="switchOrderTab(this,'open')">Open Orders <span class="badge info" style="margin-left:4px">3</span></div>
    <div class="o-tab" onclick="switchOrderTab(this,'pending')">Pending <span class="badge warn" style="margin-left:4px">2</span></div>
    <div class="o-tab" onclick="switchOrderTab(this,'filled')">Filled</div>
    <div class="o-tab" onclick="switchOrderTab(this,'cancelled')">Cancelled</div>
    <div class="o-tab" onclick="switchOrderTab(this,'blotter')">Trade Blotter</div>
    <div style="margin-left:auto;padding:4px 10px;display:flex;gap:6px;align-items:center">
      <button class="btn-g" onclick="showToast('Cancel All','All open orders cancelled','warn')">Cancel All</button>
      <button class="btn-g" onclick="showToast('Export','Orders exported','success')">Export</button>
    </div>
  </div>
  <div class="order-tc active" id="ord-open">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Order ID</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Filled</th><th>Price</th><th>Limit</th><th>Stop</th><th>Status</th><th>TIF</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td class="td-mono" style="color:var(--tx3)">#ORD-4821</td><td><div class="td-sym">AAPL</div></td><td><span class="badge up">BUY</span></td><td>Limit</td><td class="td-mono">100</td><td class="td-mono">0</td><td class="td-mono">—</td><td class="td-mono" style="color:var(--brand)">$179.50</td><td class="td-mono">—</td><td><span class="badge info">WORKING</span></td><td>GTC</td><td class="td-mono" style="color:var(--tx3)">09:14:33</td><td><button class="btn-sm dn" onclick="showToast('Cancel','Order ORD-4821 cancelled','warn')">Cancel</button></td></tr>
          <tr><td class="td-mono" style="color:var(--tx3)">#ORD-4820</td><td><div class="td-sym">TSLA</div></td><td><span class="badge dn">SELL</span></td><td>Stop</td><td class="td-mono">50</td><td class="td-mono">0</td><td class="td-mono">—</td><td class="td-mono">—</td><td class="td-mono" style="color:var(--dn)">$214.00</td><td><span class="badge info">WORKING</span></td><td>GTC</td><td class="td-mono" style="color:var(--tx3)">09:12:07</td><td><button class="btn-sm dn" onclick="showToast('Cancel','Order ORD-4820 cancelled','warn')">Cancel</button></td></tr>
          <tr><td class="td-mono" style="color:var(--tx3)">#ORD-4819</td><td><div class="td-sym">SPY</div></td><td><span class="badge up">BUY</span></td><td>Market</td><td class="td-mono">200</td><td class="td-mono">120</td><td class="td-mono" style="color:var(--tx3)">$521.82</td><td class="td-mono">—</td><td class="td-mono">—</td><td><span class="badge warn">PARTIAL</span></td><td>DAY</td><td class="td-mono" style="color:var(--tx3)">09:08:45</td><td><button class="btn-sm dn" onclick="showToast('Cancel','Order ORD-4819 cancelled','warn')">Cancel</button></td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="order-tc" id="ord-pending">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Trigger</th><th>Expires</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td><div class="td-sym">NVDA</div></td><td><span class="badge up">BUY</span></td><td>TWAP</td><td class="td-mono">300</td><td class="td-mono" style="color:var(--brand)">Scheduled 10:00</td><td class="td-mono">EOD</td><td><button class="btn-sm neutral">Edit</button></td></tr>
          <tr><td><div class="td-sym">META</div></td><td><span class="badge dn">SELL</span></td><td>Conditional</td><td class="td-mono">75</td><td class="td-mono" style="color:var(--warn)">RSI > 70</td><td class="td-mono">GTC</td><td><button class="btn-sm neutral">Edit</button></td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="order-tc" id="ord-filled">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Fill Price</th><th>Commission</th><th>Slippage</th><th>Filled At</th><th>P&amp;L</th></tr></thead>
        <tbody id="filled-tbody"></tbody>
      </table>
    </div>
  </div>
  <div class="order-tc" id="ord-cancelled">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Reason</th><th>Cancelled At</th></tr></thead>
        <tbody>
          <tr><td><div class="td-sym">GOOG</div></td><td><span class="badge dn">SELL</span></td><td>Limit</td><td class="td-mono">40</td><td style="color:var(--tx3)">User cancelled</td><td class="td-mono" style="color:var(--tx3)">08:54:12</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="order-tc" id="ord-blotter">
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Trade ID</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Value</th><th>Commission</th><th>Strategy</th><th>Time</th><th>P&amp;L</th></tr></thead>
        <tbody id="blotter-tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ===== RISK VIEW ===== -->
<div class="view" id="view-risk">
  <div class="risk-3">
    <div class="risk-card">
      <div class="rc-lbl">Portfolio VaR (95%, 1D)</div>
      <div class="rc-val warn">$4,180</div>
      <div class="rc-sub">1.09% of NAV</div>
      <div class="var-track"><div class="var-fill" style="width:28%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:5px;font-family:var(--mono);font-size:9px;color:var(--tx3)"><span>$0</span><span>Limit: $15k</span></div>
    </div>
    <div class="risk-card">
      <div class="rc-lbl">Expected Shortfall (CVaR)</div>
      <div class="rc-val dn">$6,840</div>
      <div class="rc-sub">1.79% of NAV</div>
      <div class="var-track" style="margin-top:8px"><div class="var-fill" style="width:46%"></div></div>
    </div>
    <div class="risk-card">
      <div class="rc-lbl">Portfolio Beta</div>
      <div class="rc-val">0.82</div>
      <div class="rc-sub">Delta-adj: 0.76 | Correlation: 0.71</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden">
    <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden">
      <div class="ph"><div class="ph-title"><span>Stress Test Scenarios</span></div></div>
      <div class="stress-grid" style="overflow-y:auto;flex:1">
        <div class="stress-item"><div class="stress-name">2008 GFC</div><div class="stress-val dn" style="color:var(--dn)">-31.4%</div><div class="stress-desc">Oct 2008 peak drawdown</div></div>
        <div class="stress-item"><div class="stress-name">COVID Crash</div><div class="stress-val dn" style="color:var(--dn)">-18.7%</div><div class="stress-desc">Feb-Mar 2020</div></div>
        <div class="stress-item"><div class="stress-name">Rate +200bps</div><div class="stress-val dn" style="color:var(--dn)">-8.2%</div><div class="stress-desc">Parallel shift</div></div>
        <div class="stress-item"><div class="stress-name">Tech Selloff 30%</div><div class="stress-val dn" style="color:var(--dn)">-19.3%</div><div class="stress-desc">2022 style</div></div>
        <div class="stress-item"><div class="stress-name">USD +15%</div><div class="stress-val warn" style="color:var(--warn)">-4.1%</div><div class="stress-desc">DXY strength</div></div>
        <div class="stress-item"><div class="stress-name">Oil +60%</div><div class="stress-val up" style="color:var(--up)">+2.8%</div><div class="stress-desc">Energy shock hedge</div></div>
        <div class="stress-item"><div class="stress-name">VIX Spike 80</div><div class="stress-val dn" style="color:var(--dn)">-12.6%</div><div class="stress-desc">Vol regime change</div></div>
        <div class="stress-item"><div class="stress-name">Flash Crash</div><div class="stress-val dn" style="color:var(--dn)">-5.4%</div><div class="stress-desc">May 6 2010</div></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;overflow:hidden">
      <div class="ph"><div class="ph-title"><span>Position-Level Risk</span></div></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Delta</th><th>VaR</th><th>Beta</th><th>Corr</th><th>%Port</th><th>Risk Lmt</th></tr></thead>
          <tbody>
            <tr><td><div class="td-sym">AAPL</div></td><td class="td-mono">0.95</td><td class="td-mono td-dn">$820</td><td class="td-mono">1.12</td><td class="td-mono">0.82</td><td class="td-mono">18.2%</td><td><span class="badge up">OK</span></td></tr>
            <tr><td><div class="td-sym">TSLA</div></td><td class="td-mono">1.00</td><td class="td-mono td-dn">$1,240</td><td class="td-mono">1.94</td><td class="td-mono">0.68</td><td class="td-mono">14.1%</td><td><span class="badge warn">WARN</span></td></tr>
            <tr><td><div class="td-sym">SPY</div></td><td class="td-mono">1.00</td><td class="td-mono td-dn">$980</td><td class="td-mono">1.00</td><td class="td-mono">1.00</td><td class="td-mono">22.3%</td><td><span class="badge up">OK</span></td></tr>
            <tr><td><div class="td-sym">NVDA</div></td><td class="td-mono">0.98</td><td class="td-mono td-dn">$1,640</td><td class="td-mono">2.21</td><td class="td-mono">0.79</td><td class="td-mono">11.4%</td><td><span class="badge dn">BREACH</span></td></tr>
            <tr><td><div class="td-sym">MSFT</div></td><td class="td-mono">0.96</td><td class="td-mono td-dn">$420</td><td class="td-mono">0.92</td><td class="td-mono">0.87</td><td class="td-mono">9.8%</td><td><span class="badge up">OK</span></td></tr>
            <tr><td><div class="td-sym">AMZN</div></td><td class="td-mono">0.97</td><td class="td-mono td-dn">$610</td><td class="td-mono">1.08</td><td class="td-mono">0.76</td><td class="td-mono">8.2%</td><td><span class="badge up">OK</span></td></tr>
          </tbody>
        </table>
      </div>
      <div class="ph" style="margin-top:8px"><div class="ph-title"><span>Correlation Heatmap</span></div></div>
      <canvas id="risk-corr" style="height:160px;width:100%"></canvas>
    </div>
  </div>
</div>
""")
f.close()
print("Part 3 done")
