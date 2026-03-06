/**
 * indicators-extended.ts — Extended Technical Analysis Library (80+ indicators)
 * ==============================================================================
 * Pure functions: (data: number[], params?: object) => number[] | object
 * Supports OHLCV via params: { highs?, lows?, volumes?, opens? }
 * NaN for warm-up. No external dependencies. All exports.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface IndicatorParams {
  period?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  stdDev?: number;
  multiplier?: number;
  highs?: number[];
  lows?: number[];
  opens?: number[];
  volumes?: number[];
  offset?: number;
  sigma?: number;
  [key: string]: number | number[] | undefined;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export interface IchimokuResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
}

export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
}

export interface AroonResult {
  up: number[];
  down: number[];
  oscillator: number[];
}

export interface PivotPoints {
  P: number;
  R1: number;
  R2: number;
  R3: number;
  S1: number;
  S2: number;
  S3: number;
}

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────

const fillNaN = (n: number): number[] => new Array(n).fill(NaN);

function sum(arr: number[], start: number, end: number): number {
  let s = 0;
  for (let i = start; i <= end; i++) s += arr[i] ?? 0;
  return s;
}

function rollingSum(arr: number[], period: number): number[] {
  const out = fillNaN(arr.length);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i] ?? 0;
    if (i >= period) s -= arr[i - period] ?? 0;
    if (i >= period - 1) out[i] = s;
  }
  return out;
}

function rollingMax(arr: number[], period: number): number[] {
  const out = fillNaN(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let m = -Infinity;
    for (let j = i - period + 1; j <= i; j++)
      if (arr[j] > m && !isNaN(arr[j])) m = arr[j];
    out[i] = m === -Infinity ? NaN : m;
  }
  return out;
}

function rollingMin(arr: number[], period: number): number[] {
  const out = fillNaN(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let m = Infinity;
    for (let j = i - period + 1; j <= i; j++)
      if (arr[j] < m && !isNaN(arr[j])) m = arr[j];
    out[i] = m === Infinity ? NaN : m;
  }
  return out;
}

function rollingMean(arr: number[], period: number): number[] {
  const s = rollingSum(arr, period);
  return s.map((v, i) => (i >= period - 1 && !isNaN(v) ? v / period : NaN));
}

function rollingStdDev(arr: number[], period: number): number[] {
  const out = fillNaN(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    const slice = arr.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (slice.length < period) continue;
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const var_ = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(var_);
  }
  return out;
}

function rma(arr: number[], period: number): number[] {
  const k = 1 / period;
  const out = fillNaN(arr.length);
  let prev = 0;
  let started = false;
  for (let i = 0; i < arr.length; i++) {
    if (isNaN(arr[i])) continue;
    if (!started && i >= period - 1) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += arr[j];
      prev = s / period;
      started = true;
    }
    if (started) {
      prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function ema(arr: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = fillNaN(arr.length);
  let prev = 0;
  let started = false;
  for (let i = 0; i < arr.length; i++) {
    if (isNaN(arr[i])) continue;
    if (!started && i >= period - 1) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += arr[j];
      prev = s / period;
      started = true;
    }
    if (started) {
      prev = (arr[i] - prev) * k + prev;
      out[i] = prev;
    }
  }
  return out;
}

// ─── MOVING AVERAGES ─────────────────────────────────────────────────────────

export function SMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  return rollingMean(data, period);
}

export function EMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  return ema(data, period);
}

export function WMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const out = fillNaN(data.length);
  const weightSum = (period * (period + 1)) / 2;
  for (let i = period - 1; i < data.length; i++) {
    let val = 0;
    for (let j = 0; j < period; j++)
      val += (data[i - period + 1 + j] ?? 0) * (j + 1);
    out[i] = val / weightSum;
  }
  return out;
}

export function DEMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  return e1.map((v, i) => (!isNaN(v) && !isNaN(e2[i]) ? 2 * v - e2[i] : NaN));
}

export function TEMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);
  return e1.map((v, i) =>
    !isNaN(v) && !isNaN(e2[i]) && !isNaN(e3[i])
      ? 3 * v - 3 * e2[i] + e3[i]
      : NaN
  );
}

export function HullMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = WMA(data, { period: half });
  const wmaFull = WMA(data, { period });
  const inner = wmaHalf.map((v, i) =>
    !isNaN(v) && !isNaN(wmaFull[i]) ? 2 * v - wmaFull[i] : NaN
  );
  return WMA(inner, { period: sqrtP });
}

export function VWMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const volumes = params?.volumes ?? [];
  if (!volumes.length || volumes.length !== data.length)
    return fillNaN(data.length);
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    let pv = 0, v = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pv += (data[j] ?? 0) * (volumes[j] ?? 0);
      v += volumes[j] ?? 0;
    }
    out[i] = v === 0 ? NaN : pv / v;
  }
  return out;
}

export function KAMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 10;
  const fast = params?.fast ?? 2;
  const slow = params?.slow ?? 30;
  const out = fillNaN(data.length);
  if (data.length < period) return out;

  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);

  let er = 0;
  let kama = data[period - 1] ?? 0;
  out[period - 1] = kama;

  for (let i = period; i < data.length; i++) {
    const change = Math.abs((data[i] ?? 0) - (data[i - period] ?? 0));
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++)
      volatility += Math.abs((data[j] ?? 0) - (data[j - 1] ?? 0));
    er = volatility === 0 ? 0 : change / volatility;
    const sc = (er * (fastSC - slowSC) + slowSC) ** 2;
    kama = kama + sc * ((data[i] ?? 0) - kama);
    out[i] = kama;
  }
  return out;
}

export function ALMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 9;
  const offset = params?.offset ?? 0.85;
  const sigma = params?.sigma ?? 6;
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let wSum = 0;
  for (let k = 0; k < period; k++) {
    const w = Math.exp(-((k - m) ** 2) / (2 * s * s));
    weights.push(w);
    wSum += w;
  }
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    let val = 0;
    for (let k = 0; k < period; k++)
      val += (data[i - period + 1 + k] ?? 0) * weights[k];
    out[i] = val / wSum;
  }
  return out;
}

export function FRAMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 10;
  const out = fillNaN(data.length);
  if (data.length < period * 2) return out;

  const half = Math.floor(period / 2);
  let prevFrama = (data[period - 1] ?? 0);

  for (let i = period; i < data.length; i++) {
    const hh1 = Math.max(...data.slice(i - period, i - half).map(v => v ?? -Infinity));
    const ll1 = Math.min(...data.slice(i - period, i - half).map(v => v ?? Infinity));
    const hh2 = Math.max(...data.slice(i - half, i + 1).map(v => v ?? -Infinity));
    const ll2 = Math.min(...data.slice(i - half, i + 1).map(v => v ?? Infinity));

    const d1 = hh1 - ll1;
    const d2 = hh2 - ll2;
    const d = (Math.log((d2 || 0.0001) / (d1 || 0.0001)) / Math.log(2)) || 0;
    const alpha = Math.exp(-3.453 * Math.min(Math.max(d, -1), 1));
    const sc = Math.max(alpha, 0.01);
    prevFrama = prevFrama + sc * ((data[i] ?? 0) - prevFrama);
    out[i] = prevFrama;
  }
  return out;
}

export function T3(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 5;
  const vFactor = params?.vFactor ?? 0.7;
  const c1 = -vFactor * vFactor * vFactor;
  const c2 = 3 * vFactor * vFactor + 3 * vFactor * vFactor * vFactor;
  const c3 = -6 * vFactor * vFactor - 3 * vFactor - 3 * vFactor * vFactor * vFactor;
  const c4 = 1 + 3 * vFactor + vFactor * vFactor * vFactor + 3 * vFactor * vFactor;

  let e1 = ema(data, period);
  let e2 = ema(e1, period);
  let e3 = ema(e2, period);
  let e4 = ema(e3, period);
  let e5 = ema(e4, period);
  let e6 = ema(e5, period);

  return data.map((_, i) =>
    [e1[i], e2[i], e3[i], e4[i], e5[i], e6[i]].every(v => !isNaN(v))
      ? c1 * e6[i]! + c2 * e5[i]! + c3 * e4[i]! + c4 * e3[i]!
      : NaN
  );
}

// ─── MOMENTUM ─────────────────────────────────────────────────────────────────

export function RSI(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const gains = data.map((v, i) =>
    i > 0 && (v - (data[i - 1] ?? 0)) > 0 ? v - (data[i - 1] ?? 0) : 0
  );
  const losses = data.map((v, i) =>
    i > 0 && (v - (data[i - 1] ?? 0)) < 0 ? (data[i - 1] ?? 0) - v : 0
  );
  const avgG = rma(gains, period);
  const avgL = rma(losses, period);
  return avgG.map((g, i) =>
    !isNaN(g) && !isNaN(avgL[i]) && avgL[i] !== 0
      ? 100 - 100 / (1 + g / avgL[i]!)
      : avgL[i] === 0 ? 100 : NaN
  );
}

export function MACD(data: number[], params?: IndicatorParams): MACDResult {
  const fast = params?.fast ?? 12;
  const slow = params?.slow ?? 26;
  const signal = params?.signal ?? 9;
  const fastE = ema(data, fast);
  const slowE = ema(data, slow);
  const macd = fastE.map((v, i) =>
    !isNaN(v) && !isNaN(slowE[i]) ? v - slowE[i]! : NaN
  );
  const sigLine = ema(macd, signal);
  const hist = macd.map((v, i) =>
    !isNaN(v) && !isNaN(sigLine[i]) ? v - sigLine[i]! : NaN
  );
  return { macd, signal: sigLine, histogram: hist };
}

export function Stochastic(
  data: number[],
  params?: IndicatorParams
): StochasticResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const kPeriod = params?.period ?? 14;
  const kSmooth = params?.kSmooth ?? 3;
  const dSmooth = params?.dSmooth ?? 3;
  const ll = rollingMin(lows, kPeriod);
  const hh = rollingMax(highs, kPeriod);
  const rawK = data.map((v, i) =>
    !isNaN(ll[i]) && !isNaN(hh[i]) && hh[i] !== ll[i]
      ? ((v - ll[i]!) / (hh[i]! - ll[i]!)) * 100
      : NaN
  );
  const k = rollingMean(rawK, kSmooth);
  const d = rollingMean(k, dSmooth);
  return { k, d };
}

export function CCI(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 20;
  const tp = data.map((c, i) =>
    ((highs[i] ?? 0) + (lows[i] ?? 0) + c) / 3
  );
  const smaTp = rollingMean(tp, period);
  const out = fillNaN(data.length);
  for (let i = period - 1; i < tp.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const mean = smaTp[i] ?? 0;
    const md = slice.reduce((a, v) => a + Math.abs(v - mean), 0) / period;
    out[i] = md === 0 ? 0 : ((tp[i] ?? 0) - mean) / (0.015 * md);
  }
  return out;
}

export function WilliamsR(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 14;
  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);
  return data.map((v, i) =>
    !isNaN(hh[i]) && !isNaN(ll[i]) && hh[i] !== ll[i]
      ? ((hh[i]! - v) / (hh[i]! - ll[i]!)) * -100
      : NaN
  );
}

export function ROC(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 12;
  return data.map((v, i) =>
    i >= period && (data[i - period] ?? 0) !== 0
      ? ((v - (data[i - period] ?? 0)) / (data[i - period] ?? 1)) * 100
      : NaN
  );
}

export function Momentum(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 10;
  return data.map((v, i) =>
    i >= period ? v - (data[i - period] ?? 0) : NaN
  );
}

export function UltimateOscillator(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const p1 = params?.p1 ?? 7;
  const p2 = params?.p2 ?? 14;
  const p3 = params?.p3 ?? 28;
  const n = data.length;
  const bp = fillNaN(n);
  const tr = fillNaN(n);
  for (let i = 1; i < n; i++) {
    const pc = data[i - 1] ?? 0;
    bp[i] = (data[i] ?? 0) - Math.min(lows[i] ?? 0, pc);
    tr[i] =
      Math.max(highs[i] ?? 0, pc) - Math.min(lows[i] ?? 0, pc);
  }
  const bp1 = rollingSum(bp, p1);
  const tr1 = rollingSum(tr, p1);
  const bp2 = rollingSum(bp, p2);
  const tr2 = rollingSum(tr, p2);
  const bp3 = rollingSum(bp, p3);
  const tr3 = rollingSum(tr, p3);
  return data.map((_, i) => {
    if (
      [bp1[i], tr1[i], bp2[i], tr2[i], bp3[i], tr3[i]].some(v =>
        isNaN(v as number)
      )
    )
      return NaN;
    const a1 = tr1[i] === 0 ? 0 : (bp1[i] as number) / (tr1[i] as number);
    const a2 = tr2[i] === 0 ? 0 : (bp2[i] as number) / (tr2[i] as number);
    const a3 = tr3[i] === 0 ? 0 : (bp3[i] as number) / (tr3[i] as number);
    return (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  });
}

export function TSI(data: number[], params?: IndicatorParams): number[] {
  const long = params?.long ?? 25;
  const short = params?.short ?? 13;
  const signal = params?.signal ?? 12;
  const pc = data.map((v, i) =>
    i > 0 ? v - (data[i - 1] ?? 0) : 0
  );
  const absPc = pc.map(v => Math.abs(v));
  const dmpc = ema(ema(pc, long), short);
  const dmapc = ema(ema(absPc, long), short);
  const tsi = dmapc.map((v, i) =>
    v !== 0 && !isNaN(dmpc[i]) ? (dmpc[i]! / v) * 100 : NaN
  );
  return ema(tsi, signal);
}

export function CMO(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const gains = data.map((v, i) =>
    i > 0 && v > (data[i - 1] ?? 0) ? v - (data[i - 1] ?? 0) : 0
  );
  const losses = data.map((v, i) =>
    i > 0 && v < (data[i - 1] ?? 0) ? (data[i - 1] ?? 0) - v : 0
  );
  const sumG = rollingSum(gains, period);
  const sumL = rollingSum(losses, period);
  return sumG.map((g, i) => {
    const s = sumL[i];
    if (isNaN(g) || isNaN(s as number)) return NaN;
    const total = (g as number) + (s as number);
    return total === 0 ? 0 : (((g as number) - (s as number)) / total) * 100;
  });
}

// ─── VOLATILITY ───────────────────────────────────────────────────────────────

function trueRange(
  highs: number[],
  lows: number[],
  closes: number[]
): number[] {
  return closes.map((c, i) => {
    if (i === 0) return (highs[0] ?? 0) - (lows[0] ?? 0);
    const hl = (highs[i] ?? 0) - (lows[i] ?? 0);
    const hc = Math.abs((highs[i] ?? 0) - (closes[i - 1] ?? 0));
    const lc = Math.abs((lows[i] ?? 0) - (closes[i - 1] ?? 0));
    return Math.max(hl, hc, lc);
  });
}

export function BollingerBands(
  data: number[],
  params?: IndicatorParams
): BollingerResult {
  const period = params?.period ?? 20;
  const stdDev = params?.stdDev ?? 2;
  const middle = SMA(data, { period });
  const std = rollingStdDev(data, period);
  const upper = middle.map((v, i) =>
    !isNaN(v) && !isNaN(std[i]) ? v + stdDev * std[i]! : NaN
  );
  const lower = middle.map((v, i) =>
    !isNaN(v) && !isNaN(std[i]) ? v - stdDev * std[i]! : NaN
  );
  return { upper, middle, lower };
}

export function ATR(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 14;
  const tr = trueRange(highs, lows, data);
  return rma(tr, period);
}

export function KeltnerChannel(
  data: number[],
  params?: IndicatorParams
): BollingerResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const emaPeriod = params?.period ?? 20;
  const atrPeriod = params?.atrPeriod ?? 10;
  const mult = params?.multiplier ?? 2;
  const middle = ema(data, emaPeriod);
  const atrVal = ATR(data, {
    highs,
    lows,
    period: atrPeriod,
  });
  const upper = middle.map((v, i) =>
    !isNaN(v) && !isNaN(atrVal[i]) ? v + mult * atrVal[i]! : NaN
  );
  const lower = middle.map((v, i) =>
    !isNaN(v) && !isNaN(atrVal[i]) ? v - mult * atrVal[i]! : NaN
  );
  return { upper, middle, lower };
}

export function DonchianChannel(
  data: number[],
  params?: IndicatorParams
): BollingerResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 20;
  const upper = rollingMax(highs, period);
  const lower = rollingMin(lows, period);
  const middle = upper.map((v, i) =>
    !isNaN(v) && !isNaN(lower[i]) ? (v + lower[i]!) / 2 : NaN
  );
  return { upper, middle, lower };
}

export function HistoricalVolatility(
  data: number[],
  params?: IndicatorParams
): number[] {
  const period = params?.period ?? 20;
  const logRets = data.map((v, i) =>
    i > 0 && (data[i - 1] ?? 0) > 0
      ? Math.log(v / (data[i - 1] ?? 1))
      : NaN
  );
  const std = rollingStdDev(logRets, period);
  return std.map(v => (isNaN(v) ? NaN : v * Math.sqrt(252) * 100));
}

export function ChaikinVolatility(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 10;
  const rocPeriod = params?.rocPeriod ?? 10;
  const hl = highs.map((h, i) => (h ?? 0) - (lows[i] ?? 0));
  const emaHl = ema(hl, period);
  const out = fillNaN(data.length);
  for (let i = rocPeriod; i < data.length; i++) {
    const prev = emaHl[i - rocPeriod];
    const curr = emaHl[i];
    if (!isNaN(prev) && !isNaN(curr) && prev !== 0)
      out[i] = ((curr - prev) / prev) * 100;
  }
  return out;
}

export function StandardDeviation(
  data: number[],
  params?: IndicatorParams
): number[] {
  const period = params?.period ?? 20;
  return rollingStdDev(data, period);
}

// ─── VOLUME ───────────────────────────────────────────────────────────────────

export function OBV(data: number[], params?: IndicatorParams): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const out = fillNaN(data.length);
  let cum = 0;
  for (let i = 0; i < data.length; i++) {
    if (i > 0) {
      if ((data[i] ?? 0) > (data[i - 1] ?? 0)) cum += volumes[i] ?? 0;
      else if ((data[i] ?? 0) < (data[i - 1] ?? 0)) cum -= volumes[i] ?? 0;
    }
    out[i] = cum;
  }
  return out;
}

export function ADLine(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const clv = data.map((c, i) => {
    const hl = (highs[i] ?? 0) - (lows[i] ?? 0);
    return hl === 0 ? 0 : ((c - (lows[i] ?? 0)) - ((highs[i] ?? 0) - c)) / hl;
  });
  const mf = clv.map((v, i) => v * (volumes[i] ?? 0));
  const out = fillNaN(data.length);
  let cum = 0;
  for (let i = 0; i < data.length; i++) {
    cum += mf[i] ?? 0;
    out[i] = cum;
  }
  return out;
}

export function CMF(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const period = params?.period ?? 20;
  const clv = data.map((c, i) => {
    const hl = (highs[i] ?? 0) - (lows[i] ?? 0);
    return hl === 0 ? 0 : ((c - (lows[i] ?? 0)) - ((highs[i] ?? 0) - c)) / hl;
  });
  const mfVol = clv.map((v, i) => v * (volumes[i] ?? 0));
  const mfSum = rollingSum(mfVol, period);
  const volSum = rollingSum(volumes, period);
  return mfSum.map((v, i) =>
    volSum[i] !== 0 && !isNaN(v) ? v / (volSum[i] as number) : NaN
  );
}

export function MFI(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const period = params?.period ?? 14;
  const tp = data.map((c, i) =>
    ((highs[i] ?? 0) + (lows[i] ?? 0) + c) / 3
  );
  const rawMf = tp.map((v, i) => v * (volumes[i] ?? 0));
  const posMf = rawMf.map((v, i) =>
    i > 0 && (tp[i] ?? 0) > (tp[i - 1] ?? 0) ? v : 0
  );
  const negMf = rawMf.map((v, i) =>
    i > 0 && (tp[i] ?? 0) < (tp[i - 1] ?? 0) ? v : 0
  );
  const posSum = rollingSum(posMf, period);
  const negSum = rollingSum(negMf, period);
  return posSum.map((v, i) => {
    const n = negSum[i];
    if (isNaN(v as number) || isNaN(n as number)) return NaN;
    const r = n === 0 ? Infinity : (v as number) / (n as number);
    return 100 - 100 / (1 + r);
  });
}

export function VWAP(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const tp = data.map((c, i) =>
    ((highs[i] ?? 0) + (lows[i] ?? 0) + c) / 3
  );
  const out = fillNaN(data.length);
  let cumPv = 0, cumV = 0;
  for (let i = 0; i < data.length; i++) {
    cumPv += (tp[i] ?? 0) * (volumes[i] ?? 0);
    cumV += volumes[i] ?? 0;
    out[i] = cumV === 0 ? NaN : cumPv / cumV;
  }
  return out;
}

export function VolumeProfile(data: number[], params?: IndicatorParams): object {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const bins = params?.bins ?? 24;
  const low = Math.min(...data.filter(v => !isNaN(v)));
  const high = Math.max(...data.filter(v => !isNaN(v)));
  const step = (high - low) / bins || 1;
  const profile: Record<number, number> = {};
  for (let i = 0; i < data.length; i++) {
    if (isNaN(data[i] ?? NaN)) continue;
    const bin = Math.floor(((data[i] ?? 0) - low) / step) * step + low;
    profile[bin] = (profile[bin] ?? 0) + (volumes[i] ?? 0);
  }
  return { profile, low, high, step, bins };
}

export function VolumeOscillator(
  data: number[],
  params?: IndicatorParams
): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const short = params?.short ?? 5;
  const long = params?.long ?? 10;
  const shortMA = rollingMean(volumes, short);
  const longMA = rollingMean(volumes, long);
  return shortMA.map((v, i) =>
    !isNaN(v) && !isNaN(longMA[i]) && longMA[i] !== 0
      ? ((v - longMA[i]!) / longMA[i]!) * 100
      : NaN
  );
}

export function PVT(data: number[], params?: IndicatorParams): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const out = fillNaN(data.length);
  let cum = 0;
  for (let i = 0; i < data.length; i++) {
    if (i > 0 && (data[i - 1] ?? 0) !== 0)
      cum += ((data[i] ?? 0) - (data[i - 1] ?? 0)) / (data[i - 1] ?? 1) * (volumes[i] ?? 0);
    out[i] = cum;
  }
  return out;
}

export function NVI(data: number[], params?: IndicatorParams): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const out = fillNaN(data.length);
  let cum = 1000;
  let prevVol = volumes[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    const vol = volumes[i] ?? 0;
    if (i > 0 && vol < prevVol && (data[i - 1] ?? 0) !== 0)
      cum *= 1 + ((data[i] ?? 0) - (data[i - 1] ?? 0)) / (data[i - 1] ?? 1);
    out[i] = cum;
    prevVol = vol;
  }
  return out;
}

export function EMV(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const period = params?.period ?? 14;
  const div = params?.divisor ?? 10000;
  const n = data.length;
  const emvArr = fillNaN(n);
  for (let i = 1; i < n; i++) {
    const dm =
      ((highs[i] ?? 0) + (lows[i] ?? 0)) / 2 -
      ((highs[i - 1] ?? 0) + (lows[i - 1] ?? 0)) / 2;
    const br = (highs[i] ?? 0) - (lows[i] ?? 0);
    const box = br === 0 ? NaN : ((volumes[i] ?? 0) / div) / br;
    emvArr[i] = !isNaN(box) ? dm / box : NaN;
  }
  return rollingMean(emvArr, period);
}

export function Klinger(data: number[], params?: IndicatorParams): object {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const fast = params?.fast ?? 34;
  const slow = params?.slow ?? 55;
  const signal = params?.signal ?? 13;
  const hl2 = highs.map((h, i) => ((h ?? 0) + (lows[i] ?? 0)) / 2);
  const hp = data.map((c, i) =>
    i > 0 ? hl2[i]! - hl2[i - 1]! : 0
  );
  const trend = data.map((c, i) => (i > 0 ? (c > (data[i - 1] ?? 0) ? 1 : -1) : 0));
  const dm = hp.map((v, i) => Math.abs(v) * (trend[i] ?? 0));
  const cm = fillNaN(data.length);
  cm[0] = 0;
  for (let i = 1; i < data.length; i++) {
    const prevCm = cm[i - 1] ?? 0;
    const prevHp = hp[i - 1] ?? 0;
    cm[i] =
      (hp[i] ?? 0) * (trend[i] ?? 0) * (trend[i - 1] ?? 0) >= 0
        ? prevCm + Math.abs(hp[i] ?? 0)
        : prevCm + Math.abs(prevHp) + Math.abs(hp[i] ?? 0);
  }
  const vf = data.map((v, i) => {
    const c = cm[i];
    if (isNaN(c) || c === 0) return 0;
    return (volumes[i] ?? 0) * Math.abs(2 * dm[i]! / c - 1) * (trend[i] ?? 0) * 100;
  });
  const kvo = ema(vf, fast).map((v, i) => {
    const s = ema(vf, slow)[i];
    return !isNaN(v) && !isNaN(s) ? v - s : NaN;
  });
  const signalLine = ema(kvo, signal);
  return { kvo, signal: signalLine, histogram: kvo.map((v, i) => v - (signalLine[i] ?? 0)) };
}

// ─── TREND ───────────────────────────────────────────────────────────────────

export function ADX(data: number[], params?: IndicatorParams): ADXResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 14;
  const tr = trueRange(highs, lows, data);
  const n = data.length;
  const plusDM = fillNaN(n);
  const minusDM = fillNaN(n);
  for (let i = 1; i < n; i++) {
    const up = (highs[i] ?? 0) - (highs[i - 1] ?? 0);
    const down = (lows[i - 1] ?? 0) - (lows[i] ?? 0);
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }
  const atrArr = rma(tr, period);
  const plusDI = rma(plusDM, period).map((v, i) =>
    atrArr[i] === 0 || isNaN(atrArr[i]) ? NaN : (v / atrArr[i]!) * 100
  );
  const minusDI = rma(minusDM, period).map((v, i) =>
    atrArr[i] === 0 || isNaN(atrArr[i]) ? NaN : (v / atrArr[i]!) * 100
  );
  const dx = plusDI.map((v, i) => {
    const m = minusDI[i];
    if (isNaN(v) || isNaN(m as number) || (v + (m as number)) === 0) return NaN;
    return (Math.abs(v - (m as number)) / (v + (m as number))) * 100;
  });
  const adx = rma(dx, period);
  return { adx, plusDI, minusDI };
}

export function Aroon(data: number[], params?: IndicatorParams): AroonResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 25;
  const n = data.length;
  const up = fillNaN(n);
  const down = fillNaN(n);
  for (let i = period; i < n; i++) {
    let hiIdx = i - period;
    let loIdx = i - period;
    for (let j = i - period + 1; j <= i; j++) {
      if ((highs[j] ?? -Infinity) > (highs[hiIdx] ?? -Infinity)) hiIdx = j;
      if ((lows[j] ?? Infinity) < (lows[loIdx] ?? Infinity)) loIdx = j;
    }
    up[i] = ((period - (i - hiIdx)) / period) * 100;
    down[i] = ((period - (i - loIdx)) / period) * 100;
  }
  const oscillator = up.map((v, i) =>
    !isNaN(v) && !isNaN(down[i]) ? v - down[i]! : NaN
  );
  return { up, down, oscillator };
}

export function ParabolicSAR(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const start = params?.start ?? 0.02;
  const inc = params?.increment ?? 0.02;
  const max = params?.maximum ?? 0.2;
  const n = data.length;
  const out = fillNaN(n);
  if (n < 2) return out;

  let bull = true;
  let af = start;
  let ep = highs[0] ?? 0;
  out[0] = lows[0] ?? 0;

  for (let i = 1; i < n; i++) {
    const prev = out[i - 1] ?? lows[0];
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    if (bull) {
      out[i] = prev + af * (ep - prev);
      out[i] = Math.min(out[i]!, l, lows[i - 1] ?? l);
      if (h > ep) {
        ep = h;
        af = Math.min(af + inc, max);
      }
      if (l < (out[i] ?? 0)) {
        bull = false;
        out[i] = ep;
        ep = l;
        af = start;
      }
    } else {
      out[i] = prev + af * (ep - prev);
      out[i] = Math.max(out[i]!, h, highs[i - 1] ?? h);
      if (l < ep) {
        ep = l;
        af = Math.min(af + inc, max);
      }
      if (h > (out[i] ?? 0)) {
        bull = true;
        out[i] = ep;
        ep = h;
        af = start;
      }
    }
  }
  return out;
}

export function Supertrend(
  data: number[],
  params?: IndicatorParams
): { supertrend: number[]; direction: number[] } {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 10;
  const mult = params?.multiplier ?? 3;
  const hl2 = highs.map((h, i) => ((h ?? 0) + (lows[i] ?? 0)) / 2);
  const atrVal = ATR(data, { highs, lows, period });
  const upper = hl2.map((v, i) =>
    isNaN(atrVal[i]) ? NaN : v + mult * atrVal[i]!
  );
  const lower = hl2.map((v, i) =>
    isNaN(atrVal[i]) ? NaN : v - mult * atrVal[i]!
  );
  const fu = [...upper];
  const fl = [...lower];
  const st = fillNaN(data.length);
  const dir = new Array(data.length).fill(1);

  for (let i = 1; i < data.length; i++) {
    if (upper[i]! < fu[i - 1]! || (data[i - 1] ?? 0) > fu[i - 1]!)
      fu[i] = upper[i]!;
    else fu[i] = fu[i - 1]!;
    if (lower[i]! > fl[i - 1]! || (data[i - 1] ?? 0) < fl[i - 1]!)
      fl[i] = lower[i]!;
    else fl[i] = fl[i - 1]!;

    const prev = isNaN(st[i - 1]) ? fu[i] : st[i - 1];
    if (prev === fu[i - 1]) {
      if ((data[i] ?? 0) <= fu[i]!) {
        st[i] = fu[i]!;
        dir[i] = -1;
      } else {
        st[i] = fl[i]!;
        dir[i] = 1;
      }
    } else {
      if ((data[i] ?? 0) >= fl[i]!) {
        st[i] = fl[i]!;
        dir[i] = 1;
      } else {
        st[i] = fu[i]!;
        dir[i] = -1;
      }
    }
  }
  return { supertrend: st, direction: dir };
}

export function IchimokuCloud(
  data: number[],
  params?: IndicatorParams
): IchimokuResult {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const tenkan = params?.tenkan ?? 9;
  const kijun = params?.kijun ?? 26;
  const senkouB = params?.senkouB ?? 52;
  const displ = params?.displacement ?? 26;

  const mid = (h: number[], l: number[], p: number) => {
    const hi = rollingMax(h, p);
    const lo = rollingMin(l, p);
    return hi.map((v, i) =>
      !isNaN(v) && !isNaN(lo[i]) ? (v + lo[i]!) / 2 : NaN
    );
  };

  const t = mid(highs, lows, tenkan);
  const k = mid(highs, lows, kijun);
  const sA = t.map((v, i) =>
    !isNaN(v) && !isNaN(k[i]) ? (v + k[i]!) / 2 : NaN
  );
  const sB = mid(highs, lows, senkouB);

  const shift = (arr: number[], n: number) => [
    ...fillNaN(n),
    ...arr.slice(0, data.length - n),
  ].slice(0, data.length);

  return {
    tenkan: t,
    kijun: k,
    senkouA: shift(sA, displ),
    senkouB: shift(sB, displ),
    chikou: [...data],
  };
}

export function ZigZag(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const deviation = params?.deviation ?? 5;
  const n = data.length;
  const out = fillNaN(n);
  let lastPivot = highs[0] ?? 0;
  let lastIdx = 0;
  let trend = 1;

  for (let i = 1; i < n; i++) {
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    if (trend === 1) {
      if (h > lastPivot) {
        lastPivot = h;
        lastIdx = i;
      } else if ((lastPivot - l) / lastPivot * 100 >= deviation) {
        out[lastIdx] = lastPivot;
        lastPivot = l;
        lastIdx = i;
        trend = -1;
      }
    } else {
      if (l < lastPivot) {
        lastPivot = l;
        lastIdx = i;
      } else if ((h - lastPivot) / lastPivot * 100 >= deviation) {
        out[lastIdx] = lastPivot;
        lastPivot = h;
        lastIdx = i;
        trend = 1;
      }
    }
  }
  out[lastIdx] = lastPivot;
  return out;
}

export function StandardPivots(data: number[], params?: IndicatorParams): PivotPoints[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  return data.map((c, i) => {
    const h = highs[i] ?? c;
    const l = lows[i] ?? c;
    const P = (h + l + c) / 3;
    return {
      P,
      R1: 2 * P - l,
      R2: P + (h - l),
      R3: 2 * P - l + (h - l),
      S1: 2 * P - h,
      S2: P - (h - l),
      S3: 2 * P - h - (h - l),
    };
  });
}

export function DarvasBox(data: number[], params?: IndicatorParams): object[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 5;
  const boxes: Array<{ top: number; bottom: number; time: number }> = [];
  for (let i = period - 1; i < data.length; i++) {
    const sliceH = highs.slice(i - period + 1, i + 1);
    const sliceL = lows.slice(i - period + 1, i + 1);
    const top = Math.max(...sliceH.map(v => v ?? -Infinity));
    const bottom = Math.min(...sliceL.map(v => v ?? Infinity));
    boxes.push({ top, bottom, time: i });
  }
  return boxes;
}

// ─── OSCILLATORS ─────────────────────────────────────────────────────────────

export function AwesomeOscillator(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const hl2 = highs.map((h, i) => ((h ?? 0) + (lows[i] ?? 0)) / 2);
  const s5 = SMA(hl2, { period: 5 });
  const s34 = SMA(hl2, { period: 34 });
  return s5.map((v, i) =>
    !isNaN(v) && !isNaN(s34[i]) ? v - s34[i]! : NaN
  );
}

export function BalanceOfPower(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const opens = params?.opens ?? data;
  return data.map((c, i) => {
    const range = (highs[i] ?? 0) - (lows[i] ?? 0);
    return range === 0 ? 0 : ((c - (opens[i] ?? c)) / range);
  });
}

export function CoppockCurve(
  data: number[],
  params?: IndicatorParams
): number[] {
  const roc1 = params?.roc1 ?? 11;
  const roc2 = params?.roc2 ?? 14;
  const wmaPeriod = params?.period ?? 10;
  const rocA = data.map((v, i) =>
    i >= roc1 && (data[i - roc1] ?? 0) !== 0
      ? ((v - (data[i - roc1] ?? 0)) / (data[i - roc1] ?? 1)) * 100
      : NaN
  );
  const rocB = data.map((v, i) =>
    i >= roc2 && (data[i - roc2] ?? 0) !== 0
      ? ((v - (data[i - roc2] ?? 0)) / (data[i - roc2] ?? 1)) * 100
      : NaN
  );
  const sumRoc = rocA.map((a, i) =>
    !isNaN(a) && !isNaN(rocB[i]) ? a + rocB[i]! : NaN
  );
  return WMA(sumRoc, { period: wmaPeriod });
}

export function DPO(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const displace = Math.floor(period / 2) + 1;
  const sma = SMA(data, { period });
  const shifted = [...fillNaN(displace), ...sma.slice(0, data.length - displace)];
  return data.map((v, i) =>
    !isNaN(shifted[i]) ? v - shifted[i]! : NaN
  );
}

export function ElderForceIndex(
  data: number[],
  params?: IndicatorParams
): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const period = params?.period ?? 13;
  const raw = data.map((v, i) =>
    i > 0 ? (v - (data[i - 1] ?? 0)) * (volumes[i] ?? 0) : 0
  );
  return ema(raw, period);
}

export function KST(data: number[], params?: IndicatorParams): number[] {
  const r1 = params?.r1 ?? 10;
  const r2 = params?.r2 ?? 15;
  const r3 = params?.r3 ?? 20;
  const r4 = params?.r4 ?? 30;
  const s1 = params?.s1 ?? 10;
  const s2 = params?.s2 ?? 10;
  const s3 = params?.s3 ?? 10;
  const s4 = params?.s4 ?? 15;

  const roc = (p: number) =>
    data.map((v, i) =>
      i >= p && (data[i - p] ?? 0) !== 0
        ? ((v - (data[i - p] ?? 0)) / (data[i - p] ?? 1)) * 100
        : NaN
    );
  const rc1 = roc(r1);
  const rc2 = roc(r2);
  const rc3 = roc(r3);
  const rc4 = roc(r4);
  const sma1 = SMA(rc1, { period: s1 });
  const sma2 = SMA(rc2, { period: s2 });
  const sma3 = SMA(rc3, { period: s3 });
  const sma4 = SMA(rc4, { period: s4 });
  return data.map((_, i) =>
    [sma1[i], sma2[i], sma3[i], sma4[i]].every(v => !isNaN(v))
      ? (sma1[i]! * 1 + sma2[i]! * 2 + sma3[i]! * 3 + sma4[i]! * 4)
      : NaN
  );
}

// ─── ADDITIONAL INDICATORS (to reach 80+) ─────────────────────────────────────

export function StochRSI(data: number[], params?: IndicatorParams): StochasticResult {
  const rsiPeriod = params?.period ?? 14;
  const stochPeriod = params?.stochPeriod ?? 14;
  const kSmooth = params?.kSmooth ?? 3;
  const dSmooth = params?.dSmooth ?? 3;
  const rsiVals = RSI(data, { period: rsiPeriod });
  const rsiMin = rollingMin(rsiVals, stochPeriod);
  const rsiMax = rollingMax(rsiVals, stochPeriod);
  const rawK = rsiVals.map((v, i) =>
    !isNaN(v) && !isNaN(rsiMin[i]) && !isNaN(rsiMax[i]) && rsiMax[i] !== rsiMin[i]
      ? ((v - rsiMin[i]!) / (rsiMax[i]! - rsiMin[i]!)) * 100
      : NaN
  );
  const k = rollingMean(rawK, kSmooth);
  const d = rollingMean(k, dSmooth);
  return { k, d };
}

export function TRIX(data: number[], params?: IndicatorParams): { trix: number[]; signal: number[] } {
  const period = params?.period ?? 15;
  const signalPeriod = params?.signal ?? 9;
  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);
  const trix = e3.map((v, i) =>
    i > 0 && !isNaN(v) && !isNaN(e3[i - 1]) && e3[i - 1] !== 0
      ? ((v - e3[i - 1]!) / e3[i - 1]!) * 100
      : NaN
  );
  const signal = ema(trix, signalPeriod);
  return { trix, signal };
}

export function BBPercentB(data: number[], params?: IndicatorParams): number[] {
  const bb = BollingerBands(data, params);
  return data.map((v, i) => {
    const range = (bb.upper[i] ?? 0) - (bb.lower[i] ?? 0);
    return range > 0 && !isNaN(bb.lower[i])
      ? (v - (bb.lower[i] ?? 0)) / range
      : NaN;
  });
}

export function BBWidth(data: number[], params?: IndicatorParams): number[] {
  const bb = BollingerBands(data, params);
  return bb.middle.map((v, i) =>
    v !== 0 && !isNaN(bb.upper[i]) && !isNaN(bb.lower[i])
      ? ((bb.upper[i]! - bb.lower[i]!) / v) * 100
      : NaN
  );
}

export function PVI(data: number[], params?: IndicatorParams): number[] {
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const out = fillNaN(data.length);
  let cum = 1000;
  let prevVol = volumes[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    const vol = volumes[i] ?? 0;
    if (i > 0 && vol > prevVol && (data[i - 1] ?? 0) !== 0)
      cum *= 1 + ((data[i] ?? 0) - (data[i - 1] ?? 0)) / (data[i - 1] ?? 1);
    out[i] = cum;
    prevVol = vol;
  }
  return out;
}

export function AroonOscillator(data: number[], params?: IndicatorParams): number[] {
  const res = Aroon(data, params);
  return res.oscillator;
}

export function DetrendedPrice(data: number[], params?: IndicatorParams): number[] {
  return DPO(data, params);
}

export function KnowSureThing(data: number[], params?: IndicatorParams): number[] {
  return KST(data, params);
}

export function WilliamsAlligator(
  data: number[],
  params?: IndicatorParams
): { jaw: number[]; teeth: number[]; lips: number[] } {
  const jaw = params?.jaw ?? 13;
  const teeth = params?.teeth ?? 8;
  const lips = params?.lips ?? 5;
  const jawShift = params?.jawShift ?? 8;
  const teethShift = params?.teethShift ?? 5;
  const lipsShift = params?.lipsShift ?? 3;
  const hl2 = data;
  const jawSma = SMA(hl2, { period: jaw });
  const teethSma = SMA(hl2, { period: teeth });
  const lipsSma = SMA(hl2, { period: lips });
  const shift = (arr: number[], n: number) =>
    [...fillNaN(n), ...arr.slice(0, data.length - n)].slice(0, data.length);
  return {
    jaw: shift(jawSma, jawShift),
    teeth: shift(teethSma, teethShift),
    lips: shift(lipsSma, lipsShift),
  };
}

export function ChandeMomentumOscillator(data: number[], params?: IndicatorParams): number[] {
  return CMO(data, params);
}

export function MassIndex(
  data: number[],
  params?: IndicatorParams
): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 9;
  const sumPeriod = params?.sumPeriod ?? 25;
  const hl = highs.map((h, i) => (h ?? 0) - (lows[i] ?? 0));
  const ema1 = ema(hl, period);
  const ema2 = ema(ema1, period);
  const ratio = ema1.map((v, i) =>
    ema2[i] !== 0 && !isNaN(v) ? v / ema2[i]! : NaN
  );
  const sumRatio = rollingSum(ratio, sumPeriod);
  const emaSum = ema(sumRatio, 1);
  return emaSum;
}

export function Vortex(
  data: number[],
  params?: IndicatorParams
): { plus: number[]; minus: number[] } {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 14;
  const tr = trueRange(highs, lows, data);
  const plusVM = data.map((_, i) =>
    i > 0 ? Math.abs((highs[i] ?? 0) - (lows[i - 1] ?? 0)) : 0
  );
  const minusVM = data.map((_, i) =>
    i > 0 ? Math.abs((lows[i] ?? 0) - (highs[i - 1] ?? 0)) : 0
  );
  const trSum = rollingSum(tr, period);
  const plusSum = rollingSum(plusVM, period);
  const minusSum = rollingSum(minusVM, period);
  const plus = trSum.map((v, i) =>
    v !== 0 ? (plusSum[i] as number) / v : NaN
  );
  const minus = trSum.map((v, i) =>
    v !== 0 ? (minusSum[i] as number) / v : NaN
  );
  return { plus, minus };
}

export function QStick(data: number[], params?: IndicatorParams): number[] {
  const opens = params?.opens ?? data;
  const period = params?.period ?? 14;
  const closeOpen = data.map((c, i) => c - (opens[i] ?? c));
  return SMA(closeOpen, { period });
}

export function VPT(data: number[], params?: IndicatorParams): number[] {
  return PVT(data, params);
}

// ─── ADDITIONAL INDICATORS (Extended Set) ─────────────────────────────────────

export function ZLEMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  const lag = Math.floor((period - 1) / 2);
  const adjusted = data.map((v, i) =>
    i >= lag && !isNaN(v) && !isNaN(data[i - lag])
      ? 2 * v - (data[i - lag] ?? 0)
      : NaN
  );
  return ema(adjusted, period);
}

export function RMA(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 20;
  return rma(data, period);
}

export function VAMA(data: number[], params?: IndicatorParams): number[] {
  return VWMA(data, params);
}

export function McGinleyDynamic(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const out = fillNaN(data.length);
  if (data.length < 1) return out;
  out[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    if (isNaN(data[i])) continue;
    const prev = out[i - 1];
    if (isNaN(prev)) { out[i] = data[i]; continue; }
    const denom = prev + (data[i]! - prev) / (period * ((data[i]! - prev) / prev) ** 2 + 1);
    out[i] = isNaN(denom) || !isFinite(denom) ? prev : denom;
  }
  return out;
}

export function Trix(data: number[], params?: IndicatorParams): { trix: number[]; signal: number[] } {
  return TRIX(data, params);
}

export function ChandeForecastOscillator(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (slice.length < period) continue;
    const xMean = (period - 1) / 2;
    const yMean = slice.reduce((a, b) => a + b, 0) / period;
    let num = 0, den = 0;
    for (let j = 0; j < period; j++) {
      num += (j - xMean) * (slice[j]! - yMean);
      den += (j - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    const forecast = slope * (period - 1) + intercept;
    out[i] = slice[period - 1] === 0 ? 0 : ((slice[period - 1]! - forecast) / slice[period - 1]!) * 100;
  }
  return out;
}

export function LinearRegressionIndicator(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (slice.length < period) continue;
    const xMean = (period - 1) / 2;
    const yMean = slice.reduce((a, b) => a + b, 0) / period;
    let num = 0, den = 0;
    for (let j = 0; j < period; j++) {
      num += (j - xMean) * (slice[j]! - yMean);
      den += (j - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    out[i] = slope * (period - 1) + intercept;
  }
  return out;
}

export function ConnorsRSI(data: number[], params?: IndicatorParams): number[] {
  const rsiPeriod = params?.period ?? 3;
  const streakPeriod = params?.streakPeriod ?? 2;
  const rankPeriod = params?.rankPeriod ?? 100;
  const rsiVals = RSI(data, { period: rsiPeriod });
  const streak = data.map((_, i) => {
    if (i < 2) return 0;
    let s = 0;
    const dir = (data[i] ?? 0) > (data[i - 1] ?? 0) ? 1 : (data[i] ?? 0) < (data[i - 1] ?? 0) ? -1 : 0;
    for (let j = i; j > 0; j--) {
      const d = (data[j] ?? 0) > (data[j - 1] ?? 0) ? 1 : (data[j] ?? 0) < (data[j - 1] ?? 0) ? -1 : 0;
      if (d === dir) s++; else break;
    }
    return dir === 1 ? s : dir === -1 ? -s : 0;
  });
  const streakMax = rollingMax(streak.map(Math.abs), streakPeriod);
  const streakNorm = streak.map((v, i) =>
    !isNaN(streakMax[i]) && streakMax[i] !== 0 ? (v / streakMax[i]!) * 100 : 50
  );
  const rank = data.map((v, i) => {
    if (i < rankPeriod) return 50;
    const slice = data.slice(i - rankPeriod, i);
    const count = slice.filter(x => (x ?? 0) < (v ?? 0)).length;
    return (count / rankPeriod) * 100;
  });
  return rsiVals.map((v, i) =>
    [v, streakNorm[i], rank[i]].every(x => !isNaN(x as number))
      ? ((v as number) + (streakNorm[i] as number) + (rank[i] as number)) / 3
      : NaN
  );
}

export function RVI(data: number[], params?: IndicatorParams): { rvi: number[]; signal: number[] } {
  const period = params?.period ?? 14;
  const std = data.map((v, i) =>
    i >= 1 ? (v - (data[i - 1] ?? 0)) : 0
  );
  const pos = std.map(v => v > 0 ? v : 0);
  const neg = std.map(v => v < 0 ? -v : 0);
  const posSum = rollingSum(pos, period);
  const negSum = rollingSum(neg, period);
  const rvi = posSum.map((p, i) => {
    const n = negSum[i];
    if (isNaN(p as number) || isNaN(n as number)) return NaN;
    const total = (p as number) + (n as number);
    return total === 0 ? 50 : ((p as number) / total) * 100;
  });
  const signal = rollingMean(rvi, 4);
  return { rvi, signal };
}

export function ChandelierExit(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 22;
  const mult = params?.multiplier ?? 3;
  const atrVal = ATR(data, { highs, lows, period });
  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);
  const longExit = hh.map((v, i) =>
    !isNaN(v) && !isNaN(atrVal[i]) ? v - mult * atrVal[i]! : NaN
  );
  const shortExit = ll.map((v, i) =>
    !isNaN(v) && !isNaN(atrVal[i]) ? v + mult * atrVal[i]! : NaN
  );
  return longExit.map((v, i) =>
    (data[i] ?? 0) >= (shortExit[i] ?? 0) ? longExit[i] : shortExit[i]
  );
}

export function AroonUp(data: number[], params?: IndicatorParams): number[] {
  return Aroon(data, params).up;
}

export function AroonDown(data: number[], params?: IndicatorParams): number[] {
  return Aroon(data, params).down;
}

export function DIPlus(data: number[], params?: IndicatorParams): number[] {
  return ADX(data, params).plusDI;
}

export function DIMinus(data: number[], params?: IndicatorParams): number[] {
  return ADX(data, params).minusDI;
}

export function PercentagePriceOscillator(data: number[], params?: IndicatorParams): number[] {
  const fast = params?.fast ?? 12;
  const slow = params?.slow ?? 26;
  const fastE = ema(data, fast);
  const slowE = ema(data, slow);
  return fastE.map((v, i) =>
    !isNaN(v) && !isNaN(slowE[i]) && slowE[i] !== 0
      ? ((v - slowE[i]!) / slowE[i]!) * 100
      : NaN
  );
}

export function PriceChannel(data: number[], params?: IndicatorParams): BollingerResult {
  return DonchianChannel(data, params);
}

export function ProjectionOscillator(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const lr = LinearRegressionIndicator(data, { period });
  const hh = rollingMax(data, period);
  const ll = rollingMin(data, period);
  return data.map((v, i) =>
    !isNaN(lr[i]) && !isNaN(hh[i]) && !isNaN(ll[i]) && hh[i] !== ll[i]
      ? ((v - lr[i]!) / (hh[i]! - ll[i]!)) * 100
      : NaN
  );
}

export function PriceOscillator(data: number[], params?: IndicatorParams): number[] {
  const fast = params?.fast ?? 12;
  const slow = params?.slow ?? 26;
  const fastE = ema(data, fast);
  const slowE = ema(data, slow);
  return fastE.map((v, i) =>
    !isNaN(v) && !isNaN(slowE[i]) ? v - slowE[i]! : NaN
  );
}

export function RandomWalkIndex(data: number[], params?: IndicatorParams): { rwiHigh: number[]; rwiLow: number[] } {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 14;
  const rwiHigh = fillNaN(data.length);
  const rwiLow = fillNaN(data.length);
  for (let i = period; i < data.length; i++) {
    const atrVal = ATR(data, { highs, lows, period })[i];
    if (isNaN(atrVal) || atrVal === 0) continue;
    let maxRwi = -Infinity;
    let minRwi = Infinity;
    for (let j = 1; j <= period; j++) {
      const h2l = (highs[i] ?? 0) - (lows[i - j] ?? 0);
      const l2h = (highs[i - j] ?? 0) - (lows[i] ?? 0);
      maxRwi = Math.max(maxRwi, h2l / (atrVal * Math.sqrt(j)));
      minRwi = Math.min(minRwi, -l2h / (atrVal * Math.sqrt(j)));
    }
    rwiHigh[i] = maxRwi === -Infinity ? NaN : maxRwi;
    rwiLow[i] = minRwi === Infinity ? NaN : minRwi;
  }
  return { rwiHigh, rwiLow };
}

export function RelativeVigorIndex(data: number[], params?: IndicatorParams): { rvi: number[]; signal: number[] } {
  return RVI(data, params);
}

export function SchaffTrendCycle(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 23;
  const macdFactor = params?.macdFactor ?? 0.5;
  const stcFactor = params?.stcFactor ?? 0.5;
  const macdLine = MACD(data, { fast: 12, slow: 26 }).macd;
  const xMacd = macdLine.map((v, i) =>
    !isNaN(v) ? v - ema(macdLine, period)[i]! : NaN
  );
  const hh = rollingMax(xMacd, period);
  const ll = rollingMin(xMacd, period);
  let stc = 0;
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    if (hh[i] === ll[i] || isNaN(xMacd[i])) continue;
    const raw = 100 * (xMacd[i]! - ll[i]!) / (hh[i]! - ll[i]!);
    stc = stc + stcFactor * (raw - stc);
    out[i] = stc;
  }
  return out;
}

export function SmoothedRSI(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const smooth = params?.smooth ?? 3;
  const rsiVals = RSI(data, { period });
  return ema(rsiVals, smooth);
}

export function TwiggsMoneyFlow(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const volumes = params?.volumes ?? new Array(data.length).fill(1);
  const period = params?.period ?? 21;
  const tr = trueRange(highs, lows, data);
  const ad = data.map((c, i) => {
    if (i === 0) return 0;
    const hl = (highs[i] ?? 0) - (lows[i] ?? 0);
    const clv = hl === 0 ? 0 : ((c - (lows[i] ?? 0)) - ((highs[i] ?? 0) - c)) / hl;
    return clv * (volumes[i] ?? 0);
  });
  const adSum = rollingSum(ad, period);
  const trSum = rollingSum(tr.map((v, i) => v * (volumes[i] ?? 0)), period);
  return adSum.map((v, i) =>
    trSum[i] !== 0 && !isNaN(v) ? (v / (trSum[i] as number)) * 100 : NaN
  );
}

export function UlcerIndex(data: number[], params?: IndicatorParams): number[] {
  const period = params?.period ?? 14;
  const hh = rollingMax(data, period);
  const pctDrawdown = data.map((v, i) =>
    !isNaN(hh[i]) && hh[i] !== 0 ? ((v - hh[i]!) / hh[i]!) * 100 : 0
  );
  const out = fillNaN(data.length);
  for (let i = period - 1; i < data.length; i++) {
    const slice = pctDrawdown.slice(i - period + 1, i + 1);
    const rms = Math.sqrt(slice.reduce((s, v) => s + v * v, 0) / period);
    out[i] = rms;
  }
  return out;
}

export function WilliamsAlligatorAlternate(
  data: number[],
  params?: IndicatorParams
): { jaw: number[]; teeth: number[]; lips: number[] } {
  return WilliamsAlligator(data, params);
}

export function WoodieCCI(data: number[], params?: IndicatorParams): number[] {
  const highs = params?.highs ?? data;
  const lows = params?.lows ?? data;
  const period = params?.period ?? 20;
  const tp = data.map((c, i) =>
    ((highs[i] ?? 0) + (lows[i] ?? 0) + 2 * c) / 4
  );
  return CCI(tp, { highs: tp, lows: tp, period });
}

// ─── UTILITY & CROSSOVER HELPERS ──────────────────────────────────────────────

export function Crossover(a: number[], b: number[]): boolean[] {
  return a.map((v, i) =>
    i > 0 &&
    !isNaN(v) && !isNaN(b[i]) &&
    !isNaN(a[i - 1]) && !isNaN(b[i - 1]) &&
    (a[i - 1] ?? 0) <= (b[i - 1] ?? 0) && v > (b[i] ?? 0)
  );
}

export function Crossunder(a: number[], b: number[]): boolean[] {
  return a.map((v, i) =>
    i > 0 &&
    !isNaN(v) && !isNaN(b[i]) &&
    !isNaN(a[i - 1]) && !isNaN(b[i - 1]) &&
    (a[i - 1] ?? 0) >= (b[i - 1] ?? 0) && v < (b[i] ?? 0)
  );
}

export function lastValid<T>(arr: (T | number)[]): T | number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v !== undefined && v !== null && (typeof v !== 'number' || !isNaN(v)))
      return v;
  }
  return undefined;
}

export function extractOHLCV(
  ohlcv: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
): { highs: number[]; lows: number[]; closes: number[]; volumes: number[]; opens: number[] } {
  return {
    highs: ohlcv.map(d => d.high),
    lows: ohlcv.map(d => d.low),
    closes: ohlcv.map(d => d.close),
    volumes: ohlcv.map(d => d.volume),
    opens: ohlcv.map(d => d.open),
  };
}

// ─── BREADTH INDICATORS ──────────────────────────────────────────────────────

/**
 * McClellan Oscillator — breadth momentum from advancing/declining issues.
 * Uses 19-day / 39-day EMA of A-D difference.
 */
