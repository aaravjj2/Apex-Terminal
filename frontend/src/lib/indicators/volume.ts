import { sma, ema, rma } from './movingAverages';
import { rsi } from './momentum';

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

// ─── OBV (On Balance Volume) ────────────────────────────────────────────────

export function obv(closes: number[], volumes: number[]): number[] {
  const n = closes.length;
  if (!n) return [];

  const out = nanArray(n);
  let cumOBV = 0;

  if (validNumber(volumes[0])) {
    out[0] = 0;
  }

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) || !validNumber(volumes[i])) {
      out[i] = cumOBV;
      continue;
    }

    if (closes[i] > closes[i - 1]) {
      cumOBV += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      cumOBV -= volumes[i];
    }
    out[i] = cumOBV;
  }

  return out;
}

// ─── Accumulation/Distribution Line ─────────────────────────────────────────

export function accumulationDistribution(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const n = closes.length;
  if (!n) return [];

  const out = nanArray(n);
  let adl = 0;

  for (let i = 0; i < n; i++) {
    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(closes[i]) || !validNumber(volumes[i])
    ) {
      out[i] = adl;
      continue;
    }

    const range = highs[i] - lows[i];
    let clv: number;
    if (range === 0) {
      clv = 0;
    } else {
      clv = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    }

    adl += clv * volumes[i];
    out[i] = adl;
  }

  return out;
}

// ─── CMF (Chaikin Money Flow) ───────────────────────────────────────────────

export function cmf(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 20
): number[] {
  const n = closes.length;
  if (!n) return [];

  const mfVolume = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(closes[i]) || !validNumber(volumes[i])
    ) continue;

    const range = highs[i] - lows[i];
    const clv = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    mfVolume[i] = clv * volumes[i];
  }

  const mfSum = rollingSum(mfVolume, period);
  const volSum = rollingSum(volumes, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(mfSum[i]) && validNumber(volSum[i]) && volSum[i] !== 0) {
      out[i] = mfSum[i] / volSum[i];
    }
  }

  return out;
}

// ─── MFI (Money Flow Index) ─────────────────────────────────────────────────

export function mfi(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const tp = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i]) && validNumber(closes[i])) {
      tp[i] = (highs[i] + lows[i] + closes[i]) / 3;
    }
  }

  const rawMF = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(tp[i]) && validNumber(volumes[i])) {
      rawMF[i] = tp[i] * volumes[i];
    }
  }

  const positiveMF = nanArray(n);
  const negativeMF = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(tp[i]) || !validNumber(tp[i - 1]) || !validNumber(rawMF[i])) continue;

    if (tp[i] > tp[i - 1]) {
      positiveMF[i] = rawMF[i];
      negativeMF[i] = 0;
    } else if (tp[i] < tp[i - 1]) {
      positiveMF[i] = 0;
      negativeMF[i] = rawMF[i];
    } else {
      positiveMF[i] = 0;
      negativeMF[i] = 0;
    }
  }

  const posMFSum = rollingSum(positiveMF, period);
  const negMFSum = rollingSum(negativeMF, period);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (!validNumber(posMFSum[i]) || !validNumber(negMFSum[i])) continue;

    if (negMFSum[i] === 0) {
      out[i] = 100;
    } else {
      const ratio = posMFSum[i] / negMFSum[i];
      out[i] = 100 - 100 / (1 + ratio);
    }
  }

  return out;
}

// ─── VWAP (with standard deviation bands) ───────────────────────────────────

export interface VWAPResult {
  vwap: number[];
  upperBand1: number[];
  lowerBand1: number[];
  upperBand2: number[];
  lowerBand2: number[];
  upperBand3: number[];
  lowerBand3: number[];
}

export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  sessionStarts?: boolean[]
): VWAPResult {
  const n = closes.length;
  if (!n) {
    return {
      vwap: [], upperBand1: [], lowerBand1: [],
      upperBand2: [], lowerBand2: [], upperBand3: [], lowerBand3: []
    };
  }

  const vwapLine = nanArray(n);
  const ub1 = nanArray(n), lb1 = nanArray(n);
  const ub2 = nanArray(n), lb2 = nanArray(n);
  const ub3 = nanArray(n), lb3 = nanArray(n);

  let cumPV = 0;
  let cumVol = 0;
  let cumPV2 = 0;

  for (let i = 0; i < n; i++) {
    if (sessionStarts && sessionStarts[i]) {
      cumPV = 0;
      cumVol = 0;
      cumPV2 = 0;
    }

    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(closes[i]) || !validNumber(volumes[i])
    ) continue;

    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumVol += volumes[i];
    cumPV2 += tp * tp * volumes[i];

    if (cumVol === 0) continue;

    const v = cumPV / cumVol;
    vwapLine[i] = v;

    const variance = cumPV2 / cumVol - v * v;
    const stddev = variance > 0 ? Math.sqrt(variance) : 0;

    ub1[i] = v + stddev;
    lb1[i] = v - stddev;
    ub2[i] = v + 2 * stddev;
    lb2[i] = v - 2 * stddev;
    ub3[i] = v + 3 * stddev;
    lb3[i] = v - 3 * stddev;
  }

  return {
    vwap: vwapLine,
    upperBand1: ub1, lowerBand1: lb1,
    upperBand2: ub2, lowerBand2: lb2,
    upperBand3: ub3, lowerBand3: lb3
  };
}

