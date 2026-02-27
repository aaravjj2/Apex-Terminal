// ─── Bloomberg palette ───────────────────────────────────────────────────────
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const row:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',
  padding:'5px 0',borderBottom:`1px solid ${BORDER}`}
const label:React.CSSProperties={fontSize:11,color:SUBTLE,fontFamily:MONO,textTransform:'uppercase',letterSpacing:'0.04em'}
const val:React.CSSProperties={fontSize:12,fontFamily:MONO,color:TEXT}
const sectionHead:React.CSSProperties={fontSize:10,fontFamily:MONO,color:AMBER,textTransform:'uppercase',
  letterSpacing:'0.12em',padding:'8px 0 4px',borderBottom:`1px solid ${BORDER}`,marginBottom:6}
const card:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
  padding:'10px 14px',marginBottom:8}

function Pct({v,inv}:{v:string|number,inv?:boolean}){
  if(v==='unavailable'||v===null||v===undefined) return <span style={{...val,color:SUBTLE}}>N/A</span>
  const n=typeof v==='number'?v:parseFloat(String(v))
  if(isNaN(n)) return <span style={{...val,color:SUBTLE}}>{String(v)}</span>
  const c=inv?(n<0?GREEN:RED):(n>=0?GREEN:RED)
  return <span style={{...val,color:c}}>{(n*100).toFixed(2)}%</span>
}
function Num({v,suffix=''}:{v:string|number,suffix?:string}){
  if(v==='unavailable'||v===null||v===undefined) return <span style={{...val,color:SUBTLE}}>N/A</span>
  const n=typeof v==='number'?v:parseFloat(String(v))
  if(isNaN(n)) return <span style={{...val,color:SUBTLE}}>{String(v)}</span>
  return <span style={val}>{n.toFixed(2)}{suffix}</span>
}
function Big({v}:{v:string|number}){
  if(v==='unavailable'||v===null||v===undefined) return <span style={{...val,color:SUBTLE}}>N/A</span>
  const n=typeof v==='number'?v:parseFloat(String(v))
  if(isNaN(n)) return <span style={{...val,color:SUBTLE}}>{String(v)}</span>
  if(n>=1e12) return <span style={val}>${(n/1e12).toFixed(2)}T</span>
  if(n>=1e9) return <span style={val}>${(n/1e9).toFixed(2)}B</span>
  return <span style={val}>${(n/1e6).toFixed(2)}M</span>
}

import React, { useState, useEffect } from 'react';

interface FundamentalsData {
  symbol: string;
  timestamp: string;
  profitability: {
    roic: string | number;
    gross_margin: string | number;
    operating_margin: string | number;
    net_margin: string | number;
  };
  cash_flow: {
    fcf: string | number;
    fcf_yield: string | number;
    operating_cash_flow: string | number;
  };
  leverage: {
    debt_to_equity: string | number;
    current_ratio: string | number;
    quick_ratio: string | number;
  };
  quality: {
    roe: string | number;
    roa: string | number;
    asset_turnover: string | number;
  };
  valuation: {
    pe_ratio: string | number;
    pb_ratio: string | number;
    ps_ratio: string | number;
  };
  growth: {
    revenue_growth: string | number;
    earnings_growth: string | number;
  };
  additional: {
    market_cap: string | number;
    enterprise_value: string | number;
    shares_outstanding: string | number;
  };
}

interface FundamentalsPanelProps {
  symbol: string;
}

const TABS=['OVERVIEW','PROFITABILITY','CASH FLOW','VALUATION','QUALITY','GROWTH'] as const
type FTab=typeof TABS[number]

