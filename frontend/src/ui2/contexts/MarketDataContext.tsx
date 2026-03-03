/**
 * MarketDataContext — React context providing real-time market data
 * to all descendant components via useMarketDataContext().
 */
import React, { createContext, useContext, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getMarketDataService } from '@/ui2/services/MarketDataService';
import type { Bar, Tick, Quote, Timeframe, MarketStatus } from '@/ui2/services/MarketDataService';

// ── State ────────────────────────────────────────────────────────────────────

export interface MarketDataContextState {
  quotes: Map<string, Quote>;
  bars: Map<string, Bar[]>;
  ticks: Map<string, Tick[]>;
  watchlist: string[];
  activeSymbol: string;
  activeTimeframe: Timeframe;
  marketStatus: MarketStatus;
  isStreaming: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdate: number;
}

export interface MarketDataContextActions {
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  setActiveSymbol: (symbol: string) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  getHistoricalBars: (symbol: string, tf: Timeframe, count?: number) => Bar[];
  startStreaming: () => void;
  stopStreaming: () => void;
  getLatestQuote: (symbol: string) => Quote | undefined;
  getLatestPrice: (symbol: string) => number;
}

type Ctx = [MarketDataContextState, MarketDataContextActions];

const MarketDataCtx = createContext<Ctx | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY', 'QQQ', 'IWM'];

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const service = useRef(getMarketDataService());
  const unsubs = useRef<Map<string, string>>(new Map());

  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [bars, setBars] = useState<Map<string, Bar[]>>(new Map());
  const [ticks, setTicks] = useState<Map<string, Tick[]>>(new Map());
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [activeSymbol, setActiveSymbolState] = useState('AAPL');
  const [activeTimeframe, setActiveTimeframeState] = useState<Timeframe>('1m');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const marketStatus = useMemo(() => service.current.getMarketStatus(), []);

  const subscribe = useCallback((symbol: string) => {
    if (unsubs.current.has(symbol)) return;
    const subId = service.current.subscribeTick(symbol, (tick) => {
      const t = tick as Tick;
      setQuotes(prev => {
        const next = new Map(prev);
        const existing = next.get(t.symbol);
        next.set(t.symbol, {
          symbol: t.symbol,
          bid: t.price - 0.01,
          bidSize: 100,
          ask: t.price + 0.01,
          askSize: 100,
          last: t.price,
          lastSize: t.size,
          volume: (existing?.volume || 0) + t.size,
          timestamp: t.timestamp,
        });
        return next;
      });
      setTicks(prev => {
        const next = new Map(prev);
        const arr = next.get(t.symbol) || [];
        next.set(t.symbol, [...arr.slice(-200), t]);
        return next;
      });
      setLastUpdate(Date.now());
    });
    unsubs.current.set(symbol, subId);
    setConnectionStatus('connected');
    setIsStreaming(true);
  }, []);

  const unsubscribe = useCallback((symbol: string) => {
    const subId = unsubs.current.get(symbol);
    if (subId) {
      service.current.unsubscribe(subId);
      unsubs.current.delete(symbol);
    }
  }, []);

  const setActiveSymbol = useCallback((symbol: string) => {
    setActiveSymbolState(symbol);
    // Load historical bars when symbol changes
    const hist = service.current.getHistoricalBars(symbol, activeTimeframe, 300);
    setBars(prev => {
      const next = new Map(prev);
      next.set(`${symbol}_${activeTimeframe}`, hist);
      return next;
    });
  }, [activeTimeframe]);

  const setActiveTimeframe = useCallback((tf: Timeframe) => {
    setActiveTimeframeState(tf);
    const hist = service.current.getHistoricalBars(activeSymbol, tf, 300);
    setBars(prev => {
      const next = new Map(prev);
      next.set(`${activeSymbol}_${tf}`, hist);
      return next;
    });
  }, [activeSymbol]);

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.includes(symbol) ? prev : [...prev, symbol]);
    subscribe(symbol);
  }, [subscribe]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    unsubscribe(symbol);
  }, [unsubscribe]);

  const getHistoricalBars = useCallback((symbol: string, tf: Timeframe, count = 300): Bar[] => {
    return service.current.getHistoricalBars(symbol, tf, count);
  }, []);

  const startStreaming = useCallback(() => {
    watchlist.forEach(sym => subscribe(sym));
    setIsStreaming(true);
  }, [watchlist, subscribe]);

  const stopStreaming = useCallback(() => {
    unsubs.current.forEach((subId) => {
      service.current.unsubscribe(subId);
    });
    unsubs.current.clear();
    setIsStreaming(false);
    setConnectionStatus('disconnected');
  }, []);

  const getLatestQuote = useCallback((symbol: string): Quote | undefined => {
    return quotes.get(symbol);
  }, [quotes]);

  const getLatestPrice = useCallback((symbol: string): number => {
    return quotes.get(symbol)?.last || 0;
  }, [quotes]);

  // Auto-subscribe watchlist on mount
  useEffect(() => {
    watchlist.forEach(sym => subscribe(sym));
    // Load initial bars
    const hist = service.current.getHistoricalBars(activeSymbol, activeTimeframe, 300);
    setBars(prev => {
      const next = new Map(prev);
      next.set(`${activeSymbol}_${activeTimeframe}`, hist);
      return next;
    });

    return () => stopStreaming();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const state: MarketDataContextState = {
    quotes, bars, ticks, watchlist, activeSymbol, activeTimeframe,
    marketStatus, isStreaming, connectionStatus, lastUpdate,
  };

  const actions: MarketDataContextActions = useMemo(() => ({
    subscribe, unsubscribe, setActiveSymbol, setActiveTimeframe,
    addToWatchlist, removeFromWatchlist, getHistoricalBars,
    startStreaming, stopStreaming, getLatestQuote, getLatestPrice,
  }), [subscribe, unsubscribe, setActiveSymbol, setActiveTimeframe,
       addToWatchlist, removeFromWatchlist, getHistoricalBars,
       startStreaming, stopStreaming, getLatestQuote, getLatestPrice]);

  return React.createElement(MarketDataCtx.Provider, { value: [state, actions] as Ctx }, children);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketDataContext(): Ctx {
  const ctx = useContext(MarketDataCtx);
  if (!ctx) throw new Error('useMarketDataContext must be used within MarketDataProvider');
  return ctx;
}

export default MarketDataProvider;
