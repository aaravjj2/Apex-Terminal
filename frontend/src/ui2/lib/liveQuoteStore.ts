/**
 * Global live quote store.
 *
 * - Single WebSocket connection to /ws/quotes (push every ~1s).
 * - Auto-reconnect with exponential backoff (1s → 30s).
 * - Subscribe per symbol; the store batches subscribe / unsubscribe ops.
 * - REST fallback to /api/v1/live/quotes whenever WS is disconnected.
 *
 * Usage:
 *   const q = useLiveQuote('AAPL');        // { price, change, changePct, source }
 *   const map = useLiveQuotes(['AAPL', 'MSFT']);
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

export interface LiveQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  source: string;
  ts: number;
}

type Listener = () => void;

const quotes = new Map<string, LiveQuote>();
const listeners = new Set<Listener>();
const refCount = new Map<string, number>();
let wsConn: WebSocket | null = null;
let wsState: 'connecting' | 'open' | 'closed' = 'closed';
let backoffMs = 1000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pendingSyms: Set<string> | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let status: 'live' | 'reconnecting' | 'offline' = 'offline';

// Bumped on any quotes change — used by useSyncExternalStore to detect updates.
let version = 0;

function emit() {
  version += 1;
  listeners.forEach(fn => fn());
}

function parseQuote(q: Record<string, unknown>): LiveQuote | null {
  const symbol = String(q.symbol ?? '');
  const last = Number(q.last ?? q.price ?? 0);
  if (!symbol || last <= 0) return null;
  return {
    symbol,
    price: last,
    bid: Number(q.bid ?? last),
    ask: Number(q.ask ?? last),
    last,
    change: Number(q.change ?? 0),
    changePct: Number(q.change_pct ?? q.changePct ?? 0),
    open: q.open != null ? Number(q.open) : undefined,
    high: q.high != null ? Number(q.high) : undefined,
    low: q.low != null ? Number(q.low) : undefined,
    close: q.close != null ? Number(q.close) : undefined,
    volume: q.volume != null ? Number(q.volume) : undefined,
    source: String(q.source ?? 'live'),
    ts: Date.now(),
  };
}

function applyBatch(items: unknown[]): void {
  let changed = 0;
  for (const item of items) {
    const q = parseQuote(item as Record<string, unknown>);
    if (!q) continue;
    const prev = quotes.get(q.symbol);
    if (!prev || prev.last !== q.last || prev.change !== q.change) {
      quotes.set(q.symbol, q);
      changed += 1;
    }
  }
  if (changed) emit();
}

function activeSymbols(): string[] {
  return Array.from(refCount.entries())
    .filter(([, n]) => n > 0)
    .map(([s]) => s);
}

function flushPending() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  if (!pendingSyms || pendingSyms.size === 0) return;
  if (wsConn && wsConn.readyState === WebSocket.OPEN) {
    wsConn.send(JSON.stringify({ action: 'subscribe', symbols: Array.from(pendingSyms) }));
    pendingSyms = null;
  } else {
    // Defer; subscribes will be resent in onopen via syncSubsToServer().
    // Also kick a one-shot REST poll so the UI gets data immediately.
    pollOnce();
  }
}

function scheduleSubscribe(sym: string) {
  if (!pendingSyms) pendingSyms = new Set();
  pendingSyms.add(sym);
  if (!pendingTimer) pendingTimer = setTimeout(flushPending, 50);
}

function syncSubsToServer() {
  // Send the full active symbol set to the server in one shot. Used on every
  // (re)open so server state matches client refCounts no matter what was lost.
  if (!wsConn || wsConn.readyState !== WebSocket.OPEN) return;
  const all = activeSymbols();
  if (all.length === 0) return;
  wsConn.send(JSON.stringify({ action: 'subscribe', symbols: all }));
  pendingSyms = null;
}

function pollOnce(): void {
  const syms = activeSymbols();
  if (!syms.length) return;
  fetch(`/api/v1/live/quotes?symbols=${encodeURIComponent(syms.join(','))}`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (d?.quotes?.length) applyBatch(d.quotes);
    })
    .catch(() => {});
}

function startPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setStatus(next: typeof status) {
  if (status !== next) {
    status = next;
    emit();
  }
}

function connectWS() {
  if (typeof window === 'undefined') return;
  if (wsState === 'open' || wsState === 'connecting') return;
  const syms = activeSymbols();
  if (!syms.length) return;
  wsState = 'connecting';
  setStatus('reconnecting');
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${window.location.host}/ws/quotes?symbols=${encodeURIComponent(syms.join(','))}`;
  try {
    wsConn = new WebSocket(url);
  } catch {
    wsState = 'closed';
    startPolling();
    return;
  }
  wsConn.onopen = () => {
    wsState = 'open';
    backoffMs = 1000;
    setStatus('live');
    // Resend the full active universe so any subs queued while connecting are honored.
    syncSubsToServer();
    // Kick one REST refresh so newly-subscribed symbols populate immediately
    // instead of waiting for the server's next price change.
    pollOnce();
    stopPolling();
  };
  wsConn.onmessage = (ev: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'quotes' && Array.isArray(msg.data)) {
        applyBatch(msg.data);
      }
    } catch {
      // ignore
    }
  };
  const reconnect = () => {
    wsState = 'closed';
    wsConn = null;
    setStatus('reconnecting');
    startPolling();
    setTimeout(connectWS, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 30000);
  };
  wsConn.onclose = reconnect;
  wsConn.onerror = () => {
    try { wsConn?.close(); } catch { /* ignore */ }
  };
}

