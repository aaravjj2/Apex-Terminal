
# Part 4: Backtest, Walk-Forward, Monte Carlo, Strategy Studio
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')

f.write("""
<!-- ===== BACKTEST VIEW ===== -->
<div class="view" id="view-backtest">
  <div class="bt-layout">
    <div class="bt-config">
      <div style="font-size:11px;font-weight:700;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px">Configuration</div>
      <div class="field"><label>Strategy</label><select><option>Momentum Cross</option><option>Mean Reversion</option><option>Trend Follow</option></select></div>
      <div class="field"><label>Symbol</label><input value="AAPL,MSFT,TSLA"></div>
      <div class="field"><label>Start Date</label><input type="date" value="2020-01-01"></div>
      <div class="field"><label>End Date</label><input type="date" value="2024-12-31"></div>
      <div class="field"><label>Initial Capital</label><input value="$100,000"></div>
      <div class="field"><label>Commission</label><input value="0.1%"></div>
      <div class="field"><label>Slippage</label><input value="0.05%"></div>
      <div class="field"><label>Position Sizing</label><select><option>Fixed %</option><option>Kelly Criterion</option><option>Volatility Target</option></select></div>
      <div class="field"><label>Max Position %</label><input value="10%"></div>
      <button class="btn-pri" style="width:100%;justify-content:center;margin-top:4px" onclick="runBacktest()">
        <svg width="12" height="12" fill="currentColor"><polygon points="3,2 11,6 3,10"/></svg> Run Backtest
      </button>
      <button class="btn-sm neutral" style="width:100%;text-align:center;margin-top:4px" onclick="showToast('Optimize','Parameter optimization started','info')">Optimize Parameters</button>
    </div>
    <div class="bt-results" id="bt-results">
      <div class="bt-metrics">
        <div class="bt-m"><div class="kpi-label">Total Return</div><div class="kpi-val up">+184.3%</div><div class="kpi-sub up">CAGR: 23.1%</div></div>
        <div class="bt-m"><div class="kpi-label">Sharpe Ratio</div><div class="kpi-val up">2.14</div><div class="kpi-sub">Sortino: 2.87</div></div>
        <div class="bt-m"><div class="kpi-label">Max Drawdown</div><div class="kpi-val dn">-14.2%</div><div class="kpi-sub">Duration: 47d</div></div>
        <div class="bt-m"><div class="kpi-label">Win Rate</div><div class="kpi-val">68.4%</div><div class="kpi-sub">Profit Factor: 2.8</div></div>
      </div>
      <div style="border-bottom:1px solid var(--bdr);padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3)">EQUITY CURVE</div>
      <canvas id="bt-equity" style="height:140px;width:100%"></canvas>
      <div style="border-bottom:1px solid var(--bdr);border-top:1px solid var(--bdr);padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3)">DRAWDOWN</div>
      <canvas id="bt-dd" style="height:80px;width:100%"></canvas>
      <div style="border-bottom:1px solid var(--bdr);padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3)">MONTHLY RETURNS</div>
      <div id="bt-monthly"></div>
      <div class="ph"><div class="ph-title"><span>Trade List</span><span class="badge info">342 trades</span></div></div>
      <div class="tbl-wrap" style="max-height:200px">
        <table><thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Qty</th><th>P&amp;L</th><th>%</th></tr></thead>
        <tbody id="bt-trades"></tbody></table>
      </div>
    </div>
  </div>
</div>

<!-- ===== WALK-FORWARD VIEW ===== -->
<div class="view" id="view-walkforward">
  <div class="kpi-strip">
    <div class="kpi-item"><div class="kpi-label">IS Sharpe Avg</div><div class="kpi-val up">2.31</div></div>
    <div class="kpi-item"><div class="kpi-label">OOS Sharpe Avg</div><div class="kpi-val up">1.87</div></div>
    <div class="kpi-item"><div class="kpi-label">OOS/IS Ratio</div><div class="kpi-val warn">0.81</div><div class="kpi-sub">Efficiency</div></div>
    <div class="kpi-item"><div class="kpi-label">Profitable Windows</div><div class="kpi-val">5/6</div></div>
    <div class="kpi-item"><div class="kpi-label">Overfitting Risk</div><div class="kpi-val up">Low</div></div>
  </div>
  <div style="overflow-y:auto;flex:1">
    <div class="ph"><div class="ph-title"><span>Walk-Forward Windows</span></div></div>
    <div class="wf-grid" id="wf-grid"></div>
    <div class="ph"><div class="ph-title"><span>OOS vs IS Performance</span></div></div>
    <canvas id="wf-chart" style="height:160px;width:100%"></canvas>
    <div class="ph"><div class="ph-title"><span>Parameter Stability</span></div></div>
    <div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="stat-card"><div class="sc-lbl">Fast MA Period</div><div class="sc-val">12-16</div><div class="sc-sub">Stable across windows</div></div>
      <div class="stat-card"><div class="sc-lbl">Slow MA Period</div><div class="sc-val">26-34</div><div class="sc-sub">Slight drift over time</div></div>
      <div class="stat-card"><div class="sc-lbl">RSI Threshold</div><div class="sc-val">68-72</div><div class="sc-sub">Consistent</div></div>
      <div class="stat-card"><div class="sc-lbl">Stop Loss %</div><div class="sc-val">2.0-2.5%</div><div class="sc-sub">Tightening trend</div></div>
    </div>
  </div>
</div>

<!-- ===== MONTE CARLO VIEW ===== -->
<div class="view" id="view-montecarlo">
  <div class="mc-stats">
    <div class="mc-s"><div class="kpi-label">Median Return</div><div class="kpi-val up">+142.8%</div><div class="kpi-sub">5yr projection</div></div>
    <div class="mc-s"><div class="kpi-label">5th Pct Return</div><div class="kpi-val dn">+12.4%</div><div class="kpi-sub">Worst 5%</div></div>
    <div class="mc-s"><div class="kpi-label">95th Pct Return</div><div class="kpi-val up">+418.2%</div><div class="kpi-sub">Best 5%</div></div>
    <div class="mc-s"><div class="kpi-label">Ruin Probability</div><div class="kpi-val up">0.3%</div><div class="kpi-sub">DD &gt; 50%</div></div>
    <div class="mc-s"><div class="kpi-label">Simulations</div><div class="kpi-val">10,000</div></div>
  </div>
  <div style="flex:1;display:grid;grid-template-columns:200px 1fr;overflow:hidden">
    <div style="border-right:1px solid var(--bdr);padding:10px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;background:var(--bg0)">
      <div style="font-size:11px;font-weight:700;color:var(--tx2);letter-spacing:.05em;text-transform:uppercase">Parameters</div>
      <div class="field"><label>Simulations</label><input value="10,000"></div>
      <div class="field"><label>Horizon (days)</label><input value="1,260"></div>
      <div class="field"><label>Method</label><select><option>Bootstrap</option><option>Parametric</option><option>Historical</option></select></div>
      <div class="field"><label>Confidence</label><input value="95%"></div>
      <button class="btn-pri" style="width:100%;justify-content:center" onclick="runMonteCarlo()">
        <svg width="12" height="12" fill="currentColor"><polygon points="3,2 11,6 3,10"/></svg> Run
      </button>
    </div>
    <div style="overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">EQUITY PATH DISTRIBUTION (10,000 SIMULATIONS)</div>
      <canvas id="mc-chart" style="flex:1;min-height:0;width:100%"></canvas>
      <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--bdr);height:90px;overflow:hidden">
        <div style="border-right:1px solid var(--bdr);padding:6px 12px">
          <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-bottom:4px">RETURN DISTRIBUTION</div>
          <canvas id="mc-hist" style="height:58px;width:100%"></canvas>
        </div>
        <div style="padding:6px 12px">
          <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-bottom:4px">DRAWDOWN DISTRIBUTION</div>
          <canvas id="mc-dd-hist" style="height:58px;width:100%"></canvas>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ===== STRATEGY STUDIO VIEW ===== -->
<div class="view" id="view-strategy">
  <div class="ss-layout">
    <div class="ss-editor">
      <div class="ss-toolbar">
        <span style="font-size:12px;font-weight:600;color:var(--tx)">momentum_cross.py</span>
        <div style="display:flex;gap:2px;margin-left:auto">
          <button class="btn-sm neutral" onclick="showToast('Saved','Strategy saved','success')">Save</button>
          <button class="btn-sm bt" onclick="showToast('Backtest','Running backtest...','info')">Backtest</button>
          <button class="btn-sm up" onclick="showToast('Deploy','Deployed to paper','success')">Deploy</button>
        </div>
      </div>
""")

