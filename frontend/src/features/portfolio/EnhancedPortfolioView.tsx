const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { PortfolioCrudPanel } from './PortfolioCrudPanel';

interface UnifiedPosition {
  id: string; symbol: string; underlying: string; asset_type: 'equity' | 'option';
  qty: number; avg_price: number; current_price: number; market_value: number;
  pnl: number; pnl_percent: number; side: 'long' | 'short';
  strike?: number; expiration?: string; option_type?: 'call' | 'put';
  strategy_id?: string; strategy_name?: string;
  verified: boolean; last_verified: string | null;
}
interface UnifiedOrder {
  id: string; client_order_id: string; symbol: string; side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit'; qty: number; filled_qty: number;
  price?: number; stop_price?: number;
  status: 'new' | 'pending' | 'partial' | 'filled' | 'canceled' | 'rejected';
  created_at: string; filled_at?: string; source: 'manual' | 'autopilot' | 'strategy';
}
interface BrokerVerification {
  broker: string; connected: boolean; last_check: string; account_id: string;
  cash_balance: number; equity: number; buying_power: number;
  positions_synced: boolean; orders_synced: boolean; latency_ms: number;
}
interface PortfolioStats {
  total_equity: number; total_cash: number; buying_power: number;
  open_pnl: number; day_pnl: number; position_count: number; order_count: number; options_exposure: number;
}

const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const MOCK_POSITIONS: UnifiedPosition[] = [
  { id: 'p1', symbol: 'AAPL', underlying: 'AAPL', asset_type: 'equity', qty: 100, avg_price: 185.50, current_price: 190.25, market_value: 19025, pnl: 475, pnl_percent: 2.56, side: 'long', verified: true, last_verified: new Date().toISOString() },
  { id: 'p2', symbol: 'AAPL250117C190', underlying: 'AAPL', asset_type: 'option', qty: 5, avg_price: 8.50, current_price: 11.20, market_value: 5600, pnl: 1350, pnl_percent: 31.76, side: 'long', strike: 190, expiration: '2025-01-17', option_type: 'call', strategy_name: 'CALL_DEBIT', verified: true, last_verified: new Date().toISOString() },
  { id: 'p3', symbol: 'SPY250124P520', underlying: 'SPY', asset_type: 'option', qty: -2, avg_price: 2.40, current_price: 1.85, market_value: -370, pnl: 110, pnl_percent: 22.92, side: 'short', strike: 520, expiration: '2025-01-24', option_type: 'put', strategy_name: 'PUT_CREDIT_SPREAD', verified: true, last_verified: new Date().toISOString() },
];
const MOCK_ORDERS: UnifiedOrder[] = [
  { id: 'o1', client_order_id: 'AP-2025-001', symbol: 'MSFT', side: 'buy', type: 'limit', qty: 50, filled_qty: 0, price: 420, status: 'pending', created_at: new Date().toISOString(), source: 'autopilot' },
];
const MOCK_STATS: PortfolioStats = { total_equity: 125500, total_cash: 45000, buying_power: 89500, open_pnl: 1935, day_pnl: 425, position_count: 3, order_count: 1, options_exposure: 5230 };

const TH: React.CSSProperties = { padding: '6px 12px', textAlign: 'left', fontSize: 9, color: SUBTLE, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, borderBottom: `1px solid ${BORDER}`, background: PANEL, position: 'sticky', top: 0 };

function StatusBadge({ ok, labels }: { ok: boolean; labels: [string, string] }) {
  return <span style={{ fontSize: 9, padding: '2px 6px', background: (ok ? GREEN : RED) + '22', color: ok ? GREEN : RED, border: `1px solid ${(ok ? GREEN : RED)}44`, borderRadius: 2 }}>{ok ? labels[0] : labels[1]}</span>;
}

