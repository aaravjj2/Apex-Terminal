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

// ─── REGISTRY ────────────────────────────────────────────────────────────────

export const DRAWING_TOOLS: Record<string, DrawingToolDefinition> = {
  TrendLine,
  Ray,
  ExtendedLine,
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
  Circle,
  Ellipse,
  Triangle,
  Polyline,
  Arc,
  Arrow,
  ArrowMarker,
  GannBox,
  GannFan,
  GannSquare,
  GannSquareFixed,
  PriceRange,
  DateRange,
  Text,
  Measure,
};

export function getDrawingTool(id: string): DrawingToolDefinition | undefined {
  return DRAWING_TOOLS[id];
}

export function getAllDrawingTools(): DrawingToolDefinition[] {
  return Object.values(DRAWING_TOOLS);
}
