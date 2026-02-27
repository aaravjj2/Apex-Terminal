// Bloomberg VS — Volatility Surface Terminal Tile
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

import { useMemo, useState } from 'react';
import React from 'react';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type ViewMode = 'surface' | 'skew' | 'term';
type Underlier = 'AAPL' | 'SPY' | 'NVDA' | 'TSLA';

const STRIKES: Record<Underlier, number[]> = {
    AAPL: [165, 170, 175, 180, 185, 190, 195, 200],
    SPY:  [480, 490, 495, 500, 505, 510, 515, 520],
    NVDA: [740, 760, 775, 790, 805, 820, 840, 860],
    TSLA: [195, 205, 215, 225, 235, 245, 255, 265],
};
const ATM: Record<Underlier, number> = { AAPL:182, SPY:502, NVDA:790, TSLA:219 };
const EXPIRATIONS = ['1W','2W','1M','2M','3M','6M','9M','1Y'];
const BASE_IV: Record<Underlier, number> = { AAPL:0.22, SPY:0.18, NVDA:0.42, TSLA:0.55 };

function generateSurface(und: Underlier): number[][] {
    const base = BASE_IV[und];
    return EXPIRATIONS.map((_, expIdx) =>
        STRIKES[und].map((_, sIdx) => {
            const baseIV = base + expIdx * 0.012;
            const moneyness = Math.abs(sIdx - 3.5) / 4;
            const skew = sIdx < 4 ? moneyness * 0.10 : moneyness * 0.04;
            const noise = (Math.sin(expIdx * 7 + sIdx * 13) * 0.01);
            return Math.max(0.05, baseIV + skew + noise);
        })
    );
}

function ivColor(iv: number, base: number): string {
    const rel = iv / base;
    if (rel < 0.85) return '#0d47a1';
    if (rel < 0.95) return '#1565c0';
    if (rel < 1.05) return '#1b5e20';
    if (rel < 1.15) return '#388e3c';
    if (rel < 1.30) return '#f57f17';
    if (rel < 1.50) return '#e65100';
    return '#b71c1c';
}

function ivTextColor(iv: number, base: number): string {
    const rel = iv / base;
    return rel > 1.3 || rel < 0.9 ? TEXT : SUBTLE;
}

