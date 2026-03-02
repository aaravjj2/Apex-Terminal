
# p11: Level 2, T&S, Options enhancements, Portfolio Efficient Frontier, chart toolbar enhancements
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')

js = r"""
<script>
// ============================================================
// LEVEL 2 ORDER BOOK
// ============================================================
let l2Interval = null;
function initLevel2() {
  renderLevel2();
  if (!l2Interval) l2Interval = setInterval(renderLevel2, 600);
}
function renderLevel2() {
  const sc = document.getElementById('sc-depth');
  if (!sc || !sc.classList.contains('active')) return;
  const sym = currentSym || 'AAPL';
  const last = (window.chartBars||[{c:182.43}]);
  const price = last[last.length-1]?.c || 182.43;
  document.getElementById('l2-sym') && (document.getElementById('l2-sym').textContent = sym);
  document.getElementById('l2-price') && (document.getElementById('l2-price').textContent = '$'+price.toFixed(2));

  const spread = price * 0.00005;
  const bids = [];
  const asks = [];
  for (let i=0; i<14; i++) {
    const bp = price - spread/2 - i*spread*0.8 - (Math.random()*0.02);
    const bs = Math.floor(rand(100,4000));
    bids.push({p:bp, s:bs, t: bids.reduce((a,x)=>a+x.s, 0)+bs});
  }
  for (let i=0; i<14; i++) {
    const ap = price + spread/2 + i*spread*0.8 + (Math.random()*0.02);
    const as2 = Math.floor(rand(100,3500));
    asks.push({p:ap, s:as2, t: asks.reduce((a,x)=>a+x.s, 0)+as2});
  }
  const maxBidT = bids[bids.length-1].t;
  const maxAskT = asks[asks.length-1].t;

  const bidEl = document.getElementById('l2-bids');
  const askEl = document.getElementById('l2-asks');
  if (bidEl) bidEl.innerHTML = bids.map(b => {
    const pct = (b.t/maxBidT)*100;
    return `<div class="depth-row">
      <div class="depth-bar bid" style="width:${pct}%"></div>
      <span class="depth-size">${b.s.toLocaleString()}</span>
      <span class="depth-price bid">$${b.p.toFixed(2)}</span>
      <span class="depth-total">${(b.t/1000).toFixed(1)}K</span>
    </div>`;
  }).join('');
  if (askEl) askEl.innerHTML = asks.map(a => {
    const pct = (a.t/maxAskT)*100;
    return `<div class="depth-row">
      <div class="depth-bar ask" style="width:${pct}%"></div>
      <span class="depth-size">${a.s.toLocaleString()}</span>
      <span class="depth-price ask">$${a.p.toFixed(2)}</span>
      <span class="depth-total">${(a.t/1000).toFixed(1)}K</span>
    </div>`;
  }).join('');
}

// ============================================================
// TIME & SALES
// ============================================================
let tsFeed = [];
function initTimeAndSales() {
  if (tsFeed.length === 0) {
    const last = (window.chartBars||[{c:182.43}]);
    const p = last[last.length-1]?.c || 182.43;
    for (let i=0; i<40; i++) {
      const price = p + (Math.random()-0.48)*0.5;
      tsFeed.push({
        t: new Date(Date.now()-i*2400).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        p: price,
        s: Math.floor(rand(100,2000)),
        buy: Math.random()>0.48,
        exch: ['NASDAQ','NYSE','ARCA','BATS'][Math.floor(Math.random()*4)]
      });
    }
  }
  renderTsFeed();
  setInterval(()=>{
    const sc = document.getElementById('sc-ts');
    if (!sc || !sc.classList.contains('active')) return;
    const last = (window.chartBars||[{c:182.43}]);
    const p = last[last.length-1]?.c || 182.43;
    const newTrade = {
      t: new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      p: p + (Math.random()-0.48)*0.08,
      s: Math.floor(rand(100,1500)),
      buy: Math.random()>0.45,
      exch: ['NASDAQ','NYSE','ARCA','BATS'][Math.floor(Math.random()*4)]
    };
    tsFeed.unshift(newTrade);
    if (tsFeed.length > 60) tsFeed.pop();
    renderTsFeed();
  }, 450);
}
function renderTsFeed() {
  const el = document.getElementById('ts-feed');
  if (!el) return;
  el.innerHTML = tsFeed.map(t => `<div class="ts-row">
    <span class="ts-time">${t.t}</span>
    <span class="ts-price ${t.buy?'buy':'sell'}">$${t.p.toFixed(2)}</span>
    <span class="ts-size">${t.s.toLocaleString()}</span>
    <span class="ts-exch">${t.exch}</span>
  </div>`).join('');
}

// Override switchSidebarTab to handle L2 and T&S
const origSwitchSidebarTab = window.switchSidebarTab;
window.switchSidebarTab = function(el, tab) {
  origSwitchSidebarTab(el, tab);
  if (tab === 'depth') initLevel2();
  if (tab === 'ts') initTimeAndSales();
};

// ============================================================
// OPTIONS: ADD IV SURFACE + PAYOFF TABS
// ============================================================
function enhanceOptionsView() {
  const optView = document.getElementById('view-options');
  if (!optView || optView.dataset.enhanced) return;
  optView.dataset.enhanced = '1';

  // Add tab bar + tab content wrappers
  const optHeader = optView.querySelector('.opt-header');
  const chainDiv = optView.querySelector('.flex:not(.opt-header)') || optView.lastElementChild;

  // Insert tab bar after opt-header
  const tabBar = document.createElement('div');
  tabBar.className = 'opt-view-tabs';
  tabBar.innerHTML = `
    <div class="opt-vt active" onclick="switchOptTab(this,'opt-chain')">Options Chain</div>
    <div class="opt-vt" onclick="switchOptTab(this,'opt-surface')">IV Surface</div>
    <div class="opt-vt" onclick="switchOptTab(this,'opt-payoff')">Payoff Diagram</div>
    <div class="opt-vt" onclick="switchOptTab(this,'opt-scanner')">Scanner</div>
  `;
  optHeader.insertAdjacentElement('afterend', tabBar);

  // Wrap the chain in a tab content div
  const chainContent = document.createElement('div');
  chainContent.id = 'opt-chain';
  chainContent.className = 'opt-tab-content active';
  chainContent.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';

  const greekStrip = optView.querySelector('div[style*="gap:8px;padding:6px"]');
  const chainWrap = optView.querySelector('.flex:last-child') || optView.querySelector('[style*="overflow-y:auto"]');

  // Move existing content into chain tab
  [greekStrip, chainWrap].forEach(el => { if (el) chainContent.appendChild(el); });
  tabBar.insertAdjacentElement('afterend', chainContent);

  // IV Surface tab
  const surfaceContent = document.createElement('div');
  surfaceContent.id = 'opt-surface';
  surfaceContent.className = 'opt-tab-content';
  surfaceContent.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';
  surfaceContent.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden">
      <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">IV SURFACE (3D VIEW PROJECTION)</div>
        <canvas id="iv-surface-canvas" style="flex:1;min-height:0;width:100%"></canvas>
      </div>
      <div style="display:flex;flex-direction:column;overflow-y:auto">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">IV SMILE BY EXPIRY</div>
        <canvas id="iv-smile-canvas" style="height:160px;width:100%"></canvas>
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr);border-top:1px solid var(--bdr)">TERM STRUCTURE</div>
        <canvas id="iv-term-canvas" style="height:120px;width:100%"></canvas>
        <div style="padding:8px 12px;display:flex;flex-direction:column;gap:3px">
          <div class="fund-row"><span class="fund-lbl">IV Rank (30D)</span><span class="fund-val warn">34.2</span></div>
          <div class="fund-row"><span class="fund-lbl">IV Percentile</span><span class="fund-val">42nd</span></div>
          <div class="fund-row"><span class="fund-lbl">30D HV</span><span class="fund-val">24.1%</span></div>
          <div class="fund-row"><span class="fund-lbl">RV/IV Ratio</span><span class="fund-val">0.85</span></div>
          <div class="fund-row"><span class="fund-lbl">Skew (25D)</span><span class="fund-val dn">-3.2pts</span></div>
          <div class="fund-row"><span class="fund-lbl">Kurt</span><span class="fund-val">0.84</span></div>
        </div>
      </div>
    </div>`;
  chainContent.insertAdjacentElement('afterend', surfaceContent);

  // Payoff Diagram tab
  const payoffContent = document.createElement('div');
  payoffContent.id = 'opt-payoff';
  payoffContent.className = 'opt-tab-content';
  payoffContent.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';
  payoffContent.innerHTML = `
    <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap">
      <span style="font-size:11px;font-weight:600;color:var(--tx)">Strategy Builder</span>
      <div style="display:flex;gap:3px">
        <div class="exp-btn active" onclick="setStrategy(this,'bull-call')">Bull Call</div>
        <div class="exp-btn" onclick="setStrategy(this,'bear-put')">Bear Put</div>
        <div class="exp-btn" onclick="setStrategy(this,'straddle')">Straddle</div>
        <div class="exp-btn" onclick="setStrategy(this,'strangle')">Strangle</div>
        <div class="exp-btn" onclick="setStrategy(this,'iron-condor')">Iron Condor</div>
        <div class="exp-btn" onclick="setStrategy(this,'butterfly')">Butterfly</div>
        <div class="exp-btn" onclick="setStrategy(this,'collar')">Collar</div>
        <div class="exp-btn" onclick="setStrategy(this,'covered-call')">Covered Call</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 240px;flex:1;overflow:hidden">
      <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">P&L AT EXPIRY</div>
        <canvas id="payoff-canvas" style="flex:1;min-height:0;width:100%"></canvas>
      </div>
      <div style="overflow-y:auto;display:flex;flex-direction:column">
        <div class="ph"><div class="ph-title"><span>Position Greeks</span></div></div>
        <div style="padding:8px 12px">
          <div class="fund-row"><span class="fund-lbl">Net Delta</span><span class="fund-val">+0.42</span></div>
          <div class="fund-row"><span class="fund-lbl">Net Gamma</span><span class="fund-val">+0.018</span></div>
          <div class="fund-row"><span class="fund-lbl">Net Theta</span><span class="fund-val dn">-$48/day</span></div>
          <div class="fund-row"><span class="fund-lbl">Net Vega</span><span class="fund-val up">+$124/vol%</span></div>
          <div class="fund-row"><span class="fund-lbl">Net Rho</span><span class="fund-val">+$8.4</span></div>
          <div class="fund-row"><span class="fund-lbl">Max Profit</span><span class="fund-val up">$1,840</span></div>
          <div class="fund-row"><span class="fund-lbl">Max Loss</span><span class="fund-val dn">-$480</span></div>
          <div class="fund-row"><span class="fund-lbl">Break-Even</span><span class="fund-val">$185.20</span></div>
          <div class="fund-row"><span class="fund-lbl">Prob. Profit</span><span class="fund-val">62.4%</span></div>
          <div class="fund-row"><span class="fund-lbl">Cost</span><span class="fund-val dn">-$480</span></div>
        </div>
        <div class="ph"><div class="ph-title"><span>Legs</span></div></div>
        <div id="strategy-legs" style="padding:0 0 8px"></div>
        <div style="padding:8px 10px">
          <button class="btn-pri" style="width:100%;justify-content:center" onclick="showToast('Strategy','Bull Call Spread placed — AAPL 180/190C','success')">Place Trade</button>
        </div>
      </div>
    </div>`;
  surfaceContent.insertAdjacentElement('afterend', payoffContent);

  // Options Scanner tab
  const scanContent = document.createElement('div');
  scanContent.id = 'opt-scanner';
  scanContent.className = 'opt-tab-content';
  scanContent.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';
  scanContent.innerHTML = `
    <div style="padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
      <div class="filter-pill active" onclick="togglePill(this)" style="border-radius:3px">Unusual Activity</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">High IV</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">IV Crush</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">Earnings Plays</div>
      <div class="filter-pill" onclick="togglePill(this)" style="border-radius:3px">Large Sweeps</div>
    </div>
    <div class="tbl-wrap">
      <table><thead><tr><th>Time</th><th>Symbol</th><th>Exp</th><th>Strike</th><th>Type</th><th>Side</th><th>Size</th><th>Premium</th><th>IV</th><th>OI</th><th>Signal</th></tr></thead>
      <tbody>
        <tr onclick="showToast('Option Flow','NVDA large call sweep','info')"><td class="td-mono" style="color:var(--tx3)">09:32:14</td><td><div class="td-sym">NVDA</div></td><td class="td-mono">Jan 17</td><td class="td-mono">$950</td><td><span class="badge up">CALL</span></td><td><span class="badge up">BUY</span></td><td class="td-mono">2,400</td><td class="td-mono">$4.8M</td><td class="td-mono warn" style="color:var(--warn)">68%</td><td class="td-mono">18,420</td><td><span class="badge warn">SWEEP</span></td></tr>
        <tr onclick="showToast('Option Flow','TSLA large put purchase','info')"><td class="td-mono" style="color:var(--tx3)">09:28:42</td><td><div class="td-sym">TSLA</div></td><td class="td-mono">Feb 21</td><td class="td-mono">$200</td><td><span class="badge dn">PUT</span></td><td><span class="badge up">BUY</span></td><td class="td-mono">1,800</td><td class="td-mono">$2.4M</td><td class="td-mono warn" style="color:var(--warn)">84%</td><td class="td-mono">12,840</td><td><span class="badge dn">HEDGE</span></td></tr>
        <tr onclick="showToast('Option Flow','SPY golden sweep','info')"><td class="td-mono" style="color:var(--tx3)">09:24:18</td><td><div class="td-sym">SPY</div></td><td class="td-mono">Mar 21</td><td class="td-mono">$535</td><td><span class="badge up">CALL</span></td><td><span class="badge up">BUY</span></td><td class="td-mono">5,000</td><td class="td-mono">$8.2M</td><td class="td-mono warn" style="color:var(--warn)">22%</td><td class="td-mono">48,420</td><td><span class="badge info">GOLDEN</span></td></tr>
        <tr><td class="td-mono" style="color:var(--tx3)">09:18:04</td><td><div class="td-sym">AAPL</div></td><td class="td-mono">Jan 17</td><td class="td-mono">$190</td><td><span class="badge up">CALL</span></td><td><span class="badge up">BUY</span></td><td class="td-mono">1,200</td><td class="td-mono">$1.2M</td><td class="td-mono warn" style="color:var(--warn)">31%</td><td class="td-mono">8,240</td><td><span class="badge up">BULLISH</span></td></tr>
      </tbody></table>
    </div>`;
  payoffContent.insertAdjacentElement('afterend', scanContent);

  setTimeout(()=>{ renderIVSurface(); renderIVSmile(); renderIVTerm(); renderPayoff('bull-call'); renderStrategyLegs('bull-call'); }, 100);
}

function switchOptTab(el, id) {
  document.querySelectorAll('.opt-vt').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.opt-tab-content').forEach(t=>{t.classList.remove('active');t.style.display='none';});
  el.classList.add('active');
  const t=document.getElementById(id);
  if(t){t.classList.add('active');t.style.display='flex';}
  if(id==='opt-surface') setTimeout(()=>{ renderIVSurface(); renderIVSmile(); renderIVTerm(); },50);
  if(id==='opt-payoff') setTimeout(()=>renderPayoff('bull-call'),50);
}
function setStrategy(el,strat){
  document.querySelectorAll('#opt-payoff .exp-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderPayoff(strat);
  renderStrategyLegs(strat);
}
function renderStrategyLegs(strat) {
  const el=document.getElementById('strategy-legs');
  if(!el) return;
  const legs={
    'bull-call':[{type:'CALL',action:'BUY',strike:180,exp:'Jan 17',qty:1,prem:4.80},{type:'CALL',action:'SELL',strike:190,exp:'Jan 17',qty:1,prem:0.80}],
    'bear-put':[{type:'PUT',action:'BUY',strike:180,exp:'Jan 17',qty:1,prem:3.20},{type:'PUT',action:'SELL',strike:170,exp:'Jan 17',qty:1,prem:0.60}],
    'straddle':[{type:'CALL',action:'BUY',strike:182,exp:'Jan 17',qty:1,prem:4.80},{type:'PUT',action:'BUY',strike:182,exp:'Jan 17',qty:1,prem:4.40}],
    'strangle':[{type:'CALL',action:'BUY',strike:190,exp:'Jan 17',qty:1,prem:1.20},{type:'PUT',action:'BUY',strike:175,exp:'Jan 17',qty:1,prem:1.40}],
    'iron-condor':[{type:'PUT',action:'SELL',strike:175,exp:'Jan 17',qty:1,prem:1.40},{type:'PUT',action:'BUY',strike:170,exp:'Jan 17',qty:1,prem:0.60},{type:'CALL',action:'SELL',strike:190,exp:'Jan 17',qty:1,prem:1.20},{type:'CALL',action:'BUY',strike:195,exp:'Jan 17',qty:1,prem:0.40}],
    'butterfly':[{type:'CALL',action:'BUY',strike:175,exp:'Jan 17',qty:1,prem:8.20},{type:'CALL',action:'SELL',strike:182,exp:'Jan 17',qty:2,prem:4.80},{type:'CALL',action:'BUY',strike:190,exp:'Jan 17',qty:1,prem:1.20}],
    'collar':[{type:'CALL',action:'SELL',strike:190,exp:'Jan 17',qty:1,prem:1.20},{type:'PUT',action:'BUY',strike:175,exp:'Jan 17',qty:1,prem:1.40},{type:'Stock',action:'LONG',strike:182,exp:'—',qty:100,prem:0}],
    'covered-call':[{type:'Stock',action:'LONG',strike:182,exp:'—',qty:100,prem:0},{type:'CALL',action:'SELL',strike:190,exp:'Jan 17',qty:1,prem:1.20}],
  };
  const l=legs[strat]||legs['bull-call'];
  el.innerHTML=l.map(lg=>`<div style="padding:5px 12px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:6px">
    <span class="badge ${lg.action==='BUY'?'up':'dn'}">${lg.action}</span>
    <span style="font-size:11px;font-weight:600">${lg.qty} ${lg.type}</span>
    <span style="font-size:11px;color:var(--brand);font-family:var(--mono)">$${lg.strike}</span>
    <span style="font-size:10px;color:var(--tx3);margin-left:auto">${lg.exp}</span>
    <span style="font-family:var(--mono);font-size:11px;color:${lg.action==='BUY'?'var(--dn)':'var(--up)'}">$${lg.prem.toFixed(2)}</span>
  </div>`).join('');
}
function renderPayoff(strat) {
  const c=document.getElementById('payoff-canvas');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||250;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const spot=182.43;
  const mL=50, mR=20, mT=15, mB=30;
  const dW=W-mL-mR, dH=H-mT-mB;
  const priceRange=Array.from({length:100},(_,i)=>spot*0.85+i*(spot*0.30/99));
  const pnlFuncs={
    'bull-call': p=>Math.min(10, Math.max(-4.8, p-180-4))*100,
    'bear-put': p=>Math.min(7.4, Math.max(-2.6, 180-p-2.6))*100,
    'straddle': p=>(Math.abs(p-182)-9.2)*100,
    'strangle': p=>(Math.max(p-190,0)+Math.max(175-p,0)-2.6)*100,
    'iron-condor': p=>Math.min(1.6, Math.max(-3.4, (p>175&&p<190?1.6:p<170||p>195?-3.4:(p<175?p-175+1.6:190-p+1.6))))*100,
    'butterfly': p=>{const m=182;return (Math.max(0,p-175)-2*Math.max(0,p-m)+Math.max(0,p-190)-0.8)*100;},
    'collar': p=>(Math.max(p-190,0)+Math.min(p-175,0)+0.2)*100,
    'covered-call': p=>(Math.min(p-182,8)-0.8)*100,
  };
  const pnl=priceRange.map(p=>(pnlFuncs[strat]||pnlFuncs['bull-call'])(p));
  const mnPnl=Math.min(...pnl)-200, mxPnl=Math.max(...pnl)+200;
  const scX=i=>mL+i*(dW/99);
  const scY=v=>mT+dH-((v-mnPnl)/(mxPnl-mnPnl))*dH;
  // grid
  const zeroY=scY(0);
  ctx.fillStyle='#2A2E39'; ctx.fillRect(mL,zeroY-0.5,dW,1);
  ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5;
  [-1000,-500,0,500,1000,1500].forEach(v=>{
    const y=scY(v); ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke();
    ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText((v>=0?'$+':'-$')+Math.abs(v),mL-3,y+3);
  });
  // spot line
  const spotX=mL+(priceRange.findIndex(p=>p>=spot)*(dW/99));
  ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(41,98,255,0.6)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(spotX,mT); ctx.lineTo(spotX,H-mB); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='rgba(41,98,255,0.8)'; ctx.font='8px Inter'; ctx.textAlign='center'; ctx.fillText('SPOT',spotX,mT+8);
  // fill
  ctx.beginPath();
  pnl.forEach((v,i)=>{ i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
  ctx.lineTo(scX(99),scY(0)); ctx.lineTo(scX(0),scY(0)); ctx.closePath();
  ctx.fillStyle='rgba(8,153,129,0.1)'; ctx.fill();
  // line
  ctx.beginPath(); ctx.strokeStyle='#2962FF'; ctx.lineWidth=2;
  pnl.forEach((v,i)=>{
    const x=scX(i), y=scY(v);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
  // Price axis
  [170,175,180,182,185,190,195].forEach(p=>{
    const i=priceRange.findIndex(pr=>pr>=p);
    if(i<0) return;
    const x=scX(i); ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center'; ctx.fillText('$'+p,x,H-5);
  });
}
function renderIVSurface() {
  const c=document.getElementById('iv-surface-canvas');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||250;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const strikes=10, expiries=6;
  const cellW=(W-60)/strikes, cellH=(H-30)/expiries;
  const expiryLabels=['1W','2W','1M','2M','3M','6M'];
  const moneyness=['-20%','-10%','-5%','ATM','+5%','+10%','+15%','+20%','+30%','+40%'];
  expiryLabels.forEach((e,i)=>{ ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='right'; ctx.fillText(e,56,30+i*cellH+cellH/2+3); });
  moneyness.forEach((m,j)=>{ ctx.fillStyle='#787B86'; ctx.font='7px Inter'; ctx.textAlign='center'; ctx.fillText(m,60+j*cellW+cellW/2,16); });
  for(let i=0;i<expiries;i++) {
    for(let j=0;j<strikes;j++) {
      const atm=28.4, dist=Math.abs(j-3)*3.2, timePremium=i*1.8;
      const iv=atm+dist-timePremium*0.4+(Math.random()*1.5-0.75);
      const norm=(iv-18)/(45-18);
      ctx.fillStyle=`rgba(${Math.floor(norm*242)},${Math.floor((1-norm)*153)},${Math.floor((1-norm)*129)},0.8)`;
      ctx.fillRect(60+j*cellW+1,30+i*cellH+1,cellW-2,cellH-2);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(iv.toFixed(1),60+j*cellW+cellW/2,30+i*cellH+cellH/2+3);
    }
  }
}
function renderIVSmile() {
  const c=document.getElementById('iv-smile-canvas');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=160;
  const ctx=c.getContext('2d'), W=c.width, H=160;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const mL=35, mR=10, mT=12, mB=20;
  const dW=W-mL-mR, dH=H-mT-mB;
  const deltas=[10,15,20,25,30,35,40,50,60,65,70,75,80,85,90];
  const ivs=[38.2,35.4,33.1,31.4,30.2,29.4,28.8,28.4,29.2,30.1,31.2,32.8,34.4,36.2,39.4];
  const mn=Math.min(...ivs)-1, mx=Math.max(...ivs)+1;
  const scX=i=>mL+i*(dW/(deltas.length-1));
  const scY=v=>mT+dH-((v-mn)/(mx-mn))*dH;
  [28,30,32,34,36,38,40].forEach(v=>{ const y=scY(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke(); ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right'; ctx.fillText(v+'%',mL-3,y+3); });
  [['Jan 17','#2962FF'],['Feb 21','#089981'],['Mar 21','#F7931A']].forEach(([exp,col],e)=>{
    const shifted=ivs.map((v,i)=>v+(e*0.8)+Math.sin(i/2)*1.2);
    ctx.beginPath(); ctx.strokeStyle=col; ctx.lineWidth=1.5;
    shifted.forEach((v,i)=>{ i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
    ctx.stroke();
    ctx.fillStyle=col; ctx.font='8px Inter'; ctx.textAlign='left';
    ctx.fillText(exp, mL+5+(e*45), mT+10+(e*10));
  });
  deltas.forEach((d,i)=>{ if(i%3===0){ ctx.fillStyle='#5D606B'; ctx.font='7px Inter'; ctx.textAlign='center'; ctx.fillText(d+'D',scX(i),H-4); }});
}
function renderIVTerm() {
  const c=document.getElementById('iv-term-canvas');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=120;
  const ctx=c.getContext('2d'), W=c.width, H=120;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const mL=35, mR=10, mT=10, mB=18;
  const dW=W-mL-mR, dH=H-mT-mB;
  const tenors=['1W','2W','1M','2M','3M','6M','1Y'];
  const ivATM=[32.4,30.8,28.4,27.2,26.8,26.4,27.2];
  const mn=24, mx=36;
  const scX=i=>mL+i*(dW/(tenors.length-1));
  const scY=v=>mT+dH-((v-mn)/(mx-mn))*dH;
  [24,26,28,30,32,34].forEach(v=>{ const y=scY(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke(); ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right'; ctx.fillText(v+'%',mL-3,y+3); });
  ctx.beginPath(); ctx.strokeStyle='#9333EA'; ctx.lineWidth=1.8;
  ivATM.forEach((v,i)=>{ i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
  ctx.stroke();
  ivATM.forEach((v,i)=>{ ctx.fillStyle='#9333EA'; ctx.beginPath(); ctx.arc(scX(i),scY(v),2.5,0,Math.PI*2); ctx.fill(); });
  tenors.forEach((t,i)=>{ ctx.fillStyle='#5D606B'; ctx.font='7px Inter'; ctx.textAlign='center'; ctx.fillText(t,scX(i),H-3); });
  ctx.fillStyle='#9333EA'; ctx.font='8px Inter'; ctx.textAlign='left'; ctx.fillText('ATM IV Term Structure',mL+5,mT+10);
}

// ============================================================
// PORTFOLIO: ADD EFFICIENT FRONTIER + ATTRIBUTION
// ============================================================
function enhancePortfolioView() {
  const portView = document.getElementById('view-portfolio');
  if (!portView || portView.dataset.enhanced) return;
  portView.dataset.enhanced = '1';

  // Add a row of tabs at the top
  const kpiStrip = portView.querySelector('.kpi-strip');
  const tabBar = document.createElement('div');
  tabBar.className = 'order-tabs';
  tabBar.innerHTML = `
    <div class="o-tab active" onclick="switchPortTab(this,'pt-positions')">Positions</div>
    <div class="o-tab" onclick="switchPortTab(this,'pt-frontier')">Efficient Frontier</div>
    <div class="o-tab" onclick="switchPortTab(this,'pt-attribution')">P&L Attribution</div>
    <div class="o-tab" onclick="switchPortTab(this,'pt-transactions')">Transactions</div>
  `;
  kpiStrip.insertAdjacentElement('afterend', tabBar);

  // Wrap existing port-grid in tab content
  const portGrid = portView.querySelector('.port-grid');
  if (portGrid) {
    portGrid.classList.add('order-tc', 'active');
    portGrid.id = 'pt-positions';
  }

  // Efficient Frontier tab
  const efDiv = document.createElement('div');
  efDiv.id = 'pt-frontier';
  efDiv.className = 'order-tc';
  efDiv.style.cssText = 'flex:1;overflow:hidden';
  efDiv.innerHTML = `
    <div class="ef-layout">
      <div style="display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">MARKOWITZ EFFICIENT FRONTIER</div>
        <canvas id="ef-canvas" style="flex:1;min-height:0;width:100%"></canvas>
      </div>
      <div class="ef-right">
        <div class="ph"><div class="ph-title"><span>Optimal Portfolios</span></div></div>
        <div style="padding:8px 12px;overflow-y:auto">
          <div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:var(--r4);border-left:2px solid var(--up)">
            <div style="font-size:11px;font-weight:700;color:var(--up)">Max Sharpe Ratio</div>
            <div class="fund-row" style="margin-top:4px"><span class="fund-lbl">Expected Return</span><span class="fund-val">18.4%</span></div>
            <div class="fund-row"><span class="fund-lbl">Volatility</span><span class="fund-val">12.8%</span></div>
            <div class="fund-row"><span class="fund-lbl">Sharpe Ratio</span><span class="fund-val up">1.84</span></div>
          </div>
          <div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:var(--r4);border-left:2px solid var(--brand)">
            <div style="font-size:11px;font-weight:700;color:var(--brand)">Min Variance</div>
            <div class="fund-row" style="margin-top:4px"><span class="fund-lbl">Expected Return</span><span class="fund-val">10.2%</span></div>
            <div class="fund-row"><span class="fund-lbl">Volatility</span><span class="fund-val warn">8.4%</span></div>
            <div class="fund-row"><span class="fund-lbl">Sharpe Ratio</span><span class="fund-val">1.41</span></div>
          </div>
          <div style="font-size:10px;font-weight:600;color:var(--tx3);margin-top:10px;margin-bottom:6px">OPTIMAL WEIGHTS (MAX SHARPE)</div>
          ${[['AAPL',28.4],['SPY',24.2],['NVDA',18.8],['MSFT',14.2],['AMZN',8.4],['Cash',6.0]].map(([s,w])=>`<div class="alloc-row"><span class="alloc-lbl">${s}</span><div class="alloc-track"><div class="alloc-fill" style="width:${w}%;background:var(--brand)"></div></div><span class="alloc-pct">${w}%</span></div>`).join('')}
          <button class="btn-pri" style="width:100%;justify-content:center;margin-top:8px" onclick="showToast('Rebalance','Portfolio rebalance order queued','info')">Rebalance to Optimal</button>
        </div>
      </div>
    </div>`;
  portGrid.insertAdjacentElement('afterend', efDiv);

  // Attribution tab
  const attrDiv = document.createElement('div');
  attrDiv.id = 'pt-attribution';
  attrDiv.className = 'order-tc';
  attrDiv.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';
  attrDiv.innerHTML = `
    <div class="attr-layout">
      <div class="attr-col">
        <div style="font-size:11px;font-weight:600;color:var(--tx);margin-bottom:8px">Brinson Attribution (YTD)</div>
        <div class="attr-row"><span class="attr-lbl">Allocation Effect</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:62%;background:var(--up)"></div></div><span class="attr-val td-up">+3.8%</span></div>
        <div class="attr-row"><span class="attr-lbl">Selection Effect</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:78%;background:var(--up)"></div></div><span class="attr-val td-up">+4.9%</span></div>
        <div class="attr-row"><span class="attr-lbl">Interaction</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:20%;background:var(--dn)"></div></div><span class="attr-val td-dn">-1.2%</span></div>
        <div class="attr-row"><span class="attr-lbl">Total Active</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:75%;background:var(--brand)"></div></div><span class="attr-val" style="color:var(--brand)">+7.5%</span></div>
      </div>
      <div class="attr-col">
        <div style="font-size:11px;font-weight:600;color:var(--tx);margin-bottom:8px">Factor Attribution</div>
        <div class="attr-row"><span class="attr-lbl">Market Beta</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:84%;background:var(--up)"></div></div><span class="attr-val td-up">+8.4%</span></div>
        <div class="attr-row"><span class="attr-lbl">Size (SMB)</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:15%;background:var(--dn)"></div></div><span class="attr-val td-dn">-1.5%</span></div>
        <div class="attr-row"><span class="attr-lbl">Value (HML)</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:12%;background:var(--dn)"></div></div><span class="attr-val td-dn">-1.2%</span></div>
        <div class="attr-row"><span class="attr-lbl">Momentum (MOM)</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:58%;background:var(--up)"></div></div><span class="attr-val td-up">+5.8%</span></div>
        <div class="attr-row"><span class="attr-lbl">Alpha (Idiosyncratic)</span><div class="attr-bar-wrap"><div class="attr-bar-fill" style="width:30%;background:var(--brand)"></div></div><span class="attr-val" style="color:var(--brand)">+3.0%</span></div>
      </div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;border-top:1px solid var(--bdr)">
      <div style="border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">ROLLING PERFORMANCE (12M)</div>
        <canvas id="attr-rolling" style="flex:1;min-height:0;width:100%"></canvas>
      </div>
      <div style="display:flex;flex-direction:column;overflow-y:auto">
        <div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bdr)">SECTOR CONTRIBUTION</div>
        <table><thead><tr><th>Sector</th><th>Weight</th><th>Return</th><th>Contribution</th></tr></thead>
        <tbody>
          <tr><td>Technology</td><td class="td-mono">45%</td><td class="td-up">+18.4%</td><td class="td-up">+8.3%</td></tr>
          <tr><td>Financials</td><td class="td-mono">10%</td><td class="td-up">+12.4%</td><td class="td-up">+1.2%</td></tr>
          <tr><td>Healthcare</td><td class="td-mono">12%</td><td class="td-up">+8.4%</td><td class="td-up">+1.0%</td></tr>
          <tr><td>Consumer</td><td class="td-mono">15%</td><td class="td-dn">-4.2%</td><td class="td-dn">-0.6%</td></tr>
          <tr><td>Energy</td><td class="td-mono">8%</td><td class="td-up">+6.8%</td><td class="td-up">+0.5%</td></tr>
          <tr><td>Cash</td><td class="td-mono">10%</td><td class="td-mono">+5.3%</td><td class="td-up">+0.5%</td></tr>
        </tbody></table>
      </div>
    </div>`;
  efDiv.insertAdjacentElement('afterend', attrDiv);

  // Transactions tab
  const txDiv = document.createElement('div');
  txDiv.id = 'pt-transactions';
  txDiv.className = 'order-tc';
  txDiv.style.cssText = 'flex:1;overflow:hidden;flex-direction:column';
  txDiv.innerHTML = `
    <div style="padding:5px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;align-items:center;flex-shrink:0">
      <select style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:4px 8px;font-size:11px;color:var(--tx);outline:none"><option>All Types</option><option>Buy</option><option>Sell</option><option>Dividend</option><option>Fee</option></select>
      <select style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r4);padding:4px 8px;font-size:11px;color:var(--tx);outline:none"><option>All Time</option><option>Today</option><option>1 Week</option><option>1 Month</option><option>YTD</option></select>
      <button class="btn-g" onclick="showToast('Exported','Transactions exported to CSV','success')">Export CSV</button>
      <button class="btn-g" onclick="showToast('Report','PDF report generated','success')">PDF Report</button>
    </div>
    <div class="tbl-wrap">
      <table><thead><tr><th>Date</th><th>Type</th><th>Symbol</th><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th><th>Fees</th><th>Balance</th></tr></thead>
      <tbody>
        <tr><td class="td-mono" style="color:var(--tx3)">2026-03-01</td><td><span class="badge up">BUY</span></td><td><div class="td-sym">AAPL</div></td><td style="color:var(--tx2)">Market Order</td><td class="td-mono">100</td><td class="td-mono">$180.22</td><td class="td-dn">-$18,022</td><td class="td-mono">$1.00</td><td class="td-mono">$34,630</td></tr>
        <tr><td class="td-mono" style="color:var(--tx3)">2026-02-28</td><td><span class="badge dn">SELL</span></td><td><div class="td-sym">META</div></td><td style="color:var(--tx2)">Take Profit</td><td class="td-mono">40</td><td class="td-mono">$512.30</td><td class="td-up">+$20,492</td><td class="td-mono">$1.00</td><td class="td-mono">$52,653</td></tr>
        <tr><td class="td-mono" style="color:var(--tx3)">2026-02-28</td><td><span class="badge info">DIV</span></td><td><div class="td-sym">AAPL</div></td><td style="color:var(--tx2)">Quarterly Dividend</td><td class="td-mono">—</td><td class="td-mono">—</td><td class="td-up">+$46.00</td><td class="td-mono">$0</td><td class="td-mono">$32,162</td></tr>
      </tbody></table>
    </div>`;
  attrDiv.insertAdjacentElement('afterend', txDiv);

  setTimeout(()=>{ renderEfficientFrontier(); renderAttrRolling(); }, 100);
}

function switchPortTab(el, id) {
  document.querySelectorAll('#view-portfolio .o-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#view-portfolio .order-tc').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const t=document.getElementById(id);
  if(t) t.classList.add('active');
  if(id==='pt-frontier') setTimeout(renderEfficientFrontier,50);
  if(id==='pt-attribution') setTimeout(renderAttrRolling,50);
}
function renderEfficientFrontier() {
  const c=document.getElementById('ef-canvas');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||300;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const mL=50, mR=20, mT=15, mB=30;
  const dW=W-mL-mR, dH=H-mT-mB;
  const scX=v=>mL+((v-5)/(20-5))*dW;
  const scY=v=>mT+dH-((v-5)/(25-5))*dH;
  // grid
  [5,10,15,20,25].forEach(v=>{ const y=scY(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke(); ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right'; ctx.fillText(v+'%',mL-3,y+3); });
  [5,8,11,14,17,20].forEach(v=>{ const x=scX(v); ctx.strokeStyle='#2A2E39'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(x,mT); ctx.lineTo(x,H-mB); ctx.stroke(); ctx.fillStyle='#5D606B'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center'; ctx.fillText(v+'%',x,H-5); });
  ctx.fillStyle='#5D606B'; ctx.font='9px Inter'; ctx.textAlign='center'; ctx.fillText('Volatility',W/2,H-2);
  ctx.save(); ctx.translate(12,H/2); ctx.rotate(-Math.PI/2); ctx.fillText('Expected Return',0,0); ctx.restore();
  // frontier curve
  ctx.beginPath(); ctx.strokeStyle='#2962FF'; ctx.lineWidth=2;
  for(let i=0;i<=50;i++) {
    const vol=6+i*0.26, ret=6+Math.sqrt(Math.max(0,vol-6))*2.8+Math.random()*0.3;
    const x=scX(vol), y=scY(ret);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();
  // random portfolios
  for(let i=0;i<200;i++) {
    const vol=6+Math.random()*12, ret=5+Math.random()*18;
    ctx.fillStyle='rgba(41,98,255,0.2)'; ctx.beginPath(); ctx.arc(scX(vol),scY(ret),2,0,Math.PI*2); ctx.fill();
  }
  // special points
  const pts=[{v:8.4,r:10.2,col:'#2962FF',lbl:'Min Var'},{v:12.8,r:18.4,col:'#089981',lbl:'Max Sharpe'},{v:16.8,r:21.4,col:'#F7931A',lbl:'Current'}];
  pts.forEach(p=>{ ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(scX(p.v),scY(p.r),5,0,Math.PI*2); ctx.fill(); ctx.fillStyle=p.col; ctx.font='bold 9px Inter'; ctx.textAlign='left'; ctx.fillText(p.lbl,scX(p.v)+8,scY(p.r)+4); });
  // CML
  const rf=5.25, msr={v:12.8,r:18.4};
  ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(8,153,129,0.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(scX(0),scY(rf)); ctx.lineTo(scX(20),scY(rf+((msr.r-rf)/msr.v)*20)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(8,153,129,0.7)'; ctx.font='8px Inter'; ctx.fillText('CML',W-mR-30,mT+15);
}
function renderAttrRolling() {
  const c=document.getElementById('attr-rolling');
  if(!c) return;
  c.width=c.parentElement.clientWidth; c.height=c.parentElement.clientHeight||150;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const n=52;
  ctx.beginPath(); ctx.strokeStyle='#2962FF'; ctx.lineWidth=1.5;
  let v=10;
  for(let i=0;i<n;i++){ v+=(Math.random()-0.45)*2; const x=i*(W/n), y=H-15-((v-5)/(30-5))*(H-25); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.stroke();
  ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(247,147,26,0.6)'; ctx.lineWidth=1;
  ctx.beginPath(); let bv=8;
  for(let i=0;i<n;i++){ bv+=(Math.random()-0.46)*1.5; const x=i*(W/n), y=H-15-((bv-5)/(30-5))*(H-25); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#2962FF'; ctx.font='8px Inter'; ctx.textAlign='left'; ctx.fillText('Portfolio',5,12);
  ctx.fillStyle='rgba(247,147,26,0.8)'; ctx.fillText('Benchmark',5,22);
}

// ============================================================
// CHART TOOLBAR ENHANCEMENT
// ============================================================
function enhanceChartToolbar() {
  const header = document.querySelector('.chart-header');
  if (!header || header.dataset.enhanced) return;
  header.dataset.enhanced = '1';

  // Update chart type ctrl to a richer dropdown
  const typeLbl = document.getElementById('chart-type-lbl');
  if (typeLbl && typeLbl.parentElement) {
    typeLbl.parentElement.innerHTML = `
      <select id="chart-type-sel" style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r2);padding:2px 5px;font-size:11px;color:var(--tx);outline:none;cursor:pointer" onchange="setChartTypeAdv(this.value)">
        <option value="candles">Candles</option>
        <option value="heikin-ashi">Heikin-Ashi</option>
        <option value="hollow">Hollow Candles</option>
        <option value="bar">OHLC Bars</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="renko">Renko</option>
        <option value="baseline">Baseline</option>
      </select>`;
  }

  // Add indicator panel ctrl
  const compareCtrl = document.querySelector('.ch-ctrl');
  if (compareCtrl) {
    compareCtrl.insertAdjacentHTML('beforebegin', `
      <div class="ch-ctrl" onclick="openIndicatorPanel()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="1,9 4,4 7,7 10,2"/><circle cx="10" cy="2" r="1.5" fill="currentColor"/></svg>
        Indicators <span id="ind-count" style="background:var(--brand);color:#fff;border-radius:8px;padding:0 4px;font-size:9px;margin-left:2px">3</span>
      </div>
    `);
  }
}

function setChartTypeAdv(type) {
  chartType = ['candles','heikin-ashi','hollow','bar'].includes(type) ? 'candles' : 'line';
  if (type === 'area') chartType = 'area';
  setTimeout(initCharts, 10);
  showToast('Chart Type', type + ' chart', 'info');
}

function openIndicatorPanel() {
  showToast('Indicators', 'EMA(12), EMA(26), RSI(14), BB(20,2), Volume active', 'info');
}

// ============================================================
// ENHANCE switchView to trigger enhancements
// ============================================================
const origSwitchView2 = window.switchView;
window.switchView = function(v) {
  origSwitchView2(v);
  if (v==='options') setTimeout(enhanceOptionsView, 80);
  if (v==='portfolio') { setTimeout(()=>{ initPortfolio(); enhancePortfolioView(); }, 80); }
};

// ============================================================
// INIT ON LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  enhanceChartToolbar();
  // Pre-warm options and portfolio enhancements
  setTimeout(() => {
    if (document.getElementById('view-options')) enhanceOptionsView();
    if (document.getElementById('view-portfolio')) {
      initPortfolio();
      enhancePortfolioView();
    }
  }, 500);
});
</script>
"""

f.write(js)
f.close()
print("Part 11 done")
