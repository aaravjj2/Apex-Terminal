# API Integration Quickstart

> Connect to Apex Terminal's FastAPI backend for market data, order management, and real-time streaming.

The backend exposes REST endpoints and WebSocket streams on port 8000. This guide covers authentication, core endpoints, and code examples in Python and JavaScript.

---

## Table of Contents

1. [Base URL and Authentication](#base-url-and-authentication)
2. [Making Your First API Call](#making-your-first-api-call)
3. [Fetching Market Data](#fetching-market-data)
4. [Submitting Orders](#submitting-orders)
5. [WebSocket Subscription](#websocket-subscription)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Rate Limits](#rate-limits)
9. [Tips](#tips)

---

## Base URL and Authentication

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:8000` |
| Production | `https://api.your-domain.com` |

### Authentication

All requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-api-token>
```

Obtain a token via the login endpoint:

```
POST /auth/login
Content-Type: application/json

{"username": "your-user", "password": "your-pass"}
```

Response:

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

> **Warning:** Store tokens securely. Never commit them to version control or expose in client-side code.

---

## Making Your First API Call

Verify connectivity with the health endpoint:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status": "ok", "version": "1.0.0", "uptime": 3600}
```

No authentication required for the health endpoint.

---

## Fetching Market Data

### Current Quote

```
GET /api/v1/quote/{symbol}
```

Response:

```json
{
  "symbol": "AAPL",
  "price": 185.50,
  "change": 2.30,
  "change_percent": 1.25,
  "volume": 52340000,
  "timestamp": "2025-01-15T16:00:00Z"
}
```

### Historical Bars

```
GET /api/v1/bars/{symbol}?timeframe=1D&start=2024-01-01&end=2025-01-01
```

Response:

```json
{
  "symbol": "AAPL",
  "timeframe": "1D",
  "bars": [
    {"time": "2024-01-02", "open": 180.0, "high": 182.5, "low": 179.0, "close": 181.2, "volume": 45000000},
    {"time": "2024-01-03", "open": 181.2, "high": 183.0, "low": 180.5, "close": 182.8, "volume": 38000000}
  ]
}
```

---

## Submitting Orders

```
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "symbol": "AAPL",
  "side": "buy",
  "type": "limit",
  "quantity": 100,
  "price": 185.00,
  "time_in_force": "day"
}
```

Response:

```json
{
  "order_id": "ord_abc123",
  "status": "pending",
  "symbol": "AAPL",
  "side": "buy",
  "type": "limit",
  "quantity": 100,
  "price": 185.00,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Order Types

| Type | Required Fields |
|------|----------------|
| `market` | symbol, side, quantity |
| `limit` | symbol, side, quantity, price |
| `stop` | symbol, side, quantity, stop_price |
| `stop_limit` | symbol, side, quantity, price, stop_price |
| `bracket` | symbol, side, quantity, price, take_profit, stop_loss |

---

## WebSocket Subscription

Connect for real-time streaming:

```
ws://localhost:8000/ws
```

### Subscribe to Price Updates

```json
{"action": "subscribe", "channel": "quotes", "symbols": ["AAPL", "MSFT", "GOOG"]}
```

### Incoming Messages

```json
{"channel": "quotes", "symbol": "AAPL", "price": 185.55, "volume": 52341000, "timestamp": "2025-01-15T10:30:01Z"}
```

### Subscribe to Order Updates

```json
{"action": "subscribe", "channel": "orders"}
```

### Unsubscribe

```json
{"action": "unsubscribe", "channel": "quotes", "symbols": ["GOOG"]}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_SYMBOL",
    "message": "Symbol 'XYZ123' not found",
    "details": {}
  }
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request — check parameters |
| 401 | Unauthorized — invalid or expired token |
| 404 | Resource not found |
| 429 | Rate limited — slow down |
| 500 | Server error — report the issue |

---

## Code Examples

### Python

```python
import requests

BASE = "http://localhost:8000"
TOKEN = "your-token-here"
headers = {"Authorization": f"Bearer {TOKEN}"}

quote = requests.get(f"{BASE}/api/v1/quote/AAPL", headers=headers).json()
print(f"AAPL: ${quote['price']}")

order = requests.post(f"{BASE}/api/v1/orders", headers=headers, json={
    "symbol": "AAPL", "side": "buy", "type": "limit",
    "quantity": 10, "price": 185.00, "time_in_force": "day"
}).json()
print(f"Order ID: {order['order_id']}")
```

### JavaScript

```javascript
const BASE = 'http://localhost:8000';
const TOKEN = 'your-token-here';
const headers = { Authorization: `Bearer ${TOKEN}` };

const quote = await fetch(`${BASE}/api/v1/quote/AAPL`, { headers }).then(r => r.json());
console.log(`AAPL: $${quote.price}`);

const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', channel: 'quotes', symbols: ['AAPL'] }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| REST (authenticated) | 120 requests/minute |
| REST (unauthenticated) | 30 requests/minute |
| WebSocket messages | 60 messages/minute |

Exceeding limits returns HTTP 429. Use the `Retry-After` header value to determine when to retry.

---

## Tips

- **Use WebSockets for real-time data** — polling REST endpoints is inefficient and counts against rate limits.
- **Cache historical data** — bars for past dates don't change, so cache them locally.
- **Handle reconnection** — WebSocket connections can drop. Implement automatic reconnect with exponential backoff.
- **Validate before submitting** — check order parameters client-side before calling the API to reduce rejected orders.

---

*Next: [Troubleshooting](TROUBLESHOOTING.md) for common issues and fixes.*
