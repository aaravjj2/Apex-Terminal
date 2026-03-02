import type {
  Dataset, Feature, SplitIndices, WalkForwardSplit, PCAResult,
  NormalizationMethod, ImputationMethod,
} from './types';

// ─── Vector / Matrix Helpers ─────────────────────────────────────────────────

function mean(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

function median(v: number[]): number {
  const sorted = [...v].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function mode(v: number[]): number {
  const freq = new Map<number, number>();
  let best = v[0], bestCount = 0;
  for (const x of v) {
    const c = (freq.get(x) ?? 0) + 1;
    freq.set(x, c);
    if (c > bestCount) { best = x; bestCount = c; }
  }
  return best;
}

function stdDev(v: number[], mu?: number): number {
  const m = mu ?? mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) ** 2;
  return Math.sqrt(s / v.length);
}

function quantile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

function skewness(v: number[]): number {
  const n = v.length;
  const m = mean(v);
  const s = stdDev(v, m);
  if (s === 0) return 0;
  let sum3 = 0;
  for (let i = 0; i < n; i++) sum3 += ((v[i] - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum3;
}

function kurtosis(v: number[]): number {
  const n = v.length;
  const m = mean(v);
  const s = stdDev(v, m);
  if (s === 0) return 0;
  let sum4 = 0;
  for (let i = 0; i < n; i++) sum4 += ((v[i] - m) / s) ** 4;
  const k = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4;
  return k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, p = B.length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++)
      for (let j = 0; j < n; j++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function transpose(A: number[][]): number[][] {
  const m = A.length, n = A[0].length;
  const T: number[][] = Array.from({ length: n }, () => new Array(m));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      T[j][i] = A[i][j];
  return T;
}

// ─── Normalization ───────────────────────────────────────────────────────────

export interface NormalizationParams {
  method: NormalizationMethod;
  params: Map<string, { offset: number; scale: number }>;
}

export function normalize(
  features: Feature[],
  method: NormalizationMethod,
): { normalized: Feature[]; params: NormalizationParams } {
  const params = new Map<string, { offset: number; scale: number }>();
  const normalized = features.map(f => {
    const v = f.values.filter(x => !isNaN(x));
    let offset = 0, scale = 1;

    switch (method) {
      case 'min_max': {
        const min = Math.min(...v);
        const max = Math.max(...v);
        offset = min;
        scale = max - min || 1;
        break;
      }
      case 'z_score': {
        offset = mean(v);
        scale = stdDev(v, offset) || 1;
        break;
      }
      case 'robust': {
        const sorted = [...v].sort((a, b) => a - b);
        offset = median(v);
        scale = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) || 1;
        break;
      }
      case 'max_abs': {
        offset = 0;
        scale = Math.max(...v.map(Math.abs)) || 1;
        break;
      }
      case 'quantile': {
        const sorted = [...v].sort((a, b) => a - b);
        offset = quantile(sorted, 0.25);
        scale = (quantile(sorted, 0.75) - offset) || 1;
        break;
      }
    }

    params.set(f.name, { offset, scale });
    return {
      ...f,
      values: f.values.map(x => isNaN(x) ? NaN : (x - offset) / scale),
    };
  });

  return { normalized, params: { method, params } };
}

export function denormalize(values: number[], offset: number, scale: number): number[] {
  return values.map(x => x * scale + offset);
}

// ─── Missing Value Handling ──────────────────────────────────────────────────

export function imputeMissing(values: number[], method: ImputationMethod): number[] {
  const result = [...values];
  const valid = values.filter(x => !isNaN(x));

  if (valid.length === 0) return result;

  switch (method) {
    case 'mean': {
      const m = mean(valid);
      for (let i = 0; i < result.length; i++) if (isNaN(result[i])) result[i] = m;
      break;
    }
    case 'median': {
      const med = median(valid);
      for (let i = 0; i < result.length; i++) if (isNaN(result[i])) result[i] = med;
      break;
    }
    case 'mode': {
      const mod = mode(valid);
      for (let i = 0; i < result.length; i++) if (isNaN(result[i])) result[i] = mod;
      break;
    }
    case 'forward_fill': {
      for (let i = 0; i < result.length; i++) {
        if (isNaN(result[i]) && i > 0) result[i] = result[i - 1];
      }
      const firstValid = valid[0];
      for (let i = 0; i < result.length; i++) {
        if (isNaN(result[i])) result[i] = firstValid;
        else break;
      }
      break;
    }
    case 'interpolation': {
      for (let i = 0; i < result.length; i++) {
        if (!isNaN(result[i])) continue;
        let prev = -1, next = -1;
        for (let j = i - 1; j >= 0; j--) if (!isNaN(result[j])) { prev = j; break; }
        for (let j = i + 1; j < result.length; j++) if (!isNaN(result[j])) { next = j; break; }

        if (prev >= 0 && next >= 0) {
          const ratio = (i - prev) / (next - prev);
          result[i] = result[prev] + ratio * (result[next] - result[prev]);
        } else if (prev >= 0) {
          result[i] = result[prev];
        } else if (next >= 0) {
          result[i] = result[next];
        }
      }
      break;
    }
  }
  return result;
}

// ─── Outlier Detection & Handling ────────────────────────────────────────────

export function detectOutliersIQR(values: number[], multiplier = 1.5): boolean[] {
  const sorted = values.filter(x => !isNaN(x)).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - multiplier * iqr;
  const upper = q3 + multiplier * iqr;
  return values.map(x => !isNaN(x) && (x < lower || x > upper));
}

export function detectOutliersZScore(values: number[], threshold = 3): boolean[] {
  const m = mean(values.filter(x => !isNaN(x)));
  const s = stdDev(values.filter(x => !isNaN(x)), m);
  if (s === 0) return values.map(() => false);
  return values.map(x => !isNaN(x) && Math.abs((x - m) / s) > threshold);
}

export function clipOutliers(values: number[], lower: number, upper: number): number[] {
  return values.map(x => Math.max(lower, Math.min(upper, x)));
}

export function winsorize(values: number[], percentile = 0.05): number[] {
  const sorted = values.filter(x => !isNaN(x)).sort((a, b) => a - b);
  const lo = quantile(sorted, percentile);
  const hi = quantile(sorted, 1 - percentile);
  return values.map(x => isNaN(x) ? x : Math.max(lo, Math.min(hi, x)));
}

// ─── Feature Engineering (Financial) ─────────────────────────────────────────

export function lagFeatures(values: number[], lags: number[]): Feature[] {
  return lags.map(lag => ({
    name: `lag_${lag}`,
    type: 'continuous' as const,
    values: values.map((_, i) => i >= lag ? values[i - lag] : NaN),
  }));
}

export function returnFeatures(prices: number[], periods: number[] = [1]): Feature[] {
  return periods.map(p => ({
    name: `return_${p}`,
    type: 'continuous' as const,
    values: prices.map((v, i) => i >= p ? (v - prices[i - p]) / prices[i - p] : NaN),
  }));
}

export function logReturnFeatures(prices: number[], periods: number[] = [1]): Feature[] {
  return periods.map(p => ({
    name: `log_return_${p}`,
    type: 'continuous' as const,
    values: prices.map((v, i) =>
      i >= p && prices[i - p] > 0 ? Math.log(v / prices[i - p]) : NaN
    ),
  }));
}

export function rollingStatFeatures(
  values: number[],
  window: number,
  stats: ('mean' | 'std' | 'min' | 'max' | 'skew' | 'kurt')[] = ['mean', 'std'],
): Feature[] {
  const features: Feature[] = [];

  for (const stat of stats) {
    const result = new Array(values.length).fill(NaN);
    for (let i = window - 1; i < values.length; i++) {
      const win = values.slice(i - window + 1, i + 1);
      switch (stat) {
        case 'mean': result[i] = mean(win); break;
        case 'std': result[i] = stdDev(win); break;
        case 'min': result[i] = Math.min(...win); break;
        case 'max': result[i] = Math.max(...win); break;
        case 'skew': result[i] = skewness(win); break;
        case 'kurt': result[i] = kurtosis(win); break;
      }
    }
    features.push({ name: `rolling_${stat}_${window}`, type: 'continuous', values: result });
  }

  return features;
}

export function calendarFeatures(timestamps: number[]): Feature[] {
  const dow: number[] = [], month: number[] = [], quarter: number[] = [];
  for (const ts of timestamps) {
    const d = new Date(ts);
    dow.push(d.getDay());
    month.push(d.getMonth() + 1);
    quarter.push(Math.ceil((d.getMonth() + 1) / 3));
  }
  return [
    { name: 'day_of_week', type: 'categorical', values: dow },
    { name: 'month', type: 'categorical', values: month },
    { name: 'quarter', type: 'categorical', values: quarter },
  ];
}

export function crossSectionalRank(matrix: number[][]): number[][] {
  return matrix.map(row => {
    const sorted = [...row].sort((a, b) => a - b);
    return row.map(v => sorted.indexOf(v) / (row.length - 1 || 1));
  });
}

export function crossSectionalZScore(matrix: number[][]): number[][] {
  return matrix.map(row => {
    const m = mean(row);
    const s = stdDev(row, m);
    return s === 0 ? row.map(() => 0) : row.map(v => (v - m) / s);
  });
}

// ─── Train / Test / Validation Split ─────────────────────────────────────────

export function timeSeriesSplit(
  n: number,
  trainRatio: number,
  testRatio: number,
  validationRatio = 0,
  gap = 0,
): SplitIndices {
  const trainEnd = Math.floor(n * trainRatio);
  const testStart = trainEnd + gap;
  const testEnd = validationRatio > 0
    ? Math.floor(n * (trainRatio + testRatio))
    : n;
  const valStart = testEnd + gap;

  const trainIndices = Array.from({ length: trainEnd }, (_, i) => i);
  const testIndices = Array.from({ length: testEnd - testStart }, (_, i) => i + testStart);
  const validationIndices = validationRatio > 0
    ? Array.from({ length: n - valStart }, (_, i) => i + valStart)
    : undefined;

  return { trainIndices, testIndices, validationIndices };
}

export function walkForwardSplit(
  n: number,
  windowSize: number,
  stepSize: number,
  testSize: number,
  gap = 0,
): WalkForwardSplit {
  const splits: SplitIndices[] = [];
  let start = 0;

  while (start + windowSize + gap + testSize <= n) {
    const trainIndices = Array.from({ length: windowSize }, (_, i) => i + start);
    const testStart = start + windowSize + gap;
    const testIndices = Array.from({ length: testSize }, (_, i) => i + testStart);
    splits.push({ trainIndices, testIndices });
    start += stepSize;
  }

  return { splits, windowSize, stepSize };
}

// ─── PCA ─────────────────────────────────────────────────────────────────────

function symmetricEigen(
  A: number[][],
  maxIter = 200,
): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const V: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });
  const M = A.map(r => [...r]);

  for (let iter = 0; iter < maxIter; iter++) {
    let maxOff = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(M[i][j]) > Math.abs(maxOff)) { maxOff = M[i][j]; p = i; q = j; }

    if (Math.abs(maxOff) < 1e-12) break;

    const theta = 0.5 * Math.atan2(2 * M[p][q], M[p][p] - M[q][q]);
    const c = Math.cos(theta), s = Math.sin(theta);

    const newPP = c * c * M[p][p] + 2 * s * c * M[p][q] + s * s * M[q][q];
    const newQQ = s * s * M[p][p] - 2 * s * c * M[p][q] + c * c * M[q][q];

    M[p][p] = newPP;
    M[q][q] = newQQ;
    M[p][q] = 0;
    M[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i === p || i === q) continue;
      const ip = c * M[i][p] + s * M[i][q];
      const iq = -s * M[i][p] + c * M[i][q];
      M[i][p] = ip; M[p][i] = ip;
      M[i][q] = iq; M[q][i] = iq;
    }

    for (let i = 0; i < n; i++) {
      const vp = c * V[i][p] + s * V[i][q];
      const vq = -s * V[i][p] + c * V[i][q];
      V[i][p] = vp;
      V[i][q] = vq;
    }
  }

  const eigenvalues = Array.from({ length: n }, (_, i) => M[i][i]);
  const indices = eigenvalues.map((_, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);

  return {
    values: indices.map(i => eigenvalues[i]),
    vectors: indices.map(i => V.map(row => row[i])),
  };
}

