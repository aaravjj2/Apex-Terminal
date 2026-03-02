# Drawing Tool Guide

Adding new drawing tools to the Apex Terminal chart engine.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Drawing Categories](#drawing-categories)
- [Implementing a New Tool](#implementing-a-new-tool)
- [Hit Testing](#hit-testing)
- [Rendering](#rendering)
- [Serialization](#serialization)
- [Registering in the Toolbar](#registering-in-the-toolbar)
- [Persistence](#persistence)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Architecture Overview

Drawing tools live in `frontend/src/lib/drawing/`:

```
lib/drawing/
├── types.ts   # DrawingType enum, Point, Style interfaces, coordinate helpers
├── core.ts    # Drawing engine: create, update, hit-test, render, undo/redo
└── index.ts   # Barrel export
```

The system uses a **command pattern** for undo/redo. Each drawing modification creates a `DrawingCommand` pushed onto the undo stack.

Key types from `types.ts`:

```typescript
interface Point {
  x: number;      // pixel x
  y: number;      // pixel y
  time: number;   // unix timestamp (seconds)
  price: number;  // price value
}

interface Drawing {
  id: string;
  type: DrawingType;
  points: Point[];
  style: DrawingStyle;
  locked: boolean;
  hidden: boolean;
  layer: number;
  timeframeVisibility: string[];
  selected: boolean;
  hovered: boolean;
  creating: boolean;
}
```

## Drawing Categories

The `DrawingType` enum organizes tools into categories:

| Category     | Tools                                                          |
| ------------ | -------------------------------------------------------------- |
| Lines        | TrendLine, Ray, HorizontalLine, VerticalLine, ExtendedLine     |
| Channels     | ParallelChannel, FlatChannel, RegressionTrend                  |
| Pitchfork    | AndrewsPitchfork, SchiffPitchfork, ModifiedSchiff              |
| Fibonacci    | FibRetracement, FibExtension, FibChannel, FibFan, FibArc       |
| Gann         | GannBox, GannSquare, GannFan                                   |
| Shapes       | Rectangle, Ellipse, Triangle, Polyline, Arrow                  |
| Patterns     | XABCD, HeadAndShoulders, ElliottImpulse, CyclicLines           |
| Annotations  | Text, Note, Callout, PriceLabel, Flag                          |
| Measurements | PriceRange, DatePriceRange, LongPosition, ShortPosition        |
| Freehand     | Brush, Highlighter                                             |

## Implementing a New Tool

### 1. Add the type to the enum

In `lib/drawing/types.ts`:

```typescript
export enum DrawingType {
  // ... existing entries
  MyTool = 'my_tool',
}
```

### 2. Define required points

Each tool specifies how many points the user must place:

```typescript
const POINT_COUNTS: Record<DrawingType, number> = {
  [DrawingType.TrendLine]: 2,
  [DrawingType.HorizontalLine]: 1,
  [DrawingType.FibRetracement]: 2,
  [DrawingType.AndrewsPitchfork]: 3,
  // ...
  [DrawingType.MyTool]: 2,  // ← add entry
};
```

### 3. Implement the renderer

In `lib/drawing/core.ts`, add a render function:

```typescript
function renderMyTool(ctx: CanvasRenderingContext2D, drawing: Drawing, vp: Viewport): void {
  if (drawing.points.length < 2) return;

  const p1 = pointToPixel(drawing.points[0], vp);
  const p2 = pointToPixel(drawing.points[1], vp);
  const style = drawing.style as LineStyle;

  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.globalAlpha = style.opacity;
  if (style.dashPattern.length) ctx.setLineDash(style.dashPattern);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  // ... custom rendering logic
  ctx.stroke();

  if (style.showLabels) {
    drawLabel(ctx, 'My Tool', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, style);
  }

  ctx.restore();
}
```

### 4. Register the renderer in the dispatch

```typescript
function renderDrawing(ctx: CanvasRenderingContext2D, drawing: Drawing, vp: Viewport): void {
  switch (drawing.type) {
    case DrawingType.TrendLine: return renderTrendLine(ctx, drawing, vp);
    // ... existing cases
    case DrawingType.MyTool: return renderMyTool(ctx, drawing, vp);
  }
}
```

## Hit Testing

Hit testing determines if a mouse position intersects a drawing. Return a `HitTestResult`:

```typescript
interface HitTestResult {
  hit: boolean;
  drawingId: string;
  pointIndex: number;  // -1 = body, >= 0 = control point
  distance: number;
}
```

Implement hit testing for your tool:

```typescript
function hitTestMyTool(drawing: Drawing, mouseX: number, mouseY: number, vp: Viewport): HitTestResult {
  const threshold = 6; // pixels

  // Check control points first
  for (let i = 0; i < drawing.points.length; i++) {
    const pp = pointToPixel(drawing.points[i], vp);
    const dist = Math.hypot(mouseX - pp.x, mouseY - pp.y);
    if (dist <= threshold) return { hit: true, drawingId: drawing.id, pointIndex: i, distance: dist };
  }

  // Check line body
  const p1 = pointToPixel(drawing.points[0], vp);
  const p2 = pointToPixel(drawing.points[1], vp);
  const dist = pointToLineDistance(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y);

  return { hit: dist <= threshold, drawingId: drawing.id, pointIndex: -1, distance: dist };
}
```

Use `pointToPixel()` and `pixelToPoint()` from `types.ts` for coordinate conversion.

## Rendering

Rendering follows a layered approach:

1. **Background fills** — Fibonacci zones, Gann boxes
2. **Lines and strokes** — Trend lines, channels, shapes
3. **Labels and text** — Price labels, Fibonacci levels
4. **Control points** — Visible when selected/hovered (small circles at anchor points)

Use `ctx.save()` / `ctx.restore()` around each drawing to isolate style state.

For selection visuals, draw small circles at each control point:

```typescript
if (drawing.selected) {
  for (const pt of drawing.points) {
    const pp = pointToPixel(pt, vp);
    ctx.fillStyle = '#2962FF';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

## Serialization

Drawings are serialized to JSON for persistence. The `Drawing` interface is designed to be JSON-safe:

```typescript
const serialized = JSON.stringify(drawing);
const restored: Drawing = JSON.parse(serialized);
```

Ensure your tool's style type is included in the `DrawingStyle` union:

```typescript
export type DrawingStyle = LineStyle | FibStyle | ShapeStyle | TextStyle | PatternStyle | MeasurementStyle | GannStyle;
```

If your tool needs a new style type, add it to the union and define defaults.

## Registering in the Toolbar

Add the tool to the toolbar configuration so users can select it:

```typescript
const DRAWING_TOOLBAR: ToolbarGroup[] = [
  {
    label: 'Lines',
    tools: [
      { type: DrawingType.TrendLine, icon: TrendLineIcon, label: 'Trend Line' },
      // ...
    ],
  },
  {
    label: 'Custom',
    tools: [
      { type: DrawingType.MyTool, icon: MyToolIcon, label: 'My Tool', hotkey: 'Shift+M' },
    ],
  },
];
```

## Persistence

Drawings are stored per-chart in the `chartStore`:

```typescript
// chartStore already handles this — just use the existing actions
useChartStore.getState().addDrawing(chartId, newDrawing);
useChartStore.getState().updateDrawing(chartId, drawingId, { style: newStyle });
useChartStore.getState().removeDrawing(chartId, drawingId);
```

For cross-session persistence, drawings are saved to localStorage/IndexedDB as part of the workspace save. The serialization format must remain backward-compatible.

## Conventions

- All coordinates stored as `{ time, price }` — pixel coordinates are computed at render time.
- Use the coordinate helpers from `types.ts`: `timeToX`, `priceToY`, `pointToPixel`, `pixelToPoint`.
- Default style comes from `DEFAULT_*_STYLE` constants.
- Drawing IDs are generated via `generateId()` from `types.ts`.

## Do's and Don'ts

**Do:**
- Store anchor points in time/price space, not pixel space
- Implement hit testing for both control points and body
- Support the `hidden`, `locked`, and `timeframeVisibility` fields
- Use `ctx.save()` / `ctx.restore()` in render functions
- Add a default style constant for your drawing category

**Don't:**
- Store pixel coordinates in the drawing — they change on resize/zoom
- Skip hit testing — it breaks selection and drag interactions
- Render directly to the DOM — all drawing goes through Canvas 2D context
- Create drawings that can't be serialized to JSON (no functions, no DOM refs)
- Mutate drawing objects directly — use the store's `updateDrawing` action