// ─── Volume Profile ─────────────────────────────────────────────────────────

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeProfileResult {
  levels: VolumeProfileLevel[];
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
}

export function volumeProfile(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  numBins: number = 50
): VolumeProfileResult {
  const n = closes.length;
  const emptyResult: VolumeProfileResult = {
    levels: [], poc: NaN, valueAreaHigh: NaN, valueAreaLow: NaN
  };

  if (!n) return emptyResult;

  let priceHigh = -Infinity;
  let priceLow = Infinity;

  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && highs[i] > priceHigh) priceHigh = highs[i];
    if (validNumber(lows[i]) && lows[i] < priceLow) priceLow = lows[i];
  }

  if (!isFinite(priceHigh) || !isFinite(priceLow) || priceHigh <= priceLow) return emptyResult;

  const binSize = (priceHigh - priceLow) / numBins;
  const levels: VolumeProfileLevel[] = [];

  for (let b = 0; b < numBins; b++) {
    levels.push({
      price: priceLow + (b + 0.5) * binSize,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0
    });
  }

  for (let i = 0; i < n; i++) {
    if (
      !validNumber(opens[i]) || !validNumber(highs[i]) ||
      !validNumber(lows[i]) || !validNumber(closes[i]) || !validNumber(volumes[i])
    ) continue;

    const candleLow = lows[i];
    const candleHigh = highs[i];
    const isBullish = closes[i] >= opens[i];

    const lowBin = Math.max(0, Math.floor((candleLow - priceLow) / binSize));
    const highBin = Math.min(numBins - 1, Math.floor((candleHigh - priceLow) / binSize));

    const numCandleBins = highBin - lowBin + 1;
    const volPerBin = numCandleBins > 0 ? volumes[i] / numCandleBins : 0;

    for (let b = lowBin; b <= highBin; b++) {
      levels[b].volume += volPerBin;
      if (isBullish) {
        levels[b].buyVolume += volPerBin;
      } else {
        levels[b].sellVolume += volPerBin;
      }
    }
  }

  let maxVol = 0;
  let pocIdx = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].volume > maxVol) {
      maxVol = levels[i].volume;
      pocIdx = i;
    }
  }

  const poc = levels[pocIdx].price;

  const totalVolume = levels.reduce((sum, l) => sum + l.volume, 0);
  const valueAreaTarget = totalVolume * 0.70;

  let vaVolume = levels[pocIdx].volume;
  let vaLow = pocIdx;
  let vaHigh = pocIdx;

  while (vaVolume < valueAreaTarget && (vaLow > 0 || vaHigh < numBins - 1)) {
    const addAbove = vaHigh < numBins - 1 ? levels[vaHigh + 1].volume : 0;
    const addBelow = vaLow > 0 ? levels[vaLow - 1].volume : 0;

    if (addAbove >= addBelow && vaHigh < numBins - 1) {
      vaHigh++;
      vaVolume += levels[vaHigh].volume;
    } else if (vaLow > 0) {
      vaLow--;
      vaVolume += levels[vaLow].volume;
    } else {
      vaHigh++;
      vaVolume += levels[vaHigh].volume;
    }
  }

  return {
    levels,
    poc,
    valueAreaHigh: levels[vaHigh].price + binSize / 2,
    valueAreaLow: levels[vaLow].price - binSize / 2
  };
}

// ─── Volume Oscillator ──────────────────────────────────────────────────────

export function volumeOscillator(
  volumes: number[],
  shortPeriod: number = 5,
  longPeriod: number = 10
): number[] {
  const n = volumes.length;
  if (!n) return [];

  const shortSMA = sma(volumes, shortPeriod);
  const longSMA = sma(volumes, longPeriod);

  const out = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(shortSMA[i]) && validNumber(longSMA[i]) && longSMA[i] !== 0) {
      out[i] = ((shortSMA[i] - longSMA[i]) / longSMA[i]) * 100;
    }
  }

  return out;
}

// ─── PVT (Price Volume Trend) ───────────────────────────────────────────────

export function pvt(closes: number[], volumes: number[]): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const out = nanArray(n);
  let cumPVT = 0;
  out[0] = 0;

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) || !validNumber(volumes[i]) || closes[i - 1] === 0) {
      out[i] = cumPVT;
      continue;
    }

    cumPVT += ((closes[i] - closes[i - 1]) / closes[i - 1]) * volumes[i];
    out[i] = cumPVT;
  }

  return out;
}

