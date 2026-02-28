/**
 * macroApi.ts
 * API client for the Macro Indicators endpoints (FastAPI backend).
 * Provides typed fetch functions for yield curve, inflation, ISM, recession probability,
 * macro regime classification, FOMC stance analysis, and full dashboard data.
 */

// ─── Base Configuration ───────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MACRO_BASE = `${BASE_URL}/api/macro`;
const DEFAULT_TIMEOUT_MS = 10000;

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${MACRO_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
      signal: controller.signal,
      ...fetchOptions,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({ detail: response.statusText }));
      throw new MacroApiError(response.status, detail.detail || response.statusText, endpoint);
    }
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T>(endpoint: string, body: unknown, options: FetchOptions = {}): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class MacroApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
    public readonly endpoint: string,
  ) {
    super(`MacroAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'MacroApiError';
  }
}

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface YieldCurvePointInput {
  maturity_years: number;
  yield_pct: number;
}

export interface YieldCurveAnalysis {
  is_inverted: boolean;
  spread_10y_2y: number;
  spread_10y_3m: number;
  slope: number;
  curvature: number;
  real_10y?: number;
  regime: string;
  recession_probability?: number;
  points: YieldCurvePointInput[];
}

export interface YieldCurveRequest {
  points: YieldCurvePointInput[];
  calculate_real_rates?: boolean;
  inflation_expectation?: number;
}

export interface RealRatesResult {
  nominal_10y: number;
  inflation_expectation: number;
  real_10y: number;
  real_rate_regime: string;
}

export interface InflationRequest {
  cpi_yoy: number;
  pce_yoy: number;
  core_cpi?: number;
  core_pce?: number;
  ppi_yoy?: number;
  breakeven_10y?: number;
  lookback_months?: number;
}

export interface InflationRegimeResult {
  regime: string;
  cpi_trend: string;
  pce_trend: string;
  is_above_target: boolean;
  is_accelerating: boolean;
  fed_likely_response: string;
  composite_inflation_score: number;
}

export interface ISMRequest {
  new_orders: number;
  production: number;
  employment: number;
  supplier_deliveries: number;
  inventories: number;
  previous_ism?: number;
}

export interface ISMSignalResult {
  ism_composite: number;
  expansion_signal: boolean;
  cycle_signal: string;
  momentum: string;
  month_over_month_change?: number;
}

export interface RecessionProbRequest {
  yield_spread_10y2y: number;
  leading_indicators_6m_change?: number;
  unemployment_rate?: number;
  credit_spread_bps?: number;
  manufacturing_pmi?: number;
  consumer_confidence?: number;
}

export interface RecessionProbabilityResult {
  recession_probability: number;
  regime: string;
  signal_count_negative: number;
  signal_count_positive: number;
  key_risks: string[];
  key_supports: string[];
  six_month_forecast: string;
}

export interface MacroRegimeRequest {
  real_gdp_growth?: number;
  inflation_rate?: number;
  unemployment_rate?: number;
  yield_spread?: number;
  ism_manufacturing?: number;
  credit_spreads_bps?: number;
  equity_risk_premium?: number;
}

export interface MacroRegimeResult {
  regime: string;
  regime_confidence: number;
  preferred_assets: string[];
  avoid_assets: string[];
  policy_stance: string;
  estimated_duration_months: number;
  key_indicators: Record<string, string>;
}

export interface FOMCRequest {
  inflation_rate: number;
  unemployment_rate: number;
  real_gdp_growth?: number;
  neutral_rate?: number;
  current_fed_funds_rate?: number;
}

export interface FOMCStanceResult {
  stance: string;
  likely_action: string;
  probability_hike: number;
  probability_cut: number;
  probability_hold: number;
  taylor_rule_rate?: number;
  deviation_from_neutral?: number;
  forward_guidance: string;
}

export interface FullMacroDashboardRequest {
  yield_curve_points?: YieldCurvePointInput[];
  inflation?: InflationRequest;
  ism?: ISMRequest;
  recession?: RecessionProbRequest;
  regime?: MacroRegimeRequest;
  fomc?: FOMCRequest;
}

export interface FullMacroDashboard {
  yield_curve?: YieldCurveAnalysis;
  inflation_regime?: InflationRegimeResult;
  ism_signal?: ISMSignalResult;
  recession_probability?: RecessionProbabilityResult;
  macro_regime?: MacroRegimeResult;
  fomc_stance?: FOMCStanceResult;
  timestamp: string;
}

export interface MacroCapabilities {
  endpoints: string[];
  models: string[];
  version: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Get capabilities and available models for the macro indicators engine.
 */
export async function getMacroCapabilities(): Promise<MacroCapabilities> {
  return apiFetch<MacroCapabilities>('/capabilities');
}

/**
 * Analyze a yield curve for inversion, recession probability, and regime.
 */
export async function analyzeYieldCurve(request: YieldCurveRequest): Promise<YieldCurveAnalysis> {
  return postJson<YieldCurveAnalysis>('/yield-curve/analyze', request);
}

/**
 * Calculate real interest rates given nominal yield and inflation expectations.
 */
export async function getRealRates(
  nominal10y: number,
  inflationExpectation: number,
): Promise<RealRatesResult> {
  return apiFetch<RealRatesResult>(
    `/real-rates?nominal_10y=${nominal10y}&inflation_expectation=${inflationExpectation}`
  );
}

/**
 * Detect inflation regime (transitory, persistent, stagflationary, etc.).
 */
export async function detectInflationRegime(request: InflationRequest): Promise<InflationRegimeResult> {
  return postJson<InflationRegimeResult>('/inflation/regime', request);
}

/**
 * Generate macro signal from ISM manufacturing survey data.
 */
export async function getISMSignal(request: ISMRequest): Promise<ISMSignalResult> {
  return postJson<ISMSignalResult>('/ism/signal', request);
}

/**
 * Get composite ISM signal (manufacturing + services weighted).
 */
export async function getISMComposite(
  manufacturingISM: number,
  servicesISM: number,
): Promise<{ composite_ism: number; signal: string; weight_mfg: number; weight_svc: number }> {
  return postJson('/ism/composite', { manufacturing_ism: manufacturingISM, services_ism: servicesISM });
}

/**
 * Compute recession probability using multiple leading indicators.
 */
export async function getRecessionProbability(request: RecessionProbRequest): Promise<RecessionProbabilityResult> {
  return postJson<RecessionProbabilityResult>('/recession-probability', request);
}

/**
 * Classify the current macro regime (early/mid/late cycle, recession) with asset recommendations.
 */
export async function getMacroRegime(request: MacroRegimeRequest): Promise<MacroRegimeResult> {
  return postJson<MacroRegimeResult>('/macro-regime', request);
}

/**
 * Analyze FOMC monetary policy stance and predict next rate decision.
 */
export async function getFOMCStance(request: FOMCRequest): Promise<FOMCStanceResult> {
  return postJson<FOMCStanceResult>('/fomc/stance', request);
}

/**
 * Get all available macro regime states.
 */
export async function getAllMacroRegimes(): Promise<{ regimes: string[]; descriptions: Record<string, string> }> {
  return apiFetch('/regimes/all');
}

/**
 * Get all FOMC stance labels.
 */
export async function getAllFOMCStances(): Promise<{ stances: string[] }> {
  return apiFetch('/fomc/stances');
}

/**
 * Fetch full macro dashboard — all indicators in one call.
 */
export async function getFullMacroDashboard(request: FullMacroDashboardRequest): Promise<FullMacroDashboard> {
  return postJson<FullMacroDashboard>('/dashboard', request);
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Build a standard yield curve request from US Treasury par yields. */
export function buildUSYieldCurveRequest(
  yields: { '3m': number; '6m': number; '1y': number; '2y': number; '5y': number; '10y': number; '30y': number },
  inflationExpectation?: number,
): YieldCurveRequest {
  return {
    points: [
      { maturity_years: 0.25, yield_pct: yields['3m'] },
      { maturity_years: 0.5, yield_pct: yields['6m'] },
      { maturity_years: 1, yield_pct: yields['1y'] },
      { maturity_years: 2, yield_pct: yields['2y'] },
      { maturity_years: 5, yield_pct: yields['5y'] },
      { maturity_years: 10, yield_pct: yields['10y'] },
      { maturity_years: 30, yield_pct: yields['30y'] },
    ],
    calculate_real_rates: inflationExpectation !== undefined,
    inflation_expectation: inflationExpectation,
  };
}

/** Interpret a yield curve analysis result into a human-readable summary. */
export function interpretYieldCurve(analysis: YieldCurveAnalysis): string {
  const parts: string[] = [];
  if (analysis.is_inverted) {
    parts.push(`⚠ Yield curve is INVERTED (10Y-2Y spread: ${(analysis.spread_10y_2y * 100).toFixed(0)}bps)`);
  } else {
    parts.push(`Yield curve is normal (10Y-2Y spread: ${(analysis.spread_10y_2y * 100).toFixed(0)}bps)`);
  }
  if (analysis.recession_probability !== undefined) {
    parts.push(`Recession probability: ${(analysis.recession_probability * 100).toFixed(1)}%`);
  }
  parts.push(`Regime: ${analysis.regime}`);
  return parts.join(' · ');
}

/** Format a FOMC stance result as a summary string. */
export function interpretFOMCStance(stance: FOMCStanceResult): string {
  return [
    `FOMC: ${stance.stance}`,
    `Likely: ${stance.likely_action}`,
    `Hike ${(stance.probability_hike * 100).toFixed(0)}% / Hold ${(stance.probability_hold * 100).toFixed(0)}% / Cut ${(stance.probability_cut * 100).toFixed(0)}%`,
  ].join(' · ');
}

// ─── React hook (bonus) ───────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';

interface UseMacroDashboardOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
  request?: FullMacroDashboardRequest;
}

interface UseMacroDashboardResult {
  data: FullMacroDashboard | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useMacroDashboard(options: UseMacroDashboardOptions = {}): UseMacroDashboardResult {
  const { autoRefresh = true, refreshIntervalMs = 60000, request = {} } = options;
  const [data, setData] = useState<FullMacroDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFullMacroDashboard(request);
      setData(result);
      setLastUpdated(new Date());
    } catch (e) {
      const msg = e instanceof MacroApiError ? e.message : e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(request)]);  // eslint-disable-line

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const timer = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, autoRefresh, refreshIntervalMs]);

  return { data, loading, error, lastUpdated, refresh };
}
