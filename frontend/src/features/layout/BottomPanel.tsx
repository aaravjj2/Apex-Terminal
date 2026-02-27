// Bloomberg Palette
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

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../state/appStore';

// Simulated live log entries (from websocket context)
const SEED_LOGS = [
    { time: '09:31:42', level: 'INFO', message: 'Bar confirmed: AAPL 1m @ 186.54', component: 'BAR_ENGINE' },
    { time: '09:31:41', level: 'DEBUG', message: 'WebSocket message received: type=trade', component: 'WS' },
    { time: '09:31:40', level: 'INFO', message: 'Connected to Finnhub stream [session=fh_9x2]', component: 'PROVIDER' },
    { time: '09:31:39', level: 'WARN', message: 'Rate limit approaching: 45/60 req/min', component: 'PROVIDER' },
    { time: '09:31:38', level: 'INFO', message: 'Bar saved to repository: index=29465922', component: 'REPOSITORY' },
    { time: '09:31:37', level: 'DEBUG', message: 'Indicator RSI(14) recalculated: 62.4', component: 'ENGINE' },
    { time: '09:31:36', level: 'INFO', message: 'Strategy heartbeat OK â€” uptime 00:01:36', component: 'STRATEGY' },
    { time: '09:31:35', level: 'INFO', message: 'Portfolio valuation updated: $127,450.00', component: 'PORTFOLIO' },
    { time: '09:31:34', level: 'WARN', message: 'Spread widened: TSLA ask-bid=0.42', component: 'MARKET' },
    { time: '09:31:33', level: 'DEBUG', message: 'Cache miss: symbol=NVDA timeframe=1m', component: 'CACHE' },
    { time: '09:31:32', level: 'INFO', message: 'Order submitted: ORD-001 BUY 100 AAPL LIMIT @185.00', component: 'ORDERS' },
    { time: '09:31:31', level: 'ERROR', message: 'WebSocket ping timeout â€” reconnecting...', component: 'WS' },
    { time: '09:31:30', level: 'INFO', message: 'Reconnection successful: attempt=1', component: 'WS' },
    { time: '09:31:28', level: 'DEBUG', message: 'Greeks updated: delta=0.45 gamma=0.02 theta=-0.08', component: 'OPTIONS' },
    { time: '09:31:27', level: 'INFO', message: 'Alert triggered: AAPL > $186.00', component: 'ALERTS' },
    { time: '09:31:26', level: 'DEBUG', message: 'Market depth snapshot: AAPL bid=185.98 ask=186.02', component: 'MARKET' },
];

const SEED_ORDERS = [
    { id: 'ORD-001', symbol: 'AAPL', side: 'BUY', qty: 100, type: 'LIMIT', price: 185.00, status: 'PENDING', time: '09:31:32', value: 18500 },
    { id: 'ORD-002', symbol: 'MSFT', side: 'SELL', qty: 50, type: 'MARKET', price: 415.32, status: 'FILLED', time: '09:28:14', value: 20766 },
    { id: 'ORD-003', symbol: 'TSLA', side: 'BUY', qty: 25, type: 'STOP', price: 245.00, status: 'OPEN', time: '09:25:01', value: 6125 },
    { id: 'ORD-004', symbol: 'NVDA', side: 'SELL', qty: 10, type: 'LIMIT', price: 875.00, status: 'CANCELLED', time: '09:20:45', value: 8750 },
    { id: 'ORD-005', symbol: 'SPY', side: 'BUY', qty: 200, type: 'MARKET', price: 524.80, status: 'FILLED', time: '09:15:30', value: 104960 },
];

