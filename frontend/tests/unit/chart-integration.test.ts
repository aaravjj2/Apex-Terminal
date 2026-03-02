import { describe, it, expect } from 'vitest';
import {
  Candlestick,
  HeikinAshi,
  HollowCandles,
  VolumeProfileVisible,
  OHLCV,
} from '../../../src/lib/ta/chart-types';

function makeOHLCV(n: number): OHLCV[] {
  const data: OHLCV[] = [];
  let o = 100;
  for (let i = 0; i < n; i++) {
    const c = o + (Math.random() - 0.5) * 4;
    const h = Math.max(o, c) + Math.random() * 2;
    const l = Math.min(o, c) - Math.random() * 2;
    data.push({
      time: 1609459200000 + i * 86400000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: 1000 + Math.random() * 5000,
    });
    o = c;
  }
  return data;
}

describe('Candlestick', () => {
  it('returns renderable candles', () => {
    const data = makeOHLCV(10);
    const candles = Candlestick(data);
    expect(candles).toHaveLength(10);
  });

  it('direction is up when close >= open', () => {
    const data = [{ time: 0, open: 100, high: 105, low: 98, close: 103, volume: 1000 }];
    const candles = Candlestick(data);
    expect(candles[0].direction).toBe('up');
  });

  it('direction is down when close < open', () => {
    const data = [{ time: 0, open: 100, high: 102, low: 97, close: 98, volume: 1000 }];
    const candles = Candlestick(data);
    expect(candles[0].direction).toBe('down');
  });

  it('bodySize = |close - open|', () => {
    const data = [{ time: 0, open: 100, high: 105, low: 95, close: 104, volume: 1000 }];
    const candles = Candlestick(data);
    expect(candles[0].bodySize).toBe(4);
  });

  it('empty input returns empty array', () => {
    expect(Candlestick([])).toEqual([]);
  });
});

describe('HeikinAshi', () => {
  it('returns same length as input', () => {
    const data = makeOHLCV(20);
    const ha = HeikinAshi(data);
    expect(ha).toHaveLength(20);
  });

  it('first candle has derived open', () => {
    const data = makeOHLCV(5);
    const ha = HeikinAshi(data);
    const first = ha[0];
    expect(first.open).toBeCloseTo((data[0].open + data[0].close) / 2);
  });

  it('empty input returns empty', () => {
    expect(HeikinAshi([])).toEqual([]);
  });
});

describe('HollowCandles', () => {
  it('processes OHLCV data', () => {
    const data = makeOHLCV(10);
    const hollow = HollowCandles(data);
    expect(hollow).toHaveLength(10);
  });
});

describe('VolumeProfile', () => {
  it('returns bins and POC', () => {
    const data = makeOHLCV(100);
    const vp = VolumeProfileVisible(data);
    expect(vp.bins).toBeDefined();
    expect(vp.poc).toBeDefined();
    expect(vp.totalVolume).toBeGreaterThan(0);
  });

  it('POC is within price range', () => {
    const data = makeOHLCV(50);
    const vp = VolumeProfileVisible(data);
    const minP = Math.min(...data.map(d => d.low));
    const maxP = Math.max(...data.map(d => d.high));
    expect(vp.poc).toBeGreaterThanOrEqual(minP);
    expect(vp.poc).toBeLessThanOrEqual(maxP);
  });
});
