// Bloomberg HM — Sector Heatmap Terminal Tile
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

import { useMemo, useState } from 'react';
import React from 'react';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface HeatmapItem {
    symbol: string;
    name: string;
    change: number;
    marketCap: number;
    sector: string;
    volume: number;
    price: number;
}

type GroupMode = 'sector' | 'marketcap' | 'performance';

const SECTORS: Record<string, HeatmapItem[]> = {
    Technology: [
        { symbol:'AAPL',  name:'Apple',     change: 1.33, marketCap:2800, sector:'Technology', volume:55000000, price:182.41 },
        { symbol:'MSFT',  name:'Microsoft', change:-0.32, marketCap:2700, sector:'Technology', volume:18000000, price:412.33 },
        { symbol:'GOOGL', name:'Alphabet',  change: 0.63, marketCap:1800, sector:'Technology', volume:25000000, price:152.89 },
        { symbol:'NVDA',  name:'NVIDIA',    change: 3.44, marketCap:1500, sector:'Technology', volume:22000000, price:789.55 },
        { symbol:'META',  name:'Meta',      change: 1.79, marketCap:1200, sector:'Technology', volume:14000000, price:505.12 },
    ],
    Consumer: [
        { symbol:'AMZN',  name:'Amazon',    change: 1.97, marketCap:1600, sector:'Consumer', volume:40000000, price:178.25 },
        { symbol:'TSLA',  name:'Tesla',     change:-2.23, marketCap:800,  sector:'Consumer', volume:90000000, price:218.77 },
        { symbol:'HD',    name:'Home Dep.', change: 0.12, marketCap:350,  sector:'Consumer', volume:3500000,  price:336.20 },
        { symbol:'WMT',   name:'Walmart',   change: 0.45, marketCap:420,  sector:'Consumer', volume:6000000,  price:155.30 },
    ],
    Financial: [
        { symbol:'BRK.B', name:'Berkshire', change: 0.25, marketCap:750, sector:'Financial', volume:4000000,  price:371.50 },
        { symbol:'JPM',   name:'JPMorgan',  change: 0.89, marketCap:500, sector:'Financial', volume:9000000,  price:167.40 },
        { symbol:'V',     name:'Visa',      change: 0.45, marketCap:480, sector:'Financial', volume:6500000,  price:268.00 },
        { symbol:'BAC',   name:'BankAmerica',change:-0.55,marketCap:260, sector:'Financial', volume:32000000, price:32.10  },
    ],
    Healthcare: [
        { symbol:'UNH',   name:'UnitedHlth', change:-0.67, marketCap:450, sector:'Healthcare', volume:3200000, price:502.10 },
        { symbol:'JNJ',   name:'J&J',        change: 0.33, marketCap:380, sector:'Healthcare', volume:7500000, price:155.60 },
        { symbol:'LLY',   name:'Eli Lilly',  change: 2.10, marketCap:340, sector:'Healthcare', volume:4000000, price:567.80 },
    ],
    Energy: [
        { symbol:'XOM',   name:'ExxonMobil', change: 0.95, marketCap:440, sector:'Energy', volume:14000000, price:101.30 },
        { symbol:'CVX',   name:'Chevron',    change: 0.72, marketCap:290, sector:'Energy', volume:8500000,  price:153.70 },
    ],
};

function getHeatColor(change: number): string {
    if (change >= 3)   return '#1b5e20';
    if (change >= 2)   return '#2e7d32';
    if (change >= 1)   return '#388e3c';
    if (change >= 0.5) return '#43a047';
    if (change >= 0)   return '#1b4a2d';
    if (change >= -0.5) return '#4a1b1b';
    if (change >= -1)  return '#c62828';
    if (change >= -2)  return '#b71c1c';
    return '#7f0000';
}

function getTextColor(change: number): string {
    const abs = Math.abs(change);
    return abs >= 1 ? TEXT : SUBTLE;
}

