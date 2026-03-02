# Pagination

Two pagination strategies: **cursor-based** for real-time/streaming data and **offset-based** for historical/static data. All paginated responses share a consistent metadata format.

## Table of Contents

- [Response Format](#response-format)
- [Cursor-Based Pagination](#cursor-based-pagination)
- [Offset-Based Pagination](#offset-based-pagination)
- [Sorting](#sorting)
- [Filtering Integration](#filtering-integration)
- [Endpoint Pagination Matrix](#endpoint-pagination-matrix)
- [Client Usage](#client-usage)
- [Best Practices](#best-practices)

## Response Format

All paginated endpoints return data in a consistent envelope:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;            // Total matching records (-1 if unknown/expensive)
    page?: number;            // Current page (offset-based only)
    pageSize: number;         // Items per page
    hasMore: boolean;         // Whether more results exist
    cursor?: string;          // Next cursor (cursor-based only)
    prevCursor?: string;      // Previous cursor (cursor-based only)
  };
}
```

## Cursor-Based Pagination

Used for data that changes frequently (orders, trades, news, alerts). Cursors are opaque strings encoding the position in the result set. They remain stable even when new records are inserted.

### Request

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `cursor` | string | No | Opaque cursor from previous response (omit for first page) |
| `limit` | number | No | Page size (default varies by endpoint, max: 200) |
| `direction` | string | No | `forward` or `backward` (default: `forward`) |

### Example

```typescript
// First page
const page1 = await client.get('/api/orders', { params: { limit: 20 } });
// {
//   data: [...20 orders...],
//   meta: { total: 156, pageSize: 20, hasMore: true, cursor: 'eyJpZCI6Im9yZF8wNTAi...' }
// }

// Next page
const page2 = await client.get('/api/orders', {
  params: { limit: 20, cursor: page1.meta.cursor },
});

// Previous page (backward navigation)
const prev = await client.get('/api/orders', {
  params: { limit: 20, cursor: page2.meta.prevCursor, direction: 'backward' },
});
```

### Cursor Stability

Cursors point to a specific record and direction, so they remain valid even when new data is inserted. They expire after 24 hours of inactivity. An expired cursor returns:

```typescript
// HTTP 400
{ "code": 4202, "message": "Cursor expired or invalid", "details": { "retryable": true, "suggestion": "Re-fetch from the beginning" } }
```

## Offset-Based Pagination

Used for stable, historical datasets (historical bars, backtest results, screener scans). Simpler but subject to drift when data is modified between page requests.

### Request

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number, 1-indexed (default: 1) |
| `limit` | number | No | Page size (default: 50, max: 500) |
| `offset` | number | No | Alternative to `page` — number of records to skip |

### Example

```typescript
// Page 1
const page1 = await client.get('/api/market-data/AAPL/historical', {
  params: { timeframe: '1D', limit: 100, page: 1 },
});
// {
//   data: [...100 bars...],
//   meta: { total: 5024, page: 1, pageSize: 100, hasMore: true }
// }

// Page 2
const page2 = await client.get('/api/market-data/AAPL/historical', {
  params: { timeframe: '1D', limit: 100, page: 2 },
});
```

## Sorting

Paginated endpoints support sorting via `sort` and `order` parameters:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sort` | string | No | Field name to sort by (default varies by endpoint) |
| `order` | string | No | `asc` or `desc` (default: `desc` for time-series, `asc` for alphabetical) |

```typescript
// Orders sorted by creation time, newest first
await client.get('/api/orders', { params: { sort: 'createdAt', order: 'desc', limit: 20 } });

// Screener results sorted by market cap
await client.post('/api/screener/scan', {
  filters: [...],
  sort: { field: 'market_cap', direction: 'desc' },
  limit: 50,
});
```

### Sortable Fields by Endpoint

| Endpoint | Default Sort | Available Fields |
|----------|-------------|-----------------|
| `/api/orders` | `createdAt desc` | `createdAt`, `updatedAt`, `symbol`, `side`, `status` |
| `/api/news/latest` | `publishedAt desc` | `publishedAt`, `relevance`, `sentiment` |
| `/api/alerts` | `createdAt desc` | `createdAt`, `lastTriggeredAt`, `symbol`, `status` |
| `/api/screener/scan` | `market_cap desc` | Any column in response |
| `/api/market-data/*/historical` | `timestamp asc` | `timestamp` only |

## Filtering Integration

Filters can be combined with pagination and sorting. Filters are applied server-side before pagination.

```typescript
// Paginated, filtered, sorted query
const results = await client.get('/api/orders', {
  params: {
    status: 'filled',
    symbol: 'AAPL',
    from: '2026-01-01',
    to: '2026-02-28',
    sort: 'updatedAt',
    order: 'desc',
    limit: 25,
  },
});
```

For complex filters (screener), use POST with a JSON body:

```typescript
const scan = await client.post('/api/screener/scan', {
  filters: [
    { field: 'market_cap', operator: 'gte', value: 1e9 },
    { field: 'pe_ratio', operator: 'between', value: [10, 25] },
  ],
  sort: { field: 'change_pct', direction: 'desc' },
  limit: 50,
  offset: 0,
});
```

## Endpoint Pagination Matrix

| Endpoint | Strategy | Default Limit | Max Limit |
|----------|----------|--------------|-----------|
| `GET /api/orders` | Cursor | 50 | 200 |
| `GET /api/positions` | None (all) | — | — |
| `GET /api/market-data/*/historical` | Offset | 500 | 5000 |
| `GET /api/market-data/*/trades` | Cursor | 100 | 1000 |
| `GET /api/news/*` | Cursor | 20 | 100 |
| `GET /api/alerts` | Cursor | 50 | 200 |
| `POST /api/screener/scan` | Offset | 50 | 500 |
| `GET /api/portfolio/holdings` | None (all) | — | — |
| `GET /api/backtest/results/:id` | None (all) | — | — |

## Client Usage

The `client.ts` utility includes pagination helpers:

```typescript
async function* paginate<T>(
  endpoint: string,
  params: Record<string, any> = {},
  pageSize = 50
): AsyncGenerator<T[]> {
  let cursor: string | undefined;
  do {
    const response = await client.get<PaginatedResponse<T>>(endpoint, {
      params: { ...params, limit: pageSize, cursor },
    });
    yield response.data.data;
    cursor = response.data.meta.cursor;
  } while (cursor);
}

// Usage: iterate all filled orders
for await (const batch of paginate<Order>('/api/orders', { status: 'filled' })) {
  processBatch(batch);
}
```

## Best Practices

- **Use cursor-based pagination** for live data to avoid duplicates or missed records
- **Use offset-based pagination** for historical data where random page access is needed
- **Set reasonable page sizes** — larger pages reduce round trips but increase latency; 50-100 is a good default
- **Don't rely on `total` for cursor pagination** — it may be approximate (`-1`) for large or real-time datasets
- **Cache cursors client-side** for back/forward navigation within a session
- **Handle cursor expiration** gracefully by restarting from the first page
- **Combine sorting with pagination** to ensure deterministic page ordering
