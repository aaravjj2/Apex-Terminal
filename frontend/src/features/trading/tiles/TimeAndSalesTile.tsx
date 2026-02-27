// Bloomberg TS — Time & Sales Terminal Tile
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

import { useState, useEffect, useRef } from 'react';
import React from 'react';


interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface Trade {
    id: string;
    time: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    exchange: string;
    condition: string;
}

const EXCHANGES = ['NYSE', 'ARCA', 'BATS', 'IEX', 'EDGX', 'NSDQ', 'CBOE'];
const CONDITIONS = ['@', '@T', '@F', '@@', '@I', '@O'];
const SYMBOLS_TS = ['AAPL', 'MSFT', 'NVDA', 'SPY', 'TSLA'];
const SEED_PRICES_TS: Record<string, number> = { AAPL: 182.41, MSFT: 412.33, NVDA: 789.55, SPY: 547.23, TSLA: 218.77 };

function generateTrade(id: number, lastPrice: number): Trade {
    const change = (Math.random() - 0.48) * 0.04;
    const price = lastPrice * (1 + change);
    const rawSize = Math.floor(Math.random() * 50 + 1) * 100;
    return {
        id: `t${id}`,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        price,
        size: rawSize,
        side: change >= 0 ? 'buy' : 'sell',
        exchange: EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)],
        condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
    };
}

