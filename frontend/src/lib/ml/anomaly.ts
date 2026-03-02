import type { AnomalyResult } from './types';
import { AnomalyMethod } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function buildResult(isAnomaly: boolean[], scores: number[], threshold: number, method: AnomalyMethod): AnomalyResult {
  const anomalyIndices: number[] = [];
  for (let i = 0; i < isAnomaly.length; i++) if (isAnomaly[i]) anomalyIndices.push(i);
  return {
    isAnomaly,
    scores,
    threshold,
    anomalyIndices,
    anomalyRate: anomalyIndices.length / isAnomaly.length,
    details: { method, params: { threshold } },
  };
}

// ─── Z-Score ─────────────────────────────────────────────────────────────────

export function zScoreAnomaly(values: number[], threshold = 3): AnomalyResult {
  const mu = mean(values);
  const sigma = stdDev(values, mu);
  if (sigma === 0) return buildResult(values.map(() => false), values.map(() => 0), threshold, AnomalyMethod.ZScore);
  const scores = values.map(v => Math.abs((v - mu) / sigma));
  const isAnomaly = scores.map(s => s > threshold);
  return buildResult(isAnomaly, scores, threshold, AnomalyMethod.ZScore);
}

// ─── Modified Z-Score (MAD-based) ────────────────────────────────────────────

export function modifiedZScoreAnomaly(values: number[], threshold = 3.5): AnomalyResult {
  const med = median(values);
  const diffs = values.map(v => Math.abs(v - med));
  const mad = median(diffs);
  const factor = 0.6745;
  if (mad === 0) return buildResult(values.map(() => false), values.map(() => 0), threshold, AnomalyMethod.ModifiedZScore);
  const scores = values.map(v => Math.abs(factor * (v - med) / mad));
  const isAnomaly = scores.map(s => s > threshold);
  return buildResult(isAnomaly, scores, threshold, AnomalyMethod.ModifiedZScore);
}

// ─── Grubbs Test ─────────────────────────────────────────────────────────────

export function grubbsTest(values: number[], alpha = 0.05): AnomalyResult {
  const n = values.length;
  const mu = mean(values);
  const sigma = stdDev(values, mu);
  if (sigma === 0) return buildResult(values.map(() => false), values.map(() => 0), 0, AnomalyMethod.ZScore);

  const scores = values.map(v => Math.abs(v - mu) / sigma);
  const maxScore = Math.max(...scores);

  const tCrit = 2.0 + alpha;
  const grubbsCrit = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tCrit ** 2 / (n - 2 + tCrit ** 2));

  const isAnomaly = scores.map(s => s > grubbsCrit);
  return buildResult(isAnomaly, scores, grubbsCrit, AnomalyMethod.ZScore);
}

// ─── IQR-based ───────────────────────────────────────────────────────────────

export function iqrAnomaly(values: number[], multiplier = 1.5): AnomalyResult {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - multiplier * iqr;
  const upper = q3 + multiplier * iqr;

  const scores = values.map(v => {
    if (v < lower) return (lower - v) / (iqr || 1);
    if (v > upper) return (v - upper) / (iqr || 1);
    return 0;
  });
  const isAnomaly = values.map(v => v < lower || v > upper);
  return buildResult(isAnomaly, scores, multiplier, AnomalyMethod.IQR);
}

// ─── Isolation Forest ────────────────────────────────────────────────────────

interface IsolationNode {
  splitFeature: number;
  splitValue: number;
  left: IsolationNode | null;
  right: IsolationNode | null;
  size: number;
  isLeaf: boolean;
}

export class IsolationForest {
  private nTrees: number;
  private maxSamples: number;
  private trees: IsolationNode[] = [];
  private contamination: number;

  constructor(nTrees = 100, maxSamples = 256, contamination = 0.1) {
    this.nTrees = nTrees;
    this.maxSamples = maxSamples;
    this.contamination = contamination;
  }

