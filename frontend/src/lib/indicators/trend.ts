import { sma, ema, rma } from './movingAverages';
import { atr, trueRange } from './volatility';

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

// ─── ADX / DI+ / DI- (Directional Movement System) ─────────────────────────

export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  dx: number[];
}

export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXResult {
  const n = closes.length;
  if (!n) return { adx: [], plusDI: [], minusDI: [], dx: [] };

  const tr = trueRange(highs, lows, closes);

  const plusDM = nanArray(n);
  const minusDM = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(highs[i - 1]) ||
        !validNumber(lows[i]) || !validNumber(lows[i - 1])) continue;

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  const smoothTR = rma(tr, period);
  const smoothPlusDM = rma(plusDM, period);
  const smoothMinusDM = rma(minusDM, period);

  const plusDI = nanArray(n);
  const minusDI = nanArray(n);
  const dx = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (!validNumber(smoothTR[i]) || smoothTR[i] === 0) continue;

    if (validNumber(smoothPlusDM[i])) {
      plusDI[i] = (smoothPlusDM[i] / smoothTR[i]) * 100;
    }
    if (validNumber(smoothMinusDM[i])) {
      minusDI[i] = (smoothMinusDM[i] / smoothTR[i]) * 100;
    }

    if (validNumber(plusDI[i]) && validNumber(minusDI[i])) {
      const sum = plusDI[i] + minusDI[i];
      dx[i] = sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
    }
  }

  const adxLine = rma(dx, period);

  return { adx: adxLine, plusDI, minusDI, dx };
}

// ─── Aroon Up/Down ──────────────────────────────────────────────────────────

export interface AroonResult {
  up: number[];
  down: number[];
  oscillator: number[];
}

export function aroon(
  highs: number[],
  lows: number[],
  period: number = 25
): AroonResult {
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

// ─── Parabolic SAR ──────────────────────────────────────────────────────────

export function parabolicSAR(
  highs: number[],
  lows: number[],
  start: number = 0.02,
  increment: number = 0.02,
  maximum: number = 0.2
): { sar: number[]; direction: number[] } {
  const n = highs.length;
  if (n < 2) return { sar: nanArray(n), direction: nanArray(n) };

  const sar = nanArray(n);
  const direction = new Array(n).fill(0);

  let isLong = true;
  let af = start;
  let ep = highs[0];
  let sarValue = lows[0];

  sar[0] = sarValue;
  direction[0] = 1;

  for (let i = 1; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i])) {
      sar[i] = sarValue;
      direction[i] = isLong ? 1 : -1;
      continue;
    }

    let newSAR = sarValue + af * (ep - sarValue);

    if (isLong) {
      newSAR = Math.min(newSAR, lows[i - 1]);
      if (i >= 2 && validNumber(lows[i - 2])) {
        newSAR = Math.min(newSAR, lows[i - 2]);
      }

      if (highs[i] > ep) {
        ep = highs[i];
        af = Math.min(af + increment, maximum);
      }

      if (lows[i] < newSAR) {
        isLong = false;
        newSAR = ep;
        ep = lows[i];
        af = start;
      }
    } else {
      newSAR = Math.max(newSAR, highs[i - 1]);
      if (i >= 2 && validNumber(highs[i - 2])) {
        newSAR = Math.max(newSAR, highs[i - 2]);
      }

      if (lows[i] < ep) {
        ep = lows[i];
        af = Math.min(af + increment, maximum);
      }

      if (highs[i] > newSAR) {
        isLong = true;
        newSAR = ep;
        ep = highs[i];
        af = start;
      }
    }

    sarValue = newSAR;
    sar[i] = sarValue;
    direction[i] = isLong ? 1 : -1;
  }

  return { sar, direction };
}

// ─── Supertrend ─────────────────────────────────────────────────────────────

export interface SupertrendResult {
  supertrend: number[];
  direction: number[];
  upperBand: number[];
  lowerBand: number[];
}

