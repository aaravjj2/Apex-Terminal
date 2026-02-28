/**
 * factorModelApi.ts
 * API client for the Factor Model endpoints — Fama-French 3F/5F, smart beta,
 * multi-factor portfolio construction, factor attribution, and cycle tilts.
 */

import { useState, useCallback, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const FACTOR_BASE = `${BASE_URL}/api/factor-model`;

export class FactorApiError extends Error {
  constructor(public statusCode: number, public detail: string, public endpoint: string) {
    super(`FactorAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'FactorApiError';
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...init.headers }, ...init });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new FactorApiError(r.status, e.detail ?? r.statusText, url);
  }
  return r.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${FACTOR_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

const get = <T>(path: string) => apiFetch<T>(`${FACTOR_BASE}${path}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export type FactorModel = 'ff3' | 'ff5' | 'carhart4' | 'barra' | 'custom';
export type SmartBetaFactor = 'value' | 'momentum' | 'quality' | 'low_vol' | 'size' | 'profitability' | 'investment';
export type SignalStrength = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
export type CyclePhase = 'early' | 'mid' | 'late' | 'recession';

export interface StockFundamentals {
  symbol: string;
  name?: string;
  market_cap_bn?: number;
  book_value_per_share?: number;
  price?: number;
  earnings_yield?: number;     // EP ratio
  return_on_equity?: number;
  gross_profitability?: number;
  investment_growth?: number;  // asset growth proxy
  momentum_12m1m?: number;     // 12-1 month return
  volatility_1y?: number;
  dividend_yield?: number;
  sector?: string;
}

export interface FactorScoreRequest {
  stocks: StockFundamentals[];
  normalize?: boolean;     // z-score normalisation
  winsorize_pct?: number;  // e.g. 0.05 = trim top/bottom 5%
}

export interface FactorScore {
  symbol: string;
  value_score: number;
  momentum_score: number;
  quality_score: number;
  low_vol_score: number;
  size_score: number;
  profitability_score: number;
  investment_score: number;
  composite_score: number;    // weighted average
  signal: SignalStrength;
  rank: number;
}

export interface FactorScoreResult {
  scores: FactorScore[];
  factor_means: Record<SmartBetaFactor, number>;
  factor_stds: Record<SmartBetaFactor, number>;
  top_stocks: string[];
  bottom_stocks: string[];
}

export interface FamaFrenchRequest {
  stock_returns: Array<{
    symbol: string;
    returns: number[];     // daily return series
  }>;
  market_returns: number[];    // daily
  smb_factor?: number[];       // small minus big
  hml_factor?: number[];       // high minus low
  rmw_factor?: number[];       // robust minus weak (FF5)
  cma_factor?: number[];       // conservative minus aggressive (FF5)
  mom_factor?: number[];       // Carhart momentum
  risk_free_rate?: number;     // annual decimal
  model?: FactorModel;
}

export interface FamaFrenchAlpha {
  symbol: string;
  model: FactorModel;
  alpha_pct: number;           // annualized
  alpha_t_stat: number;
  alpha_significant: boolean;
  beta_market: number;
  beta_smb?: number;
  beta_hml?: number;
  beta_rmw?: number;
  beta_cma?: number;
  beta_mom?: number;
  r_squared: number;
  information_ratio?: number;
}

export interface FamaFrenchResult {
  alphas: FamaFrenchAlpha[];
  model: FactorModel;
  factor_returns: {
    market?: number;
    smb?: number;
    hml?: number;
    rmw?: number;
    cma?: number;
    mom?: number;
  };
}

export interface FactorAttributionRequest {
  portfolio_weights: Record<string, number>;
  factor_exposures: Record<string, Record<SmartBetaFactor, number>>;
  factor_returns_pct: Record<SmartBetaFactor, number>;
  total_portfolio_return_pct?: number;
}

export interface FactorAttributionResult {
  total_return_pct: number;
  factor_contributions: Record<SmartBetaFactor, number>;
  specific_return_pct: number;    // stock-specific = total - factor-explained
  explained_pct: number;          // % of return explained by factors
  largest_contributor: SmartBetaFactor;
  largest_detractor: SmartBetaFactor;
  factor_attribution_breakdown: Array<{
    factor: SmartBetaFactor;
    exposure: number;
    factor_return_pct: number;
    contribution_pct: number;
    pct_of_total: number;
  }>;
}

export interface SmartBetaRequest {
  stocks: StockFundamentals[];
  factors: SmartBetaFactor[];
  factor_weights?: Record<SmartBetaFactor, number>;
  universe_size?: number;           // top N stocks to consider
  max_weight_pct?: number;          // position size constraint
  min_weight_pct?: number;
}

export interface SmartBetaSignal {
  symbol: string;
  composite_score: number;
  factor_scores: Record<SmartBetaFactor, number>;
  suggested_weight_pct: number;
  signal: SignalStrength;
  rationale: string;
}

export interface SmartBetaPortfolio {
  signals: SmartBetaSignal[];
  portfolio_weights: Record<string, number>;
  expected_factor_exposures: Record<SmartBetaFactor, number>;
  diversification_ratio: number;
  effective_n: number;         // Herfindahl-equivalent
}

export interface CycleTiltRequest {
  factor_scores: FactorScore[];
  cycle_phase: CyclePhase;
  macro_inputs?: {
    ism?: number;
    yield_spread?: number;
    inflation?: number;
  };
}

export interface CycleTilt {
  factor: SmartBetaFactor;
  cycle_weight: number;        // the weight to give this factor in this phase
  direction: 'overweight' | 'neutral' | 'underweight';
  rationale: string;
  historical_return_this_phase?: number;
}

export interface CycleTiltResult {
  phase: CyclePhase;
  tilts: CycleTilt[];
  recommended_portfolio_tilt: Record<SmartBetaFactor, number>;  // normalized weights
  tilt_confidence: number;
}

export interface FullFactorDashboard {
  factor_scores: FactorScoreResult;
  ff5_alphas: FamaFrenchResult;
  attribution: FactorAttributionResult;
  smart_beta: SmartBetaPortfolio;
  cycle_tilts: CycleTiltResult;
  timestamp: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const getFactorCapabilities = () =>
  get<{ endpoints: string[]; models: string[]; factors: string[] }>('/capabilities');

export const calculateFactorScores = (req: FactorScoreRequest) =>
  post<FactorScoreResult>('/scores', req);

export const runFamaFrench = (req: FamaFrenchRequest) =>
  post<FamaFrenchResult>('/fama-french', req);

export const getFactorAttribution = (req: FactorAttributionRequest) =>
  post<FactorAttributionResult>('/attribution', req);

export const getSmartBetaPortfolio = (req: SmartBetaRequest) =>
  post<SmartBetaPortfolio>('/smart-beta', req);

export const getCycleTilts = (req: CycleTiltRequest) =>
  post<CycleTiltResult>('/cycle-tilts', req);

export const getTopFactorStocks = (factor: SmartBetaFactor, n = 20) =>
  get<{ top: FactorScore[]; factor: SmartBetaFactor }>(`/top-stocks?factor=${factor}&n=${n}`);

export const getFullFactorDashboard = (req: {
  stocks: StockFundamentals[];
  portfolio_weights?: Record<string, number>;
  cycle_phase?: CyclePhase;
  model?: FactorModel;
}) => post<FullFactorDashboard>('/dashboard', req);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const FACTOR_LABELS: Record<SmartBetaFactor, string> = {
  value: 'Value',
  momentum: 'Momentum',
  quality: 'Quality',
  low_vol: 'Low Vol',
  size: 'Size',
  profitability: 'Profitability',
  investment: 'Investment',
};

export const FACTOR_COLORS: Record<SmartBetaFactor, string> = {
  value: '#4a9eff',
  momentum: '#00d4aa',
  quality: '#ffcc00',
  low_vol: '#a855f7',
  size: '#f97316',
  profitability: '#00ff9d',
  investment: '#ff9900',
};

export function signalColor(signal: SignalStrength): string {
  switch (signal) {
    case 'strong_buy': return '#00ff9d';
    case 'buy': return '#00d4aa';
    case 'neutral': return '#888';
    case 'sell': return '#ff9900';
    case 'strong_sell': return '#ff4444';
  }
}

export function factorScoreColor(score: number): string {
  // -3 to +3 z-scores
  if (score > 2) return '#00ff9d';
  if (score > 1) return '#00d4aa';
  if (score > 0.5) return '#66cc99';
  if (score > -0.5) return '#555';
  if (score > -1) return '#ff9933';
  if (score > -2) return '#ff6666';
  return '#ff2244';
}

export function formatAlphaPct(alpha: number): string {
  return `${alpha >= 0 ? '+' : ''}${(alpha * 100).toFixed(2)}%`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useFactorScores(stocks: StockFundamentals[], refreshMs = 60000) {
  const [data, setData] = useState<FactorScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!stocks.length) return;
    setLoading(true);
    setError(null);
    try { setData(await calculateFactorScores({ stocks, normalize: true })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(stocks)]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useSmartBetaPortfolio(req: SmartBetaRequest | null) {
  const [data, setData] = useState<SmartBetaPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try { setData(await getSmartBetaPortfolio(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

export function useFullFactorDashboard(
  stocks: StockFundamentals[],
  portfolioWeights?: Record<string, number>,
  cyclePhase?: CyclePhase,
  refreshMs = 60000,
) {
  const [data, setData] = useState<FullFactorDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!stocks.length) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getFullFactorDashboard({
        stocks,
        portfolio_weights: portfolioWeights,
        cycle_phase: cyclePhase,
        model: 'ff5',
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(stocks), JSON.stringify(portfolioWeights), cyclePhase]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}
