/**
 * screeningApi.ts
 * Screening API client for running custom screens, managing saved screens,
 * fetching batch fundamentals/technicals, and accessing pre-built screens.
 */

import { apiClient, cachedApiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScreenOperator =
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'eq' | 'neq'
  | 'between' | 'in' | 'not_in'
  | 'above_sma' | 'below_sma'
  | 'crosses_above' | 'crosses_below';

export type SortOrder = 'asc' | 'desc';

export interface ScreenCriterion {
  field: string;
  operator: ScreenOperator;
  value: number | string | number[] | string[];
  period?: string;
}

export interface ScreenCriteria {
  criteria: ScreenCriterion[];
  logic?: 'and' | 'or';
  sortBy?: string;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

export type UniverseType =
  | 'sp500' | 'nasdaq100' | 'djia' | 'russell2000' | 'russell3000'
  | 'all_us' | 'all_global' | 'etfs' | 'crypto' | 'forex'
  | 'custom';

export interface Universe {
  id: string;
  name: string;
  type: UniverseType;
  symbolCount: number;
  description: string;
  lastUpdated: string;
}

export interface ScreenResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  values: Record<string, number | string | null>;
}

export interface ScreenResponse {
  results: ScreenResult[];
  total: number;
  universe: string;
  criteriaCount: number;
  executionTimeMs: number;
  timestamp: string;
}

export interface SavedScreen {
  id: string;
  name: string;
  description: string;
  criteria: ScreenCriteria;
  universe: UniverseType;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  resultCount: number | null;
  isFavorite: boolean;
  tags: string[];
}

export interface ScreenHistoryEntry {
  id: string;
  screenId: string;
  runAt: string;
  resultCount: number;
  topResults: ScreenResult[];
  addedSymbols: string[];
  removedSymbols: string[];
}

export interface FundamentalData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  enterpriseValue: number;
  pe: number | null;
  forwardPE: number | null;
  peg: number | null;
  pb: number | null;
  ps: number | null;
  evEbitda: number | null;
  evRevenue: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  beta: number | null;
  floatShort: number | null;
  sharesOutstanding: number;
  floatShares: number;
  avgVolume: number;
  revenue: number;
  ebitda: number;
  netIncome: number;
  freeCashFlow: number;
  lastUpdated: string;
}

export interface TechnicalData {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  relativeVolume: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  stochK: number | null;
  stochD: number | null;
  adx14: number | null;
  atr14: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  vwap: number | null;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  distFromHigh: number;
  distFromLow: number;
  avgVolume20: number;
  trend: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
  support: number | null;
  resistance: number | null;
  lastUpdated: string;
}

export interface PreBuiltScreen {
  id: string;
  name: string;
  category: string;
  description: string;
  criteria: ScreenCriteria;
  universe: UniverseType;
  popularity: number;
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

const BASE = '/api/screening';

export async function runScreen(
  criteria: ScreenCriteria,
  universe: UniverseType = 'all_us',
): Promise<ScreenResponse> {
  return apiClient.post<ScreenResponse>(
    `${BASE}/run`,
    { criteria, universe },
    { timeoutMs: 30000 },
  );
}

export async function getSavedScreens(): Promise<SavedScreen[]> {
  return apiClient.get<SavedScreen[]>(`${BASE}/saved`);
}

export async function getSavedScreen(screenId: string): Promise<SavedScreen> {
  return apiClient.get<SavedScreen>(`${BASE}/saved/${screenId}`);
}

export async function saveScreen(
  name: string,
  criteria: ScreenCriteria,
  universe: UniverseType,
  description?: string,
  tags?: string[],
): Promise<SavedScreen> {
  return apiClient.post<SavedScreen>(`${BASE}/saved`, {
    name,
    criteria,
    universe,
    description: description ?? '',
    tags: tags ?? [],
  });
}

export async function updateScreen(
  screenId: string,
  updates: Partial<Pick<SavedScreen, 'name' | 'description' | 'criteria' | 'universe' | 'isFavorite' | 'tags'>>,
): Promise<SavedScreen> {
  return apiClient.patch<SavedScreen>(
    `${BASE}/saved/${screenId}`,
    updates,
  );
}

export async function deleteScreen(screenId: string): Promise<void> {
  await apiClient.delete(`${BASE}/saved/${screenId}`);
}

export async function getScreenHistory(
  screenId: string,
  limit = 20,
): Promise<ScreenHistoryEntry[]> {
  return apiClient.get<ScreenHistoryEntry[]>(
    `${BASE}/saved/${screenId}/history${qs({ limit })}`,
  );
}

export async function getUniverses(): Promise<Universe[]> {
  return cachedApiClient.get<Universe[]>(
    `${BASE}/universes`,
    { useCache: true, cacheTtlMs: 3_600_000 },
  );
}

export async function getFundamentals(
  symbols: string[],
): Promise<FundamentalData[]> {
  return apiClient.post<FundamentalData[]>(
    `${BASE}/fundamentals`,
    { symbols },
    { useCache: true, cacheTtlMs: 300_000 } as never,
  );
}

export async function getTechnicals(
  symbols: string[],
): Promise<TechnicalData[]> {
  return apiClient.post<TechnicalData[]>(
    `${BASE}/technicals`,
    { symbols },
  );
}

export async function getPreBuiltScreens(): Promise<PreBuiltScreen[]> {
  return cachedApiClient.get<PreBuiltScreen[]>(
    `${BASE}/pre-built`,
    { useCache: true, cacheTtlMs: 3_600_000 },
  );
}

export async function runPreBuiltScreen(
  screenId: string,
  overrides?: Partial<ScreenCriteria>,
): Promise<ScreenResponse> {
  return apiClient.post<ScreenResponse>(
    `${BASE}/pre-built/${screenId}/run`,
    { overrides },
    { timeoutMs: 30000 },
  );
}

// ─── Available Fields ─────────────────────────────────────────────────────────

export interface ScreenField {
  id: string;
  name: string;
  category: string;
  type: 'number' | 'string' | 'boolean';
  description: string;
  unit?: string;
  operators: ScreenOperator[];
}

export async function getAvailableFields(): Promise<ScreenField[]> {
  return cachedApiClient.get<ScreenField[]>(
    `${BASE}/fields`,
    { useCache: true, cacheTtlMs: 3_600_000 },
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

export function trendColor(trend: TechnicalData['trend']): string {
  const map: Record<TechnicalData['trend'], string> = {
    strong_up: '#00ff9d',
    up: '#00d4aa',
    neutral: '#888888',
    down: '#ff9900',
    strong_down: '#ff4444',
  };
  return map[trend];
}

export function operatorLabel(op: ScreenOperator): string {
  const map: Record<ScreenOperator, string> = {
    gt: 'Greater than',
    gte: 'Greater or equal',
    lt: 'Less than',
    lte: 'Less or equal',
    eq: 'Equals',
    neq: 'Not equal',
    between: 'Between',
    in: 'In',
    not_in: 'Not in',
    above_sma: 'Above SMA',
    below_sma: 'Below SMA',
    crosses_above: 'Crosses above',
    crosses_below: 'Crosses below',
  };
  return map[op];
}
