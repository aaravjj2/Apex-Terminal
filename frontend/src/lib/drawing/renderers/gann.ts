/**
 * Gann drawing renderers – Gann Box, Gann Square, Gann Fan.
 * Implements proper Gann angle calculations and grid rendering.
 */

import {
  type Drawing,
  type Viewport,
  type GannStyle,
  DEFAULT_GANN_STYLE,
  pointToPixel,
  priceToY,
  timeToX,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): GannStyle {
  return { ...DEFAULT_GANN_STYLE, ...(d.style as Partial<GannStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

// Gann angles: name -> [time multiplier, price multiplier]
const GANN_ANGLES: [string, number, number][] = [
  ['1x8', 1, 8],
  ['1x4', 1, 4],
  ['1x3', 1, 3],
  ['1x2', 1, 2],
  ['1x1', 1, 1],
  ['2x1', 2, 1],
  ['3x1', 3, 1],
  ['4x1', 4, 1],
  ['8x1', 8, 1],
];

function drawGannGridLines(
  ctx: Ctx, x1: number, y1: number, x2: number, y2: number,
  levels: number[], s: GannStyle, horizontal: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 4]);
  ctx.globalAlpha = s.opacity * 0.3;

  for (const level of levels) {
    if (horizontal) {
      const y = y1 + (y2 - y1) * level;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    } else {
      const x = x1 + (x2 - x1) * level;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawGannLabel(ctx: Ctx, text: string, x: number, y: number, color: string, fontSize: number): void {
  ctx.save();
  ctx.font = `${fontSize}px Trebuchet MS, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const pad = 2;
  ctx.fillStyle = 'rgba(30, 34, 45, 0.8)';
  const m = ctx.measureText(text);
  ctx.fillRect(x, y - fontSize - pad, m.width + pad * 2, fontSize + pad * 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x + pad, y - pad);
  ctx.restore();
}

// ── Gann Box ──────────────────────────────────────────────────────────────────

export function renderGannBox(ctx: Ctx, d: Drawing, vp: Viewport): void {
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

  // Box outline
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.strokeRect(left, top, width, height);

  // Grid lines
  if (s.showGrid) {
    drawGannGridLines(ctx, left, top, right, bottom, s.levels, s, true);
    drawGannGridLines(ctx, left, top, right, bottom, s.levels, s, false);
  }

  // Diagonal Gann angles from bottom-left corner
  const angleColors = s.angleColors;

  for (const [name, timeMul, priceMul] of GANN_ANGLES) {
    const color = angleColors[name] ?? s.color;
    ctx.strokeStyle = color;
    ctx.lineWidth = name === '1x1' ? 2 : 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = s.opacity;

    // Angle from bottom-left to top-right normalized by box dimensions
    const endX = left + width * (timeMul / (timeMul + priceMul));
    const endY = bottom - height * (priceMul / (timeMul + priceMul));

    // Clip to box bounds
    const clipX = Math.max(left, Math.min(right, endX));
    const clipY = Math.max(top, Math.min(bottom, endY));

    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(clipX, clipY);
    ctx.stroke();

    // Mirror from top-right
    const mirrorEndX = right - width * (timeMul / (timeMul + priceMul));
    const mirrorEndY = top + height * (priceMul / (timeMul + priceMul));
    const mClipX = Math.max(left, Math.min(right, mirrorEndX));
    const mClipY = Math.max(top, Math.min(bottom, mirrorEndY));

    ctx.globalAlpha = s.opacity * 0.5;
    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(mClipX, mClipY);
    ctx.stroke();

    if (s.showLabels) {
      drawGannLabel(ctx, name, clipX + 2, clipY - 2, color, 10);
    }
  }

  // Fill background
  if (s.fillOpacity > 0) {
    ctx.globalAlpha = s.fillOpacity;
    ctx.fillStyle = s.fillColor;
    ctx.fillRect(left, top, width, height);
  }

  // Price/time labels on the sides
  if (s.showLabels) {
    ctx.globalAlpha = s.opacity;
    for (const level of s.levels) {
      const y = top + height * level;
      const price = d.points[0].price + (d.points[1].price - d.points[0].price) * level;
      drawGannLabel(ctx, price.toFixed(2), right + 4, y, s.color, 10);

      const x = left + width * level;
      drawGannLabel(ctx, `${(level * 100).toFixed(0)}%`, x, bottom + 14, s.color, 10);
    }
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Gann Square ───────────────────────────────────────────────────────────────

export function renderGannSquare(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = (p[0].x + p[1].x) / 2;
  const cy = (p[0].y + p[1].y) / 2;
  const size = Math.max(Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
  const half = size / 2;
  const left = cx - half;
  const top = cy - half;

  // Main square
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.strokeRect(left, top, size, size);

  // Inner squares (Gann square of 9)
  const rings = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 4]);
  ctx.globalAlpha = s.opacity * 0.4;

  for (const ring of rings) {
    const rSize = size * ring;
    ctx.strokeRect(cx - rSize / 2, cy - rSize / 2, rSize, rSize);
  }

  // Diagonals
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity * 0.7;

  // Main diagonal (1x1)
  ctx.strokeStyle = s.angleColors['1x1'] ?? s.color;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + size, top + size);
  ctx.stroke();

  // Counter diagonal
  ctx.beginPath();
  ctx.moveTo(left + size, top);
  ctx.lineTo(left, top + size);
  ctx.stroke();

  // Cardinal lines through center
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = s.opacity * 0.5;
  ctx.setLineDash([3, 3]);

  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(left + size, cy);
  ctx.stroke();

  // Gann angles from center
  ctx.setLineDash([]);
  ctx.globalAlpha = s.opacity;

  for (const [name, timeMul, priceMul] of GANN_ANGLES) {
    if (name === '1x1') continue;
    const color = s.angleColors[name] ?? s.color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.75;

    const angle = Math.atan2(priceMul, timeMul);
    const reach = half * 1.5;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * reach, cy - Math.sin(angle) * reach);
    ctx.stroke();

    // Mirror
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
    ctx.stroke();
  }

  // Fill
  if (s.fillOpacity > 0) {
    ctx.globalAlpha = s.fillOpacity;
    ctx.fillStyle = s.fillColor;
    ctx.fillRect(left, top, size, size);
  }

  // Center dot
  ctx.globalAlpha = s.opacity;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  if (s.showLabels) {
    drawGannLabel(ctx, 'Gann Square', left, top - 4, s.color, 11);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Gann Fan ──────────────────────────────────────────────────────────────────

export function renderGannFan(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const dx = p[1].x - p[0].x;
  const dy = p[1].y - p[0].y;
  const baseLength = Math.hypot(dx, dy);

  if (baseLength < 2) return;

  // The 1x1 line direction defines the unit scale
  const unitTimePixels = Math.abs(dx);
  const unitPricePixels = Math.abs(dy);

  for (const [name, timeMul, priceMul] of GANN_ANGLES) {
    const color = s.angleColors[name] ?? s.color;
    ctx.strokeStyle = color;
    ctx.lineWidth = name === '1x1' ? 2 : 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = s.opacity;

    // Calculate the fan line endpoint
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;

    let fanDx: number, fanDy: number;
    if (unitTimePixels > 0 && unitPricePixels > 0) {
      fanDx = signX * (unitTimePixels * timeMul);
      fanDy = signY * (unitPricePixels * priceMul);
    } else {
      const angle = Math.atan2(priceMul, timeMul);
      fanDx = signX * Math.cos(angle) * baseLength * 3;
      fanDy = signY * Math.sin(angle) * baseLength * 3;
    }

    const scale = Math.max(vp.width, vp.height) * 2 / Math.hypot(fanDx, fanDy);
    const endX = p[0].x + fanDx * scale;
    const endY = p[0].y + fanDy * scale;

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    if (s.showLabels) {
      const labelDist = 120;
      const norm = Math.hypot(fanDx, fanDy);
      const lx = p[0].x + (fanDx / norm) * labelDist;
      const ly = p[0].y + (fanDy / norm) * labelDist;
      drawGannLabel(ctx, name, lx, ly, color, 10);
    }
  }

  // Downward fan (mirrored angles)
  ctx.globalAlpha = s.opacity * 0.4;
  for (const [name, timeMul, priceMul] of GANN_ANGLES) {
    if (name === '1x1') continue;
    const color = s.angleColors[name] ?? s.color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 3]);

    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? -1 : 1;

    let fanDx: number, fanDy: number;
    if (unitTimePixels > 0 && unitPricePixels > 0) {
      fanDx = signX * (unitTimePixels * timeMul);
      fanDy = signY * (unitPricePixels * priceMul);
    } else {
      const angle = Math.atan2(priceMul, timeMul);
      fanDx = signX * Math.cos(angle) * baseLength * 3;
      fanDy = signY * Math.sin(angle) * baseLength * 3;
    }

    const scale = Math.max(vp.width, vp.height) * 2 / Math.hypot(fanDx, fanDy);

    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[0].x + fanDx * scale, p[0].y + fanDy * scale);
    ctx.stroke();
  }

  // Origin dot
  ctx.globalAlpha = s.opacity;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(p[0].x, p[0].y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Reference line
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

// ── Dispatcher ────────────────────────────────────────────────────────────────

const GANN_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  gann_box: renderGannBox,
  gann_square: renderGannSquare,
  gann_square_fixed: renderGannSquare,
  gann_fan: renderGannFan,
};

export function renderGannDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = GANN_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
