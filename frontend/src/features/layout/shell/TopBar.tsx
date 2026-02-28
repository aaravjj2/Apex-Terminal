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

import React, { useState, useEffect } from 'react';
import { useAppStore, type ProviderName } from '../../../state/appStore';
import { useStore } from '../../../state/store';

function DataFeedStatus() {
    const { wsState, reconnectAttempts } = useStore();
    let label = 'FEED';
    let color = GREEN;
    if (wsState === 'CONNECTING' && reconnectAttempts > 0) { label = `RECONN(${reconnectAttempts})`; color = AMBER; }
    else if (wsState === 'CONNECTING') { label = 'CONNECTING'; color = AMBER; }
    else if (wsState === 'DISCONNECTED') { label = reconnectAttempts > 0 ? `OFFLINE(${reconnectAttempts})` : 'OFFLINE'; color = RED; }
    else if (wsState === 'DEGRADED') { label = 'DEGRADED'; color = AMBER; }
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: wsState === 'CONNECTED' ? `0 0 4px ${color}` : 'none' }} />
            <span style={{ fontFamily: MONO, fontSize: 9, color }}>{label}</span>
        </div>
    );
}

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const SYMBOLS_RECENT = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'AMD', 'AMZN', 'GOOG'];

export function TopBar() {
    const { mode, symbol, timeframe, providers, marketTime, replayTime, isReplayPlaying, setReplayPlaying } = useAppStore();
    const { candles, lastCandle } = useStore();
    const [now, setNow] = useState(new Date());
    const [showSymbolDrop, setShowSymbolDrop] = useState(false);
    const [showTfDrop, setShowTfDrop] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const displayTime = mode === 'REPLAY' && replayTime
        ? new Date(replayTime).toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' })
        : now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' });

    const displayDate = mode === 'REPLAY' && replayTime
        ? new Date(replayTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    const getProviderColor = (name: ProviderName): string => {
        const p = providers[name];
        if (p.status === 'connected') return GREEN;
        if (p.status === 'rate_limited') return AMBER;
        return RED;
    };

    // Price info from last candle
    const current = lastCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
    const prev = candles.length > 1 ? candles[candles.length - 2] : null;
    const change = current && prev ? current.close - prev.close : 0;
    const changePct = current && prev && prev.close ? (change / prev.close) * 100 : 0;

    const divStyle: React.CSSProperties = { width: 1, height: 18, background: BORDER, flexShrink: 0 };

    const modeColor = mode === 'LIVE' ? GREEN : mode === 'REPLAY' ? AMBER : mode === 'BACKTEST' ? PURPLE : BLUE;

    return (
        <header data-testid="topbar" style={{ height: 46, background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between', flexShrink: 0, zIndex: 100, gap: 4 }}>
            {/* LEFT: Logo + Mode + Symbol + Timeframe */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 26, height: 26, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: AMBER }}>A</div>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>APEX</span>
                </div>

                <div style={divStyle} />

                {/* Mode badge */}
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 2, background: modeColor + '22', color: modeColor, border: `1px solid ${modeColor}44` }}>{mode}</span>

                <div style={divStyle} />

                {/* Symbol selector */}
                <div style={{ position: 'relative' }}>
                    <button
                        data-testid="symbol-display"
                        onClick={() => { setShowSymbolDrop(s => !s); setShowTfDrop(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: showSymbolDrop ? AMBER + '22' : 'transparent', border: `1px solid ${showSymbolDrop ? AMBER : BORDER}`, borderRadius: 3, cursor: 'pointer', gap: 6 }}
                    >
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEXT }}>{symbol}</span>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: AMBER }}>â–¼</span>
                    </button>
                    {showSymbolDrop && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, zIndex: 200, minWidth: 100, marginTop: 2 }}>
                            {SYMBOLS_RECENT.map(s => (
                                <div key={s} onClick={() => setShowSymbolDrop(false)} onMouseEnter={e => (e.currentTarget.style.background = AMBER + '22')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ padding: '6px 12px', cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: s === symbol ? AMBER : TEXT }}>
                                    {s}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Timeframe selector */}
                <div style={{ position: 'relative' }}>
                    <button
                        data-testid="timeframe-display"
                        onClick={() => { setShowTfDrop(t => !t); setShowSymbolDrop(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: showTfDrop ? BLUE + '22' : 'transparent', border: `1px solid ${showTfDrop ? BLUE : BORDER}`, borderRadius: 3, cursor: 'pointer' }}
                    >
                        <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{timeframe}</span>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BLUE }}>â–¼</span>
                    </button>
                    {showTfDrop && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, zIndex: 200, minWidth: 50, marginTop: 2 }}>
                            {TIMEFRAMES.map(tf => (
                                <div key={tf} onClick={() => setShowTfDrop(false)} onMouseEnter={e => (e.currentTarget.style.background = BLUE + '22')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ padding: '5px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 10, color: tf === timeframe ? BLUE : TEXT }}>
                                    {tf}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Price quote */}
                {current && (
                    <>
                        <div style={divStyle} />
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEXT }}>${current.close.toFixed(2)}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: change >= 0 ? GREEN : RED }}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                        </span>
                    </>
                )}
            </div>

            {/* CENTER: Replay marker */}
            {mode === 'REPLAY' && displayDate && (
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>{displayDate}</span>
                    <span style={{ color: SUBTLE }}>â€¢</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: TEXT }}>{displayTime}</span>
                </div>
            )}

            {/* RIGHT: Providers + Clock + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Provider status dots */}
                {(['finnhub', 'alpaca', 'yahoo'] as ProviderName[]).map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: getProviderColor(p), display: 'inline-block' }} />
                        <span style={{ fontFamily: MONO, fontSize: 8, color: getProviderColor(p) }}>{p.toUpperCase()}</span>
                    </div>
                ))}

                <div style={divStyle} />
                <DataFeedStatus />

                <div style={divStyle} />

                {/* Rate limit */}
                <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>298/300</div>

                <div style={divStyle} />

                {/* Clock */}
                {mode !== 'REPLAY' && (
                    <>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{displayTime}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>EST</span>
                        <div style={divStyle} />
                    </>
                )}

                {/* Mode action */}
                {mode === 'REPLAY' ? (
                    <button onClick={() => setReplayPlaying(!isReplayPlaying)} style={{ padding: '4px 12px', background: isReplayPlaying ? AMBER + '22' : GREEN + '22', border: `1px solid ${isReplayPlaying ? AMBER : GREEN}`, color: isReplayPlaying ? AMBER : GREEN, borderRadius: 3, cursor: 'pointer', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                        {isReplayPlaying ? 'â¸ PAUSE' : 'â–¶ PLAY'}
                    </button>
                ) : (
                    <button data-testid="start-strategy-btn" style={{ padding: '4px 14px', background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 3, cursor: 'pointer', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                        â–¶ START
                    </button>
                )}
            </div>
        </header>
    );
}
