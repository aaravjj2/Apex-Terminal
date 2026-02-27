// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const PURPLE='#ab47bc',SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <th style={{padding:'6px 10px',fontSize:10,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
    letterSpacing:'0.08em',borderBottom:`1px solid ${BORDER}`,textAlign:'left',...c}}>{ch}</th>
)
const Td=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <td style={{padding:'6px 10px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)

function StatusBadge({status}:{status:string}){
  const cfg:Record<string,{c:string,bg:string}>={
    filled:{c:GREEN,bg:`${GREEN}18`},partial:{c:BLUE,bg:`${BLUE}18`},
    pending:{c:AMBER,bg:`${AMBER}18`},new:{c:AMBER,bg:`${AMBER}18`},
    canceled:{c:SUBTLE,bg:`${SUBTLE}18`},rejected:{c:RED,bg:`${RED}18`},
  }
  const x=cfg[status]||{c:SUBTLE,bg:`${SUBTLE}18`}
  return <span style={{fontSize:9,fontFamily:MONO,color:x.c,background:x.bg,padding:'2px 6px',borderRadius:2,
    textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>{status}</span>
}
function SideBadge({side}:{side:string}){
  return <span style={{fontSize:10,fontFamily:MONO,color:side==='buy'?GREEN:RED,
    fontWeight:700,letterSpacing:'0.04em'}}>{side.toUpperCase()}</span>
}
function SourceBadge({source}:{source:string}){
  const c=source==='autopilot'?PURPLE:source==='manual'?BLUE:AMBER
  return <span style={{fontSize:9,fontFamily:MONO,color:c,letterSpacing:'0.06em'}}>{source.toUpperCase()}</span>
}
function StatCard({label,value,color}:{label:string,value:string,color?:string}){
  return (
    <div style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,padding:'8px 12px',minWidth:100}}>
      <div style={{fontSize:9,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:16,fontFamily:MONO,color:color||AMBER,fontWeight:700}}>{value}</div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../config/api';

interface Order {
    id: string;
    client_order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    qty: number;
    filled_qty: number;
    avg_fill_price?: number;
    limit_price?: number;
    stop_price?: number;
    status: 'new' | 'pending' | 'partial' | 'filled' | 'canceled' | 'rejected';
    created_at: string;
    filled_at?: string;
    source: 'manual' | 'autopilot' | 'strategy';
    run_id?: string;
    retry_count: number;
    rejection_reason?: string;
}

const TABS=['ORDERS','FILLS','PENDING','REJECTED','AUDIT'] as const
type OTab=typeof TABS[number]

export function OrdersView() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [runIdFilter, setRunIdFilter] = useState('');
    const [tab, setTab] = useState<OTab>('ORDERS');
    const [selectedOrder, setSelectedOrder] = useState<Order|null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/api/v1/portfolio/orders`;
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (params.toString()) url += `?${params.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || data || []);
            }
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        }
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const all = orders.filter(o => {
        if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
        if (runIdFilter && !o.run_id?.includes(runIdFilter)) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return o.symbol.toLowerCase().includes(q)||o.client_order_id.toLowerCase().includes(q)||o.id.toLowerCase().includes(q);
        }
        return true;
    });
    const pending=all.filter(o=>['pending','new'].includes(o.status));
    const filled=all.filter(o=>o.status==='filled');
    const rejected=all.filter(o=>o.status==='rejected');
    const partial=all.filter(o=>o.status==='partial');

    const fmtTime=(iso:string)=>new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',
        hour:'2-digit',minute:'2-digit',hour12:false});
    const fmtPrice=(v?:number)=>v!=null?`$${v.toFixed(2)}`:'â€”';

    const displayOrders=tab==='FILLS'?filled:tab==='PENDING'?pending:tab==='REJECTED'?rejected:all;

    const S:React.CSSProperties={height:'100%',display:'flex',flexDirection:'column' as const,background:BG,fontFamily:MONO}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0,flexWrap:'wrap' as const}
    const TABBAR:React.CSSProperties={display:'flex',gap:2,padding:'0 14px',borderBottom:`1px solid ${BORDER}`,
        background:PANEL,flexShrink:0}
    const tbtn=(a:boolean):React.CSSProperties=>({padding:'7px 12px',fontSize:10,fontFamily:MONO,
        letterSpacing:'0.08em',cursor:'pointer',background:'none',border:'none',
        borderBottom:a?`2px solid ${AMBER}`:'2px solid transparent',
        color:a?AMBER:SUBTLE,textTransform:'uppercase' as const})
    const inp:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
        padding:'4px 8px',fontSize:11,fontFamily:MONO,color:TEXT}
    const sel:React.CSSProperties={...inp,appearance:'none' as const}
    const refreshBtn:React.CSSProperties={padding:'4px 10px',fontSize:10,fontFamily:MONO,
        background:PANEL,border:`1px solid ${BORDER}`,color:loading?SUBTLE:BLUE,cursor:'pointer',borderRadius:2}

    return (
        <div style={S} data-testid="orders-view">
            <div style={HDR}>
                <span style={{fontSize:11,color:BLUE,letterSpacing:'0.1em'}}>OR</span>
                <span style={{fontSize:13,color:TEXT,fontWeight:700}}>ORDER BLOTTER</span>
                <span style={{fontSize:10,color:SUBTLE}}>APEX EXECUTION ENGINE</span>
                <div style={{flex:1}}/>
                <input placeholder="Search symbol / ID..." value={searchQuery}
                    onChange={e=>setSearchQuery(e.target.value)} style={{...inp,width:180}}/>
                <input placeholder="Run ID filter..." value={runIdFilter}
                    onChange={e=>setRunIdFilter(e.target.value)} style={{...inp,width:140}}/>
                <select style={sel} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                    <option value="all">ALL STATUS</option>
                    {['pending','partial','filled','canceled','rejected'].map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
                <select style={sel} value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}>
                    <option value="all">ALL SOURCES</option>
                    <option value="autopilot">AUTOPILOT</option>
                    <option value="manual">MANUAL</option>
                    <option value="strategy">STRATEGY</option>
                </select>
                <button style={refreshBtn} onClick={fetchOrders}>{loading?'LOADING...':'REFRESH'}</button>
            </div>

            {/* Stats strip */}
            <div style={{display:'flex',gap:8,padding:'8px 14px',borderBottom:`1px solid ${BORDER}`,
                background:PANEL,flexShrink:0}}>
                <StatCard label="Total Orders" value={String(all.length)} color={TEXT}/>
                <StatCard label="Pending" value={String(pending.length)} color={AMBER}/>
                <StatCard label="Filled" value={String(filled.length)} color={GREEN}/>
                <StatCard label="Partial" value={String(partial.length)} color={BLUE}/>
                <StatCard label="Rejected" value={String(rejected.length)} color={RED}/>
            </div>

            <div style={TABBAR}>
                {TABS.map(t=><button key={t} style={tbtn(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
            </div>

            <div style={{flex:1,overflowY:'auto' as const}}>
                {tab==='AUDIT' && (
                    <div style={{padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:SUBTLE,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>
                            ORDER AUDIT TRAIL
                        </div>
                        {all.slice(0,50).map(o=>(
                            <div key={o.id} style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
                                padding:'8px 12px',marginBottom:4}}>
                                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                                    <span style={{fontSize:10,color:BLUE,fontFamily:MONO}}>{o.id.substring(0,16)}</span>
                                    <span style={{fontSize:10,color:TEXT,fontFamily:MONO}}>{o.symbol}</span>
                                    <SideBadge side={o.side}/>
                                    <StatusBadge status={o.status}/>
                                    <SourceBadge source={o.source}/>
                                    <span style={{fontSize:10,color:SUBTLE,marginLeft:'auto',fontFamily:MONO}}>{fmtTime(o.created_at)}</span>
                                </div>
                                {o.rejection_reason&&(
                                    <div style={{fontSize:10,color:RED,fontFamily:MONO,marginTop:4}}>REJECTION: {o.rejection_reason}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {tab!=='AUDIT'&&(
                    <>
                        {displayOrders.length===0&&(
                            <div style={{padding:40,textAlign:'center' as const,fontSize:12,color:SUBTLE}}>
                                {loading?'LOADING ORDERS...':'NO ORDERS FOUND FOR CURRENT FILTERS'}
                            </div>
                        )}
                        {displayOrders.length>0&&(
                            <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                                    <tr>
                                        <Th ch="Time"/>
                                        <Th ch="Symbol"/>
                                        <Th ch="Side"/>
                                        <Th ch="Type"/>
                                        <Th c={{textAlign:'right'}} ch="Qty"/>
                                        <Th c={{textAlign:'right'}} ch="Filled"/>
                                        <Th c={{textAlign:'right'}} ch="Price"/>
                                        <Th c={{textAlign:'right'}} ch="Limit"/>
                                        <Th ch="Status"/>
                                        <Th ch="Source"/>
                                        <Th c={{textAlign:'right'}} ch="Retry"/>
                                        <Th ch="Client Order ID"/>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayOrders.map(o=>(
                                        <tr key={o.id} onClick={()=>setSelectedOrder(selectedOrder?.id===o.id?null:o)}
                                            style={{cursor:'pointer',background:selectedOrder?.id===o.id?`${AMBER}11`:'transparent'}}>
                                            <Td ch={<span style={{fontSize:10,color:SUBTLE}}>{fmtTime(o.created_at)}</span>}/>
                                            <Td c={{color:TEXT,fontWeight:700}} ch={o.symbol}/>
                                            <Td ch={<SideBadge side={o.side}/>}/>
                                            <Td c={{color:SUBTLE,fontSize:10}} ch={o.type.toUpperCase()}/>
                                            <Td c={{textAlign:'right'}} ch={o.qty}/>
                                            <Td c={{textAlign:'right',color:o.filled_qty===o.qty?GREEN:AMBER}} ch={o.filled_qty}/>
                                            <Td c={{textAlign:'right',color:GREEN}} ch={fmtPrice(o.avg_fill_price)}/>
                                            <Td c={{textAlign:'right'}} ch={fmtPrice(o.limit_price)}/>
                                            <Td ch={<StatusBadge status={o.status}/>}/>
                                            <Td ch={<SourceBadge source={o.source}/>}/>
                                            <Td c={{textAlign:'right',color:o.retry_count>0?AMBER:SUBTLE}} ch={o.retry_count>0?String(o.retry_count):'â€”'}/>
                                            <Td c={{color:SUBTLE,fontSize:10}} ch={o.client_order_id}/>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>

            {selectedOrder&&(
                <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'10px 14px',
                    fontSize:11,fontFamily:MONO,flexShrink:0}}>
                    <div style={{display:'flex',gap:20,flexWrap:'wrap' as const,alignItems:'center'}}>
                        <span style={{color:BLUE}}>{selectedOrder.id}</span>
                        <span style={{color:TEXT}}>{selectedOrder.symbol} <SideBadge side={selectedOrder.side}/></span>
                        <span style={{color:SUBTLE}}>Run: {selectedOrder.run_id||'N/A'}</span>
                        <span style={{color:SUBTLE}}>Qty: {selectedOrder.qty} | Filled: {selectedOrder.filled_qty}</span>
                        {selectedOrder.rejection_reason&&<span style={{color:RED}}>REJECTION: {selectedOrder.rejection_reason}</span>}
                        <button onClick={()=>setSelectedOrder(null)} style={{marginLeft:'auto',background:'none',
                            border:'none',color:SUBTLE,fontSize:10,cursor:'pointer',fontFamily:MONO}}>DISMISS</button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface Order {
    id: string;
    client_order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    qty: number;
    filled_qty: number;
    avg_fill_price?: number;
    limit_price?: number;
    stop_price?: number;
    status: 'new' | 'pending' | 'partial' | 'filled' | 'canceled' | 'rejected';
    created_at: string;
    filled_at?: string;
    source: 'manual' | 'autopilot' | 'strategy';
    run_id?: string;
    retry_count: number;
    rejection_reason?: string;
}

