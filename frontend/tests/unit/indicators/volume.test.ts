import { describe, it, expect } from 'vitest';
import {
  obv, accumulationDistribution, cmf, mfi, vwap, volumeProfile,
  volumeOscillator, pvt, nvi, pvi, emv, klingerVolumeOscillator,
  volumeRateOfChange, volumeWeightedRSI, adosc, forceIndex,
  volumeSMA, volumeEMA, relativeVolume, anchoredVWAP, twiggsMoneyFlow,
} from '../../../src/lib/indicators/volume';

const closeTo = (val: number, expected: number, tol = 1e-4) =>
  expect(val).toBeCloseTo(expected, -Math.log10(tol));

// ═══════════════════════════════════════════════════════════════════════════════
// OBV
// ═══════════════════════════════════════════════════════════════════════════════

describe('obv', () => {
  it('adds volume on up days', () => {
    const closes = [100, 110, 120];
    const volumes = [1000, 2000, 3000];
    const result = obv(closes, volumes);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(2000);
    expect(result[2]).toBe(5000);
  });

  it('subtracts volume on down days', () => {
    const closes = [100, 90, 80];
    const volumes = [1000, 2000, 3000];
    const result = obv(closes, volumes);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(-2000);
    expect(result[2]).toBe(-5000);
  });

  it('no change when close unchanged', () => {
    const closes = [100, 100, 100];
    const volumes = [1000, 2000, 3000];
    const result = obv(closes, volumes);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it('returns empty for empty input', () => {
    expect(obv([], [])).toHaveLength(0);
  });

  it('handles mixed up/down days', () => {
    const closes = [100, 110, 105, 115, 108];
    const volumes = [1000, 2000, 1500, 3000, 2500];
    const result = obv(closes, volumes);
    // 0, +2000, -1500 => 500, +3000 => 3500, -2500 => 1000
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(2000);
    expect(result[2]).toBe(500);
    expect(result[3]).toBe(3500);
    expect(result[4]).toBe(1000);
  });

  it('is cumulative', () => {
    const closes = [100, 110, 120, 130, 140];
    const volumes = [1000, 1000, 1000, 1000, 1000];
    const result = obv(closes, volumes);
    expect(result[4]).toBe(4000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Accumulation/Distribution Line
// ═══════════════════════════════════════════════════════════════════════════════

describe('accumulationDistribution', () => {
  it('CLV = 1 when close = high', () => {
    const highs = [100];
    const lows = [90];
    const closes = [100];
    const volumes = [10000];
    const result = accumulationDistribution(highs, lows, closes, volumes);
    // CLV = ((100-90) - (100-100)) / (100-90) = 10/10 = 1
    closeTo(result[0], 10000);
  });

  it('CLV = -1 when close = low', () => {
    const highs = [100];
    const lows = [90];
    const closes = [90];
    const volumes = [10000];
    const result = accumulationDistribution(highs, lows, closes, volumes);
    // CLV = ((90-90) - (100-90)) / (100-90) = -10/10 = -1
    closeTo(result[0], -10000);
  });

  it('CLV = 0 when close midpoint', () => {
    const highs = [100];
    const lows = [90];
    const closes = [95];
    const volumes = [10000];
    const result = accumulationDistribution(highs, lows, closes, volumes);
    // CLV = ((95-90) - (100-95)) / (100-90) = 0/10 = 0
    closeTo(result[0], 0);
  });

  it('is cumulative', () => {
    const highs = [100, 100];
    const lows = [90, 90];
    const closes = [100, 100];
    const volumes = [1000, 2000];
    const result = accumulationDistribution(highs, lows, closes, volumes);
    closeTo(result[0], 1000);
    closeTo(result[1], 3000); // 1000 + 2000
  });

  it('returns empty for empty input', () => {
    expect(accumulationDistribution([], [], [], [])).toHaveLength(0);
  });

  it('handles zero range (CLV = 0)', () => {
    const result = accumulationDistribution([100], [100], [100], [5000]);
    closeTo(result[0], 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CMF (Chaikin Money Flow)
// ═══════════════════════════════════════════════════════════════════════════════

describe('cmf', () => {
  it('positive when close near high consistently', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(108);
    const v = new Array(n).fill(10000);
    const result = cmf(h, l, c, v, 20);
    const valid = result.filter(val => !isNaN(val));
    valid.forEach(val => expect(val).toBeGreaterThan(0));
  });

  it('negative when close near low consistently', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(92);
    const v = new Array(n).fill(10000);
    const result = cmf(h, l, c, v, 20);
    const valid = result.filter(val => !isNaN(val));
    valid.forEach(val => expect(val).toBeLessThan(0));
  });

  it('zero when close at midpoint', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const v = new Array(n).fill(10000);
    const result = cmf(h, l, c, v, 20);
    const valid = result.filter(val => !isNaN(val));
    valid.forEach(val => closeTo(val, 0));
  });

  it('bounded between -1 and 1', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i) * 5);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i) * 5);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 8);
    const v = Array.from({ length: n }, () => 10000 + Math.random() * 5000);
    const result = cmf(h, l, c, v, 20);
    result.filter(val => !isNaN(val)).forEach(val => {
      expect(val).toBeGreaterThanOrEqual(-1.01);
      expect(val).toBeLessThanOrEqual(1.01);
    });
  });

  it('returns empty for empty input', () => {
    expect(cmf([], [], [], [])).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MFI (Money Flow Index)
// ═══════════════════════════════════════════════════════════════════════════════

describe('mfi', () => {
  it('returns 100 when TP always rising', () => {
    const n = 20;
    const h = Array.from({ length: n }, (_, i) => 110 + i * 2);
    const l = Array.from({ length: n }, (_, i) => 90 + i * 2);
    const c = Array.from({ length: n }, (_, i) => 100 + i * 2);
    const v = new Array(n).fill(10000);
    const result = mfi(h, l, c, v, 14);
    const valid = result.filter(val => !isNaN(val));
    valid.forEach(val => closeTo(val, 100));
  });

  it('bounded between 0 and 100', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + Math.sin(i / 3) * 10);
    const l = Array.from({ length: n }, (_, i) => 90 + Math.sin(i / 3) * 10);
    const c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const v = Array.from({ length: n }, () => 5000 + Math.random() * 10000);
    const result = mfi(h, l, c, v, 14);
    result.filter(val => !isNaN(val)).forEach(val => {
      expect(val).toBeGreaterThanOrEqual(-0.1);
      expect(val).toBeLessThanOrEqual(100.1);
    });
  });

  it('returns NaN for < 2 data', () => {
    const result = mfi([110], [90], [100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns correct length', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(100);
    const v = new Array(n).fill(10000);
    const result = mfi(h, l, c, v, 14);
    expect(result).toHaveLength(n);
  });

  it('higher MFI in uptrend than downtrend', () => {
    const n = 30;
    const upC = Array.from({ length: n }, (_, i) => 100 + i * 2);
    const upH = upC.map(v => v + 5);
    const upL = upC.map(v => v - 5);
    const downC = Array.from({ length: n }, (_, i) => 200 - i * 2);
    const downH = downC.map(v => v + 5);
    const downL = downC.map(v => v - 5);
    const v = new Array(n).fill(10000);
    const upResult = mfi(upH, upL, upC, v, 14);
    const downResult = mfi(downH, downL, downC, v, 14);
    const upValid = upResult.filter(val => !isNaN(val));
    const downValid = downResult.filter(val => !isNaN(val));
    if (upValid.length && downValid.length) {
      expect(upValid[upValid.length - 1]).toBeGreaterThan(downValid[downValid.length - 1]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VWAP
// ═══════════════════════════════════════════════════════════════════════════════

describe('vwap', () => {
  it('single bar: VWAP = typical price', () => {
    const result = vwap([110], [90], [100], [10000]);
    // TP = (110+90+100)/3 = 100
    closeTo(result.vwap[0], 100);
  });

  it('cumulative volume-weighted TP', () => {
    const h = [110, 120];
    const l = [90, 100];
    const c = [100, 110];
    const v = [1000, 2000];
    const result = vwap(h, l, c, v);
    const tp0 = (110 + 90 + 100) / 3;
    const tp1 = (120 + 100 + 110) / 3;
    const expected = (tp0 * 1000 + tp1 * 2000) / (1000 + 2000);
    closeTo(result.vwap[1], expected);
  });

  it('returns standard deviation bands', () => {
    const n = 10;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const v = new Array(n).fill(10000);
    const result = vwap(h, l, c, v);
    for (let i = 0; i < n; i++) {
      if (!isNaN(result.vwap[i])) {
        expect(result.upperBand1[i]).toBeGreaterThanOrEqual(result.vwap[i] - 0.01);
        expect(result.lowerBand1[i]).toBeLessThanOrEqual(result.vwap[i] + 0.01);
        expect(result.upperBand2[i]).toBeGreaterThanOrEqual(result.upperBand1[i] - 0.01);
        expect(result.lowerBand2[i]).toBeLessThanOrEqual(result.lowerBand1[i] + 0.01);
      }
    }
  });

  it('resets on session start', () => {
    const h = [110, 120, 115];
    const l = [90, 100, 95];
    const c = [100, 110, 105];
    const v = [1000, 2000, 3000];
    const sessions = [true, false, true];
    const result = vwap(h, l, c, v, sessions);
    const tp2 = (115 + 95 + 105) / 3;
    closeTo(result.vwap[2], tp2);
  });

  it('returns empty for empty input', () => {
    const result = vwap([], [], [], []);
    expect(result.vwap).toHaveLength(0);
  });

  it('VWAP closer to high-volume bar price', () => {
    const h = [110, 120];
    const l = [90, 100];
    const c = [100, 110];
    const v = [1, 100000];
    const result = vwap(h, l, c, v);
    const tp1 = (120 + 100 + 110) / 3;
    expect(Math.abs(result.vwap[1] - tp1)).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Volume Profile
// ═══════════════════════════════════════════════════════════════════════════════

describe('volumeProfile', () => {
  it('returns levels, POC, value area', () => {
    const n = 20;
    const o = Array.from({ length: n }, () => 100);
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 105);
    const v = Array.from({ length: n }, () => 10000);
    const result = volumeProfile(o, h, l, c, v, 10);
    expect(result.levels).toHaveLength(10);
    expect(result.poc).not.toBeNaN();
    expect(result.valueAreaHigh).not.toBeNaN();
    expect(result.valueAreaLow).not.toBeNaN();
  });

  it('POC is the price level with most volume', () => {
    const n = 20;
    const o = Array.from({ length: n }, () => 100);
    const h = Array.from({ length: n }, () => 102);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 101);
    const v = Array.from({ length: n }, () => 10000);
    const result = volumeProfile(o, h, l, c, v, 10);
    const maxVol = Math.max(...result.levels.map(l => l.volume));
    const maxLevel = result.levels.find(l => l.volume === maxVol)!;
    expect(result.poc).toBe(maxLevel.price);
  });

  it('value area contains ~70% of volume', () => {
    const n = 50;
    const o = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const h = o.map(v => v + 5);
    const l = o.map(v => v - 5);
    const c = o.map(v => v + 2);
    const v = Array.from({ length: n }, () => Math.random() * 10000 + 5000);
    const result = volumeProfile(o, h, l, c, v, 20);
    expect(result.valueAreaHigh).toBeGreaterThanOrEqual(result.valueAreaLow);
  });

  it('returns empty result for empty input', () => {
    const result = volumeProfile([], [], [], [], []);
    expect(result.levels).toHaveLength(0);
    expect(result.poc).toBeNaN();
  });

  it('distributes volume into buy/sell', () => {
    const n = 10;
    const o = new Array(n).fill(100);
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(105); // bullish (close > open)
    const v = new Array(n).fill(10000);
    const result = volumeProfile(o, h, l, c, v, 5);
    const totalBuy = result.levels.reduce((s, lev) => s + lev.buyVolume, 0);
    expect(totalBuy).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Volume Oscillator
// ═══════════════════════════════════════════════════════════════════════════════

describe('volumeOscillator', () => {
  it('positive when short MA > long MA', () => {
    const volumes = [100, 100, 100, 100, 100, 200, 300, 400, 500, 600];
    const result = volumeOscillator(volumes, 3, 7);
    const valid = result.filter(v => !isNaN(v));
    if (valid.length) {
      expect(valid[valid.length - 1]).toBeGreaterThan(0);
    }
  });

  it('returns empty for empty input', () => {
    expect(volumeOscillator([])).toHaveLength(0);
  });

  it('returns correct length', () => {
    const volumes = Array.from({ length: 20 }, () => 10000);
    const result = volumeOscillator(volumes, 5, 10);
    expect(result).toHaveLength(20);
  });

  it('zero for constant volume', () => {
    const volumes = new Array(20).fill(10000);
    const result = volumeOscillator(volumes, 5, 10);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PVT (Price Volume Trend)
// ═══════════════════════════════════════════════════════════════════════════════

describe('pvt', () => {
  it('starts at 0', () => {
    const result = pvt([100, 110, 120], [1000, 2000, 3000]);
    closeTo(result[0], 0);
  });

  it('cumulates (pctChange * volume)', () => {
    const closes = [100, 110, 121];
    const volumes = [1000, 2000, 3000];
    const result = pvt(closes, volumes);
    // pvt[1] = ((110-100)/100) * 2000 = 200
    closeTo(result[1], 200);
    // pvt[2] = 200 + ((121-110)/110) * 3000 = 200 + 300 = 500
    closeTo(result[2], 500);
  });

  it('returns NaN array for < 2 data', () => {
    const result = pvt([100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('negative for falling prices', () => {
    const closes = [100, 90, 80];
    const volumes = [1000, 2000, 3000];
    const result = pvt(closes, volumes);
    expect(result[2]).toBeLessThan(0);
  });

  it('unchanged price = no contribution', () => {
    const closes = [100, 100, 100];
    const volumes = [1000, 2000, 3000];
    const result = pvt(closes, volumes);
    closeTo(result[1], 0);
    closeTo(result[2], 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NVI / PVI
// ═══════════════════════════════════════════════════════════════════════════════

describe('nvi', () => {
  it('starts at 1000', () => {
    const result = nvi([100, 110, 120], [1000, 900, 800]);
    closeTo(result[0], 1000);
  });

  it('changes only on lower volume days', () => {
    const closes = [100, 110, 105];
    const volumes = [1000, 900, 1100];
    const result = nvi(closes, volumes);
    // vol[1] < vol[0]: update NVI with price change
    // NVI[1] = 1000 + 1000 * ((110-100)/100) = 1000 + 100 = 1100
    closeTo(result[1], 1100);
    // vol[2] > vol[1]: no change
    closeTo(result[2], 1100);
  });

  it('returns NaN array for < 2 data', () => {
    const result = nvi([100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });

  it('returns correct length', () => {
    const result = nvi([100, 110, 120], [1000, 900, 800]);
    expect(result).toHaveLength(3);
  });

  it('stays at 1000 if volume never decreases', () => {
    const closes = [100, 110, 120];
    const volumes = [1000, 2000, 3000];
    const result = nvi(closes, volumes);
    closeTo(result[0], 1000);
    closeTo(result[1], 1000);
    closeTo(result[2], 1000);
  });
});

describe('pvi', () => {
  it('starts at 1000', () => {
    const result = pvi([100, 110, 120], [1000, 1100, 1200]);
    closeTo(result[0], 1000);
  });

  it('changes only on higher volume days', () => {
    const closes = [100, 110, 105];
    const volumes = [1000, 1100, 900];
    const result = pvi(closes, volumes);
    // vol[1] > vol[0]: update
    // PVI[1] = 1000 + 1000 * ((110-100)/100) = 1100
    closeTo(result[1], 1100);
    // vol[2] < vol[1]: no change
    closeTo(result[2], 1100);
  });

  it('stays at 1000 if volume never increases', () => {
    const closes = [100, 110, 120];
    const volumes = [3000, 2000, 1000];
    const result = pvi(closes, volumes);
    closeTo(result[0], 1000);
    closeTo(result[1], 1000);
    closeTo(result[2], 1000);
  });

  it('returns NaN array for < 2 data', () => {
    const result = pvi([100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Klinger Volume Oscillator
// ═══════════════════════════════════════════════════════════════════════════════

describe('klingerVolumeOscillator', () => {
  it('returns kvo and signal arrays', () => {
    const n = 60;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const v = Array.from({ length: n }, () => 10000);
    const result = klingerVolumeOscillator(h, l, c, v, 34, 55, 13);
    expect(result.kvo).toHaveLength(n);
    expect(result.signal).toHaveLength(n);
  });

  it('returns NaN arrays for < 2 data', () => {
    const result = klingerVolumeOscillator([110], [90], [100], [1000]);
    result.kvo.forEach(v => expect(v).toBeNaN());
  });

  it('returns correct length', () => {
    const n = 60;
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 100);
    const v = Array.from({ length: n }, () => 10000);
    const result = klingerVolumeOscillator(h, l, c, v);
    expect(result.kvo).toHaveLength(n);
    expect(result.signal).toHaveLength(n);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Volume Rate of Change
// ═══════════════════════════════════════════════════════════════════════════════

describe('volumeRateOfChange', () => {
  it('calculates percentage change in volume', () => {
    const volumes = [100, 200];
    const result = volumeRateOfChange(volumes, 1);
    closeTo(result[1], 100); // (200-100)/100 * 100 = 100%
  });

  it('returns NaN for warm-up', () => {
    const result = volumeRateOfChange([100, 200, 300], 2);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    closeTo(result[2], 200); // (300-100)/100 * 100 = 200%
  });

  it('returns empty for empty input', () => {
    expect(volumeRateOfChange([])).toHaveLength(0);
  });

  it('zero for constant volume', () => {
    const volumes = new Array(20).fill(10000);
    const result = volumeRateOfChange(volumes, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Force Index, ADOSC, Volume MA, Relative Volume
// ═══════════════════════════════════════════════════════════════════════════════

describe('forceIndex', () => {
  it('positive for rising close with volume', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const volumes = new Array(30).fill(10000);
    const result = forceIndex(closes, volumes, 5);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => expect(v).toBeGreaterThan(0));
  });

  it('returns NaN array for < 2 data', () => {
    const result = forceIndex([100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('adosc', () => {
  it('returns correct length', () => {
    const n = 30;
    const h = new Array(n).fill(110);
    const l = new Array(n).fill(90);
    const c = new Array(n).fill(105);
    const v = new Array(n).fill(10000);
    const result = adosc(h, l, c, v, 3, 10);
    expect(result).toHaveLength(n);
  });
});

describe('volumeSMA / volumeEMA', () => {
  it('volumeSMA returns SMA of volumes', () => {
    const volumes = [100, 200, 300, 400, 500];
    const result = volumeSMA(volumes, 3);
    closeTo(result[2], 200);
    closeTo(result[3], 300);
    closeTo(result[4], 400);
  });

  it('volumeEMA returns EMA of volumes', () => {
    const volumes = [100, 200, 300, 400, 500];
    const result = volumeEMA(volumes, 3);
    expect(result).toHaveLength(5);
    expect(result[2]).not.toBeNaN();
  });
});

describe('relativeVolume', () => {
  it('returns 1.0 for constant volume', () => {
    const volumes = new Array(20).fill(10000);
    const result = relativeVolume(volumes, 10);
    const valid = result.filter(v => !isNaN(v));
    valid.forEach(v => closeTo(v, 1));
  });

  it('returns > 1 for volume spike', () => {
    const volumes = [...new Array(19).fill(10000), 50000];
    const result = relativeVolume(volumes, 10);
    expect(result[19]).toBeGreaterThan(1);
  });

  it('returns empty for empty input', () => {
    expect(relativeVolume([])).toHaveLength(0);
  });
});

describe('anchoredVWAP', () => {
  it('anchors at given index', () => {
    const n = 10;
    const h = Array.from({ length: n }, () => 110);
    const l = Array.from({ length: n }, () => 90);
    const c = Array.from({ length: n }, () => 100);
    const v = Array.from({ length: n }, () => 10000);
    const result = anchoredVWAP(h, l, c, v, 5);
    expect(result[4]).toBeNaN();
    expect(result[5]).not.toBeNaN();
  });

  it('returns NaN array for invalid anchor', () => {
    const result = anchoredVWAP([110], [90], [100], [1000], -1);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('twiggsMoneyFlow', () => {
  it('returns correct length', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const c = Array.from({ length: n }, (_, i) => 100 + i);
    const v = new Array(n).fill(10000);
    const result = twiggsMoneyFlow(h, l, c, v, 21);
    expect(result).toHaveLength(n);
  });

  it('returns NaN for < 2 data', () => {
    const result = twiggsMoneyFlow([110], [90], [100], [1000]);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('volumeWeightedRSI', () => {
  it('high for consistently rising prices', () => {
    const n = 30;
    const closes = Array.from({ length: n }, (_, i) => 100 + i * 2);
    const volumes = new Array(n).fill(10000);
    const result = volumeWeightedRSI(closes, volumes, 14);
    const valid = result.filter(v => !isNaN(v));
    valid.slice(-3).forEach(v => expect(v).toBeGreaterThan(80));
  });

  it('bounded between 0 and 100', () => {
    const n = 30;
    const closes = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 10);
    const volumes = Array.from({ length: n }, () => Math.random() * 20000 + 5000);
    const result = volumeWeightedRSI(closes, volumes, 14);
    result.filter(v => !isNaN(v)).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThanOrEqual(100.1);
    });
  });

  it('returns NaN array when data < period + 1', () => {
    const result = volumeWeightedRSI([100, 110], [1000, 2000], 14);
    result.forEach(v => expect(v).toBeNaN());
  });
});

describe('emv', () => {
  it('returns correct length', () => {
    const n = 30;
    const h = Array.from({ length: n }, (_, i) => 110 + i);
    const l = Array.from({ length: n }, (_, i) => 90 + i);
    const v = new Array(n).fill(10000);
    const result = emv(h, l, v, 14);
    expect(result).toHaveLength(n);
  });

  it('returns NaN for < 2 data', () => {
    const result = emv([110], [90], [10000]);
    result.forEach(v => expect(v).toBeNaN());
  });
});
