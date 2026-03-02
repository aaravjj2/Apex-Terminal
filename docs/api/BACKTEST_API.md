# Backtest API

Strategy backtesting engine with parameter optimization, walk-forward analysis, and Monte Carlo simulation. Evaluate trading strategies against historical data with comprehensive performance metrics.

## Table of Contents

- [Endpoints](#endpoints)
- [Run Backtest](#post-run-backtest)
- [Get Results](#get-backtest-results)
- [Optimize](#post-optimize-parameters)
- [Walk-Forward](#post-walk-forward-analysis)
- [Strategy Definition](#strategy-definition)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/backtest/run` | Execute a strategy backtest |
| GET | `/api/backtest/results/:id` | Retrieve backtest results |
| POST | `/api/backtest/optimize` | Optimize strategy parameters |
| POST | `/api/backtest/walkforward` | Run walk-forward analysis |

## POST Run Backtest

Submits a strategy for backtesting. Returns a job ID for async result retrieval.

```typescript
interface BacktestRequest {
  strategy: StrategyDefinition;
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1D';
  startDate: string;           // ISO 8601
  endDate: string;
  initialCapital: number;      // Default: 100000
  commission?: number;         // Per-trade cost (default: 0)
  slippage?: number;           // Basis points (default: 0)
  marginRequirement?: number;  // For leveraged strategies (default: 1.0)
}

const job = await backtestApi.run({
  strategy: {
    name: 'SMA Crossover',
    entryRules: [{ indicator: 'sma', params: { period: 20 }, condition: 'crosses_above', reference: { indicator: 'sma', params: { period: 50 } } }],
    exitRules: [{ indicator: 'sma', params: { period: 20 }, condition: 'crosses_below', reference: { indicator: 'sma', params: { period: 50 } } }],
    positionSizing: { method: 'percent_equity', value: 0.02 },
    stopLoss: { type: 'atr', multiplier: 2 },
    takeProfit: { type: 'atr', multiplier: 4 },
  },
  symbol: 'AAPL',
  timeframe: '1D',
  startDate: '2020-01-01',
  endDate: '2025-12-31',
  initialCapital: 100000,
  commission: 1.0,
  slippage: 5,
});
// { jobId: 'bt_abc123', status: 'running', estimatedTime: 12 }
```

## GET Backtest Results

Poll for completed backtest results.

```typescript
interface BacktestResult {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  strategy: string;
  symbol: string;
  period: { start: string; end: string };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    averageWin: number;
    averageLoss: number;
    expectancy: number;
    recoveryFactor: number;
    calmarRatio: number;
  };
  equityCurve: { date: string; equity: number; drawdown: number }[];
  trades: {
    entryDate: string;
    exitDate: string;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    holdingPeriod: number;
    exitReason: 'signal' | 'stop_loss' | 'take_profit' | 'end_of_test';
  }[];
  monteCarlo?: {
    simulations: number;
    medianReturn: number;
    percentile5: number;
    percentile95: number;
    probabilityOfRuin: number;
    drawdownDistribution: { percentile: number; value: number }[];
  };
}
```

## POST Optimize Parameters

Searches parameter space for optimal strategy configuration.

```typescript
interface OptimizeRequest {
  strategy: StrategyDefinition;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  parameterRanges: {
    name: string;           // Parameter path (e.g., 'entryRules.0.params.period')
    min: number;
    max: number;
    step: number;
  }[];
  objective: 'sharpe' | 'return' | 'profit_factor' | 'calmar' | 'sortino';
  method?: 'grid' | 'random' | 'bayesian';  // Default: grid
  maxIterations?: number;   // For random/bayesian (default: 1000)
}

interface OptimizeResponse {
  bestParams: Record<string, number>;
  bestObjective: number;
  bestPerformance: BacktestResult['performance'];
  heatmap?: { x: number; y: number; value: number }[];  // For 2-param grid
  allResults: { params: Record<string, number>; objective: number }[];
  overfitWarning: boolean;  // True if in-sample >> out-of-sample
}
```

## POST Walk-Forward Analysis

Validates strategy robustness by splitting data into rolling in-sample/out-of-sample windows.

```typescript
interface WalkForwardRequest {
  strategy: StrategyDefinition;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  parameterRanges: { name: string; min: number; max: number; step: number }[];
  objective: string;
  windows: number;          // Number of walk-forward windows (default: 5)
  inSampleRatio: number;    // Training ratio (default: 0.7)
  anchored?: boolean;       // Expanding in-sample window (default: false)
}

interface WalkForwardResponse {
  windows: {
    inSampleStart: string;
    inSampleEnd: string;
    outSampleStart: string;
    outSampleEnd: string;
    optimizedParams: Record<string, number>;
    inSamplePerformance: BacktestResult['performance'];
    outSamplePerformance: BacktestResult['performance'];
    efficiency: number;     // Out-of-sample / in-sample ratio
  }[];
  aggregateEfficiency: number;
  robustnessScore: number;  // 0-1, higher is more robust
  passed: boolean;          // True if all windows profitable OOS
}
```

## Strategy Definition

```typescript
interface StrategyDefinition {
  name: string;
  entryRules: ConditionRule[];
  exitRules: ConditionRule[];
  positionSizing: {
    method: 'fixed_quantity' | 'fixed_dollar' | 'percent_equity' | 'kelly';
    value: number;
  };
  stopLoss?: { type: 'percent' | 'atr' | 'fixed'; value?: number; multiplier?: number };
  takeProfit?: { type: 'percent' | 'atr' | 'fixed'; value?: number; multiplier?: number };
  maxOpenPositions?: number;
  allowShort?: boolean;
}

interface ConditionRule {
  indicator: string;           // 'sma', 'ema', 'rsi', 'macd', 'bb', etc.
  params: Record<string, number>;
  condition: 'crosses_above' | 'crosses_below' | 'above' | 'below' | 'between';
  reference: { indicator: string; params: Record<string, number> } | { value: number };
}
```

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `7001` | Invalid strategy definition |
| 400 | `7002` | Date range too short for timeframe |
| 404 | `7003` | Backtest job not found |
| 400 | `7004` | Parameter range produces too many combinations (max: 50,000) |
| 408 | `7005` | Backtest timeout (simplify strategy or reduce date range) |
| 500 | `7006` | Backtest engine internal error |

## Rate Limits

| Tier | Backtests/hour | Optimizations/hour | Walk-Forward/hour |
|------|---------------|--------------------|--------------------|
| Free | 5 | 1 | 0 |
| Pro | 30 | 10 | 5 |
| Enterprise | 200 | 60 | 30 |

Backtests are compute-intensive — jobs run asynchronously. Poll `GET /api/backtest/results/:id` until `status` is `completed` or `failed`.