  fit(data: number[][]): void {
    const n = data.length;
    const sampleSize = Math.min(this.maxSamples, n);
    const maxDepth = Math.ceil(Math.log2(sampleSize));
    const rng = seededRng(42);
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      const indices: number[] = [];
      for (let i = 0; i < sampleSize; i++) indices.push(Math.floor(rng() * n));
      const sample = indices.map(i => data[i]);
      this.trees.push(this.buildTree(sample, 0, maxDepth, rng));
    }
  }

  private buildTree(
    data: number[][], depth: number, maxDepth: number, rng: () => number,
  ): IsolationNode {
    if (data.length <= 1 || depth >= maxDepth) {
      return { splitFeature: -1, splitValue: 0, left: null, right: null, size: data.length, isLeaf: true };
    }

    const d = data[0].length;
    const f = Math.floor(rng() * d);
    let min = Infinity, max = -Infinity;
    for (const row of data) { min = Math.min(min, row[f]); max = Math.max(max, row[f]); }

    if (min === max) {
      return { splitFeature: -1, splitValue: 0, left: null, right: null, size: data.length, isLeaf: true };
    }

    const splitVal = min + rng() * (max - min);
    const left = data.filter(row => row[f] < splitVal);
    const right = data.filter(row => row[f] >= splitVal);

    return {
      splitFeature: f,
      splitValue: splitVal,
      left: this.buildTree(left, depth + 1, maxDepth, rng),
      right: this.buildTree(right, depth + 1, maxDepth, rng),
      size: data.length,
      isLeaf: false,
    };
  }

  private pathLength(node: IsolationNode, x: number[], depth: number): number {
    if (node.isLeaf) return depth + this.harmonicEstimate(node.size);
    if (x[node.splitFeature] < node.splitValue)
      return this.pathLength(node.left!, x, depth + 1);
    return this.pathLength(node.right!, x, depth + 1);
  }

  private harmonicEstimate(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
  }

  detect(data: number[][]): AnomalyResult {
    const n = data.length;
    const c = this.harmonicEstimate(Math.min(this.maxSamples, n));
    const scores = data.map(x => {
      let avgPath = 0;
      for (const tree of this.trees) avgPath += this.pathLength(tree, x, 0);
      avgPath /= this.trees.length;
      return Math.pow(2, -avgPath / c);
    });

    const sorted = [...scores].sort((a, b) => b - a);
    const thresholdIdx = Math.floor(this.contamination * n);
    const threshold = sorted[Math.max(0, thresholdIdx)];
    const isAnomaly = scores.map(s => s >= threshold);

    return buildResult(isAnomaly, scores, threshold, AnomalyMethod.IsolationForest);
  }
}

// ─── Local Outlier Factor ────────────────────────────────────────────────────

export class LocalOutlierFactor {
  private k: number;
  private contamination: number;

  constructor(k = 20, contamination = 0.1) {
    this.k = k;
    this.contamination = contamination;
  }

  detect(data: number[][]): AnomalyResult {
    const n = data.length;
    const k = Math.min(this.k, n - 1);

    const distMatrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? Infinity : euclidean(data[i], data[j]))
    );

    const knn: { indices: number[]; distances: number[] }[] = distMatrix.map(row => {
      const sorted = row.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d).slice(0, k);
      return { indices: sorted.map(s => s.i), distances: sorted.map(s => s.d) };
    });

    const kDist = knn.map(nn => nn.distances[nn.distances.length - 1]);

    const reachDist = (i: number, j: number): number =>
      Math.max(kDist[j], distMatrix[i][j]);

    const lrd = new Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const j of knn[i].indices) sum += reachDist(i, j);
      lrd[i] = sum === 0 ? Infinity : k / sum;
    }

    const lof = new Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const j of knn[i].indices) sum += lrd[j];
      lof[i] = lrd[i] === 0 ? Infinity : (sum / k) / lrd[i];
    }

    const sortedLof = [...lof].sort((a, b) => b - a);
    const threshIdx = Math.floor(this.contamination * n);
    const threshold = sortedLof[Math.max(0, threshIdx)];
    const isAnomaly = lof.map(s => s >= threshold);

    return buildResult(isAnomaly, lof, threshold, AnomalyMethod.LOF);
  }
}

// ─── CUSUM ───────────────────────────────────────────────────────────────────

export function cusumAnomaly(
  values: number[],
  threshold = 5,
  drift = 0,
): AnomalyResult {
  const mu = mean(values);
  let sPos = 0, sNeg = 0;
  const scores: number[] = [];
  const isAnomaly: boolean[] = [];

  for (let i = 0; i < values.length; i++) {
    sPos = Math.max(0, sPos + (values[i] - mu) - drift);
    sNeg = Math.max(0, sNeg - (values[i] - mu) - drift);
    const score = Math.max(sPos, sNeg);
    scores.push(score);
    const anomaly = score > threshold;
    isAnomaly.push(anomaly);
    if (anomaly) { sPos = 0; sNeg = 0; }
  }

  return buildResult(isAnomaly, scores, threshold, AnomalyMethod.CUSUM);
}

// ─── Bollinger Band Anomaly ──────────────────────────────────────────────────