const SEED_ALERTS = [
    { time: '09:31:27', alert: 'AAPL > $186.00', type: 'PRICE', symbol: 'AAPL', note: 'Price above threshold' },
    { time: '09:28:42', alert: 'Volume spike: TSLA 3.2x avg', type: 'VOLUME', symbol: 'TSLA', note: 'Volume anomaly detected' },
    { time: '09:22:15', alert: 'RSI(14) overbought: NVDA @ 74.2', type: 'INDICATOR', symbol: 'NVDA', note: 'RSI above 70' },
    { time: '09:15:00', alert: 'Market open â€” session started', type: 'SESSION', symbol: 'â€”', note: 'Pre-market activity' },
    { time: '09:10:33', alert: 'Bid/ask spread widened: TSLA +0.3%', type: 'SPREAD', symbol: 'TSLA', note: 'Liquidity change' },
];

function LogsPanel() {
    const [logs, setLogs] = useState(SEED_LOGS);
    const [filter, setFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL');
    const [search, setSearch] = useState('');
    const [paused, setPaused] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (paused) return;
        const comps = ['BAR_ENGINE', 'WS', 'PROVIDER', 'CACHE', 'STRATEGY', 'ORDERS', 'ALERTS'];
        const msgs = [
            'Bar confirmed', 'WebSocket heartbeat OK', 'Cache hit', 'Strategy tick processed',
            'Indicator updated', 'Market data received', 'Order status polled',
        ];
        const t = setInterval(() => {
            const now = new Date();
            const entry = {
                time: now.toLocaleTimeString('en-US', { hour12: false }),
                level: Math.random() < 0.05 ? 'WARN' : Math.random() < 0.02 ? 'ERROR' : 'INFO',
                message: msgs[Math.floor(Math.random() * msgs.length)] + ': ' + (Math.random() * 200).toFixed(2),
                component: comps[Math.floor(Math.random() * comps.length)],
            };
            setLogs(prev => [entry, ...prev].slice(0, 100));
        }, 2000);
        return () => clearInterval(t);
    }, [paused]);

    const levelColor: Record<string, string> = { INFO: BLUE, DEBUG: SUBTLE, WARN: AMBER, ERROR: RED };
    const filtered = logs.filter(l => (filter === 'ALL' || l.level === filter) && (!search || l.message.toLowerCase().includes(search.toLowerCase()) || l.component.includes(search.toUpperCase())));

    const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
        fontSize: 9, padding: '2px 7px', background: active ? color + '22' : 'transparent',
        border: `1px solid ${active ? color : BORDER}`, color: active ? color : SUBTLE,
        borderRadius: 2, cursor: 'pointer', fontFamily: MONO,
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0, flexWrap: 'wrap' }}>
                {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map(f => (
                    <button key={f} style={btnStyle(filter === f, levelColor[f] || AMBER)} onClick={() => setFilter(f)}>{f}</button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..." style={{ background: BORDER, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 2, padding: '2px 8px', fontSize: 9, fontFamily: MONO, width: 100 }} />
                <div style={{ flex: 1 }} />
                <button style={btnStyle(paused, AMBER)} onClick={() => setPaused(p => !p)}>{paused ? 'â–¶ RESUME' : 'â¸ PAUSE'}</button>
                <button style={btnStyle(false, RED)} onClick={() => setLogs([])}>CLR</button>
                <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{filtered.length} ENTRIES</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', fontFamily: MONO }}>
                {filtered.map((log, i) => (
                    <div key={i} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 10px', borderBottom: `1px solid ${BORDER}18` }}>
                        <span style={{ fontSize: 9, color: SUBTLE, flexShrink: 0, minWidth: 60 }}>{log.time}</span>
                        <span style={{ fontSize: 9, color: levelColor[log.level] || TEXT, fontWeight: 700, flexShrink: 0, minWidth: 38 }}>[{log.level}]</span>
                        <span style={{ fontSize: 9, color: BLUE, flexShrink: 0, minWidth: 80 }}>[{log.component}]</span>
                        <span style={{ fontSize: 10, color: TEXT }}>{log.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

function OrdersPanel() {
    const [orders] = useState(SEED_ORDERS);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'FILLED' | 'OPEN' | 'CANCELLED'>('ALL');

    const statusColor: Record<string, string> = { PENDING: AMBER, FILLED: GREEN, OPEN: BLUE, CANCELLED: SUBTLE };
    const filtered = orders.filter(o => filter === 'ALL' || o.status === filter);

    const btnStyle = (active: boolean): React.CSSProperties => ({
        fontSize: 9, padding: '2px 7px', background: active ? AMBER + '22' : 'transparent',
        border: `1px solid ${active ? AMBER : BORDER}`, color: active ? AMBER : SUBTLE,
        borderRadius: 2, cursor: 'pointer', fontFamily: MONO,
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                {(['ALL', 'PENDING', 'FILLED', 'OPEN', 'CANCELLED'] as const).map(f => (
                    <button key={f} style={btnStyle(filter === f)} onClick={() => setFilter(f)}>{f}</button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{filtered.length} ORDERS</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
                    <thead style={{ position: 'sticky', top: 0, background: PANEL }}>
                        <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                            {['ID', 'SYMBOL', 'SIDE', 'QTY', 'TYPE', 'PRICE', 'VALUE', 'STATUS', 'TIME'].map(h => (
                                <th key={h} style={{ textAlign: h === 'QTY' || h === 'PRICE' || h === 'VALUE' ? 'right' : 'left', padding: '5px 8px', fontSize: 9, color: SUBTLE, letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((o, i) => (
                            <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ borderBottom: `1px solid ${BORDER}18`, cursor: 'default' }}>
                                <td style={{ padding: '5px 8px', color: SUBTLE }}>{o.id}</td>
                                <td style={{ padding: '5px 8px', fontWeight: 700, color: TEXT }}>{o.symbol}</td>
                                <td style={{ padding: '5px 8px', color: o.side === 'BUY' ? GREEN : RED, fontWeight: 700 }}>{o.side}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>{o.qty}</td>
                                <td style={{ padding: '5px 8px', color: SUBTLE }}>{o.type}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>${o.price.toFixed(2)}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>${o.value.toLocaleString()}</td>
                                <td style={{ padding: '5px 8px' }}>
                                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: (statusColor[o.status] || SUBTLE) + '22', color: statusColor[o.status] || SUBTLE, fontWeight: 700 }}>{o.status}</span>
                                </td>
                                <td style={{ padding: '5px 8px', color: SUBTLE, fontSize: 9 }}>{o.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AlertStreamPanel() {
    const [alerts] = useState(SEED_ALERTS);
    const typeColor: Record<string, string> = { PRICE: AMBER, VOLUME: BLUE, INDICATOR: PURPLE, SESSION: GREEN, SPREAD: RED };

    return (
        <div style={{ height: '100%', overflow: 'auto', padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>ALERT STREAM</div>
            {alerts.map((a, i) => (
                <div key={i} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 8px', borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${typeColor[a.type] || AMBER}`, marginBottom: 3 }}>
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>{a.time}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: typeColor[a.type] || AMBER, marginTop: 2 }}>{a.type}</div>
                    </div>
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT, fontWeight: 600 }}>{a.alert}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, marginTop: 2 }}>{a.note}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, padding: '1px 5px', background: GREEN + '22', color: GREEN, borderRadius: 2 }}>TRIGGERED</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function BottomPanel() {
    const { bottomDockOpen, toggleBottomDock } = useAppStore();
    const [activeTab, setActiveTab] = useState<'LOGS' | 'ORDERS' | 'ALERTS'>('LOGS');

    if (!bottomDockOpen) return null;

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '0 12px',
        height: 34,
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
        <div style={{ height: '100%', background: BG, borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', color: TEXT, fontFamily: MONO }}>
            <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {(['LOGS', 'ORDERS', 'ALERTS'] as const).map(t => (
                    <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={toggleBottomDock} onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', padding: '0 12px', fontSize: 13 }}>âœ•</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'LOGS' && <LogsPanel />}
                {activeTab === 'ORDERS' && <OrdersPanel />}
                {activeTab === 'ALERTS' && <AlertStreamPanel />}
            </div>
        </div>
    );
}
