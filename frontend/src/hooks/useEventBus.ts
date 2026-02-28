/**
 * useEventBus.ts
 * Pub/sub event system for cross-panel communication in the Apex Terminal.
 * Supports typed events, one-time listeners, priority queues, event replay,
 * namespace isolation, and React hook-based subscriptions with auto-cleanup.
 * Used to connect portfolio panels, alert triggers, chart sync, and more.
 */

import { useEffect, useCallback, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EventBusEvent<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  source?: string;
  id: string;
}

export type EventHandler<T = any> = (event: EventBusEvent<T>) => void;

export interface SubscriptionOptions {
  once?: boolean;
  priority?: number;
  filter?: (event: EventBusEvent) => boolean;
  namespace?: string;
}

// ─── Event Registry ───────────────────────────────────────────────────────────

// All typed Apex Terminal events
export interface ApexEvents {
  // Symbol
  'symbol:changed': { ticker: string; source: string };
  'symbol:searched': { query: string; ticker: string };
  'symbol:added_to_watchlist': { ticker: string };
  'symbol:removed_from_watchlist': { ticker: string };
  // Chart
  'chart:timeframe_changed': { timeframe: string; ticker: string };
  'chart:crosshair_moved': { time: number; price: number; panelId: string };
  'chart:range_changed': { from: number; to: number; panelId: string };
  'chart:indicator_added': { indicator: string; params: any };
  'chart:drawing_added': { type: string; points: any[] };
  // Portfolio
  'portfolio:position_opened': { ticker: string; quantity: number; price: number };
  'portfolio:position_closed': { ticker: string; realizedPnL: number };
  'portfolio:trade_executed': { side: 'buy' | 'sell'; ticker: string; qty: number; price: number };
  'portfolio:alert_triggered': { ticke: string; condition: string; threshold: number };
  // Market
  'market:session_changed': { session: string };
  'market:circuit_breaker': { level: number; message: string };
  'market:halt': { ticker: string; reason: string };
  // UI
  'ui:panel_focused': { panelId: string; panelType: string };
  'ui:panel_closed': { panelId: string };
  'ui:layout_changed': { layout: string };
  'ui:sidebar_toggled': { open: boolean };
  'ui:command_palette_opened': {};
  'ui:notification_dismissed': { id: string };
  // Data
  'data:refresh_requested': { scope: string };
  'data:export_requested': { format: 'csv' | 'json' | 'xlsx'; data: any };
  'data:error': { source: string; message: string; code?: number };
  // Alerts
  'alert:created': { id: string; ticker: string; condition: string };
  'alert:triggered': { id: string; ticker: string; message: string };
  'alert:dismissed': { id: string };
}

// ─── Event Bus Core ───────────────────────────────────────────────────────────

class EventBus {
  private listeners = new Map<string, Array<{
    handler: EventHandler;
    options: SubscriptionOptions;
    id: string;
  }>>();
  private history: EventBusEvent[] = [];
  private maxHistory = 200;

  subscribe<K extends keyof ApexEvents>(
    eventType: K,
    handler: EventHandler<ApexEvents[K]>,
    options: SubscriptionOptions = {}
  ): () => void {
    const type = String(eventType);
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    const id = `sub_${Math.random().toString(36).slice(2)}`;
    const list = this.listeners.get(type)!;
    list.push({ handler, options, id });
    // Sort by priority
    list.sort((a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0));
    return () => this.unsubscribe(type, id);
  }

  subscribeAny(
    handler: EventHandler,
    options: SubscriptionOptions = {}
  ): () => void {
    return this.subscribe('*' as any, handler, options);
  }

  private unsubscribe(type: string, id: string) {
    const list = this.listeners.get(type);
    if (!list) return;
    const idx = list.findIndex(l => l.id === id);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit<K extends keyof ApexEvents>(
    eventType: K,
    payload: ApexEvents[K],
    source?: string
  ): void {
    const event: EventBusEvent<ApexEvents[K]> = {
      type: String(eventType),
      payload,
      timestamp: Date.now(),
      source,
      id: `evt_${Math.random().toString(36).slice(2)}`,
    };

    // Add to history
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    // Dispatch to type-specific listeners
    const typeListeners = [...(this.listeners.get(String(eventType)) ?? [])];
    for (const sub of typeListeners) {
      if (sub.options.filter && !sub.options.filter(event)) continue;
      try {
        sub.handler(event);
        if (sub.options.once) this.unsubscribe(String(eventType), sub.id);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${eventType}":`, err);
      }
    }

    // Dispatch to wildcard listeners
    const wildcardListeners = [...(this.listeners.get('*') ?? [])];
    for (const sub of wildcardListeners) {
      if (sub.options.filter && !sub.options.filter(event)) continue;
      try { sub.handler(event); } catch {}
    }
  }

  getHistory(eventType?: string, limit = 50): EventBusEvent[] {
    const filtered = eventType ? this.history.filter(e => e.type === eventType) : this.history;
    return filtered.slice(-limit);
  }

  clearHistory() { this.history = []; }

  once<K extends keyof ApexEvents>(
    eventType: K,
    handler: EventHandler<ApexEvents[K]>
  ): () => void {
    return this.subscribe(eventType, handler, { once: true });
  }

  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.length ?? 0;
  }

