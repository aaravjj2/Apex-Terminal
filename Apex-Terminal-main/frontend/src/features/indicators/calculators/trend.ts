/**
 * Trend Indicator Calculators
 * 
 * Includes: Ichimoku, Supertrend, SAR, ADX/DMI, Aroon, MA Ribbon
 */

import type { Candle } from '../../../core/types';

interface DataPoint {
    time: number;
    value: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function highest(candles: Candle[], period: number, field: 'high' | 'low' | 'close' = 'high'): number[] {
    const result: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let max = -Infinity;
        for (let j = 0; j < period; j++) {
            max = Math.max(max, candles[i - j][field]);
        }
        result.push(max);
    }
    return result;
}

function lowest(candles: Candle[], period: number, field: 'high' | 'low' | 'close' = 'low'): number[] {
    const result: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
            continue;
        }
        let min = Infinity;
        for (let j = 0; j < period; j++) {
            min = Math.min(min, candles[i - j][field]);
        }
        result.push(min);
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
            // Initialize with first value
            prevEma = val;
            result.push(prevEma);
        } else {
            prevEma = val * k + prevEma * (1 - k);
            result.push(prevEma);
        }
    }
    return result;
}

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

// ============================================================================
// ICHIMOKU CLOUD
// ============================================================================

export interface IchimokuResult {
    tenkan: DataPoint[];
    kijun: DataPoint[];
    senkouA: DataPoint[];
    senkouB: DataPoint[];
    chikou: DataPoint[];
}

export function calculateIchimoku(
    candles: Candle[],
    tenkanPeriod: number = 9,
    kijunPeriod: number = 26,
    senkouPeriod: number = 52,
    _displacement: number = 26 // displacement handled at render time
): IchimokuResult {
    const tenkan: DataPoint[] = [];
    const kijun: DataPoint[] = [];
    const senkouA: DataPoint[] = [];
    const senkouB: DataPoint[] = [];
    const chikou: DataPoint[] = [];

    const highestHighTenkan = highest(candles, tenkanPeriod, 'high');
    const lowestLowTenkan = lowest(candles, tenkanPeriod, 'low');
    const highestHighKijun = highest(candles, kijunPeriod, 'high');
    const lowestLowKijun = lowest(candles, kijunPeriod, 'low');
    const highestHighSenkou = highest(candles, senkouPeriod, 'high');
    const lowestLowSenkou = lowest(candles, senkouPeriod, 'low');

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        // Tenkan-sen (Conversion Line)
        const tenkanVal = (highestHighTenkan[i] + lowestLowTenkan[i]) / 2;
        tenkan.push({ time, value: tenkanVal });

        // Kijun-sen (Base Line)
        const kijunVal = (highestHighKijun[i] + lowestLowKijun[i]) / 2;
        kijun.push({ time, value: kijunVal });

        // Senkou Span A (Leading Span A) - displaced forward
        const spanA = (tenkanVal + kijunVal) / 2;
        // We push it at current time but it represents future
        // For charting, we'll need to handle displacement in rendering
        senkouA.push({ time, value: spanA });

        // Senkou Span B (Leading Span B)
        const spanB = (highestHighSenkou[i] + lowestLowSenkou[i]) / 2;
        senkouB.push({ time, value: spanB });

        // Chikou Span (Lagging Span) - current close displaced backward
        // This is typically rendered displacement periods back
        chikou.push({ time, value: candles[i].close });
    }

    return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ============================================================================
// SUPERTREND
// ============================================================================

export interface SupertrendResult {
    supertrend: DataPoint[];
    direction: DataPoint[]; // 1 = up, -1 = down
}

export function calculateSupertrend(
    candles: Candle[],
    period: number = 10,
    multiplier: number = 3
): SupertrendResult {
    const supertrend: DataPoint[] = [];
    const direction: DataPoint[] = [];

    const tr = trueRange(candles);
    const atr: number[] = [];

    // Calculate ATR using Wilder's smoothing
    let atrSum = 0;
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            atrSum += tr[i];
            atr.push(NaN);
            continue;
        }
        if (i === period - 1) {
            atrSum += tr[i];
            atr.push(atrSum / period);
        } else {
            atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
        }
    }

    let prevSupertrend = 0;
    let prevUpperBand = 0;
    let prevLowerBand = 0;

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (isNaN(atr[i])) {
            supertrend.push({ time, value: NaN });
            direction.push({ time, value: NaN });
            continue;
        }

        const hl2 = (candles[i].high + candles[i].low) / 2;
        const basicUpperBand = hl2 + multiplier * atr[i];
        const basicLowerBand = hl2 - multiplier * atr[i];

        // Calculate final bands
        const upperBand = basicUpperBand < prevUpperBand || candles[i - 1]?.close > prevUpperBand
            ? basicUpperBand
            : prevUpperBand;

        const lowerBand = basicLowerBand > prevLowerBand || candles[i - 1]?.close < prevLowerBand
            ? basicLowerBand
            : prevLowerBand;

        // Calculate supertrend and direction
        let currentSupertrend: number;
        let currentDirection: number;

        if (prevSupertrend === prevUpperBand) {
            currentDirection = candles[i].close <= upperBand ? -1 : 1;
        } else {
            currentDirection = candles[i].close >= lowerBand ? 1 : -1;
        }

        currentSupertrend = currentDirection === 1 ? lowerBand : upperBand;

        supertrend.push({ time, value: currentSupertrend });
        direction.push({ time, value: currentDirection });

        prevSupertrend = currentSupertrend;
        prevUpperBand = upperBand;
        prevLowerBand = lowerBand;
    }

    return { supertrend, direction };
}

