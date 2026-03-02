// ============================================================================
// FPS Counter
// ============================================================================

export class FPSCounter {
  private frames: number[] = [];
  private lastTime = 0;
  private _fps = 0;
  private _min = Infinity;
  private _max = 0;
  private windowSize: number;

  constructor(windowSize = 60) {
    this.windowSize = windowSize;
  }

  tick(now: number = performance.now()): void {
    if (this.lastTime > 0) {
      const delta = now - this.lastTime;
      const fps = 1000 / delta;
      this.frames.push(fps);
      if (this.frames.length > this.windowSize) this.frames.shift();

      this._fps = this.frames.reduce((s, v) => s + v, 0) / this.frames.length;
      this._min = Math.min(this._min, fps);
      this._max = Math.max(this._max, fps);
    }
    this.lastTime = now;
  }

  get fps(): number { return Math.round(this._fps); }
  get min(): number { return Math.round(this._min); }
  get max(): number { return Math.round(this._max); }

  reset(): void {
    this.frames = [];
    this.lastTime = 0;
    this._fps = 0;
    this._min = Infinity;
    this._max = 0;
  }
}

// ============================================================================
// Memory Usage Tracking
// ============================================================================

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function getMemoryUsage(): MemorySnapshot | null {
  const perf = performance as unknown as { memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }};
  if (!perf.memory) return null;
  return {
    timestamp: Date.now(),
    usedJSHeapSize: perf.memory.usedJSHeapSize,
    totalJSHeapSize: perf.memory.totalJSHeapSize,
    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
  };
}

export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshots = 100) {
    this.maxSnapshots = maxSnapshots;
  }

  sample(): MemorySnapshot | null {
    const snapshot = getMemoryUsage();
    if (snapshot) {
      this.snapshots.push(snapshot);
      if (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
    }
    return snapshot;
  }

  get trend(): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (this.snapshots.length < 10) return 'unknown';
    const recent = this.snapshots.slice(-10);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    const change = (last - first) / first;
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  get current(): MemorySnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  get history(): MemorySnapshot[] {
    return [...this.snapshots];
  }
}

// ============================================================================
// Render Time Measurement
// ============================================================================

export class RenderTimer {
  private measurements = new Map<string, number[]>();
  private active = new Map<string, number>();

  start(label: string): void {
    this.active.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.active.get(label);
    if (startTime == null) return 0;
    const duration = performance.now() - startTime;
    this.active.delete(label);

    const history = this.measurements.get(label) ?? [];
    history.push(duration);
    if (history.length > 100) history.shift();
    this.measurements.set(label, history);

    return duration;
  }

  getStats(label: string): { avg: number; min: number; max: number; p95: number; count: number } | null {
    const history = this.measurements.get(label);
    if (!history?.length) return null;

    const sorted = [...history].sort((a, b) => a - b);
    return {
      avg: history.reduce((s, v) => s + v, 0) / history.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      count: history.length,
    };
  }

  getAllStats(): Record<string, ReturnType<RenderTimer['getStats']>> {
    const result: Record<string, ReturnType<RenderTimer['getStats']>> = {};
    for (const [label] of this.measurements) {
      result[label] = this.getStats(label);
    }
    return result;
  }

  clear(): void {
    this.measurements.clear();
    this.active.clear();
  }
}

// ============================================================================
// Network Latency Measurement
// ============================================================================

export async function measureLatency(url: string, samples = 5): Promise<{
  avg: number; min: number; max: number; jitter: number;
}> {
  const times: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    } catch { /* measure regardless */ }
    times.push(performance.now() - start);
  }

  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const sorted = times.sort((a, b) => a - b);
  const jitter = times.reduce((s, v) => s + Math.abs(v - avg), 0) / times.length;

  return { avg, min: sorted[0], max: sorted[sorted.length - 1], jitter };
}

// ============================================================================
// Performance Marks and Measures
// ============================================================================

export class PerformanceMarker {
  private prefix: string;

  constructor(prefix = 'app') {
    this.prefix = prefix;
  }

  mark(name: string): void {
    performance.mark(`${this.prefix}:${name}`);
  }

  measure(name: string, startMark: string, endMark?: string): PerformanceMeasure | null {
    try {
      if (endMark) {
        return performance.measure(
          `${this.prefix}:${name}`,
          `${this.prefix}:${startMark}`,
          `${this.prefix}:${endMark}`
        );
      }
      return performance.measure(`${this.prefix}:${name}`, `${this.prefix}:${startMark}`);
    } catch {
      return null;
    }
  }

