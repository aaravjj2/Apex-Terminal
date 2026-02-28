// Bloomberg GK â€” Options Greeks Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
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

interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    iv?: number;
    dte?: number;
}

interface PositionGreeks {
    symbol: string;
    expiry: string;
    strike: number;
    type: 'call' | 'put';
    quantity: number;
    premium: number;
    greeks: Greeks;
}

const MOCK_GREEKS: PositionGreeks[] = [
    { symbol:'AAPL', expiry:'Jan 19 \'24', strike:180, type:'call', quantity: 10, premium:4.85, greeks:{ delta:0.45, gamma:0.035, theta:-0.12, vega:0.28, rho:0.15, iv:0.224, dte:12 } },
    { symbol:'AAPL', expiry:'Jan 19 \'24', strike:175, type:'put',  quantity: -5, premium:3.20, greeks:{ delta:-0.35,gamma:0.028, theta:-0.08, vega:0.22, rho:-0.12,iv:0.248, dte:12 } },
    { symbol:'MSFT', expiry:'Feb 16 \'24', strike:380, type:'call', quantity:  5, premium:9.40, greeks:{ delta:0.52, gamma:0.022, theta:-0.15, vega:0.45, rho:0.28, iv:0.218, dte:40 } },
    { symbol:'NVDA', expiry:'Jan 19 \'24', strike:800, type:'call', quantity:  3, premium:18.5, greeks:{ delta:0.48, gamma:0.018, theta:-0.28, vega:0.82, rho:0.19, iv:0.412, dte:12 } },
    { symbol:'TSLA', expiry:'Mar 15 \'24', strike:220, type:'put',  quantity: -8, premium:7.60, greeks:{ delta:-0.42,gamma:0.031, theta:-0.18, vega:0.61, rho:-0.16,iv:0.558, dte:67 } },
];

type SortKey = 'symbol' | 'delta' | 'theta' | 'vega';

