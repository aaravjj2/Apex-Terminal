// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'
const API_BASE='/api/v1'

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatCard=({label,value,sub,color}:{label:string,value:string,sub?:string,color?:string})=>(
  <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 14px',minWidth:120}}>
    <div style={{fontSize:9,letterSpacing:'0.1em',color:SUBTLE,marginBottom:4}}>{label}</div>
    <div style={{fontSize:18,fontFamily:MONO,fontWeight:700,color:color||TEXT}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:SUBTLE,marginTop:2}}>{sub}</div>}
  </div>
)

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Metrics {
  uptime_seconds: number;
  feed_latency_avg_ms: number;
  order_latency_avg_ms: number;
  bar_processing_avg_ms: number;
  dropped_messages: number;
  ws_messages_received: number;
  ws_messages_sent: number;
  error_count: number;
}

interface LatencyPoint { timestamp: string; value: number; }

function drawLatencyChart(canvas: HTMLCanvasElement, points: LatencyPoint[]) {
  const ctx = canvas.getContext('2d'); if(!ctx||points.length<2) return;
  const {width:W,height:H}=canvas;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
  const vals=points.map(p=>p.value);
  const mx=Math.max(...vals,1),mn=0;
  const toY=(v:number)=>H-Math.round(((v-mn)/(mx-mn))*(H-8))-4;
  const toX=(i:number)=>Math.round((W/(vals.length-1))*i);
  // grid
  ctx.strokeStyle=BORDER; ctx.lineWidth=1;
  for(let r=0;r<4;r++){const y=Math.round(H*r/4);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // area
  ctx.beginPath(); ctx.moveTo(toX(0),toY(vals[0]));
  vals.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
  ctx.lineTo(toX(vals.length-1),H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle=`${BLUE}22`; ctx.fill();
  // line
  ctx.beginPath(); ctx.strokeStyle=BLUE; ctx.lineWidth=1.5; ctx.moveTo(toX(0),toY(vals[0]));
  vals.forEach((v,i)=>ctx.lineTo(toX(i),toY(v))); ctx.stroke();
  // last value dot
  const li=vals.length-1; ctx.beginPath(); ctx.arc(toX(li),toY(vals[li]),3,0,Math.PI*2);
  ctx.fillStyle=BLUE; ctx.fill();
}

type PerfTab='overview'|'latency'|'ws'|'system';

export function PerformanceDashboard() {
  const [tab,setTab]=useState<PerfTab>('overview');
  const [metrics,setMetrics]=useState<Metrics|null>(null);
  const [feedLatency,setFeedLatency]=useState<LatencyPoint[]>([]);
  const [orderLatency,setOrderLatency]=useState<LatencyPoint[]>([]);
  const [loading,setLoading]=useState(false);
  const [lastUpdate,setLastUpdate]=useState<string>('â€”');
  const [pollRate,setPollRate]=useState(5);
  const canvasFeed=useRef<HTMLCanvasElement>(null);
  const canvasOrder=useRef<HTMLCanvasElement>(null);

  const fetchMetrics=useCallback(async()=>{
    setLoading(true);
    try{
      const [mr,fr,or]=await Promise.all([
        fetch(`${API_BASE}/metrics`),
        fetch(`${API_BASE}/metrics/feed-latency?limit=60`),
        fetch(`${API_BASE}/metrics/order-latency?limit=60`)
      ]);
      if(mr.ok) setMetrics(await mr.json());
      if(fr.ok) setFeedLatency(await fr.json());
      if(or.ok) setOrderLatency(await or.json());
      setLastUpdate(new Date().toLocaleTimeString());
    }catch(e){console.error('metrics fetch failed',e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{fetchMetrics();const t=setInterval(fetchMetrics,pollRate*1000);return()=>clearInterval(t);},[pollRate,fetchMetrics]);

  useEffect(()=>{if(canvasFeed.current&&feedLatency.length>0)drawLatencyChart(canvasFeed.current,feedLatency);},[feedLatency]);
  useEffect(()=>{if(canvasOrder.current&&orderLatency.length>0)drawLatencyChart(canvasOrder.current,orderLatency);},[orderLatency]);

  const fmtUp=(s:number)=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return`${h}h ${m}m ${sec}s`;}
  const latColor=(ms:number)=>ms>200?RED:ms>100?AMBER:GREEN;

  const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO,minHeight:0}
  const tabbar:React.CSSProperties={display:'flex',gap:0,borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
  const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 14px',fontSize:10,letterSpacing:'0.08em',fontFamily:MONO,
    cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${GREEN}`:'2px solid transparent',
    color:a?GREEN:SUBTLE,textTransform:'uppercase' as const})

  return (
    <div style={S} data-testid="performance-dashboard">
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>PD</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>PERFORMANCE DASHBOARD</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:SUBTLE}}>POLL</span>
        <select value={pollRate} onChange={e=>setPollRate(Number(e.target.value))}
          style={{background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,fontSize:10,padding:'2px 6px',outline:'none',borderRadius:2}}>
          {[2,5,10,30].map(v=><option key={v} value={v}>{v}s</option>)}
        </select>
        <button onClick={fetchMetrics} style={{background:PANEL,border:`1px solid ${BORDER}`,color:loading?AMBER:TEXT,
          fontFamily:MONO,fontSize:10,padding:'3px 10px',cursor:'pointer',borderRadius:2}}>
          {loading?'UPDATING':'REFRESH'}
        </button>
        <span style={{fontSize:10,color:SUBTLE}}>UPD {lastUpdate}</span>
      </div>
      {/* Tabs */}
      <div style={tabbar}>
        {(['overview','latency','ws','system'] as PerfTab[]).map(t=>(
          <button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{flex:1,overflow:'auto',padding:14}}>
        {tab==='overview'&&(
          <>
            <div style={{display:'flex',gap:10,flexWrap:'wrap' as const,marginBottom:16}}>
              <StatCard label="UPTIME" value={metrics?fmtUp(metrics.uptime_seconds):'â€”'} color={GREEN}/>
              <StatCard label="FEED LATENCY" value={metrics?`${metrics.feed_latency_avg_ms}ms`:'â€”'}
                color={metrics?latColor(metrics.feed_latency_avg_ms):SUBTLE}
                sub={metrics&&metrics.feed_latency_avg_ms>100?'âš  HIGH':'OK'}/>
              <StatCard label="ORDER RTT" value={metrics?`${metrics.order_latency_avg_ms}ms`:'â€”'}
                color={metrics?latColor(metrics.order_latency_avg_ms):SUBTLE}/>
              <StatCard label="BAR PROC" value={metrics?`${metrics.bar_processing_avg_ms}ms`:'â€”'}/>
              <StatCard label="ERRORS" value={metrics?String(metrics.error_count):'â€”'}
                color={metrics&&metrics.error_count>0?RED:GREEN}/>
              <StatCard label="DROPPED MSG" value={metrics?String(metrics.dropped_messages):'â€”'}
                color={metrics&&metrics.dropped_messages>0?AMBER:GREEN}/>
            </div>
            {metrics&&(
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                <tbody>
                  {([
                    ['WS Messages Received',metrics.ws_messages_received],
                    ['WS Messages Sent',metrics.ws_messages_sent],
                    ['Feed Latency (avg)',`${metrics.feed_latency_avg_ms} ms`],
                    ['Order Latency (avg)',`${metrics.order_latency_avg_ms} ms`],
                    ['Bar Processing (avg)',`${metrics.bar_processing_avg_ms} ms`],
                    ['Dropped Messages',metrics.dropped_messages],
                    ['Error Count',metrics.error_count],
                    ['Uptime',fmtUp(metrics.uptime_seconds)],
                  ] as [string,string|number][]).map(([k,v])=>(
                    <tr key={k} style={{borderBottom:`1px solid ${BORDER}`}}>
                      <td style={{padding:'6px 8px',color:SUBTLE}}>{k}</td>
                      <td style={{padding:'6px 8px',color:TEXT,textAlign:'right' as const,fontFamily:MONO}}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {tab==='latency'&&(
          <div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:SUBTLE,marginBottom:6}}>FEED LATENCY â€” last {feedLatency.length} samples</div>
              <canvas ref={canvasFeed} width={800} height={120}
                style={{width:'100%',height:120,border:`1px solid ${BORDER}`,borderRadius:2,display:'block'}}/>
              <div style={{display:'flex',gap:16,marginTop:6,fontSize:10,color:SUBTLE}}>
                <span>AVG: <span style={{color:TEXT}}>{metrics?.feed_latency_avg_ms??'â€”'}ms</span></span>
                <span>SAMPLES: <span style={{color:TEXT}}>{feedLatency.length}</span></span>
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:SUBTLE,marginBottom:6}}>ORDER LATENCY â€” last {orderLatency.length} samples</div>
              <canvas ref={canvasOrder} width={800} height={120}
                style={{width:'100%',height:120,border:`1px solid ${BORDER}`,borderRadius:2,display:'block'}}/>
              <div style={{display:'flex',gap:16,marginTop:6,fontSize:10,color:SUBTLE}}>
                <span>AVG: <span style={{color:TEXT}}>{metrics?.order_latency_avg_ms??'â€”'}ms</span></span>
                <span>SAMPLES: <span style={{color:TEXT}}>{orderLatency.length}</span></span>
              </div>
            </div>
          </div>
        )}
        {tab==='ws'&&metrics&&(
          <div style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
            <StatCard label="MSG RECEIVED" value={String(metrics.ws_messages_received)} color={BLUE}/>
            <StatCard label="MSG SENT" value={String(metrics.ws_messages_sent)} color={GREEN}/>
            <StatCard label="DROPPED" value={String(metrics.dropped_messages)}
              color={metrics.dropped_messages>0?RED:GREEN} sub={metrics.dropped_messages>0?'CHECK CONN':'NOMINAL'}/>
          </div>
        )}
        {tab==='system'&&(
          <div style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
            <StatCard label="API BASE" value={API_BASE} color={BLUE}/>
            <StatCard label="POLL RATE" value={`${pollRate}s`}/>
            <StatCard label="LAST UPDATE" value={lastUpdate} color={SUBTLE}/>
            {metrics&&<StatCard label="UPTIME" value={fmtUp(metrics.uptime_seconds)} color={GREEN}/>}
          </div>
        )}
      </div>
    </div>
  );
}

interface Metrics {
    uptime_seconds: number;
    feed_latency_avg_ms: number;
    order_latency_avg_ms: number;
    bar_processing_avg_ms: number;
    dropped_messages: number;
    ws_messages_received: number;
    ws_messages_sent: number;
    error_count: number;
}

interface LatencyPoint {
    timestamp: string;
    value: number;
}

