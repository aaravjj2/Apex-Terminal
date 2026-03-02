
# Part 9: JavaScript continued (backtest, options, screener, watchlist, autopilot, platform, command palette, ticks, etc.)
path = '/home/aarav/Aarav/Tradingview recreation/Tradingview recreation/demo/index.html'
f = open(path, 'a', encoding='utf-8')

js = r"""
<script>
// ============================================================
// BACKTEST
// ============================================================
function runBacktest() {
  showToast('Backtest','Running Momentum Cross strategy...','info');
  setTimeout(()=>{ showToast('Backtest Complete','Sharpe: 2.14 | Return: +184.3% | MaxDD: -14.2%','success'); initBacktest(); },1500);
}
function initBacktest() {
  renderBTCharts();
  renderMonthlyReturns();
  renderBTTrades();
}
function renderBTCharts() {
  // equity
  const ce = document.getElementById('bt-equity');
  if (!ce) return;
  ce.width = ce.parentElement.clientWidth; ce.height = 140;
  const ctx=ce.getContext('2d'), W=ce.width, H=140;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  let eq=[100000];
  for(let i=1;i<200;i++) eq.push(eq[i-1]*(1+((Math.random()-0.46)*0.015)));
  const mn=Math.min(...eq), mx=Math.max(...eq);
  ctx.beginPath();
  eq.forEach((v,i)=>{ let x=i*(W/(eq.length-1)),y=H-10-((v-mn)/(mx-mn))*(H-20); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.strokeStyle='#2962FF'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.lineTo(W,H-10); ctx.lineTo(0,H-10); ctx.closePath();
  ctx.fillStyle='rgba(41,98,255,0.08)'; ctx.fill();
  // draw benchmark
  ctx.beginPath(); ctx.strokeStyle='rgba(247,147,26,0.5)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  let bench=100000;
  eq.forEach((_,i)=>{ bench*=(1+0.0005); let x=i*(W/(eq.length-1)),y=H-10-((bench-mn)/(mx-mn))*(H-20); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke(); ctx.setLineDash([]);

  // drawdown
  const cd = document.getElementById('bt-dd');
  if (!cd) return;
  cd.width = ce.width; cd.height = 80;
  const ctx2=cd.getContext('2d');
  ctx2.fillStyle='#131722'; ctx2.fillRect(0,0,W,80);
  let peak=eq[0], dds=eq.map(v=>{ peak=Math.max(peak,v); return (v-peak)/peak; });
  const mnDD = Math.min(...dds);
  ctx2.beginPath();
  dds.forEach((v,i)=>{ let x=i*(W/(dds.length-1)),y=4+((1-(v/mnDD))*72); i===0?ctx2.moveTo(x,y):ctx2.lineTo(x,y); });
  ctx2.lineTo(W,76); ctx2.lineTo(0,76); ctx2.closePath();
  ctx2.fillStyle='rgba(242,54,69,0.2)'; ctx2.fill();
  ctx2.beginPath();
  dds.forEach((v,i)=>{ let x=i*(W/(dds.length-1)),y=4+((1-(v/mnDD))*72); i===0?ctx2.moveTo(x,y):ctx2.lineTo(x,y); });
  ctx2.strokeStyle='#F23645'; ctx2.lineWidth=1; ctx2.stroke();
}
function renderMonthlyReturns() {
  const el = document.getElementById('bt-monthly');
  if (!el) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years = [2020,2021,2022,2023,2024];
  let html = '<div class="monthly-grid">';
  html += '<div class="mg-lbl"></div>';
  months.forEach(m=>{ html += `<div class="mg-mon">${m}</div>`; });
  years.forEach(y => {
    html += `<div class="mg-lbl">${y}</div>`;
    months.forEach(()=>{
      const v = (Math.random()-0.4)*8;
      const col = v>0 ? `rgba(8,153,129,${Math.min(v/6,1)*0.8+0.1})` : `rgba(242,54,69,${Math.min(-v/6,1)*0.8+0.1})`;
      html += `<div class="mg-cell" style="background:${col};color:${v>0?'#089981':'#F23645'}">${v>0?'+':''}${v.toFixed(1)}</div>`;
    });
  });
  html += '</div>';
  el.innerHTML = html;
}
function renderBTTrades() {
  const el = document.getElementById('bt-trades');
  if (!el) return;
  const trades = [
    ['2024-12-15','AAPL','Long',168.20,182.43,100,'+$1,423','+8.5%'],
    ['2024-11-28','TSLA','Short',232.80,215.80,50,'+$850','+7.3%'],
    ['2024-11-10','NVDA','Long',820.00,924.70,20,'+$2,094','+12.8%'],
    ['2024-10-22','SPY','Long',498.20,521.40,80,'+$1,856','+4.7%'],
    ['2024-10-08','MSFT','Long',382.10,411.80,30,'+$891','+7.8%'],
  ];
  el.innerHTML = trades.map(t=>`<tr>
    <td class="td-mono" style="color:var(--tx3)">${t[0]}</td>
    <td><div class="td-sym">${t[1]}</div></td>
    <td><span class="badge ${t[2]==='Long'?'up':'dn'}">${t[2]}</span></td>
    <td class="td-mono">$${t[3]}</td>
    <td class="td-mono">$${t[4]}</td>
    <td class="td-mono">${t[5]}</td>
    <td class="td-up">${t[6]}</td>
    <td class="td-up">${t[7]}</td>
  </tr>`).join('');
}

// ============================================================
// WALK-FORWARD
// ============================================================
function initWalkForward() {
  const el = document.getElementById('wf-grid');
  if (!el) return;
  const periods = [
    {p:'2020 Q1-Q2',is:2.84,oos:2.31,pnl:42800,ok:true},
    {p:'2020 Q3-Q4',is:3.12,oos:2.54,pnl:38200,ok:true},
    {p:'2021 Q1-Q2',is:2.41,oos:1.98,pnl:29400,ok:true},
    {p:'2021 Q3-Q4',is:2.68,oos:2.12,pnl:34800,ok:true},
    {p:'2022 Q1-Q2',is:1.94,oos:0.82,pnl:8200,ok:true},
    {p:'2022 Q3-Q4',is:2.21,oos:-0.14,pnl:-2400,ok:false},
  ];
  el.innerHTML = periods.map(w=>`<div class="wf-card">
    <div class="wf-period">${w.p}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div style="font-size:9px;color:var(--tx3)">IS Sharpe</div><div class="wf-sharpe" style="font-size:16px;color:var(--brand)">${w.is}</div></div>
      <div style="text-align:right"><div style="font-size:9px;color:var(--tx3)">OOS Sharpe</div><div class="wf-sharpe" style="font-size:16px;color:${w.oos>0?'var(--up)':'var(--dn)'}">${w.oos}</div></div>
    </div>
    <div style="font-family:var(--mono);font-size:10px;color:${w.pnl>=0?'var(--up)':'var(--dn)'};margin-top:4px">${w.pnl>=0?'+':''}$${Math.abs(w.pnl).toLocaleString()}</div>
    <div class="wf-bar"><div class="wf-fill" style="width:${Math.max(5,(w.oos/w.is)*100)}%;background:${w.ok?'var(--up)':'var(--dn)'}"></div></div>
  </div>`).join('');
}

// ============================================================
// MONTE CARLO
// ============================================================
function runMonteCarlo() {
  showToast('Monte Carlo','Running 10,000 simulations...','info');
  setTimeout(()=>{ showToast('Simulation Complete','Median: +142.8% | 5th pct: +12.4% | Ruin: 0.3%','success'); initMonteCarlo(); },2000);
}
function initMonteCarlo() {
  const c = document.getElementById('mc-chart');
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight || 200;
  const ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  // draw 60 sim paths
  const steps = 80;
  for (let s=0; s<60; s++) {
    let equity=100;
    ctx.beginPath();
    ctx.moveTo(0, H-10-((equity-80)/120)*(H-20));
    for (let i=1; i<steps; i++) {
      equity *= (1+(Math.random()-0.46)*0.04);
      let x=i*(W/(steps-1)), y=H-10-Math.max(0,Math.min((equity-80)/120,1))*(H-20);
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle=`rgba(41,98,255,0.08)`; ctx.lineWidth=0.8; ctx.stroke();
  }
  // percentile bands
  [5,25,50,75,95].forEach((pct,i) => {
    const colors=['rgba(242,54,69,0.8)','rgba(247,147,26,0.6)','rgba(41,98,255,0.9)','rgba(247,147,26,0.6)','rgba(8,153,129,0.8)'];
    let eq=100;
    ctx.beginPath();
    ctx.moveTo(0, H-10-((eq-80)/120)*(H-20));
    for (let j=1; j<steps; j++) {
      const drift = (pct/100-0.48)*0.02;
      eq *= (1+drift);
      let x=j*(W/(steps-1)), y=H-10-Math.max(0,Math.min((eq-80)/120,1))*(H-20);
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle=colors[i]; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=colors[i]; ctx.font='9px JetBrains Mono'; ctx.textAlign='left';
    ctx.fillText(pct+'th', W-28, H-10-Math.max(0,Math.min((eq-80)/120,1))*(H-20)+4);
  });
}

// ============================================================
// OPTIONS CHAIN
// ============================================================
function initOptions() {
  const el = document.getElementById('options-chain');
  if (!el) return;
  const spot = 182.43;
  const strikes = [170,172.5,175,177.5,180,182.5,185,187.5,190,192.5,195,197.5,200];
  el.innerHTML = strikes.map(k => {
    const atm = Math.abs(k-spot)<2;
    const itm_c = k < spot;
    const itm_p = k > spot;
    const dist = (k-spot)/spot;
    const iv_c = (28.4 + Math.abs(dist)*120 + (itm_c?-2:2)).toFixed(1);
    const iv_p = (30.2 + Math.abs(dist)*140 + (itm_p?-2:2)).toFixed(1);
    const d_c = (0.5 - dist*2).toFixed(3);
    const g = (0.04 - Math.abs(dist)*0.1).toFixed(4);
    const call_bid = Math.max(0.01, (spot-k+rand(0.5,2))).toFixed(2);
    const call_ask = (parseFloat(call_bid)+rand(0.1,0.5)).toFixed(2);
    const put_bid = Math.max(0.01, (k-spot+rand(0.5,2))).toFixed(2);
    const put_ask = (parseFloat(put_bid)+rand(0.1,0.5)).toFixed(2);
    const oi_c = randInt(500,5000);
    const oi_p = randInt(500,5000);
    const vol_c = randInt(50,2000);
    const vol_p = randInt(50,2000);
    return `<div class="chain-row ${atm?'atm':''}" onclick="showToast('Option Selected','${k} Strike selected','info')">
      <div class="cc cs ask">${call_ask}</div>
      <div class="cc cs bid">${call_bid}</div>
      <div class="cc cs iv">${iv_c}%</div>
      <div class="cc cs">${d_c}</div>
      <div class="cc cs">${g}</div>
      <div class="cc cs">${oi_c.toLocaleString()}</div>
      <div class="cc cs">${vol_c.toLocaleString()}</div>
      <div class="strike-c">$${k}</div>
      <div class="cc ps">${vol_p.toLocaleString()}</div>
      <div class="cc ps">${oi_p.toLocaleString()}</div>
      <div class="cc ps">${g}</div>
      <div class="cc ps">${(parseFloat(d_c)-1).toFixed(3)}</div>
      <div class="cc ps iv">${iv_p}%</div>
      <div class="cc ps bid">${put_bid}</div>
      <div class="cc ps ask">${put_ask}</div>
    </div>`;
  }).join('');
}

// ============================================================
// SCREENER
// ============================================================
function initScreener() {
  const el = document.getElementById('screener-tbody');
  if (!el) return;
  const tickers = [
    ['NVDA','NVIDIA Corp',924.70,5.82,82e6,'$2.3T',45.2,42,3.8,12.4,'A+'],
    ['AMD','Advanced Micro',184.20,4.14,48e6,'$298B',38.1,38,4.2,8.1,'A'],
    ['META','Meta Platforms',512.30,2.64,24e6,'$1.3T',24.8,52,2.4,15.2,'A'],
    ['AAPL','Apple Inc.',182.43,1.21,58e6,'$2.8T',28.4,48,1.8,4.2,'B+'],
    ['MSFT','Microsoft Corp',411.80,0.84,22e6,'$3.1T',32.1,56,1.6,7.8,'A'],
    ['AMZN','Amazon.com',198.40,1.84,40e6,'$2.1T',42.1,44,2.8,18.4,'A'],
    ['TSLA','Tesla Inc',215.80,-3.21,88e6,'$688B',68.4,28,8.2,-12.4,'C'],
    ['PLTR','Palantir',22.40,-2.87,124e6,'$48B',182.4,62,6.4,148.2,'B'],
    ['SMH','VanEck Semi ETF',248.10,3.84,12e6,'$18B',28.4,54,3.2,24.1,'A'],
  ];
  el.innerHTML = tickers.map(t => {
    const up = t[3]>=0;
    return `<tr onclick="setSymbol('${t[0]}')">
      <td><div class="td-sym">${t[0]}</div></td>
      <td><div class="td-name">${t[1]}</div></td>
      <td class="td-mono">$${t[2]}</td>
      <td class="${up?'td-up':'td-dn'}">${up?'+':''}${t[3]}%</td>
      <td class="td-mono">${(t[4]/1e6).toFixed(0)}M</td>
      <td class="td-mono">${t[5]}</td>
      <td class="td-mono">${t[6]}</td>
      <td class="td-mono" style="color:${t[7]>70?'var(--dn)':t[7]<30?'var(--up)':'var(--warn)'}">${t[7]}</td>
      <td class="td-mono">${t[8]}%</td>
      <td class="${t[9]>=0?'td-up':'td-dn'}">${t[9]>=0?'+':''}${t[9]}%</td>
      <td><span class="badge ${t[10].startsWith('A')?'up':t[10].startsWith('B')?'neutral':'dn'}">${t[10]}</span></td>
      <td><span class="badge up">BUY</span></td>
    </tr>`;
  }).join('');
}

// ============================================================
// RESEARCH
// ============================================================
function initResearch() {
  // sentiment bars
  const el = document.getElementById('sent-bars');
  if (el) {
    const syms = [{s:'AAPL',v:72,up:true},{s:'TSLA',v:38,up:false},{s:'NVDA',v:84,up:true},{s:'SPY',v:61,up:true},{s:'BTC',v:78,up:true}];
    el.innerHTML = syms.map(s=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="font-size:10px;font-weight:600;width:36px">${s.s}</span>
      <div style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden">
        <div style="width:${s.v}%;height:100%;background:${s.up?'var(--up)':'var(--dn)'};border-radius:3px"></div>
      </div>
      <span style="font-family:var(--mono);font-size:10px;color:${s.up?'var(--up)':'var(--dn)'}">${s.v}%</span>
    </div>`).join('');
  }
  // news
  const ne = document.getElementById('research-news');
  if (ne) {
    const news = [
      {time:'09:32',src:'Reuters',title:'Fed signals rate pause through H1 2026, Powell speech due 2pm',impact:'+0.4%'},
      {time:'09:18',src:'Bloomberg',title:'NVDA Q4 earnings beat: $22.1B revenue vs $20.6B expected, raises Q1 guide',impact:'+5.8%'},
      {time:'08:55',src:'WSJ',title:'Apple M4 chip benchmarks show 40% performance improvement',impact:'+1.2%'},
      {time:'08:30',src:'CNBC',title:'CPI data: headline 2.8% vs 3.0% expected, core 3.1% vs 3.3% expected',impact:'+0.6%'},
      {time:'08:10',src:'FT',title:'ECB cuts rates 25bps to 3.50%, signals two more cuts in 2026',impact:'EUR-1.2%'},
      {time:'07:42',src:'MarketWatch',title:'Treasury yields fall after CPI data, 10Y at 4.28%',impact:'-0.05%'},
      {time:'07:20',src:'Seeking Alpha',title:'Goldman upgrades TSLA to Buy: $280 price target, FSD catalyst',impact:'+2.1%'},
      {time:'06:48',src:'Barclays',title:'Research note: Technology sector remains our top pick for 2026',impact:''},
    ];
    ne.innerHTML = news.map(n=>`<div style="padding:8px 12px;border-bottom:1px solid rgba(42,46,57,.4);cursor:pointer;transition:background .08s" onmouseover="this.style.background='#1E222D'" onmouseout="this.style.background=''">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px">
        <span style="font-family:var(--mono);font-size:9px;color:var(--tx3)">${n.time}</span>
        <span style="font-size:9px;color:var(--brand);font-weight:600">${n.src}</span>
        ${n.impact?`<span style="font-family:var(--mono);font-size:9px;margin-left:auto;color:${n.impact.startsWith('+')?'var(--up)':'var(--dn)'}">${n.impact}</span>`:''}
      </div>
      <div style="font-size:11px;color:var(--tx);line-height:1.4">${n.title}</div>
    </div>`).join('');
  }
}

// ============================================================
// AUTOPILOT
// ============================================================
function initAutopilot() {
  const pe = document.getElementById('proposals');
  if (pe) {
    const props = [
      {sym:'NVDA',dir:'buy',price:924.70,size:20,reason:'EMA cross + RSI 42 + Earnings catalyst + positive sentiment 84%. Strong momentum setup.',conf:82,tp:980,sl:890},
      {sym:'TSLA',dir:'sell',price:215.80,size:30,reason:'Price below 50D MA + RSI 72 (overbought) + Negative social sentiment 38%. Reversal signal.',conf:71,tp:200,sl:228},
      {sym:'SPY',dir:'buy',price:521.40,size:100,reason:'Market breadth improving + VIX declining + Bullish macro backdrop (CPI beat). Risk-on.',conf:68,tp:535,sl:512},
      {sym:'META',dir:'buy',price:512.30,size:15,reason:'Analyst upgrade + momentum + technical breakout above resistance 510.',conf:74,tp:540,sl:498},
    ];
    pe.innerHTML = props.map(p=>`<div class="proposal-card">
      <div class="prop-hdr">
        <span class="prop-sym">${p.sym}</span>
        <span class="prop-dir ${p.dir}">${p.dir.toUpperCase()} @ $${p.price.toFixed(2)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--warn);margin-left:8px">${p.conf}% conf</span>
      </div>
      <div class="prop-reason">${p.reason}</div>
      <div class="prop-meta">
        <span>Size: ${p.size}</span>
        <span>TP: $${p.tp}</span>
        <span>SL: $${p.sl}</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px">
        <button class="btn-sm up" onclick="this.closest('.proposal-card').style.opacity='.5';showToast('Trade Approved','${p.dir.toUpperCase()} ${p.sym} order placed','success')">Approve</button>
        <button class="btn-sm neutral" onclick="showToast('Modified','Edit proposal in order ticket','info')">Modify</button>
        <button class="btn-sm dn" onclick="this.closest('.proposal-card').remove();showToast('Rejected','Proposal rejected','warn')">Reject</button>
      </div>
    </div>`).join('');
  }
  const te = document.getElementById('agent-thoughts');
  if (te) {
    const thoughts = [
      {t:'09:34:18',txt:'Market breadth positive: 68% of S&P above 200D MA. Sector rotation into tech.'},
      {t:'09:32:41',txt:'NVDA signal confirmed: EMA(12) crossed above EMA(26) at 09:32. RSI at 42 - room to run.'},
      {t:'09:30:12',txt:'CPI data better than expected. Probability of Fed cut in May increased to 62% (from 48%).'},
      {t:'09:28:55',txt:'Screening universe: 48 momentum signals, 12 mean-reversion. Filtering by risk budget.'},
      {t:'09:25:00',txt:'Pre-market analysis complete. VIX at 16.4 - low fear environment, favor long equity.'},
    ];
    te.innerHTML = thoughts.map(t=>`<div class="think-entry">
      <div class="think-time">${t.t}</div>
      <div class="think-text">${t.txt}</div>
    </div>`).join('');
  }
}

// ============================================================
// STRATEGY
// ============================================================
function initStrategy() {
  const c = document.getElementById('ss-heatmap');
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = 120;
  const ctx=c.getContext('2d'), W=c.width, H=120;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const rows=8, cols=12;
  const cW=(W-40)/cols, cH=(H-20)/rows;
  for (let r=0; r<rows; r++) {
    for (let c2=0; c2<cols; c2++) {
      const v = Math.random()*2.5;
      const col = v>1.5?`rgba(8,153,129,${v/3})`:v<0.8?`rgba(242,54,69,${(1.5-v)/2})`:`rgba(247,147,26,${v/2.5})`;
      ctx.fillStyle=col;
      ctx.fillRect(40+c2*cW, 20+r*cH, cW-1, cH-1);
    }
    ctx.fillStyle='#787B86'; ctx.font='8px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText((8+r)+':', 36, 20+r*cH+cH/2+3);
  }
  for (let c2=0; c2<cols; c2++) {
    ctx.fillStyle='#787B86'; ctx.font='8px JetBrains Mono'; ctx.textAlign='center';
    ctx.fillText((20+c2*2).toString(), 40+c2*cW+cW/2, 14);
  }
  ctx.fillStyle='#787B86'; ctx.font='8px Inter'; ctx.textAlign='left';
  ctx.fillText('slow →', 40, 10);
  ctx.save(); ctx.translate(10, 20+rows*cH/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('fast →', 0, 0); ctx.restore();
}

// ============================================================
// PLATFORM
// ============================================================
function initPlatform() {
  const c = document.getElementById('plat-latency');
  if (!c) return;
  c.width = c.parentElement.clientWidth; c.height = 100;
  const ctx=c.getContext('2d'), W=c.width, H=100;
  ctx.fillStyle='#131722'; ctx.fillRect(0,0,W,H);
  const lats = Array.from({length:80},()=>rand(0.5,4.5));
  const maxL=Math.max(...lats);
  ctx.beginPath();
  lats.forEach((v,i)=>{ let x=i*(W/(lats.length-1)), y=H-10-((v/maxL)*(H-20)); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.strokeStyle='#06B6D4'; ctx.lineWidth=1.2; ctx.stroke();
  // threshold line
  ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(242,54,69,0.5)'; ctx.lineWidth=1;
  const thY = H-10-((5/maxL)*(H-20));
  ctx.beginPath(); ctx.moveTo(0,thY); ctx.lineTo(W,thY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(242,54,69,0.7)'; ctx.font='8px JetBrains Mono'; ctx.textAlign='left';
  ctx.fillText('5ms SLA', 4, thY-2);
}

// ============================================================
// WATCHLIST
// ============================================================
function initWatchlist() {
  const wl = [
    {sym:'AAPL',name:'Apple',p:182.43,c:+1.21},
    {sym:'TSLA',name:'Tesla',p:215.80,c:-3.21},
    {sym:'NVDA',name:'NVIDIA',p:924.70,c:+5.82},
    {sym:'SPY',name:'S&P 500 ETF',p:521.40,c:+0.41},
    {sym:'MSFT',name:'Microsoft',p:411.80,c:+0.84},
    {sym:'AMZN',name:'Amazon',p:198.40,c:+1.84},
    {sym:'META',name:'Meta',p:512.30,c:+2.64},
    {sym:'GOOGL',name:'Alphabet',p:184.20,c:+1.12},
    {sym:'BTC',name:'Bitcoin',p:98420,c:+1.28},
    {sym:'ETH',name:'Ethereum',p:3420.80,c:+2.84},
    {sym:'QQQ',name:'Nasdaq ETF',p:448.20,c:+0.78},
    {sym:'GLD',name:'Gold ETF',p:228.40,c:+0.44},
  ];
  window.watchlistData = wl;
  renderWatchlist();
}

function renderWatchlist() {
  const el = document.getElementById('wl-content');
  if (!el) return;
  const wl = window.watchlistData || [];
  el.innerHTML = `<div class="wl-hdr"><span>SYMBOL</span><span>PRICE / CHG</span></div>` +
    wl.map(w=>`<div class="wl-row" onclick="setSymbol('${w.sym}')">
      <div><div class="wl-sym">${w.sym}</div><div class="wl-name">${w.name}</div></div>
      <div class="wl-p wl-p-${w.sym}" id="wlp-${w.sym}">$${w.p.toFixed(w.p>1000?0:2)}</div>
      <div class="wl-c ${w.c>=0?'up':'dn'}">${w.c>=0?'+':''}${w.c.toFixed(2)}%</div>
    </div>`).join('');
}

function initMiniPositions() {
  const el = document.getElementById('mini-positions');
  if (!el) return;
  const pos = [
    {sym:'AAPL',qty:200,entry:168.20,last:182.43,pnl:2846},
    {sym:'NVDA',qty:50,entry:840.00,last:924.70,pnl:4235},
    {sym:'SPY',qty:150,entry:498.20,last:521.40,pnl:3480},
    {sym:'MSFT',qty:75,entry:382.10,last:411.80,pnl:2228},
  ];
  el.innerHTML = pos.map(p=>`<div style="padding:6px 10px;border-bottom:1px solid var(--bdr);cursor:pointer;transition:background .08s" onclick="setSymbol('${p.sym}')" onmouseover="this.style.background='#1E222D'" onmouseout="this.style.background=''">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
      <span style="font-weight:700;font-size:12px">${p.sym}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--up)">+$${p.pnl.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:10px;color:var(--tx3)">${p.qty} @ $${p.entry}</span>
      <span style="font-family:var(--mono);font-size:10px">$${p.last}</span>
    </div>
  </div>`).join('');
}

function initSidebarNews() {
  const el = document.getElementById('sidebar-news');
  if (!el) return;
  const news = [
    {t:'09:32',src:'Reuters',h:'Fed signals rate pause'},
    {t:'09:18',src:'Bloomberg',h:'NVDA earnings beat expectations'},
    {t:'08:55',src:'WSJ',h:'Apple M4 chip launched'},
    {t:'08:30',src:'CNBC',h:'CPI shows inflation cooling'},
    {t:'08:10',src:'FT',h:'ECB cuts rates 25bps'},
    {t:'07:42',src:'MW',h:'Treasury yields fall on CPI'},
  ];
  el.innerHTML = news.map(n=>`<div style="padding:6px 10px;border-bottom:1px solid var(--bdr);cursor:pointer" onmouseover="this.style.background='#1E222D'" onmouseout="this.style.background=''">
    <div style="display:flex;gap:5px;margin-bottom:2px"><span style="font-family:var(--mono);font-size:9px;color:var(--tx3)">${n.t}</span><span style="font-size:9px;color:var(--brand)">${n.src}</span></div>
    <div style="font-size:11px;color:var(--tx);line-height:1.4">${n.h}</div>
  </div>`).join('');
}

// ============================================================
// COMMAND PALETTE
// ============================================================
const CMD_LIST = [
  {cat:'Navigate',name:'Trading View',desc:'Chart & order entry',key:'T',action:'switchView("trading")'},
  {cat:'Navigate',name:'Dashboard',desc:'Market overview',key:'D',action:'switchView("dashboard")'},
  {cat:'Navigate',name:'Portfolio',desc:'Positions & P&L',key:'P',action:'switchView("portfolio")'},
  {cat:'Navigate',name:'Backtest',desc:'Strategy testing',key:'B',action:'switchView("backtest")'},
  {cat:'Navigate',name:'Options Chain',desc:'Options analytics',key:'O',action:'switchView("options")'},
  {cat:'Navigate',name:'Screener',desc:'Stock screener',key:'S',action:'switchView("screener")'},
  {cat:'Navigate',name:'Autopilot / AI',desc:'AI trading agents',key:'A',action:'switchView("autopilot")'},
  {cat:'Navigate',name:'Risk',desc:'Risk management',key:'R',action:'switchView("risk")'},
  {cat:'Navigate',name:'Economic Calendar',desc:'Macro events',key:'',action:'switchView("macro")'},
  {cat:'Navigate',name:'Research',desc:'News & fundamentals',key:'',action:'switchView("research")'},
  {cat:'Navigate',name:'Compliance',desc:'Compliance checks',key:'',action:'switchView("compliance")'},
  {cat:'Navigate',name:'Platform',desc:'Observability & logs',key:'',action:'switchView("platform")'},
  {cat:'Trading',name:'Buy AAPL',desc:'Long 100 @ market',key:'',action:'showToast("Order","Buy AAPL 100 @ market","success")'},
  {cat:'Trading',name:'Sell AAPL',desc:'Short 100 @ market',key:'',action:'showToast("Order","Sell AAPL 100 @ market","warn")'},
  {cat:'Trading',name:'Close All Positions',desc:'Market close all',key:'',action:'showToast("Warning","Close all? Confirm first","warn")'},
  {cat:'Chart',name:'Toggle Candlestick/Line',desc:'Chart type',key:'',action:'toggleChartType()'},
  {cat:'Chart',name:'Add RSI Indicator',desc:'RSI(14)',key:'',action:'addIndicator()'},
  {cat:'Chart',name:'Start Market Replay',desc:'Historical replay mode',key:'',action:'toggleReplayBar()'},
  {cat:'Workspace',name:'Save Layout',desc:'Save current workspace',key:'',action:'showToast("Saved","Layout saved","success")'},
  {cat:'Workspace',name:'New Alert',desc:'Create price alert',key:'',action:'switchView("alerts")'},
];
let cmdSel = 0;

function openCmd() {
  document.getElementById('cmd-overlay').classList.add('open');
  document.getElementById('cmd-in').value='';
  filterCmd('');
  document.getElementById('cmd-in').focus();
}
function closeCmd() { document.getElementById('cmd-overlay').classList.remove('open'); }
function filterCmd(q) {
  const filtered = q ? CMD_LIST.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())||c.desc.toLowerCase().includes(q.toLowerCase())) : CMD_LIST;
  renderCmdResults(filtered);
}
function renderCmdResults(items) {
  const el = document.getElementById('cmd-results');
  if (!el) return;
  const cats = [...new Set(items.map(i=>i.cat))];
  el.innerHTML = cats.map(cat => `<div class="cmd-sec">${cat}</div>` +
    items.filter(i=>i.cat===cat).map((i,idx)=>`<div class="cmd-item" onclick="${i.action};closeCmd()" id="cmd-item-${idx}">
      <div class="cmd-ico"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,6 7,9 12,3"/></svg></div>
      <span class="cmd-name">${i.name}</span>
      <span class="cmd-desc">${i.desc}</span>
      ${i.key?`<span class="cmd-key">${i.key}</span>`:''}
    </div>`).join('')
  ).join('');
}

// ============================================================
// TOAST
// ============================================================
function showToast(title, msg, type='info') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button onclick="this.parentElement.remove()" style="color:var(--tx3);margin-top:1px">✕</button>`;
  wrap.appendChild(t);
  setTimeout(()=>{ if(t.parentElement) t.remove(); }, 4000);
}

// ============================================================
// SYMBOL / CHART CONTROLS
// ============================================================
function setSymbol(sym) {
  currentSym = sym;
  const s = SYMBOLS[sym] || {name:sym, exchange:'MARKET', base:100, vol:2};
  chartBars = genOHLCV(180, s.base, s.vol);
  document.getElementById('ch-sym').textContent = sym;
  const ot = document.getElementById('ot-sym');
  if (ot) ot.textContent = sym;
  const last = chartBars[chartBars.length-1].c;
  const first = chartBars[0].c;
  const chgAbs = (last-first).toFixed(2);
  const chgPct = ((last/first-1)*100).toFixed(2);
  document.getElementById('ch-price').textContent = '$'+last.toFixed(2);
  const chgEl = document.getElementById('ch-chg');
  chgEl.textContent = (chgAbs>=0?'+':'')+chgAbs+' ('+(chgAbs>=0?'+':'')+chgPct+'%)';
  chgEl.className = 'ch-chg '+(chgAbs>=0?'up':'dn');
  document.getElementById('ch-o').textContent = chartBars[chartBars.length-1].o.toFixed(2);
  document.getElementById('ch-h').textContent = chartBars[chartBars.length-1].h.toFixed(2);
  document.getElementById('ch-l').textContent = chartBars[chartBars.length-1].l.toFixed(2);
  switchView('trading');
  setTimeout(initCharts,50);
}

function setTF(el, tf) {
  currentTF = tf;
  document.querySelectorAll('.tf-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  chartBars = genOHLCV(180, chartBars[chartBars.length-1].c, SYMBOLS[currentSym]?.vol||2);
  setTimeout(initCharts,50);
  showToast('Timeframe',tf+' chart loaded','info');
}

function toggleChartType() {
  chartType = chartType==='candles'?'line':'candles';
  document.getElementById('chart-type-lbl').textContent = chartType==='candles'?'Candles':'Line';
  setTimeout(initCharts,10);
}
function addIndicator() {
  showToast('Indicator','RSI, MACD, BB added','info');
}
function setDraw(el, tool) {
  currentDraw = tool;
  document.querySelectorAll('.draw-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}
function clearDrawings() {
  showToast('Drawings','All drawings cleared','info');
}
function setExp(el, exp) {
  document.querySelectorAll('.exp-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  initOptions();
}
function togglePill(el) { el.classList.toggle('active'); }
function activatePreset(el) {
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}
function toggleReplayBar() {
  replayActive = !replayActive;
  document.getElementById('replay-bar').style.display = replayActive ? 'flex' : 'none';
  if (replayActive) showToast('Replay','Market replay mode activated','info');
}
function replayToggle() { showToast('Replay','Replay playing...','info'); }
function replayStep(d) { showToast('Replay',d>0?'+1 bar':'-1 bar','info'); }
function cycleSpeed() {
  const speeds = [0.5,1,2,5,10];
  const idx = speeds.indexOf(replaySpeed);
  replaySpeed = speeds[(idx+1)%speeds.length];
  document.getElementById('rb-speed').textContent = replaySpeed+'x';
}
function cycleModes(el) {
  const modes = ['live','paper','bt','replay'];
  const labels = ['LIVE','PAPER','BACKTEST','REPLAY'];
  const idx = modes.indexOf([...el.classList].find(c=>modes.includes(c)));
  const next = (idx+1)%modes.length;
  el.className = 'mode-badge ' + modes[next];
  el.innerHTML = `<div class="mode-dot"></div>${labels[next]}`;
}
function updateOrderType(t) {
  const w = document.getElementById('limit-price-wrap');
  if (w) w.style.display = ['Limit','Stop Limit','Stop'].includes(t)?'block':'none';
}
function setDir(dir) {
  document.getElementById('dir-buy').classList.toggle('active', dir==='buy');
  document.getElementById('dir-sell').classList.toggle('active', dir==='sell');
  const btn = document.getElementById('ot-submit-btn');
  if (btn) { btn.className='ot-submit '+dir; btn.textContent = dir.toUpperCase()+' '+(document.getElementById('ord-qty')?.value||100)+' '+(document.getElementById('ot-sym')?.textContent||'AAPL'); }
}
function updateSummary() {
  const qty = parseInt(document.getElementById('ord-qty')?.value||100);
  const limit = parseFloat(document.getElementById('ord-limit')?.value||182);
  const val = qty*limit;
  const el = document.getElementById('ord-val');
  if (el) el.textContent = '$'+val.toLocaleString();
  const pe = document.getElementById('ord-pct');
  if (pe) pe.textContent = (val/382450*100).toFixed(2)+'%';
}
function submitOrder() {
  const qty = document.getElementById('ord-qty')?.value||100;
  const sym = document.getElementById('ot-sym')?.textContent||'AAPL';
  showToast('Order Submitted','BUY '+qty+' '+sym+' order placed — confirming...','info');
  setTimeout(()=>showToast('Order Filled','BUY '+qty+' '+sym+' filled @ $'+chartBars[chartBars.length-1].c.toFixed(2),'success'),800);
}
function runMonteCarlo2() { runMonteCarlo(); }

// ============================================================
// STATUS BAR TAPE
// ============================================================
function initStatusBar() {
  const el = document.getElementById('sb-tape');
  if (!el) return;
  const items = Object.entries(SYMBOLS).map(([s,d])=>`<div class="tape-item"><span class="tape-sym">${s}</span><span class="tape-val">$${d.base.toFixed(d.base>1000?0:2)}</span><span class="tape-chg up">+0.82%</span></div>`);
  const doubled = [...items,...items].join('');
  el.innerHTML = doubled;
}

// ============================================================
// LIVE TICKS
// ============================================================
function tickPrices() {
  // Main chart price
  if (chartBars.length > 0) {
    const last = chartBars[chartBars.length-1];
    const sym = SYMBOLS[currentSym] || {vol:2};
    const newC = Math.max(0.01, last.c + (Math.random()-0.48)*sym.vol*0.05);
    last.c = newC;
    last.h = Math.max(last.h, newC);
    last.l = Math.min(last.l, newC);
    const priceEl = document.getElementById('ch-price');
    if (priceEl) {
      const prev = parseFloat(priceEl.textContent.replace('$',''));
      priceEl.textContent = '$'+newC.toFixed(2);
      priceEl.className = 'ch-price '+(newC>prev?'flash-up':'flash-dn');
    }
    document.getElementById('ot-price') && (document.getElementById('ot-price').textContent='$'+newC.toFixed(2));
  }
  // watchlist ticks
  if (window.watchlistData) {
    window.watchlistData.forEach(w=>{
      w.p = Math.max(0.01, w.p*(1+(Math.random()-0.49)*0.003));
      const el = document.getElementById('wlp-'+w.sym);
      if (el) el.textContent = '$'+w.p.toFixed(w.p>1000?0:2);
    });
  }
  // Re-render chart if trading view active
  const tv = document.getElementById('view-trading');
  if (tv && tv.classList.contains('active')) {
    renderMainChart();
    renderRSIChart();
  }
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const now = new Date();
  const h=now.getHours().toString().padStart(2,'0');
  const m=now.getMinutes().toString().padStart(2,'0');
  const s=now.getSeconds().toString().padStart(2,'0');
  document.getElementById('tb-clock').textContent = h+':'+m+':'+s+' ET';
  // latency
  const lat = (Math.random()*2+1).toFixed(0)+'ms';
  document.getElementById('latency-val').textContent = lat;
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key==='Escape') { closeCmd(); }
  if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openCmd(); }
  if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='b') { e.preventDefault(); switchView('backtest'); }
  if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='p') { e.preventDefault(); switchView('portfolio'); }
  if (e.key==='F1') { e.preventDefault(); switchView('trading'); }
});

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
  const tv = document.getElementById('view-trading');
  if (tv && tv.classList.contains('active')) setTimeout(initCharts,50);
});

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  initWatchlist();
  initMiniPositions();
  initSidebarNews();
  initStatusBar();
  updateClock();
  setInterval(tickPrices, 800);
  setInterval(updateClock, 1000);
  // init dashboard data for when navigating
  setTimeout(()=>{
    renderMovers();
    renderNews();
    renderIndices();
  }, 100);
});
</script>
</body>
</html>
"""

f.write(js)
f.close()
print("Part 9 done")
