/**
 * Profile & Anchored Indicator Calculators
 * 
 * Includes: VRVP (Volume Range Visible Profile), Anchored VWAP, VWAP Bands
 */

import type { Candle } from '../../../core/types';

interface DataPoint {
    time: number;
    value: number;
}

// ============================================================================
// VISIBLE RANGE VOLUME PROFILE (VRVP)
// ============================================================================

export interface VRVPRow {
    priceLevel: number;
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    percentage: number;
}

export interface VRVPResult {
    profile: VRVPRow[];
    poc: number;
    vah: number;
    val: number;
    totalVolume: number;
    visibleRange: { low: number; high: number };
}

export function calculateVRVP(
    candles: Candle[],
    visibleStartTime: number,
    visibleEndTime: number,
    numRows: number = 24,
    valueAreaPct: number = 70
): VRVPResult {
    // Filter candles to visible range
    const visibleCandles = candles.filter(
        (c) => c.time >= visibleStartTime && c.time <= visibleEndTime
    );

    if (visibleCandles.length === 0) {
        return {
            profile: [],
            poc: 0,
            vah: 0,
            val: 0,
            totalVolume: 0,
            visibleRange: { low: 0, high: 0 },
        };
    }

    // Find price range in visible area
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const candle of visibleCandles) {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
    }

    const priceRange = maxPrice - minPrice;
    const rowHeight = priceRange / numRows;

    // Initialize profile rows
    const rows: VRVPRow[] = [];
    for (let i = 0; i < numRows; i++) {
        rows.push({
            priceLevel: minPrice + (i + 0.5) * rowHeight,
            totalVolume: 0,
            buyVolume: 0,
            sellVolume: 0,
            percentage: 0,
        });
    }

    // Distribute volume to rows
    let totalVolume = 0;

    for (const candle of visibleCandles) {
        const lowRow = Math.max(0, Math.floor((candle.low - minPrice) / rowHeight));
        const highRow = Math.min(numRows - 1, Math.floor((candle.high - minPrice) / rowHeight));

        const numSpannedRows = highRow - lowRow + 1;
        const volumePerRow = candle.volume / numSpannedRows;

        const isBuy = candle.close >= candle.open;

        for (let row = lowRow; row <= highRow; row++) {
            rows[row].totalVolume += volumePerRow;
            if (isBuy) {
                rows[row].buyVolume += volumePerRow;
            } else {
                rows[row].sellVolume += volumePerRow;
            }
        }

        totalVolume += candle.volume;
    }

    // Calculate percentages
    for (const row of rows) {
        row.percentage = totalVolume > 0 ? (row.totalVolume / totalVolume) * 100 : 0;
    }

    // Find POC
    let pocIdx = 0;
    let maxVol = 0;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].totalVolume > maxVol) {
            maxVol = rows[i].totalVolume;
            pocIdx = i;
        }
    }

    // Calculate Value Area
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
        visibleRange: { low: minPrice, high: maxPrice },
    };
}

// ============================================================================
// ANCHORED VWAP
// ============================================================================

export interface AnchoredVWAPResult {
    vwap: DataPoint[];
    upper1: DataPoint[]; // +1 standard deviation
    lower1: DataPoint[]; // -1 standard deviation
    upper2: DataPoint[]; // +2 standard deviations
    lower2: DataPoint[]; // -2 standard deviations
}

