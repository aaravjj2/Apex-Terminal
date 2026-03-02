/**
 * Shape drawing renderers – rectangles, circles, ellipses, triangles,
 * polylines, curves, arcs, and arrows with fill/stroke/rotation.
 */

import {
  type Drawing,
  type Viewport,
  type ShapeStyle,
  DEFAULT_SHAPE_STYLE,
  pointToPixel,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): ShapeStyle {
  return { ...DEFAULT_SHAPE_STYLE, ...(d.style as Partial<ShapeStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function applyRotation(ctx: Ctx, cx: number, cy: number, angle: number): void {
  if (Math.abs(angle) > 0.001) {
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);
  }
}

function fillAndStroke(ctx: Ctx, s: ShapeStyle): void {
  if (s.fillOpacity > 0) {
    ctx.globalAlpha = s.opacity * s.fillOpacity;
    ctx.fillStyle = s.fillColor;
    ctx.fill();
  }
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.stroke();
}

function drawResizeHandles(ctx: Ctx, points: Px[], d: Drawing): void {
  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, points);
}

// ── Rectangle ─────────────────────────────────────────────────────────────────

export function renderRectangle(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const x = Math.min(p[0].x, p[1].x);
  const y = Math.min(p[0].y, p[1].y);
  const w = Math.abs(p[1].x - p[0].x);
  const h = Math.abs(p[1].y - p[0].y);

  ctx.beginPath();
  if (s.borderRadius > 0) {
    const r = Math.min(s.borderRadius, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
  fillAndStroke(ctx, s);

  // Corner handles
  const corners: Px[] = [
    p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y },
  ];
  drawResizeHandles(ctx, corners, d);
}

// ── Rotated Rectangle ─────────────────────────────────────────────────────────

export function renderRotatedRectangle(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = (p[0].x + p[1].x) / 2;
  const cy = (p[0].y + p[1].y) / 2;
  const w = Math.abs(p[1].x - p[0].x);
  const h = Math.abs(p[1].y - p[0].y);

  ctx.save();
  applyRotation(ctx, cx, cy, s.rotation);

  ctx.beginPath();
  ctx.rect(cx - w / 2, cy - h / 2, w, h);
  ctx.closePath();
  fillAndStroke(ctx, s);

  ctx.restore();

  // Rotated corner points for handles
  const cos = Math.cos(s.rotation);
  const sin = Math.sin(s.rotation);
  const hw = w / 2, hh = h / 2;
  const rotatedCorners: Px[] = [
    { x: cx + (-hw * cos - (-hh) * sin), y: cy + (-hw * sin + (-hh) * cos) },
    { x: cx + (hw * cos - (-hh) * sin), y: cy + (hw * sin + (-hh) * cos) },
    { x: cx + (hw * cos - hh * sin), y: cy + (hw * sin + hh * cos) },
    { x: cx + (-hw * cos - hh * sin), y: cy + (-hw * sin + hh * cos) },
  ];
  drawResizeHandles(ctx, rotatedCorners, d);
}

// ── Circle ────────────────────────────────────────────────────────────────────

export function renderCircle(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const radius = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);

  ctx.beginPath();
  ctx.arc(p[0].x, p[0].y, radius, 0, Math.PI * 2);
  ctx.closePath();
  fillAndStroke(ctx, s);

  // Cardinal handles
  const handles: Px[] = [
    { x: p[0].x, y: p[0].y - radius },
    { x: p[0].x + radius, y: p[0].y },
    { x: p[0].x, y: p[0].y + radius },
    { x: p[0].x - radius, y: p[0].y },
    p[0],
  ];
  drawResizeHandles(ctx, handles, d);
}

// ── Ellipse ───────────────────────────────────────────────────────────────────

export function renderEllipse(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = (p[0].x + p[1].x) / 2;
  const cy = (p[0].y + p[1].y) / 2;
  const rx = Math.abs(p[1].x - p[0].x) / 2;
  const ry = Math.abs(p[1].y - p[0].y) / 2;

  ctx.save();
  applyRotation(ctx, cx, cy, s.rotation);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
  fillAndStroke(ctx, s);

  ctx.restore();

  const corners: Px[] = [
    p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y },
    { x: cx, y: cy },
  ];
  drawResizeHandles(ctx, corners, d);
}

// ── Triangle ──────────────────────────────────────────────────────────────────

export function renderTriangle(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  fillAndStroke(ctx, s);

  drawResizeHandles(ctx, p, d);
}

// ── Polyline ──────────────────────────────────────────────────────────────────

export function renderPolyline(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) {
    ctx.lineTo(p[i].x, p[i].y);
  }
  ctx.stroke();

  drawResizeHandles(ctx, p, d);
}

// ── Curve (Bezier through points) ─────────────────────────────────────────────

export function renderCurve(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);

  if (p.length === 2) {
    ctx.lineTo(p[1].x, p[1].y);
  } else if (p.length === 3) {
    ctx.quadraticCurveTo(p[1].x, p[1].y, p[2].x, p[2].y);
  } else {
    // Catmull-Rom spline through all points
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)];
      const p1 = p[i];
      const p2 = p[Math.min(p.length - 1, i + 1)];
      const p3 = p[Math.min(p.length - 1, i + 2)];

      const tension = 0.5;
      const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.stroke();

  drawResizeHandles(ctx, p, d);
}

// ── Arc ───────────────────────────────────────────────────────────────────────

export function renderArc(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = (p[0].x + p[1].x) / 2;
  const cy = (p[0].y + p[1].y) / 2;
  const rx = Math.abs(p[1].x - p[0].x) / 2;
  const ry = Math.abs(p[1].y - p[0].y) / 2;

  const startAngle = p.length >= 3
    ? Math.atan2(p[2].y - cy, p[2].x - cx)
    : 0;
  const endAngle = p.length >= 3
    ? Math.atan2(p[0].y - cy, p[0].x - cx)
    : Math.PI;

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
  ctx.stroke();

  if (s.fillOpacity > 0) {
    ctx.globalAlpha = s.opacity * s.fillOpacity;
    ctx.fillStyle = s.fillColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }

  drawResizeHandles(ctx, p, d);
}

// ── Arrow ─────────────────────────────────────────────────────────────────────

export function renderArrow(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const dx = p[1].x - p[0].x;
  const dy = p[1].y - p[0].y;
  const angle = Math.atan2(dy, dx);
  const len = Math.hypot(dx, dy);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shaft
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Arrowhead
  const headLen = Math.min(16, len * 0.3);
  const headAngle = Math.PI / 7;

  ctx.fillStyle = s.strokeColor;
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(
    p[1].x - headLen * Math.cos(angle - headAngle),
    p[1].y - headLen * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    p[1].x - headLen * Math.cos(angle + headAngle),
    p[1].y - headLen * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();

  drawResizeHandles(ctx, p, d);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const SHAPE_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  rectangle: renderRectangle,
  rotated_rectangle: renderRotatedRectangle,
  circle: renderCircle,
  ellipse: renderEllipse,
  triangle: renderTriangle,
  polyline: renderPolyline,
  curve: renderCurve,
  arc: renderArc,
  arrow: renderArrow,
  arrow_marker: renderArrow,
};

export function renderShapeDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = SHAPE_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
