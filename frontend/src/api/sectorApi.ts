/**
 * sectorApi.ts
 * API client for Sector Analysis & Rotation endpoints.
 * Covers GICS sector performance, rotation signals, breadth, valuation, and momentum.
 */

import { useState, useCallback, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SECTOR_BASE = `${BASE_URL}/api/sector-analysis`;

export class SectorApiError extends Error {
  constructor(public statusCode: number, public detail: string, public endpoint: string) {
    super(`SectorAPI [${statusCode}] ${endpoint}: ${detail}`);
    this.name = 'SectorApiError';
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new SectorApiError(r.status, e.detail ?? r.statusText, url);
  }
  return r.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${SECTOR_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) });

const get = <T>(path: string) => apiFetch<T>(`${SECTOR_BASE}${path}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export type GICSSector =
  | 'energy' | 'materials' | 'industrials' | 'consumer_discretionary'
  | 'consumer_staples' | 'healthcare' | 'financials' | 'information_technology'
  | 'communication_services' | 'utilities' | 'real_estate';

export type CyclePhase = 'early' | 'mid' | 'late' | 'recession' | 'recovery';
export type RotationSignal = 'accumulate' | 'overweight' | 'neutral' | 'underweight' | 'avoid';

export interface SectorReturnData {
  sector: GICSSector;
  return_1d?: number;
  return_1w?: number;
  return_1m?: number;
  return_3m?: number;
  return_ytd?: number;
  return_1y?: number;
  beta?: number;
  market_cap_bn?: number;
}

export interface SectorPerformanceRequest {
  sector_returns: SectorReturnData[];
  benchmark_return?: number;
  period?: '1d' | '1w' | '1m' | '3m' | 'ytd' | '1y';
}

export interface SectorAlpha {
  sector: GICSSector;
  absolute_return: number;
  excess_return: number;
  rank: number;
  signal: RotationSignal;
}

export interface SectorPerformanceResult {
  rankings: SectorAlpha[];
  leader: GICSSector;
  laggard: GICSSector;
  dispersion: number;
  market_breadth_pct: number;   // % of sectors outperforming
}

export interface RotationModelRequest {
  sector_returns: SectorReturnData[];
  cycle_phase?: CyclePhase;
  ism_manufacturing?: number;
  yield_curve_slope?: number;
  credit_spreads_bps?: number;
  inflation_rate?: number;
}

export interface RotationSignalResult {
  sector: GICSSector;
  signal: RotationSignal;
  score: number;              // -2 to +2
  momentum_score: number;
  fundamental_score: number;
  cycle_fit_score: number;
  rationale: string;
}

export interface SectorRotationResult {
  signals: RotationSignalResult[];
  cycle_phase: CyclePhase;
  cycle_confidence: number;
  preferred_sectors: GICSSector[];
  avoid_sectors: GICSSector[];
  rotation_theme: string;
}

export interface BreadthRequest {
  symbol_data: Array<{
    symbol: string;
    sector: GICSSector;
    return_pct: number;
    above_200dma: boolean;
    above_50dma: boolean;
    rsi_14?: number;
  }>;
}

export interface SectorBreadthResult {
  sector: GICSSector;
  total_stocks: number;
  advancing: number;
  declining: number;
  above_200dma_pct: number;
  above_50dma_pct: number;
  new_highs: number;
  new_lows: number;
  breadth_score: number;     // -1 to +1
}

export interface MarketBreadthResult {
  sector_breadth: SectorBreadthResult[];
  overall_advance_decline: number;   // ratio
  overall_above_200dma_pct: number;
  breadth_regime: 'bullish' | 'neutral' | 'bearish';
  mcclellan_oscillator?: number;
}

export interface ValuationRequest {
  sector_valuations: Array<{
    sector: GICSSector;
    pe_ratio?: number;
    pb_ratio?: number;
    ps_ratio?: number;
    ev_ebitda?: number;
    dividend_yield?: number;
    forward_pe?: number;
    historical_avg_pe?: number;
  }>;
}

export interface SectorValuationResult {
  sector: GICSSector;
  pe_ratio?: number;
  pe_percentile?: number;   // vs historical — 0=cheapest, 100=most expensive
  pb_ratio?: number;
  pb_percentile?: number;
  composite_valuation_score: number;  // -1 (cheap) to +1 (expensive)
  valuation_signal: 'cheap' | 'fair' | 'expensive';
}

export interface ValuationResult {
  sector_valuations: SectorValuationResult[];
  cheapest_sectors: GICSSector[];
  most_expensive_sectors: GICSSector[];
  market_pe?: number;
  market_pb?: number;
}

export interface SectorCorrelationRequest {
  sector_returns: SectorReturnData[];
  lookback_weeks?: number;
}

export interface SectorCorrelationResult {
  matrix: Record<string, Record<string, number>>;   // sector -> sector -> correlation
  sectors: GICSSector[];
  average_correlation: number;
  most_correlated_pair: [GICSSector, GICSSector];
  least_correlated_pair: [GICSSector, GICSSector];
}

export interface FullSectorDashboard {
  performance: SectorPerformanceResult;
  rotation: SectorRotationResult;
  breadth: MarketBreadthResult;
  valuation: ValuationResult;
  correlation: SectorCorrelationResult;
  timestamp: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const getSectorCapabilities = () =>
  get<{ endpoints: string[]; sectors: string[] }>('/capabilities');

export const getSectorPerformance = (req: SectorPerformanceRequest) =>
  post<SectorPerformanceResult>('/performance', req);

export const getSectorRotation = (req: RotationModelRequest) =>
  post<SectorRotationResult>('/rotation', req);

export const getMarketBreadth = (req: BreadthRequest) =>
  post<MarketBreadthResult>('/breadth', req);

export const getSectorValuation = (req: ValuationRequest) =>
  post<ValuationResult>('/valuation', req);

export const getSectorCorrelation = (req: SectorCorrelationRequest) =>
  post<SectorCorrelationResult>('/correlation', req);

export const getFullSectorDashboard = (req: {
  sector_returns: SectorReturnData[];
  cycle_phase?: CyclePhase;
  symbol_data?: BreadthRequest['symbol_data'];
}) => post<FullSectorDashboard>('/dashboard', req);

export const getAllSectors = () =>
  get<{ sectors: GICSSector[]; descriptions: Record<GICSSector, string> }>('/sectors');

export const getCyclePhaseSignals = (phase: CyclePhase) =>
  get<{
    phase: CyclePhase;
    preferred: GICSSector[];
    avoid: GICSSector[];
    characteristics: string;
    typical_duration_months: number;
  }>(`/cycle-phase/${phase}`);

// ─── Utilities ────────────────────────────────────────────────────────────────

export const SECTOR_LABELS: Record<GICSSector, string> = {
  energy: 'Energy',
  materials: 'Materials',
  industrials: 'Industrials',
  consumer_discretionary: 'Cons. Disc.',
  consumer_staples: 'Cons. Staples',
  healthcare: 'Health Care',
  financials: 'Financials',
  information_technology: 'Info Tech',
  communication_services: 'Comm. Svcs',
  utilities: 'Utilities',
  real_estate: 'Real Estate',
};

export const SECTOR_ETFS: Record<GICSSector, string> = {
  energy: 'XLE',
  materials: 'XLB',
  industrials: 'XLI',
  consumer_discretionary: 'XLY',
  consumer_staples: 'XLP',
  healthcare: 'XLV',
  financials: 'XLF',
  information_technology: 'XLK',
  communication_services: 'XLC',
  utilities: 'XLU',
  real_estate: 'XLRE',
};

export const CYCLE_PREFERRED: Record<CyclePhase, GICSSector[]> = {
  early: ['real_estate', 'consumer_discretionary', 'financials', 'industrials'],
  mid: ['information_technology', 'industrials', 'materials', 'energy'],
  late: ['energy', 'materials', 'consumer_staples', 'healthcare'],
  recession: ['consumer_staples', 'utilities', 'healthcare'],
  recovery: ['financials', 'consumer_discretionary', 'real_estate', 'industrials'],
};

export function signalToColor(signal: RotationSignal): string {
  switch (signal) {
    case 'accumulate': return '#00d4aa';
    case 'overweight': return '#00ff9d';
    case 'neutral': return '#888';
    case 'underweight': return '#ff9900';
    case 'avoid': return '#ff4444';
  }
}

export function cyclePhaseLabel(phase: CyclePhase): string {
  const labels: Record<CyclePhase, string> = {
    early: 'Early Cycle',
    mid: 'Mid Cycle',
    late: 'Late Cycle',
    recession: 'Recession',
    recovery: 'Recovery',
  };
  return labels[phase];
}

// ─── React Hooks ──────────────────────────────────────────────────────────────

export function useFullSectorDashboard(
  sectorReturns: SectorReturnData[],
  cyclePhase?: CyclePhase,
  refreshMs = 30000,
) {
  const [data, setData] = useState<FullSectorDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (sectorReturns.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getFullSectorDashboard({ sector_returns: sectorReturns, cycle_phase: cyclePhase }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(sectorReturns), cyclePhase]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, refreshMs);
    return () => clearInterval(t);
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh };
}

export function useSectorRotation(req: RotationModelRequest | null) {
  const [data, setData] = useState<SectorRotationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSectorRotation(req));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

export function useMarketBreadth(req: BreadthRequest | null) {
  const [data, setData] = useState<MarketBreadthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!req) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getMarketBreadth(req));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(req)]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
