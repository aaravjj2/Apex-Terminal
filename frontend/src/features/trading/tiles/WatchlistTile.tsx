// Bloomberg WL — Watchlist Terminal
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

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface WatchlistItem {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    sector: string;
    high52: number;
    low52: number;
}

const SYMBOLS = ['SPY','AAPL','TSLA','NVDA','MSFT','AMZN','GOOGL','META','JPM','GS'];
const SECTORS: Record<string, string> = {
    SPY:'ETF', AAPL:'Tech', TSLA:'Auto', NVDA:'Semi', MSFT:'Tech',
    AMZN:'Retail', GOOGL:'Tech', META:'Media', JPM:'Finance', GS:'Finance',
};
const SEED_PRICES: Record<string, number> = {
    SPY:547.23, AAPL:182.41, TSLA:218.77, NVDA:789.55, MSFT:412.33,
    AMZN:178.92, GOOGL:152.89, META:505.12, JPM:199.45, GS:462.30,
};
const HIGH52: Record<string, number> = {
    SPY:565.16, AAPL:199.62, TSLA:299.29, NVDA:974.00, MSFT:468.35,
    AMZN:201.20, GOOGL:193.31, META:590.13, JPM:218.83, GS:509.39,
};
const LOW52: Record<string, number> = {
    SPY:419.40, AAPL:164.08, TSLA:138.80, NVDA:405.96, MSFT:352.61,
    AMZN:151.61, GOOGL:120.21, META:302.54, JPM:140.33, GS:325.62,
};

const MOCK_WATCHLIST: WatchlistItem[] = SYMBOLS.map(s => ({
    symbol: s,
    name: s,
    price: SEED_PRICES[s] ?? 100,
    change: (Math.random() - 0.5) * 8,
    changePercent: (Math.random() - 0.5) * 3,
    volume: Math.floor(Math.random() * 80 + 5) * 1_000_000,
    sector: SECTORS[s] ?? 'Equity',
    high52: HIGH52[s] ?? 200,
    low52: LOW52[s] ?? 100,
}));

type SortKey = 'symbol' | 'price' | 'changePercent' | 'volume';

function pctBar(price: number, lo: number, hi: number) {
    const pct = hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : 50;
    return (
        <div style={{ position:'relative', width:60, height:4, background:BORDER, borderRadius:2 }}>
            <div style={{ position:'absolute', left:0, top:0, height:4, width:`${pct}%`, background:AMBER, borderRadius:2 }} />
            <div style={{ position:'absolute', left:`${pct}%`, top:-2, width:2, height:8, background:'#fff', borderRadius:1 }} />
        </div>
    );
}

import React from 'react';

