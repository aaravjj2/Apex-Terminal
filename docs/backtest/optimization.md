# Strategy Optimization

Parameter optimization for backtest strategies.

## Grid Search

Vary strategy params (e.g. SMA period 10–50) and run backtest for each.

## Worker

`frontend/src/workers/optimizationWorker.ts` — runs multiple backtests in parallel.

## Output

Best params by Sharpe, total return, or custom objective.
