export interface MAOptions {
  offset?: number;
  sigma?: number;
  volumeFactor?: number;
  fastPeriod?: number;
  slowPeriod?: number;
}

const nanArray = (n: number): number[] => new Array(n).fill(NaN);

function validNumber(v: number): boolean {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

function safeDivide(a: number, b: number): number {
  if (b === 0 || !validNumber(a) || !validNumber(b)) return NaN;
  return a / b;
}

// ─── SMA ────────────────────────────────────────────────────────────────────

export function sma(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const out = nanArray(data.length);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i++) {
    if (validNumber(data[i])) {
      sum += data[i];
      count++;
    }
    if (i >= period) {
      if (validNumber(data[i - period])) {
        sum -= data[i - period];
        count--;
      }
    }
    if (i >= period - 1 && count === period) {
      out[i] = sum / period;
    }
  }
  return out;
}

// ─── EMA ────────────────────────────────────────────────────────────────────

export function ema(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const out = nanArray(data.length);
  const k = 2 / (period + 1);
  let seeded = false;
  let prev = 0;

  for (let i = 0; i < data.length; i++) {
    if (!validNumber(data[i])) continue;

    if (!seeded) {
      if (i >= period - 1) {
        let sum = 0;
        let validCount = 0;
        for (let j = i - period + 1; j <= i; j++) {
          if (validNumber(data[j])) {
            sum += data[j];
            validCount++;
          }
        }
        if (validCount === period) {
          prev = sum / period;
          out[i] = prev;
          seeded = true;
        }
      }
    } else {
      prev = (data[i] - prev) * k + prev;
      out[i] = prev;
    }
  }
  return out;
}

// ─── WMA (Weighted Moving Average) ─────────────────────────────────────────

export function wma(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const out = nanArray(data.length);
  const denominator = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let weightedSum = 0;
    let allValid = true;
    for (let j = 0; j < period; j++) {
      const val = data[i - period + 1 + j];
      if (!validNumber(val)) { allValid = false; break; }
      weightedSum += val * (j + 1);
    }
    if (allValid) {
      out[i] = weightedSum / denominator;
    }
  }
  return out;
}

// ─── DEMA (Double Exponential Moving Average) ───────────────────────────────

export function dema(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const ema1 = ema(data, period);
  const ema2 = ema(ema1, period);

  const out = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (validNumber(ema1[i]) && validNumber(ema2[i])) {
      out[i] = 2 * ema1[i] - ema2[i];
    }
  }
  return out;
}

// ─── TEMA (Triple Exponential Moving Average) ───────────────────────────────

export function tema(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);

  const out = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (validNumber(e1[i]) && validNumber(e2[i]) && validNumber(e3[i])) {
      out[i] = 3 * e1[i] - 3 * e2[i] + e3[i];
    }
  }
  return out;
}

// ─── Hull Moving Average ────────────────────────────────────────────────────

export function hullMA(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const halfPeriod = Math.max(1, Math.floor(period / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));

  const wmaHalf = wma(data, halfPeriod);
  const wmaFull = wma(data, period);

  const diff = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (validNumber(wmaHalf[i]) && validNumber(wmaFull[i])) {
      diff[i] = 2 * wmaHalf[i] - wmaFull[i];
    }
  }

  return wma(diff, sqrtPeriod);
}

// ─── VWMA (Volume-Weighted Moving Average) ──────────────────────────────────

export function vwma(data: number[], period: number, options?: { volumes: number[] }): number[] {
  if (!data.length || period < 1 || !options?.volumes) return nanArray(data.length);

  const volumes = options.volumes;
  if (volumes.length !== data.length) return nanArray(data.length);

  const out = nanArray(data.length);

  for (let i = period - 1; i < data.length; i++) {
    let pvSum = 0;
    let vSum = 0;
    let allValid = true;

    for (let j = i - period + 1; j <= i; j++) {
      if (!validNumber(data[j]) || !validNumber(volumes[j])) {
        allValid = false;
        break;
      }
      pvSum += data[j] * volumes[j];
      vSum += volumes[j];
    }

    if (allValid && vSum > 0) {
      out[i] = pvSum / vSum;
    }
  }
  return out;
}