export function WatchlistTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('symbol');
    const [sortAsc, setSortAsc] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [addMode, setAddMode] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');

    useEffect(() => {
        const unsub = streamSimulator.subscribe((tick) => {
            setWatchlist(prev => prev.map(item => {
                if (item.symbol !== tick.symbol) return item;
                const lp = tick.price ?? item.price;
                const chg = lp - SEED_PRICES[item.symbol];
                const chgPct = SEED_PRICES[item.symbol] ? (chg / SEED_PRICES[item.symbol]) * 100 : 0;
                return { ...item, price: lp, change: chg, changePercent: chgPct };
            }));
        });
        return unsub;
    }, []);

    const filtered = watchlist.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        let va: number | string = a[sortKey];
        let vb: number | string = b[sortKey];
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    function handleSort(k: SortKey) {
        if (sortKey === k) setSortAsc(a => !a);
        else { setSortKey(k); setSortAsc(true); }
    }

    const totalValue = watchlist.reduce((s, w) => s + w.price, 0);
    const gainers = watchlist.filter(w => w.changePercent >= 0).length;
    const losers = watchlist.filter(w => w.changePercent < 0).length;

    const colHdr = (label: string, key: SortKey, align: 'left'|'right' = 'right') => (
        <div
            onClick={() => handleSort(key)}
            style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', color: sortKey === key ? AMBER : SUBTLE, fontSize: 10 }}
        >
            {label}{sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
        </div>
    );

    const selItem = selected ? watchlist.find(w => w.symbol === selected) : null;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}` }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>WL — WATCHLIST</span>
                <div style={{ display:'flex', gap:8 }}>
                    <span style={{ color:GREEN, fontSize:10 }}>▲ {gainers}</span>
                    <span style={{ color:RED, fontSize:10 }}>▼ {losers}</span>
                    <span style={{ color:SUBTLE, fontSize:10 }}>TOT: ${(totalValue/1000).toFixed(1)}K</span>
                </div>
            </div>

            {/* Search + add */}
            <div style={{ display:'flex', gap:4, padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:PANEL }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="⌕ filter symbol/sector…"
                    style={{ flex:1, background:BG, border:`1px solid ${BORDER}`, color:TEXT, fontFamily:MONO, fontSize:11, padding:'3px 6px', outline:'none', borderRadius:2 }}
                />
                <button
                    onClick={() => setAddMode(a => !a)}
                    style={{ background:addMode ? AMBER : '#1a1a1a', border:`1px solid ${BORDER}`, color:addMode ? BG : TEXT, fontFamily:MONO, fontSize:11, padding:'3px 8px', cursor:'pointer', borderRadius:2 }}
                >+ ADD</button>
            </div>

            {/* Add row */}
            {addMode && (
                <div style={{ display:'flex', gap:4, padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d' }}>
                    <input
                        type="text"
                        value={newSymbol}
                        onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                        placeholder="TICKER"
                        style={{ width:80, background:BG, border:`1px solid ${AMBER}`, color:AMBER, fontFamily:MONO, fontSize:11, padding:'3px 6px', outline:'none', borderRadius:2, textTransform:'uppercase' }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && newSymbol) {
                                setWatchlist(prev => [...prev, { symbol:newSymbol, name:newSymbol, price:100, change:0, changePercent:0, volume:0, sector:'—', high52:200, low52:50 }]);
                                setNewSymbol(''); setAddMode(false);
                            }
                        }}
                    />
                    <span style={{ color:SUBTLE, fontSize:10, alignSelf:'center' }}>Press ↵ to add</span>
                </div>
            )}

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'80px 70px 70px 60px 60px 1fr', gap:4, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d' }}>
                {colHdr('SYMBOL', 'symbol', 'left')}
                {colHdr('PRICE', 'price')}
                {colHdr('CHG%', 'changePercent')}
                {colHdr('VOL', 'volume')}
                <div style={{ textAlign:'right', color:SUBTLE, fontSize:10 }}>SCT</div>
                <div style={{ color:SUBTLE, fontSize:10 }}>52W</div>
            </div>

            {/* Rows */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {sorted.map(item => {
                    const lp = streamSimulator.getLatestPrice(item.symbol) ?? item.price;
                    const isGain = item.changePercent >= 0;
                    const isSel = selected === item.symbol;
                    const isHov = hovered === item.symbol;
                    return (
                        <div
                            key={item.symbol}
                            data-testid={`watchlist-tile-row-${item.symbol}`}
                            onClick={() => setSelected(isSel ? null : item.symbol)}
                            onMouseEnter={() => setHovered(item.symbol)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display:'grid', gridTemplateColumns:'80px 70px 70px 60px 60px 1fr', gap:4,
                                padding:'4px 8px', cursor:'pointer', transition:'background 0.1s',
                                background: isSel ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft: isSel ? `2px solid ${AMBER}` : '2px solid transparent',
                            }}
                        >
                            <div style={{ color: isSel ? AMBER : TEXT, fontWeight: isSel ? 700 : 400 }}>{item.symbol}</div>
                            <div style={{ textAlign:'right', color:TEXT, fontFamily:MONO }} data-testid={`watchlist-tile-price-${item.symbol}`}>
                                ${lp.toFixed(2)}
                            </div>
                            <div style={{ textAlign:'right', color: isGain ? GREEN : RED, fontFamily:MONO }}>
                                {isGain ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </div>
                            <div style={{ textAlign:'right', color:SUBTLE, fontSize:10 }}>
                                {item.volume >= 1e6 ? `${(item.volume/1e6).toFixed(1)}M` : `${(item.volume/1e3).toFixed(0)}K`}
                            </div>
                            <div style={{ textAlign:'right', color:BLUE, fontSize:10 }}>{item.sector}</div>
                            <div style={{ display:'flex', alignItems:'center' }}>
                                {pctBar(lp, item.low52, item.high52)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail panel */}
            {selItem && (
                <div style={{ background:PANEL, borderTop:`1px solid ${AMBER}`, padding:'6px 10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>{selItem.symbol}</span>
                        <span style={{ color:SUBTLE, fontSize:10 }}>{selItem.sector}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                        {[
                            ['PRICE', (streamSimulator.getLatestPrice(selItem.symbol) ?? selItem.price).toFixed(2), TEXT],
                            ['CHG', `${selItem.change >= 0 ? '+' : ''}${selItem.change.toFixed(2)}`, selItem.change >= 0 ? GREEN : RED],
                            ['52H', selItem.high52.toFixed(2), GREEN],
                            ['52L', selItem.low52.toFixed(2), RED],
                        ].map(([lbl, val, col]) => (
                            <div key={lbl as string}>
                                <div style={{ color:SUBTLE, fontSize:9 }}>{lbl as string}</div>
                                <div style={{ color:col as string, fontFamily:MONO, fontSize:12 }}>{val as string}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:SUBTLE, fontSize:9 }}>STREAM: LIVE</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>{sorted.length}/{watchlist.length} SYMBOLS</span>
            </div>
        </div>
    );
}
