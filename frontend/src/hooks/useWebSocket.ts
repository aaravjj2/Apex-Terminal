/**
 * useWebSocket.ts
 * Enterprise-grade WebSocket hook for real-time market data.
 * Features: auto-reconnect with exponential backoff, message queuing,
 * subscription management, heartbeat/ping-pong, message parsing,
 * connection state tracking, and typed message dispatch.
 */

import { useState, useEffect, useRef, useCallback, useReducer } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface WSMessage<T = any> {
  type: string;
  channel?: string;
  symbol?: string;
  data: T;
  timestamp: number;
  seq?: number;
}

export interface WSSubscription {
  channel: string;
  symbol?: string;
  handler: (msg: WSMessage) => void;
}

export interface UseWebSocketOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;     // ms base
  maxReconnectInterval?: number;  // ms cap
  heartbeatInterval?: number;     // ms, 0 = disabled
  heartbeatMessage?: any;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (msg: WSMessage) => void;
  parseMessage?: (data: string) => WSMessage | null;
  shouldReconnect?: (event: CloseEvent) => boolean;
  queryParams?: Record<string, string>;
}

export interface WSState {
  status: WSStatus;
  reconnectAttempts: number;
  lastPing: number | null;
  lastPong: number | null;
  latencyMs: number | null;
  messagesReceived: number;
  messagesSent: number;
  connectedAt: Date | null;
  lastError: string | null;
}

// ─── Default Message Parser ───────────────────────────────────────────────────

function defaultParser(data: string): WSMessage | null {
  try {
    const parsed = JSON.parse(data);
    return {
      type: parsed.type ?? parsed.event ?? parsed.channel ?? 'message',
      channel: parsed.channel ?? parsed.subscription,
      symbol: parsed.symbol ?? parsed.ticker,
      data: parsed.data ?? parsed,
      timestamp: parsed.timestamp ?? Date.now(),
      seq: parsed.seq,
    };
  } catch {
    return { type: 'raw', data, timestamp: Date.now() };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    protocols,
    reconnect = true,
    maxReconnectAttempts = 10,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    heartbeatInterval = 30000,
    heartbeatMessage = { type: 'ping' },
    onOpen,
    onClose,
    onError,
    onMessage,
    parseMessage = defaultParser,
    shouldReconnect = () => true,
    queryParams,
  } = options;

  const [wsState, setWsState] = useState<WSState>({
    status: 'connecting',
    reconnectAttempts: 0,
    lastPing: null,
    lastPong: null,
    latencyMs: null,
    messagesReceived: 0,
    messagesSent: 0,
    connectedAt: null,
    lastError: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueueRef = useRef<any[]>([]);
  const subscriptionsRef = useRef<Map<string, WSSubscription[]>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const unmountedRef = useRef(false);

  function buildUrl() {
    if (!queryParams || Object.keys(queryParams).length === 0) return url;
    const params = new URLSearchParams(queryParams).toString();
    return `${url}?${params}`;
  }

  const updateState = useCallback((update: Partial<WSState>) => {
    if (!unmountedRef.current) setWsState(prev => ({ ...prev, ...update }));
  }, []);

  const startHeartbeat = useCallback(() => {
    if (!heartbeatInterval) return;
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        updateState({ lastPing: pingTime });
        wsRef.current.send(JSON.stringify(heartbeatMessage));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, heartbeatMessage, updateState]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) { clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null; }
  }, []);

  const flushQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    try {
      updateState({ status: 'connecting' });
      const ws = new WebSocket(buildUrl(), protocols);
      wsRef.current = ws;

      ws.onopen = (event) => {
        reconnectAttemptsRef.current = 0;
        updateState({ status: 'connected', reconnectAttempts: 0, connectedAt: new Date(), lastError: null });
        startHeartbeat();
        flushQueue();
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        stopHeartbeat();
        if (unmountedRef.current) return;
        updateState({ status: 'disconnected' });
        onClose?.(event);

        if (reconnect && shouldReconnect(event) && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current), maxReconnectInterval);
          reconnectAttemptsRef.current++;
          updateState({ status: 'reconnecting', reconnectAttempts: reconnectAttemptsRef.current });
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (event) => {
        updateState({ status: 'error', lastError: 'WebSocket error' });
        onError?.(event);
      };

      ws.onmessage = (event) => {
        updateState(prev => ({ ...prev, messagesReceived: (prev.messagesReceived ?? 0) + 1 }));
        const msg = parseMessage(event.data);
        if (!msg) return;

        // Handle pong
        if (msg.type === 'pong') {
          const now = Date.now();
          updateState(prev => ({ ...prev, lastPong: now, latencyMs: prev.lastPing ? now - prev.lastPing : null }));
          return;
        }

        // Dispatch to onMessage
        onMessage?.(msg);

        // Dispatch to channel subscribers
        const key = msg.channel ? `${msg.channel}:${msg.symbol ?? '*'}` : `*:${msg.symbol ?? '*'}`;
        const handlers = [
          ...(subscriptionsRef.current.get(key) ?? []),
          ...(subscriptionsRef.current.get(`${msg.channel ?? '*'}:*`) ?? []),
          ...(subscriptionsRef.current.get(`*:*`) ?? []),
        ];
        handlers.forEach(sub => sub.handler(msg));
      };
    } catch (err) {
      updateState({ status: 'error', lastError: String(err) });
    }
  }, [url, protocols, onOpen, onClose, onError, onMessage, parseMessage, reconnect, shouldReconnect, maxReconnectAttempts, reconnectInterval, maxReconnectInterval, startHeartbeat, stopHeartbeat, flushQueue]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      stopHeartbeat();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [url]);

  // ── Public API ──

  const send = useCallback((message: any) => {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
      setWsState(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
    } else {
      messageQueueRef.current.push(message);
    }
  }, []);

  const subscribe = useCallback((channel: string, symbol?: string, handler?: (msg: WSMessage) => void): (() => void) => {
    const key = `${channel}:${symbol ?? '*'}`;
    const sub: WSSubscription = { channel, symbol, handler: handler ?? (() => {}) };
    if (!subscriptionsRef.current.has(key)) subscriptionsRef.current.set(key, []);
    subscriptionsRef.current.get(key)!.push(sub);

    // Send subscription message
    send({ type: 'subscribe', channel, symbol });

    return () => {
      const subs = subscriptionsRef.current.get(key);
      if (subs) {
        const idx = subs.indexOf(sub);
        if (idx !== -1) subs.splice(idx, 1);
        if (subs.length === 0) {
          subscriptionsRef.current.delete(key);
          send({ type: 'unsubscribe', channel, symbol });
        }
      }
    };
  }, [send]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close(1000, 'Manual disconnect');
  }, []);

  const reconnectNow = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  return { wsState, send, subscribe, disconnect, reconnectNow };
}

