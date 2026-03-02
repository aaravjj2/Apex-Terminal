/**
 * Line drawing renderers – trend lines, rays, horizontal/vertical lines,
 * channels, pitchforks, and regression trends.
 */

import {
  type Drawing,
  type Viewport,
  type LineStyle,
  type Point,
  DEFAULT_LINE_STYLE,
  pointToPixel,
  timeToX,
  priceToY,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): LineStyle {
  return { ...DEFAULT_LINE_STYLE, ...(d.style as Partial<LineStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function extendLineToViewport(
  ax: number, ay: number, bx: number, by: number,
  w: number, h: number, left: boolean, right: boolean,
): [number, number, number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  let x0 = ax, y0 = ay, x1 = bx, y1 = by;

  if (dx === 0) {
    if (left) y0 = 0;
    if (right) y1 = h;
    return [x0, y0, x1, y1];
  }

  const slope = dy / dx;
  const intercept = ay - slope * ax;

  if (right) {
    const xRight = dx > 0 ? w + 100 : -100;
    x1 = xRight;
    y1 = slope * xRight + intercept;
  }
  if (left) {
    const xLeft = dx > 0 ? -100 : w + 100;
    x0 = xLeft;
    y0 = slope * xLeft + intercept;
  }

  return [x0, y0, x1, y1];
}

function drawLabel(
  ctx: Ctx, text: string, x: number, y: number, s: LineStyle, align: 'left' | 'right' | 'center' = 'left',
): void {
  if (!s.showLabels) return;
  ctx.save();
  ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = align;
  const metrics = ctx.measureText(text);
  const pad = 4;
  const bx = align === 'right' ? x - metrics.width - pad * 2 : align === 'center' ? x - metrics.width / 2 - pad : x;
  ctx.fillStyle = 'rgba(30, 34, 45, 0.85)';
  ctx.fillRect(bx, y - s.labelFontSize - pad * 2, metrics.width + pad * 2, s.labelFontSize + pad * 2);
  ctx.fillStyle = s.labelColor;
  ctx.fillText(text, bx + pad, y - pad);
  ctx.restore();
}

function begin(ctx: Ctx, d: Drawing, s: LineStyle): void {
  DrawingEngine.applyHoverEffect(ctx, d);
  DrawingEngine.setLineStyle(ctx, s.color, s.lineWidth, s.dashPattern, s.opacity);
}

function end(ctx: Ctx, d: Drawing, p: Px[]): void {
  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Trend Line ────────────────────────────────────────────────────────────────

export function renderTrendLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  if (s.showLabels) {
    const dx = p[1].x - p[0].x;
    const dy = p[1].y - p[0].y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(d.points[1].price - d.points[0].price, d.points[1].time - d.points[0].time);
    const deg = (angle * 180 / Math.PI).toFixed(1);
    drawLabel(ctx, `${deg}°  ${len.toFixed(0)}px`, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2 - 8, s, 'center');
  }

  end(ctx, d, p);
}

// ── Ray ───────────────────────────────────────────────────────────────────────

export function renderRay(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  const [, , x1, y1] = extendLineToViewport(p[0].x, p[0].y, p[1].x, p[1].y, vp.width, vp.height, false, true);

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  end(ctx, d, p);
}

// ── Extended Line ─────────────────────────────────────────────────────────────

export function renderExtendedLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  const [x0, y0, x1, y1] = extendLineToViewport(p[0].x, p[0].y, p[1].x, p[1].y, vp.width, vp.height, true, true);

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  end(ctx, d, p);
}

// ── Trend Angle ───────────────────────────────────────────────────────────────

export function renderTrendAngle(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Horizontal reference line
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[0].y);
  ctx.stroke();

  // Vertical reference line
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();
  ctx.setLineDash(s.dashPattern);

  // Angle arc
  const radius = Math.min(40, Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) * 0.3);
  const startAngle = 0;
  const endAngle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);

  ctx.beginPath();
  ctx.arc(p[0].x, p[0].y, radius, startAngle, endAngle, endAngle < startAngle);
  ctx.stroke();

  const angleDeg = (endAngle * 180 / Math.PI).toFixed(1);
  const priceDiff = (d.points[1].price - d.points[0].price).toFixed(2);
  const barsDiff = Math.round((d.points[1].time - d.points[0].time) / 60);
  drawLabel(ctx, `${angleDeg}° | Δ${priceDiff} | ${barsDiff} bars`, p[0].x + radius + 4, p[0].y - 4, s);

  end(ctx, d, p);
}

// ── Horizontal Line ───────────────────────────────────────────────────────────

