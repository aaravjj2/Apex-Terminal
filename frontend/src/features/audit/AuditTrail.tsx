// Bloomberg Palette
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

import React, { useState, useEffect, useCallback } from 'react';

interface AuditEvent {
    id: string;
    timestamp: string;
    type: 'signal' | 'order' | 'fill' | 'portfolio' | 'risk';
    symbol?: string;
    details: Record<string, unknown>;
}

const API_BASE = '/api/v1';

const typeColor: Record<string, string> = {
    signal: BLUE, order: PURPLE, fill: GREEN, portfolio: AMBER, risk: ORANGE,
};

const MOCK_EVENTS: AuditEvent[] = [
    { id: '1', timestamp: new Date(Date.now() - 300000).toISOString(), type: 'signal', symbol: 'AAPL', details: { action: 'BUY', indicator: 'SMA crossover', price: 175.00 } },
    { id: '2', timestamp: new Date(Date.now() - 299000).toISOString(), type: 'risk', symbol: 'AAPL', details: { check: 'position_limit', result: 'PASSED', current: 5000, max: 10000 } },
    { id: '3', timestamp: new Date(Date.now() - 298000).toISOString(), type: 'order', symbol: 'AAPL', details: { side: 'buy', qty: 100, type: 'market', order_id: 'ORD-001' } },
    { id: '4', timestamp: new Date(Date.now() - 295000).toISOString(), type: 'fill', symbol: 'AAPL', details: { qty: 100, price: 175.25, order_id: 'ORD-001' } },
    { id: '5', timestamp: new Date(Date.now() - 294000).toISOString(), type: 'portfolio', symbol: 'AAPL', details: { action: 'position_opened', qty: 100, avg_cost: 175.25, market_value: 17525 } },
    { id: '6', timestamp: new Date(Date.now() - 60000).toISOString(), type: 'signal', symbol: 'AAPL', details: { action: 'SELL', indicator: 'SMA crossover', price: 178.50 } },
    { id: '7', timestamp: new Date(Date.now() - 59000).toISOString(), type: 'order', symbol: 'AAPL', details: { side: 'sell', qty: 100, type: 'market', order_id: 'ORD-002' } },
    { id: '8', timestamp: new Date(Date.now() - 56000).toISOString(), type: 'fill', symbol: 'AAPL', details: { qty: 100, price: 178.40, order_id: 'ORD-002' } },
    { id: '9', timestamp: new Date(Date.now() - 55000).toISOString(), type: 'portfolio', symbol: 'AAPL', details: { action: 'position_closed', realized_pnl: 315, return_pct: 1.80 } },
    { id: '10', timestamp: new Date(Date.now() - 10000).toISOString(), type: 'signal', symbol: 'MSFT', details: { action: 'BUY', indicator: 'RSI oversold', price: 412.00 } },
    { id: '11', timestamp: new Date(Date.now() - 9500).toISOString(), type: 'risk', symbol: 'MSFT', details: { check: 'max_drawdown', result: 'PASSED', current: 1.2, threshold: 5.0 } },
    { id: '12', timestamp: new Date(Date.now() - 9000).toISOString(), type: 'order', symbol: 'MSFT', details: { side: 'buy', qty: 50, type: 'limit', price: 412.50, order_id: 'ORD-003' } },
];

