import { sma, ema, rma } from './movingAverages';

export interface OHLCVCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export interface StochRSIResult {
  k: number[];
  d: number[];
}

export interface TSIResult {
  tsi: number[];
  signal: number[];
}

export interface KSTResult {
  kst: number[];
  signal: number[];
}

const nanArray = (n: number): number[] => new Array(n).fill(NaN);

function validNumber(v: number): boolean {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

function rollingMax(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(arr[j]) && arr[j] > max) max = arr[j];
    }
    out[i] = max === -Infinity ? NaN : max;
  }
  return out;
}

function rollingMin(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(arr[j]) && arr[j] < min) min = arr[j];
    }
    out[i] = min === Infinity ? NaN : min;
  }
  return out;
}

function rollingSum(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += validNumber(arr[i]) ? arr[i] : 0;
    if (i >= period) {
      sum -= validNumber(arr[i - period]) ? arr[i - period] : 0;
    }
    if (i >= period - 1) out[i] = sum;
  }
  return out;
}

// ─── RSI (Relative Strength Index) ──────────────────────────────────────────

export function rsi(data: number[], period: number = 14): number[] {
  if (!data.length || period < 1) return [];
  const n = data.length;
  if (n < period + 1) return nanArray(n);

  const gains = nanArray(n);
  const losses = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(data[i]) || !validNumber(data[i - 1])) continue;
    const diff = data[i] - data[i - 1];
    gains[i] = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? -diff : 0;
  }

  const avgGains = rma(gains, period);
  const avgLosses = rma(losses, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (!validNumber(avgGains[i]) || !validNumber(avgLosses[i])) continue;
    if (avgLosses[i] === 0) {
      out[i] = avgGains[i] === 0 ? 50 : 100;
    } else {
      const rs = avgGains[i] / avgLosses[i];
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

// ─── MACD ───────────────────────────────────────────────────────────────────

export function macd(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (!data.length) return { macd: [], signal: [], histogram: [] };

  const fastEMA = ema(data, fastPeriod);
  const slowEMA = ema(data, slowPeriod);

  const macdLine = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (validNumber(fastEMA[i]) && validNumber(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  const signalLine = ema(macdLine, signalPeriod);

  const histogram = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (validNumber(macdLine[i]) && validNumber(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

// ─── Stochastic (%K, %D) ───────────────────────────────────────────────────

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): StochasticResult {
  const n = closes.length;
  if (!n) return { k: [], d: [] };

  const ll = rollingMin(lows, kPeriod);
  const hh = rollingMax(highs, kPeriod);

  const rawK = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(ll[i]) && validNumber(hh[i]) && hh[i] !== ll[i]) {
      rawK[i] = ((closes[i] - ll[i]) / (hh[i] - ll[i])) * 100;
    } else if (validNumber(ll[i]) && validNumber(hh[i]) && hh[i] === ll[i]) {
      rawK[i] = 50;
    }
  }

  const k = sma(rawK, kSmooth);
  const d = sma(k, dSmooth);

  return { k, d };
}

// ─── Stochastic RSI ─────────────────────────────────────────────────────────

export function stochasticRSI(
  data: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): StochRSIResult {
  if (!data.length) return { k: [], d: [] };

  const rsiValues = rsi(data, rsiPeriod);
  const rsiMin = rollingMin(rsiValues, stochPeriod);
  const rsiMax = rollingMax(rsiValues, stochPeriod);

  const rawK = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (
      validNumber(rsiValues[i]) && validNumber(rsiMin[i]) &&
      validNumber(rsiMax[i]) && rsiMax[i] !== rsiMin[i]
    ) {
      rawK[i] = ((rsiValues[i] - rsiMin[i]) / (rsiMax[i] - rsiMin[i])) * 100;
    }
  }

  const k = sma(rawK, kSmooth);
  const d = sma(k, dSmooth);

  return { k, d };
}

// ─── CCI (Commodity Channel Index) ──────────────────────────────────────────

export function cci(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): number[] {
  const n = closes.length;
  if (!n) return [];

  const tp = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i]) && validNumber(closes[i])) {
      tp[i] = (highs[i] + lows[i] + closes[i]) / 3;
    }
  }

  const tpSMA = sma(tp, period);
  const out = nanArray(n);

  for (let i = period - 1; i < n; i++) {
    if (!validNumber(tpSMA[i])) continue;

    let meanDev = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(tp[j])) {
        meanDev += Math.abs(tp[j] - tpSMA[i]);
        count++;
      }
    }

    if (count === period && meanDev > 0) {
      meanDev /= period;
      out[i] = (tp[i] - tpSMA[i]) / (0.015 * meanDev);
    } else if (count === period) {
      out[i] = 0;
    }
  }

  return out;
}