# Write textarea content separately to avoid triple-quote issues
code_content = '''# Momentum Cross Strategy — Apex Terminal
from apex import Strategy, indicators as ind

class MomentumCross(Strategy):
    fast_period:  int   = 12
    slow_period:  int   = 26
    rsi_period:   int   = 14
    rsi_ob:       float = 70.0
    rsi_os:       float = 30.0
    stop_loss:    float = 0.025
    take_profit:  float = 0.08
    position_pct: float = 0.05

    def on_bar(self, bar):
        ema_fast = ind.ema(bar.close, self.fast_period)
        ema_slow = ind.ema(bar.close, self.slow_period)
        rsi      = ind.rsi(bar.close, self.rsi_period)

        if not self.position:
            if (ema_fast[-1] > ema_slow[-1] and
                ema_fast[-2] <= ema_slow[-2] and
                rsi[-1] < self.rsi_ob):
                self.buy(size=self.position_pct,
                         stop_loss=self.stop_loss,
                         take_profit=self.take_profit)
            elif (ema_fast[-1] < ema_slow[-1] and
                  ema_fast[-2] >= ema_slow[-2] and
                  rsi[-1] > self.rsi_os):
                self.sell(size=self.position_pct,
                          stop_loss=self.stop_loss,
                          take_profit=self.take_profit)
        else:
            if self.position.side == 'long' and ema_fast[-1] < ema_slow[-1]:
                self.close()
            elif self.position.side == 'short' and ema_fast[-1] > ema_slow[-1]:
                self.close()

    def on_trade(self, trade):
        self.log(f"Trade: {trade.symbol} P&L: ${trade.pnl:.2f}")'''

