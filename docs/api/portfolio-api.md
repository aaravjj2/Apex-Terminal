# Portfolio API

`frontend/src/api/portfolioApi.ts`

## Get Portfolio

```typescript
const portfolio = await getPortfolio();
// portfolio.holdings, portfolio.totalValue, portfolio.cash
```

## Performance

```typescript
const metrics = await getPerformance({ period: '1M' });
// sharpeRatio, maxDrawdown, totalReturn, etc.
```
