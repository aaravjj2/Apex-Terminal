/**
 * Annotation renderers – text, notes, callouts, price labels, flags,
 * arrow markers, freehand brush, and highlighter.
 */

import {
  type Drawing,
  type Viewport,
  type TextStyle,
  type ShapeStyle,
  DEFAULT_TEXT_STYLE,
  DEFAULT_SHAPE_STYLE,
  pointToPixel,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function textStyle(d: Drawing): TextStyle {
  return { ...DEFAULT_TEXT_STYLE, ...(d.style as Partial<TextStyle>) };
}

function shapeStyle(d: Drawing): ShapeStyle {
  return { ...DEFAULT_SHAPE_STYLE, ...(d.style as Partial<ShapeStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

function drawTextBox(
  ctx: Ctx, x: number, y: number, s: TextStyle, lines: string[],
): { width: number; height: number } {
  const lineHeight = s.fontSize * 1.4;
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }
  const boxW = maxWidth + s.padding * 2;
  const boxH = lines.length * lineHeight + s.padding * 2;

  // Background
  if (s.backgroundOpacity > 0) {
    ctx.globalAlpha = s.backgroundOpacity;
    ctx.fillStyle = s.backgroundColor;

    if (s.borderRadius > 0) {
      const r = Math.min(s.borderRadius, boxW / 2, boxH / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + boxW - r, y);
      ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
      ctx.lineTo(x + boxW, y + boxH - r);
      ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
      ctx.lineTo(x + r, y + boxH);
      ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y, boxW, boxH);
    }
  }

  // Border
  if (s.borderWidth > 0) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.borderColor;
    ctx.lineWidth = s.borderWidth;
    ctx.strokeRect(x, y, boxW, boxH);
  }

  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.color;
  ctx.textAlign = s.textAlign;
  ctx.textBaseline = 'top';

  const textX = s.textAlign === 'center' ? x + boxW / 2
    : s.textAlign === 'right' ? x + boxW - s.padding
    : x + s.padding;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, y + s.padding + i * lineHeight);
  }

  return { width: boxW, height: boxH };
}

// ── Text ──────────────────────────────────────────────────────────────────────

