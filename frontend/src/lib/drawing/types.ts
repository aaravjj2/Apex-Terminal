/**
 * Drawing types and interfaces for the TradingView-grade drawing engine.
 */

// ── Drawing Type Enum ─────────────────────────────────────────────────────────

export enum DrawingType {
  // Lines
  TrendLine = 'trend_line',
  Ray = 'ray',
  ExtendedLine = 'extended_line',
  TrendAngle = 'trend_angle',
  HorizontalLine = 'horizontal_line',
  HorizontalRay = 'horizontal_ray',
  VerticalLine = 'vertical_line',
  CrossLine = 'cross_line',
  InfoLine = 'info_line',

  // Channels
  ParallelChannel = 'parallel_channel',
  DisjointChannel = 'disjoint_channel',
  FlatChannel = 'flat_channel',
  RegressionTrend = 'regression_trend',

  // Pitchfork
  AndrewsPitchfork = 'andrews_pitchfork',
  SchiffPitchfork = 'schiff_pitchfork',
  ModifiedSchiffPitchfork = 'modified_schiff_pitchfork',
  InsidePitchfork = 'inside_pitchfork',

  // Fibonacci
  FibRetracement = 'fib_retracement',
  FibExtension = 'fib_extension',
  FibChannel = 'fib_channel',
  FibFan = 'fib_fan',
  FibArc = 'fib_arc',
  FibSpiral = 'fib_spiral',
  FibTimeZone = 'fib_time_zone',
  FibWedge = 'fib_wedge',
  TrendBasedFibExtension = 'trend_based_fib_extension',
  TrendBasedFibTime = 'trend_based_fib_time',
  FibCircle = 'fib_circle',

  // Gann
  GannBox = 'gann_box',
  GannSquare = 'gann_square',
  GannFan = 'gann_fan',
  GannSquareFixed = 'gann_square_fixed',

  // Shapes
  Rectangle = 'rectangle',
  RotatedRectangle = 'rotated_rectangle',
  Circle = 'circle',
  Ellipse = 'ellipse',
  Triangle = 'triangle',
  Polyline = 'polyline',
  Curve = 'curve',
  Arc = 'arc',
  Arrow = 'arrow',
  ArrowMarker = 'arrow_marker',

  // Patterns
  XABCD = 'xabcd',
  Cypher = 'cypher',
  ABCD = 'abcd',
  ThreeDrives = 'three_drives',
  HeadAndShoulders = 'head_and_shoulders',
  ElliottImpulse = 'elliott_impulse',
  ElliottCorrection = 'elliott_correction',
  ElliottCombo = 'elliott_combo',
  ElliottTriangle = 'elliott_triangle',
  CyclicLines = 'cyclic_lines',
  TimeCycles = 'time_cycles',
  SineLine = 'sine_line',

  // Annotations
  Text = 'text',
  Note = 'note',
  AnchoredNote = 'anchored_note',
  Callout = 'callout',
  PriceLabel = 'price_label',
  Flag = 'flag',
  Balloon = 'balloon',
  SignPost = 'sign_post',

  // Freehand
  Brush = 'brush',
  Highlighter = 'highlighter',

  // Measurements
  PriceRange = 'price_range',
  DateRange = 'date_range',
  DatePriceRange = 'date_price_range',
  BarsPattern = 'bars_pattern',
  GhostFeed = 'ghost_feed',
  Projection = 'projection',
  LongPosition = 'long_position',
  ShortPosition = 'short_position',
  Forecast = 'forecast',
  Measure = 'measure',
  RiskRewardLong = 'risk_reward_long',
  RiskRewardShort = 'risk_reward_short',
}

// ── Core Geometry ─────────────────────────────────────────────────────────────

export interface Point {
  x: number;      // pixel x
  y: number;      // pixel y
  time: number;   // unix timestamp (seconds)
  price: number;  // price value
}

export interface Viewport {
  timeRange: [number, number];   // [startTime, endTime] unix seconds
  priceRange: [number, number];  // [lowPrice, highPrice]
  width: number;                 // canvas pixel width
  height: number;                // canvas pixel height
}

// ── Style Interfaces ──────────────────────────────────────────────────────────

export interface LineStyle {
  color: string;
  lineWidth: number;
  dashPattern: number[];
  opacity: number;
  extendLeft: boolean;
  extendRight: boolean;
  showMiddleLine: boolean;
  showLabels: boolean;
  labelFontSize: number;
  labelColor: string;
}

