# Advanced Charting Engine

Apex Terminal's charting engine delivers institutional-grade visualization powered by TradingView's lightweight-charts library, extended with seven alternative chart types, multi-pane layouts, and sub-millisecond real-time price rendering.

## Table of Contents

- [Architecture](#architecture)
- [Lightweight-Charts Integration](#lightweight-charts-integration)
- [Chart Types](#chart-types)
- [Multi-Chart Layouts](#multi-chart-layouts)
- [Overlays and Crosshair](#overlays-and-crosshair)
- [Scale Modes](#scale-modes)
- [Timeframes](#timeframes)
- [Real-Time Price Updates](#real-time-price-updates)
- [Chart Snapshots](#chart-snapshots)

## Architecture

The `ChartEngine` class in `core/` orchestrates chart lifecycle, data binding, and render coordination. It owns the lightweight-charts `IChartApi` instance and exposes a reactive interface consumed by React components via `useChart`.

```typescript
// core/ChartEngine.ts
export class ChartEngine {
  private chart: IChartApi;
  private series: Map<string, ISeriesApi<SeriesType>>;

  constructor(container: HTMLElement, options: ChartEngineOptions) {
    this.chart = createChart(container, {
      layout: { background: { color: '#0a0a0f' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1e1e2d' }, horzLines: { color: '#1e1e2d' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    this.series = new Map();
  }

  addCandlestickSeries(id: string, data: CandlestickData[]): ISeriesApi<'Candlestick'> {
    const series = this.chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });
    series.setData(data);
    this.series.set(id, series);
    return series;
  }
}
```

## Lightweight-Charts Integration

The engine wraps `lightweight-charts` v4 and adds:

- **Series management** — typed map of active series with automatic cleanup on unmount.
- **Marker pipeline** — annotation markers injected via `series.setMarkers()` for trade signals.
- **Price line factory** — horizontal price lines for support/resistance, alerts, and order levels.
- **Custom plugins** — user-defined renderers attached through the `ISeriesApi.attachPrimitive()` API.

## Chart Types

Beyond the default candlestick, the engine supports seven alternative types from `lib/chartTypes/`:

| Module | Chart Type | Use Case |
|---|---|---|
| `heikinAshi.ts` | Heikin-Ashi | Trend smoothing, noise reduction |
| `renko.ts` | Renko | Pure price movement, time-independent |
| `kagi.ts` | Kagi | Reversal detection, supply/demand shifts |
| `pointAndFigure.ts` | Point & Figure | Support/resistance identification |
| `lineBreak.ts` | Line Break | Trend confirmation without time axis |
| `rangeBar.ts` | Range Bar | Volatility-normalized bars |
| `equivolume.ts` | Equivolume | Volume encoded in bar width |

```typescript
import { toHeikinAshi } from '@/lib/chartTypes/heikinAshi';
import { toRenko } from '@/lib/chartTypes/renko';

const haData = toHeikinAshi(ohlcData);
const renkoData = toRenko(ohlcData, { boxSize: 10, style: 'atr', atrPeriod: 14 });
```

## Multi-Chart Layouts

The `ChartGrid` component renders 1–16 synchronized chart panes in configurable grid layouts (1×1 through 4×4). Each pane maintains its own `ChartEngine` instance but shares crosshair position and time range through a `SyncController`.

```typescript
const syncController = new SyncController(chartEngines);
syncController.enableCrosshairSync();   // linked crosshair across panes
syncController.enableTimeRangeSync();   // scroll/zoom propagation
```

## Overlays and Crosshair

Overlays are transparent canvas layers rendered above the chart series:

- **Crosshair overlay** — vertical/horizontal tracking lines with OHLCV tooltip.
- **Drawing overlay** — user-drawn shapes rendered by `lib/drawing/` renderers.
- **Order overlay** — pending order lines with drag-to-modify interaction.
- **Alert overlay** — triggered/active alert price levels.

The crosshair displays a floating data window showing open, high, low, close, volume, and change percentage for the bar under the cursor.

## Scale Modes

Three price-axis scale modes are available, toggled from the chart toolbar:

| Mode | Description |
|---|---|
| **Linear** | Standard arithmetic scale, default for most instruments |
| **Logarithmic** | Percentage-based spacing, ideal for long-term equity analysis |
| **Percentage** | Normalizes all series to percentage change from the first visible bar |

```typescript
chart.priceScale('right').applyOptions({ mode: PriceScaleMode.Logarithmic });
```

## Timeframes

The timeframe selector supports granularities from 1-second to monthly, with custom interval support:

```typescript
const TIMEFRAMES = [
  { label: '1s', seconds: 1 },    { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },   { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },  { label: '4h', seconds: 14400 },
  { label: '1D', seconds: 86400 }, { label: '1W', seconds: 604800 },
  { label: '1M', seconds: 2592000 },
];
```

Switching timeframes triggers a data refetch through the `marketDataApi` with server-side aggregation, then re-initializes the active series.

## Real-Time Price Updates

Live price ticks arrive via WebSocket and are applied to the chart with `series.update()`:

```typescript
ws.onmessage = (event) => {
  const tick: PriceTick = JSON.parse(event.data);
  const bar = engine.updateOrCreateBar(tick);
  series.update(bar);
};
```

The engine coalesces ticks arriving within the same timeframe bar into a single OHLCV update to avoid unnecessary repaints. A 16ms throttle aligned to `requestAnimationFrame` ensures smooth rendering even under high-frequency feeds.

## Chart Snapshots

Export the current chart view as a PNG image for sharing or reporting:

```typescript
const canvas = engine.getChart().takeScreenshot();
const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve, 'image/png'));
downloadBlob(blob, `${symbol}_${timeframe}_${Date.now()}.png`);
```

Snapshots capture the full chart state including overlays, drawings, and indicators. A clipboard variant copies the image directly for pasting into external applications.