export function AuditTrail({ onClose }: { onClose: () => void }) {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'signal' | 'order' | 'fill' | 'portfolio' | 'risk'>('ALL');
    const [search, setSearch] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/audit`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setEvents(data);
        } catch {
            setEvents(MOCK_EVENTS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const filtered = events.filter(e =>
        (filter === 'ALL' || e.type === filter) &&
        (!search || e.symbol?.includes(search.toUpperCase()) || JSON.stringify(e.details).toLowerCase().includes(search.toLowerCase()))
    );

    const counts: Record<string, number> = events.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>);

    const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
        fontSize: 9, padding: '2px 7px', background: active ? color + '22' : 'transparent',
        border: `1px solid ${active ? color : BORDER}`, color: active ? color : SUBTLE,
        borderRadius: 2, cursor: 'pointer', fontFamily: MONO,
    });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)' }}>
            <div style={{ width: 780, height: 580, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', fontFamily: MONO, color: TEXT }}>
                {/* Header */}
                <div style={{ padding: '0 16px', height: 42, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>AT</span>
                        <span style={{ color: SUBTLE, fontSize: 10 }}>|</span>
                        <span style={{ fontSize: 10, color: TEXT, letterSpacing: '0.06em' }}>AUDIT TRAIL</span>
                        <span style={{ fontSize: 9, color: SUBTLE }}>â€” Signal â€º Risk â€º Order â€º Fill â€º Portfolio</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={fetchEvents} style={{ ...btnStyle(false, AMBER), padding: '2px 10px' }}>âŸ³ REFRESH</button>
                        <button onClick={onClose} onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 14 }}>âœ•</button>
                    </div>
                </div>

                {/* Filter bar */}
                <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 6, background: PANEL, flexShrink: 0 }}>
                    {(['ALL', 'signal', 'order', 'fill', 'portfolio', 'risk'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={btnStyle(filter === f, typeColor[f] || AMBER)}>
                            {f.toUpperCase()}{f !== 'ALL' && counts[f] ? ` (${counts[f]})` : ''}
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..." style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 2, padding: '2px 8px', fontSize: 9, fontFamily: MONO, width: 100 }} />
                    <span style={{ fontSize: 9, color: SUBTLE }}>{filtered.length} EVT</span>
                </div>

                {/* Main content */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Timeline */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                        {loading && <div style={{ color: SUBTLE, fontSize: 11, textAlign: 'center', padding: 20 }}>LOADING AUDIT LOG...</div>}
                        {!loading && filtered.length === 0 && <div style={{ color: SUBTLE, fontSize: 11, textAlign: 'center', padding: 20 }}>NO EVENTS MATCH FILTER</div>}
                        {!loading && filtered.map((event, idx) => {
                            const color = typeColor[event.type] || SUBTLE;
                            const isSelected = selectedEvent?.id === event.id;
                            return (
                                <div key={event.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10, position: 'relative' }}>
                                    {/* Timeline line */}
                                    {idx < filtered.length - 1 && (
                                        <div style={{ position: 'absolute', left: 77, top: 20, bottom: -10, width: 1, background: BORDER }} />
                                    )}
                                    {/* Time */}
                                    <div style={{ width: 66, flexShrink: 0, textAlign: 'right' }}>
                                        <div style={{ fontSize: 9, color: SUBTLE }}>{formatTime(event.timestamp)}</div>
                                        <div style={{ fontSize: 8, color: BORDER }}>{formatDate(event.timestamp)}</div>
                                    </div>
                                    {/* Dot */}
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: color + '22', border: `2px solid ${color}`, flexShrink: 0, marginTop: 2, position: 'relative', zIndex: 1 }} />
                                    {/* Content */}
                                    <div
                                        onClick={() => setSelectedEvent(isSelected ? null : event)}
                                        onMouseEnter={e => (e.currentTarget.style.background = BG)}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        style={{ flex: 1, cursor: 'pointer', padding: '5px 8px', borderRadius: 3, background: isSelected ? BG : 'transparent', border: `1px solid ${isSelected ? BORDER : 'transparent'}` }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: color + '22', color, fontWeight: 700, letterSpacing: '0.06em' }}>{event.type.toUpperCase()}</span>
                                            {event.symbol && <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{event.symbol}</span>}
                                            <span style={{ fontSize: 9, color: SUBTLE }}>#{event.id}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {Object.entries(event.details).map(([k, v]) => (
                                                <span key={k} style={{ fontSize: 9, padding: '1px 6px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                                                    <span style={{ color: SUBTLE }}>{k}:</span>
                                                    <span style={{ color: TEXT, marginLeft: 3 }}>{typeof v === 'number' && !Number.isInteger(v) ? (v as number).toFixed(2) : String(v)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail panel */}
                    {selectedEvent && (
                        <div style={{ width: 220, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, padding: 14, overflow: 'auto' }}>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>EVENT ID</div>
                                <div style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>#{selectedEvent.id}</div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>TYPE</div>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 2, background: (typeColor[selectedEvent.type] || SUBTLE) + '22', color: typeColor[selectedEvent.type] || SUBTLE }}>{selectedEvent.type.toUpperCase()}</span>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>TIMESTAMP</div>
                                <div style={{ fontSize: 10, fontFamily: MONO, color: TEXT }}>{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                            </div>
                            {selectedEvent.symbol && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>SYMBOL</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: AMBER }}>{selectedEvent.symbol}</div>
                                </div>
                            )}
                            <div>
                                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>DETAILS</div>
                                {Object.entries(selectedEvent.details).map(([k, v]) => (
                                    <div key={k} style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: '0.06em' }}>{k.toUpperCase()}</div>
                                        <div style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{typeof v === 'number' && !Number.isInteger(v) ? (v as number).toFixed(2) : String(v)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '6px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, flexShrink: 0 }}>
                    <span>{filtered.length} of {events.length} EVENTS</span>
                    <span>CLICK EVENT TO EXPAND DETAIL</span>
                </div>
            </div>
        </div>
    );
}
    id: string;
    timestamp: string;
    type: 'signal' | 'order' | 'fill' | 'portfolio' | 'risk';
    symbol?: string;
    details: Record<string, unknown>;
}
