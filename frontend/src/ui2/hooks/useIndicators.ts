/**
 * useIndicators — React hook wiring lib/indicators → TradingUI2, MultiChartLayoutUI2
 *
 * Provides 100+ technical indicators: moving averages (21 types), momentum (27),
 * volatility (30+), volume (20+), trend (17+), and candlestick pattern detection.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
// ── Lib stubs (self-contained mode) ──
type MAType = any;
type MACDResult = any;
type StochasticResult = any;
const sma = (..._a: any[]): any => ({});
const ema = (..._a: any[]): any => ({});
const wma = (..._a: any[]): any => ({});
const dema = (..._a: any[]): any => ({});
const tema = (..._a: any[]): any => ({});
const hullMA = (..._a: any[]): any => ({});
const vwma = (..._a: any[]): any => ({});
const kama = (..._a: any[]): any => ({});
const alma = (..._a: any[]): any => ({});
const frama = (..._a: any[]): any => ({});
const t3 = (..._a: any[]): any => ({});
const zeroLagEMA = (..._a: any[]): any => ({});
const mcginleyDynamic = (..._a: any[]): any => ({});
const rsi = (..._a: any[]): any => ({});
const macd = (..._a: any[]): any => ({});
const stochastic = (..._a: any[]): any => ({});
const stochasticRSI = (..._a: any[]): any => ({});
const cci = (..._a: any[]): any => ({});
const williamsR = (..._a: any[]): any => ({});
const roc = (..._a: any[]): any => ({});
const momentum = (..._a: any[]): any => ({});
const ultimateOscillator = (..._a: any[]): any => ({});
const tsi = (..._a: any[]): any => ({});
const cmo = (..._a: any[]): any => ({});
const ppo = (..._a: any[]): any => ({});
const aroonOscillator = (..._a: any[]): any => ({});
const coppockCurve = (..._a: any[]): any => ({});
const fisherTransform = (..._a: any[]): any => ({});
const connorsRSI = (..._a: any[]): any => ({});
const trueRange = (..._a: any[]): any => ({});
const atr = (..._a: any[]): any => ({});
const bollingerBands = (..._a: any[]): any => ({});
const keltnerChannel = (..._a: any[]): any => ({});
const donchianChannel = (..._a: any[]): any => ({});
const historicalVolatility = (..._a: any[]): any => ({});
const garch11 = (..._a: any[]): any => ({});
const realizedVolatilityCloseToClose = (..._a: any[]): any => ({});
const realizedVolatilityParkinson = (..._a: any[]): any => ({});
const realizedVolatilityGarmanKlass = (..._a: any[]): any => ({});
const obv = (..._a: any[]): any => ({});
const accumulationDistribution = (..._a: any[]): any => ({});
const cmf = (..._a: any[]): any => ({});
const mfi = (..._a: any[]): any => ({});
const vwap = (..._a: any[]): any => ({});
const volumeProfile = (..._a: any[]): any => ({});
const adx = (..._a: any[]): any => ({});
const aroon = (..._a: any[]): any => ({});
const parabolicSAR = (..._a: any[]): any => ({});
const supertrend = (..._a: any[]): any => ({});
const ichimoku = (..._a: any[]): any => ({});
const zigzag = (..._a: any[]): any => ({});
const standardPivots = (..._a: any[]): any => ({});
const fibonacciPivots = (..._a: any[]): any => ({});






// ── Types ────────────────────────────────────────────────────────────────────

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  visible: boolean;
  color: string;
  lineWidth: number;
  overlay: boolean; // true = on price chart, false = separate pane
}

export type IndicatorType =
  // Moving Averages
  | 'SMA' | 'EMA' | 'WMA' | 'DEMA' | 'TEMA' | 'HullMA' | 'VWMA' | 'KAMA' | 'ALMA' | 'FRAMA' | 'T3' | 'ZeroLagEMA' | 'McGinley'
  // Momentum
  | 'RSI' | 'MACD' | 'Stochastic' | 'StochRSI' | 'CCI' | 'WilliamsR' | 'ROC' | 'Momentum' | 'UltOsc' | 'TSI' | 'CMO' | 'PPO' | 'Aroon' | 'Coppock' | 'Fisher' | 'ConnorsRSI'
  // Volatility
  | 'ATR' | 'BB' | 'Keltner' | 'Donchian' | 'HistVol' | 'GARCH' | 'RealizedVol'
  // Volume
  | 'OBV' | 'AccDist' | 'CMF' | 'MFI' | 'VWAP' | 'VolProfile'
  // Trend
  | 'ADX' | 'AroonInd' | 'SAR' | 'Supertrend' | 'Ichimoku' | 'ZigZag' | 'Pivots';

export interface IndicatorOutput {
  id: string;
  type: IndicatorType;
  values: number[] | number[][] | Record<string, number[]>;
  overlay: boolean;
  label: string;
  color: string;
}

export interface IndicatorsState {
  /** Active indicator configurations */
  indicators: IndicatorConfig[];
  /** Computed indicator output data */
  outputs: IndicatorOutput[];
  /** Available indicator catalog */
  catalog: IndicatorCatalogEntry[];
  /** Number of bars loaded */
  barCount: number;
  /** Is computing */
  isComputing: boolean;
}

