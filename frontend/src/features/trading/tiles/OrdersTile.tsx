// Bloomberg OR — Orders Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState } from 'react';
import React from 'react';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';
type OrderSide = 'buy' | 'sell';

interface Order {
    id: string;
    symbol: string;
    side: OrderSide;
    type: string;
    quantity: number;
    price: number | null;
    status: OrderStatus;
    filledQty: number;
    time: string;
    account: string;
}

const MOCK_ORDERS: Order[] = [
    { id:'1', symbol:'AAPL', side:'buy',  type:'limit',  quantity:100, price:175.00, status:'pending',   filledQty:0,  time:'10:32:15', account:'PRD' },
    { id:'2', symbol:'MSFT', side:'sell', type:'market', quantity:50,  price:null,   status:'filled',    filledQty:50, time:'10:28:42', account:'PRD' },
    { id:'3', symbol:'NVDA', side:'buy',  type:'limit',  quantity:25,  price:850.00, status:'pending',   filledQty:10, time:'10:15:30', account:'PRD' },
    { id:'4', symbol:'TSLA', side:'sell', type:'stop',   quantity:100, price:240.00, status:'cancelled', filledQty:0,  time:'09:45:20', account:'TST' },
    { id:'5', symbol:'SPY',  side:'buy',  type:'limit',  quantity:200, price:544.00, status:'pending',   filledQty:0,  time:'09:30:05', account:'PRD' },
    { id:'6', symbol:'META', side:'sell', type:'market', quantity:30,  price:null,   status:'filled',    filledQty:30, time:'09:29:58', account:'TST' },
    { id:'7', symbol:'AMZN', side:'buy',  type:'limit',  quantity:15,  price:178.00, status:'rejected',  filledQty:0,  time:'09:28:12', account:'PRD' },
];

const STATUS_COLOR: Record<OrderStatus, string> = {
    pending: AMBER, filled: GREEN, cancelled: SUBTLE, rejected: RED,
};
const STATUS_SYM: Record<OrderStatus, string> = {
    pending: '◷', filled: '✓', cancelled: '✕', rejected: '⊘',
};

export function OrdersTile({ tileId, onClose, onMaximize, isMaximized }: TileProps) {
    void tileId; void onClose; void onMaximize; void isMaximized;
    const [filter, setFilter] = useState<'all' | 'active' | 'filled' | 'cancelled'>('all');
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const filteredOrders = MOCK_ORDERS.filter(order => {
        if (filter === 'active')   return order.status === 'pending';
        if (filter === 'filled')   return order.status === 'filled';
        if (filter === 'cancelled') return order.status === 'cancelled' || order.status === 'rejected';
        return true;
    });

    const pending = MOCK_ORDERS.filter(o => o.status === 'pending').length;
    const filled  = MOCK_ORDERS.filter(o => o.status === 'filled').length;
    const canc    = MOCK_ORDERS.filter(o => o.status === 'cancelled' || o.status === 'rejected').length;

    const selOrder = selected ? MOCK_ORDERS.find(o => o.id === selected) : null;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>OR — ORDERS</span>
                <div style={{ display:'flex', gap:10 }}>
                    <span style={{ color:AMBER, fontSize:10 }}>◷ {pending} PEND</span>
                    <span style={{ color:GREEN, fontSize:10 }}>✓ {filled} FILL</span>
                    <span style={{ color:SUBTLE, fontSize:10 }}>✕ {canc} CXL</span>
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display:'flex', gap:0, padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {(['all','active','filled','cancelled'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        style={{
                            background: filter === tab ? AMBER : 'transparent',
                            border: `1px solid ${filter === tab ? AMBER : BORDER}`,
                            color: filter === tab ? BG : SUBTLE,
                            fontFamily:MONO, fontSize:10, padding:'2px 8px', cursor:'pointer',
                            textTransform:'uppercase', marginRight:2, borderRadius:2,
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'60px 36px 50px 50px 60px 60px 1fr', gap:4, padding:'2px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {['SYMBOL','SIDE','TYPE','QTY','PRICE','TIME','STATUS'].map(h => (
                    <div key={h} style={{ color:SUBTLE, fontSize:9, textAlign: h === 'QTY' || h === 'PRICE' ? 'right' : 'left' }}>{h}</div>
                ))}
            </div>

            {/* Orders list */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {filteredOrders.map(order => {
                    const fillPct = order.quantity ? (order.filledQty / order.quantity) * 100 : 0;
                    const isSel = selected === order.id;
                    const isHov = hovered === order.id;
                    return (
                        <div
                            key={order.id}
                            onClick={() => setSelected(isSel ? null : order.id)}
                            onMouseEnter={() => setHovered(order.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display:'grid', gridTemplateColumns:'60px 36px 50px 50px 60px 60px 1fr', gap:4,
                                padding:'4px 8px', cursor:'pointer',
                                background: isSel ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft: isSel ? `2px solid ${AMBER}` : '2px solid transparent',
                            }}
                        >
                            <div style={{ color: isSel ? AMBER : TEXT }}>{order.symbol}</div>
                            <div style={{ color: order.side === 'buy' ? GREEN : RED, fontWeight:700, fontSize:10 }}>{order.side.toUpperCase()}</div>
                            <div style={{ color:SUBTLE, fontSize:10, textTransform:'uppercase' }}>{order.type}</div>
                            <div style={{ textAlign:'right', color:TEXT }}>
                                {order.filledQty > 0 ? `${order.filledQty}/${order.quantity}` : order.quantity}
                            </div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color:TEXT }}>
                                {order.price ? order.price.toFixed(2) : 'MKT'}
                            </div>
                            <div style={{ color:SUBTLE, fontSize:10 }}>{order.time}</div>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <span style={{ color: STATUS_COLOR[order.status], fontSize:11 }}>{STATUS_SYM[order.status]}</span>
                                <span style={{ color: STATUS_COLOR[order.status], fontSize:9, textTransform:'uppercase' }}>{order.status}</span>
                                {order.status === 'pending' && fillPct > 0 && (
                                    <div style={{ width:30, height:3, background:BORDER, borderRadius:2 }}>
                                        <div style={{ width:`${fillPct}%`, height:3, background:AMBER, borderRadius:2 }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Order detail */}
            {selOrder && (
                <div style={{ background:PANEL, borderTop:`1px solid ${AMBER}`, padding:'6px 10px', flexShrink:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>ORDER #{selOrder.id} — {selOrder.symbol}</span>
                        <span style={{ color: STATUS_COLOR[selOrder.status], fontSize:10 }}>{selOrder.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                        {[
                            ['SIDE',  selOrder.side.toUpperCase(), selOrder.side === 'buy' ? GREEN : RED],
                            ['TYPE',  selOrder.type.toUpperCase(), BLUE],
                            ['QTY',   `${selOrder.filledQty}/${selOrder.quantity}`, TEXT],
                            ['PRICE', selOrder.price ? selOrder.price.toFixed(2) : 'MKT', TEXT],
                            ['ACCT',  selOrder.account, AMBER],
                        ].map(([l, v, c]) => (
                            <div key={l as string}>
                                <div style={{ color:SUBTLE, fontSize:9 }}>{l as string}</div>
                                <div style={{ color:c as string, fontFamily:MONO, fontSize:11 }}>{v as string}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', flexShrink:0 }}>
                <span style={{ color:SUBTLE, fontSize:9 }}>ORDERS: {filteredOrders.length}/{MOCK_ORDERS.length}</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>MOCK DATA</span>
            </div>
        </div>
    );
}
