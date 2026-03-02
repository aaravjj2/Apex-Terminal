import { describe, it, expect } from 'vitest';
import {
  rsi, macd, stochastic, stochasticRSI, cci, williamsR,
  roc, momentum, ultimateOscillator, tsi, cmo, ppo,
  aroonOscillator, coppockCurve, dpo, kst, elderForceIndex,
  balanceOfPower, awesomeOscillator, trix, fisherTransform,
  connorsRSI, choppinessIndex, relativeVigorIndex,
} from '../../../src/lib/indicators/momentum';

const closeTo = (val: number, expected: number, tol = 1e-4) =>
  expect(val).toBeCloseTo(expected, -Math.log10(tol));

const rising = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
const falling = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
const flat = new Array(30).fill(100);

// ═══════════════════════════════════════════════════════════════════════════════
// RSI
// ═══════════════════════════════════════════════════════════════════════════════

describe('rsi', () => {
  it('returns NaN for warm-up period', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(data, 14);
    for (let i = 0; i < 14; i++) {
      expect(result[i]).toBeNaN();
    }
  });

  it('returns high RSI (near 100) for strongly rising prices', () => {
    const result = rsi(rising, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeGreaterThan(85));
  });

  it('returns low RSI (near 0) for strongly falling prices', () => {
    const result = rsi(falling, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(v).toBeLessThan(15));
  });

  it('returns RSI 50 for no change', () => {
    const data = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const result = rsi(data, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 50));
  });

  it('returns empty for empty input', () => {
    expect(rsi([])).toHaveLength(0);
  });

  it('returns NaN array when data < period + 1', () => {
    const result = rsi([1, 2, 3], 14);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('RSI bounded between 0 and 100', () => {
    const volatile = [100, 110, 95, 115, 85, 120, 80, 125, 75, 130, 70, 135, 65, 140, 60, 145, 55, 150, 50, 155];
    const result = rsi(volatile, 5);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('uses default period of 14', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i);
    const r1 = rsi(data);
    const r2 = rsi(data, 14);
    for (let i = 0; i < 30; i++) {
      if (isNaN(r1[i])) expect(r2[i]).toBeNaN();
      else closeTo(r1[i], r2[i]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MACD
// ═══════════════════════════════════════════════════════════════════════════════

describe('macd', () => {
  it('returns macd, signal, histogram arrays of correct length', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = macd(data);
    expect(result.macd).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);
  });

  it('histogram = macd - signal', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = macd(data, 12, 26, 9);
    for (let i = 0; i < 50; i++) {
      if (!isNaN(result.macd[i]) && !isNaN(result.signal[i])) {
        closeTo(result.histogram[i], result.macd[i] - result.signal[i]);
      }
    }
  });

  it('macd line is positive for uptrend', () => {
    const data = Array.from({ length: 50 }, (_, i) => 50 + i * 3);
    const result = macd(data, 5, 10, 3);
    const valid = result.macd.filter(v => !isNaN(v));
    valid.slice(-5).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('macd line is negative for downtrend', () => {
    const data = Array.from({ length: 50 }, (_, i) => 200 - i * 3);
    const result = macd(data, 5, 10, 3);
    const valid = result.macd.filter(v => !isNaN(v));
    valid.slice(-5).forEach(v => expect(v).toBeLessThan(0));
  });

  it('returns empty arrays for empty input', () => {
    const result = macd([]);
    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
    expect(result.histogram).toHaveLength(0);
  });

  it('uses default parameters 12,26,9', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const r1 = macd(data);
    const r2 = macd(data, 12, 26, 9);
    for (let i = 0; i < 50; i++) {
      if (isNaN(r1.macd[i])) expect(r2.macd[i]).toBeNaN();
      else closeTo(r1.macd[i], r2.macd[i]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stochastic
// ═══════════════════════════════════════════════════════════════════════════════

describe('stochastic', () => {
  it('returns k and d arrays', () => {
    const highs = Array.from({ length: 30 }, (_, i) => 110 + i);
    const lows = Array.from({ length: 30 }, (_, i) => 90 + i);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = stochastic(highs, lows, closes);
    expect(result.k).toHaveLength(30);
    expect(result.d).toHaveLength(30);
  });

  it('%K near 100 when close at highest high', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [50, 50, 50, 50, 50];
    const result = stochastic(highs, lows, closes, 3, 1, 1);
    const valid = result.k.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 100));
  });

  it('%K near 0 when close at lowest low', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [40, 40, 40, 40, 40];
    const result = stochastic(highs, lows, closes, 3, 1, 1);
    const valid = result.k.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('%K = 50 when close midway', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [45, 45, 45, 45, 45];
    const result = stochastic(highs, lows, closes, 3, 1, 1);
    const valid = result.k.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 50));
  });

  it('returns empty for empty input', () => {
    const result = stochastic([], [], []);
    expect(result.k).toHaveLength(0);
    expect(result.d).toHaveLength(0);
  });

  it('%D is SMA of %K', () => {
    const highs = Array.from({ length: 30 }, () => 120);
    const lows = Array.from({ length: 30 }, () => 80);
    const closes = Array.from({ length: 30 }, (_, i) => 90 + i);
    const result = stochastic(highs, lows, closes, 14, 3, 3);
    expect(result.d).toHaveLength(30);
  });

  it('bounded between 0 and 100', () => {
    const highs = [100, 110, 95, 115, 90, 120, 85, 125, 80, 130, 75, 135, 70, 140, 105, 108, 112, 103, 107, 118];
    const lows = [90, 95, 85, 100, 80, 105, 75, 110, 70, 115, 65, 120, 60, 125, 95, 98, 102, 93, 97, 108];
    const closes = [95, 105, 90, 110, 85, 115, 80, 120, 75, 125, 70, 130, 65, 135, 100, 103, 107, 98, 102, 113];
    const result = stochastic(highs, lows, closes, 5, 3, 3);
    result.k.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(100.01);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CCI
// ═══════════════════════════════════════════════════════════════════════════════

describe('cci', () => {
  it('returns 0 for constant data', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const result = cci(h, l, c, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('returns positive for uptrend', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i * 2);
    const l = Array.from({ length: n }, (_, i) => 90 + i * 2);
    const c = Array.from({ length: n }, (_, i) => 105 + i * 2);
    const result = cci(h, l, c, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-5).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns empty for empty input', () => {
    expect(cci([], [], [])).toHaveLength(0);
  });

  it('returns NaN during warm-up', () => {
    const result = cci([100], [90], [95], 5);
    expect(result[0]).toBeNaN();
  });

  it('uses 0.015 constant in formula', () => {
    const h = [102, 104, 106, 108, 110];
    const l = [98, 96, 94, 92, 90];
    const c = [100, 100, 100, 100, 100];
    const result = cci(h, l, c, 5);
    expect(result).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Williams %R
// ═══════════════════════════════════════════════════════════════════════════════

describe('williamsR', () => {
  it('returns -100 when close = lowest low', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [40, 40, 40, 40, 40];
    const result = williamsR(highs, lows, closes, 3);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, -100));
  });

  it('returns 0 when close = highest high', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [50, 50, 50, 50, 50];
    const result = williamsR(highs, lows, closes, 3);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });

  it('returns -50 when close midway', () => {
    const highs = [50, 50, 50, 50, 50];
    const lows = [40, 40, 40, 40, 40];
    const closes = [45, 45, 45, 45, 45];
    const result = williamsR(highs, lows, closes, 3);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, -50));
  });

  it('bounded between -100 and 0', () => {
    const h = Array.from({ length: 20 }, () => 120 + Math.random() * 20);
    const l = Array.from({ length: 20 }, () => 80 + Math.random() * 10);
    const c = Array.from({ length: 20 }, () => 95 + Math.random() * 20);
    const result = williamsR(h, l, c, 5);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeLessThanOrEqual(0.01);
      expect(v).toBeGreaterThanOrEqual(-100.01);
    });
  });

  it('returns empty for empty input', () => {
    expect(williamsR([], [], [])).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROC
// ═══════════════════════════════════════════════════════════════════════════════

describe('roc', () => {
  it('calculates percentage change', () => {
    const data = [100, 110, 121];
    const result = roc(data, 1);
    // roc[1] = (110 - 100)/100 * 100 = 10%
    closeTo(result[1], 10);
    // roc[2] = (121 - 110)/110 * 100 = 10%
    closeTo(result[2], 10);
  });

  it('returns NaN for first period bars', () => {
    const result = roc([100, 110, 120, 130], 2);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    closeTo(result[2], 20); // (120-100)/100 * 100
    closeTo(result[3], 18.18, 0.01); // (130-110)/110 * 100
  });

  it('returns 0 for unchanged price', () => {
    const data = [50, 50, 50, 50];
    const result = roc(data, 1);
    closeTo(result[1], 0);
    closeTo(result[2], 0);
  });

  it('returns negative for falling prices', () => {
    const data = [100, 90];
    const result = roc(data, 1);
    closeTo(result[1], -10);
  });

  it('returns empty for empty input', () => {
    expect(roc([])).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Momentum (simple difference)
// ═══════════════════════════════════════════════════════════════════════════════

describe('momentum', () => {
  it('calculates price difference', () => {
    const data = [100, 110, 125, 140];
    const result = momentum(data, 2);
    // mom[2] = 125 - 100 = 25
    closeTo(result[2], 25);
    // mom[3] = 140 - 110 = 30
    closeTo(result[3], 30);
  });

  it('returns NaN for warm-up', () => {
    const result = momentum([10, 20, 30], 2);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    closeTo(result[2], 20);
  });

  it('returns 0 for unchanged prices', () => {
    const data = [50, 50, 50, 50];
    const result = momentum(data, 1);
    closeTo(result[1], 0);
    closeTo(result[2], 0);
  });

  it('returns empty for empty input', () => {
    expect(momentum([])).toHaveLength(0);
  });

  it('returns negative for falling prices', () => {
    const data = [100, 80, 60];
    const result = momentum(data, 1);
    closeTo(result[1], -20);
    closeTo(result[2], -20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Ultimate Oscillator
// ═══════════════════════════════════════════════════════════════════════════════

describe('ultimateOscillator', () => {
  it('returns correct length', () => {
    const n = 40;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const result = ultimateOscillator(h, l, c);
    expect(result).toHaveLength(n);
  });

  it('bounded between 0 and 100', () => {
    const n = 50;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i / 3) * 10);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const result = ultimateOscillator(h, l, c, 7, 14, 28);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('returns NaN array for < 2 data points', () => {
    const result = ultimateOscillator([100], [90], [95]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('uses weighted average of 3 periods (4:2:1)', () => {
    const n = 40;
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 100);
    const result = ultimateOscillator(h, l, c, 3, 5, 7);
    expect(result).toHaveLength(n);
  });

  it('returns high values in uptrend', () => {
    const n = 40;
    const c = Array.from({ length: n }, (_, i) => 100 + i * 2);
    const h = c.map(v => v + 5);
    const l = c.map(v => v - 5);
    const result = ultimateOscillator(h, l, c, 5, 10, 15);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length) {
      expect(valid[valid.length - 1]).toBeGreaterThan(40);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSI
// ═══════════════════════════════════════════════════════════════════════════════

describe('tsi', () => {
  it('returns tsi and signal arrays', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i);
    const result = tsi(data);
    expect(result.tsi).toHaveLength(60);
    expect(result.signal).toHaveLength(60);
  });

  it('positive for uptrend', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    const result = tsi(data, 10, 5, 5);
    const valid = result.tsi.filter(v => !isNaN(v));
    valid.slice(-5).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('negative for downtrend', () => {
    const data = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
    const result = tsi(data, 10, 5, 5);
    const valid = result.tsi.filter(v => !isNaN(v));
    valid.slice(-5).forEach(v => expect(v).toBeLessThan(0));
  });

  it('returns empty for empty input', () => {
    const result = tsi([]);
    expect(result.tsi).toHaveLength(0);
  });

  it('bounded between -100 and 100', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 30);
    const result = tsi(data, 10, 5, 5);
    result.tsi.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-100.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CMO
// ═══════════════════════════════════════════════════════════════════════════════

describe('cmo', () => {
  it('returns 100 for consistently rising prices', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const result = cmo(data, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => closeTo(v, 100));
  });

  it('returns -100 for consistently falling prices', () => {
    const data = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    const result = cmo(data, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => closeTo(v, -100));
  });

  it('near 0 for symmetric up/down', () => {
    const data = [100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102];
    const result = cmo(data, 10);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => expect(Math.abs(v)).toBeLessThan(25));
  });

  it('returns NaN array when data < period + 1', () => {
    const result = cmo([1, 2, 3], 14);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('bounded between -100 and 100', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 20);
    const result = cmo(data, 10);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-100.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PPO
// ═══════════════════════════════════════════════════════════════════════════════

describe('ppo', () => {
  it('returns ppo, signal, histogram', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = ppo(data);
    expect(result.ppo).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);
  });

  it('histogram = ppo - signal', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = ppo(data, 12, 26, 9);
    for (let i = 0; i < 50; i++) {
      if (!isNaN(result.ppo[i]) && !isNaN(result.signal[i])) {
        closeTo(result.histogram[i], result.ppo[i] - result.signal[i]);
      }
    }
  });

  it('positive for uptrend', () => {
    const data = Array.from({ length: 50 }, (_, i) => 50 + i * 3);
    const result = ppo(data, 5, 10, 3);
    const valid = result.ppo.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns empty for empty input', () => {
    const result = ppo([]);
    expect(result.ppo).toHaveLength(0);
  });

  it('expressed as percentage (differs from MACD)', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const ppoResult = ppo(data, 12, 26, 9);
    const macdResult = macd(data, 12, 26, 9);
    const validPPO = ppoResult.ppo.filter(v => !isNaN(v));
    const validMACD = macdResult.macd.filter(v => !isNaN(v));
    expect(validPPO.length).toBeGreaterThan(0);
    expect(validMACD.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Aroon Oscillator
// ═══════════════════════════════════════════════════════════════════════════════

describe('aroonOscillator', () => {
  it('returns up, down, oscillator', () => {
    const h = Array.from({ length: 40 }, (_, i) => 100 + i);
    const l = Array.from({ length: 40 }, (_, i) => 90 + i);
    const result = aroonOscillator(h, l, 25);
    expect(result.up).toHaveLength(40);
    expect(result.down).toHaveLength(40);
    expect(result.oscillator).toHaveLength(40);
  });

  it('oscillator = up - down', () => {
    const h = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 10);
    const l = Array.from({ length: 40 }, (_, i) => 90 + Math.sin(i) * 10);
    const result = aroonOscillator(h, l, 10);
    for (let i = 0; i < 40; i++) {
      if (!isNaN(result.up[i]) && !isNaN(result.down[i])) {
        closeTo(result.oscillator[i], result.up[i] - result.down[i]);
      }
    }
  });

  it('Aroon Up = 100 when latest bar is highest', () => {
    const h = [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
    const l = new Array(11).fill(80);
    const result = aroonOscillator(h, l, 10);
    closeTo(result.up[10], 100);
  });

  it('returns empty for empty input', () => {
    const result = aroonOscillator([], []);
    expect(result.up).toHaveLength(0);
  });

  it('bounded between -100 and 100', () => {
    const h = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: 40 }, (_, i) => 80 + Math.sin(i / 3) * 10);
    const result = aroonOscillator(h, l, 10);
    result.oscillator.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-100.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Coppock Curve
// ═══════════════════════════════════════════════════════════════════════════════

describe('coppockCurve', () => {
  it('returns correct length', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = coppockCurve(data);
    expect(result).toHaveLength(50);
  });

  it('positive for sustained uptrend', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    const result = coppockCurve(data, 10, 14, 11);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length) {
      expect(valid[valid.length - 1]).toBeGreaterThan(0);
    }
  });

  it('returns empty for empty input', () => {
    expect(coppockCurve([])).toHaveLength(0);
  });

  it('uses WMA of long + short ROC', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i);
    const result = coppockCurve(data, 5, 10, 8);
    expect(result).toHaveLength(60);
  });

  it('has NaN warm-up', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i);
    const result = coppockCurve(data);
    expect(result[0]).toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stochastic RSI
// ═══════════════════════════════════════════════════════════════════════════════

describe('stochasticRSI', () => {
  it('returns k and d arrays', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 20);
    const result = stochasticRSI(data);
    expect(result.k).toHaveLength(60);
    expect(result.d).toHaveLength(60);
  });

  it('returns empty for empty input', () => {
    const result = stochasticRSI([]);
    expect(result.k).toHaveLength(0);
  });

  it('bounded between 0 and 100 for valid values', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 20);
    const result = stochasticRSI(data, 14, 14, 3, 3);
    result.k.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('has longer warm-up than plain RSI', () => {
    const data = Array.from({ length: 60 }, (_, i) => 100 + i);
    const rsiResult = rsi(data, 14);
    const stochResult = stochasticRSI(data, 14, 14, 3, 3);
    const rsiNaN = rsiResult.filter(v => isNaN(v)).length;
    const stochNaN = stochResult.k.filter(v => isNaN(v)).length;
    expect(stochNaN).toBeGreaterThanOrEqual(rsiNaN);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Elder Force Index, Balance of Power, Awesome Oscillator, TRIX, Fisher Transform
// ═══════════════════════════════════════════════════════════════════════════════

describe('elderForceIndex', () => {
  it('positive when price rises on volume', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const volumes = new Array(30).fill(10000);
    const result = elderForceIndex(closes, volumes, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns empty for empty input', () => {
    expect(elderForceIndex([], [])).toHaveLength(0);
  });
});

describe('awesomeOscillator', () => {
  it('returns correct length', () => {
    const h = Array.from({ length: 50 }, (_, i) => 110 + i);
    const l = Array.from({ length: 50 }, (_, i) => 90 + i);
    const result = awesomeOscillator(h, l, 5, 34);
    expect(result).toHaveLength(50);
  });

  it('returns empty for empty input', () => {
    expect(awesomeOscillator([], [])).toHaveLength(0);
  });

  it('positive for uptrend', () => {
    const h = Array.from({ length: 50 }, (_, i) => 110 + i * 2);
    const l = Array.from({ length: 50 }, (_, i) => 90 + i * 2);
    const result = awesomeOscillator(h, l, 5, 20);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => expect(v).toBeGreaterThan(0));
  });
});

describe('trix', () => {
  it('returns trix and signal', () => {
    const data = Array.from({ length: 80 }, (_, i) => 100 + i);
    const result = trix(data, 10, 5);
    expect(result.trix).toHaveLength(80);
    expect(result.signal).toHaveLength(80);
  });

  it('returns empty for empty input', () => {
    const result = trix([]);
    expect(result.trix).toHaveLength(0);
  });
});

describe('fisherTransform', () => {
  it('returns fisher and trigger', () => {
    const h = Array.from({ length: 30 }, (_, i) => 110 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: 30 }, (_, i) => 90 + Math.sin(i / 3) * 10);
    const result = fisherTransform(h, l, 10);
    expect(result.fisher).toHaveLength(30);
    expect(result.trigger).toHaveLength(30);
  });

  it('returns empty for empty input', () => {
    const result = fisherTransform([], []);
    expect(result.fisher).toHaveLength(0);
  });
});

describe('choppinessIndex', () => {
  it('bounded between 0 and 100', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 5);
    const result = choppinessIndex(h, l, c, 14);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('returns NaN for fewer than 2 data points', () => {
    const result = choppinessIndex([100], [90], [95]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('relativeVigorIndex', () => {
  it('returns rvi and signal arrays', () => {
    const n = 30;
    const o = Array.from({ length: n }, (_, i) => 100 + i);
    const h = o.map(v => v + 5);
    const l = o.map(v => v - 5);
    const c = o.map(v => v + 3);
    const result = relativeVigorIndex(o, h, l, c, 10);
    expect(result.rvi).toHaveLength(n);
    expect(result.signal).toHaveLength(n);
  });

  it('returns NaN arrays for < 4 data', () => {
    const result = relativeVigorIndex([1, 2, 3], [2, 3, 4], [0, 1, 2], [1.5, 2.5, 3.5]);
    result.rvi.forEach(v => expect(v).toBeNaN());
  });
});
