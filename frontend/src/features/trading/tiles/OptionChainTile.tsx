// Bloomberg OCH — Option Chain Terminal Tile
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

import { useMemo, useEffect, useState } from 'react';
import React from 'react';
import { useOptionsStore } from '../../options/store';
import { useAppStore } from '../../../state/appStore';
import type { OptionContract } from '../../options/types';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

export function OptionChainTile({ }: TileProps) {
    const { symbol: appSymbol } = useAppStore();
    const {
        chain,
        chainLoading,
        selectedExpiration,
        setSelectedExpiration,
        fetchAll
    } = useOptionsStore();

    const [hoveredStrike, setHoveredStrike] = useState<number | null>(null);
    const [showGreeks, setShowGreeks] = useState(false);

    // Sync with app symbol
    useEffect(() => {
        if (appSymbol) {
            fetchAll(appSymbol);
        }
    }, [appSymbol, fetchAll]);

    const chainData = useMemo(() => {
        if (!chain || !chain.contracts) return [];

        // Group contracts by strike
        const strikesMap = new Map<number, { strike: number; call?: OptionContract; put?: OptionContract }>();
        const contracts = chain.contracts.filter(c => c.expiration === selectedExpiration);

        contracts.forEach(contract => {
            const strike = contract.strike;
            if (!strikesMap.has(strike)) {
                strikesMap.set(strike, { strike });
            }
            const entry = strikesMap.get(strike)!;
            if (contract.optionType === 'call') {
                entry.call = contract;
            } else {
                entry.put = contract;
            }
        });

        const underlying = chain.underlyingPrice;
        return Array.from(strikesMap.values())
            .sort((a, b) => a.strike - b.strike)
            .filter(a => Math.abs(a.strike - underlying) < underlying * 0.15);
    }, [chain, selectedExpiration]);

    if (chainLoading && chainData.length === 0) {
        return (
            <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:BG, color:SUBTLE, fontFamily:MONO, fontSize:11 }}>
                LOADING OPTIONS…
            </div>
        );
    }

    if (!appSymbol) {
        return (
            <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:BG, color:SUBTLE, fontFamily:MONO, fontSize:11 }}>
                SELECT A SYMBOL TO VIEW OPTIONS
            </div>
        );
    }

    const underlying = chain?.underlyingPrice ?? 0;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:11, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>OCH — OPTION CHAIN</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ color:BLUE, fontSize:10 }}>{appSymbol}</span>
                    <span style={{ color:TEXT, fontFamily:MONO }}>${underlying.toFixed(2)}</span>
                    <button onClick={() => setShowGreeks(g => !g)}
                        style={{ background: showGreeks ? AMBER : 'transparent', border:`1px solid ${showGreeks ? AMBER : BORDER}`, color: showGreeks ? BG : SUBTLE, fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2 }}>
                        GREEKS
                    </button>
                </div>
            </div>

            {/* Expiry selector */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                <span style={{ color:SUBTLE, fontSize:9 }}>EXPIRY</span>
                <select
                    value={selectedExpiration || ''}
                    onChange={(e) => setSelectedExpiration(e.target.value)}
                    disabled={!chain}
                    style={{ background:PANEL, color:TEXT, border:`1px solid ${BORDER}`, fontFamily:MONO, fontSize:9, padding:'2px 4px', outline:'none', cursor:'pointer' }}
                >
                    {chain?.expirations.map(exp => (
                        <option key={exp} value={exp}>{exp}</option>
                    ))}
                </select>
                <span style={{ marginLeft:'auto', color:SUBTLE, fontSize:9 }}>{chainData.length} STRIKES</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns: showGreeks ? '45px 45px 40px 36px 36px 55px 36px 36px 40px 45px 45px' : '50px 50px 45px 40px 55px 40px 45px 50px 50px', gap:2, padding:'2px 6px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {/* Calls side */}
                <div style={{ color:GREEN, fontSize:8, textAlign:'right' }}>BID</div>
                <div style={{ color:GREEN, fontSize:8, textAlign:'right' }}>ASK</div>
                <div style={{ color:GREEN, fontSize:8, textAlign:'right' }}>VOL</div>
                {showGreeks && <div style={{ color:GREEN, fontSize:8, textAlign:'right' }}>IV</div>}
                {showGreeks && <div style={{ color:GREEN, fontSize:8, textAlign:'right' }}>Δ</div>}
                {/* Strike */}
                <div style={{ color:AMBER, fontSize:8, textAlign:'center', fontWeight:700 }}>STRIKE</div>
                {/* Puts side */}
                {showGreeks && <div style={{ color:RED, fontSize:8, textAlign:'left' }}>IV</div>}
                {showGreeks && <div style={{ color:RED, fontSize:8, textAlign:'left' }}>Δ</div>}
                <div style={{ color:RED, fontSize:8, textAlign:'left' }}>VOL</div>
                <div style={{ color:RED, fontSize:8, textAlign:'left' }}>BID</div>
                <div style={{ color:RED, fontSize:8, textAlign:'left' }}>ASK</div>
            </div>

            {/* Chain rows */}
            <div style={{ flex:1, overflowY:'auto' }}>
                {chainData.length === 0 ? (
                    <div style={{ padding:16, textAlign:'center', color:SUBTLE, fontSize:9 }}>NO DATA FOUND</div>
                ) : (
                    chainData.map((row) => {
                        const call = row.call;
                        const put = row.put;
                        const isITMCall = row.strike < underlying;
                        const isITMPut = row.strike > underlying;
                        const isATM = Math.abs(row.strike - underlying) < (underlying * 0.01);
                        const isHov = hoveredStrike === row.strike;

                        const cols = showGreeks ? '45px 45px 40px 36px 36px 55px 36px 36px 40px 45px 45px' : '50px 50px 45px 40px 55px 40px 45px 50px 50px';

                        return (
                            <div key={row.strike}
                                onMouseEnter={() => setHoveredStrike(row.strike)}
                                onMouseLeave={() => setHoveredStrike(null)}
                                style={{
                                    display:'grid', gridTemplateColumns:cols, gap:2,
                                    padding:'2px 6px',
                                    background: isATM ? '#1a1500' : isHov ? '#141414' : 'transparent',
                                    borderBottom:`1px solid ${BORDER}`,
                                    borderLeft: isATM ? `2px solid ${AMBER}` : '2px solid transparent',
                                }}
                            >
                                {/* Calls */}
                                <div style={{ textAlign:'right', color: isITMCall ? GREEN : SUBTLE, fontFamily:MONO, fontSize:10, fontWeight: isITMCall ? 700 : 400 }}>
                                    {call?.bid?.toFixed(2) || '-'}
                                </div>
                                <div style={{ textAlign:'right', color: isITMCall ? '#81c784' : SUBTLE, fontFamily:MONO, fontSize:10 }}>
                                    {call?.ask?.toFixed(2) || '-'}
                                </div>
                                <div style={{ textAlign:'right', color:SUBTLE, fontSize:9 }}>
                                    {call?.volume != null ? (call.volume > 1000 ? `${(call.volume/1000).toFixed(0)}K` : call.volume) : '0'}
                                </div>
                                {showGreeks && <div style={{ textAlign:'right', color:SUBTLE, fontSize:9 }}>{call?.impliedVolatility ? `${(call.impliedVolatility*100).toFixed(0)}%` : '-'}</div>}
                                {showGreeks && <div style={{ textAlign:'right', color:GREEN, fontSize:9 }}>{call?.delta?.toFixed(2) ?? '-'}</div>}

                                {/* Strike */}
                                <div style={{ textAlign:'center', color: isATM ? AMBER : TEXT, fontWeight: isATM ? 700 : 400, fontSize:10, borderLeft:`1px solid ${BORDER}`, borderRight:`1px solid ${BORDER}` }}>
                                    {row.strike.toFixed(1)}
                                </div>

                                {/* Puts */}
                                {showGreeks && <div style={{ textAlign:'left', color:SUBTLE, fontSize:9 }}>{put?.impliedVolatility ? `${(put.impliedVolatility*100).toFixed(0)}%` : '-'}</div>}
                                {showGreeks && <div style={{ textAlign:'left', color:RED, fontSize:9 }}>{put?.delta?.toFixed(2) ?? '-'}</div>}
                                <div style={{ textAlign:'left', color:SUBTLE, fontSize:9 }}>
                                    {put?.volume != null ? (put.volume > 1000 ? `${(put.volume/1000).toFixed(0)}K` : put.volume) : '0'}
                                </div>
                                <div style={{ textAlign:'left', color: isITMPut ? '#ef9a9a' : SUBTLE, fontFamily:MONO, fontSize:10 }}>
                                    {put?.bid?.toFixed(2) || '-'}
                                </div>
                                <div style={{ textAlign:'left', color: isITMPut ? RED : SUBTLE, fontFamily:MONO, fontSize:10, fontWeight: isITMPut ? 700 : 400 }}>
                                    {put?.ask?.toFixed(2) || '-'}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div style={{ padding:'3px 8px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', flexShrink:0 }}>
                <span style={{ color:GREEN, fontSize:9 }}>CALLS ▲ = ITM</span>
                <span style={{ color:AMBER, fontSize:9 }}>ATM ${underlying.toFixed(2)}</span>
                <span style={{ color:RED, fontSize:9 }}>PUTS ▼ = ITM</span>
            </div>
        </div>
    );
}
