// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const StatPill=({label,value,color}:{label:string,value:string,color?:string})=>(
  <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',
    padding:'6px 12px',background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,minWidth:80}}>
    <span style={{fontSize:9,color:SUBTLE,letterSpacing:'0.1em',marginBottom:2}}>{label}</span>
    <span style={{fontSize:12,color:color||TEXT,fontFamily:MONO,fontWeight:700}}>{value}</span>
  </div>
)

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useAutopilotStore } from '../../autopilot/store';
import { API_BASE } from '../../../config/api';
import { FinancialIntelligenceDashboard } from '../../dashboard/FinancialIntelligenceDashboard';
import { MultiAgentFinancePanel } from '../../dashboard/MultiAgentFinancePanel';
import { RealTimePnLAnalytics } from '../../dashboard/RealTimePnLAnalytics';

interface QuickStats {
  total_equity: number; open_pnl: number; day_pnl: number;
  buying_power: number; position_count: number; active_orders: number; win_rate: number;
}

const fmtUSD=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v)
const fmtPct=(v:number)=>`${(v*100).toFixed(1)}%`
const fmtPnl=(v:number)=>(v>=0?'+':'')+fmtUSD(v)

export function EnhancedCommandCenterView() {
  const [stats, setStats] = useState<QuickStats|null>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const { status: apStatus, fetchStatus } = useAutopilotStore();

  const fetchData = useCallback(async()=>{
    setLoading(true);
    try {
      const res=await fetch(`${API_BASE}/api/v1/portfolio/unified`);
      if(res.ok){
        const d=await res.json();
        setStats({total_equity:d.stats?.total_equity??0,open_pnl:d.stats?.open_pnl??0,
          day_pnl:d.stats?.day_pnl??0,buying_power:d.stats?.buying_power??0,
          position_count:d.stats?.position_count??0,active_orders:d.stats?.order_count??0,win_rate:0.65});
      }
    } catch { console.error('Failed to fetch stats'); }
    setLoading(false);
  },[]);

  useEffect(()=>{
    fetchData(); fetchStatus();
    const iv=setInterval(()=>{fetchData();fetchStatus();},30000);
    return()=>clearInterval(iv);
  },[fetchData,fetchStatus]);

  const pnlPos=(stats?.open_pnl??0)>=0;
  const apState=apStatus?.kill_switch?'KILLED':apStatus?.state?.toUpperCase()||'IDLE';
  const apColor=apStatus?.state==='running'?GREEN:apStatus?.state==='paused'?AMBER:apStatus?.kill_switch?RED:SUBTLE;
  const mktSentScore=apStatus?.sentiment?.sentiment_scores?.MARKET??0;
  const mktSentLabel=mktSentScore>0.3?'BULLISH':mktSentScore<-0.3?'BEARISH':'NEUTRAL';
  const mktSentColor=mktSentScore>0.3?GREEN:mktSentScore<-0.3?RED:SUBTLE;

  const tabs=['overview','agents','analytics'] as const;
  const tbtn=(t:string):React.CSSProperties=>({padding:'6px 16px',fontSize:10,fontFamily:MONO,
    cursor:'pointer',background:'none',border:'none',letterSpacing:'0.08em',
    borderBottom:tab===t?`2px solid ${AMBER}`:'2px solid transparent',
    color:tab===t?AMBER:SUBTLE,textTransform:'uppercase' as const})

  return (
    <div data-testid="command-center-view"
      style={{height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0,flexWrap:'wrap' as const}}>
        <span style={{fontSize:11,color:AMBER,letterSpacing:'0.1em'}}>CC</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>COMMAND CENTER</span>
        <span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${apColor}`,
          color:apColor,borderRadius:2}}>AP: {apState}</span>
        {apStatus?.sentiment&&(
          <span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${mktSentColor}`,
            color:mktSentColor,borderRadius:2}}>MKT: {mktSentLabel}</span>
        )}
        <div style={{flex:1}}/>
        <button onClick={()=>{window.dispatchEvent(new CustomEvent('navigate-risk-desk',{detail:{loadDemo:true}}));}}
          data-testid="start-risk-desk-demo-btn"
          style={{fontSize:10,padding:'4px 10px',fontFamily:MONO,cursor:'pointer',
            border:`1px solid ${GREEN}`,background:`${GREEN}22`,color:GREEN,borderRadius:2}}>
          RISK DESK DEMO
        </button>
        <button onClick={()=>{fetchData();fetchStatus();}} disabled={loading}
          style={{background:PANEL,border:`1px solid ${BORDER}`,color:loading?SUBTLE:TEXT,fontFamily:MONO,
            fontSize:10,padding:'4px 10px',cursor:'pointer',borderRadius:2}}>
          {loading?'...':'REFRESH'}
        </button>
      </div>

      {/* Stats ribbon */}
      <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,overflowX:'auto' as const,flexShrink:0}}>
        <StatPill label="EQUITY" value={stats?fmtUSD(stats.total_equity):'â€”'}/>
        <StatPill label="OPEN P&L" value={stats?fmtPnl(stats.open_pnl):'â€”'} color={pnlPos?GREEN:RED}/>
        <StatPill label="DAY P&L" value={stats?fmtPnl(stats.day_pnl):'â€”'} color={(stats?.day_pnl??0)>=0?GREEN:RED}/>
        <StatPill label="BUYING PWR" value={stats?fmtUSD(stats.buying_power):'â€”'} color={BLUE}/>
        <StatPill label="POSITIONS" value={stats?.position_count?.toString()??'â€”'}/>
        <StatPill label="ORDERS" value={stats?.active_orders?.toString()??'â€”'}/>
        <StatPill label="WIN RATE" value={stats?fmtPct(stats.win_rate):'â€”'} color={(stats?.win_rate??0)>=0.5?GREEN:RED}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t} style={tbtn(t)} onClick={()=>setTab(t)}>
            {t==='overview'?'INTELLIGENCE':t==='agents'?'AI AGENTS':'P&L ANALYTICS'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'hidden'}}>
        {tab==='overview'&&<FinancialIntelligenceDashboard/>}
        {tab==='agents'&&<MultiAgentFinancePanel/>}
        {tab==='analytics'&&<RealTimePnLAnalytics/>}
      </div>
    </div>
  );
}

export default EnhancedCommandCenterView;
