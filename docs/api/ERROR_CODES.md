# Error Codes

Standardized error response format and complete error code reference for the Apex Terminal API. All errors follow a consistent JSON structure across REST and WebSocket endpoints.

## Table of Contents

- [Error Response Format](#error-response-format)
- [Error Code Ranges](#error-code-ranges)
- [Authentication Errors (1000-1999)](#authentication-errors-1000-1999)
- [Trading Errors (2000-2999)](#trading-errors-2000-2999)
- [Data Errors (3000-3999)](#data-errors-3000-3999)
- [System Errors (4000-4999)](#system-errors-4000-4999)
- [Client Handling](#client-handling)

## Error Response Format

All error responses use a consistent JSON structure:

```typescript
interface ApiError {
  code: number;             // Numeric error code (unique across the API)
  message: string;          // Human-readable error description
  details?: {               // Additional context (varies by error)
    field?: string;         // Which field caused the error
    constraint?: string;    // What constraint was violated
    suggestion?: string;    // Recommended fix
    retryable?: boolean;    // Whether the request can be retried
    retryAfter?: number;    // Seconds to wait before retrying
    [key: string]: any;
  };
}

// Example error response
// HTTP 400 Bad Request
{
  "code": 2001,
  "message": "Invalid order parameters",
  "details": {
    "field": "price",
    "constraint": "Price must be positive for limit orders",
    "suggestion": "Provide a positive price value",
    "retryable": true
  }
}
```

For validation errors that affect multiple fields:

```typescript
// HTTP 422 Unprocessable Entity
{
  "code": 4100,
  "message": "Validation failed",
  "details": {
    "errors": [
      { "field": "quantity", "message": "Must be a positive integer" },
      { "field": "timeInForce", "message": "Invalid value 'GTCC', expected GTC|DAY|IOC|FOK" }
    ]
  }
}
```

## Error Code Ranges

| Range | Category | Description |
|-------|----------|-------------|
| 1000-1999 | Authentication | Login, tokens, sessions, permissions |
| 2000-2999 | Trading | Orders, positions, execution |
| 3000-3999 | Data | Market data, options, news, screening |
| 4000-4999 | System | Infrastructure, rate limits, validation |

## Authentication Errors (1000-1999)

| Code | HTTP Status | Message | Retryable |
|------|------------|---------|-----------|
| 1001 | 401 | Invalid credentials | No |
| 1002 | 401 | Access token expired | Yes (refresh) |
| 1003 | 401 | Refresh token expired or revoked | No (re-login) |
| 1004 | 401 | Token family revoked — possible token theft | No (re-login) |
| 1005 | 403 | MFA code required | Yes (with MFA) |
| 1006 | 403 | Invalid MFA code | Yes |
| 1007 | 403 | Insufficient permissions for this resource | No |
| 1008 | 403 | Feature not available on current tier | No |
| 1010 | 429 | Too many login attempts — account locked | Yes (after cooldown) |
| 1011 | 403 | Account suspended | No |
| 1012 | 401 | Malformed authorization header | No |

## Trading Errors (2000-2999)

| Code | HTTP Status | Message | Retryable |
|------|------------|---------|-----------|
| 2001 | 400 | Invalid order parameters | No (fix params) |
| 2002 | 400 | Insufficient buying power | No |
| 2003 | 404 | Order not found | No |
| 2004 | 409 | Order already filled or cancelled | No |
| 2005 | 400 | Market is closed | Yes (market open) |
| 2006 | 422 | Symbol is not tradeable | No |
| 2007 | 400 | Quantity exceeds maximum order size | No |
| 2008 | 400 | Price outside allowed range | No |
| 2009 | 409 | Duplicate client order ID | No |
| 2010 | 429 | Order rate limit exceeded | Yes |
| 2011 | 400 | Invalid bracket order configuration | No |
| 2012 | 400 | Cannot modify filled/cancelled order | No |
| 2020 | 503 | Order routing service unavailable | Yes |

## Data Errors (3000-3999)

| Code | HTTP Status | Message | Retryable |
|------|------------|---------|-----------|
| 3001 | 404 | Symbol not found | No |
| 3002 | 400 | Invalid timeframe | No |
| 3003 | 400 | Date range exceeds maximum | No |
| 3010 | 429 | Market data rate limit exceeded | Yes |
| 3020 | 503 | Market data feed unavailable | Yes |
| 3100 | 404 | No options available for symbol | No |
| 3101 | 400 | Invalid expiration date | No |
| 3102 | 400 | Strike out of available range | No |
| 3103 | 422 | Pricing model failed to converge | Yes |
| 3104 | 400 | Invalid strategy — requires at least one leg | No |
| 3200 | 400 | Invalid search query syntax | No |
| 3201 | 404 | No news found for symbol/query | No |
| 3300 | 400 | Invalid screener filter field | No |
| 3301 | 400 | Invalid operator for field type | No |
| 3302 | 400 | Too many screener filters (max 20) | No |
| 3303 | 404 | Preset screen not found | No |
| 3304 | 408 | Scan timeout — reduce scope | Yes |
| 3400 | 400 | Invalid backtest strategy definition | No |
| 3401 | 400 | Insufficient data for backtest date range | No |
| 3402 | 404 | Backtest job not found | No |
| 3403 | 400 | Parameter grid too large (max 50,000 combos) | No |
| 3404 | 408 | Backtest execution timeout | Yes |

## System Errors (4000-4999)

| Code | HTTP Status | Message | Retryable |
|------|------------|---------|-----------|
| 4000 | 500 | Internal server error | Yes |
| 4001 | 502 | Upstream service unavailable | Yes |
| 4002 | 503 | Service temporarily unavailable | Yes |
| 4003 | 504 | Gateway timeout | Yes |
| 4100 | 422 | Validation failed (multiple fields) | No |
| 4200 | 400 | Invalid JSON in request body | No |
| 4201 | 400 | Missing required field | No |
| 4202 | 400 | Invalid query parameter | No |
| 4290 | 429 | Rate limit exceeded | Yes |
| 4300 | 404 | Endpoint not found | No |
| 4301 | 405 | Method not allowed | No |
| 4400 | 413 | Request payload too large (max 1MB) | No |

## Client Handling

The `client.ts` API client categorizes errors for appropriate handling:

```typescript
function isRetryable(code: number): boolean {
  const retryableCodes = [1002, 2005, 2010, 2020, 3010, 3020, 3103, 3304, 3404, 4000, 4001, 4002, 4003, 4290];
  return retryableCodes.includes(code);
}

function getRetryDelay(error: ApiError, attempt: number): number {
  if (error.details?.retryAfter) return error.details.retryAfter * 1000;
  return Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 500;
}
```

### Error Categories for UI Display

| Category | Codes | UI Treatment |
|----------|-------|-------------|
| Auth expired | 1002, 1003 | Silent refresh or redirect to login |
| Permissions | 1007, 1008 | Show upgrade prompt |
| User input | 2001, 3002, 4100 | Inline field validation |
| Rate limit | 1010, 2010, 3010, 4290 | Toast with countdown |
| Service down | 2020, 3020, 4001, 4002 | Banner with auto-retry |
| Fatal | 1004, 1011 | Force logout |