// ─── Williams %R ────────────────────────────────────────────────────────────

export function williamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const n = closes.length;
  if (!n) return [];

  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(hh[i]) && validNumber(ll[i]) && hh[i] !== ll[i] && validNumber(closes[i])) {
      out[i] = ((hh[i] - closes[i]) / (hh[i] - ll[i])) * -100;
    }
  }

  return out;
}

// ─── ROC (Rate of Change) ───────────────────────────────────────────────────

export function roc(data: number[], period: number = 12): number[] {
  if (!data.length) return [];

  const out = nanArray(data.length);
  for (let i = period; i < data.length; i++) {
    if (validNumber(data[i]) && validNumber(data[i - period]) && data[i - period] !== 0) {
      out[i] = ((data[i] - data[i - period]) / data[i - period]) * 100;
    }
  }

  return out;
}

// ─── Momentum ───────────────────────────────────────────────────────────────

export function momentum(data: number[], period: number = 10): number[] {
  if (!data.length) return [];

  const out = nanArray(data.length);
  for (let i = period; i < data.length; i++) {
    if (validNumber(data[i]) && validNumber(data[i - period])) {
      out[i] = data[i] - data[i - period];
    }
  }

  return out;
}

// ─── Ultimate Oscillator ────────────────────────────────────────────────────

export function ultimateOscillator(
  highs: number[],
  lows: number[],
  closes: number[],
  p1: number = 7,
  p2: number = 14,
  p3: number = 28
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const bp = nanArray(n);
  const tr = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) ||
        !validNumber(highs[i]) || !validNumber(lows[i])) continue;
    const prevClose = closes[i - 1];
    bp[i] = closes[i] - Math.min(lows[i], prevClose);
    tr[i] = Math.max(highs[i], prevClose) - Math.min(lows[i], prevClose);
  }

  const bpS1 = rollingSum(bp, p1), trS1 = rollingSum(tr, p1);
  const bpS2 = rollingSum(bp, p2), trS2 = rollingSum(tr, p2);
  const bpS3 = rollingSum(bp, p3), trS3 = rollingSum(tr, p3);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      !validNumber(bpS1[i]) || !validNumber(trS1[i]) ||
      !validNumber(bpS2[i]) || !validNumber(trS2[i]) ||
      !validNumber(bpS3[i]) || !validNumber(trS3[i])
    ) continue;

    const avg1 = trS1[i] === 0 ? 0 : bpS1[i] / trS1[i];
    const avg2 = trS2[i] === 0 ? 0 : bpS2[i] / trS2[i];
    const avg3 = trS3[i] === 0 ? 0 : bpS3[i] / trS3[i];

    out[i] = 100 * (4 * avg1 + 2 * avg2 + avg3) / 7;
  }

  return out;
}

// ─── TSI (True Strength Index) ──────────────────────────────────────────────