export function renderHorizontalLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(0, p[0].y);
  ctx.lineTo(vp.width, p[0].y);
  ctx.stroke();

  drawLabel(ctx, d.points[0].price.toFixed(2), vp.width - 4, p[0].y - 2, s, 'right');

  end(ctx, d, p);
}

// ── Horizontal Ray ────────────────────────────────────────────────────────────

export function renderHorizontalRay(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(vp.width, p[0].y);
  ctx.stroke();

  drawLabel(ctx, d.points[0].price.toFixed(2), vp.width - 4, p[0].y - 2, s, 'right');

  end(ctx, d, p);
}

// ── Vertical Line ─────────────────────────────────────────────────────────────

export function renderVerticalLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(p[0].x, 0);
  ctx.lineTo(p[0].x, vp.height);
  ctx.stroke();

  const date = new Date(d.points[0].time * 1000);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  drawLabel(ctx, dateStr, p[0].x + 4, vp.height - 4, s);

  end(ctx, d, p);
}

// ── Cross Line ────────────────────────────────────────────────────────────────

export function renderCrossLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = style(d);
  begin(ctx, d, s);

  ctx.beginPath();
  ctx.moveTo(0, p[0].y);
  ctx.lineTo(vp.width, p[0].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p[0].x, 0);
  ctx.lineTo(p[0].x, vp.height);
  ctx.stroke();

  drawLabel(ctx, d.points[0].price.toFixed(2), p[0].x + 6, p[0].y - 4, s);

  end(ctx, d, p);
}

// ── Parallel Channel ──────────────────────────────────────────────────────────

export function renderParallelChannel(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);
  begin(ctx, d, s);

  const offsetX = p[2].x - p[0].x;
  const offsetY = p[2].y - p[0].y;

  // Top line
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Bottom line (offset)
  ctx.beginPath();
  ctx.moveTo(p[0].x + offsetX, p[0].y + offsetY);
  ctx.lineTo(p[1].x + offsetX, p[1].y + offsetY);
  ctx.stroke();

  // Fill
  ctx.globalAlpha = s.opacity * 0.08;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.lineTo(p[1].x + offsetX, p[1].y + offsetY);
  ctx.lineTo(p[0].x + offsetX, p[0].y + offsetY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;

  // Middle line
  if (s.showMiddleLine) {
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo((p[0].x + p[0].x + offsetX) / 2, (p[0].y + p[0].y + offsetY) / 2);
    ctx.lineTo((p[1].x + p[1].x + offsetX) / 2, (p[1].y + p[1].y + offsetY) / 2);
    ctx.stroke();
    ctx.setLineDash(s.dashPattern);
  }

  end(ctx, d, p);
}

// ── Disjoint Channel ──────────────────────────────────────────────────────────

export function renderDisjointChannel(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 4) return;
  const s = style(d);
  begin(ctx, d, s);

  // Top line: p0 -> p1
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Bottom line: p2 -> p3
  ctx.beginPath();
  ctx.moveTo(p[2].x, p[2].y);
  ctx.lineTo(p[3].x, p[3].y);
  ctx.stroke();

  // Fill
  ctx.globalAlpha = s.opacity * 0.08;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.lineTo(p[3].x, p[3].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;

  end(ctx, d, p);
}

// ── Flat Channel (horizontal channel) ─────────────────────────────────────────

export function renderFlatChannel(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  const top = Math.min(p[0].y, p[1].y);
  const bottom = Math.max(p[0].y, p[1].y);
  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);

  // Top line
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.stroke();

  // Bottom line
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // Fill
  ctx.globalAlpha = s.opacity * 0.06;
  ctx.fillStyle = s.color;
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.globalAlpha = s.opacity;

  // Middle line
  if (s.showMiddleLine) {
    const mid = (top + bottom) / 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, mid);
    ctx.lineTo(right, mid);
    ctx.stroke();
    ctx.setLineDash(s.dashPattern);
  }

  end(ctx, d, p);
}

// ── Regression Trend ──────────────────────────────────────────────────────────