// ─── Typed Market Data Hooks ──────────────────────────────────────────────────

export interface QuoteData {
  ticker: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change: number;
  change_pct: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders?: number;
}

export interface OrderBook {
  ticker: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface Trade {
  ticker: string;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  timestamp: number;
  conditions?: string[];
}

// Mock WebSocket hook for local development (no real WS server)
export function useMockMarketData(tickers: string[]) {
  const [quotes, setQuotes] = useState<Map<string, QuoteData>>(new Map());
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initialPrices: Record<string, number> = {
    NVDA: 862.42, AAPL: 189.64, MSFT: 412.88, META: 502.64, TSLA: 246.22,
    AMZN: 184.22, GOOGL: 164.42, SPY: 527.88, QQQ: 456.22, BTC: 68420,
  };

  useEffect(() => {
    setConnected(true);
    const init = new Map<string, QuoteData>();
    tickers.forEach(t => {
      const base = initialPrices[t] ?? 100;
      const spread = base * 0.0002;
      init.set(t, {
        ticker: t, last: base, bid: base - spread / 2, ask: base + spread / 2,
        volume: Math.floor(Math.random() * 10e6), change: 0, change_pct: 0, timestamp: Date.now(),
      });
    });
    setQuotes(init);

    timerRef.current = setInterval(() => {
      setQuotes(prev => {
        const next = new Map(prev);
        tickers.forEach(t => {
          const q = next.get(t);
          if (!q) return;
          const delta = q.last * (Math.random() - 0.499) * 0.002;
          const newLast = Math.max(0.01, q.last + delta);
          const spread = newLast * 0.0002;
          const base = initialPrices[t] ?? 100;
          next.set(t, {
            ...q,
            last: newLast,
            bid: newLast - spread / 2,
            ask: newLast + spread / 2,
            change: newLast - base,
            change_pct: ((newLast - base) / base) * 100,
            volume: q.volume + Math.floor(Math.random() * 10000),
            timestamp: Date.now(),
          });
        });
        return next;
      });
    }, 500);

    return () => { if (timerRef.current) clearInterval(timerRef.current); setConnected(false); };
  }, [tickers.join(',')]);

  return { quotes, connected };
}

// ─── useTickerStream ──────────────────────────────────────────────────────────

export function useTickerStream(ticker: string, wsUrl?: string): {
  quote: QuoteData | null;
  connected: boolean;
  latencyMs: number | null;
} {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const { quotes, connected } = useMockMarketData([ticker]);

  useEffect(() => {
    const q = quotes.get(ticker);
    if (q) setQuote(q);
  }, [quotes, ticker]);

  return { quote, connected, latencyMs: null };
}

export default useWebSocket;
