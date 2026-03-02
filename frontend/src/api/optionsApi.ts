/**
 * optionsApi.ts
 * Options API client for chains, Greeks, implied volatility surfaces,
 * unusual activity, open interest, screening, and theoretical pricing.
 */

import { apiClient, cachedApiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptionType = 'call' | 'put';
export type OptionStyle = 'american' | 'european';
export type PricingModel = 'black_scholes' | 'binomial' | 'monte_carlo' | 'baw';

export interface OptionContract {
  symbol: string;
  underlying: string;
  type: OptionType;
  strike: number;
  expiration: string;
  style: OptionStyle;
  bid: number;
  ask: number;
  last: number;
  mark: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  inTheMoney: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
  daysToExpiry: number;
  exchange: string;
  lastUpdated: string;
}

export interface OptionsChain {
  underlying: string;
  underlyingPrice: number;
  expiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
  strikePrices: number[];
  timestamp: string;
}

export interface OptionsChainResponse {
  underlying: string;
  underlyingPrice: number;
  chains: OptionsChain[];
  expirations: string[];
  totalContracts: number;
}

export interface ExpirationInfo {
  date: string;
  daysToExpiry: number;
  type: 'standard' | 'weekly' | 'quarterly' | 'leaps';
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
  putCallRatio: number;
}

export interface StrikeInfo {
  strike: number;
  callBid: number;
  callAsk: number;
  callVolume: number;
  callOI: number;
  callIV: number;
  putBid: number;
  putAsk: number;
  putVolume: number;
  putOI: number;
  putIV: number;
  distance: number;
  distancePct: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  lambda: number;
  vanna: number;
  volga: number;
  charm: number;
  speed: number;
  color: number;
  zomma: number;
}

export interface VolSurfacePoint {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  impliedVol: number;
  moneyness: number;
  delta: number;
}

export interface VolSurface {
  underlying: string;
  underlyingPrice: number;
  points: VolSurfacePoint[];
  strikes: number[];
  expirations: string[];
  atmVol: number;
  skew25Delta: number;
  skew10Delta: number;
  termStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIV: number;
    call25dIV: number;
    put25dIV: number;
    skew: number;
  }>;
  timestamp: string;
}

export interface IVHistoryPoint {
  date: string;
  impliedVol: number;
  historicalVol: number;
  volSpread: number;
  underlyingPrice: number;
}

export interface IVHistoryResponse {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: OptionType;
  history: IVHistoryPoint[];
  avgIV: number;
  ivPercentile: number;
  ivRank: number;
  hvPercentile: number;
}

export type UnusualActivityType = 'large_volume' | 'vol_spike' | 'oi_change' | 'sweep' | 'block';

export interface UnusualActivity {
  id: string;
  symbol: string;
  underlying: string;
  type: UnusualActivityType;
  optionType: OptionType;
  strike: number;
  expiry: string;
  volume: number;
  openInterest: number;
  volumeOIRatio: number;
  impliedVol: number;
  premium: number;
  side: 'bid' | 'ask' | 'mid' | 'unknown';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  description: string;
  timestamp: string;
}

export interface OpenInterestData {
  underlying: string;
  underlyingPrice: number;
  expiry: string;
  strikes: Array<{
    strike: number;
    callOI: number;
    putOI: number;
    callOIChange: number;
    putOIChange: number;
    callVolume: number;
    putVolume: number;
    maxPainContribution: number;
  }>;
  totalCallOI: number;
  totalPutOI: number;
  putCallOIRatio: number;
  maxPainStrike: number;
  timestamp: string;
}