export function tsi(
  data: number[],
  longPeriod: number = 25,
  shortPeriod: number = 13,
  signalPeriod: number = 13
): TSIResult {
  if (!data.length) return { tsi: [], signal: [] };

  const n = data.length;
  const priceChange = nanArray(n);
  const absPriceChange = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (validNumber(data[i]) && validNumber(data[i - 1])) {
      priceChange[i] = data[i] - data[i - 1];
      absPriceChange[i] = Math.abs(data[i] - data[i - 1]);
    }
  }

  const pcSmooth1 = ema(priceChange, longPeriod);
  const pcSmooth2 = ema(pcSmooth1, shortPeriod);

  const apcSmooth1 = ema(absPriceChange, longPeriod);
  const apcSmooth2 = ema(apcSmooth1, shortPeriod);

  const tsiLine = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(pcSmooth2[i]) && validNumber(apcSmooth2[i]) && apcSmooth2[i] !== 0) {
      tsiLine[i] = (pcSmooth2[i] / apcSmooth2[i]) * 100;
    }
  }

  const signalLine = ema(tsiLine, signalPeriod);

  return { tsi: tsiLine, signal: signalLine };
}

// ─── CMO (Chande Momentum Oscillator) ───────────────────────────────────────

export function cmo(data: number[], period: number = 14): number[] {
  if (!data.length || data.length < period + 1) return nanArray(data.length);

  const n = data.length;
  const gains = nanArray(n);
  const losses = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(data[i]) || !validNumber(data[i - 1])) continue;
    const diff = data[i] - data[i - 1];
    gains[i] = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? -diff : 0;
  }

  const sumGains = rollingSum(gains, period);
  const sumLosses = rollingSum(losses, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (!validNumber(sumGains[i]) || !validNumber(sumLosses[i])) continue;
    const total = sumGains[i] + sumLosses[i];
    if (total === 0) {
      out[i] = 0;
    } else {
      out[i] = ((sumGains[i] - sumLosses[i]) / total) * 100;
    }
  }

  return out;
}

// ─── PPO (Percentage Price Oscillator) ──────────────────────────────────────

export function ppo(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { ppo: number[]; signal: number[]; histogram: number[] } {
  if (!data.length) return { ppo: [], signal: [], histogram: [] };

  const fastEMA = ema(data, fastPeriod);
  const slowEMA = ema(data, slowPeriod);

  const n = data.length;
  const ppoLine = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(fastEMA[i]) && validNumber(slowEMA[i]) && slowEMA[i] !== 0) {
      ppoLine[i] = ((fastEMA[i] - slowEMA[i]) / slowEMA[i]) * 100;
    }
  }

  const signalLine = ema(ppoLine, signalPeriod);
  const histogram = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(ppoLine[i]) && validNumber(signalLine[i])) {
      histogram[i] = ppoLine[i] - signalLine[i];
    }
  }

  return { ppo: ppoLine, signal: signalLine, histogram };
}

// ─── Aroon Oscillator ───────────────────────────────────────────────────────

export function aroonOscillator(
  highs: number[],
  lows: number[],
  period: number = 25
): { up: number[]; down: number[]; oscillator: number[] } {
  const n = highs.length;
  if (!n) return { up: [], down: [], oscillator: [] };

  const up = nanArray(n);
  const down = nanArray(n);
  const oscillator = nanArray(n);

  for (let i = period; i < n; i++) {
    let highIdx = 0;
    let lowIdx = 0;
    let highVal = -Infinity;
    let lowVal = Infinity;

    for (let j = 0; j <= period; j++) {
      const idx = i - period + j;
      if (validNumber(highs[idx]) && highs[idx] >= highVal) {
        highVal = highs[idx];
        highIdx = j;
      }
      if (validNumber(lows[idx]) && lows[idx] <= lowVal) {
        lowVal = lows[idx];
        lowIdx = j;
      }
    }

    up[i] = (highIdx / period) * 100;
    down[i] = (lowIdx / period) * 100;
    oscillator[i] = up[i] - down[i];
  }

  return { up, down, oscillator };
}

// ─── Coppock Curve ──────────────────────────────────────────────────────────