export function supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3.0
): SupertrendResult {
  const n = closes.length;
  if (!n) return { supertrend: [], direction: [], upperBand: [], lowerBand: [] };

  const hl2 = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      hl2[i] = (highs[i] + lows[i]) / 2;
    }
  }

  const atrVals = atr(highs, lows, closes, period);

  const upperBandRaw = nanArray(n);
  const lowerBandRaw = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(hl2[i]) && validNumber(atrVals[i])) {
      upperBandRaw[i] = hl2[i] + multiplier * atrVals[i];
      lowerBandRaw[i] = hl2[i] - multiplier * atrVals[i];
    }
  }

  const finalUpper = [...upperBandRaw];
  const finalLower = [...lowerBandRaw];
  const st = nanArray(n);
  const dir = new Array(n).fill(1);

  for (let i = 1; i < n; i++) {
    if (!validNumber(upperBandRaw[i])) continue;

    if (validNumber(finalUpper[i - 1]) && validNumber(closes[i - 1])) {
      finalUpper[i] = (upperBandRaw[i] < finalUpper[i - 1] || closes[i - 1] > finalUpper[i - 1])
        ? upperBandRaw[i] : finalUpper[i - 1];
    }

    if (validNumber(finalLower[i - 1]) && validNumber(closes[i - 1])) {
      finalLower[i] = (lowerBandRaw[i] > finalLower[i - 1] || closes[i - 1] < finalLower[i - 1])
        ? lowerBandRaw[i] : finalLower[i - 1];
    }

    const prevST = validNumber(st[i - 1]) ? st[i - 1] : finalUpper[i];

    if (validNumber(finalUpper[i - 1]) && prevST === finalUpper[i - 1]) {
      if (validNumber(closes[i]) && closes[i] <= finalUpper[i]) {
        st[i] = finalUpper[i];
        dir[i] = -1;
      } else {
        st[i] = finalLower[i];
        dir[i] = 1;
      }
    } else {
      if (validNumber(closes[i]) && closes[i] >= finalLower[i]) {
        st[i] = finalLower[i];
        dir[i] = 1;
      } else {
        st[i] = finalUpper[i];
        dir[i] = -1;
      }
    }
  }

  return { supertrend: st, direction: dir, upperBand: finalUpper, lowerBand: finalLower };
}

// ─── Ichimoku Cloud ─────────────────────────────────────────────────────────

export interface IchimokuResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
}

export function ichimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
  displacement: number = 26
): IchimokuResult {
  const n = highs.length;
  if (!n) return { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] };

  const midpoint = (h: number[], l: number[], p: number) => {
    const hi = rollingMax(h, p);
    const lo = rollingMin(l, p);
    const out = nanArray(h.length);
    for (let i = 0; i < h.length; i++) {
      if (validNumber(hi[i]) && validNumber(lo[i])) {
        out[i] = (hi[i] + lo[i]) / 2;
      }
    }
    return out;
  };

  const tenkan = midpoint(highs, lows, tenkanPeriod);
  const kijun = midpoint(highs, lows, kijunPeriod);

  const rawSenkouA = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(tenkan[i]) && validNumber(kijun[i])) {
      rawSenkouA[i] = (tenkan[i] + kijun[i]) / 2;
    }
  }

  const rawSenkouB = midpoint(highs, lows, senkouBPeriod);

  const senkouA = nanArray(n + displacement);
  const senkouB = nanArray(n + displacement);

  for (let i = 0; i < n; i++) {
    if (i + displacement < n + displacement) {
      senkouA[i + displacement] = rawSenkouA[i];
      senkouB[i + displacement] = rawSenkouB[i];
    }
  }

  const senkouATrimmed = senkouA.slice(0, n);
  const senkouBTrimmed = senkouB.slice(0, n);

  const chikou = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (i + displacement < n && validNumber(closes[i])) {
      chikou[i] = closes[i];
    }
  }

  return {
    tenkan,
    kijun,
    senkouA: senkouATrimmed,
    senkouB: senkouBTrimmed,
    chikou
  };
}

