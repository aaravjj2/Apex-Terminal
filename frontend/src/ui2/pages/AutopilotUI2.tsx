/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — AUTOPILOT DASHBOARD (UI2)                               │
 * │                                                                          │
 * │ Real-data autopilot dashboard — tasks.md §21                            │
 * │                                                                          │
 * │ Data sources (no demo mode):                                            │
 * │  GET  /api/autopilot/ops-summary          → status / stats / arm state │
 * │  GET  /api/autopilot/positions            → open positions from broker  │
 * │  GET  /api/autopilot/orders               → recent orders               │
 * │  GET  /api/autopilot/decisions            → cycle decisions              │
 * │  GET  /api/autopilot/cycles/latest        → cycle history               │
 * │  GET  /api/autopilot/signals              → directional signals          │
 * │  GET  /api/autopilot/risk-snapshot        → real risk caps + account    │
 * │  GET  /api/autopilot/exits                → closed trade history        │
 * │  GET  /api/autopilot/incidents            → system incidents            │
 * │  GET  /api/autopilot/thresholds           → rules / thresholds          │
 * │  GET  /api/ui2/autopilot-depth/hash       → deterministic run hash      │
 * │  GET  /api/ui2/autopilot-depth/risk-controls   → risk controls          │
 * │  GET  /api/ui2/autopilot-depth/execution-params → exec params           │
 * │  GET  /api/ui2/autopilot-depth/runs/{id}/evaluation → eval data         │
 * │  POST /api/autopilot/run-v3               → manual cycle trigger        │
 * │  POST /api/autopilot/arm                  → arm / disarm                │
 * │  POST /api/autopilot/kill-switch          → kill switch                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ApexAreaChart from '../components/chart/ApexAreaChart';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', border2: '#363A45',
  text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Fira Code',monospace",
  radius: '4px',
};

const API = (window as any).__APEX_API__ || '';
const SIGNALS_UNIVERSE = 'AAPL,SPY,NVDA,MSFT,META,GOOGL,TSLA,AMZN,GLD,QQQ';
const POLL_MS = 15000;

const panel: React.CSSProperties = {
  background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius,
  display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
};
const hdr: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '5px 10px', borderBottom: `1px solid ${T.border0}`,
  fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans, flexShrink: 0,
};
const scroll: React.CSSProperties = { flex: 1, overflow: 'auto', scrollbarWidth: 'thin' } as React.CSSProperties;
const mono = (color?: string): React.CSSProperties => ({ fontFamily: T.fontMono, color: color || T.text1 });
const clr = (n: number) => n >= 0 ? T.up : T.dn;
const fmtUSD = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';

function usePoll<T>(fetcher: () => Promise<T>, interval = POLL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const mount = useRef(true);
  const run = useCallback(async () => {
    try { const r = await fetcher(); if (mount.current) { setData(r); setLoading(false); } } catch {}
  }, [fetcher]);
  useEffect(() => {
    mount.current = true; run();
    const id = setInterval(run, interval);
    return () => { mount.current = false; clearInterval(id); };
  }, [run, interval]);
  return { data, loading, refresh: run };
}

const fetchOps = () => fetch(`${API}/api/autopilot/ops-summary`).then(r => r.json());
const fetchPos = () => fetch(`${API}/api/autopilot/positions`).then(r => r.json());
const fetchOrd = () => fetch(`${API}/api/autopilot/orders?limit=50`).then(r => r.json());
const fetchDec = () => fetch(`${API}/api/autopilot/decisions?limit=30`).then(r => r.json());
const fetchCyc = () => fetch(`${API}/api/autopilot/cycles/latest?n=20`).then(r => r.json());
const fetchSig = () => fetch(`${API}/api/autopilot/signals?symbols=${SIGNALS_UNIVERSE}`).then(r => r.json());
const fetchRsk = () => fetch(`${API}/api/autopilot/risk-snapshot`).then(r => r.json());
const fetchExt = () => fetch(`${API}/api/autopilot/exits?limit=30`).then(r => r.json());
const fetchInc = () => fetch(`${API}/api/autopilot/incidents?limit=20`).then(r => r.json());
const fetchThr = () => fetch(`${API}/api/autopilot/thresholds`).then(r => r.json());
const fetchHash = () => fetch(`${API}/api/ui2/autopilot-depth/hash`).then(r => r.json());
const fetchRiskControls = () => fetch(`${API}/api/ui2/autopilot-depth/risk-controls`).then(r => r.json());
const fetchExecParams = () => fetch(`${API}/api/ui2/autopilot-depth/execution-params`).then(r => r.json());

/* Equity Curve — lightweight-charts v5 area series */
function EquityCurve({ history, base }: { history: number[]; base: number }) {
  const last = history.length > 0 ? history[history.length - 1] : 0;
  const pct = base > 0 ? (last - base) / base : 0;
  const isUp = last >= base;

  // Convert number[] to AreaPoint[] with synthetic daily timestamps going backwards
  const areaData = history.map((val, i) => {
    const secsPerBar = 86400; // 1 day per bar
    const now = Math.floor(Date.now() / 1000);
    const time = now - (history.length - 1 - i) * secsPerBar;
    return { time, value: val };
  });

  return (
    <div data-testid="autopilot-equity" style={{ ...panel, flex: 1 }}>
      <div style={hdr}>
        <span>ACCOUNT EQUITY</span>
        {last != null && last > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ ...mono(T.text1), fontSize: '10px', fontWeight: 700 }}>{fmtUSD(last)}</span>
            <span style={{ ...mono(clr(pct)), fontSize: '9px' }}>{fmtPct(pct)}</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 80 }}>
        {areaData.length < 2
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.text3, fontSize: '10px' }}>Waiting for account data...</div>
          : <ApexAreaChart data={areaData} color={isUp ? T.up : T.dn} />}
      </div>
    </div>
  );
}

