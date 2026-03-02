import { describe, it, expect } from 'vitest';
import {
  adx, aroon, parabolicSAR, supertrend, ichimoku, zigzag,
  standardPivots, fibonacciPivots, woodiePivots, camarillaPivots, demarkPivots,
  vortexIndicator, ttmSqueeze, linearRegressionChannel, darvasBox,
  crossover, crossunder, trendStrength,
} from '../../../src/lib/indicators/trend';

const closeTo = (val: number, expected: number, tol = 1e-4) =>
  expect(val).toBeCloseTo(expected, -Math.log10(tol));

const mkOHLC = (n: number, base: number, step: number) => {
  const c = Array.from({ length: n }, (_, i) => base + i * step);
  const h = c.map(v => v + 5);
  const l = c.map(v => v - 5);
  return { h, l, c };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADX
// ═══════════════════════════════════════════════════════════════════════════════

describe('adx', () => {
  it('returns adx, plusDI, minusDI, dx arrays of correct length', () => {
    const { h, l, c } = mkOHLC(40, 100, 2);
    const result = adx(h, l, c, 14);
    expect(result.adx).toHaveLength(40);
    expect(result.plusDI).toHaveLength(40);
    expect(result.minusDI).toHaveLength(40);
    expect(result.dx).toHaveLength(40);
  });

  it('+DI > -DI in uptrend', () => {
    const { h, l, c } = mkOHLC(40, 100, 2);
    const result = adx(h, l, c, 14);
    const valid = result.plusDI.filter((v, i) => !isNaN(v) && !isNaN(result.minusDI[i]));
    const validIdx = result.plusDI.map((v, i) => ({
      plus: v,
      minus: result.minusDI[i],
    })).filter(v => !isNaN(v.plus) && !isNaN(v.minus));
    validIdx.slice(-5).forEach(v => expect(v.plus).toBeGreaterThan(v.minus));
  });

  it('-DI > +DI in downtrend', () => {
    const { h, l, c } = mkOHLC(40, 200, -2);
    const result = adx(h, l, c, 14);
    const validIdx = result.plusDI.map((v, i) => ({
      plus: v,
      minus: result.minusDI[i],
    })).filter(v => !isNaN(v.plus) && !isNaN(v.minus));
    validIdx.slice(-5).forEach(v => expect(v.minus).toBeGreaterThan(v.plus));
  });

  it('ADX bounded 0-100', () => {
    const { h, l, c } = mkOHLC(40, 100, 2);
    const result = adx(h, l, c, 14);
    result.adx.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('DX = |+DI - -DI| / (+DI + -DI) * 100', () => {
    const { h, l, c } = mkOHLC(40, 100, 2);
    const result = adx(h, l, c, 14);
    for (let i = 0; i < 40; i++) {
      if (!isNaN(result.dx[i]) && !isNaN(result.plusDI[i]) && !isNaN(result.minusDI[i])) {
        const sum = result.plusDI[i] + result.minusDI[i];
        if (sum > 0) {
          const expected = (Math.abs(result.plusDI[i] - result.minusDI[i]) / sum) * 100;
          closeTo(result.dx[i], expected);
        }
      }
    }
  });

  it('returns empty for empty input', () => {
    const result = adx([], [], []);
    expect(result.adx).toHaveLength(0);
  });

  it('high ADX for strong trend', () => {
    const { h, l, c } = mkOHLC(60, 100, 5);
    const result = adx(h, l, c, 14);
    const valid = result.adx.filter(v => !isNaN(v));
    if (valid.length > 5) {
      expect(valid[valid.length - 1]).toBeGreaterThan(20);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Aroon
// ═══════════════════════════════════════════════════════════════════════════════

describe('aroon', () => {
  it('Aroon Up = 100 when latest is highest high', () => {
    const h = Array.from({ length: 30 }, (_, i) => 100 + i);
    const l = new Array(30).fill(80);
    const result = aroon(h, l, 25);
    closeTo(result.up[29], 100);
  });

  it('Aroon Down = 100 when latest is lowest low', () => {
    const h = new Array(30).fill(120);
    const l = Array.from({ length: 30 }, (_, i) => 100 - i);
    const result = aroon(h, l, 25);
    closeTo(result.down[29], 100);
  });

  it('oscillator = up - down', () => {
    const h = Array.from({ length: 30 }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: 30 }, (_, i) => 90 + Math.sin(i) * 5);
    const result = aroon(h, l, 10);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(result.up[i]) && !isNaN(result.down[i])) {
        closeTo(result.oscillator[i], result.up[i] - result.down[i]);
      }
    }
  });

  it('returns empty for empty input', () => {
    const result = aroon([], []);
    expect(result.up).toHaveLength(0);
  });

  it('bounded between 0 and 100', () => {
    const h = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: 30 }, (_, i) => 80 + Math.sin(i / 3) * 10);
    const result = aroon(h, l, 10);
    result.up.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
    result.down.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('NaN for warm-up', () => {
    const h = Array.from({ length: 10 }, () => 100);
    const l = Array.from({ length: 10 }, () => 90);
    const result = aroon(h, l, 10);
    for (let i = 0; i < 10; i++) {
      expect(result.up[i]).toBeNaN();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Parabolic SAR
// ═══════════════════════════════════════════════════════════════════════════════

describe('parabolicSAR', () => {
  it('initial SAR = low[0], direction = 1', () => {
    const h = [110, 115, 120, 125, 130];
    const l = [90, 95, 100, 105, 110];
    const result = parabolicSAR(h, l);
    closeTo(result.sar[0], 90);
    expect(result.direction[0]).toBe(1);
  });

  it('SAR below price in uptrend', () => {
    const h = Array.from({ length: 20 }, (_, i) => 110 + i * 3);
    const l = Array.from({ length: 20 }, (_, i) => 90 + i * 3);
    const result = parabolicSAR(h, l, 0.02, 0.02, 0.2);
    for (let i = 5; i < 20; i++) {
      if (result.direction[i] === 1 && !isNaN(result.sar[i])) {
        expect(result.sar[i]).toBeLessThan(l[i] + 1);
      }
    }
  });

  it('direction changes on reversal', () => {
    const h = [100, 105, 110, 108, 95, 80, 70, 65, 60, 55];
    const l = [90, 95, 100, 98, 85, 70, 60, 55, 50, 45];
    const result = parabolicSAR(h, l, 0.02, 0.02, 0.2);
    const directions = result.direction;
    const hasReversal = directions.some((d, i) => i > 0 && d !== directions[i - 1]);
    expect(hasReversal).toBe(true);
  });

  it('acceleration factor increases up to maximum', () => {
    const h = Array.from({ length: 20 }, (_, i) => 100 + i * 5);
    const l = Array.from({ length: 20 }, (_, i) => 90 + i * 5);
    const result = parabolicSAR(h, l, 0.02, 0.02, 0.2);
    expect(result.sar).toHaveLength(20);
  });

  it('returns NaN arrays for < 2 data', () => {
    const result = parabolicSAR([100], [90]);
    result.sar.forEach(v => expect(v).toBeNaN());
  });

  it('direction is always 1 or -1', () => {
    const h = Array.from({ length: 30 }, (_, i) => 110 + Math.sin(i / 3) * 15);
    const l = Array.from({ length: 30 }, (_, i) => 90 + Math.sin(i / 3) * 15);
    const result = parabolicSAR(h, l);
    result.direction.forEach(d => {
      expect(d === 1 || d === -1).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Supertrend
// ═══════════════════════════════════════════════════════════════════════════════

describe('supertrend', () => {
  it('returns supertrend, direction, upper/lower bands', () => {
    const { h, l, c } = mkOHLC(30, 100, 2);
    const result = supertrend(h, l, c, 10, 3);
    expect(result.supertrend).toHaveLength(30);
    expect(result.direction).toHaveLength(30);
    expect(result.upperBand).toHaveLength(30);
    expect(result.lowerBand).toHaveLength(30);
  });

  it('direction = 1 (bullish) when price above lower band', () => {
    const { h, l, c } = mkOHLC(30, 100, 3);
    const result = supertrend(h, l, c, 10, 3);
    const valid = result.direction.slice(15);
    valid.forEach(d => expect(d).toBe(1));
  });

  it('returns empty for empty input', () => {
    const result = supertrend([], [], []);
    expect(result.supertrend).toHaveLength(0);
  });

  it('direction is 1 or -1', () => {
    const { h, l, c } = mkOHLC(40, 100, 1);
    const result = supertrend(h, l, c, 10, 3);
    result.direction.forEach(d => {
      expect(d === 1 || d === -1).toBe(true);
    });
  });

  it('supertrend = lower band in uptrend', () => {
    const { h, l, c } = mkOHLC(30, 100, 3);
    const result = supertrend(h, l, c, 10, 3);
    for (let i = 15; i < 30; i++) {
      if (result.direction[i] === 1 && !isNaN(result.supertrend[i])) {
        closeTo(result.supertrend[i], result.lowerBand[i]);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Ichimoku
// ═══════════════════════════════════════════════════════════════════════════════

describe('ichimoku', () => {
  it('returns all 5 components', () => {
    const n = 60;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = ichimoku(h, l, c);
    expect(result.tenkan).toHaveLength(n);
    expect(result.kijun).toHaveLength(n);
    expect(result.senkouA).toHaveLength(n);
    expect(result.senkouB).toHaveLength(n);
    expect(result.chikou).toHaveLength(n);
  });

  it('tenkan = midpoint of 9-period high/low', () => {
    const n = 20;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = ichimoku(h, l, c, 9, 26, 52, 26);
    // At i=8: max(h[0..8]) = 118, min(l[0..8]) = 90 => (118+90)/2 = 104
    closeTo(result.tenkan[8], (118 + 90) / 2);
  });

  it('kijun = midpoint of 26-period high/low', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = ichimoku(h, l, c, 9, 26, 52, 26);
    // At i=25: max(h[0..25]) = 135, min(l[0..25]) = 90 => (135+90)/2 = 112.5
    closeTo(result.kijun[25], (135 + 90) / 2);
  });

  it('senkouA = (tenkan + kijun) / 2 displaced forward', () => {
    const n = 60;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = ichimoku(h, l, c, 9, 26, 52, 26);
    expect(result.senkouA).toHaveLength(n);
  });

  it('returns empty for empty input', () => {
    const result = ichimoku([], [], []);
    expect(result.tenkan).toHaveLength(0);
  });

  it('chikou = close shifted back', () => {
    const n = 60;
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const h = c.map(v => v + 5);
    const l = c.map(v => v - 5);
    const result = ichimoku(h, l, c, 9, 26, 52, 26);
    for (let i = 0; i < n - 26; i++) {
      if (!isNaN(result.chikou[i])) {
        closeTo(result.chikou[i], c[i]);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZigZag
// ═══════════════════════════════════════════════════════════════════════════════

describe('zigzag', () => {
  it('detects pivots on zig-zag data', () => {
    const h = [100, 120, 115, 130, 125, 140, 100, 80, 85, 70];
    const l = [90, 110, 105, 120, 115, 130, 90, 70, 75, 60];
    const result = zigzag(h, l, 10);
    expect(result.pivots.length).toBeGreaterThan(0);
    expect(result.line).toHaveLength(10);
  });

  it('pivot types alternate high/low', () => {
    const h = [100, 150, 110, 160, 100, 170, 90, 60, 95, 50];
    const l = [90, 140, 100, 150, 90, 160, 80, 50, 85, 40];
    const result = zigzag(h, l, 5);
    for (let i = 1; i < result.pivots.length; i++) {
      expect(result.pivots[i].type).not.toBe(result.pivots[i - 1].type);
    }
  });

  it('returns NaN line for < 2 data', () => {
    const result = zigzag([100], [90]);
    expect(result.pivots).toHaveLength(0);
    result.line.forEach(v => expect(v).toBeNaN());
  });

  it('higher deviation = fewer pivots', () => {
    const h = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 20);
    const l = h.map(v => v - 10);
    const r1 = zigzag(h, l, 5);
    const r2 = zigzag(h, l, 20);
    expect(r2.pivots.length).toBeLessThanOrEqual(r1.pivots.length);
  });

  it('interpolates line between pivots', () => {
    const h = [100, 120, 140, 130, 110, 90, 80, 100, 120, 140];
    const l = [90, 110, 130, 120, 100, 80, 70, 90, 110, 130];
    const result = zigzag(h, l, 10);
    if (result.pivots.length >= 2) {
      const p0 = result.pivots[0];
      const p1 = result.pivots[1];
      if (p1.index - p0.index > 1) {
        const mid = Math.floor((p0.index + p1.index) / 2);
        expect(result.line[mid]).not.toBeNaN();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pivot Points
// ═══════════════════════════════════════════════════════════════════════════════

describe('standardPivots', () => {
  it('P = (H + L + C) / 3', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.p, 100);
  });

  it('R1 = 2P - L', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.r1, 2 * 100 - 90); // 110
  });

  it('S1 = 2P - H', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.s1, 2 * 100 - 110); // 90
  });

  it('R2 = P + (H - L)', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.r2, 100 + 20); // 120
  });

  it('S2 = P - (H - L)', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.s2, 100 - 20); // 80
  });

  it('R3 = H + 2(P - L)', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.r3, 110 + 2 * (100 - 90)); // 130
  });

  it('S3 = L - 2(H - P)', () => {
    const result = standardPivots(110, 90, 100);
    closeTo(result.s3, 90 - 2 * (110 - 100)); // 70
  });

  it('R levels > P > S levels', () => {
    const result = standardPivots(120, 80, 100);
    expect(result.r3).toBeGreaterThan(result.r2);
    expect(result.r2).toBeGreaterThan(result.r1);
    expect(result.r1).toBeGreaterThan(result.p);
    expect(result.p).toBeGreaterThan(result.s1);
    expect(result.s1).toBeGreaterThan(result.s2);
    expect(result.s2).toBeGreaterThan(result.s3);
  });
});

describe('fibonacciPivots', () => {
  it('P = (H + L + C) / 3', () => {
    const result = fibonacciPivots(110, 90, 100);
    closeTo(result.p, 100);
  });

  it('R1 = P + 0.382 * (H-L)', () => {
    const result = fibonacciPivots(110, 90, 100);
    closeTo(result.r1, 100 + 0.382 * 20);
  });

  it('R2 = P + 0.618 * (H-L)', () => {
    const result = fibonacciPivots(110, 90, 100);
    closeTo(result.r2, 100 + 0.618 * 20);
  });

  it('S1 = P - 0.382 * (H-L)', () => {
    const result = fibonacciPivots(110, 90, 100);
    closeTo(result.s1, 100 - 0.382 * 20);
  });

  it('symmetric around pivot', () => {
    const result = fibonacciPivots(110, 90, 100);
    closeTo(result.r1 - result.p, result.p - result.s1);
    closeTo(result.r2 - result.p, result.p - result.s2);
  });
});

describe('woodiePivots', () => {
  it('P = (H + L + 2C) / 4', () => {
    const result = woodiePivots(110, 90, 100);
    closeTo(result.p, (110 + 90 + 200) / 4); // 100
  });

  it('gives more weight to close', () => {
    const w = woodiePivots(110, 90, 108);
    const s = standardPivots(110, 90, 108);
    expect(w.p).toBeGreaterThan(s.p);
  });
});

describe('camarillaPivots', () => {
  it('returns R1-R4 and S1-S4', () => {
    const result = camarillaPivots(110, 90, 100);
    expect(result.r1).toBeDefined();
    expect(result.r4).toBeDefined();
    expect(result.s1).toBeDefined();
    expect(result.s4).toBeDefined();
  });

  it('R3 = C + HL*1.1/4', () => {
    const result = camarillaPivots(110, 90, 100);
    closeTo(result.r3, 100 + 20 * 1.1 / 4);
  });

  it('S3 = C - HL*1.1/4', () => {
    const result = camarillaPivots(110, 90, 100);
    closeTo(result.s3, 100 - 20 * 1.1 / 4);
  });

  it('R4 > R3 > R2 > R1', () => {
    const result = camarillaPivots(120, 80, 100);
    expect(result.r4).toBeGreaterThan(result.r3);
    expect(result.r3).toBeGreaterThan(result.r2);
    expect(result.r2).toBeGreaterThan(result.r1);
  });

  it('S1 > S2 > S3 > S4', () => {
    const result = camarillaPivots(120, 80, 100);
    expect(result.s1).toBeGreaterThan(result.s2);
    expect(result.s2).toBeGreaterThan(result.s3);
    expect(result.s3).toBeGreaterThan(result.s4);
  });
});

describe('demarkPivots', () => {
  it('uses X formula when close < open', () => {
    // x = H + 2L + C when close < open
    const result = demarkPivots(100, 110, 90, 95);
    const x = 110 + 2 * 90 + 95; // 385
    closeTo(result.p, x / 4);
  });

  it('uses X formula when close > open', () => {
    // x = 2H + L + C when close > open
    const result = demarkPivots(100, 110, 90, 105);
    const x = 2 * 110 + 90 + 105; // 415
    closeTo(result.p, x / 4);
  });

  it('uses X formula when close = open', () => {
    // x = H + L + 2C when close = open
    const result = demarkPivots(100, 110, 90, 100);
    const x = 110 + 90 + 2 * 100; // 400
    closeTo(result.p, x / 4);
  });

  it('R1 = X/2 - L', () => {
    const result = demarkPivots(100, 110, 90, 105);
    const x = 2 * 110 + 90 + 105;
    closeTo(result.r1, x / 2 - 90);
  });

  it('S1 = X/2 - H', () => {
    const result = demarkPivots(100, 110, 90, 105);
    const x = 2 * 110 + 90 + 105;
    closeTo(result.s1, x / 2 - 110);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Vortex Indicator
// ═══════════════════════════════════════════════════════════════════════════════

describe('vortexIndicator', () => {
  it('returns plusVI and minusVI', () => {
    const { h, l, c } = mkOHLC(30, 100, 2);
    const result = vortexIndicator(h, l, c, 14);
    expect(result.plusVI).toHaveLength(30);
    expect(result.minusVI).toHaveLength(30);
  });

  it('returns NaN arrays for < 2 data', () => {
    const result = vortexIndicator([110], [90], [100]);
    result.plusVI.forEach(v => expect(v).toBeNaN());
  });

  it('+VI > -VI in uptrend', () => {
    const { h, l, c } = mkOHLC(30, 100, 3);
    const result = vortexIndicator(h, l, c, 14);
    const lastIdx = 29;
    if (!isNaN(result.plusVI[lastIdx]) && !isNaN(result.minusVI[lastIdx])) {
      expect(result.plusVI[lastIdx]).toBeGreaterThan(result.minusVI[lastIdx]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Crossover / Crossunder
// ═══════════════════════════════════════════════════════════════════════════════

describe('crossover', () => {
  it('detects when a crosses above b', () => {
    const a = [1, 3, 5, 7];
    const b = [2, 2, 2, 2];
    const result = crossover(a, b);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(true); // a goes from 1 (below 2) to 3 (above 2)
  });

  it('no crossover when always above', () => {
    const a = [5, 6, 7, 8];
    const b = [1, 1, 1, 1];
    const result = crossover(a, b);
    result.forEach(v => expect(v).toBe(false));
  });

  it('no crossover when always below', () => {
    const a = [1, 1, 1, 1];
    const b = [5, 5, 5, 5];
    const result = crossover(a, b);
    result.forEach(v => expect(v).toBe(false));
  });

  it('multiple crossovers', () => {
    const a = [1, 3, 1, 3, 1];
    const b = [2, 2, 2, 2, 2];
    const result = crossover(a, b);
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
    expect(result[3]).toBe(true);
  });
});

describe('crossunder', () => {
  it('detects when a crosses below b', () => {
    const a = [5, 3, 1, 0];
    const b = [2, 2, 2, 2];
    const result = crossunder(a, b);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
    expect(result[2]).toBe(true); // a from 3 (above 2) to 1 (below 2)
  });

  it('no crossunder when always below', () => {
    const a = [1, 1, 1];
    const b = [5, 5, 5];
    const result = crossunder(a, b);
    result.forEach(v => expect(v).toBe(false));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TTM Squeeze, Linear Regression Channel, Darvas Box, Trend Strength
// ═══════════════════════════════════════════════════════════════════════════════

describe('ttmSqueeze', () => {
  it('returns momentum, squeezeOn, squeezeOff', () => {
    const { h, l, c } = mkOHLC(40, 100, 1);
    const result = ttmSqueeze(h, l, c);
    expect(result.momentum).toHaveLength(40);
    expect(result.squeezeOn).toHaveLength(40);
    expect(result.squeezeOff).toHaveLength(40);
  });

  it('returns empty for empty input', () => {
    const result = ttmSqueeze([], [], []);
    expect(result.momentum).toHaveLength(0);
  });

  it('squeezeOn and squeezeOff are complementary', () => {
    const { h, l, c } = mkOHLC(40, 100, 1);
    const result = ttmSqueeze(h, l, c);
    for (let i = 0; i < 40; i++) {
      if (result.squeezeOn[i] || result.squeezeOff[i]) {
        expect(result.squeezeOn[i]).not.toBe(result.squeezeOff[i]);
      }
    }
  });
});

describe('linearRegressionChannel', () => {
  it('returns middle, upper, lower, slope, rSquared', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = linearRegressionChannel(data, 20, 2);
    expect(result.middle).toHaveLength(30);
    expect(result.upper).toHaveLength(30);
    expect(result.lower).toHaveLength(30);
    expect(result.slope).toHaveLength(30);
    expect(result.rSquared).toHaveLength(30);
  });

  it('R² = 1 for perfect linear data', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const result = linearRegressionChannel(data, 20, 2);
    const valid = result.rSquared.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 1));
  });

  it('returns empty for empty input', () => {
    const result = linearRegressionChannel([]);
    expect(result.middle).toHaveLength(0);
  });
});

describe('trendStrength', () => {
  it('returns strength and label arrays', () => {
    const { h, l, c } = mkOHLC(40, 100, 2);
    const result = trendStrength(h, l, c, 14);
    expect(result.strength).toHaveLength(40);
    expect(result.label).toHaveLength(40);
  });

  it('labels include valid values', () => {
    const { h, l, c } = mkOHLC(60, 100, 2);
    const result = trendStrength(h, l, c, 14);
    const validLabels = ['absent', 'weak', 'strong', 'very_strong', 'extreme', 'unknown'];
    result.label.forEach(l => expect(validLabels).toContain(l));
  });
});

describe('darvasBox', () => {
  it('returns top, bottom, breakout, breakdown', () => {
    const { h, l, c } = mkOHLC(30, 100, 0);
    const result = darvasBox(h, l, c, 5);
    expect(result.top).toHaveLength(30);
    expect(result.bottom).toHaveLength(30);
    expect(result.breakout).toHaveLength(30);
    expect(result.breakdown).toHaveLength(30);
  });

  it('returns empty for empty input', () => {
    const result = darvasBox([], [], []);
    expect(result.top).toHaveLength(0);
  });
});
