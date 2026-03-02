import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RangeBarCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  barIndex: number;
  tickCount: number;
  duration: number;
  sourceBarStart: number;
  sourceBarEnd: number;
}

export type RangeSizeMode = 'fixed' | 'atr';

export interface RangeBarConfig {
  rangeSize: number;
  rangeSizeMode: RangeSizeMode;
  atrPeriod: number;
  atrMultiplier: number;
}

export interface RangeBarTrend {
  direction: 'up' | 'down' | 'neutral';
  consecutiveBars: number;
  priceChange: number;
  startIndex: number;
  endIndex: number;
}

export interface RangeBarTimingStats {
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  medianDuration: number;
  stdDevDuration: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_RANGEBAR_CONFIG: RangeBarConfig = {
  rangeSize: 1.0,
  rangeSizeMode: 'fixed',
  atrPeriod: 14,
  atrMultiplier: 1.0,
};

// ─── ATR Helper ─────────────────────────────────────────────────────────────

function computeATR(bars: OHLCVBar[], period: number): number {
  if (bars.length < 2) return 0;
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    ));
  }
  const n = Math.min(period, tr.length);
  let atr = 0;
  for (let i = 0; i < n; i++) atr += tr[i];
  atr /= n;
  for (let i = n; i < tr.length; i++) atr = (atr * (period - 1) + tr[i]) / period;
  return atr;
}

// ─── Range Bar Generation ───────────────────────────────────────────────────

export function generateRangeBars(
  bars: OHLCVBar[],
  config: Partial<RangeBarConfig> = {},
): RangeBarCandle[] {
  const cfg = { ...DEFAULT_RANGEBAR_CONFIG, ...config };
  if (!bars.length) return [];

  const range = cfg.rangeSizeMode === 'atr'
    ? computeATR(bars, cfg.atrPeriod) * cfg.atrMultiplier
    : cfg.rangeSize;

  if (range <= 0) return [];

  const rangeBars: RangeBarCandle[] = [];

  let barOpen = bars[0].open;
  let barHigh = bars[0].high;
  let barLow = bars[0].low;
  let barClose = bars[0].close;
  let barVolume = bars[0].volume;
  let barTicks = 1;
  let barStartTime = bars[0].time;
  let barEndTime = bars[0].time;

  const pushBar = () => {
    rangeBars.push({
      time: barEndTime,
      open: barOpen,
      high: barHigh,
      low: barLow,
      close: barClose,
      volume: barVolume,
      direction: barClose >= barOpen ? 'up' : 'down',
      barIndex: rangeBars.length,
      tickCount: barTicks,
      duration: barEndTime - barStartTime,
      sourceBarStart: barStartTime,
      sourceBarEnd: barEndTime,
    });
  };

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];

    const prices = [bar.open, bar.high, bar.low, bar.close];
    for (const price of prices) {
      barHigh = Math.max(barHigh, price);
      barLow = Math.min(barLow, price);

      if (barHigh - barLow >= range) {
        if (price >= barOpen) {
          barHigh = barLow + range;
          barClose = barHigh;
        } else {
          barLow = barHigh - range;
          barClose = barLow;
        }

        barEndTime = bar.time;
        pushBar();

        barOpen = barClose;
        barHigh = barClose;
        barLow = barClose;
        barVolume = 0;
        barTicks = 0;
        barStartTime = bar.time;
      }
    }

    barClose = bar.close;
    barVolume += bar.volume;
    barTicks++;
    barEndTime = bar.time;
  }

  if (barTicks > 0) {
    pushBar();
  }

  return rangeBars;
}

// ─── Volume per Range Bar ───────────────────────────────────────────────────

export function volumeProfile(rangeBars: RangeBarCandle[]): Map<number, number> {
  const profile = new Map<number, number>();
  for (const bar of rangeBars) {
    const midPrice = Math.round((bar.high + bar.low) / 2 * 100) / 100;
    profile.set(midPrice, (profile.get(midPrice) ?? 0) + bar.volume);
  }
  return profile;
}

export function averageVolumePerBar(
  rangeBars: RangeBarCandle[],
  direction?: 'up' | 'down',
): number {
  const filtered = direction ? rangeBars.filter(b => b.direction === direction) : rangeBars;
  if (!filtered.length) return 0;
  return filtered.reduce((s, b) => s + b.volume, 0) / filtered.length;
}

// ─── Timing Analysis ────────────────────────────────────────────────────────

export function timingAnalysis(rangeBars: RangeBarCandle[]): RangeBarTimingStats {
  if (!rangeBars.length) return { avgDuration: 0, minDuration: 0, maxDuration: 0, medianDuration: 0, stdDevDuration: 0 };

  const durations = rangeBars.map(b => b.duration).filter(d => d > 0);
  if (!durations.length) return { avgDuration: 0, minDuration: 0, maxDuration: 0, medianDuration: 0, stdDevDuration: 0 };

  const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = durations.reduce((s, v) => s + (v - avg) ** 2, 0) / durations.length;

  return {
    avgDuration: avg,
    minDuration: sorted[0],
    maxDuration: sorted[sorted.length - 1],
    medianDuration: median,
    stdDevDuration: Math.sqrt(variance),
  };
}

// ─── Trend Identification ───────────────────────────────────────────────────

export function identifyTrends(rangeBars: RangeBarCandle[]): RangeBarTrend[] {
  if (!rangeBars.length) return [];

  const trends: RangeBarTrend[] = [];
  let startIdx = 0;
  let currentDir = rangeBars[0].direction;
  let count = 1;

  for (let i = 1; i < rangeBars.length; i++) {
    if (rangeBars[i].direction === currentDir) {
      count++;
    } else {
      const priceChange = rangeBars[i - 1].close - rangeBars[startIdx].open;
      trends.push({
        direction: currentDir,
        consecutiveBars: count,
        priceChange,
        startIndex: startIdx,
        endIndex: i - 1,
      });
      startIdx = i;
      currentDir = rangeBars[i].direction;
      count = 1;
    }
  }

  const lastChange = rangeBars[rangeBars.length - 1].close - rangeBars[startIdx].open;
  trends.push({
    direction: currentDir,
    consecutiveBars: count,
    priceChange: lastChange,
    startIndex: startIdx,
    endIndex: rangeBars.length - 1,
  });

  return trends;
}

// ─── Activity Analysis ──────────────────────────────────────────────────────

export function activityAnalysis(rangeBars: RangeBarCandle[]): {
  barsPerHour: number;
  fastestBar: RangeBarCandle | null;
  slowestBar: RangeBarCandle | null;
  avgTicksPerBar: number;
} {
  if (!rangeBars.length) return { barsPerHour: 0, fastestBar: null, slowestBar: null, avgTicksPerBar: 0 };

  const totalDuration = rangeBars[rangeBars.length - 1].time - rangeBars[0].time;
  const barsPerHour = totalDuration > 0 ? (rangeBars.length / totalDuration) * 3_600_000 : 0;

  let fastest: RangeBarCandle | null = null;
  let slowest: RangeBarCandle | null = null;
  let minDur = Infinity;
  let maxDur = 0;

  for (const bar of rangeBars) {
    if (bar.duration > 0 && bar.duration < minDur) { minDur = bar.duration; fastest = bar; }
    if (bar.duration > maxDur) { maxDur = bar.duration; slowest = bar; }
  }

  const avgTicks = rangeBars.reduce((s, b) => s + b.tickCount, 0) / rangeBars.length;

  return { barsPerHour, fastestBar: fastest, slowestBar: slowest, avgTicksPerBar: avgTicks };
}
