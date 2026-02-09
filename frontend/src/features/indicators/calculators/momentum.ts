/**
 * Momentum Indicator Calculators
 * 
 * Includes: Stochastic, Stochastic RSI, CCI, ROC, Williams %R, TRIX, Momentum
 */

import type { Candle } from '../../../core/types';

interface DataPoint {
    time: number;
    value: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sma(values: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += values[i - j];
        }
        result.push(sum / period);
    }
    return result;
}

function ema(values: number[], period: number): number[] {
    const result: number[] = [];
    const k = 2 / (period + 1);
    let prevEma = NaN;

    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (isNaN(val)) {
            result.push(NaN);
            continue;
        }

        if (isNaN(prevEma)) {
            prevEma = val;
            result.push(prevEma);
        } else {
            prevEma = val * k + prevEma * (1 - k);
            result.push(prevEma);
        }
    }
    return result;
}

function highest(values: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let max = -Infinity;
        for (let j = 0; j < period; j++) {
            if (!isNaN(values[i - j])) {
                max = Math.max(max, values[i - j]);
            }
        }
        result.push(max === -Infinity ? NaN : max);
    }
    return result;
}

function lowest(values: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let min = Infinity;
        for (let j = 0; j < period; j++) {
            if (!isNaN(values[i - j])) {
                min = Math.min(min, values[i - j]);
            }
        }
        result.push(min === Infinity ? NaN : min);
    }
    return result;
}

// ============================================================================
// STOCHASTIC OSCILLATOR
// ============================================================================

export interface StochResult {
    k: DataPoint[];
    d: DataPoint[];
}

export function calculateStochastic(
    candles: Candle[],
    kPeriod: number = 14,
    dPeriod: number = 3,
    smooth: number = 3
): StochResult {
    const k: DataPoint[] = [];
    const d: DataPoint[] = [];

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const highestHigh = highest(highs, kPeriod);
    const lowestLow = lowest(lows, kPeriod);

    // Calculate raw %K
    const rawK: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (isNaN(highestHigh[i]) || isNaN(lowestLow[i])) {
            rawK.push(NaN);
            continue;
        }
        const range = highestHigh[i] - lowestLow[i];
        if (range === 0) {
            rawK.push(50);
        } else {
            rawK.push(((candles[i].close - lowestLow[i]) / range) * 100);
        }
    }

    // Smooth %K
    const smoothK = sma(rawK, smooth);

    // Calculate %D (SMA of smoothed %K)
    const dValues = sma(smoothK, dPeriod);

    // Build result
    for (let i = 0; i < candles.length; i++) {
        k.push({ time: candles[i].time, value: smoothK[i] });
        d.push({ time: candles[i].time, value: dValues[i] });
    }

    return { k, d };
}

// ============================================================================
// STOCHASTIC RSI
// ============================================================================

export interface StochRSIResult {
    k: DataPoint[];
    d: DataPoint[];
}

export function calculateStochRSI(
    candles: Candle[],
    rsiPeriod: number = 14,
    stochPeriod: number = 14,
    kSmooth: number = 3,
    dSmooth: number = 3
): StochRSIResult {
    const k: DataPoint[] = [];
    const d: DataPoint[] = [];

    // First calculate RSI
    const rsiValues: number[] = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            rsiValues.push(NaN);
            continue;
        }

        const change = candles[i].close - candles[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        if (i < rsiPeriod) {
            avgGain += gain / rsiPeriod;
            avgLoss += loss / rsiPeriod;
            rsiValues.push(NaN);
            continue;
        }

        if (i === rsiPeriod) {
            avgGain = avgGain;
            avgLoss = avgLoss;
        } else {
            avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
            avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
        }

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        rsiValues.push(rsi);
    }

    // Apply Stochastic to RSI
    const highestRsi = highest(rsiValues, stochPeriod);
    const lowestRsi = lowest(rsiValues, stochPeriod);

    const rawK: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (isNaN(highestRsi[i]) || isNaN(lowestRsi[i]) || isNaN(rsiValues[i])) {
            rawK.push(NaN);
            continue;
        }
        const range = highestRsi[i] - lowestRsi[i];
        if (range === 0) {
            rawK.push(50);
        } else {
            rawK.push(((rsiValues[i] - lowestRsi[i]) / range) * 100);
        }
    }

    // Smooth %K and calculate %D
    const smoothK = sma(rawK, kSmooth);
    const dValues = sma(smoothK, dSmooth);

    for (let i = 0; i < candles.length; i++) {
        k.push({ time: candles[i].time, value: smoothK[i] });
        d.push({ time: candles[i].time, value: dValues[i] });
    }

    return { k, d };
}

