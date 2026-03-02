# Backtest Engine v5

Deterministic backtest engine in `frontend/src/lib/backtest/engine.ts`.

## Architecture

- **Bar replay**: Iterate bars in time order
- **Event-driven**: Strategy receives bars, emits orders
- **PRNG**: xoshiro128** for reproducible slippage
- **Resampling**: Supports M1..MN timeframes

## Core Loop

```typescript
for (const bar of bars) {
  ctx.setBar(bar);
  strategy.onBar(ctx);
  engine.processPendingOrders(bar.time);
}
```

## Strategy API

```typescript
interface Strategy {
  onBar(ctx: StrategyContext): void;
  onOrderFill?(order: Order, fill: Trade): void;
}
```

## Config

```typescript
interface BacktestConfig {
  initialCapital: number;
  commission: CommissionConfig;
  slippage: SlippageConfig;
  timeframe: Timeframe;
}
```