export const FundamentalsPanel = ({ symbol }: FundamentalsPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FTab>('OVERVIEW');
  const [refreshTs, setRefreshTs] = useState(Date.now());

  useEffect(() => { fetchFundamentals(); }, [symbol, refreshTs]);

  const fetchFundamentals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/fundamentals/${symbol}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // kept for legacy signature compat — not actually used in new render
  const formatValue = (value: string | number, suffix: string = ''): string => {
    if (value === 'unavailable' || value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'number') {
      if (suffix === '%') {
        return `${(value * 100).toFixed(2)}%`;
      }
      if (suffix === 'B') {
        return `$${(value / 1e9).toFixed(2)}B`;
      }
      if (suffix === 'M') {
        return `$${(value / 1e6).toFixed(2)}M`;
      }
      return value.toFixed(2) + suffix;
    }
    return String(value);
  };

  const getValueColor = (value: string | number, higherIsBetter: boolean = true): string => {
    if (value === 'unavailable' || typeof value !== 'number') return 'text-gray-400';
    if (higherIsBetter) {
      return value > 0 ? 'text-green-400' : 'text-red-400';
    } else {
      return value < 0 ? 'text-green-400' : 'text-red-400';
    }
  };

  const S:React.CSSProperties={display:'flex',flexDirection:'column',height:'100%',background:BG,fontFamily:MONO,color:TEXT,overflow:'hidden'}
  const HDR:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',
    padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
  const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
    background:PANEL,flexShrink:0}
  const tbtn=(active:boolean):React.CSSProperties=>({
    padding:'7px 12px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',cursor:'pointer',
    background:'none',border:'none',borderBottom:active?`2px solid ${AMBER}`:'2px solid transparent',
    color:active?AMBER:SUBTLE,textTransform:'uppercase' as const
  })
  const content:React.CSSProperties={flex:1,overflowY:'auto' as const,padding:'12px 14px'}
  const twoCol:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}
  const threeCol:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}
  const miniCard:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 10px'}

  return (
    <div style={S}>
      <div style={HDR}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:11,color:BLUE,fontFamily:MONO,letterSpacing:'0.1em'}}>FA</span>
          <span style={{fontSize:13,color:TEXT,fontFamily:MONO,fontWeight:700}}>{symbol}</span>
          <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>FUNDAMENTALS ANALYSIS</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {loading && <span style={{fontSize:10,color:AMBER,fontFamily:MONO}}>LOADING...</span>}
          {error && <span style={{fontSize:10,color:RED,fontFamily:MONO}}>ERR: {error}</span>}
          <button onClick={()=>setRefreshTs(Date.now())} style={{fontSize:10,fontFamily:MONO,
            background:PANEL,border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
            REFRESH
          </button>
        </div>
      </div>

      <div style={TABBAR}>
        {TABS.map(t=>(
          <button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {!data && !loading && (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:12,color:SUBTLE,fontFamily:MONO}}>NO DATA — ENTER SYMBOL OR REFRESH</span>
        </div>
      )}

      {data && (
        <div style={content}>

          {/* OVERVIEW */}
          {tab==='OVERVIEW' && (
            <div>
              <div style={sectionHead}>EQUITY SNAPSHOT — {symbol}</div>
              <div style={threeCol}>
                <div style={miniCard}>
                  <div style={label}>Market Cap</div>
                  <div style={{fontSize:16,fontFamily:MONO,color:AMBER,marginTop:4}}><Big v={data.additional.market_cap}/></div>
                </div>
                <div style={miniCard}>
                  <div style={label}>Enterprise Value</div>
                  <div style={{fontSize:16,fontFamily:MONO,color:BLUE,marginTop:4}}><Big v={data.additional.enterprise_value}/></div>
                </div>
                <div style={miniCard}>
                  <div style={label}>Shares Outstanding</div>
                  <div style={{fontSize:16,fontFamily:MONO,color:TEXT,marginTop:4}}><Big v={data.additional.shares_outstanding}/></div>
                </div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>VALUATION MULTIPLES</div>
              <div style={threeCol}>
                <div style={miniCard}><div style={label}>P/E Ratio</div><div style={{...val,fontSize:14,marginTop:4}}><Num v={data.valuation.pe_ratio}/>x</div></div>
                <div style={miniCard}><div style={label}>P/B Ratio</div><div style={{...val,fontSize:14,marginTop:4}}><Num v={data.valuation.pb_ratio}/>x</div></div>
                <div style={miniCard}><div style={label}>P/S Ratio</div><div style={{...val,fontSize:14,marginTop:4}}><Num v={data.valuation.ps_ratio}/>x</div></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>KEY METRICS</div>
              <div style={twoCol}>
                <div style={card}>
                  <div style={row}><span style={label}>ROIC</span><Pct v={data.profitability.roic}/></div>
                  <div style={row}><span style={label}>Gross Margin</span><Pct v={data.profitability.gross_margin}/></div>
                  <div style={row}><span style={label}>Net Margin</span><Pct v={data.profitability.net_margin}/></div>
                  <div style={row}><span style={label}>ROE</span><Pct v={data.quality.roe}/></div>
                </div>
                <div style={card}>
                  <div style={row}><span style={label}>FCF</span><Big v={data.cash_flow.fcf}/></div>
                  <div style={row}><span style={label}>FCF Yield</span><Pct v={data.cash_flow.fcf_yield}/></div>
                  <div style={row}><span style={label}>Revenue Growth</span><Pct v={data.growth.revenue_growth}/></div>
                  <div style={row}><span style={label}>Earnings Growth</span><Pct v={data.growth.earnings_growth}/></div>
                </div>
              </div>
            </div>
          )}

          {/* PROFITABILITY */}
          {tab==='PROFITABILITY' && (
            <div>
              <div style={sectionHead}>PROFITABILITY METRICS</div>
              <div style={card}>
                <div style={row}><span style={label}>Return on Invested Capital (ROIC)</span><Pct v={data.profitability.roic}/></div>
                <div style={row}><span style={label}>Gross Margin</span><Pct v={data.profitability.gross_margin}/></div>
                <div style={row}><span style={label}>Operating Margin</span><Pct v={data.profitability.operating_margin}/></div>
                <div style={row}><span style={label}>Net Profit Margin</span><Pct v={data.profitability.net_margin}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>LEVERAGE & LIQUIDITY</div>
              <div style={card}>
                <div style={row}><span style={label}>Debt / Equity</span><Num v={data.leverage.debt_to_equity}/></div>
                <div style={row}><span style={label}>Current Ratio</span><Num v={data.leverage.current_ratio}/></div>
                <div style={row}><span style={label}>Quick Ratio</span><Num v={data.leverage.quick_ratio}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>RETURN METRICS</div>
              <div style={card}>
                <div style={row}><span style={label}>Return on Equity (ROE)</span><Pct v={data.quality.roe}/></div>
                <div style={row}><span style={label}>Return on Assets (ROA)</span><Pct v={data.quality.roa}/></div>
                <div style={row}><span style={label}>Asset Turnover</span><Num v={data.quality.asset_turnover}/></div>
              </div>
            </div>
          )}

          {/* CASH FLOW */}
          {tab==='CASH FLOW' && (
            <div>
              <div style={sectionHead}>CASH FLOW ANALYSIS</div>
              <div style={card}>
                <div style={row}><span style={label}>Free Cash Flow (FCF)</span><Big v={data.cash_flow.fcf}/></div>
                <div style={row}><span style={label}>FCF Yield</span><Pct v={data.cash_flow.fcf_yield}/></div>
                <div style={row}><span style={label}>Operating Cash Flow</span><Big v={data.cash_flow.operating_cash_flow}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>FCF INTERPRETATION</div>
              <div style={card}>
                <div style={{...row,flexDirection:'column' as const,alignItems:'flex-start'}}>
                  <div style={{fontSize:10,color:SUBTLE,fontFamily:MONO,marginBottom:4}}>FCF QUALITY SIGNAL</div>
                  {(() => {
                    const n=typeof data.cash_flow.fcf==='number'?data.cash_flow.fcf:parseFloat(String(data.cash_flow.fcf))
                    if(isNaN(n)) return <span style={{fontSize:11,color:SUBTLE,fontFamily:MONO}}>N/A</span>
                    if(n>0) return <span style={{fontSize:11,color:GREEN,fontFamily:MONO}}>POSITIVE FCF — HEALTHY CASH GENERATION</span>
                    return <span style={{fontSize:11,color:RED,fontFamily:MONO}}>NEGATIVE FCF — BURNING CASH</span>
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* VALUATION */}
          {tab==='VALUATION' && (
            <div>
              <div style={sectionHead}>VALUATION RATIOS</div>
              <div style={card}>
                <div style={row}><span style={label}>Price / Earnings (P/E)</span><Num v={data.valuation.pe_ratio} suffix="x"/></div>
                <div style={row}><span style={label}>Price / Book (P/B)</span><Num v={data.valuation.pb_ratio} suffix="x"/></div>
                <div style={row}><span style={label}>Price / Sales (P/S)</span><Num v={data.valuation.ps_ratio} suffix="x"/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>ENTERPRISE VALUE</div>
              <div style={card}>
                <div style={row}><span style={label}>Market Capitalization</span><Big v={data.additional.market_cap}/></div>
                <div style={row}><span style={label}>Enterprise Value</span><Big v={data.additional.enterprise_value}/></div>
                <div style={row}><span style={label}>Shares Outstanding</span><Big v={data.additional.shares_outstanding}/></div>
              </div>
            </div>
          )}

          {/* QUALITY */}
          {tab==='QUALITY' && (
            <div>
              <div style={sectionHead}>EARNINGS QUALITY</div>
              <div style={card}>
                <div style={row}><span style={label}>Return on Equity (ROE)</span><Pct v={data.quality.roe}/></div>
                <div style={row}><span style={label}>Return on Assets (ROA)</span><Pct v={data.quality.roa}/></div>
                <div style={row}><span style={label}>Asset Turnover</span><Num v={data.quality.asset_turnover}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>BALANCE SHEET STRENGTH</div>
              <div style={card}>
                <div style={row}><span style={label}>Debt / Equity</span><Num v={data.leverage.debt_to_equity}/></div>
                <div style={row}><span style={label}>Current Ratio</span><Num v={data.leverage.current_ratio}/></div>
                <div style={row}><span style={label}>Quick Ratio</span><Num v={data.leverage.quick_ratio}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>OPERATING EFFICIENCY</div>
              <div style={card}>
                <div style={row}><span style={label}>Gross Margin</span><Pct v={data.profitability.gross_margin}/></div>
                <div style={row}><span style={label}>Operating Margin</span><Pct v={data.profitability.operating_margin}/></div>
                <div style={row}><span style={label}>Net Margin</span><Pct v={data.profitability.net_margin}/></div>
              </div>
            </div>
          )}

          {/* GROWTH */}
          {tab==='GROWTH' && (
            <div>
              <div style={sectionHead}>GROWTH RATES</div>
              <div style={card}>
                <div style={row}><span style={label}>Revenue Growth (YoY)</span><Pct v={data.growth.revenue_growth}/></div>
                <div style={row}><span style={label}>Earnings Growth (YoY)</span><Pct v={data.growth.earnings_growth}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>REINVESTMENT CAPACITY</div>
              <div style={card}>
                <div style={row}><span style={label}>ROIC</span><Pct v={data.profitability.roic}/></div>
                <div style={row}><span style={label}>FCF Yield</span><Pct v={data.cash_flow.fcf_yield}/></div>
                <div style={row}><span style={label}>Operating Cash Flow</span><Big v={data.cash_flow.operating_cash_flow}/></div>
              </div>
              <div style={{height:12}}/>
              <div style={sectionHead}>GROWTH SIGNAL</div>
              <div style={card}>
                {[
                  {k:'Revenue Growth',v:data.growth.revenue_growth},
                  {k:'Earnings Growth',v:data.growth.earnings_growth},
                ].map(({k,v})=>{
                  const n=typeof v==='number'?v:parseFloat(String(v))
                  const sig=isNaN(n)?'N/A':n>=0.15?'STRONG':n>=0.05?'MODERATE':n>=0?'WEAK':'DECLINING'
                  const c=isNaN(n)?SUBTLE:n>=0.15?GREEN:n>=0.05?AMBER:n>=0?BLUE:RED
                  return <div key={k} style={row}><span style={label}>{k}</span>
                    <span style={{fontSize:10,fontFamily:MONO,color:c}}>{sig}</span></div>
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
