# Volume Analysis

Volume indicators and chart overlays.

## Volume Profile

```typescript
import { VolumeProfile } from '@/lib/ta/indicators-extended';

const result = VolumeProfile(data, { bins: 50 });
// result.bins: { price, volume, percent }[]
// result.vah, result.val, result.poc, result.totalVolume
```

## OBV and Volume Oscillators

```typescript
const obv = OBV(closes, { volumes });
const vo = VolumeOscillator(volumes, { short: 5, long: 10 });
const cmf = CMF(data, { highs, lows, closes, volumes });
const mfi = MFI(data, { highs, lows, closes, volumes, period: 14 });
```

## VWAP

```typescript
const vwap = VWAP(data, { highs, lows, closes, volumes });
```

API: `GET /api/market-data/vwap/:symbol?anchor_time=`

## Cumulative Volume

- PVT (Price Volume Trend)
- NVI, PVI
- EMV (Ease of Movement)
- Klinger Volume Oscillator
