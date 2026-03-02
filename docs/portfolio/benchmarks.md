# Benchmark Comparison

Compare portfolio to benchmarks.

## API

```typescript
// GET /api/portfolio/benchmark?benchmark=
const comparison = await getBenchmarkComparison({ benchmark: 'SPY' });

// GET /api/portfolio/benchmarks
const benchmarks = await getAvailableBenchmarks();
```
