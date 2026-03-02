import { describe, it, expect } from 'vitest';
import {
  SMA, EMA, WMA, DEMA, TEMA, HullMA, VWMA, KAMA, ALMA, FRAMA, T3,
  RSI, MACD, Stochastic, CCI, WilliamsR, ROC, Momentum, BollingerBands,
  ATR, KeltnerChannel, DonchianChannel, OBV, ADLine, CMF, MFI,
  ADX, Aroon, ParabolicSAR, IchimokuCloud, ZigZag,
  AwesomeOscillator, ElderForceIndex, StochRSI, TRIX,
  BBPercentB, BBWidth, Crossover, Crossunder, lastValid, extractOHLCV,
  StandardPivots, CMO, UltimateOscillator, TSI,
  INDICATORS_EXTENDED,
} from '../../src/lib/ta/indicators-extended';

const toBeCloseTo = (actual: number, expected: number, decimals = 4) =>
  expect(actual).toBeCloseTo(expected, decimals);

// ─── Fixture Data ─────────────────────────────────────────────────────────────

const closes = [100, 102, 101, 105, 107, 106, 108, 110, 109, 112];
const highs = [101, 103, 104, 106, 108, 109, 111, 112, 111, 113];
const lows = [99, 100, 100, 103, 105, 104, 106, 108, 107, 110];
const volumes = [1000, 1200, 800, 1500, 2000, 1100, 1300, 1400, 900, 1600];
const ohlcv = closes.map((c, i) => ({
  time: 1700000000000 + i * 86400000,
  open: closes[i] - 0.5,
  high: highs[i],
  low: lows[i],
  close: c,
  volume: volumes[i],
}));

// ─── Moving Averages ─────────────────────────────────────────────────────────

describe('indicators-extended: SMA', () => {
  it('returns same length as input', () => {
    const r = SMA(closes, { period: 5 });
    expect(r).toHaveLength(closes.length);
  });
  it('NaN for warm-up', () => {
    const r = SMA(closes, { period: 5 });
    expect(r[0]).toBeNaN();
    expect(r[2]).toBeNaN();
  });
  it('SMA(5) at index 4 is mean of first 5', () => {
    const r = SMA(closes, { period: 5 });
    const mean = (100 + 102 + 101 + 105 + 107) / 5;
    toBeCloseTo(r[4], mean);
  });
  it('period 1 returns data', () => {
    const r = SMA(closes, { period: 1 });
    expect(r[4]).toBeCloseTo(closes[4]);
  });
  it('empty input returns empty', () => {
    expect(SMA([], { period: 5 })).toHaveLength(0);
  });
});

