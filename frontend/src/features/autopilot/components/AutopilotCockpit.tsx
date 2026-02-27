const BG='#0a0a0a'; const PANEL='#111111'; const BORDER='#1e1e1e';
const AMBER='#f5a623'; const GREEN='#26a69a'; const RED='#ef5350';
const BLUE='#42a5f5'; const PURPLE='#ab47bc'; const SUBTLE='#555';
const TEXT='#d1d4dc'; const MONO='"Roboto Mono","Courier New",monospace';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  opsApi,
  type OpsHealthCheck,
  type OpsHealthResponse,
  type OpsLastCycle,
  type OpsOrder,
  type OpsPosition,
  type OpsRunSummary,
  type OpsUniverseSymbol,
} from '../ops-api';

//  Helpers 

const fmt$ = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
};
const fmtPct = (v: number | string | null | undefined, multiply = false) => {
  if (v == null || v === '') return '';
  const n = Number(v) * (multiply ? 100 : 1);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};
const fmtMs = (ms: number | null | undefined) => {
  if (ms == null) return '';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};
const fmtAge = (iso: string | null | undefined) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
};
const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const regimeColor = (regime: string | null | undefined) => {
  switch ((regime ?? '').toLowerCase()) {
    case 'bull': return GREEN;
    case 'bear': return RED;
    case 'volatile': return AMBER;
    case 'chaos': return '#ff1744';
    case 'neutral': return BLUE;
    default: return SUBTLE;
  }
};
const regimeChar = (regime: string | null | undefined) => {
  switch ((regime ?? '').toLowerCase()) {
    case 'bull': return '';
    case 'bear': return '';
    case 'volatile': return '~';
    case 'chaos': return '!';
    default: return '';
  }
};

//  Shared sub-components 

const Card: React.FC<{ title?: string; children: React.ReactNode; 'data-testid'?: string }> = ({
  title, children, 'data-testid': testId,
}) => (
  <div style={{ border: `1px solid ${BORDER}`, background: PANEL, borderRadius: 4, overflow: 'hidden' }} data-testid={testId}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{title}</span>
      </div>
    )}
    {children}
  </div>
);

const Pill: React.FC<{ label: string; variant?: 'ok' | 'warn' | 'err' | 'info' | 'neutral' }> = ({ label, variant = 'neutral' }) => {
  const colors: Record<string, [string, string]> = {
    ok: [GREEN, 'rgba(38,166,154,0.15)'],
    warn: [AMBER, 'rgba(245,166,35,0.15)'],
    err: [RED, 'rgba(239,83,80,0.15)'],
    info: [BLUE, 'rgba(66,165,245,0.15)'],
    neutral: [SUBTLE, 'rgba(85,85,85,0.2)'],
  };
  const [color, bg] = colors[variant] ?? colors.neutral;
  return (
    <span style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700, padding: '2px 5px', borderRadius: 2, color, background: bg, border: `1px solid ${color}44`, letterSpacing: '0.05em' }}>
      {label}
    </span>
  );
};

