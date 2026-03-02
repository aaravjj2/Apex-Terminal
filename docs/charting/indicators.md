# Technical Indicators

80+ pure-function indicators in `frontend/src/lib/ta/indicators-extended.ts`.

## API

```typescript
// (data: number[], params?: IndicatorParams) => number[] | object
export interface IndicatorParams {
  period?: number;  // default 14
  fast?: number;   // MACD, etc.
  slow?: number;
  signal?: number;
  stdDev?: number; // Bollinger
  highs?: number[];
  lows?: number[];
  opens?: number[];
  volumes?: number[];
}
```

Use `extractOHLCV` for OHLCV data:

```typescript
import { RSI, extractOHLCV, INDICATORS_EXTENDED } from '@/lib/ta/indicators-extended';

const { closes } = extractOHLCV(ohlcv);
const rsi = RSI(closes, { period: 14 });
```

## Categories

### Moving Averages
SMA, EMA, WMA, DEMA, TEMA, HullMA, VWMA, KAMA, ALMA, FRAMA, T3, ZLEMA, RMA, VAMA, McGinleyDynamic

### Momentum
RSI, ROC, Momentum, StochRSI, WilliamsR, CCI, UltimateOscillator, TSI, CMO, AwesomeOscillator, ElderForceIndex, KST, TRIX

### Volatility
ATR, BollingerBands, KeltnerChannel, DonchianChannel, HistoricalVolatility, ChaikinVolatility, StandardDeviation, BBPercentB, BBWidth

### Volume
OBV, ADLine, CMF, MFI, VWAP, VolumeProfile, VolumeOscillator, PVT, VPT, NVI, PVI, EMV, Klinger

### Trend
ADX, Aroon, AroonOscillator, ParabolicSAR, Supertrend, IchimokuCloud, ChandelierExit

### Multi-Output

```typescript
// MACD returns { macd, signal, histogram }
const result = MACD(closes, { fast: 12, slow: 26, signal: 9 });

// BollingerBands returns { upper, middle, lower }
const bb = BollingerBands(closes, { period: 20, stdDev: 2 });

// Stochastic returns { k, d }
const stoch = Stochastic(closes, { highs, lows, period: 14 });
```

## Warm-up

Indicators return NaN for warm-up periods. Use `lastValid()`:

```typescript
import { lastValid, RSI } from '@/lib/ta/indicators-extended';
const val = lastValid(RSI(closes, { period: 14 }));
```
