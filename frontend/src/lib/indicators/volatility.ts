import { sma, ema, rma } from './movingAverages';

const nanArray = (n: number): number[] => new Array(n).fill(NaN);

function validNumber(v: number): boolean {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

function rollingSum(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += validNumber(arr[i]) ? arr[i] : 0;
    if (i >= period) sum -= validNumber(arr[i - period]) ? arr[i - period] : 0;
    if (i >= period - 1) out[i] = sum;
  }
  return out;
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

function rollingStdDev(arr: number[], period: number): number[] {
  const out = nanArray(arr.length);
  for (let i = period - 1; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
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

// ─── True Range ─────────────────────────────────────────────────────────────

export function trueRange(
  highs: number[],
  lows: number[],
  closes: number[]
): number[] {
  const n = closes.length;
  const out = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (!validNumber(highs[i]) || !validNumber(lows[i]) || !validNumber(closes[i])) continue;
    if (i === 0) {
      out[i] = highs[i] - lows[i];
    } else if (validNumber(closes[i - 1])) {
      out[i] = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }
  }
  return out;
}

// ─── ATR (Average True Range) ───────────────────────────────────────────────

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  return rma(trueRange(highs, lows, closes), period);
}

// ─── Bollinger Bands ────────────────────────────────────────────────────────

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
  percentB: number[];
  bandwidth: number[];
}

export function bollingerBands(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2.0
): BollingerBandsResult {
  const n = data.length;
  if (!n) return { upper: [], middle: [], lower: [], percentB: [], bandwidth: [] };

  const middle = sma(data, period);
  const std = rollingStdDev(data, period);

  const upper = nanArray(n);
  const lower = nanArray(n);
  const percentB = nanArray(n);
  const bandwidth = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (!validNumber(middle[i]) || !validNumber(std[i])) continue;

    upper[i] = middle[i] + stdDevMultiplier * std[i];
    lower[i] = middle[i] - stdDevMultiplier * std[i];

    const range = upper[i] - lower[i];
    if (range > 0 && validNumber(data[i])) {
      percentB[i] = (data[i] - lower[i]) / range;
    }

    if (middle[i] !== 0) {
      bandwidth[i] = (range / middle[i]) * 100;
    }
  }

  return { upper, middle, lower, percentB, bandwidth };
}

// ─── Keltner Channel ────────────────────────────────────────────────────────

export interface KeltnerChannelResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function keltnerChannel(
  highs: number[],
  lows: number[],
  closes: number[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2.0
): KeltnerChannelResult {
  const n = closes.length;
  if (!n) return { upper: [], middle: [], lower: [] };

  const middle = ema(closes, emaPeriod);
  const atrVals = atr(highs, lows, closes, atrPeriod);

  const upper = nanArray(n);
  const lower = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(middle[i]) && validNumber(atrVals[i])) {
      upper[i] = middle[i] + multiplier * atrVals[i];
      lower[i] = middle[i] - multiplier * atrVals[i];
    }
  }

  return { upper, middle, lower };
}

// ─── Donchian Channel ───────────────────────────────────────────────────────

export interface DonchianChannelResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function donchianChannel(
  highs: number[],
  lows: number[],
  period: number = 20
): DonchianChannelResult {
  const n = highs.length;
  if (!n) return { upper: [], middle: [], lower: [] };

  const upper = rollingMax(highs, period);
  const lower = rollingMin(lows, period);

  const middle = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(upper[i]) && validNumber(lower[i])) {
      middle[i] = (upper[i] + lower[i]) / 2;
    }
  }

  return { upper, middle, lower };
}

// ─── Historical Volatility (Close-to-Close / Annualized) ───────────────────

export function historicalVolatility(
  closes: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const logReturns = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (validNumber(closes[i]) && validNumber(closes[i - 1]) && closes[i - 1] > 0 && closes[i] > 0) {
      logReturns[i] = Math.log(closes[i] / closes[i - 1]);
    }
  }

  const std = rollingStdDev(logReturns, period);
  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(std[i])) {
      out[i] = std[i] * Math.sqrt(annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── Chaikin Volatility ─────────────────────────────────────────────────────

export function chaikinVolatility(
  highs: number[],
  lows: number[],
  emaPeriod: number = 10,
  rocPeriod: number = 10
): number[] {
  const n = highs.length;
  if (!n) return [];

  const hlDiff = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      hlDiff[i] = highs[i] - lows[i];
    }
  }

  const emaHL = ema(hlDiff, emaPeriod);

  const out = nanArray(n);
  for (let i = rocPeriod; i < n; i++) {
    if (validNumber(emaHL[i]) && validNumber(emaHL[i - rocPeriod]) && emaHL[i - rocPeriod] !== 0) {
      out[i] = ((emaHL[i] - emaHL[i - rocPeriod]) / emaHL[i - rocPeriod]) * 100;
    }
  }

  return out;
}

