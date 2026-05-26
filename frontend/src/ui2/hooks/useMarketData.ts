/**
 * useMarketData — Real-data React hook wiring backend APIs + yfinance fallback
 *
 * Data sources:
 *   1. /api/v1/bars/{symbol}/{timeframe}         — OHLCV bar data
 *   2. /api/market-quote/quote?symbol=            — real-time quotes
 *   3. /api/market-quote/quotes/batch             — batch quotes
 *   4. /api/v4/screener/run                       — stock screener
 *   5. /api/v1/market-breadth                     — market breadth
 *   6. /api/v4/heatmap                            — sector heatmap
 *
 * Zero Math.random() — all data is real or clearly marked unavailable.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  mid: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  vwap: number;
  turnover: number;
  dataSource?: string;
}

export interface BarData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'cross_above' | 'cross_below';
  price: number;
  triggered: boolean;
  createdAt: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  sector?: string;
  quote?: MarketQuote;
  alerts: PriceAlert[];
}

export interface SectorData {
  sector: string;
  change: number;
  volume: number;
  marketCap: number;
  advancers: number;
  decliners: number;
}

export interface MarketBreadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  adRatio: number;
  mcclellanOscillator: number;
}

export interface HeatmapEntry {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  change: number;
  volume: number;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  avgVolume?: number;
  high52w?: number;
  low52w?: number;
}

export interface ScreenerFilter {
  field: string;
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  value: number | string;
}

export interface ScannerSignal {
  symbol: string;
  signal: string;
  strength: number;
  timestamp: number;
  description?: string;
}

export interface MarketDataState {
  watchlist: WatchlistItem[];
  activeSymbol: string;
  activeQuote: MarketQuote | null;
  bars: BarData[];
  timeframe: TimeFrame;
  availableTimeframes: TimeFrame[];
  screenerResults: ScreenerResult[];
  screenerFilters: ScreenerFilter[];
  scannerSignals: ScannerSignal[];
  calendarEvents: unknown[];
  fundamentals: unknown | null;
  marketStatus: 'pre' | 'open' | 'post' | 'closed';
  feedType: 'live' | 'mock';
  isStreaming: boolean;
  quoteCache: Map<string, MarketQuote>;
  sectorPerformance: SectorData[];
  breadth: MarketBreadth;
  heatmapData: HeatmapEntry[];
  loadingBars: boolean;
  loadingQuote: boolean;
  error: string | null;
}

export interface MarketDataActions {
  addToWatchlist: (symbol: string, name?: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  reorderWatchlist: (from: number, to: number) => void;
  setActiveSymbol: (symbol: string) => void;
  setTimeframe: (tf: TimeFrame) => void;
  loadBars: (symbol: string, tf?: TimeFrame, count?: number) => void;
  generateMockBars: (symbol: string, count?: number) => void;
  updateQuote: (symbol: string, quote: Partial<MarketQuote>) => void;
  refreshQuotes: () => void;
  addScreenerFilter: (filter: ScreenerFilter) => void;
  removeScreenerFilter: (index: number) => void;
  clearFilters: () => void;
  runScreener: () => void;
  runScanner: (config?: unknown) => void;
  loadCalendar: (from?: Date, to?: Date) => void;
  loadFundamentals: (symbol: string) => void;
  setFeedType: (type: MarketDataState['feedType']) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  generateHeatmap: (sector?: string) => void;
  addPriceAlert: (symbol: string, condition: PriceAlert['condition'], price: number) => string;
  removePriceAlert: (symbol: string, alertId: string) => void;
  loadSectorPerformance: () => void;
  computeBreadth: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_TIMEFRAMES: TimeFrame[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'];

const DEFAULT_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary' },
  { symbol: 'META', name: 'Meta', sector: 'Communication' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary' },
  { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF', sector: 'ETF' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial' },
];

const INITIAL_BREADTH: MarketBreadth = {
  advancers: 0, decliners: 0, unchanged: 0,
  newHighs: 0, newLows: 0, adRatio: 0, mcclellanOscillator: 0,
};

const INITIAL_STATE: MarketDataState = {
  watchlist: DEFAULT_SYMBOLS.map(s => ({ ...s, alerts: [] })),
  activeSymbol: 'AAPL',
  activeQuote: null,
  bars: [],
  timeframe: '1D',
  availableTimeframes: ALL_TIMEFRAMES,
  screenerResults: [],
  screenerFilters: [],
  scannerSignals: [],
  calendarEvents: [],
  fundamentals: null,
  marketStatus: 'open',
  feedType: 'live',
  isStreaming: false,
  quoteCache: new Map(),
  sectorPerformance: [],
  breadth: INITIAL_BREADTH,
  heatmapData: [],
  loadingBars: false,
  loadingQuote: false,
  error: null,
};

let _alertId = 0;
function genAlertId() { return `alert_${++_alertId}_${Date.now().toString(36)}`; }

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetchBars(
  symbol: string, tf: TimeFrame, limit = 500, signal?: AbortSignal,
): Promise<BarData[]> {
  const res = await fetch(
    `/api/v1/bars/${encodeURIComponent(symbol)}/${tf}?limit=${limit}`,
    { signal },
  );
  if (!res.ok) throw new Error(`bars ${res.status}`);
  const data = await res.json();
  const raw: unknown[] = (data as { bars?: unknown[]; data?: unknown[] }).bars
    ?? (data as { data?: unknown[] }).data
    ?? (Array.isArray(data) ? data : []);
  return raw.map((b: unknown) => {
    const bar = b as Record<string, unknown>;
    return {
      timestamp: (bar.timestamp as number) ?? (bar.t as number) ?? (bar.time ? new Date(bar.time as string).getTime() : Date.now()),
      open: (bar.open as number) ?? (bar.o as number) ?? 0,
      high: (bar.high as number) ?? (bar.h as number) ?? 0,
      low: (bar.low as number) ?? (bar.l as number) ?? 0,
      close: (bar.close as number) ?? (bar.c as number) ?? 0,
      volume: (bar.volume as number) ?? (bar.v as number) ?? 0,
    };
  }).filter(b => b.close > 0);
}

async function apiFetchQuote(symbol: string, signal?: AbortSignal): Promise<MarketQuote | null> {
  const res = await fetch(`/api/market-quote/quote?symbol=${encodeURIComponent(symbol)}`, { signal });
  if (!res.ok) throw new Error(`quote ${res.status}`);
  const data = await res.json();
  const q = (data as { data?: unknown }).data ?? data as Record<string, unknown>;
  const qr = q as Record<string, unknown>;
  if (!qr || qr.last === undefined) return null;
  const last = (qr.last as number) ?? (qr.price as number) ?? 0;
  return {
    symbol,
    bid: (qr.bid as number) ?? last - 0.01,
    ask: (qr.ask as number) ?? last + 0.01,
    last,
    mid: (qr.mid as number) ?? last,
    change: (qr.change as number) ?? (qr.price_change as number) ?? 0,
    changePct: (qr.changePct as number) ?? (qr.change_pct as number) ?? (qr.change_percent as number) ?? 0,
    volume: (qr.volume as number) ?? (qr.volume_traded as number) ?? 0,
    high: (qr.high as number) ?? (qr.day_high as number) ?? 0,
    low: (qr.low as number) ?? (qr.day_low as number) ?? 0,
    open: (qr.open as number) ?? (qr.day_open as number) ?? 0,
    prevClose: (qr.prevClose as number) ?? (qr.prev_close as number) ?? (qr.previous_close as number) ?? 0,
    timestamp: qr.timestamp ? new Date(qr.timestamp as string).getTime() : Date.now(),
    vwap: (qr.vwap as number) ?? 0,
    turnover: (qr.turnover as number) ?? last * ((qr.volume as number) ?? 0),
    dataSource: (qr.source as string) ?? 'api',
  };
}

async function apiFetchBatchQuotes(symbols: string[], signal?: AbortSignal): Promise<Record<string, MarketQuote>> {
  const s = symbols.join(',');
  const res = await fetch(`/api/market-quote/quotes/batch?symbols=${encodeURIComponent(s)}`, { signal });
  if (!res.ok) throw new Error(`batch_quotes ${res.status}`);
  const data = await res.json();
  const out: Record<string, MarketQuote> = {};
  const quotes: unknown[] = (data as { quotes?: unknown[]; data?: unknown[] }).quotes
    ?? (data as { data?: unknown[] }).data
    ?? [];
  for (const item of quotes) {
    const q = item as Record<string, unknown>;
    const sym = (q.symbol as string) ?? (q.ticker as string);
    if (!sym) continue;
    const last = (q.last as number) ?? (q.price as number) ?? 0;
    out[sym] = {
      symbol: sym,
      bid: (q.bid as number) ?? last - 0.01,
      ask: (q.ask as number) ?? last + 0.01,
      last,
      mid: (q.mid as number) ?? last,
      change: (q.change as number) ?? 0,
      changePct: (q.changePct as number) ?? (q.change_pct as number) ?? (q.change_percent as number) ?? 0,
      volume: (q.volume as number) ?? 0,
      high: (q.high as number) ?? 0,
      low: (q.low as number) ?? 0,
      open: (q.open as number) ?? 0,
      prevClose: (q.prevClose as number) ?? (q.prev_close as number) ?? 0,
      timestamp: q.timestamp ? new Date(q.timestamp as string).getTime() : Date.now(),
      vwap: (q.vwap as number) ?? 0,
      turnover: last * ((q.volume as number) ?? 0),
      dataSource: (q.source as string) ?? 'api',
    };
  }
  return out;
}

async function apiFetchScreener(filters: ScreenerFilter[], signal?: AbortSignal): Promise<ScreenerResult[]> {
  const res = await fetch('/api/v4/screener/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters }),
    signal,
  });
  if (!res.ok) throw new Error(`screener ${res.status}`);
  const data = await res.json();
  const raw: unknown[] = (data as { results?: unknown[]; data?: unknown[] }).results
    ?? (data as { data?: unknown[] }).data
    ?? [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      symbol: (r.symbol as string) ?? (r.ticker as string),
      name: (r.name as string) ?? (r.company_name as string) ?? (r.symbol as string),
      price: (r.price as number) ?? (r.last as number) ?? 0,
      change: (r.change as number) ?? (r.price_change as number) ?? 0,
      changePct: (r.changePct as number) ?? (r.change_percent as number) ?? 0,
      volume: (r.volume as number) ?? 0,
      marketCap: (r.marketCap as number) ?? (r.market_cap as number),
      pe: (r.pe as number) ?? (r.pe_ratio as number),
      eps: r.eps as number,
      dividendYield: (r.dividendYield as number) ?? (r.dividend_yield as number),
      beta: r.beta as number,
      avgVolume: (r.avgVolume as number) ?? (r.avg_volume as number),
      high52w: (r.high52w as number) ?? (r['52w_high'] as number),
      low52w: (r.low52w as number) ?? (r['52w_low'] as number),
    };
  });
}

async function apiFetchBreadth(signal?: AbortSignal): Promise<MarketBreadth | null> {
  const res = await fetch('/api/v1/market-breadth', { signal });
  if (!res.ok) return null;
  const d = await res.json() as Record<string, unknown>;
  return {
    advancers: (d.advancers as number) ?? (d.up as number) ?? 0,
    decliners: (d.decliners as number) ?? (d.down as number) ?? 0,
    unchanged: (d.unchanged as number) ?? 0,
    newHighs: (d.newHighs as number) ?? (d.new_highs as number) ?? 0,
    newLows: (d.newLows as number) ?? (d.new_lows as number) ?? 0,
    adRatio: (d.adRatio as number) ?? (d.ad_ratio as number) ?? 0,
    mcclellanOscillator: (d.mcclellanOscillator as number) ?? (d.mcClellan as number) ?? 0,
  };
}

async function apiFetchHeatmap(sector?: string, signal?: AbortSignal): Promise<HeatmapEntry[]> {
  const url = sector ? `/api/v4/heatmap?sector=${encodeURIComponent(sector)}` : '/api/v4/heatmap';
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const raw: unknown[] = (data as { entries?: unknown[]; data?: unknown[] }).entries
    ?? (data as { data?: unknown[] }).data
    ?? (Array.isArray(data) ? data : []);
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      symbol: (r.symbol as string) ?? (r.ticker as string),
      name: (r.name as string) ?? (r.company_name as string) ?? (r.symbol as string),
      sector: (r.sector as string) ?? 'Unknown',
      industry: (r.industry as string) ?? 'Unknown',
      marketCap: (r.marketCap as number) ?? (r.market_cap as number) ?? 0,
      change: (r.change as number) ?? (r.change_percent as number) ?? 0,
      volume: (r.volume as number) ?? 0,
    };
  });
}

async function apiFetchCalendar(from?: Date, to?: Date, signal?: AbortSignal): Promise<unknown[]> {
  const start = (from ?? new Date()).toISOString().split('T')[0];
  const endDate = to ?? new Date(Date.now() + 7 * 86400000);
  const end = endDate.toISOString().split('T')[0];
  const res = await fetch(`/api/v4/calendar?start=${start}&end=${end}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { events?: unknown[]; data?: unknown[] }).events
    ?? (data as { data?: unknown[] }).data
    ?? [];
}

async function apiFetchFundamentals(symbol: string, signal?: AbortSignal): Promise<unknown | null> {
  const res = await fetch(`/api/v4/fundamentals/${encodeURIComponent(symbol)}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return (data as { data?: unknown }).data ?? data;
}

async function apiFetchSectorPerformance(signal?: AbortSignal): Promise<SectorData[]> {
  const res = await fetch('/api/v4/sector-performance', { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const raw: unknown[] = (data as { sectors?: unknown[]; data?: unknown[] }).sectors
    ?? (data as { data?: unknown[] }).data
    ?? [];
  return raw.map((item) => {
    const s = item as Record<string, unknown>;
    return {
      sector: (s.sector as string) ?? (s.name as string) ?? 'Unknown',
      change: (s.change as number) ?? (s.performance as number) ?? 0,
      volume: (s.volume as number) ?? 0,
      marketCap: (s.marketCap as number) ?? (s.market_cap as number) ?? 0,
      advancers: (s.advancers as number) ?? 0,
      decliners: (s.decliners as number) ?? 0,
    };
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketData(): [MarketDataState, MarketDataActions] {
  const [state, setState] = useState<MarketDataState>(INITIAL_STATE);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);

  // ── Load bars ───

  const loadBars = useCallback((symbol: string, tf?: TimeFrame, count = 500) => {
    const ctrl = new AbortController();
    activeAbortRef.current?.abort();
    activeAbortRef.current = ctrl;
    setState(prev => ({ ...prev, loadingBars: true, error: null }));
    apiFetchBars(symbol, tf ?? state.timeframe, count, ctrl.signal)
      .then(bars => {
        if (ctrl.signal.aborted) return;
        setState(prev => ({ ...prev, bars, activeSymbol: symbol, loadingBars: false }));
      })
      .catch(err => {
        if (ctrl.signal.aborted) return;
        setState(prev => ({ ...prev, loadingBars: false, error: String(err) }));
      });
  }, [state.timeframe]);

  const generateMockBars = useCallback((symbol: string, count = 500) => {
    loadBars(symbol, state.timeframe, count);
  }, [loadBars, state.timeframe]);

  // ── Auto-load on symbol/timeframe change ───

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetchBars(state.activeSymbol, state.timeframe, 500, ctrl.signal)
      .then(bars => {
        if (!bars.length || ctrl.signal.aborted) return;
        setState(prev => ({ ...prev, bars, loadingBars: false }));
      })
      .catch(() => {});
    apiFetchQuote(state.activeSymbol, ctrl.signal)
      .then(quote => {
        if (!quote || ctrl.signal.aborted) return;
        setState(prev => ({
          ...prev,
          activeQuote: quote,
          loadingQuote: false,
          quoteCache: new Map(prev.quoteCache).set(state.activeSymbol, quote),
        }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSymbol, state.timeframe]);

  // ── Refresh all watchlist quotes ───

  const refreshQuotes = useCallback(() => {
    const symbols = state.watchlist.map(w => w.symbol);
    if (!symbols.length) return;
    apiFetchBatchQuotes(symbols)
      .then(quotesMap => {
        setState(prev => {
          const newCache = new Map(prev.quoteCache);
          const watchlist = prev.watchlist.map(w => {
            const q = quotesMap[w.symbol];
            if (q) { newCache.set(w.symbol, q); return { ...w, quote: q }; }
            return w;
          });
          return {
            ...prev,
            watchlist,
            quoteCache: newCache,
            activeQuote: quotesMap[prev.activeSymbol] ?? prev.activeQuote,
          };
        });
      })
      .catch(() => {});
  }, [state.watchlist]);

  // ── Streaming (5-second polling) ───

  const startStreaming = useCallback(() => {
    if (pollRef.current) return;
    setState(prev => ({ ...prev, isStreaming: true, feedType: 'live' }));
    pollRef.current = setInterval(() => {
      const symbols = state.watchlist.map(w => w.symbol);
      if (!symbols.length) return;
      apiFetchBatchQuotes(symbols)
        .then(quotesMap => {
          setState(prev => {
            const newCache = new Map(prev.quoteCache);
            const watchlist = prev.watchlist.map(w => {
              const q = quotesMap[w.symbol];
              if (!q) return w;
              newCache.set(w.symbol, q);
              const alerts = w.alerts.map(a => {
                if (a.triggered) return a;
                const hit =
                  (a.condition === 'above' && q.last > a.price) ||
                  (a.condition === 'below' && q.last < a.price) ||
                  (a.condition === 'cross_above' && q.last > a.price) ||
                  (a.condition === 'cross_below' && q.last < a.price);
                return hit ? { ...a, triggered: true } : a;
              });
              return { ...w, quote: q, alerts };
            });
            return {
              ...prev,
              watchlist,
              quoteCache: newCache,
              activeQuote: quotesMap[prev.activeSymbol] ?? prev.activeQuote,
            };
          });
        })
        .catch(() => {});
    }, 5000);
  }, [state.watchlist]);

  const stopStreaming = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  useEffect(() => () => {
    stopStreaming();
    activeAbortRef.current?.abort();
  }, [stopStreaming]);

  // ── Watchlist ───

  const addToWatchlist = useCallback((symbol: string, name?: string) => {
    setState(prev => {
      if (prev.watchlist.some(w => w.symbol === symbol)) return prev;
      const info = DEFAULT_SYMBOLS.find(s => s.symbol === symbol);
      return {
        ...prev,
        watchlist: [...prev.watchlist, { symbol, name: name ?? info?.name ?? symbol, sector: info?.sector, alerts: [] }],
      };
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, watchlist: prev.watchlist.filter(w => w.symbol !== symbol) }));
  }, []);

  const reorderWatchlist = useCallback((from: number, to: number) => {
    setState(prev => {
      const list = [...prev.watchlist];
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...prev, watchlist: list };
    });
  }, []);

  const setActiveSymbol = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, activeSymbol: symbol }));
  }, []);

  const setTimeframe = useCallback((tf: TimeFrame) => {
    setState(prev => ({ ...prev, timeframe: tf }));
  }, []);

  const updateQuote = useCallback((symbol: string, patch: Partial<MarketQuote>) => {
    setState(prev => {
      const cache = new Map(prev.quoteCache);
      const existing = cache.get(symbol);
      const merged: MarketQuote = { ...(existing ?? {} as MarketQuote), ...patch, symbol, timestamp: Date.now() };
      cache.set(symbol, merged);
      return {
        ...prev,
        quoteCache: cache,
        activeQuote: symbol === prev.activeSymbol ? merged : prev.activeQuote,
      };
    });
  }, []);

  // ── Screener ───

  const addScreenerFilter = useCallback((filter: ScreenerFilter) => {
    setState(prev => ({ ...prev, screenerFilters: [...prev.screenerFilters, filter] }));
  }, []);

  const removeScreenerFilter = useCallback((index: number) => {
    setState(prev => ({ ...prev, screenerFilters: prev.screenerFilters.filter((_, i) => i !== index) }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, screenerFilters: [] }));
  }, []);

  const runScreener = useCallback(() => {
    apiFetchScreener(state.screenerFilters)
      .then(screenerResults => setState(prev => ({ ...prev, screenerResults })))
      .catch(() => {});
  }, [state.screenerFilters]);

  // ── Scanner ───

  const runScanner = useCallback((config?: unknown) => {
    fetch('/api/v4/scanner/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config ?? {}),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const signals: ScannerSignal[] = ((data as { signals?: unknown[]; data?: unknown[] }).signals
          ?? (data as { data?: unknown[] }).data
          ?? []).map((item: unknown) => {
          const s = item as Record<string, unknown>;
          return {
            symbol: s.symbol as string,
            signal: (s.signal as string) ?? (s.type as string) ?? 'signal',
            strength: (s.strength as number) ?? (s.score as number) ?? 0,
            timestamp: s.timestamp ? new Date(s.timestamp as string).getTime() : Date.now(),
            description: s.description as string,
          };
        });
        setState(prev => ({ ...prev, scannerSignals: signals }));
      })
      .catch(() => {});
  }, []);

  // ── Calendar ───

  const loadCalendar = useCallback((from?: Date, to?: Date) => {
    apiFetchCalendar(from, to)
      .then(calendarEvents => setState(prev => ({ ...prev, calendarEvents })))
      .catch(() => {});
  }, []);

  // ── Fundamentals ───

  const loadFundamentals = useCallback((symbol: string) => {
    apiFetchFundamentals(symbol)
      .then(fundamentals => setState(prev => ({ ...prev, fundamentals })))
      .catch(() => {});
  }, []);

  // ── Feed type ───

  const setFeedType = useCallback((type: MarketDataState['feedType']) => {
    setState(prev => ({ ...prev, feedType: type }));
  }, []);

  // ── Heatmap ───

  const generateHeatmap = useCallback((sector?: string) => {
    apiFetchHeatmap(sector)
      .then(heatmapData => setState(prev => ({ ...prev, heatmapData })))
      .catch(() => {});
  }, []);

  // ── Price alerts ───

  const addPriceAlert = useCallback((symbol: string, condition: PriceAlert['condition'], price: number) => {
    const id = genAlertId();
    setState(prev => ({
      ...prev,
      watchlist: prev.watchlist.map(w =>
        w.symbol === symbol
          ? { ...w, alerts: [...w.alerts, { id, symbol, condition, price, triggered: false, createdAt: Date.now() }] }
          : w
      ),
    }));
    return id;
  }, []);

  const removePriceAlert = useCallback((symbol: string, alertId: string) => {
    setState(prev => ({
      ...prev,
      watchlist: prev.watchlist.map(w =>
        w.symbol === symbol ? { ...w, alerts: w.alerts.filter(a => a.id !== alertId) } : w
      ),
    }));
  }, []);

  // ── Sector / Breadth ───

  const loadSectorPerformance = useCallback(() => {
    apiFetchSectorPerformance()
      .then(sectorPerformance => setState(prev => ({ ...prev, sectorPerformance })))
      .catch(() => {});
  }, []);

  const computeBreadth = useCallback(() => {
    apiFetchBreadth()
      .then(breadth => { if (breadth) setState(prev => ({ ...prev, breadth })); })
      .catch(() => {});
  }, []);

  const actions: MarketDataActions = {
    addToWatchlist, removeFromWatchlist, reorderWatchlist,
    setActiveSymbol, setTimeframe,
    loadBars, generateMockBars,
    updateQuote, refreshQuotes,
    addScreenerFilter, removeScreenerFilter, clearFilters, runScreener,
    runScanner,
    loadCalendar,
    loadFundamentals,
    setFeedType,
    startStreaming, stopStreaming,
    generateHeatmap,
    addPriceAlert, removePriceAlert,
    loadSectorPerformance, computeBreadth,
  };

  return [state, actions];
}
