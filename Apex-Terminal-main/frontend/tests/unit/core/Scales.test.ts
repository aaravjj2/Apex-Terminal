import { describe, it, expect } from 'vitest';
import { LinearScale, TimeScale } from '../../../src/core/Scales.ts';

describe('LinearScale', () => {
    it('should map values to pixels correctly', () => {
        const scale = new LinearScale(0, 100, 200, 0); // 200px height, 0 mapped to 200px (bottom), 100 to 0px (top)
        expect(scale.toPixels(0)).toBe(200);
        expect(scale.toPixels(50)).toBe(100);
        expect(scale.toPixels(100)).toBe(0);
    });

    it('should map pixels to values correctly', () => {
        const scale = new LinearScale(0, 100, 200, 0);
        expect(scale.fromPixels(200)).toBe(0);
        expect(scale.fromPixels(100)).toBe(50);
        expect(scale.fromPixels(0)).toBe(100);
    });
});

describe('TimeScale', () => {
    it('should map index to pixels correctly', () => {
        // 10 candles visible, width 100px. Bar width = 10px.
        // Index 0 (startIndex) -> 0 * 10 + 5 = 5
        const scale = new TimeScale(0, 10, 100);
        expect(scale.indexToPixels(0)).toBe(5);
        expect(scale.indexToPixels(1)).toBe(15);
        expect(scale.indexToPixels(9)).toBe(95);
    });

    it('should map pixels to index correctly', () => {
        const scale = new TimeScale(0, 10, 100); // barWidth = 10
        // pixel 5 -> index 0
        expect(scale.pixelsToIndex(5)).toBe(0);
        // pixel 15 -> index 1
        expect(scale.pixelsToIndex(15)).toBe(1);
        // pixel 0 -> index -0.5
        expect(scale.pixelsToIndex(0)).toBe(-0.5);
    });
});
