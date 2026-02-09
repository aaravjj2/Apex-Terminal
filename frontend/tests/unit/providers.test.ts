/**
 * Unit Tests — Data Providers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FixtureProvider,
  CachedProvider,
  buildCacheKey,
  getProvider,
  getAvailableProviders,
  getDefaultProvider,
} from '../../src/features/data/providers';
import type { FetchCandlesRequest } from '../../src/features/data/providers';

describe('FixtureProvider', () => {
  const provider = new FixtureProvider();

  it('returns candles for valid request', async () => {
    const candles = await provider.fetchCandles({
      symbol: 'AAPL',
      timeframe: '1m',
      range: '1d',
    });
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[0]).toHaveProperty('open');
    expect(candles[0]).toHaveProperty('high');
    expect(candles[0]).toHaveProperty('low');
    expect(candles[0]).toHaveProperty('close');
    expect(candles[0]).toHaveProperty('volume');
    expect(candles[0]).toHaveProperty('time');
  });

  it('returns deterministic data for same symbol', async () => {
    const c1 = await provider.fetchCandles({ symbol: 'SPY', timeframe: '1m', range: '1d' });
    const c2 = await provider.fetchCandles({ symbol: 'SPY', timeframe: '1m', range: '1d' });
    expect(c1.length).toBe(c2.length);
    // Prices should be identical since seeded from same symbol
    expect(c1[0].open).toBe(c2[0].open);
    expect(c1[0].close).toBe(c2[0].close);
    expect(c1[c1.length - 1].close).toBe(c2[c2.length - 1].close);
  });

  it('returns different data for different symbols', async () => {
    const c1 = await provider.fetchCandles({ symbol: 'AAPL', timeframe: '1m', range: '1d' });
    const c2 = await provider.fetchCandles({ symbol: 'MSFT', timeframe: '1m', range: '1d' });
    expect(c1[0].open).not.toBe(c2[0].open);
  });

  it('candles have monotonically increasing time', async () => {
    const candles = await provider.fetchCandles({ symbol: 'NVDA', timeframe: '1m', range: '1d' });
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time).toBeGreaterThan(candles[i - 1].time);
    }
  });

  it('high >= max(open, close) and low <= min(open, close)', async () => {
    const candles = await provider.fetchCandles({ symbol: 'AAPL', timeframe: '5m', range: '5d' });
    for (const c of candles.slice(0, 50)) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    }
  });

  it('provider info is correct', () => {
    expect(provider.info.id).toBe('fixture');
    expect(provider.info.requiresNetwork).toBe(false);
  });
});

describe('CachedProvider', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      get length() { return Object.keys(storage).length; },
      key: (i: number) => Object.keys(storage)[i] ?? null,
    });
  });

  it('caches results after first fetch', async () => {
    const inner = new FixtureProvider();
    const cached = new CachedProvider(inner, 60_000);

    const req: FetchCandlesRequest = { symbol: 'AAPL', timeframe: '1m', range: '1d' };
    const first = await cached.fetchCandles(req);
    expect(Object.keys(storage).length).toBe(1);

    // Second fetch should return cached
    const second = await cached.fetchCandles(req);
    expect(first.length).toBe(second.length);
    expect(first[0].open).toBe(second[0].open);
  });

  it('cache key is deterministic', () => {
    const key = buildCacheKey({ symbol: 'SPY', timeframe: '5m', range: '3mo' });
    expect(key).toBe('mktdata:SPY:5m:3mo');
  });

  it('clearCache removes all mktdata keys', async () => {
    const inner = new FixtureProvider();
    const cached = new CachedProvider(inner, 60_000);

    await cached.fetchCandles({ symbol: 'A', timeframe: '1m', range: '1d' });
    await cached.fetchCandles({ symbol: 'B', timeframe: '1m', range: '1d' });
    expect(Object.keys(storage).length).toBe(2);

    cached.clearCache();
    expect(Object.keys(storage).length).toBe(0);
  });

  it('expired cache re-fetches', async () => {
    const inner = new FixtureProvider();
    const cached = new CachedProvider(inner, 1); // 1ms TTL

    const req: FetchCandlesRequest = { symbol: 'AAPL', timeframe: '1m', range: '1d' };
    await cached.fetchCandles(req);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 10));

    // Should re-fetch (not use stale cache)
    const spy = vi.spyOn(inner, 'fetchCandles');
    await cached.fetchCandles(req);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('Provider Registry', () => {
  it('getProvider("fixture") returns FixtureProvider', () => {
    const p = getProvider('fixture');
    expect(p.info.id).toBe('fixture');
  });

  it('getDefaultProvider returns fixture', () => {
    const p = getDefaultProvider();
    expect(p.info.id).toBe('fixture');
  });

  it('getAvailableProviders returns 3 providers', () => {
    const providers = getAvailableProviders();
    expect(providers.length).toBe(3);
    expect(providers.map((p) => p.id)).toContain('fixture');
  });
});
