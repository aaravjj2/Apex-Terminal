import type { Candle } from '../../core/types.ts';

export const calculateSMA = (candles: Candle[], period: number) => {
    const smaData = [];
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            smaData.push({ time: candles[i].time, value: NaN });
            continue;
        }

        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += candles[i - j].close;
        }
        smaData.push({ time: candles[i].time, value: sum / period });
    }
    return smaData;
};

export const calculateEMA = (candles: Candle[], period: number) => {
    const emaData = [];
    const k = 2 / (period + 1);

    let prevEma = NaN;

    for (let i = 0; i < candles.length; i++) {
        const close = candles[i].close;

        if (i < period - 1) {
            // Not enough data
            emaData.push({ time: candles[i].time, value: NaN });
            // Initialize prevEma at the end of window?
            // Standard EMA usually starts with SMA of first 'period' elements
            if (i === period - 2) {
                // Calculate initial SMA
                let sum = 0;
                for (let j = 0; j <= i; j++) sum += candles[j].close;
                // Wait, we need period elements.
            }
            continue;
        }

        // Simple initialization: use Close price as first EMA or use SMA?
        // Let's use SMA of first 'period' as first EMA point.
        if (isNaN(prevEma)) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            prevEma = sum / period;
            emaData.push({ time: candles[i].time, value: prevEma });
        } else {
            const ema = close * k + prevEma * (1 - k);
            emaData.push({ time: candles[i].time, value: ema });
            prevEma = ema;
        }
    }
    return emaData;
};

// VWAP - Volume Weighted Average Price (resets daily in prod, simplified here)
export const calculateVWAP = (candles: Candle[]) => {
    const vwapData: { time: number; value: number }[] = [];
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const typicalPrice = (c.high + c.low + c.close) / 3;
        cumulativeTPV += typicalPrice * c.volume;
        cumulativeVolume += c.volume;

        const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : NaN;
        vwapData.push({ time: c.time, value: vwap });
    }
    return vwapData;
};

// RSI - Relative Strength Index
export const calculateRSI = (candles: Candle[], period: number = 14) => {
    const rsiData: { time: number; value: number }[] = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            rsiData.push({ time: candles[i].time, value: NaN });
            continue;
        }

        const change = candles[i].close - candles[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        if (i < period) {
            avgGain += gain / period;
            avgLoss += loss / period;
            rsiData.push({ time: candles[i].time, value: NaN });
            continue;
        }

        if (i === period) {
            // Initial average
            avgGain = avgGain; // Already accumulated
            avgLoss = avgLoss;
        } else {
            // Smoothed average
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        rsiData.push({ time: candles[i].time, value: rsi });
    }
    return rsiData;
};

// MACD - Moving Average Convergence Divergence
export const calculateMACD = (
    candles: Candle[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
) => {
    const fastEMA = calculateEMA(candles, fastPeriod);
    const slowEMA = calculateEMA(candles, slowPeriod);

    const macdLine: { time: number; value: number }[] = [];
    for (let i = 0; i < candles.length; i++) {
        const fast = fastEMA[i]?.value ?? NaN;
        const slow = slowEMA[i]?.value ?? NaN;
        const macd = isNaN(fast) || isNaN(slow) ? NaN : fast - slow;
        macdLine.push({ time: candles[i].time, value: macd });
    }

    // Signal line: EMA of MACD line
    const signalLine: { time: number; value: number }[] = [];
    const k = 2 / (signalPeriod + 1);
    let prevSignal = NaN;

    for (let i = 0; i < macdLine.length; i++) {
        const macdVal = macdLine[i].value;
        if (isNaN(macdVal)) {
            signalLine.push({ time: macdLine[i].time, value: NaN });
            continue;
        }

        if (isNaN(prevSignal)) {
            // First valid MACD value
            prevSignal = macdVal;
            signalLine.push({ time: macdLine[i].time, value: prevSignal });
        } else {
            const signal = macdVal * k + prevSignal * (1 - k);
            signalLine.push({ time: macdLine[i].time, value: signal });
            prevSignal = signal;
        }
    }

    // Histogram: MACD - Signal
    const histogram: { time: number; value: number }[] = [];
    for (let i = 0; i < macdLine.length; i++) {
        const macdVal = macdLine[i].value;
        const signalVal = signalLine[i]?.value ?? NaN;
        const hist = isNaN(macdVal) || isNaN(signalVal) ? NaN : macdVal - signalVal;
        histogram.push({ time: candles[i].time, value: hist });
    }

    return { macdLine, signalLine, histogram };
};

// Bollinger Bands
export const calculateBollinger = (candles: Candle[], period: number = 20, stdDevMultiplier: number = 2) => {
    const sma = calculateSMA(candles, period);
    const middle: { time: number; value: number }[] = sma;
    const upper: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            upper.push({ time: candles[i].time, value: NaN });
            lower.push({ time: candles[i].time, value: NaN });
            continue;
        }

        // Calculate standard deviation
        let sum = 0;
        for (let j = 0; j < period; j++) {
            const diff = candles[i - j].close - sma[i].value;
            sum += diff * diff;
        }
        const stdDev = Math.sqrt(sum / period);

        upper.push({ time: candles[i].time, value: sma[i].value + stdDevMultiplier * stdDev });
        lower.push({ time: candles[i].time, value: sma[i].value - stdDevMultiplier * stdDev });
    }

    return { middle, upper, lower };
};

// ATR - Average True Range
export const calculateATR = (candles: Candle[], period: number = 14) => {
    const atrData: { time: number; value: number }[] = [];
    let atr = 0;

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            atrData.push({ time: candles[i].time, value: NaN });
            continue;
        }

        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        if (i < period) {
            atr += tr / period;
            atrData.push({ time: candles[i].time, value: NaN });
            continue;
        }

        if (i === period) {
            // First ATR value
            atrData.push({ time: candles[i].time, value: atr });
        } else {
            // Smoothed ATR
            atr = (atr * (period - 1) + tr) / period;
            atrData.push({ time: candles[i].time, value: atr });
        }
    }
    return atrData;
};
