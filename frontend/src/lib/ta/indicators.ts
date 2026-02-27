/**
 * indicators.ts — Full Technical Analysis Library (TypeScript)
 * =============================================================
 * Pure TypeScript port of the Python TA engine for real-time
 * frontend chart overlays and signal computation.
 *
 * All functions operate on number[] arrays (close, high, low, volume).
 * NaN is used for warm-up periods.
 * No external dependencies — runs in WebWorker for performance.
 *
 * Usage:
 *   import { RSI, MACD, BollingerBands } from '@/lib/ta/indicators';
 *   const rsi = RSI(closes, 14);
 *   const { macd, signal, histogram } = MACD(closes, 12, 26, 9);
 */

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface OHLCVData {
  time:   number;  // Unix timestamp
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface MACDResult {
  macd:      number[];
  signal:    number[];
  histogram: number[];
}

export interface BollingerBandsResult {
  upper:  number[];
  middle: number[];
  lower:  number[];
}

export interface KeltnerChannelResult {
  upper:  number[];
  middle: number[];
  lower:  number[];
}

export interface DonchianChannelResult {
  upper:  number[];
  middle: number[];
  lower:  number[];
}

export interface ADXResult {
  adx:      number[];
  plusDI:   number[];
  minusDI:  number[];
}

export interface IchimokuResult {
  tenkan:   number[];
  kijun:    number[];
  senkouA:  number[];
  senkouB:  number[];
  chikou:   number[];
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export interface StochRSIResult {
  k: number[];
  d: number[];
}

export interface StrategySignal {
  index:  number;
  time:   number;
  type:   'buy' | 'sell' | 'neutral';
  strength: number;  // 0-100
  reason: string;
}

// ─── MATH HELPERS ────────────────────────────────────────────────────────────

const NaN_ARRAY = (n: number): number[] => new Array(n).fill(NaN);

function rollingSum(arr: number[], period: number): number[] {
  const out = NaN_ARRAY(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += isNaN(arr[i]) ? 0 : arr[i];
    if (i >= period) {
      sum -= isNaN(arr[i - period]) ? 0 : arr[i - period];
    }
    if (i >= period - 1) out[i] = sum;
  }
  return out;
}

function rollingMax(arr: number[], period: number): number[] {
  const out = NaN_ARRAY(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(arr[j]) && arr[j] > max) max = arr[j];
    }
    out[i] = max === -Infinity ? NaN : max;
  }
  return out;
}

function rollingMin(arr: number[], period: number): number[] {
  const out = NaN_ARRAY(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(arr[j]) && arr[j] < min) min = arr[j];
    }
    out[i] = min === Infinity ? NaN : min;
  }
  return out;
}

function rollingMean(arr: number[], period: number): number[] {
  const sums = rollingSum(arr, period);
  return sums.map((s, i) => (i >= period - 1 && !isNaN(s) ? s / period : NaN));
}

function rollingStdDev(arr: number[], period: number): number[] {
  const out = NaN_ARRAY(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    const slice = arr.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (slice.length < period) { out[i] = NaN; continue; }
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

// ─── MOVING AVERAGES ─────────────────────────────────────────────────────────

/**
 * Simple Moving Average
 */
export function SMA(source: number[], period: number): number[] {
  return rollingMean(source, period);
}

/**
 * Exponential Moving Average
 */
export function EMA(source: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const out = NaN_ARRAY(source.length);
  let started = false;
  let prev = 0;
  for (let i = 0; i < source.length; i++) {
    if (isNaN(source[i])) continue;
    if (!started) {
      // Seed with SMA of first `period` values
      if (i >= period - 1) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
          if (!isNaN(source[j])) { sum += source[j]; count++; }
        }
        if (count === period) {
          prev = sum / count;
          out[i] = prev;
          started = true;
        }
      }
    } else {
      prev = (source[i] - prev) * multiplier + prev;
      out[i] = prev;
    }
  }
  return out;
}

/**
 * Wilder's Smoothed Moving Average (RMA)
 */
export function RMA(source: number[], period: number): number[] {
  const multiplier = 1 / period;
  const out = NaN_ARRAY(source.length);
  let started = false;
  let prev = 0;
  for (let i = 0; i < source.length; i++) {
    if (isNaN(source[i])) continue;
    if (!started) {
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += source[j];
        prev = sum / period;
        out[i] = prev;
        started = true;
      }
    } else {
      prev = source[i] * multiplier + prev * (1 - multiplier);
      out[i] = prev;
    }
  }
  return out;
}

/**
 * Linearly Weighted Moving Average
 */
export function WMA(source: number[], period: number): number[] {
  const out = NaN_ARRAY(source.length);
  let weightSum = 0;
  for (let w = 1; w <= period; w++) weightSum += w;
  for (let i = period - 1; i < source.length; i++) {
    let val = 0;
    for (let j = 0; j < period; j++) {
      val += source[i - (period - 1 - j)] * (j + 1);
    }
    out[i] = val / weightSum;
  }
  return out;
}

