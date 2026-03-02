# Strategy Builder

The visual Strategy Builder enables traders to construct, test, and deploy automated trading strategies through an intuitive rule-based interface — no coding required. Advanced users can extend strategies with custom TypeScript logic.

## Table of Contents

- [Overview](#overview)
- [Visual Rule Editor](#visual-rule-editor)
- [Entry and Exit Signals](#entry-and-exit-signals)
- [Indicator Combinations](#indicator-combinations)
- [Risk Management Rules](#risk-management-rules)
- [Position Sizing](#position-sizing)
- [Backtesting Integration](#backtesting-integration)
- [Strategy Templates](#strategy-templates)
- [Code Export](#code-export)

## Overview

The Strategy Builder translates visual rule configurations into executable `Strategy` objects compatible with the backtest engine. The builder produces a declarative strategy definition that the `StrategyCompiler` converts to runnable code:

```typescript
interface StrategyDefinition {
  name: string;
  symbol: string;
  timeframe: string;
  entryRules: Rule[];
  exitRules: Rule[];
  riskRules: RiskRule[];
  positionSizing: SizingConfig;
  filters: MarketFilter[];
}
```

## Visual Rule Editor

Rules are composed from three primitives — **conditions**, **operators**, and **actions** — arranged in a block-based visual editor:

```typescript
interface Rule {
  id: string;
  conditions: Condition[];
  logic: 'AND' | 'OR';
  action: Action;
  priority: number;
}

interface Condition {
  left: Operand;       // indicator value, price field, constant
  operator: ComparisonOp;  // '>', '<', '>=', '<=', '==', 'crosses_above', 'crosses_below'
  right: Operand;
}
```

The UI renders each rule as a card with drag-and-drop condition blocks. Conditions chain with AND/OR logic, and rules evaluate in priority order.

Example — a visual rule reading "RSI(14) crosses below 30 AND price is above SMA(200)":

```typescript
const oversoldEntry: Rule = {
  id: 'oversold-entry',
  conditions: [
    { left: { type: 'indicator', name: 'rsi', params: { period: 14 } },
      operator: 'crosses_below',
      right: { type: 'constant', value: 30 } },
    { left: { type: 'price', field: 'close' },
      operator: '>',
      right: { type: 'indicator', name: 'sma', params: { period: 200 } } },
  ],
  logic: 'AND',
  action: { type: 'entry', side: 'long' },
  priority: 1,
};
```

## Entry and Exit Signals

Entry and exit rules are defined separately, giving precise control over trade lifecycle:

**Entry signals** specify:
- Direction — long, short, or both.
- Order type — market (immediate) or limit (at a calculated price).
- Confirmation — require N consecutive bars meeting conditions.

**Exit signals** specify:
- Condition-based exit — e.g., RSI crosses above 70.
- Time-based exit — close after N bars.
- Trailing exit — exit when price retraces X% from peak.

```typescript
const exitRules: Rule[] = [
  { id: 'tp', conditions: [{ left: profitPct, operator: '>=', right: constant(5) }],
    logic: 'AND', action: { type: 'exit', reason: 'take_profit' }, priority: 1 },
  { id: 'sl', conditions: [{ left: profitPct, operator: '<=', right: constant(-2) }],
    logic: 'AND', action: { type: 'exit', reason: 'stop_loss' }, priority: 2 },
  { id: 'time', conditions: [{ left: barsHeld, operator: '>=', right: constant(20) }],
    logic: 'AND', action: { type: 'exit', reason: 'time_exit' }, priority: 3 },
];
```

## Indicator Combinations

The builder exposes all 100+ indicators from `lib/indicators/` as condition operands. Indicators are parameterized inline and computed on demand:

- **Single indicator vs. threshold** — RSI > 70
- **Indicator vs. indicator** — EMA(12) crosses above EMA(26)
- **Indicator vs. price** — close > upper Bollinger Band
- **Multi-timeframe** — daily RSI < 30 AND 4H MACD histogram > 0

Multi-timeframe conditions resample the higher timeframe data and align signals to the execution timeframe.

## Risk Management Rules

Risk rules override entry/exit logic to protect capital:

```typescript
interface RiskRule {
  type: 'max_drawdown' | 'max_daily_loss' | 'max_open_positions'
    | 'max_correlation' | 'equity_curve_filter';
  threshold: number;
  action: 'pause_entries' | 'close_all' | 'reduce_size';
}
```

| Rule | Description |
|---|---|
| Max Drawdown | Halt new entries if portfolio drawdown exceeds threshold |
| Max Daily Loss | Stop trading for the day after cumulative loss limit |
| Max Open Positions | Cap concurrent positions to limit exposure |
| Equity Curve Filter | Only trade when the strategy equity curve is above its own moving average |
| Correlation Guard | Skip entries correlated > threshold with existing positions |

## Position Sizing

Six position sizing methods are available:

| Method | Calculation |
|---|---|
| **Fixed Quantity** | Always trade N shares/contracts |
| **Fixed Dollar** | Dollar amount / entry price |
| **Percent of Equity** | Portfolio value × percentage / entry price |
| **Risk-Based (% risk)** | (Equity × risk%) / (entry - stop distance) |
| **Kelly Criterion** | Optimal fraction from win rate and payoff ratio |
| **Volatility-Scaled** | Target volatility / instrument ATR |

```typescript
const sizing: SizingConfig = {
  method: 'risk_based',
  riskPerTrade: 0.01,      // 1% of equity
  maxPositionPct: 0.10,    // never exceed 10% of equity
  roundToLotSize: true,
};
```

## Backtesting Integration

One-click backtesting runs the compiled strategy through the `BacktestEngine`:

```typescript
const compiled = StrategyCompiler.compile(strategyDefinition);
const engine = new BacktestEngine({
  strategy: compiled,
  initialCapital: 100_000,
  costModel: defaultCostModel,
});
const result = engine.run(historicalData);
```

Results render inline beneath the builder with equity curve, key metrics, and trade list. Parameter sliders update results in real-time for rapid iteration.

## Strategy Templates

Pre-built templates accelerate strategy creation:

| Template | Logic |
|---|---|
| **Trend Following** | MA crossover + ADX filter + ATR trailing stop |
| **Mean Reversion** | Bollinger Band mean reversion + RSI confirmation |
| **Breakout** | Donchian channel breakout + volume surge filter |
| **Momentum** | RSI/MACD momentum + trend filter |
| **Pairs Trading** | Spread z-score entry/exit on correlated pairs |

Templates load as editable strategy definitions that users can customize.

## Code Export

The builder exports strategies as standalone TypeScript modules for version control or custom modification:

```typescript
// Exported strategy — fully self-contained
export const myStrategy: Strategy = {
  name: 'RSI Mean Reversion',
  warmupPeriod: 200,
  parameters: [
    { name: 'rsiPeriod', default: 14 },
    { name: 'oversold', default: 30 },
    { name: 'overbought', default: 70 },
  ],
  onBar(ctx) {
    const rsiVal = rsi(ctx.close, ctx.params.rsiPeriod);
    if (rsiVal < ctx.params.oversold && ctx.close[0] > sma(ctx.close, 200))
      return [{ type: 'entry', side: 'long' }];
    if (rsiVal > ctx.params.overbought)
      return [{ type: 'exit' }];
    return [];
  },
};
```
