# Heatmaps

Heatmap visualizations for volume, delta, and option surfaces.

## Volume Profile Heatmap

Bins price vs volume; color by volume density.

```typescript
import { VolumeProfile } from '@/lib/ta/indicators-extended';

const { bins } = VolumeProfile(data, { bins: 50 });
const maxVol = Math.max(...bins.map(b => b.volume));
bins.forEach(bin => {
  const intensity = bin.volume / maxVol;
  // render cell at (price, time) with color scale
});
```

## Options Heatmap

For `OptionsMatrixUI2` — implied vol or Greeks across strike/expiry.

- Rows: expiry
- Cols: strike
- Color: IV, delta, gamma, theta, vega

## Delta Heatmap (Footprint)

When order-flow tick data available: bid vs ask volume per price level.

```typescript
interface FootprintCell {
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  time: number;
}
```
