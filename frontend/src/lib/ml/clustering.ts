import type { ClusterResult } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function mean(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

function centroid(points: number[][]): number[] {
  if (points.length === 0) return [];
  const d = points[0].length;
  const c = new Array(d).fill(0);
  for (const p of points) for (let j = 0; j < d; j++) c[j] += p[j];
  for (let j = 0; j < d; j++) c[j] /= points.length;
  return c;
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── K-Means ─────────────────────────────────────────────────────────────────

export interface KMeansConfig {
  k: number;
  maxIter?: number;
  tolerance?: number;
  seed?: number;
}

export class KMeans {
  private config: Required<KMeansConfig>;
  centers: number[][] = [];

  constructor(config: KMeansConfig) {
    this.config = {
      k: config.k,
      maxIter: config.maxIter ?? 300,
      tolerance: config.tolerance ?? 1e-6,
      seed: config.seed ?? 42,
    };
  }

  private kMeansPlusPlusInit(data: number[][]): number[][] {
    const rng = seededRng(this.config.seed);
    const n = data.length;
    const centers: number[][] = [data[Math.floor(rng() * n)]];

    for (let c = 1; c < this.config.k; c++) {
      const dists = data.map(p => {
        let minD = Infinity;
        for (const center of centers) minD = Math.min(minD, euclidean(p, center) ** 2);
        return minD;
      });
      const total = dists.reduce((a, b) => a + b, 0);
      if (total === 0) { centers.push(data[Math.floor(rng() * n)]); continue; }

      let r = rng() * total;
      for (let i = 0; i < n; i++) {
        r -= dists[i];
        if (r <= 0) { centers.push([...data[i]]); break; }
      }
      if (centers.length <= c) centers.push([...data[Math.floor(rng() * n)]]);
    }
    return centers;
  }

  fit(data: number[][]): ClusterResult {
    const n = data.length;
    this.centers = this.kMeansPlusPlusInit(data);
    let labels = new Array(n).fill(0);
    let inertia = Infinity;

    for (let iter = 0; iter < this.config.maxIter; iter++) {
      labels = data.map(p => {
        let minD = Infinity, minC = 0;
        for (let c = 0; c < this.config.k; c++) {
          const d = euclidean(p, this.centers[c]);
          if (d < minD) { minD = d; minC = c; }
        }
        return minC;
      });

      const newCenters = Array.from({ length: this.config.k }, (_, c) => {
        const members = data.filter((_, i) => labels[i] === c);
        return members.length > 0 ? centroid(members) : this.centers[c];
      });

      let maxShift = 0;
      for (let c = 0; c < this.config.k; c++)
        maxShift = Math.max(maxShift, euclidean(newCenters[c], this.centers[c]));
      this.centers = newCenters;
      if (maxShift < this.config.tolerance) break;
    }

    inertia = 0;
    for (let i = 0; i < n; i++) inertia += euclidean(data[i], this.centers[labels[i]]) ** 2;

    const clusterSizes = new Array(this.config.k).fill(0);
    for (const l of labels) clusterSizes[l]++;

    return {
      labels,
      centers: this.centers,
      inertia,
      silhouetteScore: silhouetteScore(data, labels),
      daviesBouldinIndex: daviesBouldinIndex(data, labels, this.centers),
      nClusters: this.config.k,
      clusterSizes,
    };
  }

  predict(data: number[][]): number[] {
    return data.map(p => {
      let minD = Infinity, minC = 0;
      for (let c = 0; c < this.centers.length; c++) {
        const d = euclidean(p, this.centers[c]);
        if (d < minD) { minD = d; minC = c; }
      }
      return minC;
    });
  }
}

// ─── Hierarchical Clustering ─────────────────────────────────────────────────

export type Linkage = 'single' | 'complete' | 'average' | 'ward';

export class HierarchicalClustering {
  private linkage: Linkage;

  constructor(linkage: Linkage = 'ward') { this.linkage = linkage; }

  fit(data: number[][], nClusters: number): ClusterResult {
    const n = data.length;
    const distMatrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? Infinity : euclidean(data[i], data[j]))
    );

    let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

    while (clusters.length > nClusters) {
      let minDist = Infinity, mergeA = 0, mergeB = 1;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = this.clusterDistance(clusters[i], clusters[j], distMatrix, data);
          if (d < minDist) { minDist = d; mergeA = i; mergeB = j; }
        }
      }

      const merged = [...clusters[mergeA], ...clusters[mergeB]];
      clusters = clusters.filter((_, i) => i !== mergeA && i !== mergeB);
      clusters.push(merged);
    }

    const labels = new Array(n).fill(0);
    for (let c = 0; c < clusters.length; c++)
      for (const idx of clusters[c]) labels[idx] = c;

    const centers = clusters.map(cl => centroid(cl.map(i => data[i])));
    const clusterSizes = clusters.map(c => c.length);

    return {
      labels,
      centers,
      nClusters,
      clusterSizes,
      silhouetteScore: silhouetteScore(data, labels),
      daviesBouldinIndex: daviesBouldinIndex(data, labels, centers),
    };
  }

  private clusterDistance(
    a: number[], b: number[], distMatrix: number[][], data: number[][],
  ): number {
    switch (this.linkage) {
      case 'single': {
        let min = Infinity;
        for (const i of a) for (const j of b) min = Math.min(min, distMatrix[i][j]);
        return min;
      }
      case 'complete': {
        let max = 0;
        for (const i of a) for (const j of b) max = Math.max(max, distMatrix[i][j]);
        return max;
      }
      case 'average': {
        let sum = 0, count = 0;
        for (const i of a) for (const j of b) { sum += distMatrix[i][j]; count++; }
        return sum / count;
      }
      case 'ward': {
        const cA = centroid(a.map(i => data[i]));
        const cB = centroid(b.map(i => data[i]));
        const cMerged = centroid([...a, ...b].map(i => data[i]));
        let ssA = 0, ssB = 0, ssMerged = 0;
        for (const i of a) ssA += euclidean(data[i], cA) ** 2;
        for (const i of b) ssB += euclidean(data[i], cB) ** 2;
        for (const i of [...a, ...b]) ssMerged += euclidean(data[i], cMerged) ** 2;
        return ssMerged - ssA - ssB;
      }
    }
  }
}

