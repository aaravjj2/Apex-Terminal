/**
 * MarketTape — Bloomberg Terminal Edition
 * Scrolling ticker tape with live prices from backend API + simulator fallback
 */
// ─── Bloomberg palette ───────────────────────────────────────────────────────
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect, useRef } from 'react';
import { streamSimulator, type StreamTick } from '../stores/streamSimulator';

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SPY', 'TSLA', 'AMZN', 'GOOG', 'META', 'BTC', 'ETH'];
const QUOTE_INTERVAL_MS = 15_000;

async function fetchQuote(symbol: string): Promise<number|null> {
  try {
    const res = await fetch('/api/v1/market-data/quote', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({symbol})
    });
    if(!res.ok) return null;
    const d=await res.json();
    return typeof d.price==='number'&&d.price>0?d.price:null;
  } catch { return null; }
}

interface MarketTapeProps { testId?: string; }

export function MarketTape({ testId='ui2-market-tape' }: MarketTapeProps) {
  const [ticks, setTicks] = useState<StreamTick[]>([]);
  const [status, setStatus] = useState<'live'|'replay'|'offline'|'disconnected'>('disconnected');
  const prevPricesRef = useRef<Record<string,number>>({});

  useEffect(() => {
    let cancelled=false;
    function applyRealPrice(symbol:string, price:number) {
      if(cancelled) return;
      const prev=prevPricesRef.current[symbol]??price;
      const change=Math.round((price-prev)*100)/100;
      const changePct=prev>0?Math.round(((price-prev)/prev)*10000)/100:0;
      prevPricesRef.current[symbol]=price;
      const tick:StreamTick={symbol,price,change,changePct,volume:0,timestamp:Date.now(),sequence:0};
      setTicks(p=>{const u=[...p];const i=u.findIndex(t=>t.symbol===symbol);
        if(i>=0)u[i]=tick;else u.push(tick);
        return u.sort((a,b)=>a.symbol.localeCompare(b.symbol));});
    }
    async function fetchAll() {
      let ok=false;
      await Promise.all(SYMBOLS.map(async s=>{
        const p=await fetchQuote(s); if(p!==null){ok=true;applyRealPrice(s,p);}
      }));
      if(!cancelled) setStatus(ok?'live':'offline');
      return ok;
    }
    fetchAll().then(ok=>{
      if(cancelled) return;
      if(!ok){ streamSimulator.reset(); streamSimulator.start(2000);
        setStatus(streamSimulator.status as 'live'|'replay'|'offline'|'disconnected');
        try{(window as any).__streamSimulator=streamSimulator;}catch{/**/}
      }
    });
    const unsub=streamSimulator.subscribe(tick=>{
      if(cancelled) return;
      setTicks(p=>{
        if(prevPricesRef.current[tick.symbol]) return p;
        const u=[...p];const i=u.findIndex(t=>t.symbol===tick.symbol);
        if(i>=0)u[i]=tick;else u.push(tick);
        return u.sort((a,b)=>a.symbol.localeCompare(b.symbol));
      });
    });
    const poll=setInterval(fetchAll,QUOTE_INTERVAL_MS);
    try{(window as any).__streamSimulator=streamSimulator;}catch{/**/}
    return ()=>{cancelled=true;unsub();clearInterval(poll);streamSimulator.stop();
      try{delete(window as any).__streamSimulator;}catch{/**/}};
  },[]);

  const statusColor=status==='live'?GREEN:status==='replay'?AMBER:SUBTLE;

  return (
    <div data-testid={testId} data-stream-status={status}
      style={{display:'flex',alignItems:'center',gap:4,padding:'3px 12px',
        background:PANEL,borderBottom:`1px solid ${BORDER}`,
        fontFamily:MONO,overflow:'hidden',height:28,flexShrink:0}}>

      {/* Status badge */}
      <div data-testid={`${testId}-status`}
        style={{display:'flex',alignItems:'center',gap:4,padding:'2px 7px',
          border:`1px solid ${statusColor}44`,background:`${statusColor}18`,
          borderRadius:2,flexShrink:0}}>
        <span style={{width:5,height:5,borderRadius:'50%',background:statusColor,display:'inline-block'}}/>
        <span style={{fontSize:9,color:statusColor,letterSpacing:'0.1em',fontWeight:700}}>
          {status==='live'?'LIVE':status==='replay'?'REPLAY':'OFFLINE'}
        </span>
      </div>

      {/* Separator */}
      <span style={{color:BORDER,fontSize:12,flexShrink:0}}>│</span>

      {/* Ticks */}
      <div style={{display:'flex',gap:14,flex:1,overflow:'hidden',alignItems:'center'}}>
        {ticks.map(tick=>(
          <div key={tick.symbol} data-testid={`${testId}-tick-${tick.symbol}`}
            style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
            <span style={{fontSize:10,color:TEXT,fontWeight:700,letterSpacing:'0.06em'}}>{tick.symbol}</span>
            <span style={{fontSize:11,color:TEXT,fontFamily:MONO}}>{tick.price.toFixed(2)}</span>
            <span data-testid={`${testId}-change-${tick.symbol}`}
              style={{fontSize:10,color:tick.change>=0?GREEN:RED,fontFamily:MONO}}>
              {tick.change>=0?'+':''}{tick.changePct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Hidden snapshot for E2E */}
      <div aria-hidden="true" style={{position:'absolute',width:1,height:1,overflow:'hidden',opacity:0}}>
        {ticks.map(t=>(
          <span key={t.symbol} data-testid={`ui2-stream-latest-${t.symbol}`}>{t.price.toFixed(2)}</span>
        ))}
      </div>

      {/* Sequence */}
      <div data-testid={`${testId}-sequence`}
        style={{color:SUBTLE,fontSize:9,flexShrink:0,marginLeft:6}}>
        SEQ:{ticks.length>0?Math.max(...ticks.map(t=>t.sequence)):0}
      </div>
    </div>
  );
}

