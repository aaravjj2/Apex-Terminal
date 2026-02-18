/**
 * Unified Run Ledger types (A1)
 * Single source of truth for Risk + Backtest runs.
 */

export type RunType = 'risk' | 'backtest';
export type LedgerRunStatus = 'success' | 'blocked' | 'error';

export interface UnifiedRun {
  run_type: RunType;
  run_id: string;
  created_at: string;          // ISO 8601
  scenario_or_strategy: string; // scenario label (risk) or strategy name (backtest)
  determinism_hash: string;     // config_hash or run_id prefix
  key_metrics: KeyMetrics;
  status: LedgerRunStatus;
}

export interface KeyMetrics {
  // Risk runs
  worst_case_pnl?: number;
  max_loss?: number;
  // Backtest runs
  total_return_pct?: number;
  max_drawdown_pct?: number;
  sharpe_ratio?: number;
}

export type DateFilter = 'all' | 'today' | '7d' | '30d';

export interface LedgerFilters {
  runType: RunType | 'all';
  dateFilter: DateFilter;
  search: string;
}