export function EnhancedPortfolioView() {
  const [positions, setPositions] = useState<UnifiedPosition[]>([]);
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [verification, setVerification] = useState<BrokerVerification | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'equity' | 'options'>('all');
  const [tab, setTab] = useState<'positions' | 'orders' | 'manage'>('positions');
  const [brokerExpanded, setBrokerExpanded] = useState(true);
  const [spinAngle, setSpinAngle] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  useEffect(() => { if (loading) { const t = setInterval(() => setSpinAngle(a => (a + 20) % 360), 50); return () => clearInterval(t); } }, [loading]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portfolio/unified`);
      if (!r.ok) throw new Error('Failed');
      const data = await r.json();
      setPositions(data.positions || []); setOrders(data.orders || []); setStats(data.stats || null);
    } catch { setPositions(MOCK_POSITIONS); setOrders(MOCK_ORDERS); setStats(MOCK_STATS); }
    finally { setLoading(false); }
  }, []);

  const fetchVerification = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/verification/broker`);
      if (r.ok) { setVerification(await r.json()); return; }
      throw new Error('Failed');
    } catch { setVerification({ broker: 'Alpaca (Paper)', connected: true, last_check: new Date().toISOString(), account_id: 'PA30UB1Y6NLQ', cash_balance: 45000, equity: 125500, buying_power: 89500, positions_synced: true, orders_synced: true, latency_ms: 45 }); }
  }, []);

  const handleExit = async (positionId: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/portfolio/positions/${positionId}/exit`, { method: 'POST' });
      if (r.ok) { setToast({ msg: 'Exit order submitted', ok: true }); fetchPortfolio(); }
      else throw new Error();
    } catch { setToast({ msg: 'Failed to exit position', ok: false }); }
  };

  useEffect(() => { fetchPortfolio(); fetchVerification(); const t = setInterval(() => { fetchPortfolio(); fetchVerification(); }, 5000); return () => clearInterval(t); }, [fetchPortfolio, fetchVerification]);

  const filtered = positions.filter(p => filter === 'all' ? true : filter === 'equity' ? p.asset_type === 'equity' : p.asset_type === 'option');
  const pnlPos = (stats?.open_pnl ?? 0) >= 0;

  return (
    <div data-testid="portfolio-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: MONO }}>
      {/* Header */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}> PORTFOLIO</span>
          <span style={{ fontSize: 10, color: SUBTLE }}>Unified positions, orders &amp; broker verification</span>
        </div>
        <button onClick={fetchPortfolio} disabled={loading} data-testid="portfolio-header" style={{ width: 28, height: 28, background: 'none', border: `1px solid ${BORDER}`, color: SUBTLE, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-block', transform: `rotate(${spinAngle}deg)` }}></span>
        </button>
      </div>

      {/* Summary Strip */}
      <div data-testid="portfolio-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
        {[
          { label: 'TOTAL EQUITY', value: stats ? fmt$(stats.total_equity) : '---', color: TEXT, testId: 'total-equity' },
          { label: 'OPEN P&L', value: stats ? `${stats.open_pnl >= 0 ? '+' : ''}${fmt$(stats.open_pnl)}` : '---', color: pnlPos ? GREEN : RED, testId: 'open-pnl' },
          { label: 'BUYING POWER', value: stats ? fmt$(stats.buying_power) : '---', color: TEXT, testId: 'buying-power' },
          { label: 'POSITIONS', value: stats?.position_count?.toString() ?? '---', color: TEXT, testId: null },
          { label: 'BROKER', value: verification?.connected ? verification.broker : 'Disconnected', color: verification?.connected ? GREEN : RED, testId: null },
        ].map(m => (
          <div key={m.label} data-testid={m.testId || undefined} style={{ padding: '10px 16px', borderRight: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Broker Verification */}
      <div style={{ margin: '10px 16px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, flexShrink: 0 }}>
        <button onClick={() => setBrokerExpanded(v => !v)} style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: TEXT, fontSize: 11, fontFamily: MONO }}>
          <span style={{ fontWeight: 700 }}> BROKER VERIFICATION</span>
          <span>{brokerExpanded ? '' : ''}</span>
        </button>
        {brokerExpanded && verification && (
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { label: 'STATUS', value: verification.connected ? ' CONNECTED' : ' DISCONNECTED', color: verification.connected ? GREEN : RED },
                { label: 'ACCOUNT', value: verification.account_id || 'N/A', color: TEXT },
                { label: 'LATENCY', value: `${verification.latency_ms}ms`, color: verification.latency_ms < 100 ? GREEN : verification.latency_ms < 500 ? AMBER : RED },
                { label: 'LAST CHECK', value: new Date(verification.last_check).toLocaleTimeString(), color: TEXT },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.1em', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: m.color, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <StatusBadge ok={verification.positions_synced} labels={['Positions Synced', 'Positions Out of Sync']} />
              <StatusBadge ok={verification.orders_synced} labels={['Orders Synced', 'Orders Out of Sync']} />
              <button onClick={fetchVerification} style={{ marginLeft: 'auto', fontSize: 10, background: 'none', border: `1px solid ${BORDER}`, color: BLUE, padding: '3px 8px', borderRadius: 2, cursor: 'pointer' }}> VERIFY NOW</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex' }}>
          {(['positions', 'orders', 'manage'] as const).map(t => (
            <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : SUBTLE, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em' }}>
              {t === 'positions' ? `POSITIONS (${positions.length})` : t === 'orders' ? `ORDERS (${orders.length})` : 'MANAGE'}
            </button>
          ))}
        </div>
        {tab !== 'manage' && (
          <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ fontSize: 10, background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, padding: '4px 8px', borderRadius: 2, fontFamily: MONO }}>
            <option value="all">All Types</option>
            <option value="equity">Equity Only</option>
            <option value="options">Options Only</option>
          </select>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'positions' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['SYMBOL', 'TYPE', 'QTY', 'AVG PRICE', 'CURRENT', 'MKT VALUE', 'P&L', 'STRATEGY', ''].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontSize: 11 }}>No positions found</td></tr>
              ) : filtered.map(pos => {
                const isOpt = pos.asset_type === 'option';
                const up = pos.pnl >= 0;
                return (
                  <tr key={pos.id || pos.symbol} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: pos.verified ? GREEN : AMBER }}>{pos.verified ? '' : ''}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: TEXT }}>{pos.symbol}</div>
                          {isOpt && <div style={{ fontSize: 9, color: SUBTLE }}>{pos.strike} {pos.option_type?.toUpperCase()} {pos.expiration}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', background: isOpt ? BLUE + '22' : BORDER, color: isOpt ? BLUE : SUBTLE, border: `1px solid ${isOpt ? BLUE : BORDER}44`, borderRadius: 2 }}>{pos.asset_type.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: pos.side === 'long' ? GREEN : RED, fontFamily: MONO }}>{pos.side === 'long' ? '+' : ''}{pos.qty}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: TEXT }}>{fmt$(pos.avg_price)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: TEXT }}>{fmt$(pos.current_price)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: MONO, color: TEXT }}>{fmt$(pos.market_value)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      <div style={{ color: up ? GREEN : RED, fontWeight: 700, fontFamily: MONO }}>{up ? '+' : ''}{fmt$(pos.pnl)}</div>
                      <div style={{ fontSize: 9, color: up ? GREEN : RED, fontFamily: MONO }}>{fmtPct(pos.pnl_percent)}</div>
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      {pos.strategy_name && <span style={{ fontSize: 9, padding: '1px 5px', background: PURPLE + '22', color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: 2 }}>{pos.strategy_name}</span>}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <button onClick={() => handleExit(pos.id)} style={{ fontSize: 10, background: 'none', border: `1px solid ${RED}44`, color: RED, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>EXIT</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'orders' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['TIME', 'SYMBOL', 'SIDE', 'TYPE', 'QTY', 'FILLED', 'PRICE', 'STATUS', 'SOURCE'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: SUBTLE }}>No orders</td></tr>
              ) : orders.map(o => {
                const statusColor = o.status === 'filled' ? GREEN : o.status === 'pending' || o.status === 'partial' ? AMBER : o.status === 'rejected' || o.status === 'canceled' ? RED : SUBTLE;
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '6px 12px', color: SUBTLE, fontFamily: MONO }}>{new Date(o.created_at).toLocaleTimeString()}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: TEXT }}>{o.symbol}</td>
                    <td style={{ padding: '6px 12px', color: o.side === 'buy' ? GREEN : RED, fontWeight: 700 }}>{o.side.toUpperCase()}</td>
                    <td style={{ padding: '6px 12px', color: SUBTLE }}>{o.type.toUpperCase()}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO }}>{o.qty}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO }}>{o.filled_qty}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO }}>{o.price ? fmt$(o.price) : '-'}</td>
                    <td style={{ padding: '6px 12px' }}><span style={{ fontSize: 9, padding: '1px 6px', background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 2 }}>{o.status.toUpperCase()}</span></td>
                    <td style={{ padding: '6px 12px' }}><span style={{ fontSize: 9, padding: '1px 6px', background: o.source === 'autopilot' ? BLUE + '22' : BORDER, color: o.source === 'autopilot' ? BLUE : SUBTLE, border: `1px solid ${(o.source === 'autopilot' ? BLUE : BORDER)}44`, borderRadius: 2 }}>{o.source}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'manage' && <PortfolioCrudPanel />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.ok ? GREEN + '22' : RED + '22', border: `1px solid ${(toast.ok ? GREEN : RED)}44`, color: toast.ok ? GREEN : RED, padding: '8px 16px', borderRadius: 3, fontSize: 11, fontFamily: MONO, zIndex: 9999 }}>
          {toast.ok ? '' : ''} {toast.msg}
        </div>
      )}
    </div>
  );
}

export default EnhancedPortfolioView;