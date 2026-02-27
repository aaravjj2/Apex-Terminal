const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';
import { SupergraphModule } from './SupergraphModule';
import { AIPanel } from './AIPanel';
import { TradeLifecycleDrawer } from './TradeLifecycleDrawer';
import { API_BASE } from '../../../config/api';

interface DailyStats {
  realized_pnl: number; unrealized_pnl: number;
  daily_loss_cap_used: number; daily_loss_cap_remaining: number;
  total_open_risk: number; max_open_risk: number;
  trades_opened: number; trades_closed: number; monitoring_passes: number;
}
interface Position {
  id: string; symbol: string; type: 'equity' | 'option';
  strategy_tag?: string; size: number; entry_time: string;
  current_pnl: number; pnl_percent: number; dte?: number;
  status: 'healthy' | 'near_stop' | 'near_profit' | 'time_stop_soon';
}
interface Order {
  id: string; client_order_id: string; symbol: string;
  side: 'buy' | 'sell'; status: 'pending' | 'partial' | 'filled' | 'rejected';
  qty: number; filled_qty: number; avg_fill_price?: number;
  retry_count: number; run_id?: string;
}
interface EventLogEntry {
  id: string; timestamp: string;
  type: 'monitoring' | 'exit' | 'order' | 'trade_update' | 'provider' | 'error';
  message: string; severity: 'info' | 'warning' | 'error';
  link_type?: 'run' | 'order' | 'position'; link_id?: string;
}
interface RiskCaps {
  max_risk_per_trade: number; max_open_risk: number;
  max_trades_per_day: number; max_daily_loss: number;
}
interface SelectedTrade { id: string; symbol: string; strategy: string; timestamp: number; side: 'entry' | 'exit'; }

const getPositionStatus = (p: { dte?: number; pnl_percent?: number }): Position['status'] => {
  if (p.dte && p.dte <= 1) return 'time_stop_soon';
  if (p.pnl_percent && p.pnl_percent >= 40) return 'near_profit';
  if (p.pnl_percent && p.pnl_percent <= -30) return 'near_stop';
  return 'healthy';
};
const mapEventType = (type: string): EventLogEntry['type'] => {
  if (type?.includes('monitoring')) return 'monitoring';
  if (type?.includes('exit')) return 'exit';
  if (type?.includes('order')) return 'order';
  if (type?.includes('trade')) return 'trade_update';
  if (type?.includes('provider') || type?.includes('outage')) return 'provider';
  return 'error';
};
const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);

const statusColors: Record<string, string> = {
  healthy: GREEN, near_profit: BLUE, near_stop: RED, time_stop_soon: AMBER,
  filled: GREEN, pending: AMBER, partial: BLUE, rejected: RED,
  error: RED, warning: AMBER, info: BLUE,
};

