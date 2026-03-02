# Backtest Worker

Web Worker for non-blocking backtests.

## Location

`frontend/src/workers/backtestWorker.ts`

## Usage

```typescript
const worker = new Worker(new URL('./backtestWorker.ts', import.meta.url));
worker.postMessage({ type: 'run', config, bars, strategy });
worker.onmessage = (e) => {
  if (e.data.type === 'result') {
    const { equityCurve, trades, metrics } = e.data;
  }
};
```