// ─── DBSCAN ──────────────────────────────────────────────────────────────────

export class DBSCAN {
  private eps: number;
  private minPts: number;

  constructor(eps = 0.5, minPts = 5) {
    this.eps = eps;
    this.minPts = minPts;
  }

  fit(data: number[][]): ClusterResult {
    const n = data.length;
    const labels = new Array(n).fill(-1);
    const visited = new Array(n).fill(false);
    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      visited[i] = true;
      const neighbors = this.regionQuery(data, i);

      if (neighbors.length < this.minPts) {
        labels[i] = -1;
        continue;
      }

      labels[i] = clusterId;
      const queue = [...neighbors];
      let qi = 0;

      while (qi < queue.length) {
        const j = queue[qi++];
        if (!visited[j]) {
          visited[j] = true;
          const jNeighbors = this.regionQuery(data, j);
          if (jNeighbors.length >= this.minPts)
            for (const k of jNeighbors) if (!queue.includes(k)) queue.push(k);
        }
        if (labels[j] === -1) labels[j] = clusterId;
        else if (labels[j] < 0) labels[j] = clusterId;
      }
      clusterId++;
    }

    const nClusters = clusterId;
    const clusterSizes = new Array(nClusters).fill(0);
    for (const l of labels) if (l >= 0) clusterSizes[l]++;

    const centers = Array.from({ length: nClusters }, (_, c) =>
      centroid(data.filter((_, i) => labels[i] === c))
    );

    return {
      labels,
      centers,
      nClusters,
      clusterSizes,
      silhouetteScore: nClusters > 1 ? silhouetteScore(data, labels) : 0,
    };
  }

  private regionQuery(data: number[][], idx: number): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < data.length; i++)
      if (i !== idx && euclidean(data[i], data[idx]) <= this.eps) neighbors.push(i);
    return neighbors;
  }
}

// ─── Gaussian Mixture Model ──────────────────────────────────────────────────

export class GaussianMixture {
  private k: number;
  private maxIter: number;
  private tol: number;
  means: number[][] = [];
  private covariances: number[][][] = [];
  private weights: number[] = [];

  constructor(k: number, maxIter = 100, tol = 1e-6) {
    this.k = k;
    this.maxIter = maxIter;
    this.tol = tol;
  }