// ─── NVI (Negative Volume Index) ────────────────────────────────────────────

export function nvi(closes: number[], volumes: number[]): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const out = nanArray(n);
  let nviValue = 1000;
  out[0] = nviValue;

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) ||
        !validNumber(volumes[i]) || !validNumber(volumes[i - 1])) {
      out[i] = nviValue;
      continue;
    }

    if (volumes[i] < volumes[i - 1] && closes[i - 1] !== 0) {
      nviValue += nviValue * ((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    out[i] = nviValue;
  }

  return out;
}

// ─── PVI (Positive Volume Index) ────────────────────────────────────────────

export function pvi(closes: number[], volumes: number[]): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const out = nanArray(n);
  let pviValue = 1000;
  out[0] = pviValue;

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) ||
        !validNumber(volumes[i]) || !validNumber(volumes[i - 1])) {
      out[i] = pviValue;
      continue;
    }

    if (volumes[i] > volumes[i - 1] && closes[i - 1] !== 0) {
      pviValue += pviValue * ((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    out[i] = pviValue;
  }

  return out;
}

// ─── EMV (Ease of Movement) ────────────────────────────────────────────────

export function emv(
  highs: number[],
  lows: number[],
  volumes: number[],
  period: number = 14,
  divisor: number = 10000
): number[] {
  const n = highs.length;
  if (n < 2) return nanArray(n);

  const rawEMV = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(highs[i - 1]) || !validNumber(lows[i - 1]) || !validNumber(volumes[i])
    ) continue;

    const dm = ((highs[i] + lows[i]) / 2) - ((highs[i - 1] + lows[i - 1]) / 2);
    const hl = highs[i] - lows[i];

    if (hl === 0) {
      rawEMV[i] = 0;
    } else {
      const boxRatio = (volumes[i] / divisor) / hl;
      rawEMV[i] = boxRatio === 0 ? 0 : dm / boxRatio;
    }
  }

  return sma(rawEMV, period);
}

// ─── Klinger Volume Oscillator ──────────────────────────────────────────────

export interface KlingerResult {
  kvo: number[];
  signal: number[];
}

export function klingerVolumeOscillator(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  fastPeriod: number = 34,
  slowPeriod: number = 55,
  signalPeriod: number = 13
): KlingerResult {
  const n = closes.length;
  if (n < 2) return { kvo: nanArray(n), signal: nanArray(n) };

  const hlc = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(highs[i]) && validNumber(lows[i]) && validNumber(closes[i])) {
      hlc[i] = highs[i] + lows[i] + closes[i];
    }
  }

  const vf = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (!validNumber(hlc[i]) || !validNumber(hlc[i - 1]) || !validNumber(volumes[i]) ||
        !validNumber(highs[i]) || !validNumber(lows[i])) continue;

    const dm = highs[i] - lows[i];
    const trend = hlc[i] > hlc[i - 1] ? 1 : -1;

    const cmPrev = (i >= 2 && validNumber(highs[i - 1]) && validNumber(lows[i - 1]))
      ? (highs[i - 1] - lows[i - 1]) : 0;
    const cm = dm + (trend === ((hlc[i - 1] > (i >= 2 && validNumber(hlc[i - 2]) ? hlc[i - 2] : 0)) ? 1 : -1)
      ? cmPrev : 0);

    if (cm !== 0) {
      vf[i] = volumes[i] * Math.abs(2 * (dm / cm) - 1) * trend * 100;
    } else {
      vf[i] = volumes[i] * trend * 100;
    }
  }

  const fastEMA = ema(vf, fastPeriod);
  const slowEMA = ema(vf, slowPeriod);

  const kvo = nanArray(n);
  for (let i = 0; i < n; i++) {
    if (validNumber(fastEMA[i]) && validNumber(slowEMA[i])) {
      kvo[i] = fastEMA[i] - slowEMA[i];
    }
  }

  const signal = ema(kvo, signalPeriod);

  return { kvo, signal };
}

// ─── Volume Rate of Change ──────────────────────────────────────────────────

export function volumeRateOfChange(
  volumes: number[],
  period: number = 14
): number[] {
  const n = volumes.length;
  if (!n) return [];

  const out = nanArray(n);
  for (let i = period; i < n; i++) {
    if (validNumber(volumes[i]) && validNumber(volumes[i - period]) && volumes[i - period] !== 0) {
      out[i] = ((volumes[i] - volumes[i - period]) / volumes[i - period]) * 100;
    }
  }

  return out;
}

// ─── Volume-Weighted RSI ────────────────────────────────────────────────────