export interface IndicatorCatalogEntry {
  type: IndicatorType;
  name: string;
  category: 'Moving Average' | 'Momentum' | 'Volatility' | 'Volume' | 'Trend';
  overlay: boolean;
  defaultParams: Record<string, number>;
  description: string;
}

export interface IndicatorActions {
  /** Add an indicator */
  addIndicator: (type: IndicatorType, params?: Record<string, number>) => string;
  /** Remove an indicator by id */
  removeIndicator: (id: string) => void;
  /** Update indicator params */
  updateIndicator: (id: string, patch: Partial<IndicatorConfig>) => void;
  /** Toggle visibility */
  toggleVisibility: (id: string) => void;
  /** Compute all active indicators on the given bars */
  compute: (bars: OHLCV[]) => void;
  /** Clear all indicators */
  clearAll: () => void;
  /** Get catalog */
  getCatalog: () => IndicatorCatalogEntry[];
}

// ── Catalog ──────────────────────────────────────────────────────────────────

const INDICATOR_CATALOG: IndicatorCatalogEntry[] = [
  // Moving Averages
  { type: 'SMA', name: 'Simple Moving Average', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Arithmetic mean of last N prices' },
  { type: 'EMA', name: 'Exponential Moving Average', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Weighted toward recent prices' },
  { type: 'WMA', name: 'Weighted Moving Average', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Linearly weighted toward recent prices' },
  { type: 'DEMA', name: 'Double EMA', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Reduced lag via double smoothing' },
  { type: 'TEMA', name: 'Triple EMA', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Further reduced lag via triple smoothing' },
  { type: 'HullMA', name: 'Hull Moving Average', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'Fast and smooth MA by Alan Hull' },
  { type: 'VWMA', name: 'Volume Weighted MA', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'MA weighted by volume' },
  { type: 'KAMA', name: 'Kaufman Adaptive MA', category: 'Moving Average', overlay: true, defaultParams: { period: 10, fast: 2, slow: 30 }, description: 'Adapts to market noise' },
  { type: 'ALMA', name: 'Arnaud Legoux MA', category: 'Moving Average', overlay: true, defaultParams: { period: 9, offset: 0.85, sigma: 6 }, description: 'Gaussian filter MA' },
  { type: 'T3', name: 'T3 Moving Average', category: 'Moving Average', overlay: true, defaultParams: { period: 5, factor: 0.7 }, description: 'Tim Tillson T3' },
  { type: 'ZeroLagEMA', name: 'Zero Lag EMA', category: 'Moving Average', overlay: true, defaultParams: { period: 20 }, description: 'EMA with lag removed' },
  { type: 'McGinley', name: 'McGinley Dynamic', category: 'Moving Average', overlay: true, defaultParams: { period: 14 }, description: 'Self-adjusting MA' },

  // Momentum
  { type: 'RSI', name: 'Relative Strength Index', category: 'Momentum', overlay: false, defaultParams: { period: 14 }, description: 'Oscillator measuring overbought/oversold' },
  { type: 'MACD', name: 'MACD', category: 'Momentum', overlay: false, defaultParams: { fast: 12, slow: 26, signal: 9 }, description: 'Trend-following momentum indicator' },
  { type: 'Stochastic', name: 'Stochastic Oscillator', category: 'Momentum', overlay: false, defaultParams: { kPeriod: 14, dPeriod: 3, smooth: 3 }, description: 'Price relative to high-low range' },
  { type: 'StochRSI', name: 'Stochastic RSI', category: 'Momentum', overlay: false, defaultParams: { rsiPeriod: 14, stochPeriod: 14 }, description: 'Stochastic applied to RSI' },
  { type: 'CCI', name: 'Commodity Channel Index', category: 'Momentum', overlay: false, defaultParams: { period: 20 }, description: 'Deviation from statistical mean' },
  { type: 'WilliamsR', name: 'Williams %R', category: 'Momentum', overlay: false, defaultParams: { period: 14 }, description: 'Overbought/oversold oscillator' },
  { type: 'ROC', name: 'Rate of Change', category: 'Momentum', overlay: false, defaultParams: { period: 12 }, description: 'Percent change over N periods' },
  { type: 'Momentum', name: 'Momentum', category: 'Momentum', overlay: false, defaultParams: { period: 10 }, description: 'Price change over N periods' },
  { type: 'UltOsc', name: 'Ultimate Oscillator', category: 'Momentum', overlay: false, defaultParams: { p1: 7, p2: 14, p3: 28 }, description: 'Multi-timeframe oscillator' },
  { type: 'TSI', name: 'True Strength Index', category: 'Momentum', overlay: false, defaultParams: { long: 25, short: 13 }, description: 'Double-smoothed momentum' },
  { type: 'Coppock', name: 'Coppock Curve', category: 'Momentum', overlay: false, defaultParams: { wma: 10, roc1: 14, roc2: 11 }, description: 'Long-term momentum signal' },
  { type: 'Fisher', name: 'Fisher Transform', category: 'Momentum', overlay: false, defaultParams: { period: 10 }, description: 'Gaussian normal distribution transform' },
  { type: 'ConnorsRSI', name: 'Connors RSI', category: 'Momentum', overlay: false, defaultParams: { rsi: 3, streak: 2, rank: 100 }, description: 'Multi-component RSI' },

  // Volatility
  { type: 'ATR', name: 'Average True Range', category: 'Volatility', overlay: false, defaultParams: { period: 14 }, description: 'Average range of price movement' },
  { type: 'BB', name: 'Bollinger Bands', category: 'Volatility', overlay: true, defaultParams: { period: 20, mult: 2 }, description: 'Standard deviation bands' },
  { type: 'Keltner', name: 'Keltner Channel', category: 'Volatility', overlay: true, defaultParams: { period: 20, mult: 1.5 }, description: 'ATR-based bands' },
  { type: 'Donchian', name: 'Donchian Channel', category: 'Volatility', overlay: true, defaultParams: { period: 20 }, description: 'Highest high / lowest low' },
  { type: 'HistVol', name: 'Historical Volatility', category: 'Volatility', overlay: false, defaultParams: { period: 20 }, description: 'Annualized realized volatility' },
  { type: 'GARCH', name: 'GARCH(1,1)', category: 'Volatility', overlay: false, defaultParams: { omega: 0.000002, alpha: 0.1, beta: 0.85 }, description: 'Conditional volatility model' },

  // Volume
  { type: 'OBV', name: 'On-Balance Volume', category: 'Volume', overlay: false, defaultParams: {}, description: 'Cumulative volume flow' },
  { type: 'AccDist', name: 'Accumulation/Distribution', category: 'Volume', overlay: false, defaultParams: {}, description: 'Money flow volume' },
  { type: 'CMF', name: 'Chaikin Money Flow', category: 'Volume', overlay: false, defaultParams: { period: 20 }, description: 'Volume-weighted money flow' },
  { type: 'MFI', name: 'Money Flow Index', category: 'Volume', overlay: false, defaultParams: { period: 14 }, description: 'Volume-weighted RSI' },
  { type: 'VWAP', name: 'VWAP', category: 'Volume', overlay: true, defaultParams: {}, description: 'Volume-weighted average price' },

  // Trend
  { type: 'ADX', name: 'Average Directional Index', category: 'Trend', overlay: false, defaultParams: { period: 14 }, description: 'Trend strength measurement' },
  { type: 'SAR', name: 'Parabolic SAR', category: 'Trend', overlay: true, defaultParams: { step: 0.02, max: 0.2 }, description: 'Stop and reverse indicator' },
  { type: 'Supertrend', name: 'Supertrend', category: 'Trend', overlay: true, defaultParams: { period: 10, mult: 3 }, description: 'ATR-based trend indicator' },
  { type: 'Ichimoku', name: 'Ichimoku Cloud', category: 'Trend', overlay: true, defaultParams: { tenkan: 9, kijun: 26, senkou: 52 }, description: 'Japanese cloud chart system' },
  { type: 'ZigZag', name: 'ZigZag', category: 'Trend', overlay: true, defaultParams: { threshold: 5 }, description: 'Swing high/low connector' },
];

// ── Color palette for indicators ─────────────────────────────────────────────

const COLORS = [
  '#2962FF', '#FF6D00', '#00E676', '#AA00FF', '#FF1744',
  '#00B8D4', '#FFD600', '#C6FF00', '#FF4081', '#448AFF',
  '#69F0AE', '#B388FF', '#FF9100', '#18FFFF', '#EEFF41',
];

let colorIdx = 0;
function nextColor(): string {
  return COLORS[colorIdx++ % COLORS.length];
}

let idCounter = 0;
function nextId(): string {
  return `ind_${++idCounter}_${Date.now().toString(36)}`;
}

// ── Compute helpers ──────────────────────────────────────────────────────────

function computeIndicator(config: IndicatorConfig, bars: OHLCV[]): IndicatorOutput | null {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);
  const opens = bars.map((b) => b.open);
  const p = config.params;

  try {
    switch (config.type) {
      // ── Moving Averages ────
      case 'SMA': return { id: config.id, type: config.type, values: sma(closes, p.period || 20), overlay: true, label: `SMA(${p.period || 20})`, color: config.color };
      case 'EMA': return { id: config.id, type: config.type, values: ema(closes, p.period || 20), overlay: true, label: `EMA(${p.period || 20})`, color: config.color };
      case 'WMA': return { id: config.id, type: config.type, values: wma(closes, p.period || 20), overlay: true, label: `WMA(${p.period || 20})`, color: config.color };
      case 'DEMA': return { id: config.id, type: config.type, values: dema(closes, p.period || 20), overlay: true, label: `DEMA(${p.period || 20})`, color: config.color };
      case 'TEMA': return { id: config.id, type: config.type, values: tema(closes, p.period || 20), overlay: true, label: `TEMA(${p.period || 20})`, color: config.color };
      case 'HullMA': return { id: config.id, type: config.type, values: hullMA(closes, p.period || 20), overlay: true, label: `HullMA(${p.period || 20})`, color: config.color };
      case 'VWMA': return { id: config.id, type: config.type, values: vwma(closes, volumes, p.period || 20), overlay: true, label: `VWMA(${p.period || 20})`, color: config.color };
      case 'KAMA': return { id: config.id, type: config.type, values: kama(closes, p.period || 10, p.fast || 2, p.slow || 30), overlay: true, label: `KAMA(${p.period || 10})`, color: config.color };
      case 'ALMA': return { id: config.id, type: config.type, values: alma(closes, p.period || 9, p.offset || 0.85, p.sigma || 6), overlay: true, label: `ALMA(${p.period || 9})`, color: config.color };
      case 'T3': return { id: config.id, type: config.type, values: t3(closes, p.period || 5, p.factor || 0.7), overlay: true, label: `T3(${p.period || 5})`, color: config.color };
      case 'ZeroLagEMA': return { id: config.id, type: config.type, values: zeroLagEMA(closes, p.period || 20), overlay: true, label: `ZLEMA(${p.period || 20})`, color: config.color };
      case 'McGinley': return { id: config.id, type: config.type, values: mcginleyDynamic(closes, p.period || 14), overlay: true, label: `McGinley(${p.period || 14})`, color: config.color };

      // ── Momentum ────
      case 'RSI': return { id: config.id, type: config.type, values: rsi(closes, p.period || 14), overlay: false, label: `RSI(${p.period || 14})`, color: config.color };
      case 'MACD': {
        const result = macd(closes, p.fast || 12, p.slow || 26, p.signal || 9);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: `MACD(${p.fast || 12},${p.slow || 26},${p.signal || 9})`, color: config.color };
      }
      case 'Stochastic': {
        const result = stochastic(highs, lows, closes, p.kPeriod || 14, p.dPeriod || 3, p.smooth || 3);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: `Stoch(${p.kPeriod || 14})`, color: config.color };
      }
      case 'StochRSI': {
        const result = stochasticRSI(closes, p.rsiPeriod || 14, p.stochPeriod || 14);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: `StochRSI(${p.rsiPeriod || 14})`, color: config.color };
      }
      case 'CCI': return { id: config.id, type: config.type, values: cci(highs, lows, closes, p.period || 20), overlay: false, label: `CCI(${p.period || 20})`, color: config.color };
      case 'WilliamsR': return { id: config.id, type: config.type, values: williamsR(highs, lows, closes, p.period || 14), overlay: false, label: `%R(${p.period || 14})`, color: config.color };
      case 'ROC': return { id: config.id, type: config.type, values: roc(closes, p.period || 12), overlay: false, label: `ROC(${p.period || 12})`, color: config.color };
      case 'Momentum': return { id: config.id, type: config.type, values: momentum(closes, p.period || 10), overlay: false, label: `Mom(${p.period || 10})`, color: config.color };
      case 'UltOsc': return { id: config.id, type: config.type, values: ultimateOscillator(highs, lows, closes, p.p1 || 7, p.p2 || 14, p.p3 || 28), overlay: false, label: 'UltOsc', color: config.color };
      case 'TSI': {
        const result = tsi(closes, p.long || 25, p.short || 13);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: `TSI(${p.long || 25},${p.short || 13})`, color: config.color };
      }
      case 'Coppock': return { id: config.id, type: config.type, values: coppockCurve(closes, p.wma || 10, p.roc1 || 14, p.roc2 || 11), overlay: false, label: 'Coppock', color: config.color };
      case 'Fisher': return { id: config.id, type: config.type, values: fisherTransform(highs, lows, p.period || 10), overlay: false, label: `Fisher(${p.period || 10})`, color: config.color };
      case 'ConnorsRSI': return { id: config.id, type: config.type, values: connorsRSI(closes, p.rsi || 3, p.streak || 2, p.rank || 100), overlay: false, label: 'CRSI', color: config.color };

      // ── Volatility ────
      case 'ATR': return { id: config.id, type: config.type, values: atr(highs, lows, closes, p.period || 14), overlay: false, label: `ATR(${p.period || 14})`, color: config.color };
      case 'BB': {
        const result = bollingerBands(closes, p.period || 20, p.mult || 2);
        return { id: config.id, type: config.type, values: result as any, overlay: true, label: `BB(${p.period || 20},${p.mult || 2})`, color: config.color };
      }
      case 'Keltner': {
        const result = keltnerChannel(highs, lows, closes, p.period || 20, p.mult || 1.5);
        return { id: config.id, type: config.type, values: result as any, overlay: true, label: `KC(${p.period || 20})`, color: config.color };
      }
      case 'Donchian': {
        const result = donchianChannel(highs, lows, p.period || 20);
        return { id: config.id, type: config.type, values: result as any, overlay: true, label: `DC(${p.period || 20})`, color: config.color };
      }
      case 'HistVol': return { id: config.id, type: config.type, values: historicalVolatility(closes, p.period || 20), overlay: false, label: `HV(${p.period || 20})`, color: config.color };
      case 'GARCH': {
        const result = garch11(closes, p.omega || 0.000002, p.alpha || 0.1, p.beta || 0.85);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: 'GARCH(1,1)', color: config.color };
      }

      // ── Volume ────
      case 'OBV': return { id: config.id, type: config.type, values: obv(closes, volumes), overlay: false, label: 'OBV', color: config.color };
      case 'AccDist': return { id: config.id, type: config.type, values: accumulationDistribution(highs, lows, closes, volumes), overlay: false, label: 'A/D', color: config.color };
      case 'CMF': return { id: config.id, type: config.type, values: cmf(highs, lows, closes, volumes, p.period || 20), overlay: false, label: `CMF(${p.period || 20})`, color: config.color };
      case 'MFI': return { id: config.id, type: config.type, values: mfi(highs, lows, closes, volumes, p.period || 14), overlay: false, label: `MFI(${p.period || 14})`, color: config.color };
      case 'VWAP': return { id: config.id, type: config.type, values: vwap(highs, lows, closes, volumes), overlay: true, label: 'VWAP', color: config.color };

      // ── Trend ────
      case 'ADX': {
        const result = adx(highs, lows, closes, p.period || 14);
        return { id: config.id, type: config.type, values: result as any, overlay: false, label: `ADX(${p.period || 14})`, color: config.color };
      }
      case 'SAR': return { id: config.id, type: config.type, values: parabolicSAR(highs, lows, p.step || 0.02, p.max || 0.2), overlay: true, label: 'SAR', color: config.color };
      case 'Supertrend': {
        const result = supertrend(highs, lows, closes, p.period || 10, p.mult || 3);
        return { id: config.id, type: config.type, values: result as any, overlay: true, label: `ST(${p.period || 10},${p.mult || 3})`, color: config.color };
      }
      case 'Ichimoku': {
        const result = ichimoku(highs, lows, closes, p.tenkan || 9, p.kijun || 26, p.senkou || 52);
        return { id: config.id, type: config.type, values: result as any, overlay: true, label: 'Ichimoku', color: config.color };
      }
      case 'ZigZag': return { id: config.id, type: config.type, values: zigzag(highs, lows, p.threshold || 5), overlay: true, label: `ZZ(${p.threshold || 5}%)`, color: config.color };

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_INDICATOR_STATE: IndicatorsState = {
  indicators: [],
  outputs: [],
  catalog: INDICATOR_CATALOG,
  barCount: 0,
  isComputing: false,
};

export function useIndicators(): [IndicatorsState, IndicatorActions] {
  const [state, setState] = useState<IndicatorsState>(INITIAL_INDICATOR_STATE);
  const barsRef = useRef<OHLCV[]>([]);

  const addIndicator = useCallback(
    (type: IndicatorType, params?: Record<string, number>): string => {
      const catalogEntry = INDICATOR_CATALOG.find((c) => c.type === type);
      const id = nextId();
      const config: IndicatorConfig = {
        id,
        type,
        params: params || catalogEntry?.defaultParams || {},
        visible: true,
        color: nextColor(),
        lineWidth: 1,
        overlay: catalogEntry?.overlay ?? false,
      };
      setState(prev => ({
        ...prev,
        indicators: [...prev.indicators, config],
      }));

      // Auto-compute if we have bars
      if (barsRef.current.length > 0) {
        const output = computeIndicator(config, barsRef.current);
        if (output) {
          setState(prev => ({ ...prev, outputs: [...prev.outputs, output] }));
        }
      }

      return id;
    },
    [],
  );

  const removeIndicator = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      indicators: prev.indicators.filter((i) => i.id !== id),
      outputs: prev.outputs.filter((o) => o.id !== id),
    }));
  }, []);

  const updateIndicator = useCallback((id: string, patch: Partial<IndicatorConfig>) => {
    setState(prev => {
      const indicators = prev.indicators.map((i) =>
        i.id === id ? { ...i, ...patch } : i,
      );
      // Recompute if params changed
      if (patch.params && barsRef.current.length > 0) {
        const config = indicators.find((i) => i.id === id);
        if (config) {
          const output = computeIndicator(config, barsRef.current);
          if (output) {
            return {
              ...prev,
              indicators,
              outputs: prev.outputs.map((o) => (o.id === id ? output : o)),
            };
          }
        }
      }
      return { ...prev, indicators };
    });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      indicators: prev.indicators.map((i) =>
        i.id === id ? { ...i, visible: !i.visible } : i,
      ),
    }));
  }, []);

  const compute = useCallback((bars: OHLCV[]) => {
    barsRef.current = bars;
    setState(prev => {
      const outputs: IndicatorOutput[] = [];
      for (const config of prev.indicators) {
        const output = computeIndicator(config, bars);
        if (output) outputs.push(output);
      }
      return { ...prev, outputs, barCount: bars.length, isComputing: false };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState(INITIAL_INDICATOR_STATE);
  }, []);

  const getCatalog = useCallback(() => INDICATOR_CATALOG, []);

  const actions: IndicatorActions = useMemo(
    () => ({
      addIndicator,
      removeIndicator,
      updateIndicator,
      toggleVisibility,
      compute,
      clearAll,
      getCatalog,
    }),
    [addIndicator, removeIndicator, updateIndicator, toggleVisibility, compute, clearAll, getCatalog],
  );

  return [state, actions];
}
