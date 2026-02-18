import { describe, it, expect } from 'vitest';
import {
    calculateSMA,
    calculateEMA,
    calculateVWAP,
    calculateRSI,
    calculateMACD,
    calculateBollinger,
    calculateATR
} from '../../../src/features/indicators/calculators.ts';
import type { Candle } from '../../../src/core/types.ts';

// Helper to generate mock candles
const mockCandles = (count: number, basePrice: number = 100): Candle[] => {
    const candles: Candle[] = [];
    for (let i = 0; i < count; i++) {
        const open = basePrice + Math.sin(i * 0.3) * 5;
        const close = open + (Math.random() - 0.5) * 2;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        candles.push({
            time: 1700000000000 + i * 60000,
            open,
            high,
            low,
            close,
            volume: 1000 + Math.random() * 500
        });
    }
    return candles;
};

describe('Indicator Calculators', () => {
    describe('SMA', () => {
        it('should return NaN for initial period - 1 values', () => {
            const candles = mockCandles(20);
            const sma = calculateSMA(candles, 5);
            expect(isNaN(sma[0].value)).toBe(true);
            expect(isNaN(sma[3].value)).toBe(true);
            expect(isNaN(sma[4].value)).toBe(false); // 5th value should be valid
        });

        it('should calculate correct SMA', () => {
            const candles: Candle[] = [
                { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 },
                { time: 2, open: 20, high: 20, low: 20, close: 20, volume: 100 },
                { time: 3, open: 30, high: 30, low: 30, close: 30, volume: 100 },
            ];
            const sma = calculateSMA(candles, 3);
            expect(sma[2].value).toBe(20); // (10+20+30)/3
        });
    });

    describe('EMA', () => {
        it('should return values after period', () => {
            const candles = mockCandles(20);
            const ema = calculateEMA(candles, 5);
            expect(isNaN(ema[3].value)).toBe(true);
            expect(isNaN(ema[4].value)).toBe(false);
        });
    });

    describe('VWAP', () => {
        it('should calculate cumulative VWAP', () => {
            const candles: Candle[] = [
                { time: 1, open: 10, high: 12, low: 8, close: 10, volume: 100 },
                { time: 2, open: 10, high: 15, low: 9, close: 12, volume: 200 },
            ];
            const vwap = calculateVWAP(candles);

            // First candle: TP = (12+8+10)/3 = 10, TPV = 1000, Vol = 100, VWAP = 10
            expect(vwap[0].value).toBe(10);

            // Second candle: TP = (15+9+12)/3 = 12, TPV = 2400, cumTPV = 3400, cumVol = 300
            expect(vwap[1].value).toBeCloseTo(3400 / 300, 5);
        });
    });

    describe('RSI', () => {
        it('should return values between 0 and 100', () => {
            const candles = mockCandles(50);
            const rsi = calculateRSI(candles, 14);

            rsi.filter(r => !isNaN(r.value)).forEach(r => {
                expect(r.value).toBeGreaterThanOrEqual(0);
                expect(r.value).toBeLessThanOrEqual(100);
            });
        });
    });

    describe('MACD', () => {
        it('should return macdLine, signalLine, and histogram', () => {
            const candles = mockCandles(50);
            const { macdLine, signalLine, histogram } = calculateMACD(candles);

            expect(macdLine.length).toBe(candles.length);
            expect(signalLine.length).toBe(candles.length);
            expect(histogram.length).toBe(candles.length);
        });
    });

    describe('Bollinger Bands', () => {
        it('should return middle, upper, and lower bands', () => {
            const candles = mockCandles(30);
            const { middle, upper, lower } = calculateBollinger(candles, 20);

            expect(middle.length).toBe(candles.length);
            expect(upper.length).toBe(candles.length);
            expect(lower.length).toBe(candles.length);

            // Upper should be above middle, lower below (for valid values)
            for (let i = 19; i < candles.length; i++) {
                expect(upper[i].value).toBeGreaterThan(middle[i].value);
                expect(lower[i].value).toBeLessThan(middle[i].value);
            }
        });
    });

    describe('ATR', () => {
        it('should calculate positive ATR values', () => {
            const candles = mockCandles(30);
            const atr = calculateATR(candles, 14);

            atr.filter(a => !isNaN(a.value)).forEach(a => {
                expect(a.value).toBeGreaterThan(0);
            });
        });
    });
});
