# Portfolio Risk

Risk metrics from `portfolioApi` and `frontend/src/lib/risk/`.

## API

```typescript
// GET /api/portfolio/risk
const metrics = await getRiskMetrics();
```

## Metrics

- VaR (Value at Risk)
- CVaR (Expected Shortfall)
- Beta, volatility
- Sector/exposure concentration

## Stress Testing

`frontend/src/lib/risk/` — marketRisk.ts, stressTesting. API: stressTestApi.ts.
