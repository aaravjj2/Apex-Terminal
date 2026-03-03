/**
 * useDrawing — React hook wiring lib/drawing → TradingUI2, MultiChartLayoutUI2
 *
 * Provides: drawing tools (trendline, horizontal/vertical lines, channels, rectangles,
 * Fibonacci retracement/extension/fan/arc, pitchfork, Gann fan, text annotations,
 * arrows, Elliott waves, XABCD patterns), tool management, persistence, snapping.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
// ── Lib stubs (self-contained mode) ──
type DrawingConfig = any;
type DrawingTool = any;
type DrawingObject = any;
type Point = any;
const DrawingEngine = class { constructor(..._a: any[]) {} } as any;
const TrendlineRenderer = class { constructor(..._a: any[]) {} } as any;
const HorizontalLineRenderer = class { constructor(..._a: any[]) {} } as any;
const VerticalLineRenderer = class { constructor(..._a: any[]) {} } as any;
const ChannelRenderer = class { constructor(..._a: any[]) {} } as any;
const RectangleRenderer = class { constructor(..._a: any[]) {} } as any;
const FibRetracementRenderer = class { constructor(..._a: any[]) {} } as any;
const FibExtensionRenderer = class { constructor(..._a: any[]) {} } as any;
const FibFanRenderer = class { constructor(..._a: any[]) {} } as any;
const FibArcRenderer = class { constructor(..._a: any[]) {} } as any;
const PitchforkRenderer = class { constructor(..._a: any[]) {} } as any;
const GannFanRenderer = class { constructor(..._a: any[]) {} } as any;
const TextRenderer = class { constructor(..._a: any[]) {} } as any;
const ArrowRenderer = class { constructor(..._a: any[]) {} } as any;
const ElliottWaveRenderer = class { constructor(..._a: any[]) {} } as any;
const XABCDRenderer = class { constructor(..._a: any[]) {} } as any;


// ── Types ────────────────────────────────────────────────────────────────────

export type ToolType =
  | 'cursor' | 'crosshair'
  | 'trendline' | 'ray' | 'extended_line' | 'trend_angle' | 'info_line'
  | 'horizontal_line' | 'horizontal_ray' | 'vertical_line'
  | 'parallel_channel' | 'regression_channel' | 'flat_top_bottom'
  | 'rectangle' | 'rotated_rectangle' | 'circle' | 'ellipse' | 'triangle' | 'arc'
  | 'fib_retracement' | 'fib_extension' | 'fib_channel' | 'fib_fan' | 'fib_arc' | 'fib_time_zone' | 'fib_spiral'
  | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff'
  | 'gann_fan' | 'gann_square' | 'gann_box'
  | 'text' | 'anchored_text' | 'note' | 'callout'
  | 'arrow_up' | 'arrow_down' | 'flag' | 'price_label'
  | 'elliott_impulse' | 'elliott_corrective' | 'elliott_triangle' | 'elliott_double' | 'elliott_triple'
  | 'xabcd_pattern' | 'abcd_pattern' | 'three_drives' | 'head_shoulders' | 'cypher_pattern'
  | 'long_position' | 'short_position' | 'forecast'
  | 'measure' | 'date_range' | 'price_range' | 'date_price_range'
  | 'brush' | 'highlighter' | 'eraser';

export type ToolCategory =
  | 'Cursor' | 'Lines' | 'Channels' | 'Shapes' | 'Fibonacci'
  | 'Pitchfork' | 'Gann' | 'Text' | 'Arrows' | 'Elliott'
  | 'Patterns' | 'Positions' | 'Measure' | 'Freehand';

export interface DrawingPoint {
  x: number;     // timestamp
  y: number;     // price
}

export interface Drawing {
  id: string;
  type: ToolType;
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  label?: string;
  data?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  zIndex: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor: string;
  fillOpacity: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  showLabels: boolean;
  showPrices: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  fibLevels?: number[];
}

export interface ToolInfo {
  type: ToolType;
  name: string;
  category: ToolCategory;
  icon: string;
  pointCount: number;    // -1 = unlimited
  shortcut?: string;
}

export interface DrawingState {
  /** All drawings */
  drawings: Drawing[];
  /** Active tool type */
  activeTool: ToolType;
  /** Currently drawing (pending points) */
  pendingPoints: DrawingPoint[];
  /** Selected drawing id */
  selectedId: string | null;
  /** Default style */
  defaultStyle: DrawingStyle;
  /** Tool catalog */
  catalog: ToolInfo[];
  /** Magnet/snap enabled */
  magnetEnabled: boolean;
  /** Show all drawings */
  showAll: boolean;
  /** Drawing mode active */
  isDrawing: boolean;
  /** Undo stack */
  undoStack: Drawing[][];
  /** Redo stack */
  redoStack: Drawing[][];
  /** Drawing count */
  drawingCount: number;
  /** Active chart id (for multi-chart) */
  activeChartId: string;
  /** Favorites */
  favoriteTools: ToolType[];
}

