// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useEffect } from 'react';
import { OptionsChain } from '../../options/OptionsChain';
import { IVSkewChart } from '../../options/IVSkewChart';
import { IVTermStructure } from '../../options/IVTermStructure';
import { StrategyBuilder } from '../../options/StrategyBuilder';
import { FundamentalsPanel } from '../../fundamentals/FundamentalsPanel';
import { RiskDeskPanel } from '../../options/riskDesk';
import { StrategyLabPanel } from '../../options/strategyLab';
import { RunsPanel } from '../../options/runs';
import { QuickActions } from '../../options/QuickActions';
import { IndicatorManager } from '../../indicators/IndicatorManager';
import { useAppStore } from '../../../state/appStore';
import { useOptionsStore } from '../../options/store';

type OptionsTab = 'chain' | 'iv-skew' | 'iv-term' | 'strategy' | 'fundamentals';
type MainTab = 'analytics' | 'risk-desk' | 'strategy-lab' | 'runs';

const MAIN_TABS:{id:MainTab,label:string}[]=[
  {id:'analytics',label:'ANALYTICS'},
  {id:'risk-desk',label:'RISK DESK'},
  {id:'strategy-lab',label:'STRATEGY LAB'},
  {id:'runs',label:'RUNS'},
]
const ANALYTICS_TABS:{id:OptionsTab,label:string}[]=[
  {id:'chain',label:'OPTIONS CHAIN'},
  {id:'iv-skew',label:'IV SKEW'},
  {id:'iv-term',label:'IV TERM STRUCTURE'},
  {id:'strategy',label:'STRATEGY BUILDER'},
  {id:'fundamentals',label:'FUNDAMENTALS'},
]

