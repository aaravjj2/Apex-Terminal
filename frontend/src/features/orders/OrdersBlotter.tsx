// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

const Th=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <th style={{padding:'5px 8px',fontSize:10,fontFamily:MONO,color:SUBTLE,textTransform:'uppercase' as const,
    letterSpacing:'0.08em',borderBottom:`1px solid ${BORDER}`,textAlign:'left',cursor:'pointer',...c}}>{ch}</th>
)
const Td=({c,ch}:{c?:React.CSSProperties,ch:React.ReactNode})=>(
  <td style={{padding:'5px 8px',fontSize:11,fontFamily:MONO,borderBottom:`1px solid ${BORDER}`,color:TEXT,...c}}>{ch}</td>
)
function SBadge({status}:{status:string}){
  const m:Record<string,{c:string,bg:string}>={
    filled:{c:GREEN,bg:`${GREEN}18`},partial:{c:BLUE,bg:`${BLUE}18`},
    submitted:{c:AMBER,bg:`${AMBER}18`},canceled:{c:SUBTLE,bg:`${SUBTLE}18`},rejected:{c:RED,bg:`${RED}18`},
  }
  const x=m[status]||{c:SUBTLE,bg:`${SUBTLE}18`}
  return <span style={{fontSize:9,fontFamily:MONO,color:x.c,background:x.bg,padding:'2px 5px',borderRadius:2,
    textTransform:'uppercase' as const}}>{status}</span>
}

import { useState, useEffect } from 'react';

interface Order {
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    order_type: string;
    limit_price?: number;
    stop_price?: number;
    status: string;
    filled_qty: number;
    avg_fill_price?: number;
    submitted_at: string;
    filled_at?: string;
    rejected_reason?: string;
    strategy_id?: string;
}

const API_BASE = '/api/v1';

