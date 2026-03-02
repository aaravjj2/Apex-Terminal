
# Part 8: JavaScript (data, charts, core logic)
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')

js = r"""
<script>
// ============================================================
// DATA GENERATION
// ============================================================
const rand = (a,b) => a + Math.random()*(b-a);
const randInt = (a,b) => Math.floor(rand(a,b+1));

function genOHLCV(n, start, vol_base, drift=0.0002) {
  let bars = [], price = start;
  for (let i=0; i<n; i++) {
    let o = price;
    let move = (Math.random()-0.48) * vol_base + drift*price;
    let c = price + move;
    let h = Math.max(o,c) + rand(0, vol_base*0.5);
    let l = Math.min(o,c) - rand(0, vol_base*0.5);
    let v = rand(20e6,80e6);
    bars.push({o, h, l, c, v});
    price = c;
  }
  return bars;
}

function calcEMA(data, period) {
  const k = 2/(period+1);
  let ema = [data[0]];
  for (let i=1; i<data.length; i++) ema.push(data[i]*k + ema[i-1]*(1-k));
  return ema;
}
function calcRSI(data, period=14) {
  let gains=0, losses=0;
  for (let i=1; i<=period; i++) {
    let d = data[i]-data[i-1];
    if (d>0) gains+=d; else losses-=d;
  }
  let rsi = [];
  for (let i=0; i<period; i++) rsi.push(50);
  let ag=gains/period, al=losses/period;
  rsi.push(100 - 100/(1+ag/al));
  for (let i=period+1; i<data.length; i++) {
    let d = data[i]-data[i-1];
    ag = (ag*(period-1)+(d>0?d:0))/period;
    al = (al*(period-1)+(d<0?-d:0))/period;
    rsi.push(al===0?100:100 - 100/(1+ag/al));
  }
  return rsi;
}
function calcBB(data, period=20, mult=2) {
  let upper=[], lower=[], mid=[];
  for (let i=0; i<data.length; i++) {
    if (i<period-1) { upper.push(null);lower.push(null);mid.push(null);continue; }
    let slice = data.slice(i-period+1, i+1);
    let m = slice.reduce((a,b)=>a+b,0)/period;
    let sd = Math.sqrt(slice.map(x=>(x-m)**2).reduce((a,b)=>a+b,0)/period);
    upper.push(m+mult*sd); lower.push(m-mult*sd); mid.push(m);
  }
  return {upper,lower,mid};
}

let SYMBOLS = {
  'AAPL': {name:'Apple Inc.', exchange:'NASDAQ', base:182.43, vol:2.1},
  'TSLA': {name:'Tesla Inc.', exchange:'NASDAQ', base:215.80, vol:8.2},
  'SPY':  {name:'SPDR S&P500', exchange:'NYSE', base:521.40, vol:3.8},
  'BTC':  {name:'Bitcoin', exchange:'CRYPTO', base:98420, vol:1800},
  'ETH':  {name:'Ethereum', exchange:'CRYPTO', base:3420, vol:120},
};
let currentSym = 'AAPL';
let chartBars = genOHLCV(180, SYMBOLS[currentSym].base, SYMBOLS[currentSym].vol);
let chartType = 'candles';
let currentTF = '1h';
let currentDraw = 'cursor';
let replayActive = false;
let replayPlayIdx = 60;
let replaySpeed = 1;

// ============================================================
// VIEW SWITCHING
// ============================================================
function switchView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const vEl = document.getElementById('view-'+v);
  if (vEl) vEl.classList.add('active');
  const nEl = document.querySelector('[data-view="'+v+'"]');
  if (nEl) nEl.classList.add('active');
  // init view-specific content
  if (v==='trading') { setTimeout(initCharts,50); }
  else if (v==='dashboard') { setTimeout(initDashboard,50); }
  else if (v==='portfolio') { initPortfolio(); }
  else if (v==='orders') { initOrders(); }
  else if (v==='risk') { initRisk(); }
  else if (v==='backtest') { initBacktest(); }
  else if (v==='walkforward') { initWalkForward(); }
  else if (v==='montecarlo') { setTimeout(initMonteCarlo,50); }
  else if (v==='strategy') { initStrategy(); }
  else if (v==='options') { initOptions(); }
  else if (v==='screener') { initScreener(); }
  else if (v==='alerts') { }
  else if (v==='macro') { }
  else if (v==='research') { initResearch(); }
  else if (v==='autopilot') { initAutopilot(); }
  else if (v==='compliance') { }
  else if (v==='platform') { setTimeout(initPlatform,50); }
}
function switchSidebarTab(el, tab) {
  document.querySelectorAll('.s-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.s-content').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const sc = document.getElementById('sc-'+tab);
  if (sc) sc.classList.add('active');
}
function switchOrderTab(el, tab) {
  document.querySelectorAll('.o-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.order-tc').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const el2 = document.getElementById('ord-'+tab);
  if (el2) el2.classList.add('active');
}

// ============================================================
// CHART RENDERING
// ============================================================
function initCharts() {
  renderMainChart();
  renderRSIChart();
}

function renderMainChart() {
  const canvas = document.getElementById('chart-main');
  if (!canvas) return;
  const wrap = document.getElementById('cmw');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const marginL=36, marginR=60, marginT=12, marginB=20;
  const drawW = W-marginL-marginR, drawH = H-marginT-marginB;
  const bars = chartBars;
  const visN = Math.min(bars.length, Math.floor(drawW/8));
  const vis = bars.slice(bars.length-visN);
  const high = Math.max(...vis.map(b=>b.h));
  const low  = Math.min(...vis.map(b=>b.l));
  const range = high - low || 1;
  const scaleY = v => marginT + drawH - ((v-low)/range)*drawH;
  const barW = drawW/vis.length;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#131722';
  ctx.fillRect(0,0,W,H);

  // grid
  ctx.strokeStyle = '#2A2E39';
  ctx.lineWidth = 0.5;
  for (let i=0; i<=5; i++) {
    let y = marginT + i*(drawH/5);
    ctx.beginPath(); ctx.moveTo(marginL,y); ctx.lineTo(W-marginR,y); ctx.stroke();
    let val = high - (range/5)*i;
    ctx.fillStyle='#787B86'; ctx.font='9px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText(val.toFixed(2), W-marginR+55, y+3);
  }

  // EMA
  const closes = vis.map(b=>b.c);
  const ema12 = calcEMA(closes,12);
  const ema26 = calcEMA(closes,26);
  function drawLine(arr, color) {
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=1;
    arr.forEach((v,i) => {
      let x = marginL + (i+0.5)*barW;
      let y = scaleY(v);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
  }
  drawLine(ema12,'#2962FF');
  drawLine(ema26,'#9333EA');

  // BB bands
  const bb = calcBB(closes,20,2);
  ctx.beginPath(); ctx.strokeStyle='rgba(247,147,26,0.4)'; ctx.lineWidth=0.8;
  bb.upper.forEach((v,i) => {
    if (v===null) return;
    let x = marginL+(i+0.5)*barW, y=scaleY(v);
    (i===0||bb.upper[i-1]===null)?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
  ctx.beginPath();
  bb.lower.forEach((v,i) => {
    if (v===null) return;
    let x=marginL+(i+0.5)*barW, y=scaleY(v);
    (i===0||bb.lower[i-1]===null)?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Candles
  if (chartType === 'candles') {
    vis.forEach((b,i) => {
      const x = marginL + i*barW;
      const up = b.c >= b.o;
      const col = up ? '#089981' : '#F23645';
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      const cx = x + barW/2;
      ctx.beginPath(); ctx.moveTo(cx, scaleY(b.h)); ctx.lineTo(cx, scaleY(b.l)); ctx.stroke();
      const oy=scaleY(b.o), cy=scaleY(b.c);
      const bh = Math.max(1, Math.abs(oy-cy));
      ctx.fillRect(x+1, Math.min(oy,cy), barW-2, bh);
    });
  } else {
    // line chart
    ctx.beginPath(); ctx.strokeStyle='#2962FF'; ctx.lineWidth=1.5;
    vis.forEach((b,i) => {
      let x=marginL+(i+0.5)*barW, y=scaleY(b.c);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  // Last price line
  const last = vis[vis.length-1].c;
  const ly = scaleY(last);
  ctx.setLineDash([3,3]);
  ctx.strokeStyle = last > vis[0].c ? '#089981' : '#F23645';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(marginL,ly); ctx.lineTo(W-marginR,ly); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = last > vis[0].c ? '#089981' : '#F23645';
  ctx.fillRect(W-marginR, ly-8, 58, 16);
  ctx.fillStyle='#fff'; ctx.font='bold 9px JetBrains Mono'; ctx.textAlign='center';
  ctx.fillText(last.toFixed(2), W-marginR+29, ly+3);

  // volume bars
  const maxVol = Math.max(...vis.map(b=>b.v));
  vis.forEach((b,i) => {
    const x = marginL + i*barW;
    const vh = (b.v/maxVol) * (drawH*0.15);
    ctx.fillStyle = b.c>=b.o ? 'rgba(8,153,129,0.3)' : 'rgba(242,54,69,0.3)';
    ctx.fillRect(x+1, marginT+drawH-vh, barW-2, vh);
  });
}

function renderRSIChart() {
  const canvas = document.getElementById('chart-rsi');
  if (!canvas) return;
  const wrap = document.getElementById('crw');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  const mL=36, mR=60, mT=4, mB=12;
  const dW=W-mL-mR, dH=H-mT-mB;
  const closes = chartBars.map(b=>b.c);
  const rsi = calcRSI(closes);
  const visN = Math.min(rsi.length, Math.floor(dW/8));
  const vis = rsi.slice(rsi.length-visN);

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);

  // levels
  [30,50,70].forEach(lv => {
    const y = mT + dH - ((lv-0)/100)*dH;
    ctx.strokeStyle = lv===50?'#434651':'#2A2E39';
    ctx.lineWidth=0.5;
    ctx.setLineDash(lv===50?[]:[ 3,3]);
    ctx.beginPath(); ctx.moveTo(mL,y); ctx.lineTo(W-mR,y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#787B86'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText(lv, W-mR+54, y+3);
  });

  const barW = dW/vis.length;
  // fill
  ctx.beginPath();
  vis.forEach((v,i) => {
    let x=mL+(i+0.5)*barW, y=mT+dH-((v/100)*dH);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.lineTo(mL+(vis.length-0.5)*barW, mT+dH);
  ctx.lineTo(mL+0.5*barW, mT+dH);
  ctx.closePath();
  ctx.fillStyle='rgba(247,147,26,0.1)';
  ctx.fill();

  // line
  ctx.beginPath(); ctx.strokeStyle='#F7931A'; ctx.lineWidth=1;
  vis.forEach((v,i) => {
    let x=mL+(i+0.5)*barW, y=mT+dH-((v/100)*dH);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();

  // RSI value label
  const lastRSI = vis[vis.length-1];
  document.getElementById('rsi-val').textContent = lastRSI.toFixed(1);
}

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
  renderEquityCanvas('dash-equity');
  renderSectorChart();
  renderMovers();
  renderNews();
  renderIndices();
  renderDashEvents();
}

function renderEquityCanvas(id) {
  const c = document.getElementById(id);
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  let equity = [100000];
  for (let i=1; i<250; i++) equity.push(equity[i-1]*(1+rand(-0.009,0.012)));
  const mn = Math.min(...equity), mx = Math.max(...equity);
  const sx = W/(equity.length-1), sy = (H-20)/(mx-mn);
  ctx.beginPath();
  equity.forEach((v,i) => {
    let x=i*sx, y=H-10-(v-mn)*sy;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle='#2962FF'; ctx.lineWidth=1.5; ctx.stroke();
  // fill
  ctx.lineTo((equity.length-1)*sx,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle='rgba(41,98,255,0.08)'; ctx.fill();
  // last label
  ctx.fillStyle='#089981'; ctx.font='bold 10px JetBrains Mono'; ctx.textAlign='right';
  ctx.fillText('+184.3%', W-5, 14);
}

function renderSectorChart() {
  const c = document.getElementById('dash-sector');
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const sectors = [
    {name:'Tech',pct:2.4,col:'#2962FF'},{name:'Finance',pct:0.8,col:'#089981'},
    {name:'Healthcare',pct:-0.3,col:'#F23645'},{name:'Energy',pct:1.2,col:'#F7931A'},
    {name:'Utilities',pct:-0.6,col:'#9333EA'},{name:'Industrials',pct:0.5,col:'#06B6D4'},
    {name:'ConsDisc',pct:1.8,col:'#2962FF'},{name:'Materials',pct:0.2,col:'#089981'},
    {name:'RealEstate',pct:-0.9,col:'#F23645'},
  ];
  const maxAbs = Math.max(...sectors.map(s=>Math.abs(s.pct)));
  const bH=14, gap=4, lM=66, rM=10, tM=8;
  sectors.forEach((s,i) => {
    const y = tM + i*(bH+gap);
    const barW = (Math.abs(s.pct)/maxAbs)*(W-lM-rM);
    ctx.fillStyle='#2A2E39'; ctx.fillRect(lM,y,W-lM-rM,bH);
    ctx.fillStyle=s.pct>0?'rgba(8,153,129,0.7)':'rgba(242,54,69,0.7)';
    ctx.fillRect(lM,y,barW,bH);
    ctx.fillStyle='#787B86'; ctx.font='9px Inter'; ctx.textAlign='right';
    ctx.fillText(s.name, lM-3, y+10);
    ctx.fillStyle=s.pct>0?'#089981':'#F23645'; ctx.font='bold 9px JetBrains Mono'; ctx.textAlign='left';
    ctx.fillText((s.pct>0?'+':'')+s.pct+'%', lM+barW+3, y+10);
  });
}

function renderMovers() {
  const el = document.getElementById('dash-movers');
  if (!el) return;
  const movers = [
    {sym:'NVDA',chg:'+5.82%',up:true,price:'$924.70'},
    {sym:'TSLA',chg:'-3.21%',up:false,price:'$215.80'},
    {sym:'AMD',chg:'+4.14%',up:true,price:'$184.20'},
    {sym:'PLTR',chg:'-2.87%',up:false,price:'$22.40'},
    {sym:'AAPL',chg:'+1.21%',up:true,price:'$182.43'},
    {sym:'META',chg:'+2.64%',up:true,price:'$512.30'},
  ];
  el.innerHTML = movers.map(m => `<div style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid rgba(42,46,57,.5);cursor:pointer" onclick="setSymbol('${m.sym}')">
    <span style="font-weight:600;font-size:12px;width:48px">${m.sym}</span>
    <span style="font-family:var(--mono);font-size:11px;flex:1">${m.price}</span>
    <span style="font-family:var(--mono);font-size:11px;color:${m.up?'var(--up)':'var(--dn)'}">${m.chg}</span>
  </div>`).join('');
}

function renderNews() {
  const el = document.getElementById('dash-news');
  if (!el) return;
  const news = [
    {time:'09:32',src:'Reuters',title:'Fed signals rate pause through H1 2026',tag:'macro'},
    {time:'09:18',src:'Bloomberg',title:'NVDA beats earnings, raises guidance 12%',tag:'earnings'},
    {time:'08:55',src:'WSJ',title:'Apple launches M4 MacBook Pro lineup',tag:'tech'},
    {time:'08:30',src:'CNBC',title:'CPI data shows inflation cooling to 2.8%',tag:'macro'},
    {time:'07:42',src:'FT',title:'ECB cuts rates 25bps, euro weakens',tag:'macro'},
  ];
  el.innerHTML = news.map(n => `<div style="padding:5px 10px;border-bottom:1px solid rgba(42,46,57,.5);cursor:pointer;transition:background .08s" onmouseover="this.style.background='#1E222D'" onmouseout="this.style.background=''">
    <div style="display:flex;gap:5px;margin-bottom:2px"><span style="font-family:var(--mono);font-size:9px;color:var(--tx3)">${n.time}</span><span style="font-size:9px;color:var(--brand)">${n.src}</span></div>
    <div style="font-size:11px;color:var(--tx);line-height:1.4">${n.title}</div>
  </div>`).join('');
}

function renderIndices() {
  const el = document.getElementById('dash-indices');
  if (!el) return;
  const idx = [
    {sym:'S&P 500',val:'5,842.40',chg:'+24.1',pct:'+0.41%',up:true},
    {sym:'NASDAQ',val:'18,420.10',chg:'+142.8',pct:'+0.78%',up:true},
    {sym:'DOW',val:'44,218.80',chg:'-82.4',pct:'-0.19%',up:false},
    {sym:'Russell 2k',val:'2,184.60',chg:'+18.2',pct:'+0.84%',up:true},
    {sym:'VIX',val:'16.42',chg:'-0.84',pct:'-4.87%',up:false},
    {sym:'DXY',val:'104.82',chg:'+0.22',pct:'+0.21%',up:true},
    {sym:'10Y UST',val:'4.28%',chg:'+0.02',pct:'',up:false},
    {sym:'Gold',val:'$2,842',chg:'+12.4',pct:'+0.44%',up:true},
    {sym:'Oil WTI',val:'$74.80',chg:'-1.20',pct:'-1.58%',up:false},
    {sym:'BTC/USD',val:'$98,420',chg:'+1,240',pct:'+1.28%',up:true},
  ];
  el.innerHTML = idx.map(i => `<div style="display:flex;align-items:center;padding:5px 10px;border-bottom:1px solid rgba(42,46,57,.4)">
    <span style="font-size:11px;font-weight:600;color:var(--tx);flex:1">${i.sym}</span>
    <span style="font-family:var(--mono);font-size:11px;margin-right:6px">${i.val}</span>
    <span style="font-family:var(--mono);font-size:10px;color:${i.up?'var(--up)':'var(--dn)'}">${i.chg} ${i.pct}</span>
  </div>`).join('');
}

function renderDashEvents() {
  const el = document.getElementById('dash-events');
  if (!el) return;
  const events = [
    {date:'Mar 3',name:'ISM Services PMI',imp:'med'},
    {date:'Mar 4',name:'ADP Employment',imp:'high'},
    {date:'Mar 5',name:'Fed Beige Book',imp:'high'},
    {date:'Mar 6',name:'Initial Jobless Claims',imp:'med'},
    {date:'Mar 7',name:'Non-Farm Payrolls',imp:'high'},
  ];
  el.innerHTML = events.map(e => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(42,46,57,.3)">
    <span style="font-family:var(--mono);font-size:10px;color:var(--tx3);width:38px">${e.date}</span>
    <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${e.imp==='high'?'var(--dn)':e.imp==='med'?'var(--warn)':'var(--tx3)'}"></div>
    <span style="font-size:11px;color:var(--tx)">${e.name}</span>
  </div>`).join('');
}

// ============================================================
// PORTFOLIO
// ============================================================
function initPortfolio() {
  const positions = [
    {sym:'AAPL',side:'Long',qty:200,entry:168.20,last:182.43,mkt:36486,upnl:2846,rpnl:4200,pct:8.42,beta:1.12,wt:9.5},
    {sym:'TSLA',side:'Long',qty:100,entry:198.40,last:215.80,mkt:21580,upnl:1740,rpnl:8200,pct:8.77,beta:1.94,wt:5.6},
    {sym:'NVDA',side:'Long',qty:50,entry:840.00,last:924.70,mkt:46235,upnl:4235,rpnl:0,pct:10.06,beta:2.21,wt:12.1},
    {sym:'SPY',side:'Long',qty:150,entry:498.20,last:521.40,mkt:78210,upnl:3480,rpnl:0,pct:4.66,beta:1.00,wt:20.4},
    {sym:'MSFT',side:'Long',qty:75,entry:382.10,last:411.80,mkt:30885,upnl:2228,rpnl:0,pct:7.77,beta:0.92,wt:8.1},
    {sym:'AMZN',side:'Long',qty:60,entry:186.20,last:198.40,mkt:11904,upnl:732,rpnl:0,pct:6.55,beta:1.08,wt:3.1},
    {sym:'META',side:'Long',qty:40,entry:487.60,last:512.30,mkt:20492,upnl:988,rpnl:2100,pct:5.07,beta:1.24,wt:5.4},
    {sym:'TSLA',side:'Short',qty:25,entry:232.80,last:215.80,mkt:-5395,upnl:425,rpnl:0,pct:7.30,beta:1.94,wt:-1.4},
    {sym:'SQQQ',side:'Long',qty:200,entry:38.40,last:36.20,mkt:7240,upnl:-440,rpnl:0,pct:-5.73,beta:-2.8,wt:1.9},
  ];
  const tbody = document.getElementById('port-tbody');
  if (tbody) tbody.innerHTML = positions.map(p => `<tr onclick="setSymbol('${p.sym}')">
    <td><div class="td-sym">${p.sym}</div></td>
    <td><span class="badge ${p.side==='Long'?'up':'dn'}">${p.side}</span></td>
    <td class="td-mono">${p.qty}</td>
    <td class="td-mono">$${p.entry.toFixed(2)}</td>
    <td class="td-mono">$${p.last.toFixed(2)}</td>
    <td class="td-mono">$${Math.abs(p.mkt).toLocaleString()}</td>
    <td class="${p.upnl>=0?'td-up':'td-dn'}">$${p.upnl>=0?'+':''}${p.upnl.toLocaleString()}</td>
    <td class="${p.rpnl>=0?'td-up':'td-dn'}">$${p.rpnl>=0?'+':''}${p.rpnl.toLocaleString()}</td>
    <td class="${p.pct>=0?'td-up':'td-dn'}">${p.pct>=0?'+':''}${p.pct.toFixed(2)}%</td>
    <td class="td-mono">${p.beta.toFixed(2)}</td>
    <td class="td-mono">${p.wt.toFixed(1)}%</td>
    <td><button class="btn-sm dn" onclick="event.stopPropagation();showToast('Close','Closing position ${p.sym}','warn')">Close</button></td>
  </tr>`).join('');

  const allocEl = document.getElementById('port-alloc');
  if (allocEl) {
    const allocs = [
      {lbl:'Technology',pct:45,col:'#2962FF'},
      {lbl:'Consumer',pct:18,col:'#089981'},
      {lbl:'Healthcare',pct:12,col:'#F7931A'},
      {lbl:'Financials',pct:10,col:'#9333EA'},
      {lbl:'Hedge/Short',pct:8,col:'#F23645'},
      {lbl:'Cash',pct:7,col:'#434651'},
    ];
    allocEl.innerHTML = allocs.map(a => `<div class="alloc-row">
      <span class="alloc-lbl">${a.lbl}</span>
      <div class="alloc-track"><div class="alloc-fill" style="width:${a.pct}%;background:${a.col}"></div></div>
      <span class="alloc-pct">${a.pct}%</span>
    </div>`).join('');
  }
  renderEquityCanvas('port-equity');
}

// ============================================================
// ORDERS
// ============================================================
function initOrders() {
  const tbody = document.getElementById('filled-tbody');
  if (tbody) {
    const filled = [
      {sym:'AAPL',side:'Buy',qty:100,fill:180.22,comm:1.00,slip:0.08,time:'09:14:02',pnl:221},
      {sym:'MSFT',side:'Buy',qty:50,fill:408.10,comm:1.00,slip:0.12,time:'09:08:32',pnl:185},
      {sym:'SPY',side:'Buy',qty:80,fill:519.40,comm:1.00,slip:0.05,time:'09:01:48',pnl:160},
    ];
    tbody.innerHTML = filled.map(t=>`<tr>
      <td><div class="td-sym">${t.sym}</div></td>
      <td><span class="badge ${t.side==='Buy'?'up':'dn'}">${t.side}</span></td>
      <td class="td-mono">${t.qty}</td>
      <td class="td-mono">$${t.fill}</td>
      <td class="td-mono">$${t.comm.toFixed(2)}</td>
      <td class="td-mono">$${t.slip.toFixed(2)}</td>
      <td class="td-mono" style="color:var(--tx3)">${t.time}</td>
      <td class="td-up">+$${t.pnl}</td>
    </tr>`).join('');
  }
  const blotter = document.getElementById('blotter-tbody');
  if (blotter) {
    const trades = [
      {id:'T-2841',sym:'AAPL',side:'Buy',qty:100,price:180.22,val:18022,comm:1.00,strat:'MomentumCross',time:'09:14',pnl:221},
      {id:'T-2840',sym:'MSFT',side:'Buy',qty:50,price:408.10,val:20405,comm:1.00,strat:'MomentumCross',time:'09:08',pnl:185},
      {id:'T-2839',sym:'TSLA',side:'Sell',qty:30,price:218.40,val:6552,comm:1.00,strat:'Manual',time:'08:54',pnl:-84},
    ];
    blotter.innerHTML = trades.map(t=>`<tr>
      <td class="td-mono" style="color:var(--tx3)">${t.id}</td>
      <td><div class="td-sym">${t.sym}</div></td>
      <td><span class="badge ${t.side==='Buy'?'up':'dn'}">${t.side}</span></td>
      <td class="td-mono">${t.qty}</td>
      <td class="td-mono">$${t.price}</td>
      <td class="td-mono">$${t.val.toLocaleString()}</td>
      <td class="td-mono">$${t.comm}</td>
      <td style="color:var(--tx3);font-size:11px">${t.strat}</td>
      <td class="td-mono" style="color:var(--tx3)">${t.time}</td>
      <td class="${t.pnl>=0?'td-up':'td-dn'}">${t.pnl>=0?'+':''}$${t.pnl}</td>
    </tr>`).join('');
  }
}

// ============================================================
// RISK
// ============================================================
function initRisk() {
  const c = document.getElementById('risk-corr');
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = 160;
  const ctx = c.getContext('2d');
  const syms = ['AAPL','TSLA','NVDA','SPY','MSFT','AMZN'];
  const n = syms.length;
  const W=c.width, H=160;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const cellW=(W-60)/n, cellH=(H-20)/n;
  const corrs = [
    [1.00,0.68,0.79,0.82,0.87,0.76],
    [0.68,1.00,0.71,0.64,0.62,0.58],
    [0.79,0.71,1.00,0.75,0.80,0.70],
    [0.82,0.64,0.75,1.00,0.88,0.84],
    [0.87,0.62,0.80,0.88,1.00,0.91],
    [0.76,0.58,0.70,0.84,0.91,1.00],
  ];
  for (let i=0; i<n; i++) {
    for (let j=0; j<n; j++) {
      const v = corrs[i][j];
      const r = v>0 ? Math.floor(v*242) : 0;
      const g = v>0 ? Math.floor(v*54) : 0;
      const b2 = v>0 ? Math.floor(v*69) : 0;
      const alpha = Math.abs(v)*0.8+0.1;
      ctx.fillStyle = v===1 ? '#2962FF' : `rgba(${v>0.7?242:89},${v>0.7?54:153},${v>0.7?69:129},${alpha})`;
      ctx.fillRect(60+j*cellW, 20+i*cellH, cellW-1, cellH-1);
      ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center';
      ctx.fillText(v.toFixed(2), 60+j*cellW+cellW/2, 20+i*cellH+cellH/2+3);
    }
    ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='right';
    ctx.fillText(syms[i], 56, 20+i*cellH+cellH/2+3);
    ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='center';
    ctx.fillText(syms[i], 60+i*cellW+cellW/2, 14);
  }
}
</script>
"""

f.write(js)
f.close()
print("Part 8 done")
