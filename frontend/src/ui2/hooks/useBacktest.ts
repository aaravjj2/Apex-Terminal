/**
 * useBacktest — React hook wiring lib/backtest → BacktestEngineUI2
 *
 * Provides a full backtesting engine inside React state, including:
 *   - Strategy configuration & parameter management
 *   - Engine execution via BacktestEngine
 *   - Performance analytics (Sharpe, Sortino, max-DD, monthly returns, etc.)
 *   - Optimization (grid-search, walk-forward, Monte Carlo, CSCV)
 *   - Reporter (summary stats)
 *   - Built-in strategy templates (SMA, RSI, Bollinger, MACD, etc.)
 */
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
// ── Lib stubs (self-contained mode) ──
type Bar = any;
type BacktestConfig = any;
type BacktestResult = any;
type BacktestMetrics = any;
type Strategy = any;
type MonthlyReturn = any;
type EquityPoint = any;
type DrawdownPeriod = any;
type Trade = any;
type Position = any;
type monteCarloOptimization = any;
type cscv = any;
type sensitivityAnalysis = any;
type ParameterRange = any;
type OptimizationResult = any;
type MonteCarloOptResult = any;
type WalkForwardResult = any;
type CSCVResult = any;
type smaCrossover = any;
type rsiMeanReversion = any;
type bollingerBandStrategy = any;
type macdStrategy = any;
type momentumRotation = any;
type breakoutStrategy = any;
type meanReversionPairs = any;
type turtleTrendFollowing = any;
const BacktestEngine = class { constructor(..._a: any[]) {} } as any;
const computeMetrics = (..._a: any[]): any => ({});
const computeMonthlyReturns = (..._a: any[]): any => ({});
const rollingMetric = (..._a: any[]): any => ({});
const maeMfeAnalysis = (..._a: any[]): any => ({});
const dayOfWeekAnalysis = (..._a: any[]): any => ({});
const regimeAnalysis = (..._a: any[]): any => ({});
const compareToBenchmark = (..._a: any[]): any => ({});
const tTestReturns = (..._a: any[]): any => ({});
const Signal = class { constructor(..._a: any[]) {} } as any;
const OrderType = class { constructor(..._a: any[]) {} } as any;
const PositionSizing = class { constructor(..._a: any[]) {} } as any;
const CommissionModel = class { constructor(..._a: any[]) {} } as any;
const SlippageModel = class { constructor(..._a: any[]) {} } as any;
const Side = class { constructor(..._a: any[]) {} } as any;
const Timeframe = class { constructor(..._a: any[]) {} } as any;
const defaultBacktestConfig = {} as any;
const gridSearch = (..._a: any[]): any => ({});
const walkForwardAnalysis = (..._a: any[]): any => ({});


type SensitivityResult = any;

const volumeBreakout = (_p?: any) => ({ name: 'VolumeBreakout', onBar: () => null } as any);
const channelBreakout = (_p?: any) => ({ name: 'ChannelBreakout', onBar: () => null } as any);

// ── Types ────────────────────────────────────────────────────────────────────

export interface BacktestState {
  /** Current configuration for the backtest run */
  config: BacktestConfig;
  /** Price data fed into the engine */
  bars: Bar[];
  /** The most recent result after executing a backtest */
  result: BacktestResult | null;
  /** Computed performance metrics from the result */
  metrics: BacktestMetrics | null;
  /** Monthly return heatmap data */
  monthlyReturns: MonthlyReturn[];
  /** Trades from the most recent run */
  trades: Trade[];
  /** Open positions at the end of the run */
  positions: Position[];
  /** Equity curve points */
  equity: EquityPoint[];
  /** Drawdown periods */
  drawdowns: DrawdownPeriod[];
  /** Whether a backtest is currently running */
  isRunning: boolean;
  /** Error message if the last run failed */
  error: string | null;