  fit(data: number[][]): ClusterResult {
    const n = data.length;
    const d = data[0].length;

    this.weights = new Array(this.k).fill(1 / this.k);
    const rng = seededRng(42);
    const indices = Array.from({ length: n }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    this.means = indices.slice(0, this.k).map(i => [...data[i]]);
    this.covariances = Array.from({ length: this.k }, () => {
      const cov: number[][] = Array.from({ length: d }, (_, i) => {
        const row = new Array(d).fill(0);
        row[i] = 1;
        return row;
      });
      return cov;
    });

    let prevLl = -Infinity;

    for (let iter = 0; iter < this.maxIter; iter++) {
      // E-step
      const resp: number[][] = Array.from({ length: n }, () => new Array(this.k));
      for (let i = 0; i < n; i++) {
        let total = 0;
        for (let c = 0; c < this.k; c++) {
          resp[i][c] = this.weights[c] * this.gaussianPdf(data[i], this.means[c], this.covariances[c]);
          total += resp[i][c];
        }
        if (total === 0) total = 1e-300;
        for (let c = 0; c < this.k; c++) resp[i][c] /= total;
      }

      // M-step
      for (let c = 0; c < this.k; c++) {
        let nk = 0;
        for (let i = 0; i < n; i++) nk += resp[i][c];
        if (nk < 1e-10) nk = 1e-10;
        this.weights[c] = nk / n;

        const newMean = new Array(d).fill(0);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < d; j++) newMean[j] += resp[i][c] * data[i][j];
        for (let j = 0; j < d; j++) newMean[j] /= nk;
        this.means[c] = newMean;

        const newCov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
        for (let i = 0; i < n; i++) {
          const diff = data[i].map((v, j) => v - newMean[j]);
          for (let a = 0; a < d; a++)
            for (let b = 0; b < d; b++)
              newCov[a][b] += resp[i][c] * diff[a] * diff[b];
        }
        for (let a = 0; a < d; a++)
          for (let b = 0; b < d; b++) newCov[a][b] /= nk;
        for (let a = 0; a < d; a++) newCov[a][a] += 1e-6;
        this.covariances[c] = newCov;
      }

      let ll = 0;
      for (let i = 0; i < n; i++) {
        let p = 0;
        for (let c = 0; c < this.k; c++)
          p += this.weights[c] * this.gaussianPdf(data[i], this.means[c], this.covariances[c]);
        ll += Math.log(p + 1e-300);
      }

      if (Math.abs(ll - prevLl) < this.tol) break;
      prevLl = ll;
    }

    const labels = data.map(p => {
      let best = 0, bestP = -Infinity;
      for (let c = 0; c < this.k; c++) {
        const prob = this.weights[c] * this.gaussianPdf(p, this.means[c], this.covariances[c]);
        if (prob > bestP) { bestP = prob; best = c; }
      }
      return best;
    });

    const clusterSizes = new Array(this.k).fill(0);
    for (const l of labels) clusterSizes[l]++;

    return {
      labels,
      centers: this.means,
      nClusters: this.k,
      clusterSizes,
      silhouetteScore: silhouetteScore(data, labels),
    };
  }

  private gaussianPdf(x: number[], mu: number[], cov: number[][]): number {
    const d = x.length;
    const diff = x.map((v, i) => v - mu[i]);

    let det = 1;
    for (let i = 0; i < d; i++) det *= cov[i][i];
    det = Math.max(det, 1e-300);

    let exponent = 0;
    for (let i = 0; i < d; i++) {
      const invDiag = cov[i][i] > 1e-15 ? 1 / cov[i][i] : 0;
      exponent += diff[i] ** 2 * invDiag;
    }

    const norm = Math.pow(2 * Math.PI, -d / 2) * Math.pow(det, -0.5);
    return norm * Math.exp(-0.5 * exponent);
  }
}

// ─── Spectral Clustering ─────────────────────────────────────────────────────

export function spectralClustering(data: number[][], k: number, sigma = 1): ClusterResult {
  const n = data.length;
  const W: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 0 : Math.exp(-(euclidean(data[i], data[j]) ** 2) / (2 * sigma ** 2))
    )
  );

  const D = new Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) D[i] += W[i][j];

  const L: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      if (D[i] === 0 || D[j] === 0) return 0;
      return -W[i][j] / Math.sqrt(D[i] * D[j]);
    })
  );

  const embedding = powerIteration(L, k, n);
  const norms = embedding.map(row => {
    const n = Math.sqrt(row.reduce((a, b) => a + b * b, 0));
    return n > 0 ? n : 1;
  });
  const normalized = embedding.map((row, i) => row.map(v => v / norms[i]));

  const km = new KMeans({ k, maxIter: 100, seed: 42 });
  return km.fit(normalized);
}

