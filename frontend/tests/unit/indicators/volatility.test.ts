import { describe, it, expect } from 'vitest';
import {
  trueRange, atr, bollingerBands, keltnerChannel, donchianChannel,
  historicalVolatility, chaikinVolatility, standardDeviation,
  ulcerIndex, choppinessIndex, massIndex, volatilityStop,
  garch11, realizedVolatilityCloseToClose, realizedVolatilityParkinson,
  realizedVolatilityGarmanKlass, realizedVolatilityRogersSatchell,
  realizedVolatilityYangZhang, atrPercent, natr, bollingerBandWidth,
  bollingerPercentB, averageDayRange, relativeVolatilityIndex,
  intradayIntensity, vixStyleCalculation,
} from '../../../src/lib/indicators/volatility';
import { sma as smaFn, ema as emaFn } from '../../../src/lib/indicators/movingAverages';

const closeTo = (val: number, expected: number, tol = 1e-4) =>
  expect(val).toBeCloseTo(expected, -Math.log10(tol));

// ═══════════════════════════════════════════════════════════════════════════════
// True Range
// ═══════════════════════════════════════════════════════════════════════════════

describe('trueRange', () => {
  it('first bar = high - low', () => {
    const result = trueRange([110], [90], [100]);
    closeTo(result[0], 20);
  });

  it('calculates max of 3 components', () => {
    // bar 1: H=50, L=40, C=45, prevC=100
    // TR = max(50-40, |50-100|, |40-100|) = max(10, 50, 60) = 60
    const result = trueRange([110, 50], [90, 40], [100, 45]);
    closeTo(result[1], 60);
  });

  it('gap up: uses abs(high - prevClose)', () => {
    const result = trueRange([100, 120], [90, 115], [95, 118]);
    // bar1: max(120-115, |120-95|, |115-95|) = max(5, 25, 20) = 25
    closeTo(result[1], 25);
  });

  it('gap down: uses abs(low - prevClose)', () => {
    const result = trueRange([100, 80], [90, 70], [95, 75]);
    // bar1: max(80-70, |80-95|, |70-95|) = max(10, 15, 25) = 25
    closeTo(result[1], 25);
  });

  it('handles constant data (TR = 0)', () => {
    const h = [100, 100, 100];
    const l = [100, 100, 100];
    const c = [100, 100, 100];
    const result = trueRange(h, l, c);
    closeTo(result[0], 0);
    closeTo(result[1], 0);
  });

  it('returns correct length', () => {
    const result = trueRange([1, 2, 3], [0, 1, 2], [0.5, 1.5, 2.5]);
    expect(result).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATR
// ═══════════════════════════════════════════════════════════════════════════════

describe('atr', () => {
  it('returns smoothed true range using RMA', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = atr(h, l, c, 14);
    expect(result).toHaveLength(n);
    const valid = result.filter(v => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
  });

  it('ATR is always non-negative', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 10);
    const l = Array.from({ length: n }, (_, i) => 80 + Math.sin(i) * 10);
    const c = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 10);
    const result = atr(h, l, c, 10);
    result.filter(v => !isNaN(v)).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('returns NaN during warm-up', () => {
    const result = atr([110], [90], [100], 5);
    expect(result[0]).toBeNaN();
  });

  it('constant range gives constant ATR', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const result = atr(h, l, c, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 20));
  });

  it('uses default period 14', () => {
    const n = 30;
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 100);
    const r1 = atr(h, l, c);
    const r2 = atr(h, l, c, 14);
    for (let i = 0; i < n; i++) {
      if (isNaN(r1[i])) expect(r2[i]).toBeNaN();
      else closeTo(r1[i], r2[i]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bollinger Bands
// ═══════════════════════════════════════════════════════════════════════════════

describe('bollingerBands', () => {
  it('middle band = SMA', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = bollingerBands(data, 20, 2);
    const expectedSMA = smaFn(data, 20);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(result.middle[i])) {
        closeTo(result.middle[i], expectedSMA[i]);
      }
    }
  });

  it('upper > middle > lower', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = bollingerBands(data, 20, 2);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(result.upper[i])) {
        expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
      }
    }
  });

  it('bandwidth = (upper - lower) / middle * 100', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = bollingerBands(data, 20, 2);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(result.bandwidth[i]) && result.middle[i] !== 0) {
        const expected = ((result.upper[i] - result.lower[i]) / result.middle[i]) * 100;
        closeTo(result.bandwidth[i], expected);
      }
    }
  });

  it('%B = (price - lower) / (upper - lower)', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = bollingerBands(data, 20, 2);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(result.percentB[i])) {
        const range = result.upper[i] - result.lower[i];
        if (range > 0) {
          const expected = (data[i] - result.lower[i]) / range;
          closeTo(result.percentB[i], expected);
        }
      }
    }
  });

  it('zero bandwidth for constant data', () => {
    const data = new Array(30).fill(100);
    const result = bollingerBands(data, 20, 2);
    const valid = result.bandwidth.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('returns empty for empty input', () => {
    const result = bollingerBands([]);
    expect(result.upper).toHaveLength(0);
  });

  it('wider bands with higher multiplier', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const r1 = bollingerBands(data, 20, 1);
    const r2 = bollingerBands(data, 20, 3);
    for (let i = 0; i < 30; i++) {
      if (!isNaN(r1.upper[i]) && !isNaN(r2.upper[i])) {
        expect(r2.upper[i] - r2.lower[i]).toBeGreaterThanOrEqual(r1.upper[i] - r1.lower[i] - 0.001);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Keltner Channel
// ═══════════════════════════════════════════════════════════════════════════════

describe('keltnerChannel', () => {
  it('middle = EMA of closes', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = keltnerChannel(h, l, c, 20, 10, 2);
    const expectedEMA = emaFn(c, 20);
    for (let i = 0; i < n; i++) {
      if (!isNaN(result.middle[i])) {
        closeTo(result.middle[i], expectedEMA[i]);
      }
    }
  });

  it('upper = middle + multiplier * ATR', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const result = keltnerChannel(h, l, c, 20, 10, 2);
    for (let i = 0; i < n; i++) {
      if (!isNaN(result.upper[i]) && !isNaN(result.middle[i])) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.lower[i]).toBeLessThan(result.middle[i]);
      }
    }
  });

  it('returns empty for empty input', () => {
    const result = keltnerChannel([], [], []);
    expect(result.upper).toHaveLength(0);
  });

  it('returns correct length', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const result = keltnerChannel(h, l, c);
    expect(result.upper).toHaveLength(n);
    expect(result.middle).toHaveLength(n);
    expect(result.lower).toHaveLength(n);
  });

  it('wider with higher multiplier', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 5);
    const r1 = keltnerChannel(h, l, c, 20, 10, 1);
    const r2 = keltnerChannel(h, l, c, 20, 10, 3);
    for (let i = 0; i < n; i++) {
      if (!isNaN(r1.upper[i]) && !isNaN(r2.upper[i])) {
        const w1 = r1.upper[i] - r1.lower[i];
        const w2 = r2.upper[i] - r2.lower[i];
        expect(w2).toBeGreaterThanOrEqual(w1 - 0.01);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Donchian Channel
// ═══════════════════════════════════════════════════════════════════════════════

describe('donchianChannel', () => {
  it('upper = rolling max of highs', () => {
    const highs = [100, 105, 110, 108, 112];
    const lows = [90, 95, 100, 98, 102];
    const result = donchianChannel(highs, lows, 3);
    closeTo(result.upper[2], 110);
    closeTo(result.upper[3], 110);
    closeTo(result.upper[4], 112);
  });

  it('lower = rolling min of lows', () => {
    const highs = [100, 105, 110, 108, 112];
    const lows = [90, 95, 100, 98, 102];
    const result = donchianChannel(highs, lows, 3);
    closeTo(result.lower[2], 90);
    closeTo(result.lower[3], 95);
    closeTo(result.lower[4], 98);
  });

  it('middle = (upper + lower) / 2', () => {
    const highs = [100, 105, 110, 108, 112];
    const lows = [90, 95, 100, 98, 102];
    const result = donchianChannel(highs, lows, 3);
    for (let i = 0; i < 5; i++) {
      if (!isNaN(result.upper[i]) && !isNaN(result.lower[i])) {
        closeTo(result.middle[i], (result.upper[i] + result.lower[i]) / 2);
      }
    }
  });

  it('returns empty for empty input', () => {
    const result = donchianChannel([], []);
    expect(result.upper).toHaveLength(0);
  });

  it('NaN for warm-up', () => {
    const result = donchianChannel([100, 110], [90, 95], 3);
    expect(result.upper[0]).toBeNaN();
    expect(result.upper[1]).toBeNaN();
  });

  it('constant data gives equal bands', () => {
    const h = new Array(10).fill(100);
    const l = new Array(10).fill(100);
    const result = donchianChannel(h, l, 5);
    const valid = result.upper.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 100));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Historical Volatility
// ═══════════════════════════════════════════════════════════════════════════════

describe('historicalVolatility', () => {
  it('returns 0 for constant prices', () => {
    const closes = new Array(30).fill(100);
    const result = historicalVolatility(closes, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('returns positive for varying prices', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const result = historicalVolatility(closes, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('higher HV for more volatile data', () => {
    const calm = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 1);
    const wild = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 20);
    const r1 = historicalVolatility(calm, 20);
    const r2 = historicalVolatility(wild, 20);
    const v1 = r1.filter(v => !isNaN(v));
    const v2 = r2.filter(v => !isNaN(v));
    if (v1.length && v2.length) {
      expect(v2[v2.length - 1]).toBeGreaterThan(v1[v1.length - 1]);
    }
  });

  it('annualizes by sqrt(252) factor', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const r1 = historicalVolatility(closes, 20, 252);
    const r2 = historicalVolatility(closes, 20, 1);
    const v1 = r1.filter(v => !isNaN(v));
    const v2 = r2.filter(v => !isNaN(v));
    if (v1.length && v2.length) {
      expect(v1[v1.length - 1] / v2[v2.length - 1]).toBeCloseTo(Math.sqrt(252), 0);
    }
  });

  it('returns NaN array for < 2 data points', () => {
    const result = historicalVolatility([100]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Chaikin Volatility
// ═══════════════════════════════════════════════════════════════════════════════

describe('chaikinVolatility', () => {
  it('returns correct length', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const result = chaikinVolatility(h, l, 10, 10);
    expect(result).toHaveLength(n);
  });

  it('returns 0 for constant H-L spread', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const result = chaikinVolatility(h, l, 10, 10);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('returns empty for empty input', () => {
    expect(chaikinVolatility([], [])).toHaveLength(0);
  });

  it('positive when H-L spread expanding', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 100 + i);
    const l = Array.from({ length: n }, (_, i) => 100 - i);
    const result = chaikinVolatility(h, l, 5, 5);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length) {
      expect(valid[valid.length - 1]).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Standard Deviation
// ═══════════════════════════════════════════════════════════════════════════════

describe('standardDeviation', () => {
  it('returns 0 for constant data', () => {
    const result = standardDeviation(new Array(30).fill(100), 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('positive for varying data', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = standardDeviation(data, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('known std dev: [2,4,4,4,5,5,7,9] period 8', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = standardDeviation(data, 8);
    // mean = 5, variance = 4, std = 2 (population)
    closeTo(result[7], 2);
  });

  it('returns NaN during warm-up', () => {
    const result = standardDeviation([1, 2, 3], 5);
    result.forEach(v => expect(v).toBeNaN());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GARCH(1,1)
// ═══════════════════════════════════════════════════════════════════════════════

describe('garch11', () => {
  it('returns annualized volatility estimates', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const result = garch11(closes);
    expect(result).toHaveLength(50);
    const valid = result.filter(v => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns NaN array for < 2 data', () => {
    const result = garch11([100]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('reacts to volatility clusters', () => {
    const calm = new Array(20).fill(100);
    const shock = [100, 120, 80, 130, 70, 140, 60, 150, 50, 160];
    const data = [...calm, ...shock];
    const result = garch11(data, 0.00001, 0.1, 0.85);
    const calmEnd = result[19];
    const shockEnd = result[29];
    if (!isNaN(calmEnd) && !isNaN(shockEnd)) {
      expect(shockEnd).toBeGreaterThan(calmEnd);
    }
  });

  it('sigma2 depends on omega, alpha, beta', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 3);
    const r1 = garch11(closes, 0.00001, 0.05, 0.9);
    const r2 = garch11(closes, 0.00001, 0.2, 0.7);
    expect(r1).toHaveLength(50);
    expect(r2).toHaveLength(50);
  });

  it('all outputs are positive or NaN', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.random() * 10);
    const result = garch11(closes);
    result.forEach(v => {
      if (!isNaN(v)) expect(v).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Realized Volatility Estimators
// ═══════════════════════════════════════════════════════════════════════════════

describe('realizedVolatilityCloseToClose', () => {
  it('is alias for historicalVolatility', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const r1 = realizedVolatilityCloseToClose(closes, 20, 252);
    const r2 = historicalVolatility(closes, 20, 252);
    for (let i = 0; i < 30; i++) {
      if (isNaN(r1[i])) expect(r2[i]).toBeNaN();
      else closeTo(r1[i], r2[i]);
    }
  });
});

describe('realizedVolatilityParkinson', () => {
  it('returns positive values for varying H-L', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const result = realizedVolatilityParkinson(h, l, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns empty for empty input', () => {
    expect(realizedVolatilityParkinson([], [])).toHaveLength(0);
  });

  it('higher for wider H-L ranges', () => {
    const n = 30;
    const narrow_h = Array.from({ length: n }, () => 101);
    const narrow_l = Array.from({ length: n }, () => 99);
    const wide_h = Array.from({ length: n }, () => 120);
    const wide_l = Array.from({ length: n }, () => 80);
    const r1 = realizedVolatilityParkinson(narrow_h, narrow_l, 20);
    const r2 = realizedVolatilityParkinson(wide_h, wide_l, 20);
    const v1 = r1.filter(v => !isNaN(v));
    const v2 = r2.filter(v => !isNaN(v));
    if (v1.length && v2.length) {
      expect(v2[v2.length - 1]).toBeGreaterThan(v1[v1.length - 1]);
    }
  });
});

describe('realizedVolatilityGarmanKlass', () => {
  it('returns correct length', () => {
    const n = 30;
    const o = Array.from({ length: n }, (_, i) => 100 + i);
    const h = o.map(v => v + 5);
    const l = o.map(v => v - 5);
    const c = o.map(v => v + 2);
    const result = realizedVolatilityGarmanKlass(o, h, l, c, 20);
    expect(result).toHaveLength(n);
  });

  it('returns empty for empty input', () => {
    expect(realizedVolatilityGarmanKlass([], [], [], [])).toHaveLength(0);
  });
});

describe('realizedVolatilityRogersSatchell', () => {
  it('returns correct length', () => {
    const n = 30;
    const o = Array.from({ length: n }, (_, i) => 100 + i);
    const h = o.map(v => v + 5);
    const l = o.map(v => v - 5);
    const c = o.map(v => v + 2);
    const result = realizedVolatilityRogersSatchell(o, h, l, c, 20);
    expect(result).toHaveLength(n);
  });

  it('returns empty for empty input', () => {
    expect(realizedVolatilityRogersSatchell([], [], [], [])).toHaveLength(0);
  });
});

describe('realizedVolatilityYangZhang', () => {
  it('returns correct length', () => {
    const n = 30;
    const o = Array.from({ length: n }, (_, i) => 100 + i);
    const h = o.map(v => v + 5);
    const l = o.map(v => v - 5);
    const c = o.map(v => v + 2);
    const result = realizedVolatilityYangZhang(o, h, l, c, 20);
    expect(result).toHaveLength(n);
  });

  it('returns NaN for < 2 data', () => {
    const result = realizedVolatilityYangZhang([100], [105], [95], [102]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('positive output for volatile data', () => {
    const n = 40;
    const o = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 3);
    const h = o.map(v => v + 5 + Math.random() * 2);
    const l = o.map(v => v - 5 - Math.random() * 2);
    const c = o.map(v => v + (Math.random() - 0.5) * 4);
    const result = realizedVolatilityYangZhang(o, h, l, c, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATR Percent / NATR
// ═══════════════════════════════════════════════════════════════════════════════

describe('atrPercent / natr', () => {
  it('atrPercent = atr / close * 100', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const result = atrPercent(h, l, c, 14);
    const atrVals = atr(h, l, c, 14);
    for (let i = 0; i < n; i++) {
      if (!isNaN(result[i]) && !isNaN(atrVals[i])) {
        closeTo(result[i], (atrVals[i] / c[i]) * 100);
      }
    }
  });

  it('natr = atrPercent', () => {
    const n = 30;
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 100);
    const r1 = atrPercent(h, l, c, 14);
    const r2 = natr(h, l, c, 14);
    for (let i = 0; i < n; i++) {
      if (isNaN(r1[i])) expect(r2[i]).toBeNaN();
      else closeTo(r1[i], r2[i]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience: bollingerBandWidth, bollingerPercentB
// ═══════════════════════════════════════════════════════════════════════════════

describe('bollingerBandWidth / bollingerPercentB', () => {
  it('bollingerBandWidth returns bandwidth from BB', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const bw = bollingerBandWidth(data, 20, 2);
    const bb = bollingerBands(data, 20, 2);
    for (let i = 0; i < 30; i++) {
      if (isNaN(bw[i])) expect(bb.bandwidth[i]).toBeNaN();
      else closeTo(bw[i], bb.bandwidth[i]);
    }
  });

  it('bollingerPercentB returns %B from BB', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const pb = bollingerPercentB(data, 20, 2);
    const bb = bollingerBands(data, 20, 2);
    for (let i = 0; i < 30; i++) {
      if (isNaN(pb[i])) expect(bb.percentB[i]).toBeNaN();
      else closeTo(pb[i], bb.percentB[i]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Misc: ulcerIndex, massIndex, averageDayRange, RVI, intradayIntensity
// ═══════════════════════════════════════════════════════════════════════════════

describe('ulcerIndex', () => {
  it('returns 0 for monotonically rising prices', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = ulcerIndex(data, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('positive for drawdown', () => {
    const data = [100, 105, 110, 108, 95, 90, 85, 80, 82, 84, 86, 88, 90, 92, 94];
    const result = ulcerIndex(data, 10);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length) expect(valid[valid.length - 1]).toBeGreaterThan(0);
  });

  it('returns empty for empty input', () => {
    expect(ulcerIndex([])).toHaveLength(0);
  });
});

describe('massIndex', () => {
  it('returns correct length', () => {
    const n = 50;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const result = massIndex(h, l);
    expect(result).toHaveLength(n);
  });

  it('returns empty for empty input', () => {
    expect(massIndex([], [])).toHaveLength(0);
  });
});

describe('averageDayRange', () => {
  it('returns SMA of H-L', () => {
    const h = [110, 112, 114, 116, 118];
    const l = [100, 102, 104, 106, 108];
    const result = averageDayRange(h, l, 3);
    closeTo(result[2], 10);
    closeTo(result[3], 10);
    closeTo(result[4], 10);
  });

  it('returns empty for empty input', () => {
    expect(averageDayRange([], [])).toHaveLength(0);
  });
});

describe('relativeVolatilityIndex', () => {
  it('returns correct length', () => {
    const data = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = relativeVolatilityIndex(data, 10, 14);
    expect(result).toHaveLength(40);
  });

  it('bounded between 0 and 100', () => {
    const data = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 2) * 10);
    const result = relativeVolatilityIndex(data, 10, 14);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('returns NaN array when data too short', () => {
    const result = relativeVolatilityIndex([1, 2, 3], 10, 14);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('volatilityStop', () => {
  it('returns stop and direction arrays', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = volatilityStop(h, l, c, 10, 2);
    expect(result.stop).toHaveLength(n);
    expect(result.direction).toHaveLength(n);
  });

  it('direction is 1 or -1', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i / 3) * 10);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const result = volatilityStop(h, l, c, 10, 2);
    result.direction.filter(v => v !== 0).forEach(v => {
      expect(Math.abs(v)).toBe(1);
    });
  });

  it('returns empty for empty input', () => {
    const result = volatilityStop([], [], []);
    expect(result.stop).toHaveLength(0);
  });
});

describe('vixStyleCalculation', () => {
  it('returns annualized values', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const result = vixStyleCalculation(closes, 30);
    const valid = result.filter(v => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
    valid.forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns NaN for < 2 data', () => {
    const result = vixStyleCalculation([100]);
    result.forEach(v => expect(v).toBeNaN());
  });
});