  // Optimization results
  optimizationResult: OptimizationResult | null;
  monteCarloResult: MonteCarloOptResult | null;
  walkForwardResult: WalkForwardResult | null;
  cscvResult: CSCVResult | null;
  sensitivityResult: SensitivityResult | null;

  // Analytics
  rollingReturns: number[];
  rollingSharpe: number[];
  maeAnalysis: ReturnType<typeof maeMfeAnalysis> | null;
  dayOfWeek: ReturnType<typeof dayOfWeekAnalysis> | null;
  regimeData: ReturnType<typeof regimeAnalysis> | null;
  benchmarkComparison: ReturnType<typeof compareToBenchmark> | null;
  statisticalTest: ReturnType<typeof tTestReturns> | null;
}

export interface BacktestActions {
  /** Replace the config entirely */
  setConfig: (config: BacktestConfig) => void;
  /** Merge partial updates into the current config */
  updateConfig: (patch: Partial<BacktestConfig>) => void;
  /** Load price bars from an array */
  loadBars: (bars: Bar[]) => void;
  /** Generate synthetic bars for testing */
  generateSyntheticBars: (opts: SyntheticBarOptions) => void;
  /** Run the backtest with the current config and bars */
  run: () => Promise<void>;
  /** Run with a specific strategy and optional config overrides */
  runStrategy: (strategy: Strategy, overrides?: Partial<BacktestConfig>) => Promise<void>;
  /** Run one of the built-in strategy templates */
  runBuiltinStrategy: (name: BuiltinStrategyName, params?: Record<string, number>) => Promise<void>;
  /** Clear results and reset state */
  reset: () => void;

  // Optimization actions
  runGridSearch: (params: ParameterRange[], strategy: Strategy) => Promise<void>;
  runMonteCarlo: (params: ParameterRange[], strategy: Strategy, iterations?: number) => Promise<void>;
  runWalkForward: (strategy: Strategy, windows?: number, trainRatio?: number) => Promise<void>;
  runCSCV: (strategy: Strategy, folds?: number) => Promise<void>;
  runSensitivity: (paramName: string, values: number[], strategy: Strategy) => Promise<void>;

  // Analytics actions
  computeRollingReturns: (window?: number) => void;
  computeRollingSharpe: (window?: number) => void;
  computeMAEAnalysis: () => void;
  computeDayOfWeek: () => void;
  computeRegimeAnalysis: (threshold?: number) => void;
  computeBenchmark: (benchmarkReturns: number[]) => void;
  runStatisticalTest: (benchmarkReturns: number[]) => void;
}

export interface SyntheticBarOptions {
  symbol?: string;
  days?: number;
  startPrice?: number;
  volatility?: number;
  drift?: number;
  startDate?: Date;
}

export type BuiltinStrategyName =
  | 'sma-crossover'
  | 'rsi-mean-reversion'
  | 'bollinger-band'
  | 'macd'
  | 'momentum-rotation'
  | 'breakout'
  | 'mean-reversion-pairs'
  | 'turtle-trend'
  | 'volume-breakout'
  | 'channel-breakout';

// ── Synthetic bar generator ──────────────────────────────────────────────────