// ─── KAMA (Kaufman Adaptive Moving Average) ─────────────────────────────────

export function kama(data: number[], period: number, options?: MAOptions): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const fastPeriod = options?.fastPeriod ?? 2;
  const slowPeriod = options?.slowPeriod ?? 30;

  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);

  const out = nanArray(data.length);

  let kamaValue = NaN;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      if (i === period - 1 && validNumber(data[i])) {
        kamaValue = data[i];
        out[i] = kamaValue;
      }
      continue;
    }

    if (!validNumber(data[i]) || !validNumber(data[i - period])) continue;

    const direction = Math.abs(data[i] - data[i - period]);

    let volatility = 0;
    let volValid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (!validNumber(data[j]) || !validNumber(data[j - 1])) {
        volValid = false;
        break;
      }
      volatility += Math.abs(data[j] - data[j - 1]);
    }

    if (!volValid) continue;

    const er = volatility === 0 ? 0 : direction / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);

    if (!validNumber(kamaValue)) {
      kamaValue = data[i];
    }

    kamaValue = kamaValue + sc * (data[i] - kamaValue);
    out[i] = kamaValue;
  }

  return out;
}

// ─── ALMA (Arnaud Legoux Moving Average) ────────────────────────────────────

export function alma(data: number[], period: number, options?: MAOptions): number[] {
  if (!data.length || period < 1) return [];

  const offset = options?.offset ?? 0.85;
  const sigma = options?.sigma ?? 6.0;

  const m = offset * (period - 1);
  const s = period / sigma;

  const weights: number[] = new Array(period);
  let wSum = 0;

  for (let k = 0; k < period; k++) {
    const w = Math.exp(-((k - m) ** 2) / (2 * s * s));
    weights[k] = w;
    wSum += w;
  }

  const out = nanArray(data.length);

  for (let i = period - 1; i < data.length; i++) {
    let val = 0;
    let allValid = true;

    for (let k = 0; k < period; k++) {
      const d = data[i - period + 1 + k];
      if (!validNumber(d)) { allValid = false; break; }
      val += d * weights[k];
    }

    if (allValid && wSum > 0) {
      out[i] = val / wSum;
    }
  }

  return out;
}

// ─── FRAMA (Fractal Adaptive Moving Average) ────────────────────────────────

export function frama(data: number[], period: number): number[] {
  if (!data.length || period < 2) return nanArray(data.length);

  const halfPeriod = Math.floor(period / 2);
  const out = nanArray(data.length);

  let framaVal = NaN;

  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    if (window.some(v => !validNumber(v))) continue;

    const firstHalf = window.slice(0, halfPeriod);
    const secondHalf = window.slice(halfPeriod);

    const n1High = Math.max(...firstHalf);
    const n1Low = Math.min(...firstHalf);
    const n2High = Math.max(...secondHalf);
    const n2Low = Math.min(...secondHalf);
    const n3High = Math.max(...window);
    const n3Low = Math.min(...window);

    const n1Range = n1High - n1Low;
    const n2Range = n2High - n2Low;
    const n3Range = n3High - n3Low;

    let dimension = 0;
    if (n3Range > 0 && n1Range > 0 && n2Range > 0) {
      dimension = (Math.log(n1Range + n2Range) - Math.log(n3Range)) / Math.log(2);
    }

    const alpha = Math.exp(-4.6 * (dimension - 1));
    const clampedAlpha = Math.max(0.01, Math.min(1, alpha));

    if (!validNumber(framaVal)) {
      framaVal = data[i];
    } else {
      framaVal = clampedAlpha * data[i] + (1 - clampedAlpha) * framaVal;
    }

    out[i] = framaVal;
  }

  return out;
}

// ─── T3 (Tillson T3 Moving Average) ─────────────────────────────────────────

