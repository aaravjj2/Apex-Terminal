// Bloomberg PT — Positions Terminal Tile
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

import { useState, useEffect } from 'react';
import { streamSimulator } from '../../../ui2/stores/streamSimulator';
import React from 'react';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface Position {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    sector: string;
    dayPL: number;
}

const SEED_PRICES: Record<string, number> = { SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55, MSFT: 412.33 };

const MOCK_POSITIONS: Position[] = [
    { symbol:'SPY',  quantity:150, avgCost:535.20, currentPrice:SEED_PRICES['SPY'],  marketValue:82084.50, unrealizedPL:1804.50,  unrealizedPLPercent:2.24,  sector:'ETF',     dayPL:310.50  },
    { symbol:'AAPL', quantity:200, avgCost:185.30, currentPrice:SEED_PRICES['AAPL'], marketValue:36482.00, unrealizedPL:-578.00,  unrealizedPLPercent:-1.56, sector:'Tech',    dayPL:-124.00 },
    { symbol:'TSLA', quantity:75,  avgCost:210.15, currentPrice:SEED_PRICES['TSLA'], marketValue:16407.75, unrealizedPL:646.50,   unrealizedPLPercent:4.10,  sector:'Auto',    dayPL:89.25   },
    { symbol:'NVDA', quantity:50,  avgCost:805.40, currentPrice:SEED_PRICES['NVDA'], marketValue:39477.50, unrealizedPL:-792.50,  unrealizedPLPercent:-1.97, sector:'Semi',    dayPL:-205.00 },
    { symbol:'MSFT', quantity:100, avgCost:400.10, currentPrice:SEED_PRICES['MSFT'], marketValue:41233.00, unrealizedPL:1223.00,  unrealizedPLPercent:3.06,  sector:'Tech',    dayPL:412.00  },
];

type SortKey = 'symbol' | 'marketValue' | 'unrealizedPL' | 'unrealizedPLPercent';

