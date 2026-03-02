# Data Dictionary

> Field definitions, types, and constraints for every data model in Apex Terminal.

## Table of Contents

- [OHLCV Bar Data](#ohlcv-bar-data)
- [Order Fields](#order-fields)
- [Position Fields](#position-fields)
- [Portfolio Fields](#portfolio-fields)
- [Options Chain Fields](#options-chain-fields)
- [News Article Fields](#news-article-fields)
- [Alert Fields](#alert-fields)
- [Watchlist Fields](#watchlist-fields)
- [User Preferences](#user-preferences)

---

## OHLCV Bar Data

Source: Market data WebSocket and REST API. Stored in `marketDataStore`.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `symbol` | `string` | Ticker symbol | `"AAPL"` |
| `timestamp` | `number` | Unix epoch (ms) at bar open | `1709251200000` |
| `open` | `number` | First trade price of the bar | `182.50` |
| `high` | `number` | Highest trade price in the bar | `184.20` |
| `low` | `number` | Lowest trade price in the bar | `181.75` |
| `close` | `number` | Last trade price of the bar | `183.90` |
| `volume` | `number` | Total shares/contracts traded | `45230100` |
| `vwap` | `number \| null` | Volume-weighted average price (intraday only) | `183.12` |
| `trades` | `number \| null` | Number of trades in the bar | `128450` |
| `interval` | `string` | Bar interval | `"1m"`, `"1D"` |

### Interval Codes

| Code | Meaning | Retention |
|------|---------|-----------|
| `1m` | 1 minute | 30 days |
| `5m` | 5 minutes | 90 days |
| `15m` | 15 minutes | 1 year |
| `1h` | 1 hour | 5 years |
| `1D` | 1 day | Full history |
| `1W` | 1 week | Full history |
| `1M` | 1 month | Full history |

---

## Order Fields

Source: Trading API. Stored in `orderStore`.

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `id` | `string` | Yes | Unique order identifier (UUID v4) | System-generated |
| `symbol` | `string` | Yes | Ticker symbol | 1–10 uppercase chars |
| `side` | `"buy" \| "sell"` | Yes | Order direction | — |
| `type` | `"market" \| "limit" \| "stop" \| "stop_limit"` | Yes | Order type | — |
| `quantity` | `number` | Yes | Number of shares/contracts | > 0, integer |
| `price` | `number \| null` | Conditional | Limit price (required for limit/stop_limit) | > 0 |
| `stopPrice` | `number \| null` | Conditional | Stop trigger price (required for stop/stop_limit) | > 0 |
| `timeInForce` | `"DAY" \| "GTC" \| "IOC" \| "FOK"` | Yes | Time-in-force instruction | Default: `"DAY"` |
| `status` | `OrderStatus` | Yes | Current order state | See status enum below |
| `filledQty` | `number` | Yes | Quantity filled so far | 0 ≤ filledQty ≤ quantity |
| `avgFillPrice` | `number \| null` | No | Weighted average fill price | Null until first fill |
| `createdAt` | `string` (ISO 8601) | Yes | Submission timestamp | System-generated |
| `updatedAt` | `string` (ISO 8601) | Yes | Last state-change timestamp | System-generated |
| `parentId` | `string \| null` | No | Parent order ID for brackets/OCO | UUID reference |
| `tag` | `string \| null` | No | User-defined label | Max 64 chars |

### OrderStatus Enum

| Value | Description |
|-------|-------------|
| `pending` | Submitted, awaiting acceptance |
| `accepted` | Accepted by exchange/broker |
| `partial` | Partially filled |
| `filled` | Fully filled |
| `cancelled` | Cancelled by user or system |
| `rejected` | Rejected (insufficient funds, invalid params) |
| `expired` | Expired due to time-in-force |

---

## Position Fields

Source: Computed from fills. Stored in `positionStore`.

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `string` | Ticker symbol |
| `side` | `"long" \| "short"` | Position direction |
| `quantity` | `number` | Current position size |
| `avgEntryPrice` | `number` | Volume-weighted average entry price |
| `currentPrice` | `number` | Latest market price |
| `marketValue` | `number` | `quantity × currentPrice` |
| `costBasis` | `number` | `quantity × avgEntryPrice` |
| `unrealizedPnl` | `number` | `marketValue − costBasis` (long) |
| `unrealizedPnlPct` | `number` | `unrealizedPnl / costBasis × 100` |
| `realizedPnl` | `number` | Cumulative P&L from closed portions |
| `openedAt` | `string` (ISO 8601) | When the position was first established |

---

## Portfolio Fields

Source: Aggregated from positions and cash. Stored in `portfolioStore`.

| Field | Type | Description |
|-------|------|-------------|
| `totalValue` | `number` | Sum of all positions' market value + cash |
| `cashBalance` | `number` | Available cash |
| `buyingPower` | `number` | Cash + margin available for new orders |
| `dayPnl` | `number` | Today's unrealized + realized P&L |
| `dayPnlPct` | `number` | Day P&L as percentage of previous close NAV |
| `totalPnl` | `number` | All-time P&L |
| `totalPnlPct` | `number` | All-time P&L as percentage of initial deposit |
| `positions` | `Position[]` | Array of open positions |
| `allocation` | `Record<string, number>` | Sector/asset allocation weights |
| `riskMetrics` | `RiskMetrics` | VaR, Sharpe, beta, drawdown, etc. |

---

## Options Chain Fields

Source: Options data API. Stored in `optionsStore`.

| Field | Type | Description |
|-------|------|-------------|
| `underlying` | `string` | Underlying symbol |
| `expiration` | `string` (YYYY-MM-DD) | Expiration date |
| `strike` | `number` | Strike price |
| `type` | `"call" \| "put"` | Option type |
| `bid` | `number` | Best bid price |
| `ask` | `number` | Best ask price |
| `last` | `number` | Last trade price |
| `volume` | `number` | Contracts traded today |
| `openInterest` | `number` | Total open contracts |
| `impliedVol` | `number` | Implied volatility (decimal, e.g. 0.35 = 35%) |
| `delta` | `number` | Delta Greek |
| `gamma` | `number` | Gamma Greek |
| `theta` | `number` | Theta Greek (per day) |
| `vega` | `number` | Vega Greek (per 1% vol) |
| `rho` | `number` | Rho Greek |
| `inTheMoney` | `boolean` | Whether the option is ITM |
| `theoreticalPrice` | `number` | Black-Scholes theoretical value |

---

## News Article Fields

Source: News API. Stored in `newsStore`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique article identifier |
| `title` | `string` | Headline text |
| `summary` | `string` | Brief summary (1–3 sentences) |
| `body` | `string \| null` | Full article content (if available) |
| `source` | `string` | Publisher name |
| `url` | `string` | External link to full article |
| `publishedAt` | `string` (ISO 8601) | Publication timestamp |
| `symbols` | `string[]` | Related ticker symbols |
| `sentiment` | `"positive" \| "negative" \| "neutral"` | AI-computed sentiment |
| `sentimentScore` | `number` | Sentiment confidence (−1.0 to 1.0) |
| `category` | `string` | Topic category (earnings, M&A, macro, etc.) |
| `imageUrl` | `string \| null` | Thumbnail image URL |

---

## Alert Fields

Source: User-defined. Stored in `alertStore` and IndexedDB.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique alert identifier |
| `symbol` | `string` | Target ticker |
| `condition` | `AlertCondition` | Trigger condition (see below) |
| `value` | `number` | Threshold value |
| `message` | `string` | Custom alert message |
| `enabled` | `boolean` | Whether the alert is active |
| `triggered` | `boolean` | Whether the alert has fired |
| `triggeredAt` | `string \| null` | When the alert last fired |
| `createdAt` | `string` | When the alert was created |
| `repeat` | `boolean` | Re-arm after triggering |
| `notification` | `"in-app" \| "push" \| "email" \| "sound"` | Delivery method |

### AlertCondition Enum

`price_above` · `price_below` · `price_cross` · `pct_change_up` · `pct_change_down` · `volume_above` · `indicator_cross` · `pattern_detected`

---

## Watchlist Fields

Source: User-defined. Stored in `watchlistStore`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Watchlist identifier |
| `name` | `string` | Display name |
| `symbols` | `string[]` | Ordered list of ticker symbols |
| `columns` | `string[]` | Visible columns (price, change, volume, etc.) |
| `sortBy` | `string` | Active sort column |
| `sortDir` | `"asc" \| "desc"` | Sort direction |
| `createdAt` | `string` | Creation timestamp |
| `updatedAt` | `string` | Last modification timestamp |

---

## User Preferences

Source: `localStorage` key `apex:preferences`. Stored in `settingsStore`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `theme` | `"dark" \| "light" \| "system"` | `"dark"` | UI color theme |
| `chartType` | `string` | `"candlestick"` | Default chart type |
| `defaultInterval` | `string` | `"1D"` | Default chart timeframe |
| `locale` | `string` | `"en-US"` | Number/date formatting locale |
| `timezone` | `string` | `"America/New_York"` | Display timezone |
| `soundEnabled` | `boolean` | `true` | Alert and fill sounds |
| `compactMode` | `boolean` | `false` | Reduced UI padding |
| `bloombergMode` | `boolean` | `false` | Enable Bloomberg-style terminal |

---

*All TypeScript interfaces are defined in `frontend/src/types/`.*