export function coppockCurve(
  data: number[],
  wmaLen: number = 10,
  longROC: number = 14,
  shortROC: number = 11
): number[] {
  if (!data.length) return [];

  const n = data.length;
  const longRoc = roc(data, longROC);
  const shortRoc = roc(data, shortROC);

  const combined = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(longRoc[i]) && validNumber(shortRoc[i])) {
      combined[i] = longRoc[i] + shortRoc[i];
    }
  }

  const weights: number[] = [];
  let wSum = 0;
  for (let i = 1; i <= wmaLen; i++) {
    weights.push(i);
    wSum += i;
  }

  const out = nanArray(n);
  for (let i = wmaLen - 1; i < n; i++) {
    let val = 0;
    let allValid = true;
    for (let j = 0; j < wmaLen; j++) {
      const idx = i - wmaLen + 1 + j;
      if (!validNumber(combined[idx])) { allValid = false; break; }
      val += combined[idx] * weights[j];
    }
    if (allValid) {
      out[i] = val / wSum;
    }
  }

  return out;
}

// ─── DPO (Detrended Price Oscillator) ───────────────────────────────────────

export function dpo(data: number[], period: number = 20): number[] {
  if (!data.length) return [];

  const n = data.length;
  const smaValues = sma(data, period);
  const shift = Math.floor(period / 2) + 1;

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    const smaIdx = i + shift;
    if (smaIdx < n && validNumber(data[i]) && validNumber(smaValues[smaIdx])) {
      out[i] = data[i] - smaValues[smaIdx];
    } else if (i >= shift && validNumber(data[i]) && validNumber(smaValues[i])) {
      out[i] = data[i] - smaValues[i - shift + period - 1 < n ? i : i];
    }
  }

  const result = nanArray(n);
  for (let i = shift + period - 1; i < n; i++) {
    if (validNumber(data[i - shift]) && validNumber(smaValues[i])) {
      result[i - shift] = data[i - shift] - smaValues[i];
    }
  }
  for (let i = 0; i < n; i++) {
    if (validNumber(result[i])) out[i] = result[i];
  }

  return out;
}

// ─── KST (Know Sure Thing) ─────────────────────────────────────────────────

export function kst(
  data: number[],
  roc1: number = 10, roc2: number = 15, roc3: number = 20, roc4: number = 30,
  sma1: number = 10, sma2: number = 10, sma3: number = 10, sma4: number = 15,
  signalPeriod: number = 9
): KSTResult {
  if (!data.length) return { kst: [], signal: [] };

  const n = data.length;

  const rocVals1 = roc(data, roc1);
  const rocVals2 = roc(data, roc2);
  const rocVals3 = roc(data, roc3);
  const rocVals4 = roc(data, roc4);

  const smoothed1 = smaFn(rocVals1, sma1);
  const smoothed2 = smaFn(rocVals2, sma2);
  const smoothed3 = smaFn(rocVals3, sma3);
  const smoothed4 = smaFn(rocVals4, sma4);

  const kstLine = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      validNumber(smoothed1[i]) && validNumber(smoothed2[i]) &&
      validNumber(smoothed3[i]) && validNumber(smoothed4[i])
    ) {
      kstLine[i] = smoothed1[i] * 1 + smoothed2[i] * 2 + smoothed3[i] * 3 + smoothed4[i] * 4;
    }
  }

  const signalLine = smaFn(kstLine, signalPeriod);

  return { kst: kstLine, signal: signalLine };
}

const smaFn = sma;

// ─── Elder Force Index ──────────────────────────────────────────────────────

export function elderForceIndex(
  closes: number[],
  volumes: number[],
  period: number = 13
): number[] {
  if (!closes.length) return [];

  const n = closes.length;
  const rawFI = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (validNumber(closes[i]) && validNumber(closes[i - 1]) && validNumber(volumes[i])) {
      rawFI[i] = (closes[i] - closes[i - 1]) * volumes[i];
    }
  }

  return ema(rawFI, period);
}

// ─── Balance of Power ───────────────────────────────────────────────────────

