# Platform Performance

Optimization guidelines in `frontend/src/lib/platform/`.

## Strategies

- Web Workers for compute (backtest, indicators, screening)
- Virtualization for long lists
- Debounce search and chart resize
- Lazy load routes

## Workers

backtestWorker, indicatorWorker, screeningWorker, dataWorker, optimizationWorker