// ─── ZigZag ─────────────────────────────────────────────────────────────────

export interface ZigZagPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

export function zigzag(
  highs: number[],
  lows: number[],
  deviation: number = 5.0
): { line: number[]; pivots: ZigZagPoint[] } {
  const n = highs.length;
  const line = nanArray(n);
  const pivots: ZigZagPoint[] = [];

  if (n < 2) return { line, pivots };

  let lastPivotPrice = highs[0];
  let lastPivotIdx = 0;
  let trend = 1;

  for (let i = 1; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i])) continue;

    if (trend === 1) {
      if (highs[i] > lastPivotPrice) {
        lastPivotPrice = highs[i];
        lastPivotIdx = i;
      } else if (lastPivotPrice > 0 && ((lastPivotPrice - lows[i]) / lastPivotPrice) * 100 >= deviation) {
        line[lastPivotIdx] = lastPivotPrice;
        pivots.push({ index: lastPivotIdx, price: lastPivotPrice, type: 'high' });
        lastPivotPrice = lows[i];
        lastPivotIdx = i;
        trend = -1;
      }
    } else {
      if (lows[i] < lastPivotPrice) {
        lastPivotPrice = lows[i];
        lastPivotIdx = i;
      } else if (lastPivotPrice > 0 && ((highs[i] - lastPivotPrice) / lastPivotPrice) * 100 >= deviation) {
        line[lastPivotIdx] = lastPivotPrice;
        pivots.push({ index: lastPivotIdx, price: lastPivotPrice, type: 'low' });
        lastPivotPrice = highs[i];
        lastPivotIdx = i;
        trend = 1;
      }
    }
  }

  line[lastPivotIdx] = lastPivotPrice;
  pivots.push({
    index: lastPivotIdx,
    price: lastPivotPrice,
    type: trend === 1 ? 'high' : 'low'
  });

  if (pivots.length >= 2) {
    for (let p = 0; p < pivots.length - 1; p++) {
      const startIdx = pivots[p].index;
      const endIdx = pivots[p + 1].index;
      const startPrice = pivots[p].price;
      const endPrice = pivots[p + 1].price;
      const steps = endIdx - startIdx;
      if (steps <= 0) continue;
      for (let j = startIdx; j <= endIdx; j++) {
        line[j] = startPrice + ((endPrice - startPrice) * (j - startIdx)) / steps;
      }
    }
  }

  return { line, pivots };
}

// ─── Pivot Points ───────────────────────────────────────────────────────────

export interface PivotPointsResult {
  p: number;
  r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
}

export function standardPivots(high: number, low: number, close: number): PivotPointsResult {
  const p = (high + low + close) / 3;
  return {
    p,
    r1: 2 * p - low,
    r2: p + (high - low),
    r3: high + 2 * (p - low),
    s1: 2 * p - high,
    s2: p - (high - low),
    s3: low - 2 * (high - p)
  };
}

export function fibonacciPivots(high: number, low: number, close: number): PivotPointsResult {
  const p = (high + low + close) / 3;
  const hl = high - low;
  return {
    p,
    r1: p + 0.382 * hl,
    r2: p + 0.618 * hl,
    r3: p + 1.000 * hl,
    s1: p - 0.382 * hl,
    s2: p - 0.618 * hl,
    s3: p - 1.000 * hl
  };
}

export function woodiePivots(high: number, low: number, close: number): PivotPointsResult {
  const p = (high + low + 2 * close) / 4;
  return {
    p,
    r1: 2 * p - low,
    r2: p + (high - low),
    r3: high + 2 * (p - low),
    s1: 2 * p - high,
    s2: p - (high - low),
    s3: low - 2 * (high - p)
  };
}

export interface CamarillaPivotResult {
  p: number;
  r1: number; r2: number; r3: number; r4: number;
  s1: number; s2: number; s3: number; s4: number;
}

