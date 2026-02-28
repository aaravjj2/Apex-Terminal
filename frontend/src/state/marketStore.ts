/**
 * marketStore.ts
 * Real-time market data state management: quotes, watchlists,
 * market status, economic calendar, sector performance, index data,
 * price alerts, and breadth indicators. Provides computed selectors
 * and action dispatchers for market-related UI components.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Quote {
  ticker: string;
  name: string;
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  avg_volume: number;
  market_cap: number;
  pe_ratio?: number;
  eps?: number;
  dividend_yield?: number;
  change: number;
  change_pct: number;
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  last_size: number;
  timestamp: number;
  exchange: string;
  currency: string;
  type: string;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  ytd_change_pct: number;
  timestamp: number;
}

export interface SectorPerf {
  sector: string;
  etf: string;
  change_pct_1d: number;
  change_pct_1w: number;
  change_pct_1m: number;
  change_pct_ytd: number;
  pe: number;
  pb: number;
  div_yield: number;
  breadth: number;
  rs_vs_spy: number;
}

export interface EconomicEvent {
  id: string;
  date: Date;
  time: string;
  country: string;
  indicator: string;
  importance: 'low' | 'medium' | 'high';
  actual?: number;
  forecast?: number;
  previous?: number;
  unit: string;
  surprise?: number;
  surprise_pct?: number;
}

export type MarketSession = 'pre' | 'open' | 'post' | 'closed' | 'weekend';

export interface MarketStatus {
  session: MarketSession;
  nextOpen: Date | null;
  nextClose: Date | null;
  dstActive: boolean;
  timezone: string;
}

export interface BreadthData {
  advancers: number;
  decliners: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  aboveSma50: number;
  aboveSma200: number;
  putCallRatio: number;
  vix: number;
  totalVolume: number;
  upVolume: number;
  downVolume: number;
  armsTrin: number;
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

const INITIAL_QUOTES: Map<string, Quote> = new Map([
  ['NVDA', {
    ticker: 'NVDA', name: 'NVIDIA Corp', price: 862.42, prev_close: 843.28, open: 848.00, high: 872.44, low: 840.12,
    volume: 42_680_000, avg_volume: 38_200_000, market_cap: 2_130_000_000_000, pe_ratio: 64.2, eps: 13.43,
    dividend_yield: 0.03, change: 19.14, change_pct: 2.27, bid: 862.30, ask: 862.50,
    bid_size: 200, ask_size: 400, last_size: 100, timestamp: Date.now(),
    exchange: 'NASDAQ', currency: 'USD', type: 'stock',
  }],
  ['AAPL', {
    ticker: 'AAPL', name: 'Apple Inc', price: 189.64, prev_close: 191.17, open: 190.22, high: 192.14, low: 188.88,
    volume: 68_440_000, avg_volume: 72_100_000, market_cap: 2_940_000_000_000, pe_ratio: 31.2, eps: 6.08,
    dividend_yield: 0.52, change: -1.53, change_pct: -0.80, bid: 189.62, ask: 189.67,
    bid_size: 500, ask_size: 300, last_size: 200, timestamp: Date.now(),
    exchange: 'NASDAQ', currency: 'USD', type: 'stock',
  }],
  ['SPY', {
    ticker: 'SPY', name: 'SPDR S&P 500 ETF', price: 527.88, prev_close: 522.44, open: 523.10, high: 529.42, low: 521.88,
    volume: 84_220_000, avg_volume: 78_400_000, market_cap: 490_000_000_000, pe_ratio: 24.8, eps: 0, dividend_yield: 1.32,
    change: 5.44, change_pct: 1.04, bid: 527.86, ask: 527.89, bid_size: 1000, ask_size: 1000, last_size: 500,
    timestamp: Date.now(), exchange: 'NYSE', currency: 'USD', type: 'etf',
  }],
  ['QQQ', {
    ticker: 'QQQ', name: 'Invesco QQQ ETF', price: 456.22, prev_close: 449.88, open: 450.11, high: 458.44, low: 448.22,
    volume: 42_100_000, avg_volume: 39_600_000, market_cap: 220_000_000_000, pe_ratio: 32.1, eps: 0, dividend_yield: 0.54,
    change: 6.34, change_pct: 1.41, bid: 456.20, ask: 456.24, bid_size: 800, ask_size: 600, last_size: 300,
    timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD', type: 'etf',
  }],
]);

const INITIAL_INDICES: IndexQuote[] = [
  { symbol: 'SPX', name: 'S&P 500', price: 5_308.42, change: 52.6, change_pct: 1.00, ytd_change_pct: 12.4, timestamp: Date.now() },
  { symbol: 'NDX', name: 'NASDAQ 100', price: 18_642.88, change: 228.4, change_pct: 1.24, ytd_change_pct: 18.2, timestamp: Date.now() },
  { symbol: 'DJI', name: 'Dow Jones', price: 39_412.88, change: 312.4, change_pct: 0.80, ytd_change_pct: 6.8, timestamp: Date.now() },
  { symbol: 'RUT', name: 'Russell 2000', price: 2_062.44, change: -12.8, change_pct: -0.62, ytd_change_pct: -1.4, timestamp: Date.now() },
  { symbol: 'VIX', name: 'CBOE VIX', price: 14.22, change: -0.68, change_pct: -4.56, ytd_change_pct: -18.4, timestamp: Date.now() },
  { symbol: 'DXY', name: 'US Dollar Index', price: 104.88, change: 0.32, change_pct: 0.31, ytd_change_pct: 3.2, timestamp: Date.now() },
  { symbol: 'TNX', name: 'US 10Y Yield', price: 4.42, change: 0.04, change_pct: 0.91, ytd_change_pct: 5.8, timestamp: Date.now() },
  { symbol: 'GC', name: 'Gold', price: 2_328.80, change: -14.2, change_pct: -0.61, ytd_change_pct: 8.4, timestamp: Date.now() },
  { symbol: 'BTC', name: 'Bitcoin', price: 68_420, change: 842, change_pct: 1.25, ytd_change_pct: 44.2, timestamp: Date.now() },
];

const INITIAL_SECTORS: SectorPerf[] = [
  { sector: 'Technology', etf: 'XLK', change_pct_1d: 1.87, change_pct_1w: 3.42, change_pct_1m: 8.12, change_pct_ytd: 22.4, pe: 38.2, pb: 12.4, div_yield: 0.64, breadth: 72.4, rs_vs_spy: 1.18 },
  { sector: 'Financials', etf: 'XLF', change_pct_1d: 0.88, change_pct_1w: 1.64, change_pct_1m: 4.22, change_pct_ytd: 12.8, pe: 14.2, pb: 1.84, div_yield: 2.12, breadth: 64.2, rs_vs_spy: 0.92 },
  { sector: 'Health Care', etf: 'XLV', change_pct_1d: -0.42, change_pct_1w: -0.88, change_pct_1m: 1.22, change_pct_ytd: 6.4, pe: 22.4, pb: 4.88, div_yield: 1.62, breadth: 48.4, rs_vs_spy: 0.78 },
  { sector: 'Comm Services', etf: 'XLC', change_pct_1d: 1.44, change_pct_1w: 2.88, change_pct_1m: 6.44, change_pct_ytd: 18.4, pe: 28.2, pb: 6.42, div_yield: 0.88, breadth: 68.4, rs_vs_spy: 1.12 },
  { sector: 'Consumer Disc', etf: 'XLY', change_pct_1d: 0.62, change_pct_1w: 1.22, change_pct_1m: 2.88, change_pct_ytd: 4.2, pe: 32.4, pb: 8.22, div_yield: 0.42, breadth: 52.4, rs_vs_spy: 0.84 },
  { sector: 'Industrials', etf: 'XLI', change_pct_1d: 0.44, change_pct_1w: 0.88, change_pct_1m: 3.44, change_pct_ytd: 9.2, pe: 24.8, pb: 4.44, div_yield: 1.44, breadth: 58.4, rs_vs_spy: 0.88 },
  { sector: 'Energy', etf: 'XLE', change_pct_1d: -0.88, change_pct_1w: -2.44, change_pct_1m: -4.22, change_pct_ytd: -2.4, pe: 12.4, pb: 2.22, div_yield: 3.42, breadth: 38.4, rs_vs_spy: 0.64 },
  { sector: 'Materials', etf: 'XLB', change_pct_1d: 0.22, change_pct_1w: 0.44, change_pct_1m: 1.88, change_pct_ytd: 4.8, pe: 18.2, pb: 3.44, div_yield: 1.88, breadth: 54.4, rs_vs_spy: 0.82 },
  { sector: 'Utilities', etf: 'XLU', change_pct_1d: -0.22, change_pct_1w: -0.44, change_pct_1m: 0.88, change_pct_ytd: 2.4, pe: 20.4, pb: 2.88, div_yield: 3.22, breadth: 44.4, rs_vs_spy: 0.68 },
  { sector: 'Real Estate', etf: 'XLRE', change_pct_1d: -0.64, change_pct_1w: -1.22, change_pct_1m: -2.44, change_pct_ytd: -4.8, pe: 28.4, pb: 2.44, div_yield: 4.42, breadth: 42.4, rs_vs_spy: 0.62 },
  { sector: 'Consumer Stap', etf: 'XLP', change_pct_1d: 0.12, change_pct_1w: 0.22, change_pct_1m: 1.44, change_pct_ytd: 2.2, pe: 24.2, pb: 6.44, div_yield: 2.88, breadth: 46.4, rs_vs_spy: 0.72 },
];

// ─── State Types ──────────────────────────────────────────────────────────────

export interface MarketState {
  quotes: Map<string, Quote>;
  indices: IndexQuote[];
  sectors: SectorPerf[];
  breadth: BreadthData;
  marketStatus: MarketStatus;
  economicCalendar: EconomicEvent[];
  watchlist: string[];
  isLoading: boolean;
  lastUpdate: Date | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type MarketAction =
  | { type: 'UPDATE_QUOTE'; quote: Quote }
  | { type: 'UPDATE_QUOTES'; quotes: Quote[] }
  | { type: 'UPDATE_INDICES'; indices: IndexQuote[] }
  | { type: 'UPDATE_SECTORS'; sectors: SectorPerf[] }
  | { type: 'UPDATE_BREADTH'; breadth: Partial<BreadthData> }
  | { type: 'UPDATE_MARKET_STATUS'; status: MarketStatus }
  | { type: 'ADD_TO_WATCHLIST'; ticker: string }
  | { type: 'REMOVE_FROM_WATCHLIST'; ticker: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ECONOMIC_CALENDAR'; events: EconomicEvent[] };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function marketReducer(state: MarketState, action: MarketAction): MarketState {
  switch (action.type) {
    case 'UPDATE_QUOTE': {
      const quotes = new Map(state.quotes);
      quotes.set(action.quote.ticker, action.quote);
      return { ...state, quotes, lastUpdate: new Date() };
    }
    case 'UPDATE_QUOTES': {
      const quotes = new Map(state.quotes);
      action.quotes.forEach(q => quotes.set(q.ticker, q));
      return { ...state, quotes, lastUpdate: new Date() };
    }
    case 'UPDATE_INDICES': return { ...state, indices: action.indices, lastUpdate: new Date() };
    case 'UPDATE_SECTORS': return { ...state, sectors: action.sectors };
    case 'UPDATE_BREADTH': return { ...state, breadth: { ...state.breadth, ...action.breadth } };
    case 'UPDATE_MARKET_STATUS': return { ...state, marketStatus: action.status };
    case 'ADD_TO_WATCHLIST':
      if (state.watchlist.includes(action.ticker)) return state;
      return { ...state, watchlist: [...state.watchlist, action.ticker] };
    case 'REMOVE_FROM_WATCHLIST':
      return { ...state, watchlist: state.watchlist.filter(t => t !== action.ticker) };
    case 'SET_LOADING': return { ...state, isLoading: action.loading };
    case 'SET_ECONOMIC_CALENDAR': return { ...state, economicCalendar: action.events };
    default: return state;
  }
}

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) return { session: 'weekend', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
  if (hour < 4) return { session: 'closed', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
  if (hour < 9) return { session: 'pre', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
  if (hour < 16) return { session: 'open', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
  if (hour < 20) return { session: 'post', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
  return { session: 'closed', nextOpen: null, nextClose: null, dstActive: false, timezone: 'America/New_York' };
}

const INITIAL_BREADTH: BreadthData = {
  advancers: 2844, decliners: 1622, unchanged: 134, newHighs: 288, newLows: 44,
  aboveSma50: 68.4, aboveSma200: 72.8, putCallRatio: 0.82, vix: 14.22,
  totalVolume: 8_420_000_000, upVolume: 5_644_000_000, downVolume: 2_776_000_000, armsTrin: 0.72,
};

const INITIAL_MARKET_STATE: MarketState = {
  quotes: INITIAL_QUOTES,
  indices: INITIAL_INDICES,
  sectors: INITIAL_SECTORS,
  breadth: INITIAL_BREADTH,
  marketStatus: getMarketStatus(),
  economicCalendar: [],
  watchlist: ['NVDA', 'AAPL', 'MSFT', 'META', 'TSLA', 'SPY', 'QQQ'],
  isLoading: false,
  lastUpdate: null,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const MarketContext = createContext<{
  state: MarketState;
  dispatch: React.Dispatch<MarketAction>;
} | null>(null);

export function useMarketStore() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarketStore must be inside MarketProvider');
  return ctx;
}

export const MarketProvider: React.FC<{ children: React.ReactNode; simulateRealtime?: boolean }> = ({
  children,
  simulateRealtime = false,
}) => {
  const [state, dispatch] = useReducer(marketReducer, INITIAL_MARKET_STATE);

  useEffect(() => {
    if (!simulateRealtime) return;
    const interval = setInterval(() => {
      const updatedIndices = state.indices.map(idx => {
        const delta = idx.price * (Math.random() - 0.499) * 0.0008;
        const newPrice = Math.max(0.01, idx.price + delta);
        return { ...idx, price: newPrice, change: newPrice - (idx.price - idx.change), change_pct: ((newPrice - (idx.price - idx.change)) / (idx.price - idx.change)) * 100, timestamp: Date.now() };
      });
      dispatch({ type: 'UPDATE_INDICES', indices: updatedIndices });

      const quotesArr = Array.from(state.quotes.values()).map(q => {
        const delta = q.price * (Math.random() - 0.499) * 0.0015;
        const newPrice = Math.max(0.01, q.price + delta);
        return { ...q, price: newPrice, change: newPrice - q.prev_close, change_pct: ((newPrice - q.prev_close) / q.prev_close) * 100, timestamp: Date.now() };
      });
      dispatch({ type: 'UPDATE_QUOTES', quotes: quotesArr });
    }, 1000);
    return () => clearInterval(interval);
  }, [simulateRealtime]);

  return (
    <MarketContext.Provider value={{ state, dispatch }}>
      {children}
    </MarketContext.Provider>
  );
};

// ─── Convenience Hooks ────────────────────────────────────────────────────────

export function useQuote(ticker: string): Quote | undefined {
  const { state } = useMarketStore();
  return state.quotes.get(ticker);
}

export function useIndices() {
  return useMarketStore().state.indices;
}

export function useSectors() {
  return useMarketStore().state.sectors;
}

export function useMarketBreadth() {
  return useMarketStore().state.breadth;
}

export function useMarketStatus() {
  return useMarketStore().state.marketStatus;
}

export function useWatchlistQuotes() {
  const { state } = useMarketStore();
  return state.watchlist.map(t => state.quotes.get(t)).filter(Boolean) as Quote[];
}

export default MarketProvider;
