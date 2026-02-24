/**
 * Backtest Engine Store — connects UI2 to /api/backtest/* endpoints.
 *
 * Provides:
 *  - runBacktest(config)      → POST /api/backtest/run
 *  - fetchRuns()              → GET  /api/backtest/runs
 *  - fetchStrategies()        → GET  /api/backtest/strategies
 *  - fetchDataHealth(sym?)    → GET  /api/backtest/data/health
 *  - compareRuns(a, b)        → POST /api/backtest/compare
 *  - primeData(syms)          → POST /api/backtest/data/prime
 */

// Minimal external-store pattern (no Zustand dependency)
function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
    setState: (partial: Partial<T>) => { state = { ...state, ...partial }; listeners.forEach(f => f()); },
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface BacktestRunResult {
  run_id: string;
  config: {
    strategy_id: string;
    symbol: string;
    start_date: string;
    end_date: string;
    initial_capital: number;
    slippage_bps: number;
    fee_per_trade: number;
    seed: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  trades: TradeRow[];
  equity_curve: EquityPoint[];
  drawdown_series: DrawdownPoint[];
  metrics: BacktestMetrics | null;
  provenance: {
    source: string;
    provider?: string;
    checksum?: string;
    fetched_at?: string;
  } | null;
  config_hash: string;
  started_at: string;
  completed_at: string;
  error?: string;
}

export interface TradeRow {
  trade_id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  pnl: number | null;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
}

export interface DrawdownPoint {
  timestamp: string;
  drawdown_pct: number;
}

export interface BacktestMetrics {
  total_return_pct: number;
  cagr_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  win_rate_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  expectancy: number;
  exposure_pct: number;
  turnover: number;
  final_equity: number;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  strategy_type: string;
  tags: string[];
}

export interface SymbolHealthInfo {
  symbol: string;
  total_rows: number;
  earliest_date: string | null;
  latest_date: string | null;
  missing_pct: number;
  expected_trading_days: number;
  actual_trading_days: number;
  last_fetch: string | null;
  provider: string;
  status: string;
}

export interface CompareResult {
  run_id_a: string;
  run_id_b: string;
  metrics_a: BacktestMetrics;
  metrics_b: BacktestMetrics;
  delta: Record<string, number>;
}

// ── State ──────────────────────────────────────────────────────────────────

export interface BacktestStoreState {
  // Runs
  runs: BacktestRunResult[];
  runsLoading: boolean;
  // Current result
  currentRun: BacktestRunResult | null;
  runLoading: boolean;
  runError: string;
  // Strategies
  strategies: StrategyInfo[];
  strategiesLoading: boolean;
  // Data health
  dataHealth: SymbolHealthInfo[];
  dataHealthLoading: boolean;
  // Compare
  compareResult: CompareResult | null;
  compareLoading: boolean;
  // Prime
  primeLoading: boolean;
  primeResult: Record<string, any> | null;
}

const API = '/api/backtest';

async function safeJson(r: Response) {
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid JSON: ${text.slice(0, 200)}`); }
}

export const backtestEngineStore = (() => {
  const store = createStore<BacktestStoreState>({
    runs: [],
    runsLoading: false,
    currentRun: null,
    runLoading: false,
    runError: '',
    strategies: [],
    strategiesLoading: false,
    dataHealth: [],
    dataHealthLoading: false,
    compareResult: null,
    compareLoading: false,
    primeLoading: false,
    primeResult: null,
  });

  return {
    ...store,

    async runBacktest(config: {
      strategy_id: string;
      symbol: string;
      start_date: string;
      end_date: string;
      initial_capital: number;
      slippage_bps?: number;
      fee_per_trade?: number;
    }) {
      store.setState({ runLoading: true, runError: '', currentRun: null });
      try {
        const r = await fetch(`${API}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            slippage_bps: config.slippage_bps ?? 5,
            fee_per_trade: config.fee_per_trade ?? 1,
            seed: 42,
          }),
        });
        if (!r.ok) {
          const err = await safeJson(r);
          const msg = typeof err.detail === 'string' ? err.detail : err.detail?.error || JSON.stringify(err.detail);
          throw new Error(msg);
        }
        const run = await safeJson(r) as BacktestRunResult;
        store.setState({
          currentRun: run,
          runLoading: false,
          runs: [run, ...store.getSnapshot().runs.filter(r => r.run_id !== run.run_id)],
        });
        return run;
      } catch (e: any) {
        store.setState({ runError: e.message, runLoading: false });
        return null;
      }
    },

    async fetchRuns() {
      store.setState({ runsLoading: true });
      try {
        const r = await fetch(`${API}/runs`);
        const data = await safeJson(r) as BacktestRunResult[];
        store.setState({ runs: data, runsLoading: false });
      } catch {
        store.setState({ runsLoading: false });
      }
    },

    async fetchStrategies() {
      store.setState({ strategiesLoading: true });
      try {
        const r = await fetch(`${API}/strategies`);
        const data = await safeJson(r) as StrategyInfo[];
        store.setState({ strategies: data, strategiesLoading: false });
      } catch {
        store.setState({ strategiesLoading: false });
      }
    },

    async fetchDataHealth(symbol?: string) {
      store.setState({ dataHealthLoading: true });
      try {
        const url = symbol ? `${API}/data/health?symbol=${symbol}` : `${API}/data/health`;
        const r = await fetch(url);
        const data = await safeJson(r) as SymbolHealthInfo[];
        store.setState({ dataHealth: data, dataHealthLoading: false });
      } catch {
        store.setState({ dataHealthLoading: false });
      }
    },

    async compareRuns(runIdA: string, runIdB: string) {
      store.setState({ compareLoading: true, compareResult: null });
      try {
        const r = await fetch(`${API}/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id_a: runIdA, run_id_b: runIdB }),
        });
        const data = await safeJson(r) as CompareResult;
        store.setState({ compareResult: data, compareLoading: false });
        return data;
      } catch {
        store.setState({ compareLoading: false });
        return null;
      }
    },

    async primeData(symbols?: string[], years?: number) {
      store.setState({ primeLoading: true, primeResult: null });
      try {
        const r = await fetch(`${API}/data/prime`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols, years: years ?? 7 }),
        });
        const data = await safeJson(r);
        store.setState({ primeResult: data, primeLoading: false });
        return data;
      } catch {
        store.setState({ primeLoading: false });
        return null;
      }
    },

    selectRun(run: BacktestRunResult) {
      store.setState({ currentRun: run });
    },
  };
})();