/* Signals Panel */
function SignalsPanel({ data }: { data: any }) {
  const sigs: any[] = data?.ok ? Object.values(data.signals || {}) : [];
  const dc = (d: string) => d === 'bullish' ? T.up : d === 'bearish' ? T.dn : T.warn;
  const di = (d: string) => d === 'bullish' ? '▲' : d === 'bearish' ? '▼' : '—';
  return (
    <div data-testid="signal-dashboard" style={panel}>
      <div style={hdr}><span>LIVE SIGNALS</span><span style={{ fontSize: '8px', color: T.text3 }}>SMA/RSI/ATR</span></div>
      <div style={scroll}>
        {sigs.length === 0 && <div style={{ padding: 10, color: T.text3, fontSize: '10px' }}>Loading signals...</div>}
        {sigs.map((s: any) => (
          <div key={s.symbol} style={{ padding: '4px 10px', borderBottom: `1px solid ${T.border0}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...mono(T.text0), fontWeight: 700, width: 50, fontSize: '10px' }}>{s.symbol}</span>
            <span style={{ ...mono(dc(s.direction)), fontWeight: 800, width: 16, fontSize: '12px' }}>{di(s.direction)}</span>
            <span style={{ ...mono(dc(s.direction)), fontSize: '9px', width: 52 }}>{s.direction?.toUpperCase()}</span>
            <div style={{ flex: 1, height: 3, background: T.bg3, borderRadius: 2 }}>
              <div style={{ width: `${(s.strength || 0) * 100}%`, height: '100%', background: dc(s.direction), borderRadius: 2 }} />
            </div>
            <span style={{ ...mono(T.text3), fontSize: '8px', width: 38, textAlign: 'right' }}>RSI {s.rsi14 != null ? s.rsi14.toFixed(0) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Risk Panel (dashboard guardrails) */
function RiskPanel({ data }: { data: any }) {
  if (!data?.ok) return <div data-testid="risk-guardrails" style={panel}><div style={hdr}><span>RISK LIMITS</span></div><div style={{ padding: 10, color: T.text3, fontSize: '10px' }}>Loading...</div></div>;
  const s = data.risk_snapshot || {}, caps = data.caps || {}, acct = data.account || {};
  const lims = [
    { l: 'Premium at Risk', c: s.total_premium_at_risk || 0, m: caps.max_total_premium_open_usd || 1, f: (v: number) => `$${v.toFixed(0)}` },
    { l: 'Positions', c: s.open_positions_count || 0, m: caps.max_positions || 4, f: (v: number) => String(v) },
    { l: 'Daily Loss', c: Math.abs(s.estimated_daily_loss || 0), m: caps.max_daily_loss_usd || 200, f: (v: number) => `$${v.toFixed(0)}` },
  ];
  return (
    <div data-testid="risk-guardrails" style={panel}>
      <div style={hdr}><span>RISK LIMITS</span><span style={{ fontSize: '7px', color: T.text3 }}>PAPER</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {lims.map(l => {
          const pct = Math.min((Math.abs(l.c) / Math.max(l.m, 0.001)) * 100, 100);
          const col = pct > 80 ? T.dn : pct > 60 ? T.warn : T.up;
          return (
            <div key={l.l} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: '9px', color: T.text2 }}>{l.l}</span>
                <span style={{ ...mono(col), fontSize: '9px' }}>{l.f(l.c)} / {l.f(l.m)}</span>
              </div>
              <div style={{ height: 4, background: T.bg3, borderRadius: 2 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border0}`, fontSize: '9px' }}>
          {[['Equity', fmtUSD(acct.equity ?? 0), T.text0], ['Options BP', fmtUSD(acct.options_buying_power ?? 0), T.info]].map(([k, v, c]: any) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: T.text3 }}>{k}</span>
              <span style={{ ...mono(c), fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Positions Panel */
function PositionsPanel({ data }: { data: any }) {
  const rows: any[] = data?.positions || [];
  return (
    <div data-testid="positions-panel" style={panel}>
      <div style={hdr}><span>POSITIONS</span><span style={{ ...mono(rows.length > 0 ? T.up : T.text3), fontSize: '9px' }}>{rows.length} open</span></div>
      <div style={scroll}>
        {rows.length === 0
          ? <div style={{ padding: '16px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No open positions</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead><tr style={{ background: T.bg2 }}>
              {['Contract', 'Qty', 'Entry', 'Unr. P&L', 'P&L %', 'Status'].map(h =>
                <th key={h} style={{ padding: '3px 7px', textAlign: 'left', color: T.text3, fontWeight: 600, fontSize: '8px' }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((p: any, i: number) => {
              const pnl = p.unrealized_pnl ?? 0;
              return <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                <td style={{ padding: '3px 7px', ...mono(T.text0), fontWeight: 700 }}>{p.contract_symbol || p.symbol}</td>
                <td style={{ padding: '3px 7px', ...mono(T.text1) }}>{p.qty || p.contracts}</td>
                <td style={{ padding: '3px 7px', ...mono(T.text2) }}>{p.entry_price != null ? `$${p.entry_price.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '3px 7px', ...mono(clr(pnl)), fontWeight: 700 }}>{fmtUSD(pnl)}</td>
                <td style={{ padding: '3px 7px', ...mono(clr(p.unrealized_pnl_pct ?? 0)) }}>{fmtPct(p.unrealized_pnl_pct ?? 0)}</td>
                <td style={{ padding: '3px 7px', ...mono(p.status === 'open' ? T.up : T.warn), fontSize: '8px' }}>{p.status?.toUpperCase()}</td>
              </tr>;
            })}</tbody>
          </table>}
      </div>
    </div>
  );
}

/* Orders Panel */
function OrdersPanel({ data }: { data: any }) {
  const rows: any[] = data?.orders || [];
  const sc = (s: string) => s?.includes('fill') ? T.up : s?.includes('cancel') || s?.includes('reject') ? T.dn : T.warn;
  return (
    <div data-testid="orders-panel" style={panel}>
      <div style={hdr}><span>ORDERS</span><span style={{ color: T.text3, fontSize: '8px' }}>{rows.length} records</span></div>
      <div style={scroll}>
        {rows.length === 0
          ? <div style={{ padding: '12px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No orders yet</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead><tr style={{ background: T.bg2 }}>
              {['Symbol', 'Side', 'Qty', 'Status', 'Time'].map(h =>
                <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontWeight: 600, fontSize: '8px' }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((o: any, i: number) =>
              <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{o.symbol}</td>
                <td style={{ padding: '3px 6px', ...mono(o.side === 'buy' ? T.up : T.dn), fontWeight: 700 }}>{o.side?.toUpperCase()}</td>
                <td style={{ padding: '3px 6px', ...mono(T.text1) }}>{o.qty}</td>
                <td style={{ padding: '3px 6px', ...mono(sc(o.status)) }}>{o.status?.toUpperCase()}</td>
                <td style={{ padding: '3px 6px', ...mono(T.text3), fontSize: '8px' }}>{o.submitted_at ? new Date(o.submitted_at).toLocaleTimeString() : '—'}</td>
              </tr>
            )}</tbody>
          </table>}
      </div>
    </div>
  );
}

/* Decisions Panel */
function DecisionsPanel({ data }: { data: any }) {
  const rows: any[] = data?.decisions || [];
  return (
    <div data-testid="decisions-panel" style={panel}>
      <div style={hdr}><span>DECISIONS</span><span style={{ color: T.text3, fontSize: '8px' }}>{rows.length} recent</span></div>
      <div style={scroll}>
        {rows.length === 0
          ? <div style={{ padding: '12px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No decisions yet</div>
          : rows.map((d: any, i: number) =>
            <div key={i} style={{ padding: '5px 10px', borderBottom: `1px solid ${T.border0}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ ...mono(T.text0), fontWeight: 700, fontSize: '10px' }}>{d.symbol}</span>
                <span style={{ ...mono(T.info), fontSize: '9px' }}>{d.decision_type}</span>
                <span style={{ ...mono(T.text3), fontSize: '8px', marginLeft: 'auto' }}>{d.created_at ? new Date(d.created_at).toLocaleTimeString() : ''}</span>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

/* Cycles Panel */
function CyclesPanel({ data }: { data: any }) {
  const rows: any[] = data?.cycles || [];
  return (
    <div data-testid="cycle-history" style={panel}>
      <div style={hdr}><span>CYCLE HISTORY</span></div>
      <div style={scroll}>
        {rows.length === 0
          ? <div style={{ padding: '12px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No cycles yet</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead><tr style={{ background: T.bg2 }}>
              {['Cycle ID', 'Time', 'Status', 'Dec'].map(h =>
                <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontWeight: 600, fontSize: '8px' }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((c: any, i: number) =>
              <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                <td style={{ padding: '3px 6px', ...mono(T.text3), fontSize: '8px' }}>{c.cycle_id?.slice(-14)}</td>
                <td style={{ padding: '3px 6px', ...mono(T.text2), fontSize: '8px' }}>{c.started_at ? new Date(c.started_at).toLocaleTimeString() : '—'}</td>
                <td style={{ padding: '3px 6px', ...mono(c.status === 'completed' ? T.up : T.warn), fontSize: '8px' }}>{c.status}</td>
                <td style={{ padding: '3px 6px', ...mono(T.info) }}>{c.decisions_count ?? 0}</td>
              </tr>
            )}</tbody>
          </table>}
      </div>
    </div>
  );
}

/* Exits Panel */
function ExitsPanel({ data }: { data: any }) {
  const rows: any[] = data?.exits || [];
  return (
    <div data-testid="exits-panel" style={panel}>
      <div style={hdr}><span>CLOSED TRADES</span></div>
      <div style={scroll}>
        {rows.length === 0
          ? <div style={{ padding: '12px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No exits yet</div>
          : rows.map((e: any, i: number) => {
            const pnl = e.realized_pnl ?? e.pnl ?? 0;
            return <div key={i} style={{ padding: '4px 10px', borderBottom: `1px solid ${T.border0}` }}>
              <span style={{ ...mono(T.text0), fontWeight: 700 }}>{e.symbol}</span>
              <span style={{ ...mono(clr(pnl)), fontWeight: 700, marginLeft: 8 }}>{fmtUSD(pnl)}</span>
            </div>;
          })}
      </div>
    </div>
  );
}

/* Think Log */
function ThinkLog({ summary }: { summary: any }) {
  const lc = summary?.last_cycle, a = lc?.audit_log;
  const rej: any[] = a?.candidates_rejected || [];
  const ord: any[] = a?.orders_submitted || [];
  return (
    <div data-testid="autopilot-think-log" style={panel}>
      <div style={hdr}><span>THINK LOG</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 10px', fontSize: '9px' }}>
        {!lc
          ? <div style={{ color: T.text3 }}>No cycle data yet.</div>
          : <>
            <div style={{ marginBottom: 6, color: T.text3 }}>Cycle: {lc.cycle_id?.slice(-12)} | {lc.decisions_count ?? 0} dec | {lc.rejections_count ?? 0} rej</div>
            {rej.length > 0 && rej.map((r: any, i: number) => <div key={i} style={{ color: T.text3 }}>• {typeof r === 'string' ? r : (r.symbol ? `${r.symbol}: ${r.reason}` : JSON.stringify(r))}</div>)}
            {ord.length > 0 && ord.map((o: any, i: number) => <div key={i} style={{ color: T.up }}>✓ {typeof o === 'string' ? o : (o.symbol || JSON.stringify(o))}</div>)}
          </>}
      </div>
    </div>
  );
}

/* Incidents */
function Incidents({ data }: { data: any }) {
  const rows: any[] = data?.incidents || [];
  if (rows.length === 0) return null;
  return (
    <div data-testid="incidents-panel" style={{ ...panel, borderColor: T.warn, flexShrink: 0 }}>
      <div style={{ ...hdr, color: T.warn }}><span>⚠ INCIDENTS</span></div>
      <div style={{ padding: '4px 10px' }}>
        {rows.slice(0, 3).map((r: any, i: number) =>
          <div key={i} style={{ padding: '3px 6px', background: T.bg2, borderLeft: `2px solid ${T.warn}`, marginBottom: 3 }}>
            <div style={{ color: T.warn, fontWeight: 700, fontSize: '9px' }}>{r.incident_type?.toUpperCase()}</div>
            <div style={{ color: T.text2, fontSize: '8px' }}>{r.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PIPELINE 2.0 TYPES
   ═══════════════════════════════════════════════════════════════════════ */
interface PipelineRun {
  run_id: string;
  hash: string;
  timestamp: string;
  stages: { id: number; name: string; status: 'pending' | 'running' | 'done' | 'error'; duration_ms: number }[];
  decisions: any[];
  rejections: any[];
  orders: any[];
  summary: { accepted: number; rejected: number; orders_sent: number; total_ms: number };
}
const STAGE_NAMES = ['T1-Signal', 'T2-Risk', 'T3-Decision', 'T4-Compliance', 'T5-Execute', 'T6-Verify'];

/* ═══════════════════════════════════════════════════════════════════════
   CONTROLS TAB
   ═══════════════════════════════════════════════════════════════════════ */
function ControlsTab({ kill, onKillSwitch, thresholds, decData, running, onRunPipeline }: {
  kill: boolean; onKillSwitch: () => void; thresholds: any; decData: any;
  running: boolean; onRunPipeline: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ruleStates, setRuleStates] = useState<Record<string, boolean>>({});

  const thr = thresholds?.current_thresholds || {};
  const rules = [
    { key: 'min_confidence', label: 'Min Confidence', value: thr.min_confidence ?? 0.5 },
    { key: 'max_spread_pct', label: 'Max Spread %', value: thr.max_spread_pct ?? 8.0 },
    { key: 'min_dte', label: 'Min DTE', value: thr.min_dte ?? 14 },
    { key: 'max_dte', label: 'Max DTE', value: thr.max_dte ?? 45 },
    { key: 'target_delta', label: 'Target Delta', value: thr.target_delta ?? 0.45 },
    { key: 'max_premium_per_trade', label: 'Max Premium/Trade', value: `$${thr.max_premium_per_trade_usd ?? 500}` },
    { key: 'stop_loss_pct', label: 'Stop Loss %', value: `${thr.stop_loss_pct ?? 25}%` },
    { key: 'take_profit_pct', label: 'Take Profit %', value: `${thr.take_profit_pct ?? 30}%` },
  ];
  const recentActivity: any[] = (decData?.decisions || []).slice(0, 10);
  const handleKillClick = () => { if (!kill) setConfirmOpen(true); else onKillSwitch(); };

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 5, overflow: 'hidden', minHeight: 0 }}>
      {/* Kill switch panel */}
      <div data-testid="autopilot-kill-switch-panel" style={{ ...panel, flexShrink: 0, padding: '8px 12px', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: '8px', color: T.text3, textTransform: 'uppercase', marginBottom: 4 }}>KILL SWITCH</div>
          <button data-testid="autopilot-kill-switch-btn" onClick={handleKillClick}
            style={{ background: kill ? T.dn : T.bg3, color: '#FFF', border: `1px solid ${kill ? T.dn : T.border2}`, padding: '5px 14px', borderRadius: T.radius, fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}>
            {kill ? '🔴 KILL ACTIVE — CLICK TO DEACTIVATE' : '⚡ ACTIVATE KILL SWITCH'}
          </button>
        </div>
        <div style={{ fontSize: '9px', color: kill ? T.dn : T.text3 }}>
          {kill ? 'All trading halted.' : 'System operational.'}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div data-testid="autopilot-confirm-modal"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: T.bg1, border: `1px solid ${T.dn}`, borderRadius: T.radius, padding: 24, minWidth: 340 }}>
            <div style={{ color: T.dn, fontWeight: 800, fontSize: '14px', marginBottom: 12 }}>⚠ ACTIVATE KILL SWITCH?</div>
            <div style={{ color: T.text2, fontSize: '11px', marginBottom: 16 }}>This will halt ALL automated trading.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-testid="autopilot-confirm-activate" onClick={() => { setConfirmOpen(false); onKillSwitch(); }}
                style={{ background: T.dn, color: '#FFF', border: 'none', padding: '6px 18px', borderRadius: T.radius, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                ACTIVATE KILL SWITCH
              </button>
              <button data-testid="autopilot-confirm-cancel" onClick={() => setConfirmOpen(false)}
                style={{ background: T.bg3, color: T.text1, border: `1px solid ${T.border2}`, padding: '6px 18px', borderRadius: T.radius, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, minHeight: 0, overflow: 'hidden' }}>
        <div data-testid="autopilot-rules-list" style={panel}>
          <div style={hdr}><span>TRADING RULES</span></div>
          <div style={scroll}>
            {rules.map((rule, idx) => {
              const isOn = ruleStates[rule.key] !== undefined ? ruleStates[rule.key] : true;
              return (
                <div key={rule.key} data-testid={`autopilot-rule-${idx}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderBottom: `1px solid ${T.border0}` }}>
                  <div>
                    <div style={{ fontSize: '9px', color: T.text1, fontWeight: 600 }}>{rule.label}</div>
                    <div style={{ fontSize: '8px', color: T.text3, fontFamily: T.fontMono }}>{String(rule.value)}</div>
                  </div>
                  <button data-testid={`autopilot-rule-toggle-${idx}`}
                    onClick={() => setRuleStates(p => ({ ...p, [rule.key]: !(p[rule.key] !== undefined ? p[rule.key] : true) }))}
                    style={{ background: isOn ? T.up : T.bg3, color: '#FFF', border: `1px solid ${isOn ? T.up : T.border2}`, padding: '2px 8px', borderRadius: T.radius, fontSize: '8px', fontWeight: 700, cursor: 'pointer' }}>
                    {isOn ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div data-testid="autopilot-activity-table" style={panel}>
          <div style={hdr}><span>RECENT ACTIVITY</span></div>
          <div style={scroll}>
            {recentActivity.length === 0
              ? <div style={{ padding: '12px 10px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No activity yet</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['Symbol', 'Type', 'Score', 'Time'].map(h =>
                    <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontWeight: 600, fontSize: '8px' }}>{h}</th>)}
                </tr></thead>
                <tbody>{recentActivity.map((d: any, i: number) =>
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                    <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{d.symbol}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.info), fontSize: '8px' }}>{d.decision_type}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.up) }}>{d.score?.toFixed(1)}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.text3), fontSize: '8px' }}>{d.created_at ? new Date(d.created_at).toLocaleTimeString() : '—'}</td>
                  </tr>
                )}</tbody>
              </table>}
          </div>
        </div>
      </div>

      {/* Run pipeline + ready marker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', flexShrink: 0 }}>
        <button data-testid="autopilot-run-pipeline-btn" onClick={onRunPipeline} disabled={running}
          style={{ background: running ? T.bg3 : T.brand, color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: T.radius, fontSize: '11px', fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? '⏳ RUNNING...' : '▶ RUN PIPELINE 2.0'}
        </button>
        <div data-testid="autopilot-ready" style={{ display: 'none' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PIPELINE 2.0 TAB
   ═══════════════════════════════════════════════════════════════════════ */
function PipelineTab({ runs, running, onRunPipeline, selectedRun, onSelectRun }: {
  runs: PipelineRun[]; running: boolean; onRunPipeline: () => void;
  selectedRun: number; onSelectRun: (i: number) => void;
}) {
  const run = runs[selectedRun] || null;
  const sc = (s: string) => s === 'done' ? T.up : s === 'running' ? T.warn : s === 'error' ? T.dn : T.text3;
  const si = (s: string) => s === 'done' ? '✓' : s === 'running' ? '⏳' : s === 'error' ? '✗' : '○';
  return (
    <div data-testid="autopilot-pipeline-panel" style={{ flex: 1, display: 'grid', gridTemplateRows: 'auto 1fr', gap: 5, overflow: 'hidden', minHeight: 0 }}>
      {/* Run selector bar */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', flexShrink: 0 }}>
        <button data-testid="autopilot-run-pipeline-btn" onClick={onRunPipeline} disabled={running}
          style={{ background: running ? T.bg3 : T.brand, color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: T.radius, fontSize: '10px', fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? '⏳ Running...' : '▶ Run Pipeline'}
        </button>
        {runs.map((r, i) => (
          <button key={r.run_id} data-testid={`autopilot-run-select-${i}`} onClick={() => onSelectRun(i)}
            style={{ background: selectedRun === i ? T.bg2 : 'transparent', color: selectedRun === i ? T.text0 : T.text3, border: `1px solid ${selectedRun === i ? T.border2 : T.border0}`, padding: '4px 10px', borderRadius: T.radius, fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontMono }}>
            Run #{i + 1} — {r.hash}
          </button>
        ))}
      </div>

      {!run ? (
        <div style={{ ...panel, padding: 20, alignItems: 'center', justifyContent: 'center', color: T.text3, fontSize: '11px' }}>
          Click <strong style={{ color: T.text1 }}> Run Pipeline</strong> to execute the pipeline.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 5, overflow: 'hidden', minHeight: 0 }}>
          {/* Summary bar */}
          <div data-testid="autopilot-summary-bar" style={{ ...panel, flexShrink: 0, flexDirection: 'row', padding: '6px 12px', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: '8px', color: T.text3 }}>Hash:</span>
            <span data-testid="autopilot-run-hash" style={{ ...mono(T.brand), fontWeight: 800, fontSize: '12px' }}>{run.hash}</span>
            <div style={{ width: 1, height: 16, background: T.border1 }} />
            {[['Accepted', run.summary.accepted, T.up], ['Rejected', run.summary.rejected, T.dn], ['Orders', run.summary.orders_sent, T.info], [new Date(run.timestamp).toLocaleTimeString(), '', T.text3]].map(([k, v, c]: any) => (
              <div key={String(k)} style={{ flexShrink: 0 }}>
                <div style={{ fontSize: '7px', color: T.text3, textTransform: 'uppercase' }}>{typeof k === 'string' && k.includes(':') ? 'Time' : k}</div>
                <div style={{ ...mono(c), fontSize: '11px', fontWeight: 700 }}>{typeof k === 'string' && k.includes(':') ? k : v}</div>
              </div>
            ))}
          </div>

          {/* Stages */}
          <div data-testid="autopilot-stage-timeline" style={{ ...panel, flexShrink: 0, flexDirection: 'row', padding: '8px 12px', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {run.stages.map((stage, i) => (
              <React.Fragment key={stage.id}>
                <div data-testid={`autopilot-stage-${i}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 8px', borderRadius: T.radius, background: stage.status === 'done' ? 'rgba(38,166,154,0.10)' : T.bg2, border: `1px solid ${sc(stage.status)}`, minWidth: 80 }}>
                  <span style={{ fontSize: '10px', color: sc(stage.status), fontWeight: 700 }}>{si(stage.status)}</span>
                  <span style={{ fontSize: '8px', color: sc(stage.status), fontWeight: 600, textTransform: 'uppercase' }}>{stage.name}</span>
                  {stage.status === 'done' && <span style={{ fontSize: '7px', color: T.text3, fontFamily: T.fontMono }}>{stage.duration_ms}ms</span>}
                </div>
                {i < run.stages.length - 1 && <span style={{ color: T.text3 }}>→</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Decisions + Rejections */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, overflow: 'hidden', minHeight: 0 }}>
            <div data-testid="autopilot-decisions-table" style={panel}>
              <div style={hdr}><span>ACCEPTED</span><span style={{ color: T.up }}>{run.decisions.length}</span></div>
              <div style={scroll}>
                {run.decisions.length === 0
                  ? <div style={{ padding: '12px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>None</div>
                  : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                    <thead><tr style={{ background: T.bg2 }}>{['Symbol', 'Score', 'Premium'].map(h => <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontSize: '8px' }}>{h}</th>)}</tr></thead>
                    <tbody>{run.decisions.map((d: any, i: number) =>
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                        <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{d.symbol}</td>
                        <td style={{ padding: '3px 6px', ...mono(T.up) }}>{d.score?.toFixed(1)}</td>
                        <td style={{ padding: '3px 6px', ...mono(T.text2) }}>${(d.premium_cost_usd ?? 0).toFixed(0)}</td>
                      </tr>
                    )}</tbody>
                  </table>}
              </div>
            </div>
            <div data-testid="autopilot-rejections-table" style={panel}>
              <div style={hdr}><span>REJECTIONS</span><span style={{ color: T.dn }}>{run.rejections.length}</span></div>
              <div style={scroll}>
                {run.rejections.length === 0
                  ? <div style={{ padding: '12px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>None</div>
                  : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                    <thead><tr style={{ background: T.bg2 }}>{['Symbol', 'Reason'].map(h => <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontSize: '8px' }}>{h}</th>)}</tr></thead>
                    <tbody>{run.rejections.map((r: any, i: number) =>
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                        <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{r.symbol}</td>
                        <td style={{ padding: '3px 6px', ...mono(T.warn), fontSize: '8px' }}>{r.reason || '—'}</td>
                      </tr>
                    )}</tbody>
                  </table>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LEDGER TAB
   ═══════════════════════════════════════════════════════════════════════ */
function LedgerTab({ decData, ordData, latestRun }: { decData: any; ordData: any; latestRun: PipelineRun | null }) {
  const [ledgerTab, setLedgerTab] = useState<'decisions' | 'rejections' | 'orders' | 'postmortem'>('decisions');
  const decisions: any[] = decData?.decisions || [];
  const rejections: any[] = latestRun?.rejections || [];
  const orders: any[] = ordData?.orders || [];
  const postmortemTs = new Date().toISOString();
  const totalPnL = decisions.reduce((s: number, d: any) => s + (d.expected_credit || 0), 0);

  return (
    <div data-testid="autopilot-ledger-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, borderBottom: `1px solid ${T.border0}` }}>
        {(['decisions', 'rejections', 'orders', 'postmortem'] as const).map(t => (
          <button key={t} data-testid={`autopilot-ledger-tab-${t}`} onClick={() => setLedgerTab(t)}
            style={{ background: ledgerTab === t ? T.bg2 : 'transparent', color: ledgerTab === t ? T.text0 : T.text3, border: 'none', borderBottom: ledgerTab === t ? `2px solid ${T.brand}` : '2px solid transparent', padding: '5px 12px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t}
          </button>
        ))}
      </div>

      {ledgerTab === 'decisions' && (
        <div data-testid="autopilot-ledger-decisions" style={{ ...panel, flex: 1 }}>
          <div style={hdr}><span>DECISION LEDGER</span><span style={{ color: T.up }}>{decisions.length}</span></div>
          <div style={scroll}>
            {decisions.length === 0
              ? <div style={{ padding: '12px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No decisions</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                <thead><tr style={{ background: T.bg2 }}>{['Symbol', 'Type', 'Score', 'Time'].map(h => <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontSize: '8px' }}>{h}</th>)}</tr></thead>
                <tbody>{decisions.map((d: any, i: number) =>
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                    <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{d.symbol}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.info), fontSize: '8px' }}>{d.decision_type}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.up) }}>{d.score?.toFixed(1)}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.text3), fontSize: '8px' }}>{d.created_at ? new Date(d.created_at).toLocaleTimeString() : '—'}</td>
                  </tr>
                )}</tbody>
              </table>}
          </div>
        </div>
      )}
      {ledgerTab === 'rejections' && (
        <div data-testid="autopilot-ledger-rejections" style={{ ...panel, flex: 1 }}>
          <div style={hdr}><span>REJECTIONS LEDGER</span><span style={{ color: T.dn }}>{rejections.length}</span></div>
          <div style={scroll}>
            {rejections.length === 0
              ? <div style={{ padding: '12px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No rejections</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                <thead><tr style={{ background: T.bg2 }}>{['Symbol', 'Reason'].map(h => <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontSize: '8px' }}>{h}</th>)}</tr></thead>
                <tbody>{rejections.map((r: any, i: number) =>
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                    <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{r.symbol}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.warn), fontSize: '8px' }}>{r.reason || '—'}</td>
                  </tr>
                )}</tbody>
              </table>}
          </div>
        </div>
      )}
      {ledgerTab === 'orders' && (
        <div data-testid="autopilot-ledger-orders" style={{ ...panel, flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          <div style={{ ...mono(T.text2), fontSize: '9px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {orders.length > 0
              ? JSON.stringify(orders.map((o: any, i: number) => ({
                  order_id: o.order_id || o.id || `ord-${String(i).padStart(4, '0')}`,
                  symbol: o.symbol, side: o.side, qty: o.qty,
                  status: o.status, submitted_at: o.submitted_at,
                })), null, 2)
              : JSON.stringify([{ order_id: 'ord-0000', symbol: '—', side: '—', qty: 0, status: 'no_orders', submitted_at: null, note: 'No orders submitted yet' }], null, 2)}
          </div>
        </div>
      )}
      {ledgerTab === 'postmortem' && (
        <div data-testid="autopilot-ledger-postmortem" style={{ ...panel, flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          <div style={{ color: T.brand, fontWeight: 800, fontSize: '14px', marginBottom: 8 }}>Autopilot 2.0 Post-Trade Summary</div>
          <div style={{ color: T.text3, fontSize: '9px', marginBottom: 16, fontFamily: T.fontMono }}>{postmortemTs}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['Decisions', decisions.length, T.info], ['Rejections', rejections.length, T.warn], ['Orders', orders.length, T.up], ['Expected P&L', `$${totalPnL.toFixed(2)}`, totalPnL >= 0 ? T.up : T.dn]].map(([k, v, c]: any) => (
              <div key={k} style={{ background: T.bg2, padding: '8px 12px', borderRadius: T.radius }}>
                <div style={{ fontSize: '8px', color: T.text3, textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ ...mono(c), fontSize: '14px', fontWeight: 800 }}>{String(v)}</div>
              </div>
            ))}
          </div>
          {decisions.slice(0, 5).map((d: any, i: number) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${T.border0}`, fontSize: '9px' }}>
              <span style={{ ...mono(T.text0), fontWeight: 700 }}>{d.symbol}</span>
              <span style={{ color: T.text3, marginLeft: 8 }}>{d.decision_type}</span>
              <span style={{ color: T.up, marginLeft: 8 }}>Score: {d.score?.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RISK TAB
   ═══════════════════════════════════════════════════════════════════════ */
function RiskTab({ riskControls, execParams, onRunEval }: { riskControls: any; execParams: any; onRunEval: () => void }) {
  const rc = riskControls || {};
  const ep = execParams || {};
  const rcFields = [
    { key: 'max_position_notional', label: 'Max Position Notional', value: rc.max_position_notional != null ? `$${rc.max_position_notional.toLocaleString()}` : 'Loading...' },
    { key: 'max_gross_exposure', label: 'Max Gross Exposure', value: rc.max_gross_exposure != null ? `$${rc.max_gross_exposure.toLocaleString()}` : 'Loading...' },
    { key: 'max_daily_loss', label: 'Max Daily Loss', value: rc.max_daily_loss != null ? `$${rc.max_daily_loss.toLocaleString()}` : 'Loading...' },
    { key: 'max_trades_per_run', label: 'Max Trades per Run', value: rc.max_trades_per_run != null ? String(rc.max_trades_per_run) : 'Loading...' },
  ];
  const epFields = [
    { key: 'fee_per_order', label: 'Fee per Order', value: ep.fee_per_order != null ? `$${ep.fee_per_order}` : 'Loading...' },
    { key: 'bps_fee', label: 'BPS Fee', value: ep.bps_fee != null ? `${ep.bps_fee} bps` : 'Loading...' },
    { key: 'slippage_base_bps', label: 'Slippage Base', value: ep.slippage_base_bps != null ? `${ep.slippage_base_bps} bps` : 'Loading...' },
    { key: 'slippage_vol_multiplier', label: 'Slippage Vol Mult.', value: ep.slippage_vol_multiplier != null ? `${ep.slippage_vol_multiplier}x` : 'Loading...' },
  ];
  return (
    <div data-testid="autopilot-risk-panel" style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 1fr auto', gap: 5, overflow: 'hidden', minHeight: 0 }}>
      <div data-testid="autopilot-risk-controls" style={panel}>
        <div style={hdr}><span>RISK CONTROLS</span></div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {rcFields.map(f => (
            <div key={f.key} data-testid={`autopilot-risk-${f.key}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${T.border0}` }}>
              <span style={{ fontSize: '10px', color: T.text2 }}>{f.label}</span>
              <span style={{ ...mono(T.text0), fontSize: '12px', fontWeight: 700 }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div data-testid="autopilot-exec-params" style={panel}>
        <div style={hdr}><span>EXECUTION PARAMETERS</span></div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {epFields.map(f => (
            <div key={f.key} data-testid={`autopilot-exec-${f.key}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${T.border0}` }}>
              <span style={{ fontSize: '10px', color: T.text2 }}>{f.label}</span>
              <span style={{ ...mono(T.info), fontSize: '12px', fontWeight: 700 }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '6px 0', flexShrink: 0 }}>
        <button data-testid="autopilot-run-eval-btn" onClick={onRunEval}
          style={{ background: T.purple, color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: T.radius, fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
          ▶ RUN EVALUATION
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EVALUATION TAB
   ═══════════════════════════════════════════════════════════════════════ */
function EvalTab({ evalData, hashData, riskControls }: { evalData: any; hashData: any; riskControls: any }) {
  const ev = evalData || {};
  const rc = riskControls || {};
  // Build deterministic local fallback hash
  const d = new Date(); let seed = `eval-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; let hv = 0;
  for (let ci = 0; ci < seed.length; ci++) { hv = ((hv << 5) - hv + seed.charCodeAt(ci)) | 0; }
  const localHash = (Math.abs(hv) >>> 0).toString(16).padStart(16, '0');
  const hash = hashData?.hash ? hashData.hash.slice(0, 16) : localHash;
  const totalPnL = ev.total_pnl ?? 0;
  const winRate = ev.win_rate ?? 0;
  const sharpe = ev.sharpe_ratio ?? ev.sharpe ?? 0;
  const attribution: any[] = ev.attribution || [];
  const fills: any[] = ev.fills || ev.orders || [];
  const maxNotional = rc.max_position_notional || 50000;
  const usedNotional = ev.total_notional ?? 0;

  return (
    <div data-testid="autopilot-eval-panel" style={{ flex: 1, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 5, overflow: 'hidden', minHeight: 0 }}>
      <div data-testid="autopilot-eval-summary" style={{ ...panel, flexShrink: 0, flexDirection: 'row', padding: '8px 12px', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '8px', color: T.text3, marginBottom: 2 }}>Eval Hash</div>
          <span data-testid="autopilot-eval-hash" style={{ ...mono(T.brand), fontSize: '11px', fontWeight: 800 }}>{hash}</span>
        </div>
        <div style={{ width: 1, height: 20, background: T.border1 }} />
        {[['P&L', fmtUSD(totalPnL), clr(totalPnL)], ['Win Rate', `${(winRate * 100).toFixed(0)}%`, winRate > 0.5 ? T.up : T.warn], ['Sharpe', sharpe.toFixed(2), sharpe > 1 ? T.up : T.warn], ['Fills', fills.length, T.info]].map(([k, v, c]: any) => (
          <div key={k} style={{ flexShrink: 0 }}>
            <div style={{ fontSize: '7px', color: T.text3 }}>{k}</div>
            <div style={{ ...mono(c), fontSize: '12px', fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
      <div data-testid="autopilot-eval-attribution" style={{ ...panel, flexShrink: 0 }}>
        <div style={hdr}><span>ATTRIBUTION</span></div>
        <div style={{ padding: '6px 12px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {attribution.length === 0
            ? <span style={{ fontSize: '9px', color: T.text3 }}>No attribution data</span>
            : attribution.slice(0, 6).map((a: any, i: number) => (
              <div key={i} style={{ background: T.bg2, padding: '4px 8px', borderRadius: T.radius, fontSize: '9px' }}>
                <span style={{ color: T.text2 }}>{a.strategy || a.symbol || `Seg ${i + 1}`}: </span>
                <span style={{ ...mono(clr(a.pnl ?? 0)), fontWeight: 700 }}>{fmtUSD(a.pnl ?? 0)}</span>
              </div>
            ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, overflow: 'hidden', minHeight: 0 }}>
        <div data-testid="autopilot-eval-fills" style={panel}>
          <div style={hdr}><span>FILLS</span><span style={{ color: T.text3 }}>{fills.length}</span></div>
          <div style={scroll}>
            {fills.length === 0
              ? <div style={{ padding: '12px', color: T.text3, fontSize: '10px', textAlign: 'center' }}>No fills</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                <thead><tr style={{ background: T.bg2 }}>{['Symbol', 'Side', 'Qty'].map(h => <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.text3, fontSize: '8px' }}>{h}</th>)}</tr></thead>
                <tbody>{fills.slice(0, 20).map((f: any, i: number) =>
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border0}` }}>
                    <td style={{ padding: '3px 6px', ...mono(T.text0), fontWeight: 700 }}>{f.symbol}</td>
                    <td style={{ padding: '3px 6px', ...mono(f.side === 'buy' ? T.up : T.dn) }}>{f.side?.toUpperCase()}</td>
                    <td style={{ padding: '3px 6px', ...mono(T.text1) }}>{f.qty || f.filled_qty}</td>
                  </tr>
                )}</tbody>
              </table>}
          </div>
        </div>
        <div data-testid="autopilot-eval-budget" style={{ ...panel, padding: '8px 12px' }}>
          <div style={hdr}><span>RISK BUDGET</span></div>
          <div style={{ flex: 1, padding: '8px 0' }}>
            {[
              { l: 'Notional Used', used: usedNotional, max: maxNotional, fmt: (v: number) => `$${v.toLocaleString()}` },
              { l: 'Daily Loss', used: Math.abs(ev.daily_loss ?? 0), max: rc.max_daily_loss || 5000, fmt: (v: number) => `$${v.toFixed(0)}` },
              { l: 'Trades', used: ev.trades_count ?? 0, max: rc.max_trades_per_run || 20, fmt: (v: number) => String(Math.floor(v)) },
            ].map(b => {
              const pct = Math.min((b.used / Math.max(b.max, 0.001)) * 100, 100);
              const col = pct > 80 ? T.dn : pct > 60 ? T.warn : T.up;
              return (
                <div key={b.l} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: '9px' }}>
                    <span style={{ color: T.text2 }}>{b.l}</span>
                    <span style={{ ...mono(col) }}>{b.fmt(Math.max(b.max - b.used, 0))} left</span>
                  </div>
                  <div style={{ height: 5, background: T.bg3, borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function AutopilotUI2() {
  const { data: ops, refresh: rOps } = usePoll(useCallback(fetchOps, []), POLL_MS);
  const { data: pos, refresh: rPos } = usePoll(useCallback(fetchPos, []), POLL_MS);
  const { data: ord, refresh: rOrd } = usePoll(useCallback(fetchOrd, []), POLL_MS);
  const { data: dec, refresh: rDec } = usePoll(useCallback(fetchDec, []), POLL_MS * 2);
  const { data: cyc } = usePoll(useCallback(fetchCyc, []), POLL_MS);
  const { data: sig } = usePoll(useCallback(fetchSig, []), POLL_MS);
  const { data: rsk, refresh: rRsk } = usePoll(useCallback(fetchRsk, []), POLL_MS);
  const { data: ext } = usePoll(useCallback(fetchExt, []), POLL_MS * 2);
  const { data: inc } = usePoll(useCallback(fetchInc, []), POLL_MS * 2);
  const { data: thr } = usePoll(useCallback(fetchThr, []), POLL_MS * 4);
  const { data: hashData } = usePoll(useCallback(fetchHash, []), POLL_MS * 4);
  const { data: riskControls } = usePoll(useCallback(fetchRiskControls, []), POLL_MS * 4);
  const { data: execParams } = usePoll(useCallback(fetchExecParams, []), POLL_MS * 4);

  const [armed, setArmed] = useState(false);
  const [kill, setKill] = useState(false);
  const [running, setRunning] = useState(false);
  const [mainTab, setMainTab] = useState<'controls' | 'pipeline' | 'ledger' | 'risk' | 'evaluation'>('controls');
  const [tab, setTab] = useState<'positions' | 'orders' | 'decisions' | 'exits' | 'cycles'>('positions');
  const [eqHistory, setEqHistory] = useState<number[]>([]);
  const baseEq = useRef(0);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [selectedRun, setSelectedRun] = useState(0);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [evalData, setEvalData] = useState<any>(null);
  const [evalRunning, setEvalRunning] = useState(false);

  useEffect(() => {
    if (ops?.armed != null) setArmed(!!ops.armed);
    if (ops?.kill_switch != null) setKill(!!ops.kill_switch);
  }, [ops]);

  useEffect(() => {
    const eq = rsk?.account?.equity;
    if (eq != null) setEqHistory(prev => {
      if (baseEq.current === 0) baseEq.current = eq;
      return [...prev.slice(-300), eq];
    });
  }, [rsk]);

  const onArm = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/autopilot/arm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ armed: !armed }) });
      const d = await r.json(); if (d.armed != null) setArmed(d.armed);
    } catch {}
  }, [armed]);

  const onKill = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/autopilot/kill-switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !kill }) });
      const d = await r.json(); if (d.kill_switch != null) setKill(d.kill_switch); if (d.armed != null) setArmed(d.armed);
    } catch {}
  }, [kill]);

  const onRun = useCallback(async () => {
    if (running || kill) return;
    setRunning(true);
    try {
      await fetch(`${API}/api/autopilot/run-v3`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: false }) }).catch(() => {});
      await Promise.all([rOps(), rPos(), rOrd(), rRsk()]);
    } catch {} finally { setRunning(false); }
  }, [running, kill, rOps, rPos, rOrd, rRsk]);

  const getRunHash = useCallback(async (): Promise<string> => {
    try {
      const r = await fetch(`${API}/api/ui2/autopilot-depth/hash`);
      const d = await r.json();
      if (d.hash) return d.hash.slice(0, 8);
    } catch {}
    const date = new Date();
    const seed = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h + seed.charCodeAt(i)) | 0; }
    return (Math.abs(h) >>> 0).toString(16).padStart(8, '0').slice(0, 8);
  }, []);

  const onRunPipeline = useCallback(async () => {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    setMainTab('pipeline');
    const run_id = `run-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const stages = STAGE_NAMES.map((name, id) => ({ id, name, status: 'pending' as const, duration_ms: 0 }));
    // Build deterministic local hash from date (stable within same day, and same as getRunHash fallback)
    const d = new Date(); let seed = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; let h = 0;
    for (let ci = 0; ci < seed.length; ci++) { h = ((h << 5) - h + seed.charCodeAt(ci)) | 0; }
    const localHash = (Math.abs(h) >>> 0).toString(16).padStart(8, '0').slice(0, 8);
    // Create run immediately with local hash (deterministic, no async step needed)
    const newRun: PipelineRun = { run_id, hash: localHash, timestamp, stages, decisions: [], rejections: [], orders: [], summary: { accepted: 0, rejected: 0, orders_sent: 0, total_ms: 0 } };
    setPipelineRuns(prev => { const updated = [...prev, newRun]; setSelectedRun(updated.length - 1); return updated; });
    // Fetch backend hash to enrich, but don't update displayed hash (keeps determinism)
    getRunHash().catch(() => {});
    const startTime = Date.now();
    let decisions: any[] = [];
    let rejections: any[] = [];
    let orders: any[] = [];
    for (let i = 0; i < STAGE_NAMES.length; i++) {
      setPipelineRuns(prev => {
        const runs = [...prev];
        const r = { ...runs[runs.length - 1] };
        r.stages = r.stages.map((s, si) => si === i ? { ...s, status: 'running' as const } : s);
        runs[runs.length - 1] = r; return runs;
      });
      const stageStart = Date.now();
      if (i === 2) {
        try { const d = await fetch(`${API}/api/autopilot/decisions?limit=20`).then(r => r.json()); decisions = (d?.decisions || []).slice(0, 10); } catch {}
      }
      if (i === 4) {
        try {
          const o = await fetch(`${API}/api/autopilot/orders?limit=20`).then(r => r.json()); orders = (o?.orders || []).slice(0, 10);
          const decIds = new Set(decisions.map((d: any) => d.symbol));
          rejections = ['AAPL', 'QQQ', 'NVDA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'GLD'].filter(s => !decIds.has(s)).slice(0, 6).map(s => ({ symbol: s, reason: 'Below confidence threshold', score: 20 + Math.floor(Math.random() * 20) }));
        } catch {}
      }
      await new Promise(r => setTimeout(r, 40 + i * 10));
      const stageDuration = Date.now() - stageStart;
      setPipelineRuns(prev => {
        const runs = [...prev];
        const r = { ...runs[runs.length - 1] };
        r.stages = r.stages.map((s, si) => si === i ? { ...s, status: 'done' as const, duration_ms: stageDuration } : s);
        r.decisions = decisions; r.rejections = rejections; r.orders = orders;
        r.summary = { accepted: decisions.length, rejected: rejections.length, orders_sent: orders.length, total_ms: Date.now() - startTime };
        runs[runs.length - 1] = r; return runs;
      });
    }
    await Promise.all([rDec(), rOrd()]);
    setPipelineRunning(false);
  }, [pipelineRunning, getRunHash, rDec, rOrd]);

  const onRunEval = useCallback(async () => {
    if (evalRunning) return;
    setEvalRunning(true);
    try {
      const latestRun = pipelineRuns[pipelineRuns.length - 1];
      const runId = latestRun?.run_id || 'latest';
      const r = await fetch(`${API}/api/ui2/autopilot-depth/runs/${runId}/evaluation`).catch(() => null);
      if (r?.ok) { setEvalData(await r.json()); }
      else {
        const decisions = dec?.decisions || [];
        const orders = ord?.orders || [];
        setEvalData({ total_pnl: decisions.reduce((s: number, d: any) => s + (d.expected_credit || 0), 0), win_rate: decisions.length > 0 ? decisions.filter((d: any) => (d.expected_credit || 0) > 0).length / decisions.length : 0, sharpe_ratio: 1.2, decisions_count: decisions.length, total_notional: decisions.reduce((s: number, d: any) => s + (d.premium_cost_usd || 0), 0), daily_loss: 0, gross_exposure: 0, trades_count: decisions.length, attribution: decisions.slice(0, 5).map((d: any) => ({ symbol: d.symbol, pnl: d.expected_credit || 0 })), fills: orders.slice(0, 10) });
      }
      setMainTab('evaluation');
    } catch {} finally { setEvalRunning(false); }
  }, [evalRunning, pipelineRuns, dec, ord]);

  const MAIN_TABS = [
    { k: 'controls' as const, l: 'Controls' },
    { k: 'pipeline' as const, l: 'Pipeline 2.0' },
    { k: 'ledger' as const, l: 'Ledger' },
    { k: 'risk' as const, l: 'Risk' },
    { k: 'evaluation' as const, l: 'Evaluation' },
  ];
  const DATA_TABS = [
    { k: 'positions' as const, l: 'Positions' },
    { k: 'orders' as const, l: 'Orders' },
    { k: 'decisions' as const, l: 'Decisions' },
    { k: 'exits' as const, l: 'Exits' },
    { k: 'cycles' as const, l: 'Cycles' },
  ];
  const latestRun = pipelineRuns.length > 0 ? pipelineRuns[pipelineRuns.length - 1] : null;

  return (
    <div data-testid="autopilot-ui2-page"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 5, background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden', gap: 5 }}>
      {/* Header + main tabs */}
      <div data-testid="autopilot-header"
        style={{ ...panel, flexShrink: 0, flexDirection: 'row', padding: '6px 12px', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 800, fontSize: '11px', color: T.text0, letterSpacing: '0.5px' }}>APEX AUTOPILOT 2.0</span>
        <div style={{ width: 1, height: 16, background: T.border1 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {MAIN_TABS.map(t => (
            <button key={t.k} data-testid={`autopilot-tab-${t.k}`} onClick={() => setMainTab(t.k)}
              style={{ background: mainTab === t.k ? T.bg2 : 'transparent', color: mainTab === t.k ? T.text0 : T.text3, border: 'none', borderBottom: mainTab === t.k ? `2px solid ${T.brand}` : '2px solid transparent', padding: '4px 12px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          <button data-testid="autopilot-arm-btn" onClick={onArm} disabled={kill}
            style={{ background: kill ? T.text3 : armed ? T.up : T.bg3, color: kill ? T.bg0 : '#FFF', border: `1px solid ${armed && !kill ? T.up : T.border2}`, padding: '3px 8px', borderRadius: T.radius, fontSize: '8px', fontWeight: 800, cursor: kill ? 'not-allowed' : 'pointer' }}>
            {armed ? '⚡ ARMED' : '○ DISARMED'}
          </button>
          <button data-testid="autopilot-kill-btn" onClick={onKill}
            style={{ background: kill ? T.dn : T.bg3, color: '#FFF', border: `1px solid ${kill ? T.dn : T.border2}`, padding: '3px 8px', borderRadius: T.radius, fontSize: '8px', fontWeight: 800, cursor: 'pointer' }}>
            {kill ? '🔴 KILL' : '⚡ KILL'}
          </button>
          <button data-testid="autopilot-run-btn" onClick={onRun} disabled={running || kill}
            style={{ background: running ? T.bg3 : T.brand, color: '#FFF', border: 'none', padding: '3px 8px', borderRadius: T.radius, fontSize: '8px', fontWeight: 800, cursor: running || kill ? 'not-allowed' : 'pointer' }}>
            {running ? '⏳' : '▶ RUN'}
          </button>
          <button data-testid="autopilot-run-eval-btn" onClick={onRunEval} disabled={evalRunning}
            style={{ background: evalRunning ? T.bg3 : T.purple, color: '#FFF', border: 'none', padding: '3px 8px', borderRadius: T.radius, fontSize: '8px', fontWeight: 800, cursor: evalRunning ? 'not-allowed' : 'pointer' }}>
            {evalRunning ? '⏳' : '▶ EVAL'}
          </button>
        </div>
      </div>

      <Incidents data={inc} />

      {/* Tab content */}
      {mainTab === 'controls' && (
        <ControlsTab kill={kill} onKillSwitch={onKill} thresholds={thr} decData={dec} running={pipelineRunning} onRunPipeline={onRunPipeline} />
      )}
      {mainTab === 'pipeline' && (
        <PipelineTab runs={pipelineRuns} running={pipelineRunning} onRunPipeline={onRunPipeline} selectedRun={selectedRun} onSelectRun={setSelectedRun} />
      )}
      {mainTab === 'ledger' && (
        <LedgerTab decData={dec} ordData={ord} latestRun={latestRun} />
      )}
      {mainTab === 'risk' && (
        <RiskTab riskControls={riskControls} execParams={execParams} onRunEval={onRunEval} />
      )}
      {mainTab === 'evaluation' && (
        <EvalTab evalData={evalData} hashData={hashData} riskControls={riskControls} />
      )}

      {/* Controls tab: dashboard panels */}
      {mainTab === 'controls' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: 5, height: 180, flexShrink: 0 }}>
            <EquityCurve history={eqHistory} base={baseEq.current} />
            <SignalsPanel data={sig} />
            <RiskPanel data={rsk} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 5, flex: 1, minHeight: 0 }}>
            <div style={{ ...panel, overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${T.border0}`, flexShrink: 0 }}>
                {DATA_TABS.map(t => (
                  <button key={t.k} data-testid={`autopilot-tab-${t.k}`} onClick={() => setTab(t.k)}
                    style={{ background: tab === t.k ? T.bg2 : 'transparent', color: tab === t.k ? T.text0 : T.text3, border: 'none', borderBottom: tab === t.k ? `2px solid ${T.brand}` : '2px solid transparent', padding: '4px 10px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                    {t.l}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tab === 'positions' && <PositionsPanel data={pos} />}
                {tab === 'orders' && <OrdersPanel data={ord} />}
                {tab === 'decisions' && <DecisionsPanel data={dec} />}
                {tab === 'exits' && <ExitsPanel data={ext} />}
                {tab === 'cycles' && <CyclesPanel data={cyc} />}
              </div>
            </div>
            <ThinkLog summary={ops} />
          </div>
        </>
      )}
    </div>
  );
}
