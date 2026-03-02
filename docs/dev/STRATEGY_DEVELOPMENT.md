# Strategy Development Guide

Building and testing trading strategies in the Apex Terminal backtest engine.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Strategy Interface](#strategy-interface)
- [Implementing a Strategy](#implementing-a-strategy)
- [Accessing Indicators](#accessing-indicators)
- [Managing Positions](#managing-positions)
- [Risk Rules](#risk-rules)
- [Testing Strategies](#testing-strategies)
- [Optimization Config](#optimization-config)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Architecture Overview

The backtest engine lives in `frontend/src/lib/backtest/`:

```
lib/backtest/
├── types.ts         # Strategy, Position, TradeResult, BacktestConfig interfaces
├── engine.ts        # Core backtest loop: iterates bars, calls strategy hooks
├── strategies.ts    # Built-in strategy implementations
├── analytics.ts     # Performance metrics: Sharpe, Sortino, drawdown, etc.
├── optimization.ts  # Parameter optimization (grid search, genetic algorithm)
├── reporter.ts      # HTML/JSON report generation
└── index.ts         # Barrel export
```

Strategies run inside the `backtestWorker` to avoid blocking the UI. The engine iterates historical bars and calls strategy lifecycle hooks at each step.

## Strategy Interface

Every strategy must implement the `Strategy` interface:

```typescript
interface Strategy {
  name: string;
  description: string;
  version: string;

  params: StrategyParams;

  init(context: StrategyContext): void;
  onBar(bar: Bar, context: StrategyContext): void;
  onTick?(tick: Tick, context: StrategyContext): void;
  onOrderFilled?(order: FilledOrder, context: StrategyContext): void;
  cleanup?(context: StrategyContext): void;
}

interface StrategyParams {
  [key: string]: {
    value: number | string | boolean;
    label: string;
    type: 'number' | 'select' | 'boolean';
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}
```

The `StrategyContext` provides access to the engine:

```typescript
interface StrategyContext {
  bars: Bar[];                              // Full historical data
  currentIndex: number;                     // Current bar index
  positions: Position[];                    // Open positions
  closedTrades: TradeResult[];              // Completed trades
  equity: number;                           // Current account equity
  cash: number;                             // Available cash
  indicators: IndicatorAccess;              // Pre-computed indicator values
  buy(params: OrderParams): string;         // Submit buy order
  sell(params: OrderParams): string;        // Submit sell order
  closePosition(positionId: string): void;  // Close a specific position
  closeAll(): void;                         // Close all positions
  log(message: string): void;              // Debug logging
}
```

## Implementing a Strategy

```typescript
import type { Strategy, StrategyContext, Bar } from './types';

export const goldenCrossStrategy: Strategy = {
  name: 'Golden Cross',
  description: 'Buys on SMA 50/200 golden cross, sells on death cross',
  version: '1.0.0',

  params: {
    fastPeriod: { value: 50, label: 'Fast MA Period', type: 'number', min: 5, max: 100, step: 5 },
    slowPeriod: { value: 200, label: 'Slow MA Period', type: 'number', min: 50, max: 500, step: 10 },
    positionSize: { value: 0.95, label: 'Position Size (%)', type: 'number', min: 0.1, max: 1, step: 0.05 },
  },

  init(ctx: StrategyContext) {
    ctx.log(`Golden Cross initialized: fast=${this.params.fastPeriod.value}, slow=${this.params.slowPeriod.value}`);
  },

  onBar(bar: Bar, ctx: StrategyContext) {
    const fast = ctx.indicators.get('sma', { period: this.params.fastPeriod.value as number });
    const slow = ctx.indicators.get('sma', { period: this.params.slowPeriod.value as number });

    if (!fast || !slow) return;

    const currentFast = fast[ctx.currentIndex];
    const currentSlow = slow[ctx.currentIndex];
    const prevFast = fast[ctx.currentIndex - 1];
    const prevSlow = slow[ctx.currentIndex - 1];

    if (isNaN(currentFast) || isNaN(currentSlow) || isNaN(prevFast) || isNaN(prevSlow)) return;

    const crossedAbove = prevFast <= prevSlow && currentFast > currentSlow;
    const crossedBelow = prevFast >= prevSlow && currentFast < currentSlow;

    if (crossedAbove && ctx.positions.length === 0) {
      const size = Math.floor((ctx.cash * (this.params.positionSize.value as number)) / bar.close);
      if (size > 0) ctx.buy({ quantity: size, price: bar.close });
    }

    if (crossedBelow && ctx.positions.length > 0) {
      ctx.closeAll();
    }
  },
};
```

## Accessing Indicators

The `StrategyContext.indicators` object provides pre-computed indicator values:

```typescript
const rsi = ctx.indicators.get('rsi', { period: 14 });
const bb = ctx.indicators.get('bollinger', { period: 20, multiplier: 2 });
const macd = ctx.indicators.get('macd', { fast: 12, slow: 26, signal: 9 });

// Access current value
const currentRSI = rsi[ctx.currentIndex];

// Multi-output indicators return objects
const { upper, middle, lower } = bb;
const upperBand = upper[ctx.currentIndex];
```

Indicators are computed once over the full dataset before the backtest loop begins, so accessing them is O(1) per bar.

## Managing Positions

```typescript
// Open a long position
const orderId = ctx.buy({ quantity: 100, price: bar.close });

// Open a short position (if enabled in config)
const shortId = ctx.sell({ quantity: 50, price: bar.close });

// Close a specific position
ctx.closePosition(orderId);

// Close all open positions
ctx.closeAll();

// Check current positions
for (const pos of ctx.positions) {
  const pnl = (bar.close - pos.entryPrice) * pos.quantity;
  if (pnl < -pos.entryPrice * 0.02) {
    ctx.closePosition(pos.id); // 2% stop loss
  }
}
```

`OrderParams` interface:

```typescript
interface OrderParams {
  quantity: number;
  price?: number;        // undefined = market order at current bar close
  stopLoss?: number;     // auto-close if price hits this level
  takeProfit?: number;   // auto-close if price hits this level
  trailingStop?: number; // percentage trailing stop
}
```

## Risk Rules

Strategies can enforce risk limits:

```typescript
onBar(bar: Bar, ctx: StrategyContext) {
  // Max drawdown check
  const peakEquity = Math.max(...ctx.closedTrades.map(t => t.equity));
  const currentDrawdown = (peakEquity - ctx.equity) / peakEquity;
  if (currentDrawdown > 0.15) {
    ctx.closeAll();
    ctx.log('Max drawdown exceeded — closing all positions');
    return;
  }

  // Max position count
  if (ctx.positions.length >= 5) return;

  // Per-trade risk limit (1% of equity)
  const maxRisk = ctx.equity * 0.01;
  const stopDistance = bar.close * 0.02;
  const maxShares = Math.floor(maxRisk / stopDistance);
}
```

## Testing Strategies

Unit test the strategy's `onBar` logic with synthetic data:

```typescript
import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/lib/backtest/engine';
import { goldenCrossStrategy } from '@/lib/backtest/strategies';

describe('goldenCrossStrategy', () => {
  const bars = generateTrendingBars(500, 100, 0.1); // 500 bars, start $100, uptrend

  it('produces positive returns in uptrend', () => {
    const result = runBacktest({
      strategy: goldenCrossStrategy,
      bars,
      initialCapital: 100000,
      commission: 0,
    });
    expect(result.totalReturn).toBeGreaterThan(0);
  });

  it('generates at least one trade', () => {
    const result = runBacktest({ strategy: goldenCrossStrategy, bars, initialCapital: 100000 });
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('respects position sizing parameter', () => {
    const result = runBacktest({ strategy: goldenCrossStrategy, bars, initialCapital: 100000 });
    for (const trade of result.trades) {
      expect(trade.value).toBeLessThanOrEqual(100000 * 0.95 + 1);
    }
  });

  it('closes all positions on death cross', () => {
    const barsWithReversal = generateReversalBars(500, 100);
    const result = runBacktest({ strategy: goldenCrossStrategy, bars: barsWithReversal, initialCapital: 100000 });
    expect(result.openPositions).toHaveLength(0);
  });
});
```

## Optimization Config

Define parameter ranges for optimization:

```typescript
const optimizationConfig = {
  strategy: goldenCrossStrategy,
  paramRanges: {
    fastPeriod: { min: 10, max: 100, step: 10 },
    slowPeriod: { min: 50, max: 300, step: 25 },
  },
  objective: 'sharpe',           // 'sharpe' | 'return' | 'sortino' | 'calmar'
  method: 'grid',                // 'grid' | 'genetic' | 'random'
  maxIterations: 1000,
  walkForwardSplits: 5,          // Walk-forward analysis folds
};
```

Optimization runs in the `optimizationWorker` and reports progress back to the UI.

## Conventions

- Strategies are pure objects implementing the `Strategy` interface — no React.
- All strategy files go in `lib/backtest/strategies.ts` or a `strategies/` subdirectory.
- Use `ctx.log()` for debug output — it appears in the backtest report.
- Default parameters should be reasonable starting points for the strategy.

## Do's and Don'ts

**Do:**
- Guard against NaN indicator values before making trading decisions
- Include stop-loss or risk management in every strategy
- Test with different market regimes (trending, ranging, volatile)
- Use `ctx.indicators.get()` instead of computing indicators inside `onBar`
- Document the strategy's logic and expected market conditions

**Don't:**
- Look ahead in the bar array — `ctx.bars[ctx.currentIndex + 1]` is future data
- Modify `ctx.bars` — the data is shared and must remain immutable
- Use random numbers without seeding — results must be reproducible
- Skip the `init()` hook — use it to validate parameters
- Assume commission is zero — always test with realistic transaction costs
