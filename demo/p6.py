
# Part 6: Macro/Calendar, Research/Sentiment, Autopilot/AI views
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')
f.write("""
<!-- ===== ECONOMIC CALENDAR VIEW ===== -->
<div class="view" id="view-macro">
  <div style="display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;padding:5px 12px;gap:6px;align-items:center;flex-wrap:wrap">
    <span style="font-size:12px;font-weight:600;color:var(--tx)">Economic Calendar</span>
    <div style="display:flex;gap:3px;margin-left:8px">
      <div class="filter-pill active" onclick="togglePill(this)" style="border-radius:3px">All</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px;border-color:var(--dn);color:var(--dn)">High Impact</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">Medium</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">Low</div>
    </div>
    <div style="display:flex;gap:3px;margin-left:4px">
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">US</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">EU</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">UK</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">JP</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">CN</div>
    </div>
    <span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--tx3)">Week of Mar 1–7, 2026</span>
    <div class="tb-icon-btn"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="1,10 4,4 7,7 10,2"/></svg></div>
  </div>
  <div style="flex:1;overflow-y:auto">
    <div class="eco-row eco-hdr">
      <div>TIME</div><div>IMP</div><div>CCY</div><div>EVENT</div><div>ACTUAL</div><div>FORECAST</div><div>PREVIOUS</div><div>REVISION</div>
    </div>
    <div style="padding:3px 12px;font-size:10px;font-weight:700;color:var(--tx3);background:var(--bg0);border-bottom:1px solid var(--bdr)">MONDAY, MARCH 2</div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">08:30</div>
      <div><div class="eco-imp high"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">Non-Farm Payrolls</div>
      <div class="eco-val eco-actual beat">+256K</div>
      <div class="eco-val" style="color:var(--tx2)">+200K</div>
      <div class="eco-val" style="color:var(--tx3)">+223K</div>
      <div class="eco-val" style="color:var(--warn)">+218K</div>
    </div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">08:30</div>
      <div><div class="eco-imp high"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">Unemployment Rate</div>
      <div class="eco-val eco-actual beat">3.7%</div>
      <div class="eco-val" style="color:var(--tx2)">3.9%</div>
      <div class="eco-val" style="color:var(--tx3)">3.8%</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">10:00</div>
      <div><div class="eco-imp med"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">ISM Manufacturing PMI</div>
      <div class="eco-val eco-actual miss">49.2</div>
      <div class="eco-val" style="color:var(--tx2)">50.1</div>
      <div class="eco-val" style="color:var(--tx3)">49.8</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div style="padding:3px 12px;font-size:10px;font-weight:700;color:var(--tx3);background:var(--bg0);border-bottom:1px solid var(--bdr);border-top:1px solid var(--bdr)">TUESDAY, MARCH 3</div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">08:30</div>
      <div><div class="eco-imp med"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">Trade Balance</div>
      <div class="eco-val eco-actual tbd">—</div>
      <div class="eco-val" style="color:var(--tx2)">-$67.2B</div>
      <div class="eco-val" style="color:var(--tx3)">-$68.4B</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">10:00</div>
      <div><div class="eco-imp high"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">JOLTs Job Openings</div>
      <div class="eco-val eco-actual tbd">—</div>
      <div class="eco-val" style="color:var(--tx2)">8.1M</div>
      <div class="eco-val" style="color:var(--tx3)">7.9M</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">14:00</div>
      <div><div class="eco-imp med"></div></div>
      <div style="font-weight:600;color:var(--tx)">EUR</div>
      <div style="font-weight:500;color:var(--tx)">ECB Consumer Inflation</div>
      <div class="eco-val eco-actual tbd">—</div>
      <div class="eco-val" style="color:var(--tx2)">2.4%</div>
      <div class="eco-val" style="color:var(--tx3)">2.6%</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div style="padding:3px 12px;font-size:10px;font-weight:700;color:var(--tx3);background:var(--bg0);border-bottom:1px solid var(--bdr);border-top:1px solid var(--bdr)">WEDNESDAY, MARCH 4</div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">08:15</div>
      <div><div class="eco-imp high"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">ADP Employment Change</div>
      <div class="eco-val eco-actual tbd">—</div>
      <div class="eco-val" style="color:var(--tx2)">+185K</div>
      <div class="eco-val" style="color:var(--tx3)">+170K</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
    <div class="eco-row">
      <div class="td-mono" style="color:var(--tx3)">14:30</div>
      <div><div class="eco-imp high"></div></div>
      <div style="font-weight:600;color:var(--tx)">USD</div>
      <div style="font-weight:500;color:var(--tx)">Fed Beige Book</div>
      <div class="eco-val eco-actual tbd">—</div>
      <div class="eco-val" style="color:var(--tx2)">—</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
      <div class="eco-val" style="color:var(--tx3)">—</div>
    </div>
  </div>
</div>

<!-- ===== RESEARCH / SENTIMENT VIEW ===== -->
<div class="view" id="view-research">
  <div class="research-layout">
    <div class="res-panel res-l">
      <div class="ph"><div class="ph-title"><span>Sentiment</span></div></div>
      <div style="padding:10px 12px">
        <div style="margin-bottom:10px">
          <div style="font-size:10px;color:var(--tx3);margin-bottom:5px">FEAR &amp; GREED INDEX</div>
          <div style="position:relative;height:10px;background:linear-gradient(90deg,var(--dn),var(--warn),var(--up));border-radius:5px">
            <div style="position:absolute;top:-3px;left:62%;width:14px;height:14px;background:#fff;border-radius:50%;border:2px solid var(--brand);transform:translateX(-50%)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-family:var(--mono);font-size:9px;color:var(--tx3)"><span>Fear</span><span>Neutral</span><span>Greed</span></div>
          <div style="text-align:center;font-family:var(--mono);font-size:20px;font-weight:700;color:var(--warn);margin-top:6px">62</div>
          <div style="text-align:center;font-size:10px;color:var(--warn)">GREED</div>
        </div>
        <div style="height:1px;background:var(--bdr);margin:10px 0"></div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:6px">SOCIAL SENTIMENT (24H)</div>
        <div style="display:flex;flex-direction:column;gap:5px" id="sent-bars"></div>
      </div>
      <div class="ph"><div class="ph-title"><span>Put/Call Ratio</span></div></div>
      <div style="padding:8px 12px;display:flex;flex-direction:column;gap:4px">
        <div class="fund-row"><span class="fund-lbl">SPY P/C</span><span class="fund-val" style="color:var(--warn)">1.24</span></div>
        <div class="fund-row"><span class="fund-lbl">QQQ P/C</span><span class="fund-val" style="color:var(--up)">0.82</span></div>
        <div class="fund-row"><span class="fund-lbl">VIX</span><span class="fund-val">16.4</span></div>
        <div class="fund-row"><span class="fund-lbl">SKEW</span><span class="fund-val">124.8</span></div>
      </div>
    </div>
    <div class="res-panel" style="overflow-y:auto;display:flex;flex-direction:column">
      <div class="ph">
        <div class="ph-title"><span>News &amp; Research</span></div>
        <div style="display:flex;gap:4px">
          <div class="filter-pill active" onclick="togglePill(this)" style="border-radius:3px;font-size:10px;padding:2px 6px">All</div>
          <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px;font-size:10px;padding:2px 6px">Macro</div>
          <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px;font-size:10px;padding:2px 6px">Earnings</div>
          <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px;font-size:10px;padding:2px 6px">Analyst</div>
        </div>
      </div>
      <div id="research-news" style="overflow-y:auto;flex:1"></div>
    </div>
    <div class="res-panel res-r">
      <div class="ph"><div class="ph-title"><span>Fundamentals</span></div></div>
      <div style="padding:5px 12px;display:flex;gap:6px;border-bottom:1px solid var(--bdr)">
        <input style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:4px 8px;font-size:11px;color:var(--tx);outline:none;width:100%" placeholder="Enter symbol...">
      </div>
      <div style="overflow-y:auto;flex:1">
        <div class="fund-row"><span class="fund-lbl">Market Cap</span><span class="fund-val">$2.82T</span></div>
        <div class="fund-row"><span class="fund-lbl">P/E Ratio</span><span class="fund-val">28.4</span></div>
        <div class="fund-row"><span class="fund-lbl">Fwd P/E</span><span class="fund-val">25.1</span></div>
        <div class="fund-row"><span class="fund-lbl">P/S Ratio</span><span class="fund-val">7.2</span></div>
        <div class="fund-row"><span class="fund-lbl">EV/EBITDA</span><span class="fund-val">22.8</span></div>
        <div class="fund-row"><span class="fund-lbl">Revenue TTM</span><span class="fund-val">$391B</span></div>
        <div class="fund-row"><span class="fund-lbl">Revenue YoY</span><span class="fund-val" style="color:var(--up)">+7.8%</span></div>
        <div class="fund-row"><span class="fund-lbl">Gross Margin</span><span class="fund-val">44.1%</span></div>
        <div class="fund-row"><span class="fund-lbl">Net Margin</span><span class="fund-val">25.3%</span></div>
        <div class="fund-row"><span class="fund-lbl">EPS TTM</span><span class="fund-val">$6.43</span></div>
        <div class="fund-row"><span class="fund-lbl">EPS Growth</span><span class="fund-val" style="color:var(--up)">+12.4%</span></div>
        <div class="fund-row"><span class="fund-lbl">Debt/Equity</span><span class="fund-val">1.96</span></div>
        <div class="fund-row"><span class="fund-lbl">Current Ratio</span><span class="fund-val">0.87</span></div>
        <div class="fund-row"><span class="fund-lbl">Free Cash Flow</span><span class="fund-val">$107B</span></div>
        <div class="fund-row"><span class="fund-lbl">Div Yield</span><span class="fund-val">0.45%</span></div>
        <div class="fund-row"><span class="fund-lbl">Beta</span><span class="fund-val">1.12</span></div>
        <div class="fund-row"><span class="fund-lbl">52W High</span><span class="fund-val">$199.62</span></div>
        <div class="fund-row"><span class="fund-lbl">52W Low</span><span class="fund-val">$164.08</span></div>
        <div class="fund-row"><span class="fund-lbl">Shares Out</span><span class="fund-val">15.4B</span></div>
        <div class="fund-row"><span class="fund-lbl">Float</span><span class="fund-val">15.1B</span></div>
        <div class="fund-row"><span class="fund-lbl">Short Float</span><span class="fund-val">0.72%</span></div>
        <div class="fund-row"><span class="fund-lbl">Insider Own</span><span class="fund-val">0.8%</span></div>
        <div class="fund-row"><span class="fund-lbl">Inst Own</span><span class="fund-val">60.4%</span></div>
        <div class="fund-row"><span class="fund-lbl">Next Earnings</span><span class="fund-val" style="color:var(--warn)">Apr 30</span></div>
        <div class="ph" style="margin-top:8px"><div class="ph-title"><span>Analyst Ratings</span></div></div>
        <div style="padding:8px 12px">
          <div style="display:flex;gap:3px;height:32px;align-items:flex-end;margin-bottom:5px">
            <div style="flex:4;background:var(--up);border-radius:2px 2px 0 0" title="Strong Buy"></div>
            <div style="flex:8;background:rgba(8,153,129,.5);border-radius:2px 2px 0 0" title="Buy"></div>
            <div style="flex:5;background:var(--tx3);border-radius:2px 2px 0 0" title="Hold"></div>
            <div style="flex:2;background:rgba(242,54,69,.5);border-radius:2px 2px 0 0" title="Sell"></div>
            <div style="flex:1;background:var(--dn);border-radius:2px 2px 0 0" title="Strong Sell"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--tx3)"><span style="color:var(--up)">Str.Buy</span><span>Buy</span><span>Hold</span><span>Sell</span><span style="color:var(--dn)">Str.Sell</span></div>
          <div style="text-align:center;margin-top:8px;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--up)">BUY</div>
          <div style="text-align:center;font-size:10px;color:var(--tx3)">Avg target: $210.50</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ===== AUTOPILOT / AI VIEW ===== -->
<div class="view" id="view-autopilot">
  <div class="ap-layout">
    <div class="ap-panel ap-l" style="display:flex;flex-direction:column;overflow-y:auto">
      <div class="ph"><div class="ph-title"><span>Agent Controls</span></div></div>
      <div style="padding:0 0 8px 0;display:flex;flex-direction:column;gap:6px">
        <div class="ap-toggle">
          <div><div style="font-size:12px;font-weight:600;color:var(--tx)">Momentum Strategy</div><div style="font-size:10px;color:var(--tx3)">Paper mode</div></div>
          <div class="toggle-sw" onclick="this.classList.toggle('off')"><div class="toggle-knob"></div></div>
        </div>
        <div class="ap-toggle">
          <div><div style="font-size:12px;font-weight:600;color:var(--tx)">Mean Reversion</div><div style="font-size:10px;color:var(--tx3)">Disabled</div></div>
          <div class="toggle-sw off" onclick="this.classList.toggle('off')"><div class="toggle-knob"></div></div>
        </div>
        <div class="ap-toggle">
          <div><div style="font-size:12px;font-weight:600;color:var(--tx)">Risk Manager</div><div style="font-size:10px;color:var(--tx3)">Always on</div></div>
          <div class="toggle-sw" onclick="this.classList.toggle('off')"><div class="toggle-knob"></div></div>
        </div>
        <div class="ap-toggle">
          <div><div style="font-size:12px;font-weight:600;color:var(--tx)">News Sentiment</div><div style="font-size:10px;color:var(--tx3)">Live signals</div></div>
          <div class="toggle-sw off" onclick="this.classList.toggle('off')"><div class="toggle-knob"></div></div>
        </div>
        <div class="ap-toggle">
          <div><div style="font-size:12px;font-weight:600;color:var(--tx)">Auto-Rebalance</div><div style="font-size:10px;color:var(--tx3)">Monthly</div></div>
          <div class="toggle-sw off" onclick="this.classList.toggle('off')"><div class="toggle-knob"></div></div>
        </div>
      </div>
      <div class="ph"><div class="ph-title"><span>Agent Registry</span></div></div>
      <div style="overflow-y:auto;flex:1">
        <div class="svc-card" style="flex-direction:column;align-items:flex-start;gap:5px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <div class="svc-ico ok"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="3"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2"/></svg></div>
            <div style="flex:1"><div class="svc-name">Market Scanner v2.1</div><div class="svc-status">Running · 342 scans/min</div></div>
            <span class="badge up">ACTIVE</span>
          </div>
        </div>
        <div class="svc-card" style="flex-direction:column;align-items:flex-start;gap:5px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <div class="svc-ico warn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 1L1.5 12h11z"/><line x1="7" y1="6" x2="7" y2="9"/></svg></div>
            <div style="flex:1"><div class="svc-name">Risk Monitor v1.4</div><div class="svc-status">Degraded · High CPU</div></div>
            <span class="badge warn">WARN</span>
          </div>
        </div>
        <div class="svc-card" style="flex-direction:column;align-items:flex-start;gap:5px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <div class="svc-ico ok"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><line x1="7" y1="6" x2="7" y2="6"/></svg></div>
            <div style="flex:1"><div class="svc-name">Signal Generator v3.0</div><div class="svc-status">Running · 8 signals today</div></div>
            <span class="badge up">ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
    <div class="ap-panel" style="overflow-hidden;display:flex;flex-direction:column">
      <div class="ph"><div class="ph-title"><span>Trade Proposals</span><span class="badge info" id="proposal-count">4 pending</span></div>
        <div style="display:flex;gap:4px">
          <button class="btn-sm up" onclick="showToast('Approved','All proposals approved','success')">Approve All</button>
          <button class="btn-sm dn" onclick="showToast('Rejected','All proposals rejected','warn')">Reject All</button>
        </div>
      </div>
      <div style="overflow-y:auto;flex:1" id="proposals"></div>
    </div>
    <div class="ap-panel ap-r" style="overflow-y:auto;display:flex;flex-direction:column">
      <div class="ph"><div class="ph-title"><span>Agent Reasoning</span></div></div>
      <div style="overflow-y:auto;flex:1;padding:6px 0" id="agent-thoughts"></div>
      <div class="ph"><div class="ph-title"><span>ML Predictions</span></div></div>
      <div style="padding:8px 12px;display:flex;flex-direction:column;gap:5px">
        <div class="fund-row"><span class="fund-lbl">AAPL 1D</span><span class="fund-val" style="color:var(--up)">+0.8% conf:72%</span></div>
        <div class="fund-row"><span class="fund-lbl">TSLA 1D</span><span class="fund-val" style="color:var(--dn)">-1.2% conf:68%</span></div>
        <div class="fund-row"><span class="fund-lbl">SPY 1W</span><span class="fund-val" style="color:var(--up)">+1.4% conf:64%</span></div>
        <div class="fund-row"><span class="fund-lbl">VIX 1D</span><span class="fund-val" style="color:var(--warn)">+0.4 conf:59%</span></div>
        <div class="fund-row"><span class="fund-lbl">Model</span><span class="fund-val" style="color:var(--bt)">LSTM+Transformer</span></div>
        <div class="fund-row"><span class="fund-lbl">Train Acc</span><span class="fund-val">76.4%</span></div>
        <div class="fund-row"><span class="fund-lbl">Val Acc</span><span class="fund-val">71.8%</span></div>
      </div>
    </div>
  </div>
</div>
""")
f.close()
print("Part 6 done")
