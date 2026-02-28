/**
 * useChartData.ts
 * Data normalization, windowing, downsampling, and transformation hooks
 * for financial chart components. Handles OHLCV, tick, and line series data.
 * Includes streaming data appending, viewport windowing, and technical
 * indicator calculations (SMA, EMA, VWAP, Bollinger Bands, RSI, MACD).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OHLCVPoint {
  time: number;          // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: number;
  value: number;
  label?: string;
}

export interface ChartBounds {
  minTime: number;
  maxTime: number;
  minValue: number;
  maxValue: number;
  rangeTime: number;
  rangeValue: number;
}

export interface Viewport {
  startIndex: number;
  endIndex: number;
  visibleData: OHLCVPoint[];
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

const TF_MS: Record<Timeframe, number> = {
  '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000, '1D': 86400000, '1W': 604800000, '1M': 2592000000,
};

// ─── Resampling ───────────────────────────────────────────────────────────────

export function resampleOHLCV(data: OHLCVPoint[], targetTf: Timeframe): OHLCVPoint[] {
  if (data.length === 0) return [];
  const interval = TF_MS[targetTf];
  const buckets = new Map<number, OHLCVPoint[]>();

  data.forEach(pt => {
    const key = Math.floor(pt.time / interval) * interval;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(pt);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, pts]) => ({
      time: key,
      open: pts[0].open,
      high: Math.max(...pts.map(p => p.high)),
      low: Math.min(...pts.map(p => p.low)),
      close: pts[pts.length - 1].close,
      volume: pts.reduce((s, p) => s + p.volume, 0),
    }));
}

// ─── Downsampling (LTTB algorithm) ───────────────────────────────────────────

export function downsampleLTTB(data: LinePoint[], threshold: number): LinePoint[] {
  if (data.length <= threshold) return data;
  const sampled: LinePoint[] = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);

  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    let avgX = 0, avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].time;
      avgY += data[j].value;
    }
    avgX /= (avgRangeEnd - avgRangeStart);
    avgY /= (avgRangeEnd - avgRangeStart);

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);
    const prevPoint = sampled[sampled.length - 1];

    let maxArea = -1, maxPoint = data[rangeStart];
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (prevPoint.time - avgX) * (data[j].value - prevPoint.value) -
        (prevPoint.time - data[j].time) * (avgY - prevPoint.value)
      ) * 0.5;
      if (area > maxArea) { maxArea = area; maxPoint = data[j]; }
    }
    sampled.push(maxPoint);
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}

// ─── Technical Indicators ─────────────────────────────────────────────────────

export function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    return data.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
  });
}

export function calcEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(data.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    if (ema === null) {
      ema = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    result[i] = ema;
  }
  return result;
}

export function calcBollingerBands(data: number[], period = 20, stdDev = 2) {
  const mid = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const width: (number | null)[] = [];

  data.forEach((_, i) => {
    if (mid[i] === null) { upper.push(null); lower.push(null); width.push(null); return; }
    const slice = data.slice(Math.max(0, i - period + 1), i + 1);
    const mean = mid[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance) * stdDev;
    upper.push(mean + sd);
    lower.push(mean - sd);
    width.push(sd * 2 / mean);  // normalized
  });

  return { upper, mid, lower, width };
}

export function calcRSI(data: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = data[i] - data[i - 1];
    if (delta >= 0) avgGain += delta; else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;

  const rsi0 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result[period] = rsi0;

  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function calcMACD(data: number[], fast = 12, slow = 26, signal = 9): MACDResult {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macd: (number | null)[] = data.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i]! - emaSlow[i]! : null
  );
  const validMacd = macd.map(v => v ?? 0);
  const signalLine = calcEMA(validMacd, signal);
  const histogram = macd.map((v, i) => v !== null ? v - (signalLine[i] ?? 0) : null);
  return { macd, signal: signalLine, histogram };
}

export function calcVWAP(data: OHLCVPoint[]): number[] {
  let cumPV = 0, cumVol = 0;
  return data.map(pt => {
    const typical = (pt.high + pt.low + pt.close) / 3;
    cumPV += typical * pt.volume;
    cumVol += pt.volume;
    return cumVol > 0 ? cumPV / cumVol : typical;
  });
}

export function calcATR(data: OHLCVPoint[], period = 14): (number | null)[] {
  if (data.length < 2) return new Array(data.length).fill(null);
  const tr: number[] = [data[0].high - data[0].low];
  for (let i = 1; i < data.length; i++) {
    tr.push(Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    ));
  }
  const atr: (number | null)[] = new Array(data.length).fill(null);
  let avg = tr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  atr[period - 1] = avg;
  for (let i = period; i < data.length; i++) {
    avg = (avg * (period - 1) + tr[i]) / period;
    atr[i] = avg;
  }
  return atr;
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeToPercent(data: OHLCVPoint[]): LinePoint[] {
  if (data.length === 0) return [];
  const base = data[0].close;
  return data.map(pt => ({ time: pt.time, value: ((pt.close - base) / base) * 100 }));
}

export function calcBounds(data: OHLCVPoint[]): ChartBounds {
  if (data.length === 0) return { minTime: 0, maxTime: 0, minValue: 0, maxValue: 0, rangeTime: 0, rangeValue: 0 };
  const minTime = data[0].time;
  const maxTime = data[data.length - 1].time;
  const minValue = Math.min(...data.map(p => p.low));
  const maxValue = Math.max(...data.map(p => p.high));
  return { minTime, maxTime, minValue, maxValue, rangeTime: maxTime - minTime, rangeValue: maxValue - minValue };
}

// ─── Hook: useChartData ───────────────────────────────────────────────────────

export interface UseChartDataOptions {
  data: OHLCVPoint[];
  timeframe?: Timeframe;
  maxPoints?: number;
  indicators?: {
    sma?: number[];
    ema?: number[];
    bollinger?: { period?: number; stdDev?: number };
    rsi?: { period?: number };
    macd?: { fast?: number; slow?: number; signal?: number };
    vwap?: boolean;
    atr?: { period?: number };
  };
}

export function useChartData(options: UseChartDataOptions) {
  const { data, timeframe, maxPoints = 500, indicators = {} } = options;

  const processedData = useMemo(() => {
    if (!data.length) return [];
    let d = timeframe ? resampleOHLCV(data, timeframe) : data;
    if (d.length > maxPoints) {
      const step = Math.ceil(d.length / maxPoints);
      d = d.filter((_, i) => i % step === 0 || i === d.length - 1);
    }
    return d;
  }, [data, timeframe, maxPoints]);

  const closes = useMemo(() => processedData.map(p => p.close), [processedData]);
  const bounds = useMemo(() => calcBounds(processedData), [processedData]);

  const computedIndicators = useMemo(() => {
    const result: Record<string, any> = {};
    if (indicators.sma) {
      indicators.sma.forEach(period => { result[`sma${period}`] = calcSMA(closes, period); });
    }
    if (indicators.ema) {
      indicators.ema.forEach(period => { result[`ema${period}`] = calcEMA(closes, period); });
    }
    if (indicators.bollinger) {
      result.bollinger = calcBollingerBands(closes, indicators.bollinger.period, indicators.bollinger.stdDev);
    }
    if (indicators.rsi) {
      result.rsi = calcRSI(closes, indicators.rsi.period);
    }
    if (indicators.macd) {
      const { fast, slow, signal } = indicators.macd;
      result.macd = calcMACD(closes, fast, slow, signal);
    }
    if (indicators.vwap) {
      result.vwap = calcVWAP(processedData);
    }
    if (indicators.atr) {
      result.atr = calcATR(processedData, indicators.atr.period);
    }
    return result;
  }, [closes, processedData, JSON.stringify(indicators)]);

  return { data: processedData, bounds, indicators: computedIndicators };
}

// ─── Hook: useStreamingData ───────────────────────────────────────────────────

export function useStreamingData(maxLength = 1000) {
  const [data, setData] = useState<OHLCVPoint[]>([]);

  const append = useCallback((point: OHLCVPoint) => {
    setData(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.time === point.time) {
        next[next.length - 1] = {
          ...last,
          high: Math.max(last.high, point.high),
          low: Math.min(last.low, point.low),
          close: point.close,
          volume: last.volume + point.volume,
        };
      } else {
        next.push(point);
        if (next.length > maxLength) next.shift();
      }
      return next;
    });
  }, [maxLength]);

  const reset = useCallback(() => setData([]), []);
  const seed = useCallback((initial: OHLCVPoint[]) => setData(initial), []);

  return { data, append, reset, seed };
}

// ─── Mock OHLCV Generator ─────────────────────────────────────────────────────

export function generateMockOHLCV(
  basePrice = 150,
  bars = 200,
  tf: Timeframe = '1D',
  volatility = 0.015
): OHLCVPoint[] {
  const interval = TF_MS[tf];
  const now = Date.now();
  const start = now - bars * interval;
  const result: OHLCVPoint[] = [];
  let price = basePrice;

  for (let i = 0; i < bars; i++) {
    const time = start + i * interval;
    const change = price * volatility * (Math.random() - 0.49);
    const open = price;
    const close = Math.max(0.01, price + change);
    const amplitude = Math.abs(change) + price * volatility * Math.random();
    const high = Math.max(open, close) + amplitude * 0.5;
    const low = Math.min(open, close) - amplitude * 0.3;
    const volume = Math.floor((Math.random() * 0.8 + 0.2) * 5e6);
    result.push({ time, open, high, low: Math.max(0.01, low), close, volume });
    price = close;
  }
  return result;
}

export default useChartData;
