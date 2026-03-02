import type { OHLCVBar } from './renko';

// ─── Types ──────────────────────────────────────────────────────────────────

export type KagiLineWeight = 'yang' | 'yin';

export interface KagiSegment {
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  weight: KagiLineWeight;
  direction: 'up' | 'down';
  volume: number;
  segmentIndex: number;
}

export type ReversalMode = 'fixed' | 'percentage' | 'atr';

export interface KagiConfig {
  reversalAmount: number;
  reversalMode: ReversalMode;
  atrPeriod: number;
  percentageReversal: number;
}

export interface KagiShoulder {
  price: number;
  time: number;
  segmentIndex: number;
}

export interface KagiWaist {
  price: number;
  time: number;
  segmentIndex: number;
}

export interface KagiTrend {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  segments: number;
  startIndex: number;
  endIndex: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_KAGI_CONFIG: KagiConfig = {
  reversalAmount: 4.0,
  reversalMode: 'percentage',
  atrPeriod: 14,
  percentageReversal: 4.0,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function getReversalThreshold(price: number, bars: OHLCVBar[], cfg: KagiConfig): number {
  switch (cfg.reversalMode) {
    case 'fixed': return cfg.reversalAmount;
    case 'percentage': return price * (cfg.percentageReversal / 100);
    case 'atr': return computeATR(bars, cfg.atrPeriod);
  }
}

// ─── Kagi Line Generation ───────────────────────────────────────────────────

export function generateKagiLines(
  bars: OHLCVBar[],
  config: Partial<KagiConfig> = {},
): KagiSegment[] {
  const cfg = { ...DEFAULT_KAGI_CONFIG, ...config };
  if (bars.length < 2) return [];

  const segments: KagiSegment[] = [];
  let direction: 'up' | 'down' = bars[1].close >= bars[0].close ? 'up' : 'down';
  let segStart = bars[0].close;
  let segEnd = bars[0].close;
  let segStartTime = bars[0].time;
  let segEndTime = bars[0].time;
  let accVol = bars[0].volume;

  let prevHigh = bars[0].close;
  let prevLow = bars[0].close;
  let weight: KagiLineWeight = 'yang';

  const pushSegment = () => {
    segments.push({
      startPrice: segStart,
      endPrice: segEnd,
      startTime: segStartTime,
      endTime: segEndTime,
      weight,
      direction,
      volume: accVol,
      segmentIndex: segments.length,
    });
  };

  for (let i = 1; i < bars.length; i++) {
    const price = bars[i].close;
    const reversal = getReversalThreshold(segEnd, bars.slice(0, i + 1), cfg);
    accVol += bars[i].volume;

    if (direction === 'up') {
      if (price > segEnd) {
        segEnd = price;
        segEndTime = bars[i].time;
        if (price > prevHigh) {
          weight = 'yang';
          prevHigh = price;
        }
      } else if (segEnd - price >= reversal) {
        pushSegment();
        direction = 'down';
        segStart = segEnd;
        segStartTime = segEndTime;
        segEnd = price;
        segEndTime = bars[i].time;
        accVol = bars[i].volume;
        if (price < prevLow) {
          weight = 'yin';
          prevLow = price;
        }
      }
    } else {
      if (price < segEnd) {
        segEnd = price;
        segEndTime = bars[i].time;
        if (price < prevLow) {
          weight = 'yin';
          prevLow = price;
        }
      } else if (price - segEnd >= reversal) {
        pushSegment();
        direction = 'up';
        segStart = segEnd;
        segStartTime = segEndTime;
        segEnd = price;
        segEndTime = bars[i].time;
        accVol = bars[i].volume;
        if (price > prevHigh) {
          weight = 'yang';
          prevHigh = price;
        }
      }
    }
  }

  pushSegment();
  return segments;
}

// ─── Shoulder / Waist Identification ────────────────────────────────────────

export function findShoulders(segments: KagiSegment[]): KagiShoulder[] {
  const shoulders: KagiShoulder[] = [];

  for (let i = 1; i < segments.length; i++) {
    if (segments[i - 1].direction === 'up' && segments[i].direction === 'down') {
      shoulders.push({
        price: segments[i - 1].endPrice,
        time: segments[i - 1].endTime,
        segmentIndex: i - 1,
      });
    }
  }

  return shoulders;
}

export function findWaists(segments: KagiSegment[]): KagiWaist[] {
  const waists: KagiWaist[] = [];

  for (let i = 1; i < segments.length; i++) {
    if (segments[i - 1].direction === 'down' && segments[i].direction === 'up') {
      waists.push({
        price: segments[i - 1].endPrice,
        time: segments[i - 1].endTime,
        segmentIndex: i - 1,
      });
    }
  }

  return waists;
}

// ─── Trend Analysis ─────────────────────────────────────────────────────────

export function analyzeKagiTrends(segments: KagiSegment[]): KagiTrend[] {
  if (segments.length < 2) return [];

  const trends: KagiTrend[] = [];
  let trendDir: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let startIdx = 0;
  let strength = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let newDir: 'bullish' | 'bearish' | 'neutral';

    if (seg.weight === 'yang' && seg.direction === 'up') {
      newDir = 'bullish';
    } else if (seg.weight === 'yin' && seg.direction === 'down') {
      newDir = 'bearish';
    } else {
      newDir = trendDir;
    }

    if (newDir !== trendDir && trendDir !== 'neutral') {
      trends.push({
        direction: trendDir,
        strength,
        segments: i - startIdx,
        startIndex: startIdx,
        endIndex: i - 1,
      });
      startIdx = i;
      strength = 0;
    }

    trendDir = newDir;
    strength += Math.abs(seg.endPrice - seg.startPrice);
  }

  trends.push({
    direction: trendDir,
    strength,
    segments: segments.length - startIdx,
    startIndex: startIdx,
    endIndex: segments.length - 1,
  });

  return trends;
}

// ─── Volume Integration ─────────────────────────────────────────────────────

export function kagiVolumeByWeight(segments: KagiSegment[]): { yang: number; yin: number } {
  let yang = 0;
  let yin = 0;
  for (const seg of segments) {
    if (seg.weight === 'yang') yang += seg.volume;
    else yin += seg.volume;
  }
  return { yang, yin };
}

export function kagiVolumeByDirection(segments: KagiSegment[]): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const seg of segments) {
    if (seg.direction === 'up') up += seg.volume;
    else down += seg.volume;
  }
  return { up, down };
}

// ─── Buy / Sell Signals ─────────────────────────────────────────────────────

export interface KagiSignal {
  type: 'buy' | 'sell';
  price: number;
  time: number;
  segmentIndex: number;
}

export function generateSignals(segments: KagiSegment[]): KagiSignal[] {
  const signals: KagiSignal[] = [];

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];

    if (prev.weight === 'yin' && curr.weight === 'yang') {
      signals.push({ type: 'buy', price: curr.startPrice, time: curr.startTime, segmentIndex: i });
    } else if (prev.weight === 'yang' && curr.weight === 'yin') {
      signals.push({ type: 'sell', price: curr.startPrice, time: curr.startTime, segmentIndex: i });
    }
  }

  return signals;
}
