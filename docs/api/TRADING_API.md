# Trading API

Order management and position tracking for all supported asset classes. Supports market, limit, stop, stop-limit, and trailing-stop orders with bracket/OCO functionality.

## Table of Contents

- [Endpoints](#endpoints)
- [Create Order](#post-create-order)
- [List Orders](#get-list-orders)
- [Modify Order](#patch-modify-order)
- [Cancel Order](#delete-cancel-order)
- [Positions](#get-positions)
- [Bracket Orders](#post-bracket-order)
- [Order Types](#order-types)
- [Time In Force](#time-in-force)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Create a new order |
| GET | `/api/orders` | List orders with filters |
| PATCH | `/api/orders/:id` | Modify a pending order |
| DELETE | `/api/orders/:id` | Cancel a pending order |
| GET | `/api/positions` | Get open positions |
| POST | `/api/orders/bracket` | Create bracket (OCO) order |

## POST Create Order

```typescript
interface CreateOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  quantity: number;
  price?: number;         // Required for limit, stop_limit
  stopPrice?: number;     // Required for stop, stop_limit
  trailAmount?: number;   // Required for trailing_stop
  trailPercent?: number;  // Alternative to trailAmount
  timeInForce: 'GTC' | 'DAY' | 'IOC' | 'FOK';
  clientOrderId?: string; // Idempotency key
}

const order = await tradingApi.createOrder({
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  price: 185.50,
  timeInForce: 'DAY',
});

interface OrderResponse {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  quantity: number;
  filledQuantity: number;
  averagePrice: number | null;
  price: number | null;
  stopPrice: number | null;
  timeInForce: string;
  createdAt: string;
  updatedAt: string;
}
```

## GET List Orders

**Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | `open`, `filled`, `cancelled`, `all` (default: `open`) |
| `symbol` | string | No | Filter by symbol |
| `side` | string | No | `buy` or `sell` |
| `from` | string | No | ISO 8601 start date |
| `to` | string | No | ISO 8601 end date |
| `limit` | number | No | Page size (default: 50, max: 200) |
| `cursor` | string | No | Pagination cursor |

## PATCH Modify Order

Only pending/open orders can be modified. Quantity, price, and stop price can be changed.

```typescript
await tradingApi.modifyOrder('ord_abc123', {
  price: 186.00,
  quantity: 150,
});
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Order ID (path param) |
| `price` | number | No | New limit price |
| `stopPrice` | number | No | New stop price |
| `quantity` | number | No | New quantity (must be >= filledQuantity) |

## DELETE Cancel Order

Cancels a pending or open order. Returns `204 No Content` on success.

```typescript
await tradingApi.cancelOrder('ord_abc123');
```

## GET Positions

Returns all open positions with real-time P&L calculations.

```typescript
interface Position {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  averageEntry: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  costBasis: number;
}
```

## POST Bracket Order

Creates an entry order with attached take-profit and stop-loss (OCO pair).

```typescript
const bracket = await tradingApi.createBracketOrder({
  entry: {
    symbol: 'AAPL',
    side: 'buy',
    type: 'limit',
    quantity: 100,
    price: 185.00,
    timeInForce: 'GTC',
  },
  takeProfit: { price: 195.00 },
  stopLoss: { stopPrice: 180.00 },
});
```

When the entry fills, the take-profit and stop-loss orders activate as an OCO pair — filling one automatically cancels the other.

## Order Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `market` | Executes immediately at best available price | `quantity` |
| `limit` | Executes at specified price or better | `quantity`, `price` |
| `stop` | Becomes market order when stop price is hit | `quantity`, `stopPrice` |
| `stop_limit` | Becomes limit order when stop price is hit | `quantity`, `price`, `stopPrice` |
| `trailing_stop` | Stop price trails market by fixed amount/percent | `quantity`, `trailAmount` or `trailPercent` |

## Time In Force

| Code | Name | Description |
|------|------|-------------|
| `GTC` | Good Till Cancelled | Remains active until filled or manually cancelled |
| `DAY` | Day Order | Expires at market close if unfilled |
| `IOC` | Immediate or Cancel | Fill immediately (partial OK), cancel remainder |
| `FOK` | Fill or Kill | Fill entire quantity immediately or cancel entirely |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `2001` | Invalid order parameters |
| 400 | `2002` | Insufficient buying power |
| 404 | `2003` | Order not found |
| 409 | `2004` | Order already filled/cancelled |
| 400 | `2005` | Market is closed |
| 422 | `2006` | Symbol not tradeable |
| 429 | `2010` | Order rate limit exceeded |

## Rate Limits

| Tier | Orders/min | Modifications/min |
|------|-----------|-------------------|
| Free | 10 | 20 |
| Pro | 60 | 120 |
| Enterprise | 600 | 1200 |