/**
 * Double Exponential Moving Average (2*EMA - EMA(EMA))
 */
export function DEMA(source: number[], period: number): number[] {
  const ema1 = EMA(source, period);
  const ema2 = EMA(ema1.filter(v => !isNaN(v)), period);
  // Realign ema2 to original length
  const out = NaN_ARRAY(source.length);
  let j = 0;
  let k = 0;
  for (let i = 0; i < source.length; i++) {
    if (!isNaN(ema1[i])) {
      if (!isNaN(ema2[j])) {
        out[i] = 2 * ema1[i] - ema2[j];
      }
      j++;
    }
  }
  // Simpler approach: just recompute aligned
  const e1 = EMA(source, period);
  const e2 = EMA(e1, period);
  return e1.map((v, i) => (!isNaN(v) && !isNaN(e2[i])) ? 2 * v - e2[i] : NaN);
}

/**
 * Triple Exponential Moving Average (3*EMA - 3*EMA(EMA) + EMA(EMA(EMA)))
 */
export function TEMA(source: number[], period: number): number[] {
  const e1 = EMA(source, period);
  const e2 = EMA(e1, period);
  const e3 = EMA(e2, period);
  return e1.map((v, i) =>
    (!isNaN(v) && !isNaN(e2[i]) && !isNaN(e3[i])) ? 3 * v - 3 * e2[i] + e3[i] : NaN
  );
}

/**
 * Hull Moving Average: WMA(2*WMA(n/2) - WMA(n), sqrt(n))
 */
export function HMA(source: number[], period: number): number[] {
  const half    = Math.max(1, Math.floor(period / 2));
  const sqrtP   = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = WMA(source, half);
  const wmaFull = WMA(source, period);
  const inner   = wmaHalf.map((v, i) =>
    (!isNaN(v) && !isNaN(wmaFull[i])) ? 2 * v - wmaFull[i] : NaN
  );
  return WMA(inner, sqrtP);
}

/**
 * Zero-Lag EMA
 */
export function ZLEMA(source: number[], period: number): number[] {
  const lag = Math.floor((period - 1) / 2);
  const adjusted = source.map((v, i) =>
    i >= lag && !isNaN(v) && !isNaN(source[i - lag]) ? 2 * v - source[i - lag] : NaN
  );
  return EMA(adjusted, period);
}

/**
 * Volume-Weighted Moving Average
 */
export function VWMA(closes: number[], volumes: number[], period: number): number[] {
  const out = NaN_ARRAY(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let pvSum = 0, vSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pvSum += closes[j] * volumes[j];
      vSum += volumes[j];
    }
    out[i] = vSum === 0 ? NaN : pvSum / vSum;
  }
  return out;
}

/**
 * Arnaud Legoux Moving Average
 */
export function ALMA(source: number[], period: number, offset = 0.85, sigma = 6.0): number[] {
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let wSum = 0;
  for (let k = 0; k < period; k++) {
    const w = Math.exp(-((k - m) ** 2) / (2 * s * s));
    weights[k] = w;
    wSum += w;
  }
  const out = NaN_ARRAY(source.length);
  for (let i = period - 1; i < source.length; i++) {
    let val = 0;
    for (let k = 0; k < period; k++) {
      val += source[i - (period - 1 - k)] * weights[k];
    }
    out[i] = val / wSum;
  }
  return out;
}

// ─── OSCILLATORS ─────────────────────────────────────────────────────────────

/**
 * Relative Strength Index (Wilder's smoothing — exact TradingView)
 */
