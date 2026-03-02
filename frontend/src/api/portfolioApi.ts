/**
 * portfolioApi.ts
 * Portfolio management API client.
 * Covers portfolio state, historical performance, risk metrics, attribution,
 * optimization, rebalancing, tax-loss harvesting, exposures, and benchmarks.
 */

import { apiClient, cachedApiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PerformancePeriod =
  | '1D' | '1W' | '1M' | '3M' | '6M'
  | 'YTD' | '1Y' | '3Y' | '5Y' | 'ALL';

export type AttributionModel = 'brinson' | 'factor' | 'sector' | 'country';

export type OptimizationObjective =
  | 'max_sharpe'
  | 'min_variance'
  | 'max_return'
  | 'risk_parity'
  | 'max_diversification';

export interface PortfolioHolding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  weight: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  todayChange: number;
  todayChangePct: number;
  sector: string;
  assetClass: string;
  currency: string;
}

export interface Portfolio {
  accountId: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  todayChange: number;
  todayChangePct: number;
  holdings: PortfolioHolding[];
  lastUpdated: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

export interface PortfolioHistoryResponse {
  snapshots: PortfolioSnapshot[];
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  totalReturn: number;
  totalReturnPct: number;
}

export interface PerformanceMetrics {
  period: PerformancePeriod;
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDate: string;
  recoveryDays: number | null;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  bestDay: number;
  bestDayDate: string;
  worstDay: number;
  worstDayDate: string;
  beta: number | null;
  alpha: number | null;
  rSquared: number | null;
  treynorRatio: number | null;
  informationRatio: number | null;
  trackingError: number | null;
}

export interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  maxDrawdown: number;
  currentDrawdown: number;
  annualizedVol: number;
  downsideDeviation: number;
  ulcerIndex: number;
  betaToMarket: number;
  correlationToMarket: number;
  tailRatio: number;
  skewness: number;
  kurtosis: number;
  concentrationHHI: number;
  stressTestResults: StressResult[];
}

export interface StressResult {
  scenario: string;
  estimatedLoss: number;
  estimatedLossPct: number;
}

export interface AttributionEntry {
  name: string;
  weight: number;
  contribution: number;
  contributionPct: number;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
}

export interface AttributionResult {
  model: AttributionModel;
  period: PerformancePeriod;
  totalReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  entries: AttributionEntry[];
  timestamp: string;
}

export interface OptimizationConstraints {
  objective: OptimizationObjective;
  minWeight?: number;
  maxWeight?: number;
  sectorLimits?: Record<string, number>;
  excludeSymbols?: string[];
  includeSymbols?: string[];
  targetReturn?: number;
  targetVolatility?: number;
  maxTurnover?: number;
  riskFreeRate?: number;
}

export interface OptimizationResult {
  objective: OptimizationObjective;
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  expectedSharpe: number;
  turnoverFromCurrent: number;
  efficientFrontier: Array<{
    volatility: number;
    returnPct: number;
  }>;
  status: 'optimal' | 'suboptimal' | 'infeasible';
  message?: string;
}

