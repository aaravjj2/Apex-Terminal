// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <th style={{padding:'6px 8px',fontSize:10,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
    letterSpacing:'0.08em',borderBottom:`1px solid ${BORDER}`,textAlign:'left',...c}}>{ch}</th>
)
const Td=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <td style={{padding:'6px 8px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function StatCard({label,value,sub,color}:{label:string,value:string,sub?:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'10px 14px',flex:1,minWidth:120}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:18,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
      {sub&&<div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,marginTop:2}}>{sub}</div>}
    </div>
  )
}

import { useState, useEffect } from 'react';
import { ApiClient, type Position, type Order } from '../../../data/ApiClient';

interface Fill {id:string;time:string;orderId:string;symbol:string;side:string;qty:number;price:number;fee:number}

const TABS=['POSITIONS','ORDERS','FILLS','P&L ANALYSIS'] as const
type PTab=typeof TABS[number]

export function PortfolioView() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [fills] = useState<Fill[]>([]);
    const [tab, setTab] = useState<PTab>('POSITIONS');
    const [loading, setLoading] = useState(false);
    const [selectedPos, setSelectedPos] = useState<Position|null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [posData, ordData] = await Promise.all([
                ApiClient.getPositions(),
                ApiClient.getOrders()
            ]);
            setPositions(posData);
            setOrders(ordData);
        } catch (e) {
            console.warn('Failed to load portfolio data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const totalPnl = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
    const portfolioValue = 100000 + positions.reduce((acc, p) => acc + (p.qty * p.current_price), 0);
    const longPositions = positions.filter(p => p.qty > 0);
    const shortPositions = positions.filter(p => p.qty < 0);
    const openOrders = orders.filter(o => ['PENDING','NEW','PARTIAL'].includes(o.status||''));

    const fmtUSD=(v:number)=>`$${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
    const fmtPct=(v:number)=>`${v>=0?'+':''}${v.toFixed(2)}%`

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
    const body:React.CSSProperties={flex:1,overflowY:'auto' as const}

    return (
        <div style={S}>
            <div style={HDR}>
                <span style={{fontSize:11,color:BLUE,letterSpacing:'0.1em'}}>PF</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>PORTFOLIO MONITOR</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX EXECUTION ENGINE</span>
                <div style={{flex:1}}/>
                {loading&&<span style={{fontSize:10,color:AMBER}}>LIVE</span>}
                <button onClick={fetchData} style={{fontSize:10,fontFamily:MONO,background:PANEL,
                    border:`1px solid ${BORDER}`,color:BLUE,padding:'3px 8px',cursor:'pointer',borderRadius:2}}>
                    REFRESH
                </button>
            </div>

            {/* Stats strip */}
            <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                <StatCard label="Portfolio Value" value={fmtUSD(portfolioValue)} color={TEXT}/>
                <StatCard label="Total P&L" value={fmtUSD(totalPnl)} color={totalPnl>=0?GREEN:RED}/>
                <StatCard label="Positions" value={String(positions.length)} sub={`${longPositions.length}L / ${shortPositions.length}S`} color={TEXT}/>
                <StatCard label="Open Orders" value={String(openOrders.length)} color={openOrders.length>0?AMBER:TEXT}/>
                <StatCard label="Buying Power" value="$45,000.00" color={BLUE}/>
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            <div style={body}>
                {/* POSITIONS */}
                {tab==='POSITIONS'&&(
                    <>
                        {positions.length===0&&<div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                            {loading?'LOADING...':'NO OPEN POSITIONS'}</div>}
                        {positions.length>0&&(
                            <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                    <tr>
                                        <Th ch="Symbol"/>
                                        <Th c={{textAlign:'right'}} ch="Qty"/>
                                        <Th c={{textAlign:'right'}} ch="Avg Price"/>
                                        <Th c={{textAlign:'right'}} ch="Current"/>
                                        <Th c={{textAlign:'right'}} ch="Market Value"/>
                                        <Th c={{textAlign:'right'}} ch="P&L"/>
                                        <Th c={{textAlign:'right'}} ch="P&L %"/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positions.map(p=>{
                                        const pnl=p.pnl||0;
                                        const mv=p.qty*p.current_price;
                                        const pnlPct=p.avg_price>0?(pnl/(p.qty*p.avg_price))*100:0;
                                        return (
                                            <tr key={p.symbol} onClick={()=>setSelectedPos(selectedPos?.symbol===p.symbol?null:p)}
                                                style={{cursor:'pointer',background:selectedPos?.symbol===p.symbol?`${AMBER}11`:'transparent'}}>
                                                <Td c={{fontWeight:700,color:AMBER}} ch={p.symbol}/>
                                                <Td c={{textAlign:'right',color:p.qty>0?GREEN:RED}} ch={p.qty}/>
                                                <Td c={{textAlign:'right'}} ch={`$${p.avg_price.toFixed(2)}`}/>
                                                <Td c={{textAlign:'right'}} ch={`$${p.current_price.toFixed(2)}`}/>
                                                <Td c={{textAlign:'right'}} ch={fmtUSD(mv)}/>
                                                <Td c={{textAlign:'right',color:pnl>=0?GREEN:RED}} ch={fmtUSD(pnl)}/>
                                                <Td c={{textAlign:'right',color:pnlPct>=0?GREEN:RED}} ch={fmtPct(pnlPct)}/>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                )}

                {/* ORDERS */}
                {tab==='ORDERS'&&(
                    <>
                        {orders.length===0&&<div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                            {loading?'LOADING...':'NO ORDERS'}</div>}
                        {orders.length>0&&(
                            <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                    <tr>
                                        <Th ch="Time"/>
                                        <Th ch="Symbol"/>
                                        <Th ch="Side"/>
                                        <Th ch="Type"/>
                                        <Th c={{textAlign:'right'}} ch="Qty"/>
                                        <Th c={{textAlign:'right'}} ch="Filled"/>
                                        <Th ch="Status"/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o=>(
                                        <tr key={o.id}>
                                            <Td c={{fontSize:10,color:SUBTLE}} ch={new Date(o.created_at).toLocaleTimeString()}/>
                                            <Td c={{fontWeight:700}} ch={o.symbol}/>
                                            <Td c={{color:o.side==='BUY'?GREEN:RED}} ch={o.side}/>
                                            <Td c={{color:SUBTLE,fontSize:10}} ch={o.type}/>
                                            <Td c={{textAlign:'right'}} ch={o.qty}/>
                                            <Td c={{textAlign:'right',color:o.filled_qty===o.qty?GREEN:AMBER}} ch={o.filled_qty}/>
                                            <Td c={{fontSize:9,color:o.status==='FILLED'?GREEN:o.status==='REJECTED'?RED:AMBER}}
                                                ch={o.status}/>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}

                {/* FILLS */}
                {tab==='FILLS'&&(
                    <>
                        {fills.length===0&&<div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>NO FILLS RECORDED</div>}
                        {fills.length>0&&(
                            <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                    <tr>
                                        <Th ch="Time"/><Th ch="Symbol"/><Th ch="Side"/>
                                        <Th c={{textAlign:'right'}} ch="Qty"/>
                                        <Th c={{textAlign:'right'}} ch="Price"/>
                                        <Th c={{textAlign:'right'}} ch="Fee"/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fills.map(f=>(
                                        <tr key={f.id}>
                                            <Td c={{fontSize:10,color:SUBTLE}} ch={f.time}/>
                                            <Td c={{fontWeight:700}} ch={f.symbol}/>
                                            <Td c={{color:f.side==='BUY'?GREEN:RED}} ch={f.side}/>
                                            <Td c={{textAlign:'right'}} ch={f.qty}/>
                                            <Td c={{textAlign:'right'}} ch={`$${f.price.toFixed(2)}`}/>
                                            <Td c={{textAlign:'right',color:SUBTLE}} ch={`$${f.fee.toFixed(2)}`}/>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}

                {/* P&L ANALYSIS */}
                {tab==='P&L ANALYSIS'&&(
                    <div style={{padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:SUBTLE,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>
                            POSITION P&L BREAKDOWN
                        </div>
                        {positions.map(p=>{
                            const pnl=p.pnl||0;
                            const pnlPct=p.avg_price>0?(pnl/(p.qty*p.avg_price))*100:0;
                            const barW=Math.min(Math.abs(pnlPct)*5,100);
                            return (
                                <div key={p.symbol} style={{background:PANEL,border:`1px solid ${BORDER}`,
                                    borderRadius:2,padding:'8px 12px',marginBottom:6}}>
                                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                                        <span style={{fontSize:12,color:AMBER,fontFamily:MONO,fontWeight:700}}>{p.symbol}</span>
                                        <span style={{fontSize:12,color:pnl>=0?GREEN:RED,fontFamily:MONO}}>
                                            {fmtUSD(pnl)} ({fmtPct(pnlPct)})
                                        </span>
                                    </div>
                                    <div style={{width:'100%',height:4,background:BORDER,borderRadius:2}}>
                                        <div style={{width:`${barW}%`,height:4,background:pnl>=0?GREEN:RED,borderRadius:2}}/>
                                    </div>
                                    <div style={{display:'flex',gap:16,marginTop:4,fontSize:10,color:SUBTLE,fontFamily:MONO}}>
                                        <span>QTY: {p.qty}</span>
                                        <span>AVG: ${p.avg_price.toFixed(2)}</span>
                                        <span>CUR: ${p.current_price.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {positions.length===0&&<div style={{fontSize:12,color:SUBTLE}}>NO POSITIONS</div>}
                    </div>
                )}
            </div>

            {selectedPos&&(
                <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'8px 14px',
                    display:'flex',gap:16,alignItems:'center',flexShrink:0,flexWrap:'wrap' as const}}>
                    <span style={{fontSize:11,color:AMBER,fontFamily:MONO,fontWeight:700}}>{selectedPos.symbol}</span>
                    <span style={{fontSize:11,color:TEXT,fontFamily:MONO}}>Qty: {selectedPos.qty}</span>
                    <span style={{fontSize:11,color:TEXT,fontFamily:MONO}}>Avg: ${selectedPos.avg_price.toFixed(2)}</span>
                    <span style={{fontSize:11,color:(selectedPos.pnl||0)>=0?GREEN:RED,fontFamily:MONO}}>
                        P&L: {fmtUSD(selectedPos.pnl||0)}
                    </span>
                    <button onClick={()=>setSelectedPos(null)} style={{marginLeft:'auto',background:'none',
                        border:'none',color:SUBTLE,cursor:'pointer',fontFamily:MONO,fontSize:9}}>DISMISS</button>
                </div>
            )}
        </div>
    );
}