export function calculateAnchoredVWAP(
    candles: Candle[],
    anchorTime: number,
    showBands: boolean = true,
    stdDev1: number = 1,
    stdDev2: number = 2
): AnchoredVWAPResult {
    const vwap: DataPoint[] = [];
    const upper1: DataPoint[] = [];
    const lower1: DataPoint[] = [];
    const upper2: DataPoint[] = [];
    const lower2: DataPoint[] = [];

    // Find anchor index
    let anchorIdx = 0;
    for (let i = 0; i < candles.length; i++) {
        if (candles[i].time >= anchorTime) {
            anchorIdx = i;
            break;
        }
    }

    // Fill NaN before anchor
    for (let i = 0; i < anchorIdx; i++) {
        vwap.push({ time: candles[i].time, value: NaN });
        if (showBands) {
            upper1.push({ time: candles[i].time, value: NaN });
            lower1.push({ time: candles[i].time, value: NaN });
            upper2.push({ time: candles[i].time, value: NaN });
            lower2.push({ time: candles[i].time, value: NaN });
        }
    }

    // Calculate VWAP from anchor
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    const typicalPrices: number[] = [];

    for (let i = anchorIdx; i < candles.length; i++) {
        const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
        typicalPrices.push(tp);

        cumulativePV += tp * candles[i].volume;
        cumulativeVolume += candles[i].volume;

        const vwapValue = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : tp;
        vwap.push({ time: candles[i].time, value: vwapValue });

        if (showBands) {
            // Calculate standard deviation
            let sumSquaredDev = 0;
            for (let j = 0; j <= i - anchorIdx; j++) {
                const dev = typicalPrices[j] - vwapValue;
                sumSquaredDev += dev * dev;
            }
            const stdDevValue = Math.sqrt(sumSquaredDev / (i - anchorIdx + 1));

            upper1.push({ time: candles[i].time, value: vwapValue + stdDev1 * stdDevValue });
            lower1.push({ time: candles[i].time, value: vwapValue - stdDev1 * stdDevValue });
            upper2.push({ time: candles[i].time, value: vwapValue + stdDev2 * stdDevValue });
            lower2.push({ time: candles[i].time, value: vwapValue - stdDev2 * stdDevValue });
        }
    }

    return { vwap, upper1, lower1, upper2, lower2 };
}

// ============================================================================
// VWAP BANDS
// ============================================================================

export interface VWAPBandsResult {
    vwap: DataPoint[];
    upper1: DataPoint[];
    lower1: DataPoint[];
    upper2: DataPoint[];
    lower2: DataPoint[];
    upper3: DataPoint[];
    lower3: DataPoint[];
}

export function calculateVWAPBands(
    candles: Candle[],
    anchorType: 'session' | 'week' | 'month' | 'manual' = 'session',
    manualAnchorTime?: number,
    multiplier1: number = 1.0,
    multiplier2: number = 2.0,
    multiplier3: number = 3.0
): VWAPBandsResult {
    const vwap: DataPoint[] = [];
    const upper1: DataPoint[] = [];
    const lower1: DataPoint[] = [];
    const upper2: DataPoint[] = [];
    const lower2: DataPoint[] = [];
    const upper3: DataPoint[] = [];
    const lower3: DataPoint[] = [];

    // Determine anchor points based on anchor type
    const getAnchorPoints = (candles: Candle[]): number[] => {
        const anchors: number[] = [0]; // Always start with first candle

        if (anchorType === 'manual' && manualAnchorTime) {
            for (let i = 0; i < candles.length; i++) {
                if (candles[i].time >= manualAnchorTime) {
                    anchors.push(i);
                    break;
                }
            }
            return anchors;
        }

        for (let i = 1; i < candles.length; i++) {
            const prevDate = new Date(candles[i - 1].time * 1000);
            const currDate = new Date(candles[i].time * 1000);

            let isNewPeriod = false;

            switch (anchorType) {
                case 'session':
                    // New day
                    isNewPeriod = currDate.getDate() !== prevDate.getDate();
                    break;
                case 'week':
                    // New week (Monday = 1)
                    isNewPeriod = currDate.getDay() === 1 && prevDate.getDay() !== 1;
                    break;
                case 'month':
                    // New month
                    isNewPeriod = currDate.getMonth() !== prevDate.getMonth();
                    break;
            }

            if (isNewPeriod) {
                anchors.push(i);
            }
        }

        return anchors;
    };

    const anchorPoints = getAnchorPoints(candles);

    let currentAnchorIdx = 0;
    let nextAnchorIdx = anchorPoints.length > 1 ? anchorPoints[1] : candles.length;

    let cumulativePV = 0;
    let cumulativeVolume = 0;
    const typicalPrices: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        // Check if we hit a new anchor point
        if (i === nextAnchorIdx) {
            cumulativePV = 0;
            cumulativeVolume = 0;
            typicalPrices.length = 0;
            currentAnchorIdx++;
            nextAnchorIdx = currentAnchorIdx + 1 < anchorPoints.length
                ? anchorPoints[currentAnchorIdx + 1]
                : candles.length;
        }

        const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
        typicalPrices.push(tp);

        cumulativePV += tp * candles[i].volume;
        cumulativeVolume += candles[i].volume;

        const vwapValue = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : tp;
        vwap.push({ time: candles[i].time, value: vwapValue });

        // Calculate standard deviation
        let sumSquaredDev = 0;
        for (const price of typicalPrices) {
            const dev = price - vwapValue;
            sumSquaredDev += dev * dev;
        }
        const stdDevValue = Math.sqrt(sumSquaredDev / typicalPrices.length);

        upper1.push({ time: candles[i].time, value: vwapValue + multiplier1 * stdDevValue });
        lower1.push({ time: candles[i].time, value: vwapValue - multiplier1 * stdDevValue });
        upper2.push({ time: candles[i].time, value: vwapValue + multiplier2 * stdDevValue });
        lower2.push({ time: candles[i].time, value: vwapValue - multiplier2 * stdDevValue });
        upper3.push({ time: candles[i].time, value: vwapValue + multiplier3 * stdDevValue });
        lower3.push({ time: candles[i].time, value: vwapValue - multiplier3 * stdDevValue });
    }

    return { vwap, upper1, lower1, upper2, lower2, upper3, lower3 };
}

