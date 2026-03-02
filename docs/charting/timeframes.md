# Timeframes

Supported timeframes and resampling.

## Supported Values

From `marketDataApi.ts`:

```typescript
type Timeframe =
  | '1m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h'
  | '1D' | '1W' | '1M';
```

## Bar Request

```typescript
const bars = await getBars({
  symbol: 'AAPL',
  timeframe: '1D',
  start: '2024-01-01',
  end: '2024-03-01',
  adjustSplits: true,
  adjustDividends: true,
  limit: 500,
});
```

API: `GET /api/market-data/bars/:symbol?timeframe=&start=&end=`

## Backtest Timeframes

From `frontend/src/lib/backtest/types.ts`:

```typescript
enum Timeframe {
  M1, M5, M15, M30, H1, H4, D1, W1, MN,
}
```

## Resampling

Backtest engine resamples bars via `resampleBars(bars, targetTf)` — buckets by interval, aggregates OHLCV.
