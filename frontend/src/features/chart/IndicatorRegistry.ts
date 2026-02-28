/**
 * IndicatorRegistry.ts — Comprehensive indicator catalog
 * ========================================================
 * Every indicator available from the backend TA engines (v4 + v5),
 * organized by category with metadata for the indicator picker.
 */

export type IndicatorPane = 'main' | 'sub';
export type IndicatorAPI = 'v4' | 'v5';

export interface IndicatorDef {
  id:          string;
  name:        string;
  shortName:   string;
  category:    string;
  pane:        IndicatorPane;
  api:         IndicatorAPI;
  endpoint:    string;  // v4: indicator name for /compute; v5: route path
  params:      Record<string, { type: 'number' | 'string' | 'boolean'; default: unknown; min?: number; max?: number; label: string }>;
  description: string;
  color:       string;
  outputs:     string[];  // key names returned by API
}

const C = {
  amber:   '#f5a623',
  blue:    '#42a5f5',
  red:     '#ef5350',
  green:   '#26a69a',
  purple:  '#7e57c2',
  orange:  '#ff7043',
  pink:    '#ec407a',
  teal:    '#26c6da',
  lime:    '#c6ff00',
  cyan:    '#00e5ff',
  yellow:  '#ffea00',
  indigo:  '#5c6bc0',
  deepOrange: '#ff5722',
  blueGrey: '#78909c',
  lightGreen: '#8bc34a',
  deepPurple: '#9c27b0',
};

// ── CATEGORY METADATA ──────────────────────────────────────────────────────

export const INDICATOR_CATEGORIES: { id: string; label: string; icon: string; description: string }[] = [
  { id: 'trend',         label: 'Trend',            icon: '📈', description: 'Moving averages, trend filters, and directional indicators' },
  { id: 'momentum',      label: 'Momentum',         icon: '⚡', description: 'Oscillators and momentum-based indicators' },
  { id: 'volatility',    label: 'Volatility',       icon: '📊', description: 'Volatility measures and bands' },
  { id: 'volume',        label: 'Volume',            icon: '📉', description: 'Volume-based indicators and analysis' },
  { id: 'patterns',      label: 'Patterns',          icon: '🔮', description: 'Candlestick and chart patterns' },
  { id: 'fibonacci',     label: 'Fibonacci & Gann',  icon: '🌀', description: 'Fib levels, harmonics, Elliott, Gann' },
  { id: 'orderflow',     label: 'Order Flow',        icon: '🏛️', description: 'Institutional flow, S/D zones, footprint' },
  { id: 'advanced',      label: 'Advanced',          icon: '🧪', description: 'Ehlers, entropy, regime detection, microstructure' },
  { id: 'profile',       label: 'Profile',           icon: '▊', description: 'Volume profile, market profile, VWAP variants' },
];

// ── FULL INDICATOR LIST ────────────────────────────────────────────────────