export function GreeksTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [sortKey, setSortKey] = useState<SortKey>('symbol');
    const [sortAsc, setSortAsc] = useState(true);
    const [selected, setSelected] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);

    const sorted = [...MOCK_GREEKS].sort((a, b) => {
        let va: number | string, vb: number | string;
        if (sortKey === 'symbol') { va = a.symbol; vb = b.symbol; }
        else if (sortKey === 'delta') { va = a.greeks.delta * a.quantity; vb = b.greeks.delta * b.quantity; }
        else if (sortKey === 'theta') { va = a.greeks.theta * a.quantity; vb = b.greeks.theta * b.quantity; }
        else { va = a.greeks.vega * Math.abs(a.quantity); vb = b.greeks.vega * Math.abs(b.quantity); }
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    const totals = MOCK_GREEKS.reduce((acc, pos) => ({
        delta: acc.delta + pos.greeks.delta * pos.quantity * 100,
        gamma: acc.gamma + pos.greeks.gamma * pos.quantity * 100,
        theta: acc.theta + pos.greeks.theta * pos.quantity * 100,
        vega:  acc.vega  + pos.greeks.vega  * pos.quantity * 100,
        rho:   acc.rho   + pos.greeks.rho   * pos.quantity * 100,
    }), { delta:0, gamma:0, theta:0, vega:0, rho:0 });

    function toggleSort(k: SortKey) {
        if (sortKey === k) setSortAsc(a => !a);
        else { setSortKey(k); setSortAsc(true); }
    }

    const selPos = selected !== null ? sorted[selected] : null;

    const hdrBtn = (label: string, k: SortKey, align: 'left'|'right' = 'right') => (
        <div onClick={() => toggleSort(k)} style={{ textAlign:align, cursor:'pointer', color: sortKey === k ? AMBER : SUBTLE, fontSize:9, userSelect:'none' }}>
            {label}{sortKey === k ? (sortAsc ? 'â–²' : 'â–¼') : ''}
        </div>
    );

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>GK â€” GREEKS</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>{MOCK_GREEKS.length} POSITIONS</span>
            </div>

            {/* Portfolio summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1, padding:4, background:'#0d0d0d', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                {[
                    ['Î” DELTA',  totals.delta.toFixed(0),  totals.delta >= 0 ? GREEN : RED],
                    ['Î“ GAMMA',  totals.gamma.toFixed(1),  BLUE],
                    ['Î˜ THETA',  `$${totals.theta.toFixed(0)}`, totals.theta >= 0 ? GREEN : RED],
                    ['V VEGA',   totals.vega.toFixed(0),   PURPLE],
                    ['Ï RHO',    totals.rho.toFixed(0),    ORANGE],
                ].map(([label, value, color]) => (
                    <div key={label as string} style={{ background:PANEL, padding:'4px 6px', textAlign:'center', borderTop:`2px solid ${color as string}` }}>
                        <div style={{ color:SUBTLE, fontSize:8 }}>{label as string}</div>
                        <div style={{ color:color as string, fontFamily:MONO, fontSize:12, fontWeight:700 }}>{value as string}</div>
                    </div>
                ))}
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'60px 80px 40px 40px 40px 40px 40px', gap:4, padding:'2px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {hdrBtn('SYMBOL', 'symbol', 'left')}
                <div style={{ color:SUBTLE, fontSize:9 }}>POSITION</div>
                {hdrBtn('Î”', 'delta')}
                <div style={{ color:SUBTLE, fontSize:9, textAlign:'right' }}>Î“</div>
                {hdrBtn('Î˜$', 'theta')}
                {hdrBtn('V', 'vega')}
                <div style={{ color:SUBTLE, fontSize:9, textAlign:'right' }}>Ï</div>
            </div>

            {/* Rows */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {sorted.map((pos, idx) => {
                    const isSel = selected === idx;
                    const isHov = hovered === idx;
                    const netDelta = pos.greeks.delta * pos.quantity * 100;
                    const netTheta = pos.greeks.theta * pos.quantity * 100;
                    return (
                        <div key={idx}
                            onClick={() => setSelected(isSel ? null : idx)}
                            onMouseEnter={() => setHovered(idx)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display:'grid', gridTemplateColumns:'60px 80px 40px 40px 40px 40px 40px', gap:4,
                                padding:'4px 8px', cursor:'pointer',
                                background: isSel ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft:`2px solid ${pos.type === 'call' ? GREEN : RED}`,
                            }}
                        >
                            <div style={{ color: isSel ? AMBER : TEXT }}>{pos.symbol}</div>
                            <div style={{ color:SUBTLE, fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {pos.quantity > 0 ? '+' : ''}{pos.quantity} {pos.strike}{pos.type === 'call' ? 'C' : 'P'}
                            </div>
                            <div style={{ textAlign:'right', color: netDelta >= 0 ? GREEN : RED, fontFamily:MONO }}>{netDelta.toFixed(0)}</div>
                            <div style={{ textAlign:'right', color:BLUE, fontFamily:MONO, fontSize:10 }}>{(pos.greeks.gamma * pos.quantity * 100).toFixed(1)}</div>
                            <div style={{ textAlign:'right', color: netTheta >= 0 ? GREEN : RED, fontFamily:MONO }}>{netTheta.toFixed(0)}</div>
                            <div style={{ textAlign:'right', color:PURPLE, fontFamily:MONO }}>{(pos.greeks.vega * Math.abs(pos.quantity) * 100).toFixed(0)}</div>
                            <div style={{ textAlign:'right', color:SUBTLE, fontFamily:MONO, fontSize:10 }}>{(pos.greeks.rho * pos.quantity * 100).toFixed(0)}</div>
                        </div>
                    );
                })}
            </div>

            {/* Detail panel */}
            {selPos && (
                <div style={{ background:PANEL, borderTop:`1px solid ${AMBER}`, padding:'6px 10px', flexShrink:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>{selPos.symbol} {selPos.strike}{selPos.type.toUpperCase()} {selPos.expiry}</span>
                        <span style={{ color: selPos.quantity >= 0 ? GREEN : RED }}>{selPos.quantity >= 0 ? 'LONG' : 'SHORT'} {Math.abs(selPos.quantity)}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
                        {[
                            ['PREMIUM', `$${selPos.premium.toFixed(2)}`, TEXT],
                            ['IV', `${(selPos.greeks.iv! * 100).toFixed(1)}%`, selPos.greeks.iv! > 0.3 ? RED : AMBER],
                            ['DTE', `${selPos.greeks.dte}d`, BLUE],
                            ['Î”/contract', selPos.greeks.delta.toFixed(3), selPos.greeks.delta >= 0 ? GREEN : RED],
                            ['Î˜/day', `-$${(Math.abs(selPos.greeks.theta)*100).toFixed(2)}`, RED],
                            ['V/vol%', selPos.greeks.vega.toFixed(3), PURPLE],
                        ].map(([l,v,c]) => (
                            <div key={l as string}>
                                <div style={{ color:SUBTLE, fontSize:8 }}>{l as string}</div>
                                <div style={{ color:c as string, fontFamily:MONO, fontSize:10 }}>{v as string}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
