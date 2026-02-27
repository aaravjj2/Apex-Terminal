const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';
import { useAutopilotStore } from '../../autopilot/store';
import { API_BASE } from '../../../config/api';

interface Position { id: string; symbol: string; quantity: number; avg_cost: number; current_price: number; market_value: number; unrealized_pnl: number; unrealized_pnl_pct: number; side: string; asset_class: string; dte?: number; managed: boolean; }
interface Order { id: string; symbol: string; side: string; qty: number; type: string; status: string; filled_qty: number; limit_price?: number; created_at: string; }
interface Stats { total_equity: number; total_cash: number; buying_power: number; open_pnl: number; day_pnl: number; position_count: number; order_count: number; }

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const TAB_IDS = ['overview', 'positions', 'orders', 'autopilot'] as const;
type TabId = typeof TAB_IDS[number];
const TAB_LABELS: Record<TabId, string> = { overview: ' OVERVIEW', positions: ' POSITIONS', orders: ' ORDERS', autopilot: ' AUTOPILOT' };

const StatusPill: React.FC<{ label: string; color?: string }> = ({ label, color = SUBTLE }) => (
    <span style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700, padding: '2px 6px', borderRadius: 2, color, border: `1px solid ${color}44`, background: `${color}18`, letterSpacing: '0.05em' }}>
        {label}
    </span>
);

const Tbl: React.FC<{ headers: { label: string; align?: string }[]; children: React.ReactNode }> = ({ headers, children }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
        <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
                {headers.map(h => (
                    <th key={h.label} style={{ padding: '7px 12px', textAlign: (h.align || 'left') as any, fontSize: 9, color: SUBTLE, letterSpacing: '0.08em', fontWeight: 600 }}>{h.label}</th>
                ))}
            </tr>
        </thead>
        <tbody>{children}</tbody>
    </table>
);

const TR: React.FC<{ cols: React.ReactNode[]; aligns?: string[] }> = ({ cols, aligns = [] }) => {
    const [hov, setHov] = useState(false);
    return (
        <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ borderBottom: `1px solid ${BORDER}`, background: hov ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
            {cols.map((c, i) => <td key={i} style={{ padding: '7px 12px', textAlign: (aligns[i] || 'left') as any, color: TEXT }}>{c}</td>)}
        </tr>
    );
};

