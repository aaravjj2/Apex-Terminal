/**
 * marketDataApi.ts
 * Market data API client for real-time quotes, historical bars, order book,
 * trades, VWAP, corporate actions, earnings, IPOs, and live WebSocket feeds.
 */

import {
  apiClient,
  cachedApiClient,
  createWebSocket,
  type WebSocketOptions,
} from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Timeframe =
  | '1m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h'
  | '1D' | '1W' | '1M';

export type MarketStatus = 'pre' | 'open' | 'post' | 'closed';

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  lastSize: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  vwap: number;
  avgVolume: number;
  marketCap: number;
  pe: number | null;
  eps: number | null;
  dividend: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketStatus: MarketStatus;
  exchange: string;
  timestamp: string;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface BarRequest {
  symbol: string;
  timeframe: Timeframe;
  start: string;
  end: string;
  adjustSplits?: boolean;
  adjustDividends?: boolean;
  limit?: number;
}

export interface BarResponse {
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  nextPageToken?: string;
}

export interface Level2Entry {
  price: number;
  size: number;
  orders: number;
  exchange?: string;
}

export interface Level2Data {
  symbol: string;
  bids: Level2Entry[];
  asks: Level2Entry[];
  spread: number;
  spreadPct: number;
  midpoint: number;
  imbalance: number;
  timestamp: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  exchange: string;
  conditions: string[];
  timestamp: string;
}

export interface TradesResponse {
  symbol: string;
  trades: Trade[];
  nextPageToken?: string;
}

export interface VWAPData {
  symbol: string;
  vwap: number;
  cumulativeVolume: number;
  cumulativeTurnover: number;
  deviation: number;
  upperBand1: number;
  lowerBand1: number;
  upperBand2: number;
  lowerBand2: number;
  anchored?: boolean;
  anchorTime?: string;
  timestamp: string;
}

export type CorporateActionType =
  | 'dividend'
  | 'split'
  | 'reverse_split'
  | 'spinoff'
  | 'rights_offering'
  | 'merger';

export interface CorporateAction {
  id: string;
  symbol: string;
  type: CorporateActionType;
  exDate: string;
  recordDate?: string;
  payDate?: string;
  description: string;
  amount?: number;
  ratio?: string;
  currency?: string;
}

export interface CorporateActionsResponse {
  symbol: string;
  actions: CorporateAction[];
}

export type EarningsSurprise = 'beat' | 'miss' | 'inline' | 'pending';

export interface EarningsData {
  symbol: string;
  fiscalQuarter: string;
  fiscalYear: number;
  reportDate: string;
  reportTime: 'bmo' | 'amc' | 'dmh' | 'unknown';
  epsEstimate: number | null;
  epsActual: number | null;
  epsSurprise: number | null;
  epsSurprisePct: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueSurprise: number | null;
  surprise: EarningsSurprise;
  whisperNumber?: number | null;
  guidanceLow?: number | null;
  guidanceHigh?: number | null;
  upcoming: EarningsDate[];
  history: EarningsHistoryEntry[];
}