export interface DrawingActions {
  // ── Tool ────
  setActiveTool: (tool: ToolType) => void;
  resetTool: () => void;

  // ── Drawing ────
  addPoint: (point: DrawingPoint) => void;
  completeDrawing: () => void;
  cancelDrawing: () => void;
  addDrawing: (drawing: Omit<Drawing, 'id' | 'createdAt' | 'updatedAt' | 'zIndex'>) => string;

  // ── Selection ────
  selectDrawing: (id: string | null) => void;
  deleteDrawing: (id: string) => void;
  deleteSelected: () => void;
  deleteAll: () => void;

  // ── Editing ────
  updateDrawing: (id: string, patch: Partial<Drawing>) => void;
  moveDrawing: (id: string, dx: number, dy: number) => void;
  updateStyle: (id: string, style: Partial<DrawingStyle>) => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // ── Default Style ────
  setDefaultColor: (color: string) => void;
  setDefaultLineWidth: (width: number) => void;
  setDefaultLineStyle: (style: DrawingStyle['lineStyle']) => void;
  setDefaultStyle: (style: Partial<DrawingStyle>) => void;

  // ── Settings ────
  toggleMagnet: () => void;
  toggleShowAll: () => void;

  // ── Undo/Redo ────
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Persistence ────
  exportDrawings: () => string;
  importDrawings: (json: string) => void;

  // ── Favorites ────
  addFavorite: (tool: ToolType) => void;
  removeFavorite: (tool: ToolType) => void;

  // ── Multi-chart ────
  setActiveChart: (chartId: string) => void;
}

// ── Tool Catalog ─────────────────────────────────────────────────────────────