// ============================================================================
// PARABOLIC SAR
// ============================================================================

export interface SARResult {
    sar: DataPoint[];
    direction: DataPoint[]; // 1 = up, -1 = down
}

export function calculateSAR(
    candles: Candle[],
    acceleration: number = 0.02,
    maximum: number = 0.2
): SARResult {
    const sar: DataPoint[] = [];
    const direction: DataPoint[] = [];

    if (candles.length < 2) {
        return { sar: [], direction: [] };
    }

    let isUpTrend = candles[1].close > candles[0].close;
    let extremePoint = isUpTrend ? candles[0].high : candles[0].low;
    let sarValue = isUpTrend ? candles[0].low : candles[0].high;
    let af = acceleration;

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (i === 0) {
            sar.push({ time, value: sarValue });
            direction.push({ time, value: isUpTrend ? 1 : -1 });
            continue;
        }

        const prevSar = sarValue;

        // Calculate new SAR
        sarValue = prevSar + af * (extremePoint - prevSar);

        // Ensure SAR is within prior two bars' range
        if (isUpTrend) {
            sarValue = Math.min(sarValue, candles[i - 1].low, i > 1 ? candles[i - 2].low : candles[i - 1].low);
        } else {
            sarValue = Math.max(sarValue, candles[i - 1].high, i > 1 ? candles[i - 2].high : candles[i - 1].high);
        }

        // Check for trend reversal
        let reversed = false;
        if (isUpTrend && candles[i].low < sarValue) {
            reversed = true;
            isUpTrend = false;
            sarValue = extremePoint;
            extremePoint = candles[i].low;
            af = acceleration;
        } else if (!isUpTrend && candles[i].high > sarValue) {
            reversed = true;
            isUpTrend = true;
            sarValue = extremePoint;
            extremePoint = candles[i].high;
            af = acceleration;
        }

        // Update extreme point and AF
        if (!reversed) {
            if (isUpTrend && candles[i].high > extremePoint) {
                extremePoint = candles[i].high;
                af = Math.min(af + acceleration, maximum);
            } else if (!isUpTrend && candles[i].low < extremePoint) {
                extremePoint = candles[i].low;
                af = Math.min(af + acceleration, maximum);
            }
        }

        sar.push({ time, value: sarValue });
        direction.push({ time, value: isUpTrend ? 1 : -1 });
    }

    return { sar, direction };
}

// ============================================================================
// ADX / DMI
// ============================================================================

export interface ADXResult {
    adx: DataPoint[];
    diPlus: DataPoint[];
    diMinus: DataPoint[];
}

