# Rate Limiting

Tiered rate limiting across all API endpoints with configurable quotas by subscription tier. Rate limit state is communicated via standard HTTP response headers.

## Table of Contents

- [Overview](#overview)
- [Response Headers](#response-headers)
- [Tier Limits](#tier-limits)
- [Endpoint Categories](#endpoint-categories)
- [WebSocket Limits](#websocket-limits)
- [Retry-After Handling](#retry-after-handling)
- [Client Implementation](#client-implementation)
- [Best Practices](#best-practices)

## Overview

Rate limits are enforced per user account using a sliding window algorithm. Each endpoint category has independent quotas. Exceeding a limit returns `429 Too Many Requests` with a `Retry-After` header.

## Response Headers

Every API response includes rate limit headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window | `60` |
| `X-RateLimit-Remaining` | Requests remaining in the current window | `42` |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets | `1709312460` |
| `X-RateLimit-Category` | Which category the endpoint belongs to | `market_data` |
| `Retry-After` | Seconds to wait before retrying (only on 429 responses) | `12` |

```typescript
// Example response headers
{
  'X-RateLimit-Limit': '300',
  'X-RateLimit-Remaining': '298',
  'X-RateLimit-Reset': '1709312460',
  'X-RateLimit-Category': 'market_data'
}
```

## Tier Limits

### Free Tier

| Category | Requests/min | Burst |
|----------|-------------|-------|
| Market Data (quotes) | 30 | 10 |
| Market Data (historical) | 10 | 5 |
| Trading (orders) | 10 | 3 |
| Portfolio | 30 | 10 |
| Options | 15 | 5 |
| News | 20 | 10 |
| Screener | 5 | 2 |
| Backtest | 5/hour | 1 |
| Analytics | 5 | 2 |
| Alerts | 5 | 3 |

### Pro Tier

| Category | Requests/min | Burst |
|----------|-------------|-------|
| Market Data (quotes) | 300 | 50 |
| Market Data (historical) | 60 | 20 |
| Trading (orders) | 60 | 15 |
| Portfolio | 120 | 30 |
| Options | 60 | 20 |
| News | 120 | 30 |
| Screener | 30 | 10 |
| Backtest | 30/hour | 5 |
| Analytics | 30 | 10 |
| Alerts | 30 | 10 |

### Enterprise Tier

| Category | Requests/min | Burst |
|----------|-------------|-------|
| Market Data (quotes) | 3000 | 500 |
| Market Data (historical) | 600 | 100 |
| Trading (orders) | 600 | 100 |
| Portfolio | 600 | 100 |
| Options | 300 | 50 |
| News | 600 | 100 |
| Screener | 150 | 30 |
| Backtest | 200/hour | 20 |
| Analytics | 150 | 30 |
| Alerts | 120 | 30 |

## Endpoint Categories

Each API endpoint belongs to a rate limit category. Requests to different endpoints in the same category share the same quota.

| Category | Endpoints |
|----------|-----------|
| `market_data` | `/api/market-data/*` |
| `trading` | `/api/orders/*`, `/api/positions/*` |
| `portfolio` | `/api/portfolio/*` |
| `options` | `/api/options/*` |
| `news` | `/api/news/*` |
| `screener` | `/api/screener/*`, `/api/scanner/*` |
| `backtest` | `/api/backtest/*` |
| `analytics` | `/api/analytics/*` |
| `alerts` | `/api/alerts/*` |
| `auth` | `/api/auth/*` (special: 5 login attempts per 15 min) |

## WebSocket Limits

WebSocket connections have separate limits:

| Tier | Max Connections | Max Subscriptions | Inbound Messages/sec |
|------|----------------|------------------|---------------------|
| Free | 1 | 10 | 5 |
| Pro | 3 | 100 | 30 |
| Enterprise | 10 | 1000 | 200 |

Exceeding WebSocket limits sends an error message on the socket (code `4003` or `4007`) rather than closing the connection.

## Retry-After Handling

When a `429` response is received, the `Retry-After` header indicates how many seconds to wait.

```typescript
// 429 Response
{
  status: 429,
  headers: {
    'Retry-After': '8',
    'X-RateLimit-Limit': '60',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': '1709312468'
  },
  body: {
    code: 4290,
    message: 'Rate limit exceeded for category: market_data',
    retryAfter: 8
  }
}
```

## Client Implementation

The `client.ts` HTTP client handles rate limits with exponential backoff:

```typescript
async function handleRateLimit(error: AxiosError): Promise<AxiosResponse> {
  const retryAfter = parseInt(error.response?.headers['retry-after'] || '1', 10);
  const attempt = error.config?._retryCount || 0;

  if (attempt >= 3) throw error;

  const delay = retryAfter * 1000 + Math.random() * 500; // jitter
  await sleep(delay);

  error.config._retryCount = attempt + 1;
  return client(error.config);
}
```

The client also tracks `X-RateLimit-Remaining` and proactively throttles requests when approaching zero, avoiding 429s entirely where possible.

## Best Practices

- **Use WebSocket for real-time data** instead of polling REST endpoints
- **Batch requests** where possible (e.g., multi-symbol quotes in one call)
- **Cache responses** using the ETags and `Cache-Control` headers returned by the API
- **Implement backoff** using the `Retry-After` value rather than fixed delays
- **Monitor headers** — track `X-RateLimit-Remaining` to preemptively slow requests
- **Upgrade tier** if consistently hitting limits during normal usage patterns
- **Use cursor pagination** to reduce redundant page requests on changing datasets