  getEntries(): PerformanceEntryList {
    return performance.getEntriesByType('measure').filter(e => e.name.startsWith(this.prefix));
  }

  clear(): void {
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// ============================================================================
// Throttle & Debounce
// ============================================================================

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): T & { cancel: () => void } {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: unknown, ...args: unknown[]) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      lastCall = now;
      return fn.apply(this, args);
    }
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } };
  return throttled;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: unknown[] | null = null;
  let lastThis: unknown = null;

  const invoke = () => {
    if (lastArgs) {
      fn.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  const debounced = function (this: unknown, ...args: unknown[]) {
    lastArgs = args;
    lastThis = this;
    const callNow = leading && !timeoutId;

    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (trailing) invoke();
    }, delay);

    if (callNow) invoke();
  } as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } };
  debounced.flush = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; invoke(); } };
  return debounced;
}

// ============================================================================
// Memoization with LRU Cache
// ============================================================================

export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: { maxSize?: number; ttl?: number; keyFn?: (...args: unknown[]) => string } = {}
): T & { cache: { size: number; clear: () => void; hits: number; misses: number } } {
  const { maxSize = 100, ttl, keyFn = (...args) => JSON.stringify(args) } = options;
  const cache = new Map<string, { value: unknown; timestamp: number }>();
  const order: string[] = [];
  let hits = 0, misses = 0;

  const memoized = function (this: unknown, ...args: unknown[]) {
    const key = keyFn(...args);
    const entry = cache.get(key);

    if (entry) {
      if (ttl && Date.now() - entry.timestamp > ttl) {
        cache.delete(key);
        const idx = order.indexOf(key);
        if (idx !== -1) order.splice(idx, 1);
      } else {
        hits++;
        const idx = order.indexOf(key);
        if (idx !== -1) order.splice(idx, 1);
        order.push(key);
        return entry.value;
      }
    }

    misses++;
    const value = fn.apply(this, args);

    if (cache.size >= maxSize) {
      const evict = order.shift();
      if (evict) cache.delete(evict);
    }

    cache.set(key, { value, timestamp: Date.now() });
    order.push(key);
    return value;
  } as T & { cache: { size: number; clear: () => void; hits: number; misses: number } };

  Object.defineProperty(memoized, 'cache', {
    get: () => ({
      size: cache.size,
      clear: () => { cache.clear(); order.length = 0; hits = 0; misses = 0; },
      get hits() { return hits; },
      get misses() { return misses; },
    }),
  });

  return memoized;
}

// ============================================================================
// Lazy Evaluation
// ============================================================================

export class Lazy<T> {
  private _value: T | undefined;
  private _computed = false;
  private factory: () => T;

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get value(): T {
    if (!this._computed) {
      this._value = this.factory();
      this._computed = true;
    }
    return this._value!;
  }

  get isComputed(): boolean {
    return this._computed;
  }

  reset(): void {
    this._computed = false;
    this._value = undefined;
  }
}

export function lazy<T>(factory: () => T): Lazy<T> {
  return new Lazy(factory);
}

// ============================================================================
// Bottleneck Detection
// ============================================================================

export interface BottleneckReport {
  label: string;
  avgMs: number;
  maxMs: number;
  p95Ms: number;
  callCount: number;
  severity: 'ok' | 'warning' | 'critical';
}

export function detectBottlenecks(
  timer: RenderTimer,
  thresholds = { warning: 16, critical: 50 }
): BottleneckReport[] {
  const reports: BottleneckReport[] = [];
  const allStats = timer.getAllStats();

  for (const [label, stats] of Object.entries(allStats)) {
    if (!stats) continue;
    const severity = stats.p95 > thresholds.critical ? 'critical'
      : stats.p95 > thresholds.warning ? 'warning' : 'ok';

    reports.push({
      label,
      avgMs: Math.round(stats.avg * 100) / 100,
      maxMs: Math.round(stats.max * 100) / 100,
      p95Ms: Math.round(stats.p95 * 100) / 100,
      callCount: stats.count,
      severity,
    });
  }

  return reports.sort((a, b) => b.p95Ms - a.p95Ms);
}
