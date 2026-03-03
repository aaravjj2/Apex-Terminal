/**
 * useChartTypes — React hook wiring lib/chartTypes → MultiChartLayoutUI2, TradingUI2
 *
 * Provides: alternative chart types (Renko, Point & Figure, Kagi, Heikin-Ashi,
 * Line Break, Range, Tick, Footprint, Market Profile, Equivolume, Baseline),
 * chart type management and configuration.
 */
import { useState, useCallback, useMemo } from 'react';
// ── Lib stubs (self-contained mode) ──
type RenkoBrick = any;
type PnFColumn = any;
type KagiLine = any;
type HABar = any;
type LineBreakBar = any;
type RangeBar = any;
type TickBar = any;
type FootprintBar = any;
type ProfilePeriod = any;
type EquiBar = any;
type BaselineBar = any;
type ChartConfig = any;
const renkoChart = (..._a: any[]): any => ({});
const pointAndFigure = (..._a: any[]): any => ({});
const kagiChart = (..._a: any[]): any => ({});
const heikinAshi = (..._a: any[]): any => ({});
const lineBreak = (..._a: any[]): any => ({});
const rangeChart = (..._a: any[]): any => ({});
const tickChart = (..._a: any[]): any => ({});
const footprintChart = (..._a: any[]): any => ({});
const marketProfile = (..._a: any[]): any => ({});
const equivolumeChart = (..._a: any[]): any => ({});
const baselineChart = (..._a: any[]): any => ({});


// ── Types ────────────────────────────────────────────────────────────────────

export type ChartType =
  | 'candlestick' | 'ohlc' | 'line' | 'area' | 'baseline'
  | 'heikin_ashi' | 'renko' | 'point_and_figure' | 'kagi'
  | 'line_break' | 'range' | 'tick'
  | 'footprint' | 'market_profile' | 'equivolume'
  | 'hollow_candle' | 'colored_bar';

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartTypeConfig {
  // Renko
  renkoBrickSize?: number;
  renkoATRPeriod?: number;
  renkoUseATR?: boolean;
  // Point & Figure
  pnfBoxSize?: number;
  pnfReversalCount?: number;
  pnfMethod?: 'close' | 'highlow';
  // Kagi
  kagiReversalPct?: number;
  kagiReversalATR?: number;
  kagiUseATR?: boolean;
  // Line Break
  lineBreakCount?: number;
  // Range
  rangeSize?: number;
  // Tick
  tickCount?: number;
  // Footprint
  footprintTickSize?: number;
  footprintLevels?: number;
  // Market Profile
  profileTickSize?: number;
  profilePeriod?: 'session' | 'daily' | 'weekly';
  // Baseline
  baselineValue?: number;
  // Heikin-Ashi
  haSmoothed?: boolean;
}

export interface ChartTypeInfo {
  type: ChartType;
  name: string;
  description: string;
  category: 'Standard' | 'Japanese' | 'Point-based' | 'Volume-based' | 'Other';
  hasTimeAxis: boolean;           // false for renko, P&F, kagi
  requiresVolume: boolean;        // true for footprint, equivolume
  configKeys: string[];           // which ChartTypeConfig keys apply
}

export interface ComputedChartData {
  type: ChartType;
  standard?: OHLCV[];
  renko?: RenkoBrick[];
  pnf?: PnFColumn[];
  kagi?: KagiLine[];
  heikinAshi?: HABar[];
  lineBreak?: LineBreakBar[];
  range?: RangeBar[];
  tick?: TickBar[];
  footprint?: FootprintBar[];
  profile?: ProfilePeriod[];
  equivolume?: EquiBar[];
  baseline?: BaselineBar[];
}

export interface ChartTypesState {
  /** Active chart type */
  activeType: ChartType;
  /** Configuration */
  config: ChartTypeConfig;
  /** Computed data for current type */
  data: ComputedChartData | null;
  /** Available chart types catalog */
  catalog: ChartTypeInfo[];
  /** Input bars */
  inputBars: OHLCV[];
  /** Bar count */
  barCount: number;
  /** Is computing */
  isComputing: boolean;
  /** Recent chart types */
  recentTypes: ChartType[];
  /** Favorites */
  favoriteTypes: ChartType[];
}

