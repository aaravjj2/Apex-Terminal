/**
 * Volatility Indicator Calculators
 * 
 * Includes: Keltner Channel, Donchian Channel, BB Width, Historical Volatility, ATR Bands
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

function trueRange(candles: Candle[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            result.push(candles[i].high - candles[i].low);
            continue;
        }
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        );
        result.push(tr);
    }
    return result;
}

function calculateATR(candles: Candle[], period: number): number[] {
    const tr = trueRange(candles);
    const result: number[] = [];

    let atrSum = 0;
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            atrSum += tr[i];
            result.push(NaN);
            continue;
        }
        if (i === period - 1) {
            atrSum += tr[i];
            result.push(atrSum / period);
        } else {
            result.push((result[i - 1] * (period - 1) + tr[i]) / period);
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
            max = Math.max(max, values[i - j]);
        }
        result.push(max);
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
            min = Math.min(min, values[i - j]);
        }
        result.push(min);
    }
    return result;
}

// ============================================================================
// KELTNER CHANNEL
// ============================================================================

export interface KeltnerResult {
    upper: DataPoint[];
    middle: DataPoint[];
    lower: DataPoint[];
}

export function calculateKeltner(
    candles: Candle[],
    emaPeriod: number = 20,
    atrPeriod: number = 10,
    multiplier: number = 2
): KeltnerResult {
    const upper: DataPoint[] = [];
    const middle: DataPoint[] = [];
    const lower: DataPoint[] = [];

    const closes = candles.map(c => c.close);
    const emaValues = ema(closes, emaPeriod);
    const atrValues = calculateATR(candles, atrPeriod);

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;
        const emaVal = emaValues[i];
        const atrVal = atrValues[i];

        if (isNaN(emaVal) || isNaN(atrVal)) {
            upper.push({ time, value: NaN });
            middle.push({ time, value: NaN });
            lower.push({ time, value: NaN });
            continue;
        }

        middle.push({ time, value: emaVal });
        upper.push({ time, value: emaVal + multiplier * atrVal });
        lower.push({ time, value: emaVal - multiplier * atrVal });
    }

    return { upper, middle, lower };
}

// ============================================================================
// DONCHIAN CHANNEL
// ============================================================================

export interface DonchianResult {
    upper: DataPoint[];
    middle: DataPoint[];
    lower: DataPoint[];
}

export function calculateDonchian(candles: Candle[], period: number = 20): DonchianResult {
    const upper: DataPoint[] = [];
    const middle: DataPoint[] = [];
    const lower: DataPoint[] = [];

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const highestHigh = highest(highs, period);
    const lowestLow = lowest(lows, period);

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;
        const high = highestHigh[i];
        const low = lowestLow[i];

        upper.push({ time, value: high });
        lower.push({ time, value: low });
        middle.push({ time, value: (high + low) / 2 });
    }

    return { upper, middle, lower };
}

// ============================================================================
// BOLLINGER BAND WIDTH & %B
// ============================================================================

export interface BBWidthResult {
    width: DataPoint[];
    percentB: DataPoint[];
}

export function calculateBBWidth(
    candles: Candle[],
    period: number = 20,
    stdDev: number = 2
): BBWidthResult {
    const width: DataPoint[] = [];
    const percentB: DataPoint[] = [];

    const closes = candles.map(c => c.close);
    const smaValues = sma(closes, period);

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (isNaN(smaValues[i])) {
            width.push({ time, value: NaN });
            percentB.push({ time, value: NaN });
            continue;
        }

        // Calculate standard deviation
        let sumSqDiff = 0;
        for (let j = 0; j < period; j++) {
            const diff = closes[i - j] - smaValues[i];
            sumSqDiff += diff * diff;
        }
        const sd = Math.sqrt(sumSqDiff / period);

        const upperBand = smaValues[i] + stdDev * sd;
        const lowerBand = smaValues[i] - stdDev * sd;
        const bandWidth = upperBand - lowerBand;

        // Width as percentage of middle band
        const widthPct = smaValues[i] !== 0 ? (bandWidth / smaValues[i]) * 100 : 0;
        width.push({ time, value: widthPct });

        // %B calculation
        const pctB = bandWidth !== 0 ? (closes[i] - lowerBand) / bandWidth : 0.5;
        percentB.push({ time, value: pctB * 100 });
    }

    return { width, percentB };
}

// ============================================================================
// HISTORICAL VOLATILITY
// ============================================================================

export function calculateHV(
    candles: Candle[],
    period: number = 20,
    annualize: boolean = true
): DataPoint[] {
    const result: DataPoint[] = [];

    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (i === 0 || candles[i - 1].close === 0) {
            logReturns.push(NaN);
            continue;
        }
        logReturns.push(Math.log(candles[i].close / candles[i - 1].close));
    }

    // Calculate rolling standard deviation of log returns
    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (i < period) {
            result.push({ time, value: NaN });
            continue;
        }

        // Mean of log returns
        let sum = 0;
        let validCount = 0;
        for (let j = 0; j < period; j++) {
            if (!isNaN(logReturns[i - j])) {
                sum += logReturns[i - j];
                validCount++;
            }
        }

        if (validCount < period) {
            result.push({ time, value: NaN });
            continue;
        }

        const mean = sum / period;

        // Standard deviation
        let sumSqDiff = 0;
        for (let j = 0; j < period; j++) {
            const diff = logReturns[i - j] - mean;
            sumSqDiff += diff * diff;
        }
        const stdDev = Math.sqrt(sumSqDiff / (period - 1));

        // Annualize if requested (assuming 252 trading days)
        const hv = annualize ? stdDev * Math.sqrt(252) * 100 : stdDev * 100;
        result.push({ time, value: hv });
    }

    return result;
}

// ============================================================================
// ATR BANDS
// ============================================================================

export interface ATRBandsResult {
    upper: DataPoint[];
    middle: DataPoint[];
    lower: DataPoint[];
}

export function calculateATRBands(
    candles: Candle[],
    atrPeriod: number = 14,
    multiplier: number = 2,
    maType: 'SMA' | 'EMA' = 'EMA',
    maPeriod: number = 20
): ATRBandsResult {
    const upper: DataPoint[] = [];
    const middle: DataPoint[] = [];
    const lower: DataPoint[] = [];

    const closes = candles.map(c => c.close);
    const maValues = maType === 'EMA' ? ema(closes, maPeriod) : sma(closes, maPeriod);
    const atrValues = calculateATR(candles, atrPeriod);

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;
        const maVal = maValues[i];
        const atrVal = atrValues[i];

        if (isNaN(maVal) || isNaN(atrVal)) {
            upper.push({ time, value: NaN });
            middle.push({ time, value: NaN });
            lower.push({ time, value: NaN });
            continue;
        }

        middle.push({ time, value: maVal });
        upper.push({ time, value: maVal + multiplier * atrVal });
        lower.push({ time, value: maVal - multiplier * atrVal });
    }

    return { upper, middle, lower };
}
