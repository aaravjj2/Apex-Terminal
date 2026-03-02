/**
 * Core drawing engine – manages all drawings, hit testing, undo/redo,
 * snapping (magnet mode), serialization, z-ordering, and events.
 */

import {
  type Drawing,
  type DrawingBase,
  type DrawingType,
  type DrawingStyle,
  type DrawingState,
  type DrawingCommand,
  type DrawingEvent,
  type DrawingEventHandler,
  type DrawingEventType,
  type HitTestResult,
  type Point,
  type Viewport,
  timeToX,
  priceToY,
  pointToPixel,
  generateId,
} from './types';

// ── OHLCV bar for magnet snapping ─────────────────────────────────────────────

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Utility geometry ──────────────────────────────────────────────────────────

function distPointToPoint(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distPointToSegment(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distPointToLine(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
}

function distPointToRay(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) return Math.hypot(px - ax, py - ay);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isPointInRect(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

function isPointInEllipse(
  px: number, py: number,
  cx: number, cy: number, rx: number, ry: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

function isPointInTriangle(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
): boolean {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function cloneDrawing(d: Drawing): Drawing {
  return JSON.parse(JSON.stringify(d));
}

// ── Selection handle constants ────────────────────────────────────────────────

const HANDLE_SIZE = 6;
const HIT_TOLERANCE = 8;

// ── DrawingEngine ─────────────────────────────────────────────────────────────

export class DrawingEngine {
  private state: DrawingState;
  private listeners: Map<DrawingEventType, Set<DrawingEventHandler>> = new Map();
  private bars: OHLCVBar[] = [];

  constructor() {
    this.state = {
      drawings: [],
      activeDrawingId: null,
      selectedDrawingIds: new Set(),
      hoveredDrawingId: null,
      activeTool: null,
      magnetMode: false,
      magnetStrength: 10,
      drawingInProgress: null,
      clipboard: null,
      undoStack: [],
      redoStack: [],
    };
  }

  // ── Bar data for magnet ───────────────────────────────────────────────────

  setBars(bars: OHLCVBar[]): void {
    this.bars = bars;
  }

  // ── Event system ──────────────────────────────────────────────────────────

  on(event: DrawingEventType, handler: DrawingEventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => { this.listeners.get(event)?.delete(handler); };
  }

  private emit(event: DrawingEvent): void {
    this.listeners.get(event.type)?.forEach(h => h(event));
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  getState(): Readonly<DrawingState> { return this.state; }

  getDrawings(): readonly Drawing[] { return this.state.drawings; }

  getDrawingById(id: string): Drawing | undefined {
    return this.state.drawings.find(d => d.id === id);
  }

  getSelectedDrawings(): Drawing[] {
    return this.state.drawings.filter(d => this.state.selectedDrawingIds.has(d.id));
  }

  getVisibleDrawings(timeframe: string): Drawing[] {
    return this.state.drawings
      .filter(d => !d.hidden)
      .filter(d =>
        d.timeframeVisibility.includes('all') ||
        d.timeframeVisibility.includes(timeframe),
      )
      .sort((a, b) => a.layer - b.layer);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  addDrawing(drawing: Partial<DrawingBase> & { type: DrawingType; points: Point[] }): Drawing {
    const d: Drawing = {
      id: drawing.id ?? generateId(),
      type: drawing.type,
      points: drawing.points,
      style: drawing.style ?? ({} as DrawingStyle),
      locked: drawing.locked ?? false,
      hidden: drawing.hidden ?? false,
      layer: drawing.layer ?? this.state.drawings.length,
      timeframeVisibility: drawing.timeframeVisibility ?? ['all'],
      selected: false,
      hovered: false,
      creating: drawing.creating ?? false,
      groupId: drawing.groupId,
      metadata: drawing.metadata,
    };
    this.state.drawings.push(d);
    this.pushCommand({ type: 'add', timestamp: Date.now(), drawingId: d.id, after: cloneDrawing(d) });
    this.emit({ type: 'create', drawingId: d.id, drawing: d });
    return d;
  }

  removeDrawing(id: string): boolean {
    const idx = this.state.drawings.findIndex(d => d.id === id);
    if (idx === -1) return false;
    const removed = this.state.drawings.splice(idx, 1)[0];
    this.state.selectedDrawingIds.delete(id);
    if (this.state.activeDrawingId === id) this.state.activeDrawingId = null;
    if (this.state.hoveredDrawingId === id) this.state.hoveredDrawingId = null;
    this.pushCommand({ type: 'remove', timestamp: Date.now(), drawingId: id, before: cloneDrawing(removed) });
    this.emit({ type: 'delete', drawingId: id, drawing: removed });
    return true;
  }

  updateDrawing(id: string, updates: Partial<Drawing>): boolean {
    const d = this.getDrawingById(id);
    if (!d) return false;
    const before = cloneDrawing(d);
    Object.assign(d, updates);
    this.pushCommand({ type: 'modify', timestamp: Date.now(), drawingId: id, before, after: cloneDrawing(d) });
    this.emit({ type: 'modify', drawingId: id, drawing: d, previousState: before });
    return true;
  }

  updateDrawingPoints(id: string, points: Point[]): boolean {
    return this.updateDrawing(id, { points });
  }

  updateDrawingStyle(id: string, style: Partial<DrawingStyle>): boolean {
    const d = this.getDrawingById(id);
    if (!d) return false;
    return this.updateDrawing(id, { style: { ...d.style, ...style } });
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  selectDrawing(id: string, additive = false): void {
    if (!additive) {
      for (const sid of this.state.selectedDrawingIds) {
        const sd = this.getDrawingById(sid);
        if (sd) sd.selected = false;
        this.emit({ type: 'deselect', drawingId: sid });
      }
      this.state.selectedDrawingIds.clear();
    }
    const d = this.getDrawingById(id);
    if (d) {
      d.selected = true;
      this.state.selectedDrawingIds.add(id);
      this.state.activeDrawingId = id;
      this.emit({ type: 'select', drawingId: id, drawing: d });
    }
  }

  deselectAll(): void {
    for (const id of this.state.selectedDrawingIds) {
      const d = this.getDrawingById(id);
      if (d) d.selected = false;
      this.emit({ type: 'deselect', drawingId: id });
    }
    this.state.selectedDrawingIds.clear();
    this.state.activeDrawingId = null;
  }

  setHovered(id: string | null): void {
    if (this.state.hoveredDrawingId && this.state.hoveredDrawingId !== id) {
      const prev = this.getDrawingById(this.state.hoveredDrawingId);
      if (prev) prev.hovered = false;
      this.emit({ type: 'unhover', drawingId: this.state.hoveredDrawingId });
    }
    this.state.hoveredDrawingId = id;
    if (id) {
      const d = this.getDrawingById(id);
      if (d) d.hovered = true;
      this.emit({ type: 'hover', drawingId: id });
    }
  }

  // ── Lock / Hide ───────────────────────────────────────────────────────────

  lockDrawing(id: string): void {
    const d = this.getDrawingById(id);
    if (d) { d.locked = true; this.emit({ type: 'lock', drawingId: id, drawing: d }); }
  }

  unlockDrawing(id: string): void {
    const d = this.getDrawingById(id);
    if (d) { d.locked = false; this.emit({ type: 'unlock', drawingId: id, drawing: d }); }
  }

  hideDrawing(id: string): void {
    const d = this.getDrawingById(id);
    if (d) { d.hidden = true; this.emit({ type: 'hide', drawingId: id, drawing: d }); }
  }

  showDrawing(id: string): void {
    const d = this.getDrawingById(id);
    if (d) { d.hidden = false; this.emit({ type: 'show', drawingId: id, drawing: d }); }
  }

  // ── Z-Ordering ────────────────────────────────────────────────────────────

  bringToFront(id: string): void {
    const maxLayer = Math.max(...this.state.drawings.map(d => d.layer), 0);
    this.updateDrawing(id, { layer: maxLayer + 1 });
    this.emit({ type: 'reorder', drawingId: id });
  }

  sendToBack(id: string): void {
    const minLayer = Math.min(...this.state.drawings.map(d => d.layer), 0);
    this.updateDrawing(id, { layer: minLayer - 1 });
    this.emit({ type: 'reorder', drawingId: id });
  }

  moveUp(id: string): void {
    const d = this.getDrawingById(id);
    if (d) this.updateDrawing(id, { layer: d.layer + 1 });
  }

  moveDown(id: string): void {
    const d = this.getDrawingById(id);
    if (d) this.updateDrawing(id, { layer: d.layer - 1 });
  }

  // ── Hit Testing ───────────────────────────────────────────────────────────

  hitTest(px: number, py: number, vp: Viewport): HitTestResult | null {
    const visible = this.getVisibleDrawings('all').reverse(); // top-first
    for (const d of visible) {
      const result = this.hitTestDrawing(d, px, py, vp);
      if (result && result.hit) return result;
    }
    return null;
  }

  hitTestDrawing(d: Drawing, px: number, py: number, vp: Viewport): HitTestResult | null {
    const pts = d.points.map(p => pointToPixel(p, vp));

    // Check control points first (higher priority)
    for (let i = 0; i < pts.length; i++) {
      if (distPointToPoint(pts[i], { x: px, y: py }) <= HANDLE_SIZE + 2) {
        return { hit: true, drawingId: d.id, pointIndex: i, distance: 0 };
      }
    }

    const dist = this.computeBodyDistance(d, pts, px, py, vp);
    if (dist <= HIT_TOLERANCE) {
      return { hit: true, drawingId: d.id, pointIndex: -1, distance: dist };
    }
    return null;
  }

  private computeBodyDistance(
    d: Drawing, pts: { x: number; y: number }[], px: number, py: number, vp: Viewport,
  ): number {
    switch (d.type) {
      case 'trend_line':
      case 'info_line':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'ray':
      case 'horizontal_ray':
        return pts.length >= 2 ? distPointToRay(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'extended_line':
      case 'trend_angle':
        return pts.length >= 2 ? distPointToLine(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'horizontal_line':
        return pts.length >= 1 ? Math.abs(py - pts[0].y) : Infinity;

      case 'vertical_line':
        return pts.length >= 1 ? Math.abs(px - pts[0].x) : Infinity;

      case 'cross_line':
        return pts.length >= 1 ? Math.min(Math.abs(px - pts[0].x), Math.abs(py - pts[0].y)) : Infinity;

      case 'parallel_channel':
      case 'disjoint_channel':
      case 'flat_channel':
        return this.hitTestChannel(pts, px, py);

      case 'rectangle':
      case 'price_range':
      case 'date_range':
      case 'date_price_range':
        if (pts.length >= 2 && isPointInRect(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
          return 0;
        return pts.length >= 2
          ? Math.min(
              distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[0].y),
              distPointToSegment(px, py, pts[1].x, pts[0].y, pts[1].x, pts[1].y),
              distPointToSegment(px, py, pts[1].x, pts[1].y, pts[0].x, pts[1].y),
              distPointToSegment(px, py, pts[0].x, pts[1].y, pts[0].x, pts[0].y),
            )
          : Infinity;

      case 'ellipse':
      case 'circle':
      case 'fib_arc':
      case 'fib_circle':
        if (pts.length >= 2) {
          const cx = (pts[0].x + pts[1].x) / 2;
          const cy = (pts[0].y + pts[1].y) / 2;
          const rx = Math.abs(pts[1].x - pts[0].x) / 2;
          const ry = Math.abs(pts[1].y - pts[0].y) / 2;
          if (isPointInEllipse(px, py, cx, cy, rx, ry)) return 0;
          const norm = Math.hypot((px - cx) / (rx || 1), (py - cy) / (ry || 1));
          return Math.abs(norm - 1) * Math.min(rx, ry);
        }
        return Infinity;

      case 'triangle':
        if (pts.length >= 3 && isPointInTriangle(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y))
          return 0;
        return pts.length >= 3
          ? Math.min(
              distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y),
              distPointToSegment(px, py, pts[1].x, pts[1].y, pts[2].x, pts[2].y),
              distPointToSegment(px, py, pts[2].x, pts[2].y, pts[0].x, pts[0].y),
            )
          : Infinity;

      case 'fib_retracement':
      case 'fib_extension':
      case 'fib_channel':
      case 'fib_fan':
      case 'fib_wedge':
      case 'fib_time_zone':
      case 'trend_based_fib_extension':
      case 'trend_based_fib_time':
        if (pts.length >= 2 && isPointInRect(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
          return 0;
        return pts.length >= 2
          ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y)
          : Infinity;

      case 'gann_box':
      case 'gann_square':
      case 'gann_square_fixed':
        if (pts.length >= 2 && isPointInRect(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
          return 0;
        return Infinity;

      case 'gann_fan':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'andrews_pitchfork':
      case 'schiff_pitchfork':
      case 'modified_schiff_pitchfork':
      case 'inside_pitchfork':
        return this.hitTestPitchfork(pts, px, py);

      case 'regression_trend':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'xabcd':
      case 'cypher':
      case 'abcd':
      case 'three_drives':
      case 'head_and_shoulders':
        return this.hitTestPolyline(pts, px, py);

      case 'elliott_impulse':
      case 'elliott_correction':
      case 'elliott_combo':
      case 'elliott_triangle':
        return this.hitTestPolyline(pts, px, py);

      case 'polyline':
      case 'curve':
      case 'brush':
      case 'highlighter':
        return this.hitTestPolyline(pts, px, py);

      case 'arc':
      case 'arrow':
      case 'arrow_marker':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'text':
      case 'note':
      case 'anchored_note':
      case 'callout':
      case 'price_label':
      case 'flag':
      case 'balloon':
      case 'sign_post':
        if (pts.length >= 1) {
          const textHitRadius = 30;
          return distPointToPoint(pts[0], { x: px, y: py }) <= textHitRadius ? 0 : Infinity;
        }
        return Infinity;

      case 'long_position':
      case 'short_position':
      case 'risk_reward_long':
      case 'risk_reward_short':
      case 'forecast':
      case 'measure':
      case 'bars_pattern':
      case 'ghost_feed':
      case 'projection':
        if (pts.length >= 2 && isPointInRect(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y))
          return 0;
        return Infinity;

      case 'cyclic_lines':
      case 'time_cycles':
      case 'sine_line':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'fib_spiral':
        return pts.length >= 2 ? distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) : Infinity;

      case 'rotated_rectangle':
        return pts.length >= 2 ? (isPointInRect(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y) ? 0 : Infinity) : Infinity;

      default:
        return Infinity;
    }
  }

  private hitTestChannel(pts: { x: number; y: number }[], px: number, py: number): number {
    if (pts.length < 3) return Infinity;
    const d1 = distPointToSegment(px, py, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    const dx = pts[2].x - pts[0].x;
    const dy = pts[2].y - pts[0].y;
    const d2 = distPointToSegment(px, py, pts[0].x + dx, pts[0].y + dy, pts[1].x + dx, pts[1].y + dy);
    return Math.min(d1, d2);
  }

  private hitTestPitchfork(pts: { x: number; y: number }[], px: number, py: number): number {
    if (pts.length < 3) return Infinity;
    const midX = (pts[1].x + pts[2].x) / 2;
    const midY = (pts[1].y + pts[2].y) / 2;
    return Math.min(
      distPointToSegment(px, py, pts[0].x, pts[0].y, midX, midY),
      distPointToSegment(px, py, pts[1].x, pts[1].y, pts[2].x, pts[2].y),
    );
  }

  private hitTestPolyline(pts: { x: number; y: number }[], px: number, py: number): number {
    let minDist = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      minDist = Math.min(minDist, distPointToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
    }
    return minDist;
  }

  // ── Magnet / Snapping ─────────────────────────────────────────────────────

  setMagnetMode(enabled: boolean): void {
    this.state.magnetMode = enabled;
  }

  setMagnetStrength(pixels: number): void {
    this.state.magnetStrength = pixels;
  }

  snapPoint(point: Point, vp: Viewport): Point {
    if (!this.state.magnetMode || this.bars.length === 0) return point;

    let bestDist = this.state.magnetStrength;
    let snapped = point;

    for (const bar of this.bars) {
      const barX = timeToX(bar.time, vp);
      const dxPixels = Math.abs(timeToX(point.time, vp) - barX);
      if (dxPixels > this.state.magnetStrength * 3) continue;

      const candidates: { price: number; label: string }[] = [
        { price: bar.open, label: 'open' },
        { price: bar.high, label: 'high' },
        { price: bar.low, label: 'low' },
        { price: bar.close, label: 'close' },
      ];

      for (const c of candidates) {
        const cy = priceToY(c.price, vp);
        const cx = barX;
        const dist = Math.hypot(timeToX(point.time, vp) - cx, priceToY(point.price, vp) - cy);
        if (dist < bestDist) {
          bestDist = dist;
          snapped = {
            x: cx,
            y: cy,
            time: bar.time,
            price: c.price,
          };
        }
      }
    }

    return snapped;
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  private pushCommand(cmd: DrawingCommand): void {
    this.state.undoStack.push(cmd);
    if (this.state.undoStack.length > 200) this.state.undoStack.shift();
    this.state.redoStack = [];
  }

  undo(): boolean {
    const cmd = this.state.undoStack.pop();
    if (!cmd) return false;

    this.applyCommandReverse(cmd);
    this.state.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.state.redoStack.pop();
    if (!cmd) return false;

    this.applyCommandForward(cmd);
    this.state.undoStack.push(cmd);
    return true;
  }

  private applyCommandReverse(cmd: DrawingCommand): void {
    switch (cmd.type) {
      case 'add': {
        const idx = this.state.drawings.findIndex(d => d.id === cmd.drawingId);
        if (idx !== -1) this.state.drawings.splice(idx, 1);
        break;
      }
      case 'remove': {
        if (cmd.before) this.state.drawings.push(cmd.before as Drawing);
        break;
      }
      case 'modify': {
        const d = this.getDrawingById(cmd.drawingId);
        if (d && cmd.before) Object.assign(d, cmd.before);
        break;
      }
      case 'batch': {
        if (cmd.children) {
          for (let i = cmd.children.length - 1; i >= 0; i--) {
            this.applyCommandReverse(cmd.children[i]);
          }
        }
        break;
      }
    }
  }

  private applyCommandForward(cmd: DrawingCommand): void {
    switch (cmd.type) {
      case 'add': {
        if (cmd.after) this.state.drawings.push(cmd.after as Drawing);
        break;
      }
      case 'remove': {
        const idx = this.state.drawings.findIndex(d => d.id === cmd.drawingId);
        if (idx !== -1) this.state.drawings.splice(idx, 1);
        break;
      }
      case 'modify': {
        const d = this.getDrawingById(cmd.drawingId);
        if (d && cmd.after) Object.assign(d, cmd.after);
        break;
      }
      case 'batch': {
        if (cmd.children) {
          for (const child of cmd.children) {
            this.applyCommandForward(child);
          }
        }
        break;
      }
    }
  }

  canUndo(): boolean { return this.state.undoStack.length > 0; }
  canRedo(): boolean { return this.state.redoStack.length > 0; }

  // ── Active Tool Management ────────────────────────────────────────────────

  setActiveTool(tool: DrawingType | null): void {
    this.state.activeTool = tool;
  }

  getActiveTool(): DrawingType | null {
    return this.state.activeTool;
  }

  // ── Drawing in progress ───────────────────────────────────────────────────

  startDrawing(type: DrawingType, firstPoint: Point): Drawing {
    const d: Drawing = {
      id: generateId(),
      type,
      points: [firstPoint],
      style: {} as DrawingStyle,
      locked: false,
      hidden: false,
      layer: this.state.drawings.length,
      timeframeVisibility: ['all'],
      selected: false,
      hovered: false,
      creating: true,
    };
    this.state.drawingInProgress = d;
    return d;
  }

  addPointToDrawing(point: Point): void {
    if (this.state.drawingInProgress) {
      this.state.drawingInProgress.points.push(point);
    }
  }

  updateLastPoint(point: Point): void {
    if (this.state.drawingInProgress && this.state.drawingInProgress.points.length > 0) {
      this.state.drawingInProgress.points[this.state.drawingInProgress.points.length - 1] = point;
    }
  }

  finishDrawing(): Drawing | null {
    const d = this.state.drawingInProgress;
    if (!d) return null;
    d.creating = false;
    this.state.drawingInProgress = null;
    this.addDrawing(d);
    return d;
  }

  cancelDrawing(): void {
    this.state.drawingInProgress = null;
  }

  getDrawingInProgress(): Drawing | null {
    return this.state.drawingInProgress;
  }

  // ── Clipboard ─────────────────────────────────────────────────────────────

  copyDrawing(id: string): void {
    const d = this.getDrawingById(id);
    if (d) this.state.clipboard = cloneDrawing(d);
  }

  pasteDrawing(offset: Point): Drawing | null {
    if (!this.state.clipboard) return null;
    const d = cloneDrawing(this.state.clipboard);
    d.id = generateId();
    d.points = d.points.map(p => ({
      x: p.x + offset.x,
      y: p.y + offset.y,
      time: p.time + offset.time,
      price: p.price + offset.price,
    }));
    return this.addDrawing(d);
  }

  duplicateDrawing(id: string): Drawing | null {
    const d = this.getDrawingById(id);
    if (!d) return null;
    const dup = cloneDrawing(d);
    dup.id = generateId();
    dup.points = dup.points.map(p => ({ ...p, price: p.price * 1.002 }));
    return this.addDrawing(dup);
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  serialize(): string {
    return JSON.stringify({
      version: 1,
      drawings: this.state.drawings.map(d => ({
        ...d,
        selected: false,
        hovered: false,
        creating: false,
      })),
    });
  }

  deserialize(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.version === 1 && Array.isArray(data.drawings)) {
        this.state.drawings = data.drawings.map((d: Drawing) => ({
          ...d,
          selected: false,
          hovered: false,
          creating: false,
        }));
        this.state.undoStack = [];
        this.state.redoStack = [];
        this.state.selectedDrawingIds = new Set();
        this.state.activeDrawingId = null;
        this.state.hoveredDrawingId = null;
      }
    } catch {
      console.error('Failed to deserialize drawings');
    }
  }

  // ── Bulk operations ───────────────────────────────────────────────────────

  removeAll(): void {
    const children: DrawingCommand[] = this.state.drawings.map(d => ({
      type: 'remove' as const,
      timestamp: Date.now(),
      drawingId: d.id,
      before: cloneDrawing(d),
    }));
    this.pushCommand({ type: 'batch', timestamp: Date.now(), drawingId: '', children });
    this.state.drawings = [];
    this.state.selectedDrawingIds.clear();
    this.state.activeDrawingId = null;
    this.state.hoveredDrawingId = null;
  }

  removeSelected(): void {
    const ids = [...this.state.selectedDrawingIds];
    const children: DrawingCommand[] = [];
    for (const id of ids) {
      const d = this.getDrawingById(id);
      if (d) children.push({ type: 'remove', timestamp: Date.now(), drawingId: id, before: cloneDrawing(d) });
    }
    this.pushCommand({ type: 'batch', timestamp: Date.now(), drawingId: '', children });
    this.state.drawings = this.state.drawings.filter(d => !this.state.selectedDrawingIds.has(d.id));
    this.state.selectedDrawingIds.clear();
    this.state.activeDrawingId = null;
  }

  lockSelected(): void {
    for (const id of this.state.selectedDrawingIds) this.lockDrawing(id);
  }

  unlockSelected(): void {
    for (const id of this.state.selectedDrawingIds) this.unlockDrawing(id);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  static drawSelectionHandle(ctx: CanvasRenderingContext2D, x: number, y: number, active = false): void {
    const size = HANDLE_SIZE;
    ctx.save();
    ctx.fillStyle = active ? '#2962FF' : '#FFFFFF';
    ctx.strokeStyle = '#2962FF';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  static drawSelectionHandles(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
    for (const p of points) {
      DrawingEngine.drawSelectionHandle(ctx, p.x, p.y);
    }
  }

  static setLineStyle(ctx: CanvasRenderingContext2D, color: string, lineWidth: number, dashPattern: number[], opacity: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashPattern);
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  static resetCtx(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  static applyHoverEffect(ctx: CanvasRenderingContext2D, drawing: Drawing): void {
    if (drawing.hovered && !drawing.selected) {
      ctx.shadowColor = 'rgba(41, 98, 255, 0.5)';
      ctx.shadowBlur = 6;
    }
    if (drawing.selected) {
      ctx.shadowColor = 'rgba(41, 98, 255, 0.8)';
      ctx.shadowBlur = 8;
    }
  }
}