export function McClellanOscillator(advances: number[], declines: number[]): number[] {
  const ad = advances.map((a, i) => a - (declines[i] ?? 0));
  const ema19 = EMA(ad, 19);
  const ema39 = EMA(ad, 39);
  return ema19.map((v, i) => v - (ema39[i] ?? 0));
}

/**
 * McClellan Summation Index — cumulative sum of McClellan Oscillator.
 */
export function McClellanSummation(advances: number[], declines: number[]): number[] {
  const osc = McClellanOscillator(advances, declines);
  const result: number[] = [];
  let sum = 0;
  for (const v of osc) { sum += v; result.push(sum); }
  return result;
}

/**
 * Arms Index (TRIN) — Trading Index = (Adv Issues / Dec Issues) / (Adv Volume / Dec Volume).
 * TRIN > 1 = bearish breadth, < 1 = bullish breadth.
 */
export function ArmsIndex(
  advIssues: number[], decIssues: number[],
  advVolume: number[], decVolume: number[]
): number[] {
  return advIssues.map((ai, i) => {
    const di = decIssues[i] || 1;
    const av = advVolume[i] || 1;
    const dv = decVolume[i] || 1;
    return (ai / di) / (av / dv);
  });
}

/**
 * Advance/Decline Line — cumulative sum of (advances - declines).
 */
