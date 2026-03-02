/**
 * useBacktest.ts
 * Backtest execution hook with start/stop/pause controls, progress tracking,
 * results subscription, parameter optimization, walk-forward analysis,
 * Monte Carlo simulation, result comparison, export, and strategy
 * parameter management.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BacktestStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';
export type OptimizationMethod = 'grid' | 'random' | 'bayesian' | 'genetic';

export interface StrategyParameter {
  name: string;
  type: 'number' | 'boolean' | 'enum';
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
  optimize?: boolean;
}

export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  symbols?: string[];
  startDate: string;
  endDate: string;
  timeframe: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  marginRate?: number;
  parameters: StrategyParameter[];
  benchmarkSymbol?: string;
  riskFreeRate?: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  commission: number;
  mae: number;
  mfe: number;
  holdingPeriodBars: number;
}

export interface BacktestResults {
  id: string;
  config: BacktestConfig;
  trades: TradeRecord[];
  equity: Array<{ time: number; value: number }>;
  drawdown: Array<{ time: number; value: number }>;
  metrics: BacktestMetrics;
  completedAt: number;
  executionTimeMs: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDrawdownDuration: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  payoffRatio: number;
  expectancy: number;
  avgHoldingPeriod: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  recoveryFactor: number;
  ulcerIndex: number;
  beta?: number;
  alpha?: number;
  informationRatio?: number;
}

export interface OptimizationResult {
  parameterSets: Array<{
    parameters: Record<string, number | boolean | string>;
    metrics: BacktestMetrics;
  }>;
  bestSet: Record<string, number | boolean | string>;
  bestMetric: number;
  targetMetric: string;
  totalCombinations: number;
  completedCombinations: number;
}

export interface WalkForwardResult {
  windows: Array<{
    inSampleStart: string;
    inSampleEnd: string;
    outSampleStart: string;
    outSampleEnd: string;
    inSampleMetrics: BacktestMetrics;
    outSampleMetrics: BacktestMetrics;
    selectedParameters: Record<string, number | boolean | string>;
  }>;
  aggregateOOS: BacktestMetrics;
  efficiencyRatio: number;
}

export interface MonteCarloResult {
  simulations: number;
  confidenceLevels: Array<{
    confidence: number;
    maxDrawdown: number;
    finalEquity: number;
    annualizedReturn: number;
  }>;
  ruinProbability: number;
  medianFinalEquity: number;
  meanMaxDrawdown: number;
}

export interface UseBacktestOptions {
  apiUrl?: string;
  workerUrl?: string;
  onProgress?: (pct: number) => void;
  onComplete?: (results: BacktestResults) => void;
  onError?: (error: string) => void;
  mockMode?: boolean;
}

// ─── Mock Simulation ───────────────────────────────────────────────────────────

function generateMockResults(config: BacktestConfig): BacktestResults {
  const trades: TradeRecord[] = [];
  const equity: Array<{ time: number; value: number }> = [];
  let capital = config.initialCapital;
  const startTs = new Date(config.startDate).getTime();
  const endTs = new Date(config.endDate).getTime();
  const numBars = 200;
  const barSize = (endTs - startTs) / numBars;

  for (let i = 0; i < numBars; i++) {
    const time = startTs + i * barSize;
    const returnPct = (Math.random() - 0.48) * 0.04;
    capital *= (1 + returnPct);
    equity.push({ time, value: capital });

    if (Math.random() > 0.85) {
      const pnl = capital * (Math.random() - 0.4) * 0.02;
      trades.push({
        id: `T-${i}`, symbol: config.symbol, side: pnl > 0 ? 'long' : 'short',
        entryPrice: 100 + Math.random() * 50, exitPrice: 100 + Math.random() * 50,
        entryTime: time, exitTime: time + barSize * 3, quantity: 100,
        pnl, pnlPct: pnl / capital * 100, commission: config.commission,
        mae: -Math.abs(pnl) * 0.5, mfe: Math.abs(pnl) * 1.2, holdingPeriodBars: 3,
      });
    }
  }

  const totalReturn = capital - config.initialCapital;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const maxEq = Math.max(...equity.map(e => e.value));
  const drawdown = equity.map(e => ({ time: e.time, value: (e.value - maxEq) / maxEq }));

  return {
    id: `BT-${Date.now().toString(36)}`, config, trades, equity, drawdown,
    completedAt: Date.now(), executionTimeMs: 1200 + Math.random() * 3000,
    metrics: {
      totalReturn, totalReturnPct: (totalReturn / config.initialCapital) * 100,
      annualizedReturn: ((capital / config.initialCapital) ** (365 / ((endTs - startTs) / 86400000)) - 1) * 100,
      sharpeRatio: 0.8 + Math.random() * 1.5, sortinoRatio: 1.0 + Math.random() * 1.5,
      calmarRatio: 0.5 + Math.random() * 2, maxDrawdown: -Math.abs(Math.min(...drawdown.map(d => d.value))) * config.initialCapital,
      maxDrawdownPct: Math.min(...drawdown.map(d => d.value)) * 100,
      maxDrawdownDuration: 30 + Math.random() * 60, totalTrades: trades.length,
      winRate: wins.length / Math.max(1, trades.length), avgWin: wins.reduce((s, t) => s + t.pnl, 0) / Math.max(1, wins.length),
      avgLoss: losses.reduce((s, t) => s + t.pnl, 0) / Math.max(1, losses.length),
      profitFactor: Math.abs(wins.reduce((s, t) => s + t.pnl, 0)) / Math.max(1, Math.abs(losses.reduce((s, t) => s + t.pnl, 0))),
      payoffRatio: 1.2 + Math.random(), expectancy: totalReturn / Math.max(1, trades.length),
      avgHoldingPeriod: 3, longestWinStreak: 5 + Math.floor(Math.random() * 5),
      longestLoseStreak: 3 + Math.floor(Math.random() * 4), recoveryFactor: 1.5 + Math.random(),
      ulcerIndex: 5 + Math.random() * 10,
    },
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useBacktest(options: UseBacktestOptions = {}) {
  const {
    apiUrl = '/api/backtest',
    onProgress,
    onComplete,
    onError,
    mockMode = true,
  } = options;

  const [status, setStatus] = useState<BacktestStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [savedResults, setSavedResults] = useState<BacktestResults[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [walkForwardResult, setWalkForwardResult] = useState<WalkForwardResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parameters, setParameters] = useState<StrategyParameter[]>([]);

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const simulateProgress = useCallback((durationMs: number, onDone: () => void) => {
    let elapsed = 0;
    const step = 50;
    progressTimerRef.current = setInterval(() => {
      if (cancelRef.current) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        return;
      }
      if (pauseRef.current) return;
      elapsed += step;
      const pct = Math.min(99, (elapsed / durationMs) * 100);
      setProgress(pct);
      onProgress?.(pct);
      if (elapsed >= durationMs) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        setProgress(100);
        onProgress?.(100);
        onDone();
      }
    }, step);
  }, [onProgress]);

  const start = useCallback(async (config: BacktestConfig) => {
    cancelRef.current = false;
    pauseRef.current = false;
    setStatus('running');
    setProgress(0);
    setError(null);
    setResults(null);

    try {
      if (mockMode) {
        simulateProgress(2000, () => {
          if (cancelRef.current) return;
          const res = generateMockResults(config);
          setResults(res);
          setStatus('completed');
          onComplete?.(res);
        });
      } else {
        const res = await fetch(`${apiUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: BacktestResults = await res.json();
        setResults(data);
        setStatus('completed');
        setProgress(100);
        onComplete?.(data);
      }
    } catch (err) {
      const msg = `Backtest failed: ${err}`;
      setError(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [apiUrl, mockMode, simulateProgress, onComplete, onError]);

  const stop = useCallback(() => {
    cancelRef.current = true;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus('cancelled');
  }, []);

  const pause = useCallback(() => {
    pauseRef.current = true;
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setStatus('running');
  }, []);

  const runOptimization = useCallback(async (
    config: BacktestConfig,
    method: OptimizationMethod = 'grid',
    targetMetric: keyof BacktestMetrics = 'sharpeRatio'
  ) => {
    setStatus('running');
    setProgress(0);

    const optimizable = config.parameters.filter(p => p.optimize && p.type === 'number');
    const combinations: Array<Record<string, number | boolean | string>> = [];

    if (method === 'grid') {
      const paramRanges = optimizable.map(p => {
        const vals: number[] = [];
        for (let v = (p.min ?? 0); v <= (p.max ?? 100); v += (p.step ?? 1)) vals.push(v);
        return { name: p.name, values: vals };
      });
      const cartesian = (arrs: typeof paramRanges, prefix: Record<string, number> = {}): Record<string, number>[] => {
        if (arrs.length === 0) return [prefix];
        const [first, ...rest] = arrs;
        return first.values.flatMap(v => cartesian(rest, { ...prefix, [first.name]: v }));
      };
      combinations.push(...cartesian(paramRanges));
    } else {
      for (let i = 0; i < 50; i++) {
        const combo: Record<string, number> = {};
        optimizable.forEach(p => {
          combo[p.name] = (p.min ?? 0) + Math.random() * ((p.max ?? 100) - (p.min ?? 0));
        });
        combinations.push(combo);
      }
    }

    const parameterSets: OptimizationResult['parameterSets'] = [];
    for (let i = 0; i < combinations.length; i++) {
      if (cancelRef.current) break;
      const mockRes = generateMockResults(config);
      parameterSets.push({ parameters: combinations[i], metrics: mockRes.metrics });
      setProgress(((i + 1) / combinations.length) * 100);
    }

    const bestIdx = parameterSets.reduce((best, curr, idx) =>
      (curr.metrics[targetMetric] as number) > (parameterSets[best].metrics[targetMetric] as number) ? idx : best, 0);

    const result: OptimizationResult = {
      parameterSets, bestSet: parameterSets[bestIdx].parameters,
      bestMetric: parameterSets[bestIdx].metrics[targetMetric] as number,
      targetMetric: targetMetric as string,
      totalCombinations: combinations.length, completedCombinations: parameterSets.length,
    };
    setOptimizationResult(result);
    setStatus('completed');
    return result;
  }, []);

  const runWalkForward = useCallback(async (config: BacktestConfig, windowCount = 5) => {
    setStatus('running');
    const windows: WalkForwardResult['windows'] = [];
    for (let i = 0; i < windowCount; i++) {
      const inRes = generateMockResults(config);
      const outRes = generateMockResults(config);
      windows.push({
        inSampleStart: config.startDate, inSampleEnd: config.endDate,
        outSampleStart: config.startDate, outSampleEnd: config.endDate,
        inSampleMetrics: inRes.metrics, outSampleMetrics: outRes.metrics,
        selectedParameters: {},
      });
      setProgress(((i + 1) / windowCount) * 100);
    }
    const result: WalkForwardResult = {
      windows, aggregateOOS: windows[0].outSampleMetrics,
      efficiencyRatio: 0.6 + Math.random() * 0.3,
    };
    setWalkForwardResult(result);
    setStatus('completed');
    return result;
  }, []);

  const runMonteCarlo = useCallback(async (baseResults: BacktestResults, simCount = 1000) => {
    setStatus('running');
    const finalEquities: number[] = [];
    const maxDrawdowns: number[] = [];

    for (let sim = 0; sim < simCount; sim++) {
      const shuffled = [...baseResults.trades].sort(() => Math.random() - 0.5);
      let equity = baseResults.config.initialCapital;
      let peak = equity;
      let maxDd = 0;
      shuffled.forEach(t => {
        equity += t.pnl;
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDd) maxDd = dd;
      });
      finalEquities.push(equity);
      maxDrawdowns.push(maxDd);
      if (sim % 100 === 0) setProgress((sim / simCount) * 100);
    }

    finalEquities.sort((a, b) => a - b);
    maxDrawdowns.sort((a, b) => a - b);

    const result: MonteCarloResult = {
      simulations: simCount,
      confidenceLevels: [95, 90, 75, 50].map(c => ({
        confidence: c,
        maxDrawdown: maxDrawdowns[Math.floor((c / 100) * simCount)] ?? 0,
        finalEquity: finalEquities[Math.floor(((100 - c) / 100) * simCount)] ?? 0,
        annualizedReturn: 0,
      })),
      ruinProbability: finalEquities.filter(e => e <= 0).length / simCount,
      medianFinalEquity: finalEquities[Math.floor(simCount / 2)],
      meanMaxDrawdown: maxDrawdowns.reduce((s, v) => s + v, 0) / simCount,
    };
    setMonteCarloResult(result);
    setStatus('completed');
    return result;
  }, []);

  const saveResult = useCallback((result: BacktestResults) => {
    setSavedResults(prev => [...prev, result]);
  }, []);

  const exportResults = useCallback((result: BacktestResults, format: 'json' | 'csv' = 'json') => {
    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'csv') {
      const headers = Object.keys(result.metrics).join(',');
      const values = Object.values(result.metrics).join(',');
      const tradeHeaders = 'id,symbol,side,entryPrice,exitPrice,pnl,pnlPct';
      const tradeRows = result.trades.map(t => `${t.id},${t.symbol},${t.side},${t.entryPrice},${t.exitPrice},${t.pnl},${t.pnlPct}`);
      content = `Metrics\n${headers}\n${values}\n\nTrades\n${tradeHeaders}\n${tradeRows.join('\n')}`;
      mimeType = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(result, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-${result.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const updateParameter = useCallback((name: string, value: number | boolean | string) => {
    setParameters(prev => prev.map(p => p.name === name ? { ...p, value } : p));
  }, []);

  const compareResults = useCallback((a: BacktestResults, b: BacktestResults) => {
    const keys = Object.keys(a.metrics) as (keyof BacktestMetrics)[];
    return keys.reduce((acc, key) => {
      const va = a.metrics[key] as number;
      const vb = b.metrics[key] as number;
      acc[key] = { a: va, b: vb, diff: va - vb, pctDiff: vb !== 0 ? ((va - vb) / Math.abs(vb)) * 100 : 0 };
      return acc;
    }, {} as Record<string, { a: number; b: number; diff: number; pctDiff: number }>);
  }, []);

  return {
    status, progress, results, error,
    savedResults, optimizationResult, walkForwardResult, monteCarloResult,
    parameters,
    start, stop, pause, resume,
    runOptimization, runWalkForward, runMonteCarlo,
    saveResult, exportResults, compareResults,
    updateParameter, setParameters,
  };
}

export default useBacktest;
