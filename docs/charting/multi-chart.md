# Multi-Chart Layout

Layout and synchronization for multiple chart panes.

## Architecture

Charts share a common time scale and can be linked for pan/zoom. Implemented via:

- `frontend/src/lib/chartTypes/index.ts` — chart processors per pane
- Viewport state: `{ timeRange, priceRange, width, height }`
- Event bus for cross-chart sync

## Time Scale Sync

```typescript
// Shared time range across all panes
const sharedTimeRange: [number, number] = [startTs, endTs];

// Each pane has its own price range
const paneViewports = panes.map((p, i) => ({
  timeRange: sharedTimeRange,
  priceRange: p.priceRange,
  width: p.width,
  height: p.height,
}));
```

## Pane Types

| Pane | Content | Processor |
|------|---------|-----------|
| Main | Price | Candlestick, HeikinAshi, etc. |
| Volume | Volume bars | VolumeProfile, OBV |
| Indicators | Overlays | RSI, MACD, etc. |
| Options | Greeks | Options matrix |

## Resize and Layout

```typescript
// ResizeObserver for responsive layout
const chartHeight = container.clientHeight / paneCount;
panes.forEach((pane, i) => {
  pane.viewport.height = chartHeight - GAP;
  pane.viewport.width = container.clientWidth;
});
```

## Cross-Chart Events

- Pan/zoom on main chart updates all panes
- Drawing tool changes emit to other panes if linked