// ============================================================================
// TIME SEGMENTED VOLUME (TSV)
// ============================================================================

export function calculateTSV(candles: Candle[], period: number = 13): DataPoint[] {
    const result: DataPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period) {
            result.push({ time: candles[i].time, value: NaN });
            continue;
        }

        let tsv = 0;
        for (let j = 0; j < period; j++) {
            const idx = i - j;
            if (idx > 0) {
                const priceChange = candles[idx].close - candles[idx - 1].close;
                tsv += priceChange * candles[idx].volume;
            }
        }

        result.push({ time: candles[i].time, value: tsv });
    }

    return result;
}

// ============================================================================
// EASE OF MOVEMENT (EOM)
// ============================================================================

export function calculateEOM(candles: Candle[], period: number = 14, divisor: number = 10000): DataPoint[] {
    const result: DataPoint[] = [];
    const eomValues: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            result.push({ time: candles[i].time, value: NaN });
            eomValues.push(NaN);
            continue;
        }

        const high = candles[i].high;
        const low = candles[i].low;
        const prevHigh = candles[i - 1].high;
        const prevLow = candles[i - 1].low;
        const volume = candles[i].volume;

        // Distance moved
        const dm = ((high + low) / 2) - ((prevHigh + prevLow) / 2);

        // Box ratio
        const boxRatio = (volume / divisor) / (high - low);

        // 1-period EMV
        const emv = boxRatio === 0 ? 0 : dm / boxRatio;
        eomValues.push(emv);
    }

    // SMA smoothing
    const smaValues: number[] = [];
    for (let i = 0; i < eomValues.length; i++) {
        if (i < period - 1 || isNaN(eomValues[i])) {
            smaValues.push(NaN);
            continue;
        }

        let sum = 0;
        let count = 0;
        for (let j = 0; j < period; j++) {
            if (!isNaN(eomValues[i - j])) {
                sum += eomValues[i - j];
                count++;
            }
        }
        smaValues.push(count > 0 ? sum / count : NaN);
    }

    for (let i = 0; i < candles.length; i++) {
        result.push({ time: candles[i].time, value: smaValues[i] || NaN });
    }

    return result;
}

// ============================================================================
// FORCE INDEX
// ============================================================================

export function calculateForceIndex(candles: Candle[], period: number = 13): DataPoint[] {
    const result: DataPoint[] = [];
    const forceValues: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            forceValues.push(0);
        } else {
            const priceChange = candles[i].close - candles[i - 1].close;
            forceValues.push(priceChange * candles[i].volume);
        }
    }

    // EMA smoothing
    const k = 2 / (period + 1);
    let prevEma = NaN;

    for (let i = 0; i < forceValues.length; i++) {
        if (i < period - 1) {
            result.push({ time: candles[i].time, value: NaN });
            if (i === period - 2) {
                // Initialize EMA with SMA
                let sum = 0;
                for (let j = 0; j <= i; j++) {
                    sum += forceValues[j];
                }
                prevEma = sum / (i + 1);
            }
            continue;
        }

        if (isNaN(prevEma)) {
            prevEma = forceValues[i];
        } else {
            prevEma = forceValues[i] * k + prevEma * (1 - k);
        }

        result.push({ time: candles[i].time, value: prevEma });
    }

    return result;
}
