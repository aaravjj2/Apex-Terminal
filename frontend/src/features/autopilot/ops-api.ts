/**
 * Autopilot Ops API Client
 * Connects to /api/ops/autopilot/* (Phase 0 endpoints)
 */

import { API_BASE } from '../../config/api';

const OPS_BASE = `${API_BASE}/api/ops/autopilot`;

async function fetchOps<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${OPS_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    signal: options?.signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpsVersionResponse {
  ok: boolean;
  git_sha: string;
  schema_version: string;
  build_date: string | null;
  feature_flags: Record<string, boolean>;
  uptime_seconds: number;
}

export interface OpsHealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'error';
  latency_ms: number;
  detail: string;
}

export interface OpsMarketSession {
  state: string;
  allow_trading: boolean;
  reason: string;
  trigger_flatten: boolean;
}

export interface OpsAutopilotState {
  is_running: boolean;
  kill_switch: boolean;
  paper_verified: boolean;
  cycle_count: number;
  current_phase: string;
  last_run_id: string | null;
  last_run_at: string | null;
  last_run_success: boolean | null;
  last_run_duration_ms: number | null;
  last_candidates_generated: number;
  last_candidates_selected: number;
  last_orders_filled: number;
  circuit_breaker_active: boolean;
  consecutive_stopouts: number;
}

export interface OpsHealthResponse {
  ok: boolean;
  overall_status: 'ok' | 'degraded' | 'error';
  checks: OpsHealthCheck[];
  autopilot_state: OpsAutopilotState;
  market_session: OpsMarketSession;
}

export interface OpsMarketContext {
  timestamp: string;
  market_open: boolean;
  regime: string;
  vix_level: number | null;
  spy_change_pct: number | null;
}

export interface OpsSentiment {
  timestamp: string;
  provider: string;
  symbols_checked: string[];
  sentiment_scores: Record<string, number>;
  news_velocity: string;
}

export interface OpsLastCycle {
  run_id: string;
  timestamp: string;
  success: boolean;
  duration_ms: number;
  candidates_generated: number;
  candidates_selected: number;
  exits_triggered: number;
  exits_executed: number;
  orders_placed: number;
  orders_filled: number;
  no_action_reasons: string[];
  gates_triggered: string[];
  health: Record<string, unknown>;
  market: OpsMarketContext;
  sentiment: OpsSentiment;
  error: string | null;
}

export interface OpsCycleResponse {
  ok: boolean;
  has_cycle: boolean;
  cycle: OpsLastCycle | null;
}

export interface OpsPosition {
  symbol: string;
  qty: number | string;
  side: string;
  avg_entry_price: number | string;
  current_price: number | string;
  market_value: number | string;
  unrealized_pl: number | string;
  unrealized_plpc: number | string;
  asset_class: string;
}

export interface OpsAccount {
  equity: number | string;
  cash: number | string;
  buying_power: number | string;
  portfolio_value: number | string;
  daytrade_count: number | string;
  pattern_day_trader: boolean;
}

export interface OpsOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  qty: number | string;
  filled_qty: number | string;
  status: string;
  created_at: string;
  filled_at: string | null;
  filled_avg_price: number | string | null;
}

export interface OpsUniverseSymbol {
  symbol: string;
  sector: string;
  liquidity_tier: string;
}

export interface OpsRunSummary {
  run_id: string;
  timestamp: string;
  success: boolean;
  duration_ms: number;
  candidates_generated: number;
  candidates_selected: number;
  orders_filled: number;
  gates_triggered: string[];
  market_open: boolean;
  regime: string;
  vix_level: number | null;
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const opsApi = {
  async getVersion(signal?: AbortSignal): Promise<OpsVersionResponse> {
    return fetchOps('/version', { signal });
  },

  async getHealth(signal?: AbortSignal): Promise<OpsHealthResponse> {
    return fetchOps('/health', { signal });
  },

  async getLastCycle(signal?: AbortSignal): Promise<OpsCycleResponse> {
    return fetchOps('/cycle', { signal });
  },

  async arm(signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    return fetchOps('/arm', { method: 'POST', signal });
  },

  async disarm(signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    return fetchOps('/disarm', { method: 'POST', signal });
  },

  async runNow(force = true, signal?: AbortSignal): Promise<{ ok: boolean; message: string; run_id?: string }> {
    return fetchOps(`/run-now?force=${force}`, { method: 'POST', signal });
  },

  async getPositions(signal?: AbortSignal): Promise<{ ok: boolean; positions: OpsPosition[]; count: number }> {
    return fetchOps('/positions', { signal });
  },

  async getAccount(signal?: AbortSignal): Promise<{ ok: boolean; account: OpsAccount | null }> {
    return fetchOps('/account', { signal });
  },

  async getOrders(limit = 20, signal?: AbortSignal): Promise<{ ok: boolean; orders: OpsOrder[]; count: number }> {
    return fetchOps(`/orders?limit=${limit}`, { signal });
  },

  async getUniverse(signal?: AbortSignal): Promise<{ ok: boolean; symbols: OpsUniverseSymbol[]; count: number }> {
    return fetchOps('/universe', { signal });
  },

  async getRuns(limit = 30, signal?: AbortSignal): Promise<{ ok: boolean; runs: OpsRunSummary[]; count: number }> {
    return fetchOps(`/runs?limit=${limit}`, { signal });
  },
};