export function CommandCenterView() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tab, setTab] = useState<TabId>('overview');

    const { status: autopilotStatus, fetchStatus, triggerRun, activateKillSwitch } = useAutopilotStore();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/portfolio/unified`);
            if (res.ok) {
                const data = await res.json();
                setPositions(data.positions || []);
                setOrders(data.orders || []);
                setStats(data.stats || null);
                setLastUpdated(new Date());
            }
        } catch (e) { console.error('Failed to fetch data:', e); }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData(); fetchStatus();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData, fetchStatus]);

    const handleRunAutopilot = async () => { await triggerRun(true); await fetchData(); };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }} data-testid="command-center">
            {/* Header Strip */}
            <div style={{ height: 50, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: AMBER, letterSpacing: '0.05em' }}>COMMAND CENTER</span>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: MONO }}>
                        <span style={{ color: SUBTLE }}>Equity: <span style={{ color: AMBER, fontWeight: 700 }}>{stats ? fmt$(stats.total_equity) : ''}</span></span>
                        <span style={{ color: (stats?.open_pnl ?? 0) >= 0 ? GREEN : RED }}>P&L: {stats ? fmt$(stats.open_pnl) : ''}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusPill label={autopilotStatus?.state?.toUpperCase() || 'IDLE'} color={autopilotStatus?.state === 'running' ? GREEN : SUBTLE} />
                    {autopilotStatus?.kill_switch && <StatusPill label="KILL SWITCH" color={RED} />}
                    <button onClick={handleRunAutopilot} disabled={loading || autopilotStatus?.kill_switch}
                        style={{ padding: '5px 12px', fontSize: 10, fontFamily: MONO, fontWeight: 700, color: BG, background: BLUE, border: 'none', borderRadius: 3, cursor: 'pointer', opacity: (loading || autopilotStatus?.kill_switch) ? 0.5 : 1 }}>
                        RUN CYCLE
                    </button>
                    <button onClick={fetchData} disabled={loading}
                        style={{ padding: '5px 8px', fontSize: 13, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, color: SUBTLE, cursor: 'pointer' }}>
                        
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                {TAB_IDS.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        style={{ padding: '9px 16px', fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: '0.07em', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : SUBTLE, transition: 'color 0.1s', marginBottom: -1 }}>
                        {TAB_LABELS[t]} {t === 'positions' ? `(${positions.length})` : t === 'orders' ? `(${orders.length})` : ''}
                    </button>
                ))}
                {lastUpdated && (
                    <span style={{ marginLeft: 'auto', marginRight: 14, fontSize: 9, color: SUBTLE, fontFamily: MONO }}>
                        Updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {/* Overview */}
                {tab === 'overview' && (
                    <div style={{ padding: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                            {[
                                { label: 'TOTAL EQUITY', value: fmt$(stats?.total_equity ?? 0), color: AMBER },
                                { label: 'CASH', value: fmt$(stats?.total_cash ?? 0), color: TEXT },
                                { label: 'OPEN P&L', value: fmt$(stats?.open_pnl ?? 0), color: (stats?.open_pnl ?? 0) >= 0 ? GREEN : RED },
                                { label: 'BUYING POWER', value: fmt$(stats?.buying_power ?? 0), color: BLUE },
                            ].map(c => (
                                <div key={c.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: '10px 14px', background: PANEL }}>
                                    <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.09em', marginBottom: 6 }}>{c.label}</div>
                                    <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: c.color }}>{c.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, overflow: 'hidden', background: PANEL }}>
                            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.09em' }}>RECENT POSITIONS</div>
                            {positions.length === 0 ? (
                                <p style={{ padding: 24, textAlign: 'center', fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No positions</p>
                            ) : (
                                <Tbl headers={[{ label: 'SYMBOL' }, { label: 'QTY', align: 'right' }, { label: 'VALUE', align: 'right' }, { label: 'P&L', align: 'right' }]}>
                                    {positions.slice(0, 5).map(p => (
                                        <TR key={p.id} aligns={['left','right','right','right']} cols={[
                                            <span style={{ fontWeight: 700 }}>{p.symbol}</span>,
                                            p.quantity,
                                            fmt$(p.market_value),
                                            <span style={{ color: p.unrealized_pnl >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmt$(p.unrealized_pnl)}</span>,
                                        ]} />
                                    ))}
                                </Tbl>
                            )}
                        </div>
                    </div>
                )}

                {/* Positions */}
                {tab === 'positions' && (
                    positions.length === 0 ? (
                        <p style={{ padding: 32, textAlign: 'center', fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No positions found</p>
                    ) : (
                        <Tbl headers={[{ label: 'SYMBOL' }, { label: 'TYPE' }, { label: 'QTY', align: 'right' }, { label: 'AVG COST', align: 'right' }, { label: 'CURRENT', align: 'right' }, { label: 'VALUE', align: 'right' }, { label: 'P&L', align: 'right' }, { label: 'DTE', align: 'right' }]}>
                            {positions.map(p => (
                                <TR key={p.id} aligns={['left','left','right','right','right','right','right','right']} cols={[
                                    <span style={{ fontWeight: 700 }}>{p.symbol}</span>,
                                    <span style={{ fontSize: 9, fontFamily: MONO, color: p.asset_class === 'option' ? BLUE : SUBTLE, textTransform: 'uppercase' }}>{p.asset_class}</span>,
                                    p.quantity,
                                    fmt$(p.avg_cost),
                                    fmt$(p.current_price),
                                    fmt$(p.market_value),
                                    <span style={{ color: p.unrealized_pnl >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmt$(p.unrealized_pnl)} ({fmtPct(p.unrealized_pnl_pct)})</span>,
                                    p.dte ?? '',
                                ]} />
                            ))}
                        </Tbl>
                    )
                )}

                {/* Orders */}
                {tab === 'orders' && (
                    orders.length === 0 ? (
                        <p style={{ padding: 32, textAlign: 'center', fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No orders found</p>
                    ) : (
                        <Tbl headers={[{ label: 'TIME' }, { label: 'SYMBOL' }, { label: 'SIDE' }, { label: 'QTY', align: 'right' }, { label: 'FILLED', align: 'right' }, { label: 'PRICE', align: 'right' }, { label: 'STATUS' }]}>
                            {orders.map(o => {
                                const sColor = o.status === 'filled' ? GREEN : o.status === 'pending' ? AMBER : o.status === 'rejected' ? RED : SUBTLE;
                                return (
                                    <TR key={o.id} aligns={['left','left','left','right','right','right','left']} cols={[
                                        new Date(o.created_at).toLocaleTimeString(),
                                        <span style={{ fontWeight: 700 }}>{o.symbol}</span>,
                                        <span style={{ color: o.side === 'buy' ? GREEN : RED, fontWeight: 700, textTransform: 'uppercase' }}>{o.side}</span>,
                                        o.qty,
                                        o.filled_qty,
                                        o.limit_price ? fmt$(o.limit_price) : '',
                                        <span style={{ fontSize: 9, fontFamily: MONO, color: sColor, textTransform: 'uppercase', fontWeight: 700 }}>{o.status}</span>,
                                    ]} />
                                );
                            })}
                        </Tbl>
                    )
                )}

                {/* Autopilot */}
                {tab === 'autopilot' && (
                    <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: 14, background: PANEL }}>
                            <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.09em', marginBottom: 10 }}>AUTOPILOT STATUS</div>
                            {[
                                { label: 'State', value: autopilotStatus?.state || 'idle', color: autopilotStatus?.state === 'running' ? GREEN : SUBTLE },
                                { label: 'Mode', value: autopilotStatus?.mode || 'paper', color: TEXT },
                                { label: 'Cycles Completed', value: `${autopilotStatus?.cycles_completed || 0}`, color: TEXT },
                                { label: 'Win Rate', value: fmtPct(autopilotStatus?.win_rate ?? 0), color: TEXT },
                            ].map(r => (
                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
                                    <span style={{ fontSize: 11, fontFamily: MONO, color: SUBTLE }}>{r.label}</span>
                                    <span style={{ fontSize: 11, fontFamily: MONO, color: r.color, textTransform: 'uppercase', fontWeight: 700 }}>{r.value}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: 14, background: PANEL }}>
                            <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.09em', marginBottom: 10 }}>CONTROLS</div>
                            <button onClick={handleRunAutopilot} disabled={!!autopilotStatus?.kill_switch}
                                style={{ width: '100%', padding: '10px', marginBottom: 8, fontSize: 11, fontFamily: MONO, fontWeight: 700, color: BG, background: BLUE, border: 'none', borderRadius: 3, cursor: 'pointer', opacity: autopilotStatus?.kill_switch ? 0.5 : 1, letterSpacing: '0.07em' }}>
                                 RUN CYCLE NOW
                            </button>
                            <button onClick={() => activateKillSwitch(true)}
                                style={{ width: '100%', padding: '10px', fontSize: 11, fontFamily: MONO, fontWeight: 700, color: '#fff', background: RED, border: 'none', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.07em' }}>
                                 ACTIVATE KILL SWITCH
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}