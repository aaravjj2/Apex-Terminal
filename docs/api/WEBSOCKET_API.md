# WebSocket API

Real-time bidirectional communication for live market data, order updates, alert triggers, and news. Connection endpoint is proxied through Vite at `ws://localhost:5100/ws` (backed by FastAPI on port 8000).

## Table of Contents

- [Connection](#connection)
- [Authentication](#authentication)
- [Message Format](#message-format)
- [Channels](#channels)
- [Subscription Management](#subscription-management)
- [Heartbeat](#heartbeat)
- [Reconnection](#reconnection-protocol)
- [Error Messages](#error-messages)
- [Rate Limits](#rate-limits)

## Connection

```typescript
const ws = new WebSocket('ws://localhost:5100/ws');
```

The server expects JSON messages. Connection is upgraded from HTTP to WebSocket via the standard handshake. The FastAPI backend handles WebSocket routing at `/ws`.

## Authentication

After opening the connection, send an authentication message within 5 seconds or the server will close the connection with code `4001`.

```typescript
// Client -> Server
{
  "type": "auth",
  "token": "eyJhbGciOi..."   // JWT access token
}

// Server -> Client (success)
{
  "type": "auth_ok",
  "userId": "usr_abc123",
  "tier": "pro",
  "maxSubscriptions": 100
}

// Server -> Client (failure)
{
  "type": "auth_error",
  "code": 1001,
  "message": "Invalid or expired token"
}
```

Token refresh is handled by sending a new `auth` message with an updated token at any time during the session. The server will re-validate without dropping existing subscriptions.

## Message Format

All messages are JSON with a `type` field.

```typescript
// Client -> Server (action messages)
interface ClientMessage {
  type: 'auth' | 'subscribe' | 'unsubscribe' | 'ping';
  [key: string]: any;
}

// Server -> Client (data messages)
interface ServerMessage {
  type: 'auth_ok' | 'auth_error' | 'data' | 'error' | 'pong' | 'subscribed' | 'unsubscribed';
  channel?: string;
  [key: string]: any;
}
```

## Channels

### `price` — Real-Time Quotes

```typescript
// Subscribe
{ "type": "subscribe", "channel": "price", "symbols": ["AAPL", "GOOGL", "BTC-USD"] }

// Data
{
  "type": "data",
  "channel": "price",
  "symbol": "AAPL",
  "price": 192.45,
  "bid": 192.44,
  "ask": 192.46,
  "volume": 42315600,
  "change": 1.23,
  "changePercent": 0.64,
  "timestamp": 1709312400000
}
```

### `depth` — Order Book L2

```typescript
// Subscribe
{ "type": "subscribe", "channel": "depth", "symbol": "AAPL", "levels": 10 }

// Data
{
  "type": "data",
  "channel": "depth",
  "symbol": "AAPL",
  "bids": [{ "price": 192.44, "size": 500 }, ...],
  "asks": [{ "price": 192.46, "size": 300 }, ...],
  "timestamp": 1709312400050
}
```

### `trades` — Time & Sales

```typescript
// Subscribe
{ "type": "subscribe", "channel": "trades", "symbol": "AAPL" }

// Data
{
  "type": "data",
  "channel": "trades",
  "symbol": "AAPL",
  "price": 192.45,
  "size": 100,
  "side": "buy",
  "timestamp": 1709312400123
}
```

### `orders` — Order Status Updates

Automatically subscribed upon authentication. Pushes status changes for all user orders.

```typescript
{
  "type": "data",
  "channel": "orders",
  "orderId": "ord_abc123",
  "status": "filled",
  "filledQuantity": 100,
  "averagePrice": 192.45,
  "timestamp": 1709312400200
}
```

### `alerts` — Alert Triggers

Automatically subscribed upon authentication.

```typescript
{
  "type": "data",
  "channel": "alerts",
  "alertId": "alert_xyz789",
  "symbol": "AAPL",
  "condition": "price_above",
  "triggerValue": 192.45,
  "message": "AAPL above $192.00",
  "timestamp": 1709312400300
}
```

### `news` — Breaking News

```typescript
// Subscribe
{ "type": "subscribe", "channel": "news", "symbols": ["AAPL"], "categories": ["earnings"] }

// Data
{
  "type": "data",
  "channel": "news",
  "articleId": "art_123",
  "title": "Apple Reports Record Q1 Revenue",
  "source": "reuters",
  "symbols": ["AAPL"],
  "sentiment": 0.72,
  "isBreaking": true,
  "publishedAt": "2026-02-28T16:30:00Z"
}
```

## Subscription Management

```typescript
// Subscribe to a channel
{ "type": "subscribe", "channel": "price", "symbols": ["AAPL", "GOOGL"] }

// Server confirms
{ "type": "subscribed", "channel": "price", "symbols": ["AAPL", "GOOGL"] }

// Unsubscribe
{ "type": "unsubscribe", "channel": "price", "symbols": ["GOOGL"] }

// Server confirms
{ "type": "unsubscribed", "channel": "price", "symbols": ["GOOGL"] }

// Unsubscribe from all symbols on a channel
{ "type": "unsubscribe", "channel": "price", "symbols": ["*"] }
```

## Heartbeat

The server sends a `ping` every 30 seconds. The client must respond with `pong` within 10 seconds. Two missed pongs will terminate the connection with close code `4002`.

```typescript
// Server -> Client
{ "type": "ping", "ts": 1709312400000 }

// Client -> Server
{ "type": "pong", "ts": 1709312400000 }
```

## Reconnection Protocol

The API client in `client.ts` implements automatic reconnection:

1. On unexpected disconnect, wait `1s` then attempt reconnect
2. Exponential backoff: `1s`, `2s`, `4s`, `8s`, `16s`, max `30s`
3. Add random jitter (0-500ms) to prevent thundering herd
4. On reconnect, re-authenticate and re-subscribe to all previous channels
5. After 10 consecutive failures, stop and emit a `connection_failed` event
6. Reset backoff counter on successful connection

## Error Messages

```typescript
{
  "type": "error",
  "code": number,
  "message": string,
  "channel"?: string
}
```

| Code | Description |
|------|-------------|
| `4001` | Authentication required or failed |
| `4002` | Heartbeat timeout |
| `4003` | Subscription limit exceeded |
| `4004` | Invalid channel name |
| `4005` | Invalid symbol |
| `4006` | Permission denied for channel |
| `4007` | Rate limit exceeded |
| `4008` | Invalid message format |

## Rate Limits

| Tier | Max Subscriptions | Messages/sec (inbound) | Price Symbols |
|------|------------------|----------------------|---------------|
| Free | 10 | 5 | 5 |
| Pro | 100 | 30 | 50 |
| Enterprise | 1000 | 200 | 500 |

Outbound data rate is not limited, but the server may throttle high-frequency channels (depth, trades) for lower tiers by reducing update frequency.
