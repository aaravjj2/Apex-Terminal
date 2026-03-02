# API Client Guide

Adding and consuming API endpoints in Apex Terminal.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [API Module Structure](#api-module-structure)
- [Typed Request and Response](#typed-request-and-response)
- [Using the apiClient](#using-the-apiclient)
- [Error Handling](#error-handling)
- [Caching Configuration](#caching-configuration)
- [Adding New Endpoints](#adding-new-endpoints)
- [Barrel Export](#barrel-export)
- [Do's and Don'ts](#dos-and-donts)

## Architecture Overview

All HTTP communication flows through `frontend/src/api/client.ts`, which provides:

- **Retry logic** with exponential backoff on 429/5xx status codes
- **Auth header injection** via configurable token getter
- **Request deduplication** — identical in-flight GET requests share a single fetch
- **LRU response cache** with configurable TTL
- **Error normalization** — all failures become typed `ApiError` subclasses
- **WebSocket helper** with auto-reconnect

Three singleton clients are exported:

| Client           | Purpose                       | Config                            |
| ---------------- | ----------------------------- | --------------------------------- |
| `apiClient`      | General requests              | 12s timeout, 3 retries            |
| `cachedApiClient`| Reference/slow-changing data  | Cache enabled, 30s TTL, 2 retries |
| `pollClient`     | Long-poll / streaming         | 30s timeout, 1 retry              |

The 17 API modules live in `frontend/src/api/`:

```
api/
├── client.ts          # Core client, error classes, WebSocket helper
├── index.ts           # Barrel export
├── marketDataApi.ts   # Quotes, bars, level2, trades, VWAP
├── tradingApi.ts      # Order submission, cancellation
├── portfolioApi.ts    # Holdings, allocations, P&L
├── optionsApi.ts      # Options chains, greeks
├── backtestApi.ts     # Strategy runs, results
├── screeningApi.ts    # Screener criteria, results
├── alertsApi.ts       # Alert CRUD
├── newsApi.ts         # News feed, sentiment
├── analyticsApi.ts    # Usage analytics
├── factorModelApi.ts  # Factor exposures
├── crossAssetApi.ts   # Cross-asset correlation
├── sectorApi.ts       # Sector rotation data
├── stressTestApi.ts   # Stress test scenarios
├── sentimentApi.ts    # Market sentiment indicators
└── macroApi.ts        # Macroeconomic data
```

## API Module Structure

Every API module follows this pattern:

```typescript
import { apiClient, cachedApiClient } from './client';

// ─── Types ──────────────────────────────────────────────────

export interface QuoteRequest { symbol: string; }
export interface Quote { symbol: string; last: number; /* ... */ }

// ─── API Functions ──────────────────────────────────────────

const BASE = '/api/market-data';

export async function getQuote(symbol: string): Promise<Quote> {
  return apiClient.get<Quote>(`${BASE}/quotes/${encodeURIComponent(symbol)}`);
}
```

## Typed Request and Response

Define request and response interfaces in the same module, co-located with the functions that use them:

```typescript
export interface BarRequest {
  symbol: string;
  timeframe: Timeframe;
  start: string;
  end: string;
  adjustSplits?: boolean;
  limit?: number;
}

export interface BarResponse {
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  nextPageToken?: string;
}

export async function getBars(params: BarRequest): Promise<BarResponse> {
  const { symbol, timeframe, start, end, adjustSplits, limit } = params;
  return apiClient.get<BarResponse>(
    `${BASE}/bars/${encodeURIComponent(symbol)}${qs({ timeframe, start, end, adjust_splits: adjustSplits, limit })}`,
    { useCache: true, cacheTtlMs: timeframeToTtl(timeframe) },
  );
}
```

Use a `qs()` helper to build query strings, filtering out `null`/`undefined` values:

```typescript
function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
```

## Using the apiClient

The client exposes typed HTTP methods:

```typescript
// GET — default method, supports caching and deduplication
const quote = await apiClient.get<Quote>('/api/market-data/quotes/AAPL');

// POST — body is auto-serialized to JSON
const order = await apiClient.post<OrderResponse>('/api/orders', {
  symbol: 'AAPL', side: 'buy', quantity: 100, type: 'limit', price: 185.50,
});

// PUT
await apiClient.put<void>('/api/alerts/123', { price: 190.00 });

// DELETE
await apiClient.delete<void>('/api/alerts/123');
```

Override per-request options:

```typescript
const data = await apiClient.get<HeavyPayload>('/api/analytics/report', {
  timeoutMs: 30000,
  useCache: true,
  cacheTtlMs: 60000,
});
```

## Error Handling

All errors are instances of `ApiError` (or its subclasses `NetworkError`, `TimeoutError`):

```typescript
import { ApiError, NetworkError, TimeoutError } from '@/api/client';

try {
  const quote = await getQuote('INVALID');
} catch (err) {
  if (err instanceof ApiError) {
    if (err.isAuthError) redirectToLogin();
    if (err.isRateLimit) showRateLimitToast();
    if (err.isTimeout) showTimeoutWarning();
    if (err.isNetworkError) showOfflineBanner();
    console.error(`[${err.statusCode}] ${err.endpoint}: ${err.detail}`);
  }
}
```

Properties on `ApiError`:

| Property        | Type      | Description                            |
| --------------- | --------- | -------------------------------------- |
| `statusCode`    | `number`  | HTTP status (0 for network errors)     |
| `detail`        | `string`  | Error message from server              |
| `endpoint`      | `string`  | Full URL that failed                   |
| `requestId`     | `string?` | `x-request-id` header from response    |
| `isServerError` | `boolean` | 5xx                                    |
| `isClientError` | `boolean` | 4xx                                    |
| `isAuthError`   | `boolean` | 401 or 403                             |
| `isRateLimit`   | `boolean` | 429                                    |
| `isTimeout`     | `boolean` | 408                                    |

## Caching Configuration

Use caching for data that doesn't change frequently:

```typescript
// Earnings data — cache 10 minutes
export async function getEarnings(symbol: string): Promise<EarningsData> {
  return cachedApiClient.get<EarningsData>(
    `${BASE}/earnings/${encodeURIComponent(symbol)}`,
    { useCache: true, cacheTtlMs: 600_000 },
  );
}
```

Invalidate cache when the user performs a mutation:

```typescript
export async function updateAlert(id: string, body: AlertUpdate): Promise<Alert> {
  const result = await apiClient.put<Alert>(`/api/alerts/${id}`, body);
  apiClient.invalidateCache('/api/alerts');
  return result;
}
```

## Adding New Endpoints

1. Create a new file `frontend/src/api/myFeatureApi.ts`.
2. Define request/response types.
3. Write async functions using `apiClient` or `cachedApiClient`.
4. Add the module to the barrel export in `frontend/src/api/index.ts`.

```typescript
// myFeatureApi.ts
import { apiClient } from './client';

export interface Widget { id: string; name: string; }

const BASE = '/api/widgets';

export async function getWidgets(): Promise<Widget[]> {
  return apiClient.get<Widget[]>(BASE);
}

export async function createWidget(name: string): Promise<Widget> {
  return apiClient.post<Widget>(BASE, { name });
}
```

## Barrel Export

Every API module must be re-exported from `frontend/src/api/index.ts`:

```typescript
export * from './client';
export * from './marketDataApi';
export * from './tradingApi';
export * from './myFeatureApi'; // ← add new modules here
```

This allows consumers to import from a single path:

```typescript
import { getQuote, submitOrder, getWidgets } from '@/api';
```

## Do's and Don'ts

**Do:**
- Use `encodeURIComponent` for path parameters (symbols can contain special characters)
- Set appropriate `cacheTtlMs` per endpoint — real-time data gets short TTLs, reference data longer
- Define types close to the API functions that use them
- Use `cachedApiClient` for slow-changing reference data (corporate actions, earnings)

**Don't:**
- Create a new `fetch()` call outside of the client — always use `apiClient`
- Put business logic in API modules — they are pure HTTP wrappers
- Store API responses in module-level variables — use Zustand stores for state
- Hardcode base URLs — they come from `VITE_API_URL` environment variable
- Skip error handling — every API call site should handle or propagate errors