export function pca(data: number[][], nComponents?: number): PCAResult {
  const n = data.length;
  const d = data[0].length;
  const k = nComponents ?? d;

  const means = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < n; i++) means[j] += data[i][j];
    means[j] /= n;
  }

  const centered = data.map(row => row.map((v, j) => v - means[j]));

  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++)
    for (let j = i; j < d; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += centered[r][i] * centered[r][j];
      cov[i][j] = s / (n - 1);
      cov[j][i] = cov[i][j];
    }

  const { values, vectors } = symmetricEigen(cov);

  const totalVar = values.reduce((a, b) => a + Math.max(0, b), 0);
  const explainedVariance = values.slice(0, k);
  const explainedVarianceRatio = explainedVariance.map(v => Math.max(0, v) / totalVar);

  const cumVar: number[] = [];
  let cum = 0;
  for (const r of explainedVarianceRatio) { cum += r; cumVar.push(cum); }

  const components = vectors.slice(0, k);
  const W = transpose(components);
  const transformedData = matMul(centered, W);

  return {
    components,
    explainedVariance,
    explainedVarianceRatio,
    cumulativeVariance: cumVar,
    nComponents: k,
    transformedData,
  };
}

// ─── Feature Selection ───────────────────────────────────────────────────────

export function correlationMatrix(features: Feature[]): number[][] {
  const n = features.length;
  const mat: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    mat[i][i] = 1;
    const vi = features[i].values;
    const mi = mean(vi), si = stdDev(vi, mi);
    for (let j = i + 1; j < n; j++) {
      const vj = features[j].values;
      const mj = mean(vj), sj = stdDev(vj, mj);
      if (si === 0 || sj === 0) { mat[i][j] = 0; mat[j][i] = 0; continue; }
      let cov = 0;
      for (let k = 0; k < vi.length; k++) cov += (vi[k] - mi) * (vj[k] - mj);
      const r = cov / (vi.length * si * sj);
      mat[i][j] = r;
      mat[j][i] = r;
    }
  }
  return mat;
}

