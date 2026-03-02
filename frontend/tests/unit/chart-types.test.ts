import { describe, it, expect } from 'vitest';
import {
  Candlestick,
  HeikinAshi,
  HollowCandles,
  Line,
  Area,
  Bar,
  VolumeProfileVisible,
  processChartType,
  type OHLCV,
} from '../../src/lib/ta/chart-types';

const fixture: OHLCV[] = [
  { time: 1000, open: 100, high: 105, low: 98, close: 102, volume: 1000 },
  { time: 2000, open: 102, high: 108, low: 101, close: 106, volume: 1200 },
  { time: 3000, open: 106, high: 110, low: 104, close: 108, volume: 800 },
  { time: 4000, open: 108, high: 112, low: 106, close: 109, volume: 1500 },
  { time: 5000, open: 109, high: 114, low: 107, close: 112, volume: 2000 },
];

describe('chart-types: Candlestick', () => {
  it('returns same length as input', () => {
    const r = Candlestick(fixture);
    expect(r).toHaveLength(fixture.length);
  });
  it('direction is up when close >= open', () => {
    const r = Candlestick(fixture);
    expect(r[0].direction).toBe('up');
  });
  it('direction is down when close < open', () => {
    const bear = [{ ...fixture[0], open: 105, close: 98 }];
    const r = Candlestick(bear);
    expect(r[0].direction).toBe('down');
  });
  it('bodyTop and bodyBottom correct', () => {
    const r = Candlestick(fixture);
    expect(r[0].bodyTop).toBe(102);
    expect(r[0].bodyBottom).toBe(100);
  });
  it('upperWick and lowerWick correct', () => {
    const r = Candlestick(fixture);
    expect(r[0].upperWick).toBe(105 - 102);
    expect(r[0].lowerWick).toBe(100 - 98);
  });
  it('empty input returns empty', () => {
    expect(Candlestick([])).toHaveLength(0);
  });
});

describe('chart-types: HeikinAshi', () => {
  it('returns same length', () => {
    const r = HeikinAshi(fixture);
    expect(r).toHaveLength(fixture.length);
  });
  it('haClose is OHLC/4', () => {
    const r = HeikinAshi(fixture);
    const expected = (100 + 105 + 98 + 102) / 4;
    expect(r[0].close).toBeCloseTo(expected);
  });
  it('has bodyTop >= bodyBottom for up candle', () => {
    const r = HeikinAshi(fixture);
    if (r[0].direction === 'up') {
      expect(r[0].bodyTop).toBeGreaterThanOrEqual(r[0].bodyBottom);
    }
  });
});

describe('chart-types: HollowCandles', () => {
  it('adds hollow property', () => {
    const r = HollowCandles(fixture);
    expect(r[0]).toHaveProperty('hollow');
  });
});

describe('chart-types: Line', () => {
  it('returns close as value', () => {
    const r = Line(fixture);
    expect(r[0].value).toBe(102);
    expect(r[0].time).toBe(1000);
  });
});

describe('chart-types: Area', () => {
  it('returns value and baseline', () => {
    const r = Area(fixture);
    expect(r[0].value).toBe(102);
    expect(r[0].baseline).toBe(0);
  });
});

describe('chart-types: Bar', () => {
  it('returns OHLCV per bar', () => {
    const r = Bar(fixture);
    expect(r[0].open).toBe(100);
    expect(r[0].high).toBe(105);
    expect(r[0].low).toBe(98);
    expect(r[0].close).toBe(102);
  });
});

describe('chart-types: VolumeProfileVisible', () => {
  it('returns bins and poc', () => {
    const r = VolumeProfileVisible(fixture, { bins: 10 });
    expect(r).toHaveProperty('bins');
    expect(r).toHaveProperty('poc');
    expect(r).toHaveProperty('vah');
    expect(r).toHaveProperty('val');
  });
});

describe('chart-types: processChartType', () => {
  it('dispatches Candlestick', () => {
    const r = processChartType('Candlestick', fixture);
    expect(Array.isArray(r)).toBe(true);
    expect((r as unknown[]).length).toBe(fixture.length);
  });
  it('dispatches Line', () => {
    const r = processChartType('Line', fixture);
    expect(Array.isArray(r)).toBe(true);
  });
});