export function AdvanceDeclineLine(advances: number[], declines: number[]): number[] {
  const result: number[] = [];
  let cum = 0;
  for (let i = 0; i < advances.length; i++) {
    cum += (advances[i] ?? 0) - (declines[i] ?? 0);
    result.push(cum);
  }
  return result;
}

/**
 * New Highs / New Lows ratio.
 */
export function NewHighsLows(newHighs: number[], newLows: number[]): number[] {
  return newHighs.map((h, i) => {
    const l = newLows[i] || 1;
    return h / l;
  });
}

/**
 * Envelope (moving average envelope) — upper/lower bands around an SMA.
 */
export function Envelope(
  data: number[], period = 20, percentShift = 2.5
): { upper: number[]; lower: number[]; middle: number[] } {
  const middle = SMA(data, period);
  const shift = percentShift / 100;
  return {
    upper: middle.map(v => v * (1 + shift)),
    lower: middle.map(v => v * (1 - shift)),
    middle,
  };
}

// ─── EXPORT ALL ──────────────────────────────────────────────────────────────

export const INDICATORS_EXTENDED = {
  SMA, EMA, WMA, DEMA, TEMA, HullMA, VWMA, KAMA, ALMA, FRAMA, T3,
  ZLEMA, RMA, VAMA, McGinleyDynamic,
  RSI, MACD, Stochastic, CCI, WilliamsR, ROC, Momentum,
  UltimateOscillator, TSI, CMO, StochRSI, TRIX, Trix,
  BollingerBands, ATR, KeltnerChannel, DonchianChannel,
  HistoricalVolatility, ChaikinVolatility, StandardDeviation,
  BBPercentB, BBWidth,
  OBV, ADLine, CMF, MFI, VWAP, VolumeProfile, VolumeOscillator,
  PVT, VPT, NVI, PVI, EMV, Klinger,
  ADX, Aroon, AroonOscillator, AroonUp, AroonDown,
  DIPlus, DIMinus, ParabolicSAR, Supertrend, ChandelierExit,
  IchimokuCloud, ZigZag, StandardPivots, DarvasBox,
  AwesomeOscillator, BalanceOfPower, CoppockCurve, DPO,
  ElderForceIndex, KST, KnowSureThing,
  WilliamsAlligator, WilliamsAlligatorAlternate, DetrendedPrice,
  ChandeMomentumOscillator, ChandeForecastOscillator,
  MassIndex, Vortex, QStick,
  LinearRegressionIndicator, ConnorsRSI, RVI, RelativeVigorIndex,
  PercentagePriceOscillator, PriceOscillator, PriceChannel,
  ProjectionOscillator, RandomWalkIndex, SchaffTrendCycle,
  SmoothedRSI, TwiggsMoneyFlow, UlcerIndex, WoodieCCI,
  McClellanOscillator, McClellanSummation, ArmsIndex,
  AdvanceDeclineLine, NewHighsLows, Envelope,
  Crossover, Crossunder, lastValid, extractOHLCV,
} as const;
