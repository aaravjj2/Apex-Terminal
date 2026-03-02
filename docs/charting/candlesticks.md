# Candlestick Charts

Primary chart type for OHLCV data.

## Processor

`frontend/src/lib/ta/chart-types.ts` — `Candlestick(data: OHLCV[])`:

```typescript
export function Candlestick(data: OHLCV[]): RenderableCandle[] {
  return data.map(bar => {
    const direction = bar.close >= bar.open ? 'up' : 'down';
    const bodyTop = Math.max(bar.open, bar.close);
    const bodyBottom = Math.min(bar.open, bar.close);
    return {
      time, open, high, low, close, volume,
      direction,
      bodySize: Math.abs(bar.close - bar.open),
      upperWick: bar.high - bodyTop,
      lowerWick: bodyBottom - bar.low,
      bodyTop, bodyBottom,
    };
  });
}
```

## RenderableCandle Fields

| Field | Type | Description |
|-------|------|--------------|
| direction | 'up' \| 'down' | Bullish or bearish |
| bodySize | number | |close - open| |
| upperWick | number | high - bodyTop |
| lowerWick | number | bodyBottom - low |
| bodyTop | number | Max of open, close |
| bodyBottom | number | Min of open, close |

## Doji Detection

```typescript
const isDoji = bar.bodySize < (bar.high - bar.low) * 0.1;
```

## Heikin-Ashi Smoothed Candles

Use `computeHeikinAshi` from `@/lib/chartTypes/heikinAshi` for reduced noise.