const Spinner: React.FC = () => (
  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${BORDER}`, borderTopColor: BLUE, animation: 'spin 0.8s linear infinite' }} />
);

const StatusDot: React.FC<{ ok: boolean; pulse?: boolean }> = ({ ok, pulse }) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: ok ? GREEN : RED,
    ...(pulse && ok ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
  }} />
);

//  Cockpit Tabs 

type CockpitTab = 'overview' | 'health' | 'cycle-log' | 'positions' | 'orders' | 'universe';

const COCKPIT_TABS: { id: CockpitTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '' },
  { id: 'health', label: 'Health', icon: '' },
  { id: 'cycle-log', label: 'Cycle Log', icon: '' },
  { id: 'positions', label: 'Positions', icon: '' },
  { id: 'orders', label: 'Orders', icon: '' },
  { id: 'universe', label: 'Universe', icon: '' },
];

//  Overview Tab 

interface OverviewTabProps {
  health: OpsHealthResponse | null;
  lastCycle: OpsLastCycle | null;
  loading: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onRunNow: () => void;
  actionLoading: string | null;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ health, lastCycle, loading, onArm, onDisarm, onRunNow, actionLoading }) => {
  const state = health?.autopilot_state;
  const session = health?.market_session;
  const market = lastCycle?.market;
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{value}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 14 }} data-testid="cockpit-overview-tab">
      {/* Engine State */}
      <Card title="ENGINE STATE" data-testid="cockpit-engine-card">
        <div style={{ padding: 14 }}>
          {loading ? <Spinner /> : (
            <>
              {row('Status',
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusDot ok={state?.is_running ?? false} pulse />
                  <span style={{ color: state?.is_running ? GREEN : SUBTLE, fontSize: 11, fontWeight: 700 }} data-testid="engine-running-status">
                    {state?.is_running ? 'RUNNING' : state?.current_phase ?? 'IDLE'}
                  </span>
                </span>
              )}
              {row('Phase', <Pill label={state?.current_phase ?? ''} variant="info" />)}
              {row('Cycles Run', <span data-testid="cycle-count">{state?.cycle_count ?? 0}</span>)}
              {row('Paper Verified', <span style={{ color: state?.paper_verified ? GREEN : RED }}>{state?.paper_verified ? ' YES' : ' NO'}</span>)}
              {state?.kill_switch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginTop: 8, background: 'rgba(239,83,80,0.15)', border: `1px solid ${RED}44`, borderRadius: 3 }}>
                  <span style={{ color: RED, fontSize: 10, fontFamily: MONO, fontWeight: 700 }}> KILL SWITCH ACTIVE</span>
                </div>
              )}
              {state?.circuit_breaker_active && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginTop: 6, background: 'rgba(245,166,35,0.15)', border: `1px solid ${AMBER}44`, borderRadius: 3 }}>
                  <span style={{ color: AMBER, fontSize: 10, fontFamily: MONO, fontWeight: 700 }}> CIRCUIT BREAKER ON</span>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '0 14px 14px' }}>
          {[
            { id: 'arm', label: ' ARM', fn: onArm, color: GREEN },
            { id: 'disarm', label: ' DISARM', fn: onDisarm, color: SUBTLE },
            { id: 'run-now', label: ' RUN NOW', fn: onRunNow, color: BLUE },
          ].map(({ id, label, fn, color }) => (
            <button key={id} data-testid={`cockpit-${id}-btn`} onClick={fn} disabled={!!actionLoading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.05em', color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 3, cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>
              {actionLoading === id ? '' : label}
            </button>
          ))}
        </div>
      </Card>

      {/* Market Regime */}
      <Card title="MARKET REGIME" data-testid="cockpit-regime-card">
        <div style={{ padding: 14 }}>
          {loading ? <Spinner /> : (
            <>
              {row('Session',
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusDot ok={session?.allow_trading ?? false} pulse={session?.allow_trading} />
                  <span style={{ color: session?.allow_trading ? GREEN : SUBTLE, fontSize: 11 }} data-testid="market-session-state">{session?.state ?? ''}</span>
                </span>
              )}
              {row('Regime',
                <span style={{ color: regimeColor(market?.regime), fontWeight: 700 }} data-testid="market-regime">
                  {regimeChar(market?.regime)} {market?.regime ?? ''}
                </span>
              )}
              {row('VIX',
                <span style={{ color: (market?.vix_level ?? 0) > 30 ? AMBER : (market?.vix_level ?? 0) > 20 ? AMBER : GREEN }} data-testid="vix-level">
                  {market?.vix_level != null ? market.vix_level.toFixed(2) : ''}
                </span>
              )}
              {row('SPY 21d',
                <span style={{ color: (market?.spy_change_pct ?? 0) >= 0 ? GREEN : RED }} data-testid="spy-change">
                  {market?.spy_change_pct != null ? fmtPct(market.spy_change_pct * 100) : ''}
                </span>
              )}
              {session?.reason && (
                <div style={{ padding: '6px 8px', marginTop: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
                  <p style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO, lineHeight: 1.5 }}>{session.reason}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Last Cycle */}
      <Card title="LAST CYCLE" data-testid="cockpit-last-cycle-card">
        <div style={{ padding: 14 }}>
          {loading ? <Spinner /> : lastCycle ? (<>
            {row('Run ID', <span style={{ fontSize: 10, color: SUBTLE, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="last-run-id">{lastCycle.run_id}</span>)}
            {row('Status', lastCycle.success
              ? <span style={{ color: GREEN, fontWeight: 700 }}> SUCCESS</span>
              : <span style={{ color: RED, fontWeight: 700 }}> FAILED</span>
            )}
            {row('Duration', <span data-testid="last-cycle-duration">{fmtMs(lastCycle.duration_ms)}</span>)}
            {row('Candidates', `${lastCycle.candidates_generated} gen / ${lastCycle.candidates_selected} sel`)}
            {row('Orders', `${lastCycle.orders_placed} placed / ${lastCycle.orders_filled} filled`)}
            {lastCycle.gates_triggered.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4, fontFamily: MONO }}>GATES TRIGGERED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {lastCycle.gates_triggered.map(g => <Pill key={g} label={g} variant="warn" />)}
                </div>
              </div>
            )}
            {lastCycle.no_action_reasons.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4, fontFamily: MONO }}>NO-ACTION</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {lastCycle.no_action_reasons.map((r, i) => <Pill key={i} label={r} variant="neutral" />)}
                </div>
              </div>
            )}
            <div style={{ fontSize: 9, color: SUBTLE, textAlign: 'right', marginTop: 8, fontFamily: MONO }}>{fmtAge(lastCycle.timestamp)}</div>
          </>) : (
            <p style={{ fontSize: 11, color: SUBTLE, textAlign: 'center', padding: '16px 0', fontFamily: MONO }}>No cycles yet this session</p>
          )}
        </div>
      </Card>
    </div>
  );
};

//  Health Tab 

interface HealthTabProps {
  health: OpsHealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

const HealthCheckRow: React.FC<{ check: OpsHealthCheck }> = ({ check }) => {
  const isOk = check.status === 'ok';
  const isDegraded = check.status === 'degraded';
  const [hov, setHov] = useState(false);
  return (
    <div
      data-testid={`health-check-${check.name}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: `1px solid ${BORDER}`,
        background: hov ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: isOk ? GREEN : isDegraded ? AMBER : RED }}>
          {isOk ? '' : isDegraded ? '' : ''}
        </span>
        <span style={{ fontSize: 12, fontFamily: MONO, color: TEXT, textTransform: 'capitalize' }}>{check.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{check.detail}</span>
        <span style={{ fontSize: 10, fontFamily: MONO, color: check.latency_ms < 100 ? GREEN : check.latency_ms < 500 ? AMBER : RED }}>
          {fmtMs(check.latency_ms)}
        </span>
        <Pill label={check.status.toUpperCase()} variant={isOk ? 'ok' : isDegraded ? 'warn' : 'err'} />
      </div>
    </div>
  );
};

