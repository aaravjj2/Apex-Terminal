# Technical Indicator Guide

Adding new technical indicators to Apex Terminal.

## Table of Contents

- [Module Structure](#module-structure)
- [Implementing Indicator Math](#implementing-indicator-math)
- [Registering with the Indicator System](#registering-with-the-indicator-system)
- [UI Config Panel](#ui-config-panel)
- [Worker Integration](#worker-integration)
- [Testing with Known Values](#testing-with-known-values)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Module Structure

Indicator implementations live in `frontend/src/lib/indicators/`:

```
lib/indicators/
├── index.ts           # Barrel export + indicator registry
├── movingAverages.ts  # SMA, EMA, WMA, DEMA, TEMA, Hull, KAMA, ALMA, etc.
├── momentum.ts        # RSI, MACD, Stochastic, CCI, Williams %R, ROC
├── volatility.ts      # Bollinger Bands, ATR, Keltner, Donchian, StdDev
├── volume.ts          # OBV, VWAP, MFI, A/D Line, CMF, Volume Profile
├── trend.ts           # ADX, Aroon, Ichimoku, Parabolic SAR, SuperTrend
└── patterns.ts        # Candlestick pattern detection (doji, hammer, etc.)
```

Each file exports pure functions. No React, no state, no side effects.

## Implementing Indicator Math

Follow this function signature pattern:

```typescript
export function myIndicator(data: number[], period: number, options?: MyOptions): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const out = nanArray(data.length);

  // Indicator computation
  for (let i = period - 1; i < data.length; i++) {
    // ... math
    out[i] = computedValue;
  }

  return out;
}
```

Key conventions:

- Return an array the **same length** as the input. Use `NaN` for indices where the indicator hasn't accumulated enough data.
- Use the `validNumber()` helper to guard against NaN/Infinity in input.
- For multi-output indicators, return a named object:

```typescript
export function bollingerBands(
  data: number[],
  period: number,
  multiplier: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  const upper = nanArray(data.length);
  const lower = nanArray(data.length);

  for (let i = period - 1; i < data.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j] - middle[i]) ** 2;
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + multiplier * std;
    lower[i] = middle[i] - multiplier * std;
  }

  return { upper, middle, lower };
}
```

For indicators that need OHLCV bars (not just close prices), accept the `BarData` type:

```typescript
interface BarData {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

export function atr(bars: BarData[], period: number): number[] { /* ... */ }
```

## Registering with the Indicator System

After implementing the math, register the indicator in `lib/indicators/index.ts`:

```typescript
import { myIndicator } from './myModule';

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  // ... existing entries
  my_indicator: {
    name: 'My Indicator',
    shortName: 'MI',
    category: 'momentum',           // momentum | trend | volatility | volume | custom
    overlay: false,                  // true = drawn on price chart, false = separate pane
    defaultParams: { period: 14 },
    params: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
    ],
    outputs: [
      { key: 'value', label: 'MI', color: '#2962FF', lineWidth: 2 },
    ],
    calculate: (data, params) => myIndicator(data, params.period as number),
  },
};
```

The `IndicatorDefinition` type:

```typescript
interface IndicatorDefinition {
  name: string;
  shortName: string;
  category: 'momentum' | 'trend' | 'volatility' | 'volume' | 'custom';
  overlay: boolean;
  defaultParams: Record<string, number | string | boolean>;
  params: ParamDefinition[];
  outputs: OutputDefinition[];
  calculate: (data: number[] | BarData[], params: Record<string, any>) => number[] | Record<string, number[]>;
}
```

## UI Config Panel

When a user adds the indicator, a config panel is auto-generated from the `params` array. Each param entry maps to a form control:

| `type`    | Control      |
| --------- | ------------ |
| `number`  | Numeric input with min/max/step |
| `select`  | Dropdown from `options` array    |
| `boolean` | Toggle switch                    |
| `color`   | Color picker                     |

```typescript
params: [
  { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
  { key: 'source', label: 'Source', type: 'select', options: ['close', 'open', 'hl2', 'hlc3', 'ohlc4'] },
  { key: 'showSignal', label: 'Show Signal', type: 'boolean' },
],
```

## Worker Integration

Indicators run in the `indicatorWorker` to avoid blocking the main thread. Add a case to the worker's dispatch:

```typescript
// In workers/indicatorWorker.ts → calculateIndicator()
switch (indicator.type) {
  // ... existing cases
  case 'my_indicator':
    return myIndicator(data, (p.period as number) ?? 14);
}
```

The worker receives `InboundMessage` and responds with `OutboundMessage`:

```typescript
// Main thread → Worker
{ type: 'calculate', taskId: 'abc123', indicators: [{ type: 'my_indicator', params: { period: 14 } }], bars: [...] }

// Worker → Main thread
{ type: 'result', taskId: 'abc123', data: { indicator: 'my_indicator', values: [NaN, NaN, ..., 65.2, 58.1] } }
```

For batch calculation (multiple indicators at once), the worker processes them sequentially and reports progress:

```typescript
{ type: 'batch', taskId: 'xyz', indicators: [...], bars: [...] }
// Worker sends progress: { type: 'progress', taskId: 'xyz', progress: 0.5 }
// Then result:           { type: 'result', taskId: 'xyz', data: { ... } }
```

## Testing with Known Values

Test against hand-calculated or reference values:

```typescript
import { describe, it, expect } from 'vitest';
import { myIndicator } from '@/lib/indicators/myModule';

describe('myIndicator', () => {
  const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84];

  it('computes correctly for period 5', () => {
    const result = myIndicator(data, 5);
    expect(result[4]).toBeCloseTo(44.07, 1);
    expect(result[8]).toBeCloseTo(45.10, 1);
  });

  it('returns NaN before period is reached', () => {
    const result = myIndicator(data, 5);
    expect(result[0]).toBeNaN();
    expect(result[3]).toBeNaN();
  });

  it('handles empty data', () => {
    expect(myIndicator([], 14)).toEqual([]);
  });

  it('handles period > data length', () => {
    const result = myIndicator([1, 2, 3], 10);
    expect(result.every(Number.isNaN)).toBe(true);
  });

  it('handles NaN in input', () => {
    const result = myIndicator([1, NaN, 3, 4, 5], 3);
    expect(result[2]).toBeNaN(); // NaN in window prevents computation
  });
});
```

Use reference data from established charting platforms (TradingView, Bloomberg) to validate against.

## Conventions

- Pure functions only — no state, no DOM, no fetch calls.
- Same-length output arrays with NaN padding.
- Use `nanArray(n)` helper for initial output arrays.
- Guard all arithmetic with `validNumber()`.
- Parameter defaults must match industry standard periods (RSI=14, MACD=12/26/9, BB=20/2).

## Do's and Don'ts

**Do:**
- Return `number[]` or `{ key: number[] }` — nothing else
- Validate inputs at the top of every function (empty check, period check)
- Use existing moving average functions as building blocks (e.g., RSI uses RMA internally)
- Add the indicator to both `lib/indicators/` and `workers/indicatorWorker.ts`
- Write at least 4 test cases: happy path, edge case, empty data, NaN handling

**Don't:**
- Mutate the input array
- Throw errors for bad input — return empty or NaN-filled arrays
- Import React or browser APIs in indicator files
- Skip the worker integration — all indicators must work off the main thread
- Use `Math.round` on financial data — preserve precision