export function balanceOfPower(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  if (!closes.length) return [];

  const n = closes.length;
  const rawBOP = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (
      validNumber(opens[i]) && validNumber(highs[i]) &&
      validNumber(lows[i]) && validNumber(closes[i])
    ) {
      const range = highs[i] - lows[i];
      rawBOP[i] = range === 0 ? 0 : (closes[i] - opens[i]) / range;
    }
  }

  return sma(rawBOP, period);
}

// ─── Awesome Oscillator ─────────────────────────────────────────────────────

export function awesomeOscillator(
  highs: number[],
  lows: number[],
  fastPeriod: number = 5,
  slowPeriod: number = 34
): number[] {
  const n = highs.length;
  if (!n) return [];

  const hl2 = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      hl2[i] = (highs[i] + lows[i]) / 2;
    }
  }

  const fastSMA = sma(hl2, fastPeriod);
  const slowSMA = sma(hl2, slowPeriod);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(fastSMA[i]) && validNumber(slowSMA[i])) {
      out[i] = fastSMA[i] - slowSMA[i];
    }
  }

  return out;
}

// ─── TRIX ───────────────────────────────────────────────────────────────────

export function trix(
  data: number[],
  period: number = 18,
  signalPeriod: number = 9
): { trix: number[]; signal: number[] } {
  if (!data.length) return { trix: [], signal: [] };

  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);

  const n = data.length;
  const trixLine = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (validNumber(e3[i]) && validNumber(e3[i - 1]) && e3[i - 1] !== 0) {
      trixLine[i] = ((e3[i] - e3[i - 1]) / e3[i - 1]) * 100;
    }
  }

  const signalLine = ema(trixLine, signalPeriod);

  return { trix: trixLine, signal: signalLine };
}

// ─── Fisher Transform ───────────────────────────────────────────────────────

export function fisherTransform(
  highs: number[],
  lows: number[],
  period: number = 10
): { fisher: number[]; trigger: number[] } {
  const n = highs.length;
  if (!n) return { fisher: [], trigger: [] };

  const hl2 = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      hl2[i] = (highs[i] + lows[i]) / 2;
    }
  }

  const hh = rollingMax(hl2, period);
  const ll = rollingMin(hl2, period);

  const fisher = nanArray(n);
  const trigger = nanArray(n);
  let prevValue = 0;
  let prevFisher = 0;

  for (let i = period - 1; i < n; i++) {
    if (!validNumber(hh[i]) || !validNumber(ll[i]) || !validNumber(hl2[i])) continue;

    const range = hh[i] - ll[i];
    let value: number;
    if (range === 0) {
      value = 0;
    } else {
      value = 0.66 * ((hl2[i] - ll[i]) / range - 0.5) + 0.67 * prevValue;
    }
    value = Math.max(-0.999, Math.min(0.999, value));

    const fisherVal = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * prevFisher;

    trigger[i] = prevFisher;
    fisher[i] = fisherVal;

    prevValue = value;
    prevFisher = fisherVal;
  }

  return { fisher, trigger };
}

// ─── Connors RSI ────────────────────────────────────────────────────────────

export function connorsRSI(
  data: number[],
  rsiPeriod: number = 3,
  streakPeriod: number = 2,
  rocPeriod: number = 100
): number[] {
  if (!data.length) return [];

  const n = data.length;
  const rsiVals = rsi(data, rsiPeriod);

  const streaks = nanArray(n);
  let currentStreak = 0;
  for (let i = 1; i < n; i++) {
    if (!validNumber(data[i]) || !validNumber(data[i - 1])) {
      currentStreak = 0;
      continue;
    }
    if (data[i] > data[i - 1]) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
    } else if (data[i] < data[i - 1]) {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
    } else {
      currentStreak = 0;
    }
    streaks[i] = currentStreak;
  }

  const streakRSI = rsi(streaks, streakPeriod);

  const percentRank = nanArray(n);
  for (let i = rocPeriod; i < n; i++) {
    if (!validNumber(data[i]) || !validNumber(data[i - 1])) continue;
    const currentROC = data[i] - data[i - 1];
    let count = 0;
    let total = 0;
    for (let j = i - rocPeriod; j < i; j++) {
      if (!validNumber(data[j]) || !validNumber(data[j + 1])) continue;
      total++;
      if ((data[j + 1] - data[j]) <= currentROC) count++;
    }
    if (total > 0) {
      percentRank[i] = (count / total) * 100;
    }
  }

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(rsiVals[i]) && validNumber(streakRSI[i]) && validNumber(percentRank[i])) {
      out[i] = (rsiVals[i] + streakRSI[i] + percentRank[i]) / 3;
    }
  }

  return out;
}

