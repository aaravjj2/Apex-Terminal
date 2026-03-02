# Technical Indicators

Apex Terminal ships over 100 technical indicators computed in dedicated Web Workers for zero-jank UI performance. The indicator library in `lib/indicators/` is organized into six modules covering momentum, moving averages, volatility, volume, trend, and pattern recognition.

## Table of Contents

- [Architecture](#architecture)
- [Worker-Based Computation](#worker-based-computation)
- [Momentum Indicators](#momentum-indicators)
- [Moving Averages](#moving-averages)
- [Volatility Indicators](#volatility-indicators)
- [Volume Indicators](#volume-indicators)
- [Trend Indicators](#trend-indicators)
- [Pattern Recognition](#pattern-recognition)
- [Custom Indicator API](#custom-indicator-api)
- [Indicator Overlay Rendering](#indicator-overlay-rendering)

## Architecture

Each indicator module exports pure functions that accept OHLCV arrays and parameter objects, returning typed result arrays. No side effects, no DOM access — designed for worker execution:

```typescript
// lib/indicators/momentum.ts
export function rsi(data: OHLCVData[], period: number = 14): IndicatorResult[] {
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const delta = data[i].close - data[i - 1].close;
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? Math.abs(delta) : 0);
  }
  const avgGain = wilderSmoothing(gains, period);
  const avgLoss = wilderSmoothing(losses, period);
  return avgGain.map((g, i) => ({
    time: data[i + period].time,
    value: avgLoss[i] === 0 ? 100 : 100 - 100 / (1 + g / avgLoss[i]),
  }));
}
```

## Worker-Based Computation

Heavy indicator calculations run in a pool of Web Workers managed by `useWorker`. The main thread sends OHLCV data and parameters; the worker returns results without blocking the UI:

```typescript
// hooks/useWorker.ts integration
const { compute } = useWorker('indicators');

const rsiResult = await compute('rsi', { data: ohlcv, period: 14 });
const macdResult = await compute('macd', { data: ohlcv, fast: 12, slow: 26, signal: 9 });
```

The worker pool scales from 1 to `navigator.hardwareConcurrency` threads and reuses workers across indicator requests via a task queue.

## Momentum Indicators

Module: `lib/indicators/momentum.ts`

| Indicator | Function | Default Parameters |
|---|---|---|
| RSI | `rsi()` | period: 14 |
| MACD | `macd()` | fast: 12, slow: 26, signal: 9 |
| Stochastic | `stochastic()` | kPeriod: 14, dPeriod: 3, smooth: 3 |
| Stochastic RSI | `stochasticRsi()` | rsiPeriod: 14, stochPeriod: 14 |
| Williams %R | `williamsR()` | period: 14 |
| CCI | `cci()` | period: 20 |
| ROC | `rateOfChange()` | period: 12 |
| Momentum | `momentum()` | period: 10 |
| TSI | `tsi()` | long: 25, short: 13 |
| Ultimate Oscillator | `ultimateOscillator()` | p1: 7, p2: 14, p3: 28 |

```typescript
const { macdLine, signalLine, histogram } = macd(ohlcv, { fast: 12, slow: 26, signal: 9 });
```

## Moving Averages

Module: `lib/indicators/movingAverages.ts`

| Indicator | Function | Description |
|---|---|---|
| SMA | `sma()` | Simple moving average |
| EMA | `ema()` | Exponential moving average |
| WMA | `wma()` | Weighted moving average |
| VWAP | `vwap()` | Volume-weighted average price |
| DEMA | `dema()` | Double exponential MA |
| TEMA | `tema()` | Triple exponential MA |
| Hull MA | `hma()` | Hull moving average (reduced lag) |
| KAMA | `kama()` | Kaufman adaptive MA |
| ALMA | `alma()` | Arnaud Legoux MA |
| ZLEMA | `zlema()` | Zero-lag EMA |

```typescript
const sma20 = sma(ohlcv, { period: 20, source: 'close' });
const ema50 = ema(ohlcv, { period: 50, source: 'close' });
const dailyVwap = vwap(ohlcv);
```

## Volatility Indicators

Module: `lib/indicators/volatility.ts`

| Indicator | Function | Default Parameters |
|---|---|---|
| Bollinger Bands | `bollingerBands()` | period: 20, stdDev: 2 |
| ATR | `atr()` | period: 14 |
| Keltner Channel | `keltnerChannel()` | emaPeriod: 20, atrPeriod: 10, mult: 1.5 |
| Donchian Channel | `donchianChannel()` | period: 20 |
| Standard Deviation | `stdDev()` | period: 20 |
| Historical Volatility | `historicalVol()` | period: 21, annualize: true |
| Chaikin Volatility | `chaikinVolatility()` | emaPeriod: 10, rocPeriod: 10 |

```typescript
const { upper, middle, lower } = bollingerBands(ohlcv, { period: 20, stdDev: 2 });
```

## Volume Indicators

Module: `lib/indicators/volume.ts`

| Indicator | Function | Description |
|---|---|---|
| OBV | `obv()` | On-balance volume — cumulative volume flow |
| MFI | `mfi()` | Money Flow Index — volume-weighted RSI |
| VWAP | `vwap()` | Session VWAP with standard deviation bands |
| A/D Line | `adLine()` | Accumulation/Distribution line |
| CMF | `cmf()` | Chaikin Money Flow |
| Volume Profile | `volumeProfile()` | Price-bucketed volume distribution |
| Force Index | `forceIndex()` | Elder's force index |
| EMV | `emv()` | Ease of Movement |

## Trend Indicators

Module: `lib/indicators/trend.ts`

| Indicator | Function | Default Parameters |
|---|---|---|
| ADX | `adx()` | period: 14 |
| Aroon | `aroon()` | period: 25 |
| Ichimoku Cloud | `ichimoku()` | tenkan: 9, kijun: 26, senkou: 52 |
| Supertrend | `supertrend()` | period: 10, multiplier: 3 |
| Parabolic SAR | `parabolicSar()` | step: 0.02, max: 0.2 |
| TRIX | `trix()` | period: 15 |
| Vortex | `vortex()` | period: 14 |

```typescript
const { tenkan, kijun, senkouA, senkouB, chikou } = ichimoku(ohlcv);
```

## Pattern Recognition

Module: `lib/indicators/patterns.ts`

Candlestick pattern detection scans OHLCV data and returns signal arrays:

```typescript
const signals = detectPatterns(ohlcv, {
  patterns: ['doji', 'hammer', 'engulfing', 'morningStar', 'threeWhiteSoldiers'],
  minConfidence: 0.7,
});
// signals: [{ time, pattern: 'hammer', direction: 'bullish', confidence: 0.85 }]
```

Recognized patterns include: Doji (standard, dragonfly, gravestone), Hammer/Hanging Man, Engulfing (bull/bear), Morning/Evening Star, Three White Soldiers / Black Crows, Harami, Piercing Line / Dark Cloud Cover, Spinning Top, Marubozu, and Tweezer tops/bottoms.

## Custom Indicator API

Users can register custom indicators that integrate with the worker pipeline:

```typescript
registerIndicator({
  name: 'customSpread',
  inputs: ['close'],
  params: [{ name: 'lookback', default: 20 }],
  compute: (close: number[], { lookback }) => {
    return close.map((c, i) => i >= lookback ? c - smaCalc(close, i, lookback) : null);
  },
});
```

## Indicator Overlay Rendering

Indicators render as either **overlays** (on the price pane — moving averages, Bollinger Bands) or **oscillators** (separate pane — RSI, MACD). The `ChartEngine` auto-detects the render mode from the indicator's `overlay` property and creates/manages sub-panes accordingly.