export function camarillaPivots(high: number, low: number, close: number): CamarillaPivotResult {
  const hl = high - low;
  return {
    p: (high + low + close) / 3,
    r1: close + hl * 1.1 / 12,
    r2: close + hl * 1.1 / 6,
    r3: close + hl * 1.1 / 4,
    r4: close + hl * 1.1 / 2,
    s1: close - hl * 1.1 / 12,
    s2: close - hl * 1.1 / 6,
    s3: close - hl * 1.1 / 4,
    s4: close - hl * 1.1 / 2
  };
}

export interface DeMarkPivotResult {
  p: number;
  r1: number;
  s1: number;
}

export function demarkPivots(open: number, high: number, low: number, close: number): DeMarkPivotResult {
  let x: number;
  if (close < open) {
    x = high + 2 * low + close;
  } else if (close > open) {
    x = 2 * high + low + close;
  } else {
    x = high + low + 2 * close;
  }

  const p = x / 4;
  return {
    p,
    r1: x / 2 - low,
    s1: x / 2 - high
  };
}

// ─── Vortex Indicator ───────────────────────────────────────────────────────

export interface VortexResult {
  plusVI: number[];
  minusVI: number[];
}

export function vortexIndicator(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): VortexResult {
  const n = closes.length;
  if (n < 2) return { plusVI: nanArray(n), minusVI: nanArray(n) };

  const plusVM = nanArray(n);
  const minusVM = nanArray(n);
  const tr = trueRange(highs, lows, closes);

  for (let i = 1; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i]) ||
        !validNumber(highs[i - 1]) || !validNumber(lows[i - 1])) continue;

    plusVM[i] = Math.abs(highs[i] - lows[i - 1]);
    minusVM[i] = Math.abs(lows[i] - highs[i - 1]);
  }

  const plusVI = nanArray(n);
  const minusVI = nanArray(n);

  for (let i = period; i < n; i++) {
    let sumPVM = 0, sumNVM = 0, sumTR = 0;
    let allValid = true;

    for (let j = i - period + 1; j <= i; j++) {
      if (!validNumber(plusVM[j]) || !validNumber(minusVM[j]) || !validNumber(tr[j])) {
        allValid = false;
        break;
      }
      sumPVM += plusVM[j];
      sumNVM += minusVM[j];
      sumTR += tr[j];
    }

    if (allValid && sumTR > 0) {
      plusVI[i] = sumPVM / sumTR;
      minusVI[i] = sumNVM / sumTR;
    }
  }

  return { plusVI, minusVI };
}

// ─── TTM Squeeze ────────────────────────────────────────────────────────────

export interface TTMSqueezeResult {
  momentum: number[];
  squeezeOn: boolean[];
  squeezeOff: boolean[];
}

export function ttmSqueeze(
  highs: number[],
  lows: number[],
  closes: number[],
  bbPeriod: number = 20,
  bbMult: number = 2.0,
  kcPeriod: number = 20,
  kcMult: number = 1.5
): TTMSqueezeResult {
  const n = closes.length;
  if (!n) return { momentum: [], squeezeOn: [], squeezeOff: [] };

  const bbMiddle = sma(closes, bbPeriod);
  const bbStd = rollingStdDev(closes, bbPeriod);
  const kcMiddle = ema(closes, kcPeriod);
  const atrVals = atr(highs, lows, closes, kcPeriod);

  const bbUpper = nanArray(n);
  const bbLower = nanArray(n);
  const kcUpper = nanArray(n);
  const kcLower = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(bbMiddle[i]) && validNumber(bbStd[i])) {
      bbUpper[i] = bbMiddle[i] + bbMult * bbStd[i];
      bbLower[i] = bbMiddle[i] - bbMult * bbStd[i];
    }
    if (validNumber(kcMiddle[i]) && validNumber(atrVals[i])) {
      kcUpper[i] = kcMiddle[i] + kcMult * atrVals[i];
      kcLower[i] = kcMiddle[i] - kcMult * atrVals[i];
    }
  }

  const squeezeOn: boolean[] = new Array(n).fill(false);
  const squeezeOff: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (
      validNumber(bbLower[i]) && validNumber(kcLower[i]) &&
      validNumber(bbUpper[i]) && validNumber(kcUpper[i])
    ) {
      squeezeOn[i] = bbLower[i] > kcLower[i] && bbUpper[i] < kcUpper[i];
      squeezeOff[i] = !squeezeOn[i];
    }
  }

  const hh = rollingMax(highs, kcPeriod);
  const ll = rollingMin(lows, kcPeriod);

  const mom = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      validNumber(closes[i]) && validNumber(hh[i]) && validNumber(ll[i]) && validNumber(kcMiddle[i])
    ) {
      const midHL = (hh[i] + ll[i]) / 2;
      const midMid = (midHL + kcMiddle[i]) / 2;
      mom[i] = closes[i] - midMid;
    }
  }

  const linRegMom = linearRegressionOnArray(mom, kcPeriod);

  return { momentum: linRegMom, squeezeOn, squeezeOff };
}

