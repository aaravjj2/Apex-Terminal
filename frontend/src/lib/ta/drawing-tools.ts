/**
 * drawing-tools.ts — 50+ Drawing Tool Definitions
 * ================================================
 * Each tool: { id, name, category, defaultParams, hitTest, render, toJSON, fromJSON }
 * For TradingView-style chart drawings. All exports.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ChartPoint {
  time: number;
  price: number;
}

export interface Viewport {
  timeRange: [number, number];
  priceRange: [number, number];
  width: number;
  height: number;
}

export interface DrawingState {
  points: ChartPoint[];
  params?: Record<string, unknown>;
}

export interface HitTestContext {
  x: number;
  y: number;
  viewport: Viewport;
  tolerance?: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  style?: Record<string, unknown>;
}

export interface DrawingToolDefinition {
  id: string;
  name: string;
  category: 'lines' | 'channels' | 'fibonacci' | 'gann' | 'shapes' | 'annotations' | 'measurements';
  minPoints: number;
  maxPoints?: number;
  defaultParams: Record<string, unknown>;
  hitTest: (state: DrawingState, ctx: HitTestContext) => { hit: boolean; pointIndex?: number };
  render: (state: DrawingState, ctx: RenderContext) => void;
  toJSON: (state: DrawingState) => string;
  fromJSON: (json: string) => DrawingState;
}

// ─── COORDINATE HELPERS ───────────────────────────────────────────────────────

function timeToX(time: number, vp: Viewport): number {
  const [t0, t1] = vp.timeRange;
  return ((time - t0) / (t1 - t0 || 1)) * vp.width;
}

function priceToY(price: number, vp: Viewport): number {
  const [lo, hi] = vp.priceRange;
  return ((hi - price) / (hi - lo || 1)) * vp.height;
}

function xToTime(x: number, vp: Viewport): number {
  const [t0, t1] = vp.timeRange;
  return t0 + (x / vp.width) * (t1 - t0);
}

function yToPrice(y: number, vp: Viewport): number {
  const [lo, hi] = vp.priceRange;
  return hi - (y / vp.height) * (hi - lo);
}

function ptToPx(pt: ChartPoint, vp: Viewport): { x: number; y: number } {
  return { x: timeToX(pt.time, vp), y: priceToY(pt.price, vp) };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function distToSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

function distToRay(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, x1, y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  if (t < 0) return dist(px, py, x1, y1);
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

function inRect(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// ─── DEFAULT PARAMS ──────────────────────────────────────────────────────────

const LINE_PARAMS = {
  color: '#2962FF',
  lineWidth: 2,
  dashPattern: [] as number[],
  opacity: 1,
  extendLeft: false,
  extendRight: false,
};

const FIB_PARAMS = {
  color: '#787B86',
  lineWidth: 1,
  levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
  showLabels: true,
  fillOpacity: 0.1,
};

const SHAPE_PARAMS = {
  strokeColor: '#2962FF',
  fillColor: '#2962FF',
  lineWidth: 2,
  fillOpacity: 0.1,
};

// ─── TOOL FACTORY ─────────────────────────────────────────────────────────────

function createTool(def: Omit<DrawingToolDefinition, 'toJSON' | 'fromJSON'>): DrawingToolDefinition {
  return {
    ...def,
    toJSON: (state: DrawingState) => JSON.stringify({
      points: state.points,
      params: state.params ?? def.defaultParams,
    }),
    fromJSON: (json: string) => {
      const data = JSON.parse(json);
      return {
        points: data.points ?? [],
        params: data.params ?? def.defaultParams,
      };
    },
  };
}

// ─── TREND LINE ───────────────────────────────────────────────────────────────

export const TrendLine = createTool({
  id: 'trend_line',
  name: 'Trend Line',
  category: 'lines',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2) {
      const d = distToSegment(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── RAY ─────────────────────────────────────────────────────────────────────

export const Ray = createTool({
  id: 'ray',
  name: 'Ray',
  category: 'lines',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2) {
      const d = distToRay(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const [t0, t1] = ctx.viewport.timeRange;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const extend = 5000;
    const endX = pts[0].x + dx * (1 + extend / Math.hypot(dx, dy));
    const endY = pts[0].y + dy * (1 + extend / Math.hypot(dx, dy));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(endX, endY);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── EXTENDED LINE ───────────────────────────────────────────────────────────

export const ExtendedLine = createTool({
  id: 'extended_line',
  name: 'Extended Line',
  category: 'lines',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2) {
      const lineLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const perp = Math.abs(
        (pts[1].y - pts[0].y) * ctx.x - (pts[1].x - pts[0].x) * ctx.y +
        pts[1].x * pts[0].y - pts[1].y * pts[0].x
      ) / (lineLen || 1);
      if (perp <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const ext = 2000;
    const len = Math.hypot(dx, dy) || 1;
    const startX = pts[0].x - (dx / len) * ext;
    const startY = pts[0].y - (dy / len) * ext;
    const endX = pts[1].x + (dx / len) * ext;
    const endY = pts[1].y + (dy / len) * ext;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(startX, startY);
    ctx.ctx.lineTo(endX, endY);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── HORIZONTAL LINE ───────────────────────────────────────────────────────────

export const HorizontalLine = createTool({
  id: 'horizontal_line',
  name: 'Horizontal Line',
  category: 'lines',
  minPoints: 1,
  maxPoints: 1,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    if (state.points.length < 1) return { hit: false };
    const pt = ptToPx(state.points[0], ctx.viewport);
    if (dist(ctx.x, ctx.y, ctx.viewport.width / 2, pt.y) <= tol) return { hit: true };
    if (Math.abs(ctx.y - pt.y) <= tol) return { hit: true };
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 1) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(0, pt.y);
    ctx.ctx.lineTo(ctx.viewport.width, pt.y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.setLineDash([4, 4]);
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
  },
});

// ─── VERTICAL LINE ────────────────────────────────────────────────────────────

export const VerticalLine = createTool({
  id: 'vertical_line',
  name: 'Vertical Line',
  category: 'lines',
  minPoints: 1,
  maxPoints: 1,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    if (state.points.length < 1) return { hit: false };
    const pt = ptToPx(state.points[0], ctx.viewport);
    if (Math.abs(ctx.x - pt.x) <= tol) return { hit: true };
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 1) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, 0);
    ctx.ctx.lineTo(pt.x, ctx.viewport.height);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.setLineDash([4, 4]);
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
  },
});

// ─── CROSS LINE ───────────────────────────────────────────────────────────────

export const CrossLine = createTool({
  id: 'cross_line',
  name: 'Cross Line',
  category: 'lines',
  minPoints: 1,
  maxPoints: 1,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    if (state.points.length < 1) return { hit: false };
    const pt = ptToPx(state.points[0], ctx.viewport);
    if (dist(ctx.x, ctx.y, pt.x, pt.y) <= tol * 2) return { hit: true };
    if (Math.abs(ctx.x - pt.x) <= tol || Math.abs(ctx.y - pt.y) <= tol) return { hit: true };
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 1) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, 0);
    ctx.ctx.lineTo(pt.x, ctx.viewport.height);
    ctx.ctx.moveTo(0, pt.y);
    ctx.ctx.lineTo(ctx.viewport.width, pt.y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.setLineDash([4, 4]);
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
  },
});

// ─── PARALLEL CHANNEL ─────────────────────────────────────────────────────────

export const ParallelChannel = createTool({
  id: 'parallel_channel',
  name: 'Parallel Channel',
  category: 'channels',
  minPoints: 3,
  maxPoints: 3,
  defaultParams: { ...LINE_PARAMS, showFill: true },
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 3) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const p2 = { x: pts[2].x + dx, y: pts[2].y + dy };
      const d1 = distToSegment(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      const d2 = distToSegment(ctx.x, ctx.y, pts[2].x, pts[2].y, p2.x, p2.y);
      if (d1 <= tol || d2 <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const p3 = { x: pts[2].x + dx, y: pts[2].y + dy };
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(p3.x, p3.y);
    ctx.ctx.lineTo(pts[2].x, pts[2].y);
    ctx.ctx.closePath();
    ctx.ctx.fillStyle = 'rgba(41, 98, 255, 0.05)';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── REGRESSION TREND ─────────────────────────────────────────────────────────

export const RegressionTrend = createTool({
  id: 'regression_trend',
  name: 'Regression Trend',
  category: 'channels',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => TrendLine.hitTest(state, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.setLineDash([6, 4]);
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
  },
});

// ─── ANDREWS PITCHFORK ─────────────────────────────────────────────────────────

export const AndrewsPitchfork = createTool({
  id: 'andrews_pitchfork',
  name: "Andrews' Pitchfork",
  category: 'channels',
  minPoints: 3,
  maxPoints: 3,
  defaultParams: { ...LINE_PARAMS, showFill: false },
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 3) {
      const midX = (pts[1].x + pts[2].x) / 2;
      const midY = (pts[1].y + pts[2].y) / 2;
      const d1 = distToSegment(ctx.x, ctx.y, pts[0].x, pts[0].y, midX, midY);
      const d2 = distToSegment(ctx.x, ctx.y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      if (d1 <= tol || d2 <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const midX = (pts[1].x + pts[2].x) / 2;
    const midY = (pts[1].y + pts[2].y) / 2;
    const dx = midX - pts[0].x;
    const dy = midY - pts[0].y;
    const ext = 500;
    const len = Math.hypot(dx, dy) || 1;
    const endX = midX + (dx / len) * ext;
    const endY = midY + (dy / len) * ext;

    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(endX, endY);
    ctx.ctx.moveTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(pts[1].x + dx * 2, pts[1].y + dy * 2);
    ctx.ctx.moveTo(pts[2].x, pts[2].y);
    ctx.ctx.lineTo(pts[2].x + dx * 2, pts[2].y + dy * 2);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── FIBONACCI RETRACEMENT ────────────────────────────────────────────────────

export const FibonacciRetracement = createTool({
  id: 'fib_retracement',
  name: 'Fibonacci Retracement',
  category: 'fibonacci',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2 && inRect(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
      return { hit: true };
    if (pts.length >= 2) {
      const d = distToSegment(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const levels = (state.params?.levels as number[]) ?? FIB_PARAMS.levels;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const [p0, p1] = state.points;
    const low = Math.min(p0.price, p1.price);
    const high = Math.max(p0.price, p1.price);
    const range = high - low;

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? FIB_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    ctx.ctx.setLineDash([2, 2]);

    for (const lvl of levels) {
      const price = low + range * (1 - lvl);
      const y = priceToY(price, ctx.viewport);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pts[0].x, y);
      ctx.ctx.lineTo(pts[1].x, y);
      ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

// ─── FIBONACCI EXTENSION ──────────────────────────────────────────────────────

export const FibonacciExtension = createTool({
  id: 'fib_extension',
  name: 'Fibonacci Extension',
  category: 'fibonacci',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...FIB_PARAMS, levels: [0, 0.382, 0.618, 1, 1.382, 1.618] },
  hitTest: FibonacciRetracement.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const levels = (state.params?.levels as number[]) ?? [0, 0.382, 0.618, 1, 1.382, 1.618];
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const [p0, p1] = state.points;
    const low = Math.min(p0.price, p1.price);
    const high = Math.max(p0.price, p1.price);
    const range = high - low;

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? FIB_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    for (const lvl of levels) {
      const price = high + range * (lvl - 1);
      const y = priceToY(price, ctx.viewport);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pts[0].x, y);
      ctx.ctx.lineTo(pts[1].x, y);
      ctx.ctx.stroke();
    }
  },
});

// ─── FIBONACCI FAN ────────────────────────────────────────────────────────────

export const FibonacciFan = createTool({
  id: 'fib_fan',
  name: 'Fibonacci Fan',
  category: 'fibonacci',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const levels = (state.params?.levels as number[]) ?? [0.236, 0.382, 0.5, 0.618, 0.786];
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const [p0, p1] = state.points;
    const low = Math.min(p0.price, p1.price);
    const high = Math.max(p0.price, p1.price);
    const range = high - low;

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? FIB_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    ctx.ctx.setLineDash([2, 2]);

    for (const lvl of levels) {
      const targetPrice = low + range * (1 - lvl);
      const t = (p1.time - p0.time) * lvl + p0.time;
      const endX = timeToX(t, ctx.viewport);
      const endY = priceToY(targetPrice, ctx.viewport);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pts[0].x, pts[0].y);
      ctx.ctx.lineTo(endX, endY);
      ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

// ─── FIBONACCI ARC ────────────────────────────────────────────────────────────

export const FibonacciArc = createTool({
  id: 'fib_arc',
  name: 'Fibonacci Arc',
  category: 'fibonacci',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const levels = (state.params?.levels as number[]) ?? [0.382, 0.5, 0.618];
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const [p0, p1] = state.points;
    const range = Math.abs(p1.price - p0.price);
    const cx = pts[0].x;
    const cy = (pts[0].y + pts[1].y) / 2;

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? FIB_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    ctx.ctx.setLineDash([2, 2]);

    for (const lvl of levels) {
      const r = (range * lvl * ctx.viewport.height) / (ctx.viewport.priceRange[1] - ctx.viewport.priceRange[0]);
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, Math.abs(r), Math.abs(r), 0, -Math.PI / 2, Math.PI / 2);
      ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

// ─── FIBONACCI TIME ZONE ───────────────────────────────────────────────────────

export const FibonacciTimeZone = createTool({
  id: 'fib_time_zone',
  name: 'Fibonacci Time Zone',
  category: 'fibonacci',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const levels = (state.params?.levels as number[]) ?? [1, 2, 3, 5, 8, 13, 21];
    const [p0, p1] = state.points;
    const tRange = p1.time - p0.time;

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? FIB_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    ctx.ctx.setLineDash([4, 4]);

    for (const fib of levels) {
      const t = p0.time + tRange * (fib / 21);
      const x = timeToX(t, ctx.viewport);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(x, 0);
      ctx.ctx.lineTo(x, ctx.viewport.height);
      ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

// ─── RECTANGLE ────────────────────────────────────────────────────────────────

export const Rectangle = createTool({
  id: 'rectangle',
  name: 'Rectangle',
  category: 'shapes',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2 && inRect(ctx.x, ctx.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
      return { hit: true };
    if (pts.length >= 2) {
      const minX = Math.min(pts[0].x, pts[1].x);
      const maxX = Math.max(pts[0].x, pts[1].x);
      const minY = Math.min(pts[0].y, pts[1].y);
      const maxY = Math.max(pts[0].y, pts[1].y);
      const d = Math.min(
        Math.abs(ctx.x - minX), Math.abs(ctx.x - maxX),
        Math.abs(ctx.y - minY), Math.abs(ctx.y - maxY)
      );
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);
    ctx.ctx.fillStyle = ((ctx.style?.fillColor as string) ?? SHAPE_PARAMS.fillColor) + '26';
    ctx.ctx.fillRect(x, y, w, h);
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.strokeRect(x, y, w, h);
  },
});

// ─── CIRCLE ───────────────────────────────────────────────────────────────────

export const Circle = createTool({
  id: 'circle',
  name: 'Circle',
  category: 'shapes',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2) {
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 2;
      const d = Math.abs(dist(ctx.x, ctx.y, cx, cy) - r);
      if (d <= tol) return { hit: true };
      if (dist(ctx.x, ctx.y, cx, cy) <= r) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 2;
    ctx.ctx.beginPath();
    ctx.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.ctx.fillStyle = ((ctx.style?.fillColor as string) ?? SHAPE_PARAMS.fillColor) + '26';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── ELLIPSE ───────────────────────────────────────────────────────────────────

export const Ellipse = createTool({
  id: 'ellipse',
  name: 'Ellipse',
  category: 'shapes',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 2) {
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const rx = Math.abs(pts[1].x - pts[0].x) / 2;
      const ry = Math.abs(pts[1].y - pts[0].y) / 2;
      const dx = (ctx.x - cx) / (rx || 1);
      const dy = (ctx.y - cy) / (ry || 1);
      const inside = dx * dx + dy * dy <= 1;
      const edgeDist = Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(rx, ry);
      if (inside || edgeDist <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const rx = Math.abs(pts[1].x - pts[0].x) / 2;
    const ry = Math.abs(pts[1].y - pts[0].y) / 2;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.ctx.fillStyle = ((ctx.style?.fillColor as string) ?? SHAPE_PARAMS.fillColor) + '26';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── TRIANGLE ────────────────────────────────────────────────────────────────

export const Triangle = createTool({
  id: 'triangle',
  name: 'Triangle',
  category: 'shapes',
  minPoints: 3,
  maxPoints: 3,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    if (pts.length >= 3) {
      const [p0, p1, p2] = pts;
      const d1 = distToSegment(ctx.x, ctx.y, p0.x, p0.y, p1.x, p1.y);
      const d2 = distToSegment(ctx.x, ctx.y, p1.x, p1.y, p2.x, p2.y);
      const d3 = distToSegment(ctx.x, ctx.y, p2.x, p2.y, p0.x, p0.y);
      if (d1 <= tol || d2 <= tol || d3 <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(pts[2].x, pts[2].y);
    ctx.ctx.closePath();
    ctx.ctx.fillStyle = ((ctx.style?.fillColor as string) ?? SHAPE_PARAMS.fillColor) + '26';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── POLYLINE ────────────────────────────────────────────────────────────────

export const Polyline = createTool({
  id: 'polyline',
  name: 'Polyline',
  category: 'shapes',
  minPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol)
        return { hit: true, pointIndex: i };
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(ctx.x, ctx.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.ctx.lineTo(pts[i].x, pts[i].y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── ARROW ────────────────────────────────────────────────────────────────────

export const Arrow = createTool({
  id: 'arrow',
  name: 'Arrow',
  category: 'shapes',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => TrendLine.hitTest(state, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const angle = Math.atan2(dy, dx);
    const headLen = 12;

    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(
      pts[1].x - headLen * Math.cos(angle - 0.4),
      pts[1].y - headLen * Math.sin(angle - 0.4)
    );
    ctx.ctx.lineTo(
      pts[1].x - headLen * Math.cos(angle + 0.4),
      pts[1].y - headLen * Math.sin(angle + 0.4)
    );
    ctx.ctx.closePath();
    ctx.ctx.fillStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();

    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x - headLen * Math.cos(angle) * 0.5, pts[1].y - headLen * Math.sin(angle) * 0.5);
    ctx.ctx.stroke();
  },
});

// ─── GANN BOX ─────────────────────────────────────────────────────────────────

export const GannBox = createTool({
  id: 'gann_box',
  name: 'Gann Box',
  category: 'gann',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...SHAPE_PARAMS, showGrid: true, levels: [0.25, 0.5, 0.75] },
  hitTest: Rectangle.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);
    const levels = (state.params?.levels as number[]) ?? [0.25, 0.5, 0.75];

    ctx.ctx.strokeStyle = ((ctx.style?.color as string) ?? '#2962FF') + '88';
    ctx.ctx.lineWidth = 1;
    for (const lvl of levels) {
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(x + w * lvl, y);
      ctx.ctx.lineTo(x + w * lvl, y + h);
      ctx.ctx.moveTo(x, y + h * lvl);
      ctx.ctx.lineTo(x + w, y + h * lvl);
      ctx.ctx.stroke();
    }
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.strokeRect(x, y, w, h);
  },
});

// ─── GANN FAN ─────────────────────────────────────────────────────────────────

export const GannFan = createTool({
  id: 'gann_fan',
  name: 'Gann Fan',
  category: 'gann',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...LINE_PARAMS, angles: [1, 2, 3, 4, 5, 6, 7, 8] },
  hitTest: FibonacciRetracement.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const angles = (state.params?.angles as number[]) ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const [p0, p1] = state.points;
    const tRange = ctx.viewport.timeRange[1] - ctx.viewport.timeRange[0];
    const pRange = ctx.viewport.priceRange[1] - ctx.viewport.priceRange[0];
    const scale = (ctx.viewport.width / tRange) * (pRange / ctx.viewport.height);

    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 1;
    ctx.ctx.setLineDash([2, 2]);

    for (const n of angles) {
      const slope = (p1.price - p0.price) / (p1.time - p0.time || 1);
      const gannSlope = slope * (n / 8);
      const endTime = p1.time + (ctx.viewport.timeRange[1] - p1.time);
      const endPrice = p1.price + gannSlope * (endTime - p1.time);
      const endX = timeToX(endTime, ctx.viewport);
      const endY = priceToY(endPrice, ctx.viewport);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pts[0].x, pts[0].y);
      ctx.ctx.lineTo(endX, endY);
      ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

// ─── SCHIFF PITCHFORK ──────────────────────────────────────────────────────────

export const SchiffPitchfork = createTool({
  id: 'schiff_pitchfork',
  name: 'Schiff Pitchfork',
  category: 'channels',
  minPoints: 3,
  maxPoints: 3,
  defaultParams: LINE_PARAMS,
  hitTest: AndrewsPitchfork.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const midX = (pts[1].x + pts[2].x) / 2;
    const midY = (pts[1].y + pts[2].y) / 2;
    const dx = midX - pts[0].x;
    const dy = midY - pts[0].y;
    const ext = 600;

    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[0].x + dx * 2, pts[0].y + dy * 2);
    ctx.ctx.moveTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(pts[1].x + dx * 2, pts[1].y + dy * 2);
    ctx.ctx.moveTo(pts[2].x, pts[2].y);
    ctx.ctx.lineTo(pts[2].x + dx * 2, pts[2].y + dy * 2);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

// ─── PRICE RANGE ───────────────────────────────────────────────────────────────

export const PriceRange = createTool({
  id: 'price_range',
  name: 'Price Range',
  category: 'measurements',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...SHAPE_PARAMS, showLabels: true },
  hitTest: Rectangle.hitTest,
  render: Rectangle.render,
});

// ─── DATE RANGE ────────────────────────────────────────────────────────────────

export const DateRange = createTool({
  id: 'date_range',
  name: 'Date Range',
  category: 'measurements',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...SHAPE_PARAMS, showLabels: true },
  hitTest: Rectangle.hitTest,
  render: Rectangle.render,
});

// ─── ADDITIONAL TOOLS (compact definitions) ───────────────────────────────────

export const HorizontalRay = createTool({
  id: 'horizontal_ray',
  name: 'Horizontal Ray',
  category: 'lines',
  minPoints: 1,
  maxPoints: 1,
  defaultParams: LINE_PARAMS,
  hitTest: HorizontalLine.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 1) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(0, pt.y);
    ctx.ctx.lineTo(ctx.viewport.width, pt.y);
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

export const InfoLine = createTool({
  id: 'info_line',
  name: 'Info Line',
  category: 'lines',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: { ...LINE_PARAMS, showLabels: true },
  hitTest: TrendLine.hitTest,
  render: TrendLine.render,
});

export const DisjointChannel = createTool({
  id: 'disjoint_channel',
  name: 'Disjoint Channel',
  category: 'channels',
  minPoints: 4,
  defaultParams: LINE_PARAMS,
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 8;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    for (let i = 0; i < pts.length; i++) {
      if (dist(ctx.x, ctx.y, pts[i].x, pts[i].y) <= tol) return { hit: true, pointIndex: i };
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(ctx.x, ctx.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d <= tol) return { hit: true };
    }
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 4) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.lineTo(pts[3].x, pts[3].y);
    ctx.ctx.lineTo(pts[2].x, pts[2].y);
    ctx.ctx.closePath();
    ctx.ctx.strokeStyle = (ctx.style?.color as string) ?? LINE_PARAMS.color;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

export const FlatChannel = createTool({
  id: 'flat_channel',
  name: 'Flat Channel',
  category: 'channels',
  minPoints: 3,
  defaultParams: LINE_PARAMS,
  hitTest: ParallelChannel.hitTest,
  render: ParallelChannel.render,
});

export const ModifiedSchiffPitchfork = createTool({
  id: 'modified_schiff_pitchfork',
  name: 'Modified Schiff Pitchfork',
  category: 'channels',
  minPoints: 3,
  defaultParams: LINE_PARAMS,
  hitTest: AndrewsPitchfork.hitTest,
  render: SchiffPitchfork.render,
});

export const InsidePitchfork = createTool({
  id: 'inside_pitchfork',
  name: 'Inside Pitchfork',
  category: 'channels',
  minPoints: 3,
  defaultParams: LINE_PARAMS,
  hitTest: AndrewsPitchfork.hitTest,
  render: AndrewsPitchfork.render,
});

export const FibChannel = createTool({
  id: 'fib_channel',
  name: 'Fibonacci Channel',
  category: 'fibonacci',
  minPoints: 3,
  defaultParams: FIB_PARAMS,
  hitTest: ParallelChannel.hitTest,
  render: (state, ctx) => {
    if (state.points.length >= 3) ParallelChannel.render(state, ctx);
  },
});

export const FibSpiral = createTool({
  id: 'fib_spiral',
  name: 'Fibonacci Spiral',
  category: 'fibonacci',
  minPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: FibonacciArc.render,
});

export const FibWedge = createTool({
  id: 'fib_wedge',
  name: 'Fibonacci Wedge',
  category: 'fibonacci',
  minPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: FibonacciRetracement.render,
});

export const FibCircle = createTool({
  id: 'fib_circle',
  name: 'Fibonacci Circle',
  category: 'fibonacci',
  minPoints: 2,
  defaultParams: FIB_PARAMS,
  hitTest: FibonacciRetracement.hitTest,
  render: FibonacciArc.render,
});

export const GannSquare = createTool({
  id: 'gann_square',
  name: 'Gann Square',
  category: 'gann',
  minPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: Rectangle.hitTest,
  render: GannBox.render,
});

export const GannSquareFixed = createTool({
  id: 'gann_square_fixed',
  name: 'Gann Square (Fixed)',
  category: 'gann',
  minPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: Rectangle.hitTest,
  render: GannBox.render,
});

export const Arc = createTool({
  id: 'arc',
  name: 'Arc',
  category: 'shapes',
  minPoints: 3,
  defaultParams: SHAPE_PARAMS,
  hitTest: (state, ctx) => Polyline.hitTest(state, ctx),
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    ctx.ctx.strokeStyle = (ctx.style?.strokeColor as string) ?? SHAPE_PARAMS.strokeColor;
    ctx.ctx.lineWidth = (ctx.style?.lineWidth as number) ?? 2;
    ctx.ctx.stroke();
  },
});

export const ArrowMarker = createTool({
  id: 'arrow_marker',
  name: 'Arrow Marker',
  category: 'shapes',
  minPoints: 2,
  defaultParams: SHAPE_PARAMS,
  hitTest: Arrow.hitTest,
  render: Arrow.render,
});

export const Text = createTool({
  id: 'text',
  name: 'Text',
  category: 'annotations',
  minPoints: 1,
  maxPoints: 1,
  defaultParams: { text: '', fontSize: 14, color: '#D1D4DC' },
  hitTest: (state, ctx) => {
    const tol = ctx.tolerance ?? 15;
    if (state.points.length < 1) return { hit: false };
    const pt = ptToPx(state.points[0], ctx.viewport);
    if (dist(ctx.x, ctx.y, pt.x, pt.y) <= tol) return { hit: true };
    return { hit: false };
  },
  render: (state, ctx) => {
    if (state.points.length < 1) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const text = (state.params?.text as string) ?? '';
    ctx.ctx.font = `${state.params?.fontSize ?? 14}px sans-serif`;
    ctx.ctx.fillStyle = (state.params?.color as string) ?? '#D1D4DC';
    ctx.ctx.fillText(text, pt.x, pt.y);
  },
});

export const Measure = createTool({
  id: 'measure',
  name: 'Measure',
  category: 'measurements',
  minPoints: 2,
  maxPoints: 2,
  defaultParams: LINE_PARAMS,
  hitTest: TrendLine.hitTest,
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    TrendLine.render(state, ctx);
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    const [p0, p1] = state.points;
    const distPct = Math.abs((p1.price - p0.price) / (p0.price || 1)) * 100;
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#787B86';
    ctx.ctx.fillText(`${distPct.toFixed(2)}%`, midX, midY);
  },
});

// ─── ADDITIONAL DRAWING TOOLS ────────────────────────────────────────────────

const TrendAngle = createTool('TrendAngle', 'trend', 2, {
  hitTest: (state, p, ctx) => TrendLine.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    TrendLine.render(state, ctx);
    const pts = state.points.map(p => ptToPx(p, ctx.viewport));
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#FFD700';
    ctx.ctx.fillText(`${angle.toFixed(1)}°`, pts[0].x + 10, pts[0].y - 10);
  },
});

const RotatedRectangle = createTool('RotatedRectangle', 'shape', 3, {
  hitTest: (state, p, ctx) => {
    if (state.points.length < 3) return false;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / (len || 1), uy = dy / (len || 1);
    const vx = -uy, vy = ux;
    const w2 = pts[2].x - pts[0].x, h2 = pts[2].y - pts[0].y;
    const projW = w2 * ux + h2 * uy;
    const projH = w2 * vx + h2 * vy;
    const relX = (pp.x - pts[0].x) * ux + (pp.y - pts[0].y) * uy;
    const relY = (pp.x - pts[0].x) * vx + (pp.y - pts[0].y) * vy;
    return relX >= 0 && relX <= projW && relY >= 0 && relY <= Math.abs(projH);
  },
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / (len || 1), uy = dy / (len || 1);
    const vx = -uy, vy = ux;
    const h = (pts[2].x - pts[0].x) * vx + (pts[2].y - pts[0].y) * vy;
    const corners = [
      pts[0], pts[1],
      { x: pts[1].x + vx * h, y: pts[1].y + vy * h },
      { x: pts[0].x + vx * h, y: pts[0].y + vy * h },
    ];
    ctx.ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.ctx.moveTo(c.x, c.y) : ctx.ctx.lineTo(c.x, c.y));
    ctx.ctx.closePath();
    ctx.ctx.strokeStyle = state.style?.color ?? '#2962FF';
    ctx.ctx.stroke();
  },
});

const Curve = createTool('Curve', 'shape', 3, {
  hitTest: (state, p, ctx) => {
    if (state.points.length < 3) return false;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    for (let t = 0; t <= 1; t += 0.02) {
      const mt = 1 - t;
      const bx = mt * mt * pts[0].x + 2 * mt * t * pts[1].x + t * t * pts[2].x;
      const by = mt * mt * pts[0].y + 2 * mt * t * pts[1].y + t * t * pts[2].y;
      if (Math.hypot(bx - pp.x, by - pp.y) < 6) return true;
    }
    return false;
  },
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    ctx.ctx.strokeStyle = state.style?.color ?? '#2962FF';
    ctx.ctx.stroke();
  },
});

const DateAndPriceRange = createTool('DateAndPriceRange', 'measure', 2, {
  hitTest: (state, p, ctx) => Rectangle.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    Rectangle.render(state, ctx);
    const [p0, p1] = state.points;
    const priceDiff = p1.price - p0.price;
    const pct = (priceDiff / (p0.price || 1)) * 100;
    const timeDiff = Math.abs(p1.time - p0.time);
    const days = Math.round(timeDiff / 86400);
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#E1E3E6';
    ctx.ctx.fillText(`${priceDiff.toFixed(2)} (${pct.toFixed(1)}%) / ${days}d`, midX - 40, midY);
  },
});

const BarsPattern = createTool('BarsPattern', 'pattern', 2, {
  hitTest: (state, p, ctx) => Rectangle.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    Rectangle.render(state, ctx);
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.font = '10px sans-serif';
    ctx.ctx.fillStyle = '#787B86';
    ctx.ctx.fillText('Bars Pattern', pts[0].x + 4, pts[0].y + 12);
  },
});

const GhostFeed = createTool('GhostFeed', 'pattern', 2, {
  hitTest: (state, p, ctx) => Rectangle.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.setLineDash([4, 4]);
    ctx.ctx.strokeStyle = state.style?.color ?? '#787B86';
    ctx.ctx.globalAlpha = 0.5;
    ctx.ctx.strokeRect(pts[0].x, pts[0].y, pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    ctx.ctx.globalAlpha = 1;
    ctx.ctx.setLineDash([]);
  },
});

const Projection = createTool('Projection', 'pattern', 3, {
  hitTest: (state, p, ctx) => {
    if (state.points.length < 2) return false;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    return pts.some(pt => Math.hypot(pt.x - pp.x, pt.y - pp.y) < 8);
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.setLineDash([6, 3]);
    ctx.ctx.strokeStyle = '#FFD700';
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
    if (state.points.length >= 3) {
      const projected = { x: pts[2].x + (pts[2].x - pts[1].x), y: pts[2].y + (pts[2].y - pts[1].y) };
      ctx.ctx.lineTo(projected.x, projected.y);
      ctx.ctx.stroke();
    }
  },
});

const LongPosition = createTool('LongPosition', 'trade', 2, {
  hitTest: (state, p, ctx) => Rectangle.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const entry = pts[0].y, target = pts[1].y;
    const stopY = entry + (entry - target);
    ctx.ctx.fillStyle = 'rgba(38, 166, 91, 0.15)';
    ctx.ctx.fillRect(pts[0].x, Math.min(entry, target), 120, Math.abs(target - entry));
    ctx.ctx.fillStyle = 'rgba(234, 57, 67, 0.15)';
    ctx.ctx.fillRect(pts[0].x, entry, 120, stopY - entry);
    ctx.ctx.strokeStyle = '#26A65B';
    ctx.ctx.setLineDash([4, 2]);
    ctx.ctx.beginPath(); ctx.ctx.moveTo(pts[0].x, entry); ctx.ctx.lineTo(pts[0].x + 120, entry); ctx.ctx.stroke();
    ctx.ctx.strokeStyle = '#EA3943';
    ctx.ctx.beginPath(); ctx.ctx.moveTo(pts[0].x, stopY); ctx.ctx.lineTo(pts[0].x + 120, stopY); ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
    ctx.ctx.font = '10px sans-serif';
    ctx.ctx.fillStyle = '#26A65B';
    ctx.ctx.fillText('LONG', pts[0].x + 4, entry - 4);
  },
});

const ShortPosition = createTool('ShortPosition', 'trade', 2, {
  hitTest: (state, p, ctx) => Rectangle.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const entry = pts[0].y, target = pts[1].y;
    const stopY = entry - (target - entry);
    ctx.ctx.fillStyle = 'rgba(234, 57, 67, 0.15)';
    ctx.ctx.fillRect(pts[0].x, Math.min(entry, target), 120, Math.abs(target - entry));
    ctx.ctx.fillStyle = 'rgba(38, 166, 91, 0.15)';
    ctx.ctx.fillRect(pts[0].x, stopY, 120, entry - stopY);
    ctx.ctx.strokeStyle = '#EA3943';
    ctx.ctx.setLineDash([4, 2]);
    ctx.ctx.beginPath(); ctx.ctx.moveTo(pts[0].x, entry); ctx.ctx.lineTo(pts[0].x + 120, entry); ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);
    ctx.ctx.font = '10px sans-serif';
    ctx.ctx.fillStyle = '#EA3943';
    ctx.ctx.fillText('SHORT', pts[0].x + 4, entry - 4);
  },
});

const Forecast = createTool('Forecast', 'pattern', 3, {
  hitTest: (state, p, ctx) => Projection.hitTest(state, p, ctx),
  render: (state, ctx) => {
    Projection.render(state, ctx);
    if (state.points.length >= 2) {
      const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
      ctx.ctx.font = '10px sans-serif';
      ctx.ctx.fillStyle = '#26A65B';
      ctx.ctx.fillText('Forecast', pts[0].x, pts[0].y - 6);
    }
  },
});

const XABCDPattern = createTool('XABCDPattern', 'harmonic', 5, {
  hitTest: (state, p, ctx) => {
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    return pts.some(pt => Math.hypot(pt.x - pp.x, pt.y - pp.y) < 8);
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#2962FF';
    ctx.ctx.stroke();
    const labels = ['X', 'A', 'B', 'C', 'D'];
    pts.forEach((pt, i) => {
      ctx.ctx.font = '11px sans-serif';
      ctx.ctx.fillStyle = '#E1E3E6';
      ctx.ctx.fillText(labels[i] || '', pt.x - 4, pt.y - 8);
    });
  },
});

const CypherPattern = createTool('CypherPattern', 'harmonic', 5, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    XABCDPattern.render(state, ctx);
    if (state.points.length >= 1) {
      const px = ptToPx(state.points[0], ctx.viewport);
      ctx.ctx.font = '10px sans-serif';
      ctx.ctx.fillStyle = '#FFD700';
      ctx.ctx.fillText('Cypher', px.x, px.y - 14);
    }
  },
});

const ABCDPattern = createTool('ABCDPattern', 'harmonic', 4, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#FF9800';
    ctx.ctx.stroke();
    ['A', 'B', 'C', 'D'].forEach((l, i) => {
      if (pts[i]) {
        ctx.ctx.font = '11px sans-serif';
        ctx.ctx.fillStyle = '#E1E3E6';
        ctx.ctx.fillText(l, pts[i].x - 4, pts[i].y - 8);
      }
    });
  },
});

const ThreeDrives = createTool('ThreeDrives', 'harmonic', 6, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#9C27B0';
    ctx.ctx.stroke();
    ['1', '2', '3', 'D1', 'D2', 'D3'].forEach((l, i) => {
      if (pts[i]) { ctx.ctx.fillStyle = '#E1E3E6'; ctx.ctx.fillText(l, pts[i].x - 4, pts[i].y - 8); }
    });
  },
});

const HeadAndShoulders = createTool('HeadAndShoulders', 'pattern', 7, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 3) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#FF5722';
    ctx.ctx.stroke();
    // Neckline
    if (pts.length >= 5) {
      ctx.ctx.setLineDash([4, 2]);
      ctx.ctx.beginPath(); ctx.ctx.moveTo(pts[1].x, pts[1].y); ctx.ctx.lineTo(pts[3].x, pts[3].y);
      ctx.ctx.strokeStyle = '#787B86'; ctx.ctx.stroke();
      ctx.ctx.setLineDash([]);
    }
    ctx.ctx.font = '10px sans-serif';
    ctx.ctx.fillStyle = '#FF5722';
    ctx.ctx.fillText('H&S', pts[0].x, pts[0].y - 12);
  },
});

const ElliottWaveImpulse = createTool('ElliottWaveImpulse', 'wave', 6, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#2962FF';
    ctx.ctx.stroke();
    ['0', '1', '2', '3', '4', '5'].forEach((l, i) => {
      if (pts[i]) { ctx.ctx.font = '12px sans-serif'; ctx.ctx.fillStyle = '#2962FF'; ctx.ctx.fillText(l, pts[i].x + 4, pts[i].y - 6); }
    });
  },
});

const ElliottWaveCorrection = createTool('ElliottWaveCorrection', 'wave', 4, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#FF9800';
    ctx.ctx.stroke();
    ['A', 'B', 'C'].forEach((l, i) => {
      if (pts[i]) { ctx.ctx.font = '12px sans-serif'; ctx.ctx.fillStyle = '#FF9800'; ctx.ctx.fillText(l, pts[i].x + 4, pts[i].y - 6); }
    });
  },
});

const ElliottWaveCombo = createTool('ElliottWaveCombo', 'wave', 8, {
  hitTest: (state, p, ctx) => XABCDPattern.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.ctx.moveTo(pt.x, pt.y) : ctx.ctx.lineTo(pt.x, pt.y));
    ctx.ctx.strokeStyle = '#4CAF50';
    ctx.ctx.stroke();
    ['W', 'X', 'Y', 'X2', 'Z'].forEach((l, i) => {
      if (pts[i]) { ctx.ctx.font = '12px sans-serif'; ctx.ctx.fillStyle = '#4CAF50'; ctx.ctx.fillText(l, pts[i].x + 4, pts[i].y - 6); }
    });
  },
});

const CyclicLines = createTool('CyclicLines', 'cycle', 2, {
  hitTest: (state, p, ctx) => {
    if (state.points.length < 2) return false;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    const spacing = Math.abs(pts[1].x - pts[0].x);
    if (spacing < 1) return false;
    const offset = (pp.x - pts[0].x) % spacing;
    return Math.abs(offset) < 4 || Math.abs(offset - spacing) < 4;
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const spacing = Math.abs(pts[1].x - pts[0].x);
    if (spacing < 1) return;
    ctx.ctx.strokeStyle = state.style?.color ?? '#787B86';
    ctx.ctx.setLineDash([2, 2]);
    const { width, height } = ctx.viewport;
    for (let x = pts[0].x; x <= width; x += spacing) {
      ctx.ctx.beginPath(); ctx.ctx.moveTo(x, 0); ctx.ctx.lineTo(x, height); ctx.ctx.stroke();
    }
    for (let x = pts[0].x - spacing; x >= 0; x -= spacing) {
      ctx.ctx.beginPath(); ctx.ctx.moveTo(x, 0); ctx.ctx.lineTo(x, height); ctx.ctx.stroke();
    }
    ctx.ctx.setLineDash([]);
  },
});

const TimeCycles = createTool('TimeCycles', 'cycle', 2, {
  hitTest: (state, p, ctx) => CyclicLines.hitTest(state, p, ctx),
  render: (state, ctx) => CyclicLines.render(state, ctx),
});

const SineLine = createTool('SineLine', 'cycle', 2, {
  hitTest: (state, p, ctx) => {
    if (state.points.length < 2) return false;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const pp = ptToPx(p, ctx.viewport);
    const period = Math.abs(pts[1].x - pts[0].x) * 2;
    const amp = Math.abs(pts[1].y - pts[0].y);
    if (period < 1) return false;
    const midY = (pts[0].y + pts[1].y) / 2;
    const sinY = midY + amp * Math.sin(((pp.x - pts[0].x) / period) * 2 * Math.PI);
    return Math.abs(sinY - pp.y) < 6;
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    const period = Math.abs(pts[1].x - pts[0].x) * 2;
    const amp = Math.abs(pts[1].y - pts[0].y);
    const midY = (pts[0].y + pts[1].y) / 2;
    ctx.ctx.beginPath();
    for (let x = 0; x <= ctx.viewport.width; x += 2) {
      const sy = midY + amp * Math.sin(((x - pts[0].x) / (period || 1)) * 2 * Math.PI);
      x === 0 ? ctx.ctx.moveTo(x, sy) : ctx.ctx.lineTo(x, sy);
    }
    ctx.ctx.strokeStyle = state.style?.color ?? '#2962FF';
    ctx.ctx.stroke();
  },
});

const Note = createTool('Note', 'annotation', 1, {
  hitTest: (state, p, ctx) => {
    if (!state.points.length) return false;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const pp = ptToPx(p, ctx.viewport);
    return Math.abs(pt.x - pp.x) < 60 && Math.abs(pt.y - pp.y) < 30;
  },
  render: (state, ctx) => {
    if (!state.points.length) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const txt = state.text ?? 'Note';
    ctx.ctx.fillStyle = 'rgba(30, 33, 40, 0.9)';
    ctx.ctx.fillRect(pt.x, pt.y, 120, 40);
    ctx.ctx.strokeStyle = '#787B86';
    ctx.ctx.strokeRect(pt.x, pt.y, 120, 40);
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#E1E3E6';
    ctx.ctx.fillText(txt, pt.x + 6, pt.y + 16);
  },
});

const AnchoredNote = createTool('AnchoredNote', 'annotation', 1, {
  hitTest: (state, p, ctx) => Note.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (!state.points.length) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.beginPath();
    ctx.ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.ctx.fillStyle = '#FFD700';
    ctx.ctx.fill();
    const txt = state.text ?? 'Anchored Note';
    ctx.ctx.fillStyle = 'rgba(30, 33, 40, 0.9)';
    ctx.ctx.fillRect(pt.x + 8, pt.y - 10, 130, 24);
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#E1E3E6';
    ctx.ctx.fillText(txt, pt.x + 12, pt.y + 6);
  },
});

const Callout = createTool('Callout', 'annotation', 2, {
  hitTest: (state, p, ctx) => Note.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    ctx.ctx.lineTo(pts[1].x, pts[1].y);
    ctx.ctx.strokeStyle = '#787B86';
    ctx.ctx.stroke();
    const txt = state.text ?? 'Callout';
    const tw = ctx.ctx.measureText(txt).width + 12;
    ctx.ctx.fillStyle = 'rgba(30, 33, 40, 0.95)';
    ctx.ctx.fillRect(pts[1].x, pts[1].y - 12, tw, 20);
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#E1E3E6';
    ctx.ctx.fillText(txt, pts[1].x + 6, pts[1].y + 2);
  },
});

const PriceLabel = createTool('PriceLabel', 'annotation', 1, {
  hitTest: (state, p, ctx) => {
    if (!state.points.length) return false;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const pp = ptToPx(p, ctx.viewport);
    return Math.abs(pt.x - pp.x) < 40 && Math.abs(pt.y - pp.y) < 12;
  },
  render: (state, ctx) => {
    if (!state.points.length) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const price = state.points[0].price.toFixed(2);
    ctx.ctx.fillStyle = '#2962FF';
    ctx.ctx.fillRect(pt.x, pt.y - 10, 60, 20);
    ctx.ctx.font = '11px sans-serif';
    ctx.ctx.fillStyle = '#FFF';
    ctx.ctx.fillText(`$${price}`, pt.x + 4, pt.y + 4);
  },
});

const Flag = createTool('Flag', 'annotation', 1, {
  hitTest: (state, p, ctx) => PriceLabel.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (!state.points.length) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.strokeStyle = '#787B86';
    ctx.ctx.beginPath(); ctx.ctx.moveTo(pt.x, pt.y); ctx.ctx.lineTo(pt.x, pt.y - 30); ctx.ctx.stroke();
    ctx.ctx.fillStyle = state.style?.color ?? '#FF5722';
    ctx.ctx.beginPath(); ctx.ctx.moveTo(pt.x, pt.y - 30); ctx.ctx.lineTo(pt.x + 20, pt.y - 22);
    ctx.ctx.lineTo(pt.x, pt.y - 14); ctx.ctx.fill();
  },
});

const Brush = createTool('Brush', 'freehand', 100, {
  hitTest: (state, p, ctx) => {
    const pp = ptToPx(p, ctx.viewport);
    return state.points.some(pt => {
      const ppt = ptToPx(pt, ctx.viewport);
      return Math.hypot(ppt.x - pp.x, ppt.y - pp.y) < 6;
    });
  },
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.ctx.lineTo(pts[i].x, pts[i].y);
    ctx.ctx.strokeStyle = state.style?.color ?? '#FF9800';
    ctx.ctx.lineWidth = 3;
    ctx.ctx.stroke();
    ctx.ctx.lineWidth = 1;
  },
});

const Highlighter = createTool('Highlighter', 'freehand', 100, {
  hitTest: (state, p, ctx) => Brush.hitTest(state, p, ctx),
  render: (state, ctx) => {
    if (state.points.length < 2) return;
    const pts = state.points.map(pt => ptToPx(pt, ctx.viewport));
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.ctx.lineTo(pts[i].x, pts[i].y);
    ctx.ctx.strokeStyle = state.style?.color ?? 'rgba(255, 235, 59, 0.4)';
    ctx.ctx.lineWidth = 12;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.stroke();
    ctx.ctx.lineWidth = 1;
    ctx.ctx.lineCap = 'butt';
  },
});

const EmojiSticker = createTool('EmojiSticker', 'annotation', 1, {
  hitTest: (state, p, ctx) => {
    if (!state.points.length) return false;
    const pt = ptToPx(state.points[0], ctx.viewport);
    const pp = ptToPx(p, ctx.viewport);
    return Math.hypot(pt.x - pp.x, pt.y - pp.y) < 16;
  },
  render: (state, ctx) => {
    if (!state.points.length) return;
    const pt = ptToPx(state.points[0], ctx.viewport);
    ctx.ctx.font = '24px serif';
    ctx.ctx.fillText(state.text ?? '📍', pt.x - 12, pt.y + 8);
  },
});

// ─── REGISTRY ────────────────────────────────────────────────────────────────

export const DRAWING_TOOLS: Record<string, DrawingToolDefinition> = {
  TrendLine,
  Ray,
  ExtendedLine,
  TrendAngle,
  HorizontalLine,
  VerticalLine,
  CrossLine,
  HorizontalRay,
  InfoLine,
  ParallelChannel,
  RegressionTrend,
  AndrewsPitchfork,
  SchiffPitchfork,
  ModifiedSchiffPitchfork,
  InsidePitchfork,
  DisjointChannel,
  FlatChannel,
  FibonacciRetracement,
  FibonacciExtension,
  FibonacciFan,
  FibonacciArc,
  FibonacciTimeZone,
  FibChannel,
  FibSpiral,
  FibWedge,
  FibCircle,
  Rectangle,
  RotatedRectangle,
  Circle,
  Ellipse,
  Triangle,
  Polyline,
  Curve,
  Arc,
  Arrow,
  ArrowMarker,
  GannBox,
  GannFan,
  GannSquare,
  GannSquareFixed,
  PriceRange,
  DateRange,
  DateAndPriceRange,
  BarsPattern,
  GhostFeed,
  Projection,
  LongPosition,
  ShortPosition,
  Forecast,
  Measure,
  XABCDPattern,
  CypherPattern,
  ABCDPattern,
  ThreeDrives,
  HeadAndShoulders,
  ElliottWaveImpulse,
  ElliottWaveCorrection,
  ElliottWaveCombo,
  CyclicLines,
  TimeCycles,
  SineLine,
  Text,
  Note,
  AnchoredNote,
  Callout,
  PriceLabel,
  Flag,
  Brush,
  Highlighter,
  EmojiSticker,
};

export function getDrawingTool(id: string): DrawingToolDefinition | undefined {
  return DRAWING_TOOLS[id];
}

export function getAllDrawingTools(): DrawingToolDefinition[] {
  return Object.values(DRAWING_TOOLS);
}