export interface RebalanceSuggestion {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  deltaWeight: number;
  deltaShares: number;
  deltaValue: number;
  action: 'buy' | 'sell' | 'hold';
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface RebalanceResponse {
  suggestions: RebalanceSuggestion[];
  estimatedTurnover: number;
  estimatedCost: number;
  taxImplication: number;
  driftScore: number;
}

export interface TLHOpportunity {
  symbol: string;
  unrealizedLoss: number;
  costBasis: number;
  currentValue: number;
  holdingPeriod: number;
  taxSavingsEstimate: number;
  washSaleRisk: boolean;
  substituteSymbol: string | null;
  substituteCorrelation: number | null;
  priority: 'high' | 'medium' | 'low';
}

export interface TLHResponse {
  opportunities: TLHOpportunity[];
  totalTaxSavings: number;
  longTermLosses: number;
  shortTermLosses: number;
  washSaleWarnings: string[];
}

export interface ExposureBreakdown {
  name: string;
  weight: number;
  value: number;
}

export interface Exposures {
  bySector: ExposureBreakdown[];
  byCountry: ExposureBreakdown[];
  byAssetClass: ExposureBreakdown[];
  byCurrency: ExposureBreakdown[];
  byFactor: ExposureBreakdown[];
  byMarketCap: ExposureBreakdown[];
}

export interface BenchmarkComparison {
  benchmark: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number;
  downCapture: number;
  beta: number;
  alpha: number;
  correlation: number;
  cumulativeSeries: Array<{
    date: string;
    portfolio: number;
    benchmark: number;
  }>;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/portfolio';

export async function getPortfolio(): Promise<Portfolio> {
  return apiClient.get<Portfolio>(`${BASE}`);
}

export async function getPortfolioHistory(
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily',
): Promise<PortfolioHistoryResponse> {
  return apiClient.get<PortfolioHistoryResponse>(
    `${BASE}/history${qs({
      start_date: startDate,
      end_date: endDate,
      interval,
    })}`,
    { useCache: true, cacheTtlMs: 60_000 },
  );
}

export async function getPerformance(
  period: PerformancePeriod,
): Promise<PerformanceMetrics> {
  return apiClient.get<PerformanceMetrics>(
    `${BASE}/performance${qs({ period })}`,
    { useCache: true, cacheTtlMs: 30_000 },
  );
}

export async function getRiskMetrics(): Promise<RiskMetrics> {
  return apiClient.get<RiskMetrics>(`${BASE}/risk`);
}

export async function getAttribution(
  period: PerformancePeriod,
  model: AttributionModel = 'brinson',
  benchmarkSymbol?: string,
): Promise<AttributionResult> {
  return apiClient.get<AttributionResult>(
    `${BASE}/attribution${qs({ period, model, benchmark: benchmarkSymbol })}`,
    { useCache: true, cacheTtlMs: 120_000 },
  );
}

export async function getOptimization(
  constraints: OptimizationConstraints,
): Promise<OptimizationResult> {
  return apiClient.post<OptimizationResult>(
    `${BASE}/optimize`,
    constraints,
    { timeoutMs: 30000 },
  );
}

export async function getRebalanceSuggestions(
  strategy?: OptimizationObjective,
  threshold?: number,
): Promise<RebalanceResponse> {
  return apiClient.get<RebalanceResponse>(
    `${BASE}/rebalance${qs({ strategy, threshold })}`,
  );
}

export async function getTaxLossHarvesting(
  taxRate?: number,
): Promise<TLHResponse> {
  return apiClient.get<TLHResponse>(
    `${BASE}/tax-loss-harvesting${qs({ tax_rate: taxRate })}`,
  );
}

export async function getExposures(): Promise<Exposures> {
  return apiClient.get<Exposures>(
    `${BASE}/exposures`,
    { useCache: true, cacheTtlMs: 60_000 },
  );
}

export async function getBenchmarkComparison(
  benchmark: string,
  period: PerformancePeriod = '1Y',
): Promise<BenchmarkComparison> {
  return apiClient.get<BenchmarkComparison>(
    `${BASE}/benchmark${qs({ benchmark, period })}`,
    { useCache: true, cacheTtlMs: 120_000 },
  );
}

// ─── Aggregate helpers ────────────────────────────────────────────────────────

export async function getPortfolioDashboard(): Promise<{
  portfolio: Portfolio;
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  exposures: Exposures;
}> {
  const [portfolio, performance, risk, exposures] = await Promise.all([
    getPortfolio(),
    getPerformance('1D'),
    getRiskMetrics(),
    getExposures(),
  ]);
  return { portfolio, performance, risk, exposures };
}

export async function getAvailableBenchmarks(): Promise<
  Array<{ symbol: string; name: string; description: string }>
> {
  return cachedApiClient.get(`${BASE}/benchmarks`, {
    useCache: true,
    cacheTtlMs: 3_600_000,
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function holdingWeight(holding: PortfolioHolding, totalValue: number): number {
  return totalValue > 0 ? holding.marketValue / totalValue : 0;
}

export function portfolioConcentration(holdings: PortfolioHolding[]): number {
  return holdings.reduce((sum, h) => sum + h.weight * h.weight, 0);
}

export function riskLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'low':      return '#00d4aa';
    case 'moderate': return '#ffcc00';
    case 'high':     return '#ff9900';
    case 'critical': return '#ff4444';
    default:         return '#888888';
  }
}

export function formatWeight(weight: number): string {
  return `${(weight * 100).toFixed(2)}%`;
}