const TOOL_CATALOG: ToolInfo[] = [
  // Cursor
  { type: 'cursor', name: 'Cursor', category: 'Cursor', icon: '↖', pointCount: 0 },
  { type: 'crosshair', name: 'Crosshair', category: 'Cursor', icon: '+', pointCount: 0 },
  // Lines
  { type: 'trendline', name: 'Trend Line', category: 'Lines', icon: '╱', pointCount: 2, shortcut: 'Alt+T' },
  { type: 'ray', name: 'Ray', category: 'Lines', icon: '→', pointCount: 2 },
  { type: 'extended_line', name: 'Extended Line', category: 'Lines', icon: '↔', pointCount: 2 },
  { type: 'info_line', name: 'Info Line', category: 'Lines', icon: 'ℹ', pointCount: 2 },
  { type: 'horizontal_line', name: 'Horizontal Line', category: 'Lines', icon: '—', pointCount: 1, shortcut: 'Alt+H' },
  { type: 'horizontal_ray', name: 'Horizontal Ray', category: 'Lines', icon: '⟶', pointCount: 1 },
  { type: 'vertical_line', name: 'Vertical Line', category: 'Lines', icon: '|', pointCount: 1, shortcut: 'Alt+V' },
  // Channels
  { type: 'parallel_channel', name: 'Parallel Channel', category: 'Channels', icon: '∥', pointCount: 3 },
  { type: 'regression_channel', name: 'Regression Channel', category: 'Channels', icon: '⊞', pointCount: 2 },
  // Shapes
  { type: 'rectangle', name: 'Rectangle', category: 'Shapes', icon: '□', pointCount: 2 },
  { type: 'circle', name: 'Circle', category: 'Shapes', icon: '○', pointCount: 2 },
  { type: 'ellipse', name: 'Ellipse', category: 'Shapes', icon: '⬭', pointCount: 2 },
  { type: 'triangle', name: 'Triangle', category: 'Shapes', icon: '△', pointCount: 3 },
  // Fibonacci
  { type: 'fib_retracement', name: 'Fib Retracement', category: 'Fibonacci', icon: 'F', pointCount: 2, shortcut: 'Alt+F' },
  { type: 'fib_extension', name: 'Fib Extension', category: 'Fibonacci', icon: 'FE', pointCount: 3 },
  { type: 'fib_channel', name: 'Fib Channel', category: 'Fibonacci', icon: 'FC', pointCount: 3 },
  { type: 'fib_fan', name: 'Fib Fan', category: 'Fibonacci', icon: 'FF', pointCount: 2 },
  { type: 'fib_arc', name: 'Fib Arc', category: 'Fibonacci', icon: 'FA', pointCount: 2 },
  { type: 'fib_time_zone', name: 'Fib Time Zone', category: 'Fibonacci', icon: 'FT', pointCount: 2 },
  // Pitchfork
  { type: 'pitchfork', name: 'Pitchfork', category: 'Pitchfork', icon: '⑂', pointCount: 3 },
  { type: 'schiff_pitchfork', name: 'Schiff Pitchfork', category: 'Pitchfork', icon: '⑂S', pointCount: 3 },
  // Gann
  { type: 'gann_fan', name: 'Gann Fan', category: 'Gann', icon: 'G', pointCount: 2 },
  { type: 'gann_square', name: 'Gann Square', category: 'Gann', icon: 'GS', pointCount: 2 },
  { type: 'gann_box', name: 'Gann Box', category: 'Gann', icon: 'GB', pointCount: 2 },
  // Text
  { type: 'text', name: 'Text', category: 'Text', icon: 'T', pointCount: 1 },
  { type: 'anchored_text', name: 'Anchored Text', category: 'Text', icon: '⚓T', pointCount: 1 },
  { type: 'note', name: 'Note', category: 'Text', icon: '📝', pointCount: 1 },
  { type: 'callout', name: 'Callout', category: 'Text', icon: '💬', pointCount: 2 },
  // Arrows
  { type: 'arrow_up', name: 'Arrow Up', category: 'Arrows', icon: '↑', pointCount: 1 },
  { type: 'arrow_down', name: 'Arrow Down', category: 'Arrows', icon: '↓', pointCount: 1 },
  { type: 'flag', name: 'Flag', category: 'Arrows', icon: '🚩', pointCount: 1 },
  { type: 'price_label', name: 'Price Label', category: 'Arrows', icon: '$', pointCount: 1 },
  // Elliott
  { type: 'elliott_impulse', name: 'Elliott Impulse (12345)', category: 'Elliott', icon: 'E5', pointCount: 6 },
  { type: 'elliott_corrective', name: 'Elliott Corrective (ABC)', category: 'Elliott', icon: 'ABC', pointCount: 4 },
  { type: 'elliott_triangle', name: 'Elliott Triangle', category: 'Elliott', icon: 'ET', pointCount: 6 },
  // Patterns
  { type: 'xabcd_pattern', name: 'XABCD Pattern', category: 'Patterns', icon: 'X', pointCount: 5 },
  { type: 'abcd_pattern', name: 'ABCD Pattern', category: 'Patterns', icon: 'ABCD', pointCount: 4 },
  { type: 'head_shoulders', name: 'Head & Shoulders', category: 'Patterns', icon: 'H&S', pointCount: 7 },
  // Positions
  { type: 'long_position', name: 'Long Position', category: 'Positions', icon: '📈', pointCount: 1 },
  { type: 'short_position', name: 'Short Position', category: 'Positions', icon: '📉', pointCount: 1 },
  { type: 'forecast', name: 'Forecast', category: 'Positions', icon: '🔮', pointCount: 2 },
  // Measure
  { type: 'measure', name: 'Measure', category: 'Measure', icon: '📏', pointCount: 2 },
  { type: 'date_range', name: 'Date Range', category: 'Measure', icon: '📅', pointCount: 2 },
  { type: 'price_range', name: 'Price Range', category: 'Measure', icon: '💰', pointCount: 2 },
  // Freehand
  { type: 'brush', name: 'Brush', category: 'Freehand', icon: '🖌', pointCount: -1 },
  { type: 'highlighter', name: 'Highlighter', category: 'Freehand', icon: '🖍', pointCount: -1 },
  { type: 'eraser', name: 'Eraser', category: 'Freehand', icon: '🧹', pointCount: -1 },
];

