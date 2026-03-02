# Database & Storage

> Client-side data persistence architecture using IndexedDB, localStorage, in-memory Zustand state, and service worker caching.

---

## Table of Contents

- [Overview](#overview)
- [Storage Tier Model](#storage-tier-model)
- [IndexedDB Schema](#indexeddb-schema)
- [localStorage Partitioning](#localstorage-partitioning)
- [In-Memory Zustand State](#in-memory-zustand-state)
- [Service Worker Cache](#service-worker-cache)
- [The useIndexedDB Hook](#the-useindexeddb-hook)
- [Data Migration Strategy](#data-migration-strategy)
- [Storage Quotas](#storage-quotas)
- [Cleanup Policies](#cleanup-policies)

---

## Overview

Apex Terminal operates as a thick client with all persistent storage happening in the browser. Data is distributed across four tiers based on size, access frequency, and durability requirements. The `useIndexedDB` hook provides typed CRUD operations with index queries, bulk operations, and migration support. Zustand's `persist` middleware bridges stores to both localStorage and IndexedDB backends.

---

## Storage Tier Model

| Tier | Technology | Capacity | Use Cases | Durability |
|------|-----------|----------|-----------|------------|
| **L1 — Memory** | Zustand stores | ~50-200 MB | Live prices, UI state, active orders | Session only |
| **L2 — localStorage** | Web Storage API | ~5-10 MB | Settings, preferences, flag overrides, small configs | Persistent |
| **L3 — IndexedDB** | IDB via `useIndexedDB` | ~100 MB-2 GB+ | Backtest results, workspaces, cached market data, drawings | Persistent |
| **L4 — Service Worker** | Cache API | ~100 MB+ | Static assets, API response cache, locale bundles | Persistent (versioned) |

Data flows downward on write (hot → cold) and upward on read (cold → hot). Active trading data lives in L1 for sub-millisecond access; historical data and large datasets reside in L3.

---

## IndexedDB Schema

The primary IndexedDB database is `apex-terminal` with versioned schema upgrades:

### Object Stores

| Store | Key Path | Indexes | Content |
|-------|----------|---------|---------|
| `backtests` | `id` | `strategyId`, `createdAt`, `symbol` | Backtest run results, equity curves, trade logs |
| `workspaces` | `id` | `name`, `updatedAt` | Layout configs, widget positions, panel state |
| `drawings` | `id` | `chartId`, `symbol`, `type` | Chart annotations, trend lines, fibonacci levels |
| `indicators` | `id` | `chartId`, `type` | Custom indicator configurations and state |
| `marketDataCache` | `key` | `symbol`, `timeframe`, `expiresAt` | Cached OHLCV data for offline/fast reload |
| `strategies` | `id` | `name`, `type` | User-defined backtest strategies |
| `reports` | `id` | `type`, `createdAt` | Generated portfolio and risk reports |
| `stores` | (key) | — | Zustand persist middleware serialized state |

### Store Configuration

```typescript
const DB_CONFIG: DBConfig = {
  name: 'apex-terminal',
  version: 3,
  stores: [
    {
      name: 'backtests',
      keyPath: 'id',
      indexes: [
        { name: 'strategyId', keyPath: 'strategyId' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'symbol', keyPath: 'symbol' },
      ],
    },
    {
      name: 'workspaces',
      keyPath: 'id',
      indexes: [
        { name: 'name', keyPath: 'name', unique: true },
        { name: 'updatedAt', keyPath: 'updatedAt' },
      ],
    },
    {
      name: 'marketDataCache',
      keyPath: 'key',
      indexes: [
        { name: 'symbol', keyPath: 'symbol' },
        { name: 'timeframe', keyPath: 'timeframe' },
        { name: 'expiresAt', keyPath: 'expiresAt' },
      ],
    },
  ],
  onUpgrade: (db, oldVersion, newVersion) => {
    console.log(`IDB upgrade: v${oldVersion} → v${newVersion}`);
  },
};
```

---

## localStorage Partitioning

localStorage keys are namespaced by domain to prevent collisions:

| Key Pattern | Size Estimate | Content |
|-------------|---------------|---------|
| `platform_locale` | ~5 bytes | Active locale code (`'en'`, `'ja'`) |
| `feature_flags` | ~2 KB | Persisted flag definitions |
| `feature_flag_overrides` | ~500 bytes | Active flag overrides |
| `feature_flag_audit` | ~5 KB | Last 100 audit entries |
| `permissions_state` | ~1 KB | User roles and resource permissions |
| `settings_*` | ~2 KB | Theme, chart defaults, keyboard shortcuts |
| `watchlist_*` | ~3 KB | Watchlist symbols and column configs |
| `chart_preferences` | ~1 KB | Default chart type, timeframe, scale |
| `analytics_session` | ~30 bytes | Current session ID |

Total estimated localStorage usage: **~15 KB** typical, **~50 KB** maximum. Well within the 5-10 MB browser limit.

---

## In-Memory Zustand State

The 37 Zustand stores hold all active session data. Stores are categorized by persistence strategy:

### Ephemeral (Memory Only)

| Store | Why Ephemeral |
|-------|---------------|
| `chartStore` (partial) | Active crosshair, zoom state, replay position |
| `orderStore` | In-progress order tickets (not yet submitted) |
| `positionStore` | Live P&L recalculated from WebSocket ticks |
| `newsStore` | Real-time news feed (re-fetched on load) |
| `screeningStore` | Active scan results (re-run on demand) |

### Persisted to localStorage

```typescript
create<SettingsState>()(
  persist(
    immer((set) => ({ /* ... */ })),
    {
      name: 'settings-store',
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

### Persisted to IndexedDB

For stores with large payloads (backtest results, workspace layouts):

```typescript
const indexedDBStorage = createJSONStorage(() => ({
  getItem: async (name) => {
    const db = await openDB('apex-terminal', 3);
    return db.get('stores', name);
  },
  setItem: async (name, value) => {
    const db = await openDB('apex-terminal', 3);
    await db.put('stores', value, name);
  },
  removeItem: async (name) => {
    const db = await openDB('apex-terminal', 3);
    await db.delete('stores', name);
  },
}));
```

---

## Service Worker Cache

The `ServiceWorkerManager` (`lib/platform/serviceWorker.ts`) manages versioned caches with route-based strategies:

| Cache Name | Strategy | Content | Max Age |
|------------|----------|---------|---------|
| `static-v{n}` | cache-first | JS/CSS bundles, fonts, images | Until new version |
| `api-v{n}` | stale-while-revalidate | REST API responses | 5 min |
| `locale-v{n}` | cache-first | Translation JSON bundles | Until new version |
| `market-data` | network-first | Real-time quotes (fallback to last known) | 30 sec |

Cache versions are tied to the `cacheVersion` field in `SWConfig`. On activation, old caches are purged. The service worker also supports background sync for queuing failed API requests (order submissions) for retry when connectivity returns.

---

## The useIndexedDB Hook

The `useIndexedDB` hook provides a complete typed interface for IndexedDB operations:

```typescript
const db = useIndexedDB<BacktestResult>(DB_CONFIG);

// CRUD
await db.put('backtests', result);
const run = await db.get('backtests', runId);
await db.delete('backtests', runId);

// Bulk operations
await db.bulkPut('marketDataCache', candles);

// Index queries
const bySymbol = await db.getByIndex('backtests', 'symbol', 'AAPL');
const recent = await db.query('backtests', {
  index: 'createdAt',
  direction: 'prev',
  limit: 20,
});

// Conditional operations
await db.deleteWhere('marketDataCache', (entry) => entry.expiresAt < Date.now());
await db.updateWhere('workspaces', (ws) => ws.id === activeId, (ws) => ({ ...ws, lastOpened: Date.now() }));
```

The hook manages database lifecycle (open, upgrade, close) and exposes connection status (`closed`, `opening`, `open`, `upgrading`, `error`).

---

## Data Migration Strategy

Schema upgrades are handled in the `onupgradeneeded` callback during `indexedDB.open()`:

```typescript
onUpgrade: (db, oldVersion, newVersion) => {
  if (oldVersion < 2) {
    // v1 → v2: Add marketDataCache store
    // Store creation handled automatically by useIndexedDB config
  }
  if (oldVersion < 3) {
    // v2 → v3: Add expiresAt index to marketDataCache
    // Index creation handled automatically if not already present
  }
}
```

The `useIndexedDB` hook automatically creates missing stores and indexes during upgrade. Existing stores are preserved — only new stores/indexes are added. For data transformation migrations, the `onUpgrade` callback provides direct `IDBDatabase` access.

Version bumps in `DBConfig.version` trigger the upgrade path. Each version increment should be additive to support users upgrading from any prior version.

---

## Storage Quotas

Browser storage limits vary but generally follow:

| Browser | IndexedDB | localStorage | Cache API |
|---------|-----------|-------------|-----------|
| Chrome | ~60% of disk (per origin) | 5 MB | Part of IDB quota |
| Firefox | ~50% of disk | 5 MB | Separate quota |
| Safari | ~1 GB (may prompt) | 5 MB | Part of origin quota |

The platform monitors storage usage via the Storage API:

```typescript
if (navigator.storage?.estimate) {
  const { usage, quota } = await navigator.storage.estimate();
  const usedMB = (usage ?? 0) / 1024 / 1024;
  const quotaMB = (quota ?? 0) / 1024 / 1024;
  const percentUsed = ((usage ?? 0) / (quota ?? 1)) * 100;
}
```

When usage exceeds 80%, the cleanup policy activates.

---

## Cleanup Policies

Automatic cleanup prevents storage exhaustion:

| Target | Trigger | Action |
|--------|---------|--------|
| `marketDataCache` | `expiresAt < now` | Delete expired entries on app startup |
| `backtests` | >100 runs stored | Delete oldest runs beyond the limit |
| `reports` | >50 reports, oldest >30 days | Prune oldest reports |
| Service worker cache | Version mismatch | Purge all caches from previous version |
| localStorage audit logs | >100 entries | Trim to most recent 100 |
| Analytics breadcrumbs | >50 entries | FIFO eviction in memory |

The `deleteWhere` operation from `useIndexedDB` powers most cleanup:

```typescript
await db.deleteWhere('marketDataCache', (entry) => entry.expiresAt < Date.now());
```

Users can trigger a full data reset from Settings, which calls `indexedDB.deleteDatabase('apex-terminal')`, clears all namespaced localStorage keys, and unregisters the service worker.
