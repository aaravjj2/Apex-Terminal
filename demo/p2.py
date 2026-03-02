
# Part 2: Body structure, topbar, leftnav, trading view
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')
f.write("""<body>
<div id="app">
<!-- TOPBAR -->
<div id="topbar">
  <div class="tb-logo">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="12,2 22,20 2,20" fill="#2962FF" opacity=".9"/><polygon points="12,7 19,20 5,20" fill="#1E53E4" opacity=".6"/></svg>
    APEX
  </div>
  <div class="tb-sep"></div>
  <div class="mode-badge live" onclick="cycleModes(this)"><div class="mode-dot"></div>LIVE</div>
  <div class="tb-sep"></div>
  <div class="tb-search" onclick="openCmd()">
    <svg width="13" height="13" fill="none" stroke="#787B86" stroke-width="2"><circle cx="5.5" cy="5.5" r="4.5"/><path d="m9 9 3 3"/></svg>
    <input placeholder="Search symbols, commands... (K)" readonly onclick="openCmd()">
    <span style="font-family:var(--mono);font-size:10px;color:var(--tx3);background:var(--bg3);padding:1px 5px;border-radius:3px">⌘K</span>
  </div>
  <!-- symbol strip -->
  <div style="display:flex;gap:1px;overflow:hidden;flex-shrink:0">
    <div onclick="setSymbol('AAPL')" style="padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer;background:var(--bg2)">AAPL</div>
    <div onclick="setSymbol('TSLA')" style="padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer">TSLA</div>
    <div onclick="setSymbol('SPY')" style="padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer">SPY</div>
    <div onclick="setSymbol('BTC')" style="padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer">BTC</div>
    <div onclick="setSymbol('ETH')" style="padding:3px 8px;border-radius:var(--r2);font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer">ETH</div>
  </div>
  <div class="latency"><div class="latency-dot"></div><span id="latency-val">2ms</span></div>
  <div class="tb-right">
    <div class="tb-clock" id="tb-clock">09:34:22 ET</div>
    <div class="tb-icon-btn" title="Notifications" onclick="showToast('Alerts','3 price alerts triggered','warn')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3.5A4 4 0 0 0 4 7.5v3l-1 1.5h10l-1-1.5V7.5M7 13.5a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2z"/></svg>
      <div class="notif-dot"></div>
    </div>
    <div class="tb-icon-btn" title="Layout" onclick="showToast('Layout','Saved workspace layout','success')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="4" height="4"/><rect x="9" y="2" width="4" height="4"/><rect x="2" y="9" width="4" height="4"/><rect x="9" y="9" width="4" height="4"/></svg>
    </div>
    <div class="tb-icon-btn" title="Settings">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7" r="2.5"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4"/></svg>
    </div>
    <div class="tb-user">
      <div class="avatar">AG</div>
      <span style="font-size:12px;font-weight:500">Aarav</span>
    </div>
  </div>
</div>

<!-- MAIN LAYOUT -->
<div id="layout">
<!-- LEFT NAV -->
<div id="leftnav">
  <div class="nav-item active" data-view="trading" onclick="switchView('trading')" title="">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="1,12 5,7 9,9 13,3 15,3"/><polyline points="13,3 15,3 15,5"/></svg>
    <span class="nav-tip">Trading</span>
  </div>
  <div class="nav-item" data-view="dashboard" onclick="switchView('dashboard')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
    <span class="nav-tip">Dashboard</span>
  </div>
  <div class="nav-item" data-view="portfolio" onclick="switchView('portfolio')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5v6.5l4 2.3"/></svg>
    <span class="nav-tip">Portfolio</span>
  </div>
  <div class="navd"></div>
  <div class="nav-item" data-view="orders" onclick="switchView('orders')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/></svg>
    <span class="nav-tip">Orders / Blotter</span>
  </div>
  <div class="nav-item" data-view="risk" onclick="switchView('risk')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1.5L1.5 14h13z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg>
    <span class="nav-tip">Risk</span>
  </div>
  <div class="navd"></div>
  <div class="nav-item" data-view="backtest" onclick="switchView('backtest')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><polyline points="5,8 8,5 11,9.5"/></svg>
    <span class="nav-tip">Backtest</span>
  </div>
  <div class="nav-item" data-view="walkforward" onclick="switchView('walkforward')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="2,13 5,8 8,10 11,5 14,7"/><line x1="14" y1="7" x2="14" y2="13"/></svg>
    <span class="nav-tip">Walk-Forward</span>
  </div>
  <div class="nav-item" data-view="montecarlo" onclick="switchView('montecarlo')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12 Q5 4 8 8 Q11 12 14 3"/></svg>
    <span class="nav-tip">Monte Carlo</span>
  </div>
  <div class="nav-item" data-view="strategy" onclick="switchView('strategy')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="4,12 7,6 10,9 13,4"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="13" cy="4" r="1.5" fill="currentColor"/></svg>
    <span class="nav-tip">Strategy Studio</span>
  </div>
  <div class="navd"></div>
  <div class="nav-item" data-view="options" onclick="switchView('options')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13 C3 7 7 3 13 3"/><circle cx="8" cy="8" r="2.5"/></svg>
    <span class="nav-tip">Options Chain</span>
  </div>
  <div class="nav-item" data-view="screener" onclick="switchView('screener')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/><line x1="5" y1="7" x2="9" y2="7"/><line x1="7" y1="5" x2="7" y2="9"/></svg>
    <span class="nav-tip">Screener</span>
  </div>
  <div class="nav-item" data-view="alerts" onclick="switchView('alerts')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3.5A4 4 0 0 0 4 7.5v3l-1 1.5h10l-1-1.5V7.5M7 13.5a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2z"/></svg>
    <span class="nav-tip">Alerts</span>
  </div>
  <div class="navd"></div>
  <div class="nav-item" data-view="macro" onclick="switchView('macro')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="12" height="11" rx="1"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="6" y1="3" x2="6" y2="7"/><line x1="10" y1="3" x2="10" y2="7"/></svg>
    <span class="nav-tip">Economic Calendar</span>
  </div>
  <div class="nav-item" data-view="research" onclick="switchView('research')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/></svg>
    <span class="nav-tip">Research / Sentiment</span>
  </div>
  <div class="nav-spacer"></div>
  <div class="nav-item" data-view="autopilot" onclick="switchView('autopilot')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>
    <span class="nav-tip">Autopilot / AI</span>
  </div>
  <div class="nav-item" data-view="compliance" onclick="switchView('compliance')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 1L2 4v5c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4z"/><polyline points="5.5,8 7.5,10 11,6"/></svg>
    <span class="nav-tip">Compliance</span>
  </div>
  <div class="nav-item" data-view="platform" onclick="switchView('platform')">
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="3" width="14" height="10" rx="1"/><line x1="5" y1="13" x2="5" y2="15"/><line x1="11" y1="13" x2="11" y2="15"/><line x1="3" y1="15" x2="13" y2="15"/></svg>
    <span class="nav-tip">Platform / Observability</span>
  </div>
</div>

<!-- CONTENT AREA -->
<div id="content">

<!-- ===== TRADING VIEW ===== -->
<div class="view active" id="view-trading">
  <div class="chart-header">
    <span class="ch-sym" id="ch-sym">AAPL</span>
    <span class="ch-exch">NASDAQ</span>
    <div class="ch-sep"></div>
    <span class="ch-price" id="ch-price">$182.43</span>
    <span class="ch-chg up" id="ch-chg">+2.18 (+1.21%)</span>
    <div class="ch-sep"></div>
    <div class="ch-ohlcv"><span>O <span class="ohlcv-v" id="ch-o">180.91</span></span><span>H <span class="ohlcv-v" id="ch-h">183.20</span></span><span>L <span class="ohlcv-v" id="ch-l">180.10</span></span><span>V <span class="ohlcv-v" id="ch-v">58.4M</span></span></div>
    <div class="ch-sep"></div>
    <div class="tf-grp">
      <div class="tf-btn" onclick="setTF(this,'1m')">1m</div>
      <div class="tf-btn" onclick="setTF(this,'5m')">5m</div>
      <div class="tf-btn" onclick="setTF(this,'15m')">15m</div>
      <div class="tf-btn active" onclick="setTF(this,'1h')">1h</div>
      <div class="tf-btn" onclick="setTF(this,'4h')">4h</div>
      <div class="tf-btn" onclick="setTF(this,'1D')">1D</div>
      <div class="tf-btn" onclick="setTF(this,'1W')">1W</div>
    </div>
    <div class="ch-sep"></div>
    <div class="ch-ctrl" onclick="toggleChartType()">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="4" width="3" height="7"/><line x1="1" y1="4" x2="4" y2="4"/><line x1="4" y1="8" x2="4" y2="12"/><rect x="6" y="2" width="3" height="9"/><line x1="6" y1="6" x2="9" y2="6"/><line x1="9" y1="10" x2="9" y2="11"/></svg>
      <span id="chart-type-lbl">Candles</span>
    </div>
    <div class="ch-ctrl" onclick="addIndicator()">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
      Indicator
    </div>
    <div class="ch-ctrl" onclick="showToast('Compare','Add comparison symbol','info')">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="1,10 4,4 7,7 10,2"/><polyline points="1,10 4,7 7,9 10,5" stroke-dasharray="2,2"/></svg>
      Compare
    </div>
    <div style="margin-left:auto;display:flex;gap:4px">
      <div class="ch-ctrl" onclick="toggleReplayBar()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="6" r="5"/><polyline points="4,8 4,4 9,6z"/></svg>
        Replay
      </div>
    </div>
  </div>
  <div class="chart-body" id="chart-body">
    <div id="cmw">
      <div class="draw-strip">
        <div class="draw-btn active" onclick="setDraw(this,'cursor')" title="Cursor"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 1l9 9-5 1-2 4z"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'trendline')" title="Trend Line"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="11" x2="11" y2="1"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'ray')" title="Ray"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="11" x2="11" y2="1" stroke-dasharray="3,2"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'hline')" title="Horizontal Line"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="6" x2="11" y2="6"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'hrect')" title="Rect"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="8" height="6"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'fib')" title="Fibonacci"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="10" x2="11" y2="2"/><line x1="1" y1="7" x2="11" y2="5" stroke-dasharray="2,2"/><line x1="1" y1="5" x2="11" y2="7" stroke-dasharray="2,2"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'text')" title="Text"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 3h8M6 3v7"/></svg></div>
        <div class="draw-btn" onclick="setDraw(this,'measure')" title="Measure"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="4" x2="1" y2="8"/><line x1="11" y1="4" x2="11" y2="8"/></svg></div>
        <div class="draw-btn" onclick="clearDrawings()" title="Clear All" style="margin-top:auto"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></div>
      </div>
      <canvas id="chart-main"></canvas>
      <div class="ch-tooltip" id="ch-tooltip"></div>
    </div>
    <div id="crw">
      <span class="rsi-lbl">RSI(14) <span id="rsi-val" style="color:var(--warn)">54.2</span></span>
      <canvas id="chart-rsi"></canvas>
    </div>
  </div>
  <div class="replay-bar" id="replay-bar" style="display:none">
    <span class="rb-badge">REPLAY</span>
    <div class="rb-btn" onclick="replayToggle()"><svg width="12" height="12" fill="currentColor"><polygon points="3,2 10,6 3,10"/></svg>Play</div>
    <div class="rb-btn" onclick="replayStep(-1)"><svg width="12" height="12" fill="currentColor"><polygon points="9,2 2,6 9,10"/></svg>-1</div>
    <div class="rb-btn" onclick="replayStep(1)">+1<svg width="12" height="12" fill="currentColor"><polygon points="3,2 10,6 3,10"/></svg></div>
    <div class="rb-timeline"><div class="rb-fill" id="rb-fill"></div></div>
    <div class="rb-speed" id="rb-speed" onclick="cycleSpeed()">1x</div>
    <div class="rb-btn" onclick="toggleReplayBar()">Exit</div>
  </div>
</div>

<!-- ===== DASHBOARD VIEW ===== -->
<div class="view" id="view-dashboard">
  <div class="kpi-strip">
    <div class="kpi-item"><div class="kpi-label">Portfolio P&amp;L</div><div class="kpi-val up" id="dash-pnl">+$8,240</div><div class="kpi-sub up">+2.34% today</div></div>
    <div class="kpi-item"><div class="kpi-label">Net Exposure</div><div class="kpi-val">$347,820</div><div class="kpi-sub">68% long</div></div>
    <div class="kpi-item"><div class="kpi-label">Open Positions</div><div class="kpi-val">12</div><div class="kpi-sub">8 long / 4 short</div></div>
    <div class="kpi-item"><div class="kpi-label">Day VaR 95%</div><div class="kpi-val warn">$4,180</div><div class="kpi-sub">1.1% of NAV</div></div>
    <div class="kpi-item"><div class="kpi-label">Beta</div><div class="kpi-val">0.82</div><div class="kpi-sub">vs S&amp;P 500</div></div>
    <div class="kpi-item"><div class="kpi-label">Sharpe YTD</div><div class="kpi-val up">1.84</div><div class="kpi-sub">vs 1.12 benchmark</div></div>
    <div class="kpi-item"><div class="kpi-label">Max Drawdown</div><div class="kpi-val dn">-7.2%</div><div class="kpi-sub">Current: -1.3%</div></div>
    <div class="kpi-item"><div class="kpi-label">Pending Orders</div><div class="kpi-val">3</div><div class="kpi-sub">2 limit / 1 stop</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 240px;flex:1;min-height:0;overflow:hidden">
    <div style="display:flex;flex-direction:column;overflow:hidden">
      <div class="ph"><div class="ph-title"><span>Market Overview</span></div><div style="display:flex;gap:4px"><span style="font-family:var(--mono);font-size:10px;color:var(--tx3)">Last updated 09:34:21</span></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden;border-bottom:1px solid var(--bdr)">
        <div style="border-right:1px solid var(--bdr);overflow:hidden;display:flex;flex-direction:column">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">EQUITY CURVE</div>
          <canvas id="dash-equity" style="flex:1;min-height:0;width:100%"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">SECTOR PERFORMANCE</div>
          <canvas id="dash-sector" style="flex:1;min-height:0;width:100%"></canvas>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;flex:0 0 160px;overflow:hidden">
        <div style="border-right:1px solid var(--bdr);overflow:hidden;display:flex;flex-direction:column">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">TOP MOVERS</div>
          <div id="dash-movers" style="overflow-y:auto;flex:1"></div>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">NEWS FEED</div>
          <div id="dash-news" style="overflow-y:auto;flex:1;padding:4px 0"></div>
        </div>
      </div>
    </div>
    <div style="border-left:1px solid var(--bdr);overflow-y:auto;display:flex;flex-direction:column">
      <div class="ph"><div class="ph-title"><span>Indices</span></div></div>
      <div id="dash-indices"></div>
      <div class="ph" style="margin-top:8px"><div class="ph-title"><span>Upcoming Events</span></div></div>
      <div id="dash-events" style="padding:0 8px 8px"></div>
    </div>
  </div>
</div>
""")
f.close()
print("Part 2 done")