export function calculateADX(candles: Candle[], period: number = 14): ADXResult {
    const adx: DataPoint[] = [];
    const diPlus: DataPoint[] = [];
    const diMinus: DataPoint[] = [];

    const tr = trueRange(candles);

    // Calculate +DM and -DM
    const dmPlus: number[] = [];
    const dmMinus: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            dmPlus.push(0);
            dmMinus.push(0);
            continue;
        }

        const upMove = candles[i].high - candles[i - 1].high;
        const downMove = candles[i - 1].low - candles[i].low;

        if (upMove > downMove && upMove > 0) {
            dmPlus.push(upMove);
        } else {
            dmPlus.push(0);
        }

        if (downMove > upMove && downMove > 0) {
            dmMinus.push(downMove);
        } else {
            dmMinus.push(0);
        }
    }

    // Smooth TR, +DM, -DM using Wilder's smoothing
    const smoothTr: number[] = [];
    const smoothDmPlus: number[] = [];
    const smoothDmMinus: number[] = [];

    let trSum = 0, dmPlusSum = 0, dmMinusSum = 0;

    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            trSum += tr[i];
            dmPlusSum += dmPlus[i];
            dmMinusSum += dmMinus[i];
            smoothTr.push(NaN);
            smoothDmPlus.push(NaN);
            smoothDmMinus.push(NaN);
            continue;
        }

        if (i === period - 1) {
            trSum += tr[i];
            dmPlusSum += dmPlus[i];
            dmMinusSum += dmMinus[i];
            smoothTr.push(trSum);
            smoothDmPlus.push(dmPlusSum);
            smoothDmMinus.push(dmMinusSum);
        } else {
            smoothTr.push(smoothTr[i - 1] - smoothTr[i - 1] / period + tr[i]);
            smoothDmPlus.push(smoothDmPlus[i - 1] - smoothDmPlus[i - 1] / period + dmPlus[i]);
            smoothDmMinus.push(smoothDmMinus[i - 1] - smoothDmMinus[i - 1] / period + dmMinus[i]);
        }
    }

    // Calculate DI+ and DI-
    const diPlusValues: number[] = [];
    const diMinusValues: number[] = [];
    const dx: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (isNaN(smoothTr[i])) {
            diPlusValues.push(NaN);
            diMinusValues.push(NaN);
            dx.push(NaN);
            continue;
        }

        const diPlusVal = (smoothDmPlus[i] / smoothTr[i]) * 100;
        const diMinusVal = (smoothDmMinus[i] / smoothTr[i]) * 100;
        diPlusValues.push(diPlusVal);
        diMinusValues.push(diMinusVal);

        const diSum = diPlusVal + diMinusVal;
        const dxVal = diSum !== 0 ? Math.abs(diPlusVal - diMinusVal) / diSum * 100 : 0;
        dx.push(dxVal);
    }

    // Calculate ADX (smoothed DX)
    let adxSum = 0;
    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (isNaN(dx[i])) {
            adx.push({ time, value: NaN });
            diPlus.push({ time, value: NaN });
            diMinus.push({ time, value: NaN });
            continue;
        }

        // Start ADX calculation after we have period DX values
        const startIdx = period - 1 + period - 1;
        if (i < startIdx) {
            if (i >= period - 1) {
                adxSum += dx[i];
            }
            adx.push({ time, value: NaN });
            diPlus.push({ time, value: diPlusValues[i] });
            diMinus.push({ time, value: diMinusValues[i] });
            continue;
        }

        if (i === startIdx) {
            adxSum += dx[i];
            const adxVal = adxSum / period;
            adx.push({ time, value: adxVal });
        } else {
            const prevAdx = adx[i - 1].value;
            const adxVal = (prevAdx * (period - 1) + dx[i]) / period;
            adx.push({ time, value: adxVal });
        }

        diPlus.push({ time, value: diPlusValues[i] });
        diMinus.push({ time, value: diMinusValues[i] });
    }

    return { adx, diPlus, diMinus };
}

// ============================================================================
// AROON
// ============================================================================

export interface AroonResult {
    aroonUp: DataPoint[];
    aroonDown: DataPoint[];
    oscillator: DataPoint[];
}

export function calculateAroon(candles: Candle[], period: number = 25): AroonResult {
    const aroonUp: DataPoint[] = [];
    const aroonDown: DataPoint[] = [];
    const oscillator: DataPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
        const time = candles[i].time;

        if (i < period - 1) {
            aroonUp.push({ time, value: NaN });
            aroonDown.push({ time, value: NaN });
            oscillator.push({ time, value: NaN });
            continue;
        }

        // Find highest high and lowest low positions
        let highestIdx = i;
        let lowestIdx = i;
        let highestVal = candles[i].high;
        let lowestVal = candles[i].low;

        for (let j = 0; j < period; j++) {
            if (candles[i - j].high > highestVal) {
                highestVal = candles[i - j].high;
                highestIdx = i - j;
            }
            if (candles[i - j].low < lowestVal) {
                lowestVal = candles[i - j].low;
                lowestIdx = i - j;
            }
        }

        const daysSinceHigh = i - highestIdx;
        const daysSinceLow = i - lowestIdx;

        const upVal = ((period - daysSinceHigh) / period) * 100;
        const downVal = ((period - daysSinceLow) / period) * 100;

        aroonUp.push({ time, value: upVal });
        aroonDown.push({ time, value: downVal });
        oscillator.push({ time, value: upVal - downVal });
    }

    return { aroonUp, aroonDown, oscillator };
}

// ============================================================================
// MA RIBBON
// ============================================================================

export interface MARibbonResult {
    lines: DataPoint[][];
}

export function calculateMARibbon(
    candles: Candle[],
    periods: number[] = [8, 13, 21, 34, 55, 89],
    maType: 'SMA' | 'EMA' = 'EMA'
): MARibbonResult {
    const closes = candles.map(c => c.close);
    const lines: DataPoint[][] = [];

    for (const period of periods) {
        const maValues = maType === 'EMA' ? ema(closes, period) : sma(closes, period);
        const line: DataPoint[] = candles.map((c, i) => ({
            time: c.time,
            value: maValues[i],
        }));
        lines.push(line);
    }

    return { lines };
}
