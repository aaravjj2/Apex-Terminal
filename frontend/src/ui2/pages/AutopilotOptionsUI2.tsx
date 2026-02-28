/**
 * AutopilotOptionsUI2 — Real Options Autopilot Command Center
 *
 * Tabs: Controls | Decisions | Rejections | Orders | Positions | PnL | LLM | Health
 * Fetches from /api/autopilot-options/* — NO demo/mock data.
 * All elements carry data-testid for Playwright E2E.
 */

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Pill, StatusBadge, DataTable, type ColumnDef } from '../components';

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthData {
  armed: boolean;
  kill_switch_active: boolean;
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
  };
  loop: {
    last_loop_ts: string | null;
    last_decision_id: string | null;
    last_error: string | null;
    cycles_run: number;
  };
  risk_controls: Record<string, number>;
  universe: string[];
  correlation_id: string;
}

interface Decision {
  decision_id: string;
  symbol: string;
  timestamp: string;
  // brain_v2 uses decision_type; legacy used action
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
    limit_price_rule?: string;
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
  // legacy
  features?: Record<string, unknown>;
  risk_checks_passed?: boolean;
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
  action?: string;
  reason: string;
  detail: string;
  hard_rule?: string;
  candidates_count?: number;
  candidates_accepted?: number;
  rejection_counts?: Record<string, number>;
  correlation_id: string;
}

// Candidates snapshot (from /debug-snapshot)
interface CandidateResult {
  symbol: string;
  spot: number;
  chain_fetch_ok: boolean;
  contracts_fetched: number;
  candidates_total: number;
  candidates_accepted: number;
  rejection_counts: Record<string, number>;
  winner: {
    contract_symbol: string;
    strike: number;
    expiry: string;
    dte: number;
    bid: number;
    ask: number;
    mid: number;
    spread_pct: number;
    delta: number | null;
    iv: number | null;
    score: number;
  } | null;
  top_3: Array<{
    symbol: string;
    score: number;
    spread_pct: number;
    dte: number;
    delta: number | null;
    mid: number;
  }>;
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
  correlation_id: string;
}

interface LLMStatus {
  provider: string;
  gemini_available: boolean;
  groq_available: boolean;
  cache_size: number;
  total_calls: number;
  cache_hit_rate: number;
  budget_remaining: number;
  budget_max: number;
  last_error: string | null;
}

interface ConnectivityData {
  paper_base_url: string;
  connected: boolean;
  latency_ms: number;
  options_enabled: boolean;
  options_trading_level: number | null;
  options_buying_power: number | null;
  equity: number | null;
  last_chain_fetch_ts: string | null;
  last_quote_ts: string | null;
  correlation_id: string;
}

interface OptionPosition {
  symbol: string;
  qty: number;
  side: string;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  market_value: number;
  asset_class: string;
}

interface OptionOrder {
  id: string;
  symbol: string;
  qty: number;
  side: string;
  type: string;
  status: string;
  limit_price: number | null;
  filled_avg_price: number | null;
  submitted_at: string;
}

// ── V3 Types ─────────────────────────────────────────────────────────────────

interface V3Position {
  position_id: string;
  contract_symbol: string;
  symbol: string;
  option_type: string;
  avg_entry: number;
  qty: number;
  status: string;
  unrealized_pnl_pct: number | null;
  unrealized_pnl: number | null;
  current_price: number | null;
  exit_trigger: string | null;
  dte_at_open: number | null;
  spread_pct_at_open: number | null;
  delta_at_open: number | null;
  opened_at: string;
  held_days?: number;
}

interface V3Evaluation {
  eval_id: string;
  symbol: string;
  realized_pnl_pct: number;
  mae_pct: number;
  mfe_pct: number;
  direction_correct: boolean | null;
  exit_reason: string | null;
  held_days: number;
  entry_spread_pct: number | null;
  entry_dte: number | null;
  entry_delta: number | null;
  entry_signal_direction: string | null;
  created_at: string;
}

interface ThresholdHistoryEntry {
  change_id: string;
  trigger_reason: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  trade_sample_n: number;
  win_rate: number | null;
  notes: string | null;
  created_at: string;
}

interface OpsSummary {
  stats: {
    total_cycles: number;
    total_decisions: number;
    total_rejections: number;
    total_orders: number;
    total_positions: number;
    open_positions: number;
    total_exits: number;
    total_evaluations: number;
    total_incidents: number;
    unresolved_incidents: number;
  };
  last_cycle: Record<string, unknown> | null;
  invariants: { ok: boolean; violations: string[] };
  unresolved_incidents: Array<{ incident_id: string; level: string; title: string; detail: string; created_at: string }>;
  current_thresholds: Record<string, unknown>;
  armed: boolean;
  kill_switch: boolean;
}

// ── Tab definition ───────────────────────────────────────────────────────────

type TabKey = 'controls' | 'decisions' | 'rejections' | 'orders' | 'positions' | 'pnl' | 'llm' | 'health' | 'candidates' | 'positions-v3' | 'evaluations' | 'thresholds' | 'ops-v3';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'controls', label: 'Controls' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'rejections', label: 'Rejections' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'orders', label: 'Orders' },
  { key: 'positions', label: 'Positions' },
  { key: 'positions-v3', label: 'Positions V3' },
  { key: 'evaluations', label: 'Evaluations' },
  { key: 'thresholds', label: 'Thresholds' },
  { key: 'ops-v3', label: 'Ops V3' },
  { key: 'pnl', label: 'PnL' },
  { key: 'llm', label: 'LLM' },
  { key: 'health', label: 'Health' },
];

// ── API helpers ──────────────────────────────────────────────────────────────

const BASE = '/api/autopilot-options';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  return res.json();
}

// ── Component ────────────────────────────────────────────────────────────────

