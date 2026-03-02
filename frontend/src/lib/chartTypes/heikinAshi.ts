import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HACandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  bodySize: number;
  upperWick: number;
  lowerWick: number;
}

export type HATrendState = 'strong_up' | 'up' | 'indecision' | 'down' | 'strong_down';

export interface HATrendInfo {
  state: HATrendState;
  consecutiveSameColor: number;
  trendStrength: number;
  isIndecision: boolean;
}

export interface HASmoothedCandle extends HACandle {
  smoothedClose: number;
  smoothedOpen: number;
}

// ─── Heikin-Ashi OHLC Transformation ────────────────────────────────────────

export function computeHeikinAshi(bars: OHLCVBar[]): HACandle[] {
  if (!bars.length) return [];

  const candles: HACandle[] = [];
  let prevOpen = bars[0].open;
  let prevClose = (bars[0].open + bars[0].high + bars[0].low + bars[0].close) / 4;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
    const haOpen = i === 0 ? (bar.open + bar.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(bar.high, haOpen, haClose);
    const haLow = Math.min(bar.low, haOpen, haClose);

    const direction: 'up' | 'down' = haClose >= haOpen ? 'up' : 'down';
    const bodySize = Math.abs(haClose - haOpen);
    const upperWick = haHigh - Math.max(haOpen, haClose);
    const lowerWick = Math.min(haOpen, haClose) - haLow;

    candles.push({
      time: bar.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: bar.volume,
      direction,
      bodySize,
      upperWick,
      lowerWick,
    });

    prevOpen = haOpen;
    prevClose = haClose;
  }

  return candles;
}

// ─── Trend Detection ────────────────────────────────────────────────────────

export function detectTrend(candles: HACandle[], index: number): HATrendInfo {
  if (!candles.length || index < 0 || index >= candles.length) {
    return { state: 'indecision', consecutiveSameColor: 0, trendStrength: 0, isIndecision: true };
  }

  const candle = candles[index];
  const totalRange = candle.high - candle.low;
  const bodyRatio = totalRange > 0 ? candle.bodySize / totalRange : 0;
  const isIndecision = bodyRatio < 0.15;

  let consecutive = 1;
  const dir = candle.direction;
  for (let i = index - 1; i >= 0; i--) {
    if (candles[i].direction === dir) consecutive++;
    else break;
  }

  let state: HATrendState;
  if (isIndecision) {
    state = 'indecision';
  } else if (dir === 'up') {
    state = consecutive >= 3 && candle.lowerWick < candle.bodySize * 0.1 ? 'strong_up' : 'up';
  } else {
    state = consecutive >= 3 && candle.upperWick < candle.bodySize * 0.1 ? 'strong_down' : 'down';
  }

  return {
    state,
    consecutiveSameColor: consecutive,
    trendStrength: bodyRatio * consecutive,
    isIndecision,
  };
}

export function detectAllTrends(candles: HACandle[]): HATrendInfo[] {
  return candles.map((_, i) => detectTrend(candles, i));
}

// ─── Indecision Detection (Doji-like HA) ────────────────────────────────────

export function findIndecisionCandles(
  candles: HACandle[],
  bodyThreshold: number = 0.15,
): number[] {
  const indices: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range > 0 && c.bodySize / range < bodyThreshold) {
      indices.push(i);
    }
  }

  return indices;
}

export function isDojiLike(candle: HACandle, threshold: number = 0.1): boolean {
  const range = candle.high - candle.low;
  return range > 0 && candle.bodySize / range < threshold;
}

// ─── Smoothed Heikin-Ashi (Double Smoothing) ────────────────────────────────

