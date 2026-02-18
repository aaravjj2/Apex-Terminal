/**
 * Autopilot API Client (v2 - Unified)
 * 
 * This connects to the new unified autopilot router.
 * Legacy endpoints are deprecated but kept for backwards compatibility.
 */

import type {
  AutopilotConfig,
  AutopilotStatus,
  AutopilotPosition,
  PortfolioState,
  CycleResult,
  ActivityLogEntry,
  DailyReport,
} from './types';

import { API_BASE as BASE_URL } from '../../config/api';

const API_BASE = `${BASE_URL}/api/v1/autopilot`;

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    signal: options?.signal ?? AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// UNIFIED API (v2) - Matches unified_router.py
// ============================================================================

export interface UnifiedStatus {
  is_running: boolean;
  kill_switch_active: boolean;
  current_phase: string;
  last_run_id: string | null;
  last_run_timestamp: string | null;
  last_run_success: boolean | null;
  cycle_count: number;
}

export interface CycleRequest {
  dry_run?: boolean;
  force?: boolean;
}

export interface CycleResponse {
  run_id: string;
  success: boolean;
  duration_ms: number;
  candidates_generated: number;
  candidates_selected: number;
  exits_triggered: number;
  exits_executed: number;
  orders_filled: number;
  no_action_reasons: string[];
  error: string | null;
}

export interface UnifiedPosition {
  symbol: string;
  qty: number;
  side: string;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  asset_class: string;
  underlying: string | null;
  expiration: string | null;
  strike: number | null;
  option_type: string | null;
  dte: number | null;
  managed: boolean;
  run_id: string | null;
  strategy_template: string | null;
  current_profit_pct: number;
  exit_signals: Array<{
    symbol: string;
    trigger: string;
    trigger_value: number;
    threshold: number;
    urgency: string;
  }>;
}

export interface RunSummary {
  run_id: string;
  timestamp: string;
  success: boolean;
  duration_ms: number;
  candidates_generated: number;
  orders_filled: number;
  exits_executed: number;
}

