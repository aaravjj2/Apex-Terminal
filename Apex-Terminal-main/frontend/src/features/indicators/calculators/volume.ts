/**
 * Volume Indicator Calculators
 * 
 * Includes: OBV, MFI, CMF, A/D Line, VWMA, Volume Profile
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

// ============================================================================
// ON BALANCE VOLUME (OBV)
// ============================================================================

export interface OBVResult {
    obv: DataPoint[];
    ma: DataPoint[];
}

export function calculateOBV(
    candles: Candle[],
    showMA: boolean = true,
    maPeriod: number = 20
): OBVResult {
    const obv: DataPoint[] = [];
    const obvValues: number[] = [];

    let currentOBV = 0;

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            currentOBV = candles[i].volume;
        } else {
            if (candles[i].close > candles[i - 1].close) {
                currentOBV += candles[i].volume;
            } else if (candles[i].close < candles[i - 1].close) {
                currentOBV -= candles[i].volume;
            }
            // If close == prev close, OBV stays the same
        }

        obvValues.push(currentOBV);
        obv.push({ time: candles[i].time, value: currentOBV });
    }

    // Calculate MA of OBV
    const maValues = showMA ? sma(obvValues, maPeriod) : [];
    const ma: DataPoint[] = showMA
        ? candles.map((c, i) => ({ time: c.time, value: maValues[i] }))
        : [];

    return { obv, ma };
}

// ============================================================================
// MONEY FLOW INDEX (MFI)
// ============================================================================

export function calculateMFI(candles: Candle[], period: number = 14): DataPoint[] {
    const result: DataPoint[] = [];

    // Calculate typical price and raw money flow
    const typicalPrices: number[] = [];
    const moneyFlows: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
        typicalPrices.push(tp);
        moneyFlows.push(tp * candles[i].volume);
    }

    // Calculate MFI
    for (let i = 0; i < candles.length; i++) {
        if (i < period) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        let positiveFlow = 0;
        let negativeFlow = 0;

        for (let j = 0; j < period; j++) {
            const idx = i - j;
            if (idx > 0) {
                if (typicalPrices[idx] > typicalPrices[idx - 1]) {
                    positiveFlow += moneyFlows[idx];
                } else if (typicalPrices[idx] < typicalPrices[idx - 1]) {
                    negativeFlow += moneyFlows[idx];
                }
            }
        }

        const moneyRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
        const mfi = 100 - (100 / (1 + moneyRatio));

        result.push({ time: candles[i].time, value: mfi });
    }

    return result;
}

// ============================================================================
// CHAIKIN MONEY FLOW (CMF)
// ============================================================================

export function calculateCMF(candles: Candle[], period: number = 20): DataPoint[] {
    const result: DataPoint[] = [];

    // Calculate Money Flow Multiplier and Money Flow Volume
    const mfv: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const close = candles[i].close;
        const volume = candles[i].volume;

        // Money Flow Multiplier
        const range = high - low;
        const mfm = range === 0 ? 0 : ((close - low) - (high - close)) / range;

        // Money Flow Volume
        mfv.push(mfm * volume);
    }

    // Calculate CMF (sum of MFV / sum of Volume over period)
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        let sumMFV = 0;
        let sumVolume = 0;

        for (let j = 0; j < period; j++) {
            sumMFV += mfv[i - j];
            sumVolume += candles[i - j].volume;
        }

        const cmf = sumVolume === 0 ? 0 : sumMFV / sumVolume;
        result.push({ time: candles[i].time, value: cmf });
    }

    return result;
}

// ============================================================================
// ACCUMULATION/DISTRIBUTION LINE (A/D)
// ============================================================================

export function calculateADL(candles: Candle[]): DataPoint[] {
    const result: DataPoint[] = [];
    let adl = 0;

    for (let i = 0; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const close = candles[i].close;
        const volume = candles[i].volume;

        // Money Flow Multiplier
        const range = high - low;
        const mfm = range === 0 ? 0 : ((close - low) - (high - close)) / range;

        // A/D = previous A/D + (MFM * Volume)
        adl += mfm * volume;

        result.push({ time: candles[i].time, value: adl });
    }

    return result;
}

// ============================================================================
// VOLUME WEIGHTED MOVING AVERAGE (VWMA)
// ============================================================================

export function calculateVWMA(candles: Candle[], period: number = 20): DataPoint[] {
    const result: DataPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        let sumPriceVolume = 0;
        let sumVolume = 0;

        for (let j = 0; j < period; j++) {
            sumPriceVolume += candles[i - j].close * candles[i - j].volume;
            sumVolume += candles[i - j].volume;
        }

        const vwma = sumVolume === 0 ? candles[i].close : sumPriceVolume / sumVolume;
        result.push({ time: candles[i].time, value: vwma });
    }

    return result;
}

// ============================================================================
// VOLUME PROFILE
// ============================================================================

export interface VolumeProfileRow {
    priceLevel: number;
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
}

export interface VolumeProfileResult {
    profile: VolumeProfileRow[];
    poc: number; // Point of Control (price level with most volume)
    vah: number; // Value Area High
    val: number; // Value Area Low
    totalVolume: number;
}

export function calculateVolumeProfile(
    candles: Candle[],
    numRows: number = 24,
    valueAreaPct: number = 70
): VolumeProfileResult {
    if (candles.length === 0) {
        return { profile: [], poc: 0, vah: 0, val: 0, totalVolume: 0 };
    }

    // Find price range
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const candle of candles) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
    }

    const priceRange = maxPrice - minPrice;
    const rowHeight = priceRange / numRows;

    // Initialize profile rows
    const rows: VolumeProfileRow[] = [];
    for (let i = 0; i < numRows; i++) {
        rows.push({
            priceLevel: minPrice + (i + 0.5) * rowHeight,
            totalVolume: 0,
            buyVolume: 0,
            sellVolume: 0,
        });
    }

    // Distribute volume to rows
    let totalVolume = 0;

    for (const candle of candles) {
        // Determine which rows this candle spans
        const lowRow = Math.floor((candle.low - minPrice) / rowHeight);
        const highRow = Math.floor((candle.high - minPrice) / rowHeight);

        // Simple distribution: divide volume equally among spanned rows
        const numSpannedRows = highRow - lowRow + 1;
        const volumePerRow = candle.volume / numSpannedRows;

        const isBuy = candle.close >= candle.open;

        for (let row = lowRow; row <= highRow && row < numRows; row++) {
            if (row >= 0) {
                rows[row].totalVolume += volumePerRow;
                if (isBuy) {
                    rows[row].buyVolume += volumePerRow;
                } else {
                    rows[row].sellVolume += volumePerRow;
                }
            }
        }

        totalVolume += candle.volume;
    }

    // Find POC (row with highest volume)
    let pocIdx = 0;
    let maxVol = 0;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].totalVolume > maxVol) {
            maxVol = rows[i].totalVolume;
            pocIdx = i;
        }
    }

    // Calculate Value Area (70% of volume centered on POC)
    const targetVolume = totalVolume * (valueAreaPct / 100);
    let valueAreaVolume = rows[pocIdx].totalVolume;
    let vahIdx = pocIdx;
    let valIdx = pocIdx;

    while (valueAreaVolume < targetVolume && (vahIdx < numRows - 1 || valIdx > 0)) {
        const nextHighVol = vahIdx < numRows - 1 ? rows[vahIdx + 1].totalVolume : 0;
        const nextLowVol = valIdx > 0 ? rows[valIdx - 1].totalVolume : 0;

        if (nextHighVol >= nextLowVol && vahIdx < numRows - 1) {
            vahIdx++;
            valueAreaVolume += rows[vahIdx].totalVolume;
        } else if (valIdx > 0) {
            valIdx--;
            valueAreaVolume += rows[valIdx].totalVolume;
        }
    }

    return {
        profile: rows,
        poc: rows[pocIdx].priceLevel,
        vah: rows[vahIdx].priceLevel + rowHeight / 2,
        val: rows[valIdx].priceLevel - rowHeight / 2,
        totalVolume,
    };
}
