/**
 * useMarketData.ts
 * Real-time market data subscription hook with WebSocket auto-reconnect,
 * configurable throttling, quote cache with TTL, multi-symbol support,
 * Level 1/Level 2 data, trade tape streaming, connection status tracking,
 * and automatic fallback to REST polling when WebSocket is unavailable.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'polling';

export interface Level1Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  bidSize: number;
  askSize: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  vwap: number;
  timestamp: number;
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
  timestamp: number;
  spread: number;
  spreadPct: number;
}

export interface TradeTick {
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  exchange?: string;
  conditions?: string[];
  timestamp: number;
  id: string;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface MarketDataSubscription {
  symbol: string;
  channels: Set<'level1' | 'level2' | 'trades'>;
}

export interface UseMarketDataOptions {
  wsUrl?: string;
  pollUrl?: string;
  pollIntervalMs?: number;
  throttleMs?: number;
  cacheTtlMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseMs?: number;
  maxTradeTapeSize?: number;
  enablePollingFallback?: boolean;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
}

export interface MarketDataState {
  quotes: Map<string, Level1Quote>;
  level2: Map<string, Level2Data>;
  tradeTape: Map<string, TradeTick[]>;
  connectionStatus: ConnectionStatus;
  subscribedSymbols: string[];
  lastUpdate: number | null;
  error: string | null;
  latencyMs: number | null;
}

// ─── Quote Cache ───────────────────────────────────────────────────────────────

class QuoteCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}

// ─── Throttle Utility ──────────────────────────────────────────────────────────

function createThrottle<T>(intervalMs: number, callback: (data: T) => void) {
  let lastCall = 0;
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    push(data: T) {
      const now = Date.now();
      if (now - lastCall >= intervalMs) {
        lastCall = now;
        callback(data);
      } else {
        pending = data;
        if (!timer) {
          timer = setTimeout(() => {
            if (pending !== null) {
              lastCall = Date.now();
              callback(pending);
              pending = null;
            }
            timer = null;
          }, intervalMs - (now - lastCall));
        }
      }
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMarketData(options: UseMarketDataOptions = {}) {
  const {
    wsUrl = 'wss://stream.example.com/market',
    pollUrl = '/api/market/quotes',
    pollIntervalMs = 3000,
    throttleMs = 100,
    cacheTtlMs = 30000,
    maxReconnectAttempts = 15,
    reconnectBaseMs = 1000,
    maxTradeTapeSize = 200,
    enablePollingFallback = true,
    onConnectionChange,
    onError,
  } = options;

  const [state, setState] = useState<MarketDataState>({
    quotes: new Map(),
    level2: new Map(),
    tradeTape: new Map(),
    connectionStatus: 'disconnected',
    subscribedSymbols: [],
    lastUpdate: null,
    error: null,
    latencyMs: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Map<string, MarketDataSubscription>>(new Map());
  const cacheRef = useRef(new QuoteCache<Level1Quote>());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const pingTimestampRef = useRef<number>(0);

  const throttledUpdate = useRef(createThrottle<Partial<MarketDataState>>(throttleMs, (update) => {
    if (!unmountedRef.current) {
      setState(prev => ({ ...prev, ...update, lastUpdate: Date.now() }));
    }
  }));

  const setStatus = useCallback((status: ConnectionStatus) => {
    setState(prev => ({ ...prev, connectionStatus: status }));
    onConnectionChange?.(status);
  }, [onConnectionChange]);

  // ── WebSocket Connection ──

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        stopPolling();
        for (const sub of subscriptionsRef.current.values()) {
          ws.send(JSON.stringify({
            action: 'subscribe',
            symbol: sub.symbol,
            channels: Array.from(sub.channels),
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch { /* malformed message */ }
      };

      ws.onclose = (event) => {
        if (unmountedRef.current) return;
        if (event.code !== 1000 && reconnectAttemptRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else if (enablePollingFallback) {
          startPolling();
        } else {
          setStatus('disconnected');
        }
      };

      ws.onerror = () => {
        const errMsg = 'WebSocket connection error';
        setState(prev => ({ ...prev, error: errMsg }));
        onError?.(errMsg);
      };
    } catch (err) {
      const errMsg = `Failed to connect: ${err}`;
      setState(prev => ({ ...prev, error: errMsg }));
      onError?.(errMsg);
      if (enablePollingFallback) startPolling();
    }
  }, [wsUrl, maxReconnectAttempts, enablePollingFallback, onError]);

  const scheduleReconnect = useCallback(() => {
    setStatus('reconnecting');
    const delay = Math.min(reconnectBaseMs * Math.pow(2, reconnectAttemptRef.current), 30000);
    reconnectAttemptRef.current++;
    reconnectTimerRef.current = setTimeout(connect, delay);
  }, [connect, reconnectBaseMs]);

  // ── Message Handling ──

  const handleMessage = useCallback((msg: any) => {
    const now = Date.now();

    if (msg.type === 'pong') {
      setState(prev => ({ ...prev, latencyMs: now - pingTimestampRef.current }));
      return;
    }

    if (msg.type === 'quote' || msg.type === 'level1') {
      const quote: Level1Quote = {
        symbol: msg.symbol,
        bid: msg.bid ?? 0, ask: msg.ask ?? 0, last: msg.last ?? 0,
        bidSize: msg.bidSize ?? 0, askSize: msg.askSize ?? 0,
        volume: msg.volume ?? 0, open: msg.open ?? 0,
        high: msg.high ?? 0, low: msg.low ?? 0, close: msg.close ?? 0,
        change: msg.change ?? 0, changePct: msg.changePct ?? 0,
        vwap: msg.vwap ?? 0, timestamp: msg.timestamp ?? now,
      };
      cacheRef.current.set(msg.symbol, quote, cacheTtlMs);
      throttledUpdate.current.push({
        quotes: new Map(setState.length ? state.quotes : new Map()).set(msg.symbol, quote),
      });
      setState(prev => {
        const next = new Map(prev.quotes);
        next.set(msg.symbol, quote);
        return { ...prev, quotes: next, lastUpdate: now };
      });
    }

    if (msg.type === 'level2' || msg.type === 'book') {
      const bids: Level2Entry[] = (msg.bids ?? []).map((b: any) => ({ price: b.price, size: b.size, orders: b.orders ?? 1, exchange: b.exchange }));
      const asks: Level2Entry[] = (msg.asks ?? []).map((a: any) => ({ price: a.price, size: a.size, orders: a.orders ?? 1, exchange: a.exchange }));
      const bestBid = bids[0]?.price ?? 0;
      const bestAsk = asks[0]?.price ?? 0;
      const l2: Level2Data = {
        symbol: msg.symbol, bids, asks, timestamp: msg.timestamp ?? now,
        spread: bestAsk - bestBid,
        spreadPct: bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
      };
      setState(prev => {
        const next = new Map(prev.level2);
        next.set(msg.symbol, l2);
        return { ...prev, level2: next, lastUpdate: now };
      });
    }

    if (msg.type === 'trade') {
      const tick: TradeTick = {
        symbol: msg.symbol, price: msg.price, size: msg.size,
        side: msg.side ?? 'unknown', exchange: msg.exchange,
        conditions: msg.conditions, timestamp: msg.timestamp ?? now,
        id: `${msg.symbol}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setState(prev => {
        const tapeMap = new Map(prev.tradeTape);
        const tape = [...(tapeMap.get(msg.symbol) ?? []), tick];
        tapeMap.set(msg.symbol, tape.slice(-maxTradeTapeSize));
        return { ...prev, tradeTape: tapeMap, lastUpdate: now };
      });
    }
  }, [cacheTtlMs, maxTradeTapeSize]);

  // ── Polling Fallback ──

  const startPolling = useCallback(() => {
    setStatus('polling');
    if (pollTimerRef.current) return;

    const poll = async () => {
      const symbols = Array.from(subscriptionsRef.current.keys());
      if (symbols.length === 0) return;
      try {
        const res = await fetch(`${pollUrl}?symbols=${symbols.join(',')}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((q: any) => handleMessage({ ...q, type: 'quote' }));
        }
      } catch (err) {
        onError?.(`Polling error: ${err}`);
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, pollIntervalMs);
  }, [pollUrl, pollIntervalMs, handleMessage, onError]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── Public API ──

  const subscribe = useCallback((symbols: string | string[], channels: ('level1' | 'level2' | 'trades')[] = ['level1']) => {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];
    const channelSet = new Set(channels);

    symbolList.forEach(symbol => {
      const existing = subscriptionsRef.current.get(symbol);
      if (existing) {
        channels.forEach(ch => existing.channels.add(ch));
      } else {
        subscriptionsRef.current.set(symbol, { symbol, channels: new Set(channelSet) });
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'subscribe', symbol, channels }));
      }
    });

    setState(prev => ({
      ...prev,
      subscribedSymbols: Array.from(subscriptionsRef.current.keys()),
    }));

    return () => unsubscribe(symbolList, channels);
  }, []);

  const unsubscribe = useCallback((symbols: string | string[], channels?: ('level1' | 'level2' | 'trades')[]) => {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];

    symbolList.forEach(symbol => {
      if (channels) {
        const sub = subscriptionsRef.current.get(symbol);
        if (sub) {
          channels.forEach(ch => sub.channels.delete(ch));
          if (sub.channels.size === 0) subscriptionsRef.current.delete(symbol);
        }
      } else {
        subscriptionsRef.current.delete(symbol);
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'unsubscribe', symbol, channels }));
      }
    });

    setState(prev => ({
      ...prev,
      subscribedSymbols: Array.from(subscriptionsRef.current.keys()),
    }));
  }, []);

  const getQuote = useCallback((symbol: string): Level1Quote | null => {
    return cacheRef.current.get(symbol) ?? state.quotes.get(symbol) ?? null;
  }, [state.quotes]);

  const getLevel2 = useCallback((symbol: string): Level2Data | null => {
    return state.level2.get(symbol) ?? null;
  }, [state.level2]);

  const getTrades = useCallback((symbol: string): TradeTick[] => {
    return state.tradeTape.get(symbol) ?? [];
  }, [state.tradeTape]);

  const disconnect = useCallback(() => {
    stopPolling();
    throttledUpdate.current.cancel();
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close(1000, 'Manual disconnect');
    setStatus('disconnected');
  }, [stopPolling]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptRef.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // ── Lifecycle ──

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    const pruneTimer = setInterval(() => cacheRef.current.prune(), cacheTtlMs);
    return () => {
      unmountedRef.current = true;
      disconnect();
      clearInterval(pruneTimer);
    };
  }, [wsUrl]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    getQuote,
    getLevel2,
    getTrades,
    disconnect,
    reconnect,
  };
}

export default useMarketData;