export function RSI(source: number[], period: number): number[] {
  const n = source.length;
  const out = NaN_ARRAY(n);
  if (n < period + 1) return out;

  const gains = NaN_ARRAY(n);
  const losses = NaN_ARRAY(n);
  for (let i = 1; i < n; i++) {
    const diff = source[i] - source[i - 1];
    gains[i]  = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? -diff : 0;
  }

  const avgGains  = RMA(gains, period);
  const avgLosses = RMA(losses, period);

  for (let i = 0; i < n; i++) {
    if (isNaN(avgGains[i]) || isNaN(avgLosses[i])) continue;
    const rs = avgLosses[i] === 0 ? Infinity : avgGains[i] / avgLosses[i];
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/**
 * Stochastic RSI: K and D lines
 */
export function StochRSI(
  source: number[], rsiPeriod = 14, stochPeriod = 14,
  kSmooth = 3, dSmooth = 3
): StochRSIResult {
  const rsiVals  = RSI(source, rsiPeriod);
  const rsiMin   = rollingMin(rsiVals, stochPeriod);
  const rsiMax   = rollingMax(rsiVals, stochPeriod);
  const rawK     = rsiVals.map((v, i) =>
    (!isNaN(v) && !isNaN(rsiMin[i]) && !isNaN(rsiMax[i]) && rsiMax[i] !== rsiMin[i])
      ? (v - rsiMin[i]) / (rsiMax[i] - rsiMin[i]) * 100
      : NaN
  );
  const k = rollingMean(rawK, kSmooth);
  const d = rollingMean(k, dSmooth);
  return { k, d };
}

/**
 * MACD: macd line, signal, histogram
 */
export function MACD(
  source: number[], fast = 12, slow = 26, signalPeriod = 9
): MACDResult {
  const fastEMA = EMA(source, fast);
  const slowEMA = EMA(source, slow);
  const macd    = fastEMA.map((v, i) =>
    (!isNaN(v) && !isNaN(slowEMA[i])) ? v - slowEMA[i] : NaN
  );
  const signal    = EMA(macd, signalPeriod);
  const histogram = macd.map((v, i) =>
    (!isNaN(v) && !isNaN(signal[i])) ? v - signal[i] : NaN
  );
  return { macd, signal, histogram };
}

/**
 * Commodity Channel Index
 */
export function CCI(
  highs: number[], lows: number[], closes: number[], period = 20
): number[] {
  const tp  = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const sma = rollingMean(tp, period);
  const out = NaN_ARRAY(tp.length);
  for (let i = period - 1; i < tp.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const mean  = sma[i];
    const md    = slice.reduce((acc, v) => acc + Math.abs(v - mean), 0) / period;
    out[i] = md === 0 ? 0 : (tp[i] - mean) / (0.015 * md);
  }
  return out;
}

/**
 * Williams %R
 */
export function WilliamsR(
  highs: number[], lows: number[], closes: number[], period = 14
): number[] {
  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);
  return closes.map((v, i) =>
    (!isNaN(hh[i]) && !isNaN(ll[i]) && hh[i] !== ll[i])
      ? ((hh[i] - v) / (hh[i] - ll[i])) * -100
      : NaN
  );
}

/**
 * Stochastic Oscillator
 */
export function Stochastic(
  highs: number[], lows: number[], closes: number[],
  kPeriod = 14, kSmooth = 3, dSmooth = 3
): StochasticResult {
  const ll   = rollingMin(lows, kPeriod);
  const hh   = rollingMax(highs, kPeriod);
  const rawK = closes.map((v, i) =>
    (!isNaN(ll[i]) && !isNaN(hh[i]) && hh[i] !== ll[i])
      ? (v - ll[i]) / (hh[i] - ll[i]) * 100
      : NaN
  );
  const k = rollingMean(rawK, kSmooth);
  const d = rollingMean(k, dSmooth);
  return { k, d };
}

/**
 * Rate of Change
 */
export function ROC(source: number[], period = 12): number[] {
  return source.map((v, i) =>
    (i >= period && !isNaN(source[i - period]) && source[i - period] !== 0)
      ? (v - source[i - period]) / source[i - period] * 100
      : NaN
  );
}

/**
 * Momentum: close - close[period]
 */
export function Momentum(source: number[], period = 10): number[] {
  return source.map((v, i) =>
    (i >= period && !isNaN(source[i - period])) ? v - source[i - period] : NaN
  );
}

/**
 * Awesome Oscillator: SMA(HL2,5) - SMA(HL2,34)
 */
export function AwesomeOscillator(highs: number[], lows: number[]): number[] {
  const hl2  = highs.map((h, i) => (h + lows[i]) / 2);
  const s5   = SMA(hl2, 5);
  const s34  = SMA(hl2, 34);
  return s5.map((v, i) => (!isNaN(v) && !isNaN(s34[i])) ? v - s34[i] : NaN);
}

/**
 * TRIX: 1-day percent change of triple-smoothed EMA
 */
export function TRIX(source: number[], period = 18, signalPeriod = 9): { trix: number[]; signal: number[] } {
  const e1 = EMA(source, period);
  const e2 = EMA(e1, period);
  const e3 = EMA(e2, period);
  const trix = e3.map((v, i) =>
    (i > 0 && !isNaN(v) && !isNaN(e3[i - 1]) && e3[i - 1] !== 0)
      ? (v - e3[i - 1]) / e3[i - 1] * 100
      : NaN
  );
  const signal = EMA(trix, signalPeriod);
  return { trix, signal };
}

/**
 * Ultimate Oscillator (Larry Williams)
 */
export function UltimateOscillator(
  highs: number[], lows: number[], closes: number[],
  p1 = 7, p2 = 14, p3 = 28
): number[] {
  const n = closes.length;
  const bp = new Array(n).fill(NaN);
  const tr = new Array(n).fill(NaN);

  for (let i = 1; i < n; i++) {
    const pcClose = closes[i - 1];
    bp[i] = closes[i] - Math.min(lows[i], pcClose);
    tr[i] = Math.max(highs[i], pcClose) - Math.min(lows[i], pcClose);
  }

  const bpS1 = rollingSum(bp, p1), trS1 = rollingSum(tr, p1);
  const bpS2 = rollingSum(bp, p2), trS2 = rollingSum(tr, p2);
  const bpS3 = rollingSum(bp, p3), trS3 = rollingSum(tr, p3);

  return closes.map((_, i) => {
    if ([bpS1[i], trS1[i], bpS2[i], trS2[i], bpS3[i], trS3[i]].some(isNaN)) return NaN;
    const a1 = trS1[i] === 0 ? 0 : bpS1[i] / trS1[i];
    const a2 = trS2[i] === 0 ? 0 : bpS2[i] / trS2[i];
    const a3 = trS3[i] === 0 ? 0 : bpS3[i] / trS3[i];
    return 100 * (4 * a1 + 2 * a2 + a3) / 7;
  });
}

// ─── VOLATILITY ───────────────────────────────────────────────────────────────

/**
 * True Range
 */
export function TrueRange(highs: number[], lows: number[], closes: number[]): number[] {
  return closes.map((v, i) => {
    if (i === 0) return highs[0] - lows[0];
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    return Math.max(hl, hc, lc);
  });
}

/**
 * Average True Range
 */
export function ATR(
  highs: number[], lows: number[], closes: number[], period = 14
): number[] {
  return RMA(TrueRange(highs, lows, closes), period);
}

/**
 * Bollinger Bands: upper, middle, lower
 */
export function BollingerBands(
  source: number[], period = 20, stdDev = 2.0
): BollingerBandsResult {
  const middle = SMA(source, period);
  const std    = rollingStdDev(source, period);
  const upper  = middle.map((v, i) => (!isNaN(v) && !isNaN(std[i])) ? v + stdDev * std[i] : NaN);
  const lower  = middle.map((v, i) => (!isNaN(v) && !isNaN(std[i])) ? v - stdDev * std[i] : NaN);
  return { upper, middle, lower };
}

/**
 * Bollinger Band %B
 */
export function BBPercentB(source: number[], period = 20, stdDev = 2.0): number[] {
  const { upper, middle, lower } = BollingerBands(source, period, stdDev);
  return source.map((v, i) => {
    const range = upper[i] - lower[i];
    return (!isNaN(upper[i]) && range > 0) ? (v - lower[i]) / range : NaN;
  });
}

/**
 * Keltner Channel
 */
export function KeltnerChannel(
  highs: number[], lows: number[], closes: number[],
  emaPeriod = 20, atrPeriod = 10, multiplier = 2.0
): KeltnerChannelResult {
  const middle = EMA(closes, emaPeriod);
  const atrVal = ATR(highs, lows, closes, atrPeriod);
  const upper  = middle.map((v, i) => (!isNaN(v) && !isNaN(atrVal[i])) ? v + multiplier * atrVal[i] : NaN);
  const lower  = middle.map((v, i) => (!isNaN(v) && !isNaN(atrVal[i])) ? v - multiplier * atrVal[i] : NaN);
  return { upper, middle, lower };
}

/**
 * Donchian Channel
 */
export function DonchianChannel(
  highs: number[], lows: number[], period = 20
): DonchianChannelResult {
  const upper  = rollingMax(highs, period);
  const lower  = rollingMin(lows, period);
  const middle = upper.map((v, i) => (!isNaN(v) && !isNaN(lower[i])) ? (v + lower[i]) / 2 : NaN);
  return { upper, middle, lower };
}

/**
 * Historical Volatility (annualised)
 */
export function HistoricalVolatility(closes: number[], period = 20): number[] {
  const logRets = closes.map((v, i) =>
    (i > 0 && !isNaN(closes[i - 1]) && closes[i - 1] > 0) ? Math.log(v / closes[i - 1]) : NaN
  );
  const std = rollingStdDev(logRets, period);
  return std.map(v => isNaN(v) ? NaN : v * Math.sqrt(252) * 100);
}

// ─── TREND ────────────────────────────────────────────────────────────────────

/**
 * Average Directional Index (ADX + DI lines)
 */
export function ADX(
  highs: number[], lows: number[], closes: number[], period = 14
): ADXResult {
  const n = closes.length;
  const tr     = TrueRange(highs, lows, closes);
  const plusDM  = new Array(n).fill(NaN);
  const minusDM = new Array(n).fill(NaN);

  for (let i = 1; i < n; i++) {
    const upMove   = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i]  = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  const atrArr   = RMA(tr, period);
  const plusDIArr  = RMA(plusDM, period).map((v, i) => (isNaN(atrArr[i]) || atrArr[i] === 0) ? NaN : v / atrArr[i] * 100);
  const minusDIArr = RMA(minusDM, period).map((v, i) => (isNaN(atrArr[i]) || atrArr[i] === 0) ? NaN : v / atrArr[i] * 100);
  const dx = plusDIArr.map((v, i) => {
    const sum = v + minusDIArr[i];
    return (!isNaN(v) && !isNaN(minusDIArr[i]) && sum > 0) ? Math.abs(v - minusDIArr[i]) / sum * 100 : NaN;
  });
  const adx = RMA(dx, period);
  return { adx, plusDI: plusDIArr, minusDI: minusDIArr };
}

/**
 * Aroon Up, Down, Oscillator
 */
export function Aroon(
  highs: number[], lows: number[], period = 25
): { up: number[]; down: number[]; oscillator: number[] } {
  const n = highs.length;
  const up   = NaN_ARRAY(n);
  const down = NaN_ARRAY(n);
  for (let i = period; i < n; i++) {
    const hi = highs.slice(i - period, i + 1);
    const lo = lows.slice(i - period, i + 1);
    const highIdx = hi.reduce((bi, v, j) => v > hi[bi] ? j : bi, 0);
    const lowIdx  = lo.reduce((bi, v, j) => v < lo[bi] ? j : bi, 0);
    up[i]   = (period - (period - highIdx)) / period * 100;
    down[i] = (period - (period - lowIdx)) / period * 100;
  }
  const oscillator = up.map((v, i) => (!isNaN(v) && !isNaN(down[i])) ? v - down[i] : NaN);
  return { up, down, oscillator };
}

/**
 * Parabolic SAR
 */
export function ParabolicSAR(
  highs: number[], lows: number[],
  start = 0.02, increment = 0.02, maximum = 0.2
): number[] {
  const n   = highs.length;
  const out = new Array(n).fill(NaN);
  if (n < 2) return out;

  let bull = true;
  let af   = start;
  let ep   = highs[0];
  out[0]   = lows[0];

  for (let i = 1; i < n; i++) {
    const prevSAR = out[i - 1] ?? lows[0];
    if (bull) {
      out[i] = prevSAR + af * (ep - prevSAR);
      out[i] = Math.min(out[i], lows[i - 1], i >= 2 ? lows[i - 2] : lows[i - 1]);
      if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + increment, maximum); }
      if (lows[i] < out[i]) {
        bull = false; out[i] = ep; ep = lows[i]; af = start;
      }
    } else {
      out[i] = prevSAR + af * (ep - prevSAR);
      out[i] = Math.max(out[i], highs[i - 1], i >= 2 ? highs[i - 2] : highs[i - 1]);
      if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + increment, maximum); }
      if (highs[i] > out[i]) {
        bull = true; out[i] = ep; ep = highs[i]; af = start;
      }
    }
  }
  return out;
}

