# Backtesting Engine

Apex Terminal's backtesting engine in `lib/backtest/` simulates trading strategies against historical data with realistic execution modeling, comprehensive performance analytics, and multi-dimensional parameter optimization.

## Table of Contents

- [Architecture](#architecture)
- [Strategy Definition](#strategy-definition)
- [Historical Data Loading](#historical-data-loading)
- [Trade Simulation](#trade-simulation)
- [Slippage and Commission Modeling](#slippage-and-commission-modeling)
- [Walk-Forward Analysis](#walk-forward-analysis)
- [Monte Carlo Simulation](#monte-carlo-simulation)
- [Parameter Optimization](#parameter-optimization)
- [Performance Analytics](#performance-analytics)

## Architecture

The backtest pipeline consists of five modules:

```
strategies.ts → engine.ts → analytics.ts → optimization.ts → reporter.ts
```

The `BacktestEngine` iterates through historical bars, feeds them to the strategy, collects signals, simulates execution with slippage/commissions, and tracks portfolio state:

```typescript
// lib/backtest/engine.ts
export class BacktestEngine {
  private strategy: Strategy;
  private portfolio: SimulatedPortfolio;
  private trades: Trade[] = [];

  constructor(config: BacktestConfig) {
    this.strategy = config.strategy;
    this.portfolio = new SimulatedPortfolio(config.initialCapital);
  }

  run(data: OHLCVData[]): BacktestResult {
    for (let i = this.strategy.warmupPeriod; i < data.length; i++) {
      const context = this.buildContext(data, i);
      const signals = this.strategy.onBar(context);
      this.processSignals(signals, data[i]);
    }
    return this.buildResult();
  }
}
```

## Strategy Definition

Strategies implement the `Strategy` interface with lifecycle hooks:

```typescript
// lib/backtest/strategies.ts
export interface Strategy {
  name: string;
  warmupPeriod: number;
  parameters: StrategyParam[];
  onInit?(context: StrategyContext): void;
  onBar(context: BarContext): Signal[];
  onOrderFilled?(fill: Fill): void;
  onEnd?(context: StrategyContext): void;
}

// Example: Moving Average Crossover
export const maCrossover: Strategy = {
  name: 'MA Crossover',
  warmupPeriod: 50,
  parameters: [
    { name: 'fastPeriod', default: 10, min: 5, max: 50, step: 1 },
    { name: 'slowPeriod', default: 50, min: 20, max: 200, step: 5 },
  ],
  onBar({ close, params }) {
    const fast = sma(close, params.fastPeriod);
    const slow = sma(close, params.slowPeriod);
    if (fast > slow && prevFast <= prevSlow) return [{ type: 'entry', side: 'long' }];
    if (fast < slow && prevFast >= prevSlow) return [{ type: 'exit' }];
    return [];
  },
};
```

Built-in strategy templates include: MA Crossover, RSI Mean Reversion, Bollinger Breakout, MACD Divergence, and Pairs Trading.

## Historical Data Loading

The engine accepts data from multiple sources:

- **Local IndexedDB cache** — previously fetched OHLCV data stored via `useIndexedDB`.
- **API fetch** — on-demand retrieval through `marketDataApi` with automatic gap-fill.
- **CSV import** — user-uploaded files parsed with column mapping.

```typescript
const data = await loadHistoricalData({
  symbol: 'AAPL',
  timeframe: '1D',
  start: '2020-01-01',
  end: '2024-12-31',
  adjustSplits: true,
  adjustDividends: true,
});
```

## Trade Simulation

The simulated execution engine models realistic order processing:

- **Market orders** fill at the next bar's open price ± slippage.
- **Limit orders** fill when price crosses the limit level within a bar.
- **Stop orders** trigger at the stop level, then fill as market orders.
- **Partial fills** are simulated based on bar volume and order size ratio.

```typescript
interface SimulationConfig {
  fillModel: 'next_bar_open' | 'within_bar' | 'close';
  allowPartialFills: boolean;
  maxFillPercent: number;   // max % of bar volume that can be filled
}
```

## Slippage and Commission Modeling

Realistic cost modeling prevents overly optimistic backtest results:

```typescript
interface CostModel {
  slippage: {
    model: 'fixed' | 'percentage' | 'volume_dependent';
    fixedAmount?: number;
    percentage?: number;
    impactCoefficient?: number;
  };
  commission: {
    model: 'per_share' | 'per_trade' | 'percentage';
    rate: number;
    minimum?: number;
  };
  borrowCost?: number;    // annual rate for short positions
}
```

The volume-dependent slippage model uses a square-root market impact function: `slippage = coefficient * σ * √(quantity / ADV)`.

## Walk-Forward Analysis

Walk-forward testing guards against overfitting by splitting data into rolling in-sample (optimization) and out-of-sample (validation) windows:

```typescript
const wfResult = walkForwardAnalysis({
  data: historicalData,
  strategy: maCrossover,
  inSamplePct: 0.7,
  windows: 6,
  optimizeMetric: 'sharpe',
  optimizeMethod: 'grid',
});
// Returns per-window IS/OOS metrics plus aggregate OOS performance
```

A strategy that degrades significantly out-of-sample relative to in-sample signals curve-fitting risk.

## Monte Carlo Simulation

Monte Carlo analysis resamples the trade sequence to estimate the distribution of possible outcomes:

```typescript
const mcResult = monteCarloAnalysis({
  trades: backtestResult.trades,
  simulations: 10000,
  confidenceLevels: [0.05, 0.25, 0.50, 0.75, 0.95],
  method: 'trade_resampling',  // or 'returns_shuffling'
});
// { maxDrawdown: { p5: -18.2, p50: -12.1, p95: -6.8 }, finalReturn: { ... } }
```

This reveals the range of drawdowns and returns the strategy might experience under different trade orderings.

## Parameter Optimization

Three optimization methods search the parameter space:

| Method | Module | Characteristics |
|---|---|---|
| **Grid Search** | `optimization.ts` | Exhaustive, evaluates every combination |
| **Random Search** | `optimization.ts` | Stochastic sampling, faster for high-dimensional spaces |
| **Bayesian** | `optimization.ts` | Gaussian process surrogate, sample-efficient |

```typescript
const optResult = optimizeStrategy({
  strategy: maCrossover,
  data: historicalData,
  method: 'bayesian',
  objective: 'sharpe',
  maxIterations: 200,
  constraints: [
    { param: 'fastPeriod', lt: 'slowPeriod' },
  ],
});
// { bestParams: { fastPeriod: 12, slowPeriod: 55 }, bestSharpe: 1.82 }
```

Optimization runs in Web Workers to keep the UI responsive. Results visualize as 2D/3D heatmaps in the reporter.

## Performance Analytics

The `analytics.ts` module computes comprehensive metrics from backtest results:

| Category | Metrics |
|---|---|
| **Returns** | Total return, CAGR, daily/monthly/annual returns |
| **Risk** | Max drawdown, volatility, downside deviation, VaR |
| **Risk-Adjusted** | Sharpe ratio, Sortino ratio, Calmar ratio, Omega ratio |
| **Trade Stats** | Win rate, profit factor, avg win/loss, expectancy |
| **Exposure** | Time in market, long/short exposure, turnover |

The `reporter.ts` module generates interactive HTML reports with equity curves, drawdown charts, monthly return heatmaps, and trade distribution histograms.
