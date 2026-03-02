# Chart Overlays

Overlay indicators and studies drawn on the main price chart.

## Types

- **Overlays**: Drawn on price scale — Bollinger Bands, MA, Ichimoku
- **Oscillators**: Separate pane — RSI, MACD, Stochastic

## Overlay Examples

```typescript
import { BollingerBands, SMA, IchimokuCloud } from '@/lib/ta/indicators-extended';

const closes = ohlcv.map(b => b.close);

// Bollinger — same scale as price
const bb = BollingerBands(closes, { period: 20, stdDev: 2 });
// bb.upper, bb.middle, bb.lower

// SMA overlay
const sma20 = SMA(closes, { period: 20 });
const sma50 = SMA(closes, { period: 50 });

// Ichimoku — 5 lines on price
const ichi = IchimokuCloud(closes, { highs, lows });
// tenkan, kijun, senkouA, senkouB, chikou
```

## Rendering

Overlays use the same viewport as the price chart. Map `(time, value)` to `(x, y)`:

```typescript
function valueToY(value: number, priceRange: [number, number], height: number) {
  const [lo, hi] = priceRange;
  return ((hi - value) / (hi - lo || 1)) * height;
}
```

## Keltner and Donchian

```typescript
const keltner = KeltnerChannel(closes, { highs, lows, period: 20, multiplier: 2 });
const donchian = DonchianChannel(closes, { period: 20 });
```