  clearAll() {
    this.listeners.clear();
  }

  removeAllListeners(eventType: string) {
    this.listeners.delete(eventType);
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const apexEventBus = new EventBus();

// Global window binding for debugging
if (typeof window !== 'undefined') {
  (window as any).__apexEventBus = apexEventBus;
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

export function useEventBus() {
  const emit = useCallback(<K extends keyof ApexEvents>(
    eventType: K,
    payload: ApexEvents[K],
    source?: string
  ) => {
    apexEventBus.emit(eventType, payload, source);
  }, []);

  const subscribe = useCallback(<K extends keyof ApexEvents>(
    eventType: K,
    handler: EventHandler<ApexEvents[K]>,
    options?: SubscriptionOptions
  ) => {
    return apexEventBus.subscribe(eventType, handler, options);
  }, []);

  return { emit, subscribe, bus: apexEventBus };
}

export function useEventListener<K extends keyof ApexEvents>(
  eventType: K,
  handler: (event: EventBusEvent<ApexEvents[K]>) => void,
  options: SubscriptionOptions = {},
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    const stable = (e: EventBusEvent) => handlerRef.current(e);
    return apexEventBus.subscribe(eventType, stable, options);
  }, [eventType, ...deps]);
}

export function useEventEmitter<K extends keyof ApexEvents>(
  eventType: K,
  source?: string
) {
  return useCallback((payload: ApexEvents[K]) => {
    apexEventBus.emit(eventType, payload, source);
  }, [eventType, source]);
}

// ─── Symbol Sync Hook ─────────────────────────────────────────────────────────

export function useSymbolSync(
  onSymbolChange: (ticker: string) => void,
  options?: SubscriptionOptions
) {
  useEventListener('symbol:changed', (e) => onSymbolChange(e.payload.ticker), options);
  const emitSymbolChange = useEventEmitter('symbol:changed');
  const changeSymbol = useCallback((ticker: string, source = 'user') => {
    emitSymbolChange({ ticker, source });
  }, [emitSymbolChange]);
  return changeSymbol;
}

// ─── Chart Sync Hook ──────────────────────────────────────────────────────────

export function useCrosshairSync(panelId: string) {
  const [crosshair, setCrosshair] = useState<{ time: number; price: number } | null>(null);

  useEventListener('chart:crosshair_moved', (e) => {
    if (e.payload.panelId !== panelId) {
      setCrosshair({ time: e.payload.time, price: e.payload.price });
    }
  });

  const emitCrosshair = useEventEmitter('chart:crosshair_moved');
  const moveCrosshair = useCallback((time: number, price: number) => {
    emitCrosshair({ time, price, panelId });
  }, [emitCrosshair, panelId]);

  return { crosshair, moveCrosshair };
}

// ─── Alert Bridge ─────────────────────────────────────────────────────────────

export function useAlertBridge() {
  const emitAlert = useEventEmitter('alert:triggered');
  const dismissAlert = useEventEmitter('alert:dismissed');

  const triggerAlert = useCallback((id: string, ticker: string, message: string) => {
    emitAlert({ id, ticker, message });
  }, [emitAlert]);

  const dismiss = useCallback((id: string) => {
    dismissAlert({ id });
  }, [dismissAlert]);

  return { triggerAlert, dismiss };
}

// ─── Event History Hook ───────────────────────────────────────────────────────

export function useEventHistory(eventType?: string, limit = 20) {
  const [history, setHistory] = useState<EventBusEvent[]>(() => apexEventBus.getHistory(eventType, limit));

  useEffect(() => {
    const updateHistory = () => setHistory(apexEventBus.getHistory(eventType, limit));
    if (eventType) {
      return apexEventBus.subscribe(eventType as keyof ApexEvents, updateHistory);
    } else {
      return apexEventBus.subscribeAny(updateHistory);
    }
  }, [eventType, limit]);

  return history;
}

// ─── Namespace Factory ────────────────────────────────────────────────────────

export function createNamespacedBus(namespace: string) {
  const prefix = `${namespace}:`;
  return {
    emit: <K extends keyof ApexEvents>(type: K, payload: ApexEvents[K]) => {
      apexEventBus.emit(type, payload, namespace);
    },
    subscribe: <K extends keyof ApexEvents>(type: K, handler: EventHandler<ApexEvents[K]>) => {
      return apexEventBus.subscribe(type, handler, { namespace });
    },
  };
}

// ─── Import for JSX ──────────────────────────────────────────────────────────
import React from 'react';

export default apexEventBus;