export function t3(data: number[], period: number, options?: { volumeFactor?: number }): number[] {
  if (!data.length || period < 1) return [];

  const vf = options?.volumeFactor ?? 0.7;

  const c1 = -(vf * vf * vf);
  const c2 = 3 * vf * vf + 3 * vf * vf * vf;
  const c3 = -6 * vf * vf - 3 * vf - 3 * vf * vf * vf;
  const c4 = 1 + 3 * vf + vf * vf * vf + 3 * vf * vf;

  const e1 = ema(data, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);
  const e4 = ema(e3, period);
  const e5 = ema(e4, period);
  const e6 = ema(e5, period);

  const out = nanArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if (
      validNumber(e3[i]) && validNumber(e4[i]) &&
      validNumber(e5[i]) && validNumber(e6[i])
    ) {
      out[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
    }
  }

  return out;
}

// ─── Zero-Lag EMA ───────────────────────────────────────────────────────────

export function zeroLagEMA(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const lag = Math.floor((period - 1) / 2);
  const adjusted = nanArray(data.length);

  for (let i = 0; i < data.length; i++) {
    if (i >= lag && validNumber(data[i]) && validNumber(data[i - lag])) {
      adjusted[i] = 2 * data[i] - data[i - lag];
    }
  }

  return ema(adjusted, period);
}

// ─── McGinley Dynamic ───────────────────────────────────────────────────────

export function mcginleyDynamic(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const out = nanArray(data.length);
  let md = NaN;

  for (let i = 0; i < data.length; i++) {
    if (!validNumber(data[i])) continue;

    if (!validNumber(md)) {
      if (i >= period - 1) {
        let sum = 0;
        let count = 0;
        for (let j = i - period + 1; j <= i; j++) {
          if (validNumber(data[j])) { sum += data[j]; count++; }
        }
        if (count === period) {
          md = sum / period;
          out[i] = md;
        }
      }
      continue;
    }

    const ratio = data[i] / md;
    const denominator = period * Math.pow(ratio, 4);
    if (denominator === 0) {
      out[i] = md;
      continue;
    }

    md = md + (data[i] - md) / denominator;
    out[i] = md;
  }

  return out;
}

// ─── Triangular Moving Average ──────────────────────────────────────────────

export function triangularMA(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];

  const firstPeriod = Math.ceil((period + 1) / 2);
  const secondPeriod = Math.floor((period + 1) / 2);

  const firstSMA = sma(data, firstPeriod);
  return sma(firstSMA, secondPeriod);
}

// ─── Wilder's Smoothed Moving Average (RMA) ────────────────────────────────

export function rma(data: number[], period: number): number[] {
  if (!data.length || period < 1) return [];
  if (period > data.length) return nanArray(data.length);

  const out = nanArray(data.length);
  const alpha = 1 / period;
  let seeded = false;
  let prev = 0;

  for (let i = 0; i < data.length; i++) {
    if (!validNumber(data[i])) continue;

    if (!seeded) {
      if (i >= period - 1) {
        let sum = 0;
        let count = 0;
        for (let j = i - period + 1; j <= i; j++) {
          if (validNumber(data[j])) { sum += data[j]; count++; }
        }
        if (count === period) {
          prev = sum / period;
          out[i] = prev;
          seeded = true;
        }
      }
    } else {
      prev = data[i] * alpha + prev * (1 - alpha);
      out[i] = prev;
    }
  }
  return out;
}

// ─── SMMA (Smoothed Moving Average — alias for RMA) ────────────────────────

export function smma(data: number[], period: number): number[] {
  return rma(data, period);
}

// ─── LSMA (Least Squares Moving Average / Linear Regression Value) ─────────