export function HeatmapTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [groupMode, setGroupMode] = useState<GroupMode>('sector');
    const [hovered, setHovered] = useState<string | null>(null);
    const [selected, setSelected] = useState<HeatmapItem | null>(null);

    const allItems = useMemo(() => Object.values(SECTORS).flat(), []);

    const sortedFlat = useMemo(() => {
        if (groupMode === 'performance') return [...allItems].sort((a,b) => b.change - a.change);
        if (groupMode === 'marketcap')   return [...allItems].sort((a,b) => b.marketCap - a.marketCap);
        return allItems;
    }, [groupMode, allItems]);

    const renderItem = (item: HeatmapItem, size: 'large'|'medium'|'small') => {
        const isSel = selected?.symbol === item.symbol;
        const isHov = hovered === item.symbol;
        const bg = getHeatColor(item.change);
        const fontSz = size === 'large' ? 13 : size === 'medium' ? 11 : 10;
        const padding = size === 'large' ? '8px' : size === 'medium' ? '5px' : '3px';
        return (
            <div key={item.symbol}
                onClick={() => setSelected(isSel ? null : item)}
                onMouseEnter={() => setHovered(item.symbol)}
                onMouseLeave={() => setHovered(null)}
                style={{
                    background: bg, padding, cursor:'pointer', borderRadius:2, overflow:'hidden',
                    border: isSel ? `1px solid ${AMBER}` : isHov ? `1px solid ${TEXT}` : `1px solid transparent`,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    minHeight: size === 'large' ? 70 : size === 'medium' ? 45 : 30,
                    transition:'border-color 0.1s',
                }}
            >
                <div style={{ color: getTextColor(item.change), fontWeight:700, fontSize:fontSz, fontFamily:MONO }}>{item.symbol}</div>
                {size !== 'small' && <div style={{ color: item.change >= 0 ? '#81c784' : '#ef9a9a', fontSize:fontSz - 2, fontFamily:MONO }}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</div>}
            </div>
        );
    };

    // Legend scale
    const legendStops = [
        { pct: '>3%', color:'#2e7d32' },
        { pct: '1-3%', color:'#388e3c' },
        { pct: '0-1%', color:'#1b4a2d' },
        { pct: '0 to -1%', color:'#4a1b1b' },
        { pct: '-1 to -3%', color:'#c62828' },
        { pct: '<-3%', color:'#7f0000' },
    ];

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>HM — HEATMAP</span>
                <div style={{ display:'flex', gap:2 }}>
                    {(['sector','marketcap','performance'] as GroupMode[]).map(m => (
                        <button key={m} onClick={() => setGroupMode(m)}
                            style={{ background: groupMode === m ? AMBER : 'transparent', border:`1px solid ${groupMode === m ? AMBER : BORDER}`, color: groupMode === m ? BG : SUBTLE, fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2 }}>
                            {m.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Heatmap grid */}
            <div style={{ flex:1, overflowY:'auto', padding:6 }}>
                {groupMode === 'sector' ? (
                    Object.entries(SECTORS).map(([sectorName, items]) => (
                        <div key={sectorName} style={{ marginBottom:6 }}>
                            <div style={{ color:SUBTLE, fontSize:9, marginBottom:3, padding:'0 2px' }}>{sectorName.toUpperCase()}</div>
                            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(items.length, 5)}, 1fr)`, gap:2 }}>
                                {items.map((item, i) => renderItem(item, i < 2 ? 'large' : i < 4 ? 'medium' : 'small'))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:2 }}>
                        {sortedFlat.map((item,i) => renderItem(item, i < 3 ? 'large' : i < 8 ? 'medium' : 'small'))}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderTop:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, flexWrap:'wrap' }}>
                {legendStops.map(s => (
                    <div key={s.pct} style={{ display:'flex', alignItems:'center', gap:2 }}>
                        <div style={{ width:10, height:10, background:s.color, borderRadius:1 }} />
                        <span style={{ color:SUBTLE, fontSize:8 }}>{s.pct}</span>
                    </div>
                ))}
            </div>

            {/* Detail panel */}
            {selected && (
                <div style={{ background:PANEL, borderTop:`1px solid ${AMBER}`, padding:'5px 10px', flexShrink:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ color:AMBER, fontWeight:700 }}>{selected.symbol} — {selected.name}</span>
                        <span style={{ color: selected.change >= 0 ? GREEN : RED }}>{selected.change >= 0 ? '+' : ''}{selected.change.toFixed(2)}%</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                        {[
                            ['PRICE', `$${selected.price.toFixed(2)}`, TEXT],
                            ['MKT CAP', `$${selected.marketCap}B`, BLUE],
                            ['VOLUME', selected.volume >= 1e6 ? `${(selected.volume/1e6).toFixed(1)}M` : `${(selected.volume/1e3).toFixed(0)}K`, SUBTLE],
                            ['SECTOR', selected.sector, AMBER],
                        ].map(([l,v,c]) => (
                            <div key={l as string}>
                                <div style={{ color:SUBTLE, fontSize:8 }}>{l as string}</div>
                                <div style={{ color:c as string, fontSize:10 }}>{v as string}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
