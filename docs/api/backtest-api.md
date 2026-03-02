# Backtest API

`frontend/src/api/backtestApi.ts`

## Run Backtest

```typescript
const { runId } = await runBacktest({ config, bars, strategy });
const result = await pollBacktestUntilDone(runId);
```

## Optimization

```typescript
await runOptimization({ strategy, paramRanges });
```
