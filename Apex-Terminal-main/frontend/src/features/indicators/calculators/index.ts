/**
 * Indicator Calculators - Central Export
 * 
 * All indicator calculation functions organized by category
 */

// ============================================================================
// TREND INDICATORS
// ============================================================================
export {
    calculateIchimoku,
    calculateSupertrend,
    calculateSAR,
    calculateADX,
    calculateAroon,
    calculateMARibbon,
    type IchimokuResult,
    type SupertrendResult,
    type SARResult,
    type ADXResult,
    type AroonResult,
    type MARibbonResult,
} from './trend';

// ============================================================================
// MOMENTUM INDICATORS
// ============================================================================
export {
    calculateStochastic,
    calculateStochRSI,
    calculateCCI,
    calculateROC,
    calculateWilliamsR,
    calculateTRIX,
    calculateMomentum,
    type StochResult,
    type StochRSIResult,
} from './momentum';

// ============================================================================
// VOLATILITY INDICATORS
// ============================================================================
export {
    calculateKeltner,
    calculateDonchian,
    calculateBBWidth,
    calculateHV,
    calculateATRBands,
    type KeltnerResult,
    type DonchianResult,
    type ATRBandsResult,
} from './volatility';

// ============================================================================
// VOLUME INDICATORS
// ============================================================================
export {
    calculateOBV,
    calculateMFI,
    calculateCMF,
    calculateADL,
    calculateVWMA,
    calculateVolumeProfile,
    type OBVResult,
    type VolumeProfileRow,
    type VolumeProfileResult,
} from './volume';

// ============================================================================
// PROFILE & ANCHORED INDICATORS
// ============================================================================
export {
    calculateVRVP,
    calculateAnchoredVWAP,
    calculateVWAPBands,
    calculateTSV,
    calculateEOM,
    calculateForceIndex,
    type VRVPRow,
    type VRVPResult,
    type AnchoredVWAPResult,
    type VWAPBandsResult,
} from './profile';

// ============================================================================
// BASIC INDICATOR HELPERS (existing)
// ============================================================================

import type { Candle } from '../../../core/types';

interface DataPoint {
    time: number;
    value: number;
}

// Simple Moving Average
export function calculateSMA(candles: Candle[], period: number): DataPoint[] {
    const result: DataPoint[] = [];
    
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += candles[i - j].close;
        }
        result.push({ time: candles[i].time, value: sum / period });
    }
    
    return result;
}

// Exponential Moving Average
export function calculateEMA(candles: Candle[], period: number): DataPoint[] {
    const result: DataPoint[] = [];
    const k = 2 / (period + 1);
    let prevEma = NaN;
    
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        if (isNaN(prevEma)) {
            // Initialize with SMA
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            prevEma = sum / period;
        } else {
            prevEma = candles[i].close * k + prevEma * (1 - k);
        }
        
        result.push({ time: candles[i].time, value: prevEma });
    }
    
    return result;
}

// RSI - Relative Strength Index
export function calculateRSI(candles: Candle[], period: number = 14): DataPoint[] {
    const result: DataPoint[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            result.push({ time: candles[i].time, value: NaN });
            gains.push(0);
            losses.push(0);
            continue;
        }
        
        const change = candles[i].close - candles[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
        
        if (i < period) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        // Calculate average gain/loss
        let avgGain = 0;
        let avgLoss = 0;
        
        if (i === period) {
            // First RSI uses simple average
            for (let j = 1; j <= period; j++) {
                avgGain += gains[j];
                avgLoss += losses[j];
            }
            avgGain /= period;
            avgLoss /= period;
        } else {
            // Subsequent uses smoothed average
            const prevAvgGain = result[i - 1].value !== null 
                ? (100 - result[i - 1].value!) > 0 
                    ? result[i - 1].value! / (100 - result[i - 1].value!) 
                    : 0 
                : 0;
            avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
            avgLoss = avgLoss * (period - 1) + losses[i];
            avgLoss /= period;
        }
        
        if (avgLoss === 0) {
            result.push({ time: candles[i].time, value: 100 });
        } else {
            const rs = avgGain / avgLoss;
            result.push({ time: candles[i].time, value: 100 - (100 / (1 + rs)) });
        }
    }
    
    return result;
}

// MACD
export interface MACDResult {
    macd: DataPoint[];
    signal: DataPoint[];
    histogram: DataPoint[];
}

