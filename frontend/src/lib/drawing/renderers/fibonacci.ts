/**
 * Fibonacci drawing renderers – retracements, extensions, channels,
 * fans, arcs, spirals, time zones, and wedges.
 */

import {
  type Drawing,
  type Viewport,
  type FibStyle,
  type FibLevel,
  DEFAULT_FIB_STYLE,
  pointToPixel,
  timeToX,
  priceToY,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): FibStyle {
  return { ...DEFAULT_FIB_STYLE, ...(d.style as Partial<FibStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function levelY(p0y: number, p1y: number, level: number): number {
  return p0y + (p1y - p0y) * level;
}

function fibLabel(level: FibLevel, price: number, showPercent: boolean, showPrice: boolean): string {
  const parts: string[] = [];
  if (showPercent) parts.push(`${(level.value * 100).toFixed(1)}%`);
  if (showPrice) parts.push(price.toFixed(2));
  return parts.join('  ');
}

function drawLevelLine(
  ctx: Ctx, level: FibLevel, y: number, left: number, right: number,
  price: number, s: FibStyle,
): void {
  if (!level.visible) return;
  ctx.save();
  ctx.strokeStyle = level.color;
  ctx.lineWidth = level.lineWidth;
  ctx.setLineDash(level.dashPattern);

  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  if (s.showLabels) {
    const label = fibLabel(level, price, s.showPercents, s.showPrices);
    ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
    ctx.fillStyle = level.color;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText(label, right - 4, y - 3);
  }

  ctx.restore();
}

// ── Fib Retracement ───────────────────────────────────────────────────────────

const RETRACE_LEVELS: number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export function renderFibRetracement(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);
  const topPrice = d.points[0].price;
  const bottomPrice = d.points[1].price;

  const levels = s.levels.length > 0 ? s.levels : RETRACE_LEVELS.map((v, i) => ({
    value: v,
    color: DEFAULT_FIB_STYLE.levels[i]?.color ?? s.color,
    lineWidth: 1,
    dashPattern: v === 0.5 ? [5, 5] : [],
    visible: true,
  }));

  // Fill backgrounds between levels
  if (s.fillBackground) {
    for (let i = 0; i < levels.length - 1; i++) {
      if (!levels[i].visible || !levels[i + 1].visible) continue;
      const y1 = levelY(p[0].y, p[1].y, levels[i].value);
      const y2 = levelY(p[0].y, p[1].y, levels[i + 1].value);
      ctx.globalAlpha = s.fillOpacity;
      ctx.fillStyle = levels[i].color;
      ctx.fillRect(left, Math.min(y1, y2), right - left, Math.abs(y2 - y1));
    }
    ctx.globalAlpha = s.opacity;
  }

  // Draw level lines
  for (const level of levels) {
    const y = levelY(p[0].y, p[1].y, level.value);
    const price = topPrice + (bottomPrice - topPrice) * level.value;
    drawLevelLine(ctx, level, y, left, right, price, s);
  }

  // Trend line connecting the two anchor points
  DrawingEngine.setLineStyle(ctx, s.color, 1, [3, 3], s.opacity * 0.5);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Extension ─────────────────────────────────────────────────────────────

const EXTENSION_LEVELS: number[] = [0, 0.236, 0.382, 0.5, 0.618, 1, 1.272, 1.382, 1.618, 2, 2.618, 3.618, 4.236];

export function renderFibExtension(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = 0;
  const right = vp.width;
  const topPrice = d.points[0].price;
  const bottomPrice = d.points[1].price;
  const range = bottomPrice - topPrice;

  const extColors = ['#787B86', '#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722', '#795548', '#607D8B', '#3F51B5'];

  for (let i = 0; i < EXTENSION_LEVELS.length; i++) {
    const lev = EXTENSION_LEVELS[i];
    const price = topPrice + range * lev;
    const y = priceToY(price, vp);
    const color = extColors[i % extColors.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = lev === 1 ? 2 : 1;
    ctx.setLineDash(lev === 0.5 ? [5, 5] : []);

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    if (s.showLabels) {
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'right';
      const label = `${(lev * 100).toFixed(1)}%  ${price.toFixed(2)}`;
      ctx.fillText(label, right - 4, y - 3);
    }
  }

  // Fill between selected zones
  if (s.fillBackground) {
    for (let i = 0; i < EXTENSION_LEVELS.length - 1; i++) {
      const y1 = priceToY(topPrice + range * EXTENSION_LEVELS[i], vp);
      const y2 = priceToY(topPrice + range * EXTENSION_LEVELS[i + 1], vp);
      ctx.globalAlpha = s.fillOpacity * 0.5;
      ctx.fillStyle = extColors[i % extColors.length];
      ctx.fillRect(Math.min(p[0].x, p[1].x), Math.min(y1, y2), Math.abs(p[1].x - p[0].x), Math.abs(y2 - y1));
    }
    ctx.globalAlpha = s.opacity;
  }

  // Anchor line
  DrawingEngine.setLineStyle(ctx, s.color, 1, [3, 3], s.opacity * 0.5);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Channel ───────────────────────────────────────────────────────────────

export function renderFibChannel(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const dx = p[2].x - p[0].x;
  const dy = p[2].y - p[0].y;

  const channelLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#787B86', '#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#787B86'];

  for (let i = 0; i < channelLevels.length; i++) {
    const lev = channelLevels[i];
    const offX = dx * lev;
    const offY = dy * lev;

    ctx.strokeStyle = colors[i];
    ctx.lineWidth = lev === 0 || lev === 1 ? 2 : 1;
    ctx.setLineDash(lev === 0.5 ? [5, 5] : []);

    ctx.beginPath();
    ctx.moveTo(p[0].x + offX, p[0].y + offY);
    ctx.lineTo(p[1].x + offX, p[1].y + offY);
    ctx.stroke();

    if (s.showLabels) {
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = colors[i];
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${(lev * 100).toFixed(1)}%`, p[1].x + offX + 4, p[1].y + offY - 2);
    }
  }

  // Fill background
  if (s.fillBackground) {
    ctx.globalAlpha = s.fillOpacity;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.lineTo(p[1].x + dx, p[1].y + dy);
    ctx.lineTo(p[0].x + dx, p[0].y + dy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = s.opacity;
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Fan ───────────────────────────────────────────────────────────────────

export function renderFibFan(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const fanLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#787B86', '#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#787B86'];

  for (let i = 0; i < fanLevels.length; i++) {
    const lev = fanLevels[i];
    const targetY = p[0].y + (p[1].y - p[0].y) * lev;

    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1;
    ctx.setLineDash(lev === 0.5 ? [5, 5] : []);

    // Extend fan line to right edge
    const dx = p[1].x - p[0].x;
    const dy = targetY - p[0].y;
    const factor = dx !== 0 ? (vp.width - p[0].x) / dx : 1;

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[0].x + dx * factor, p[0].y + dy * factor);
    ctx.stroke();

    if (s.showLabels) {
      const labelX = p[0].x + dx * Math.min(factor, 2);
      const labelY = p[0].y + dy * Math.min(factor, 2);
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = colors[i];
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${(lev * 100).toFixed(1)}%`, labelX + 4, labelY - 2);
    }
  }

  // Fill between adjacent fan lines
  if (s.fillBackground) {
    ctx.globalAlpha = s.fillOpacity;
    for (let i = 0; i < fanLevels.length - 1; i++) {
      const y1 = p[0].y + (p[1].y - p[0].y) * fanLevels[i];
      const y2 = p[0].y + (p[1].y - p[0].y) * fanLevels[i + 1];
      const dx = p[1].x - p[0].x;
      const factor = dx !== 0 ? (vp.width - p[0].x) / dx : 1;

      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[0].x + dx * factor, p[0].y + (y1 - p[0].y) * factor);
      ctx.lineTo(p[0].x + dx * factor, p[0].y + (y2 - p[0].y) * factor);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = s.opacity;
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Arc ───────────────────────────────────────────────────────────────────

export function renderFibArc(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const dist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  const arcLevels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#787B86'];

  for (let i = 0; i < arcLevels.length; i++) {
    const radius = dist * arcLevels[i];

    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1;
    ctx.setLineDash(arcLevels[i] === 0.5 ? [4, 4] : []);

    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (s.showLabels) {
      const angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      const lx = p[0].x + Math.cos(angle) * radius;
      const ly = p[0].y + Math.sin(angle) * radius;
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = colors[i];
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${(arcLevels[i] * 100).toFixed(1)}%`, lx + 4, ly - 2);
    }
  }

  // Anchor line
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Spiral ────────────────────────────────────────────────────────────────

export function renderFibSpiral(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = p[0].x;
  const cy = p[0].y;
  const initRadius = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  const phi = (1 + Math.sqrt(5)) / 2; // golden ratio
  const growthFactor = Math.log(phi) / (Math.PI / 2);

  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  const steps = 800;
  const maxAngle = Math.PI * 6;

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * maxAngle;
    const r = initRadius * 0.05 * Math.exp(growthFactor * theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    if (r > Math.max(vp.width, vp.height)) break;
  }
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Time Zone ─────────────────────────────────────────────────────────────

export function renderFibTimeZone(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const barWidth = Math.abs(p[1].x - p[0].x);
  if (barWidth < 1) return;

  const fibNumbers = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
  const colors = ['#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#E91E63'];
  let accum = 0;

  for (let i = 0; i < fibNumbers.length; i++) {
    accum += fibNumbers[i];
    const x = p[0].x + barWidth * accum;
    if (x > vp.width + 100) break;

    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = s.opacity;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vp.height);
    ctx.stroke();

    if (s.showLabels) {
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = colors[i % colors.length];
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText(`${accum}`, x, 4);
    }
  }

  // Fill between zones
  if (s.fillBackground) {
    let prevX = p[0].x;
    let acc2 = 0;
    for (let i = 0; i < fibNumbers.length; i++) {
      acc2 += fibNumbers[i];
      const x = p[0].x + barWidth * acc2;
      if (x > vp.width + 100) break;

      ctx.globalAlpha = s.fillOpacity;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(prevX, 0, x - prevX, vp.height);
      prevX = x;
    }
    ctx.globalAlpha = s.opacity;
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Fib Wedge ─────────────────────────────────────────────────────────────────

export function renderFibWedge(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const wedgeLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = ['#787B86', '#F44336', '#FF9800', '#4CAF50', '#009688', '#2196F3', '#787B86'];

  for (let i = 0; i < wedgeLevels.length; i++) {
    const lev = wedgeLevels[i];
    const y1 = p[0].y + (p[1].y - p[0].y) * lev;
    const y2 = p[0].y + (p[2].y - p[0].y) * lev;

    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[2].x, y2);
    ctx.stroke();

    if (s.showLabels) {
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = colors[i];
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${(lev * 100).toFixed(1)}%`, p[1].x + 4, y1 - 2);
    }
  }

  // Boundary lines
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const FIB_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  fib_retracement: renderFibRetracement,
  fib_extension: renderFibExtension,
  fib_channel: renderFibChannel,
  fib_fan: renderFibFan,
  fib_arc: renderFibArc,
  fib_spiral: renderFibSpiral,
  fib_time_zone: renderFibTimeZone,
  fib_wedge: renderFibWedge,
  fib_circle: renderFibArc,
  trend_based_fib_extension: renderFibExtension,
  trend_based_fib_time: renderFibTimeZone,
};

export function renderFibDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = FIB_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