// ─── Standard Deviation ─────────────────────────────────────────────────────

export function standardDeviation(data: number[], period: number = 20): number[] {
  return rollingStdDev(data, period);
}

// ─── Ulcer Index ────────────────────────────────────────────────────────────

export function ulcerIndex(data: number[], period: number = 14): number[] {
  const n = data.length;
  if (!n) return [];

  const out = nanArray(n);

  for (let i = period - 1; i < n; i++) {
    let maxClose = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(data[j]) && data[j] > maxClose) maxClose = data[j];
    }

    if (maxClose <= 0) continue;

    let sumSquares = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (!validNumber(data[j])) continue;
      let runningMax = -Infinity;
      for (let k = i - period + 1; k <= j; k++) {
        if (validNumber(data[k]) && data[k] > runningMax) runningMax = data[k];
      }
      if (runningMax > 0) {
        const pctDrawdown = ((data[j] - runningMax) / runningMax) * 100;
        sumSquares += pctDrawdown * pctDrawdown;
        count++;
      }
    }

    if (count > 0) {
      out[i] = Math.sqrt(sumSquares / count);
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

  const tr = trueRange(highs, lows, closes);
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

// ─── Mass Index ─────────────────────────────────────────────────────────────

export function massIndex(
  highs: number[],
  lows: number[],
  emaPeriod: number = 9,
  sumPeriod: number = 25
): number[] {
  const n = highs.length;
  if (!n) return [];

  const hlDiff = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      hlDiff[i] = highs[i] - lows[i];
    }
  }

  const singleEMA = ema(hlDiff, emaPeriod);
  const doubleEMA = ema(singleEMA, emaPeriod);

  const ratio = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(singleEMA[i]) && validNumber(doubleEMA[i]) && doubleEMA[i] !== 0) {
      ratio[i] = singleEMA[i] / doubleEMA[i];
    }
  }

  return rollingSum(ratio, sumPeriod);
}

// ─── Volatility Stop ────────────────────────────────────────────────────────

export function volatilityStop(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20,
  multiplier: number = 2.0
): { stop: number[]; direction: number[] } {
  const n = closes.length;
  if (!n) return { stop: [], direction: [] };

  const atrVals = atr(highs, lows, closes, period);

  const stop = nanArray(n);
  const direction = new Array(n).fill(0);

  let isUptrend = true;
  let maxClose = closes[0] || 0;
  let minClose = closes[0] || 0;

  for (let i = period; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(atrVals[i])) continue;

    if (isUptrend) {
      const trailingStop = closes[i] - multiplier * atrVals[i];
      if (i > period && validNumber(stop[i - 1])) {
        stop[i] = Math.max(trailingStop, stop[i - 1]);
      } else {
        stop[i] = trailingStop;
      }

      if (closes[i] < stop[i]) {
        isUptrend = false;
        maxClose = closes[i];
        stop[i] = closes[i] + multiplier * atrVals[i];
      }
      direction[i] = 1;
    } else {
      const trailingStop = closes[i] + multiplier * atrVals[i];
      if (i > period && validNumber(stop[i - 1])) {
        stop[i] = Math.min(trailingStop, stop[i - 1]);
      } else {
        stop[i] = trailingStop;
      }

      if (closes[i] > stop[i]) {
        isUptrend = true;
        minClose = closes[i];
        stop[i] = closes[i] - multiplier * atrVals[i];
      }
      direction[i] = -1;
    }
  }

  return { stop, direction };
}

// ─── VIX-Style Calculation ──────────────────────────────────────────────────