export interface FibStyle {
  color: string;
  lineWidth: number;
  dashPattern: number[];
  opacity: number;
  showLevels: boolean;
  showLabels: boolean;
  showPrices: boolean;
  showPercents: boolean;
  fillBackground: boolean;
  fillOpacity: number;
  levels: FibLevel[];
  reverseDirection: boolean;
  labelFontSize: number;
}

export interface FibLevel {
  value: number;     // e.g. 0.236
  color: string;
  lineWidth: number;
  dashPattern: number[];
  visible: boolean;
}

export interface ShapeStyle {
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  dashPattern: number[];
  opacity: number;
  fillOpacity: number;
  rotation: number;        // radians
  borderRadius: number;
}

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  wordWrap: boolean;
  maxWidth: number;
}

export interface PatternStyle {
  color: string;
  lineWidth: number;
  dashPattern: number[];
  opacity: number;
  showLabels: boolean;
  labelFontSize: number;
  labelColor: string;
  fillColor: string;
  fillOpacity: number;
  waveLabelStyle: 'full' | 'compact' | 'number';
}

export interface MeasurementStyle {
  color: string;
  lineWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  showPercentage: boolean;
  showAbsoluteChange: boolean;
  showBars: boolean;
  showTime: boolean;
  fontSize: number;
  profitColor: string;
  lossColor: string;
  entryColor: string;
  targetColor: string;
  stopColor: string;
}

export interface GannStyle {
  color: string;
  lineWidth: number;
  dashPattern: number[];
  opacity: number;
  showLabels: boolean;
  showGrid: boolean;
  fillColor: string;
  fillOpacity: number;
  angleColors: Record<string, string>;
  levels: number[];
}

export type DrawingStyle =
  | LineStyle
  | FibStyle
  | ShapeStyle
  | TextStyle
  | PatternStyle
  | MeasurementStyle
  | GannStyle;

// ── Drawing Base ──────────────────────────────────────────────────────────────

export interface DrawingBase {
  id: string;
  type: DrawingType;
  points: Point[];
  style: DrawingStyle;
  locked: boolean;
  hidden: boolean;
  layer: number;
  timeframeVisibility: string[];  // e.g. ['1m','5m','1D'] or ['all']
  selected: boolean;
  hovered: boolean;
  creating: boolean;   // true while the user is still placing points
  groupId?: string;    // optional grouping
  metadata?: Record<string, unknown>;
}

export type Drawing = DrawingBase;

// ── Drawing State ─────────────────────────────────────────────────────────────

export interface DrawingState {
  drawings: Drawing[];
  activeDrawingId: string | null;
  selectedDrawingIds: Set<string>;
  hoveredDrawingId: string | null;
  activeTool: DrawingType | null;
  magnetMode: boolean;
  magnetStrength: number;       // pixels
  drawingInProgress: Drawing | null;
  clipboard: Drawing | null;
  undoStack: DrawingCommand[];
  redoStack: DrawingCommand[];
}

// ── Command Pattern for Undo/Redo ─────────────────────────────────────────────

export type CommandType = 'add' | 'remove' | 'modify' | 'reorder' | 'batch';

export interface DrawingCommand {
  type: CommandType;
  timestamp: number;
  drawingId: string;
  before?: Partial<Drawing>;
  after?: Partial<Drawing>;
  children?: DrawingCommand[];  // for batch commands
}

// ── Events ────────────────────────────────────────────────────────────────────

export type DrawingEventType =
  | 'create' | 'modify' | 'delete' | 'select' | 'deselect'
  | 'hover' | 'unhover' | 'lock' | 'unlock' | 'hide' | 'show'
  | 'reorder' | 'styleChange';

export interface DrawingEvent {
  type: DrawingEventType;
  drawingId: string;
  drawing?: Drawing;
  previousState?: Partial<Drawing>;
}

export type DrawingEventHandler = (event: DrawingEvent) => void;

// ── Hit Test Result ───────────────────────────────────────────────────────────

export interface HitTestResult {
  hit: boolean;
  drawingId: string;
  pointIndex: number;  // -1 if on body, >= 0 if on a control point
  distance: number;
}

// ── Coordinate Helpers ────────────────────────────────────────────────────────

export function timeToX(time: number, vp: Viewport): number {
  const [t0, t1] = vp.timeRange;
  return ((time - t0) / (t1 - t0)) * vp.width;
}

export function priceToY(price: number, vp: Viewport): number {
  const [lo, hi] = vp.priceRange;
  return ((hi - price) / (hi - lo)) * vp.height;
}