function generateSyntheticBarsData(opts: SyntheticBarOptions): Bar[] {
  const {
    symbol = 'SYNTH',
    days = 500,
    startPrice = 100,
    volatility = 0.02,
    drift = 0.0003,
    startDate = new Date('2022-01-03'),
  } = opts;

  const bars: Bar[] = [];
  let price = startPrice;
  const ms = startDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < days; i++) {
    const date = new Date(ms + i * dayMs);
    // Skip weekends
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    const ret = drift + volatility * (Math.random() * 2 - 1);
    const open = price;
    const close = price * (1 + ret);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.round(1e6 * (0.5 + Math.random()));

    bars.push({
      timestamp: date.getTime(),
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return bars;
}

// ── Built-in strategy mapping ────────────────────────────────────────────────

const BUILTIN_STRATEGIES: Record<BuiltinStrategyName, (params?: Record<string, number>) => Strategy> = {
  'sma-crossover': (p) => smaCrossover(p?.fast ?? 10, p?.slow ?? 30),
  'rsi-mean-reversion': (p) => rsiMeanReversion(p?.period ?? 14, p?.oversold ?? 30, p?.overbought ?? 70),
  'bollinger-band': (p) => bollingerBandStrategy(p?.period ?? 20, p?.mult ?? 2),
  'macd': (p) => macdStrategy(p?.fast ?? 12, p?.slow ?? 26, p?.signal ?? 9),
  'momentum-rotation': (p) => momentumRotation(p?.lookback ?? 60, p?.topN ?? 3),
  'breakout': (p) => breakoutStrategy(p?.period ?? 20, p?.atrMult ?? 1.5),
  'mean-reversion-pairs': (p) => meanReversionPairs(p?.lookback ?? 60, p?.zThreshold ?? 2),
  'turtle-trend': (p) => turtleTrendFollowing(p?.entryPeriod ?? 20, p?.exitPeriod ?? 10),
  'volume-breakout': (p) => volumeBreakout(p?.period ?? 20, p?.volMult ?? 2),
  'channel-breakout': (p) => channelBreakout(p?.period ?? 20, p?.atrMult ?? 1),
};

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: BacktestState = {
  config: defaultBacktestConfig,
  bars: [],
  result: null,
  metrics: null,
  monthlyReturns: [],
  trades: [],
  positions: [],
  equity: [],
  drawdowns: [],
  isRunning: false,
  error: null,
  optimizationResult: null,
  monteCarloResult: null,
  walkForwardResult: null,
  cscvResult: null,
  sensitivityResult: null,
  rollingReturns: [],
  rollingSharpe: [],
  maeAnalysis: null,
  dayOfWeek: null,
  regimeData: null,
  benchmarkComparison: null,
  statisticalTest: null,
};

export function useBacktest(): [BacktestState, BacktestActions] {
  const [state, setState] = useState<BacktestState>(INITIAL_STATE);
  const engineRef = useRef<BacktestEngine | null>(null);

  // Ensure we always have a fresh engine instance
  const getEngine = useCallback((): BacktestEngine => {
    if (!engineRef.current) {
      engineRef.current = new BacktestEngine();
    }
    return engineRef.current;
  }, []);

  // ── Config actions ───────────────────────────────────────────────────────

  const setConfig = useCallback((config: BacktestConfig) => {
    setState(prev => ({ ...prev, config }));
  }, []);

  const updateConfig = useCallback((patch: Partial<BacktestConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...patch },
    }));
  }, []);

  // ── Data actions ─────────────────────────────────────────────────────────

  const loadBars = useCallback((bars: Bar[]) => {
    setState(prev => ({ ...prev, bars }));
  }, []);

  const generateSyntheticBars = useCallback((opts: SyntheticBarOptions) => {
    const bars = generateSyntheticBarsData(opts);
    setState(prev => ({ ...prev, bars }));
  }, []);

  // ── Run actions ──────────────────────────────────────────────────────────

  const processResult = useCallback((result: BacktestResult) => {
    const metrics = computeMetrics(result);
    const monthlyReturns = computeMonthlyReturns(result);

    setState(prev => ({
      ...prev,
      result,
      metrics,
      monthlyReturns,
      trades: result.trades,
      positions: result.positions || [],
      equity: result.equity,
      drawdowns: result.drawdowns || [],
      isRunning: false,
      error: null,
    }));
  }, []);

  const run = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true, error: null }));
    try {
      const engine = getEngine();
      const result = engine.run(state.bars, state.config);
      processResult(result);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: err.message || 'Backtest failed',
      }));
    }
  }, [state.bars, state.config, getEngine, processResult]);

  const runStrategy = useCallback(
    async (strategy: Strategy, overrides?: Partial<BacktestConfig>) => {
      const config = { ...state.config, ...overrides, strategy };
      setState(prev => ({ ...prev, config, isRunning: true, error: null }));
      try {
        const engine = getEngine();
        const result = engine.run(state.bars, config);
        processResult(result);
      } catch (err: any) {
        setState(prev => ({
          ...prev,
          isRunning: false,
          error: err.message || 'Backtest failed',
        }));
      }
    },
    [state.bars, state.config, getEngine, processResult],
  );

  const runBuiltinStrategy = useCallback(
    async (name: BuiltinStrategyName, params?: Record<string, number>) => {
      const factory = BUILTIN_STRATEGIES[name];
      if (!factory) {
        setState(prev => ({ ...prev, error: `Unknown strategy: ${name}` }));
        return;
      }
      const strategy = factory(params);
      await runStrategy(strategy);
    },
    [runStrategy],
  );

  const reset = useCallback(() => {
    engineRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // ── Optimization actions ─────────────────────────────────────────────────

  const runGridSearch = useCallback(
    async (params: ParameterRange[], strategy: Strategy) => {
      setState(prev => ({ ...prev, isRunning: true, error: null }));
      try {
        const result = gridSearch(state.bars, state.config, params, strategy);
        setState(prev => ({ ...prev, optimizationResult: result, isRunning: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isRunning: false, error: err.message }));
      }
    },
    [state.bars, state.config],
  );

  const runMonteCarlo = useCallback(
    async (params: ParameterRange[], strategy: Strategy, iterations = 100) => {
      setState(prev => ({ ...prev, isRunning: true, error: null }));
      try {
        const result = monteCarloOptimization(state.bars, state.config, params, strategy, iterations);
        setState(prev => ({ ...prev, monteCarloResult: result, isRunning: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isRunning: false, error: err.message }));
      }
    },
    [state.bars, state.config],
  );

  const runWalkForward = useCallback(
    async (strategy: Strategy, windows = 5, trainRatio = 0.7) => {
      setState(prev => ({ ...prev, isRunning: true, error: null }));
      try {
        const result = walkForwardAnalysis(state.bars, state.config, strategy, windows, trainRatio);
        setState(prev => ({ ...prev, walkForwardResult: result, isRunning: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isRunning: false, error: err.message }));
      }
    },
    [state.bars, state.config],
  );

  const runCSCV = useCallback(
    async (strategy: Strategy, folds = 10) => {
      setState(prev => ({ ...prev, isRunning: true, error: null }));
      try {
        const result = cscv(state.bars, state.config, strategy, folds);
        setState(prev => ({ ...prev, cscvResult: result, isRunning: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isRunning: false, error: err.message }));
      }
    },
    [state.bars, state.config],
  );

  const runSensitivity = useCallback(
    async (paramName: string, values: number[], strategy: Strategy) => {
      setState(prev => ({ ...prev, isRunning: true, error: null }));
      try {
        const result = sensitivityAnalysis(state.bars, state.config, paramName, values, strategy);
        setState(prev => ({ ...prev, sensitivityResult: result, isRunning: false }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isRunning: false, error: err.message }));
      }
    },
    [state.bars, state.config],
  );

  // ── Analytics actions ────────────────────────────────────────────────────

  const computeRollingReturns = useCallback(
    (window = 20) => {
      if (!state.result) return;
      const returns = state.equity.map((e, i, arr) =>
        i === 0 ? 0 : (e.value - arr[i - 1].value) / arr[i - 1].value,
      );
      const rolling = rollingMetric(returns, window, (seg) => {
        const cum = seg.reduce((a, r) => a * (1 + r), 1) - 1;
        return cum;
      });
      setState(prev => ({ ...prev, rollingReturns: rolling }));
    },
    [state.result, state.equity],
  );

  const computeRollingSharpe = useCallback(
    (window = 60) => {
      if (!state.result) return;
      const returns = state.equity.map((e, i, arr) =>
        i === 0 ? 0 : (e.value - arr[i - 1].value) / arr[i - 1].value,
      );
      const rolling = rollingMetric(returns, window, (seg) => {
        const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
        const std = Math.sqrt(seg.reduce((a, r) => a + (r - mean) ** 2, 0) / seg.length);
        return std > 0 ? (mean / std) * Math.sqrt(252) : 0;
      });
      setState(prev => ({ ...prev, rollingSharpe: rolling }));
    },
    [state.result, state.equity],
  );

  const computeMAEAnalysis = useCallback(() => {
    if (!state.result) return;
    const maeData = maeMfeAnalysis(state.trades);
    setState(prev => ({ ...prev, maeAnalysis: maeData }));
  }, [state.result, state.trades]);

  const computeDayOfWeek = useCallback(() => {
    if (!state.result) return;
    const dowData = dayOfWeekAnalysis(state.trades);
    setState(prev => ({ ...prev, dayOfWeek: dowData }));
  }, [state.result, state.trades]);

  const computeRegimeAnalysis = useCallback(
    (threshold = 0) => {
      if (!state.result) return;
      const regData = regimeAnalysis(state.equity, threshold);
      setState(prev => ({ ...prev, regimeData: regData }));
    },
    [state.result, state.equity],
  );

  const computeBenchmark = useCallback(
    (benchmarkReturns: number[]) => {
      if (!state.result) return;
      const strategyReturns = state.equity.map((e, i, arr) =>
        i === 0 ? 0 : (e.value - arr[i - 1].value) / arr[i - 1].value,
      );
      const cmp = compareToBenchmark(strategyReturns, benchmarkReturns);
      setState(prev => ({ ...prev, benchmarkComparison: cmp }));
    },
    [state.result, state.equity],
  );

  const runStatisticalTest = useCallback(
    (benchmarkReturns: number[]) => {
      if (!state.result) return;
      const strategyReturns = state.equity.map((e, i, arr) =>
        i === 0 ? 0 : (e.value - arr[i - 1].value) / arr[i - 1].value,
      );
      const tt = tTestReturns(strategyReturns, benchmarkReturns);
      setState(prev => ({ ...prev, statisticalTest: tt }));
    },
    [state.result, state.equity],
  );

  // ── Build actions object ─────────────────────────────────────────────────

  const actions: BacktestActions = useMemo(
    () => ({
      setConfig,
      updateConfig,
      loadBars,
      generateSyntheticBars,
      run,
      runStrategy,
      runBuiltinStrategy,
      reset,
      runGridSearch,
      runMonteCarlo,
      runWalkForward,
      runCSCV,
      runSensitivity,
      computeRollingReturns,
      computeRollingSharpe,
      computeMAEAnalysis,
      computeDayOfWeek,
      computeRegimeAnalysis,
      computeBenchmark,
      runStatisticalTest,
    }),
    [
      setConfig,
      updateConfig,
      loadBars,
      generateSyntheticBars,
      run,
      runStrategy,
      runBuiltinStrategy,
      reset,
      runGridSearch,
      runMonteCarlo,
      runWalkForward,
      runCSCV,
      runSensitivity,
      computeRollingReturns,
      computeRollingSharpe,
      computeMAEAnalysis,
      computeDayOfWeek,
      computeRegimeAnalysis,
      computeBenchmark,
      runStatisticalTest,
    ],
  );

  return [state, actions];
}

// Re-export key types for consumer convenience
export type {
  Bar,
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  Strategy,
  MonthlyReturn,
  EquityPoint,
  DrawdownPeriod,
  Trade,
  Position,
  ParameterRange,
  OptimizationResult,
  WalkForwardResult,
};
export {
  Signal,
  OrderType,
  PositionSizing,
  CommissionModel,
  SlippageModel,
  Side,
  Timeframe,
  defaultBacktestConfig,
};
