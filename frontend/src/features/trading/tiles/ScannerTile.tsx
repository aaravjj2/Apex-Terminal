// Bloomberg SC — Scanner Terminal Tile
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
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

interface ScanResult {
    symbol: string;
    name: string;
    price: number;
    change: number;
    volume: number;
    signal: string;
    strength: number;
    rsi: number;
    atr: number;
    sector: string;
}

const SCAN_PRESETS: Record<string, { label: string; color: string; results: ScanResult[] }> = {
    breakouts: {
        label: '⚡ BREAKOUTS', color: AMBER,
        results: [
            { symbol:'SMCI', name:'Super Micro',   price:289.50, change:8.45,  volume:12500000, signal:'52W Breakout', strength:95, rsi:71, atr:8.2,  sector:'Tech'   },
            { symbol:'ARM',  name:'ARM Holdings',  price:148.20, change:5.67,  volume:8900000,  signal:'Golden Cross', strength:88, rsi:65, atr:4.1,  sector:'Semi'   },
            { symbol:'PLTR', name:'Palantir',      price:24.80,  change:4.23,  volume:45000000, signal:'Cup & Handle', strength:82, rsi:60, atr:0.9,  sector:'Tech'   },
            { symbol:'COIN', name:'Coinbase',      price:178.90, change:6.78,  volume:15600000, signal:'Vol Breakout', strength:78, rsi:68, atr:5.5,  sector:'Fin'    },
            { symbol:'RBLX', name:'Roblox',        price:45.30,  change:3.12,  volume:9800000,  signal:'Flag Break',  strength:72, rsi:62, atr:1.4,  sector:'Media'  },
        ],
    },
    momentum: {
        label: '▶ MOMENTUM', color: GREEN,
        results: [
            { symbol:'NVDA', name:'Nvidia',        price:789.55, change:3.21,  volume:22000000, signal:'EMA 9>21',    strength:92, rsi:74, atr:18.4, sector:'Semi'   },
            { symbol:'META', name:'Meta',          price:505.12, change:2.45,  volume:14000000, signal:'MACD Bull',   strength:85, rsi:67, atr:9.8,  sector:'Media'  },
            { symbol:'AAPL', name:'Apple',         price:182.41, change:1.87,  volume:55000000, signal:'Mmt >100',    strength:80, rsi:59, atr:2.9,  sector:'Tech'   },
            { symbol:'MSFT', name:'Microsoft',     price:412.33, change:1.23,  volume:18000000, signal:'VWAP +',      strength:75, rsi:55, atr:5.2,  sector:'Tech'   },
            { symbol:'GOOGL', name:'Alphabet',     price:152.89, change:0.98,  volume:25000000, signal:'Range High',  strength:70, rsi:52, atr:3.1,  sector:'Tech'   },
        ],
    },
    oversold: {
        label: '▼ OVERSOLD', color: BLUE,
        results: [
            { symbol:'TSLA', name:'Tesla',         price:218.77, change:-3.45, volume:90000000, signal:'RSI<30',      strength:90, rsi:28, atr:8.1,  sector:'Auto'   },
            { symbol:'PYPL', name:'PayPal',        price:62.30,  change:-2.10, volume:12000000, signal:'BB Lower',    strength:84, rsi:25, atr:1.8,  sector:'Fin'    },
            { symbol:'INTC', name:'Intel',         price:35.20,  change:-1.80, volume:40000000, signal:'Disc Div',    strength:78, rsi:31, atr:1.1,  sector:'Semi'   },
            { symbol:'DIS',  name:'Disney',        price:101.45, change:-1.20, volume:9500000,  signal:'S/R Bounce',  strength:72, rsi:33, atr:2.4,  sector:'Media'  },
        ],
    },
    volume: {
        label: '📊 VOL SPIKE', color: PURPLE,
        results: [
            { symbol:'GME',  name:'GameStop',      price:18.50,  change:15.30, volume:250000000, signal:'10x AvVol',  strength:99, rsi:82, atr:1.2,  sector:'Retail' },
            { symbol:'AMC',  name:'AMC Ent.',      price:4.20,   change:12.10, volume:180000000, signal:'5x AvVol',   strength:95, rsi:78, atr:0.3,  sector:'Media'  },
            { symbol:'TLRY', name:'Tilray',        price:2.15,   change:8.50,  volume:95000000,  signal:'3x AvVol',   strength:88, rsi:71, atr:0.1,  sector:'Cannabis'},
        ],
    },
};

type SortKey = 'symbol' | 'change' | 'strength' | 'volume' | 'rsi';

