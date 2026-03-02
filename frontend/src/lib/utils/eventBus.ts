// ============================================================================
// Types
// ============================================================================

export type EventHandler<T = unknown> = (data: T) => void;

export interface EventSubscription {
  unsubscribe: () => void;
}

export interface BufferedEvent<T = unknown> {
  channel: string;
  data: T;
  timestamp: number;
  priority: number;
}

export interface EventMetrics {
  totalEmitted: number;
  totalHandled: number;
  channelCounts: Record<string, number>;
  lastEmittedAt: number;
  droppedEvents: number;
}

// ============================================================================
// Type-Safe Event Emitter
// ============================================================================

export class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  private handlers = new Map<keyof EventMap, Set<{ handler: EventHandler; priority: number; once: boolean }>>();
  private metrics: EventMetrics = {
    totalEmitted: 0,
    totalHandled: 0,
    channelCounts: {},
    lastEmittedAt: 0,
    droppedEvents: 0,
  };
  private maxListeners: number;

  constructor(maxListeners = 100) {
    this.maxListeners = maxListeners;
  }

  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
    priority = 0
  ): EventSubscription {
    return this.addListener(event, handler, priority, false);
  }

  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
    priority = 0
  ): EventSubscription {
    return this.addListener(event, handler, priority, true);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.metrics.totalEmitted++;
    this.metrics.lastEmittedAt = Date.now();
    this.metrics.channelCounts[event as string] = (this.metrics.channelCounts[event as string] || 0) + 1;

    const listeners = this.handlers.get(event);
    if (!listeners) return;

    const sorted = [...listeners].sort((a, b) => b.priority - a.priority);
    const toRemove: typeof sorted = [];

    for (const entry of sorted) {
      entry.handler(data);
      this.metrics.totalHandled++;
      if (entry.once) toRemove.push(entry);
    }

    for (const entry of toRemove) listeners.delete(entry);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const listeners = this.handlers.get(event);
    if (!listeners) return;
    for (const entry of listeners) {
      if (entry.handler === handler) { listeners.delete(entry); break; }
    }
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }

  listenerCount(event: keyof EventMap): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = { totalEmitted: 0, totalHandled: 0, channelCounts: {}, lastEmittedAt: 0, droppedEvents: 0 };
  }

  private addListener<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
    priority: number,
    once: boolean
  ): EventSubscription {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    const listeners = this.handlers.get(event)!;

    if (listeners.size >= this.maxListeners) {
      console.warn(`Max listeners (${this.maxListeners}) reached for event "${String(event)}"`);
      this.metrics.droppedEvents++;
      return { unsubscribe: () => {} };
    }

    const entry = { handler: handler as EventHandler, priority, once };
    listeners.add(entry);

    return {
      unsubscribe: () => listeners.delete(entry),
    };
  }
}

// ============================================================================
// Channel-Based Pub/Sub
// ============================================================================

export class PubSub {
  private emitter = new TypedEventEmitter<Record<string, unknown>>();
  private channels = new Set<string>();

  subscribe(channel: string, handler: EventHandler, priority = 0): EventSubscription {
    this.channels.add(channel);
    return this.emitter.on(channel, handler, priority);
  }

  publish(channel: string, data: unknown): void {
    this.emitter.emit(channel, data);
  }

  unsubscribe(channel: string): void {
    this.emitter.removeAllListeners(channel);
    this.channels.delete(channel);
  }

  getChannels(): string[] {
    return [...this.channels];
  }

  getMetrics(): EventMetrics {
    return this.emitter.getMetrics();
  }
}

// ============================================================================
// Event Buffer
// ============================================================================

export class EventBuffer<T = unknown> {
  private buffer: BufferedEvent<T>[] = [];
  private maxSize: number;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private onFlush: ((events: BufferedEvent<T>[]) => void) | null = null;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  add(channel: string, data: T, priority = 0): void {
    this.buffer.push({ channel, data, timestamp: Date.now(), priority });
    if (this.buffer.length >= this.maxSize) this.flush();
  }

  flush(): BufferedEvent<T>[] {
    const events = this.buffer.sort((a, b) => b.priority - a.priority);
    this.buffer = [];
    if (this.onFlush) this.onFlush(events);
    return events;
  }

  startAutoFlush(intervalMs: number, handler: (events: BufferedEvent<T>[]) => void): void {
    this.onFlush = handler;
    this.flushInterval = setInterval(() => {
      if (this.buffer.length > 0) this.flush();
    }, intervalMs);
  }

  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  get size(): number { return this.buffer.length; }
  get pending(): BufferedEvent<T>[] { return [...this.buffer]; }
}

// ============================================================================
// Event Replay
// ============================================================================

export class EventReplay<EventMap extends Record<string, unknown>> {
  private history: Array<{ event: keyof EventMap; data: unknown; timestamp: number }> = [];
  private maxHistory: number;
  private emitter: TypedEventEmitter<EventMap>;

  constructor(emitter: TypedEventEmitter<EventMap>, maxHistory = 1000) {
    this.emitter = emitter;
    this.maxHistory = maxHistory;
  }

  record<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.history.push({ event, data, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
    this.emitter.emit(event, data);
  }

  replay(filter?: { event?: keyof EventMap; since?: number }): void {
    let events = this.history;
    if (filter?.event) events = events.filter(e => e.event === filter.event);
    if (filter?.since) events = events.filter(e => e.timestamp >= filter.since!);
    for (const { event, data } of events) {
      this.emitter.emit(event, data as EventMap[typeof event]);
    }
  }

  getHistory(): Array<{ event: keyof EventMap; data: unknown; timestamp: number }> {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}

// ============================================================================
// Cross-Tab Communication (BroadcastChannel)
// ============================================================================

export class CrossTabChannel<T = unknown> {
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<EventHandler<T>>();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(name);
      this.channel.onmessage = (event: MessageEvent) => {
        for (const handler of this.handlers) handler(event.data);
      };
    }
  }

  send(data: T): void {
    this.channel?.postMessage(data);
  }

  onMessage(handler: EventHandler<T>): EventSubscription {
    this.handlers.add(handler);
    return {
      unsubscribe: () => this.handlers.delete(handler),
    };
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
    this.handlers.clear();
  }
}

// ============================================================================
// Event Logger
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface EventLogEntry {
  timestamp: number;
  level: LogLevel;
  channel: string;
  message: string;
  data?: unknown;
}

export class EventLogger {
  private logs: EventLogEntry[] = [];
  private maxLogs: number;
  private minLevel: LogLevel;

  private static readonly LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  constructor(maxLogs = 500, minLevel: LogLevel = 'info') {
    this.maxLogs = maxLogs;
    this.minLevel = minLevel;
  }

  log(level: LogLevel, channel: string, message: string, data?: unknown): void {
    if (EventLogger.LEVELS[level] < EventLogger.LEVELS[this.minLevel]) return;
    this.logs.push({ timestamp: Date.now(), level, channel, message, data });
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  getLogs(filter?: { level?: LogLevel; channel?: string; since?: number }): EventLogEntry[] {
    let results = [...this.logs];
    if (filter?.level) results = results.filter(l => EventLogger.LEVELS[l.level] >= EventLogger.LEVELS[filter.level!]);
    if (filter?.channel) results = results.filter(l => l.channel === filter.channel);
    if (filter?.since) results = results.filter(l => l.timestamp >= filter.since!);
    return results;
  }

  clear(): void {
    this.logs = [];
  }

  get size(): number {
    return this.logs.length;
  }
}