export function AutopilotOptionsUI2() {
  const [tab, setTab] = useState<TabKey>('controls');

  // State
  const [health, setHealth] = useState<HealthData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityData | null>(null);
  const [positions, setPositions] = useState<OptionPosition[]>([]);
  const [orders, setOrders] = useState<OptionOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [candidatesData, setCandidatesData] = useState<Record<string, CandidateResult> | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // V3 state
  const [v3Positions, setV3Positions] = useState<V3Position[]>([]);
  const [evaluations, setEvaluations] = useState<V3Evaluation[]>([]);
  const [thresholdData, setThresholdData] = useState<{
    current_thresholds: Record<string, unknown>;
    history: ThresholdHistoryEntry[];
  } | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [v3ExitProposals, setV3ExitProposals] = useState<Array<{
    contract_symbol: string;
    exit_reason: string;
    pnl_pct: number;
    trigger_detail: string;
  }>>([]);

  // Derived
  const armed = health?.armed ?? false;
  const killSwitchActive = health?.kill_switch_active ?? false;
  const marketOpen = health?.market_session?.is_open ?? false;

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    try {
      const data = await apiFetch<HealthData>('/health');
      setHealth(data);
    } catch { /* noop */ }
  }, []);

  const fetchDecisions = useCallback(async () => {
    try {
      const data = await apiFetch<{ decisions: Decision[] }>('/decisions?limit=50');
      setDecisions(data.decisions ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchRejections = useCallback(async () => {
    try {
      const data = await apiFetch<{ rejections: Rejection[] }>('/rejections?limit=50');
      setRejections(data.rejections ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchPnl = useCallback(async () => {
    try {
      const data = await apiFetch<PnlData>('/pnl');
      setPnl(data);
    } catch { /* noop */ }
  }, []);

  const fetchLlm = useCallback(async () => {
    try {
      const data = await apiFetch<LLMStatus>('/llm/status');
      setLlmStatus(data);
    } catch { /* noop */ }
  }, []);

  const fetchConnectivity = useCallback(async () => {
    try {
      const data = await apiFetch<ConnectivityData>('/options/connectivity');
      setConnectivity(data);
    } catch { /* noop */ }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const data = await apiFetch<{ positions: OptionPosition[]; count: number }>('/options/positions');
      setPositions(data.positions ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: OptionOrder[]; count: number }>('/options/orders?status=all');
      setOrders(data.orders ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchV3Positions = useCallback(async () => {
    try {
      const data = await fetch('/api/autopilot/positions?status=open');
      const json = await data.json();
      setV3Positions(json.positions ?? []);
      // Also fetch exit proposals
      const epRes = await fetch('/api/autopilot/exit-proposals');
      const epJson = await epRes.json();
      setV3ExitProposals(epJson.proposals ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchEvaluations = useCallback(async () => {
    try {
      const data = await fetch('/api/autopilot/evaluations?limit=100');
      const json = await data.json();
      setEvaluations(json.evaluations ?? []);
    } catch { /* noop */ }
  }, []);

  const fetchThresholds = useCallback(async () => {
    try {
      const data = await fetch('/api/autopilot/thresholds');
      const json = await data.json();
      setThresholdData({ current_thresholds: json.current_thresholds ?? {}, history: json.history ?? [] });
    } catch { /* noop */ }
  }, []);

  const fetchOpsSummary = useCallback(async () => {
    try {
      const data = await fetch('/api/autopilot/ops-summary');
      const json = await data.json();
      setOpsSummary(json);
    } catch { /* noop */ }
  }, []);

  const fetchCandidates = useCallback(async (syms?: string[]) => {
    setCandidatesLoading(true);
    try {
      const symbolList = (syms ?? ['AAPL', 'SPY', 'MSFT', 'NVDA', 'QQQ']).join(',');
      const data = await apiFetch<{ ok: boolean; results: Record<string, CandidateResult> }>(`/debug-snapshot?symbols=${symbolList}&dte_min=14&dte_max=45&option_type=call`);
      setCandidatesData(data.results ?? {});
    } catch { /* noop */ }
    finally { setCandidatesLoading(false); }
  }, []);

  // ── Initial load + polling ───────────────────────────────────────────────

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Fetch tab-specific data on tab change
  useEffect(() => {
    if (tab === 'decisions') fetchDecisions();
    if (tab === 'rejections') fetchRejections();
    if (tab === 'pnl') fetchPnl();
    if (tab === 'llm') fetchLlm();
    if (tab === 'health') { fetchConnectivity(); fetchHealth(); }
    if (tab === 'positions') fetchPositions();
    if (tab === 'orders') fetchOrders();
    if (tab === 'candidates') fetchCandidates();
    if (tab === 'positions-v3') fetchV3Positions();
    if (tab === 'evaluations') fetchEvaluations();
    if (tab === 'thresholds') fetchThresholds();
    if (tab === 'ops-v3') fetchOpsSummary();
  }, [tab, fetchDecisions, fetchRejections, fetchPnl, fetchLlm, fetchConnectivity, fetchHealth, fetchPositions, fetchOrders, fetchCandidates, fetchV3Positions, fetchEvaluations, fetchThresholds, fetchOpsSummary]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleArm = async () => {
    setLoading(true);
    try {
      await apiFetch('/arm', { method: 'POST', body: JSON.stringify({ armed: !armed }) });
      await fetchHealth();
    } finally { setLoading(false); }
  };

  const handleKillSwitch = async () => {
    setLoading(true);
    try {
      await apiFetch('/kill-switch', {
        method: 'POST',
        body: JSON.stringify({ active: !killSwitchActive, close_all: false }),
      });
      await fetchHealth();
    } finally { setLoading(false); }
  };

  const handleRunNow = async () => {
    setLoading(true);
    setRunResult(null);
    try {
      const res = await apiFetch<{ ok: boolean; decisions: Decision[]; rejections: Rejection[]; orders: unknown[]; duration_ms: number }>('/run-now', {
        method: 'POST',
        body: JSON.stringify({ symbols: null, dry_run: false }),
      });
      const msg = `Cycle done in ${res.duration_ms}ms — ${res.decisions?.length ?? 0} decisions, ${res.rejections?.length ?? 0} rejections, ${res.orders?.length ?? 0} orders`;
      setRunResult(msg);
      await fetchDecisions();
      await fetchRejections();
    } catch (e) {
      setRunResult(`Error: ${e}`);
    } finally { setLoading(false); }
  };

  // ── Column definitions ───────────────────────────────────────────────────

  const decisionCols: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '70px' },
    { key: 'decision_type', label: 'Action', width: '90px', render: (val: unknown, row?: Record<string, unknown>) => {
      const v = (val as string) || (row?.action as string) || '';
      return <StatusBadge variant={v?.includes('CALL') ? 'success' : v?.includes('PUT') ? 'warning' : v === 'EXIT' ? 'danger' : 'info'} testId="">{v || '—'}</StatusBadge>;
    }},
    { key: 'contract', label: 'Contract', width: '180px', render: (val: unknown) => {
      const c = val as Decision['contract'];
      return c?.contract_symbol ?? '-';
    }},
    { key: 'contract', label: 'Score', width: '55px', render: (val: unknown) => {
      const c = val as Decision['contract'];
      const s = c?.score;
      return s != null ? <span style={{ fontWeight: 600, color: s >= 80 ? 'var(--ui2-success)' : s >= 60 ? 'var(--ui2-warning)' : 'var(--ui2-danger)' }}>{s.toFixed(0)}</span> : '—';
    }},
    { key: 'contract', label: 'Spread%', width: '65px', render: (val: unknown) => {
      const c = val as Decision['contract'];
      const sp = c?.spread_pct;
      return sp != null ? <span style={{ color: sp <= 2 ? 'var(--ui2-success)' : sp <= 5 ? 'var(--ui2-warning)' : 'var(--ui2-danger)' }}>{sp.toFixed(1)}%</span> : '—';
    }},
    { key: 'contract', label: 'DTE', width: '45px', render: (val: unknown) => {
      const c = val as Decision['contract'];
      return c?.dte ?? '—';
    }},
    { key: 'confidence', label: 'Conf', width: '55px', render: (val: unknown) => {
      const n = val as number;
      return n != null ? `${(n * 100).toFixed(0)}%` : '—';
    }},
    { key: 'order', label: 'Limit', width: '70px', render: (val: unknown) => {
      const o = val as Decision['order'];
      return o?.limit_price ? `$${o.limit_price.toFixed(2)}` : '-';
    }},
    { key: 'premium_cost_usd', label: 'Premium', width: '75px', render: (val: unknown) => `$${(val as number)?.toFixed(0) ?? '0'}` },
    { key: 'candidates_count', label: 'Cands', width: '55px', render: (val: unknown, row?: Record<string, unknown>) => {
      const total = val as number;
      const accepted = row?.candidates_accepted as number;
      return total ? <span style={{ fontSize: '10px' }}>{accepted ?? '?'}/{total}</span> : '—';
    }},
    { key: 'will_submit', label: 'Submit?', width: '55px', render: (val: unknown) => val ? <span style={{ color: 'var(--ui2-success)' }}>✓</span> : '—' },
    { key: 'timestamp', label: 'Time', width: '80px', render: (val: unknown) => {
      const s = val as string;
      return s ? new Date(s).toLocaleTimeString() : '-';
    }},
  ];

  const rejectionCols: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '70px', render: (val: unknown) => (val as string) || '—' },
    { key: 'reason', label: 'Reason', width: '140px', render: (val: unknown) => {
      const code = val as string;
      const reasonColors: Record<string, 'danger' | 'warning' | 'info'> = {
        no_contracts: 'danger', no_liquid_contracts: 'danger', risk_cap: 'warning',
        premium_too_high: 'warning', kill_switch_active: 'danger', daily_loss_limit: 'danger',
        market_closed: 'info', spread_too_wide: 'warning', no_eligible_dte: 'info',
      };
      const variant = reasonColors[code] ?? 'danger';
      return <StatusBadge variant={variant} testId="autopilot-rejection-code">{code}</StatusBadge>;
    }},
    { key: 'hard_rule', label: 'Rule', width: '120px', render: (val: unknown) => val ? (
      <span style={{ fontSize: '10px', color: 'var(--ui2-text-secondary)', fontFamily: 'monospace' }}>{val as string}</span>
    ) : null },
    { key: 'detail', label: 'Detail', render: (val: unknown) => <span style={{ fontSize: '11px' }}>{val as string}</span> },
    { key: 'candidates_count', label: 'Cands', width: '55px', render: (val: unknown, row?: Record<string, unknown>) => {
      const total = val as number;
      const acc = row?.candidates_accepted as number;
      return total ? <span style={{ fontSize: '10px' }}>{acc ?? '?'}/{total}</span> : '—';
    }},
    { key: 'timestamp', label: 'Time', width: '80px', render: (val: unknown) => {
      const s = val as string;
      return s ? new Date(s).toLocaleTimeString() : '-';
    }},
  ];

  const orderCols: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '200px' },
    { key: 'side', label: 'Side', width: '60px' },
    { key: 'qty', label: 'Qty', width: '50px' },
    { key: 'type', label: 'Type', width: '60px' },
    { key: 'status', label: 'Status', width: '80px', render: (val: unknown) => {
      const s = val as string;
      const variant = s === 'filled' ? 'success' : s === 'canceled' ? 'danger' : 'info';
      return <StatusBadge variant={variant} testId="">{s}</StatusBadge>;
    }},
    { key: 'limit_price', label: 'Limit', width: '80px', render: (val: unknown) => val ? `$${(val as number).toFixed(2)}` : '-' },
    { key: 'submitted_at', label: 'Submitted', width: '160px', render: (val: unknown) => {
      const s = val as string;
      return s ? new Date(s).toLocaleTimeString() : '-';
    }},
  ];

  const positionCols: ColumnDef<Record<string, unknown>>[] = [
    { key: 'symbol', label: 'Symbol', width: '200px' },
    { key: 'qty', label: 'Qty', width: '45px' },
    { key: 'side', label: 'Side', width: '55px' },
    { key: 'avg_entry_price', label: 'Entry', width: '75px', render: (val: unknown) => `$${(val as number)?.toFixed(2) ?? '0.00'}` },
    { key: 'current_price', label: 'Current', width: '75px', render: (val: unknown) => `$${(val as number)?.toFixed(2) ?? '0.00'}` },
    { key: 'unrealized_pnl', label: 'P&L$', width: '75px', render: (val: unknown) => {
      const n = (val as number) ?? 0;
      const color = n >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)';
      return <span style={{ color, fontWeight: 600 }}>{n >= 0 ? '+' : ''}${n?.toFixed(2)}</span>;
    }},
    { key: 'unrealized_pnl_pct', label: 'P&L%', width: '70px', render: (val: unknown) => {
      const n = (val as number) ?? 0;
      const color = n >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)';
      return <span style={{ color, fontWeight: 700 }}>{n >= 0 ? '+' : ''}{n?.toFixed(1)}%</span>;
    }},
    { key: 'market_value', label: 'Mkt Value', width: '85px', render: (val: unknown) => `$${(val as number)?.toFixed(2) ?? '0.00'}` },
  ];

  // ── Styles ───────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--ui2-bg-panel)',
    border: '1px solid var(--ui2-border)',
    borderRadius: 'var(--ui2-radius-md)',
    marginBottom: '12px',
  };

  const kpiStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 24px',
    background: 'var(--ui2-bg-panel)',
    border: '1px solid var(--ui2-border)',
    borderRadius: 'var(--ui2-radius-md)',
    flex: 1,
    minWidth: '140px',
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div data-testid="autopilot-options-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Autopilot Options"
          subtitle="Real options autopilot — Alpaca paper trading with Gemini + Groq analysis"
          icon="⚡"
          badge={
            killSwitchActive
              ? <Pill variant="danger" size="xs">KILL SWITCH</Pill>
              : armed
                ? <Pill variant="success" size="xs">ARMED</Pill>
                : <Pill variant="warning" size="xs">DISARMED</Pill>
          }
          testId="autopilot-options-header"
        />
      </div>

      {/* Status strip */}
      <div data-testid="autopilot-options-status-strip" style={{
        display: 'flex', gap: '8px', padding: '8px 16px', alignItems: 'center',
        fontSize: '11px', color: 'var(--ui2-text-secondary)',
      }}>
        <StatusBadge
          variant={health?.providers?.alpaca_paper_connected ? 'success' : 'danger'}
          testId="autopilot-options-alpaca-badge"
        >
          Alpaca {health?.providers?.alpaca_paper_connected ? 'Connected' : 'Disconnected'}
        </StatusBadge>
        <StatusBadge
          variant={health?.providers?.options_enabled ? 'success' : 'warning'}
          testId="autopilot-options-opts-badge"
        >
          Options {health?.providers?.options_enabled ? 'Enabled' : 'N/A'}
        </StatusBadge>
        <StatusBadge
          variant={marketOpen ? 'success' : 'info'}
          testId="autopilot-options-market-badge"
        >
          Market {health?.market_session?.status ?? 'unknown'}
        </StatusBadge>
        <span data-testid="autopilot-options-cycles">Cycles: {health?.loop?.cycles_run ?? 0}</span>
      </div>

      {/* Tabs */}
      <div data-testid="autopilot-options-tabs" style={{
        display: 'flex', gap: '2px', padding: '0 16px',
        borderBottom: '1px solid var(--ui2-border)',
      }}>
        {TABS.map(t => (
          <button key={t.key} data-testid={`autopilot-options-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: '12px', fontWeight: tab === t.key ? 600 : 400,
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--ui2-accent)' : '2px solid transparent',
              background: 'none', color: tab === t.key ? 'var(--ui2-accent)' : 'var(--ui2-text-secondary)',
              cursor: 'pointer', marginBottom: '-1px',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px 16px' }}>

        {/* ── CONTROLS ── */}
        {tab === 'controls' && (
          <div data-testid="autopilot-options-controls-panel">
            {/* Arm / Disarm */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Arm / Disarm</div>
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginTop: '2px' }}>
                  {armed ? 'ARMED — orders will be submitted when market is open' : 'DISARMED — analysis only, no orders submitted'}
                </div>
              </div>
              <button
                data-testid="autopilot-options-arm-btn"
                onClick={handleArm}
                disabled={loading || killSwitchActive}
                style={{
                  padding: '8px 24px', fontWeight: 600, fontSize: '13px',
                  border: 'none', borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
                  background: armed ? 'var(--ui2-warning, #f59e0b)' : 'var(--ui2-success)',
                  color: 'white', opacity: (loading || killSwitchActive) ? 0.5 : 1,
                }}
              >
                {armed ? 'DISARM' : 'ARM'}
              </button>
            </div>

            {/* Kill Switch */}
            <div style={{
              ...cardStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: killSwitchActive ? 'rgba(239,68,68,0.08)' : undefined,
              borderColor: killSwitchActive ? 'rgba(239,68,68,0.4)' : undefined,
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: killSwitchActive ? 'var(--ui2-danger)' : undefined }}>
                  Kill Switch
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginTop: '2px' }}>
                  {killSwitchActive ? 'ALL trading halted — kill switch is ACTIVE' : 'Emergency stop — halts all order submission'}
                </div>
              </div>
              <button
                data-testid="autopilot-options-kill-btn"
                onClick={handleKillSwitch}
                disabled={loading}
                style={{
                  padding: '8px 24px', fontWeight: 600, fontSize: '13px',
                  border: 'none', borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
                  background: killSwitchActive ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                  color: 'white', opacity: loading ? 0.5 : 1,
                }}
              >
                {killSwitchActive ? 'DEACTIVATE' : 'KILL SWITCH'}
              </button>
            </div>

            {/* Run Now */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Run Decision Cycle</div>
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginTop: '2px' }}>
                  Execute one full cycle across the universe ({health?.universe?.length ?? 10} symbols).
                  {!armed && ' Disarmed — decisions only, no orders.'}
                </div>
                {runResult && (
                  <div data-testid="autopilot-options-run-result" style={{
                    marginTop: '8px', fontSize: '12px', padding: '6px 10px',
                    background: 'var(--ui2-bg-input)', borderRadius: 'var(--ui2-radius-sm)',
                    color: 'var(--ui2-text-primary)',
                  }}>
                    {runResult}
                  </div>
                )}
              </div>
              <button
                data-testid="autopilot-options-run-btn"
                onClick={handleRunNow}
                disabled={loading || killSwitchActive}
                style={{
                  padding: '8px 24px', fontWeight: 600, fontSize: '13px',
                  border: 'none', borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
                  background: 'var(--ui2-accent)', color: 'white',
                  opacity: (loading || killSwitchActive) ? 0.5 : 1,
                }}
              >
                {loading ? 'Running…' : 'RUN NOW'}
              </button>
            </div>

            {/* Universe */}
            <div style={cardStyle}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Universe</div>
              <div data-testid="autopilot-options-universe" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(health?.universe ?? []).map(s => (
                  <Pill key={s} variant="info" size="xs">{s}</Pill>
                ))}
                {(!health?.universe || health.universe.length === 0) && (
                  <span style={{ fontSize: '12px', color: 'var(--ui2-text-muted)' }}>Loading…</span>
                )}
              </div>
            </div>

            {/* Risk Controls */}
            <div style={cardStyle}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Risk Controls</div>
              <div data-testid="autopilot-options-risk-controls" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px',
              }}>
                {health?.risk_controls && Object.entries(health.risk_controls).map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '12px',
                    padding: '4px 8px', background: 'var(--ui2-bg-input)', borderRadius: 'var(--ui2-radius-sm)',
                  }}>
                    <span style={{ color: 'var(--ui2-text-secondary)' }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 600 }}>{typeof v === 'number' && v > 100 ? `$${v}` : v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DECISIONS ── */}
        {tab === 'decisions' && (
          <div data-testid="autopilot-options-decisions-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Latest Decisions ({decisions.length})</div>
              <button data-testid="autopilot-options-refresh-decisions" onClick={fetchDecisions}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {decisions.length === 0 ? (
              <div data-testid="autopilot-options-decisions-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No decisions yet. Run a cycle to generate decisions.
              </div>
            ) : (
              <DataTable
                columns={decisionCols}
                data={decisions as unknown as Record<string, unknown>[]}
                testId="autopilot-options-decisions-table"
              />
            )}
          </div>
        )}

        {/* ── REJECTIONS ── */}
        {tab === 'rejections' && (
          <div data-testid="autopilot-options-rejections-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Latest Rejections ({rejections.length})</div>
              <button data-testid="autopilot-options-refresh-rejections" onClick={fetchRejections}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {rejections.length === 0 ? (
              <div data-testid="autopilot-options-rejections-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No rejections yet.
              </div>
            ) : (
              <DataTable
                columns={rejectionCols}
                data={rejections as unknown as Record<string, unknown>[]}
                testId="autopilot-options-rejections-table"
              />
            )}
          </div>
        )}

        {/* ── CANDIDATES DRAWER ── */}
        {tab === 'candidates' && (
          <div data-testid="autopilot-options-candidates-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                Contract Candidates — Chain Quality (DTE 14-45, Call)
              </div>
              <button data-testid="autopilot-options-refresh-candidates" onClick={() => fetchCandidates()}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                {candidatesLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {candidatesLoading && !candidatesData && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--ui2-text-muted)', fontSize: '12px' }}>
                Fetching live chain data from Alpaca…
              </div>
            )}
            {!candidatesLoading && !candidatesData && (
              <div data-testid="autopilot-options-candidates-empty" style={{ textAlign: 'center', padding: '32px', color: 'var(--ui2-text-muted)', fontSize: '12px' }}>
                No candidate data. Click Refresh.
              </div>
            )}
            {candidatesData && Object.entries(candidatesData).map(([sym, result]) => (
              <div key={sym} data-testid={`autopilot-candidates-sym-${sym}`} style={{
                background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                borderRadius: 'var(--ui2-radius-md)', padding: '12px', marginBottom: '10px',
              }}>
                {/* Symbol header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{sym}</span>
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>
                    spot ${result.spot?.toFixed(2) ?? '—'}
                  </span>
                  <StatusBadge variant={result.chain_fetch_ok ? 'success' : 'danger'} testId={`autopilot-candidates-chain-${sym}`}>
                    {result.chain_fetch_ok ? 'chain OK' : 'chain FAIL'}
                  </StatusBadge>
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>
                    {result.candidates_accepted ?? 0}/{result.candidates_total ?? 0} passed
                  </span>
                  {result.rejection_counts && Object.entries(result.rejection_counts).map(([code, count]) => (
                    <span key={code} style={{ fontSize: '10px', padding: '1px 6px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: '9999px', color: 'var(--ui2-text-secondary)' }}>
                      {code}:{count}
                    </span>
                  ))}
                </div>

                {/* Winner highlight */}
                {result.winner ? (
                  <div data-testid={`autopilot-candidates-winner-${sym}`} style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px',
                    padding: '8px', background: 'color-mix(in srgb, var(--ui2-success) 8%, var(--ui2-bg-card))',
                    border: '1px solid color-mix(in srgb, var(--ui2-success) 25%, transparent)',
                    borderRadius: 'var(--ui2-radius-sm)', marginBottom: '8px',
                  }}>
                    {[
                      ['Contract', result.winner.contract_symbol],
                      ['Strike', `$${result.winner.strike}`],
                      ['Expiry', result.winner.expiry],
                      ['DTE', result.winner.dte],
                      ['Bid', `$${result.winner.bid?.toFixed(2) ?? '—'}`],
                      ['Ask', `$${result.winner.ask?.toFixed(2) ?? '—'}`],
                      ['Mid', `$${result.winner.mid?.toFixed(2) ?? '—'}`],
                      ['Spread', `${result.winner.spread_pct?.toFixed(1) ?? '—'}%`],
                      ['Delta', result.winner.delta?.toFixed(3) ?? '—'],
                      ['IV', result.winner.iv ? `${(result.winner.iv * 100).toFixed(0)}%` : '—'],
                      ['Score', result.winner.score?.toFixed(1) ?? '—'],
                    ].map(([label, val]) => (
                      <div key={label as string} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', color: 'var(--ui2-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--ui2-danger)', padding: '4px 0' }}>No winner selected</div>
                )}

                {/* Top 3 alternatives */}
                {result.top_3?.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {result.top_3.map((c, i) => (
                      <div key={c.symbol} style={{
                        fontSize: '10px', padding: '4px 8px', background: 'var(--ui2-bg-input)',
                        border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                        fontFamily: 'monospace', color: 'var(--ui2-text-secondary)',
                      }}>
                        #{i+1} {c.symbol} — score {c.score?.toFixed(0)} | DTE {c.dte} | Δ{c.delta?.toFixed(2) ?? '—'} | mid ${c.mid?.toFixed(2)} | spread {c.spread_pct?.toFixed(1)}%
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div data-testid="autopilot-options-orders-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Option Orders ({orders.length})</div>
              <button data-testid="autopilot-options-refresh-orders" onClick={fetchOrders}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {orders.length === 0 ? (
              <div data-testid="autopilot-options-orders-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No option orders from broker.
              </div>
            ) : (
              <DataTable
                columns={orderCols}
                data={orders as unknown as Record<string, unknown>[]}
                testId="autopilot-options-orders-table"
              />
            )}
          </div>
        )}

        {/* ── POSITIONS ── */}
        {tab === 'positions' && (
          <div data-testid="autopilot-options-positions-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Option Positions ({positions.length})</div>
              <button data-testid="autopilot-options-refresh-positions" onClick={fetchPositions}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {positions.length === 0 ? (
              <div data-testid="autopilot-options-positions-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No option positions held.
              </div>
            ) : (
              <DataTable
                columns={positionCols}
                data={positions as unknown as Record<string, unknown>[]}
                testId="autopilot-options-positions-table"
              />
            )}
          </div>
        )}

        {/* ── PNL ── */}
        {tab === 'pnl' && (
          <div data-testid="autopilot-options-pnl-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>PnL Snapshot (Alpaca Paper)</div>
              <button data-testid="autopilot-options-refresh-pnl" onClick={fetchPnl}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {pnl ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-equity">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Equity</span>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>${pnl.equity?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}</span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-cash">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Cash</span>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>${pnl.cash?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}</span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-bp">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Buying Power</span>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>${pnl.buying_power?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}</span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-day">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Day P&L</span>
                  <span style={{
                    fontSize: '20px', fontWeight: 700,
                    color: (pnl.day_pnl ?? 0) >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                  }}>
                    {(pnl.day_pnl ?? 0) >= 0 ? '+' : ''}${pnl.day_pnl?.toFixed(2) ?? '0.00'}
                  </span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-unrealized">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Unrealized P&L</span>
                  <span style={{
                    fontSize: '20px', fontWeight: 700,
                    color: (pnl.total_unrealized_pnl ?? 0) >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                  }}>
                    {(pnl.total_unrealized_pnl ?? 0) >= 0 ? '+' : ''}${pnl.total_unrealized_pnl?.toFixed(2) ?? '0.00'}
                  </span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-opt-unrealized">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Options Unrealized</span>
                  <span style={{
                    fontSize: '20px', fontWeight: 700,
                    color: (pnl.option_unrealized_pnl ?? 0) >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                  }}>
                    {(pnl.option_unrealized_pnl ?? 0) >= 0 ? '+' : ''}${pnl.option_unrealized_pnl?.toFixed(2) ?? '0.00'}
                  </span>
                </div>
                <div style={kpiStyle} data-testid="autopilot-options-pnl-positions">
                  <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Positions</span>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>{pnl.total_positions ?? 0} ({pnl.option_positions ?? 0} opts)</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Loading PnL data…
              </div>
            )}
          </div>
        )}

        {/* ── LLM ── */}
        {tab === 'llm' && (
          <div data-testid="autopilot-options-llm-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>LLM Provider Status</div>
              <button data-testid="autopilot-options-refresh-llm" onClick={fetchLlm}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>
            {llmStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={cardStyle}>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Active Provider</div>
                  <div data-testid="autopilot-options-llm-provider" style={{ fontSize: '16px', fontWeight: 700 }}>
                    {llmStatus.provider || 'none'}
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Configuration</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <StatusBadge variant={llmStatus.gemini_available ? 'success' : 'danger'} testId="autopilot-options-gemini-badge">
                      Gemini {llmStatus.gemini_available ? '✓' : '✗'}
                    </StatusBadge>
                    <StatusBadge variant={llmStatus.groq_available ? 'success' : 'danger'} testId="autopilot-options-groq-badge">
                      Groq {llmStatus.groq_available ? '✓' : '✗'}
                    </StatusBadge>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Cache</div>
                  <div data-testid="autopilot-options-llm-cache" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {llmStatus.total_calls} calls ({(llmStatus.cache_hit_rate * 100).toFixed(0)}% cache hit)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>{llmStatus.cache_size} cached entries</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>Budget</div>
                  <div data-testid="autopilot-options-llm-budget" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {llmStatus.budget_remaining}/{llmStatus.budget_max} remaining
                  </div>
                  <div style={{
                    marginTop: '4px', height: '4px', background: 'var(--ui2-border)', borderRadius: '2px',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${(llmStatus.budget_remaining / llmStatus.budget_max) * 100}%`,
                      background: llmStatus.budget_remaining > 5 ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                    }} />
                  </div>
                </div>
                {llmStatus.last_error && (
                  <div style={{ ...cardStyle, gridColumn: '1 / -1', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ui2-danger)', fontWeight: 600 }}>Last Error</div>
                    <div data-testid="autopilot-options-llm-error" style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', marginTop: '4px' }}>
                      {llmStatus.last_error}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Loading LLM status…
              </div>
            )}
          </div>
        )}

        {/* ── POSITIONS V3 ── */}
        {tab === 'positions-v3' && (
          <div data-testid="autopilot-v3-positions-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>V3 Positions — System of Record ({v3Positions.length})</div>
              <button data-testid="autopilot-v3-refresh-positions" onClick={fetchV3Positions}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>

            {v3Positions.length === 0 ? (
              <div data-testid="autopilot-v3-positions-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No open V3 positions.
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'symbol', label: 'Symbol', width: '70px' },
                  { key: 'contract_symbol', label: 'Contract', width: '190px', render: (val: unknown) => (
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{val as string}</span>
                  )},
                  { key: 'option_type', label: 'Type', width: '50px', render: (val: unknown) => (
                    <span style={{ color: val === 'call' ? 'var(--ui2-success)' : 'var(--ui2-warning)', fontWeight: 600 }}>{(val as string)?.toUpperCase()}</span>
                  )},
                  { key: 'avg_entry', label: 'Entry', width: '70px', render: (val: unknown) => `$${(val as number)?.toFixed(2) ?? '—'}` },
                  { key: 'unrealized_pnl_pct', label: 'P&L%', width: '70px', render: (val: unknown) => {
                    const n = val as number | null;
                    if (n == null) return '—';
                    const color = n >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)';
                    return <span style={{ color, fontWeight: 700 }}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>;
                  }},
                  { key: 'dte_at_open', label: 'DTE@Open', width: '75px', render: (val: unknown) => val ?? '—' },
                  { key: 'spread_pct_at_open', label: 'Spread@Open', width: '90px', render: (val: unknown) => {
                    const n = val as number | null;
                    if (n == null) return '—';
                    return <span style={{ color: n <= 2 ? 'var(--ui2-success)' : n <= 5 ? 'var(--ui2-warning)' : 'var(--ui2-danger)' }}>{n.toFixed(1)}%</span>;
                  }},
                  { key: 'exit_trigger', label: 'Exit Trigger', width: '110px', render: (val: unknown) => {
                    const t = val as string | null;
                    if (!t) return <span style={{ color: 'var(--ui2-text-muted)', fontSize: '11px' }}>—</span>;
                    const color = t === 'take_profit' ? 'var(--ui2-success)' : t === 'stop_loss' ? 'var(--ui2-danger)' : 'var(--ui2-warning)';
                    return <span style={{ color, fontWeight: 600, fontSize: '11px' }}>{t.replace(/_/g, ' ').toUpperCase()}</span>;
                  }},
                  { key: 'status', label: 'Status', width: '75px', render: (val: unknown) => (
                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                      background: val === 'open' ? 'color-mix(in srgb, var(--ui2-success) 15%, transparent)' : 'var(--ui2-bg-input)',
                      color: val === 'open' ? 'var(--ui2-success)' : 'var(--ui2-text-secondary)',
                    }}>{val as string}</span>
                  )},
                  { key: 'opened_at', label: 'Opened', width: '80px', render: (val: unknown) => {
                    const s = val as string;
                    return s ? new Date(s).toLocaleTimeString() : '—';
                  }},
                ]}
                data={v3Positions as unknown as Record<string, unknown>[]}
                testId="autopilot-v3-positions-table"
              />
            )}

            {/* Exit Proposals Preview */}
            {v3ExitProposals.length > 0 && (
              <div data-testid="autopilot-v3-exit-proposals" style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--ui2-warning)' }}>
                  ⚠ Pending Exit Proposals ({v3ExitProposals.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {v3ExitProposals.map((p, i) => (
                    <div key={i} data-testid={`autopilot-v3-exit-proposal-${i}`} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px',
                      background: 'color-mix(in srgb, var(--ui2-warning) 8%, var(--ui2-bg-panel))',
                      border: '1px solid color-mix(in srgb, var(--ui2-warning) 25%, transparent)',
                      borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.contract_symbol}</span>
                      <span style={{ color: 'var(--ui2-warning)' }}>{p.exit_reason?.replace(/_/g, ' ') ?? '—'}</span>
                      <span style={{ color: (p.pnl_pct ?? 0) >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)', fontWeight: 700 }}>
                        {(p.pnl_pct ?? 0) >= 0 ? '+' : ''}{(p.pnl_pct ?? 0).toFixed(1)}%
                      </span>
                      <span style={{ color: 'var(--ui2-text-muted)' }}>{p.trigger_detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EVALUATIONS ── */}
        {tab === 'evaluations' && (
          <div data-testid="autopilot-v3-evaluations-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Trade Evaluations — Post-Exit Analysis ({evaluations.length})</div>
              <button data-testid="autopilot-v3-refresh-evaluations" onClick={fetchEvaluations}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>

            {evaluations.length === 0 ? (
              <div data-testid="autopilot-v3-evaluations-empty" style={{
                textAlign: 'center', padding: '48px 16px', color: 'var(--ui2-text-muted)', fontSize: '13px',
              }}>
                No evaluations yet. Evaluations are created after trades close.
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'symbol', label: 'Symbol', width: '65px' },
                  { key: 'realized_pnl_pct', label: 'PnL%', width: '70px', render: (val: unknown) => {
                    const n = val as number;
                    const color = n >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)';
                    return <span style={{ color, fontWeight: 700 }}>{n >= 0 ? '+' : ''}{n?.toFixed(1)}%</span>;
                  }},
                  { key: 'mae_pct', label: 'MAE%', width: '65px', render: (val: unknown) => (
                    <span style={{ color: 'var(--ui2-danger)', fontSize: '11px' }}>{(val as number)?.toFixed(1)}%</span>
                  )},
                  { key: 'mfe_pct', label: 'MFE%', width: '65px', render: (val: unknown) => (
                    <span style={{ color: 'var(--ui2-success)', fontSize: '11px' }}>{(val as number)?.toFixed(1)}%</span>
                  )},
                  { key: 'direction_correct', label: 'Signal✓', width: '65px', render: (val: unknown) => {
                    if (val == null) return <span style={{ color: 'var(--ui2-text-muted)' }}>—</span>;
                    return <span style={{ color: val ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{val ? '✓' : '✗'}</span>;
                  }},
                  { key: 'exit_reason', label: 'Exit Reason', width: '110px', render: (val: unknown) => (
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>{(val as string)?.replace(/_/g, ' ') ?? '—'}</span>
                  )},
                  { key: 'held_days', label: 'Held(d)', width: '65px', render: (val: unknown) => `${(val as number)?.toFixed(0) ?? 0}d` },
                  { key: 'entry_dte', label: 'Entry DTE', width: '70px', render: (val: unknown) => val ?? '—' },
                  { key: 'entry_spread_pct', label: 'Spread', width: '65px', render: (val: unknown) => {
                    const n = val as number | null;
                    return n != null ? <span style={{ fontSize: '11px' }}>{n.toFixed(1)}%</span> : '—';
                  }},
                  { key: 'entry_signal_direction', label: 'Signal', width: '70px', render: (val: unknown) => {
                    const d = val as string | null;
                    const color = d === 'bullish' ? 'var(--ui2-success)' : d === 'bearish' ? 'var(--ui2-danger)' : 'var(--ui2-text-muted)';
                    return <span style={{ color, fontSize: '11px' }}>{d ?? '—'}</span>;
                  }},
                  { key: 'created_at', label: 'Date', width: '80px', render: (val: unknown) => {
                    const s = val as string;
                    return s ? new Date(s).toLocaleDateString() : '—';
                  }},
                ]}
                data={evaluations as unknown as Record<string, unknown>[]}
                testId="autopilot-v3-evaluations-table"
              />
            )}
          </div>
        )}

        {/* ── THRESHOLDS ── */}
        {tab === 'thresholds' && (
          <div data-testid="autopilot-v3-thresholds-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Adaptive Thresholds — Learning Loop</div>
              <button data-testid="autopilot-v3-refresh-thresholds" onClick={fetchThresholds}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>

            {/* Current Thresholds */}
            {thresholdData && (
              <>
                <div data-testid="autopilot-v3-current-thresholds" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '16px',
                }}>
                  {Object.entries(thresholdData.current_thresholds).map(([k, v]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                      borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px',
                    }}>
                      <span style={{ color: 'var(--ui2-text-secondary)' }}>{k.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {typeof v === 'number' ? (v > 100 ? `$${v}` : k.includes('pct') || k.includes('rate') ? `${(v * 100).toFixed(0)}%` : v.toFixed(2)) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Threshold History Timeline */}
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Change History ({thresholdData.history.length})</div>
                {thresholdData.history.length === 0 ? (
                  <div data-testid="autopilot-v3-threshold-history-empty" style={{
                    textAlign: 'center', padding: '32px', color: 'var(--ui2-text-muted)', fontSize: '12px',
                  }}>
                    No threshold changes yet. Changes appear after every {'{5}'} evaluated trades.
                  </div>
                ) : (
                  <div data-testid="autopilot-v3-threshold-history" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {thresholdData.history.map((h, i) => (
                      <div key={h.change_id ?? i} data-testid={`autopilot-v3-threshold-change-${i}`} style={{
                        padding: '10px 14px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                        borderRadius: 'var(--ui2-radius-sm)', borderLeft: '3px solid var(--ui2-accent)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui2-accent)' }}>{h.trigger_reason}</span>
                          <span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>
                          <span>Sample: {h.trade_sample_n}</span>
                          {h.win_rate != null && <span>Win rate: {(h.win_rate * 100).toFixed(0)}%</span>}
                          {h.notes && <span>{h.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!thresholdData && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>Loading thresholds…</div>
            )}
          </div>
        )}

        {/* ── OPS V3 ── */}
        {tab === 'ops-v3' && (
          <div data-testid="autopilot-v3-ops-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Ops V3 — System Health</div>
              <button data-testid="autopilot-v3-refresh-ops" onClick={fetchOpsSummary}
                style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer', color: 'var(--ui2-text-secondary)' }}>
                Refresh
              </button>
            </div>

            {opsSummary ? (
              <>
                {/* Invariant Status */}
                <div data-testid="autopilot-v3-invariant-status" style={{
                  ...{ padding: '12px 16px', border: '1px solid', borderRadius: 'var(--ui2-radius-md)', marginBottom: '12px' },
                  background: opsSummary.invariants.ok ? 'color-mix(in srgb, var(--ui2-success) 8%, var(--ui2-bg-panel))' : 'color-mix(in srgb, var(--ui2-danger) 8%, var(--ui2-bg-panel))',
                  borderColor: opsSummary.invariants.ok ? 'color-mix(in srgb, var(--ui2-success) 30%, transparent)' : 'color-mix(in srgb, var(--ui2-danger) 30%, transparent)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: opsSummary.invariants.violations.length > 0 ? '8px' : 0 }}>
                    <span style={{ fontSize: '16px' }}>{opsSummary.invariants.ok ? '✅' : '❌'}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: opsSummary.invariants.ok ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>
                      Invariants: {opsSummary.invariants.ok ? 'All OK' : `${opsSummary.invariants.violations.length} violation(s)`}
                    </span>
                  </div>
                  {opsSummary.invariants.violations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {opsSummary.invariants.violations.map((v, i) => (
                        <div key={i} style={{ fontSize: '11px', color: 'var(--ui2-danger)', padding: '2px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>{v}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                {opsSummary.stats && (
                  <div data-testid="autopilot-v3-stats" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px',
                  }}>
                    {Object.entries(opsSummary.stats).map(([k, v]) => (
                      <div key={k} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px',
                        background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                      }}>
                        <span style={{ fontSize: '9px', color: 'var(--ui2-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last Cycle Summary */}
                {opsSummary.last_cycle && (
                  <div data-testid="autopilot-v3-last-cycle" style={{ padding: '12px 16px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--ui2-text-secondary)' }}>Last Cycle</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
                      {['cycle_id', 'started_at', 'status', 'decisions_count', 'rejections_count', 'orders_count', 'armed', 'duration_ms'].map(k => (
                        opsSummary.last_cycle?.[k] != null ? (
                          <div key={k} style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ color: 'var(--ui2-text-muted)' }}>{k.replace(/_/g, ' ')}:</span>
                            <span style={{ fontWeight: 600 }}>
                              {k.includes('at') ? new Date(opsSummary.last_cycle[k] as string).toLocaleTimeString() : String(opsSummary.last_cycle[k])}
                            </span>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}

                {/* Unresolved Incidents */}
                {opsSummary.unresolved_incidents.length > 0 && (
                  <div data-testid="autopilot-v3-incidents" style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--ui2-warning)' }}>
                      Unresolved Incidents ({opsSummary.unresolved_incidents.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {opsSummary.unresolved_incidents.map((inc, i) => (
                        <div key={inc.incident_id ?? i} data-testid={`autopilot-v3-incident-${i}`} style={{
                          padding: '8px 12px', background: 'color-mix(in srgb, var(--ui2-warning) 8%, var(--ui2-bg-panel))',
                          border: '1px solid color-mix(in srgb, var(--ui2-warning) 25%, transparent)',
                          borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px',
                        }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: inc.level === 'critical' ? 'var(--ui2-danger)' : 'var(--ui2-warning)' }}>[{inc.level?.toUpperCase()}]</span>
                            <span style={{ fontWeight: 600 }}>{inc.title}</span>
                            <span style={{ color: 'var(--ui2-text-muted)', marginLeft: 'auto', fontSize: '11px' }}>{inc.created_at ? new Date(inc.created_at).toLocaleTimeString() : '—'}</span>
                          </div>
                          <div style={{ marginTop: '4px', color: 'var(--ui2-text-secondary)', fontSize: '11px' }}>{inc.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Thresholds mini */}
                <div data-testid="autopilot-v3-ops-thresholds" style={{ padding: '12px 16px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--ui2-text-secondary)' }}>Current Thresholds</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px' }}>
                    {Object.entries(opsSummary.current_thresholds ?? {}).filter(([, v]) => v !== null).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ color: 'var(--ui2-text-muted)' }}>{k.replace(/_/g, ' ')}:</span>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>Loading ops summary…</div>
            )}
          </div>
        )}

        {/* ── HEALTH ── */}
        {tab === 'health' && (
          <div data-testid="autopilot-options-health-panel">
            {/* Connectivity card */}
            <div style={{ ...cardStyle, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Options Connectivity</div>
              {connectivity ? (
                <div data-testid="autopilot-options-connectivity" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px',
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Paper URL</span>
                    <div data-testid="autopilot-options-paper-url" style={{ fontSize: '12px', fontWeight: 600 }}>{connectivity.paper_base_url}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Connected</span>
                    <div>
                      <StatusBadge variant={connectivity.connected ? 'success' : 'danger'} testId="autopilot-options-conn-badge">
                        {connectivity.connected ? 'Yes' : 'No'}
                      </StatusBadge>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Latency</span>
                    <div data-testid="autopilot-options-latency" style={{ fontSize: '12px', fontWeight: 600 }}>{connectivity.latency_ms}ms</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Options Enabled</span>
                    <div>
                      <StatusBadge variant={connectivity.options_enabled ? 'success' : 'warning'} testId="autopilot-options-enabled-badge">
                        {connectivity.options_enabled ? 'Yes' : 'No'}
                      </StatusBadge>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Trading Level</span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{connectivity.options_trading_level ?? 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Options Buying Power</span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {connectivity.options_buying_power != null ? `$${Number(connectivity.options_buying_power).toLocaleString()}` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Equity</span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {connectivity.equity != null ? `$${Number(connectivity.equity).toLocaleString()}` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Last Chain Fetch</span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {connectivity.last_chain_fetch_ts ? new Date(connectivity.last_chain_fetch_ts).toLocaleTimeString() : 'never'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)' }}>Loading connectivity…</div>
              )}
            </div>

            {/* Health details */}
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>System Health</div>
              {health ? (
                <div data-testid="autopilot-options-health-details" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px',
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Armed</span>
                    <div><StatusBadge variant={health.armed ? 'success' : 'warning'} testId="autopilot-options-armed-detail">{health.armed ? 'Yes' : 'No'}</StatusBadge></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Kill Switch</span>
                    <div><StatusBadge variant={health.kill_switch_active ? 'danger' : 'success'} testId="autopilot-options-ks-detail">{health.kill_switch_active ? 'ACTIVE' : 'Off'}</StatusBadge></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Market Session</span>
                    <div data-testid="autopilot-options-market-detail" style={{ fontSize: '12px', fontWeight: 600 }}>{health.market_session?.status ?? 'unknown'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Alpaca Paper</span>
                    <div><StatusBadge variant={health.providers?.alpaca_paper_connected ? 'success' : 'danger'} testId="autopilot-options-alpaca-detail">{health.providers?.alpaca_paper_connected ? 'Connected' : 'Disconnected'}</StatusBadge></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Options Gateway</span>
                    <div><StatusBadge variant={health.providers?.options_enabled ? 'success' : 'warning'} testId="autopilot-options-gw-detail">{health.providers?.options_enabled ? 'Enabled' : 'Not Available'}</StatusBadge></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Cycles Run</span>
                    <div data-testid="autopilot-options-cycles-detail" style={{ fontSize: '12px', fontWeight: 600 }}>{health.loop?.cycles_run ?? 0}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ui2-text-secondary)' }}>Last Loop</span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {health.loop?.last_loop_ts ? new Date(health.loop.last_loop_ts).toLocaleTimeString() : 'never'}
                    </div>
                  </div>
                  {health.loop?.last_error && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '11px', color: 'var(--ui2-danger)' }}>Last Error</span>
                      <div data-testid="autopilot-options-last-error" style={{ fontSize: '12px', color: 'var(--ui2-danger)' }}>{health.loop.last_error}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)' }}>Loading health…</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