/**
 * SuperTrend Indicator
 */
export function SuperTrend(
  highs: number[], lows: number[], closes: number[],
  period = 10, multiplier = 3.0
): { supertrend: number[]; direction: number[] } {
  const n       = closes.length;
  const hl2     = highs.map((h, i) => (h + lows[i]) / 2);
  const atrArr  = ATR(highs, lows, closes, period);

  const upperBandRaw = hl2.map((v, i) => isNaN(atrArr[i]) ? NaN : v + multiplier * atrArr[i]);
  const lowerBandRaw = hl2.map((v, i) => isNaN(atrArr[i]) ? NaN : v - multiplier * atrArr[i]);

  const finalUpper = [...upperBandRaw];
  const finalLower = [...lowerBandRaw];
  const st         = new Array(n).fill(NaN);
  const dir        = new Array(n).fill(1);

  for (let i = 1; i < n; i++) {
    if (isNaN(upperBandRaw[i])) continue;
    finalUpper[i] = (upperBandRaw[i] < finalUpper[i - 1] || closes[i - 1] > finalUpper[i - 1])
      ? upperBandRaw[i] : finalUpper[i - 1];
    finalLower[i] = (lowerBandRaw[i] > finalLower[i - 1] || closes[i - 1] < finalLower[i - 1])
      ? lowerBandRaw[i] : finalLower[i - 1];

    const prevST = isNaN(st[i - 1]) ? finalUpper[i] : st[i - 1];
    if (prevST === finalUpper[i - 1]) {
      if (closes[i] <= finalUpper[i]) { st[i] = finalUpper[i]; dir[i] = -1; }
      else { st[i] = finalLower[i]; dir[i] = 1; }
    } else {
      if (closes[i] >= finalLower[i]) { st[i] = finalLower[i]; dir[i] = 1; }
      else { st[i] = finalUpper[i]; dir[i] = -1; }
    }
  }
  return { supertrend: st, direction: dir };
}