export function computeSmoothedHA(
  bars: OHLCVBar[],
  period: number = 6,
): HASmoothedCandle[] {
  const haCandles = computeHeikinAshi(bars);
  if (haCandles.length < period) return haCandles.map(c => ({ ...c, smoothedClose: c.close, smoothedOpen: c.open }));

  const smoothed: HASmoothedCandle[] = [];
  const closes = haCandles.map(c => c.close);
  const opens = haCandles.map(c => c.open);

  const smoothedCloses = emaSmooth(closes, period);
  const smoothedOpens = emaSmooth(opens, period);

  for (let i = 0; i < haCandles.length; i++) {
    const sc = smoothedCloses[i];
    const so = smoothedOpens[i];

    smoothed.push({
      ...haCandles[i],
      smoothedClose: sc,
      smoothedOpen: so,
      direction: sc >= so ? 'up' : 'down',
      bodySize: Math.abs(sc - so),
    });
  }

  return smoothed;
}

function emaSmooth(data: number[], period: number): number[] {
  const out = new Array<number>(data.length).fill(NaN);
  if (data.length < period) return out;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let prev = sum / period;
  out[period - 1] = prev;

  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * k + prev;
    out[i] = prev;
  }

  return out;
}

// ─── Trend Strength from Consecutive Same-Color Candles ─────────────────────

export function trendStrengthSeries(candles: HACandle[]): number[] {
  const strength = new Array<number>(candles.length).fill(0);
  if (!candles.length) return strength;

  strength[0] = candles[0].direction === 'up' ? 1 : -1;

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].direction === candles[i - 1].direction) {
      strength[i] = strength[i - 1] + (candles[i].direction === 'up' ? 1 : -1);
    } else {
      strength[i] = candles[i].direction === 'up' ? 1 : -1;
    }
  }

  return strength;
}

// ─── Color Change Detection ─────────────────────────────────────────────────

export interface HAColorChange {
  index: number;
  time: number;
  from: 'up' | 'down';
  to: 'up' | 'down';
  prevConsecutive: number;
}

export function detectColorChanges(candles: HACandle[]): HAColorChange[] {
  const changes: HAColorChange[] = [];

  let consecutive = 1;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].direction !== candles[i - 1].direction) {
      changes.push({
        index: i,
        time: candles[i].time,
        from: candles[i - 1].direction,
        to: candles[i].direction,
        prevConsecutive: consecutive,
      });
      consecutive = 1;
    } else {
      consecutive++;
    }
  }

  return changes;
}

// ─── Summary Statistics ─────────────────────────────────────────────────────

export function haStatistics(candles: HACandle[]): {
  totalCandles: number;
  upCandles: number;
  downCandles: number;
  avgBodySize: number;
  avgUpperWick: number;
  avgLowerWick: number;
  maxConsecutiveUp: number;
  maxConsecutiveDown: number;
  indecisionCount: number;
} {
  const up = candles.filter(c => c.direction === 'up');
  const down = candles.filter(c => c.direction === 'down');
  const indecision = findIndecisionCandles(candles);

  let maxUp = 0;
  let maxDown = 0;
  let run = 0;
  let lastDir: 'up' | 'down' | null = null;

  for (const c of candles) {
    if (c.direction === lastDir) {
      run++;
    } else {
      if (lastDir === 'up') maxUp = Math.max(maxUp, run);
      else if (lastDir === 'down') maxDown = Math.max(maxDown, run);
      lastDir = c.direction;
      run = 1;
    }
  }
  if (lastDir === 'up') maxUp = Math.max(maxUp, run);
  else if (lastDir === 'down') maxDown = Math.max(maxDown, run);

  const bodies = candles.map(c => c.bodySize);
  const upperWicks = candles.map(c => c.upperWick);
  const lowerWicks = candles.map(c => c.lowerWick);

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  return {
    totalCandles: candles.length,
    upCandles: up.length,
    downCandles: down.length,
    avgBodySize: avg(bodies),
    avgUpperWick: avg(upperWicks),
    avgLowerWick: avg(lowerWicks),
    maxConsecutiveUp: maxUp,
    maxConsecutiveDown: maxDown,
    indecisionCount: indecision.length,
  };
}