export function selectByCorrelation(
  features: Feature[],
  target: number[],
  threshold = 0.1,
): Feature[] {
  const tMean = mean(target);
  const tStd = stdDev(target, tMean);
  if (tStd === 0) return [];

  return features.filter(f => {
    const fMean = mean(f.values);
    const fStd = stdDev(f.values, fMean);
    if (fStd === 0) return false;
    let cov = 0;
    for (let i = 0; i < f.values.length; i++)
      cov += (f.values[i] - fMean) * (target[i] - tMean);
    return Math.abs(cov / (f.values.length * fStd * tStd)) >= threshold;
  });
}

export function mutualInformation(x: number[], y: number[], bins = 10): number {
  const n = x.length;
  const xMin = Math.min(...x), xMax = Math.max(...x);
  const yMin = Math.min(...y), yMax = Math.max(...y);
  const xRange = (xMax - xMin) || 1, yRange = (yMax - yMin) || 1;

  const joint: number[][] = Array.from({ length: bins }, () => new Array(bins).fill(0));
  const margX = new Array(bins).fill(0);
  const margY = new Array(bins).fill(0);

  for (let i = 0; i < n; i++) {
    const bx = Math.min(bins - 1, Math.floor((x[i] - xMin) / xRange * bins));
    const by = Math.min(bins - 1, Math.floor((y[i] - yMin) / yRange * bins));
    joint[bx][by]++;
    margX[bx]++;
    margY[by]++;
  }

  let mi = 0;
  for (let i = 0; i < bins; i++)
    for (let j = 0; j < bins; j++) {
      if (joint[i][j] === 0 || margX[i] === 0 || margY[j] === 0) continue;
      const pxy = joint[i][j] / n;
      const px = margX[i] / n;
      const py = margY[j] / n;
      mi += pxy * Math.log(pxy / (px * py));
    }

  return Math.max(0, mi);
}

export function selectByMutualInformation(
  features: Feature[],
  target: number[],
  topK: number,
): Feature[] {
  const scores = features.map(f => ({
    feature: f,
    mi: mutualInformation(f.values, target),
  }));
  scores.sort((a, b) => b.mi - a.mi);
  return scores.slice(0, topK).map(s => s.feature);
}

export function removeHighlyCorrelated(features: Feature[], threshold = 0.95): Feature[] {
  const corrMat = correlationMatrix(features);
  const drop = new Set<number>();

  for (let i = 0; i < features.length; i++) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < features.length; j++) {
      if (drop.has(j)) continue;
      if (Math.abs(corrMat[i][j]) > threshold) drop.add(j);
    }
  }

  return features.filter((_, i) => !drop.has(i));
}