export interface ChartTypesActions {
  /** Set active chart type */
  setChartType: (type: ChartType) => void;
  /** Update configuration */
  setConfig: (config: Partial<ChartTypeConfig>) => void;
  /** Load input bars */
  loadBars: (bars: OHLCV[]) => void;
  /** Re-compute with current settings */
  recompute: () => void;
  /** Get catalog */
  getCatalog: () => ChartTypeInfo[];
  /** Toggle favorite */
  toggleFavorite: (type: ChartType) => void;
  /** Generate mock bars */
  generateMockBars: (count?: number) => void;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

const CHART_TYPE_CATALOG: ChartTypeInfo[] = [
  { type: 'candlestick', name: 'Candlestick', description: 'Traditional Japanese candlestick chart', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'ohlc', name: 'OHLC Bars', description: 'Open-High-Low-Close bar chart', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'line', name: 'Line', description: 'Simple line chart using close prices', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'area', name: 'Area', description: 'Area chart with gradient fill', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'hollow_candle', name: 'Hollow Candles', description: 'Hollow for bullish, filled for bearish', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'colored_bar', name: 'Colored Bars', description: 'OHLC bars colored by direction', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: [] },
  { type: 'baseline', name: 'Baseline', description: 'Line chart with above/below coloring relative to a baseline', category: 'Standard', hasTimeAxis: true, requiresVolume: false, configKeys: ['baselineValue'] },
  { type: 'heikin_ashi', name: 'Heikin-Ashi', description: 'Smoothed Japanese candlestick technique', category: 'Japanese', hasTimeAxis: true, requiresVolume: false, configKeys: ['haSmoothed'] },
  { type: 'renko', name: 'Renko', description: 'Brick chart based on price movement only (no time)', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['renkoBrickSize', 'renkoATRPeriod', 'renkoUseATR'] },
  { type: 'point_and_figure', name: 'Point & Figure', description: 'X and O columns showing price movements', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['pnfBoxSize', 'pnfReversalCount', 'pnfMethod'] },
  { type: 'kagi', name: 'Kagi', description: 'Japanese chart showing supply/demand shifts', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['kagiReversalPct', 'kagiReversalATR', 'kagiUseATR'] },
  { type: 'line_break', name: 'Line Break', description: 'N-line break chart showing trend reversals', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['lineBreakCount'] },
  { type: 'range', name: 'Range Bars', description: 'Bars with fixed price range (no time)', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['rangeSize'] },
  { type: 'tick', name: 'Tick Chart', description: 'Bars formed after N trades', category: 'Point-based', hasTimeAxis: false, requiresVolume: false, configKeys: ['tickCount'] },
  { type: 'footprint', name: 'Footprint', description: 'Volume profile within each bar', category: 'Volume-based', hasTimeAxis: true, requiresVolume: true, configKeys: ['footprintTickSize', 'footprintLevels'] },
  { type: 'market_profile', name: 'Market Profile', description: 'TPO (Time-Price Opportunity) chart', category: 'Volume-based', hasTimeAxis: true, requiresVolume: true, configKeys: ['profileTickSize', 'profilePeriod'] },
  { type: 'equivolume', name: 'Equivolume', description: 'Bar width proportional to volume', category: 'Volume-based', hasTimeAxis: true, requiresVolume: true, configKeys: [] },
];

const DEFAULT_CONFIG: ChartTypeConfig = {
  renkoBrickSize: 1,
  renkoATRPeriod: 14,
  renkoUseATR: false,
  pnfBoxSize: 1,
  pnfReversalCount: 3,
  pnfMethod: 'close',
  kagiReversalPct: 4,
  kagiUseATR: false,
  lineBreakCount: 3,
  rangeSize: 2,
  tickCount: 100,
  footprintTickSize: 0.5,
  footprintLevels: 20,
  profileTickSize: 0.5,
  profilePeriod: 'session',
  baselineValue: 0,
  haSmoothed: false,
};

// ── Compute functions ────────────────────────────────────────────────────────

function computeChartData(type: ChartType, bars: OHLCV[], config: ChartTypeConfig): ComputedChartData {
  const data: ComputedChartData = { type };

  try {
    switch (type) {
      case 'candlestick':
      case 'ohlc':
      case 'line':
      case 'area':
      case 'hollow_candle':
      case 'colored_bar':
        data.standard = bars;
        break;

      case 'heikin_ashi':
        data.heikinAshi = heikinAshi(bars, config.haSmoothed);
        break;

      case 'renko': {
        const brickSize = config.renkoUseATR
          ? computeATRBrickSize(bars, config.renkoATRPeriod || 14)
          : config.renkoBrickSize || 1;
        data.renko = renkoChart(bars, brickSize);
        break;
      }

      case 'point_and_figure':
        data.pnf = pointAndFigure(bars, config.pnfBoxSize || 1, config.pnfReversalCount || 3, config.pnfMethod || 'close');
        break;

      case 'kagi': {
        const reversal = config.kagiUseATR
          ? computeATRBrickSize(bars, 14) * 2
          : config.kagiReversalPct || 4;
        data.kagi = kagiChart(bars, reversal);
        break;
      }

      case 'line_break':
        data.lineBreak = lineBreak(bars, config.lineBreakCount || 3);
        break;

      case 'range':
        data.range = rangeChart(bars, config.rangeSize || 2);
        break;

      case 'tick':
        data.tick = tickChart(bars, config.tickCount || 100);
        break;

      case 'footprint':
        data.footprint = footprintChart(bars, config.footprintTickSize || 0.5, config.footprintLevels || 20);
        break;

      case 'market_profile':
        data.profile = marketProfile(bars, config.profileTickSize || 0.5, config.profilePeriod || 'session');
        break;

      case 'equivolume':
        data.equivolume = equivolumeChart(bars);
        break;

      case 'baseline':
        data.baseline = baselineChart(bars, config.baselineValue || (bars.length > 0 ? bars[0].close : 0));
        break;
    }
  } catch {
    // Fallback to standard
    data.standard = bars;
  }

  return data;
}

function computeATRBrickSize(bars: OHLCV[], period: number): number {
  if (bars.length < period + 1) return 1;
  let atrSum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    );
    atrSum += tr;
  }
  return +(atrSum / period).toFixed(4);
}