/**
 * Ichimoku Cloud
 */
export function Ichimoku(
  highs: number[], lows: number[],
  tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52, displacement = 26
): IchimokuResult {
  const n = highs.length;
  const midpoint = (h: number[], l: number[], p: number) => {
    const hi = rollingMax(h, p);
    const lo = rollingMin(l, p);
    return hi.map((v, i) => (!isNaN(v) && !isNaN(lo[i])) ? (v + lo[i]) / 2 : NaN);
  };

  const tenkan   = midpoint(highs, lows, tenkanPeriod);
  const kijun    = midpoint(highs, lows, kijunPeriod);
  const senkouA  = tenkan.map((v, i) => (!isNaN(v) && !isNaN(kijun[i])) ? (v + kijun[i]) / 2 : NaN);
  const senkouB  = midpoint(highs, lows, senkouBPeriod);
  const chikou   = [...closes].map((v, i) => v);  // Chikou is just close shifted -26

  // Shift senkou forward by displacement
  const senkouAShifted = [...NaN_ARRAY(displacement), ...senkouA].slice(0, n);
  const senkouBShifted = [...NaN_ARRAY(displacement), ...senkouB].slice(0, n);

  return {
    tenkan, kijun,
    senkouA: senkouAShifted,
    senkouB: senkouBShifted,
    chikou,
  };
}