export function TimeAndSalesTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [activeSym, setActiveSym] = useState('AAPL');
    const [trades, setTrades] = useState<Trade[]>([]);
    const [paused, setPaused] = useState(false);
    const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
    const [minSize, setMinSize] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPriceRef = useRef(SEED_PRICES_TS['AAPL']);
    const idRef = useRef(0);

    // Reinitialize when symbol changes
    useEffect(() => {
        lastPriceRef.current = SEED_PRICES_TS[activeSym] ?? 100;
        setTrades([]);
    }, [activeSym]);

    // Simulate streaming trades
    useEffect(() => {
        if (paused) return;
        const interval = setInterval(() => {
            const newTrade = generateTrade(idRef.current++, lastPriceRef.current);
            lastPriceRef.current = newTrade.price;
            setTrades(prev => [newTrade, ...prev.slice(0, 199)]);
        }, 150 + Math.random() * 250);
        return () => clearInterval(interval);
    }, [paused, activeSym]);

    const filteredTrades = trades.filter(t => {
        if (filterSide !== 'all' && t.side !== filterSide) return false;
        if (minSize > 0 && t.size < minSize) return false;
        return true;
    });

    const buyVol  = trades.filter(t => t.side === 'buy').reduce((s, t) => s + t.size, 0);
    const sellVol = trades.filter(t => t.side === 'sell').reduce((s, t) => s + t.size, 0);
    const totalVol = buyVol + sellVol;
    const buyPct  = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;

    const lastPrice = trades[0] ? trades[0].price : SEED_PRICES_TS[activeSym] ?? 100;
    const firstPrice = trades.length > 1 ? trades[trades.length - 1].price : lastPrice;
    const net = lastPrice - firstPrice;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>TS — TIME & SALES</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ color: net >= 0 ? GREEN : RED, fontFamily:MONO, fontSize:11 }}>{lastPrice.toFixed(2)} {net >= 0 ? '+' : ''}{net.toFixed(2)}</span>
                    <span style={{ color: paused ? AMBER : GREEN, fontSize:10 }}>{paused ? '⏸ PAUSED' : '▶ LIVE'}</span>
                </div>
            </div>

            {/* Symbol selector */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {SYMBOLS_TS.map(s => (
                    <button key={s} onClick={() => setActiveSym(s)}
                        style={{ background: activeSym === s ? AMBER : 'transparent', border:`1px solid ${activeSym === s ? AMBER : BORDER}`, color: activeSym === s ? BG : SUBTLE, fontFamily:MONO, fontSize:10, padding:'1px 6px', cursor:'pointer', borderRadius:2 }}>
                        {s}
                    </button>
                ))}
                <div style={{ flex:1 }} />
                <button onClick={() => setPaused(p => !p)}
                    style={{ background: paused ? GREEN : 'transparent', border:`1px solid ${paused ? GREEN : BORDER}`, color: paused ? BG : SUBTLE, fontFamily:MONO, fontSize:10, padding:'1px 8px', cursor:'pointer', borderRadius:2 }}>
                    {paused ? '▶ RUN' : '⏸ PAUSE'}
                </button>
            </div>

            {/* Buy/Sell volume bar */}
            <div style={{ padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:BG, flexShrink:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ color:GREEN, fontSize:9 }}>BUY {(buyVol/1000).toFixed(0)}K ({buyPct.toFixed(1)}%)</span>
                    <span style={{ color:RED, fontSize:9 }}>SELL {(sellVol/1000).toFixed(0)}K ({(100-buyPct).toFixed(1)}%)</span>
                </div>
                <div style={{ height:4, background:BORDER, borderRadius:2 }}>
                    <div style={{ width:`${buyPct}%`, height:4, background:GREEN, borderRadius:2, transition:'width 0.3s' }} />
                </div>
            </div>

            {/* Filter row */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, alignItems:'center' }}>
                {(['all','buy','sell'] as const).map(f => (
                    <button key={f} onClick={() => setFilterSide(f)}
                        style={{ background: filterSide === f ? (f === 'buy' ? GREEN : f === 'sell' ? RED : AMBER) : 'transparent', border:`1px solid ${filterSide === f ? 'transparent' : BORDER}`, color: filterSide === f ? BG : SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 5px', cursor:'pointer', borderRadius:2, textTransform:'uppercase' }}>
                        {f}
                    </button>
                ))}
                <span style={{ color:SUBTLE, fontSize:9 }}>MIN:</span>
                {[0, 1000, 5000, 10000].map(sz => (
                    <button key={sz} onClick={() => setMinSize(sz)}
                        style={{ background: minSize === sz ? BLUE : 'transparent', border:`1px solid ${minSize === sz ? BLUE : BORDER}`, color: minSize === sz ? BG : SUBTLE, fontFamily:MONO, fontSize:9, padding:'1px 4px', cursor:'pointer', borderRadius:2 }}>
                        {sz === 0 ? 'ALL' : `${sz/1000}K`}
                    </button>
                ))}
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9 }}>{filteredTrades.length} TRADES</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'60px 70px 60px 46px 40px 30px', gap:4, padding:'2px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {['TIME','PRICE','SIZE','SIDE','EXCH','CND'].map(h => (
                    <div key={h} style={{ color:SUBTLE, fontSize:9, textAlign: h === 'PRICE' || h === 'SIZE' ? 'right' : 'left' }}>{h}</div>
                ))}
            </div>

            {/* Trade tape */}
            <div ref={containerRef} style={{ flex:1, overflowY:'auto' }}>
                {filteredTrades.map((trade, idx) => {
                    const isBig = trade.size >= 10000;
                    return (
                        <div
                            key={trade.id}
                            style={{
                                display:'grid', gridTemplateColumns:'60px 70px 60px 46px 40px 30px', gap:4,
                                padding:'2px 8px',
                                background: idx === 0 ? '#161600' : isBig ? '#0d0d00' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                animation: idx === 0 ? 'flash 0.3s ease' : 'none',
                            }}
                        >
                            <div style={{ color:SUBTLE, fontSize:10 }}>{trade.time}</div>
                            <div style={{ textAlign:'right', color: trade.side === 'buy' ? GREEN : RED, fontFamily:MONO }}>
                                {trade.price.toFixed(2)}
                            </div>
                            <div style={{ textAlign:'right', color: isBig ? AMBER : SUBTLE, fontWeight: isBig ? 700 : 400, fontFamily:MONO }}>
                                {trade.size.toLocaleString()}
                            </div>
                            <div style={{ color: trade.side === 'buy' ? GREEN : RED, fontSize:9, fontWeight:700 }}>
                                {trade.side.toUpperCase()}
                            </div>
                            <div style={{ color:BLUE, fontSize:9 }}>{trade.exchange}</div>
                            <div style={{ color:SUBTLE, fontSize:9 }}>{trade.condition}</div>
                        </div>
                    );
                })}
                {filteredTrades.length === 0 && (
                    <div style={{ padding:'20px 8px', textAlign:'center', color:SUBTLE, fontSize:11 }}>
                        {paused ? '— PAUSED —' : '— AWAITING TRADES —'}
                    </div>
                )}
            </div>

            {/* Footer stats */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', flexShrink:0 }}>
                <span style={{ color:SUBTLE, fontSize:9 }}>VOL: {(totalVol/1000).toFixed(1)}K</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>{activeSym} · TAPE</span>
            </div>
        </div>
    );
}