// ─── Choppiness Index ───────────────────────────────────────────────────────

export function choppinessIndex(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const tr = nanArray(n);
  tr[0] = validNumber(highs[0]) && validNumber(lows[0]) ? highs[0] - lows[0] : NaN;
  for (let i = 1; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i]) || !validNumber(closes[i - 1])) continue;
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  const atrSum = rollingSum(tr, period);
  const hh = rollingMax(highs, period);
  const ll = rollingMin(lows, period);

  const out = nanArray(n);
  for (let i = period - 1; i < n; i++) {
    if (!validNumber(atrSum[i]) || !validNumber(hh[i]) || !validNumber(ll[i])) continue;
    const range = hh[i] - ll[i];
    if (range > 0 && atrSum[i] > 0) {
      out[i] = 100 * Math.log10(atrSum[i] / range) / Math.log10(period);
    }
  }

  return out;
}

// ─── Relative Vigor Index ───────────────────────────────────────────────────

export function relativeVigorIndex(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10
): { rvi: number[]; signal: number[] } {
  const n = closes.length;
  if (n < 4) return { rvi: nanArray(n), signal: nanArray(n) };

  const closeOpen = nanArray(n);
  const highLow = nanArray(n);

  for (let i = 3; i < n; i++) {
    if (
      validNumber(closes[i]) && validNumber(opens[i]) &&
      validNumber(closes[i - 1]) && validNumber(opens[i - 1]) &&
      validNumber(closes[i - 2]) && validNumber(opens[i - 2]) &&
      validNumber(closes[i - 3]) && validNumber(opens[i - 3])
    ) {
      closeOpen[i] = (
        (closes[i] - opens[i]) +
        2 * (closes[i - 1] - opens[i - 1]) +
        2 * (closes[i - 2] - opens[i - 2]) +
        (closes[i - 3] - opens[i - 3])
      ) / 6;
    }

    if (
      validNumber(highs[i]) && validNumber(lows[i]) &&
      validNumber(highs[i - 1]) && validNumber(lows[i - 1]) &&
      validNumber(highs[i - 2]) && validNumber(lows[i - 2]) &&
      validNumber(highs[i - 3]) && validNumber(lows[i - 3])
    ) {
      highLow[i] = (
        (highs[i] - lows[i]) +
        2 * (highs[i - 1] - lows[i - 1]) +
        2 * (highs[i - 2] - lows[i - 2]) +
        (highs[i - 3] - lows[i - 3])
      ) / 6;
    }
  }

  const coSum = rollingSum(closeOpen, period);
  const hlSum = rollingSum(highLow, period);

  const rviLine = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(coSum[i]) && validNumber(hlSum[i]) && hlSum[i] !== 0) {
      rviLine[i] = coSum[i] / hlSum[i];
    }
  }

  const signal = nanArray(n);
  for (let i = 3; i < n; i++) {
    if (
      validNumber(rviLine[i]) && validNumber(rviLine[i - 1]) &&
      validNumber(rviLine[i - 2]) && validNumber(rviLine[i - 3])
    ) {
      signal[i] = (rviLine[i] + 2 * rviLine[i - 1] + 2 * rviLine[i - 2] + rviLine[i - 3]) / 6;
    }
  }

  return { rvi: rviLine, signal };
}
