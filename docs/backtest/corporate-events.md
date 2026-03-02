# Corporate Events

Splits and dividends in backtest.

## Types

```typescript
interface SplitEvent {
  date: string;
  ratio: string;  // e.g. "2:1"
}
interface DividendEvent {
  exDate: string;
  amount: number;
}
```

## Handling

- **Splits**: Adjust position quantity and cost basis
- **Dividends**: Credit cash; optionally reinvest

API: `GET /api/market-data/corporate-actions/:symbol`