function generateMock(count: number): OHLCV[] {
  const now = Date.now();
  let price = 150;
  const bars: OHLCV[] = [];
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 3;
    const open = price;
    const close = +(open + change).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * 1.5).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * 1.5).toFixed(2);
    bars.push({
      timestamp: now - (count - i) * 86400000,
      open, high, low, close,
      volume: Math.floor(500000 + Math.random() * 3000000),
    });
    price = close;
  }
  return bars;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: ChartTypesState = {
  activeType: 'candlestick',
  config: DEFAULT_CONFIG,
  data: null,
  catalog: CHART_TYPE_CATALOG,
  inputBars: [],
  barCount: 0,
  isComputing: false,
  recentTypes: ['candlestick'],
  favoriteTypes: ['candlestick', 'heikin_ashi', 'renko'],
};

export function useChartTypes(): [ChartTypesState, ChartTypesActions] {
  const [state, setState] = useState<ChartTypesState>(INITIAL_STATE);

  const setChartType = useCallback((type: ChartType) => {
    setState(prev => {
      const data = prev.inputBars.length > 0 ? computeChartData(type, prev.inputBars, prev.config) : null;
      const recent = [type, ...prev.recentTypes.filter(t => t !== type)].slice(0, 5);
      return { ...prev, activeType: type, data, recentTypes: recent };
    });
  }, []);

  const setConfig = useCallback((config: Partial<ChartTypeConfig>) => {
    setState(prev => {
      const merged = { ...prev.config, ...config };
      const data = prev.inputBars.length > 0 ? computeChartData(prev.activeType, prev.inputBars, merged) : prev.data;
      return { ...prev, config: merged, data };
    });
  }, []);

  const loadBars = useCallback((bars: OHLCV[]) => {
    setState(prev => {
      const data = computeChartData(prev.activeType, bars, prev.config);
      return { ...prev, inputBars: bars, barCount: bars.length, data };
    });
  }, []);

  const recompute = useCallback(() => {
    setState(prev => {
      const data = prev.inputBars.length > 0 ? computeChartData(prev.activeType, prev.inputBars, prev.config) : prev.data;
      return { ...prev, data };
    });
  }, []);

  const getCatalog = useCallback(() => CHART_TYPE_CATALOG, []);

  const toggleFavorite = useCallback((type: ChartType) => {
    setState(prev => ({
      ...prev,
      favoriteTypes: prev.favoriteTypes.includes(type)
        ? prev.favoriteTypes.filter(t => t !== type)
        : [...prev.favoriteTypes, type],
    }));
  }, []);

  const generateMockBars = useCallback((count = 300) => {
    const bars = generateMock(count);
    setState(prev => {
      const data = computeChartData(prev.activeType, bars, prev.config);
      return { ...prev, inputBars: bars, barCount: bars.length, data };
    });
  }, []);

  const actions: ChartTypesActions = useMemo(() => ({
    setChartType, setConfig, loadBars, recompute, getCatalog, toggleFavorite, generateMockBars,
  }), [setChartType, setConfig, loadBars, recompute, getCatalog, toggleFavorite, generateMockBars]);

  return [state, actions];
}