// ============================================================================
// COMMODITY CHANNEL INDEX (CCI)
// ============================================================================

export function calculateCCI(candles: Candle[], period: number = 20): DataPoint[] {
    const result: DataPoint[] = [];

    // Calculate typical price
    const tp: number[] = candles.map(c => (c.high + c.low + c.close) / 3);

    // Calculate SMA of typical price
    const tpSma = sma(tp, period);

    // Calculate mean deviation
    for (let i = 0; i < candles.length; i++) {
        if (isNaN(tpSma[i])) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        // Mean deviation
        let sumDev = 0;
        for (let j = 0; j < period; j++) {
            sumDev += Math.abs(tp[i - j] - tpSma[i]);
        }
        const meanDev = sumDev / period;

        // CCI formula
        const cci = meanDev === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * meanDev);
        result.push({ time: candles[i].time, value: cci });
    }

    return result;
}

// ============================================================================
// RATE OF CHANGE (ROC)
// ============================================================================

export function calculateROC(candles: Candle[], period: number = 12): DataPoint[] {
    const result: DataPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        const prevClose = candles[i - period].close;
        const roc = prevClose === 0 ? 0 : ((candles[i].close - prevClose) / prevClose) * 100;
        result.push({ time: candles[i].time, value: roc });
    }

    return result;
}

// ============================================================================
// WILLIAMS %R
// ============================================================================

export function calculateWilliamsR(candles: Candle[], period: number = 14): DataPoint[] {
    const result: DataPoint[] = [];

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const highestHigh = highest(highs, period);
    const lowestLow = lowest(lows, period);

    for (let i = 0; i < candles.length; i++) {
        if (isNaN(highestHigh[i]) || isNaN(lowestLow[i])) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        const range = highestHigh[i] - lowestLow[i];
        if (range === 0) {
            result.push({ time: candles[i].time, value: -50 });
        } else {
            const willR = ((highestHigh[i] - candles[i].close) / range) * -100;
            result.push({ time: candles[i].time, value: willR });
        }
    }

    return result;
}

// ============================================================================
// TRIX
// ============================================================================

export interface TRIXResult {
    trix: DataPoint[];
    signal: DataPoint[];
}

export function calculateTRIX(
    candles: Candle[],
    period: number = 15,
    signalPeriod: number = 9
): TRIXResult {
    const trix: DataPoint[] = [];
    const signal: DataPoint[] = [];

    const closes = candles.map(c => c.close);

    // Triple EMA
    const ema1 = ema(closes, period);
    const ema2 = ema(ema1, period);
    const ema3 = ema(ema2, period);

    // Calculate TRIX (percentage change of triple EMA)
    const trixValues: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (i === 0 || isNaN(ema3[i]) || isNaN(ema3[i - 1]) || ema3[i - 1] === 0) {
            trixValues.push(NaN);
            continue;
        }
        const trixVal = ((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 100;
        trixValues.push(trixVal);
    }

    // Signal line (EMA of TRIX)
    const signalValues = ema(trixValues, signalPeriod);

    for (let i = 0; i < candles.length; i++) {
        trix.push({ time: candles[i].time, value: trixValues[i] });
        signal.push({ time: candles[i].time, value: signalValues[i] });
    }

    return { trix, signal };
}

// ============================================================================
// MOMENTUM
// ============================================================================

export function calculateMomentum(candles: Candle[], period: number = 10): DataPoint[] {
    const result: DataPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        const momentum = candles[i].close - candles[i - period].close;
        result.push({ time: candles[i].time, value: momentum });
    }

    return result;
}