export function xToTime(x: number, vp: Viewport): number {
  const [t0, t1] = vp.timeRange;
  return t0 + (x / vp.width) * (t1 - t0);
}

export function yToPrice(y: number, vp: Viewport): number {
  const [lo, hi] = vp.priceRange;
  return hi - (y / vp.height) * (hi - lo);
}

export function pointToPixel(pt: Point, vp: Viewport): { x: number; y: number } {
  return { x: timeToX(pt.time, vp), y: priceToY(pt.price, vp) };
}

export function pixelToPoint(px: number, py: number, vp: Viewport): Point {
  return { x: px, y: py, time: xToTime(px, vp), price: yToPrice(py, vp) };
}

// ── Default Styles ────────────────────────────────────────────────────────────

export const DEFAULT_LINE_STYLE: LineStyle = {
  color: '#2962FF',
  lineWidth: 2,
  dashPattern: [],
  opacity: 1,
  extendLeft: false,
  extendRight: false,
  showMiddleLine: false,
  showLabels: true,
  labelFontSize: 11,
  labelColor: '#FFFFFF',
};

export const DEFAULT_FIB_STYLE: FibStyle = {
  color: '#787B86',
  lineWidth: 1,
  dashPattern: [],
  opacity: 1,
  showLevels: true,
  showLabels: true,
  showPrices: true,
  showPercents: true,
  fillBackground: true,
  fillOpacity: 0.08,
  reverseDirection: false,
  labelFontSize: 11,
  levels: [
    { value: 0, color: '#787B86', lineWidth: 1, dashPattern: [], visible: true },
    { value: 0.236, color: '#F44336', lineWidth: 1, dashPattern: [], visible: true },
    { value: 0.382, color: '#FF9800', lineWidth: 1, dashPattern: [], visible: true },
    { value: 0.5, color: '#4CAF50', lineWidth: 1, dashPattern: [5, 5], visible: true },
    { value: 0.618, color: '#009688', lineWidth: 1, dashPattern: [], visible: true },
    { value: 0.786, color: '#2196F3', lineWidth: 1, dashPattern: [], visible: true },
    { value: 1, color: '#787B86', lineWidth: 1, dashPattern: [], visible: true },
  ],
};

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  strokeColor: '#2962FF',
  fillColor: '#2962FF',
  lineWidth: 2,
  dashPattern: [],
  opacity: 1,
  fillOpacity: 0.1,
  rotation: 0,
  borderRadius: 0,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: '',
  fontFamily: 'Trebuchet MS, sans-serif',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#D1D4DC',
  backgroundColor: '#1E222D',
  backgroundOpacity: 0.8,
  borderColor: '#363A45',
  borderWidth: 1,
  borderRadius: 4,
  padding: 8,
  textAlign: 'left',
  verticalAlign: 'top',
  wordWrap: true,
  maxWidth: 200,
};

export const DEFAULT_PATTERN_STYLE: PatternStyle = {
  color: '#2962FF',
  lineWidth: 2,
  dashPattern: [],
  opacity: 1,
  showLabels: true,
  labelFontSize: 12,
  labelColor: '#FFFFFF',
  fillColor: '#2962FF',
  fillOpacity: 0.06,
  waveLabelStyle: 'full',
};

export const DEFAULT_MEASUREMENT_STYLE: MeasurementStyle = {
  color: '#2962FF',
  lineWidth: 1,
  backgroundColor: '#1E222D',
  backgroundOpacity: 0.85,
  showPercentage: true,
  showAbsoluteChange: true,
  showBars: true,
  showTime: true,
  fontSize: 11,
  profitColor: '#26A69A',
  lossColor: '#EF5350',
  entryColor: '#2196F3',
  targetColor: '#26A69A',
  stopColor: '#EF5350',
};

export const DEFAULT_GANN_STYLE: GannStyle = {
  color: '#2962FF',
  lineWidth: 1,
  dashPattern: [],
  opacity: 1,
  showLabels: true,
  showGrid: true,
  fillColor: '#2962FF',
  fillOpacity: 0.04,
  angleColors: {
    '1x1': '#2962FF',
    '1x2': '#E91E63',
    '2x1': '#00BCD4',
    '1x3': '#FF9800',
    '3x1': '#4CAF50',
    '1x4': '#9C27B0',
    '4x1': '#CDDC39',
    '1x8': '#795548',
    '8x1': '#607D8B',
  },
  levels: [0, 0.25, 0.333, 0.5, 0.667, 0.75, 1],
};

export function generateId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