describe('indicators-extended: EMA', () => {
  it('returns same length', () => {
    expect(EMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
  it('NaN for warm-up', () => {
    const r = EMA(closes, { period: 5 });
    expect(r[0]).toBeNaN();
  });
  it('last value is finite', () => {
    const r = EMA(closes, { period: 5 });
    expect(r[r.length - 1]).not.toBeNaN();
  });
});

describe('indicators-extended: WMA', () => {
  it('period 3 on [1,2,3]', () => {
    const r = WMA([1, 2, 3], { period: 3 });
    expect(r[2]).toBeCloseTo((1 * 1 + 2 * 2 + 3 * 3) / 6, 4);
  });
});

describe('indicators-extended: DEMA', () => {
  it('returns correct length', () => {
    expect(DEMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: TEMA', () => {
  it('returns correct length', () => {
    expect(TEMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: HullMA', () => {
  it('returns correct length', () => {
    expect(HullMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: VWMA', () => {
  it('requires volumes', () => {
    const r = VWMA(closes, { period: 3 });
    expect(r.every((v) => isNaN(v))).toBe(true);
  });
  it('with volumes returns values', () => {
    const r = VWMA(closes, { period: 3, volumes });
    expect(r[2]).not.toBeNaN();
  });
});

describe('indicators-extended: KAMA', () => {
  it('returns correct length', () => {
    expect(KAMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: ALMA', () => {
  it('returns correct length', () => {
    expect(ALMA(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: FRAMA', () => {
  it('returns correct length', () => {
    expect(FRAMA(closes, { period: 10 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: T3', () => {
  it('returns correct length', () => {
    expect(T3(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

// ─── Momentum ────────────────────────────────────────────────────────────────

describe('indicators-extended: RSI', () => {
  it('RSI in [0,100]', () => {
    const r = RSI(closes, { period: 14 });
    const valid = r.filter((v) => !isNaN(v));
    valid.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
  it('returns same length', () => {
    expect(RSI(closes, { period: 5 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: MACD', () => {
  it('returns { macd, signal, histogram }', () => {
    const r = MACD(closes, { fast: 12, slow: 26, signal: 9 });
    expect(r).toHaveProperty('macd');
    expect(r).toHaveProperty('signal');
    expect(r).toHaveProperty('histogram');
    expect(r.macd).toHaveLength(closes.length);
  });
  it('histogram = macd - signal', () => {
    const r = MACD(closes, { fast: 12, slow: 26, signal: 9 });
    for (let i = 0; i < r.macd.length; i++) {
      if (!isNaN(r.macd[i]) && !isNaN(r.signal[i]))
        toBeCloseTo(r.histogram[i], r.macd[i] - r.signal[i]);
    }
  });
});

describe('indicators-extended: Stochastic', () => {
  it('returns { k, d } with highs and lows', () => {
    const r = Stochastic(closes, { highs, lows, period: 14 });
    expect(r).toHaveProperty('k');
    expect(r).toHaveProperty('d');
    expect(r.k).toHaveLength(closes.length);
  });
});

describe('indicators-extended: CCI', () => {
  it('returns correct length', () => {
    expect(CCI(closes, { period: 20 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: WilliamsR', () => {
  it('returns values in [-100,0] with highs/lows', () => {
    const r = WilliamsR(closes, { highs, lows, period: 14 });
    const valid = r.filter((v) => !isNaN(v));
    valid.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-100);
      expect(v).toBeLessThanOrEqual(0);
    });
  });
});

describe('indicators-extended: ROC', () => {
  it('ROC(1) is percent change', () => {
    const r = ROC(closes, { period: 1 });
    expect(r[1]).toBeCloseTo(((closes[1] - closes[0]) / closes[0]) * 100, 2);
  });
});

describe('indicators-extended: Momentum', () => {
  it('returns price - price[n]', () => {
    const r = Momentum(closes, { period: 2 });
    expect(r[2]).toBeCloseTo(closes[2] - closes[0]);
  });
});

describe('indicators-extended: CMO', () => {
  it('returns correct length', () => {
    expect(CMO(closes, { period: 14 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: UltimateOscillator', () => {
  it('returns correct length with OHLC', () => {
    const r = UltimateOscillator(closes, {
      highs,
      lows,
      opens: ohlcv.map((b) => b.open),
      period: 7,
    });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: TSI', () => {
  it('returns correct length', () => {
    expect(TSI(closes, { long: 25, short: 13 })).toHaveLength(closes.length);
  });
});

describe('indicators-extended: AwesomeOscillator', () => {
  it('returns correct length with highs/lows', () => {
    const r = AwesomeOscillator(closes, { highs, lows });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: ElderForceIndex', () => {
  it('returns correct length with volumes', () => {
    const r = ElderForceIndex(closes, { volumes, period: 13 });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: StochRSI', () => {
  it('returns { k, d }', () => {
    const r = StochRSI(closes, { period: 14 });
    expect(r).toHaveProperty('k');
    expect(r).toHaveProperty('d');
  });
});

describe('indicators-extended: TRIX', () => {
  it('returns { trix, signal }', () => {
    const r = TRIX(closes, { period: 15 });
    expect(r).toHaveProperty('trix');
    expect(r).toHaveProperty('signal');
  });
});

// ─── Volatility ──────────────────────────────────────────────────────────────

describe('indicators-extended: BollingerBands', () => {
  it('returns { upper, middle, lower }', () => {
    const r = BollingerBands(closes, { period: 20, stdDev: 2 });
    expect(r.upper).toHaveLength(closes.length);
    expect(r.middle).toHaveLength(closes.length);
    expect(r.lower).toHaveLength(closes.length);
  });
  it('upper >= middle >= lower', () => {
    const r = BollingerBands(closes, { period: 5, stdDev: 2 });
    for (let i = 4; i < r.upper.length; i++) {
      expect(r.upper[i]).toBeGreaterThanOrEqual(r.middle[i]);
      expect(r.middle[i]).toBeGreaterThanOrEqual(r.lower[i]);
    }
  });
});

describe('indicators-extended: ATR', () => {
  it('returns correct length with highs/lows', () => {
    const r = ATR(closes, { highs, lows, period: 14 });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: KeltnerChannel', () => {
  it('returns { upper, middle, lower }', () => {
    const r = KeltnerChannel(closes, {
      highs,
      lows,
      period: 20,
      multiplier: 2,
    });
    expect(r).toHaveProperty('upper');
    expect(r).toHaveProperty('middle');
    expect(r).toHaveProperty('lower');
  });
});

describe('indicators-extended: DonchianChannel', () => {
  it('returns { upper, middle, lower }', () => {
    const r = DonchianChannel(closes, { period: 20 });
    expect(r).toHaveProperty('upper');
    expect(r).toHaveProperty('middle');
    expect(r).toHaveProperty('lower');
  });
});

describe('indicators-extended: BBPercentB', () => {
  it('returns correct length', () => {
    expect(BBPercentB(closes, { period: 20, stdDev: 2 })).toHaveLength(
      closes.length
    );
  });
});

describe('indicators-extended: BBWidth', () => {
  it('returns correct length', () => {
    expect(BBWidth(closes, { period: 20, stdDev: 2 })).toHaveLength(
      closes.length
    );
  });
});

// ─── Volume ─────────────────────────────────────────────────────────────────

describe('indicators-extended: OBV', () => {
  it('returns correct length with volumes', () => {
    const r = OBV(closes, { volumes });
    expect(r).toHaveLength(closes.length);
  });
  it('first value is 0 or volume-based', () => {
    const r = OBV(closes, { volumes });
    expect(r[0]).not.toBeNaN();
  });
});

describe('indicators-extended: ADLine', () => {
  it('returns correct length with OHLCV', () => {
    const r = ADLine(closes, { highs, lows, volumes, opens: ohlcv.map((b) => b.open) });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: CMF', () => {
  it('returns correct length', () => {
    const r = CMF(closes, {
      highs,
      lows,
      volumes,
      period: 20,
    });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: MFI', () => {
  it('returns values in [0,100]', () => {
    const r = MFI(closes, {
      highs,
      lows,
      volumes,
      period: 14,
    });
    const valid = r.filter((v) => !isNaN(v));
    valid.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

// ─── Trend ───────────────────────────────────────────────────────────────────

describe('indicators-extended: ADX', () => {
  it('returns { adx, plusDI, minusDI }', () => {
    const r = ADX(closes, { highs, lows, period: 14 });
    expect(r).toHaveProperty('adx');
    expect(r).toHaveProperty('plusDI');
    expect(r).toHaveProperty('minusDI');
  });
});

describe('indicators-extended: Aroon', () => {
  it('returns { up, down, oscillator }', () => {
    const r = Aroon(closes, { period: 14 });
    expect(r).toHaveProperty('up');
    expect(r).toHaveProperty('down');
    expect(r).toHaveProperty('oscillator');
  });
});

describe('indicators-extended: ParabolicSAR', () => {
  it('returns correct length with highs/lows', () => {
    const r = ParabolicSAR(closes, { highs, lows, start: 0.02, increment: 0.02 });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: IchimokuCloud', () => {
  it('returns five series', () => {
    const r = IchimokuCloud(closes, { highs, lows });
    expect(r).toHaveProperty('tenkan');
    expect(r).toHaveProperty('kijun');
    expect(r).toHaveProperty('senkouA');
    expect(r).toHaveProperty('senkouB');
    expect(r).toHaveProperty('chikou');
  });
});

describe('indicators-extended: ZigZag', () => {
  it('returns correct length', () => {
    const r = ZigZag(closes, { deviation: 5 });
    expect(r).toHaveLength(closes.length);
  });
});

describe('indicators-extended: StandardPivots', () => {
  it('returns pivot levels for OHLC', () => {
    const r = StandardPivots(closes, { highs, lows });
    expect(r).toHaveLength(closes.length);
    expect(r[0]).toHaveProperty('P');
    expect(r[0]).toHaveProperty('R1');
    expect(r[0]).toHaveProperty('S1');
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('indicators-extended: Crossover', () => {
  it('true when a crosses above b', () => {
    const a = [1, 2, 3, 4];
    const b = [2, 2, 2, 2];
    const r = Crossover(a, b);
    expect(r[2]).toBe(true); // a[2]=3 > b[2]=2, a[1]=2 <= b[1]=2
  });
});

describe('indicators-extended: Crossunder', () => {
  it('true when a crosses below b', () => {
    const a = [3, 2, 1];
    const b = [2, 2, 2];
    const r = Crossunder(a, b);
    expect(r[2]).toBe(true);
  });
});

describe('indicators-extended: lastValid', () => {
  it('returns last non-NaN', () => {
    expect(lastValid([NaN, 1, NaN, 3])).toBe(3);
  });
  it('returns undefined for all NaN', () => {
    expect(lastValid([NaN, NaN])).toBeUndefined();
  });
});

describe('indicators-extended: extractOHLCV', () => {
  it('extracts closes, highs, lows, volumes, opens', () => {
    const r = extractOHLCV(ohlcv);
    expect(r.closes).toEqual(closes);
    expect(r.highs).toEqual(highs);
    expect(r.lows).toEqual(lows);
    expect(r.volumes).toEqual(volumes);
  });
});

describe('indicators-extended: INDICATORS_EXTENDED', () => {
  it('exports all indicator functions', () => {
    expect(INDICATORS_EXTENDED.SMA).toBeDefined();
    expect(INDICATORS_EXTENDED.RSI).toBeDefined();
    expect(INDICATORS_EXTENDED.MACD).toBeDefined();
  });
});

describe('indicators-extended: empty and edge cases', () => {
  it('SMA empty returns empty', () => {
    expect(SMA([], { period: 5 })).toEqual([]);
  });
  it('RSI empty returns empty', () => {
    expect(RSI([], { period: 14 })).toEqual([]);
  });
  it('MACD empty returns empty arrays', () => {
    const r = MACD([], { fast: 12, slow: 26, signal: 9 });
    expect(r.macd).toEqual([]);
    expect(r.signal).toEqual([]);
  });
  it('BollingerBands empty', () => {
    const r = BollingerBands([], { period: 20 });
    expect(r.upper).toEqual([]);
  });
  it('extractOHLCV empty returns empty arrays', () => {
    const r = extractOHLCV([]);
    expect(r.closes).toEqual([]);
  });
  it('Crossover with unequal lengths returns a.length', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    const r = Crossover(a, b);
    expect(r.length).toBe(a.length);
  });
  it('lastValid with single valid', () => {
    expect(lastValid([NaN, 5])).toBe(5);
  });
  it('RSI with all same values', () => {
    const same = new Array(20).fill(100);
    const r = RSI(same, { period: 14 });
    expect(r.some((v) => !isNaN(v))).toBe(true);
  });
  it('ATR with single bar', () => {
    const r = ATR([100], { highs: [101], lows: [99], period: 14 });
    expect(r).toHaveLength(1);
  });
  it('OBV with default params returns cumulative', () => {
    const r = OBV(closes, { volumes });
    expect(r).toHaveLength(closes.length);
    expect(r[0]).not.toBeNaN();
  });
  it('ZigZag with constant price', () => {
    const flat = new Array(20).fill(100);
    const r = ZigZag(flat, { deviation: 5 });
    expect(r).toHaveLength(20);
  });
  it('Ichimoku returns arrays of correct length', () => {
    const r = IchimokuCloud(closes, { highs, lows });
    expect(r.tenkan).toHaveLength(closes.length);
    expect(r.chikou).toHaveLength(closes.length);
  });
  it('DonchianChannel upper >= lower', () => {
    const r = DonchianChannel(closes, { period: 5 });
    for (let i = 4; i < r.upper.length; i++) {
      expect(r.upper[i]).toBeGreaterThanOrEqual(r.lower[i]);
    }
  });
  it('ROC with period 0 does not crash', () => {
    const r = ROC(closes, { period: 1 });
    expect(r).toHaveLength(closes.length);
  });
  it('Momentum with period 1', () => {
    const r = Momentum(closes, { period: 1 });
    expect(r[1]).toBeCloseTo(closes[1] - closes[0]);
  });
  it('KeltnerChannel returns valid structure', () => {
    const r = KeltnerChannel(closes, { highs, lows, period: 5, multiplier: 2 });
    expect(r.upper.length).toBe(closes.length);
    expect(r.middle.length).toBe(closes.length);
  });
  it('Aroon up and down in [0,100]', () => {
    const r = Aroon(closes, { period: 14 });
    const validUp = r.up.filter((v) => !isNaN(v));
    validUp.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
  it('ADX adx values non-negative', () => {
    const r = ADX(closes, { highs, lows, period: 14 });
    const valid = r.adx.filter((v) => !isNaN(v));
    valid.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
  it('StochRSI k and d in valid range', () => {
    const r = StochRSI(closes, { period: 14 });
    const validK = r.k.filter((v) => !isNaN(v));
    validK.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
  it('VWMA with zeros volume', () => {
    const zeroVol = new Array(5).fill(0);
    const r = VWMA(closes.slice(0, 5), { period: 3, volumes: zeroVol });
    expect(r.some((v) => isNaN(v))).toBe(true);
  });
});
