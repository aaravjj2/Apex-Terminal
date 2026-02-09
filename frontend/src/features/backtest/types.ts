/**
 * Backtest TypeScript types
 */

export type BacktestStatus = 'pending' | 'running' | 'completed' | 'failed';
export type BacktestTab = 'configure' | 'runs' | 'analyze' | 'compare' | 'export';

export interface BacktestConfig {
  strategy_id: string;
  symbol: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  slippage_bps: number;
  fee_per_trade: number;
  seed: number;
}

export interface BacktestMetrics {
  total_return_pct: number;
  cagr_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  final_equity: number;
}

export interface TradeFill {
  trade_id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  pnl?: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
}

export interface BacktestRun {
  run_id: string;
  config: BacktestConfig;
  status: BacktestStatus;
  trades: TradeFill[];
  equity_curve: EquityPoint[];
  metrics?: BacktestMetrics;
  config_hash: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}
