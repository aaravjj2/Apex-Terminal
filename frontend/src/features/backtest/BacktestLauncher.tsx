// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',ORANGE='#ff8a65',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c,children}:{c?:React.CSSProperties,children:React.ReactNode})=>(
  <th style={{padding:'6px 10px',fontSize:10,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
    letterSpacing:'0.08em',borderBottom:`1px solid ${BORDER}`,textAlign:'left',...c}}>{children}</th>
)
const Td=({c,children}:{c?:React.CSSProperties,children:React.ReactNode})=>(
  <td style={{padding:'6px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{children}</td>
)

function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',minWidth:100}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:16,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react';

interface BacktestConfig {
    strategy_type: string;
    symbol: string;
    start_date: string;
    end_date: string;
    timeframe: string;
    initial_capital: number;
    slippage_pct: number;
    commission_per_share: number;
}

interface BacktestResult {
    id: string;
    config_hash: string;
    trade_log_hash: string;
    equity_curve_hash: string;
    initial_capital: number;
    final_equity: number;
    total_return: number;
    total_return_pct: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    equity_curve: number[];
}

const STRATEGIES=['sma_crossover','rsi_breakout','vwap_reversion','momentum','mean_reversion','bollinger_bands','macd_cross','pairs_trading']
const SYMBOLS=['AAPL','TSLA','MSFT','GOOGL','AMZN','SPY','QQQ','NVDA','META','NFLX']
const TIMEFRAMES=['1m','5m','15m','30m','1h','4h','1d','1w']
const TABS=['CONFIG','RESULTS','EQUITY CURVE','AUDIT'] as const
type BTab=typeof TABS[number]

export function BacktestLauncher({ onClose }: { onClose: () => void }) {
    const [config, setConfig] = useState<BacktestConfig>({
        strategy_type: 'sma_crossover',
        symbol: 'AAPL',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        timeframe: '1d',
        initial_capital: 100000,
        slippage_pct: 0.05,
        commission_per_share: 0.01,
    });

    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BacktestResult[]>([]);
    const [selectedResult, setSelectedResult] = useState<BacktestResult|null>(null);
    const [tab, setTab] = useState<BTab>('CONFIG');
    const [error, setError] = useState<string|null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

    const runBacktest = async () => {
        setRunning(true);
        setProgress(0);
        setError(null);
        let taskId:string|null=null;

        try {
            const res=await fetch('/api/v1/backtest/run',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify(config)
            });
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const data=await res.json();
            taskId=data.task_id||data.id;
        } catch(e){
            setError(e instanceof Error?e.message:'Failed to start backtest');
            setRunning(false);
            return;
        }

        if(!taskId){setRunning(false);return;}

        pollRef.current=setInterval(async()=>{
            try{
                const res=await fetch(`/api/v1/backtest/status/${taskId}`);
                if(!res.ok) return;
                const data=await res.json();
                if(data.progress!=null) setProgress(data.progress);
                if(data.status==='completed'||data.result){
                    clearInterval(pollRef.current!);
                    setProgress(100);
                    const r:BacktestResult=data.result||data;
                    setResults(prev=>[r,...prev]);
                    setSelectedResult(r);
                    setTab('RESULTS');
                    setRunning(false);
                }
                if(data.status==='failed'){
                    clearInterval(pollRef.current!);
                    setError(data.error||'Backtest failed');
                    setRunning(false);
                }
            }catch(e){
                clearInterval(pollRef.current!);
                setError(e instanceof Error?e.message:'Poll error');
                setRunning(false);
            }
        },800);
    };

    useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current);},[]);

    // Draw equity curve
    useEffect(()=>{
        if(!canvasRef.current||!selectedResult) return;
        const canvas=canvasRef.current;
        const ctx=canvas.getContext('2d');
        if(!ctx) return;
        const {width,height}=canvas;
        ctx.fillStyle=BG;ctx.fillRect(0,0,width,height);
        const curve=selectedResult.equity_curve;
        if(!curve||curve.length<2) return;
        const mn=Math.min(...curve)*0.995,mx=Math.max(...curve)*1.005,rng=mx-mn||1;
        ctx.strokeStyle=GREEN;ctx.lineWidth=1.5;ctx.beginPath();
        curve.forEach((v,i)=>{
            const x=(i/(curve.length-1))*width;
            const y=height-((v-mn)/rng)*height;
            i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        });
        ctx.stroke();
        // zero line
        ctx.strokeStyle=BORDER;ctx.lineWidth=1;ctx.setLineDash([4,4]);
        const initY=height-((selectedResult.initial_capital-mn)/rng)*height;
        ctx.beginPath();ctx.moveTo(0,initY);ctx.lineTo(width,initY);ctx.stroke();
        ctx.setLineDash([]);
    },[selectedResult,tab]);

    const S:React.CSSProperties={position:'fixed' as const,inset:0,zIndex:50,
        display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)'}
    const panel:React.CSSProperties={width:920,maxHeight:'85vh',background:BG,border:`1px solid ${BORDER}`,
        borderRadius:2,display:'flex',flexDirection:'column' as const,overflow:'hidden',fontFamily:MONO}
    const hdr:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'10px 16px',borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const tabbar:React.CSSProperties={display:'flex',gap:2,padding:'0 16px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
    const body:React.CSSProperties={flex:1,overflowY:'auto' as const,padding:'14px 16px',display:'flex',gap:12}
    const formGroup:React.CSSProperties={marginBottom:10}
    const lbl:React.CSSProperties={fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
        letterSpacing:'0.08em',marginBottom:3,display:'block'}
    const inp:React.CSSProperties={width:'100%',background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
        padding:'5px 8px',fontSize:11,fontFamily:MONO,color:TEXT,boxSizing:'border-box' as const}
    const sel:React.CSSProperties={...inp,appearance:'none' as const}

    const fmt=(v:number)=>`${v>=0?'+':''}${v.toFixed(2)}%`

    return (
        <div style={S}>
            <div style={panel}>
                <div style={hdr}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:11,color:PURPLE,fontFamily:MONO,letterSpacing:'0.1em'}}>BT</span>
                        <span style={{fontSize:13,color:TEXT,fontFamily:MONO,fontWeight:700}}>BACKTEST LAUNCHER</span>
                        <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>APEX STRATEGY ENGINE V1</span>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        {running&&<span style={{fontSize:10,color:AMBER,fontFamily:MONO}}>RUNNING {progress}%</span>}
                        {error&&<span style={{fontSize:10,color:RED,fontFamily:MONO}}>ERR: {error}</span>}
                        <button onClick={onClose} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                            border:`1px solid ${BORDER}`,color:SUBTLE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
                            CLOSE
                        </button>
                    </div>
                </div>

                <div style={tabbar}>
                    {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
                </div>

                <div style={body}>

                    {/* CONFIG */}
                    {tab==='CONFIG' && (
                        <div style={{width:260,flexShrink:0}}>
                            <div style={formGroup}>
                                <label style={lbl}>Strategy Type</label>
                                <select style={sel} value={config.strategy_type}
                                    onChange={e=>setConfig(p=>({...p,strategy_type:e.target.value}))}>
                                    {STRATEGIES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ').toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div style={formGroup}>
                                <label style={lbl}>Symbol</label>
                                <select style={sel} value={config.symbol}
                                    onChange={e=>setConfig(p=>({...p,symbol:e.target.value}))}>
                                    {SYMBOLS.map(s=><option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                                <div>
                                    <label style={lbl}>Start Date</label>
                                    <input type="date" style={inp} value={config.start_date}
                                        onChange={e=>setConfig(p=>({...p,start_date:e.target.value}))}/>
                                </div>
                                <div>
                                    <label style={lbl}>End Date</label>
                                    <input type="date" style={inp} value={config.end_date}
                                        onChange={e=>setConfig(p=>({...p,end_date:e.target.value}))}/>
                                </div>
                            </div>
                            <div style={formGroup}>
                                <label style={lbl}>Timeframe</label>
                                <select style={sel} value={config.timeframe}
                                    onChange={e=>setConfig(p=>({...p,timeframe:e.target.value}))}>
                                    {TIMEFRAMES.map(t=><option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={formGroup}>
                                <label style={lbl}>Initial Capital ($)</label>
                                <input type="number" style={inp} value={config.initial_capital}
                                    onChange={e=>setConfig(p=>({...p,initial_capital:parseFloat(e.target.value)||0}))}/>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                                <div>
                                    <label style={lbl}>Slippage %</label>
                                    <input type="number" step="0.01" style={inp} value={config.slippage_pct}
                                        onChange={e=>setConfig(p=>({...p,slippage_pct:parseFloat(e.target.value)||0}))}/>
                                </div>
                                <div>
                                    <label style={lbl}>Commission/Share</label>
                                    <input type="number" step="0.001" style={inp} value={config.commission_per_share}
                                        onChange={e=>setConfig(p=>({...p,commission_per_share:parseFloat(e.target.value)||0}))}/>
                                </div>
                            </div>
                            <button onClick={runBacktest} disabled={running}
                                style={{width:'100%',padding:'8px',fontSize:11,fontFamily:MONO,
                                    background:running?SUBTLE:GREEN,border:'none',color:BG,cursor:running?'wait':'pointer',
                                    letterSpacing:'0.08em',textTransform:'uppercase' as const,borderRadius:2,marginBottom:8}}>
                                {running?`RUNNING... ${progress}%`:'â–¶  RUN BACKTEST'}
                            </button>
                            {running&&(
                                <div style={{width:'100%',height:4,background:BORDER,borderRadius:2}}>
                                    <div style={{width:`${progress}%`,height:4,background:AMBER,borderRadius:2,
                                        transition:'width 0.3s'}}/>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RESULTS */}
                    {tab==='RESULTS' && (
                        <div style={{flex:1}}>
                            {selectedResult && (
                                <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginBottom:12}}>
                                    <StatCard label="Total Return" value={fmt(selectedResult.total_return_pct)} color={selectedResult.total_return_pct>=0?GREEN:RED}/>
                                    <StatCard label="Sharpe Ratio" value={selectedResult.sharpe_ratio.toFixed(2)} color={selectedResult.sharpe_ratio>=1?GREEN:AMBER}/>
                                    <StatCard label="Max Drawdown" value={`${selectedResult.max_drawdown_pct.toFixed(2)}%`} color={RED}/>
                                    <StatCard label="Win Rate" value={`${selectedResult.win_rate.toFixed(1)}%`} color={BLUE}/>
                                    <StatCard label="Total Trades" value={String(selectedResult.total_trades)} color={TEXT}/>
                                    <StatCard label="Sortino" value={selectedResult.sortino_ratio.toFixed(2)} color={PURPLE}/>
                                </div>
                            )}
                            {results.length===0&&<div style={{fontSize:12,color:SUBTLE,fontFamily:MONO,padding:20}}>NO RESULTS â€” RUN A BACKTEST FIRST</div>}
                            {results.length>0&&(
                                <div style={{overflowX:'auto' as const}}>
                                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                                        <thead>
                                            <tr>
                                                <Th>ID</Th>
                                                <Th c={{textAlign:'right'}}>Return</Th>
                                                <Th c={{textAlign:'right'}}>Final Equity</Th>
                                                <Th c={{textAlign:'right'}}>Trades</Th>
                                                <Th c={{textAlign:'right'}}>Win %</Th>
                                                <Th c={{textAlign:'right'}}>Sharpe</Th>
                                                <Th c={{textAlign:'right'}}>Sortino</Th>
                                                <Th c={{textAlign:'right'}}>Max DD</Th>
                                                <Th>Hash</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map(r=>(
                                                <tr key={r.id} onClick={()=>setSelectedResult(r)}
                                                    style={{cursor:'pointer',background:selectedResult?.id===r.id?`${AMBER}11`:'transparent'}}>
                                                    <Td c={{color:BLUE}}>{r.id}</Td>
                                                    <Td c={{textAlign:'right',color:r.total_return_pct>=0?GREEN:RED}}>{fmt(r.total_return_pct)}</Td>
                                                    <Td c={{textAlign:'right'}}>${r.final_equity.toLocaleString(undefined,{maximumFractionDigits:0})}</Td>
                                                    <Td c={{textAlign:'right'}}>{r.total_trades}</Td>
                                                    <Td c={{textAlign:'right'}}>{r.win_rate.toFixed(1)}%</Td>
                                                    <Td c={{textAlign:'right',color:r.sharpe_ratio>=1?GREEN:AMBER}}>{r.sharpe_ratio.toFixed(2)}</Td>
                                                    <Td c={{textAlign:'right'}}>{r.sortino_ratio.toFixed(2)}</Td>
                                                    <Td c={{textAlign:'right',color:RED}}>{r.max_drawdown_pct.toFixed(2)}%</Td>
                                                    <Td c={{color:SUBTLE,fontSize:10}}>{r.config_hash.substring(0,12)}</Td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EQUITY CURVE */}
                    {tab==='EQUITY CURVE' && (
                        <div style={{flex:1}}>
                            {!selectedResult&&<div style={{fontSize:12,color:SUBTLE,fontFamily:MONO,padding:20}}>NO RESULT SELECTED â€” RUN A BACKTEST FIRST</div>}
                            {selectedResult&&(
                                <>
                                    <div style={{fontSize:10,color:SUBTLE,fontFamily:MONO,marginBottom:8}}>
                                        {selectedResult.id} â€” {selectedResult.symbol||config.symbol} â€” {config.start_date} â†’ {config.end_date}
                                    </div>
                                    <canvas ref={canvasRef} width={840} height={200}
                                        style={{width:'100%',height:200,display:'block',border:`1px solid ${BORDER}`}}/>
                                    <div style={{marginTop:12,display:'flex',gap:8}}>
                                        <StatCard label="Initial Capital" value={`$${selectedResult.initial_capital.toLocaleString()}`} color={TEXT}/>
                                        <StatCard label="Final Equity" value={`$${selectedResult.final_equity.toLocaleString(undefined,{maximumFractionDigits:0})}`}
                                            color={selectedResult.final_equity>=selectedResult.initial_capital?GREEN:RED}/>
                                        <StatCard label="P&L" value={`$${(selectedResult.final_equity-selectedResult.initial_capital).toLocaleString(undefined,{maximumFractionDigits:0})}`}
                                            color={selectedResult.total_return>=0?GREEN:RED}/>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* AUDIT */}
                    {tab==='AUDIT' && (
                        <div style={{flex:1}}>
                            <div style={{fontSize:10,color:SUBTLE,fontFamily:MONO,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>BACKTEST AUDIT LOG</div>
                            {results.length===0&&<div style={{fontSize:12,color:SUBTLE,fontFamily:MONO}}>NO RUNS YET</div>}
                            {results.map(r=>(
                                <div key={r.id} style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',marginBottom:6}}>
                                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                        <span style={{fontSize:11,color:BLUE,fontFamily:MONO}}>{r.id}</span>
                                        <span style={{fontSize:10,color:r.total_return_pct>=0?GREEN:RED,fontFamily:MONO}}>{fmt(r.total_return_pct)}</span>
                                    </div>
                                    <div style={{display:'flex',gap:16}}>
                                        <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>CONFIG: {r.config_hash.substring(0,16)}</span>
                                        <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>TRADES: {r.trade_log_hash.substring(0,16)}</span>
                                        <span style={{fontSize:10,color:SUBTLE,fontFamily:MONO}}>EQUITY: {r.equity_curve_hash.substring(0,16)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface BacktestConfig {
    strategy_type: string;
    symbol: string;
    start_date: string;
    end_date: string;
    timeframe: string;
    initial_capital: number;
    slippage_pct: number;
    commission_per_share: number;
}

interface BacktestResult {
    id: string;
    config_hash: string;
    trade_log_hash: string;
    equity_curve_hash: string;
    initial_capital: number;
    final_equity: number;
    total_return: number;
    total_return_pct: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    equity_curve: number[];
}