export function bollingerBandAnomaly(
  values: number[],
  window = 20,
  nStd = 2,
): AnomalyResult {
  const scores: number[] = new Array(values.length).fill(0);
  const isAnomaly: boolean[] = new Array(values.length).fill(false);

  for (let i = window - 1; i < values.length; i++) {
    const win = values.slice(i - window + 1, i + 1);
    const mu = mean(win);
    const sigma = stdDev(win, mu);
    if (sigma === 0) continue;
    const upper = mu + nStd * sigma;
    const lower = mu - nStd * sigma;
    const score = Math.abs(values[i] - mu) / sigma;
    scores[i] = score;
    isAnomaly[i] = values[i] > upper || values[i] < lower;
  }

  return buildResult(isAnomaly, scores, nStd, AnomalyMethod.ZScore);
}

// ─── Mahalanobis Distance ────────────────────────────────────────────────────

export function mahalanobisAnomaly(data: number[][], threshold = 3): AnomalyResult {
  const n = data.length;
  const d = data[0].length;

  const mu = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < n; i++) mu[j] += data[i][j];
    mu[j] /= n;
  }

  const covInvDiag = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (data[i][j] - mu[j]) ** 2;
    variance /= (n - 1);
    covInvDiag[j] = variance > 1e-15 ? 1 / variance : 0;
  }

  const scores = data.map(x => {
    let dist = 0;
    for (let j = 0; j < d; j++) dist += (x[j] - mu[j]) ** 2 * covInvDiag[j];
    return Math.sqrt(dist);
  });

  const isAnomaly = scores.map(s => s > threshold);
  return buildResult(isAnomaly, scores, threshold, AnomalyMethod.Mahalanobis);
}

// ─── PCA Reconstruction Error (Autoencoder Proxy) ────────────────────────────

export function pcaReconstructionAnomaly(
  data: number[][],
  nComponents: number,
  contamination = 0.1,
): AnomalyResult {
  const n = data.length;
  const d = data[0].length;

  const mu = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < n; i++) mu[j] += data[i][j];
    mu[j] /= n;
  }
  const centered = data.map(row => row.map((v, j) => v - mu[j]));

  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let a = 0; a < d; a++)
    for (let b = a; b < d; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += centered[i][a] * centered[i][b];
      cov[a][b] = s / (n - 1);
      cov[b][a] = cov[a][b];
    }

  const components = powerMethodPCA(cov, Math.min(nComponents, d));

  const scores = centered.map(x => {
    const projected = components.map(c => {
      let dp = 0;
      for (let j = 0; j < d; j++) dp += x[j] * c[j];
      return dp;
    });
    const reconstructed = new Array(d).fill(0);
    for (let k = 0; k < components.length; k++)
      for (let j = 0; j < d; j++) reconstructed[j] += projected[k] * components[k][j];

    let err = 0;
    for (let j = 0; j < d; j++) err += (x[j] - reconstructed[j]) ** 2;
    return Math.sqrt(err);
  });

  const sorted = [...scores].sort((a, b) => b - a);
  const threshIdx = Math.floor(contamination * n);
  const threshold = sorted[Math.max(0, threshIdx)];
  const isAnomaly = scores.map(s => s >= threshold);

  return buildResult(isAnomaly, scores, threshold, AnomalyMethod.PCAReconstruction);
}

function powerMethodPCA(cov: number[][], k: number): number[][] {
  const d = cov.length;
  const rng = seededRng(42);
  const components: number[][] = [];

  for (let comp = 0; comp < k; comp++) {
    let vec = Array.from({ length: d }, () => rng() - 0.5);

    for (let iter = 0; iter < 100; iter++) {
      const newVec = new Array(d).fill(0);
      for (let i = 0; i < d; i++)
        for (let j = 0; j < d; j++) newVec[i] += cov[i][j] * vec[j];

      for (const prev of components) {
        let dp = 0;
        for (let i = 0; i < d; i++) dp += newVec[i] * prev[i];
        for (let i = 0; i < d; i++) newVec[i] -= dp * prev[i];
      }

      let norm = 0;
      for (let i = 0; i < d; i++) norm += newVec[i] ** 2;
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < d; i++) newVec[i] /= norm;
      vec = newVec;
    }
    components.push(vec);

    let eigenval = 0;
    const Av = new Array(d).fill(0);
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++) Av[i] += cov[i][j] * vec[j];
    for (let i = 0; i < d; i++) eigenval += vec[i] * Av[i];

    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++)
        cov[i][j] -= eigenval * vec[i] * vec[j];
  }
  return components;
}

// ─── Sequential (Online) Anomaly Detection ───────────────────────────────────

export class OnlineAnomalyDetector {
  private windowSize: number;
  private threshold: number;
  private buffer: number[] = [];
  private runningMean = 0;
  private runningM2 = 0;
  private count = 0;