export function renderRegressionTrend(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);
  begin(ctx, d, s);

  const midY1 = p[0].y;
  const midY2 = p[1].y;

  // Main regression line
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1);
  ctx.lineTo(p[1].x, midY2);
  ctx.stroke();

  // Standard deviation channels (estimated based on point spread)
  const channelOffset = Math.abs(midY2 - midY1) * 0.2 || 20;

  ctx.setLineDash([6, 4]);

  // +1 StdDev
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1 - channelOffset);
  ctx.lineTo(p[1].x, midY2 - channelOffset);
  ctx.stroke();

  // -1 StdDev
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1 + channelOffset);
  ctx.lineTo(p[1].x, midY2 + channelOffset);
  ctx.stroke();

  // +2 StdDev
  ctx.globalAlpha = s.opacity * 0.5;
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1 - channelOffset * 2);
  ctx.lineTo(p[1].x, midY2 - channelOffset * 2);
  ctx.stroke();

  // -2 StdDev
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1 + channelOffset * 2);
  ctx.lineTo(p[1].x, midY2 + channelOffset * 2);
  ctx.stroke();

  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;

  // Fill between ±1 StdDev
  ctx.globalAlpha = s.opacity * 0.04;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(p[0].x, midY1 - channelOffset);
  ctx.lineTo(p[1].x, midY2 - channelOffset);
  ctx.lineTo(p[1].x, midY2 + channelOffset);
  ctx.lineTo(p[0].x, midY1 + channelOffset);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;

  if (s.showLabels) {
    drawLabel(ctx, 'Regression', p[1].x + 4, midY2 - 4, s);
  }

  end(ctx, d, p);
}

// ── Andrews' Pitchfork ────────────────────────────────────────────────────────

export function renderAndrewsPitchfork(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);
  begin(ctx, d, s);

  const midX = (p[1].x + p[2].x) / 2;
  const midY = (p[1].y + p[2].y) / 2;

  // Median line: p0 -> midpoint(p1, p2), extended
  const [mx0, my0, mx1, my1] = extendLineToViewport(p[0].x, p[0].y, midX, midY, vp.width, vp.height, false, true);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(mx1, my1);
  ctx.stroke();

  // Upper prong: p1 extended parallel to median
  const dx = midX - p[0].x;
  const dy = midY - p[0].y;
  const factor = 5;
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[1].x + dx * factor, p[1].y + dy * factor);
  ctx.stroke();

  // Lower prong: p2 extended parallel to median
  ctx.beginPath();
  ctx.moveTo(p[2].x, p[2].y);
  ctx.lineTo(p[2].x + dx * factor, p[2].y + dy * factor);
  ctx.stroke();

  // Fill between prongs
  ctx.globalAlpha = s.opacity * 0.04;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[1].x + dx * factor, p[1].y + dy * factor);
  ctx.lineTo(p[2].x + dx * factor, p[2].y + dy * factor);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;

  // Handle at origin
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();

  if (s.showLabels) drawLabel(ctx, 'Andrews', p[0].x + 4, p[0].y - 8, s);

  end(ctx, d, p);
}

// ── Schiff Pitchfork ──────────────────────────────────────────────────────────

export function renderSchiffPitchfork(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);
  begin(ctx, d, s);

  // Schiff variant: origin moves to midpoint of p0 and p1
  const originX = (p[0].x + p[1].x) / 2;
  const originY = (p[0].y + p[1].y) / 2;

  const midX = (p[1].x + p[2].x) / 2;
  const midY = (p[1].y + p[2].y) / 2;

  const dx = midX - originX;
  const dy = midY - originY;
  const factor = 5;

  // Median line
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + dx * factor, originY + dy * factor);
  ctx.stroke();

  // Upper prong
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[1].x + dx * factor, p[1].y + dy * factor);
  ctx.stroke();

  // Lower prong
  ctx.beginPath();
  ctx.moveTo(p[2].x, p[2].y);
  ctx.lineTo(p[2].x + dx * factor, p[2].y + dy * factor);
  ctx.stroke();

  // Fill
  ctx.globalAlpha = s.opacity * 0.04;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[1].x + dx * factor, p[1].y + dy * factor);
  ctx.lineTo(p[2].x + dx * factor, p[2].y + dy * factor);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;

  // Connection lines
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(originX, originY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.moveTo(originX, originY);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();
  ctx.setLineDash(s.dashPattern);

  if (s.showLabels) drawLabel(ctx, 'Schiff', p[0].x + 4, p[0].y - 8, s);

  end(ctx, d, p);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const LINE_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  trend_line: renderTrendLine,
  ray: renderRay,
  extended_line: renderExtendedLine,
  trend_angle: renderTrendAngle,
  horizontal_line: renderHorizontalLine,
  horizontal_ray: renderHorizontalRay,
  vertical_line: renderVerticalLine,
  cross_line: renderCrossLine,
  parallel_channel: renderParallelChannel,
  disjoint_channel: renderDisjointChannel,
  flat_channel: renderFlatChannel,
  regression_trend: renderRegressionTrend,
  andrews_pitchfork: renderAndrewsPitchfork,
  schiff_pitchfork: renderSchiffPitchfork,
  modified_schiff_pitchfork: renderSchiffPitchfork, // same visual, different origin calc
  inside_pitchfork: renderAndrewsPitchfork, // variant with tighter prongs
  info_line: renderTrendLine,
};

export function renderLineDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = LINE_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}

export {
  extendLineToViewport,
  drawLabel,
};