function ensureRunning() {
  startPolling();
  if (!wsConn) connectWS();
}

function subscribe(sym: string) {
  const upper = sym.toUpperCase();
  const n = (refCount.get(upper) ?? 0) + 1;
  refCount.set(upper, n);
  if (n === 1) {
    scheduleSubscribe(upper);
    ensureRunning();
    // Immediate REST refresh so the UI doesn't wait up to ~2s for the next
    // WS push tick to see the first price for a newly-tracked symbol.
    if (!quotes.has(upper)) {
      fetch(`/api/v1/live/quotes?symbols=${encodeURIComponent(upper)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.quotes?.length) applyBatch(d.quotes); })
        .catch(() => {});
    }
  }
}

function unsubscribe(sym: string) {
  const upper = sym.toUpperCase();
  const n = (refCount.get(upper) ?? 0) - 1;
  if (n <= 0) {
    refCount.delete(upper);
    if (wsConn?.readyState === WebSocket.OPEN) {
      wsConn.send(JSON.stringify({ action: 'unsubscribe', symbols: [upper] }));
    }
  } else {
    refCount.set(upper, n);
  }
}

function getVersion(): number {
  return version;
}

function getStatus(): typeof status {
  return status;
}

const subscribeStore = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLiveQuote(symbol: string | undefined): LiveQuote | null {
  useEffect(() => {
    if (!symbol) return;
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol]);
  // Subscribe to the store via primitive (version number); read on each render.
  useSyncExternalStore(subscribeStore, getVersion, getVersion);
  if (!symbol) return null;
  return quotes.get(symbol.toUpperCase()) ?? null;
}

const EMPTY_QUOTES: Record<string, LiveQuote> = Object.freeze({}) as Record<string, LiveQuote>;

/**
 * Returns a stable object reference that only changes when the underlying
 * quotes (for the requested symbols) actually change. Safe to use as a
 * `useEffect` dependency without infinite loops.
 */
export function useLiveQuotes(symbols: string[]): Record<string, LiveQuote> {
  const key = useMemo(
    () => Array.from(new Set(symbols.map(s => s.toUpperCase()))).sort().join(','),
    [symbols.join(',')],
  );
  useEffect(() => {
    const list = key ? key.split(',').filter(Boolean) : [];
    list.forEach(subscribe);
    return () => list.forEach(unsubscribe);
  }, [key]);
  const v = useSyncExternalStore(subscribeStore, getVersion, getVersion);
  return useMemo(() => {
    if (!key) return EMPTY_QUOTES;
    const out: Record<string, LiveQuote> = {};
    for (const s of key.split(',')) {
      const q = quotes.get(s);
      if (q) out[s] = q;
    }
    return out;
    // v drives recomputation when any quote in the store ticks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
}

export function useLiveStatus(): 'live' | 'reconnecting' | 'offline' {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return getStatus();
}

export const liveQuoteStore = {
  subscribe,
  unsubscribe,
  snapshot: () => quotes,
  status: getStatus,
  forcePoll: pollOnce,
};