export function lsma(data: number[], period: number): number[] {
  if (!data.length || period < 2) return nanArray(data.length);

  const out = nanArray(data.length);

  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    if (window.some(v => !validNumber(v))) continue;

    const n = period;
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

// ─── VIDYA (Variable Index Dynamic Average) ────────────────────────────────

export function vidya(data: number[], period: number, options?: MAOptions): number[] {
  if (!data.length || period < 1) return [];

  const cmoLen = options?.fastPeriod ?? 9;
  const out = nanArray(data.length);
  let vidyaVal = NaN;

  const sc = 2 / (period + 1);

  for (let i = cmoLen; i < data.length; i++) {
    if (!validNumber(data[i])) continue;

    let upSum = 0;
    let downSum = 0;
    for (let j = i - cmoLen + 1; j <= i; j++) {
      if (!validNumber(data[j]) || !validNumber(data[j - 1])) continue;
      const diff = data[j] - data[j - 1];
      if (diff > 0) upSum += diff;
      else downSum += Math.abs(diff);
    }

    const cmoRaw = (upSum + downSum) === 0 ? 0 : Math.abs((upSum - downSum) / (upSum + downSum));

    if (!validNumber(vidyaVal)) {
      vidyaVal = data[i];
    } else {
      vidyaVal = sc * cmoRaw * data[i] + (1 - sc * cmoRaw) * vidyaVal;
    }

    out[i] = vidyaVal;
  }

  return out;
}

// ─── JMA-inspired Smoothing (Jurik Moving Average approximation) ────────────

export function jma(data: number[], period: number, options?: { phase?: number; power?: number }): number[] {
  if (!data.length || period < 1) return [];

  const phase = options?.phase ?? 0;
  const power = options?.power ?? 2;

  const phaseRatio = phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
  const beta = 0.45 * (period - 1) / (0.45 * (period - 1) + 2);
  const alpha = Math.pow(beta, power);

  const out = nanArray(data.length);
  let e0 = 0, e1 = 0, e2 = 0;
  let started = false;

  for (let i = 0; i < data.length; i++) {
    if (!validNumber(data[i])) continue;

    if (!started) {
      e0 = data[i];
      e1 = 0;
      e2 = data[i];
      started = true;
      out[i] = data[i];
      continue;
    }

    e0 = (1 - alpha) * data[i] + alpha * e0;
    e1 = (data[i] - e0) * (1 - beta) + beta * e1;
    e2 = e0 + phaseRatio * e1;

    out[i] = e2;
  }

  return out;
}

// ─── SWMA (Symmetrically Weighted Moving Average) ──────────────────────────

export function swma(data: number[]): number[] {
  if (data.length < 4) return nanArray(data.length);

  const out = nanArray(data.length);

  for (let i = 3; i < data.length; i++) {
    if (
      validNumber(data[i - 3]) && validNumber(data[i - 2]) &&
      validNumber(data[i - 1]) && validNumber(data[i])
    ) {
      out[i] = (data[i - 3] + 2 * data[i - 2] + 2 * data[i - 1] + data[i]) / 6;
    }
  }

  return out;
}

// ─── Convenience: Apply any MA by name ──────────────────────────────────────

export type MAType =
  | 'sma' | 'ema' | 'wma' | 'dema' | 'tema' | 'hullma' | 'vwma'
  | 'kama' | 'alma' | 'frama' | 't3' | 'zlema' | 'mcginley'
  | 'triangular' | 'rma' | 'smma' | 'lsma' | 'vidya' | 'jma' | 'swma';

export function applyMA(
  type: MAType,
  data: number[],
  period: number,
  options?: MAOptions & { volumes?: number[]; phase?: number; power?: number; volumeFactor?: number }
): number[] {
  switch (type) {
    case 'sma': return sma(data, period);
    case 'ema': return ema(data, period);
    case 'wma': return wma(data, period);
    case 'dema': return dema(data, period);
    case 'tema': return tema(data, period);
    case 'hullma': return hullMA(data, period);
    case 'vwma': return vwma(data, period, { volumes: options?.volumes ?? [] });
    case 'kama': return kama(data, period, options);
    case 'alma': return alma(data, period, options);
    case 'frama': return frama(data, period);
    case 't3': return t3(data, period, { volumeFactor: options?.volumeFactor });
    case 'zlema': return zeroLagEMA(data, period);
    case 'mcginley': return mcginleyDynamic(data, period);
    case 'triangular': return triangularMA(data, period);
    case 'rma': return rma(data, period);
    case 'smma': return smma(data, period);
    case 'lsma': return lsma(data, period);
    case 'vidya': return vidya(data, period, options);
    case 'jma': return jma(data, period, options);
    case 'swma': return swma(data);
    default: return sma(data, period);
  }
}