export function volumeWeightedRSI(
  closes: number[],
  volumes: number[],
  period: number = 14
): number[] {
  const n = closes.length;
  if (n < period + 1) return nanArray(n);

  const vwGains = nanArray(n);
  const vwLosses = nanArray(n);

  for (let i = 1; i < n; i++) {
    if (!validNumber(closes[i]) || !validNumber(closes[i - 1]) || !validNumber(volumes[i])) continue;

    const diff = closes[i] - closes[i - 1];
    if (diff > 0) {
      vwGains[i] = diff * volumes[i];
      vwLosses[i] = 0;
    } else {
      vwGains[i] = 0;
      vwLosses[i] = -diff * volumes[i];
    }
  }

  const avgGains = rma(vwGains, period);
  const avgLosses = rma(vwLosses, period);

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

// ─── ADOSC (Accumulation/Distribution Oscillator / Chaikin Oscillator) ──────

export function adosc(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  fastPeriod: number = 3,
  slowPeriod: number = 10
): number[] {
  const adLine = accumulationDistribution(highs, lows, closes, volumes);

  const fastEMA = ema(adLine, fastPeriod);
  const slowEMA = ema(adLine, slowPeriod);

  const n = adLine.length;
  const out = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(fastEMA[i]) && validNumber(slowEMA[i])) {
      out[i] = fastEMA[i] - slowEMA[i];
    }
  }

  return out;
}

// ─── Force Index ────────────────────────────────────────────────────────────

export function forceIndex(
  closes: number[],
  volumes: number[],
  period: number = 13
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const rawFI = nanArray(n);
  for (let i = 1; i < n; i++) {
    if (validNumber(closes[i]) && validNumber(closes[i - 1]) && validNumber(volumes[i])) {
      rawFI[i] = (closes[i] - closes[i - 1]) * volumes[i];
    }
  }

  return ema(rawFI, period);
}

// ─── Volume Moving Average ──────────────────────────────────────────────────

export function volumeSMA(volumes: number[], period: number = 20): number[] {
  return sma(volumes, period);
}

export function volumeEMA(volumes: number[], period: number = 20): number[] {
  return ema(volumes, period);
}

// ─── Relative Volume (RVOL) ─────────────────────────────────────────────────

export function relativeVolume(
  volumes: number[],
  period: number = 20
): number[] {
  const n = volumes.length;
  if (!n) return [];

  const avgVol = sma(volumes, period);
  const out = nanArray(n);

  for (let i = 0; i < n; i++) {
    if (validNumber(volumes[i]) && validNumber(avgVol[i]) && avgVol[i] !== 0) {
      out[i] = volumes[i] / avgVol[i];
    }
  }

  return out;
}

// ─── Volume Weighted Average Price (Anchored) ───────────────────────────────

export function anchoredVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  anchorIndex: number
): number[] {
  const n = closes.length;
  if (!n || anchorIndex < 0 || anchorIndex >= n) return nanArray(n);

  const out = nanArray(n);
  let cumPV = 0;
  let cumVol = 0;

  for (let i = anchorIndex; i < n; i++) {
    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(closes[i]) || !validNumber(volumes[i])
    ) {
      out[i] = cumVol === 0 ? NaN : cumPV / cumVol;
      continue;
    }

    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumVol += volumes[i];

    out[i] = cumVol === 0 ? NaN : cumPV / cumVol;
  }

  return out;
}

// ─── Twiggs Money Flow ──────────────────────────────────────────────────────

export function twiggsMoneyFlow(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 21
): number[] {
  const n = closes.length;
  if (n < 2) return nanArray(n);

  const out = nanArray(n);

  let prevADV = 0;
  let prevVol = 0;

  for (let i = 1; i < n; i++) {
    if (
      !validNumber(highs[i]) || !validNumber(lows[i]) ||
      !validNumber(closes[i]) || !validNumber(closes[i - 1]) || !validNumber(volumes[i])
    ) continue;

    const trueHigh = Math.max(highs[i], closes[i - 1]);
    const trueLow = Math.min(lows[i], closes[i - 1]);
    const trueRange = trueHigh - trueLow;

    let adv: number;
    if (trueRange === 0) {
      adv = 0;
    } else {
      adv = ((2 * closes[i] - trueHigh - trueLow) / trueRange) * volumes[i];
    }

    const k = 2 / (period + 1);

    if (i <= period) {
      prevADV += adv;
      prevVol += volumes[i];
      if (i === period) {
        out[i] = prevVol === 0 ? 0 : prevADV / prevVol;
      }
    } else {
      const smoothADV = prevADV + k * (adv - prevADV);
      const smoothVol = prevVol + k * (volumes[i] - prevVol);
      prevADV = smoothADV;
      prevVol = smoothVol;
      out[i] = smoothVol === 0 ? 0 : smoothADV / smoothVol;
    }
  }

  return out;
}
