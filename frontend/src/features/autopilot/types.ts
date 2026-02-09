/**
 * Autopilot Types
 */

export type AutopilotMode = 'paper' | 'paused' | 'auto' | 'semi' | 'manual';
export type AutopilotState = 'idle' | 'running' | 'paused' | 'error';
export type PositionStatus = 'open' | 'closed' | 'expired' | 'assigned';
export type CandidateStatus = 'pending' | 'selected' | 'rejected' | 'executed';

export interface RiskLimits {
  max_risk_per_trade: number;
  max_total_risk: number;
  max_daily_loss: number;
  max_open_positions: number;
  max_positions_per_underlying: number;
  max_total_exposure_usd?: number;
  max_positions_per_cluster?: number;
  max_cluster_risk_pct?: number;
  max_cluster_concentration?: number;
  max_symbol_concentration?: number;
}

export interface StrategyConstraints {
  allowed_templates?: string[];
  min_dte: number;
  max_dte: number;
  min_short_delta?: number;
  max_short_delta?: number;
  min_spread_width?: number;
  max_spread_width?: number;
  min_iv_rank?: number;
  max_iv_rank?: number;
  min_liquidity_score?: number;
  max_spread_percent?: number;
}

export interface AutopilotConfig {
  paper_equity: number;
  mode: AutopilotMode;
  auto_execute: boolean;
  llm_enabled: boolean;
  forecast_influence: number;
  allowed_templates: string[];
  risk_limits: RiskLimits;
  strategy_constraints: StrategyConstraints;
  universe: string[];
  focus_symbol?: string | null;
  max_symbols_per_cycle?: number;
  contracts_per_trade?: number;
  continuous_run?: boolean;
  weekly_expiry_only?: boolean;
  forecast_settings: {
    enabled: boolean;
    influence_level: number;
  };
  llm_settings: {
    enabled: boolean;
  };
}

export interface OptionLeg {
  option_type: 'call' | 'put';
  strike: number;
  expiry: string;
  side: 'buy' | 'sell';
  quantity: number;
  premium: number;
  entry_price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface PositionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface AutopilotPosition {
  position_id: string;
  symbol: string;
  template: string;
  legs: OptionLeg[];
  entry_price: number;
  entry_cost: number;
  entry_time: string;
  quantity: number;
  status: PositionStatus;
  current_value: number;
  greeks: PositionGreeks;
  max_loss: number;
  max_profit: number;
  max_risk: number;
  dte: number;
  days_to_expiry: number;
  expiration: string;
  underlying_price: number;
  iv_rank: number;
  realized_pnl: number;
  unrealized_pnl: number;
  net_pnl: number;
  pnl_percent: number;
  total_commission: number;
  exit_time?: string;
  exit_reason?: string;
}

export interface TradeCandidate {
  id: string;
  symbol: string;
  template: string;
  legs: OptionLeg[];
  underlying_price: number;
  max_loss: number;
  max_profit: number;
  pop: number;
  dte: number;
  iv_rank: number;
  liquidity_score: number;
  spread_percent: number;
  regime: string;
  trend: string;
  base_score: number;
  adjusted_score: number;
  status: CandidateStatus;
  selection_reason: string;
  rejection_reasons: string[];
  rationale?: string;
  created_at: string;
}

export interface PortfolioState {
  equity: number;
  cash: number;
  total_risk: number;
  position_count: number;
  open_positions: number;
  daily_pnl: number;
  total_pnl: number;
  realized_pnl: number;
  realized_pnl_today: number;
  unrealized_pnl: number;
  net_delta: number;
  net_gamma: number;
  net_theta: number;
  net_vega: number;
  greeks: PositionGreeks;
  symbol_exposure: Record<string, number>;
  cluster_exposure: Record<string, number>;
  positions?: unknown[];
  total_exposure?: number;
}

export interface CycleResult {
  cycle_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  success: boolean;
  candidates: {
    generated: number;
    by_template: Record<string, number>;
  };
  selection: {
    selected: number;
    rejected: number;
    method: string;
  };
  validation: {
    valid: number;
    invalid: number;
    errors: string[];
  };
  execution: {
    submitted: number;
    filled: number;
    rejected: number;
  };
  monitoring: {
    exit_signals: number;
    exits_executed: number;
    risk_alerts: number;
  };
  error?: {
    message: string;
    traceback?: string;
  };
}

export interface AutopilotStatus {
  state: AutopilotState;
  mode: AutopilotMode;
  kill_switch: boolean;
  kill_switch_active: boolean;
  last_cycle: CycleResult | null;
  last_cycle_at: string | null;
  cycles_completed: number;
  trades_executed: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  sharpe_ratio: number | null;
  portfolio: PortfolioState;
  open_positions: number;
  broker_metrics: {
    total_orders: number;
    filled_orders: number;
    rejected_orders: number;
    fill_rate: number;
    total_slippage: number;
  };
  sentiment?: {
    timestamp: string;
    provider: string;
    news_velocity: string;
    sentiment_scores: Record<string, number>;
  };
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  symbol?: string;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DailyReport {
  report_date: string;
  generated_at: string;
  pnl_summary: {
    starting_equity: number;
    ending_equity: number;
    daily_pnl: number;
    daily_return_pct: number;
  };
  trading_activity: {
    trades_opened: number;
    trades_closed: number;
    candidates_generated: number;
    candidates_selected: number;
  };
  position_summary: {
    open_positions: number;
    total_risk_outstanding: number;
  };
  attribution: {
    by_template: Array<{
      template: string;
      trade_count: number;
      win_rate: number;
      net_pnl: number;
    }>;
    by_symbol: Array<{
      symbol: string;
      trade_count: number;
      net_pnl: number;
    }>;
  };
  notes: {
    no_trade_reasons: string[];
    alerts: string[];
  };
}

export interface Incident {
  severity: 'error' | 'critical' | 'warning';
  category: string;
  title: string;
  description: string;
  timestamp: string;
}
