/**
 * stressTestApi.ts
 * API client for Stress Testing & Risk Analysis endpoints (FastAPI backend).
 * Covers VaR, CVaR, drawdown analysis, stress scenarios, and full risk reports.
 */

import { useState, useCallback, useEffect } from 'react';

// ─── Base ─────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STRESS_BASE = `${BASE_URL}/api/stress-testing`;
const DEFAULT_TIMEOUT = 15000;

export class StressApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly endpoint: string,
  ) {
    super(`StressAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'StressApiError';
  }
}

async function apiFetch<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, ...rest } = options;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...rest.headers }, signal: ctrl.signal, ...rest });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new StressApiError(r.status, err.detail ?? r.statusText, url);
    }
    return r.json() as Promise<T>;
  } finally {
    clearTimeout(t);
  }
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${STRESS_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

const get = <T>(path: string) => apiFetch<T>(`${STRESS_BASE}${path}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export type VaRMethod = 'historical' | 'parametric' | 'monte_carlo' | 'cornish_fisher';

export interface ReturnSeries {
  dates: string[];          // ISO date strings
  returns: number[];        // decimal returns, e.g. 0.012 = +1.2%
  symbol?: string;
}

export interface VaRRequest {
  returns: ReturnSeries;
  confidence_level?: number;       // default 0.95
  method?: VaRMethod;
  lookback_days?: number;          // default 252
  portfolio_value?: number;
}

export interface VaRResult {
  method: VaRMethod;
  confidence_level: number;
  var_return: number;         // e.g. -0.023
  var_dollar?: number;
  expected_shortfall: number; // CVaR
  expected_shortfall_dollar?: number;
  lookback_days: number;
  observations: number;
}

export interface MultiMethodVaRRequest {
  returns: ReturnSeries;
  confidence_level?: number;
  portfolio_value?: number;
}

export interface MultiMethodVaRResult {
  results: Record<VaRMethod, VaRResult>;
  recommended_method: VaRMethod;
  portfolio_value?: number;
}

export interface CVaRRequest {
  returns: ReturnSeries;
  confidence_level?: number;
  method?: VaRMethod;
}

export interface CVaRResult {
  expected_shortfall: number;
  var_threshold: number;
  tail_losses: number[];
  mean_tail_loss: number;
  worst_loss: number;
  confidence_level: number;
}

export interface DrawdownRequest {
  cumulative_returns: number[];   // or price levels
  dates?: string[];
  is_prices?: boolean;
}

export interface DrawdownPeriod {
  peak_date?: string;
  trough_date?: string;
  recovery_date?: string;
  peak_value: number;
  trough_value: number;
  drawdown_pct: number;
  duration_days?: number;
  recovery_days?: number;
}

export interface DrawdownAnalysis {
  max_drawdown: number;
  max_drawdown_duration_days?: number;
  average_drawdown: number;
  drawdown_periods: DrawdownPeriod[];
  recovery_factor: number;
  underwater_pct: number;   // % of days underwater
  current_drawdown: number;
  calmar_ratio?: number;
}

export interface ScenarioInput {
  name: string;
  description?: string;
  asset_shocks: Record<string, number>;  // symbol -> shock multiplier
  correlation_impact?: number;            // -1 to +1
  duration_days?: number;
}

export interface ScenarioResult {
  scenario_name: string;
  portfolio_return: number;
  worst_position: string;
  best_position: string;
  var_impact_multiplier: number;
  estimated_dollar_loss?: number;
  probability_weight?: number;
}

export interface StressTestRequest {
  portfolio_weights: Record<string, number>;   // symbol -> weight
  portfolio_value?: number;
  scenarios?: ScenarioInput[];
  include_historical?: boolean;
  confidence_level?: number;
}

export interface HistoricalScenarioResult {
  scenario: string;
  period: string;
  market_return: number;
  estimated_portfolio_return: number;
  estimated_dollar_loss?: number;
  beta_adjusted: boolean;
}

export interface FullStressTestResult {
  var_results: MultiMethodVaRResult;
  drawdown: DrawdownAnalysis;
  stress_scenarios: ScenarioResult[];
  historical_scenarios: HistoricalScenarioResult[];
  risk_summary: {
    risk_level: string;
    max_loss_1d_95: number;
    max_loss_1d_99: number;
    max_drawdown: number;
    sharpe_ratio?: number;
    sortino_ratio?: number;
  };
  timestamp: string;
}

export interface LossDistributionRequest {
  returns: ReturnSeries;
  bins?: number;
  portfolio_value?: number;
}

export interface LossDistributionResult {
  histogram_returns: number[];
  histogram_counts: number[];
  var_95: number;
  var_99: number;
  cvar_95: number;
  skewness: number;
  kurtosis: number;
  is_fat_tailed: boolean;
  normality_p_value?: number;
}

export interface RiskMetricsRequest {
  returns: ReturnSeries;
  benchmark_returns?: ReturnSeries;
  risk_free_rate?: number;
}

export interface RiskMetricsResult {
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  information_ratio?: number;
  max_drawdown: number;
  annualized_return: number;
  annualized_volatility: number;
  downside_deviation: number;
  up_capture?: number;
  down_capture?: number;
  beta?: number;
  alpha?: number;
  r_squared?: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const getStressTestCapabilities = () =>
  get<{ endpoints: string[]; var_methods: string[]; historical_scenarios: string[] }>('/capabilities');

export const calculateVaR = (req: VaRRequest) =>
  post<VaRResult>('/var/calculate', req);

export const calculateMultiMethodVaR = (req: MultiMethodVaRRequest) =>
  post<MultiMethodVaRResult>('/var/multi-method', req);

export const calculateCVaR = (req: CVaRRequest) =>
  post<CVaRResult>('/cvar/calculate', req);

export const analyzeDrawdowns = (req: DrawdownRequest) =>
  post<DrawdownAnalysis>('/drawdown/analyze', req);

export const runStressTests = (req: StressTestRequest) =>
  post<ScenarioResult[]>('/scenarios/stress', req);

export const runHistoricalScenarios = (req: { portfolio_weights: Record<string, number>; portfolio_value?: number }) =>
  post<HistoricalScenarioResult[]>('/scenarios/historical', req);

export const getAvailableScenarios = () =>
  get<{ scenarios: Array<{ name: string; period: string; description: string }> }>('/scenarios/available');

export const getLossDistribution = (req: LossDistributionRequest) =>
  post<LossDistributionResult>('/loss-distribution', req);

export const calculateRiskMetrics = (req: RiskMetricsRequest) =>
  post<RiskMetricsResult>('/risk-metrics', req);

export const getFullRiskReport = (req: {
  portfolio_weights: Record<string, number>;
  returns: ReturnSeries;
  portfolio_value?: number;
  confidence_level?: number;
}) => post<FullStressTestResult>('/full-report', req);

// ─── Utility Helpers ──────────────────────────────────────────────────────────

/** Convert a list of price series to log returns */
export function pricesToLogReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const result: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    result.push(Math.log(prices[i] / prices[i - 1]));
  }
  return result;
}

/** Annualize a daily volatility (assuming 252 trading days) */
export function annualizeVolatility(dailyVol: number, tradingDays = 252): number {
  return dailyVol * Math.sqrt(tradingDays);
}

/** Scale VaR from daily to N-day horizon using square-root-of-time rule */
export function scaleVaRToHorizon(dailyVaR: number, days: number): number {
  return dailyVaR * Math.sqrt(days);
}

/** Classify a VaR level as low / medium / high / critical risk */
export function classifyVaRRisk(varPct: number): { level: string; color: string } {
  const abs = Math.abs(varPct);
  if (abs < 0.01) return { level: 'Low', color: '#00d4aa' };
  if (abs < 0.02) return { level: 'Moderate', color: '#ffcc00' };
  if (abs < 0.04) return { level: 'High', color: '#ff9900' };
  return { level: 'Critical', color: '#ff4444' };
}

/** Classify drawdown severity */
export function classifyDrawdown(drawdownPct: number): { level: string; color: string } {
  const abs = Math.abs(drawdownPct);
  if (abs < 0.05) return { level: 'Minor', color: '#00d4aa' };
  if (abs < 0.15) return { level: 'Moderate', color: '#ffcc00' };
  if (abs < 0.30) return { level: 'Severe', color: '#ff9900' };
  return { level: 'Extreme', color: '#ff4444' };
}

/** Build a minimal ReturnSeries from raw return array */
export function buildReturnSeries(returns: number[], symbol = 'PORTFOLIO'): ReturnSeries {
  const today = new Date();
  const dates = returns.map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (returns.length - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  return { dates, returns, symbol };
}

// ─── React Hooks ──────────────────────────────────────────────────────────────

interface UseVaROptions {
  autoRefresh?: boolean;
  refreshMs?: number;
}

export function useVaRAnalysis(
  request: MultiMethodVaRRequest | null,
  options: UseVaROptions = {},
) {
  const { autoRefresh = false, refreshMs = 30000 } = options;
  const [data, setData] = useState<MultiMethodVaRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      setData(await calculateMultiMethodVaR(request));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(request)]); // eslint-disable-line

  useEffect(() => {
    run();
    if (!autoRefresh) return;
    const t = setInterval(run, refreshMs);
    return () => clearInterval(t);
  }, [run, autoRefresh, refreshMs]);

  return { data, loading, error, refresh: run };
}

export function useFullRiskReport(
  portfolioWeights: Record<string, number> | null,
  returnSeries: ReturnSeries | null,
  portfolioValue?: number,
) {
  const [data, setData] = useState<FullStressTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!portfolioWeights || !returnSeries) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getFullRiskReport({
        portfolio_weights: portfolioWeights,
        returns: returnSeries,
        portfolio_value: portfolioValue,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(portfolioWeights), JSON.stringify(returnSeries), portfolioValue]); // eslint-disable-line

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refresh: run };
}

export function useRiskMetrics(request: RiskMetricsRequest | null) {
  const [data, setData] = useState<RiskMetricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    try {
      setData(await calculateRiskMetrics(request));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(request)]); // eslint-disable-line

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refresh: run };
}