export function VolSurfaceTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [underlier, setUnderlier] = useState<Underlier>('AAPL');
    const [viewMode, setViewMode] = useState<ViewMode>('surface');
    const [hovered, setHovered] = useState<{exp:number,str:number} | null>(null);

    const surface = useMemo(() => generateSurface(underlier), [underlier]);
    const base = BASE_IV[underlier];
    const strikes = STRIKES[underlier];
    const atm = ATM[underlier];

    // Term structure: ATM IV at each expiry (index 3=ATM)
    const termStructure = surface.map(row => row[3]);
    // Skew at 1M (expIdx=2)
    const skewRow = surface[2];

    const maxSkew = Math.max(...skewRow);
    const maxTerm = Math.max(...termStructure);

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>VS — VOL SURFACE</span>
                <div style={{ display:'flex', gap:2 }}>
                    {(['AAPL','SPY','NVDA','TSLA'] as Underlier[]).map(u => (
                        <button key={u} onClick={() => setUnderlier(u)}
                            style={{
                                background: underlier === u ? AMBER : 'transparent',
                                border:`1px solid ${underlier === u ? AMBER : BORDER}`,
                                color: underlier === u ? BG : SUBTLE,
                                fontFamily:MONO, fontSize:9, padding:'1px 5px', cursor:'pointer', borderRadius:2,
                            }}>
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            {/* View mode + ATM display */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                <div style={{ display:'flex', gap:2 }}>
                    {(['surface','skew','term'] as ViewMode[]).map(v => (
                        <button key={v} onClick={() => setViewMode(v)}
                            style={{
                                background: viewMode === v ? BLUE : 'transparent',
                                border:`1px solid ${viewMode === v ? BLUE : BORDER}`,
                                color: viewMode === v ? BG : SUBTLE,
                                fontFamily:MONO, fontSize:8, padding:'1px 5px', cursor:'pointer', borderRadius:2,
                            }}>
                            {v.toUpperCase()}
                        </button>
                    ))}
                </div>
                <span style={{ color:SUBTLE, fontSize:9 }}>ATM: {atm} | BASE IV: {(base*100).toFixed(1)}%</span>
            </div>

            {/* Main content */}
            <div style={{ flex:1, overflowAuto:'auto', overflow:'auto', padding:4 }}>
                {viewMode === 'surface' && (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign:'left', color:SUBTLE, fontSize:9, padding:'2px 4px', borderBottom:`1px solid ${BORDER}` }}>EXP╲STK</th>
                                {strikes.map(s => (
                                    <th key={s} style={{ textAlign:'center', color: s === atm ? AMBER : SUBTLE, fontSize:9, padding:'2px 2px', borderBottom:`1px solid ${BORDER}`, fontWeight: s === atm ? 700 : 400 }}>
                                        {s}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {EXPIRATIONS.map((exp, eIdx) => (
                                <tr key={exp}>
                                    <td style={{ color:SUBTLE, fontSize:9, padding:'1px 4px', borderBottom:`1px solid ${BORDER}` }}>{exp}</td>
                                    {surface[eIdx].map((iv, sIdx) => {
                                        const isHov = hovered?.exp === eIdx && hovered?.str === sIdx;
                                        const bg = ivColor(iv, base);
                                        const fc = ivTextColor(iv, base);
                                        const isATM = Math.abs(strikes[sIdx] - atm) < 5;
                                        return (
                                            <td key={sIdx} style={{ padding:'1px' }}
                                                onMouseEnter={() => setHovered({exp:eIdx,str:sIdx})}
                                                onMouseLeave={() => setHovered(null)}
                                            >
                                                <div style={{
                                                    background:bg, textAlign:'center', padding:'2px 1px',
                                                    fontFamily:MONO, fontSize:9, color:fc,
                                                    border: isHov ? `1px solid ${AMBER}` : isATM ? `1px solid ${GREEN}` : '1px solid transparent',
                                                    borderRadius:1,
                                                }}>
                                                    {(iv*100).toFixed(1)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {viewMode === 'skew' && (
                    <div>
                        <div style={{ color:SUBTLE, fontSize:9, marginBottom:6 }}>1M IV SKEW — {underlier}</div>
                        <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:80, marginBottom:6 }}>
                            {skewRow.map((iv, i) => {
                                const h = Math.max(4, (iv / maxSkew) * 78);
                                const isATM = Math.abs(strikes[i] - atm) < 5;
                                return (
                                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                                        <div style={{ width:'100%', height:h, background: isATM ? GREEN : ivColor(iv, base), marginBottom:2, borderRadius:1 }} />
                                        <div style={{ color:SUBTLE, fontSize:8, transform:'rotate(-45deg)', transformOrigin:'top left', width:20, whiteSpace:'nowrap' }}>{strikes[i]}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:`repeat(${strikes.length},1fr)`, gap:2, marginTop:14 }}>
                            {skewRow.map((iv, i) => (
                                <div key={i} style={{ textAlign:'center', fontFamily:MONO, fontSize:9, color: ivTextColor(iv, base) || TEXT }}>{(iv*100).toFixed(1)}%</div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'term' && (
                    <div>
                        <div style={{ color:SUBTLE, fontSize:9, marginBottom:6 }}>ATM TERM STRUCTURE — {underlier}</div>
                        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, marginBottom:6 }}>
                            {termStructure.map((iv, i) => {
                                const h = Math.max(4, (iv / maxTerm) * 78);
                                return (
                                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                                        <div style={{ color:TEXT, fontSize:9, marginBottom:1 }}>{(iv*100).toFixed(1)}</div>
                                        <div style={{ width:'100%', height:h, background:BLUE, borderRadius:1, opacity: 0.5 + i*0.07 }} />
                                        <div style={{ color:SUBTLE, fontSize:8, marginTop:2 }}>{EXPIRATIONS[i]}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ borderTop:`1px solid ${BORDER}`, marginTop:8, paddingTop:6 }}>
                            <div style={{ color:SUBTLE, fontSize:9, marginBottom:4 }}>TERM STRUCTURE METRICS</div>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                                {[
                                    ['1M ATM IV', `${(termStructure[2]*100).toFixed(2)}%`, TEXT],
                                    ['3M ATM IV', `${(termStructure[4]*100).toFixed(2)}%`, TEXT],
                                    ['1Y ATM IV', `${(termStructure[7]*100).toFixed(2)}%`, TEXT],
                                    ['1M/3M Ratio', `${(termStructure[2]/termStructure[4]).toFixed(2)}x`, termStructure[2]>termStructure[4] ? RED : GREEN],
                                    ['Contango', termStructure[7]>termStructure[2] ? 'YES' : 'NO', termStructure[7]>termStructure[2] ? GREEN : RED],
                                    ['Base IV', `${(base*100).toFixed(1)}%`, AMBER],
                                ].map(([l,v,c]) => (
                                    <div key={l as string}>
                                        <div style={{ color:SUBTLE, fontSize:8 }}>{l as string}</div>
                                        <div style={{ color:c as string, fontFamily:MONO, fontSize:10 }}>{v as string}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:4, padding:'3px 8px', borderTop:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0, flexWrap:'wrap' }}>
                {[['LOW','#0d47a1'],['MID-L','#1565c0'],['ATM','#1b5e20'],['MID-H','#388e3c'],['HIGH','#e65100'],['V.HIGH','#b71c1c']].map(([l,c]) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:2 }}>
                        <div style={{ width:8, height:8, background:c, borderRadius:1 }} />
                        <span style={{ color:SUBTLE, fontSize:8 }}>{l}</span>
                    </div>
                ))}
                {hovered && (
                    <span style={{ marginLeft:'auto', color:AMBER, fontSize:9 }}>
                        {EXPIRATIONS[hovered.exp]} x {strikes[hovered.str]}: {(surface[hovered.exp][hovered.str]*100).toFixed(2)}%
                    </span>
                )}
            </div>
        </div>
    );
}
