/**
 * analyticsApi.ts
 * Analytics API client for correlation matrices, volatility analysis,
 * seasonality, risk analysis, factor exposures, macro indicators,
 * central bank data, yield curves, and credit spreads.
 */

import { apiClient, cachedApiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorrelationMethod = 'pearson' | 'spearman' | 'kendall';
export type VolatilityModel = 'realized' | 'ewma' | 'garch' | 'parkinson' | 'yang_zhang';
export type AnalysisPeriod = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '10Y';

export interface CorrelationMatrixRequest {
  symbols: string[];
  period: AnalysisPeriod;
  method?: CorrelationMethod;
  rollingWindow?: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  method: CorrelationMethod;
  period: AnalysisPeriod;
  observations: number;
  eigenvalues: number[];
  principalComponents: number;
  highCorrelationPairs: Array<{
    symbolA: string;
    symbolB: string;
    correlation: number;
  }>;
  lowCorrelationPairs: Array<{
    symbolA: string;
    symbolB: string;
    correlation: number;
  }>;
  rollingCorrelation?: Array<{
    date: string;
    correlations: Record<string, number>;
  }>;
  timestamp: string;
}

export interface VolatilityAnalysisRequest {
  symbol: string;
  period: AnalysisPeriod;
  model?: VolatilityModel;
  annualize?: boolean;
}

export interface VolatilityAnalysis {
  symbol: string;
  period: AnalysisPeriod;
  model: VolatilityModel;
  currentVol: number;
  annualizedVol: number;
  avgVol: number;
  minVol: number;
  maxVol: number;
  volPercentile: number;
  volRank: number;
  volOfVol: number;
  volTrend: 'rising' | 'falling' | 'stable';
  volRegime: 'low' | 'normal' | 'high' | 'extreme';
  volCone: Array<{
    period: string;
    current: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    min: number;
    max: number;
  }>;
  historicalVol: Array<{
    date: string;
    vol: number;
  }>;
  garchForecast?: Array<{
    date: string;
    forecastVol: number;
    upperBound: number;
    lowerBound: number;
  }>;
  timestamp: string;
}

export interface SeasonalityResult {
  symbol: string;
  monthlyReturns: Record<string, {
    avgReturn: number;
    medianReturn: number;
    winRate: number;
    stdDev: number;
    best: number;
    worst: number;
    observations: number;
  }>;
  dayOfWeekReturns: Record<string, {
    avgReturn: number;
    winRate: number;
    observations: number;
  }>;
  holidayEffects: Array<{
    holiday: string;
    avgReturnBefore: number;
    avgReturnAfter: number;
    winRate: number;
  }>;
  turnOfMonthEffect: {
    avgReturn: number;
    winRate: number;
  };
  januaryEffect: {
    avgReturn: number;
    winRate: number;
    significance: number;
  };
  sellInMayEffect: {
    mayOctReturn: number;
    novAprReturn: number;
    significance: number;
  };
  yearsAnalyzed: number;
  timestamp: string;
}

export interface RiskAnalysisRequest {
  portfolio: Record<string, number>;
  benchmarkSymbol?: string;
  period?: AnalysisPeriod;
  confidenceLevel?: number;
}

export interface RiskAnalysisResult {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  beta: number;
  alpha: number;
  treynorRatio: number;
  informationRatio: number;
  trackingError: number;
  annualizedVol: number;
  downsideDeviation: number;
  tailRatio: number;
  skewness: number;
  kurtosis: number;
  concentrationHHI: number;
  diversificationRatio: number;
  marginalRiskContribution: Record<string, number>;
  componentRiskContribution: Record<string, number>;
  stressTests: Array<{
    scenario: string;
    portfolioReturn: number;
    benchmarkReturn: number;
  }>;
  timestamp: string;
}

export interface FactorExposureRequest {
  portfolio: Record<string, number>;
  model?: 'fama_french_3' | 'fama_french_5' | 'carhart' | 'barra' | 'custom';
  period?: AnalysisPeriod;
}

export interface FactorExposure {
  name: string;
  exposure: number;
  tStat: number;
  pValue: number;
  contribution: number;
  contributionPct: number;
}

export interface FactorExposureResult {
  model: string;
  factors: FactorExposure[];
  rSquared: number;
  adjustedRSquared: number;
  residualReturn: number;
  residualRisk: number;
  factorReturn: number;
  specificReturn: number;
  timestamp: string;
}

export type MacroIndicator =
  | 'gdp'
  | 'cpi'
  | 'ppi'
  | 'unemployment'
  | 'nonfarm_payrolls'
  | 'retail_sales'
  | 'industrial_production'
  | 'housing_starts'
  | 'consumer_confidence'
  | 'pmi_manufacturing'
  | 'pmi_services'
  | 'trade_balance'
  | 'fed_funds_rate'
  | 'm2_money_supply';

export interface MacroDataPoint {
  date: string;
  value: number;
  previousValue: number | null;
  change: number | null;
  changePct: number | null;
  forecast: number | null;
  surprise: number | null;
}

export interface MacroIndicatorResponse {
  indicator: MacroIndicator;
  name: string;
  country: string;
  unit: string;
  frequency: string;
  history: MacroDataPoint[];
  latestValue: number;
  trend: 'rising' | 'falling' | 'stable';
  lastUpdated: string;
}

export interface CentralBankDecision {
  bank: string;
  country: string;
  date: string;
  rate: number;
  previousRate: number;
  change: number;
  decision: 'hike' | 'cut' | 'hold';
  votingSplit: string | null;
  statement: string;
  nextMeeting: string;
  marketExpectation: number;
}

export interface CentralBankResponse {
  banks: CentralBankDecision[];
  globalAvgRate: number;
  hikingBanks: number;
  cuttingBanks: number;
  holdingBanks: number;
  timestamp: string;
}

export interface YieldCurvePoint {
  maturity: string;
  yield: number;
  previousYield: number;
  change: number;
}

export interface YieldCurveResponse {
  country: string;
  currency: string;
  date: string;
  points: YieldCurvePoint[];
  spread2s10s: number;
  spread3m10y: number;
  isInverted: boolean;
  historicalCurves?: Array<{
    date: string;
    points: YieldCurvePoint[];
  }>;
}

export interface CreditSpreadData {
  sector: string;
  rating: string;
  spread: number;
  previousSpread: number;
  change: number;
  changePct: number;
  percentile: number;
  zScore: number;
}

export interface CreditSpreadResponse {
  sector: string;
  date: string;
  spreads: CreditSpreadData[];
  avgSpread: number;
  avgSpreadChange: number;
  historicalSpreads?: Array<{
    date: string;
    avgSpread: number;
    investment_grade: number;
    high_yield: number;
  }>;
  timestamp: string;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── API Functions ────────────────────────────────────────────────────────────

const BASE = '/api/analytics';

export async function getCorrelationMatrix(
  params: CorrelationMatrixRequest,
): Promise<CorrelationMatrix> {
  return apiClient.post<CorrelationMatrix>(
    `${BASE}/correlation`,
    params,
    { useCache: true, cacheTtlMs: 300_000 } as never,
  );
}

export async function getVolatilityAnalysis(
  params: VolatilityAnalysisRequest,
): Promise<VolatilityAnalysis> {
  return apiClient.get<VolatilityAnalysis>(
    `${BASE}/volatility/${encodeURIComponent(params.symbol)}${qs({
      period: params.period,
      model: params.model,
      annualize: params.annualize,
    })}`,
    { useCache: true, cacheTtlMs: 120_000 },
  );
}

export async function getSeasonality(
  symbol: string,
  yearsBack = 10,
): Promise<SeasonalityResult> {
  return cachedApiClient.get<SeasonalityResult>(
    `${BASE}/seasonality/${encodeURIComponent(symbol)}${qs({ years_back: yearsBack })}`,
    { useCache: true, cacheTtlMs: 3_600_000 },
  );
}

export async function getRiskAnalysis(
  params: RiskAnalysisRequest,
): Promise<RiskAnalysisResult> {
  return apiClient.post<RiskAnalysisResult>(
    `${BASE}/risk`,
    params,
    { timeoutMs: 20000 },
  );
}

export async function getFactorExposures(
  params: FactorExposureRequest,
): Promise<FactorExposureResult> {
  return apiClient.post<FactorExposureResult>(
    `${BASE}/factors`,
    params,
    { useCache: true, cacheTtlMs: 300_000 } as never,
  );
}

export async function getMacroIndicators(
  indicators: MacroIndicator[],
  country = 'US',
  period: AnalysisPeriod = '5Y',
): Promise<MacroIndicatorResponse[]> {
  return cachedApiClient.get<MacroIndicatorResponse[]>(
    `${BASE}/macro${qs({
      indicators: indicators.join(','),
      country,
      period,
    })}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function getCentralBankData(): Promise<CentralBankResponse> {
  return cachedApiClient.get<CentralBankResponse>(
    `${BASE}/central-banks`,
    { useCache: true, cacheTtlMs: 3_600_000 },
  );
}

export async function getYieldCurve(
  country = 'US',
  includeHistory = false,
  historyDates?: string[],
): Promise<YieldCurveResponse> {
  return cachedApiClient.get<YieldCurveResponse>(
    `${BASE}/yield-curve${qs({
      country,
      include_history: includeHistory,
      history_dates: historyDates?.join(','),
    })}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function getCreditSpreads(
  sector?: string,
  includeHistory = false,
): Promise<CreditSpreadResponse> {
  return cachedApiClient.get<CreditSpreadResponse>(
    `${BASE}/credit-spreads${qs({
      sector,
      include_history: includeHistory,
    })}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

// ─── Composite helpers ────────────────────────────────────────────────────────

export async function getMarketOverview(): Promise<{
  yieldCurve: YieldCurveResponse;
  centralBanks: CentralBankResponse;
  creditSpreads: CreditSpreadResponse;
}> {
  const [yieldCurve, centralBanks, creditSpreads] = await Promise.all([
    getYieldCurve(),
    getCentralBankData(),
    getCreditSpreads(),
  ]);
  return { yieldCurve, centralBanks, creditSpreads };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function correlationColor(value: number): string {
  if (value >= 0.7) return '#00d4aa';
  if (value >= 0.3) return '#00d4aa88';
  if (value >= -0.3) return '#888888';
  if (value >= -0.7) return '#ff444488';
  return '#ff4444';
}

export function volRegimeColor(regime: VolatilityAnalysis['volRegime']): string {
  const map: Record<VolatilityAnalysis['volRegime'], string> = {
    low: '#00d4aa',
    normal: '#3b82f6',
    high: '#f59e0b',
    extreme: '#ef4444',
  };
  return map[regime];
}

export function spreadHealthColor(zScore: number): string {
  const abs = Math.abs(zScore);
  if (abs < 1) return '#00d4aa';
  if (abs < 2) return '#f59e0b';
  return '#ef4444';
}

export function macroIndicatorLabel(indicator: MacroIndicator): string {
  const map: Record<MacroIndicator, string> = {
    gdp: 'GDP',
    cpi: 'CPI',
    ppi: 'PPI',
    unemployment: 'Unemployment Rate',
    nonfarm_payrolls: 'Nonfarm Payrolls',
    retail_sales: 'Retail Sales',
    industrial_production: 'Industrial Production',
    housing_starts: 'Housing Starts',
    consumer_confidence: 'Consumer Confidence',
    pmi_manufacturing: 'PMI Manufacturing',
    pmi_services: 'PMI Services',
    trade_balance: 'Trade Balance',
    fed_funds_rate: 'Fed Funds Rate',
    m2_money_supply: 'M2 Money Supply',
  };
  return map[indicator];
}

export function formatBasisPoints(bps: number): string {
  return `${bps.toFixed(0)} bps`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