export function renderText(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
  const lines = s.wordWrap ? wrapText(ctx, s.text, s.maxWidth) : s.text.split('\n');

  drawTextBox(ctx, p[0].x, p[0].y, s, lines);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Note ──────────────────────────────────────────────────────────────────────

export function renderNote(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Note icon (small square with fold)
  const iconSize = 20;
  const ix = p[0].x;
  const iy = p[0].y;

  ctx.fillStyle = '#FFB74D';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(ix, iy, iconSize, iconSize);

  // Fold triangle
  ctx.fillStyle = '#F57C00';
  ctx.beginPath();
  ctx.moveTo(ix + iconSize - 5, iy);
  ctx.lineTo(ix + iconSize, iy + 5);
  ctx.lineTo(ix + iconSize - 5, iy + 5);
  ctx.closePath();
  ctx.fill();

  // Lines on note
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.5;
  for (let i = 1; i <= 3; i++) {
    const ly = iy + 4 + i * 4;
    if (ly < iy + iconSize - 2) {
      ctx.beginPath();
      ctx.moveTo(ix + 3, ly);
      ctx.lineTo(ix + iconSize - 6, ly);
      ctx.stroke();
    }
  }

  // Tooltip on hover
  if (d.hovered || d.selected) {
    ctx.globalAlpha = 1;
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
    const lines = s.wordWrap ? wrapText(ctx, s.text, s.maxWidth) : s.text.split('\n');
    drawTextBox(ctx, ix + iconSize + 6, iy, s, lines);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Anchored Note ─────────────────────────────────────────────────────────────

export function renderAnchoredNote(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Anchor line from price point down
  const anchorX = p[0].x;
  const anchorY = p[0].y;
  const noteY = anchorY - 50;

  ctx.strokeStyle = s.borderColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(anchorX, noteY);
  ctx.stroke();

  // Anchor dot
  ctx.setLineDash([]);
  ctx.fillStyle = s.color;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Note box
  ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
  const lines = s.wordWrap ? wrapText(ctx, s.text, s.maxWidth) : s.text.split('\n');
  drawTextBox(ctx, anchorX - 4, noteY - lines.length * s.fontSize * 1.4 - s.padding * 2, s, lines);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Callout ───────────────────────────────────────────────────────────────────

export function renderCallout(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
  const lines = s.wordWrap ? wrapText(ctx, s.text, s.maxWidth) : s.text.split('\n');
  const lineHeight = s.fontSize * 1.4;
  let maxWidth = 0;
  for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);

  const boxW = maxWidth + s.padding * 2;
  const boxH = lines.length * lineHeight + s.padding * 2;
  const boxX = p[1].x;
  const boxY = p[1].y;

  // Arrow from anchor point to box
  ctx.strokeStyle = s.borderColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);

  // Find nearest point on box edge
  const closestX = Math.max(boxX, Math.min(boxX + boxW, p[0].x));
  const closestY = Math.max(boxY, Math.min(boxY + boxH, p[0].y));
  ctx.lineTo(closestX, closestY);
  ctx.stroke();

  // Arrow dot at anchor
  ctx.fillStyle = s.borderColor;
  ctx.beginPath();
  ctx.arc(p[0].x, p[0].y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Box
  drawTextBox(ctx, boxX, boxY, s, lines);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Price Label ───────────────────────────────────────────────────────────────

export function renderPriceLabel(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const price = d.points[0].price;
  const label = s.text || price.toFixed(2);

  ctx.font = `bold ${s.fontSize}px ${s.fontFamily}`;
  const metrics = ctx.measureText(label);
  const pad = 6;
  const boxW = metrics.width + pad * 2 + 10; // arrow space
  const boxH = s.fontSize + pad * 2;

  const x = vp.width - boxW;
  const y = p[0].y - boxH / 2;

  // Background pill
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = s.backgroundColor;
  ctx.beginPath();
  ctx.moveTo(x, y + boxH / 2);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + boxW, y);
  ctx.lineTo(x + boxW, y + boxH);
  ctx.lineTo(x + 8, y + boxH);
  ctx.closePath();
  ctx.fill();

  // Horizontal dashed line from point to label
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(x, p[0].y);
  ctx.stroke();

  // Text
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + boxH / 2);

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Arrow Marker ──────────────────────────────────────────────────────────────

export function renderArrowMarker(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = shapeStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const isUp = (d.metadata?.direction as string) !== 'down';
  const size = 16;

  ctx.fillStyle = isUp ? '#26A69A' : '#EF5350';
  ctx.globalAlpha = s.opacity;
  ctx.beginPath();

  if (isUp) {
    ctx.moveTo(p[0].x, p[0].y - size);
    ctx.lineTo(p[0].x - size * 0.6, p[0].y);
    ctx.lineTo(p[0].x - size * 0.2, p[0].y);
    ctx.lineTo(p[0].x - size * 0.2, p[0].y + size * 0.4);
    ctx.lineTo(p[0].x + size * 0.2, p[0].y + size * 0.4);
    ctx.lineTo(p[0].x + size * 0.2, p[0].y);
    ctx.lineTo(p[0].x + size * 0.6, p[0].y);
  } else {
    ctx.moveTo(p[0].x, p[0].y + size);
    ctx.lineTo(p[0].x - size * 0.6, p[0].y);
    ctx.lineTo(p[0].x - size * 0.2, p[0].y);
    ctx.lineTo(p[0].x - size * 0.2, p[0].y - size * 0.4);
    ctx.lineTo(p[0].x + size * 0.2, p[0].y - size * 0.4);
    ctx.lineTo(p[0].x + size * 0.2, p[0].y);
    ctx.lineTo(p[0].x + size * 0.6, p[0].y);
  }

  ctx.closePath();
  ctx.fill();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Flag ──────────────────────────────────────────────────────────────────────

export function renderFlag(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 1) return;
  const s = textStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const x = p[0].x;
  const y = p[0].y;
  const flagW = 28;
  const flagH = 20;
  const poleH = 40;

  // Pole
  ctx.strokeStyle = s.borderColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - poleH);
  ctx.stroke();

  // Flag shape
  ctx.fillStyle = s.backgroundColor || '#EF5350';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y - poleH);
  ctx.lineTo(x + flagW, y - poleH + flagH / 2);
  ctx.lineTo(x, y - poleH + flagH);
  ctx.closePath();
  ctx.fill();

  // Text label on flag
  if (s.text) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 9px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.text.slice(0, 3), x + flagW * 0.4, y - poleH + flagH / 2);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Brush (Freehand) ──────────────────────────────────────────────────────────

export function renderBrush(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = shapeStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = s.opacity;

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);

  // Smooth the freehand line using quadratic curves
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }

  if (p.length > 1) {
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected && p.length <= 20) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Highlighter ───────────────────────────────────────────────────────────────

export function renderHighlighter(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = shapeStyle(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  ctx.strokeStyle = s.fillColor || '#FFEB3B';
  ctx.lineWidth = Math.max(s.lineWidth * 4, 16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.35;

  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);

  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }

  if (p.length > 1) {
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected && p.length <= 20) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const ANNOTATION_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  text: renderText,
  note: renderNote,
  anchored_note: renderAnchoredNote,
  callout: renderCallout,
  price_label: renderPriceLabel,
  arrow_marker: renderArrowMarker,
  flag: renderFlag,
  balloon: renderNote,
  sign_post: renderFlag,
  brush: renderBrush,
  highlighter: renderHighlighter,
};

export function renderAnnotationDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = ANNOTATION_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
