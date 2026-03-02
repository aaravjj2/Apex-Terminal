# Strategy API

Strategy context and order submission.

## StrategyContext

```typescript
interface StrategyContext {
  bar: Bar;
  equity: number;
  positions: Map<string, Position>;
  order(side: Side, symbol: string, quantity: number, type?: OrderType, limitPrice?: number): string;
  cancel(orderId: string): void;
}
```

## Order Types

From `frontend/src/lib/backtest/types.ts`:

- Market: fill at bar close (with slippage)
- Limit: fill when price crosses

## Example Strategy

```typescript
const strategy: Strategy = {
  onBar(ctx) {
    const sma = ctx.getIndicator('SMA', 20);
    if (ctx.bar.close > sma && !ctx.positions.has(ctx.bar.symbol)) {
      ctx.order('buy', ctx.bar.symbol, 100);
    }
  },
};
```
