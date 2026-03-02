/**
 * Pattern drawing renderers – harmonic patterns (XABCD, Cypher, ABCD, Three Drives),
 * head-and-shoulders, Elliott waves, cyclic lines, time cycles, and sine waves.
 */

import {
  type Drawing,
  type Viewport,
  type PatternStyle,
  DEFAULT_PATTERN_STYLE,
  pointToPixel,
  timeToX,
  priceToY,
} from '../types';
import { DrawingEngine } from '../core';

type Ctx = CanvasRenderingContext2D;
type Px = { x: number; y: number };

function style(d: Drawing): PatternStyle {
  return { ...DEFAULT_PATTERN_STYLE, ...(d.style as Partial<PatternStyle>) };
}

function pts(d: Drawing, vp: Viewport): Px[] {
  return d.points.map(p => pointToPixel(p, vp));
}

function drawPatternSegments(ctx: Ctx, p: Px[], s: PatternStyle): void {
  if (p.length < 2) return;
  ctx.strokeStyle = s.color;
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
}

function drawPatternFill(ctx: Ctx, p: Px[], s: PatternStyle): void {
  if (p.length < 3) return;
  ctx.globalAlpha = s.fillOpacity;
  ctx.fillStyle = s.fillColor;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) {
    ctx.lineTo(p[i].x, p[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = s.opacity;
}

function drawPointLabel(
  ctx: Ctx, label: string, x: number, y: number, s: PatternStyle, above: boolean,
): void {
  if (!s.showLabels) return;
  ctx.save();
  ctx.font = `bold ${s.labelFontSize}px Trebuchet MS, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = above ? 'bottom' : 'top';

  const offset = above ? -10 : 10;
  const metrics = ctx.measureText(label);
  const pad = 3;

  ctx.fillStyle = 'rgba(30, 34, 45, 0.85)';
  ctx.fillRect(
    x - metrics.width / 2 - pad,
    y + offset - (above ? s.labelFontSize + pad : 0),
    metrics.width + pad * 2,
    s.labelFontSize + pad * 2,
  );

  ctx.fillStyle = s.labelColor;
  ctx.fillText(label, x, y + offset);
  ctx.restore();
}

function drawRatioLabel(
  ctx: Ctx, ratio: string, x1: number, y1: number, x2: number, y2: number, s: PatternStyle,
): void {
  if (!s.showLabels) return;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  ctx.save();
  ctx.font = `${s.labelFontSize - 2}px Trebuchet MS, sans-serif`;
  ctx.fillStyle = s.labelColor;
  ctx.globalAlpha = s.opacity * 0.7;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ratio, mx + 8, my);
  ctx.restore();
}

function isAbove(idx: number, p: Px[]): boolean {
  if (idx <= 0 || idx >= p.length - 1) return p.length > 1 && p[idx].y < p[Math.min(idx + 1, p.length - 1)].y;
  return p[idx].y < (p[idx - 1].y + p[idx + 1].y) / 2;
}

// ── XABCD Pattern ─────────────────────────────────────────────────────────────

export function renderXABCD(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 5) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Fill triangles: XAB, BCD
  ctx.globalAlpha = s.fillOpacity;
  ctx.fillStyle = s.fillColor;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(p[2].x, p[2].y);
  ctx.lineTo(p[3].x, p[3].y);
  ctx.lineTo(p[4].x, p[4].y);
  ctx.closePath();
  ctx.fill();

  // Connector: A->D (dashed)
  ctx.globalAlpha = s.opacity * 0.4;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[4].x, p[4].y);
  ctx.stroke();

  // X->B connector (dashed)
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();

  // Main pattern lines
  ctx.setLineDash(s.dashPattern);
  drawPatternSegments(ctx, p, s);

  // Labels
  const labels = ['X', 'A', 'B', 'C', 'D'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  // Ratio labels
  const xa = Math.abs(d.points[1].price - d.points[0].price);
  if (xa > 0) {
    const ab = Math.abs(d.points[2].price - d.points[1].price);
    const bc = Math.abs(d.points[3].price - d.points[2].price);
    const cd = Math.abs(d.points[4].price - d.points[3].price);

    drawRatioLabel(ctx, (ab / xa).toFixed(3), p[1].x, p[1].y, p[2].x, p[2].y, s);
    drawRatioLabel(ctx, (bc / ab).toFixed(3), p[2].x, p[2].y, p[3].x, p[3].y, s);
    drawRatioLabel(ctx, (cd / bc).toFixed(3), p[3].x, p[3].y, p[4].x, p[4].y, s);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Cypher Pattern ────────────────────────────────────────────────────────────

export function renderCypher(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 5) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Fill
  drawPatternFill(ctx, p, s);

  // X->C connector (dashed)
  ctx.globalAlpha = s.opacity * 0.4;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[3].x, p[3].y);
  ctx.stroke();

  // Main segments
  ctx.setLineDash(s.dashPattern);
  drawPatternSegments(ctx, p, s);

  const labels = ['X', 'A', 'B', 'C', 'D'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  // Ratio labels
  const xa = Math.abs(d.points[1].price - d.points[0].price);
  if (xa > 0) {
    const ab = Math.abs(d.points[2].price - d.points[1].price);
    const xc = Math.abs(d.points[3].price - d.points[0].price);
    drawRatioLabel(ctx, (ab / xa).toFixed(3), p[1].x, p[1].y, p[2].x, p[2].y, s);
    drawRatioLabel(ctx, (xc / xa).toFixed(3), p[0].x, p[0].y, p[3].x, p[3].y, s);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── ABCD Pattern ──────────────────────────────────────────────────────────────

export function renderABCD(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 4) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Fill quadrilateral
  drawPatternFill(ctx, p, s);

  // A->C connector (dashed)
  ctx.globalAlpha = s.opacity * 0.4;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();

  // B->D connector
  ctx.beginPath();
  ctx.moveTo(p[1].x, p[1].y);
  ctx.lineTo(p[3].x, p[3].y);
  ctx.stroke();

  // Main pattern
  ctx.setLineDash(s.dashPattern);
  drawPatternSegments(ctx, p, s);

  const labels = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  // Ratio labels
  const ab = Math.abs(d.points[1].price - d.points[0].price);
  if (ab > 0) {
    const bc = Math.abs(d.points[2].price - d.points[1].price);
    const cd = Math.abs(d.points[3].price - d.points[2].price);
    drawRatioLabel(ctx, (bc / ab).toFixed(3), p[1].x, p[1].y, p[2].x, p[2].y, s);
    drawRatioLabel(ctx, (cd / ab).toFixed(3), p[2].x, p[2].y, p[3].x, p[3].y, s);
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Three Drives ──────────────────────────────────────────────────────────────

export function renderThreeDrives(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 7) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Fill alternate triangles
  for (let i = 0; i < p.length - 2; i += 2) {
    if (i + 2 < p.length) {
      ctx.globalAlpha = s.fillOpacity;
      ctx.fillStyle = s.fillColor;
      ctx.beginPath();
      ctx.moveTo(p[i].x, p[i].y);
      ctx.lineTo(p[i + 1].x, p[i + 1].y);
      ctx.lineTo(p[i + 2].x, p[i + 2].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Main pattern
  drawPatternSegments(ctx, p, s);

  const labels = ['O', '1', 'A', '2', 'B', '3', 'C'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Head and Shoulders ────────────────────────────────────────────────────────

export function renderHeadAndShoulders(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 7) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Fill the pattern area
  drawPatternFill(ctx, p, s);

  // Main pattern outline
  drawPatternSegments(ctx, p, s);

  // Neckline (connect the two troughs: index 1 and 5 for standard H&S)
  if (p.length >= 6) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = s.opacity;

    ctx.beginPath();
    ctx.moveTo(p[1].x, p[1].y);
    ctx.lineTo(p[5].x, p[5].y);

    // Extend neckline to right
    const ndx = p[5].x - p[1].x;
    const ndy = p[5].y - p[1].y;
    if (ndx !== 0) {
      const extFactor = (vp.width - p[5].x) / ndx;
      ctx.lineTo(p[5].x + ndx * extFactor, p[5].y + ndy * extFactor);
    }
    ctx.stroke();
    ctx.setLineDash(s.dashPattern);
  }

  const labels = ['LS₁', 'T₁', 'LS₂', 'Head', 'RS₁', 'T₂', 'RS₂'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Elliott Impulse Wave ──────────────────────────────────────────────────────

const IMPULSE_LABELS_FULL = ['0', '1', '2', '3', '4', '5'];
const IMPULSE_LABELS_COMPACT = ['0', '①', '②', '③', '④', '⑤'];

export function renderElliottImpulse(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 6) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  // Impulse waves: 0->1, 2->3, 4->5 (with 1->2, 3->4 corrections)
  // Fill impulse triangles
  const impulseColor = '#26A69A';
  const correctionColor = '#EF5350';

  for (let i = 0; i < p.length - 1; i++) {
    const isImpulse = i % 2 === 0;
    ctx.strokeStyle = isImpulse ? impulseColor : correctionColor;
    ctx.lineWidth = isImpulse ? s.lineWidth + 1 : s.lineWidth;
    ctx.setLineDash(isImpulse ? [] : [4, 3]);
    ctx.globalAlpha = s.opacity;

    ctx.beginPath();
    ctx.moveTo(p[i].x, p[i].y);
    ctx.lineTo(p[i + 1].x, p[i + 1].y);
    ctx.stroke();
  }

  // Wave degree channel
  if (p.length >= 6) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 6]);
    ctx.globalAlpha = s.opacity * 0.3;

    // 0-2 baseline extended
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[4].x, p[4].y);
    ctx.stroke();
  }

  const labels = s.waveLabelStyle === 'compact' ? IMPULSE_LABELS_COMPACT : IMPULSE_LABELS_FULL;
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Elliott Correction Wave ───────────────────────────────────────────────────

export function renderElliottCorrection(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 4) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const corrColors = ['#EF5350', '#26A69A', '#EF5350'];

  for (let i = 0; i < Math.min(p.length - 1, 3); i++) {
    ctx.strokeStyle = corrColors[i];
    ctx.lineWidth = s.lineWidth;
    ctx.setLineDash(i === 1 ? [] : [4, 3]);
    ctx.globalAlpha = s.opacity;

    ctx.beginPath();
    ctx.moveTo(p[i].x, p[i].y);
    ctx.lineTo(p[i + 1].x, p[i + 1].y);
    ctx.stroke();
  }

  // A-C trendline
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 5]);
  ctx.globalAlpha = s.opacity * 0.3;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.stroke();

  const labels = s.waveLabelStyle === 'compact' ? ['Ⓐ', 'Ⓑ', 'Ⓒ', 'End'] : ['A', 'B', 'C', 'End'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Elliott Combo (WXY) ───────────────────────────────────────────────────────

export function renderElliottCombo(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 5) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  for (let i = 0; i < p.length - 1; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#EF5350' : '#26A69A';
    ctx.lineWidth = s.lineWidth;
    ctx.setLineDash(i % 2 === 0 ? [4, 3] : []);
    ctx.globalAlpha = s.opacity;

    ctx.beginPath();
    ctx.moveTo(p[i].x, p[i].y);
    ctx.lineTo(p[i + 1].x, p[i + 1].y);
    ctx.stroke();
  }

  const labels = ['W', 'X', 'Y', 'X\'', 'Z'];
  for (let i = 0; i < Math.min(p.length, labels.length); i++) {
    drawPointLabel(ctx, labels[i], p[i].x, p[i].y, s, isAbove(i, p));
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Cyclic Lines ──────────────────────────────────────────────────────────────

export function renderCyclicLines(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const period = Math.abs(p[1].x - p[0].x);
  if (period < 2) return;

  const startX = Math.min(p[0].x, p[1].x);
  let x = startX;
  let idx = 0;

  while (x < vp.width + period) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.setLineDash(s.dashPattern);
    ctx.globalAlpha = s.opacity * (idx < 2 ? 1 : 0.6);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vp.height);
    ctx.stroke();

    if (s.showLabels && idx < 20) {
      ctx.font = `${s.labelFontSize}px Trebuchet MS, sans-serif`;
      ctx.fillStyle = s.labelColor;
      ctx.globalAlpha = s.opacity * 0.7;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${idx}`, x, 4);
    }

    x += period;
    idx++;
  }

  // Backward from start
  x = startX - period;
  while (x > -period) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.setLineDash(s.dashPattern);
    ctx.globalAlpha = s.opacity * 0.4;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vp.height);
    ctx.stroke();

    x -= period;
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Time Cycles ───────────────────────────────────────────────────────────────

