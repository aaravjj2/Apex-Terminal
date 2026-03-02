# Portfolio Optimization

Mean-variance and risk-parity optimization.

## Objectives

```typescript
type OptimizationObjective =
  | 'max_sharpe'
  | 'min_variance'
  | 'max_return'
  | 'risk_parity'
  | 'max_diversification';
```

## API

```typescript
// GET /api/portfolio/optimization?objective=
const result = await getOptimization({ objective: 'max_sharpe' });
```

Worker: `frontend/src/workers/optimizationWorker.ts`
