/**
 * Measurement drawing renderers – price range, date range, date-price range,
 * bars pattern, ghost feed, projection, long/short position, forecast, measure.
 * Includes P&L calculation display and risk/reward ratios.
 */

import {
  type Drawing,
  type Viewport,
  type MeasurementStyle,
  DEFAULT_MEASUREMENT_STYLE,
  pointToPixel,
  priceToY,
  timeToX,
  yToPrice,
  xToTime,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): MeasurementStyle {
  return { ...DEFAULT_MEASUREMENT_STYLE, ...(d.style as Partial<MeasurementStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function formatDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${(abs / 3600).toFixed(1)}h`;
  return `${(abs / 86400).toFixed(1)}d`;
}

function formatPercent(change: number, base: number): string {
  if (base === 0) return '0.00%';
  return `${((change / base) * 100).toFixed(2)}%`;
}

function drawInfoBox(
  ctx: Ctx, x: number, y: number, lines: string[], s: MeasurementStyle, color?: string,
): void {
  const fontSize = s.fontSize;
  ctx.font = `${fontSize}px Trebuchet MS, sans-serif`;

  let maxWidth = 0;
  for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);

  const pad = 6;
  const lineHeight = fontSize * 1.4;
  const boxW = maxWidth + pad * 2;
  const boxH = lines.length * lineHeight + pad * 2;

  ctx.globalAlpha = s.backgroundOpacity;
  ctx.fillStyle = s.backgroundColor;
  ctx.fillRect(x, y, boxW, boxH);

  ctx.strokeStyle = color || s.color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.fillStyle = color || s.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + pad, y + pad + i * lineHeight);
  }
}

// ── Price Range ───────────────────────────────────────────────────────────────

export function renderPriceRange(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const top = Math.min(p[0].y, p[1].y);
  const bottom = Math.max(p[0].y, p[1].y);
  const x = p[0].x;

  const price1 = d.points[0].price;
  const price2 = d.points[1].price;
  const change = price2 - price1;
  const isPositive = change >= 0;
  const color = isPositive ? s.profitColor : s.lossColor;

  // Shaded region
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fillRect(x - 30, top, 60, bottom - top);

  // Horizontal lines at top and bottom
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(x - 40, p[0].y);
  ctx.lineTo(x + 40, p[0].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 40, p[1].y);
  ctx.lineTo(x + 40, p[1].y);
  ctx.stroke();

  // Vertical connecting line with arrow
  ctx.beginPath();
  ctx.moveTo(x, p[0].y);
  ctx.lineTo(x, p[1].y);
  ctx.stroke();

  // Arrow head
  const arrowDir = p[1].y > p[0].y ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x, p[1].y);
  ctx.lineTo(x - 4, p[1].y - 8 * arrowDir);
  ctx.lineTo(x + 4, p[1].y - 8 * arrowDir);
  ctx.closePath();
  ctx.fill();

  // Info box
  const infoLines: string[] = [];
  if (s.showAbsoluteChange) infoLines.push(`${change >= 0 ? '+' : ''}${change.toFixed(2)}`);
  if (s.showPercentage) infoLines.push(formatPercent(change, price1));

  const boxX = x + 10;
  const boxY = (p[0].y + p[1].y) / 2 - (infoLines.length * s.fontSize * 1.4) / 2;

  ctx.fillStyle = color;
  drawInfoBox(ctx, boxX, boxY, infoLines, s, color);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Date Range ────────────────────────────────────────────────────────────────

export function renderDateRange(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);
  const y = p[0].y;

  // Shaded region
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = s.color;
  ctx.fillRect(left, 0, right - left, vp.height);

  // Vertical lines
  ctx.globalAlpha = 1;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  ctx.beginPath();
  ctx.moveTo(p[0].x, 0);
  ctx.lineTo(p[0].x, vp.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p[1].x, 0);
  ctx.lineTo(p[1].x, vp.height);
  ctx.stroke();

  // Horizontal connecting line
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  // Arrow heads
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(right, y);
  ctx.lineTo(right - 8, y - 4);
  ctx.lineTo(right - 8, y + 4);
  ctx.closePath();
  ctx.fill();

  // Info
  const duration = Math.abs(d.points[1].time - d.points[0].time);
  const bars = Math.round(duration / 60);
  const infoLines: string[] = [];
  if (s.showTime) infoLines.push(formatDuration(duration));
  if (s.showBars) infoLines.push(`${bars} bars`);

  drawInfoBox(ctx, (left + right) / 2 - 30, y - s.fontSize * 1.4 * infoLines.length - 16, infoLines, s);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Date & Price Range ────────────────────────────────────────────────────────

export function renderDatePriceRange(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);
  const top = Math.min(p[0].y, p[1].y);
  const bottom = Math.max(p[0].y, p[1].y);

  const priceDiff = d.points[1].price - d.points[0].price;
  const isPositive = priceDiff >= 0;
  const color = isPositive ? s.profitColor : s.lossColor;

  // Shaded rect
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = color;
  ctx.fillRect(left, top, right - left, bottom - top);

  // Border
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(left, top, right - left, bottom - top);

  // Diagonal line
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Info
  const duration = Math.abs(d.points[1].time - d.points[0].time);
  const bars = Math.round(duration / 60);
  const infoLines: string[] = [];
  if (s.showAbsoluteChange) infoLines.push(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)}`);
  if (s.showPercentage) infoLines.push(formatPercent(priceDiff, d.points[0].price));
  if (s.showTime) infoLines.push(formatDuration(duration));
  if (s.showBars) infoLines.push(`${bars} bars`);

  drawInfoBox(ctx, (left + right) / 2 - 30, top - s.fontSize * 1.4 * infoLines.length - 14, infoLines, s, color);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Bars Pattern ──────────────────────────────────────────────────────────────

export function renderBarsPattern(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);
  const top = Math.min(p[0].y, p[1].y);
  const bottom = Math.max(p[0].y, p[1].y);

  // Selection region
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(left, top, right - left, bottom - top);

  // Fill
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = s.color;
  ctx.fillRect(left, top, right - left, bottom - top);

  // Ghost bars (projected forward)
  const width = right - left;
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = s.color;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(right, top, width, bottom - top);

  ctx.globalAlpha = 0.02;
  ctx.fillStyle = s.color;
  ctx.fillRect(right, top, width, bottom - top);

  // Label
  ctx.globalAlpha = 1;
  ctx.font = `${s.fontSize}px Trebuchet MS, sans-serif`;
  ctx.fillStyle = s.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Bars Pattern', (left + right) / 2, top - s.fontSize - 4);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Ghost Feed ────────────────────────────────────────────────────────────────

export function renderGhostFeed(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const left = Math.min(p[0].x, p[1].x);
  const right = Math.max(p[0].x, p[1].x);
  const top = Math.min(p[0].y, p[1].y);
  const bottom = Math.max(p[0].y, p[1].y);
  const width = right - left;
  const height = bottom - top;

  // Source region
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(left, top, width, height);

  // Ghost projection (forward)
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#9C27B0';
  ctx.setLineDash([2, 3]);
  ctx.strokeRect(right, top, width, height);

  // Connecting arrow
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(right, (top + bottom) / 2);
  ctx.lineTo(right + 20, (top + bottom) / 2);
  ctx.stroke();

  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(right + 20, (top + bottom) / 2);
  ctx.lineTo(right + 14, (top + bottom) / 2 - 4);
  ctx.lineTo(right + 14, (top + bottom) / 2 + 4);
  ctx.closePath();
  ctx.fill();

  // Label
  ctx.globalAlpha = 0.7;
  ctx.font = `${s.fontSize}px Trebuchet MS, sans-serif`;
  ctx.fillStyle = '#9C27B0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Ghost', right + width / 2, top - 4);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Projection ────────────────────────────────────────────────────────────────

export function renderProjection(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 3) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Source move: p0 -> p1
  const moveHeight = p[1].y - p[0].y;

  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Projected move from p2
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p[2].x, p[2].y);
  ctx.lineTo(p[2].x, p[2].y + moveHeight);
  ctx.stroke();

  // Horizontal connector
  ctx.setLineDash([2, 3]);
  ctx.globalAlpha = s.opacity * 0.5;
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[2].x, p[2].y + moveHeight);
  ctx.stroke();

  // Target level
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity;
  const targetY = p[2].y + moveHeight;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(p[2].x, targetY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Label
  const projectedPrice = d.points[2].price + (d.points[1].price - d.points[0].price);
  drawInfoBox(ctx, p[2].x + 8, targetY - 10, [`Target: ${projectedPrice.toFixed(2)}`], s);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Long Position ─────────────────────────────────────────────────────────────

export function renderLongPosition(ctx: Ctx, d: Drawing, vp: Viewport): void {
  renderPositionBox(ctx, d, vp, true);
}

// ── Short Position ────────────────────────────────────────────────────────────

export function renderShortPosition(ctx: Ctx, d: Drawing, vp: Viewport): void {
  renderPositionBox(ctx, d, vp, false);
}

function renderPositionBox(ctx: Ctx, d: Drawing, vp: Viewport, isLong: boolean): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const entry = d.points[0].price;
  const exit = d.points[1].price;
  const stop = d.metadata?.stop as number | undefined;

  const entryY = p[0].y;
  const exitY = p[1].y;
  const stopY = stop != null ? priceToY(stop, vp) : (isLong ? entryY + 40 : entryY - 40);
  const left = p[0].x;
  const right = p[1].x;

  // Profit zone
  const profitTop = isLong ? Math.min(entryY, exitY) : Math.min(exitY, entryY);
  const profitBottom = isLong ? Math.max(entryY, exitY) : Math.max(exitY, entryY);
  const isProfit = isLong ? exit > entry : exit < entry;
  const profitColor = isProfit ? s.profitColor : s.lossColor;

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = profitColor;
  ctx.fillRect(left, profitTop, right - left, profitBottom - profitTop);

  // Stop zone
  const stopColor = s.lossColor;
  const stopTop = isLong ? Math.min(entryY, stopY) : Math.min(stopY, entryY);
  const stopBottom = isLong ? Math.max(entryY, stopY) : Math.max(stopY, entryY);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = stopColor;
  ctx.fillRect(left, stopTop, right - left, stopBottom - stopTop);

  // Entry line
  ctx.globalAlpha = 1;
  ctx.strokeStyle = s.entryColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left, entryY);
  ctx.lineTo(right, entryY);
  ctx.stroke();

  // Target line
  ctx.strokeStyle = s.targetColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(left, exitY);
  ctx.lineTo(right, exitY);
  ctx.stroke();

  // Stop line
  ctx.strokeStyle = s.stopColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, stopY);
  ctx.lineTo(right, stopY);
  ctx.stroke();
  ctx.setLineDash([]);

  // P&L calculation
  const priceDiff = isLong ? exit - entry : entry - exit;
  const riskDiff = isLong ? entry - (stop ?? entry * 0.98) : (stop ?? entry * 1.02) - entry;
  const riskReward = riskDiff !== 0 ? Math.abs(priceDiff / riskDiff) : 0;
  const pnlPercent = entry !== 0 ? (priceDiff / entry) * 100 : 0;

  // Labels on right side
  const labelX = right + 6;

  ctx.font = `bold ${s.fontSize}px Trebuchet MS, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Entry label
  ctx.fillStyle = s.entryColor;
  ctx.fillText(`Entry ${entry.toFixed(2)}`, labelX, entryY);

  // Target label
  ctx.fillStyle = s.targetColor;
  ctx.fillText(`Target ${exit.toFixed(2)}`, labelX, exitY);

  // Stop label
  ctx.fillStyle = s.stopColor;
  ctx.fillText(`Stop ${(stop ?? (isLong ? entry * 0.98 : entry * 1.02)).toFixed(2)}`, labelX, stopY);

  // P&L summary box
  const summaryLines = [
    `${isLong ? 'LONG' : 'SHORT'} | ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
    `P&L: ${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)}`,
    `R:R = 1:${riskReward.toFixed(2)}`,
  ];
  drawInfoBox(ctx, labelX, Math.min(entryY, exitY, stopY) - 50, summaryLines, s, profitColor);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Forecast ──────────────────────────────────────────────────────────────────