export const INDICATORS: IndicatorDef[] = [
  // ═══ TREND ═══════════════════════════════════════════════════════════════
  {
    id: 'sma', name: 'Simple Moving Average', shortName: 'SMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'SMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Arithmetic mean of closing prices over N periods',
    color: C.amber, outputs: ['sma'],
  },
  {
    id: 'ema', name: 'Exponential Moving Average', shortName: 'EMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'EMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Exponentially weighted moving average',
    color: C.green, outputs: ['ema'],
  },
  {
    id: 'wma', name: 'Weighted Moving Average', shortName: 'WMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'WMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Linearly weighted moving average',
    color: C.blue, outputs: ['wma'],
  },
  {
    id: 'dema', name: 'Double EMA', shortName: 'DEMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'DEMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Double exponential moving average (less lag)',
    color: C.teal, outputs: ['dema'],
  },
  {
    id: 'tema', name: 'Triple EMA', shortName: 'TEMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'TEMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Triple exponential moving average',
    color: C.cyan, outputs: ['tema'],
  },
  {
    id: 'vwma', name: 'Volume Weighted MA', shortName: 'VWMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'VWMA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Volume-weighted moving average',
    color: C.orange, outputs: ['vwma'],
  },
  {
    id: 'hull_ma', name: 'Hull Moving Average', shortName: 'HMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'HULL_MA',
    params: { period: { type: 'number', default: 20, min: 1, max: 500, label: 'Period' } },
    description: 'Hull MA — reduces lag significantly',
    color: C.lime, outputs: ['hma'],
  },
  {
    id: 'kama', name: 'Kaufman Adaptive MA', shortName: 'KAMA',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'KAMA',
    params: { period: { type: 'number', default: 10, min: 1, max: 500, label: 'Period' } },
    description: 'Adapts smoothing to price volatility',
    color: C.indigo, outputs: ['kama'],
  },
  {
    id: 'vwap', name: 'VWAP', shortName: 'VWAP',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'VWAP',
    params: {},
    description: 'Volume-weighted average price',
    color: C.orange, outputs: ['vwap'],
  },
  {
    id: 'ichimoku', name: 'Ichimoku Cloud', shortName: 'ICH',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'ICHIMOKU',
    params: {
      tenkan: { type: 'number', default: 9, min: 1, max: 100, label: 'Tenkan' },
      kijun: { type: 'number', default: 26, min: 1, max: 100, label: 'Kijun' },
      senkou: { type: 'number', default: 52, min: 1, max: 200, label: 'Senkou B' },
    },
    description: 'Ichimoku Kinko Hyo — comprehensive trend system',
    color: C.teal, outputs: ['tenkan', 'kijun', 'senkou_a', 'senkou_b', 'chikou'],
  },
  {
    id: 'supertrend', name: 'Supertrend', shortName: 'ST',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'SUPERTREND',
    params: {
      period: { type: 'number', default: 10, min: 1, max: 100, label: 'Period' },
      multiplier: { type: 'number', default: 3, min: 0.5, max: 10, label: 'Multiplier' },
    },
    description: 'Trend-following overlay with dynamic support/resistance',
    color: C.green, outputs: ['supertrend', 'direction'],
  },
  {
    id: 'parabolic_sar', name: 'Parabolic SAR', shortName: 'SAR',
    category: 'trend', pane: 'main', api: 'v4', endpoint: 'SAR',
    params: {
      af_start: { type: 'number', default: 0.02, min: 0.001, max: 0.1, label: 'AF Start' },
      af_max: { type: 'number', default: 0.2, min: 0.05, max: 1, label: 'AF Max' },
    },
    description: 'Wilder Parabolic Stop-and-Reverse',
    color: C.pink, outputs: ['sar'],
  },
  {
    id: 'adx', name: 'Average Directional Index', shortName: 'ADX',
    category: 'trend', pane: 'sub', api: 'v4', endpoint: 'ADX',
    params: { period: { type: 'number', default: 14, min: 1, max: 100, label: 'Period' } },
    description: 'Trend strength (0-100). +DI/-DI for direction',
    color: C.amber, outputs: ['adx', 'plus_di', 'minus_di'],
  },
  {
    id: 'aroon', name: 'Aroon', shortName: 'AROON',
    category: 'trend', pane: 'sub', api: 'v4', endpoint: 'AROON',
    params: { period: { type: 'number', default: 25, min: 1, max: 200, label: 'Period' } },
    description: 'Aroon Up/Down — trend identification',
    color: C.indigo, outputs: ['aroon_up', 'aroon_down'],
  },
  {
    id: 'ehlers_super_smoother', name: 'Ehlers Super Smoother', shortName: 'ESS',
    category: 'trend', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: { period: { type: 'number', default: 20, min: 2, max: 200, label: 'Period' } },
    description: 'Ehlers 2-pole super smoother — minimal lag',
    color: C.deepPurple, outputs: ['super_smoother'],
  },
  {
    id: 'ehlers_instantaneous', name: 'Ehlers Inst. Trendline', shortName: 'EIT',
    category: 'trend', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: {},
    description: 'Ehlers instantaneous trendline',
    color: C.cyan, outputs: ['instantaneous_trendline'],
  },

  // ═══ MOMENTUM ════════════════════════════════════════════════════════════
  {
    id: 'rsi', name: 'RSI', shortName: 'RSI',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'RSI',
    params: { period: { type: 'number', default: 14, min: 1, max: 200, label: 'Period' } },
    description: 'Relative Strength Index — overbought/oversold',
    color: C.green, outputs: ['rsi'],
  },
  {
    id: 'macd', name: 'MACD', shortName: 'MACD',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'MACD',
    params: {
      fast: { type: 'number', default: 12, min: 1, max: 200, label: 'Fast' },
      slow: { type: 'number', default: 26, min: 1, max: 200, label: 'Slow' },
      signal: { type: 'number', default: 9, min: 1, max: 100, label: 'Signal' },
    },
    description: 'Moving Average Convergence/Divergence',
    color: C.blue, outputs: ['macd', 'signal', 'histogram'],
  },
  {
    id: 'stochastic', name: 'Stochastic', shortName: 'STOCH',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'STOCHASTIC',
    params: {
      k_period: { type: 'number', default: 14, min: 1, max: 200, label: '%K' },
      d_period: { type: 'number', default: 3, min: 1, max: 100, label: '%D' },
      smooth: { type: 'number', default: 3, min: 1, max: 100, label: 'Smooth' },
    },
    description: 'Stochastic Oscillator — momentum reversal',
    color: C.pink, outputs: ['k', 'd'],
  },
  {
    id: 'stoch_rsi', name: 'Stochastic RSI', shortName: 'StochRSI',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'STOCH_RSI',
    params: {
      rsi_period: { type: 'number', default: 14, min: 1, max: 200, label: 'RSI' },
      stoch_period: { type: 'number', default: 14, min: 1, max: 200, label: 'Stoch' },
    },
    description: 'RSI of RSI — extreme overbought/oversold',
    color: C.deepPurple, outputs: ['k', 'd'],
  },
  {
    id: 'cci', name: 'CCI', shortName: 'CCI',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'CCI',
    params: { period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' } },
    description: 'Commodity Channel Index',
    color: C.orange, outputs: ['cci'],
  },
  {
    id: 'roc', name: 'Rate of Change', shortName: 'ROC',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'ROC',
    params: { period: { type: 'number', default: 12, min: 1, max: 200, label: 'Period' } },
    description: 'Percentage price change over N periods',
    color: C.teal, outputs: ['roc'],
  },
  {
    id: 'williams_r', name: 'Williams %R', shortName: '%R',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'WILLIAMS_R',
    params: { period: { type: 'number', default: 14, min: 1, max: 200, label: 'Period' } },
    description: 'Williams %R — overbought/oversold momentum',
    color: C.red, outputs: ['williams_r'],
  },
  {
    id: 'trix', name: 'TRIX', shortName: 'TRIX',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'TRIX',
    params: { period: { type: 'number', default: 15, min: 1, max: 200, label: 'Period' } },
    description: 'Triple-smoothed EMA rate of change',
    color: C.lime, outputs: ['trix'],
  },
  {
    id: 'momentum', name: 'Momentum', shortName: 'MOM',
    category: 'momentum', pane: 'sub', api: 'v4', endpoint: 'MOMENTUM',
    params: { period: { type: 'number', default: 10, min: 1, max: 200, label: 'Period' } },
    description: 'Price momentum (close - close[N])',
    color: C.blueGrey, outputs: ['momentum'],
  },
  {
    id: 'cmo', name: 'Chande Momentum Osc.', shortName: 'CMO',
    category: 'momentum', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: { period: { type: 'number', default: 14, min: 1, max: 200, label: 'Period' } },
    description: 'Chande Momentum Oscillator — unsmoothed momentum',
    color: C.deepOrange, outputs: ['cmo'],
  },
  {
    id: 'rvi', name: 'Relative Vigor Index', shortName: 'RVI',
    category: 'momentum', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: { period: { type: 'number', default: 10, min: 1, max: 100, label: 'Period' } },
    description: 'Measures conviction of recent price moves',
    color: C.lightGreen, outputs: ['rvi', 'signal'],
  },
  {
    id: 'ehlers_fisher', name: 'Ehlers Fisher Transform', shortName: 'FT',
    category: 'momentum', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: { period: { type: 'number', default: 10, min: 2, max: 100, label: 'Period' } },
    description: 'Fisher Transform — Gaussian normalization of price',
    color: C.indigo, outputs: ['fisher', 'trigger'],
  },
  {
    id: 'elder_impulse', name: 'Elder Impulse System', shortName: 'EIS',
    category: 'momentum', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: {},
    description: 'Elder: EMA + MACD-H color coding (green/red/blue)',
    color: C.green, outputs: ['impulse'],
  },

  // ═══ VOLATILITY ══════════════════════════════════════════════════════════
  {
    id: 'bbands', name: 'Bollinger Bands', shortName: 'BB',
    category: 'volatility', pane: 'main', api: 'v4', endpoint: 'BBANDS',
    params: {
      period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' },
      std_dev: { type: 'number', default: 2, min: 0.5, max: 5, label: 'Std Dev' },
    },
    description: 'Bollinger Bands — volatility envelope',
    color: C.purple, outputs: ['upper', 'middle', 'lower'],
  },
  {
    id: 'keltner', name: 'Keltner Channel', shortName: 'KC',
    category: 'volatility', pane: 'main', api: 'v4', endpoint: 'KELTNER',
    params: {
      period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' },
      multiplier: { type: 'number', default: 1.5, min: 0.5, max: 5, label: 'Mult' },
    },
    description: 'Keltner Channel — ATR-based envelope',
    color: C.teal, outputs: ['upper', 'middle', 'lower'],
  },
  {
    id: 'donchian', name: 'Donchian Channel', shortName: 'DC',
    category: 'volatility', pane: 'main', api: 'v4', endpoint: 'DONCHIAN',
    params: { period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' } },
    description: 'Donchian Channel — highest high / lowest low',
    color: C.cyan, outputs: ['upper', 'lower', 'middle'],
  },
  {
    id: 'atr', name: 'Average True Range', shortName: 'ATR',
    category: 'volatility', pane: 'sub', api: 'v4', endpoint: 'ATR',
    params: { period: { type: 'number', default: 14, min: 1, max: 200, label: 'Period' } },
    description: 'Wilder ATR — volatility measure',
    color: C.purple, outputs: ['atr'],
  },
  {
    id: 'bb_width', name: 'BB Width', shortName: 'BBW',
    category: 'volatility', pane: 'sub', api: 'v4', endpoint: 'BB_WIDTH',
    params: { period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' } },
    description: 'Bollinger Band Width — squeeze detection',
    color: C.deepPurple, outputs: ['bb_width'],
  },
  {
    id: 'hv', name: 'Historical Volatility', shortName: 'HV',
    category: 'volatility', pane: 'sub', api: 'v4', endpoint: 'HV',
    params: { period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' } },
    description: 'Annualized historical volatility',
    color: C.red, outputs: ['hv'],
  },
  {
    id: 'garman_klass', name: 'Garman-Klass Volatility', shortName: 'GKV',
    category: 'volatility', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/advanced-volatility',
    params: { period: { type: 'number', default: 20, min: 5, max: 200, label: 'Period' } },
    description: 'OHLC-based volatility estimator (more efficient than close-close)',
    color: C.deepOrange, outputs: ['garman_klass'],
  },
  {
    id: 'parkinson', name: 'Parkinson Volatility', shortName: 'PKV',
    category: 'volatility', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/advanced-volatility',
    params: { period: { type: 'number', default: 20, min: 5, max: 200, label: 'Period' } },
    description: 'High-low range-based volatility estimator',
    color: C.pink, outputs: ['parkinson'],
  },
  {
    id: 'yang_zhang', name: 'Yang-Zhang Volatility', shortName: 'YZV',
    category: 'volatility', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/advanced-volatility',
    params: { period: { type: 'number', default: 20, min: 5, max: 200, label: 'Period' } },
    description: 'Yang-Zhang — combines overnight + OHLC volatility',
    color: C.indigo, outputs: ['yang_zhang'],
  },

  // ═══ VOLUME ══════════════════════════════════════════════════════════════
  {
    id: 'obv', name: 'OBV', shortName: 'OBV',
    category: 'volume', pane: 'sub', api: 'v4', endpoint: 'OBV',
    params: {},
    description: 'On Balance Volume — cumulative volume flow',
    color: C.blue, outputs: ['obv'],
  },
  {
    id: 'mfi', name: 'Money Flow Index', shortName: 'MFI',
    category: 'volume', pane: 'sub', api: 'v4', endpoint: 'MFI',
    params: { period: { type: 'number', default: 14, min: 1, max: 200, label: 'Period' } },
    description: 'Volume-weighted RSI (0-100)',
    color: C.green, outputs: ['mfi'],
  },
  {
    id: 'cmf', name: 'Chaikin Money Flow', shortName: 'CMF',
    category: 'volume', pane: 'sub', api: 'v4', endpoint: 'CMF',
    params: { period: { type: 'number', default: 20, min: 1, max: 200, label: 'Period' } },
    description: 'Chaikin Money Flow — accumulation/distribution pressure',
    color: C.amber, outputs: ['cmf'],
  },
  {
    id: 'adl', name: 'A/D Line', shortName: 'ADL',
    category: 'volume', pane: 'sub', api: 'v4', endpoint: 'ADL',
    params: {},
    description: 'Accumulation/Distribution Line',
    color: C.purple, outputs: ['adl'],
  },
  {
    id: 'vwap_bands', name: 'VWAP Bands', shortName: 'VWAP±',
    category: 'volume', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/anchored-vwap',
    params: { anchor_idx: { type: 'number', default: 0, min: 0, max: 999, label: 'Anchor Bar' } },
    description: 'Anchored VWAP with ±1σ and ±2σ bands',
    color: C.orange, outputs: ['vwap', 'upper_1', 'lower_1', 'upper_2', 'lower_2'],
  },
  {
    id: 'smart_money', name: 'Smart Money Flow', shortName: 'SMF',
    category: 'volume', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/vsa',
    params: { period: { type: 'number', default: 20, min: 5, max: 100, label: 'Period' } },
    description: 'Smart vs dumb money flow estimation',
    color: C.deepPurple, outputs: ['smart_money_flow'],
  },
  {
    id: 'klinger', name: 'Klinger Volume Osc.', shortName: 'KVO',
    category: 'volume', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/vsa',
    params: {},
    description: 'Klinger Volume Oscillator — volume-based trend',
    color: C.teal, outputs: ['kvo', 'signal', 'histogram'],
  },
  {
    id: 'vzo', name: 'Volume Zone Oscillator', shortName: 'VZO',
    category: 'volume', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/vsa',
    params: { period: { type: 'number', default: 14, min: 5, max: 100, label: 'Period' } },
    description: 'Volume Zone Oscillator — trend confirmation',
    color: C.lightGreen, outputs: ['vzo'],
  },

  // ═══ PATTERNS ════════════════════════════════════════════════════════════
  {
    id: 'candlestick_all', name: 'Candlestick Patterns', shortName: 'CANDLE',
    category: 'patterns', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/candlestick-patterns',
    params: {},
    description: 'Detect all 26 candlestick patterns (doji, engulfing, etc.)',
    color: C.amber, outputs: ['pattern_signals'],
  },
  {
    id: 'vsa_signals', name: 'VSA Signals', shortName: 'VSA',
    category: 'patterns', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/vsa',
    params: { period: { type: 'number', default: 20, min: 5, max: 100, label: 'Period' } },
    description: 'Volume Spread Analysis: climax, no-demand, stopping volume',
    color: C.red, outputs: ['vsa_type', 'vsa_direction', 'vsa_strength'],
  },
  {
    id: 'harmonic', name: 'Harmonic Patterns', shortName: 'HARM',
    category: 'patterns', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/harmonic-patterns',
    params: {},
    description: 'XABCD: Gartley, Butterfly, Bat, Crab, Shark, Cypher',
    color: C.deepPurple, outputs: ['patterns'],
  },
  {
    id: 'elliott', name: 'Elliott Wave Count', shortName: 'EW',
    category: 'patterns', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/elliott-waves',
    params: {},
    description: '5-wave impulse pattern detection',
    color: C.indigo, outputs: ['waves', 'labels'],
  },

  // ═══ FIBONACCI & GANN ═══════════════════════════════════════════════════
  {
    id: 'auto_fib', name: 'Auto Fibonacci', shortName: 'FIB',
    category: 'fibonacci', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/fibonacci',
    params: { mode: { type: 'string', default: 'retracement', label: 'Mode' } },
    description: 'Auto-detect swing points and draw Fibonacci levels',
    color: C.amber, outputs: ['levels'],
  },
  {
    id: 'auto_sr', name: 'Auto Support/Resistance', shortName: 'S/R',
    category: 'fibonacci', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/support-resistance',
    params: { method: { type: 'string', default: 'cluster', label: 'Method' } },
    description: 'Automatic S/R levels (cluster, volume, or fractal method)',
    color: C.red, outputs: ['support', 'resistance'],
  },
  {
    id: 'regression_channel', name: 'Regression Channel', shortName: 'REG',
    category: 'fibonacci', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/regression-channel',
    params: {
      period: { type: 'number', default: 100, min: 20, max: 500, label: 'Period' },
      type: { type: 'string', default: 'linear', label: 'Type' },
    },
    description: 'Linear/quadratic/logarithmic regression channel',
    color: C.blue, outputs: ['center', 'upper', 'lower'],
  },
  {
    id: 'gann_fan', name: 'Gann Fan', shortName: 'GANN',
    category: 'fibonacci', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/gann',
    params: {},
    description: 'Gann fan angles from swing point + square of 9',
    color: C.deepOrange, outputs: ['fan_lines', 'square'],
  },

  // ═══ ORDER FLOW ══════════════════════════════════════════════════════════
  {
    id: 'order_flow', name: 'Order Flow Score', shortName: 'OF',
    category: 'orderflow', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/order-flow',
    params: {},
    description: 'Composite order flow score (-100 to +100)',
    color: C.amber, outputs: ['raw_score', 'smoothed_score'],
  },
  {
    id: 'sd_zones', name: 'Supply/Demand Zones', shortName: 'S/D',
    category: 'orderflow', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/supply-demand-zones',
    params: {},
    description: 'Key supply and demand zones with strength + freshness',
    color: C.green, outputs: ['zones'],
  },
  {
    id: 'inst_flow', name: 'Institutional Flow', shortName: 'INST',
    category: 'orderflow', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/institutional-flow',
    params: { period: { type: 'number', default: 20, min: 5, max: 100, label: 'Period' } },
    description: 'Institutional accumulation/distribution proxy',
    color: C.deepPurple, outputs: ['inst_flow_strength', 'inst_flow_direction'],
  },

  // ═══ ADVANCED ════════════════════════════════════════════════════════════
  {
    id: 'regime', name: 'Market Regime', shortName: 'REG',
    category: 'advanced', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/regime',
    params: {},
    description: 'Market regime classifier (trending/ranging/volatile)',
    color: C.amber, outputs: ['regime', 'confidence'],
  },
  {
    id: 'confluence', name: 'Multi-TF Confluence', shortName: 'CONF',
    category: 'advanced', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/confluence',
    params: {},
    description: 'Multi-timeframe confluence score (-100 to +100)',
    color: C.green, outputs: ['confluence_score'],
  },
  {
    id: 'ehlers_roofing', name: 'Ehlers Roofing Filter', shortName: 'ERF',
    category: 'advanced', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/ehlers',
    params: {},
    description: 'Ehlers bandpass roofing filter — cycle extraction',
    color: C.cyan, outputs: ['roofing'],
  },
  {
    id: 'volatility_regime', name: 'Volatility Regime', shortName: 'VREG',
    category: 'advanced', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/regime',
    params: {},
    description: 'Volatility regime detection (low/normal/high/extreme)',
    color: C.red, outputs: ['volatility_regime'],
  },
  {
    id: 'trend_strength', name: 'Trend Strength', shortName: 'TS',
    category: 'advanced', pane: 'sub', api: 'v5', endpoint: '/api/v5/ta/regime',
    params: {},
    description: 'Composite trend strength (0-100)',
    color: C.lime, outputs: ['trend_strength'],
  },

  // ═══ PROFILE ═════════════════════════════════════════════════════════════
  {
    id: 'volume_profile', name: 'Volume Profile', shortName: 'VP',
    category: 'profile', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/volume-profile',
    params: { bins: { type: 'number', default: 50, min: 10, max: 200, label: 'Bins' } },
    description: 'Volume at price with POC, VAH, VAL, HVN, LVN',
    color: C.blue, outputs: ['poc', 'vah', 'val', 'levels'],
  },
  {
    id: 'market_profile', name: 'Market Profile (TPO)', shortName: 'TPO',
    category: 'profile', pane: 'main', api: 'v5', endpoint: '/api/v5/ta/market-profile',
    params: {},
    description: 'Time Price Opportunity — single prints, IB, profile type',
    color: C.purple, outputs: ['poc', 'vah', 'val', 'profile_type'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getIndicatorsByCategory(category: string): IndicatorDef[] {
  return INDICATORS.filter(i => i.category === category);
}

export function getIndicatorById(id: string): IndicatorDef | undefined {
  return INDICATORS.find(i => i.id === id);
}

export function searchIndicators(query: string): IndicatorDef[] {
  const q = query.toLowerCase();
  return INDICATORS.filter(
    i => i.name.toLowerCase().includes(q)
      || i.shortName.toLowerCase().includes(q)
      || i.category.toLowerCase().includes(q)
      || i.description.toLowerCase().includes(q),
  );
}

export const INDICATOR_COUNT = INDICATORS.length;
