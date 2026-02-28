/**
 * AutopilotCommandCenterUI2 — Autopilot Revolution Command Center
 *
 * Tabs: StatusStrip | Cycles | Decisions | Rejections | Orders | Positions | PnL | LLM
 *
 * All live data — NO demo/mock data. Fetches from /api/ops/autopilot/* and /autopilot/*.
 * Every HTML element carries data-testid for Playwright E2E.
 * Auto-refreshes every 10s. Manual refresh available.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  message: string;
  value?: string | number | boolean | null;
}

interface HealthData {
  armed: boolean;
  kill_switch_active: boolean;
  autopilot_state: string;
  market_session: {
    status: string;
    is_open: boolean;
    next_open: string | null;
    next_close: string | null;
  };
  providers: {
    alpaca_paper_connected: boolean;
    options_enabled: boolean;
    last_contract_fetch_ts: string | null;
    last_quote_ts: string | null;
    ws_status?: string;
  };
  loop: {
    last_loop_ts: string | null;
    last_decision_id: string | null;
    last_error: string | null;
    cycles_run: number;
  };
  checks?: HealthCheck[];
  risk_controls: Record<string, number>;
  universe: string[];
  correlation_id: string;
}

interface CycleSummary {
  cycle_id: string;
  started_at: string;
  completed_at: string | null;
  symbol: string;
  decision: string;
  rejected: boolean;
  rejection_reason: string | null;
  orders_submitted: number;
  reconciliation_incidents: number;
  correlation_id: string;
}

interface Decision {
  decision_id: string;
  symbol: string;
  timestamp: string;
  decision_type?: string;
  action?: string;
  contract: {
    contract_symbol: string;
    option_type: string;
    strike: number;
    expiry?: string;
    expiration?: string;
    dte: number;
    bid?: number;
    ask?: number;
    mid?: number;
    spread_pct?: number;
    delta?: number;
    iv?: number;
    score?: number;
  } | null;
  order: {
    limit_price: number;
    qty: number;
    side: string;
  } | null;
  premium_cost_usd: number;
  confidence?: number;
  score?: number;
  dte?: number;
  spread_pct?: number;
  candidates_count?: number;
  candidates_accepted?: number;
  feature_contributions?: Array<{ name: string; value: unknown; contribution: string; pass_fail: boolean }>;
  risk_checks?: Array<{ name: string; passed: boolean; value: unknown; message: string }>;
  armed: boolean;
  market_open: boolean;
  will_submit: boolean;
  explanation?: string;
  correlation_id: string;
}

interface Rejection {
  decision_id: string;
  symbol?: string;
  timestamp: string;
  reason: string;
  detail: string;
  hard_rule?: string;
  candidates_count?: number;
  rejection_counts?: Record<string, number>;
  correlation_id: string;
}

interface BrokerOrder {
  id: string;
  symbol: string;
  qty: number | string;
  side: string;
  type: string;
  status: string;
  limit_price: number | null;
  filled_avg_price: number | null;
  submitted_at: string;
  asset_class?: string;
}

interface BrokerPosition {
  symbol: string;
  qty: number | string;
  side: 'long' | 'short';
  avg_entry_price: number | string;
  current_price: number | string;
  unrealized_pl: number | string;
  unrealized_plpc: number | string | null;
  market_value: number | string;
  asset_class?: string;
  exit_trigger?: string | null;
  dte?: number | null;
}

interface PnlData {
  equity: number;
  cash: number;
  buying_power: number;
  day_pnl: number;
  total_unrealized_pnl: number;
  option_unrealized_pnl: number;
  total_positions: number;
  option_positions: number;
  premium_at_risk?: number;
  daily_loss_limit?: number;
  correlation_id: string;
}

interface LLMStatus {
  provider: string;
  gemini_available?: boolean;
  groq_available?: boolean;
  ollama_available?: boolean;
  cache_size: number;
  total_calls: number;
  cache_hit_rate: number;
  budget_remaining?: number;
  budget_max?: number;
  last_error: string | null;
  last_narrative?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API  = '/api/ops/autopilot';   // health/version/cycle/arm/run-now
const AUTO = '/autopilot';           // /autopilot/status, /positions, /runs, /decisions, /rejections

const TABS = [
  { id: 'status',    label: 'Status Strip' },
  { id: 'cycles',    label: 'Cycles' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'rejections',label: 'Rejections' },
  { id: 'orders',    label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'pnl',       label: 'PnL / Exposure' },
  { id: 'llm',       label: 'LLM' },
] as const;

type TabId = typeof TABS[number]['id'];

const POLL_MS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ago(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 5)   return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function pct(v: number | string | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return `${(+v * 100).toFixed(decimals)}%`;
}

function dollar(v: number | string | null | undefined): string {
  if (v == null) return '—';
  const n = +v;
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function statusColor(s: string | null | undefined): string {
  if (!s) return '#6b7280';
  const l = s.toLowerCase();
  if (l === 'pass' || l === 'open' || l === 'filled' || l === 'armed') return '#10b981';
  if (l === 'warn' || l === 'partial_fill' || l === 'pending_new') return '#f59e0b';
  if (l === 'fail' || l === 'rejected' || l === 'canceled' || l === 'kill') return '#ef4444';
  return '#6b7280';
}

// ── Reusable primitives ────────────────────────────────────────────────────────

function Pill({ label, color, testId }: { label: string; color: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: color + '22',
        color,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function Badge({ ok, label, testId }: { ok: boolean; label: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: ok ? '#10b98122' : '#ef444422',
        color: ok ? '#10b981' : '#ef4444',
        border: `1px solid ${ok ? '#10b98133' : '#ef444433'}`,
      }}
    >
      <span>{ok ? '●' : '○'}</span>
      {label}
    </span>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{title}</h2>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DataRow({ label, value, testId, mono }: { label: string; value: React.ReactNode; testId?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 13 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span data-testid={testId} style={{ color: '#e2e8f0', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  );
}

function EmptyState({ msg, testId }: { msg: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 14 }}>
      {msg}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ color: '#3b82f6', padding: 24, textAlign: 'center', fontSize: 13 }}>
      Loading…
    </div>
  );
}

function ErrorBanner({ msg, testId }: { msg: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, padding: '10px 16px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
      ⚠ {msg}
    </div>
  );
}

// ── API fetcher ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch {
    return null;
  }
}

// ── Status Strip Tab ──────────────────────────────────────────────────────────

function StatusStripTab({ health }: { health: HealthData | null }) {
  const p = health?.providers;
  const m = health?.market_session;
  const l = health?.loop;

  const freshness = (ts: string | null, thresh = 60) => {
    if (!ts) return false;
    return (Date.now() - new Date(ts).getTime()) / 1000 < thresh;
  };

  return (
    <div data-testid="tab-status" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="System Status Strip" sub="Live broker and engine connectivity" />

      {!health && <EmptyState msg="Waiting for health data…" testId="status-empty" />}

      {health && (
        <>
          {/* Top status bar */}
          <div data-testid="status-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 16px', background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b' }}>
            <Badge ok={!!p?.alpaca_paper_connected}  label="Alpaca Connected"   testId="badge-alpaca-connected" />
            <Badge ok={!!p?.options_enabled}          label="Options Enabled"    testId="badge-options-enabled" />
            <Badge ok={!!m?.is_open}                  label="Market Open"        testId="badge-market-open" />
            <Badge ok={freshness(p?.last_quote_ts ?? null, 30)}    label="Quote Fresh"   testId="badge-quote-fresh" />
            <Badge ok={freshness(p?.last_contract_fetch_ts ?? null, 90)} label="Chain Fresh" testId="badge-chain-fresh" />
            <Badge ok={p?.ws_status === 'connected'}  label="WS Live"            testId="badge-ws-status" />
            <Badge ok={!!health.armed && !health.kill_switch_active} label="Armed"     testId="badge-armed" />
            <Badge ok={!health.kill_switch_active}    label="Kill Switch Off"    testId="badge-kill-switch" />
          </div>

          {/* Checks */}
          {health.checks && health.checks.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>System Checks</div>
              <div data-testid="health-checks-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {health.checks.map((c, i) => (
                  <div key={i} data-testid={`health-check-${c.name}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#0f172a', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: statusColor(c.status), fontWeight: 700 }}>
                      {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '~'}
                    </span>
                    <span style={{ flex: 1, color: '#e2e8f0' }}>{c.name}</span>
                    <span style={{ color: '#64748b' }}>{c.message}</span>
                    {c.value != null && <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{String(c.value)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            <Card title="Market Session" testId="card-market-session">
              <DataRow label="Status"    value={<Pill label={m?.status ?? 'unknown'} color={m?.is_open ? '#10b981' : '#f59e0b'} />} />
              <DataRow label="Next Open"  value={m?.next_open  ? ago(m.next_open)  : '—'} testId="market-next-open" />
              <DataRow label="Next Close" value={m?.next_close ? ago(m.next_close) : '—'} testId="market-next-close" />
            </Card>
            <Card title="Data Plane" testId="card-data-plane">
              <DataRow label="Last Quote"  value={ago(p?.last_quote_ts ?? null)}           testId="last-quote-ts" />
              <DataRow label="Last Chain"  value={ago(p?.last_contract_fetch_ts ?? null)}  testId="last-chain-ts" />
              <DataRow label="WS Status"   value={p?.ws_status ?? '—'}                     testId="ws-status-text" />
            </Card>
            <Card title="Engine Loop" testId="card-engine-loop">
              <DataRow label="Cycles Run"  value={l?.cycles_run ?? 0}                      testId="cycles-run" />
              <DataRow label="Last Loop"   value={ago(l?.last_loop_ts ?? null)}            testId="last-loop-ts" />
              <DataRow label="Last Error"  value={l?.last_error ?? 'none'}                 testId="last-error" />
            </Card>
          </div>

          {/* Universe */}
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Trading Universe</div>
            <div data-testid="universe-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(health.universe ?? []).map(sym => (
                <Pill key={sym} label={sym} color="#3b82f6" testId={`universe-${sym}`} />
              ))}
              {(!health.universe || health.universe.length === 0) && (
                <span style={{ color: '#475569', fontSize: 12 }}>No symbols configured</span>
              )}
            </div>
          </div>

          {/* Risk controls */}
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Risk Controls</div>
            <div data-testid="risk-controls-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, minHeight: 40 }}>
              {Object.entries(health.risk_controls ?? {}).length > 0
                ? Object.entries(health.risk_controls ?? {}).map(([k, v]) => (
                    <div key={k} data-testid={`risk-${k}`} style={{ padding: '8px 12px', background: '#0f172a', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ color: '#64748b' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>{dollar(v)}</div>
                    </div>
                  ))
                : <span style={{ color: '#475569', fontSize: 12, alignSelf: 'center' }}>No risk controls in health response</span>
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Cycles Tab ────────────────────────────────────────────────────────────────

function CyclesTab({ cycles, loading }: { cycles: CycleSummary[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div data-testid="tab-cycles">
      <SectionHeader title="Cycle Log" sub="Every brain cycle with decisions, rejections, orders, and reconciliation" />
      {loading && <Spinner />}
      {!loading && cycles.length === 0 && <EmptyState msg="No cycles recorded yet." testId="cycles-empty" />}
      {!loading && cycles.length > 0 && (
        <div data-testid="cycles-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cycles.map(c => (
            <div key={c.cycle_id}>
              <div
                data-testid={`cycle-row-${c.cycle_id}`}
                onClick={() => setExpanded(expanded === c.cycle_id ? null : c.cycle_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f172a', borderRadius: 8, cursor: 'pointer', border: '1px solid #1e293b', fontSize: 13 }}
              >
                <span style={{ color: '#64748b', fontSize: 11, width: 160, flexShrink: 0, fontFamily: 'monospace' }}>
                  {new Date(c.started_at).toLocaleTimeString()}
                </span>
                <Pill label={c.symbol} color="#3b82f6" testId={`cycle-symbol-${c.cycle_id}`} />
                <span data-testid={`cycle-decision-${c.cycle_id}`} style={{ color: '#e2e8f0', flex: 1 }}>{c.decision}</span>
                {c.rejected && <Pill label={`REJECT: ${c.rejection_reason ?? '?'}`} color="#ef4444" />}
                <Badge ok={c.orders_submitted > 0} label={`${c.orders_submitted} orders`} testId={`cycle-orders-${c.cycle_id}`} />
                {c.reconciliation_incidents > 0 && (
                  <Pill label={`${c.reconciliation_incidents} incidents`} color="#f59e0b" />
                )}
                <span style={{ color: '#475569', fontSize: 11 }}>{expanded === c.cycle_id ? '▲' : '▼'}</span>
              </div>
              {expanded === c.cycle_id && (
                <div data-testid={`cycle-drawer-${c.cycle_id}`} style={{ background: '#071124', borderRadius: '0 0 8px 8px', padding: '12px 16px', border: '1px solid #1e293b', borderTop: 'none', fontSize: 12 }}>
                  <DataRow label="Cycle ID"       value={c.cycle_id}                        mono />
                  <DataRow label="Correlation ID" value={c.correlation_id}                  mono />
                  <DataRow label="Started"        value={new Date(c.started_at).toISOString()} />
                  <DataRow label="Completed"      value={c.completed_at ? new Date(c.completed_at).toISOString() : 'running…'} />
                  <DataRow label="Decision"       value={c.decision} />
                  <DataRow label="Orders"         value={c.orders_submitted} />
                  <DataRow label="Incidents"      value={c.reconciliation_incidents} />
                  {c.rejected && <DataRow label="Rejection Reason" value={c.rejection_reason ?? '—'} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Decisions Tab ─────────────────────────────────────────────────────────────

function DecisionsTab({ decisions, loading }: { decisions: Decision[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const action = (d: Decision) => d.decision_type ?? d.action ?? 'UNKNOWN';

  return (
    <div data-testid="tab-decisions">
      <SectionHeader title="Accepted Decisions" sub="BUY/EXIT decisions with contract details, risk checks, and feature attribution" />
      {loading && <Spinner />}
      {!loading && decisions.length === 0 && <EmptyState msg="No accepted decisions yet." testId="decisions-empty" />}
      {!loading && decisions.length > 0 && (
        <div data-testid="decisions-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {decisions.map(d => (
            <div key={d.decision_id}>
              <div
                data-testid={`decision-row-${d.decision_id}`}
                onClick={() => setExpanded(expanded === d.decision_id ? null : d.decision_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f172a', borderRadius: 8, cursor: 'pointer', border: '1px solid #1e293b', fontSize: 13 }}
              >
                <span style={{ color: '#64748b', fontSize: 11, width: 160, flexShrink: 0, fontFamily: 'monospace' }}>
                  {new Date(d.timestamp).toLocaleTimeString()}
                </span>
                <Pill label={d.symbol} color="#3b82f6" />
                <Pill
                  label={action(d)}
                  color={action(d).includes('BUY') ? '#10b981' : action(d).includes('EXIT') ? '#f59e0b' : '#6b7280'}
                  testId={`decision-action-${d.decision_id}`}
                />
                {d.contract && (
                  <>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {d.contract.contract_symbol}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>DTE {d.contract.dte ?? d.dte ?? '—'}</span>
                    {d.contract.delta != null && <span style={{ color: '#64748b', fontSize: 11 }}>Δ {d.contract.delta.toFixed(3)}</span>}
                    {(d.contract.spread_pct ?? d.spread_pct) != null && (
                      <span style={{ color: '#64748b', fontSize: 11 }}>spread {((d.contract.spread_pct ?? d.spread_pct ?? 0) * 100).toFixed(1)}%</span>
                    )}
                  </>
                )}
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>
                  conf {((d.confidence ?? 0) * 100).toFixed(0)}%
                </span>
                {d.will_submit && <Pill label="submitted" color="#10b981" />}
              </div>

              {expanded === d.decision_id && (
                <div data-testid={`decision-drawer-${d.decision_id}`} style={{ background: '#071124', borderRadius: '0 0 8px 8px', padding: '12px 16px', border: '1px solid #1e293b', borderTop: 'none', fontSize: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Contract */}
                    <div>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Contract</div>
                      <DataRow label="Symbol"     value={d.contract?.contract_symbol ?? '—'}          mono />
                      <DataRow label="Type"       value={d.contract?.option_type ?? '—'} />
                      <DataRow label="Strike"     value={d.contract?.strike != null ? `$${d.contract.strike}` : '—'} />
                      <DataRow label="Expiry"     value={d.contract?.expiry ?? d.contract?.expiration ?? '—'} />
                      <DataRow label="DTE"        value={d.contract?.dte ?? d.dte ?? '—'} />
                      <DataRow label="Bid"        value={d.contract?.bid != null ? dollar(d.contract.bid) : '—'} />
                      <DataRow label="Ask"        value={d.contract?.ask != null ? dollar(d.contract.ask) : '—'} />
                      <DataRow label="Mid"        value={d.contract?.mid != null ? dollar(d.contract.mid) : '—'} />
                      <DataRow label="IV"         value={d.contract?.iv != null ? pct(d.contract.iv) : '—'} />
                      <DataRow label="Score"      value={d.contract?.score?.toFixed(4) ?? d.score?.toFixed(4) ?? '—'} />
                    </div>
                    {/* Order */}
                    <div>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Order & Risk</div>
                      <DataRow label="Side"         value={d.order?.side ?? '—'} />
                      <DataRow label="Qty"          value={d.order?.qty ?? '—'} />
                      <DataRow label="Limit Price"  value={d.order?.limit_price != null ? dollar(d.order.limit_price) : '—'} />
                      <DataRow label="Premium"      value={dollar(d.premium_cost_usd)} />
                      <DataRow label="Confidence"   value={pct(d.confidence ?? 0)} />
                      <DataRow label="Candidates"   value={`${d.candidates_count ?? 0} / ${d.candidates_accepted ?? 0} accepted`} />
                      <DataRow label="Will Submit"  value={d.will_submit ? '✓ yes' : '✗ no'} />
                    </div>
                  </div>

                  {/* Risk checks */}
                  {d.risk_checks && d.risk_checks.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Risk Checks</div>
                      <div data-testid={`risk-checks-${d.decision_id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {d.risk_checks.map((rc, i) => (
                          <Badge key={i} ok={rc.passed} label={`${rc.name}: ${rc.message}`} testId={`rc-${d.decision_id}-${rc.name}`} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feature contributions */}
                  {d.feature_contributions && d.feature_contributions.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Feature Attribution (top 10)</div>
                      <div data-testid={`features-${d.decision_id}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {d.feature_contributions.slice(0, 10).map((f, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                            <span style={{ color: '#94a3b8' }}>{f.name}</span>
                            <span style={{ color: f.pass_fail ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>{f.contribution}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LLM narrative */}
                  {d.explanation && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>LLM Narrative</div>
                      <div data-testid={`narrative-${d.decision_id}`} style={{ background: '#0f172a', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                        {d.explanation}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rejections Tab ────────────────────────────────────────────────────────────

const REJECTION_CODES: Record<string, string> = {
  no_chain:          'Could not fetch options chain',
  stale_quote:       'Quote older than SLA threshold',
  spread_too_wide:   'Bid–ask spread exceeds max threshold',
  risk_cap:          'Risk engine hard cap triggered',
  market_closed:     'Market is not open',
  insufficient_bp:   'Insufficient buying power',
  no_candidates:     'No contracts passed filters',
  kill_switch:       'Kill switch active',
  unknown:           'Unknown rejection reason',
};

function RejectionsTab({ rejections, loading }: { rejections: Rejection[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div data-testid="tab-rejections">
      <SectionHeader title="Rejections" sub="Cycles where brain decided not to trade — with real rejection codes" />
      {loading && <Spinner />}
      {!loading && rejections.length === 0 && <EmptyState msg="No rejections recorded." testId="rejections-empty" />}
      {!loading && rejections.length > 0 && (
        <div data-testid="rejections-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rejections.map(r => (
            <div key={r.decision_id}>
              <div
                data-testid={`rejection-row-${r.decision_id}`}
                onClick={() => setExpanded(expanded === r.decision_id ? null : r.decision_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f172a', borderRadius: 8, cursor: 'pointer', border: '1px solid #1e293b', fontSize: 13 }}
              >
                <span style={{ color: '#64748b', fontSize: 11, width: 160, flexShrink: 0, fontFamily: 'monospace' }}>
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
                {r.symbol && <Pill label={r.symbol} color="#3b82f6" />}
                <Pill label={r.reason} color="#ef4444" testId={`rejection-reason-${r.decision_id}`} />
                <span style={{ color: '#94a3b8', flex: 1, fontSize: 12 }}>
                  {REJECTION_CODES[r.reason] ?? r.detail}
                </span>
              </div>
              {expanded === r.decision_id && (
                <div data-testid={`rejection-drawer-${r.decision_id}`} style={{ background: '#071124', borderRadius: '0 0 8px 8px', padding: '12px 16px', border: '1px solid #1e293b', borderTop: 'none', fontSize: 12 }}>
                  <DataRow label="Decision ID"     value={r.decision_id}       mono />
                  <DataRow label="Correlation ID"  value={r.correlation_id}    mono />
                  <DataRow label="Reason"          value={r.reason} />
                  <DataRow label="Detail"          value={r.detail} />
                  <DataRow label="Hard Rule"       value={r.hard_rule ?? '—'} />
                  <DataRow label="Candidates"      value={r.candidates_count ?? '—'} />
                  {r.rejection_counts && Object.keys(r.rejection_counts).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Rejection Count by Code</div>
                      {Object.entries(r.rejection_counts).map(([code, cnt]) => (
                        <DataRow key={code} label={code} value={cnt} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ orders, loading }: { orders: BrokerOrder[]; loading: boolean }) {
  const [filterSym, setFilterSym] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSide, setFilterSide] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = orders.filter(o => {
    if (filterSym && !o.symbol.toLowerCase().includes(filterSym.toLowerCase())) return false;
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterSide !== 'all' && o.side !== filterSide) return false;
    return true;
  });

  return (
    <div data-testid="tab-orders">
      <SectionHeader title="Orders — Broker Truth" sub="All orders from Alpaca /v2/orders — raw broker state, no internal transforms" />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          data-testid="order-filter-symbol"
          placeholder="Filter by symbol…"
          value={filterSym}
          onChange={e => setFilterSym(e.target.value)}
          style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, width: 180 }}
        />
        <select
          data-testid="order-filter-status"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }}
        >
          <option value="all">All Statuses</option>
          <option value="filled">filled</option>
          <option value="new">new</option>
          <option value="pending_new">pending_new</option>
          <option value="partial_fill">partial_fill</option>
          <option value="canceled">canceled</option>
          <option value="rejected">rejected</option>
        </select>
        <select
          data-testid="order-filter-side"
          value={filterSide}
          onChange={e => setFilterSide(e.target.value)}
          style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }}
        >
          <option value="all">All Sides</option>
          <option value="buy">buy</option>
          <option value="sell">sell</option>
        </select>
        <span data-testid="order-count" style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>
          {filtered.length} / {orders.length} orders
        </span>
      </div>

      {loading && <Spinner />}
      {!loading && filtered.length === 0 && <EmptyState msg="No orders match filter." testId="orders-empty" />}
      {!loading && filtered.length > 0 && (
        <div data-testid="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(o => (
            <div key={o.id}>
              <div
                data-testid={`order-row-${o.id}`}
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#0f172a', borderRadius: 8, cursor: 'pointer', border: '1px solid #1e293b', fontSize: 12 }}
              >
                <Pill label={o.status} color={statusColor(o.status)} testId={`order-status-${o.id}`} />
                <Pill label={o.side}   color={o.side === 'buy' ? '#3b82f6' : '#f59e0b'} />
                <span data-testid={`order-symbol-${o.id}`} style={{ color: '#e2e8f0', width: 180, fontFamily: 'monospace' }}>{o.symbol}</span>
                <span style={{ color: '#94a3b8' }}>qty {o.qty}</span>
                <span style={{ color: '#64748b' }}>{o.type}</span>
                {o.limit_price != null && <span style={{ color: '#94a3b8' }}>lmt {dollar(o.limit_price)}</span>}
                {o.filled_avg_price != null && <span style={{ color: '#10b981' }}>fill {dollar(o.filled_avg_price)}</span>}
                <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 11 }}>
                  {ago(o.submitted_at)}
                </span>
              </div>
              {expanded === o.id && (
                <div data-testid={`order-drawer-${o.id}`} style={{ background: '#071124', borderRadius: '0 0 8px 8px', padding: '12px 16px', border: '1px solid #1e293b', borderTop: 'none', fontSize: 12 }}>
                  <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Raw Broker Data</div>
                  <pre data-testid={`order-raw-${o.id}`} style={{ background: '#0d1117', borderRadius: 6, padding: 12, overflow: 'auto', fontSize: 11, color: '#94a3b8', margin: 0 }}>
                    {JSON.stringify(o, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Positions Tab ─────────────────────────────────────────────────────────────

function PositionsTab({ positions, loading }: { positions: BrokerPosition[]; loading: boolean }) {
  const incidents = positions.filter(p => p.exit_trigger);

  return (
    <div data-testid="tab-positions">
      <SectionHeader title="Positions — Broker Truth" sub="All positions from Alpaca /v2/positions — unrealized P&L, DTE, exit triggers" />

      {incidents.length > 0 && (
        <div data-testid="incident-banner" style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#f59e0b', fontSize: 13 }}>
          ⚠ {incidents.length} position(s) have exit trigger active: {incidents.map(p => `${p.symbol}(${p.exit_trigger})`).join(', ')}
        </div>
      )}

      {loading && <Spinner />}
      {!loading && positions.length === 0 && <EmptyState msg="No open positions." testId="positions-empty" />}
      {!loading && positions.length > 0 && (
        <div data-testid="positions-list" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: 11 }}>
                {['Symbol', 'Side', 'Qty', 'Avg Entry', 'Current', 'Unrealized P&L', 'P&L %', 'DTE', 'Exit Trigger'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, background: '#0f172a', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const plPct = +p.unrealized_plpc! || 0;
                const isProfit = plPct >= 0;
                return (
                  <tr key={i} data-testid={`position-row-${p.symbol}`} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#e2e8f0' }}>{p.symbol}</td>
                    <td style={{ padding: '8px 10px' }}><Pill label={p.side} color={p.side === 'long' ? '#3b82f6' : '#f59e0b'} /></td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{p.qty}</td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{dollar(p.avg_entry_price)}</td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{dollar(p.current_price)}</td>
                    <td style={{ padding: '8px 10px', color: +p.unrealized_pl >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {dollar(p.unrealized_pl)}
                    </td>
                    <td style={{ padding: '8px 10px', color: isProfit ? '#10b981' : '#ef4444' }}>
                      {pct(plPct / 100)}
                    </td>
                    <td style={{ padding: '8px 10px', color: (p.dte ?? 99) <= 7 ? '#f59e0b' : '#94a3b8' }}>
                      {p.dte ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {p.exit_trigger
                        ? <Pill label={p.exit_trigger} color="#f59e0b" testId={`exit-trigger-${p.symbol}`} />
                        : <span style={{ color: '#475569' }}>—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PnL Tab ───────────────────────────────────────────────────────────────────

function PnlTab({ pnl, loading }: { pnl: PnlData | null; loading: boolean }) {
  const dailyLossPct = pnl && pnl.daily_loss_limit
    ? Math.abs(pnl.day_pnl) / pnl.daily_loss_limit
    : 0;

  return (
    <div data-testid="tab-pnl">
      <SectionHeader title="P&L / Exposure" sub="Account equity, buying power, unrealized P&L, delta exposure" />
      {loading && <Spinner />}
      {!pnl && !loading && <EmptyState msg="P&L data unavailable." testId="pnl-empty" />}
      {pnl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Daily P&L stop bar */}
          {pnl.daily_loss_limit && (
            <div data-testid="daily-loss-bar-container" style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Daily P&L Loss Limit</span>
                <span data-testid="daily-loss-pct" style={{ color: dailyLossPct > 0.8 ? '#ef4444' : '#94a3b8' }}>
                  {dollar(pnl.day_pnl)} / {dollar(-pnl.daily_loss_limit)} ({(dailyLossPct * 100).toFixed(1)}% used)
                </span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  data-testid="daily-loss-bar"
                  style={{ height: '100%', width: `${Math.min(dailyLossPct * 100, 100)}%`, background: dailyLossPct > 0.8 ? '#ef4444' : '#3b82f6', borderRadius: 3, transition: 'width 0.5s' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            <Card title="Account" testId="card-account">
              <DataRow label="Equity"         value={dollar(pnl.equity)}        testId="pnl-equity" />
              <DataRow label="Cash"           value={dollar(pnl.cash)}          testId="pnl-cash" />
              <DataRow label="Buying Power"   value={dollar(pnl.buying_power)}  testId="pnl-bp" />
            </Card>
            <Card title="Daily P&L" testId="card-daily-pnl">
              <DataRow label="Day P&L" value={
                <span style={{ color: pnl.day_pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {dollar(pnl.day_pnl)}
                </span>
              } testId="pnl-day" />
              <DataRow label="Unrealized (all)"     value={dollar(pnl.total_unrealized_pnl)} testId="pnl-unrealized-total" />
              <DataRow label="Unrealized (options)" value={dollar(pnl.option_unrealized_pnl)} testId="pnl-unrealized-options" />
            </Card>
            <Card title="Positions" testId="card-positions-summary">
              <DataRow label="Total Positions"  value={pnl.total_positions}  testId="pnl-total-positions" />
              <DataRow label="Option Positions" value={pnl.option_positions}  testId="pnl-option-positions" />
              {pnl.premium_at_risk != null && (
                <DataRow label="Premium at Risk" value={dollar(pnl.premium_at_risk)} testId="pnl-premium-at-risk" />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LLM Tab ───────────────────────────────────────────────────────────────────

function LLMTab({ llm, loading }: { llm: LLMStatus | null; loading: boolean }) {
  const budgetUsedPct = llm && llm.budget_max
    ? ((llm.budget_max - (llm.budget_remaining ?? llm.budget_max)) / llm.budget_max)
    : 0;

  return (
    <div data-testid="tab-llm">
      <SectionHeader title="LLM Subsystem" sub="Provider health, token budgets, cache hit rate, last cycle narrative" />
      {loading && <Spinner />}
      {!llm && !loading && <EmptyState msg="LLM status unavailable." testId="llm-empty" />}
      {llm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Provider badges */}
          <div data-testid="llm-providers" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Badge ok={llm.gemini_available ?? false}  label="Gemini"  testId="badge-gemini" />
            <Badge ok={llm.groq_available   ?? false}  label="Groq"    testId="badge-groq" />
            <Badge ok={llm.ollama_available ?? false}  label="Ollama"  testId="badge-ollama" />
          </div>

          {/* Budget bar */}
          {llm.budget_max && (
            <div data-testid="llm-budget-bar-container" style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Token Budget</span>
                <span data-testid="llm-budget-remaining" style={{ color: '#94a3b8' }}>
                  {llm.budget_remaining?.toLocaleString()} / {llm.budget_max?.toLocaleString()} remaining
                </span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  data-testid="llm-budget-bar"
                  style={{ height: '100%', width: `${Math.min(budgetUsedPct * 100, 100)}%`, background: budgetUsedPct > 0.9 ? '#ef4444' : '#3b82f6', borderRadius: 3, transition: 'width 0.5s' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            <Card title="Usage" testId="card-llm-usage">
              <DataRow label="Provider"      value={llm.provider}                            testId="llm-provider" />
              <DataRow label="Total Calls"   value={llm.total_calls}                         testId="llm-total-calls" />
              <DataRow label="Cache Size"    value={llm.cache_size}                          testId="llm-cache-size" />
              <DataRow label="Cache Hit %"   value={pct(llm.cache_hit_rate)}                 testId="llm-cache-hit-rate" />
            </Card>
            <Card title="Errors" testId="card-llm-errors">
              <DataRow label="Last Error" value={llm.last_error ?? 'none'} testId="llm-last-error" />
            </Card>
          </div>

          {/* Last narrative */}
          {llm.last_narrative && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Last Cycle Narrative</div>
              <div data-testid="llm-last-narrative" style={{ background: '#0f172a', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#94a3b8', lineHeight: 1.7, border: '1px solid #1e293b' }}>
                {llm.last_narrative}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card helper ────────────────────────────────────────────────────────────────

function Card({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AutopilotCommandCenterUI2() {
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [health, setHealth]         = useState<HealthData | null>(null);
  const [cycles, setCycles]         = useState<CycleSummary[]>([]);
  const [decisions, setDecisions]   = useState<Decision[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [orders, setOrders]         = useState<BrokerOrder[]>([]);
  const [positions, setPositions]   = useState<BrokerPosition[]>([]);
  const [pnl, setPnl]               = useState<PnlData | null>(null);
  const [llm, setLlm]               = useState<LLMStatus | null>(null);

  // Loading
  const [loadingStatus,    setLoadingStatus]    = useState(false);
  const [loadingCycles,    setLoadingCycles]    = useState(false);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [loadingRejections,setLoadingRejections]= useState(false);
  const [loadingOrders,    setLoadingOrders]    = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingPnl,       setLoadingPnl]       = useState(false);
  const [loadingLlm,       setLoadingLlm]       = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const sig = ac.signal;

    setLoadingStatus(true);   setLoadingCycles(true);
    setLoadingDecisions(true);setLoadingRejections(true);
    setLoadingOrders(true);   setLoadingPositions(true);
    setLoadingPnl(true);      setLoadingLlm(true);

    try {
      const [h, status, dec, rej, orders_, pos, pnl_, llm_] = await Promise.all([
        apiFetch<HealthData  >(`${API}/health`,              sig),
        apiFetch<{ cycles: CycleSummary[] }>(`${AUTO}/runs?limit=50`,      sig),
        apiFetch<{ decisions: Decision[] }>(`${AUTO}/decisions?limit=50&accepted=true`, sig),
        apiFetch<{ rejections: Rejection[] }>(`${AUTO}/rejections?limit=50`, sig),
        apiFetch<{ orders: BrokerOrder[] }>(`${AUTO}/orders?limit=100`,     sig),
        apiFetch<{ positions: BrokerPosition[] }>(`${AUTO}/positions`,      sig),
        apiFetch<PnlData     >(`${AUTO}/pnl`,                sig),
        apiFetch<LLMStatus   >(`${AUTO}/llm-status`,         sig),
      ]);

      if (!sig.aborted) {
        setHealth(h);
        setCycles(status?.cycles ?? []);
        setDecisions(dec?.decisions ?? []);
        setRejections(rej?.rejections ?? []);
        setOrders(orders_?.orders ?? []);
        setPositions(pos?.positions ?? []);
        setPnl(pnl_);
        setLlm(llm_);
        setLastRefresh(new Date());
        setError(null);
      }
    } catch (e) {
      if (!sig.aborted) setError(`Fetch error: ${e}`);
    } finally {
      if (!sig.aborted) {
        setLoadingStatus(false);   setLoadingCycles(false);
        setLoadingDecisions(false);setLoadingRejections(false);
        setLoadingOrders(false);   setLoadingPositions(false);
        setLoadingPnl(false);      setLoadingLlm(false);
      }
    }
  }, []);

  // Initial fetch + poll
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchAll]);

  // Arm / disarm / kill-switch / run-now
  const handleArm = async () => {
    const r = await fetch(`${API}/arm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ armed: true }) });
    if (r.ok) fetchAll();
  };
  const handleDisarm = async () => {
    const r = await fetch(`${API}/arm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ armed: false }) });
    if (r.ok) fetchAll();
  };
  const handleKillSwitch = async () => {
    const r = await fetch(`${AUTO}/kill-switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true, reason: 'User triggered via command center' }) });
    if (r.ok) fetchAll();
  };
  const handleRunNow = async () => {
    await fetch(`${API}/run-now`, { method: 'POST' });
    setTimeout(fetchAll, 3000);  // re-fetch after cycle completes
  };

  const isArmed    = health?.armed ?? false;
  const killActive = health?.kill_switch_active ?? false;

  return (
    <div data-testid="autopilot-command-center" style={{ minHeight: '100vh', background: '#020817', color: '#e2e8f0', fontFamily: "'Inter', -apple-system, sans-serif", padding: 24 }}>

      {/* Legacy Mode Banner — Parity Contract v1.0.0 */}
      <div
        data-testid="legacy-mode-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#0a1628',
          border: '1px solid #1e3a5f',
          borderRadius: 6,
          padding: '7px 14px',
          marginBottom: 16,
          fontSize: 11,
          color: '#64748b',
          letterSpacing: '0.03em',
        }}
      >
        <span style={{ color: '#3b82f6', fontWeight: 700, fontFamily: 'monospace' }}>
          LEGACY-PARITY
        </span>
        <span>Baseline commit:</span>
        <code
          data-testid="legacy-commit-sha"
          style={{ color: '#94a3b8', background: '#0f172a', borderRadius: 3, padding: '1px 6px', fontFamily: 'monospace' }}
        >
          9580ba5
        </code>
        <span style={{ color: '#334155' }}>·</span>
        <span>Contract:</span>
        <code
          data-testid="legacy-contract-version"
          style={{ color: '#94a3b8', background: '#0f172a', borderRadius: 3, padding: '1px 6px', fontFamily: 'monospace' }}
        >
          v1.0.0
        </code>
        <span style={{ color: '#334155' }}>·</span>
        <span>Real Alpaca paper · No demo data</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 data-testid="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Autopilot Command Center
          </h1>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Real paper trading · Alpaca · {lastRefresh ? `Updated ${ago(lastRefresh.toISOString())}` : 'Connecting…'}
          </div>
        </div>

        {/* Control buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            data-testid="btn-refresh"
            onClick={fetchAll}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
          >
            ↻ Refresh
          </button>
          <button
            data-testid="btn-run-now"
            onClick={handleRunNow}
            style={{ background: '#1d4ed8', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            ▶ Run Now
          </button>
          {isArmed ? (
            <button
              data-testid="btn-disarm"
              onClick={handleDisarm}
              style={{ background: '#374151', border: '1px solid #4b5563', borderRadius: 6, padding: '6px 14px', color: '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              Disarm
            </button>
          ) : (
            <button
              data-testid="btn-arm"
              onClick={handleArm}
              style={{ background: '#065f46', border: '1px solid #10b98133', borderRadius: 6, padding: '6px 14px', color: '#10b981', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              ⬢ Arm
            </button>
          )}
          <button
            data-testid="btn-kill-switch"
            onClick={handleKillSwitch}
            disabled={killActive}
            style={{ background: killActive ? '#1e293b' : '#7f1d1d', border: `1px solid ${killActive ? '#334155' : '#ef444433'}`, borderRadius: 6, padding: '6px 14px', color: killActive ? '#475569' : '#ef4444', cursor: killActive ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            ✕ Kill Switch{killActive ? ' (Active)' : ''}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner msg={error} testId="global-error-banner" />}

      {/* Kill switch banner */}
      {killActive && (
        <div data-testid="kill-switch-banner" style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#ef4444', fontWeight: 600 }}>
          ⛔ KILL SWITCH ACTIVE — All autopilot activity halted. Go to Kill Switch Recovery to re-arm.
        </div>
      )}

      {/* Tabs */}
      <div data-testid="tab-bar" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1e293b', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            data-testid={`tab-btn-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
              padding: '10px 16px',
              color: activeTab === t.id ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div data-testid="tab-content">
        {activeTab === 'status'     && <StatusStripTab  health={health}                                  />}
        {activeTab === 'cycles'     && <CyclesTab       cycles={cycles}       loading={loadingCycles}    />}
        {activeTab === 'decisions'  && <DecisionsTab    decisions={decisions} loading={loadingDecisions} />}
        {activeTab === 'rejections' && <RejectionsTab   rejections={rejections} loading={loadingRejections} />}
        {activeTab === 'orders'     && <OrdersTab       orders={orders}       loading={loadingOrders}    />}
        {activeTab === 'positions'  && <PositionsTab    positions={positions} loading={loadingPositions} />}
        {activeTab === 'pnl'        && <PnlTab          pnl={pnl}             loading={loadingPnl}       />}
        {activeTab === 'llm'        && <LLMTab          llm={llm}             loading={loadingLlm}       />}
      </div>
    </div>
  );
}