function rollingStdDev(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let sum = 0, count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(arr[j])) { sum += arr[j]; count++; }
    }
    if (count < period) continue;
    const mean = sum / count;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(arr[j])) variance += (arr[j] - mean) ** 2;
    }
    out[i] = Math.sqrt(variance / count);
  }
  return out;
}

function linearRegressionOnArray(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    const window: number[] = [];
    for (let j = i - period + 1; j <= i; j++) {
      window.push(validNumber(arr[j]) ? arr[j] : 0);
    }
    const n = window.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < n; j++) {
      sumX += j;
      sumY += window[j];
      sumXY += j * window[j];
      sumX2 += j * j;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) continue;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    out[i] = slope * (n - 1) + intercept;
  }
  return out;
}

// ─── Linear Regression Channel ──────────────────────────────────────────────

export interface LinearRegressionChannelResult {
  middle: number[];
  upper: number[];
  lower: number[];
  slope: number[];
  rSquared: number[];
}

export function linearRegressionChannel(
  data: number[],
  period: number = 100,
  stdDevMultiplier: number = 2.0
): LinearRegressionChannelResult {
  const n = data.length;
  if (!n) return { middle: [], upper: [], lower: [], slope: [], rSquared: [] };

  const middle = nanArray(n);
  const upper = nanArray(n);
  const lower = nanArray(n);
  const slopeArr = nanArray(n);
  const rSquared = nanArray(n);

  for (let i = period - 1; i < n; i++) {
    const window: number[] = [];
    let allValid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (!validNumber(data[j])) { allValid = false; break; }
      window.push(data[j]);
    }
    if (!allValid) continue;

    const len = window.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let j = 0; j < len; j++) {
      sumX += j;
      sumY += window[j];
      sumXY += j * window[j];
      sumX2 += j * j;
    }

    const denom = len * sumX2 - sumX * sumX;
    if (denom === 0) continue;

    const slope = (len * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / len;

    const regValue = slope * (len - 1) + intercept;
    middle[i] = regValue;
    slopeArr[i] = slope;

    let ssRes = 0, ssTot = 0;
    const yMean = sumY / len;
    let stdDevSum = 0;

    for (let j = 0; j < len; j++) {
      const predicted = slope * j + intercept;
      const residual = window[j] - predicted;
      ssRes += residual ** 2;
      ssTot += (window[j] - yMean) ** 2;
      stdDevSum += residual ** 2;
    }

    rSquared[i] = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    const channelStdDev = Math.sqrt(stdDevSum / len);
    upper[i] = regValue + stdDevMultiplier * channelStdDev;
    lower[i] = regValue - stdDevMultiplier * channelStdDev;
  }

  return { middle, upper, lower, slope: slopeArr, rSquared };
}

// ─── Darvas Box ─────────────────────────────────────────────────────────────

