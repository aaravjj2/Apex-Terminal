/**
 * Data Provider Abstraction
 * ==========================
 * Defines a pluggable interface for market data sources.
 * Three providers:
 *   1. FixtureProvider  — deterministic mock data (default, always available)
 *   2. CachedProvider   — wraps any provider with localStorage caching
 *   3. YahooFinanceProvider — real data via yfinance (runtime only)
 *
 * Demo mode and E2E tests ALWAYS use FixtureProvider.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Candle {
  time: number;   // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchCandlesRequest {
  symbol: string;
  timeframe: string;     // e.g. '1m', '5m', '15m', '1h', '1d'
  range: string;         // e.g. '1d', '5d', '1mo', '3mo', '1y'
}

export interface DataProviderInfo {
  id: string;
  name: string;
  description: string;
  requiresNetwork: boolean;
}

export interface DataProvider {
  readonly info: DataProviderInfo;
  fetchCandles(req: FetchCandlesRequest): Promise<Candle[]>;
}

// ── Cache key builder ──────────────────────────────────────────────────────

export function buildCacheKey(req: FetchCandlesRequest): string {
  return `mktdata:${req.symbol}:${req.timeframe}:${req.range}`;
}

// ── FixtureProvider ────────────────────────────────────────────────────────

/**
 * Deterministic mock candle generator.
 * Uses a seeded PRNG to always produce identical data for the same request.
 */
export class FixtureProvider implements DataProvider {
  readonly info: DataProviderInfo = {
    id: 'fixture',
    name: 'Demo Fixtures',
    description: 'Deterministic mock data — no network required',
    requiresNetwork: false,
  };

  async fetchCandles(req: FetchCandlesRequest): Promise<Candle[]> {
    const count = this.countForRange(req.range, req.timeframe);
    return this.generate(req.symbol, count, req.timeframe);
  }

  private countForRange(range: string, timeframe: string): number {
    const rangeBars: Record<string, number> = {
      '1d': 390,   // 1 minute bars in a trading day
      '5d': 390 * 5,
      '1mo': 390 * 21,
      '3mo': 390 * 63,
      '1y': 252,   // daily bars in a year
    };
    const tfMultiplier: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '1d': 390,
    };
    const totalMinutes = rangeBars[range] ?? 390;
    const div = tfMultiplier[timeframe] ?? 1;
    return Math.max(50, Math.min(2000, Math.floor(totalMinutes / div)));
  }

  private generate(symbol: string, count: number, _timeframe: string): Candle[] {
    // Seed from symbol for determinism
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) {
      seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
    }
    const rng = this.seededRandom(Math.abs(seed) || 42);

    const basePrice = 100 + (Math.abs(seed) % 200);
    const candles: Candle[] = [];
    let price = basePrice;
    const now = Date.now();
    const intervalMs = 60_000; // 1 minute for simplicity

    for (let i = 0; i < count; i++) {
      const change = (rng() - 0.5) * 2;
      const open = price;
      const close = Math.max(1, open + change);
      const high = Math.max(open, close) + rng() * 1.5;
      const low = Math.min(open, close) - rng() * 1.5;
      const volume = Math.floor(1000 + rng() * 50000);

      candles.push({
        time: now - (count - i) * intervalMs,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume,
      });

      price = close;
    }

    return candles;
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
}

// ── CachedProvider ─────────────────────────────────────────────────────────

/**
 * Wraps any DataProvider with localStorage caching.
 * Cache keys are deterministic: symbol + timeframe + range.
 */
export class CachedProvider implements DataProvider {
  private inner: DataProvider;
  private ttlMs: number;

  readonly info: DataProviderInfo;

  constructor(inner: DataProvider, ttlMs: number = 5 * 60 * 1000) {
    this.inner = inner;
    this.ttlMs = ttlMs;
    this.info = {
      ...inner.info,
      id: `cached-${inner.info.id}`,
      name: `${inner.info.name} (Cached)`,
      description: `${inner.info.description} — with local cache`,
    };
  }

  async fetchCandles(req: FetchCandlesRequest): Promise<Candle[]> {
    const key = buildCacheKey(req);

    // Check cache
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < this.ttlMs) {
          return data as Candle[];
        }
      }
    } catch {
      // Cache miss or corrupt — continue to fetch
    }

    // Fetch from inner provider
    const candles = await this.inner.fetchCandles(req);

    // Store in cache
    try {
      localStorage.setItem(key, JSON.stringify({ data: candles, ts: Date.now() }));
    } catch {
      // localStorage full — best-effort
    }

    return candles;
  }

  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('mktdata:')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

// ── YahooFinanceProvider ───────────────────────────────────────────────────

/**
 * Real market data via backend proxy to yfinance.
 * Only available at runtime when ENABLE_YAHOO=1.
 * Falls back to FixtureProvider on any error.
 */
export class YahooFinanceProvider implements DataProvider {
  private apiBase: string;
  private fallback: FixtureProvider;

  readonly info: DataProviderInfo = {
    id: 'yahoo',
    name: 'Yahoo Finance',
    description: 'Real market data via yfinance — requires network',
    requiresNetwork: true,
  };

  constructor(apiBase: string = 'http://127.0.0.1:8000') {
    this.apiBase = apiBase;
    this.fallback = new FixtureProvider();
  }

  async fetchCandles(req: FetchCandlesRequest): Promise<Candle[]> {
    try {
      const url = `${this.apiBase}/api/v1/yahoo/candles?symbol=${encodeURIComponent(req.symbol)}&timeframe=${encodeURIComponent(req.timeframe)}&range=${encodeURIComponent(req.range)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as Candle[];
      }
      throw new Error('Empty response');
    } catch {
      // Fallback to fixture data
      console.warn(`[YahooFinanceProvider] fetch failed for ${req.symbol}, falling back to fixtures`);
      return this.fallback.fetchCandles(req);
    }
  }
}

// ── Provider Registry ──────────────────────────────────────────────────────

export type DataSourceId = 'fixture' | 'cached' | 'yahoo';

const fixtureProvider = new FixtureProvider();
const cachedYahoo = new CachedProvider(new YahooFinanceProvider());

const PROVIDERS: Record<DataSourceId, DataProvider> = {
  fixture: fixtureProvider,
  cached: cachedYahoo,
  yahoo: new YahooFinanceProvider(),
};

export function getProvider(id: DataSourceId): DataProvider {
  return PROVIDERS[id] ?? fixtureProvider;
}

export function getAvailableProviders(): DataProviderInfo[] {
  return Object.values(PROVIDERS).map((p) => p.info);
}

export function getDefaultProvider(): DataProvider {
  return fixtureProvider;
}
