// Bloomberg PF — Performance Terminal Tile
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

type Period = 'today' | 'week' | 'month' | 'ytd' | 'inception';

const METRICS: Record<Period, { pl: number; plPct: number; trades: number; wins: number }> = {
    today:     { pl: 1234.56,   plPct:  0.82, trades:  8, wins:  5 },
    week:      { pl: 4567.89,   plPct:  3.12, trades: 34, wins: 21 },
    month:     { pl: 12345.67,  plPct:  8.45, trades:142, wins: 89 },
    ytd:       { pl: 45678.90,  plPct: 32.15, trades:612, wins:382 },
    inception: { pl:103214.50,  plPct: 82.40, trades:2140,wins:1337 },
};

const DAILY_PL = [
    620, -180, 450, 1100, -320, 890, 240, 550, -90, 780, 1020, -150,
    330, 670, -210, 940, 120, -440, 810, 580, -70, 1200, -280, 760,
];

const RISK_METRICS = {
    sharpe:      1.85,
    sortino:     2.14,
    maxDrawdown: -12.5,
    calmar:      2.58,
    beta:        0.72,
    alpha:       0.034,
    volatility:  15.3,
    varDaily:    -0.42,
};

export function PerformanceTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [period, setPeriod] = useState<Period>('today');

    const m = METRICS[period];
    const winRate = m.trades > 0 ? (m.wins / m.trades) * 100 : 0;
    const plColor = m.pl >= 0 ? GREEN : RED;
    const barMax = Math.max(...DAILY_PL.map(Math.abs));

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:BG, fontFamily:MONO, fontSize:12, color:TEXT }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span style={{ color:AMBER, fontWeight:700, fontSize:11, letterSpacing:2 }}>PF — PERFORMANCE</span>
                <span style={{ color:SUBTLE, fontSize:9 }}>APEX-TERMINAL</span>
            </div>

            {/* Period selector */}
            <div style={{ display:'flex', gap:2, padding:'3px 8px', borderBottom:`1px solid ${BORDER}`, background:'#0d0d0d', flexShrink:0 }}>
                {(['today','week','month','ytd','inception'] as Period[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                        style={{
                            background: period === p ? AMBER : 'transparent',
                            border: `1px solid ${period === p ? AMBER : BORDER}`,
                            color: period === p ? BG : SUBTLE,
                            fontFamily:MONO, fontSize:9, padding:'2px 6px', cursor:'pointer', borderRadius:2,
                        }}>
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Main P&L Hero */}
            <div style={{ padding:'8px 12px', background:PANEL, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <div style={{ color:SUBTLE, fontSize:9, marginBottom:2 }}>{period.toUpperCase()} P&L</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                    <span style={{ color:plColor, fontSize:22, fontWeight:700, fontFamily:MONO }}>
                        {m.pl >= 0 ? '+' : '-'}${Math.abs(m.pl).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                    </span>
                    <span style={{ color:plColor, fontSize:14 }}>
                        {m.plPct >= 0 ? '+' : ''}{m.plPct.toFixed(2)}%
                    </span>
                </div>
                <div style={{ display:'flex', gap:16, marginTop:4 }}>
                    <div>
                        <span style={{ color:SUBTLE, fontSize:9 }}>TRADES </span>
                        <span style={{ color:TEXT, fontSize:10 }}>{m.trades}</span>
                    </div>
                    <div>
                        <span style={{ color:SUBTLE, fontSize:9 }}>WINS </span>
                        <span style={{ color:GREEN, fontSize:10 }}>{m.wins}</span>
                    </div>
                    <div>
                        <span style={{ color:SUBTLE, fontSize:9 }}>WIN% </span>
                        <span style={{ color: winRate >= 55 ? GREEN : winRate >= 45 ? AMBER : RED, fontSize:10 }}>{winRate.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Win Rate Bar */}
            <div style={{ padding:'4px 8px', borderBottom:`1px solid ${BORDER}`, flexShrink:0, background:'#0d0d0d' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ color:GREEN, fontSize:9 }}>WIN {winRate.toFixed(1)}%</span>
                    <span style={{ color:RED, fontSize:9 }}>LOSS {(100-winRate).toFixed(1)}%</span>
                </div>
                <div style={{ height:6, background:RED, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${winRate}%`, background:GREEN, borderRadius:3 }} />
                </div>
            </div>

            {/* Daily P&L Chart */}
            <div style={{ padding:'6px 8px', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <div style={{ color:SUBTLE, fontSize:9, marginBottom:4 }}>DAILY P&L (24 SESSIONS)</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:1, height:40 }}>
                    {DAILY_PL.map((v, i) => {
                        const h = Math.max(2, Math.abs(v) / barMax * 38);
                        return (
                            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent: v >= 0 ? 'flex-end' : 'flex-start', height:40 }}>
                                <div style={{ width:'100%', height:h, background: v >= 0 ? GREEN : RED, opacity:0.9 }} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Risk Metrics Grid */}
            <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
                <div style={{ padding:'2px 8px', color:SUBTLE, fontSize:9, borderBottom:`1px solid ${BORDER}` }}>RISK METRICS</div>
                {[
                    ['Sharpe Ratio',  RISK_METRICS.sharpe.toFixed(2),          RISK_METRICS.sharpe > 1.5 ? GREEN : RISK_METRICS.sharpe > 1 ? AMBER : RED],
                    ['Sortino Ratio', RISK_METRICS.sortino.toFixed(2),         RISK_METRICS.sortino > 2 ? GREEN : AMBER],
                    ['Max Drawdown',  `${RISK_METRICS.maxDrawdown.toFixed(1)}%`, RED],
                    ['Calmar Ratio',  RISK_METRICS.calmar.toFixed(2),          GREEN],
                    ['Beta',          RISK_METRICS.beta.toFixed(2),            BLUE],
                    ['Alpha',         `${(RISK_METRICS.alpha * 100).toFixed(2)}%`, ORANGE],
                    ['Volatility',    `${RISK_METRICS.volatility.toFixed(1)}%`, SUBTLE],
                    ['VaR (1D 95%)',  `${RISK_METRICS.varDaily.toFixed(2)}%`,   RED],
                ].map(([label, value, color]) => (
                    <div key={label as string} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderBottom:`1px solid ${BORDER}` }}>
                        <span style={{ color:SUBTLE, fontSize:10 }}>{label as string}</span>
                        <span style={{ color:color as string, fontFamily:MONO, fontSize:11 }}>{value as string}</span>
                    </div>
                ))}
            </div>

            {/* Period summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, padding:'4px', background:'#0d0d0d', borderTop:`1px solid ${BORDER}`, flexShrink:0 }}>
                {(['week','month','ytd','inception'] as Period[]).map(p => {
                    const pm = METRICS[p];
                    return (
                        <div key={p} onClick={() => setPeriod(p)}
                            style={{ background: period === p ? '#1a1500' : PANEL, padding:'3px 4px', cursor:'pointer', borderTop:`2px solid ${pm.pl >= 0 ? GREEN : RED}` }}>
                            <div style={{ color:SUBTLE, fontSize:8 }}>{p.toUpperCase()}</div>
                            <div style={{ color: pm.pl >= 0 ? GREEN : RED, fontSize:9, fontFamily:MONO }}>
                                {pm.plPct >= 0 ? '+' : ''}{pm.plPct.toFixed(1)}%
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