  constructor(windowSize = 100, threshold = 3) {
    this.windowSize = windowSize;
    this.threshold = threshold;
  }

  update(value: number): { isAnomaly: boolean; score: number } {
    this.count++;
    const delta = value - this.runningMean;
    this.runningMean += delta / this.count;
    this.runningM2 += delta * (value - this.runningMean);

    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    const variance = this.count > 1 ? this.runningM2 / (this.count - 1) : 0;
    const sigma = Math.sqrt(variance);
    const score = sigma > 0 ? Math.abs(value - this.runningMean) / sigma : 0;

    return { isAnomaly: score > this.threshold, score };
  }

  reset(): void {
    this.buffer = [];
    this.runningMean = 0;
    this.runningM2 = 0;
    this.count = 0;
  }
}

// ─── Market-specific Anomaly Detection ───────────────────────────────────────

export interface MarketAnomalyConfig {
  priceThreshold?: number;
  volumeThreshold?: number;
  correlationWindow?: number;
  correlationThreshold?: number;
}

export function detectMarketAnomalies(
  prices: number[],
  volumes: number[],
  config: MarketAnomalyConfig = {},
): {
  flashCrashes: AnomalyResult;
  unusualVolume: AnomalyResult;
  priceJumps: AnomalyResult;
} {
  const priceThreshold = config.priceThreshold ?? 3;
  const volumeThreshold = config.volumeThreshold ?? 3;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++)
    returns.push(prices[i - 1] !== 0 ? (prices[i] - prices[i - 1]) / prices[i - 1] : 0);

  const flashCrashes = zScoreAnomaly(returns, priceThreshold);
  flashCrashes.isAnomaly = flashCrashes.isAnomaly.map((a, i) => a && returns[i] < 0);
  flashCrashes.anomalyIndices = flashCrashes.isAnomaly
    .map((a, i) => a ? i : -1)
    .filter(i => i >= 0);
  flashCrashes.anomalyRate = flashCrashes.anomalyIndices.length / returns.length;

  const logVolumes = volumes.map(v => Math.log(v + 1));
  const unusualVolume = zScoreAnomaly(logVolumes, volumeThreshold);

  const absReturns = returns.map(Math.abs);
  const priceJumps = modifiedZScoreAnomaly(absReturns, priceThreshold);

  return { flashCrashes, unusualVolume, priceJumps };
}

export function correlationBreakDetection(
  seriesA: number[],
  seriesB: number[],
  window = 60,
  threshold = 2,
): AnomalyResult {
  const n = Math.min(seriesA.length, seriesB.length);
  const rollingCorr: number[] = new Array(n).fill(0);

  for (let i = window - 1; i < n; i++) {
    const a = seriesA.slice(i - window + 1, i + 1);
    const b = seriesB.slice(i - window + 1, i + 1);
    const ma = mean(a), mb = mean(b);
    let cov = 0, va = 0, vb = 0;
    for (let j = 0; j < window; j++) {
      cov += (a[j] - ma) * (b[j] - mb);
      va += (a[j] - ma) ** 2;
      vb += (b[j] - mb) ** 2;
    }
    const denom = Math.sqrt(va * vb);
    rollingCorr[i] = denom > 0 ? cov / denom : 0;
  }

  const validCorr = rollingCorr.slice(window - 1);
  const corrChanges: number[] = [0];
  for (let i = 1; i < validCorr.length; i++)
    corrChanges.push(Math.abs(validCorr[i] - validCorr[i - 1]));

  const result = zScoreAnomaly(corrChanges, threshold);
  const padded: boolean[] = new Array(window - 1).fill(false);
  const paddedScores: number[] = new Array(window - 1).fill(0);

  return buildResult(
    [...padded, ...result.isAnomaly],
    [...paddedScores, ...result.scores],
    threshold,
    AnomalyMethod.ZScore,
  );
}

// ─── Anomaly Scoring & Ranking ───────────────────────────────────────────────

export function rankAnomalies(
  results: AnomalyResult[],
): { index: number; combinedScore: number; methods: string[] }[] {
  const n = results[0].scores.length;
  const ranked: { index: number; combinedScore: number; methods: string[] }[] = [];

  for (let i = 0; i < n; i++) {
    let combined = 0;
    const methods: string[] = [];
    for (const r of results) {
      if (r.isAnomaly[i]) {
        combined += r.scores[i] / (r.threshold || 1);
        methods.push(r.details?.method ?? 'unknown');
      }
    }
    if (combined > 0) ranked.push({ index: i, combinedScore: combined, methods });
  }

  ranked.sort((a, b) => b.combinedScore - a.combinedScore);
  return ranked;
}