export function OrdersBlotter({ embedded }: { embedded?: boolean }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [filterSymbol, setFilterSymbol] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortField, setSortField] = useState<'submitted_at' | 'symbol'>('submitted_at');
    const [sortAsc, setSortAsc] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/portfolio/orders`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOrders(Array.isArray(data)?data:data.orders||[]);
        } catch (e) {
            console.error('Failed to fetch orders:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen || embedded) {
            fetchOrders();
            const interval = setInterval(fetchOrders, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen, embedded]);

    const filtered = orders
        .filter(o => !filterSymbol || o.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
        .filter(o => !filterStatus || o.status === filterStatus)
        .sort((a, b) => {
            const av = sortField==='submitted_at'?new Date(a.submitted_at).getTime():a.symbol;
            const bv = sortField==='submitted_at'?new Date(b.submitted_at).getTime():b.symbol;
            if (av<bv) return sortAsc?-1:1;
            if (av>bv) return sortAsc?1:-1;
            return 0;
        });

    const fmtTime=(iso:string)=>new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const fmtPrice=(v?:number)=>v!=null?`$${v.toFixed(2)}`:'â€”';
    const toggleSort=(f:'submitted_at'|'symbol')=>{
        if(sortField===f) setSortAsc(!sortAsc);
        else{setSortField(f);setSortAsc(false);}
    };

    const inp:React.CSSProperties={background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,
        padding:'3px 7px',fontSize:10,fontFamily:MONO,color:TEXT}
    const sel:React.CSSProperties={...inp,appearance:'none' as const}
    const toggleBtn:React.CSSProperties={display:'flex',alignItems:'center',gap:6,padding:'4px 10px',
        fontSize:10,fontFamily:MONO,background:PANEL,border:`1px solid ${BORDER}`,color:BLUE,cursor:'pointer',borderRadius:2}

    if (!embedded) {
        return (
            <>
                <button onClick={()=>setIsOpen(!isOpen)} style={toggleBtn} data-testid="orders-blotter-toggle">
                    ORDERS
                    {orders.filter(o=>o.status==='submitted').length>0&&(
                        <span style={{fontSize:9,background:AMBER,color:BG,padding:'1px 5px',borderRadius:2}}>
                            {orders.filter(o=>o.status==='submitted').length}
                        </span>
                    )}
                </button>
                {isOpen&&<BlotterPanel orders={filtered} filterSymbol={filterSymbol} setFilterSymbol={setFilterSymbol}
                    filterStatus={filterStatus} setFilterStatus={setFilterStatus} loading={loading}
                    fetch={fetchOrders} selectedOrder={selectedOrder} setSelectedOrder={setSelectedOrder}
                    sortField={sortField} toggleSort={toggleSort} sortAsc={sortAsc} onClose={()=>setIsOpen(false)}
                    fmtTime={fmtTime} fmtPrice={fmtPrice} inp={inp} sel={sel}/>}
            </>
        );
    }

    return (
        <BlotterPanel orders={filtered} filterSymbol={filterSymbol} setFilterSymbol={setFilterSymbol}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus} loading={loading}
            fetch={fetchOrders} selectedOrder={selectedOrder} setSelectedOrder={setSelectedOrder}
            sortField={sortField} toggleSort={toggleSort} sortAsc={sortAsc}
            fmtTime={fmtTime} fmtPrice={fmtPrice} inp={inp} sel={sel}/>
    );
}

interface BlotterProps {
    orders:Order[]; filterSymbol:string; setFilterSymbol:(v:string)=>void;
    filterStatus:string; setFilterStatus:(v:string)=>void; loading:boolean;
    fetch:()=>void; selectedOrder:Order|null; setSelectedOrder:(o:Order|null)=>void;
    sortField:'submitted_at'|'symbol'; toggleSort:(f:'submitted_at'|'symbol')=>void; sortAsc:boolean;
    onClose?:()=>void; fmtTime:(iso:string)=>string; fmtPrice:(v?:number)=>string;
    inp:React.CSSProperties; sel:React.CSSProperties;
}

function BlotterPanel({orders,filterSymbol,setFilterSymbol,filterStatus,setFilterStatus,loading,
    fetch: doFetch,selectedOrder,setSelectedOrder,sortField,toggleSort,sortAsc,onClose,fmtTime,fmtPrice,inp,sel}:BlotterProps){
    const S:React.CSSProperties={display:'flex',flexDirection:'column' as const,background:BG,
        border:`1px solid ${BORDER}`,height:'100%',fontFamily:MONO,color:TEXT}
    const HDR:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'6px 10px',
        borderBottom:`1px solid ${BORDER}`,background:PANEL,flexShrink:0}
    const sortIco=(f:string)=>sortField===f?(sortAsc?'â–²':'â–¼'):'â‡…'

    return (
        <div style={S} data-testid="orders-blotter-panel">
            <div style={HDR}>
                <span style={{fontSize:10,color:BLUE,letterSpacing:'0.1em'}}>OB</span>
                <span style={{fontSize:11,color:TEXT,fontWeight:700}}>ORDERS BLOTTER</span>
                <span style={{fontSize:10,color:SUBTLE}}>{orders.length} orders</span>
                <input placeholder="Symbol..." value={filterSymbol} onChange={e=>setFilterSymbol(e.target.value)} style={{...inp,width:80}}/>
                <select style={sel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                    <option value="">ALL</option>
                    <option value="submitted">SUBMITTED</option>
                    <option value="filled">FILLED</option>
                    <option value="partial">PARTIAL</option>
                    <option value="canceled">CANCELED</option>
                    <option value="rejected">REJECTED</option>
                </select>
                <button onClick={doFetch} style={{...inp,cursor:'pointer',color:loading?SUBTLE:BLUE,border:`1px solid ${BORDER}`}}>
                    {loading?'...':'â†»'}
                </button>
                {onClose&&<button onClick={onClose} style={{...inp,cursor:'pointer',marginLeft:'auto',color:SUBTLE}}>âœ•</button>}
            </div>
            <div style={{flex:1,overflowY:'auto' as const}} data-testid="orders-blotter-table">
                {orders.length===0&&(
                    <div style={{padding:24,textAlign:'center' as const,fontSize:11,color:SUBTLE}}>
                        {loading?'LOADING...':'NO ORDERS'}
                    </div>
                )}
                {orders.length>0&&(
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead style={{position:'sticky' as const,top:0,background:PANEL}}>
                            <tr>
                                <Th ch={<span onClick={()=>toggleSort('submitted_at')}>TIME {sortIco('submitted_at')}</span>}/>
                                <Th ch={<span onClick={()=>toggleSort('symbol')}>SYMBOL {sortIco('symbol')}</span>}/>
                                <Th ch="SIDE"/>
                                <Th ch="TYPE"/>
                                <Th c={{textAlign:'right'}} ch="QTY"/>
                                <Th c={{textAlign:'right'}} ch="FILLED"/>
                                <Th c={{textAlign:'right'}} ch="PRICE"/>
                                <Th ch="STATUS"/>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(o=>(
                                <tr key={o.id} data-testid={`order-row-${o.id}`}
                                    onClick={()=>setSelectedOrder(selectedOrder?.id===o.id?null:o)}
                                    style={{cursor:'pointer',background:selectedOrder?.id===o.id?`${AMBER}11`:'transparent'}}>
                                    <Td c={{fontSize:10,color:SUBTLE}} ch={fmtTime(o.submitted_at)}/>
                                    <Td c={{fontWeight:700}} ch={o.symbol}/>
                                    <Td c={{color:o.side==='buy'?GREEN:RED}} ch={o.side?.toUpperCase()||'â€”'}/>
                                    <Td c={{color:SUBTLE,fontSize:10}} ch={o.order_type?.toUpperCase()||'â€”'}/>
                                    <Td c={{textAlign:'right'}} ch={o.quantity}/>
                                    <Td c={{textAlign:'right',color:o.filled_qty===o.quantity?GREEN:AMBER}} ch={o.filled_qty}/>
                                    <Td c={{textAlign:'right',color:GREEN}} ch={fmtPrice(o.avg_fill_price||o.limit_price)}/>
                                    <Td ch={<SBadge status={o.status}/>}/>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {selectedOrder&&(
                <div style={{borderTop:`1px solid ${BORDER}`,background:PANEL,padding:'8px 10px',
                    fontSize:10,fontFamily:MONO,display:'flex',gap:16,flexWrap:'wrap' as const}}>
                    <span style={{color:BLUE}}>{selectedOrder.id}</span>
                    <span style={{color:TEXT}}>{selectedOrder.symbol}</span>
                    <span style={{color:selectedOrder.side==='buy'?GREEN:RED}}>{selectedOrder.side?.toUpperCase()}</span>
                    <SBadge status={selectedOrder.status}/>
                    {selectedOrder.rejected_reason&&<span style={{color:RED}}>REJ: {selectedOrder.rejected_reason}</span>}
                    <span style={{color:SUBTLE}}>STRAT: {selectedOrder.strategy_id||'N/A'}</span>
                    <button onClick={()=>setSelectedOrder(null)} style={{marginLeft:'auto',background:'none',
                        border:'none',color:SUBTLE,cursor:'pointer',fontFamily:MONO,fontSize:9}}>DISMISS</button>
                </div>
            )}
        </div>
    );
}
