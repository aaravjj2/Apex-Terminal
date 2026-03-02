/**
 * useChart.ts
 * Chart management hook providing chart instance lifecycle, indicator
 * add/remove/update, drawing tools, crosshair tracking, zoom/pan control,
 * timeframe management, screenshot capture, comparison mode,
 * and overlay management.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ChartType = 'candlestick' | 'line' | 'area' | 'bar' | 'heikin_ashi' | 'renko' | 'kagi';
export type DrawingType = 'trendline' | 'horizontal' | 'vertical' | 'fibonacci' | 'channel'
  | 'rectangle' | 'ellipse' | 'pitchfork' | 'ray' | 'arrow' | 'text' | 'measure';
export type Timeframe = '1s' | '5s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export interface ChartPoint {
  time: number;
  price: number;
}

export interface ChartIndicator {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, number | string | boolean>;
  visible: boolean;
  overlay: boolean;
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  panelIndex: number;
}

export interface ChartDrawing {
  id: string;
  type: DrawingType;
  points: ChartPoint[];
  color: string;
  lineWidth: number;
  style: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  locked: boolean;
  visible: boolean;
  interactive: boolean;
  data?: Record<string, any>;
}

export interface CrosshairData {
  time: number;
  price: number;
  x: number;
  y: number;
  ohlcv?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

export interface ChartViewport {
  timeStart: number;
  timeEnd: number;
  priceHigh: number;
  priceLow: number;
  barCount: number;
  barWidth: number;
}

export interface ChartOverlay {
  id: string;
  symbol: string;
  color: string;
  visible: boolean;
  priceScale: 'same' | 'percent' | 'separate';
  data: Array<{ time: number; value: number }>;
}

export interface ChartConfig {
  type: ChartType;
  timeframe: Timeframe;
  symbol: string;
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  showWatermark: boolean;
  showLegend: boolean;
  autoScale: boolean;
  logScale: boolean;
  extendedHours: boolean;
  theme: 'dark' | 'light';
  colors: {
    up: string;
    down: string;
    background: string;
    grid: string;
    crosshair: string;
    text: string;
    volume: string;
  };
}

export interface ChartState {
  config: ChartConfig;
  viewport: ChartViewport;
  indicators: ChartIndicator[];
  drawings: ChartDrawing[];
  overlays: ChartOverlay[];
  crosshair: CrosshairData | null;
  selectedDrawingId: string | null;
  activeDrawingTool: DrawingType | null;
  isDrawing: boolean;
  zoomLevel: number;
  panOffset: number;
}

export interface UseChartOptions {
  initialSymbol?: string;
  initialTimeframe?: Timeframe;
  initialChartType?: ChartType;
  onCrosshairMove?: (data: CrosshairData | null) => void;
  onTimeframeChange?: (tf: Timeframe) => void;
  onSymbolChange?: (symbol: string) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

// ─── Default Config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ChartConfig = {
  type: 'candlestick',
  timeframe: '1D',
  symbol: 'AAPL',
  showVolume: true,
  showGrid: true,
  showCrosshair: true,
  showWatermark: true,
  showLegend: true,
  autoScale: true,
  logScale: false,
  extendedHours: false,
  theme: 'dark',
  colors: {
    up: '#00C087',
    down: '#FF4976',
    background: '#0a0a0f',
    grid: '#1a1a2e',
    crosshair: '#666',
    text: '#9ca3af',
    volume: '#334155',
  },
};

const DEFAULT_VIEWPORT: ChartViewport = {
  timeStart: Date.now() - 90 * 86400000,
  timeEnd: Date.now(),
  priceHigh: 200,
  priceLow: 100,
  barCount: 200,
  barWidth: 8,
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useChart(options: UseChartOptions = {}) {
  const {
    initialSymbol = 'AAPL',
    initialTimeframe = '1D',
    initialChartType = 'candlestick',
    onCrosshairMove,
    onTimeframeChange,
    onSymbolChange,
    canvasRef,
  } = options;

  const [state, setState] = useState<ChartState>({
    config: { ...DEFAULT_CONFIG, symbol: initialSymbol, timeframe: initialTimeframe, type: initialChartType },
    viewport: DEFAULT_VIEWPORT,
    indicators: [],
    drawings: [],
    overlays: [],
    crosshair: null,
    selectedDrawingId: null,
    activeDrawingTool: null,
    isDrawing: false,
    zoomLevel: 1,
    panOffset: 0,
  });

  const drawingPointsRef = useRef<ChartPoint[]>([]);
  const indicatorIdCounter = useRef(0);
  const drawingIdCounter = useRef(0);

  // ── Config ──

  const setChartType = useCallback((type: ChartType) => {
    setState(prev => ({ ...prev, config: { ...prev.config, type } }));
  }, []);

  const setTimeframe = useCallback((timeframe: Timeframe) => {
    setState(prev => ({ ...prev, config: { ...prev.config, timeframe } }));
    onTimeframeChange?.(timeframe);
  }, [onTimeframeChange]);

  const setSymbol = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, config: { ...prev.config, symbol } }));
    onSymbolChange?.(symbol);
  }, [onSymbolChange]);

  const updateConfig = useCallback((updates: Partial<ChartConfig>) => {
    setState(prev => ({ ...prev, config: { ...prev.config, ...updates } }));
  }, []);

  // ── Indicators ──

  const addIndicator = useCallback((
    type: string,
    parameters: Record<string, number | string | boolean> = {},
    indicatorOptions: Partial<ChartIndicator> = {}
  ): string => {
    const id = `ind-${++indicatorIdCounter.current}-${Date.now().toString(36)}`;
    const indicator: ChartIndicator = {
      id, type, name: indicatorOptions.name ?? type.toUpperCase(),
      parameters, visible: true,
      overlay: indicatorOptions.overlay ?? ['sma', 'ema', 'bollinger', 'vwap', 'ichimoku'].includes(type),
      color: indicatorOptions.color,
      lineWidth: indicatorOptions.lineWidth ?? 1,
      style: indicatorOptions.style ?? 'solid',
      panelIndex: indicatorOptions.panelIndex ?? (indicatorOptions.overlay === false ? -1 : 0),
    };

    setState(prev => {
      let panelIdx = indicator.panelIndex;
      if (panelIdx === -1) {
        const maxPanel = prev.indicators.reduce((m, i) => Math.max(m, i.panelIndex), 0);
        panelIdx = maxPanel + 1;
      }
      return { ...prev, indicators: [...prev.indicators, { ...indicator, panelIndex: panelIdx }] };
    });
    return id;
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setState(prev => ({ ...prev, indicators: prev.indicators.filter(i => i.id !== id) }));
  }, []);

  const updateIndicator = useCallback((id: string, updates: Partial<ChartIndicator>) => {
    setState(prev => ({
      ...prev,
      indicators: prev.indicators.map(i => i.id === id ? { ...i, ...updates } : i),
    }));
  }, []);

  const toggleIndicatorVisibility = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      indicators: prev.indicators.map(i => i.id === id ? { ...i, visible: !i.visible } : i),
    }));
  }, []);

  const clearIndicators = useCallback(() => {
    setState(prev => ({ ...prev, indicators: [] }));
  }, []);

  // ── Drawings ──

  const startDrawing = useCallback((type: DrawingType) => {
    drawingPointsRef.current = [];
    setState(prev => ({ ...prev, activeDrawingTool: type, isDrawing: true }));
  }, []);

  const addDrawingPoint = useCallback((point: ChartPoint) => {
    drawingPointsRef.current.push(point);
    const tool = state.activeDrawingTool;
    if (!tool) return;

    const requiredPoints: Record<DrawingType, number> = {
      trendline: 2, horizontal: 1, vertical: 1, fibonacci: 2, channel: 3,
      rectangle: 2, ellipse: 2, pitchfork: 3, ray: 2, arrow: 2, text: 1, measure: 2,
    };

    if (drawingPointsRef.current.length >= requiredPoints[tool]) {
      const id = `drw-${++drawingIdCounter.current}-${Date.now().toString(36)}`;
      const drawing: ChartDrawing = {
        id, type: tool, points: [...drawingPointsRef.current],
        color: '#ffb700', lineWidth: 2, style: 'solid',
        locked: false, visible: true, interactive: true,
      };
      setState(prev => ({
        ...prev,
        drawings: [...prev.drawings, drawing],
        activeDrawingTool: null,
        isDrawing: false,
      }));
      drawingPointsRef.current = [];
    }
  }, [state.activeDrawingTool]);

  const cancelDrawing = useCallback(() => {
    drawingPointsRef.current = [];
    setState(prev => ({ ...prev, activeDrawingTool: null, isDrawing: false }));
  }, []);

  const removeDrawing = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.filter(d => d.id !== id),
      selectedDrawingId: prev.selectedDrawingId === id ? null : prev.selectedDrawingId,
    }));
  }, []);

  const updateDrawing = useCallback((id: string, updates: Partial<ChartDrawing>) => {
    setState(prev => ({
      ...prev,
      drawings: prev.drawings.map(d => d.id === id ? { ...d, ...updates } : d),
    }));
  }, []);

  const selectDrawing = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedDrawingId: id }));
  }, []);

  const clearDrawings = useCallback(() => {
    setState(prev => ({ ...prev, drawings: [], selectedDrawingId: null }));
  }, []);

  const lockDrawing = useCallback((id: string, locked: boolean) => {
    updateDrawing(id, { locked, interactive: !locked });
  }, [updateDrawing]);

  // ── Crosshair ──

  const setCrosshair = useCallback((data: CrosshairData | null) => {
    setState(prev => ({ ...prev, crosshair: data }));
    onCrosshairMove?.(data);
  }, [onCrosshairMove]);

  // ── Zoom / Pan ──

  const zoom = useCallback((delta: number, center?: number) => {
    setState(prev => {
      const newZoom = Math.max(0.1, Math.min(10, prev.zoomLevel + delta));
      const ratio = newZoom / prev.zoomLevel;
      const range = prev.viewport.timeEnd - prev.viewport.timeStart;
      const newRange = range / ratio;
      const anchorTime = center ?? (prev.viewport.timeStart + range / 2);
      const leftRatio = (anchorTime - prev.viewport.timeStart) / range;
      return {
        ...prev,
        zoomLevel: newZoom,
        viewport: {
          ...prev.viewport,
          timeStart: anchorTime - newRange * leftRatio,
          timeEnd: anchorTime + newRange * (1 - leftRatio),
          barWidth: Math.max(1, Math.min(50, prev.viewport.barWidth * ratio)),
        },
      };
    });
  }, []);

  const pan = useCallback((deltaTime: number) => {
    setState(prev => ({
      ...prev,
      panOffset: prev.panOffset + deltaTime,
      viewport: {
        ...prev.viewport,
        timeStart: prev.viewport.timeStart + deltaTime,
        timeEnd: prev.viewport.timeEnd + deltaTime,
      },
    }));
  }, []);

  const resetView = useCallback(() => {
    setState(prev => ({
      ...prev,
      zoomLevel: 1,
      panOffset: 0,
      viewport: DEFAULT_VIEWPORT,
    }));
  }, []);

  const fitToData = useCallback((data: Array<{ time: number; high: number; low: number }>) => {
    if (data.length === 0) return;
    const minTime = data[0].time;
    const maxTime = data[data.length - 1].time;
    const minPrice = Math.min(...data.map(d => d.low));
    const maxPrice = Math.max(...data.map(d => d.high));
    const padding = (maxPrice - minPrice) * 0.05;
    setState(prev => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        timeStart: minTime,
        timeEnd: maxTime,
        priceLow: minPrice - padding,
        priceHigh: maxPrice + padding,
        barCount: data.length,
      },
    }));
  }, []);

  // ── Overlays / Comparison ──

  const addOverlay = useCallback((symbol: string, color: string, priceScale: ChartOverlay['priceScale'] = 'percent') => {
    const id = `overlay-${Date.now().toString(36)}`;
    const overlay: ChartOverlay = { id, symbol, color, visible: true, priceScale, data: [] };
    setState(prev => ({ ...prev, overlays: [...prev.overlays, overlay] }));
    return id;
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setState(prev => ({ ...prev, overlays: prev.overlays.filter(o => o.id !== id) }));
  }, []);

  const updateOverlayData = useCallback((id: string, data: Array<{ time: number; value: number }>) => {
    setState(prev => ({
      ...prev,
      overlays: prev.overlays.map(o => o.id === id ? { ...o, data } : o),
    }));
  }, []);

  const clearOverlays = useCallback(() => {
    setState(prev => ({ ...prev, overlays: [] }));
  }, []);

  // ── Screenshot ──

  const takeScreenshot = useCallback(async (format: 'png' | 'jpeg' = 'png', quality = 0.92): Promise<string | null> => {
    const canvas = canvasRef?.current;
    if (!canvas) {
      const chartEl = document.querySelector('[data-chart-container]') as HTMLElement | null;
      if (!chartEl) return null;
      try {
        const { default: html2canvas } = await import('html2canvas' as any);
        const cvs = await html2canvas(chartEl);
        return cvs.toDataURL(`image/${format}`, quality);
      } catch {
        return null;
      }
    }
    return canvas.toDataURL(`image/${format}`, quality);
  }, [canvasRef]);

  const downloadScreenshot = useCallback(async (filename?: string) => {
    const dataUrl = await takeScreenshot();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename ?? `chart-${state.config.symbol}-${state.config.timeframe}-${Date.now()}.png`;
    a.click();
  }, [takeScreenshot, state.config.symbol, state.config.timeframe]);

  // ── Template Save/Load ──

  const saveTemplate = useCallback((name: string) => {
    const template = {
      name, config: state.config,
      indicators: state.indicators, drawings: state.drawings,
      savedAt: Date.now(),
    };
    try {
      const stored = JSON.parse(localStorage.getItem('apex_chart_templates') ?? '[]');
      stored.push(template);
      localStorage.setItem('apex_chart_templates', JSON.stringify(stored));
    } catch {}
    return template;
  }, [state.config, state.indicators, state.drawings]);

  const loadTemplate = useCallback((template: { config: Partial<ChartConfig>; indicators: ChartIndicator[]; drawings: ChartDrawing[] }) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...template.config },
      indicators: template.indicators,
      drawings: template.drawings,
    }));
  }, []);

  return {
    ...state,
    setChartType, setTimeframe, setSymbol, updateConfig,
    addIndicator, removeIndicator, updateIndicator, toggleIndicatorVisibility, clearIndicators,
    startDrawing, addDrawingPoint, cancelDrawing, removeDrawing, updateDrawing,
    selectDrawing, clearDrawings, lockDrawing,
    setCrosshair,
    zoom, pan, resetView, fitToData,
    addOverlay, removeOverlay, updateOverlayData, clearOverlays,
    takeScreenshot, downloadScreenshot,
    saveTemplate, loadTemplate,
  };
}

export default useChart;