export interface ScreenerCriteria {
  minVolume?: number;
  maxVolume?: number;
  minOI?: number;
  minIV?: number;
  maxIV?: number;
  minDelta?: number;
  maxDelta?: number;
  minDaysToExpiry?: number;
  maxDaysToExpiry?: number;
  optionType?: OptionType;
  moneyness?: 'itm' | 'atm' | 'otm';
  minPremium?: number;
  maxPremium?: number;
  symbols?: string[];
  sector?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface ScreenerResult {
  contracts: OptionContract[];
  total: number;
  appliedFilters: Record<string, unknown>;
}

export interface PricingParams {
  underlying: string;
  underlyingPrice: number;
  strike: number;
  expiry: string;
  optionType: OptionType;
  riskFreeRate?: number;
  dividendYield?: number;
  volatility?: number;
  model?: PricingModel;
  steps?: number;
  simulations?: number;
}

export interface PricingResult {
  theoreticalPrice: number;
  greeks: Greeks;
  model: PricingModel;
  impliedVol: number | null;
  intrinsicValue: number;
  timeValue: number;
  breakeven: number;
  probabilityITM: number;
  probabilityOTM: number;
  maxProfit: number | null;
  maxLoss: number | null;
  inputs: {
    spot: number;
    strike: number;
    daysToExpiry: number;
    riskFreeRate: number;
    volatility: number;
    dividendYield: number;
  };
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

const BASE = '/api/options';

export async function getOptionsChain(
  symbol: string,
  expiry?: string,
  strikeRange?: { min?: number; max?: number },
): Promise<OptionsChainResponse> {
  return apiClient.get<OptionsChainResponse>(
    `${BASE}/chain/${encodeURIComponent(symbol)}${qs({
      expiry,
      min_strike: strikeRange?.min,
      max_strike: strikeRange?.max,
    })}`,
  );
}

export async function getExpirations(
  symbol: string,
): Promise<ExpirationInfo[]> {
  return cachedApiClient.get<ExpirationInfo[]>(
    `${BASE}/expirations/${encodeURIComponent(symbol)}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function getStrikes(
  symbol: string,
  expiry: string,
): Promise<StrikeInfo[]> {
  return apiClient.get<StrikeInfo[]>(
    `${BASE}/strikes/${encodeURIComponent(symbol)}${qs({ expiry })}`,
  );
}

export async function getGreeks(
  symbol: string,
  strike: number,
  expiry: string,
  optionType: OptionType,
): Promise<Greeks> {
  return apiClient.get<Greeks>(
    `${BASE}/greeks/${encodeURIComponent(symbol)}${qs({
      strike,
      expiry,
      type: optionType,
    })}`,
  );
}

export async function getVolSurface(symbol: string): Promise<VolSurface> {
  return apiClient.get<VolSurface>(
    `${BASE}/vol-surface/${encodeURIComponent(symbol)}`,
    { useCache: true, cacheTtlMs: 60_000 },
  );
}

export async function getIVHistory(
  symbol: string,
  strike: number,
  expiry: string,
  optionType: OptionType = 'call',
  period: string = '30D',
): Promise<IVHistoryResponse> {
  return apiClient.get<IVHistoryResponse>(
    `${BASE}/iv-history/${encodeURIComponent(symbol)}${qs({
      strike,
      expiry,
      type: optionType,
      period,
    })}`,
    { useCache: true, cacheTtlMs: 120_000 },
  );
}

export async function getUnusualActivity(
  symbol?: string,
  minPremium?: number,
  minVolumeOIRatio?: number,
  limit?: number,
): Promise<UnusualActivity[]> {
  return apiClient.get<UnusualActivity[]>(
    `${BASE}/unusual-activity${qs({
      symbol,
      min_premium: minPremium,
      min_vol_oi_ratio: minVolumeOIRatio,
      limit,
    })}`,
  );
}

export async function getOpenInterest(
  symbol: string,
  expiry?: string,
): Promise<OpenInterestData> {
  return apiClient.get<OpenInterestData>(
    `${BASE}/open-interest/${encodeURIComponent(symbol)}${qs({ expiry })}`,
    { useCache: true, cacheTtlMs: 60_000 },
  );
}

export async function getOptionsScreener(
  criteria: ScreenerCriteria,
): Promise<ScreenerResult> {
  return apiClient.post<ScreenerResult>(
    `${BASE}/screener`,
    criteria,
  );
}

export async function priceOption(
  params: PricingParams,
): Promise<PricingResult> {
  return apiClient.post<PricingResult>(
    `${BASE}/price`,
    params,
  );
}

// ─── Strategy Payoff ──────────────────────────────────────────────────────────

export interface StrategyLeg {
  optionType: OptionType;
  strike: number;
  expiry: string;
  quantity: number;
  side: 'buy' | 'sell';
  premium: number;
}

export interface PayoffPoint {
  underlyingPrice: number;
  payoff: number;
  payoffPerContract: number;
}

export interface StrategyAnalysis {
  legs: StrategyLeg[];
  netPremium: number;
  maxProfit: number | null;
  maxLoss: number | null;
  breakevens: number[];
  payoffCurve: PayoffPoint[];
  probabilityOfProfit: number;
  expectedValue: number;
  greeks: Greeks;
}

export async function analyzeStrategy(
  underlying: string,
  legs: StrategyLeg[],
): Promise<StrategyAnalysis> {
  return apiClient.post<StrategyAnalysis>(
    `${BASE}/strategy/analyze`,
    { underlying, legs },
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function moneyness(underlyingPrice: number, strike: number, type: OptionType): string {
  const diff = type === 'call'
    ? underlyingPrice - strike
    : strike - underlyingPrice;
  if (Math.abs(diff / underlyingPrice) < 0.02) return 'ATM';
  return diff > 0 ? 'ITM' : 'OTM';
}

export function formatIV(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`;
}

export function formatGreek(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

export function unusualActivityColor(type: UnusualActivityType): string {
  const map: Record<UnusualActivityType, string> = {
    large_volume: '#3b82f6',
    vol_spike: '#f59e0b',
    oi_change: '#8b5cf6',
    sweep: '#ef4444',
    block: '#00d4aa',
  };
  return map[type];
}

export function sentimentColor(sentiment: 'bullish' | 'bearish' | 'neutral'): string {
  switch (sentiment) {
    case 'bullish':  return '#00d4aa';
    case 'bearish':  return '#ff4444';
    case 'neutral':  return '#888888';
  }
}
