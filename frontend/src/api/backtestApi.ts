/**
 * backtestApi.ts
 * Backtest API client for running backtests, parameter optimization,
 * walk-forward analysis, Monte Carlo simulations, and strategy management.
 */

import { apiClient, cachedApiClient, pollClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StrategyType =
  | 'momentum'
  | 'mean_reversion'
  | 'trend_following'
  | 'breakout'
  | 'pairs_trading'
  | 'stat_arb'
  | 'market_making'
  | 'custom';

export interface BacktestConfig {
  strategyId: string;
  name?: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  timeframe: string;
  initialCapital: number;
  commission?: number;
  slippage?: number;
  maxPositionSize?: number;
  maxDrawdownLimit?: number;
  riskFreeRate?: number;
  benchmark?: string;
  parameters: Record<string, number | string | boolean>;
  warmupPeriod?: number;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: string;
  exitDate: string;
  pnl: number;
  pnlPct: number;
  holdingPeriod: number;
  commission: number;
  slippage: number;
  mae: number;
  mfe: number;
}

export interface EquityCurvePoint {
  date: string;
  equity: number;
  cash: number;
  invested: number;
  dailyReturn: number;
  cumulativeReturn: number;
  drawdown: number;
  benchmark?: number;
}

export interface BacktestResults {
  runId: string;
  config: BacktestConfig;
  status: BacktestStatus;
  startedAt: string;
  completedAt: string | null;
  executionTimeMs: number;
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDate: string;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgHoldingPeriod: number;
  avgTradeReturn: number;
  expectancy: number;
  payoffRatio: number;
  ulcerIndex: number;
  recoveryFactor: number;
  tailRatio: number;
  beta: number | null;
  alpha: number | null;
  informationRatio: number | null;
  trackingError: number | null;
  trades: BacktestTrade[];
  equityCurve: EquityCurvePoint[];
  monthlyReturns: Record<string, number>;
  yearlyReturns: Record<string, number>;
  drawdownPeriods: Array<{
    start: string;
    trough: string;
    end: string | null;
    depth: number;
    duration: number;
    recovery: number | null;
  }>;
}

export interface BacktestStatusResponse {
  runId: string;
  status: BacktestStatus;
  progress: number;
  currentDate?: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface BacktestListItem {
  runId: string;
  name: string;
  strategyId: string;
  status: BacktestStatus;
  symbols: string[];
  startDate: string;
  endDate: string;
  totalReturn: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  totalTrades: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface BacktestFilters {
  strategyId?: string;
  status?: BacktestStatus;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface OptimizationConfig {
  baseConfig: BacktestConfig;
  parameterRanges: Record<string, {
    min: number;
    max: number;
    step: number;
  }>;
  objective: 'sharpe' | 'return' | 'calmar' | 'sortino' | 'profit_factor';
  method?: 'grid' | 'random' | 'bayesian';
  maxIterations?: number;
  crossValidation?: boolean;
}

export interface OptimizationResult {
  runId: string;
  bestParameters: Record<string, number>;
  bestObjectiveValue: number;
  iterations: number;
  results: Array<{
    parameters: Record<string, number>;
    objectiveValue: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  }>;
  sensitivityAnalysis: Record<string, Array<{
    value: number;
    objectiveValue: number;
  }>>;
  overfitScore: number;
  status: BacktestStatus;
  executionTimeMs: number;
}

export interface WalkForwardConfig {
  baseConfig: BacktestConfig;
  inSamplePeriod: number;
  outOfSamplePeriod: number;
  steps: number;
  optimizationObjective: 'sharpe' | 'return' | 'calmar';
  parameterRanges: Record<string, { min: number; max: number; step: number }>;
  anchored?: boolean;
}

export interface WalkForwardResult {
  runId: string;
  windows: Array<{
    inSampleStart: string;
    inSampleEnd: string;
    outOfSampleStart: string;
    outOfSampleEnd: string;
    inSampleReturn: number;
    outOfSampleReturn: number;
    inSampleSharpe: number;
    outOfSampleSharpe: number;
    bestParameters: Record<string, number>;
    degradation: number;
  }>;
  aggregateISReturn: number;
  aggregateOOSReturn: number;
  aggregateISSharpe: number;
  aggregateOOSSharpe: number;
  robustnessScore: number;
  walkForwardEfficiency: number;
  status: BacktestStatus;
  executionTimeMs: number;
}

export interface MonteCarloConfig {
  baseResults: string;
  simulations: number;
  method: 'bootstrap' | 'parametric' | 'block_bootstrap';
  blockSize?: number;
  confidenceLevels?: number[];
}

export interface MonteCarloResult {
  runId: string;
  simulations: number;
  method: string;
  confidenceBands: Record<string, {
    terminalWealth: number;
    maxDrawdown: number;
    annualizedReturn: number;
    sharpeRatio: number;
  }>;
  medianTerminalWealth: number;
  meanTerminalWealth: number;
  probabilityOfProfit: number;
  probabilityOfRuin: number;
  ruinThreshold: number;
  terminalWealthDistribution: number[];
  maxDrawdownDistribution: number[];
  status: BacktestStatus;
  executionTimeMs: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  description: string;
  author: string;
  version: string;
  parameters: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean';
    default: number | string | boolean;
    description: string;
    min?: number;
    max?: number;
    options?: string[];
  }>;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveStrategyParams {
  name: string;
  type: StrategyType;
  description: string;
  code: string;
  parameters: Strategy['parameters'];
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/backtest';

export async function runBacktest(
  config: BacktestConfig,
): Promise<{ runId: string; status: BacktestStatus }> {
  return apiClient.post(`${BASE}/run`, config, {
    timeoutMs: 15000,
    deduplicate: false,
  } as never);
}

export async function getBacktestStatus(
  runId: string,
): Promise<BacktestStatusResponse> {
  return pollClient.get<BacktestStatusResponse>(
    `${BASE}/status/${runId}`,
  );
}

export async function getBacktestResults(
  runId: string,
): Promise<BacktestResults> {
  return apiClient.get<BacktestResults>(
    `${BASE}/results/${runId}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function cancelBacktest(
  runId: string,
): Promise<{ runId: string; status: BacktestStatus }> {
  return apiClient.post(`${BASE}/cancel/${runId}`, {});
}

export async function listBacktests(
  filters?: BacktestFilters,
): Promise<{ backtests: BacktestListItem[]; total: number }> {
  const q = filters
    ? new URLSearchParams(
        Object.entries(filters)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  return apiClient.get(`${BASE}/list${q ? `?${q}` : ''}`);
}

export async function deleteBacktest(runId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${runId}`);
}

export async function runOptimization(
  config: OptimizationConfig,
): Promise<{ runId: string; status: BacktestStatus }> {
  return apiClient.post(`${BASE}/optimize`, config, {
    timeoutMs: 60000,
    deduplicate: false,
  } as never);
}

export async function getOptimizationResults(
  runId: string,
): Promise<OptimizationResult> {
  return apiClient.get<OptimizationResult>(
    `${BASE}/optimize/results/${runId}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function runWalkForward(
  config: WalkForwardConfig,
): Promise<{ runId: string; status: BacktestStatus }> {
  return apiClient.post(`${BASE}/walk-forward`, config, {
    timeoutMs: 60000,
    deduplicate: false,
  } as never);
}

export async function getWalkForwardResults(
  runId: string,
): Promise<WalkForwardResult> {
  return apiClient.get<WalkForwardResult>(
    `${BASE}/walk-forward/results/${runId}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function runMonteCarlo(
  config: MonteCarloConfig,
): Promise<{ runId: string; status: BacktestStatus }> {
  return apiClient.post(`${BASE}/monte-carlo`, config, {
    timeoutMs: 30000,
    deduplicate: false,
  } as never);
}

export async function getMonteCarloResults(
  runId: string,
): Promise<MonteCarloResult> {
  return apiClient.get<MonteCarloResult>(
    `${BASE}/monte-carlo/results/${runId}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function getStrategies(): Promise<Strategy[]> {
  return cachedApiClient.get<Strategy[]>(
    `${BASE}/strategies`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function getStrategy(strategyId: string): Promise<Strategy> {
  return cachedApiClient.get<Strategy>(
    `${BASE}/strategies/${strategyId}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function saveStrategy(
  params: SaveStrategyParams,
): Promise<Strategy> {
  apiClient.invalidateCache(`${BASE}/strategies`);
  return apiClient.post<Strategy>(`${BASE}/strategies`, params);
}

export async function updateStrategy(
  strategyId: string,
  updates: Partial<SaveStrategyParams>,
): Promise<Strategy> {
  apiClient.invalidateCache(`${BASE}/strategies`);
  return apiClient.patch<Strategy>(
    `${BASE}/strategies/${strategyId}`,
    updates,
  );
}

export async function deleteStrategy(strategyId: string): Promise<void> {
  apiClient.invalidateCache(`${BASE}/strategies`);
  await apiClient.delete(`${BASE}/strategies/${strategyId}`);
}

// ─── Polling helper ───────────────────────────────────────────────────────────

export async function pollBacktestUntilDone(
  runId: string,
  onProgress?: (status: BacktestStatusResponse) => void,
  intervalMs = 2000,
  timeoutMs = 300_000,
): Promise<BacktestResults> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getBacktestStatus(runId);
    onProgress?.(status);
    if (status.status === 'completed') return getBacktestResults(runId);
    if (status.status === 'failed') throw new Error(status.error ?? 'Backtest failed');
    if (status.status === 'cancelled') throw new Error('Backtest cancelled');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Backtest polling timed out');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function backtestStatusColor(status: BacktestStatus): string {
  const map: Record<BacktestStatus, string> = {
    queued: '#6b7280',
    running: '#3b82f6',
    completed: '#00d4aa',
    failed: '#ef4444',
    cancelled: '#f59e0b',
  };
  return map[status];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = Math.floor(secs % 60);
  return `${mins}m ${remSecs}s`;
}

export function formatSharpe(ratio: number): string {
  return ratio.toFixed(2);
}
