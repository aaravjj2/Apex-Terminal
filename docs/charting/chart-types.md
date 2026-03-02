# Chart Types

Technical chart type processors transform OHLCV data into renderable formats.

## Overview

Located at `frontend/src/lib/ta/chart-types.ts` and `frontend/src/lib/chartTypes/`. Each processor: `(data: OHLCV[]) => RenderableData`.

## Base Types

```typescript
interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RenderableCandle {
  time: number;
  open: number; high: number; low: number; close: number;
  direction: 'up' | 'down';
  bodySize: number; upperWick: number; lowerWick: number;
  bodyTop: number; bodyBottom: number;
}
```

## Candlestick

Standard candlestick processor with direction and wick calculations.

```typescript
import { Candlestick } from '@/lib/ta/chart-types';

const candles = Candlestick(ohlcvData);
// Returns RenderableCandle[] with bodyTop, bodyBottom, upperWick, lowerWick
```

## Alternative Chart Types

From `frontend/src/lib/chartTypes/`:

| Type | Module | Key Function |
|------|--------|--------------|
| Renko | renko.ts | generateRenkoBricks |
| Point & Figure | pointAndFigure.ts | generatePnFColumns |
| Kagi | kagi.ts | generateKagiLines |
| Line Break | lineBreak.ts | generateLineBreakBlocks |
| Heikin-Ashi | heikinAshi.ts | computeHeikinAshi |
| Range Bar | rangeBar.ts | generateRangeBars |
| Equivolume | equivolume.ts | generateEquivolumeBoxes |

## Volume Profile

```typescript
import { VolumeProfile } from '@/lib/ta/chart-types';

const result = VolumeProfile(data, { bins: 50 });
// Returns { bins: VolumeProfileBin[], vah, val, poc, totalVolume }
```

## Footprint / Order Flow

`Footprint` processor produces per-price bid/ask/delta cells when tick data available.

## Market Profile

Time-price-opportunity (TPO) visualization with `MarketProfile` processor.

## Heikin-Ashi Example

```typescript
import { computeHeikinAshi } from '@/lib/chartTypes/heikinAshi';

const haCandles = computeHeikinAshi(ohlcvBars);
// Smoothed OHLC for reduced noise
```

## Renko Example

```typescript
import { generateRenkoBricks } from '@/lib/chartTypes/renko';

const bricks = generateRenkoBricks(ohlcvData, { brickSize: 2 });
```