export function calculateMACD(
    candles: Candle[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): MACDResult {
    const fastEma = calculateEMA(candles, fastPeriod);
    const slowEma = calculateEMA(candles, slowPeriod);
    
    const macdLine: DataPoint[] = [];
    const macdValues: number[] = [];
    
    for (let i = 0; i < candles.length; i++) {
        const fast = fastEma[i]?.value;
        const slow = slowEma[i]?.value;
        
        if (isNaN(fast) || isNaN(slow)) {
            macdLine.push({ time: candles[i].time, value: NaN });
            macdValues.push(NaN);
        } else {
            const macdVal = fast - slow;
            macdLine.push({ time: candles[i].time, value: macdVal });
            macdValues.push(macdVal);
        }
    }
    
    // Calculate signal line (EMA of MACD)
    const signal: DataPoint[] = [];
    const k = 2 / (signalPeriod + 1);
    let prevSignal = NaN;
    
    for (let i = 0; i < macdValues.length; i++) {
        if (isNaN(macdValues[i])) {
            signal.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        if (isNaN(prevSignal)) {
            prevSignal = macdValues[i];
        } else {
            prevSignal = macdValues[i] * k + prevSignal * (1 - k);
        }
        
        signal.push({ time: candles[i].time, value: prevSignal });
    }
    
    // Calculate histogram
    const histogram: DataPoint[] = [];
    for (let i = 0; i < candles.length; i++) {
        const macdVal = macdLine[i]?.value;
        const signalVal = signal[i]?.value;
        
        if (isNaN(macdVal) || isNaN(signalVal)) {
            histogram.push({ time: candles[i].time, value: NaN });
        } else {
            histogram.push({ time: candles[i].time, value: macdVal - signalVal });
        }
    }
    
    return { macd: macdLine, signal, histogram };
}

// Bollinger Bands
export interface BollingerResult {
    upper: DataPoint[];
    middle: DataPoint[];
    lower: DataPoint[];
}

export function calculateBollinger(
    candles: Candle[],
    period: number = 20,
    stdDev: number = 2
): BollingerResult {
    const sma = calculateSMA(candles, period);
    const upper: DataPoint[] = [];
    const lower: DataPoint[] = [];
    
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            upper.push({ time: candles[i].time, value: NaN });
            lower.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        // Calculate standard deviation
        let sumSquares = 0;
        for (let j = 0; j < period; j++) {
            const diff = candles[i - j].close - sma[i].value;
            sumSquares += diff * diff;
        }
        const std = Math.sqrt(sumSquares / period);
        
        upper.push({ time: candles[i].time, value: sma[i].value + stdDev * std });
        lower.push({ time: candles[i].time, value: sma[i].value - stdDev * std });
    }
    
    return { upper, middle: sma, lower };
}

// ATR - Average True Range
export function calculateATR(candles: Candle[], period: number = 14): DataPoint[] {
    const result: DataPoint[] = [];
    const trueRanges: number[] = [];
    
    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            trueRanges.push(candles[i].high - candles[i].low);
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        );
        trueRanges.push(tr);
        
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }
        
        if (i === period - 1) {
            // First ATR is simple average
            let sum = 0;
            for (let j = 0; j <= i; j++) {
                sum += trueRanges[j];
            }
            result.push({ time: candles[i].time, value: sum / period });
        } else {
            // Subsequent ATR uses smoothing
            const prevAtr = result[i - 1].value;
            const atr = (prevAtr * (period - 1) + tr) / period;
            result.push({ time: candles[i].time, value: atr });
        }
    }
    
    return result;
}

// VWAP - Volume Weighted Average Price
export function calculateVWAP(candles: Candle[]): DataPoint[] {
    const result: DataPoint[] = [];
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    
    // Detect session boundaries (simple: new day)
    let lastDate: number | null = null;
    
    for (let i = 0; i < candles.length; i++) {
        const date = new Date(candles[i].time * 1000).getDate();
        
        if (lastDate !== null && date !== lastDate) {
            // New session, reset
            cumulativePV = 0;
            cumulativeVolume = 0;
        }
        lastDate = date;
        
        const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
        cumulativePV += tp * candles[i].volume;
        cumulativeVolume += candles[i].volume;
        
        const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : tp;
        result.push({ time: candles[i].time, value: vwap });
    }
    
    return result;
}