export function renderForecast(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Past data line (solid)
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  const mid = p.length > 2 ? Math.floor(p.length / 2) : 1;
  for (let i = 1; i <= mid && i < p.length; i++) {
    ctx.lineTo(p[i].x, p[i].y);
  }
  ctx.stroke();

  // Forecast line (dashed, different color)
  ctx.strokeStyle = '#FF9800';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = s.lineWidth;

  ctx.beginPath();
  ctx.moveTo(p[mid].x, p[mid].y);
  for (let i = mid + 1; i < p.length; i++) {
    ctx.lineTo(p[i].x, p[i].y);
  }
  ctx.stroke();

  // Confidence bands
  if (p.length > 2) {
    const bandWidth = Math.abs(p[p.length - 1].y - p[mid].y) * 0.3 || 20;
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.moveTo(p[mid].x, p[mid].y - bandWidth * 0.5);
    for (let i = mid; i < p.length; i++) {
      const expand = ((i - mid) / (p.length - mid)) * bandWidth;
      ctx.lineTo(p[i].x, p[i].y - expand);
    }
    for (let i = p.length - 1; i >= mid; i--) {
      const expand = ((i - mid) / (p.length - mid)) * bandWidth;
      ctx.lineTo(p[i].x, p[i].y + expand);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Dividing line at midpoint
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#FF9800';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(p[mid].x, 0);
  ctx.lineTo(p[mid].x, vp.height);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.font = `${s.fontSize}px Trebuchet MS, sans-serif`;
  ctx.fillStyle = '#FF9800';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Forecast', p[mid].x, 4);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Measure (ruler) ───────────────────────────────────────────────────────────

export function renderMeasure(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Line between two points
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.stroke();

  // Endpoints
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(p[0].x, p[0].y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p[1].x, p[1].y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Measurements
  const priceDiff = d.points[1].price - d.points[0].price;
  const timeDiff = d.points[1].time - d.points[0].time;
  const pixelDist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  const isPositive = priceDiff >= 0;

  const infoLines: string[] = [];
  if (s.showAbsoluteChange) infoLines.push(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)}`);
  if (s.showPercentage) infoLines.push(formatPercent(priceDiff, d.points[0].price));
  if (s.showBars) infoLines.push(`${Math.round(Math.abs(timeDiff) / 60)} bars`);
  if (s.showTime) infoLines.push(formatDuration(timeDiff));

  const midX = (p[0].x + p[1].x) / 2;
  const midY = (p[0].y + p[1].y) / 2;
  drawInfoBox(ctx, midX + 8, midY - 10, infoLines, s, isPositive ? s.profitColor : s.lossColor);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const MEASUREMENT_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  price_range: renderPriceRange,
  date_range: renderDateRange,
  date_price_range: renderDatePriceRange,
  bars_pattern: renderBarsPattern,
  ghost_feed: renderGhostFeed,
  projection: renderProjection,
  long_position: renderLongPosition,
  short_position: renderShortPosition,
  risk_reward_long: renderLongPosition,
  risk_reward_short: renderShortPosition,
  forecast: renderForecast,
  measure: renderMeasure,
};

export function renderMeasurementDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = MEASUREMENT_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
