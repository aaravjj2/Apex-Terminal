# Caching Strategy

> Client-side caching layers that minimize network requests, speed up navigation, and enable offline-capable features in Apex Terminal.

---

## Table of Contents

- [Overview](#overview)
- [Caching Layer Diagram](#caching-layer-diagram)
- [API Client HTTP Cache](#api-client-http-cache)
- [IndexedDB for Large Datasets](#indexeddb-for-large-datasets)
- [localStorage for Settings](#localstorage-for-settings)
- [In-Memory Store Caching](#in-memory-store-caching)
- [Cache Invalidation Strategies](#cache-invalidation-strategies)
- [Stale-While-Revalidate Pattern](#stale-while-revalidate-pattern)
- [Cache Warming](#cache-warming)
- [TTL Management](#ttl-management)

---

## Overview

Apex Terminal caches data at four levels: in-memory Zustand stores for instant access, an HTTP cache layer in the API client for deduplicating network calls, IndexedDB for persisting large datasets like backtest results and workspace layouts, and localStorage for lightweight user preferences. Each level has distinct TTL rules and invalidation strategies.

---

## Caching Layer Diagram

```
Component Request
      │
      ▼
┌─────────────────┐  HIT   ┌───────────────────┐
│ React useMemo   │ ◄───── │ Memoized selectors │
└───────┬─────────┘         └───────────────────┘
        │ MISS
        ▼
┌─────────────────┐  HIT   ┌───────────────────┐
│ Zustand Store   │ ◄───── │ In-memory state   │
└───────┬─────────┘         └───────────────────┘
        │ MISS
        ▼
┌─────────────────┐  HIT   ┌───────────────────┐
│ API Client      │ ◄───── │ HTTP response cache│
└───────┬─────────┘         └───────────────────┘
        │ MISS
        ▼
┌─────────────────┐
│ Network Request │
└─────────────────┘
```

---

## API Client HTTP Cache

The `ApiClient` maintains an in-memory cache keyed by URL + query parameters:

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class HttpCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) this.store.delete(key);
    }
  }
}
```

### Per-Endpoint TTL Configuration

| Endpoint Pattern | TTL | Rationale |
|-----------------|-----|-----------|
| `/market-data/*/historical` | 60s | Historical data changes infrequently |
| `/market-data/*/quote` | 0 (no cache) | Real-time data via WebSocket instead |
| `/options/chain/*` | 30s | Chain updates on each expiry cycle |
| `/news/*` | 120s | News refreshes at moderate intervals |
| `/screener/scan` | 0 | Every scan should reflect latest data |
| `/portfolio/holdings` | 10s | Positions may change with fills |
| `/reference/symbols` | 3600s | Symbol universe changes rarely |

---

## IndexedDB for Large Datasets

Large or structured datasets are persisted in IndexedDB via the `useIndexedDB` hook and Zustand's `persist` middleware:

```typescript
const indexedDBStorage = createJSONStorage(() => ({
  getItem: async (name: string) => {
    const db = await openDB('apex-terminal', 1, {
      upgrade(db) {
        db.createObjectStore('stores');
        db.createObjectStore('backtests');
        db.createObjectStore('workspaces');
      },
    });
    return db.get('stores', name);
  },
  setItem: async (name: string, value: string) => {
    const db = await openDB('apex-terminal', 1);
    await db.put('stores', value, name);
  },
  removeItem: async (name: string) => {
    const db = await openDB('apex-terminal', 1);
    await db.delete('stores', name);
  },
}));
```

### What Lives in IndexedDB

| Object Store | Data | Typical Size |
|-------------|------|-------------|
| `backtests` | Run results, equity curves, trade logs | 1–50MB per run |
| `workspaces` | Layout configurations, widget positions, panel sizes | 5–100KB per workspace |
| `stores` | Persisted Zustand store snapshots (workspace, backtest) | 10KB–5MB |

IndexedDB is chosen over localStorage for these because localStorage has a 5–10MB limit and blocks the main thread on read/write.

---

## localStorage for Settings

Lightweight user preferences are stored in localStorage via Zustand's `persist` middleware:

```typescript
export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      theme: 'dark',
      chartDefaults: { type: 'candlestick', timeframe: '1D' },
      keyboardShortcuts: defaultShortcuts,
      // ...
    })),
    {
      name: 'apex-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        chartDefaults: state.chartDefaults,
        keyboardShortcuts: state.keyboardShortcuts,
      }),
    }
  )
);
```

| Key | Data | Size |
|-----|------|------|
| `apex-settings` | Theme, chart defaults, shortcuts | ~2KB |
| `apex-watchlists` | Symbol lists, column configuration | ~5KB |
| `apex-chart-prefs` | Indicator defaults, drawing tool preferences | ~3KB |

---

## In-Memory Store Caching

Zustand stores act as a fast in-memory cache layer. Once data is fetched and stored, subsequent accesses are instant:

```typescript
// First access: fetches from API and caches in store
const fetchHistorical = async (symbol: string, tf: string) => {
  const cached = get().dataCache[`${symbol}:${tf}`];
  if (cached && Date.now() - cached.fetchedAt < 60_000) return cached.data;

  const data = await marketDataApi.getHistorical(symbol, tf);
  set((state) => {
    state.dataCache[`${symbol}:${tf}`] = { data, fetchedAt: Date.now() };
  });
  return data;
};
```

Real-time WebSocket updates continually refresh the store cache, so components always read the latest state without explicit fetch calls.

---

## Cache Invalidation Strategies

| Trigger | Invalidation Scope |
|---------|-------------------|
| Symbol change | Clear all cached data for the previous symbol |
| Order fill | Invalidate portfolio holdings and position caches |
| Timeframe switch | Invalidate historical data for the current symbol |
| WebSocket reconnect | Resubscribe all channels, refresh all active quotes |
| Manual refresh (F5) | Full store rehydration from persistence layer |
| Settings change | Re-apply theme/chart defaults (no data invalidation) |

```typescript
eventBus.on('order:filled', () => {
  httpCache.invalidate('/portfolio');
  httpCache.invalidate('/positions');
  usePortfolioStore.getState().refresh();
});
```

---

## Stale-While-Revalidate Pattern

For non-critical data (news, screener metadata), the API client returns stale cached data immediately while fetching fresh data in the background:

```typescript
async function fetchWithSWR<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = httpCache.get<T>(key);

  if (cached) {
    fetcher().then((fresh) => {
      httpCache.set(key, fresh, TTL_MAP[key] ?? 60_000);
      useDataStore.getState().updateEntry(key, fresh);
    });
    return cached;
  }

  const data = await fetcher();
  httpCache.set(key, data, TTL_MAP[key] ?? 60_000);
  return data;
}
```

This eliminates loading spinners for repeat visits while ensuring data freshness.

---

## Cache Warming

On application startup, critical data is prefetched to eliminate loading delays:

```typescript
async function warmCaches() {
  const settings = useSettingsStore.getState();
  const watchlists = useWatchlistStore.getState().watchlists;

  const defaultSymbols = watchlists.flatMap((wl) => wl.symbols).slice(0, 20);

  await Promise.all([
    ...defaultSymbols.map((s) =>
      marketDataApi.getHistorical(s, settings.chartDefaults.timeframe)
    ),
    marketDataApi.getSymbolReference(),
  ]);
}
```

Cache warming runs after the initial render using `requestIdleCallback`, keeping the first paint fast while pre-populating data for the user's most likely interactions.

---

## TTL Management

All TTLs are centrally configured for consistency and easy tuning:

```typescript
const CACHE_TTLS = {
  HISTORICAL_DATA: 60_000,
  OPTIONS_CHAIN: 30_000,
  NEWS_FEED: 120_000,
  SYMBOL_REFERENCE: 3_600_000,
  PORTFOLIO_HOLDINGS: 10_000,
  SCREENER_METADATA: 300_000,
  USER_PREFERENCES: Infinity,
} as const;
```

In development, a debug panel displays cache hit/miss rates and current entry counts, accessible via the command palette (`Cmd+K` → "Cache Stats").