const HealthTab: React.FC<HealthTabProps> = ({ health, loading, onRefresh }) => (
  <div style={{ padding: 14 }} data-testid="cockpit-health-tab">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {health && (
          <>
            <StatusDot ok={health.overall_status === 'ok'} />
            <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: health.overall_status === 'ok' ? GREEN : RED, textTransform: 'uppercase' }} data-testid="health-overall-status">
              {health.overall_status}
            </span>
          </>
        )}
      </div>
      <button onClick={onRefresh} disabled={loading} data-testid="health-refresh-btn"
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: MONO, color: SUBTLE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {loading ? '' : ''} Refresh
      </button>
    </div>
    <Card data-testid="health-checks-card">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
      ) : health?.checks.length ? (
        health.checks.map(c => <HealthCheckRow key={c.name} check={c} />)
      ) : (
        <p style={{ fontSize: 11, color: SUBTLE, padding: 24, textAlign: 'center', fontFamily: MONO }}>No health data</p>
      )}
    </Card>
  </div>
);

//  Cycle Log Tab 

interface CycleLogTabProps {
  runs: OpsRunSummary[];
  loading: boolean;
  onRefresh: () => void;
}

const CycleLogTab: React.FC<CycleLogTabProps> = ({ runs, loading, onRefresh }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ padding: 14 }} data-testid="cockpit-cycle-log-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>{runs.length} runs in session</span>
        <button onClick={onRefresh} disabled={loading} data-testid="cycle-log-refresh-btn"
          style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
          {loading ? '' : ''} Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
      ) : runs.length === 0 ? (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}></div>
          <p style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No cycles recorded yet</p>
        </div>
      ) : (
        <div data-testid="cycle-log-list">
          {runs.map(run => (
            <div key={run.run_id} style={{ border: `1px solid ${BORDER}`, borderRadius: 3, marginBottom: 4, overflow: 'hidden' }} data-testid={`cycle-row-${run.run_id}`}>
              <button
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setExpanded(expanded === run.run_id ? null : run.run_id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: run.success ? GREEN : RED, fontSize: 12 }}>{run.success ? '' : ''}</span>
                  <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{run.run_id}</span>
                  <span style={{ fontSize: 11, color: regimeColor(run.regime), fontWeight: 700 }}>{regimeChar(run.regime)} {run.regime}</span>
                  {run.vix_level != null && <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>VIX {run.vix_level.toFixed(1)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{fmtMs(run.duration_ms)}</span>
                  <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO }}>{fmtAge(run.timestamp)}</span>
                  <span style={{ fontSize: 10, color: SUBTLE }}>{expanded === run.run_id ? '' : ''}</span>
                </div>
              </button>
              {expanded === run.run_id && (
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div><p style={{ fontSize: 9, color: SUBTLE, marginBottom: 3, fontFamily: MONO }}>CANDIDATES</p><p style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{run.candidates_generated} gen / {run.candidates_selected} sel</p></div>
                  <div><p style={{ fontSize: 9, color: SUBTLE, marginBottom: 3, fontFamily: MONO }}>ORDERS FILLED</p><p style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{run.orders_filled}</p></div>
                  <div><p style={{ fontSize: 9, color: SUBTLE, marginBottom: 3, fontFamily: MONO }}>MARKET OPEN</p><p style={{ fontSize: 11, fontFamily: MONO, color: TEXT }}>{run.market_open ? 'YES' : 'NO'}</p></div>
                  {run.gates_triggered.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p style={{ fontSize: 9, color: SUBTLE, marginBottom: 4, fontFamily: MONO }}>GATES TRIGGERED</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {run.gates_triggered.map(g => <Pill key={g} label={g} variant="warn" />)}
                      </div>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{new Date(run.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

//  Positions Tab 

interface PositionsTabProps { positions: OpsPosition[]; loading: boolean; onRefresh: () => void; }

const PositionsTab: React.FC<PositionsTabProps> = ({ positions, loading, onRefresh }) => (
  <div style={{ padding: 14 }} data-testid="cockpit-positions-tab">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>{positions.length} open position{positions.length !== 1 ? 's' : ''}</span>
      <button onClick={onRefresh} disabled={loading} data-testid="positions-refresh-btn"
        style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {loading ? '' : ''} Refresh
      </button>
    </div>
    {loading ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
    ) : positions.length === 0 ? (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No open positions (paper account)</p>
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }} data-testid="positions-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
              {['Symbol','Qty','Avg Entry','Current','Mkt Value','Unrealised P&L','P&L %'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Symbol' ? 'left' : 'right', fontSize: 9, color: SUBTLE, letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(p => {
              const plNum = Number(p.unrealized_pl ?? 0);
              const plPct = Number(p.unrealized_plpc ?? 0) * 100;
              return (
                <tr key={p.symbol} style={{ borderBottom: `1px solid ${BORDER}` }} data-testid={`position-row-${p.symbol}`}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: TEXT }}>{p.symbol}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{p.qty}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt$(p.avg_entry_price)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt$(p.current_price)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt$(p.market_value)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: plNum >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmt$(plNum)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: plPct >= 0 ? GREEN : RED }}>{fmtPct(plPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

//  Orders Tab 

interface OrdersTabProps { orders: OpsOrder[]; loading: boolean; onRefresh: () => void; }

const statusVariant = (s: string): 'ok' | 'warn' | 'err' | 'info' | 'neutral' => {
  if (s === 'filled') return 'ok';
  if (s === 'canceled' || s === 'rejected') return 'err';
  if (s === 'pending_new' || s === 'new') return 'info';
  return 'neutral';
};

const OrdersTab: React.FC<OrdersTabProps> = ({ orders, loading, onRefresh }) => (
  <div style={{ padding: 14 }} data-testid="cockpit-orders-tab">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>{orders.length} recent orders</span>
      <button onClick={onRefresh} disabled={loading} data-testid="orders-refresh-btn"
        style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {loading ? '' : ''} Refresh
      </button>
    </div>
    {loading ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
    ) : orders.length === 0 ? (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>No orders in paper account</p>
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }} data-testid="orders-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
              {['Symbol','Side','Type','Qty','Filled','Avg Price','Status','Created'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: ['Qty','Filled','Avg Price'].includes(h) ? 'right' : 'left', fontSize: 9, color: SUBTLE, letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: `1px solid ${BORDER}` }} data-testid={`order-row-${o.id}`}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: TEXT }}>{o.symbol}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: o.side === 'buy' ? GREEN : RED, textTransform: 'uppercase' }}>{o.side}</td>
                <td style={{ padding: '8px 12px', color: SUBTLE }}>{o.type}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{o.qty}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{o.filled_qty}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{o.filled_avg_price ? fmt$(o.filled_avg_price) : ''}</td>
                <td style={{ padding: '8px 12px' }}><Pill label={o.status.toUpperCase()} variant={statusVariant(o.status)} /></td>
                <td style={{ padding: '8px 12px', color: SUBTLE }}>{fmtTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

//  Universe Tab 

interface UniverseTabProps {
  symbols: OpsUniverseSymbol[];
  account: { equity: number | string; cash: number | string; buying_power: number | string; portfolio_value: number | string } | null;
  loading: boolean;
  onRefresh: () => void;
}

const UniverseTab: React.FC<UniverseTabProps> = ({ symbols, account, loading, onRefresh }) => (
  <div style={{ padding: 14 }} data-testid="cockpit-universe-tab">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: SUBTLE, fontFamily: MONO }}>{symbols.length} symbols in trading universe</span>
      <button onClick={onRefresh} disabled={loading} data-testid="universe-refresh-btn"
        style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {loading ? '' : ''} Refresh
      </button>
    </div>

    {account && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }} data-testid="account-summary">
        {[
          { label: 'Portfolio Value', value: fmt$(account.portfolio_value) },
          { label: 'Equity', value: fmt$(account.equity) },
          { label: 'Cash', value: fmt$(account.cash) },
          { label: 'Buying Power', value: fmt$(account.buying_power) },
        ].map(item => (
          <div key={item.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: '10px 12px', textAlign: 'center', background: PANEL }}>
            <p style={{ fontSize: 9, color: SUBTLE, marginBottom: 4, fontFamily: MONO, letterSpacing: '0.07em' }}>{item.label.toUpperCase()}</p>
            <p style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color: AMBER }}>{item.value}</p>
          </div>
        ))}
      </div>
    )}

    {loading ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }} data-testid="universe-grid">
        {symbols.map(s => (
          <div key={s.symbol} data-testid={`universe-symbol-${s.symbol}`}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px', background: PANEL, transition: 'border-color 0.1s' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1 }}>{s.symbol}</p>
            <p style={{ fontSize: 9, color: SUBTLE, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: MONO }}>{s.sector}</p>
            <div style={{ marginTop: 4 }}><Pill label={s.liquidity_tier} variant="info" /></div>
          </div>
        ))}
      </div>
    )}
  </div>
);

