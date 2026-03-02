# Portfolio History

Historical snapshots and performance.

## API

```typescript
// GET /api/portfolio/history?start=&end=&period=
const { snapshots, totalReturn, totalReturnPct } = await getPortfolioHistory({
  start: '2024-01-01',
  end: '2024-03-01',
  period: '1D',
});
```

## Snapshot

```typescript
interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}
```
