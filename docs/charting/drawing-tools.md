# Drawing Tools

50+ drawing tools in `frontend/src/lib/ta/drawing-tools.ts`. Each tool: `{ id, name, category, hitTest, render, toJSON, fromJSON }`.

## Types

```typescript
interface ChartPoint { time: number; price: number; }

interface DrawingState {
  points: ChartPoint[];
  params?: Record<string, unknown>;
}

interface DrawingToolDefinition {
  id: string;
  name: string;
  category: 'lines' | 'channels' | 'fibonacci' | 'gann' | 'shapes' | 'annotations' | 'measurements';
  minPoints: number;
  maxPoints?: number;
  hitTest: (state, ctx: HitTestContext) => { hit: boolean; pointIndex?: number };
  render: (state, ctx: RenderContext) => void;
  toJSON: (state: DrawingState) => string;
  fromJSON: (json: string) => DrawingState;
}
```

## Categories

### Lines
TrendLine, Ray, ExtendedLine, HorizontalLine, VerticalLine, CrossLine

### Channels
ParallelChannel, RegressionTrend, AndrewsPitchfork, DisjointChannel, FlatChannel, FibChannel

### Fibonacci
FibonacciRetracement, FibonacciExtension, FibonacciFan, FibonacciArc, FibonacciTimeZone, FibSpiral, FibWedge, FibCircle

### Gann
GannBox, GannFan, GannSquare, GannSquareFixed

### Shapes
Rectangle, Circle, Ellipse, Triangle, Polyline, Arc

### Annotations
Arrow, ArrowMarker, Text, InfoLine

### Measurements
Measure, PriceRange, DateRange

## Usage

```typescript
import { TrendLine, HorizontalLine } from '@/lib/ta/drawing-tools';

const state: DrawingState = {
  points: [
    { time: 1700000000000, price: 100 },
    { time: 1700086400000, price: 105 },
  ],
};

const viewport = {
  timeRange: [1700000000000, 1700172800000],
  priceRange: [95, 110],
  width: 800,
  height: 400,
};

// Hit testing
const hit = TrendLine.hitTest(state, { x: 100, y: 50, viewport });
if (hit.hit) { /* user clicked on tool */ }

// Serialization
const json = TrendLine.toJSON(state);
const restored = TrendLine.fromJSON(json);
```

## Render Context

```typescript
render(state, {
  ctx: canvas.getContext('2d')!,
  viewport,
  style: { color: '#2962FF', lineWidth: 2 },
});
```