export function vixStyleCalculation(
  closes: number[],
  period: number = 30,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const logReturns = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (validNumber(closes[i]) && validNumber(closes[i - 1]) && closes[i - 1] > 0 && closes[i] > 0) {
      logReturns[i] = Math.log(closes[i] / closes[i - 1]);
    }
  }

  const out = nanArray(n);
  for (let i = period; i < n; i++) {
    let sum = 0;
    let count = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(logReturns[j])) {
        sum += logReturns[j] * logReturns[j];
        count++;
      }
    }

    if (count >= period * 0.8) {
      const variance = sum / count;
      out[i] = Math.sqrt(variance * annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── GARCH(1,1) Estimation ──────────────────────────────────────────────────

export function garch11(
  closes: number[],
  omega: number = 0.00001,
  alpha: number = 0.1,
  beta: number = 0.85,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const returns = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (validNumber(closes[i]) && validNumber(closes[i - 1]) && closes[i - 1] > 0 && closes[i] > 0) {
      returns[i] = Math.log(closes[i] / closes[i - 1]);
    }
  }

  let initialVar = 0;
  let count = 0;
  for (let i = 1; i < Math.min(n, 31); i++) {
    if (validNumber(returns[i])) {
      initialVar += returns[i] ** 2;
      count++;
    }
  }
  if (count > 0) initialVar /= count;
  else initialVar = omega / (1 - alpha - beta);

  const out = nanArray(n);
  let sigma2 = initialVar;

  for (let i = 1; i < n; i++) {
    if (!validNumber(returns[i])) {
      out[i] = validNumber(sigma2) ? Math.sqrt(sigma2 * annualizationFactor) * 100 : NaN;
      continue;
    }

    sigma2 = omega + alpha * returns[i] ** 2 + beta * sigma2;
    out[i] = Math.sqrt(sigma2 * annualizationFactor) * 100;
  }

  return out;
}

// ─── Realized Volatility: Close-to-Close ────────────────────────────────────

export function realizedVolatilityCloseToClose(
  closes: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  return historicalVolatility(closes, period, annualizationFactor);
}

// ─── Realized Volatility: Parkinson ─────────────────────────────────────────

export function realizedVolatilityParkinson(
  highs: number[],
  lows: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  const n = highs.length;
  if (!n) return [];

  const logHL2 = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i]) && highs[i] > 0 && lows[i] > 0) {
      const logHL = Math.log(highs[i] / lows[i]);
      logHL2[i] = logHL * logHL;
    }
  }

  const factor = 1 / (4 * Math.log(2));

  const out = nanArray(n);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(logHL2[j])) {
        sum += logHL2[j];
        count++;
      }
    }
    if (count === period) {
      const variance = factor * (sum / period);
      out[i] = Math.sqrt(variance * annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── Realized Volatility: Garman-Klass ──────────────────────────────────────

export function realizedVolatilityGarmanKlass(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (!n) return [];

  const gkTerms = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      validNumber(opens[i]) && validNumber(highs[i]) &&
      validNumber(lows[i]) && validNumber(closes[i]) &&
      opens[i] > 0 && highs[i] > 0 && lows[i] > 0 && closes[i] > 0
    ) {
      const logHL = Math.log(highs[i] / lows[i]);
      const logCO = Math.log(closes[i] / opens[i]);
      gkTerms[i] = 0.5 * logHL * logHL - (2 * Math.log(2) - 1) * logCO * logCO;
    }
  }

  const out = nanArray(n);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(gkTerms[j])) {
        sum += gkTerms[j];
        count++;
      }
    }
    if (count === period) {
      out[i] = Math.sqrt((sum / period) * annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── Realized Volatility: Rogers-Satchell ───────────────────────────────────

export function realizedVolatilityRogersSatchell(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (!n) return [];

  const rsTerms = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      validNumber(opens[i]) && validNumber(highs[i]) &&
      validNumber(lows[i]) && validNumber(closes[i]) &&
      opens[i] > 0 && highs[i] > 0 && lows[i] > 0 && closes[i] > 0
    ) {
      const logHC = Math.log(highs[i] / closes[i]);
      const logHO = Math.log(highs[i] / opens[i]);
      const logLC = Math.log(lows[i] / closes[i]);
      const logLO = Math.log(lows[i] / opens[i]);
      rsTerms[i] = logHC * logHO + logLC * logLO;
    }
  }

  const out = nanArray(n);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(rsTerms[j])) {
        sum += rsTerms[j];
        count++;
      }
    }
    if (count === period) {
      out[i] = Math.sqrt((sum / period) * annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── Realized Volatility: Yang-Zhang ────────────────────────────────────────

export function realizedVolatilityYangZhang(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20,
  annualizationFactor: number = 252
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const overnightReturns = nanArray(n);
  const openCloseReturns = nanArray(n);
  const rsTerms = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (
      validNumber(opens[i]) && validNumber(closes[i - 1]) &&
      validNumber(highs[i]) && validNumber(lows[i]) && validNumber(closes[i]) &&
      opens[i] > 0 && closes[i - 1] > 0 && highs[i] > 0 && lows[i] > 0 && closes[i] > 0
    ) {
      overnightReturns[i] = Math.log(opens[i] / closes[i - 1]);
      openCloseReturns[i] = Math.log(closes[i] / opens[i]);

      const logHO = Math.log(highs[i] / opens[i]);
      const logHC = Math.log(highs[i] / closes[i]);
      const logLO = Math.log(lows[i] / opens[i]);
      const logLC = Math.log(lows[i] / closes[i]);
      rsTerms[i] = logHO * logHC + logLO * logLC;
    }
  }

  const k = 0.34 / (1.34 + (period + 1) / (period - 1));

  const out = nanArray(n);
  for (let i = period; i < n; i++) {
    let oMean = 0, oCount = 0;
    let cMean = 0, cCount = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(overnightReturns[j])) { oMean += overnightReturns[j]; oCount++; }
      if (validNumber(openCloseReturns[j])) { cMean += openCloseReturns[j]; cCount++; }
    }

    if (oCount < period || cCount < period) continue;
    oMean /= oCount;
    cMean /= cCount;

    let oVar = 0, cVar = 0, rsSum = 0;
    let rsCount = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (validNumber(overnightReturns[j])) {
        oVar += (overnightReturns[j] - oMean) ** 2;
      }
      if (validNumber(openCloseReturns[j])) {
        cVar += (openCloseReturns[j] - cMean) ** 2;
      }
      if (validNumber(rsTerms[j])) {
        rsSum += rsTerms[j];
        rsCount++;
      }
    }

    if (rsCount < period) continue;

    oVar /= (period - 1);
    cVar /= (period - 1);
    const rsVar = rsSum / period;

    const yzVariance = oVar + k * cVar + (1 - k) * rsVar;
    if (yzVariance >= 0) {
      out[i] = Math.sqrt(yzVariance * annualizationFactor) * 100;
    }
  }

  return out;
}

