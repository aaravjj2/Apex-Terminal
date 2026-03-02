# Backtest API

REST and client for backtest runs.

## Client

```typescript
import { runBacktest, getBacktestResult } from '@/api/backtestApi';
```

## Endpoints

- `POST /api/backtest/run` — Submit backtest job
- `GET /api/backtest/:id` — Get result by id
- `GET /api/backtest/:id/equity` — Equity curve

## Result Schema

Matches `BacktestResult` from engine: `equityCurve`, `trades`, `orders`, `metrics`.