export interface DarvasBoxResult {
  top: number[];
  bottom: number[];
  breakout: boolean[];
  breakdown: boolean[];
}

export function darvasBox(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 5
): DarvasBoxResult {
  const n = closes.length;
  if (!n) return { top: [], bottom: [], breakout: [], breakdown: [] };

  const top = nanArray(n);
  const bottom = nanArray(n);
  const breakout = new Array(n).fill(false);
  const breakdown = new Array(n).fill(false);

  let boxTop = NaN;
  let boxBottom = NaN;
  let highestHigh = -Infinity;
  let highestIdx = 0;
  let confirmCount = 0;
  let boxFormed = false;
  let findingBottom = false;
  let lowestLow = Infinity;
  let bottomConfirmCount = 0;

  for (let i = 0; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i]) || !validNumber(closes[i])) continue;

    if (!boxFormed) {
      if (!findingBottom) {
        if (highs[i] > highestHigh) {
          highestHigh = highs[i];
          highestIdx = i;
          confirmCount = 0;
        } else {
          confirmCount++;
          if (confirmCount >= period) {
            boxTop = highestHigh;
            findingBottom = true;
            lowestLow = lows[i];
            bottomConfirmCount = 0;
          }
        }
      } else {
        if (highs[i] > boxTop) {
          findingBottom = false;
          highestHigh = highs[i];
          highestIdx = i;
          confirmCount = 0;
          continue;
        }

        if (lows[i] < lowestLow) {
          lowestLow = lows[i];
          bottomConfirmCount = 0;
        } else {
          bottomConfirmCount++;
          if (bottomConfirmCount >= period) {
            boxBottom = lowestLow;
            boxFormed = true;
          }
        }
      }
    }

    if (boxFormed) {
      top[i] = boxTop;
      bottom[i] = boxBottom;

      if (closes[i] > boxTop) {
        breakout[i] = true;
        boxFormed = false;
        findingBottom = false;
        highestHigh = highs[i];
        highestIdx = i;
        confirmCount = 0;
      } else if (closes[i] < boxBottom) {
        breakdown[i] = true;
        boxFormed = false;
        findingBottom = false;
        highestHigh = highs[i];
        highestIdx = i;
        confirmCount = 0;
      }
    }
  }

  return { top, bottom, breakout, breakdown };
}

// ─── Crossover / Crossunder utilities ───────────────────────────────────────

export function crossover(a: number[], b: number[]): boolean[] {
  const n = Math.min(a.length, b.length);
  const out = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    if (
      validNumber(a[i]) && validNumber(b[i]) &&
      validNumber(a[i - 1]) && validNumber(b[i - 1]) &&
      a[i - 1] <= b[i - 1] && a[i] > b[i]
    ) {
      out[i] = true;
    }
  }
  return out;
}

export function crossunder(a: number[], b: number[]): boolean[] {
  const n = Math.min(a.length, b.length);
  const out = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    if (
      validNumber(a[i]) && validNumber(b[i]) &&
      validNumber(a[i - 1]) && validNumber(b[i - 1]) &&
      a[i - 1] >= b[i - 1] && a[i] < b[i]
    ) {
      out[i] = true;
    }
  }
  return out;
}

// ─── Trend Strength (based on ADX) ─────────────────────────────────────────

export function trendStrength(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { strength: number[]; label: string[] } {
  const { adx: adxVals } = adx(highs, lows, closes, period);
  const n = adxVals.length;
  const label: string[] = new Array(n).fill('');

  for (let i = 0; i < n; i++) {
    if (!validNumber(adxVals[i])) {
      label[i] = 'unknown';
      continue;
    }
    if (adxVals[i] < 20) label[i] = 'absent';
    else if (adxVals[i] < 25) label[i] = 'weak';
    else if (adxVals[i] < 50) label[i] = 'strong';
    else if (adxVals[i] < 75) label[i] = 'very_strong';
    else label[i] = 'extreme';
  }

  return { strength: adxVals, label };
}
