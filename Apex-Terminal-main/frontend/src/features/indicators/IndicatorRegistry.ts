/**
 * Indicator Registry - Central registry of all available indicators
 * 
 * This module defines the metadata for 30+ technical indicators across:
 * - Trend (6): Ichimoku, Supertrend, SAR, ADX, Aroon, MA Ribbon
 * - Momentum (7): Stoch, Stoch RSI, CCI, ROC, Williams %R, TRIX, Momentum
 * - Volatility (5): Keltner, Donchian, BB Width, HV, ATR Bands
 * - Volume (6): OBV, MFI, CMF, ADL, VWMA, Volume Profile
 * - Profile (4): VRVP, Anchored VWAP, VWAP Bands, POC/VAH/VAL
 * - Existing (7): SMA, EMA, VWAP, RSI, MACD, Bollinger, ATR
 */

import type { IndicatorType, IndicatorDefinition, IndicatorCategory } from '../../core/types';

// ============================================================================
// INDICATOR DEFINITIONS
// ============================================================================

export const INDICATOR_REGISTRY: Record<IndicatorType, IndicatorDefinition> = {
    // ========================================================================
    // EXISTING INDICATORS
    // ========================================================================
    SMA: {
        id: 'SMA',
        name: 'Simple Moving Average',
        shortName: 'SMA',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500 },
            { name: 'color', label: 'Color', type: 'color', default: '#2962ff' },
        ],
        outputs: ['sma'],
        description: 'Average of closing prices over a specified period',
    },

    EMA: {
        id: 'EMA',
        name: 'Exponential Moving Average',
        shortName: 'EMA',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500 },
            { name: 'color', label: 'Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['ema'],
        description: 'Weighted moving average giving more weight to recent prices',
    },

    VWAP: {
        id: 'VWAP',
        name: 'Volume Weighted Average Price',
        shortName: 'VWAP',
        category: 'volume',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'color', label: 'Color', type: 'color', default: '#ab47bc' },
            { name: 'resetDaily', label: 'Reset Daily', type: 'boolean', default: true },
        ],
        outputs: ['vwap'],
        description: 'Average price weighted by volume, typically resets daily',
    },

    RSI: {
        id: 'RSI',
        name: 'Relative Strength Index',
        shortName: 'RSI',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100 },
            { name: 'color', label: 'Color', type: 'color', default: '#7e57c2' },
            { name: 'overbought', label: 'Overbought', type: 'number', default: 70, min: 50, max: 100 },
            { name: 'oversold', label: 'Oversold', type: 'number', default: 30, min: 0, max: 50 },
        ],
        outputs: ['rsi'],
        description: 'Measures momentum by comparing recent gains to losses (0-100)',
    },

    MACD: {
        id: 'MACD',
        name: 'Moving Average Convergence Divergence',
        shortName: 'MACD',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'histogram',
        params: [
            { name: 'fastPeriod', label: 'Fast Period', type: 'number', default: 12, min: 1, max: 100 },
            { name: 'slowPeriod', label: 'Slow Period', type: 'number', default: 26, min: 1, max: 200 },
            { name: 'signalPeriod', label: 'Signal Period', type: 'number', default: 9, min: 1, max: 50 },
            { name: 'macdColor', label: 'MACD Color', type: 'color', default: '#2962ff' },
            { name: 'signalColor', label: 'Signal Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['macd', 'signal', 'histogram'],
        description: 'Shows relationship between two EMAs with signal line and histogram',
    },

    BOLLINGER: {
        id: 'BOLLINGER',
        name: 'Bollinger Bands',
        shortName: 'BB',
        category: 'volatility',
        paneType: 'overlay',
        renderType: 'bands',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 200 },
            { name: 'stdDev', label: 'Std Dev', type: 'number', default: 2, min: 0.5, max: 5, step: 0.5 },
            { name: 'middleColor', label: 'Middle Color', type: 'color', default: '#2962ff' },
            { name: 'bandsColor', label: 'Bands Color', type: 'color', default: '#2962ff33' },
        ],
        outputs: ['upper', 'middle', 'lower'],
        description: 'Volatility bands based on standard deviation around SMA',
    },

    ATR: {
        id: 'ATR',
        name: 'Average True Range',
        shortName: 'ATR',
        category: 'volatility',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'color', label: 'Color', type: 'color', default: '#26a69a' },
        ],
        outputs: ['atr'],
        description: 'Measures market volatility using high-low range',
    },

    // ========================================================================
    // TREND INDICATORS
    // ========================================================================
    ICHIMOKU: {
        id: 'ICHIMOKU',
        name: 'Ichimoku Cloud',
        shortName: 'Ichimoku',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'cloud',
        params: [
            { name: 'tenkanPeriod', label: 'Tenkan Period', type: 'number', default: 9, min: 1, max: 100 },
            { name: 'kijunPeriod', label: 'Kijun Period', type: 'number', default: 26, min: 1, max: 200 },
            { name: 'senkouPeriod', label: 'Senkou Period', type: 'number', default: 52, min: 1, max: 300 },
            { name: 'displacement', label: 'Displacement', type: 'number', default: 26, min: 1, max: 100 },
            { name: 'tenkanColor', label: 'Tenkan Color', type: 'color', default: '#2962ff' },
            { name: 'kijunColor', label: 'Kijun Color', type: 'color', default: '#ff6d00' },
            { name: 'cloudUpColor', label: 'Cloud Up', type: 'color', default: '#26a69a33' },
            { name: 'cloudDownColor', label: 'Cloud Down', type: 'color', default: '#ef535033' },
        ],
        outputs: ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'],
        description: 'Comprehensive trend system showing support/resistance, trend, and momentum',
    },

    SUPERTREND: {
        id: 'SUPERTREND',
        name: 'Supertrend',
        shortName: 'ST',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'period', label: 'ATR Period', type: 'number', default: 10, min: 1, max: 100 },
            { name: 'multiplier', label: 'Multiplier', type: 'number', default: 3, min: 0.5, max: 10, step: 0.5 },
            { name: 'upColor', label: 'Up Color', type: 'color', default: '#26a69a' },
            { name: 'downColor', label: 'Down Color', type: 'color', default: '#ef5350' },
        ],
        outputs: ['supertrend', 'direction'],
        description: 'Trend-following indicator using ATR for stop levels',
    },

    SAR: {
        id: 'SAR',
        name: 'Parabolic SAR',
        shortName: 'SAR',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'acceleration', label: 'Acceleration', type: 'number', default: 0.02, min: 0.01, max: 0.2, step: 0.01 },
            { name: 'maximum', label: 'Maximum', type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
            { name: 'upColor', label: 'Up Color', type: 'color', default: '#26a69a' },
            { name: 'downColor', label: 'Down Color', type: 'color', default: '#ef5350' },
        ],
        outputs: ['sar', 'direction'],
        description: 'Stop and reverse indicator for trend following',
    },

    ADX: {
        id: 'ADX',
        name: 'Average Directional Index',
        shortName: 'ADX',
        category: 'trend',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'adxColor', label: 'ADX Color', type: 'color', default: '#2962ff' },
            { name: 'diPlusColor', label: 'DI+ Color', type: 'color', default: '#26a69a' },
            { name: 'diMinusColor', label: 'DI- Color', type: 'color', default: '#ef5350' },
        ],
        outputs: ['adx', 'diPlus', 'diMinus'],
        description: 'Measures trend strength (0-100) with directional indicators',
    },

    AROON: {
        id: 'AROON',
        name: 'Aroon Indicator',
        shortName: 'Aroon',
        category: 'trend',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 25, min: 1, max: 100 },
            { name: 'upColor', label: 'Up Color', type: 'color', default: '#26a69a' },
            { name: 'downColor', label: 'Down Color', type: 'color', default: '#ef5350' },
        ],
        outputs: ['aroonUp', 'aroonDown', 'oscillator'],
        description: 'Identifies trends and trend changes using time since high/low',
    },

    MA_RIBBON: {
        id: 'MA_RIBBON',
        name: 'Moving Average Ribbon',
        shortName: 'MA Ribbon',
        category: 'trend',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'periods', label: 'Periods (CSV)', type: 'select', default: '8,13,21,34,55,89', options: [
                { value: '8,13,21,34,55,89', label: 'Fibonacci' },
                { value: '5,10,20,50,100,200', label: 'Standard' },
                { value: '10,20,30,40,50,60', label: 'Sequential' },
            ]},
            { name: 'maType', label: 'MA Type', type: 'select', default: 'EMA', options: [
                { value: 'SMA', label: 'SMA' },
                { value: 'EMA', label: 'EMA' },
            ]},
        ],
        outputs: ['ma1', 'ma2', 'ma3', 'ma4', 'ma5', 'ma6'],
        description: 'Multiple moving averages showing trend strength and direction',
    },

    // ========================================================================
    // MOMENTUM INDICATORS
    // ========================================================================
    STOCH: {
        id: 'STOCH',
        name: 'Stochastic Oscillator',
        shortName: 'Stoch',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'kPeriod', label: '%K Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'dPeriod', label: '%D Period', type: 'number', default: 3, min: 1, max: 50 },
            { name: 'smooth', label: 'Smooth', type: 'number', default: 3, min: 1, max: 50 },
            { name: 'kColor', label: '%K Color', type: 'color', default: '#2962ff' },
            { name: 'dColor', label: '%D Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['k', 'd'],
        description: 'Compares closing price to price range over period (0-100)',
    },

    STOCH_RSI: {
        id: 'STOCH_RSI',
        name: 'Stochastic RSI',
        shortName: 'Stoch RSI',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'stochPeriod', label: 'Stoch Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'kSmooth', label: 'K Smooth', type: 'number', default: 3, min: 1, max: 50 },
            { name: 'dSmooth', label: 'D Smooth', type: 'number', default: 3, min: 1, max: 50 },
            { name: 'kColor', label: 'K Color', type: 'color', default: '#2962ff' },
            { name: 'dColor', label: 'D Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['k', 'd'],
        description: 'Stochastic applied to RSI values for more sensitive signals',
    },

    CCI: {
        id: 'CCI',
        name: 'Commodity Channel Index',
        shortName: 'CCI',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 200 },
            { name: 'color', label: 'Color', type: 'color', default: '#7e57c2' },
            { name: 'overbought', label: 'Overbought', type: 'number', default: 100, min: 50, max: 200 },
            { name: 'oversold', label: 'Oversold', type: 'number', default: -100, min: -200, max: -50 },
        ],
        outputs: ['cci'],
        description: 'Measures price deviation from average relative to typical volatility',
    },

    ROC: {
        id: 'ROC',
        name: 'Rate of Change',
        shortName: 'ROC',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 12, min: 1, max: 200 },
            { name: 'color', label: 'Color', type: 'color', default: '#26a69a' },
        ],
        outputs: ['roc'],
        description: 'Percentage change between current and N periods ago',
    },

    WILLIAMS_R: {
        id: 'WILLIAMS_R',
        name: 'Williams %R',
        shortName: 'Will %R',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'color', label: 'Color', type: 'color', default: '#ff6d00' },
            { name: 'overbought', label: 'Overbought', type: 'number', default: -20, min: -50, max: 0 },
            { name: 'oversold', label: 'Oversold', type: 'number', default: -80, min: -100, max: -50 },
        ],
        outputs: ['willR'],
        description: 'Shows where current close is relative to high-low range (-100 to 0)',
    },

    TRIX: {
        id: 'TRIX',
        name: 'Triple Exponential Average',
        shortName: 'TRIX',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 15, min: 1, max: 100 },
            { name: 'signalPeriod', label: 'Signal', type: 'number', default: 9, min: 1, max: 50 },
            { name: 'trixColor', label: 'TRIX Color', type: 'color', default: '#2962ff' },
            { name: 'signalColor', label: 'Signal Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['trix', 'signal'],
        description: 'Triple-smoothed EMA rate of change with signal line',
    },

    MOMENTUM: {
        id: 'MOMENTUM',
        name: 'Momentum',
        shortName: 'MOM',
        category: 'momentum',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 10, min: 1, max: 200 },
            { name: 'color', label: 'Color', type: 'color', default: '#7e57c2' },
        ],
        outputs: ['momentum'],
        description: 'Price change over N periods (can be positive or negative)',
    },

    // ========================================================================
    // VOLATILITY INDICATORS
    // ========================================================================
    KELTNER: {
        id: 'KELTNER',
        name: 'Keltner Channel',
        shortName: 'KC',
        category: 'volatility',
        paneType: 'overlay',
        renderType: 'bands',
        params: [
            { name: 'emaPeriod', label: 'EMA Period', type: 'number', default: 20, min: 1, max: 200 },
            { name: 'atrPeriod', label: 'ATR Period', type: 'number', default: 10, min: 1, max: 100 },
            { name: 'multiplier', label: 'Multiplier', type: 'number', default: 2, min: 0.5, max: 5, step: 0.5 },
            { name: 'middleColor', label: 'Middle Color', type: 'color', default: '#2962ff' },
            { name: 'bandsColor', label: 'Bands Color', type: 'color', default: '#2962ff33' },
        ],
        outputs: ['upper', 'middle', 'lower'],
        description: 'Volatility channel using EMA and ATR',
    },

    DONCHIAN: {
        id: 'DONCHIAN',
        name: 'Donchian Channel',
        shortName: 'DC',
        category: 'volatility',
        paneType: 'overlay',
        renderType: 'bands',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 200 },
            { name: 'upperColor', label: 'Upper Color', type: 'color', default: '#26a69a' },
            { name: 'lowerColor', label: 'Lower Color', type: 'color', default: '#ef5350' },
            { name: 'middleColor', label: 'Middle Color', type: 'color', default: '#9e9e9e' },
        ],
        outputs: ['upper', 'middle', 'lower'],
        description: 'Highest high and lowest low over period (turtle trading)',
    },

    BB_WIDTH: {
        id: 'BB_WIDTH',
        name: 'Bollinger Band Width',
        shortName: 'BB Width',
        category: 'volatility',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 200 },
            { name: 'stdDev', label: 'Std Dev', type: 'number', default: 2, min: 0.5, max: 5, step: 0.5 },
            { name: 'color', label: 'Color', type: 'color', default: '#ab47bc' },
        ],
        outputs: ['width', 'percentB'],
        description: 'Width of Bollinger Bands as percentage (identifies squeezes)',
    },

    HV: {
        id: 'HV',
        name: 'Historical Volatility',
        shortName: 'HV',
        category: 'volatility',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 252 },
            { name: 'annualize', label: 'Annualize', type: 'boolean', default: true },
            { name: 'color', label: 'Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['hv'],
        description: 'Standard deviation of log returns (realized volatility)',
    },

    ATR_BANDS: {
        id: 'ATR_BANDS',
        name: 'ATR Bands',
        shortName: 'ATR Bands',
        category: 'volatility',
        paneType: 'overlay',
        renderType: 'bands',
        params: [
            { name: 'atrPeriod', label: 'ATR Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'multiplier', label: 'Multiplier', type: 'number', default: 2, min: 0.5, max: 5, step: 0.5 },
            { name: 'maType', label: 'MA Type', type: 'select', default: 'EMA', options: [
                { value: 'SMA', label: 'SMA' },
                { value: 'EMA', label: 'EMA' },
            ]},
            { name: 'maPeriod', label: 'MA Period', type: 'number', default: 20, min: 1, max: 200 },
            { name: 'bandsColor', label: 'Bands Color', type: 'color', default: '#ff980033' },
        ],
        outputs: ['upper', 'middle', 'lower'],
        description: 'Bands using ATR around a moving average',
    },

    // ========================================================================
    // VOLUME INDICATORS
    // ========================================================================
    OBV: {
        id: 'OBV',
        name: 'On Balance Volume',
        shortName: 'OBV',
        category: 'volume',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'color', label: 'Color', type: 'color', default: '#26a69a' },
            { name: 'showMA', label: 'Show MA', type: 'boolean', default: true },
            { name: 'maPeriod', label: 'MA Period', type: 'number', default: 20, min: 1, max: 100 },
        ],
        outputs: ['obv', 'ma'],
        description: 'Cumulative volume based on price direction',
    },

    MFI: {
        id: 'MFI',
        name: 'Money Flow Index',
        shortName: 'MFI',
        category: 'volume',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100 },
            { name: 'color', label: 'Color', type: 'color', default: '#ab47bc' },
            { name: 'overbought', label: 'Overbought', type: 'number', default: 80, min: 50, max: 100 },
            { name: 'oversold', label: 'Oversold', type: 'number', default: 20, min: 0, max: 50 },
        ],
        outputs: ['mfi'],
        description: 'Volume-weighted RSI using typical price (0-100)',
    },

    CMF: {
        id: 'CMF',
        name: 'Chaikin Money Flow',
        shortName: 'CMF',
        category: 'volume',
        paneType: 'separate',
        renderType: 'histogram',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 100 },
            { name: 'positiveColor', label: 'Positive Color', type: 'color', default: '#26a69a' },
            { name: 'negativeColor', label: 'Negative Color', type: 'color', default: '#ef5350' },
        ],
        outputs: ['cmf'],
        description: 'Measures accumulation/distribution over period (-1 to 1)',
    },

    ADL: {
        id: 'ADL',
        name: 'Accumulation/Distribution Line',
        shortName: 'A/D',
        category: 'volume',
        paneType: 'separate',
        renderType: 'line',
        params: [
            { name: 'color', label: 'Color', type: 'color', default: '#2962ff' },
        ],
        outputs: ['adl'],
        description: 'Cumulative indicator combining price and volume',
    },

    VWMA: {
        id: 'VWMA',
        name: 'Volume Weighted Moving Average',
        shortName: 'VWMA',
        category: 'volume',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 200 },
            { name: 'color', label: 'Color', type: 'color', default: '#ff6d00' },
        ],
        outputs: ['vwma'],
        description: 'Moving average weighted by volume',
    },

    VOLUME_PROFILE: {
        id: 'VOLUME_PROFILE',
        name: 'Volume Profile',
        shortName: 'VP',
        category: 'volume',
        paneType: 'overlay',
        renderType: 'profile',
        params: [
            { name: 'numRows', label: 'Rows', type: 'number', default: 24, min: 10, max: 100 },
            { name: 'valueAreaPct', label: 'Value Area %', type: 'number', default: 70, min: 50, max: 90 },
            { name: 'upColor', label: 'Up Color', type: 'color', default: '#26a69a66' },
            { name: 'downColor', label: 'Down Color', type: 'color', default: '#ef535066' },
            { name: 'pocColor', label: 'POC Color', type: 'color', default: '#ff9800' },
        ],
        outputs: ['profile', 'poc', 'vah', 'val'],
        description: 'Volume distribution by price level',
    },

    // ========================================================================
    // PROFILE INDICATORS
    // ========================================================================
    VRVP: {
        id: 'VRVP',
        name: 'Visible Range Volume Profile',
        shortName: 'VRVP',
        category: 'profile',
        paneType: 'overlay',
        renderType: 'profile',
        params: [
            { name: 'numRows', label: 'Rows', type: 'number', default: 24, min: 10, max: 100 },
            { name: 'valueAreaPct', label: 'Value Area %', type: 'number', default: 70, min: 50, max: 90 },
            { name: 'upColor', label: 'Up Color', type: 'color', default: '#26a69a66' },
            { name: 'downColor', label: 'Down Color', type: 'color', default: '#ef535066' },
        ],
        outputs: ['profile', 'poc', 'vah', 'val'],
        description: 'Volume profile for visible chart range',
    },

    ANCHORED_VWAP: {
        id: 'ANCHORED_VWAP',
        name: 'Anchored VWAP',
        shortName: 'A-VWAP',
        category: 'profile',
        paneType: 'overlay',
        renderType: 'line',
        params: [
            { name: 'anchorDate', label: 'Anchor Date', type: 'number', default: 0 },
            { name: 'color', label: 'Color', type: 'color', default: '#ab47bc' },
            { name: 'showBands', label: 'Show Bands', type: 'boolean', default: true },
            { name: 'bandMultiplier', label: 'Band Multiplier', type: 'number', default: 2, min: 1, max: 5 },
        ],
        outputs: ['vwap', 'upper', 'lower'],
        description: 'VWAP starting from a specific anchor point',
    },

    VWAP_BANDS: {
        id: 'VWAP_BANDS',
        name: 'VWAP with Bands',
        shortName: 'VWAP Bands',
        category: 'profile',
        paneType: 'overlay',
        renderType: 'bands',
        params: [
            { name: 'stdDev1', label: 'Std Dev 1', type: 'number', default: 1, min: 0.5, max: 3, step: 0.5 },
            { name: 'stdDev2', label: 'Std Dev 2', type: 'number', default: 2, min: 1, max: 5, step: 0.5 },
            { name: 'vwapColor', label: 'VWAP Color', type: 'color', default: '#ab47bc' },
            { name: 'band1Color', label: 'Band 1 Color', type: 'color', default: '#ab47bc33' },
            { name: 'band2Color', label: 'Band 2 Color', type: 'color', default: '#ab47bc22' },
        ],
        outputs: ['vwap', 'upper1', 'lower1', 'upper2', 'lower2'],
        description: 'VWAP with standard deviation bands',
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getIndicatorsByCategory(category: IndicatorCategory): IndicatorDefinition[] {
    return Object.values(INDICATOR_REGISTRY).filter(i => i.category === category);
}

export function getIndicatorDefinition(type: IndicatorType): IndicatorDefinition | undefined {
    return INDICATOR_REGISTRY[type];
}

export function getAllIndicators(): IndicatorDefinition[] {
    return Object.values(INDICATOR_REGISTRY);
}

export function getOverlayIndicators(): IndicatorDefinition[] {
    return Object.values(INDICATOR_REGISTRY).filter(i => i.paneType === 'overlay');
}

export function getSeparateIndicators(): IndicatorDefinition[] {
    return Object.values(INDICATOR_REGISTRY).filter(i => i.paneType === 'separate');
}

// Category display names
export const CATEGORY_NAMES: Record<IndicatorCategory, string> = {
    trend: 'Trend',
    momentum: 'Momentum',
    volatility: 'Volatility',
    volume: 'Volume',
    profile: 'Profile',
};

// Preset packs - includes type, default period, and color for quick setup
interface PresetIndicator {
    type: IndicatorType;
    period: number;
    color: string;
}

interface Preset {
    name: string;
    description: string;
    indicators: PresetIndicator[];
}

export const INDICATOR_PRESETS: Record<string, Preset> = {
    momentum: {
        name: 'Momentum Pack',
        description: 'RSI, MACD, and Stochastic for momentum analysis',
        indicators: [
            { type: 'RSI', period: 14, color: '#7e57c2' },
            { type: 'MACD', period: 12, color: '#26a69a' },
            { type: 'STOCH', period: 14, color: '#ef5350' },
        ],
    },
    volatility: {
        name: 'Volatility Pack',
        description: 'Bollinger, ATR, and Keltner for volatility analysis',
        indicators: [
            { type: 'BOLLINGER', period: 20, color: '#2962ff' },
            { type: 'ATR', period: 14, color: '#ff9800' },
            { type: 'KELTNER', period: 20, color: '#00bcd4' },
        ],
    },
    volume: {
        name: 'Volume Pack',
        description: 'OBV, MFI, and VWAP for volume analysis',
        indicators: [
            { type: 'OBV', period: 0, color: '#4caf50' },
            { type: 'MFI', period: 14, color: '#9c27b0' },
            { type: 'VWAP', period: 0, color: '#ab47bc' },
        ],
    },
    trend: {
        name: 'Trend Pack',
        description: 'EMA, Supertrend, and ADX for trend analysis',
        indicators: [
            { type: 'EMA', period: 20, color: '#ff6d00' },
            { type: 'SUPERTREND', period: 10, color: '#26a69a' },
            { type: 'ADX', period: 14, color: '#ffeb3b' },
        ],
    },
    ichimoku: {
        name: 'Ichimoku Cloud',
        description: 'Complete Ichimoku Cloud setup',
        indicators: [
            { type: 'ICHIMOKU', period: 9, color: '#e91e63' },
        ],
    },
};