// Add closes reference for Ichimoku (needed in function above)
let closes: number[] = [];

// ─── VOLUME INDICATORS ───────────────────────────────────────────────────────

/**
 * VWAP — Session-anchored (reset manually by passing session-scoped arrays)
 */
export function VWAP(
  highs: number[], lows: number[], closesIn: number[], volumes: number[]
): number[] {
  const n  = closesIn.length;
  const tp = closesIn.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const out = new Array(n).fill(NaN);
  let cumPV  = 0;
  let cumVol = 0;
  for (let i = 0; i < n; i++) {
    cumPV  += tp[i] * volumes[i];
    cumVol += volumes[i];
    out[i]  = cumVol === 0 ? NaN : cumPV / cumVol;
  }
  return out;
}

/**
 * On Balance Volume
 */
export function OBV(closes: number[], volumes: number[]): number[] {
  const out = new Array(closes.length).fill(NaN);
  let cumOBV = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) cumOBV += volumes[i];
    else if (closes[i] < closes[i - 1]) cumOBV -= volumes[i];
    out[i] = cumOBV;
  }
  return out;
}

/**
 * Money Flow Index
 */
export function MFI(
  highs: number[], lows: number[], closes: number[], volumes: number[], period = 14
): number[] {
  const n  = closes.length;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMF       = tp.map((v, i) => v * volumes[i]);
  const posMF       = new Array(n).fill(0);
  const negMF       = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    if (tp[i] > tp[i - 1]) posMF[i] = rawMF[i];
    else negMF[i] = rawMF[i];
  }
  const posMFSum = rollingSum(posMF, period);
  const negMFSum = rollingSum(negMF, period);
  return posMFSum.map((v, i) => {
    if (isNaN(v) || isNaN(negMFSum[i])) return NaN;
    const ratio = negMFSum[i] === 0 ? Infinity : v / negMFSum[i];
    return 100 - 100 / (1 + ratio);
  });
}

/**
 * Chaikin Money Flow
 */
export function CMF(
  highs: number[], lows: number[], closes: number[], volumes: number[], period = 20
): number[] {
  const clv = closes.map((c, i) => {
    const hl = highs[i] - lows[i];
    return hl === 0 ? 0 : ((c - lows[i]) - (highs[i] - c)) / hl;
  });
  const mfVol = clv.map((v, i) => v * volumes[i]);
  const mfSum  = rollingSum(mfVol, period);
  const volSum = rollingSum(volumes, period);
  return mfSum.map((v, i) => (isNaN(v) || !volSum[i]) ? NaN : v / volSum[i]);
}

/**
 * Ease of Movement
 */
export function EaseOfMovement(
  highs: number[], lows: number[], volumes: number[], period = 14, divisor = 10000
): number[] {
  const n = highs.length;
  const emv1 = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const dm    = (highs[i] + lows[i]) / 2 - (highs[i - 1] + lows[i - 1]) / 2;
    const hl    = highs[i] - lows[i];
    const boxR  = hl === 0 ? NaN : (volumes[i] / divisor) / hl;
    emv1[i] = boxR ? dm / boxR : NaN;
  }
  return SMA(emv1, period);
}

/**
 * Force Index
 */
export function ForceIndex(closes: number[], volumes: number[], period = 13): number[] {
  const fi1 = closes.map((v, i) => i > 0 ? (v - closes[i - 1]) * volumes[i] : NaN);
  return EMA(fi1, period);
}

// ─── PIVOT POINTS ────────────────────────────────────────────────────────────

export interface PivotPoints {
  P: number; R1: number; R2: number; R3: number;
  S1: number; S2: number; S3: number;
}

/**
 * Standard Pivot Points (for a single bar)
 */
export function StandardPivots(high: number, low: number, close: number): PivotPoints {
  const P  = (high + low + close) / 3;
  const R1 = 2 * P - low;
  const R2 = P + (high - low);
  const R3 = R1 + (high - low);
  const S1 = 2 * P - high;
  const S2 = P - (high - low);
  const S3 = S1 - (high - low);
  return { P, R1, R2, R3, S1, S2, S3 };
}

/**
 * Fibonacci Pivot Points
 */
