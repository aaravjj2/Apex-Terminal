// Bloomberg Palette
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

import React, { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { useStore } from '../../state/store';
import { IndicatorDock } from '../indicators/IndicatorDock';

// Panel content components
function DataInspector() {
    const { candles, lastCandle } = useStore();
    const { providers } = useAppStore();

    const current = lastCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
    const prev = candles.length > 1 ? candles[candles.length - 2] : null;
    const change = current && prev ? current.close - prev.close : 0;
    const changePercent = current && prev && prev.close ? (change / prev.close) * 100 : 0;

    const activeProvider = providers.alpaca.status === 'connected' ? 'Alpaca' :
        providers.finnhub.status === 'connected' ? 'Finnhub' : 'Mock/Offline';

    const fmt = (n: number) => n.toFixed(2);
    const fmtVol = (n: number) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    };

    const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` };
    const labelStyle: React.CSSProperties = { fontSize: 10, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.05em' };
    const valStyle: React.CSSProperties = { fontSize: 11, fontFamily: MONO, color: TEXT };
    const sectionLabel: React.CSSProperties = { fontSize: 9, color: AMBER, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6, marginTop: 12, fontFamily: MONO };

    if (!current) {
        return <div style={{ padding: 12, fontSize: 11, color: SUBTLE, fontFamily: MONO }}>NO DATA â€” WAITING FOR FEED</div>;
    }

    return (
        <div style={{ padding: '12px 14px', overflow: 'auto', height: '100%' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>PRICE DATA</div>

            {/* OHLCV */}
            {[
                { label: 'OPEN', val: fmt(current.open) },
                { label: 'HIGH', val: fmt(current.high), color: GREEN },
                { label: 'LOW', val: fmt(current.low), color: RED },
                { label: 'CLOSE', val: fmt(current.close) },
                { label: 'VOLUME', val: fmtVol(current.volume) },
            ].map(({ label, val, color }) => (
                <div key={label} style={rowStyle}>
                    <span style={labelStyle}>{label}</span>
                    <span style={{ ...valStyle, color: color || TEXT }}>{val}</span>
                </div>
            ))}

            {/* Change */}
            <div style={rowStyle}>
                <span style={labelStyle}>CHANGE</span>
                <span style={{ ...valStyle, color: change >= 0 ? GREEN : RED }}>
                    {change >= 0 ? '+' : ''}{fmt(change)} ({fmt(changePercent)}%)
                </span>
            </div>
            <div style={rowStyle}>
                <span style={labelStyle}>SPREAD</span>
                <span style={valStyle}>â€”</span>
            </div>

            {/* VWAP/Range */}
            <div style={sectionLabel}>SESSION METRICS</div>
            {[
                { label: 'DAY HIGH', val: fmt(Math.max(...candles.slice(-78).map(c => c.high), current.high)) },
                { label: 'DAY LOW', val: fmt(Math.min(...candles.slice(-78).map(c => c.low), current.low)) },
                { label: 'BAR COUNT', val: candles.length.toString() },
                { label: 'LAST BAR', val: new Date(current.time).toLocaleTimeString() },
            ].map(({ label, val }) => (
                <div key={label} style={rowStyle}>
                    <span style={labelStyle}>{label}</span>
                    <span style={valStyle}>{val}</span>
                </div>
            ))}

            {/* Provider */}
            <div style={sectionLabel}>DATA SOURCE</div>
            {[
                { label: 'PROVIDER', val: activeProvider, color: providers.alpaca.status === 'connected' ? GREEN : providers.finnhub.status === 'connected' ? BLUE : SUBTLE },
                { label: 'ALPACA', val: providers.alpaca.status.toUpperCase(), color: providers.alpaca.status === 'connected' ? GREEN : SUBTLE },
                { label: 'FINNHUB', val: providers.finnhub.status.toUpperCase(), color: providers.finnhub.status === 'connected' ? GREEN : SUBTLE },
                { label: 'YAHOO', val: providers.yahoo.status.toUpperCase(), color: providers.yahoo.status === 'connected' ? GREEN : SUBTLE },
            ].map(({ label, val, color }) => (
                <div key={label} style={rowStyle}>
                    <span style={labelStyle}>{label}</span>
                    <span style={{ ...valStyle, color: color || TEXT }}>{val}</span>
                </div>
            ))}

            {/* Technical quick stats */}
            <div style={sectionLabel}>TECHNICALS</div>
            {(() => {
                const closes = candles.slice(-20).map(c => c.close);
                const sma20 = closes.length > 0 ? closes.reduce((a, b) => a + b, 0) / closes.length : 0;
                const sma5 = candles.slice(-5).map(c => c.close).reduce((a, b) => a + b, 0) / Math.min(5, candles.length);
                const vols = candles.slice(-14).map((c, i, a) => i === 0 ? 0 : Math.abs(c.close - a[i-1].close));
                const avgVol = vols.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, vols.length - 1);
                return [
                    { label: 'SMA(20)', val: sma20 > 0 ? fmt(sma20) : 'â€”', color: current.close > sma20 ? GREEN : RED },
                    { label: 'SMA(5)', val: sma5 > 0 ? fmt(sma5) : 'â€”', color: current.close > sma5 ? GREEN : RED },
                    { label: 'ATR(14)', val: avgVol > 0 ? fmt(avgVol) : 'â€”' },
                    { label: 'MOM', val: closes.length >= 10 ? ((current.close / closes[0] - 1) * 100).toFixed(2) + '%' : 'â€”', color: current.close >= closes[0] ? GREEN : RED },
                ].map(({ label, val, color }) => (
                    <div key={label} style={rowStyle}>
                        <span style={labelStyle}>{label}</span>
                        <span style={{ ...valStyle, color: color || TEXT }}>{val}</span>
                    </div>
                ));
            })()}
        </div>
    );
}

function IndicatorManager() {
    return <IndicatorDock />;
}

function DrawingManager() {
    const drawings = [
        { type: 'Trend Line', symbol: 'AAPL', note: 'Bullish channel', color: BLUE },
        { type: 'Horizontal', symbol: 'AAPL', note: '$185.00 Support', color: GREEN },
        { type: 'Rectangle', symbol: 'AAPL', note: 'Support Zone', color: AMBER },
        { type: 'Fib Retrace', symbol: 'MSFT', note: '0.618 Level', color: PURPLE },
        { type: 'Channel', symbol: 'SPY', note: 'Wedge pattern', color: RED },
    ];

    return (
        <div style={{ padding: '12px 14px', height: '100%', overflow: 'auto' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>CHART DRAWINGS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{drawings.length} OBJECTS</span>
                <button style={{ padding: '2px 8px', fontSize: 9, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>+ NEW</button>
            </div>
            {drawings.map((d, i) => (
                <div key={i} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', borderLeft: `2px solid ${d.color}` }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{d.type}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>{d.symbol} â€¢ {d.note}</div>
                    </div>
                    <button onMouseEnter={e => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.color = RED; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = SUBTLE; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUBTLE, fontSize: 12 }}>âœ•</button>
                </div>
            ))}
        </div>
    );
}

function AlertsPanel() {
    const alerts = [
        { symbol: 'AAPL', condition: '> $190.00', type: 'Price', active: true, color: AMBER },
        { symbol: 'SPY', condition: 'RSI > 70', type: 'Indicator', active: true, color: RED },
        { symbol: 'TSLA', condition: 'Vol Spike', type: 'Volume', active: false, color: BLUE },
        { symbol: 'MSFT', condition: '< $390.00', type: 'Price', active: true, color: GREEN },
    ];

    return (
        <div style={{ padding: '12px 14px', height: '100%', overflow: 'auto' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>ACTIVE ALERTS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{alerts.filter(a => a.active).length} ACTIVE</span>
                <button style={{ padding: '2px 8px', fontSize: 9, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>+ NEW</button>
            </div>
            {alerts.map((a, i) => (
                <div key={i} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ padding: '8px', marginBottom: 6, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${a.active ? a.color : SUBTLE}`, borderRadius: '0 2px 2px 0', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: TEXT }}>{a.symbol}</span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 2, background: a.active ? GREEN + '22' : BORDER, color: a.active ? GREEN : SUBTLE, fontFamily: MONO }}>{a.active ? 'ACTIVE' : 'PAUSED'}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: a.color, marginTop: 3 }}>{a.condition}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, marginTop: 2 }}>{a.type.toUpperCase()}</div>
                </div>
            ))}
        </div>
    );
}

export function RightPanel() {
    const { rightDockOpen, toggleRightDock } = useAppStore();
    const [activeTab, setActiveTab] = useState<'DATA' | 'IND' | 'DRAW' | 'ALERTS'>('DATA');

    if (!rightDockOpen) return null;

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '0 10px',
        height: 36,
        border: 'none',
        borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
        background: 'transparent',
        color: active ? AMBER : SUBTLE,
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        cursor: 'pointer',
    });

    return (
        <div style={{ height: '100%', background: BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', color: TEXT, fontFamily: MONO }}>
            {/* Tab bar */}
            <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {(['DATA', 'IND', 'DRAW', 'ALERTS'] as const).map(t => (
                    <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}
                        data-testid={t === 'IND' ? 'right-dock-tab-ind' : undefined}>{t}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={toggleRightDock} onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', padding: '0 10px', fontSize: 13 }}>âœ•</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'DATA' && <DataInspector />}
                {activeTab === 'IND' && <IndicatorManager />}
                {activeTab === 'DRAW' && <DrawingManager />}
                {activeTab === 'ALERTS' && <AlertsPanel />}
            </div>
        </div>
    );
}
