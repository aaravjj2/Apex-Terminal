# Market Data API

Real-time and historical market data for equities, forex, crypto, futures, and indices. All endpoints are proxied through Vite dev server at `http://localhost:5100/api`.

## Table of Contents

- [Endpoints](#endpoints)
- [Quote](#get-real-time-quote)
- [Historical OHLCV](#get-historical-data)
- [Intraday](#get-intraday-data)
- [Order Book](#get-order-book-depth)
- [Time & Sales](#get-recent-trades)
- [Symbol Search](#search-symbols)
- [Data Structures](#data-structures)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market-data/:symbol/quote` | Real-time quote with bid/ask |
| GET | `/api/market-data/:symbol/historical` | Historical OHLCV bars |
| GET | `/api/market-data/:symbol/intraday` | Intraday tick/bar data |
| GET | `/api/market-data/:symbol/depth` | L2 order book depth |
| GET | `/api/market-data/:symbol/trades` | Time & sales (recent trades) |
| GET | `/api/market-data/search` | Symbol search across exchanges |

## GET Real-Time Quote

Returns the latest quote for a given symbol including bid/ask spread and volume.

**Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol (e.g., `AAPL`, `EUR/USD`, `BTC-USD`) |
| `extended` | boolean | No | Include pre/post-market data (default: `false`) |

```typescript
const response = await marketDataApi.getQuote('AAPL');
// Response
interface Quote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  volume: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number; // Unix ms
}
```

## GET Historical Data

Returns OHLCV bars for the specified timeframe.

**Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol |
| `timeframe` | string | Yes | `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` |
| `from` | number | No | Start timestamp (Unix ms) |
| `to` | number | No | End timestamp (Unix ms) |
| `limit` | number | No | Max bars to return (default: 500, max: 5000) |

```typescript
const bars = await marketDataApi.getHistorical('AAPL', {
  timeframe: '1D',
  from: Date.now() - 365 * 86400000,
  limit: 252,
});
// Response
interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}
interface HistoricalResponse {
  symbol: string;
  timeframe: string;
  bars: OHLCVBar[];
  meta: { total: number; hasMore: boolean };
}
```

## GET Intraday Data

Tick-level or sub-minute bar data for the current trading session.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol |
| `resolution` | string | No | `tick`, `1s`, `5s`, `1m` (default: `1m`) |

## GET Order Book Depth

Level 2 order book with configurable depth levels.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol |
| `levels` | number | No | Number of price levels (default: 20, max: 50) |

```typescript
interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}
interface DepthResponse {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  spread: number;
  midPrice: number;
}
```

## GET Recent Trades

Time & sales feed of executed trades.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol |
| `limit` | number | No | Number of trades (default: 100, max: 1000) |
| `cursor` | string | No | Cursor for pagination |

## Search Symbols

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query (min 1 char) |
| `type` | string | No | `stock`, `forex`, `crypto`, `futures`, `index` |
| `exchange` | string | No | Exchange filter (e.g., `NASDAQ`, `NYSE`) |
| `limit` | number | No | Results count (default: 20) |

```typescript
const results = await marketDataApi.search('AAPL');
interface SearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'forex' | 'crypto' | 'futures' | 'index';
  exchange: string;
  currency: string;
}
```

## Data Structures

### Timeframes

| Code | Description | Max History |
|------|-------------|-------------|
| `1m` | 1 minute | 30 days |
| `5m` | 5 minutes | 60 days |
| `15m` | 15 minutes | 120 days |
| `1h` | 1 hour | 2 years |
| `4h` | 4 hours | 5 years |
| `1D` | Daily | 20+ years |
| `1W` | Weekly | 20+ years |
| `1M` | Monthly | 20+ years |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 404 | `3001` | Symbol not found |
| 400 | `3002` | Invalid timeframe |
| 400 | `3003` | Date range exceeds maximum |
| 429 | `3010` | Rate limit exceeded |
| 503 | `3020` | Market data feed unavailable |

## Rate Limits

Market data endpoints are rate-limited per tier:

| Tier | Quotes/min | Historical/min | Depth/min |
|------|-----------|----------------|-----------|
| Free | 30 | 10 | 5 |
| Pro | 300 | 60 | 30 |
| Enterprise | 3000 | 600 | 300 |

Responses include `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. The API client in `client.ts` automatically handles `429` responses with exponential backoff.