export function FibonacciPivots(high: number, low: number, close: number): PivotPoints {
  const P  = (high + low + close) / 3;
  const hl = high - low;
  return {
    P, R1: P + 0.382 * hl, R2: P + 0.618 * hl, R3: P + hl,
    S1: P - 0.382 * hl, S2: P - 0.618 * hl, S3: P - hl,
  };
}

/**
 * Camarilla Pivots
 */
export function CamarillaPivots(
  high: number, low: number, close: number
): { P: number; R1: number; R2: number; R3: number; R4: number; S1: number; S2: number; S3: number; S4: number } {
  const hl = high - low;
  return {
    P:  close,
    R1: close + hl * 1.0833, R2: close + hl * 1.1666,
    R3: close + hl * 1.25,   R4: close + hl * 1.5,
    S1: close - hl * 1.0833, S2: close - hl * 1.1666,
    S3: close - hl * 1.25,   S4: close - hl * 1.5,
  };
}

// ─── STATISTICAL ────────────────────────────────────────────────────────────

/**
 * Z-Score of price relative to rolling mean
 */
export function ZScore(source: number[], period = 20): number[] {
  const mean  = SMA(source, period);
  const std   = rollingStdDev(source, period);
  return source.map((v, i) =>
    (!isNaN(mean[i]) && !isNaN(std[i]) && std[i] > 0) ? (v - mean[i]) / std[i] : NaN
  );
}

/**
 * Linear Regression value (end-point)
 */
export function LinearRegression(source: number[], period = 14): number[] {
  const out = NaN_ARRAY(source.length);
  for (let i = period - 1; i < source.length; i++) {
    const y     = source.slice(i - period + 1, i + 1);
    const valid = y.filter(v => !isNaN(v));
    if (valid.length < period) continue;
    const n     = valid.length;
    const xArr  = Array.from({ length: n }, (_, k) => k);
    const xMean = (n - 1) / 2;
    const yMean = valid.reduce((a, b) => a + b, 0) / n;
    const num   = xArr.reduce((acc, x, j) => acc + (x - xMean) * (valid[j] - yMean), 0);
    const den   = xArr.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
    const slope     = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    out[i] = slope * (n - 1) + intercept;
  }
  return out;
}

// ─── ZIGZAG ─────────────────────────────────────────────────────────────────

/**
 * ZigZag Indicator (percentage deviation)
 */
export function ZigZag(
  highs: number[], lows: number[], deviation = 5.0
): number[] {
  const n   = highs.length;
  const out = new Array(n).fill(NaN);
  let lastPivot    = highs[0];
  let lastPivotIdx = 0;
  let trend        = 1; // 1=up, -1=down

  for (let i = 1; i < n; i++) {
    if (trend === 1) {
      if (highs[i] > lastPivot) {
        lastPivot = highs[i]; lastPivotIdx = i;
      } else if ((lastPivot - lows[i]) / lastPivot * 100 >= deviation) {
        out[lastPivotIdx] = lastPivot;
        lastPivot = lows[i]; lastPivotIdx = i; trend = -1;
      }
    } else {
      if (lows[i] < lastPivot) {
        lastPivot = lows[i]; lastPivotIdx = i;
      } else if ((highs[i] - lastPivot) / lastPivot * 100 >= deviation) {
        out[lastPivotIdx] = lastPivot;
        lastPivot = highs[i]; lastPivotIdx = i; trend = 1;
      }
    }
  }
  out[lastPivotIdx] = lastPivot;
  return out;
}

// ─── COMPOSITE SIGNAL GENERATOR ──────────────────────────────────────────────

/**
 * Multi-indicator trend strength score (0-100) for current bar
 */
