
# p10: Inject new views HTML (Fixed Income, FX, Commodities, Crypto, Heatmap, Social)
# Also: enhance options view (tabs + IV surface + payoff), portfolio (efficient frontier + attribution)
import re

path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')

# We need to append new views BEFORE the closing </div><!-- #content --> tag
# The current file ends with </div><!-- #content --> then right sidebar etc.
# Since we're appending, the browser will still render correctly as long as
# we append inside the body. We'll add a script block that adds views dynamically.
# Actually, we need to inject them into #content. Let's use a different approach:
# We'll write a JS function that builds these views and appends them to #content on DOMContentLoaded.
# This avoids needing to modify the HTML file structure (risky with string replacement on large files).

new_views_js = r"""
<script>
// ============================================================
// INJECT ADDITIONAL VIEWS DYNAMICALLY
// ============================================================
function injectViews() {
  const content = document.getElementById('content');
  if (!content) return;

  // ── FIXED INCOME ───────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-fixedincome">
    <div class="kpi-strip">
      <div class="kpi-item"><div class="kpi-label">10Y UST Yield</div><div class="kpi-val warn">4.28%</div><div class="kpi-sub dn">+0.02 today</div></div>
      <div class="kpi-item"><div class="kpi-label">2Y UST Yield</div><div class="kpi-val warn">4.71%</div><div class="kpi-sub">2s10s: -43bps</div></div>
      <div class="kpi-item"><div class="kpi-label">30Y UST Yield</div><div class="kpi-val">4.52%</div><div class="kpi-sub">Real: 2.14%</div></div>
      <div class="kpi-item"><div class="kpi-label">Fed Funds Rate</div><div class="kpi-val">5.25-5.50%</div><div class="kpi-sub">Target rate</div></div>
      <div class="kpi-item"><div class="kpi-label">IG Spread (OAS)</div><div class="kpi-val">84bps</div><div class="kpi-sub dn">+2bps</div></div>
      <div class="kpi-item"><div class="kpi-label">HY Spread (OAS)</div><div class="kpi-val warn">312bps</div><div class="kpi-sub dn">+8bps</div></div>
    </div>
    <div class="yc-tab-bar">
      <div class="yc-tab active" onclick="switchYCTab(this,'yc-curve')">Yield Curve</div>
      <div class="yc-tab" onclick="switchYCTab(this,'yc-bonds')">Bond Search</div>
      <div class="yc-tab" onclick="switchYCTab(this,'yc-analytics')">Analytics</div>
      <div class="yc-tab" onclick="switchYCTab(this,'yc-credit')">Credit Spreads</div>
    </div>
    <div class="opt-tab-content active" id="yc-curve" style="display:flex;flex-direction:column;flex:1;overflow:hidden">
      <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0;overflow:hidden">
        <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">US TREASURY YIELD CURVE</div>
          <canvas id="yc-canvas" style="flex:1;min-height:0;width:100%"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CURVE COMPARISON (1Y vs 5Y vs TODAY)</div>
          <canvas id="yc-compare" style="flex:1;min-height:0;width:100%"></canvas>
        </div>
      </div>
      <div style="border-top:1px solid var(--bdr);padding:6px 12px;display:flex;gap:16px;flex-shrink:0;flex-wrap:wrap">
        <div style="display:flex;gap:3px;align-items:center;font-size:10px;color:var(--tx3)"><div style="width:12px;height:2px;background:#2962FF"></div>Today</div>
        <div style="display:flex;gap:3px;align-items:center;font-size:10px;color:var(--tx3)"><div style="width:12px;height:2px;background:rgba(41,98,255,.4)"></div>1Y Ago</div>
        <div style="display:flex;gap:3px;align-items:center;font-size:10px;color:var(--tx3)"><div style="width:12px;height:2px;background:rgba(247,147,26,.7)"></div>5Y Ago</div>
        <span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--dn)">INVERTED CURVE (2s10s: -43bps)</span>
      </div>
    </div>
    <div class="opt-tab-content" id="yc-bonds" style="flex:1;overflow:hidden;flex-direction:column">
      <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;flex-shrink:0">
        <input style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:5px 10px;font-size:12px;color:var(--tx);outline:none;flex:1" placeholder="Search bonds: CUSIP, issuer, ticker...">
        <select style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:5px 8px;font-size:11px;color:var(--tx);outline:none"><option>All Issuers</option><option>Government</option><option>Corporate IG</option><option>Corporate HY</option><option>Municipal</option><option>Agency/MBS</option></select>
        <select style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:5px 8px;font-size:11px;color:var(--tx);outline:none"><option>All Maturities</option><option>1-3Y</option><option>3-7Y</option><option>7-10Y</option><option>10Y+</option></select>
      </div>
      <div class="bond-table-wrap">
        <table><thead><tr><th>Issuer</th><th>Coupon</th><th>Maturity</th><th>Rating</th><th>Bid Price</th><th>Ask Price</th><th>YTM Bid</th><th>YTM Ask</th><th>OAS</th><th>Duration</th><th>Convexity</th><th>DV01</th></tr></thead>
        <tbody>
          <tr onclick="showToast('Bond Selected','UST 4.25% Nov 2034','info')"><td><div class="td-sym">US TREASURY</div><div class="td-name">4.250% Nov 2034</div></td><td class="td-mono">4.250%</td><td class="td-mono">11/15/2034</td><td><span class="badge up">AAA</span></td><td class="td-mono">99.42</td><td class="td-mono">99.45</td><td class="td-mono">4.315%</td><td class="td-mono">4.312%</td><td class="td-mono">0</td><td class="td-mono">8.21</td><td class="td-mono">0.82</td><td class="td-mono">$82.1</td></tr>
          <tr onclick="showToast('Bond Selected','AAPL 3.2% May 2027','info')"><td><div class="td-sym">APPLE INC</div><div class="td-name">3.200% May 2027</div></td><td class="td-mono">3.200%</td><td class="td-mono">05/11/2027</td><td><span class="badge up">AA+</span></td><td class="td-mono">97.18</td><td class="td-mono">97.24</td><td class="td-mono">4.82%</td><td class="td-mono">4.79%</td><td class="td-mono">54bps</td><td class="td-mono">2.84</td><td class="td-mono">0.12</td><td class="td-mono">$28.4</td></tr>
          <tr onclick="showToast('Bond Selected','MS 4.1% Jan 2029','info')"><td><div class="td-sym">MORGAN STANLEY</div><div class="td-name">4.100% Jan 2029</div></td><td class="td-mono">4.100%</td><td class="td-mono">01/22/2029</td><td><span class="badge neutral">A-</span></td><td class="td-mono">98.24</td><td class="td-mono">98.34</td><td class="td-mono">4.54%</td><td class="td-mono">4.51%</td><td class="td-mono">126bps</td><td class="td-mono">4.12</td><td class="td-mono">0.22</td><td class="td-mono">$41.2</td></tr>
          <tr onclick="showToast('Bond Selected','FORD 9% Apr 2030','info')"><td><div class="td-sym">FORD MOTOR CO</div><div class="td-name">9.000% Apr 2030</div></td><td class="td-mono">9.000%</td><td class="td-mono">04/22/2030</td><td><span class="badge warn">BB+</span></td><td class="td-mono">109.82</td><td class="td-mono">110.14</td><td class="td-mono">6.82%</td><td class="td-mono">6.78%</td><td class="td-mono">354bps</td><td class="td-mono">4.84</td><td class="td-mono">0.28</td><td class="td-mono">$48.4</td></tr>
          <tr onclick="showToast('Bond Selected','NYC GEN OBL 3.5%','info')"><td><div class="td-sym">NYC GEN OBLG</div><div class="td-name">3.500% Jan 2040 MUNI</div></td><td class="td-mono">3.500%</td><td class="td-mono">01/01/2040</td><td><span class="badge up">AA</span></td><td class="td-mono">96.84</td><td class="td-mono">97.04</td><td class="td-mono">3.84%</td><td class="td-mono">3.81%</td><td class="td-mono">TEY</td><td class="td-mono">12.41</td><td class="td-mono">1.82</td><td class="td-mono">$124.1</td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="opt-tab-content" id="yc-analytics" style="flex:1;overflow:hidden;flex-direction:column">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;flex:1;overflow:hidden">
        <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">DURATION ANALYSIS</div>
          <div style="padding:10px 12px;overflow-y:auto;flex:1">
            <div class="fund-row"><span class="fund-lbl">Modified Duration</span><span class="fund-val">8.21</span></div>
            <div class="fund-row"><span class="fund-lbl">Macaulay Duration</span><span class="fund-val">8.56</span></div>
            <div class="fund-row"><span class="fund-lbl">Effective Duration</span><span class="fund-val">8.18</span></div>
            <div class="fund-row"><span class="fund-lbl">Key Rate 2Y</span><span class="fund-val">0.42</span></div>
            <div class="fund-row"><span class="fund-lbl">Key Rate 5Y</span><span class="fund-val">1.84</span></div>
            <div class="fund-row"><span class="fund-lbl">Key Rate 10Y</span><span class="fund-val">3.82</span></div>
            <div class="fund-row"><span class="fund-lbl">Key Rate 30Y</span><span class="fund-val">2.10</span></div>
            <div class="fund-row"><span class="fund-lbl">Convexity</span><span class="fund-val">0.82</span></div>
            <div class="fund-row"><span class="fund-lbl">DV01</span><span class="fund-val">$82.10</span></div>
            <div class="fund-row"><span class="fund-lbl">DV100 (CR01)</span><span class="fund-val">$1.24</span></div>
          </div>
        </div>
        <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">SPREAD ANALYSIS</div>
          <div style="padding:10px 12px;overflow-y:auto;flex:1">
            <div class="fund-row"><span class="fund-lbl">G-Spread</span><span class="fund-val warn">48bps</span></div>
            <div class="fund-row"><span class="fund-lbl">Z-Spread</span><span class="fund-val warn">52bps</span></div>
            <div class="fund-row"><span class="fund-lbl">OAS</span><span class="fund-val warn">54bps</span></div>
            <div class="fund-row"><span class="fund-lbl">I-Spread</span><span class="fund-val warn">46bps</span></div>
            <div class="fund-row"><span class="fund-lbl">ASW Spread</span><span class="fund-val warn">38bps</span></div>
            <div class="fund-row"><span class="fund-lbl">TED Spread</span><span class="fund-val">12bps</span></div>
            <div class="fund-row"><span class="fund-lbl">LIBOR-OIS</span><span class="fund-val">8bps</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CASH FLOW SCHEDULE</div>
          <div style="overflow-y:auto;flex:1">
            <table><thead><tr><th>Date</th><th>Coupon</th><th>Principal</th><th>Cash Flow</th><th>PV</th></tr></thead>
            <tbody>
              <tr><td class="td-mono" style="color:var(--tx3)">05/15/2025</td><td class="td-mono">$21.25</td><td class="td-mono">—</td><td class="td-mono">$21.25</td><td class="td-mono">$20.82</td></tr>
              <tr><td class="td-mono" style="color:var(--tx3)">11/15/2025</td><td class="td-mono">$21.25</td><td class="td-mono">—</td><td class="td-mono">$21.25</td><td class="td-mono">$20.41</td></tr>
              <tr><td class="td-mono" style="color:var(--tx3)">05/15/2026</td><td class="td-mono">$21.25</td><td class="td-mono">—</td><td class="td-mono">$21.25</td><td class="td-mono">$19.82</td></tr>
              <tr><td class="td-mono" style="color:var(--tx3)">11/15/2026</td><td class="td-mono">$21.25</td><td class="td-mono">—</td><td class="td-mono">$21.25</td><td class="td-mono">$19.28</td></tr>
              <tr><td class="td-mono" style="color:var(--tx3)">11/15/2034</td><td class="td-mono">$21.25</td><td class="td-mono">$1,000</td><td class="td-mono">$1,021.25</td><td class="td-mono">$720.84</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
    <div class="opt-tab-content" id="yc-credit" style="flex:1;overflow:hidden;flex-direction:column">
      <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden">
        <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CREDIT SPREAD CURVE (IG vs HY)</div>
          <canvas id="credit-spread-canvas" style="flex:1;min-height:0;width:100%"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CDS RATES (5Y)</div>
          <div class="tbl-wrap">
            <table><thead><tr><th>Issuer</th><th>Rating</th><th>CDS Spread</th><th>1D Chg</th><th>PD (1Y)</th></tr></thead>
            <tbody>
              <tr><td><div class="td-sym">AAPL</div></td><td><span class="badge up">AA+</span></td><td class="td-mono">24bps</td><td class="td-up">-1bp</td><td class="td-mono">0.08%</td></tr>
              <tr><td><div class="td-sym">MSFT</div></td><td><span class="badge up">AAA</span></td><td class="td-mono">18bps</td><td class="td-up">-0.5bp</td><td class="td-mono">0.06%</td></tr>
              <tr><td><div class="td-sym">TSLA</div></td><td><span class="badge warn">BB+</span></td><td class="td-mono">284bps</td><td class="td-dn">+12bp</td><td class="td-mono">2.14%</td></tr>
              <tr><td><div class="td-sym">FORD</div></td><td><span class="badge warn">BB+</span></td><td class="td-mono">312bps</td><td class="td-dn">+8bp</td><td class="td-mono">2.42%</td></tr>
              <tr><td><div class="td-sym">JPM</div></td><td><span class="badge neutral">A-</span></td><td class="td-mono">62bps</td><td class="td-dn">+2bp</td><td class="td-mono">0.48%</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // ── FX ANALYTICS ──────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-fx">
    <div class="kpi-strip">
      <div class="kpi-item"><div class="kpi-label">EUR/USD</div><div class="kpi-val">1.0842</div><div class="kpi-sub dn">-0.0082 (-0.75%)</div></div>
      <div class="kpi-item"><div class="kpi-label">USD/JPY</div><div class="kpi-val warn">149.82</div><div class="kpi-sub up">+1.24 (+0.84%)</div></div>
      <div class="kpi-item"><div class="kpi-label">GBP/USD</div><div class="kpi-val">1.2641</div><div class="kpi-sub dn">-0.0048 (-0.38%)</div></div>
      <div class="kpi-item"><div class="kpi-label">DXY</div><div class="kpi-val">104.82</div><div class="kpi-sub up">+0.22 (+0.21%)</div></div>
      <div class="kpi-item"><div class="kpi-label">USD/CNH</div><div class="kpi-val">7.2420</div><div class="kpi-sub up">+0.0124</div></div>
    </div>
    <div class="fx-layout">
      <div style="display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CROSS-RATE MATRIX</div>
        <div class="fx-matrix" id="fx-matrix"></div>
        <div style="border-top:1px solid var(--bdr);padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3)">FORWARD POINTS (vs USD)</div>
        <div style="overflow:auto;flex:0 0 120px">
          <table><thead><tr><th>Pair</th><th>Spot</th><th>1W</th><th>1M</th><th>3M</th><th>6M</th><th>1Y</th><th>Carry</th></tr></thead>
          <tbody id="fwd-tbody"></tbody></table>
        </div>
      </div>
      <div class="fx-right">
        <div class="ph"><div class="ph-title"><span>Central Bank Tracker</span></div></div>
        <div style="padding:0 0 8px;overflow-y:auto;flex:1">
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:12px">Federal Reserve</span>
              <span style="font-family:var(--mono);font-size:12px;color:var(--warn)">5.25-5.50%</span>
            </div>
            <div style="font-size:10px;color:var(--tx3)">Next meeting: Mar 18-19 · Cut prob 62%</div>
            <div style="height:4px;background:var(--bg2);border-radius:2px;margin-top:5px;overflow:hidden">
              <div style="width:62%;height:100%;background:var(--up);border-radius:2px"></div>
            </div>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:12px">ECB</span>
              <span style="font-family:var(--mono);font-size:12px;color:var(--up)">3.50%</span>
            </div>
            <div style="font-size:10px;color:var(--tx3)">Cut 25bps Mar 6 · Dovish guidance</div>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:12px">Bank of Japan</span>
              <span style="font-family:var(--mono);font-size:12px;color:var(--warn)">0.10%</span>
            </div>
            <div style="font-size:10px;color:var(--tx3)">Hawkish pivot risk · YCC adjusted</div>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:12px">Bank of England</span>
              <span style="font-family:var(--mono);font-size:12px;color:var(--warn)">5.25%</span>
            </div>
            <div style="font-size:10px;color:var(--tx3)">Hold expected · Inflation 4.2%</div>
          </div>
        </div>
        <div class="ph"><div class="ph-title"><span>FX Vol Surface</span></div></div>
        <canvas id="fx-vol" style="height:130px;width:100%"></canvas>
      </div>
    </div>
  </div>`);

  // ── COMMODITIES ─────────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-commodities">
    <div class="kpi-strip">
      <div class="kpi-item"><div class="kpi-label">WTI Crude</div><div class="kpi-val dn">$74.80</div><div class="kpi-sub dn">-1.20 (-1.58%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Brent Crude</div><div class="kpi-val dn">$79.20</div><div class="kpi-sub dn">-1.04 (-1.30%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Natural Gas</div><div class="kpi-val">$2.48</div><div class="kpi-sub up">+0.08 (+3.34%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Gold</div><div class="kpi-val up">$2,842</div><div class="kpi-sub up">+12.4 (+0.44%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Silver</div><div class="kpi-val up">$32.84</div><div class="kpi-sub up">+0.42 (+1.29%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Copper</div><div class="kpi-val">$4.24</div><div class="kpi-sub dn">-0.02 (-0.47%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Corn</div><div class="kpi-val">$4.82</div><div class="kpi-sub">bu</div></div>
    </div>
    <div class="cmdt-layout">
      <div style="display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">WTI CRUDE FUTURES CURVE (CONTANGO/BACKWARDATION)</div>
        <canvas id="cmdt-curve" style="height:180px;width:100%"></canvas>
        <div style="border-top:1px solid var(--bdr);padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3)">COMMODITY TRACKER</div>
        <div class="tbl-wrap">
          <table><thead><tr><th>Commodity</th><th>Price</th><th>1D</th><th>1W</th><th>1M</th><th>YTD</th><th>1Y High</th><th>1Y Low</th><th>Open Int</th></tr></thead>
          <tbody id="cmdt-tbody"></tbody></table>
        </div>
      </div>
      <div class="cmdt-right">
        <div class="ph"><div class="ph-title"><span>Seasonality (WTI)</span></div></div>
        <canvas id="cmdt-season" style="height:120px;width:100%"></canvas>
        <div class="ph"><div class="ph-title"><span>Spread Analysis</span></div></div>
        <div style="padding:8px 12px;overflow-y:auto;flex:1">
          <div class="fund-row"><span class="fund-lbl">CL1-CL2 (Roll)</span><span class="fund-val dn">-0.42</span></div>
          <div class="fund-row"><span class="fund-lbl">Brent-WTI</span><span class="fund-val">+4.40</span></div>
          <div class="fund-row"><span class="fund-lbl">Crack Spread</span><span class="fund-val warn">$22.84</span></div>
          <div class="fund-row"><span class="fund-lbl">Spark Spread</span><span class="fund-val">$8.42</span></div>
          <div class="fund-row"><span class="fund-lbl">Crush Spread</span><span class="fund-val">$1.82</span></div>
          <div class="fund-row"><span class="fund-lbl">Gold/Silver Ratio</span><span class="fund-val">86.5</span></div>
          <div class="fund-row"><span class="fund-lbl">Gold/Copper</span><span class="fund-val warn">670</span></div>
          <div style="margin-top:10px">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-bottom:6px">EIA INVENTORY</div>
            <div class="fund-row"><span class="fund-lbl">Crude (Mb)</span><span class="fund-val dn">-2.4M</span></div>
            <div class="fund-row"><span class="fund-lbl">Gasoline (Mb)</span><span class="fund-val up">+1.2M</span></div>
            <div class="fund-row"><span class="fund-lbl">Distillates</span><span class="fund-val dn">-0.8M</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // ── CRYPTO ──────────────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-crypto">
    <div class="kpi-strip">
      <div class="kpi-item"><div class="kpi-label">BTC/USD</div><div class="kpi-val up">$98,420</div><div class="kpi-sub up">+$1,240 (+1.28%)</div></div>
      <div class="kpi-item"><div class="kpi-label">ETH/USD</div><div class="kpi-val up">$3,420</div><div class="kpi-sub up">+$96.8 (+2.84%)</div></div>
      <div class="kpi-item"><div class="kpi-label">Total Market Cap</div><div class="kpi-val">$3.84T</div><div class="kpi-sub up">+1.84%</div></div>
      <div class="kpi-item"><div class="kpi-label">BTC Dominance</div><div class="kpi-val">52.4%</div><div class="kpi-sub dn">-0.2%</div></div>
      <div class="kpi-item"><div class="kpi-label">Crypto Fear Index</div><div class="kpi-val up">78</div><div class="kpi-sub" style="color:var(--up)">GREED</div></div>
      <div class="kpi-item"><div class="kpi-label">BTC Funding Rate</div><div class="kpi-val warn">0.0082%</div><div class="kpi-sub">8hr rate</div></div>
    </div>
    <div class="crypto-layout">
      <div style="display:flex;flex-direction:column;overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--bdr);height:160px">
          <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column">
            <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">ON-CHAIN: EXCHANGE FLOWS (BTC)</div>
            <canvas id="onchain-flows" style="flex:1;min-height:0;width:100%"></canvas>
          </div>
          <div style="display:flex;flex-direction:column">
            <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">LIQUIDATIONS (24H)</div>
            <canvas id="liquidations" style="flex:1;min-height:0;width:100%"></canvas>
          </div>
        </div>
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">CRYPTO MARKET</div>
        <div class="tbl-wrap">
          <table><thead><tr><th>Asset</th><th>Price</th><th>24H%</th><th>7D%</th><th>Mkt Cap</th><th>Vol 24H</th><th>Funding</th><th>OI</th><th>Dominance</th></tr></thead>
          <tbody id="crypto-tbody"></tbody></table>
        </div>
      </div>
      <div class="crypto-right">
        <div class="ph"><div class="ph-title"><span>On-Chain Analytics</span></div></div>
        <div style="padding:8px 12px;overflow-y:auto">
          <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-bottom:6px">BITCOIN METRICS</div>
          <div class="fund-row"><span class="fund-lbl">Hash Rate</span><span class="fund-val">624 EH/s</span></div>
          <div class="fund-row"><span class="fund-lbl">Active Addresses</span><span class="fund-val up">824K</span></div>
          <div class="fund-row"><span class="fund-lbl">Exchange Inflow</span><span class="fund-val dn">18.4K BTC</span></div>
          <div class="fund-row"><span class="fund-lbl">Exchange Outflow</span><span class="fund-val up">22.1K BTC</span></div>
          <div class="fund-row"><span class="fund-lbl">Net Flow</span><span class="fund-val up">-3.7K BTC</span></div>
          <div class="fund-row"><span class="fund-lbl">SOPR</span><span class="fund-val">1.024</span></div>
          <div class="fund-row"><span class="fund-lbl">NUPL</span><span class="fund-val up">0.48</span></div>
          <div class="fund-row"><span class="fund-lbl">MVRV Z-Score</span><span class="fund-val">2.84</span></div>
          <div class="fund-row"><span class="fund-lbl">Puell Multiple</span><span class="fund-val">1.24</span></div>
          <div class="fund-row"><span class="fund-lbl">Realized Cap</span><span class="fund-val">$482B</span></div>
          <div style="margin-top:10px">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-bottom:6px">DEFI OVERVIEW</div>
            <div class="fund-row"><span class="fund-lbl">Total TVL</span><span class="fund-val">$112.4B</span></div>
            <div class="fund-row"><span class="fund-lbl">Uniswap TVL</span><span class="fund-val">$4.82B</span></div>
            <div class="fund-row"><span class="fund-lbl">Aave TVL</span><span class="fund-val">$12.4B</span></div>
            <div class="fund-row"><span class="fund-lbl">ETH Staking APY</span><span class="fund-val up">4.2%</span></div>
            <div class="fund-row"><span class="fund-lbl">Gas (Gwei)</span><span class="fund-val">24</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  // ── MARKET HEATMAP ───────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-heatmap">
    <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap">
      <span style="font-size:12px;font-weight:600">Market Heatmap</span>
      <div style="display:flex;gap:3px">
        <div class="filter-pill active" onclick="togglePill(this);renderHeatmap()" style="border-radius:3px">S&amp;P 500</div>
        <div class="filter-pill" onclick="togglePill(this);renderHeatmap()" style="border-radius:3px">Nasdaq</div>
        <div class="filter-pill" onclick="togglePill(this);renderHeatmap()" style="border-radius:3px">Global</div>
        <div class="filter-pill" onclick="togglePill(this);renderHeatmap()" style="border-radius:3px">Crypto</div>
      </div>
      <div style="display:flex;gap:3px;margin-left:8px">
        <div class="filter-pill active" onclick="togglePill(this)" style="border-radius:3px">1D%</div>
        <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">1W%</div>
        <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">1M%</div>
        <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">YTD</div>
      </div>
      <span style="margin-left:auto;font-size:10px;color:var(--tx3)">Size = Market Cap · Color = Performance</span>
    </div>
    <div style="flex:1;overflow:hidden;position:relative">
      <canvas id="heatmap-canvas" style="width:100%;height:100%;display:block"></canvas>
    </div>
    <div style="border-top:1px solid var(--bdr);padding:5px 12px;display:flex;gap:16px;align-items:center;flex-shrink:0;font-size:10px">
      <div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:10px;border-radius:2px;background:rgba(242,54,69,.9)"></div><span style="color:var(--dn)">-5%+</span></div>
      <div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:10px;border-radius:2px;background:rgba(242,54,69,.5)"></div><span style="color:var(--tx3)">-2 to -5%</span></div>
      <div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:10px;border-radius:2px;background:rgba(42,46,57,.9)"></div><span style="color:var(--tx3)">-2 to +2%</span></div>
      <div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:10px;border-radius:2px;background:rgba(8,153,129,.5)"></div><span style="color:var(--tx3)">+2 to +5%</span></div>
      <div style="display:flex;gap:3px;align-items:center"><div style="width:12px;height:10px;border-radius:2px;background:rgba(8,153,129,.9)"></div><span style="color:var(--up)">+5%+</span></div>
      <span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--up)">S&amp;P 500: +0.41% · 321 advancing · 179 declining</span>
    </div>
  </div>`);

  // ── SOCIAL / IDEAS ───────────────────────────────────────────
  content.insertAdjacentHTML('beforeend', `
  <div class="view" id="view-social">
    <div class="social-layout">
      <div class="social-panel s-l">
        <div class="ph"><div class="ph-title"><span>Popular Ideas</span></div></div>
        <div style="overflow-y:auto;flex:1">
          <div class="idea-card" onclick="showToast('Idea','Opening AAPL bullish idea','info')">
            <div class="idea-hdr">
              <div class="avatar" style="width:20px;height:20px;font-size:8px">JD</div>
              <span class="idea-author">john_dow</span>
              <span class="idea-sym">AAPL</span>
              <span class="idea-dir bull">BULL</span>
              <span style="margin-left:auto;font-size:10px;color:var(--tx3)">2h ago</span>
            </div>
            <div class="idea-body">Inverse H&S forming on daily. Neckline break at $185 targets $210. RSI divergence confirms. Strong earnings catalyst.</div>
            <div class="idea-meta"><span>▲ 284</span><span>💬 42</span><span>🔗 Share</span></div>
          </div>
          <div class="idea-card" onclick="showToast('Idea','Opening TSLA bearish idea','info')">
            <div class="idea-hdr">
              <div class="avatar" style="width:20px;height:20px;font-size:8px">MK</div>
              <span class="idea-author">market_king</span>
              <span class="idea-sym">TSLA</span>
              <span class="idea-dir bear">BEAR</span>
              <span style="margin-left:auto;font-size:10px;color:var(--tx3)">4h ago</span>
            </div>
            <div class="idea-body">Death cross forming. Volume declining on up moves. Support at $200 likely to break. Target $185.</div>
            <div class="idea-meta"><span>▲ 148</span><span>💬 67</span><span>🔗 Share</span></div>
          </div>
          <div class="idea-card" onclick="showToast('Idea','Opening SPY idea','info')">
            <div class="idea-hdr">
              <div class="avatar" style="width:20px;height:20px;font-size:8px">AR</div>
              <span class="idea-author">apex_rider</span>
              <span class="idea-sym">SPY</span>
              <span class="idea-dir bull">BULL</span>
              <span style="margin-left:auto;font-size:10px;color:var(--tx3)">6h ago</span>
            </div>
            <div class="idea-body">Market breadth expanding. 80% of SPX above 200D MA. Seasonality strongly bullish March-April. Long calls.</div>
            <div class="idea-meta"><span>▲ 412</span><span>💬 88</span><span>🔗 Share</span></div>
          </div>
          <div class="idea-card">
            <div class="idea-hdr">
              <div class="avatar" style="width:20px;height:20px;font-size:8px">TF</div>
              <span class="idea-author">tech_flow</span>
              <span class="idea-sym">NVDA</span>
              <span class="idea-dir bull">BULL</span>
              <span style="margin-left:auto;font-size:10px;color:var(--tx3)">8h ago</span>
            </div>
            <div class="idea-body">Post-earnings consolidation setting up. Flag pattern target $1,100. AI demand cycle far from peak.</div>
            <div class="idea-meta"><span>▲ 521</span><span>💬 124</span><span>🔗 Share</span></div>
          </div>
        </div>
      </div>
      <div class="social-panel" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="ph"><div class="ph-title"><span>Publish Idea</span></div></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:7px;flex-shrink:0">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <div class="field"><label>Symbol</label><input placeholder="AAPL"></div>
            <div class="field"><label>Direction</label><select><option>Bullish</option><option>Bearish</option><option>Neutral</option></select></div>
            <div class="field"><label>Timeframe</label><select><option>Short (1-7d)</option><option>Medium (1-4w)</option><option>Long (1-6m)</option></select></div>
          </div>
          <div class="field"><label>Title</label><input placeholder="Idea title..."></div>
          <div class="field"><label>Analysis</label><textarea style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:7px 10px;font-size:12px;color:var(--tx);outline:none;resize:none;height:80px;transition:border-color .15s" placeholder="Write your analysis..." onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='var(--bdr)'"></textarea></div>
          <div style="display:flex;gap:6px">
            <button class="btn-pri" onclick="showToast('Published','Trading idea published!','success')">Publish Idea</button>
            <button class="btn-g" onclick="showToast('Saved','Idea saved as draft','info')">Save Draft</button>
          </div>
        </div>
        <div style="height:1px;background:var(--bdr)"></div>
        <div class="ph"><div class="ph-title"><span>Feed</span></div></div>
        <div style="overflow-y:auto;flex:1" id="social-feed"></div>
      </div>
      <div class="social-panel s-r">
        <div class="ph"><div class="ph-title"><span>Top Contributors</span></div></div>
        <div style="overflow-y:auto">
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px">
            <div class="avatar" style="width:28px;height:28px;font-size:11px">JD</div>
            <div style="flex:1"><div style="font-size:12px;font-weight:600">john_dow</div><div style="font-size:10px;color:var(--tx3)">48.2K followers</div></div>
            <button class="btn-sm neutral">Follow</button>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px">
            <div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(135deg,#089981,#06B6D4)">AR</div>
            <div style="flex:1"><div style="font-size:12px;font-weight:600">apex_rider</div><div style="font-size:10px;color:var(--tx3)">31.4K followers</div></div>
            <button class="btn-sm neutral">Follow</button>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px">
            <div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(135deg,#F7931A,#F23645)">TF</div>
            <div style="flex:1"><div style="font-size:12px;font-weight:600">tech_flow</div><div style="font-size:10px;color:var(--tx3)">24.8K followers</div></div>
            <button class="btn-sm neutral">Follow</button>
          </div>
        </div>
        <div class="ph"><div class="ph-title"><span>Trending</span></div></div>
        <div style="padding:8px 12px">
          <div style="display:flex;flex-direction:column;gap:5px" id="trending-tags"></div>
        </div>
      </div>
    </div>
  </div>`);

  initFXMatrix();
  initCommodities();
  initCrypto();
  renderHeatmapCanvas();
  initSocialFeed();
  initFICharts();
  window.addEventListener('resize', () => {
    const vm = document.getElementById('view-heatmap');
    if (vm && vm.classList.contains('active')) renderHeatmapCanvas();
  });
}

// ── YC Tab switching ─────────────────────────────────────────
function switchYCTab(el, id) {
  document.querySelectorAll('.yc-tab').forEach(t=>t.classList.remove('active'));
  ['yc-curve','yc-bonds','yc-analytics','yc-credit'].forEach(i=>{ const e=document.getElementById(i); if(e){e.style.display='none'; e.classList.remove('active');} });
  el.classList.add('active');
  const t = document.getElementById(id);
  if (t) { t.style.display='flex'; t.classList.add('active'); }
  if (id==='yc-curve') { setTimeout(()=>{ initYieldCurve(); }, 30); }
  if (id==='yc-credit') { setTimeout(()=>{ initCreditSpreads(); }, 30); }
}

// ── Fixed Income Charts ──────────────────────────────────────
function initFICharts() { setTimeout(initYieldCurve, 100); }
function initYieldCurve() {
  const c = document.getElementById('yc-canvas');
  if (!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||200;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const tenors=[1/12,3/12,6/12,1,2,3,5,7,10,20,30];
  const labels=['1M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
  const today=[5.28,5.24,5.18,5.00,4.71,4.58,4.42,4.38,4.28,4.48,4.52];
  const yago=[4.82,4.88,4.94,4.80,4.42,4.22,4.01,4.04,3.96,4.12,4.18];
  const fiveago=[1.42,1.52,1.64,1.88,2.14,2.28,2.42,2.58,2.72,2.92,3.02];
  const mL=30, mR=20, mT=15, mB=25;
  const dW=W-mL-mR, dH=H-mT-mB;
  const allVals=[...today,...yago,...fiveago];
  const mn=Math.min(...allVals)-0.2, mx=Math.max(...allVals)+0.2;
  const scX=i=>mL+i*(dW/(labels.length-1));
  const scY=v=>mT+dH-((v-mn)/(mx-mn))*dH;
  // grid
  [3,3.5,4,4.5,5,5.5].forEach(v=>{
    const y=scY(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke();
    ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText(v.toFixed(1)+'%', mL-3, y+3);
  });
  // lines
  function drawYC(data, color, dash=[]) {
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.setLineDash(dash);
    data.forEach((v,i)=>{ i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  drawYC(fiveago,'rgba(247,147,26,0.5)',[3,3]);
  drawYC(yago,'rgba(41,98,255,0.5)',[3,3]);
  drawYC(today,'#2962FF');
  // dots + labels
  today.forEach((v,i)=>{ ctx.fillStyle='#2962FF'; ctx.beginPath(); ctx.arc(scX(i),scY(v),2.5,0,Math.PI*2); ctx.fill(); });
  labels.forEach((l,i)=>{ ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='center'; ctx.fillText(l,scX(i),H-5); });
  // 2s10s spread label
  const spread = today[8]-today[4];
  ctx.fillStyle=spread<0?'#F23645':'#089981'; ctx.font='bold 10px JetBrains Mono'; ctx.textAlign='left';
  ctx.fillText(`2s10s: ${spread>0?'+':''}${(spread*100).toFixed(0)}bps`, mL+5, mT+12);
}

function initCreditSpreads() {
  const c = document.getElementById('credit-spread-canvas');
  if (!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||200;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const points=60;
  ctx.beginPath(); ctx.strokeStyle='#089981'; ctx.lineWidth=1.5;
  for(let i=0;i<points;i++){ const v=80+Math.sin(i/8)*12+(Math.random()-0.5)*5; const x=i*(W/points), y=H-20-((v-40)/200)*(H-30); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle='#F23645'; ctx.lineWidth=1.5;
  for(let i=0;i<points;i++){ const v=300+Math.sin(i/6)*40+(Math.random()-0.5)*20; const x=i*(W/points), y=H-20-((v-40)/600)*(H-30); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.stroke();
  ctx.fillStyle='#089981'; ctx.font='9px Inter'; ctx.textAlign='left'; ctx.fillText('IG OAS: 84bps',6,14);
  ctx.fillStyle='#F23645'; ctx.fillText('HY OAS: 312bps',6,26);
}

// ── FX Matrix ────────────────────────────────────────────────
function initFXMatrix() {
  const el = document.getElementById('fx-matrix');
  if (!el) return;
  const curs=['USD','EUR','GBP','JPY','CHF','AUD','CAD','CNH'];
  const rates={
    'USD':{'USD':1,'EUR':0.9220,'GBP':0.7910,'JPY':149.82,'CHF':0.8942,'AUD':1.5482,'CAD':1.3520,'CNH':7.2420},
    'EUR':{'USD':1.0842,'EUR':1,'GBP':0.8580,'JPY':162.40,'CHF':0.9698,'AUD':1.6782,'CAD':1.4660,'CNH':7.8480},
    'GBP':{'USD':1.2641,'EUR':1.1654,'GBP':1,'JPY':189.40,'CHF':1.1298,'AUD':1.9572,'CAD':1.7088,'CNH':9.1488},
    'JPY':{'USD':0.00668,'EUR':0.00616,'GBP':0.00528,'JPY':1,'CHF':0.00597,'AUD':0.01033,'CAD':0.00902,'CNH':0.04834},
    'CHF':{'USD':1.1184,'EUR':1.0312,'GBP':0.8852,'JPY':167.56,'CHF':1,'AUD':1.7314,'CAD':1.5122,'CNH':8.1020},
    'AUD':{'USD':0.6459,'EUR':0.5958,'GBP':0.5110,'JPY':96.78,'CHF':0.5778,'AUD':1,'CAD':0.8733,'CNH':4.6792},
    'CAD':{'USD':0.7396,'EUR':0.6820,'GBP':0.5852,'JPY':110.82,'CHF':0.6614,'AUD':1.1451,'CAD':1,'CNH':5.3560},
    'CNH':{'USD':0.1381,'EUR':0.1274,'GBP':0.1093,'JPY':20.692,'CHF':0.1234,'AUD':0.2137,'CAD':0.1867,'CNH':1},
  };
  let html='<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:4px 8px;background:var(--bg2);font-size:10px;color:var(--tx3);text-align:left;border-bottom:1px solid var(--bdr);position:sticky;top:0;z-index:2;font-weight:600"></th>';
  curs.forEach(c=>{ html+=`<th class="cross-hdr">${c}</th>`; });
  html+='</tr></thead><tbody>';
  curs.forEach(from=>{
    html+=`<tr><td style="padding:5px 10px;font-size:11px;font-weight:700;color:var(--tx);background:var(--bg2);border-bottom:1px solid var(--bdr);border-right:1px solid var(--bdr);position:sticky;left:0;z-index:1">${from}</td>`;
    curs.forEach(to=>{
      const v=rates[from]?.[to]||1;
      const isDiag=from===to;
      const chg=(Math.random()-0.48)*0.8;
      html+=`<td class="cross-cell ${isDiag?'diagonal':chg>0?'up':'dn'}" onclick="showToast('FX','${from}/${to}: ${v.toFixed(4)}','info')">${isDiag?'—':v>10?v.toFixed(2):v>1?v.toFixed(4):v.toFixed(6)}</td>`;
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  el.innerHTML=html;

  // Forward table
  const fwdEl=document.getElementById('fwd-tbody');
  if(fwdEl){
    const pairs=[
      ['EUR/USD',1.0842,2.4,8.2,21.4,38.8,72.4,0.8],
      ['USD/JPY',149.82,-12.4,-38.2,-84.2,-148.8,-248.4,-3.2],
      ['GBP/USD',1.2641,1.8,6.2,16.4,29.8,54.2,0.4],
      ['USD/CHF',0.8942,-3.2,-9.8,-22.4,-38.2,-62.8,-1.8],
      ['AUD/USD',0.6459,0.4,1.2,2.8,4.2,6.8,2.4],
    ];
    fwdEl.innerHTML=pairs.map(p=>`<tr>
      <td><div class="td-sym">${p[0]}</div></td>
      <td class="td-mono">${p[1]}</td>
      <td class="td-mono" style="color:${p[2]>=0?'var(--up)':'var(--dn)'}">${p[2]>0?'+':''}${p[2]}</td>
      <td class="td-mono" style="color:${p[3]>=0?'var(--up)':'var(--dn)'}">${p[3]>0?'+':''}${p[3]}</td>
      <td class="td-mono" style="color:${p[4]>=0?'var(--up)':'var(--dn)'}">${p[4]>0?'+':''}${p[4]}</td>
      <td class="td-mono" style="color:${p[5]>=0?'var(--up)':'var(--dn)'}">${p[5]>0?'+':''}${p[5]}</td>
      <td class="td-mono" style="color:${p[6]>=0?'var(--up)':'var(--dn)'}">${p[6]>0?'+':''}${p[6]}</td>
      <td class="td-mono" style="color:${p[7]>=0?'var(--up)':'var(--dn)'}">${p[7]>0?'+':''}${p[7]}%</td>
    </tr>`).join('');
  }

  // FX vol canvas
  const fvc=document.getElementById('fx-vol');
  if(fvc){
    fvc.width=fvc.parentElement.clientWidth; fvc.height=130;
    const ctx=fvc.getContext('2d'), W=fvc.width, H=130;
    ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
    const tenors=['1W','1M','3M','6M','1Y'];
    const dels=['10D','25D','ATM','25D','10D'];
    const cellW=(W-50)/(dels.length), cellH=(H-20)/(tenors.length);
    dels.forEach((d,j)=>{ ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='center'; ctx.fillText(d,50+j*cellW+cellW/2,12); });
    tenors.forEach((t,i)=>{
      ctx.fillStyle='#787B86'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right'; ctx.fillText(t,46,20+i*cellH+cellH/2+3);
      dels.forEach((_,j)=>{
        const vol=8+Math.abs(j-2)*2.5+i*1.2+(Math.random()*1.5);
        const intensity=(vol-8)/20;
        ctx.fillStyle=`rgba(247,147,26,${0.1+intensity*0.7})`;
        ctx.fillRect(50+j*cellW+1,20+i*cellH+1,cellW-2,cellH-2);
        ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center';
        ctx.fillText(vol.toFixed(1)+'%',50+j*cellW+cellW/2,20+i*cellH+cellH/2+3);
      });
    });
  }
}

// ── Commodities ──────────────────────────────────────────────
function initCommodities() {
  const cmdt=[
    ['WTI Crude','$74.80','-1.58%','-2.14%','+4.82%','+8.24%','$88.40','$68.20','412,840'],
    ['Brent Crude','$79.20','-1.30%','-1.84%','+5.14%','+9.82%','$92.80','$71.40','228,420'],
    ['Natural Gas','$2.48','+3.34%','+8.20%','-12.48%','-18.42%','$3.84','$1.92','284,120'],
    ['Gold','$2,842','+0.44%','+2.84%','+6.42%','+24.82%','$2,920','$1,984','486,280'],
    ['Silver','$32.84','+1.29%','+4.82%','+8.24%','+32.48%','$34.80','$22.28','124,840'],
    ['Copper','$4.24','-0.47%','-1.24%','+2.84%','+12.48%','$4.64','$3.52','182,420'],
    ['Corn','$4.82/bu','-0.82%','+1.24%','-4.82%','-8.42%','$5.48','$4.12','682,240'],
    ['Wheat','$5.24/bu','+0.48%','+2.14%','-2.48%','-12.84%','$6.84','$4.82','284,120'],
    ['Soybeans','$12.40/bu','-0.24%','-0.82%','-1.84%','-8.24%','$14.82','$11.24','184,840'],
  ];
  const el=document.getElementById('cmdt-tbody');
  if(el) el.innerHTML=cmdt.map(c=>`<tr onclick="showToast('Commodity','${c[0]} selected','info')">
    <td><div class="td-sym">${c[0]}</div></td>
    <td class="td-mono">${c[1]}</td>
    <td class="${c[2].startsWith('-')?'td-dn':'td-up'}">${c[2]}</td>
    <td class="${c[3].startsWith('-')?'td-dn':'td-up'}">${c[3]}</td>
    <td class="${c[4].startsWith('-')?'td-dn':'td-up'}">${c[4]}</td>
    <td class="${c[5].startsWith('-')?'td-dn':'td-up'}">${c[5]}</td>
    <td class="td-mono">${c[6]}</td><td class="td-mono">${c[7]}</td><td class="td-mono">${c[8]}</td>
  </tr>`).join('');

  // Futures curve canvas
  const c=document.getElementById('cmdt-curve');
  if(c){
    c.width=c.parentElement.clientWidth; c.height=180;
    const ctx=c.getContext('2d'), W=c.width, H=180;
    ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
    const months=['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan\'26','Feb\'26'];
    const contango=[74.80,74.20,73.60,72.90,72.20,71.50,70.80,70.20,69.60,69.10,68.60,68.20];
    const mL=40, mR=10, mT=10, mB=20;
    const dW=W-mL-mR, dH=H-mT-mB;
    const mn=Math.min(...contango)-0.5, mx=Math.max(...contango)+0.5;
    const scX=i=>mL+i*(dW/(months.length-1));
    const scY=v=>mT+dH-((v-mn)/(mx-mn))*dH;
    [69,70,71,72,73,74,75].forEach(v=>{
      const y=scY(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke();
      ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right'; ctx.fillText('$'+v,mL-3,y+3);
    });
    ctx.beginPath(); ctx.strokeStyle='#F7931A'; ctx.lineWidth=2;
    contango.forEach((v,i)=>{ i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
    ctx.stroke();
    contango.forEach((v,i)=>{ ctx.fillStyle='#F7931A'; ctx.beginPath(); ctx.arc(scX(i),scY(v),2.5,0,Math.PI*2); ctx.fill(); });
    months.forEach((m,i)=>{ ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='center'; ctx.fillText(m,scX(i),H-4); });
    ctx.fillStyle='rgba(242,54,69,0.8)'; ctx.font='bold 9px JetBrains Mono'; ctx.textAlign='left'; ctx.fillText('BACKWARDATION',mL+5,mT+12);

    // Seasonality
    const sc=document.getElementById('cmdt-season');
    if(sc){
      sc.width=sc.parentElement.clientWidth; sc.height=120;
      const ctx2=sc.getContext('2d'), W2=sc.width, H2=120;
      ctx2.fillStyle='#131722'; ctx2.fillRect(0,0,W2,H2);
      const seas=[2.4,-3.2,-1.8,1.2,4.8,3.2,-2.4,-4.8,-2.1,1.4,2.8,1.2];
      const monLabels=['J','F','M','A','M','J','J','A','S','O','N','D'];
      const bW=(W2-20)/(seas.length), bH_max=45;
      ctx2.fillStyle='#5D606B'; ctx2.font='8px Inter'; ctx2.textAlign='center';
      monLabels.forEach((m,i)=>ctx2.fillText(m,10+i*bW+bW/2,H2-4));
      seas.forEach((v,i)=>{
        const bH=Math.abs(v)/5*bH_max;
        ctx2.fillStyle=v>0?'rgba(8,153,129,0.7)':'rgba(242,54,69,0.7)';
        const y=v>0?H2-20-bH:H2-20;
        ctx2.fillRect(10+i*bW+2,y,bW-4,v>0?bH:-bH);
        ctx2.fillStyle=v>0?'#089981':'#F23645'; ctx2.font='7px JetBrains Mono'; ctx2.textAlign='center';
        ctx2.fillText((v>0?'+':'')+v.toFixed(1),10+i*bW+bW/2,v>0?H2-22-bH:H2-20+Math.abs(bH)+8);
      });
    }
  }
}

// ── Crypto ───────────────────────────────────────────────────
function initCrypto() {
  const assets=[
    ['BTC','Bitcoin','$98,420','+1.28%','+8.42%','$1.94T','$48.4B','0.0082%','$28.4B','52.4%'],
    ['ETH','Ethereum','$3,420','+2.84%','+12.48%','$410B','$24.2B','0.0042%','$12.8B','10.7%'],
    ['SOL','Solana','$142.80','+4.82%','+18.42%','$62.4B','$8.4B','0.0124%','$4.2B','1.6%'],
    ['BNB','BNB Chain','$412.40','+0.84%','+2.48%','$60.8B','$2.4B','0.0018%','$1.4B','1.6%'],
    ['XRP','Ripple','$0.624','-1.24%','-4.82%','$34.8B','$4.8B','N/A','N/A','0.9%'],
    ['AVAX','Avalanche','$38.40','+6.24%','+24.82%','$15.8B','$1.2B','0.0184%','$0.8B','0.4%'],
    ['LINK','Chainlink','$18.42','+3.84%','+14.24%','$10.8B','$0.6B','0.0084%','$0.4B','0.3%'],
    ['DOGE','Dogecoin','$0.184','+2.48%','+8.42%','$26.4B','$2.8B','N/A','N/A','0.7%'],
  ];
  const el=document.getElementById('crypto-tbody');
  if(el) el.innerHTML=assets.map(a=>`<tr onclick="setSymbol('${a[0]}')">
    <td><div class="td-sym">${a[0]}</div><div class="td-name">${a[1]}</div></td>
    <td class="td-mono">${a[2]}</td>
    <td class="${a[3].startsWith('+')?'td-up':'td-dn'}">${a[3]}</td>
    <td class="${a[4].startsWith('+')?'td-up':'td-dn'}">${a[4]}</td>
    <td class="td-mono">${a[5]}</td>
    <td class="td-mono">${a[6]}</td>
    <td class="td-mono" style="color:var(--warn)">${a[7]}</td>
    <td class="td-mono">${a[8]}</td>
    <td class="td-mono">${a[9]}</td>
  </tr>`).join('');

  // On-chain flows
  const c=document.getElementById('onchain-flows');
  if(c){
    c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||150;
    const ctx=c.getContext('2d'), W=c.width, H=c.height;
    ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
    const n=40;
    ctx.beginPath(); ctx.strokeStyle='#089981'; ctx.lineWidth=1.2;
    for(let i=0;i<n;i++){ const v=rand(-5,8); const x=i*(W/n), y=H/2-v*3; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    ctx.fillStyle='#089981'; ctx.font='8px Inter'; ctx.textAlign='left'; ctx.fillText('Net Outflow (Bullish)',5,12);
  }

  // Liquidations
  const lc=document.getElementById('liquidations');
  if(lc){
    lc.width=lc.parentElement.clientWidth; lc.height=lc.parentElement.clientHeight||150;
    const ctx=lc.getContext('2d'), W=lc.width, H=lc.height;
    ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
    const hours=24;
    for(let i=0;i<hours;i++){
      const longLiq=rand(0.5,8);
      const shortLiq=rand(0.5,5);
      const x=i*(W/hours), w=(W/hours)-2;
      ctx.fillStyle='rgba(242,54,69,0.7)'; ctx.fillRect(x,H/2-longLiq*4,w,longLiq*4);
      ctx.fillStyle='rgba(8,153,129,0.7)'; ctx.fillRect(x,H/2,w,shortLiq*4);
    }
    ctx.fillStyle='#F23645'; ctx.font='8px Inter'; ctx.textAlign='left'; ctx.fillText('Longs liquidated',5,12);
    ctx.fillStyle='#089981'; ctx.fillText('Shorts liquidated',5,H-5);
  }
}

// ── Heatmap Canvas ───────────────────────────────────────────
function renderHeatmapCanvas() {
  const c=document.getElementById('heatmap-canvas');
  if(!c) return;
  const wrap=c.parentElement;
  c.width=wrap.clientWidth; c.height=wrap.clientHeight;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);

  const sectors=[
    {name:'Technology',cap:28,syms:[
      {s:'AAPL',chg:1.21,cap:6},{s:'MSFT',chg:0.84,cap:7},{s:'NVDA',chg:5.82,cap:5},{s:'AMD',chg:4.14,cap:2},{s:'INTC',chg:-1.24,cap:1.5},{s:'ORCL',chg:1.48,cap:2},{s:'CRM',chg:0.82,cap:1.5},{s:'ADBE',chg:1.24,cap:1.2}]},
    {name:'Healthcare',cap:12,syms:[
      {s:'JNJ',chg:0.42,cap:2.4},{s:'UNH',chg:1.84,cap:2.8},{s:'PFE',chg:-0.84,cap:1.8},{s:'MRK',chg:0.64,cap:2.2},{s:'ABBV',chg:0.48,cap:1.4}]},
    {name:'Financials',cap:14,syms:[
      {s:'JPM',chg:0.84,cap:3.2},{s:'BAC',chg:0.42,cap:2.4},{s:'GS',chg:1.24,cap:1.8},{s:'MS',chg:0.64,cap:1.6},{s:'BRK.B',chg:0.28,cap:3.8}]},
    {name:'Consumer',cap:10,syms:[
      {s:'AMZN',chg:1.84,cap:2.8},{s:'TSLA',chg:-3.21,cap:2.4},{s:'HD',chg:0.48,cap:1.4},{s:'NKE',chg:-0.84,cap:1.2}]},
    {name:'Comm Svcs',cap:8,syms:[
      {s:'GOOGL',chg:1.12,cap:2.4},{s:'META',chg:2.64,cap:2.8},{s:'NFLX',chg:2.12,cap:1.4},{s:'DIS',chg:-0.42,cap:1.2}]},
    {name:'Industrials',cap:9,syms:[
      {s:'BA',chg:-1.84,cap:1.4},{s:'CAT',chg:0.84,cap:1.8},{s:'HON',chg:0.42,cap:1.6},{s:'UPS',chg:0.24,cap:1.4}]},
    {name:'Energy',cap:5,syms:[
      {s:'XOM',chg:-0.84,cap:2.4},{s:'CVX',chg:-0.64,cap:1.8}]},
    {name:'Utilities',cap:3,syms:[
      {s:'NEE',chg:0.48,cap:1.4},{s:'DUK',chg:0.24,cap:1.0}]},
  ];

  const totalCap=sectors.reduce((a,s)=>a+s.cap,0);
  let x=2;
  sectors.forEach(sec=>{
    const secW=Math.floor((sec.cap/totalCap)*(W-4));
    // sector header
    ctx.fillStyle='rgba(42,46,57,0.8)'; ctx.fillRect(x,2,secW-2,16);
    ctx.fillStyle='#787B86'; ctx.font='bold 8px Inter'; ctx.textAlign='center';
    ctx.fillText(sec.name, x+secW/2, 13);
    // arrange symbols in grid within sector
    const symCap=sec.syms.reduce((a,s)=>a+s.cap,0);
    const cellH=(H-22)/1;
    let sy=20;
    const cols=sec.syms.length<=4?1:2;
    const rows=Math.ceil(sec.syms.length/cols);
    const cellW2=Math.floor(secW/cols);
    const cellH2=Math.floor((H-22)/rows);
    sec.syms.forEach((sym,i)=>{
      const col=i%cols, row=Math.floor(i/cols);
      const cx=x+col*cellW2, cy=sy+row*cellH2;
      const w=cellW2-2, h=cellH2-2;
      const chg=sym.chg;
      let bg;
      if(chg>4) bg='rgba(8,153,129,0.9)';
      else if(chg>2) bg='rgba(8,153,129,0.65)';
      else if(chg>0.5) bg='rgba(8,153,129,0.4)';
      else if(chg>-0.5) bg='rgba(42,46,57,0.8)';
      else if(chg>-2) bg='rgba(242,54,69,0.4)';
      else if(chg>-4) bg='rgba(242,54,69,0.65)';
      else bg='rgba(242,54,69,0.9)';
      ctx.fillStyle=bg; ctx.fillRect(cx+1,cy+1,w,h);
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1; ctx.strokeRect(cx+1,cy+1,w,h);
      if(h>20){
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font=`bold ${Math.min(12,h/3)}px Inter`; ctx.textAlign='center';
        ctx.fillText(sym.s,cx+cellW2/2,cy+h/2+2);
        if(h>30){
          ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font=`${Math.min(9,h/4)}px JetBrains Mono`;
          ctx.fillText((chg>0?'+':'')+chg.toFixed(2)+'%',cx+cellW2/2,cy+h/2+14);
        }
      }
    });
    x+=secW;
  });
}
function renderHeatmap() { renderHeatmapCanvas(); }

// ── Social Feed ──────────────────────────────────────────────
function initSocialFeed() {
  const el=document.getElementById('social-feed');
  if(el) el.innerHTML=[
    {u:'john_dow',s:'AAPL',t:'EMA crossover confirmed. Adding at $182.',ago:'3m'},
    {u:'apex_rider',s:'SPY',t:'VIX dropping fast. Risk-on signal. Bullish.',ago:'8m'},
    {u:'tech_flow',s:'NVDA',t:'Post-earnings flag targeting $1,100.',ago:'15m'},
    {u:'market_king',s:'BTC',t:'Above 100K psychological level incoming.',ago:'22m'},
  ].map(p=>`<div style="padding:7px 12px;border-bottom:1px solid var(--bdr)">
    <div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">
      <div class="avatar" style="width:18px;height:18px;font-size:8px">${p.u[0].toUpperCase()}</div>
      <span style="font-size:11px;font-weight:600">${p.u}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--brand)">${p.s}</span>
      <span style="font-size:10px;color:var(--tx3);margin-left:auto">${p.ago} ago</span>
    </div>
    <div style="font-size:11px;color:var(--tx2)">${p.t}</div>
  </div>`).join('');

  const te=document.getElementById('trending-tags');
  if(te) te.innerHTML=['#NVIDIA','#FedPivot','#TechRally','#Bitcoin100k','#EarningsSeason','#SPY500'].map((t,i)=>`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:11px;color:var(--brand)">${t}</span><span style="font-family:var(--mono);font-size:10px;color:var(--tx3)">${[8420,6240,4820,3840,2940,2120][i].toLocaleString()}</span></div>`).join('');
}

// ── Enhanced switchView for new views ──────────────────────
const origSwitchView = window.switchView;
window.switchView = function(v) {
  origSwitchView(v);
  if (v==='fixedincome') setTimeout(initYieldCurve, 80);
  else if (v==='fx') setTimeout(()=>{ const c=document.getElementById('fx-vol'); if(c && !c.width){ initFXMatrix(); }}, 80);
  else if (v==='commodities') setTimeout(initCommodities, 80);
  else if (v==='crypto') setTimeout(initCrypto, 80);
  else if (v==='heatmap') setTimeout(renderHeatmapCanvas, 80);
  else if (v==='social') { }
};

document.addEventListener('DOMContentLoaded', () => {
  injectViews();
});
</script>
"""

f.write(new_views_js)
f.close()
print("Part 10 done (new views)")
