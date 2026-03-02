# Screening API

Stock screener and real-time scanner with configurable fundamental, technical, and volume filters. Supports preset screens and streaming results via WebSocket.

## Table of Contents

- [Endpoints](#endpoints)
- [Run Scan](#post-screener-scan)
- [Preset Screens](#get-preset-screens)
- [Real-Time Scanner](#get-realtime-scanner)
- [Filter Reference](#filter-reference)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/screener/scan` | Run a custom screen with filters |
| GET | `/api/screener/presets` | List available preset screens |
| GET | `/api/scanner/realtime` | Real-time scanner with streaming results |

## POST Screener Scan

Executes a custom screen against the universe of available instruments.

```typescript
interface ScanFilter {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in';
  value: number | string | [number, number] | string[];
}

interface ScanRequest {
  universe?: 'us_equities' | 'global_equities' | 'etfs' | 'crypto' | 'forex';
  filters: ScanFilter[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  columns?: string[];     // Fields to return per result
  limit?: number;         // Default: 50, max: 500
  offset?: number;
}

const results = await screeningApi.scan({
  universe: 'us_equities',
  filters: [
    { field: 'market_cap', operator: 'gte', value: 10_000_000_000 },
    { field: 'pe_ratio', operator: 'between', value: [5, 20] },
    { field: 'rsi_14', operator: 'lt', value: 30 },
    { field: 'avg_volume_20d', operator: 'gte', value: 1_000_000 },
    { field: 'sector', operator: 'in', value: ['Technology', 'Healthcare'] },
  ],
  sort: { field: 'market_cap', direction: 'desc' },
  columns: ['symbol', 'name', 'price', 'change_pct', 'market_cap', 'pe_ratio', 'rsi_14'],
  limit: 25,
});

interface ScanResponse {
  results: Record<string, any>[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    scanTime: number;   // Execution time in ms
  };
}
```

## GET Preset Screens

Returns a list of built-in screening templates.

```typescript
const presets = await screeningApi.getPresets();

interface PresetScreen {
  id: string;
  name: string;
  description: string;
  category: 'momentum' | 'value' | 'growth' | 'income' | 'volatility' | 'technical';
  filters: ScanFilter[];
  resultCount: number;   // Approximate current matches
}
```

### Built-In Presets

| Preset | Description |
|--------|-------------|
| `oversold_rsi` | RSI(14) < 30, volume > 1M, market cap > $1B |
| `golden_cross` | 50-day SMA crossed above 200-day SMA in last 5 sessions |
| `high_short_interest` | Short interest > 20%, days to cover > 5 |
| `earnings_momentum` | Beat earnings estimates last 4 quarters, positive guidance |
| `dividend_aristocrats` | 25+ consecutive years of dividend increases |
| `gap_up` | Opened 3%+ above previous close with above-average volume |
| `volume_breakout` | Volume > 3x 20-day average, price at 52-week high |
| `value_picks` | P/E < 15, P/B < 2, dividend yield > 2%, debt/equity < 1 |

## GET Real-Time Scanner

Streams matching symbols as market conditions change. Initial response returns current matches; subscribe via WebSocket `scanner` channel for live updates.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `presetId` | string | No | Use a preset screen configuration |
| `filters` | string | No | JSON-encoded filter array (alternative to preset) |
| `throttle` | number | No | Min seconds between updates (default: 5) |

```typescript
interface ScannerUpdate {
  type: 'added' | 'removed' | 'updated';
  symbol: string;
  data: Record<string, any>;
  timestamp: number;
}
```

## Filter Reference

### Fundamental Filters

| Field | Type | Description |
|-------|------|-------------|
| `market_cap` | number | Market capitalization (USD) |
| `pe_ratio` | number | Price-to-earnings ratio (TTM) |
| `forward_pe` | number | Forward P/E |
| `pb_ratio` | number | Price-to-book ratio |
| `ps_ratio` | number | Price-to-sales ratio |
| `dividend_yield` | number | Annual dividend yield (decimal) |
| `debt_equity` | number | Debt-to-equity ratio |
| `roe` | number | Return on equity (decimal) |
| `revenue_growth` | number | YoY revenue growth (decimal) |
| `earnings_growth` | number | YoY earnings growth (decimal) |
| `sector` | string | GICS sector name |
| `industry` | string | GICS industry name |

### Technical Filters

| Field | Type | Description |
|-------|------|-------------|
| `price` | number | Current price |
| `change_pct` | number | Daily % change |
| `rsi_14` | number | 14-period RSI |
| `sma_50` | number | 50-day simple moving average |
| `sma_200` | number | 200-day simple moving average |
| `atr_14` | number | 14-period ATR |
| `macd_signal` | string | `bullish` or `bearish` |
| `bb_position` | number | Bollinger Band %B (0-1) |
| `distance_52w_high` | number | % below 52-week high |

### Volume Filters

| Field | Type | Description |
|-------|------|-------------|
| `volume` | number | Current session volume |
| `avg_volume_20d` | number | 20-day average volume |
| `relative_volume` | number | Volume / avg_volume_20d ratio |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `6001` | Invalid filter field name |
| 400 | `6002` | Invalid operator for field type |
| 400 | `6003` | Too many filters (max: 20) |
| 404 | `6004` | Preset not found |
| 408 | `6005` | Scan timeout (reduce filters or limit) |

## Rate Limits

| Tier | Scans/min | Presets/min | Real-Time Scanners |
|------|----------|-------------|-------------------|
| Free | 5 | 30 | 1 concurrent |
| Pro | 30 | 120 | 5 concurrent |
| Enterprise | 150 | 600 | 25 concurrent |