f.write('<textarea class="code-area" spellcheck="false">' + code_content + '</textarea>\n')

f.write("""    </div>
    <div class="ss-results">
      <div class="ph"><div class="ph-title"><span>Live Metrics</span></div><span class="badge bt">PAPER</span></div>
      <div class="card-grid">
        <div class="stat-card"><div class="sc-lbl">Today P&amp;L</div><div class="sc-val up">+$284</div></div>
        <div class="stat-card"><div class="sc-lbl">Positions</div><div class="sc-val">3</div></div>
        <div class="stat-card"><div class="sc-lbl">Win Rate</div><div class="sc-val">67%</div></div>
        <div class="stat-card"><div class="sc-lbl">Signals Today</div><div class="sc-val">8</div></div>
      </div>
      <div class="ph"><div class="ph-title"><span>Signal Log</span></div></div>
      <div style="overflow-y:auto;flex:1">
        <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;font-size:11px"><span class="td-mono" style="color:var(--tx3)">09:32:15</span><span class="badge up">BUY</span><span>AAPL</span><span style="color:var(--tx2)">EMA cross + RSI 42</span></div>
        <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;font-size:11px"><span class="td-mono" style="color:var(--tx3)">09:18:44</span><span class="badge dn">SELL</span><span>TSLA</span><span style="color:var(--tx2)">Reverse cross exit</span></div>
        <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;font-size:11px"><span class="td-mono" style="color:var(--tx3)">09:10:02</span><span class="badge up">BUY</span><span>NVDA</span><span style="color:var(--tx2)">EMA cross + RSI 38</span></div>
      </div>
      <div class="ph"><div class="ph-title"><span>Parameter Sweep</span></div></div>
      <canvas id="ss-heatmap" style="height:120px;width:100%"></canvas>
    </div>
  </div>
</div>
""")
f.close()
print("Part 4 done")