export function renderTimeCycles(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const cx = p[0].x;
  const cy = p[0].y;
  const radius = Math.abs(p[1].x - p[0].x);
  if (radius < 2) return;

  const count = Math.ceil(vp.width / (radius * 2)) + 2;

  for (let i = -1; i < count; i++) {
    const offX = cx + i * radius * 2;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.setLineDash(s.dashPattern);
    ctx.globalAlpha = s.opacity * (i < 1 ? 1 : 0.5);

    ctx.beginPath();
    ctx.arc(offX, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (s.fillOpacity > 0) {
      ctx.globalAlpha = s.fillOpacity * 0.5;
      ctx.fillStyle = s.fillColor;
      ctx.fill();
    }
  }

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Sine Line ─────────────────────────────────────────────────────────────────

export function renderSineLine(ctx: Ctx, d: Drawing, vp: Viewport): void {
  const p = pts(d, vp);
  if (p.length < 2) return;
  const s = style(d);

  DrawingEngine.applyHoverEffect(ctx, d);

  const period = Math.abs(p[1].x - p[0].x) * 2;
  const amplitude = Math.abs(p[1].y - p[0].y);
  const centerY = p[0].y;
  const startX = p[0].x;

  if (period < 2) return;

  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.setLineDash(s.dashPattern);
  ctx.globalAlpha = s.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const step = 2; // pixels
  for (let x = -100; x < vp.width + 100; x += step) {
    const phase = ((x - startX) / period) * Math.PI * 2;
    const y = centerY + Math.sin(phase) * amplitude;

    if (x === -100) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Center line (dashed)
  ctx.setLineDash([4, 6]);
  ctx.globalAlpha = s.opacity * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(vp.width, centerY);
  ctx.stroke();

  DrawingEngine.resetCtx(ctx);
  if (d.selected) DrawingEngine.drawSelectionHandles(ctx, p);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const PATTERN_RENDERERS: Record<string, (ctx: Ctx, d: Drawing, vp: Viewport) => void> = {
  xabcd: renderXABCD,
  cypher: renderCypher,
  abcd: renderABCD,
  three_drives: renderThreeDrives,
  head_and_shoulders: renderHeadAndShoulders,
  elliott_impulse: renderElliottImpulse,
  elliott_correction: renderElliottCorrection,
  elliott_combo: renderElliottCombo,
  elliott_triangle: renderElliottCorrection,
  cyclic_lines: renderCyclicLines,
  time_cycles: renderTimeCycles,
  sine_line: renderSineLine,
};

export function renderPatternDrawing(ctx: Ctx, d: Drawing, vp: Viewport): boolean {
  const renderer = PATTERN_RENDERERS[d.type];
  if (!renderer) return false;
  ctx.save();
  renderer(ctx, d, vp);
  ctx.restore();
  return true;
}