export interface EarningsDate {
  fiscalQuarter: string;
  reportDate: string;
  reportTime: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

export interface EarningsHistoryEntry {
  fiscalQuarter: string;
  reportDate: string;
  epsEstimate: number;
  epsActual: number;
  epsSurprisePct: number;
  revenueEstimate: number;
  revenueActual: number;
}

export interface IPO {
  symbol: string;
  companyName: string;
  exchange: string;
  expectedDate: string;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  sharesOffered: number | null;
  dealSize: number | null;
  lead_underwriters: string[];
  sector: string;
  status: 'filed' | 'expected' | 'priced' | 'withdrawn';
}

export interface IPOCalendarResponse {
  startDate: string;
  endDate: string;
  ipos: IPO[];
  total: number;
}

export type LiveEventType =
  | 'quote'
  | 'trade'
  | 'bar'
  | 'level2'
  | 'status'
  | 'error';

export interface LiveEvent<T = unknown> {
  type: LiveEventType;
  symbol: string;
  data: T;
  timestamp: string;
}

export interface LiveSubscription {
  unsubscribe: () => void;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
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

const BASE = '/api/market-data';

export async function getQuote(symbol: string): Promise<Quote> {
  return apiClient.get<Quote>(`${BASE}/quotes/${encodeURIComponent(symbol)}`);
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  return apiClient.get<Quote[]>(
    `${BASE}/quotes${qs({ symbols: symbols.join(',') })}`,
  );
}

export async function getBars(params: BarRequest): Promise<BarResponse> {
  const { symbol, timeframe, start, end, adjustSplits, adjustDividends, limit } = params;
  return apiClient.get<BarResponse>(
    `${BASE}/bars/${encodeURIComponent(symbol)}${qs({
      timeframe,
      start,
      end,
      adjust_splits: adjustSplits,
      adjust_dividends: adjustDividends,
      limit,
    })}`,
    { useCache: true, cacheTtlMs: timeframeToTtl(timeframe) },
  );
}

export async function getLevel2(symbol: string): Promise<Level2Data> {
  return apiClient.get<Level2Data>(
    `${BASE}/level2/${encodeURIComponent(symbol)}`,
    { timeoutMs: 5000 },
  );
}

export async function getTrades(
  symbol: string,
  since?: string,
  limit?: number,
): Promise<TradesResponse> {
  return apiClient.get<TradesResponse>(
    `${BASE}/trades/${encodeURIComponent(symbol)}${qs({ since, limit })}`,
  );
}

export async function getVWAP(
  symbol: string,
  anchorTime?: string,
): Promise<VWAPData> {
  return apiClient.get<VWAPData>(
    `${BASE}/vwap/${encodeURIComponent(symbol)}${qs({ anchor_time: anchorTime })}`,
  );
}

export async function getCorporateActions(
  symbol: string,
  type?: CorporateActionType,
  startDate?: string,
  endDate?: string,
): Promise<CorporateActionsResponse> {
  return cachedApiClient.get<CorporateActionsResponse>(
    `${BASE}/corporate-actions/${encodeURIComponent(symbol)}${qs({
      type,
      start_date: startDate,
      end_date: endDate,
    })}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

export async function getEarnings(symbol: string): Promise<EarningsData> {
  return cachedApiClient.get<EarningsData>(
    `${BASE}/earnings/${encodeURIComponent(symbol)}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}

export async function getIPOs(
  startDate: string,
  endDate: string,
): Promise<IPOCalendarResponse> {
  return cachedApiClient.get<IPOCalendarResponse>(
    `${BASE}/ipos${qs({ start_date: startDate, end_date: endDate })}`,
    { useCache: true, cacheTtlMs: 300_000 },
  );
}

// ─── WebSocket Subscription ───────────────────────────────────────────────────

export function subscribeLive(
  symbols: string | string[],
  callback: (event: LiveEvent) => void,
  channels: LiveEventType[] = ['quote', 'trade'],
): LiveSubscription {
  const symbolList = Array.isArray(symbols) ? symbols : [symbols];
  const activeSymbols = new Set(symbolList);

  const ws = createWebSocket('/ws/market-data', {
    onMessage: (raw) => {
      const event = raw as LiveEvent;
      if (activeSymbols.has(event.symbol)) {
        callback(event);
      }
    },
    onOpen: () => {
      ws.send({
        action: 'subscribe',
        symbols: [...activeSymbols],
        channels,
      });
    },
    reconnectMs: 2000,
    maxReconnects: 10,
  });

  return {
    unsubscribe: () => {
      ws.send({ action: 'unsubscribe', symbols: [...activeSymbols] });
      ws.close();
    },
    addSymbol: (symbol: string) => {
      activeSymbols.add(symbol);
      ws.send({ action: 'subscribe', symbols: [symbol], channels });
    },
    removeSymbol: (symbol: string) => {
      activeSymbols.delete(symbol);
      ws.send({ action: 'unsubscribe', symbols: [symbol] });
    },
  };
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

export async function getMarketSnapshot(symbols: string[]): Promise<{
  quotes: Quote[];
  timestamp: string;
}> {
  return apiClient.get<{ quotes: Quote[]; timestamp: string }>(
    `${BASE}/snapshot${qs({ symbols: symbols.join(',') })}`,
  );
}

export async function getMarketStatus(): Promise<{
  exchange: string;
  status: MarketStatus;
  nextOpen?: string;
  nextClose?: string;
}[]> {
  return cachedApiClient.get(`${BASE}/status`, {
    useCache: true,
    cacheTtlMs: 60_000,
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function timeframeToTtl(tf: Timeframe): number {
  switch (tf) {
    case '1m':  return 5_000;
    case '5m':  return 15_000;
    case '15m': return 30_000;
    case '30m': return 60_000;
    case '1h':  return 120_000;
    case '2h':  return 300_000;
    case '4h':  return 600_000;
    case '1D':  return 3_600_000;
    case '1W':  return 3_600_000;
    case '1M':  return 3_600_000;
    default:    return 60_000;
  }
}

export function formatPrice(price: number, decimals = 2): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

export function changeColor(change: number): string {
  if (change > 0) return '#00d4aa';
  if (change < 0) return '#ff4444';
  return '#888888';
}

export function marketStatusLabel(status: MarketStatus): string {
  const labels: Record<MarketStatus, string> = {
    pre: 'Pre-Market',
    open: 'Market Open',
    post: 'After Hours',
    closed: 'Market Closed',
  };
  return labels[status];
}

export function timeframeLabel(tf: Timeframe): string {
  const labels: Record<Timeframe, string> = {
    '1m': '1 Min', '5m': '5 Min', '15m': '15 Min', '30m': '30 Min',
    '1h': '1 Hour', '2h': '2 Hour', '4h': '4 Hour',
    '1D': 'Daily', '1W': 'Weekly', '1M': 'Monthly',
  };
  return labels[tf];
}