//  Main Cockpit Component 

export const AutopilotCockpit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CockpitTab>('overview');
  const [health, setHealth] = useState<OpsHealthResponse | null>(null);
  const [lastCycle, setLastCycle] = useState<OpsLastCycle | null>(null);
  const [runs, setRuns] = useState<OpsRunSummary[]>([]);
  const [positions, setPositions] = useState<OpsPosition[]>([]);
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [universeSymbols, setUniverseSymbols] = useState<OpsUniverseSymbol[]>([]);
  const [account, setAccount] = useState<UniverseTabProps['account']>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingUniverse, setLoadingUniverse] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const [h, c] = await Promise.all([opsApi.getHealth(), opsApi.getLastCycle()]);
      setHealth(h);
      if (c.has_cycle && c.cycle) setLastCycle(c.cycle);
    } catch (e) { console.error('Failed to load health/cycle', e); }
    finally { setLoadingHealth(false); }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try { const res = await opsApi.getRuns(30); setRuns(res.runs ?? []); }
    catch (e) { console.error('Failed to load runs', e); }
    finally { setLoadingRuns(false); }
  }, []);

  const loadPositions = useCallback(async () => {
    setLoadingPositions(true);
    try { const res = await opsApi.getPositions(); setPositions(res.positions ?? []); }
    catch (e) { console.error('Failed to load positions', e); }
    finally { setLoadingPositions(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try { const res = await opsApi.getOrders(25); setOrders(res.orders ?? []); }
    catch (e) { console.error('Failed to load orders', e); }
    finally { setLoadingOrders(false); }
  }, []);

  const loadUniverse = useCallback(async () => {
    setLoadingUniverse(true);
    try {
      const [u, a] = await Promise.all([opsApi.getUniverse(), opsApi.getAccount()]);
      setUniverseSymbols(u.symbols ?? []);
      if (a.account) setAccount(a.account as UniverseTabProps['account']);
    } catch (e) { console.error('Failed to load universe/account', e); }
    finally { setLoadingUniverse(false); }
  }, []);

  useEffect(() => {
    loadHealth(); loadRuns(); loadPositions(); loadOrders(); loadUniverse();
    pollRef.current = setInterval(() => { loadHealth(); }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadHealth, loadRuns, loadPositions, loadOrders, loadUniverse]);

  useEffect(() => {
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'cycle-log') loadRuns();
    if (activeTab === 'positions') loadPositions();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'universe') loadUniverse();
  }, [activeTab, loadHealth, loadRuns, loadPositions, loadOrders, loadUniverse]);

  const handleArm = async () => {
    setActionLoading('arm');
    try { const res = await opsApi.arm(); showToast(res.message, res.ok); await loadHealth(); }
    catch (e: unknown) { showToast(`Arm failed: ${(e as Error).message}`, false); }
    finally { setActionLoading(null); }
  };

  const handleDisarm = async () => {
    setActionLoading('disarm');
    try { const res = await opsApi.disarm(); showToast(res.message, res.ok); await loadHealth(); }
    catch (e: unknown) { showToast(`Disarm failed: ${(e as Error).message}`, false); }
    finally { setActionLoading(null); }
  };

  const handleRunNow = async () => {
    setActionLoading('run-now');
    try {
      const res = await opsApi.runNow(true); showToast(res.message, res.ok);
      setTimeout(async () => { await loadHealth(); await loadRuns(); }, 8000);
    } catch (e: unknown) { showToast(`Run failed: ${(e as Error).message}`, false); }
    finally { setActionLoading(null); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }} data-testid="autopilot-cockpit">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {toast && (
        <div data-testid="cockpit-toast" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          fontSize: 11, fontFamily: MONO, fontWeight: 700,
          background: toast.ok ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)',
          border: `1px solid ${toast.ok ? GREEN : RED}44`,
          borderRadius: 4, color: toast.ok ? GREEN : RED,
        }}>
          {toast.ok ? '' : ''} {toast.msg}
        </div>
      )}

      {/* Tab Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '0 14px',
        borderBottom: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.2)', flexShrink: 0,
      }}>
        {COCKPIT_TABS.map(t => (
          <button
            key={t.id}
            data-testid={`cockpit-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            aria-selected={activeTab === t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '10px 14px', fontSize: 10, fontFamily: MONO, fontWeight: 600,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeTab === t.id ? AMBER : 'transparent'}`,
              color: activeTab === t.id ? AMBER : SUBTLE,
              cursor: 'pointer', transition: 'color 0.1s, border-color 0.1s',
              marginBottom: -1,
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <OverviewTab health={health} lastCycle={lastCycle} loading={loadingHealth}
            onArm={handleArm} onDisarm={handleDisarm} onRunNow={handleRunNow} actionLoading={actionLoading} />
        )}
        {activeTab === 'health' && <HealthTab health={health} loading={loadingHealth} onRefresh={loadHealth} />}
        {activeTab === 'cycle-log' && <CycleLogTab runs={runs} loading={loadingRuns} onRefresh={loadRuns} />}
        {activeTab === 'positions' && <PositionsTab positions={positions} loading={loadingPositions} onRefresh={loadPositions} />}
        {activeTab === 'orders' && <OrdersTab orders={orders} loading={loadingOrders} onRefresh={loadOrders} />}
        {activeTab === 'universe' && <UniverseTab symbols={universeSymbols} account={account} loading={loadingUniverse} onRefresh={loadUniverse} />}
      </div>
    </div>
  );
};

export default AutopilotCockpit;