# Market Data API

`frontend/src/api/marketDataApi.ts`

## Quotes

```typescript
const quote = await getQuote('AAPL');
const quotes = await getQuotes(['AAPL', 'MSFT']);
```

## Bars

```typescript
const { bars } = await getBars({
  symbol: 'AAPL',
  timeframe: '1D',
  start: '2024-01-01',
  end: '2024-03-01',
});
```

## Timeframes

1m, 5m, 15m, 30m, 1h, 2h, 4h, 1D, 1W, 1M
