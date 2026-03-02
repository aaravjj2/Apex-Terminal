/**
 * Drawing tools engine – barrel exports.
 *
 * Usage:
 *   import { DrawingEngine, DrawingType, renderDrawing } from '@/lib/drawing';
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export {
  DrawingType,
  type Point,
  type Viewport,
  type Drawing,
  type DrawingBase,
  type DrawingState,
  type DrawingCommand,
  type DrawingEvent,
  type DrawingEventHandler,
  type DrawingEventType,
  type HitTestResult,
  type LineStyle,
  type FibStyle,
  type FibLevel,
  type ShapeStyle,
  type TextStyle,
  type PatternStyle,
  type MeasurementStyle,
  type GannStyle,
  type DrawingStyle,
  type CommandType,
  DEFAULT_LINE_STYLE,
  DEFAULT_FIB_STYLE,
  DEFAULT_SHAPE_STYLE,
  DEFAULT_TEXT_STYLE,
  DEFAULT_PATTERN_STYLE,
  DEFAULT_MEASUREMENT_STYLE,
  DEFAULT_GANN_STYLE,
  timeToX,
  priceToY,
  xToTime,
  yToPrice,
  pointToPixel,
  pixelToPoint,
  generateId,
} from './types';

// ── Core Engine ───────────────────────────────────────────────────────────────

export { DrawingEngine, type OHLCVBar } from './core';

// ── Renderers ─────────────────────────────────────────────────────────────────

export { renderLineDrawing } from './renderers/lines';
export { renderFibDrawing } from './renderers/fibonacci';
export { renderGannDrawing } from './renderers/gann';
export { renderShapeDrawing } from './renderers/shapes';
export { renderPatternDrawing } from './renderers/patterns';
export { renderAnnotationDrawing } from './renderers/annotations';
export { renderMeasurementDrawing } from './renderers/measurements';

// Individual line renderers
export {
  renderTrendLine,
  renderRay,
  renderExtendedLine,
  renderTrendAngle,
  renderHorizontalLine,
  renderHorizontalRay,
  renderVerticalLine,
  renderCrossLine,
  renderParallelChannel,
  renderDisjointChannel,
  renderFlatChannel,
  renderRegressionTrend,
  renderAndrewsPitchfork,
  renderSchiffPitchfork,
} from './renderers/lines';

// Individual fibonacci renderers
export {
  renderFibRetracement,
  renderFibExtension,
  renderFibChannel,
  renderFibFan,
  renderFibArc,
  renderFibSpiral,
  renderFibTimeZone,
  renderFibWedge,
} from './renderers/fibonacci';

// Individual gann renderers
export {
  renderGannBox,
  renderGannSquare,
  renderGannFan,
} from './renderers/gann';

// Individual shape renderers
export {
  renderRectangle,
  renderRotatedRectangle,
  renderCircle,
  renderEllipse,
  renderTriangle,
  renderPolyline,
  renderCurve,
  renderArc,
  renderArrow,
} from './renderers/shapes';

// Individual pattern renderers
export {
  renderXABCD,
  renderCypher,
  renderABCD,
  renderThreeDrives,
  renderHeadAndShoulders,
  renderElliottImpulse,
  renderElliottCorrection,
  renderElliottCombo,
  renderCyclicLines,
  renderTimeCycles,
  renderSineLine,
} from './renderers/patterns';

// Individual annotation renderers
export {
  renderText,
  renderNote,
  renderAnchoredNote,
  renderCallout,
  renderPriceLabel,
  renderArrowMarker,
  renderFlag,
  renderBrush,
  renderHighlighter,
} from './renderers/annotations';

// Individual measurement renderers
export {
  renderPriceRange,
  renderDateRange,
  renderDatePriceRange,
  renderBarsPattern,
  renderGhostFeed,
  renderProjection,
  renderLongPosition,
  renderShortPosition,
  renderForecast,
  renderMeasure,
} from './renderers/measurements';

// ── Unified Renderer ──────────────────────────────────────────────────────────

import type { Drawing, Viewport } from './types';
import { renderLineDrawing } from './renderers/lines';
import { renderFibDrawing } from './renderers/fibonacci';
import { renderGannDrawing } from './renderers/gann';
import { renderShapeDrawing } from './renderers/shapes';
import { renderPatternDrawing } from './renderers/patterns';
import { renderAnnotationDrawing } from './renderers/annotations';
import { renderMeasurementDrawing } from './renderers/measurements';

/**
 * Render any drawing to a canvas context. Dispatches to the correct
 * category renderer based on drawing type. Returns true if rendered.
 */
export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  viewport: Viewport,
): boolean {
  return (
    renderLineDrawing(ctx, drawing, viewport) ||
    renderFibDrawing(ctx, drawing, viewport) ||
    renderGannDrawing(ctx, drawing, viewport) ||
    renderShapeDrawing(ctx, drawing, viewport) ||
    renderPatternDrawing(ctx, drawing, viewport) ||
    renderAnnotationDrawing(ctx, drawing, viewport) ||
    renderMeasurementDrawing(ctx, drawing, viewport)
  );
}