export function OptionsView() {
  const { symbol: appSymbol } = useAppStore();
  const {
    fetchAll,
    chain,
    selectedExpiration,
    setSelectedExpiration,
    chainLoading
  } = useOptionsStore();

  const initialTab = (window as any).__navigateToRiskDesk ? 'risk-desk' : 'analytics';
  if ((window as any).__navigateToRiskDesk) delete (window as any).__navigateToRiskDesk;

  const [mainTab, setMainTab] = useState<MainTab>(initialTab as MainTab);
  const [activeTab, setActiveTab] = useState<OptionsTab>('chain');
  const [indicatorManagerOpen, setIndicatorManagerOpen] = useState(false);
  const [, setIndicators] = useState<unknown[]>([]);

  useEffect(() => {
    const handler = () => setMainTab('risk-desk');
    window.addEventListener('navigate-risk-desk', handler);
    return () => window.removeEventListener('navigate-risk-desk', handler);
  }, []);

  useEffect(() => {
    if (appSymbol) fetchAll(appSymbol);
  }, [appSymbol, fetchAll]);

  const handleIndicatorUpdate = (newIndicators: unknown[]) => setIndicators(newIndicators);
  const handleStartDemo = () => setMainTab('risk-desk');
  const handleRunBacktest = () => window.dispatchEvent(new CustomEvent('navigate-view', {detail:'backtest'}));
  const handleExportLastRun = async () => { console.log('Export last run bundle'); };

  const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,
    background:BG,fontFamily:MONO}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
    borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0,flexWrap:'wrap' as const}
  const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
    background:PANEL,flexShrink:0,overflowX:'auto' as const}

  const mtbtn=(a:boolean,id:string):React.CSSProperties=>({padding:'4px 10px',fontSize:10,fontFamily:MONO,
    letterSpacing:'0.08em',cursor:'pointer',border:`1px solid ${a?AMBER:BORDER}`,background:a?`${AMBER}22`:PANEL,
    color:a?AMBER:SUBTLE,borderRadius:2,textTransform:'uppercase' as const})
  const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
    cursor:'pointer',background:'none',border:'none',borderBottom:a?`2px solid ${BLUE}`:'2px solid transparent',
    color:a?BLUE:SUBTLE,textTransform:'uppercase' as const,whiteSpace:'nowrap' as const})

  return (
    <div style={S} data-testid="options-view">
      {/* Main header */}
      <div style={HDR}>
        <span style={{fontSize:11,color:GREEN,letterSpacing:'0.1em'}}>OV</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}} data-testid="options-heading">
          OPTIONS â€” {appSymbol}
        </span>
        <div style={{display:'flex',gap:4,marginLeft:8}}>
          {MAIN_TABS.map(t=>(
            <button key={t.id} onClick={()=>setMainTab(t.id)}
              style={mtbtn(mainTab===t.id,t.id)}
              data-testid={`options-main-tab-${t.id}`}>{t.label}</button>
          ))}
        </div>
        {/* Expiration selector */}
        {mainTab==='analytics'&&chain&&chain.expirations.length>0&&
         (activeTab==='chain'||activeTab==='iv-skew'||activeTab==='iv-term')&&(
          <select value={selectedExpiration||''}
            onChange={e=>setSelectedExpiration(e.target.value)}
            style={{background:BG,border:`1px solid ${BORDER}`,color:TEXT,fontFamily:MONO,fontSize:10,
              padding:'4px 8px',borderRadius:2,outline:'none',marginLeft:8}}>
            {chain.expirations.map(exp=><option key={exp} value={exp}>{exp}</option>)}
          </select>
        )}
        {chainLoading&&<span style={{fontSize:10,color:AMBER}}>LOADING</span>}
        <div style={{flex:1}}/>
        <QuickActions onStartDemo={handleStartDemo} onRunBacktest={handleRunBacktest} onExportLastRun={handleExportLastRun}/>
        {mainTab==='analytics'&&(
          <button onClick={()=>setIndicatorManagerOpen(!indicatorManagerOpen)}
            style={{fontSize:10,fontFamily:MONO,background:indicatorManagerOpen?`${PURPLE}33`:PANEL,
              border:`1px solid ${indicatorManagerOpen?PURPLE:BORDER}`,color:indicatorManagerOpen?PURPLE:SUBTLE,
              padding:'4px 10px',cursor:'pointer',borderRadius:2,marginLeft:6}}>
            {indicatorManagerOpen?'HIDE INDICATORS':'INDICATORS'}
          </button>
        )}
      </div>

      {/* Analytics secondary tabs */}
      {mainTab==='analytics'&&(
        <div style={TABBAR}>
          {ANALYTICS_TABS.map(t=>(
            <button key={t.id} style={tbtn(activeTab===t.id)} onClick={()=>setActiveTab(t.id)}
              data-testid={`options-tab-${t.id}`}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {mainTab==='analytics'&&(
          <>
            <div style={{flex:1,overflowY:'auto' as const}} data-testid="analytics-panel">
              {activeTab==='chain'&&(
                <OptionsChain symbol={appSymbol} expiration={selectedExpiration||''} underlyingPrice={chain?.underlyingPrice}/>
              )}
              {activeTab==='iv-skew'&&(
                <IVSkewChart symbol={appSymbol} expiration={selectedExpiration||''} underlyingPrice={chain?.underlyingPrice}/>
              )}
              {activeTab==='iv-term'&&<IVTermStructure symbol={appSymbol}/>}
              {activeTab==='strategy'&&<StrategyBuilder symbol={appSymbol} underlyingPrice={chain?.underlyingPrice||0}/>}
              {activeTab==='fundamentals'&&<FundamentalsPanel symbol={appSymbol}/>}
            </div>
            {indicatorManagerOpen&&(
              <div style={{width:280,borderLeft:`1px solid ${BORDER}`,flexShrink:0}}>
                <IndicatorManager symbol={appSymbol} onIndicatorUpdate={handleIndicatorUpdate}/>
              </div>
            )}
          </>
        )}
        {mainTab==='risk-desk'&&<div style={{flex:1,overflow:'hidden'}}><RiskDeskPanel/></div>}
        {mainTab==='strategy-lab'&&<div style={{flex:1,overflow:'hidden'}}><StrategyLabPanel/></div>}
        {mainTab==='runs'&&<div style={{flex:1,overflow:'hidden'}}><RunsPanel/></div>}
      </div>
    </div>
  );
}