function powerIteration(A: number[][], k: number, n: number): number[][] {
  const rng = seededRng(42);
  const vectors: number[][] = [];

  for (let v = 0; v < k; v++) {
    let vec = Array.from({ length: n }, () => rng() - 0.5);

    for (let iter = 0; iter < 100; iter++) {
      const newVec = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) newVec[i] += A[i][j] * vec[j];

      for (const prev of vectors) {
        let dp = 0;
        for (let i = 0; i < n; i++) dp += newVec[i] * prev[i];
        for (let i = 0; i < n; i++) newVec[i] -= dp * prev[i];
      }

      let norm = 0;
      for (let i = 0; i < n; i++) norm += newVec[i] ** 2;
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < n; i++) newVec[i] /= norm;

      vec = newVec;
    }
    vectors.push(vec);
  }

  return Array.from({ length: n }, (_, i) => vectors.map(v => v[i]));
}

// ─── Cluster Evaluation ──────────────────────────────────────────────────────

export function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  if (n < 2) return 0;

  const uniqueLabels = [...new Set(labels.filter(l => l >= 0))];
  if (uniqueLabels.length < 2) return 0;

  let totalSil = 0, count = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] < 0) continue;

    let intraSum = 0, intraCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j || labels[j] !== labels[i]) continue;
      intraSum += euclidean(data[i], data[j]);
      intraCount++;
    }
    const a = intraCount > 0 ? intraSum / intraCount : 0;

    let minInterDist = Infinity;
    for (const cl of uniqueLabels) {
      if (cl === labels[i]) continue;
      let interSum = 0, interCount = 0;
      for (let j = 0; j < n; j++) {
        if (labels[j] !== cl) continue;
        interSum += euclidean(data[i], data[j]);
        interCount++;
      }
      if (interCount > 0) minInterDist = Math.min(minInterDist, interSum / interCount);
    }
    const b = minInterDist === Infinity ? 0 : minInterDist;

    const sil = Math.max(a, b) === 0 ? 0 : (b - a) / Math.max(a, b);
    totalSil += sil;
    count++;
  }

  return count > 0 ? totalSil / count : 0;
}

export function daviesBouldinIndex(data: number[][], labels: number[], centers: number[][]): number {
  const k = centers.length;
  const scatters = new Array(k).fill(0);
  const counts = new Array(k).fill(0);

  for (let i = 0; i < data.length; i++) {
    if (labels[i] < 0 || labels[i] >= k) continue;
    scatters[labels[i]] += euclidean(data[i], centers[labels[i]]);
    counts[labels[i]]++;
  }
  for (let c = 0; c < k; c++) scatters[c] = counts[c] > 0 ? scatters[c] / counts[c] : 0;

  let dbIndex = 0;
  for (let i = 0; i < k; i++) {
    let maxR = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const d = euclidean(centers[i], centers[j]);
      const r = d > 0 ? (scatters[i] + scatters[j]) / d : 0;
      maxR = Math.max(maxR, r);
    }
    dbIndex += maxR;
  }
  return dbIndex / k;
}

export function calinskiHarabaszIndex(data: number[][], labels: number[], centers: number[][]): number {
  const n = data.length;
  const k = centers.length;
  if (k <= 1 || n <= k) return 0;

  const globalCenter = centroid(data);
  let bgss = 0, wgss = 0;

  const counts = new Array(k).fill(0);
  for (const l of labels) if (l >= 0 && l < k) counts[l]++;

  for (let c = 0; c < k; c++)
    bgss += counts[c] * euclidean(centers[c], globalCenter) ** 2;

  for (let i = 0; i < n; i++) {
    if (labels[i] < 0 || labels[i] >= k) continue;
    wgss += euclidean(data[i], centers[labels[i]]) ** 2;
  }

  return wgss === 0 ? 0 : (bgss / (k - 1)) / (wgss / (n - k));
}

export function elbowMethod(data: number[][], maxK = 10): { k: number[]; inertias: number[] } {
  const ks: number[] = [];
  const inertias: number[] = [];

  for (let k = 1; k <= Math.min(maxK, data.length); k++) {
    const km = new KMeans({ k, seed: 42 });
    const result = km.fit(data);
    ks.push(k);
    inertias.push(result.inertia!);
  }

  return { k: ks, inertias };
}