export function PositionsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
    const [sortKey, setSortKey] = useState<SortKey>('marketValue');
    const [sortAsc, setSortAsc] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [showDayPL, setShowDayPL] = useState(false);

    useEffect(() => {
        setPositions(prev => prev.map(p => {
            const latest = streamSimulator.getLatestPrice(p.symbol) || p.currentPrice;
            const mv = Number((latest * p.quantity).toFixed(2));
            const cb = Number((p.avgCost * p.quantity).toFixed(2));
            const upl = Number((mv - cb).toFixed(2));
            const uplPct = cb ? Number(((upl / cb) * 100).toFixed(2)) : p.unrealizedPLPercent;
            return { ...p, currentPrice: latest, marketValue: mv, unrealizedPL: upl, unrealizedPLPercent: uplPct };
        }));
        const unsub = streamSimulator.subscribe((tick) => {
            setPositions(prev => prev.map(p => {
                if (p.symbol !== tick.symbol) return p;
                const latest = tick.price ?? p.currentPrice;
                const mv = Number((latest * p.quantity).toFixed(2));
                const cb = Number((p.avgCost * p.quantity).toFixed(2));
                const upl = Number((mv - cb).toFixed(2));
                const uplPct = cb ? Number(((upl / cb) * 100).toFixed(2)) : p.unrealizedPLPercent;
                return { ...p, currentPrice: latest, marketValue: mv, unrealizedPL: upl, unrealizedPLPercent: uplPct };
            }));
        });
        return () => unsub();
    }, []);

    function handleSort(k: SortKey) {
        if (sortKey === k) setSortAsc(a => !a);
        else { setSortKey(k); setSortAsc(false); }
    }

    const sorted = [...positions].sort((a, b) => {
        let va: number | string = a[sortKey];
        let vb: number | string = b[sortKey];
        if (typeof va === 'string') return sortAsc ? (va).localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
    const totalPL    = positions.reduce((s, p) => s + p.unrealizedPL, 0);
    const totalDayPL = positions.reduce((s, p) => s + p.dayPL, 0);
    const selPos     = selected ? positions.find(p => p.symbol === selected) : null;

    const hdrBtn = (label: string, k: SortKey) => (
        <div onClick={() => handleSort(k)} style={{ textAlign:'right', cursor:'pointer', color: sortKey === k ? AMBER : SUBTLE, fontSize:9, userSelect:'none' }}>
            {label}{sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
        </div>
    );

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>PT — POSITIONS</span>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ color:SUBTLE, fontSize:10 }}>NAV: ${(totalValue/1000).toFixed(1)}K</span>
                    <span style={{ color: totalPL >= 0 ? GREEN : RED, fontSize:10 }}>{totalPL >= 0 ? '+' : ''}${totalPL.toFixed(0)}</span>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {[
                    ['PORTFOLIO VALUE', `$${(totalValue/1000).toFixed(2)}K`, BLUE],
                    ['UNREALIZED P&L', `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`, totalPL >= 0 ? GREEN : RED],
                    ['DAY P&L', `${totalDayPL >= 0 ? '+' : ''}$${totalDayPL.toFixed(2)}`, totalDayPL >= 0 ? GREEN : RED],
                ].map(([lbl, val, col]) => (
                    <div key={lbl as string} style={{ padding:'3px 4px', background:BG, border:`1px solid ${BORDER}`, borderRadius:2, borderTop:`2px solid ${col as string}` }}>
                        <div style={{ color:SUBTLE, fontSize:8 }}>{lbl as string}</div>
                        <div style={{ color:col as string, fontFamily:MONO, fontSize:11, fontWeight:700 }}>{val as string}</div>
                    </div>
                ))}
            </div>

            {/* Toggle */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:BG, flexShrink:0 }}>
                <button onClick={() => setShowDayPL(false)}
                    style={{ background: !showDayPL ? AMBER : 'transparent', border:`1px solid ${!showDayPL ? AMBER : BORDER}`, color: !showDayPL ? BG : SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 6px', cursor:'pointer', borderRadius:2 }}>
                    TOTAL P&L
                </button>
                <button onClick={() => setShowDayPL(true)}
                    style={{ background: showDayPL ? AMBER : 'transparent', border:`1px solid ${showDayPL ? AMBER : BORDER}`, color: showDayPL ? BG : SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 6px', cursor:'pointer', borderRadius:2 }}>
                    DAY P&L
                </button>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'60px 40px 60px 70px 70px 50px', gap:4, padding:'2px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                <div style={{ color:SUBTLE, fontSize:9 }}>SYMBOL</div>
                <div style={{ textAlign:'right', color:SUBTLE, fontSize:9 }}>QTY</div>
                {hdrBtn('PRICE', 'symbol')}
                {hdrBtn('MKT VAL', 'marketValue')}
                {hdrBtn(showDayPL ? 'DAY P&L' : 'P&L $', 'unrealizedPL')}
                {hdrBtn('P&L %', 'unrealizedPLPercent')}
            </div>

            {/* Position rows */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {sorted.map(pos => {
                    const plVal = showDayPL ? pos.dayPL : pos.unrealizedPL;
                    const plPct = pos.unrealizedPLPercent;
                    const isGain = plVal >= 0;
                    const isSel = selected === pos.symbol;
                    const isHov = hovered === pos.symbol;
                    return (
                        <div
                            key={pos.symbol}
                            onClick={() => setSelected(isSel ? null : pos.symbol)}
                            onMouseEnter={() => setHovered(pos.symbol)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display:'grid', gridTemplateColumns:'60px 40px 60px 70px 70px 50px', gap:4,
                                padding:'4px 8px', cursor:'pointer',
                                background: isSel ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft: isSel ? `2px solid ${AMBER}` : '2px solid transparent',
                            }}
                        >
                            <div>
                                <div style={{ color: isSel ? AMBER : TEXT }}>{pos.symbol}</div>
                                <div style={{ color:SUBTLE, fontSize:9 }}>{pos.sector}</div>
                            </div>
                            <div style={{ textAlign:'right', color:SUBTLE }}>{pos.quantity}</div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color:TEXT }} data-testid={`positions-tile-price-${pos.symbol}`}>
                                {pos.currentPrice.toFixed(2)}
                            </div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color:TEXT }}>
                                ${(pos.marketValue/1000).toFixed(1)}K
                            </div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color: isGain ? GREEN : RED }}>
                                {isGain ? '+' : ''}${Math.abs(plVal).toFixed(0)}
                            </div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color: plPct >= 0 ? GREEN : RED }}>
                                {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail panel */}
            {selPos && (
                <div style={{ background:PANEL, borderTop:`1px solid ${AMBER}`, padding:'6px 10px', flexShrink:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>{selPos.symbol} — {selPos.sector}</span>
                        <span style={{ color: selPos.unrealizedPL >= 0 ? GREEN : RED, fontSize:10 }}>
                            {selPos.unrealizedPLPercent >= 0 ? '+' : ''}{selPos.unrealizedPLPercent.toFixed(2)}%
                        </span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                        {[
                            ['QTY',   selPos.quantity.toString(), TEXT],
                            ['AVG',   `$${selPos.avgCost.toFixed(2)}`, SUBTLE],
                            ['CURR',  `$${selPos.currentPrice.toFixed(2)}`, TEXT],
                            ['MKT V', `$${(selPos.marketValue/1000).toFixed(2)}K`, BLUE],
                            ['DAY',   `${selPos.dayPL >= 0 ? '+' : ''}$${selPos.dayPL.toFixed(2)}`, selPos.dayPL >= 0 ? GREEN : RED],
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
                <span style={{ color:SUBTLE, fontSize:9 }}>STREAM: LIVE</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>{positions.length} POSITIONS</span>
            </div>
        </div>
    );
}