const DEFAULT_STYLE: DrawingStyle = {
  color: '#2962FF',
  lineWidth: 1,
  lineStyle: 'solid',
  fillColor: '#2962FF',
  fillOpacity: 0.1,
  fontSize: 12,
  fontFamily: 'Inter',
  textColor: '#D1D4DC',
  showLabels: true,
  showPrices: true,
  extendLeft: false,
  extendRight: false,
  fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
};

let drawingCounter = 0;
function genDrawingId() { return `draw_${++drawingCounter}_${Date.now().toString(36)}`; }

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: DrawingState = {
  drawings: [],
  activeTool: 'cursor',
  pendingPoints: [],
  selectedId: null,
  defaultStyle: DEFAULT_STYLE,
  catalog: TOOL_CATALOG,
  magnetEnabled: true,
  showAll: true,
  isDrawing: false,
  undoStack: [],
  redoStack: [],
  drawingCount: 0,
  activeChartId: 'main',
  favoriteTools: ['trendline', 'horizontal_line', 'fib_retracement', 'rectangle', 'text'],
};

export function useDrawing(): [DrawingState, DrawingActions] {
  const [state, setState] = useState<DrawingState>(INITIAL_STATE);

  const saveUndo = useCallback(() => {
    setState(prev => ({
      ...prev,
      undoStack: [...prev.undoStack.slice(-50), prev.drawings],
      redoStack: [],
    }));
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    setState(prev => ({ ...prev, activeTool: tool, pendingPoints: [], isDrawing: tool !== 'cursor' && tool !== 'crosshair' }));
  }, []);

  const resetTool = useCallback(() => {
    setState(prev => ({ ...prev, activeTool: 'cursor', pendingPoints: [], isDrawing: false }));
  }, []);

  const addPoint = useCallback((point: DrawingPoint) => {
    setState(prev => {
      const toolInfo = TOOL_CATALOG.find(t => t.type === prev.activeTool);
      if (!toolInfo || toolInfo.pointCount === 0) return prev;

      const newPoints = [...prev.pendingPoints, point];

      // If we have enough points, auto-complete
      if (toolInfo.pointCount > 0 && newPoints.length >= toolInfo.pointCount) {
        const id = genDrawingId();
        const drawing: Drawing = {
          id,
          type: prev.activeTool,
          points: newPoints,
          style: { ...prev.defaultStyle },
          visible: true,
          locked: false,
          selected: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: prev.drawingCount + 1,
        };
        return {
          ...prev,
          drawings: [...prev.drawings, drawing],
          pendingPoints: [],
          drawingCount: prev.drawingCount + 1,
          undoStack: [...prev.undoStack.slice(-50), prev.drawings],
          redoStack: [],
        };
      }

      return { ...prev, pendingPoints: newPoints };
    });
  }, []);

  const completeDrawing = useCallback(() => {
    setState(prev => {
      if (prev.pendingPoints.length < 2) return { ...prev, pendingPoints: [] };
      const id = genDrawingId();
      const drawing: Drawing = {
        id,
        type: prev.activeTool,
        points: prev.pendingPoints,
        style: { ...prev.defaultStyle },
        visible: true,
        locked: false,
        selected: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        zIndex: prev.drawingCount + 1,
      };
      return {
        ...prev,
        drawings: [...prev.drawings, drawing],
        pendingPoints: [],
        drawingCount: prev.drawingCount + 1,
        undoStack: [...prev.undoStack.slice(-50), prev.drawings],
        redoStack: [],
      };
    });
  }, []);

  const cancelDrawing = useCallback(() => {
    setState(prev => ({ ...prev, pendingPoints: [] }));
  }, []);

  const addDrawing = useCallback((drawing: Omit<Drawing, 'id' | 'createdAt' | 'updatedAt' | 'zIndex'>): string => {
    const id = genDrawingId();
    setState(prev => {
      const newDrawing: Drawing = {
        ...drawing,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        zIndex: prev.drawingCount + 1,
      };
      return {
        ...prev,
        drawings: [...prev.drawings, newDrawing],
        drawingCount: prev.drawingCount + 1,
        undoStack: [...prev.undoStack.slice(-50), prev.drawings],
        redoStack: [],
      };
    });
    return id;
  }, []);

  const selectDrawing = useCallback((id: string | null) => {
    setState(prev => ({
      ...prev,
      selectedId: id,
      drawings: prev.drawings.map(d => ({ ...d, selected: d.id === id })),
    }));
  }, []);

  const deleteDrawing = useCallback((id: string) => {
    saveUndo();
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.filter(d => d.id !== id),
      selectedId: prev.selectedId === id ? null : prev.selectedId,
    }));
  }, [saveUndo]);

  const deleteSelected = useCallback(() => {
    if (state.selectedId) deleteDrawing(state.selectedId);
  }, [state.selectedId, deleteDrawing]);

  const deleteAll = useCallback(() => {
    saveUndo();
    setState(prev => ({ ...prev, drawings: [], selectedId: null, drawingCount: 0 }));
  }, [saveUndo]);

  const updateDrawing = useCallback((id: string, patch: Partial<Drawing>) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d => d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d),
    }));
  }, []);

  const moveDrawing = useCallback((id: string, dx: number, dy: number) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d =>
        d.id === id
          ? { ...d, points: d.points.map(p => ({ x: p.x + dx, y: p.y + dy })), updatedAt: Date.now() }
          : d
      ),
    }));
  }, []);

  const updateStyle = useCallback((id: string, style: Partial<DrawingStyle>) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d => d.id === id ? { ...d, style: { ...d.style, ...style }, updatedAt: Date.now() } : d),
    }));
  }, []);

  const toggleLock = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d => d.id === id ? { ...d, locked: !d.locked } : d),
    }));
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d => d.id === id ? { ...d, visible: !d.visible } : d),
    }));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setState(prev => {
      const maxZ = Math.max(...prev.drawings.map(d => d.zIndex), 0);
      return { ...prev, drawings: prev.drawings.map(d => d.id === id ? { ...d, zIndex: maxZ + 1 } : d) };
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setState(prev => {
      const minZ = Math.min(...prev.drawings.map(d => d.zIndex), 0);
      return { ...prev, drawings: prev.drawings.map(d => d.id === id ? { ...d, zIndex: minZ - 1 } : d) };
    });
  }, []);

  const setDefaultColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, defaultStyle: { ...prev.defaultStyle, color } }));
  }, []);

  const setDefaultLineWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, defaultStyle: { ...prev.defaultStyle, lineWidth: width } }));
  }, []);

  const setDefaultLineStyle = useCallback((style: DrawingStyle['lineStyle']) => {
    setState(prev => ({ ...prev, defaultStyle: { ...prev.defaultStyle, lineStyle: style } }));
  }, []);

  const setDefaultStyleAction = useCallback((style: Partial<DrawingStyle>) => {
    setState(prev => ({ ...prev, defaultStyle: { ...prev.defaultStyle, ...style } }));
  }, []);

  const toggleMagnet = useCallback(() => {
    setState(prev => ({ ...prev, magnetEnabled: !prev.magnetEnabled }));
  }, []);

  const toggleShowAll = useCallback(() => {
    setState(prev => ({ ...prev, showAll: !prev.showAll }));
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.undoStack.length === 0) return prev;
      const newStack = [...prev.undoStack];
      const drawings = newStack.pop()!;
      return {
        ...prev,
        drawings,
        undoStack: newStack,
        redoStack: [...prev.redoStack, prev.drawings],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.redoStack.length === 0) return prev;
      const newStack = [...prev.redoStack];
      const drawings = newStack.pop()!;
      return {
        ...prev,
        drawings,
        redoStack: newStack,
        undoStack: [...prev.undoStack, prev.drawings],
      };
    });
  }, []);

  const canUndo = useCallback(() => state.undoStack.length > 0, [state.undoStack]);
  const canRedo = useCallback(() => state.redoStack.length > 0, [state.redoStack]);

  const exportDrawings = useCallback(() => JSON.stringify(state.drawings, null, 2), [state.drawings]);
  const importDrawings = useCallback((json: string) => {
    try {
      const drawings = JSON.parse(json);
      if (Array.isArray(drawings)) {
        saveUndo();
        setState(prev => ({ ...prev, drawings, drawingCount: drawings.length }));
      }
    } catch { /* import failed */ }
  }, [saveUndo]);

  const addFavorite = useCallback((tool: ToolType) => {
    setState(prev => prev.favoriteTools.includes(tool) ? prev : { ...prev, favoriteTools: [...prev.favoriteTools, tool] });
  }, []);

  const removeFavorite = useCallback((tool: ToolType) => {
    setState(prev => ({ ...prev, favoriteTools: prev.favoriteTools.filter(t => t !== tool) }));
  }, []);

  const setActiveChart = useCallback((chartId: string) => {
    setState(prev => ({ ...prev, activeChartId: chartId }));
  }, []);

  const actions: DrawingActions = useMemo(() => ({
    setActiveTool, resetTool,
    addPoint, completeDrawing, cancelDrawing, addDrawing,
    selectDrawing, deleteDrawing, deleteSelected, deleteAll,
    updateDrawing, moveDrawing, updateStyle, toggleLock, toggleVisibility,
    bringToFront, sendToBack,
    setDefaultColor, setDefaultLineWidth, setDefaultLineStyle, setDefaultStyle: setDefaultStyleAction,
    toggleMagnet, toggleShowAll,
    undo, redo, canUndo, canRedo,
    exportDrawings, importDrawings,
    addFavorite, removeFavorite,
    setActiveChart,
  }), [
    setActiveTool, resetTool,
    addPoint, completeDrawing, cancelDrawing, addDrawing,
    selectDrawing, deleteDrawing, deleteSelected, deleteAll,
    updateDrawing, moveDrawing, updateStyle, toggleLock, toggleVisibility,
    bringToFront, sendToBack,
    setDefaultColor, setDefaultLineWidth, setDefaultLineStyle, setDefaultStyleAction,
    toggleMagnet, toggleShowAll,
    undo, redo, canUndo, canRedo,
    exportDrawings, importDrawings,
    addFavorite, removeFavorite,
    setActiveChart,
  ]);

  return [state, actions];
}