function Badge({ label }: { label: string }) {
  const color = statusColors[label] || SUBTLE;
  return (
    <span style={{ fontSize: 9, padding: '1px 5px', background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 2, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function PanelHeader({ icon, title, count, action }: { icon: string; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '5px 10px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: TEXT, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: MONO }}>{title}</span>
        {count !== undefined && <span style={{ fontSize: 9, color: SUBTLE }}>({count})</span>}
      </div>
      {action}
    </div>
  );
}

export function UnifiedDashboardView() {
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  void setSelectedSymbol;
  const [timeframe, setTimeframe] = useState('1D');
  const [focusMode, setFocusMode] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [riskCaps, setRiskCaps] = useState<RiskCaps | null>(null);
  const [enabledStrategies, setEnabledStrategies] = useState<string[]>([]);
  const [sentimentGatesEnabled, setSentimentGatesEnabled] = useState(false);
  const [autopilotSchedule, setAutopilotSchedule] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const timeframes = ['1D', '5D', '1M', '3M', '1Y'];

  useEffect(() => {
    if (loading) {
      const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50);
      return () => clearInterval(t);
    }
  }, [loading]);

  const fetchDailyStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/autopilot/report`);
      if (res.ok) {
        const data = await res.json(); const r = data.report || {};
        setDailyStats({ realized_pnl: r.realized_pnl || 0, unrealized_pnl: r.unrealized_pnl || 0, daily_loss_cap_used: r.daily_loss_used || 0, daily_loss_cap_remaining: r.daily_loss_remaining || 100, total_open_risk: r.total_open_risk || 0, max_open_risk: r.max_open_risk || 500, trades_opened: r.trades_opened || 0, trades_closed: r.trades_closed || 0, monitoring_passes: r.monitoring_passes || 0 });
      }
    } catch (err) { console.error('Failed to fetch daily stats:', err); }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/autopilot/positions?status=open`);
      if (res.ok) {
        const data = await res.json();
        setPositions((data.positions || []).slice(0, 10).map((p: any) => ({ id: p.position_id, symbol: p.symbol, type: p.legs?.length > 0 ? 'option' : 'equity', strategy_tag: p.template || 'manual', size: p.quantity, entry_time: p.entry_time, current_pnl: p.unrealized_pnl || 0, pnl_percent: p.pnl_percent || 0, dte: p.dte, status: getPositionStatus(p) })));
      }
    } catch (err) { console.error('Failed to fetch positions:', err); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/orders?status=open`);
      if (res.ok) {
        const data = await res.json();
        setOrders((data.orders || []).slice(0, 10).map((o: any) => ({ id: o.id, client_order_id: o.client_order_id, symbol: o.symbol, side: o.side, status: o.status, qty: o.qty, filled_qty: o.filled_qty || 0, avg_fill_price: o.avg_fill_price, retry_count: o.retry_count || 0, run_id: o.run_id })));
      }
    } catch (err) { console.error('Failed to fetch orders:', err); }
  }, []);

  const fetchEventLog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/autopilot/logs?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setEventLog((data.logs || []).map((l: any, idx: number) => ({ id: `event-${idx}`, timestamp: l.timestamp, type: mapEventType(l.event_type), message: l.message || l.event_type, severity: l.level === 'error' ? 'error' : l.level === 'warning' ? 'warning' : 'info', link_type: l.run_id ? 'run' : l.order_id ? 'order' : undefined, link_id: l.run_id || l.order_id })));
      }
    } catch (err) { console.error('Failed to fetch event log:', err); }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/autopilot/config`);
      if (res.ok) {
        const data = await res.json(); const config = data.config || {};
        setRiskCaps({ max_risk_per_trade: config.risk_limits?.max_risk_per_trade || 50, max_open_risk: config.risk_limits?.max_total_risk || 500, max_trades_per_day: config.risk_limits?.max_open_positions || 10, max_daily_loss: config.risk_limits?.max_daily_loss || 100 });
        setEnabledStrategies(config.strategy_constraints?.allowed_templates || []);
        setSentimentGatesEnabled(config.forecast_settings?.enabled || false);
        setAutopilotSchedule(`Every ${config.schedule?.interval_minutes || 15}min (market hours)`);
      }
    } catch (err) { console.error('Failed to fetch config:', err); }
  }, []);

  const runAutopilotNow = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/v1/autopilot/cycle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: false, force: false }) });
      await Promise.all([fetchDailyStats(), fetchPositions(), fetchOrders(), fetchEventLog()]);
    } catch (err) { console.error('Failed to run autopilot:', err); }
    setLoading(false);
  };

  const runMonitoringNow = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/v1/autopilot/cycle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
      await Promise.all([fetchDailyStats(), fetchPositions(), fetchEventLog()]);
    } catch (err) { console.error('Failed to run monitoring:', err); }
    setLoading(false);
  };

  useEffect(() => {
    fetchDailyStats(); fetchPositions(); fetchOrders(); fetchEventLog(); fetchConfig();
  }, [fetchDailyStats, fetchPositions, fetchOrders, fetchEventLog, fetchConfig]);

  useEffect(() => {
    const interval = setInterval(() => { fetchDailyStats(); fetchPositions(); fetchOrders(); fetchEventLog(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchDailyStats, fetchPositions, fetchOrders, fetchEventLog]);

  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', border: 'none', borderRadius: 2, fontFamily: MONO, textTransform: 'uppercase', transition: 'background 0.1s' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO, overflow: 'hidden' }} data-testid="unified-dashboard">

      {/* B1: Header Strip */}
      <div style={{ height: 44, padding: '0 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }} data-testid="symbol-selector">SPY</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BG, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 3px' }} data-testid="timeframe-selector">
            {timeframes.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                style={{ ...btnBase, padding: '2px 7px', background: timeframe === tf ? AMBER : 'none', color: timeframe === tf ? '#000' : SUBTLE, border: 'none', borderRadius: 1 }}>
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-risk-desk', { detail: { loadDemo: true } }))}
            style={{ ...btnBase, background: GREEN, color: '#000' }}
            data-testid="start-risk-desk-demo-btn"
          >
             Start Risk Desk Demo
          </button>
          <button onClick={runAutopilotNow} disabled={loading} style={{ ...btnBase, background: AMBER, color: '#000', opacity: loading ? 0.5 : 1 }} data-testid="run-autopilot-btn">
             Run Autopilot Now
          </button>
          <button onClick={runMonitoringNow} disabled={loading} style={{ ...btnBase, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, opacity: loading ? 0.5 : 1 }} data-testid="run-monitoring-btn">
            <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span> Run Monitoring
          </button>
          <button style={{ ...btnBase, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT }} data-testid="explain-action-btn">
             Explain Last Action
          </button>
          <button onClick={() => setFocusMode(!focusMode)}
            style={{ ...btnBase, background: focusMode ? AMBER : PANEL, color: focusMode ? '#000' : SUBTLE, border: `1px solid ${BORDER}`, padding: '4px 8px' }}
            data-testid="focus-mode-toggle">
            {focusMode ? '' : ''}
          </button>
        </div>
      </div>

      {/* B2: Main Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: focusMode ? 'column' : 'row' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: focusMode ? 'none' : `1px solid ${BORDER}` }}>
          <SupergraphModule symbol={selectedSymbol} timeframe={timeframe} onTradeClick={(t: SelectedTrade) => { setSelectedTrade(t); setDrawerOpen(true); }} />
        </div>
        {!focusMode && (
          <div style={{ width: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <AIPanel symbol={selectedSymbol} />
          </div>
        )}
      </div>

      {/* E: Today Operational Strip */}
      <div style={{ height: 44, padding: '0 14px', borderTop: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }} data-testid="today-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {[
            { label: 'Realized P&L', value: dailyStats ? `${dailyStats.realized_pnl >= 0 ? '+' : ''}${fmt(dailyStats.realized_pnl)}` : '--', color: (dailyStats?.realized_pnl || 0) >= 0 ? GREEN : RED },
            { label: 'Unrealized P&L', value: dailyStats ? `${dailyStats.unrealized_pnl >= 0 ? '+' : ''}${fmt(dailyStats.unrealized_pnl)}` : '--', color: (dailyStats?.unrealized_pnl || 0) >= 0 ? GREEN : RED },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: stat.color, fontFamily: MONO }}>{stat.value}</span>
            </div>
          ))}
          <div style={{ width: 1, height: 20, background: BORDER }} />
          {[
            { label: 'Daily Loss Cap', used: dailyStats?.daily_loss_cap_used || 0, total: (dailyStats?.daily_loss_cap_used || 0) + (dailyStats?.daily_loss_cap_remaining || 100), color: RED },
            { label: 'Open Risk', used: dailyStats?.total_open_risk || 0, total: dailyStats?.max_open_risk || 500, color: AMBER },
          ].map(bar => (
            <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: SUBTLE, textTransform: 'uppercase' }}>{bar.label}</span>
              <div style={{ width: 72, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(bar.used / bar.total) * 100}%`, background: bar.color, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>${bar.used}/${bar.total}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[
            { icon: '', label: 'Opened', value: dailyStats?.trades_opened || 0, color: GREEN },
            { icon: '', label: 'Closed', value: dailyStats?.trades_closed || 0, color: RED },
            { icon: '', label: 'Passes', value: dailyStats?.monitoring_passes || 0, color: BLUE },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: item.color, fontSize: 11 }}>{item.icon}</span>
              <span style={{ fontSize: 9, color: SUBTLE }}>{item.label}:</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div style={{ height: 180, borderTop: `1px solid ${BORDER}`, display: 'flex', flexShrink: 0, overflow: 'hidden' }}>
        {/* F: Positions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER}` }}>
          <PanelHeader icon="" title="Positions" count={positions.length} action={<button style={{ fontSize: 9, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}>VIEW ALL </button>} />
          <div style={{ flex: 1, overflowY: 'auto' }} data-testid="positions-widget">
            {positions.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: SUBTLE }}>No open positions</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead style={{ position: 'sticky', top: 0, background: PANEL }}>
                  <tr style={{ color: SUBTLE }}>
                    {['Symbol', 'Type', 'Size', 'P&L', 'DTE', 'Status'].map(h => (
                      <th key={h} style={{ padding: '3px 6px', textAlign: h === 'Symbol' || h === 'Type' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => (
                    <tr key={pos.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700, color: TEXT }}>{pos.symbol}</td>
                      <td style={{ padding: '3px 6px', color: SUBTLE }}>{pos.type}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: TEXT, fontFamily: MONO }}>{pos.size}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: MONO, color: pos.current_pnl >= 0 ? GREEN : RED }}>{fmt(pos.current_pnl)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: SUBTLE, fontFamily: MONO }}>{pos.dte ?? '-'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}><Badge label={pos.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* G: Orders */}
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER}` }}>
          <PanelHeader icon="" title="Orders" count={orders.length} action={<button style={{ fontSize: 9, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}>VIEW ALL </button>} />
          <div style={{ flex: 1, overflowY: 'auto' }} data-testid="orders-widget">
            {orders.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: SUBTLE }}>No pending orders</div>
            ) : (
              <div>
                {orders.map(order => (
                  <div key={order.id} style={{ padding: '5px 8px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{order.symbol}</span>
                      <Badge label={order.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginTop: 2 }}>
                      <span>{order.side.toUpperCase()} {order.filled_qty}/{order.qty}</span>
                      {order.avg_fill_price && <span>${order.avg_fill_price.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* H: Event Log */}
        <div style={{ width: 290, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BORDER}` }}>
          <PanelHeader icon="" title="Event Log" />
          <div style={{ flex: 1, overflowY: 'auto' }} data-testid="event-log">
            {eventLog.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: SUBTLE }}>No events</div>
            ) : (
              <div>
                {eventLog.map(event => (
                  <div key={event.id} style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColors[event.severity] || SUBTLE, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.message}</div>
                      <div style={{ fontSize: 9, color: SUBTLE }}>{new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* I: Settings Mini */}
        <div style={{ width: 210, display: 'flex', flexDirection: 'column' }}>
          <PanelHeader icon="" title="Risk Caps" />
          <div style={{ flex: 1, padding: '6px 8px', overflowY: 'auto' }} data-testid="settings-mini">
            {[
              { label: 'Max Risk/Trade', value: riskCaps ? `$${riskCaps.max_risk_per_trade}` : '--' },
              { label: 'Max Open Risk', value: riskCaps ? `$${riskCaps.max_open_risk}` : '--' },
              { label: 'Max Trades/Day', value: riskCaps ? String(riskCaps.max_trades_per_day) : '--' },
              { label: 'Max Daily Loss', value: riskCaps ? `$${riskCaps.max_daily_loss}` : '--' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: SUBTLE }}>{item.label}</span>
                <span style={{ color: TEXT, fontFamily: MONO }}>{item.value}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: SUBTLE }}>Strategies</span>
                <span style={{ color: TEXT, fontFamily: MONO }}>{enabledStrategies.length} enabled</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: SUBTLE }}>Sentiment Gates</span>
                <span style={{ color: sentimentGatesEnabled ? GREEN : SUBTLE, fontFamily: MONO }}>{sentimentGatesEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                <span style={{ color: SUBTLE }}>Schedule</span>
                <span style={{ color: TEXT, fontFamily: MONO, fontSize: 9 }}>{autopilotSchedule || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && selectedTrade && (
        <TradeLifecycleDrawer trade={selectedTrade} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
}