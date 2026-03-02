# Drawing Tools

Apex Terminal provides over 70 drawing tools organized into seven renderer categories, enabling traders to annotate charts with trend lines, Fibonacci retracements, Gann fans, measurement tools, and complex pattern overlays — all persisted across sessions and synchronized across multi-chart layouts.

## Table of Contents

- [Architecture](#architecture)
- [Renderer Categories](#renderer-categories)
- [Lines](#lines)
- [Fibonacci Tools](#fibonacci-tools)
- [Gann Tools](#gann-tools)
- [Annotations](#annotations)
- [Measurement Tools](#measurement-tools)
- [Pattern Tools](#pattern-tools)
- [Shape Tools](#shape-tools)
- [Tool Selection and Interaction](#tool-selection-and-interaction)
- [Drawing Persistence](#drawing-persistence)
- [Multi-Chart Sync](#multi-chart-sync)
- [Snap-to-Price](#snap-to-price)
- [Undo / Redo](#undo--redo)

## Architecture

The drawing system lives in `lib/drawing/` with a plugin-based renderer architecture. Each drawing tool is a self-contained renderer that implements the `IDrawingRenderer` interface:

```typescript
// lib/drawing/types.ts
export interface IDrawingRenderer {
  id: string;
  type: DrawingType;
  points: AnchorPoint[];
  render(ctx: CanvasRenderingContext2D, coordMap: CoordinateMapper): void;
  hitTest(x: number, y: number, tolerance: number): boolean;
  serialize(): SerializedDrawing;
  static deserialize(data: SerializedDrawing): IDrawingRenderer;
}
```

A `DrawingManager` coordinates tool activation, mouse/touch event routing, z-order stacking, and the undo/redo command stack.

## Renderer Categories

| Category | Module | Count | Examples |
|---|---|---|---|
| Lines | `renderers/lines.ts` | 12 | Trend line, ray, horizontal, vertical, channel, pitchfork |
| Fibonacci | `renderers/fibonacci.ts` | 10 | Retracement, extension, fan, arc, time zones, spiral |
| Gann | `renderers/gann.ts` | 6 | Fan, square, box, angles, grid |
| Annotations | `renderers/annotations.ts` | 10 | Text, callout, arrow marker, price label, note, emoji |
| Measures | `renderers/measures.ts` | 8 | Price range, date range, price/date combo, bars count |
| Patterns | `renderers/patterns.ts` | 14 | Head & shoulders, triangle, wedge, flag, XABCD harmonic |
| Shapes | `renderers/shapes.ts` | 12 | Rectangle, ellipse, arc, polyline, brush, highlighter |

## Lines

Line renderers form the foundation of chart annotation:

```typescript
import { TrendLine, Channel, AndrewsPitchfork } from '@/lib/drawing/renderers/lines';

const trendLine = new TrendLine({
  p1: { time: 1700000000, price: 150.25 },
  p2: { time: 1700500000, price: 162.80 },
  style: { color: '#3b82f6', width: 2, dash: [] },
  extend: { left: false, right: true },
});
```

Supported line types: trend line, ray, extended line, horizontal line, vertical line, parallel channel, regression channel, disjoint channel, Andrews' pitchfork, Schiff pitchfork, inside pitchfork, and multi-point path.

## Fibonacci Tools

Fibonacci renderers compute level lines from anchor points using the golden ratio sequence:

```typescript
import { FibRetracement } from '@/lib/drawing/renderers/fibonacci';

const fib = new FibRetracement({
  p1: { time: t1, price: swingLow },
  p2: { time: t2, price: swingHigh },
  levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
  showLabels: true,
  fillBetweenLevels: true,
});
```

Available Fibonacci tools: retracement, extension, fan, arc, time zones, circles, spiral, channel, wedge, and three-point extension.

## Gann Tools

Gann renderers implement W.D. Gann's geometric price-time analysis:

- **Gann Fan** — rays at standard Gann angles (1×1, 1×2, 2×1, etc.) from an anchor point.
- **Gann Square** — price-time grid based on the square of nine.
- **Gann Box** — rectangular overlay with diagonal and intermediate subdivisions.

## Annotations

Text and label tools for contextual notes directly on the chart:

```typescript
import { Callout, PriceLabel } from '@/lib/drawing/renderers/annotations';

const callout = new Callout({
  anchor: { time: t, price: p },
  text: 'Earnings beat — gap up',
  style: { background: '#1e1e2d', border: '#3b82f6', fontSize: 12 },
});
```

## Measurement Tools

Measurement renderers display calculated values between two anchor points:

- **Price Range** — vertical distance in price units and percentage.
- **Date Range** — horizontal distance in bars and calendar time.
- **Price & Date** — combined rectangle showing Δprice, Δtime, and implied annualized return.
- **Bars Count** — number of bars between two time points.

## Pattern Tools

Pattern renderers overlay recognized chart patterns with visual guides:

```typescript
import { HeadAndShoulders, XABCD } from '@/lib/drawing/renderers/patterns';

const hs = new HeadAndShoulders({
  leftShoulder: p1, head: p2, rightShoulder: p3,
  neckline: { start: n1, end: n2 },
  target: projectedTarget,
});
```

Supported patterns include: head & shoulders (regular/inverse), double top/bottom, triple top/bottom, ascending/descending/symmetrical triangle, rising/falling wedge, bull/pennant flag, cup & handle, and XABCD harmonic patterns (Gartley, Bat, Butterfly, Crab).

## Shape Tools

Freeform drawing primitives for flexible annotation:

Rectangle, ellipse, triangle, arc, polyline, polygon, brush (freehand), highlighter (semi-transparent brush), arrow, curved path, rotated rectangle, and rounded rectangle.

## Tool Selection and Interaction

The drawing toolbar groups tools by category with fly-out sub-menus. Selecting a tool enters draw mode where click/drag interactions place anchor points. Tools support:

- **Magnetic cursor** — snaps to OHLC values when near a price bar.
- **Modifier keys** — Shift constrains angles to 15° increments, Ctrl disables snapping.
- **Double-click** to finish multi-point tools (polyline, brush).
- **Right-click** context menu for properties, duplication, and deletion.

## Drawing Persistence

All drawings serialize to JSON and persist in IndexedDB via `useIndexedDB`:

```typescript
const serialized = drawingManager.serializeAll();
await indexedDB.put('drawings', { symbol, timeframe, drawings: serialized });
```

Drawings restore automatically when revisiting a symbol/timeframe combination.

## Multi-Chart Sync

When multi-chart sync is enabled, drawings created on one pane propagate to all panes displaying the same symbol. The `SyncController` broadcasts drawing events through a shared `BroadcastChannel`.

## Snap-to-Price

The snap engine aligns anchor points to the nearest OHLC value within a configurable pixel tolerance (default 10px). Snap targets include: open, high, low, close, and existing drawing anchor points for precise alignment.

## Undo / Redo

Drawing mutations push commands onto an undo stack managed by `DrawingManager`:

```typescript
drawingManager.undo(); // Ctrl+Z — reverts last drawing action
drawingManager.redo(); // Ctrl+Y — reapplies undone action
```

The command stack tracks creation, deletion, move, resize, and property changes with a configurable depth of 50 operations.