export interface SentimentResponse {
  symbol: string;
  overall_score: number;
  overall_level: string;
  news_count_24h: number;
  is_blackout: boolean;
  earnings_within: number | null;
  recent_headlines: string[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  alpaca_connected: boolean;
  websocket_connected: boolean;
  news_provider: string;
  engine_running: boolean;
  kill_switch_active: boolean;
}

export const unifiedAutopilotApi = {
  /**
   * Get engine status
   */
  async getStatus(): Promise<UnifiedStatus> {
    return fetchJSON(`${API_BASE}/status`);
  },

  /**
   * Run an autopilot cycle
   */
  async runCycle(request: CycleRequest = {}): Promise<CycleResponse> {
    return fetchJSON(`${API_BASE}/cycle`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Toggle kill switch
   */
  async setKillSwitch(active: boolean): Promise<{ kill_switch_active: boolean; timestamp: string }> {
    return fetchJSON(`${API_BASE}/kill-switch`, {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
  },

  /**
   * Get kill switch status
   */
  async getKillSwitchStatus(): Promise<{ active: boolean; timestamp: string }> {
    return fetchJSON(`${API_BASE}/kill-switch`);
  },

  /**
   * Get all positions (from Alpaca)
   */
  async getPositions(): Promise<UnifiedPosition[]> {
    return fetchJSON(`${API_BASE}/positions`);
  },

  /**
   * Get a specific run artifact
   */
  async getRun(runId: string): Promise<Record<string, unknown>> {
    return fetchJSON(`${API_BASE}/run/${runId}`);
  },

  /**
   * List recent runs
   */
  async listRuns(limit = 20, successOnly = false): Promise<RunSummary[]> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (successOnly) params.set('success_only', 'true');
    return fetchJSON(`${API_BASE}/runs?${params.toString()}`);
  },

  /**
   * Get sentiment for a symbol
   */
  async getSentiment(symbol: string): Promise<SentimentResponse> {
    return fetchJSON(`${API_BASE}/sentiment/${symbol}`);
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthResponse> {
    return fetchJSON(`${API_BASE}/health`);
  },

  /**
   * Get WebSocket event types
   */
  async getWsEvents(): Promise<{ events: Array<{ name: string; description: string; payload: Record<string, string> }> }> {
    return fetchJSON(`${API_BASE}/ws-events`);
  },

  /**
   * Close a position immediately (Panic Sell)
   */
  async closePosition(symbol: string): Promise<any> {
    return fetchJSON(`${API_BASE}/positions/${symbol}/close`, {
      method: 'POST',
    });
  },
};

// ============================================================================
// LEGACY API (deprecated - kept for backwards compatibility)
// ============================================================================

export const autopilotApi = {
  /**
   * Get current configuration
   */
  async getConfig(): Promise<{ config: AutopilotConfig; defaults: AutopilotConfig }> {
    return fetchJSON(`${API_BASE}/config`);
  },

  /**
   * Update configuration
   */
  async updateConfig(update: Partial<{
    paper_equity: number;
    mode: string;
    risk_limits: Partial<AutopilotConfig['risk_limits']>;
    allowed_templates: string[];
    forecast_influence: number;
    llm_enabled: boolean;
    focus_symbol: string | null;
    max_symbols_per_cycle: number;
    contracts_per_trade: number;
    continuous_run: boolean;
    weekly_expiry_only: boolean;
  }>): Promise<{ status: string; config: AutopilotConfig }> {
    return fetchJSON(`${API_BASE}/config`, {
      method: 'POST',
      body: JSON.stringify(update),
    });
  },

  /**
   * Trigger an autopilot run
   */
  async triggerRun(force = false): Promise<{ status: string; cycle: CycleResult }> {
    const result = await unifiedAutopilotApi.runCycle({ force });
    return {
      status: result.success ? 'completed' : 'failed',
      cycle: {
        cycle_id: result.run_id,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: result.duration_ms,
        success: result.success,
        candidates: {
          generated: result.candidates_generated,
          by_template: {},
        },
        selection: {
          selected: result.candidates_selected,
          rejected: 0,
          method: 'score',
        },
        validation: {
          valid: result.candidates_selected,
          invalid: 0,
          errors: result.no_action_reasons,
        },
        execution: {
          submitted: result.candidates_selected,
          filled: result.orders_filled,
          rejected: 0,
        },
        monitoring: {
          exit_signals: result.exits_triggered,
          exits_executed: result.exits_executed,
          risk_alerts: 0,
        },
        error: result.error ? { message: result.error } : undefined,
      },
    };
  },

  /**
   * Get current status
   */
  async getStatus(): Promise<AutopilotStatus> {
    const unified = await unifiedAutopilotApi.getStatus();
    // The raw response may contain extra fields from mocks or enriched backend responses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = unified as any;
    return {
      state: (raw.state as AutopilotStatus['state']) ?? (unified.is_running ? 'running' : 'idle'),
      mode: (raw.mode as AutopilotStatus['mode']) ?? 'paper',
      kill_switch: unified.kill_switch_active ?? raw.kill_switch ?? false,
      kill_switch_active: unified.kill_switch_active ?? raw.kill_switch_active ?? false,
      last_cycle: raw.last_cycle ?? null,
      last_cycle_at: unified.last_run_timestamp ?? raw.last_cycle_at ?? null,
      cycles_completed: unified.cycle_count ?? raw.cycles_completed ?? 0,
      trades_executed: raw.trades_executed ?? 0,
      win_rate: raw.win_rate ?? 0,
      avg_win: raw.avg_win ?? 0,
      avg_loss: raw.avg_loss ?? 0,
      sharpe_ratio: raw.sharpe_ratio ?? null,
      portfolio: raw.portfolio ?? {
        equity: 0,
        cash: 0,
        total_risk: 0,
        position_count: 0,
        open_positions: 0,
        daily_pnl: 0,
        total_pnl: 0,
        realized_pnl: 0,
        realized_pnl_today: 0,
        unrealized_pnl: 0,
        net_delta: 0,
        net_gamma: 0,
        net_theta: 0,
        net_vega: 0,
        greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
        symbol_exposure: {},
        cluster_exposure: {},
      },
      open_positions: raw.open_positions ?? 0,
      broker_metrics: raw.broker_metrics ?? {
        total_orders: 0,
        filled_orders: 0,
        rejected_orders: 0,
        fill_rate: 0,
        total_slippage: 0,
      },
      sentiment: raw.sentiment ?? undefined,
    };
  },

  /**
   * Get proposals from last run
   */
  async getProposals(): Promise<{
    cycle_id: string;
    candidates_generated: number;
    candidates_by_template: Record<string, number>;
    selected_count: number;
    selection_method: string;
    timestamp: string;
  }> {
    return fetchJSON(`${API_BASE}/proposals`);
  },

  /**
   * Get positions
   */
  async getPositions(status?: 'open' | 'closed' | 'all'): Promise<{
    positions: AutopilotPosition[];
    count: number;
    portfolio: PortfolioState;
  }> {
    const url = status ? `${API_BASE}/positions?status=${status}` : `${API_BASE}/positions`;
    const data = await fetchJSON<any>(url);
    const raw = Array.isArray(data) ? data : data.positions ?? [];
    const positions: AutopilotPosition[] = raw.map((p: any) => ({
      position_id: p.symbol ?? 'unknown',
      symbol: p.symbol ?? 'unknown',
      template: p.strategy_template ?? 'unknown',
      legs: [],
      entry_price: Number(p.avg_entry_price ?? 0),
      entry_cost: Number(p.avg_entry_price ?? 0),
      entry_time: new Date().toISOString(),
      quantity: Number(p.qty ?? 0),
      status: 'open',
      current_value: Number(p.market_value ?? 0),
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
      max_loss: 0,
      max_profit: 0,
      max_risk: 0,
      dte: Number(p.dte ?? 0),
      days_to_expiry: Number(p.dte ?? 0),
      expiration: p.expiration ?? '',
      underlying_price: Number(p.current_price ?? 0),
      iv_rank: 0,
      realized_pnl: 0,
      unrealized_pnl: Number(p.unrealized_pnl ?? 0),
      net_pnl: Number(p.unrealized_pnl ?? 0),
      pnl_percent: Number(p.unrealized_pnl_pct ?? 0),
      total_commission: 0,
    }));
    return {
      positions,
      count: positions.length,
      portfolio: data.portfolio ?? {
        equity: 0,
        cash: 0,
        total_risk: 0,
        position_count: positions.length,
        open_positions: positions.length,
        daily_pnl: 0,
        total_pnl: 0,
        realized_pnl: 0,
        realized_pnl_today: 0,
        unrealized_pnl: 0,
        net_delta: 0,
        net_gamma: 0,
        net_theta: 0,
        net_vega: 0,
        greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
        symbol_exposure: {},
        cluster_exposure: {},
      },
    };
  },

  /**
   * Get activity logs
   */
  async getLogs(options?: {
    limit?: number;
    event_type?: string;
    level?: string;
  }): Promise<{ logs: ActivityLogEntry[]; count: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.event_type) params.set('event_type', options.event_type);
    if (options?.level) params.set('level', options.level);

    const url = `${API_BASE}/logs?${params.toString()}`;
    return fetchJSON(url);
  },

  /**
   * Activate/deactivate kill switch
   */
  async setKillSwitch(activate: boolean, closeAll = false): Promise<{ status: string }> {
    void closeAll;
    await unifiedAutopilotApi.setKillSwitch(activate);
    return { status: activate ? 'activated' : 'deactivated' };
  },

  /**
   * Get daily report
   */
  async getDailyReport(reportDate?: string): Promise<{ report: DailyReport; markdown: string }> {
    const url = reportDate
      ? `${API_BASE}/report?report_date=${reportDate}`
      : `${API_BASE}/report`;
    return fetchJSON(url);
  },

  /**
   * Pause autopilot
   */
  async pause(): Promise<{ status: string }> {
    return fetchJSON(`${API_BASE}/pause`, { method: 'POST' });
  },

  /**
   * Resume autopilot
   */
  async resume(): Promise<{ status: string }> {
    return fetchJSON(`${API_BASE}/resume`, { method: 'POST' });
  },

  /**
   * Get broker metrics
   */
  async getBrokerMetrics(): Promise<{
    total_orders: number;
    filled_orders: number;
    rejected_orders: number;
    fill_rate: number;
    total_slippage: number;
  }> {
    return fetchJSON(`${API_BASE}/broker/metrics`);
  },

  /**
   * Get trading universe
   */
  async getUniverse(): Promise<{
    symbols: Array<{ symbol: string; sector: string; liquidity_tier: string }>;
    count: number;
  }> {
    return fetchJSON(`${API_BASE}/universe`);
  },

  /**
   * Close a position immediately (Panic Sell)
   */
  async closePosition(symbol: string): Promise<any> {
    return unifiedAutopilotApi.closePosition(symbol);
  },
};