export function ScannerTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [activeScan, setActiveScan] = useState<keyof typeof SCAN_PRESETS>('breakouts');
    const [sortKey, setSortKey] = useState<SortKey>('strength');
    const [sortAsc, setSortAsc] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const preset = SCAN_PRESETS[activeScan];
    const results = [...preset.results].sort((a, b) => {
        const va = a[sortKey as keyof ScanResult] as number | string;
        const vb = b[sortKey as keyof ScanResult] as number | string;
        if (typeof va === 'string') return sortAsc ? (va).localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    function handleSort(k: SortKey) {
        if (sortKey === k) setSortAsc(a => !a);
        else { setSortKey(k); setSortAsc(false); }
    }

    const selResult = selected ? results.find(r => r.symbol === selected) : null;

    const hdrBtn = (label: string, k: SortKey, align: 'left'|'right' = 'right') => (
        <div onClick={() => handleSort(k)} style={{ textAlign: align, cursor:'pointer', color: sortKey === k ? AMBER : SUBTLE, fontSize:9, userSelect:'none' }}>
            {label}{sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
        </div>
    );

    const strengthColor = (s: number) => s >= 80 ? GREEN : s >= 60 ? AMBER : RED;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>SC — SCANNER</span>
                <span style={{ color: preset.color, fontSize:10 }}>{preset.label}</span>
            </div>

            {/* Scan type selector */}
            <div style={{ display:'flex', gap:0, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, overflowX:'auto' }}>
                {(Object.entries(SCAN_PRESETS) as [keyof typeof SCAN_PRESETS, typeof SCAN_PRESETS[keyof typeof SCAN_PRESETS]][]).map(([key, val]) => (
                    <button key={key} onClick={() => { setActiveScan(key); setSelected(null); }}
                        style={{
                            background: activeScan === key ? val.color : 'transparent',
                            border: `1px solid ${activeScan === key ? val.color : BORDER}`,
                            color: activeScan === key ? BG : SUBTLE,
                            fontFamily:MONO, fontSize:9, padding:'2px 7px', cursor:'pointer', marginRight:2, borderRadius:2, whiteSpace:'nowrap',
                        }}>
                        {key.toUpperCase()}
                    </button>
                ))}
                <div style={{ marginLeft:'auto', display:'flex', alignItems:'center' }}>
                    <span style={{ color:SUBTLE, fontSize:9 }}>{results.length} HITS</span>
                </div>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'55px 65px 50px 60px 40px 40px 1fr', gap:4, padding:'2px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {hdrBtn('SYMBOL', 'symbol', 'left')}
                {hdrBtn('PRICE', 'symbol')}
                {hdrBtn('CHG%', 'change')}
                {hdrBtn('VOL', 'volume')}
                {hdrBtn('RSI', 'rsi')}
                {hdrBtn('STR', 'strength')}
                <div style={{ color:SUBTLE, fontSize:9 }}>SIGNAL</div>
            </div>

            {/* Results */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {results.map(result => {
                    const isSel = selected === result.symbol;
                    const isHov = hovered === result.symbol;
                    return (
                        <div
                            key={result.symbol}
                            onClick={() => setSelected(isSel ? null : result.symbol)}
                            onMouseEnter={() => setHovered(result.symbol)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display:'grid', gridTemplateColumns:'55px 65px 50px 60px 40px 40px 1fr', gap:4,
                                padding:'4px 8px', cursor:'pointer',
                                background: isSel ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                borderBottom:`1px solid ${BORDER}`,
                                borderLeft: isSel ? `2px solid ${AMBER}` : '2px solid transparent',
                            }}
                        >
                            <div>
                                <div style={{ color: isSel ? AMBER : TEXT }}>{result.symbol}</div>
                                <div style={{ color:SUBTLE, fontSize:9 }}>{result.sector}</div>
                            </div>
                            <div style={{ textAlign:'right', fontFamily:MONO, color:TEXT }}>{result.price.toFixed(2)}</div>
                            <div style={{ textAlign:'right', color: result.change >= 0 ? GREEN : RED, fontFamily:MONO }}>
                                {result.change >= 0 ? '+' : ''}{result.change.toFixed(2)}%
                            </div>
                            <div style={{ textAlign:'right', color:SUBTLE, fontSize:10 }}>
                                {result.volume >= 1e6 ? `${(result.volume/1e6).toFixed(1)}M` : `${(result.volume/1e3).toFixed(0)}K`}
                            </div>
                            <div style={{ textAlign:'right', color: result.rsi > 70 ? RED : result.rsi < 30 ? GREEN : TEXT, fontFamily:MONO }}>
                                {result.rsi}
                            </div>
                            <div style={{ textAlign:'right', color: strengthColor(result.strength), fontWeight:700 }}>
                                {result.strength}
                            </div>
                            <div style={{ color: preset.color, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {result.signal}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail panel */}
            {selResult && (
                <div style={{ background:PANEL, borderTop:`1px solid ${preset.color}`, padding:'6px 10px', flexShrink:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>{selResult.symbol} — {selResult.name}</span>
                        <span style={{ color: preset.color, fontSize:10 }}>{selResult.signal}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                        {[
                            ['PRICE',  selResult.price.toFixed(2), TEXT],
                            ['CHG%',   `${selResult.change >= 0 ? '+' : ''}${selResult.change.toFixed(2)}%`, selResult.change >= 0 ? GREEN : RED],
                            ['RSI',    selResult.rsi.toString(), selResult.rsi > 70 ? RED : selResult.rsi < 30 ? GREEN : TEXT],
                            ['ATR',    selResult.atr.toFixed(2), SUBTLE],
                            ['STR',    `${selResult.strength}%`, strengthColor(selResult.strength)],
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
                <span style={{ color:SUBTLE, fontSize:9 }}>{activeScan.toUpperCase()} SCAN</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>MOCK DATA</span>
            </div>
        </div>
    );
}