// ─── Average True Range Percent ─────────────────────────────────────────────

export function atrPercent(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const atrVals = atr(highs, lows, closes, period);
  const out = nanArray(closes.length);
  for (let i = 0; i < closes.length; i++) {
    if (validNumber(atrVals[i]) && validNumber(closes[i]) && closes[i] !== 0) {
      out[i] = (atrVals[i] / closes[i]) * 100;
    }
  }
  return out;
}

// ─── Normalized ATR (NATR) ──────────────────────────────────────────────────

export function natr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  return atrPercent(highs, lows, closes, period);
}

// ─── Bollinger Band Width ───────────────────────────────────────────────────

export function bollingerBandWidth(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2.0
): number[] {
  const bb = bollingerBands(data, period, stdDevMultiplier);
  return bb.bandwidth;
}

// ─── Bollinger %B ───────────────────────────────────────────────────────────

export function bollingerPercentB(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2.0
): number[] {
  const bb = bollingerBands(data, period, stdDevMultiplier);
  return bb.percentB;
}

// ─── Average Day Range ──────────────────────────────────────────────────────

export function averageDayRange(
  highs: number[],
  lows: number[],
  period: number = 14
): number[] {
  const n = highs.length;
  if (!n) return [];

  const dayRange = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i])) {
      dayRange[i] = highs[i] - lows[i];
    }
  }

  return sma(dayRange, period);
}

// ─── Relative Volatility Index (RVI) ────────────────────────────────────────

export function relativeVolatilityIndex(
  data: number[],
  stdDevPeriod: number = 10,
  smoothPeriod: number = 14
): number[] {
  const n = data.length;
  if (n < stdDevPeriod + 1) return nanArray(n);

  const std = rollingStdDev(data, stdDevPeriod);

  const upStd = nanArray(n);
  const downStd = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(data[i]) || !validNumber(data[i - 1]) || !validNumber(std[i])) continue;
    if (data[i] > data[i - 1]) {
      upStd[i] = std[i];
      downStd[i] = 0;
    } else {
      upStd[i] = 0;
      downStd[i] = std[i];
    }
  }

  const avgUp = ema(upStd, smoothPeriod);
  const avgDown = ema(downStd, smoothPeriod);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(avgUp[i]) && validNumber(avgDown[i])) {
      const total = avgUp[i] + avgDown[i];
      out[i] = total === 0 ? 50 : (avgUp[i] / total) * 100;
    }
  }

  return out;
}

// ─── Intraday Intensity ─────────────────────────────────────────────────────

export function intradayIntensity(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 21
): number[] {
  const n = closes.length;
  if (!n) return [];

  const iiRaw = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      validNumber(highs[i]) && validNumber(lows[i]) &&
      validNumber(closes[i]) && validNumber(volumes[i])
    ) {
      const range = highs[i] - lows[i];
      if (range > 0) {
        iiRaw[i] = ((2 * closes[i] - highs[i] - lows[i]) / range) * volumes[i];
      } else {
        iiRaw[i] = 0;
      }
    }
  }

  const iiSum = rollingSum(iiRaw, period);
  const volSum = rollingSum(volumes, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(iiSum[i]) && validNumber(volSum[i]) && volSum[i] !== 0) {
      out[i] = iiSum[i] / volSum[i];
    }
  }

  return out;
}
