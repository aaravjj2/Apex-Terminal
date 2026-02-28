/**
 * crossAssetApi.ts
 * API client for Cross-Asset Analysis endpoints.
 * Returns, correlations, risk regime, carry trades, Fed model, and flight-to-safety.
 */

import { useState, useCallback, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const XA_BASE = `${BASE_URL}/api/cross-asset`;

export class CrossAssetApiError extends Error {
  constructor(public statusCode: number, public detail: string, public endpoint: string) {
    super(`CrossAssetAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'CrossAssetApiError';
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...init.headers }, ...init });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new CrossAssetApiError(r.status, e.detail ?? r.statusText, url);
  }
  return r.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${XA_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

const get = <T>(path: string) => apiFetch<T>(`${XA_BASE}${path}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetClass =
  | 'equities' | 'fixed_income' | 'commodities' | 'currencies'
  | 'real_estate' | 'crypto' | 'alternatives';

export type RiskRegime = 'risk_on' | 'risk_off' | 'transition' | 'crisis';
export type CarryDirection = 'long' | 'short';

export interface AssetReturnData {
  symbol: string;
  asset_class: AssetClass;
  return_1d?: number;
  return_1w?: number;
  return_1m?: number;
  return_3m?: number;
  return_ytd?: number;
  return_1y?: number;
  volatility_30d?: number;
  sharpe_ratio?: number;
  country?: string;
  currency?: string;
}

export interface CrossAssetReturnRequest {
  assets: AssetReturnData[];
  benchmark?: string;
  period?: '1d' | '1w' | '1m' | '3m' | 'ytd' | '1y';
}

export interface ReturnRankingResult {
  symbol: string;
  asset_class: AssetClass;
  absolute_return: number;
  rank: number;
  excess_return?: number;
  risk_adjusted_return?: number;
}

export interface CrossAssetReturnResult {
  rankings: ReturnRankingResult[];
  best_asset_class: AssetClass;
  worst_asset_class: AssetClass;
  dispersion_pct: number;           // max - min return
  correlation_with_benchmark?: number;
  timestamp: string;
}

export interface CorrelationRequest {
  assets: Array<{
    symbol: string;
    returns: number[];     // daily return series
  }>;
  lookback_days?: number;
  method?: 'pearson' | 'spearman' | 'kendall';
}

export interface CorrelationResult {
  matrix: Record<string, Record<string, number>>;
  symbols: string[];
  average_correlation: number;
  highest_pair: { pair: [string, string]; correlation: number };
  lowest_pair: { pair: [string, string]; correlation: number };
  diversification_ratio: number;
}

export interface RiskRegimeRequest {
  vix_level?: number;
  vix_change_pct?: number;
  credit_spread_bps?: number;
  hy_spread_change?: number;
  em_spread_bps?: number;
  gold_return_1m?: number;
  yen_return_1m?: number;
  equity_vol_realized?: number;
  commodities_return?: number;
}

export interface RiskRegimeResult {
  regime: RiskRegime;
  regime_confidence: number;
  risk_score: number;         // 0=no risk, 100=full crisis
  vix_signal: string;
  credit_signal: string;
  safe_haven_signal: string;
  preferred_assets: string[];
  avoid_assets: string[];
  historical_analogue?: string;
}

export interface CarryTradeRequest {
  asset_pairs: Array<{
    long_asset: string;
    short_asset: string;
    long_yield_pct: number;
    short_yield_pct: number;
    long_volatility?: number;
    long_currency?: string;
    short_currency?: string;
  }>;
  funding_rate?: number;
}

export interface CarryResult {
  asset_pair: string;
  gross_carry_pct: number;      // annualized
  net_carry_pct: number;        // after funding
  carry_to_vol_ratio?: number;  // Sharpe-like
  direction: CarryDirection;
  is_attractive: boolean;
  fx_risk?: number;
  rank: number;
}

export interface CarryTradeResult {
  carries: CarryResult[];
  best_carry_pair: string;
  aggregate_carry_pct: number;
  carry_regime: 'high_carry' | 'compressed' | 'inverted';
}

export interface FedModelRequest {
  sp500_earnings_yield_pct: number;    // E/P ratio * 100
  ten_year_treasury_yield_pct: number;
  risk_premium_avg_pct?: number;       // historical avg ERP
  earnings_growth_forecast_pct?: number;
}

export interface FedModelResult {
  equity_risk_premium: number;
  fair_value_spread: number;
  signal: 'undervalued' | 'fairly_valued' | 'overvalued' | 'severely_overvalued';
  signal_strength: number;             // 0 to 1
  implied_sp500_return?: number;
  historical_percentile?: number;
  commentary: string;
}

export interface FlightToSafetyRequest {
  equity_return_1w?: number;
  gold_return_1w?: number;
  ten_yr_yield_change_bps?: number;
  yen_return_1w?: number;
  vix_level?: number;
  em_return_1w?: number;
}

export interface FlightToSafetyResult {
  is_flight_to_safety: boolean;
  intensity: 'mild' | 'moderate' | 'severe' | 'extreme';
  flow_score: number;           // -1 (risk-on) to +1 (full flight)
  safe_haven_inflows: string[];
  risk_asset_outflows: string[];
  duration_days_expected?: number;
  historical_context?: string;
}

export interface FullCrossAssetDashboard {
  returns: CrossAssetReturnResult;
  correlation: CorrelationResult;
  risk_regime: RiskRegimeResult;
  carry: CarryTradeResult;
  fed_model: FedModelResult;
  flight_to_safety: FlightToSafetyResult;
  timestamp: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const getCrossAssetCapabilities = () =>
  get<{ endpoints: string[]; asset_classes: string[] }>('/capabilities');

export const getCrossAssetReturns = (req: CrossAssetReturnRequest) =>
  post<CrossAssetReturnResult>('/returns', req);

export const getCrossAssetCorrelation = (req: CorrelationRequest) =>
  post<CorrelationResult>('/correlation', req);

export const detectRiskRegime = (req: RiskRegimeRequest) =>
  post<RiskRegimeResult>('/risk-regime', req);

export const analyzeCarryTrades = (req: CarryTradeRequest) =>
  post<CarryTradeResult>('/carry', req);

export const getFedModel = (req: FedModelRequest) =>
  post<FedModelResult>('/fed-model', req);

export const detectFlightToSafety = (req: FlightToSafetyRequest) =>
  post<FlightToSafetyResult>('/flight-to-safety', req);

export const getFullCrossAssetDashboard = (req: {
  assets?: AssetReturnData[];
  vix_level?: number;
  credit_spread_bps?: number;
  sp500_earnings_yield_pct?: number;
  ten_year_yield_pct?: number;
}) => post<FullCrossAssetDashboard>('/dashboard', req);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equities: '#4a9eff',
  fixed_income: '#00d4aa',
  commodities: '#ffcc00',
  currencies: '#ff9900',
  real_estate: '#a855f7',
  crypto: '#f97316',
  alternatives: '#888',
};

export const RISK_REGIME_COLORS: Record<RiskRegime, string> = {
  risk_on: '#00d4aa',
  risk_off: '#ff9900',
  transition: '#ffcc00',
  crisis: '#ff4444',
};

export function assetClassLabel(cls: AssetClass): string {
  const labels: Record<AssetClass, string> = {
    equities: 'Equities',
    fixed_income: 'Fixed Income',
    commodities: 'Commodities',
    currencies: 'FX',
    real_estate: 'Real Estate',
    crypto: 'Crypto',
    alternatives: 'Alternatives',
  };
  return labels[cls];
}

export function riskRegimeLabel(regime: RiskRegime): string {
  const labels: Record<RiskRegime, string> = {
    risk_on: 'Risk On',
    risk_off: 'Risk Off',
    transition: 'Transitioning',
    crisis: 'Crisis Mode',
  };
  return labels[regime];
}

export function corrToColor(corr: number): string {
  // red = -1, white = 0, blue = +1
  if (corr > 0) {
    const v = Math.round(corr * 180);
    return `rgb(0,${(v * 0.6) | 0},${200 + ((v * 0.2) | 0)})`;
  }
  const v = Math.abs(corr);
  const r = Math.round(180 + v * 75);
  const g = Math.round(60 - v * 60);
  return `rgb(${r},${g},60)`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCrossAssetDashboard(
  req: Parameters<typeof getFullCrossAssetDashboard>[0] | null,
  refreshMs = 30000,
) {
  const [data, setData] = useState<FullCrossAssetDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await getFullCrossAssetDashboard(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useRiskRegime(req: RiskRegimeRequest | null, refreshMs = 15000) {
  const [data, setData] = useState<RiskRegimeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await detectRiskRegime(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useFedModel(req: FedModelRequest | null) {
  const [data, setData] = useState<FedModelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await getFedModel(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