export function TrendStrengthScore(
  ohlcv: OHLCVData[],
): { score: number; bias: 'bullish' | 'bearish' | 'neutral'; signals: Record<string, string> } {
  const closesArr  = ohlcv.map(d => d.close);
  const highsArr   = ohlcv.map(d => d.high);
  const lowsArr    = ohlcv.map(d => d.low);
  const volumesArr = ohlcv.map(d => d.volume);

  const last = (arr: number[]) => arr[arr.length - 1];

  const rsi14     = last(RSI(closesArr, 14));
  const macvals   = MACD(closesArr, 12, 26, 9);
  const macd      = last(macvals.macd);
  const macSig    = last(macvals.signal);
  const sma20     = last(SMA(closesArr, 20));
  const sma50     = last(SMA(closesArr, 50));
  const sma200    = last(SMA(closesArr, 200));
  const bb        = BollingerBands(closesArr, 20, 2);
  const bbB       = last(BBPercentB(closesArr, 20, 2));
  const adxData   = ADX(highsArr, lowsArr, closesArr, 14);
  const adxVal    = last(adxData.adx);
  const plusDI    = last(adxData.plusDI);
  const minusDI   = last(adxData.minusDI);
  const stochData = Stochastic(highsArr, lowsArr, closesArr, 14, 3, 3);
  const stochK    = last(stochData.k);
  const obvArr    = OBV(closesArr, volumesArr);
  const obvEMA    = last(EMA(obvArr, 20));
  const closeNow  = last(closesArr);
  const vwapVal   = last(VWAP(highsArr, lowsArr, closesArr, volumesArr));

  let score  = 50;
  const sigs: Record<string, string> = {};

  // RSI signals
  if (!isNaN(rsi14)) {
    if (rsi14 > 60) { score += 5; sigs.rsi = 'bullish'; }
    else if (rsi14 < 40) { score -= 5; sigs.rsi = 'bearish'; }
    else sigs.rsi = 'neutral';
    if (rsi14 > 70) { score += 3; sigs.rsi_extreme = 'overbought'; }
    else if (rsi14 < 30) { score -= 3; sigs.rsi_extreme = 'oversold'; }
  }

  // MACD signals
  if (!isNaN(macd) && !isNaN(macSig)) {
    if (macd > macSig) { score += 7; sigs.macd = 'bullish_cross'; }
    else { score -= 7; sigs.macd = 'bearish_cross'; }
    if (macd > 0) score += 3; else score -= 3;
  }

  // Moving average alignment
  if (!isNaN(sma20) && !isNaN(sma50) && !isNaN(sma200)) {
    if (closeNow > sma200) { score += 5; sigs.trend_200 = 'above_200sma'; }
    else { score -= 5; sigs.trend_200 = 'below_200sma'; }
    if (sma20 > sma50) { score += 4; sigs.ma_cross = 'golden_cross'; }
    else { score -= 4; sigs.ma_cross = 'death_cross'; }
    if (closeNow > sma20) score += 2; else score -= 2;
  }

  // Bollinger Band position
  if (!isNaN(bbB)) {
    if (bbB > 0.8) { score -= 4; sigs.bb = 'near_upper_band'; }
    else if (bbB < 0.2) { score += 4; sigs.bb = 'near_lower_band'; }
    else sigs.bb = 'mid_range';
  }

  // ADX trend strength
  if (!isNaN(adxVal)) {
    if (adxVal > 25) {
      if (plusDI > minusDI) { score += 6; sigs.adx = 'strong_uptrend'; }
      else { score -= 6; sigs.adx = 'strong_downtrend'; }
    } else sigs.adx = 'no_trend';
  }

  // Stochastic
  if (!isNaN(stochK)) {
    if (stochK > 80) { score -= 3; sigs.stoch = 'overbought'; }
    else if (stochK < 20) { score += 3; sigs.stoch = 'oversold'; }
    else sigs.stoch = 'neutral';
  }

  // VWAP
  if (!isNaN(vwapVal)) {
    if (closeNow > vwapVal) { score += 4; sigs.vwap = 'above_vwap'; }
    else { score -= 4; sigs.vwap = 'below_vwap'; }
  }

  score = Math.max(0, Math.min(100, score));
  const bias =
    score >= 60 ? 'bullish' :
    score <= 40 ? 'bearish' : 'neutral';

  return { score, bias, signals: sigs };
}

/**
 * Detect crossovers between two series
 */
export function Crossover(a: number[], b: number[]): boolean[] {
  return a.map((v, i) =>
    i > 0 && !isNaN(v) && !isNaN(b[i]) &&
    !isNaN(a[i - 1]) && !isNaN(b[i - 1]) &&
    a[i - 1] <= b[i - 1] && v > b[i]
  );
}

/**
 * Detect crossunders between two series
 */
export function Crossunder(a: number[], b: number[]): boolean[] {
  return a.map((v, i) =>
    i > 0 && !isNaN(v) && !isNaN(b[i]) &&
    !isNaN(a[i - 1]) && !isNaN(b[i - 1]) &&
    a[i - 1] >= b[i - 1] && v < b[i]
  );
}

/**
 * List of all available indicators
 */
export const AVAILABLE_INDICATORS = [
  'SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'HMA', 'ZLEMA', 'VWMA', 'ALMA', 'RMA',
  'RSI', 'StochRSI', 'MACD', 'CCI', 'WilliamsR', 'Stochastic',
  'ROC', 'Momentum', 'AwesomeOscillator', 'TRIX', 'UltimateOscillator',
  'ATR', 'TrueRange', 'BollingerBands', 'BBPercentB', 'KeltnerChannel', 'DonchianChannel',
  'HistoricalVolatility', 'ADX', 'Aroon', 'ParabolicSAR', 'SuperTrend', 'Ichimoku',
  'VWAP', 'OBV', 'MFI', 'CMF', 'EaseOfMovement', 'ForceIndex',
  'StandardPivots', 'FibonacciPivots', 'CamarillaPivots',
  'ZScore', 'LinearRegression', 'ZigZag',
  'TrendStrengthScore', 'Crossover', 'Crossunder',
] as const;

export type IndicatorName = typeof AVAILABLE_INDICATORS[number];
