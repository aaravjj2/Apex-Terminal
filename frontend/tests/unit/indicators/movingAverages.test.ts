import { describe, it, expect } from 'vitest';
import {
  sma, ema, wma, dema, tema, hullMA, vwma, kama, alma,
  frama, t3, zeroLagEMA, mcginleyDynamic, triangularMA,
  rma, smma, lsma, vidya, jma, swma, applyMA,
} from '../../../src/lib/indicators/movingAverages';

const closeTo = (val: number, expected: number, tolerance = 1e-6) =>
  expect(val).toBeCloseTo(expected, -Math.log10(tolerance));

// ═══════════════════════════════════════════════════════════════════════════════
// SMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('sma', () => {
  it('calculates period-3 SMA on [1,2,3,4,5]', () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    closeTo(result[2], 2);
    closeTo(result[3], 3);
    closeTo(result[4], 4);
  });

  it('calculates period-1 SMA (identity)', () => {
    const data = [10, 20, 30, 40];
    const result = sma(data, 1);
    result.forEach((v, i) => closeTo(v, data[i]));
  });

  it('calculates period equal to data length', () => {
    const result = sma([2, 4, 6, 8], 4);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeNaN();
    closeTo(result[3], 5);
  });

  it('returns NaN array when period > data length', () => {
    const result = sma([1, 2], 5);
    expect(result).toHaveLength(2);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns empty array for empty input', () => {
    expect(sma([], 3)).toHaveLength(0);
  });

  it('returns empty array when period < 1', () => {
    expect(sma([1, 2, 3], 0)).toHaveLength(0);
  });

  it('handles single element with period 1', () => {
    const result = sma([42], 1);
    closeTo(result[0], 42);
  });

  it('handles constant series', () => {
    const result = sma([5, 5, 5, 5, 5], 3);
    closeTo(result[2], 5);
    closeTo(result[3], 5);
    closeTo(result[4], 5);
  });

  it('handles larger dataset correctly', () => {
    const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const result = sma(data, 5);
    closeTo(result[4], 12); // (10+11+12+13+14)/5
    closeTo(result[9], 17); // (15+16+17+18+19)/5
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('ema', () => {
  it('seeds with SMA then applies multiplier', () => {
    const data = [1, 2, 3, 4, 5, 6];
    const result = ema(data, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    closeTo(result[2], 2); // SMA seed = (1+2+3)/3
    // k = 2/(3+1) = 0.5
    // ema[3] = (4 - 2)*0.5 + 2 = 3
    closeTo(result[3], 3);
    // ema[4] = (5 - 3)*0.5 + 3 = 4
    closeTo(result[4], 4);
    // ema[5] = (6 - 4)*0.5 + 4 = 5
    closeTo(result[5], 5);
  });

  it('returns NaN array when period > data length', () => {
    const result = ema([1, 2], 5);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns empty array for empty input', () => {
    expect(ema([], 5)).toHaveLength(0);
  });

  it('handles period=1 (tracks data exactly)', () => {
    const data = [10, 20, 30];
    const result = ema(data, 1);
    // k = 2/2 = 1, so ema = data[i]
    closeTo(result[0], 10);
    closeTo(result[1], 20);
    closeTo(result[2], 30);
  });

  it('gives more weight to recent values', () => {
    const data = [10, 10, 10, 10, 100];
    const emaResult = ema(data, 4);
    const smaResult = sma(data, 4);
    // EMA should react more to the spike
    expect(emaResult[4]).toBeGreaterThan(smaResult[4]);
  });

  it('converges on constant series', () => {
    const result = ema([7, 7, 7, 7, 7, 7], 3);
    closeTo(result[2], 7);
    closeTo(result[5], 7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('wma', () => {
  it('calculates period-3 WMA with known weights', () => {
    // WMA(3) of [1,2,3]: (1*1 + 2*2 + 3*3) / (1+2+3) = (1+4+9)/6 = 14/6
    const result = wma([1, 2, 3], 3);
    closeTo(result[2], 14 / 6);
  });

  it('applies linearly increasing weights', () => {
    // [10, 20, 30, 40] period 3
    // at i=2: (10*1 + 20*2 + 30*3) / 6 = 140/6
    // at i=3: (20*1 + 30*2 + 40*3) / 6 = 200/6
    const result = wma([10, 20, 30, 40], 3);
    closeTo(result[2], 140 / 6);
    closeTo(result[3], 200 / 6);
  });

  it('returns NaN for warm-up period', () => {
    const result = wma([5, 10, 15, 20], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).not.toBeNaN();
  });

  it('returns NaN array when period > data length', () => {
    const result = wma([1, 2], 5);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns empty array for empty input', () => {
    expect(wma([], 3)).toHaveLength(0);
  });

  it('WMA period-1 equals the data itself', () => {
    const result = wma([5, 10, 15], 1);
    closeTo(result[0], 5);
    closeTo(result[1], 10);
    closeTo(result[2], 15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('dema', () => {
  it('produces values: 2*EMA1 - EMA2', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = dema(data, 3);
    expect(result).toHaveLength(10);
    const ema1 = ema(data, 3);
    const ema2 = ema(ema1, 3);
    for (let i = 0; i < 10; i++) {
      if (!isNaN(ema1[i]) && !isNaN(ema2[i])) {
        closeTo(result[i], 2 * ema1[i] - ema2[i]);
      } else {
        expect(result[i]).toBeNaN();
      }
    }
  });

  it('has NaN for initial warm-up', () => {
    const result = dema([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
  });

  it('returns empty for empty input', () => {
    expect(dema([], 3)).toHaveLength(0);
  });

  it('tracks a linear series closely', () => {
    const linear = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = dema(linear, 5);
    const lastValid = result.filter(v => !isNaN(v));
    closeTo(lastValid[lastValid.length - 1], 20, 1);
  });

  it('responds faster than EMA to changes', () => {
    const data = [10, 10, 10, 10, 10, 10, 10, 10, 10, 100];
    const demaResult = dema(data, 5);
    const emaResult = ema(data, 5);
    if (!isNaN(demaResult[9]) && !isNaN(emaResult[9])) {
      expect(demaResult[9]).toBeGreaterThan(emaResult[9]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('tema', () => {
  it('produces 3*e1 - 3*e2 + e3', () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = tema(data, 3);
    const e1 = ema(data, 3);
    const e2 = ema(e1, 3);
    const e3 = ema(e2, 3);
    for (let i = 0; i < 20; i++) {
      if (!isNaN(e1[i]) && !isNaN(e2[i]) && !isNaN(e3[i])) {
        closeTo(result[i], 3 * e1[i] - 3 * e2[i] + e3[i]);
      }
    }
  });

  it('returns empty for empty input', () => {
    expect(tema([], 3)).toHaveLength(0);
  });

  it('has more NaN warm-up than DEMA', () => {
    const data = Array.from({ length: 10 }, (_, i) => i + 1);
    const dResult = dema(data, 3);
    const tResult = tema(data, 3);
    const dNaN = dResult.filter(v => isNaN(v)).length;
    const tNaN = tResult.filter(v => isNaN(v)).length;
    expect(tNaN).toBeGreaterThanOrEqual(dNaN);
  });

  it('converges on constant series', () => {
    const data = new Array(20).fill(50);
    const result = tema(data, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 50));
  });

  it('tracks linear trend closely', () => {
    const linear = Array.from({ length: 30 }, (_, i) => i * 2);
    const result = tema(linear, 5);
    const last = result[29];
    if (!isNaN(last)) {
      expect(Math.abs(last - 58)).toBeLessThan(3);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hull Moving Average
// ═══════════════════════════════════════════════════════════════════════════════

describe('hullMA', () => {
  it('returns correct length', () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = hullMA(data, 9);
    expect(result).toHaveLength(20);
  });

  it('reduces lag compared to WMA', () => {
    const data = [10, 10, 10, 10, 10, 10, 10, 10, 10, 100, 100, 100];
    const hResult = hullMA(data, 4);
    const wResult = wma(data, 4);
    const lastHull = hResult.filter(v => !isNaN(v));
    const lastWma = wResult.filter(v => !isNaN(v));
    if (lastHull.length && lastWma.length) {
      expect(lastHull[lastHull.length - 1]).toBeGreaterThanOrEqual(
        lastWma[lastWma.length - 1] - 10
      );
    }
  });

  it('returns empty for empty input', () => {
    expect(hullMA([], 5)).toHaveLength(0);
  });

  it('handles period=1', () => {
    const result = hullMA([10, 20, 30], 1);
    expect(result).toHaveLength(3);
  });

  it('converges on constant data', () => {
    const data = new Array(20).fill(100);
    const result = hullMA(data, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 100));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VWMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('vwma', () => {
  it('calculates volume-weighted average', () => {
    const prices = [10, 20, 30];
    const volumes = [100, 200, 300];
    const result = vwma(prices, 3, { volumes });
    // (10*100 + 20*200 + 30*300) / (100+200+300) = 14000/600
    closeTo(result[2], 14000 / 600);
  });

  it('equals SMA when volumes are uniform', () => {
    const prices = [10, 20, 30, 40, 50];
    const volumes = [1, 1, 1, 1, 1];
    const vResult = vwma(prices, 3, { volumes });
    const sResult = sma(prices, 3);
    for (let i = 0; i < 5; i++) {
      if (!isNaN(vResult[i]) && !isNaN(sResult[i])) {
        closeTo(vResult[i], sResult[i]);
      }
    }
  });

  it('returns NaN array when no volumes provided', () => {
    const result = vwma([1, 2, 3], 2);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns NaN array when volumes length mismatches', () => {
    const result = vwma([1, 2, 3], 2, { volumes: [100, 200] });
    result.forEach(v => expect(v).toBeNaN());
  });

  it('weights toward high-volume prices', () => {
    const prices = [10, 100];
    const volumes = [1, 1000];
    const result = vwma(prices, 2, { volumes });
    expect(result[1]).toBeGreaterThan(90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KAMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('kama', () => {
  it('seeds at period-1 index with that value', () => {
    const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const result = kama(data, 5);
    closeTo(result[4], 14); // data[period-1]
  });

  it('adapts slowly in choppy market', () => {
    const choppy = [10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10];
    const result = kama(choppy, 5);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length >= 2) {
      const range = Math.max(...valid) - Math.min(...valid);
      expect(range).toBeLessThan(15);
    }
  });

  it('returns empty for empty input', () => {
    expect(kama([], 5)).toHaveLength(0);
  });

  it('returns NaN array when period > data length', () => {
    const result = kama([1, 2], 5);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('uses custom fast/slow periods', () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const r1 = kama(data, 5, { fastPeriod: 2, slowPeriod: 30 });
    const r2 = kama(data, 5, { fastPeriod: 5, slowPeriod: 10 });
    expect(r1).toHaveLength(20);
    expect(r2).toHaveLength(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('alma', () => {
  it('calculates Gaussian-weighted average', () => {
    const data = [1, 2, 3, 4, 5];
    const result = alma(data, 5, { offset: 0.85, sigma: 6 });
    expect(result[4]).not.toBeNaN();
    expect(result[0]).toBeNaN();
  });

  it('weights toward end with high offset', () => {
    const data = [1, 1, 1, 1, 100];
    const highOffset = alma(data, 5, { offset: 0.99, sigma: 6 });
    const lowOffset = alma(data, 5, { offset: 0.01, sigma: 6 });
    expect(highOffset[4]).toBeGreaterThan(lowOffset[4]);
  });

  it('uses default offset=0.85 and sigma=6', () => {
    const data = [10, 20, 30, 40, 50];
    const result = alma(data, 5);
    expect(result[4]).not.toBeNaN();
  });

  it('returns empty for empty input', () => {
    expect(alma([], 5)).toHaveLength(0);
  });

  it('converges on constant data', () => {
    const data = new Array(10).fill(42);
    const result = alma(data, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 42));
  });

  it('returns NaN for warm-up indices', () => {
    const result = alma([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RMA (Wilder's Smoothed MA)
// ═══════════════════════════════════════════════════════════════════════════════

describe('rma', () => {
  it('seeds with SMA then applies 1/period alpha', () => {
    const data = [1, 2, 3, 4, 5, 6];
    const result = rma(data, 3);
    // SMA seed = (1+2+3)/3 = 2, alpha = 1/3
    closeTo(result[2], 2);
    // rma[3] = 4 * (1/3) + 2 * (2/3) = 4/3 + 4/3 = 8/3
    closeTo(result[3], 8 / 3);
  });

  it('smma is alias for rma', () => {
    const data = [10, 20, 30, 40, 50];
    const rmaResult = rma(data, 3);
    const smmaResult = smma(data, 3);
    for (let i = 0; i < 5; i++) {
      if (isNaN(rmaResult[i])) {
        expect(smmaResult[i]).toBeNaN();
      } else {
        closeTo(smmaResult[i], rmaResult[i]);
      }
    }
  });

  it('returns NaN array when period > data length', () => {
    const result = rma([1], 5);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns empty for empty input', () => {
    expect(rma([], 5)).toHaveLength(0);
  });

  it('converges on constant data', () => {
    const data = new Array(20).fill(10);
    const result = rma(data, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 10));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LSMA (Least Squares MA)
// ═══════════════════════════════════════════════════════════════════════════════

describe('lsma', () => {
  it('fits linear regression to window', () => {
    const data = [1, 2, 3, 4, 5]; // perfect line
    const result = lsma(data, 5);
    closeTo(result[4], 5);
  });

  it('returns NaN for warm-up', () => {
    const result = lsma([10, 20, 30], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).not.toBeNaN();
  });

  it('predicts end of line for constant data', () => {
    const data = new Array(10).fill(7);
    const result = lsma(data, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 7));
  });

  it('returns NaN array for period < 2', () => {
    const result = lsma([1, 2, 3], 1);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('handles short data', () => {
    const result = lsma([5], 2);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Other MAs: FRAMA, T3, ZLEMA, McGinley, Triangular, VIDYA, JMA, SWMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('frama', () => {
  it('returns values starting at period-1', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i));
    const result = frama(data, 10);
    expect(result[8]).toBeNaN();
    expect(result[9]).not.toBeNaN();
  });

  it('returns NaN array for period < 2', () => {
    const result = frama([1, 2, 3], 1);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('adapts based on fractal dimension', () => {
    const data = Array.from({ length: 30 }, (_, i) => i + 1);
    const result = frama(data, 10);
    const valid = result.filter(v => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe('t3', () => {
  it('returns correct length', () => {
    const data = Array.from({ length: 50 }, (_, i) => i);
    const result = t3(data, 5);
    expect(result).toHaveLength(50);
  });

  it('returns empty for empty input', () => {
    expect(t3([], 5)).toHaveLength(0);
  });

  it('uses custom volume factor', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const r1 = t3(data, 5, { volumeFactor: 0.7 });
    const r2 = t3(data, 5, { volumeFactor: 0.9 });
    expect(r1).toHaveLength(50);
    expect(r2).toHaveLength(50);
  });
});

describe('zeroLagEMA', () => {
  it('reduces lag vs standard EMA', () => {
    const data = [10, 10, 10, 10, 10, 10, 10, 10, 10, 50];
    const zlResult = zeroLagEMA(data, 5);
    const eResult = ema(data, 5);
    const zlValid = zlResult.filter(v => !isNaN(v));
    const eValid = eResult.filter(v => !isNaN(v));
    if (zlValid.length && eValid.length) {
      expect(zlValid[zlValid.length - 1]).toBeGreaterThanOrEqual(
        eValid[eValid.length - 1] - 5
      );
    }
  });

  it('returns empty for empty input', () => {
    expect(zeroLagEMA([], 5)).toHaveLength(0);
  });
});

describe('mcginleyDynamic', () => {
  it('seeds with SMA and tracks price', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = mcginleyDynamic(data, 10);
    expect(result[8]).toBeNaN();
    expect(result[9]).not.toBeNaN();
  });

  it('returns empty for empty input', () => {
    expect(mcginleyDynamic([], 5)).toHaveLength(0);
  });

  it('stays close to price on trending data', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const result = mcginleyDynamic(data, 10);
    const last = result[29];
    if (!isNaN(last)) {
      expect(Math.abs(last - 158)).toBeLessThan(35);
    }
  });
});

describe('triangularMA', () => {
  it('is double-smoothed SMA', () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = triangularMA(data, 5);
    expect(result).toHaveLength(20);
  });

  it('returns empty for empty input', () => {
    expect(triangularMA([], 5)).toHaveLength(0);
  });

  it('is smoother than single SMA', () => {
    const data = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
    const tma = triangularMA(data, 5);
    const s = sma(data, 5);
    const tmaValid = tma.filter(v => !isNaN(v));
    const sValid = s.filter(v => !isNaN(v));
    const tmaRange = Math.max(...tmaValid) - Math.min(...tmaValid);
    const sRange = Math.max(...sValid) - Math.min(...sValid);
    expect(tmaRange).toBeLessThanOrEqual(sRange + 0.01);
  });
});

describe('vidya', () => {
  it('returns correct length', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i));
    const result = vidya(data, 10);
    expect(result).toHaveLength(30);
  });

  it('returns empty for empty input', () => {
    expect(vidya([], 5)).toHaveLength(0);
  });
});

describe('jma', () => {
  it('starts at first valid data point', () => {
    const data = [10, 20, 30, 40, 50];
    const result = jma(data, 3);
    closeTo(result[0], 10);
  });

  it('returns empty for empty input', () => {
    expect(jma([], 3)).toHaveLength(0);
  });

  it('accepts phase and power options', () => {
    const data = Array.from({ length: 20 }, (_, i) => i);
    const r1 = jma(data, 5, { phase: 50, power: 2 });
    const r2 = jma(data, 5, { phase: -50, power: 1 });
    expect(r1).toHaveLength(20);
    expect(r2).toHaveLength(20);
  });
});

describe('swma', () => {
  it('applies symmetrical weights [1,2,2,1]/6', () => {
    const data = [6, 12, 18, 24];
    const result = swma(data);
    // (6 + 2*12 + 2*18 + 24) / 6 = (6+24+36+24)/6 = 90/6 = 15
    closeTo(result[3], 15);
  });

  it('returns NaN for first 3 elements', () => {
    const result = swma([1, 2, 3, 4, 5]);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeNaN();
    expect(result[3]).not.toBeNaN();
  });

  it('returns all NaN for < 4 elements', () => {
    const result = swma([1, 2, 3]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// applyMA dispatcher
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyMA', () => {
  const data = Array.from({ length: 20 }, (_, i) => i + 1);

  it('dispatches sma correctly', () => {
    const direct = sma(data, 5);
    const dispatched = applyMA('sma', data, 5);
    for (let i = 0; i < 20; i++) {
      if (isNaN(direct[i])) expect(dispatched[i]).toBeNaN();
      else closeTo(dispatched[i], direct[i]);
    }
  });

  it('dispatches ema correctly', () => {
    const direct = ema(data, 5);
    const dispatched = applyMA('ema', data, 5);
    for (let i = 0; i < 20; i++) {
      if (isNaN(direct[i])) expect(dispatched[i]).toBeNaN();
      else closeTo(dispatched[i], direct[i]);
    }
  });

  it('defaults unknown type to sma', () => {
    const result = applyMA('unknown_type' as any, data, 5);
    const smaResult = sma(data, 5);
    for (let i = 0; i < 20; i++) {
      if (isNaN(smaResult[i])) expect(result[i]).toBeNaN();
      else closeTo(result[i], smaResult[i]);
    }
  });

  it('passes volumes for vwma', () => {
    const volumes = new Array(20).fill(100);
    const result = applyMA('vwma', data, 5, { volumes });
    expect(result).toHaveLength(20);
    expect(result[4]).not.toBeNaN();
  });

  it('dispatches all MA types without error', () => {
    const types = [
      'sma', 'ema', 'wma', 'dema', 'tema', 'hullma', 'kama',
      'alma', 'frama', 'zlema', 'mcginley', 'triangular', 'rma',
      'smma', 'lsma', 'vidya', 'jma', 'swma',
    ] as const;
    const bigData = Array.from({ length: 50 }, (_, i) => 100 + i);
    for (const t of types) {
      expect(() => applyMA(t, bigData, 5)).not.toThrow();
    }
  });
});
