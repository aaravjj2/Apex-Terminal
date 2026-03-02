import type { PredictionResult, FeatureImportance, TrainingResult } from './types';
import { ModelType } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

function variance(v: number[]): number {
  const m = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) ** 2;
  return s / v.length;
}

function giniImpurity(labels: number[]): number {
  const counts = new Map<number, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let gini = 1;
  for (const c of counts.values()) gini -= (c / labels.length) ** 2;
  return gini;
}

function entropy(labels: number[]): number {
  const counts = new Map<number, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / labels.length;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function mseImpurity(values: number[]): number {
  return variance(values);
}

function maeImpurity(values: number[]): number {
  const med = sortedMedian(values);
  let s = 0;
  for (const v of values) s += Math.abs(v - med);
  return s / values.length;
}

function sortedMedian(v: number[]): number {
  const sorted = [...v].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function majorityVote(labels: number[]): number {
  const counts = new Map<number, number>();
  let best = labels[0], bestCount = 0;
  for (const l of labels) {
    const c = (counts.get(l) ?? 0) + 1;
    counts.set(l, c);
    if (c > bestCount) { best = l; bestCount = c; }
  }
  return best;
}

function bootstrapSample(n: number, rng: () => number): { inBag: number[]; oob: number[] } {
  const selected = new Set<number>();
  const inBag: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * n);
    inBag.push(idx);
    selected.add(idx);
  }
  const oob: number[] = [];
  for (let i = 0; i < n; i++) if (!selected.has(i)) oob.push(i);
  return { inBag, oob };
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── Decision Tree Node ──────────────────────────────────────────────────────

interface TreeNode {
  featureIndex: number;
  threshold: number;
  left: TreeNode | null;
  right: TreeNode | null;
  value: number;
  impurity: number;
  nSamples: number;
  isLeaf: boolean;
  depth: number;
}

type CriterionFn = (values: number[]) => number;

// ─── Decision Tree ───────────────────────────────────────────────────────────

export interface DecisionTreeConfig {
  task: 'classification' | 'regression';
  criterion?: 'gini' | 'entropy' | 'mse' | 'mae';
  maxDepth?: number;
  minSamplesSplit?: number;
  minSamplesLeaf?: number;
  maxFeatures?: number | 'sqrt' | 'log2';
  randomSeed?: number;
}

export class DecisionTree {
  root: TreeNode | null = null;
  private config: Required<DecisionTreeConfig>;
  private featureImportances_: number[] = [];
  private nFeatures = 0;
  private criterionFn: CriterionFn;
  private rng: () => number;

  constructor(config: DecisionTreeConfig) {
    this.config = {
      task: config.task,
      criterion: config.criterion ?? (config.task === 'classification' ? 'gini' : 'mse'),
      maxDepth: config.maxDepth ?? 20,
      minSamplesSplit: config.minSamplesSplit ?? 2,
      minSamplesLeaf: config.minSamplesLeaf ?? 1,
      maxFeatures: config.maxFeatures ?? 'sqrt',
      randomSeed: config.randomSeed ?? 42,
    };

    this.rng = seededRng(this.config.randomSeed);

    const criterionMap: Record<string, CriterionFn> = {
      gini: giniImpurity, entropy, mse: mseImpurity, mae: maeImpurity,
    };
    this.criterionFn = criterionMap[this.config.criterion];
  }

  private getMaxFeatures(nFeatures: number): number {
    const mf = this.config.maxFeatures;
    if (typeof mf === 'number') return Math.min(mf, nFeatures);
    if (mf === 'sqrt') return Math.max(1, Math.floor(Math.sqrt(nFeatures)));
    if (mf === 'log2') return Math.max(1, Math.floor(Math.log2(nFeatures)));
    return nFeatures;
  }

  private selectFeatures(nFeatures: number): number[] {
    const k = this.getMaxFeatures(nFeatures);
    if (k >= nFeatures) return Array.from({ length: nFeatures }, (_, i) => i);
    const indices = Array.from({ length: nFeatures }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, k);
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    this.nFeatures = X[0].length;
    this.featureImportances_ = new Array(this.nFeatures).fill(0);
    const indices = Array.from({ length: X.length }, (_, i) => i);
    this.root = this.buildTree(X, y, indices, 0);
    this.normalizeImportances();

    const yHat = this.predict(X).predictions;
    const metrics = this.computeMetrics(y, yHat);

    return {
      model: { type: ModelType.DecisionTree, hyperparameters: { ...this.config } as unknown as Record<string, string | number | boolean> },
      trainMetrics: metrics,
      trainingTime: performance.now() - start,
      iterations: 1,
      converged: true,
    };
  }

  private buildTree(X: number[][], y: number[], indices: number[], depth: number): TreeNode {
    const labels = indices.map(i => y[i]);
    const leafValue = this.config.task === 'classification' ? majorityVote(labels) : mean(labels);
    const impurity = this.criterionFn(labels);

    if (
      depth >= this.config.maxDepth ||
      indices.length < this.config.minSamplesSplit ||
      impurity === 0
    ) {
      return { featureIndex: -1, threshold: 0, left: null, right: null, value: leafValue, impurity, nSamples: indices.length, isLeaf: true, depth };
    }

    let bestGain = 0, bestFeature = -1, bestThreshold = 0;
    let bestLeft: number[] = [], bestRight: number[] = [];

    const featureSubset = this.selectFeatures(this.nFeatures);

    for (const f of featureSubset) {
      const featureVals = indices.map(i => X[i][f]);
      const uniqueVals = [...new Set(featureVals)].sort((a, b) => a - b);

      for (let t = 0; t < uniqueVals.length - 1; t++) {
        const thresh = (uniqueVals[t] + uniqueVals[t + 1]) / 2;
        const leftIdx: number[] = [], rightIdx: number[] = [];
        for (const i of indices) {
          if (X[i][f] <= thresh) leftIdx.push(i);
          else rightIdx.push(i);
        }

        if (leftIdx.length < this.config.minSamplesLeaf || rightIdx.length < this.config.minSamplesLeaf)
          continue;

        const leftLabels = leftIdx.map(i => y[i]);
        const rightLabels = rightIdx.map(i => y[i]);
        const leftImp = this.criterionFn(leftLabels);
        const rightImp = this.criterionFn(rightLabels);

        const wl = leftIdx.length / indices.length;
        const wr = rightIdx.length / indices.length;
        const gain = impurity - wl * leftImp - wr * rightImp;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = thresh;
          bestLeft = leftIdx;
          bestRight = rightIdx;
        }
      }
    }

    if (bestGain <= 0 || bestFeature < 0) {
      return { featureIndex: -1, threshold: 0, left: null, right: null, value: leafValue, impurity, nSamples: indices.length, isLeaf: true, depth };
    }

    this.featureImportances_[bestFeature] += bestGain * indices.length;

    return {
      featureIndex: bestFeature,
      threshold: bestThreshold,
      left: this.buildTree(X, y, bestLeft, depth + 1),
      right: this.buildTree(X, y, bestRight, depth + 1),
      value: leafValue,
      impurity,
      nSamples: indices.length,
      isLeaf: false,
      depth,
    };
  }

  private normalizeImportances(): void {
    const sum = this.featureImportances_.reduce((a, b) => a + b, 0);
    if (sum > 0) this.featureImportances_ = this.featureImportances_.map(v => v / sum);
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.predictOne(this.root!, row)) };
  }

  private predictOne(node: TreeNode, x: number[]): number {
    if (node.isLeaf) return node.value;
    return x[node.featureIndex] <= node.threshold
      ? this.predictOne(node.left!, x)
      : this.predictOne(node.right!, x);
  }

  featureImportance(): FeatureImportance[] {
    return this.featureImportances_.map((imp, i) => ({
      featureName: `feature_${i}`,
      importance: imp,
      rank: 0,
    })).sort((a, b) => b.importance - a.importance).map((fi, i) => ({ ...fi, rank: i + 1 }));
  }

  private computeMetrics(y: number[], yHat: number[]): Record<string, number> {
    if (this.config.task === 'classification') {
      let correct = 0;
      for (let i = 0; i < y.length; i++) if (y[i] === yHat[i]) correct++;
      return { accuracy: correct / y.length };
    }
    const m = mean(y);
    let ssRes = 0, ssTot = 0, mseVal = 0, maeVal = 0;
    for (let i = 0; i < y.length; i++) {
      ssRes += (y[i] - yHat[i]) ** 2;
      ssTot += (y[i] - m) ** 2;
      mseVal += (y[i] - yHat[i]) ** 2;
      maeVal += Math.abs(y[i] - yHat[i]);
    }
    return { r2: 1 - ssRes / (ssTot || 1), mse: mseVal / y.length, mae: maeVal / y.length };
  }

  prune(X: number[][], y: number[], alpha = 0.01): void {
    if (this.root) this.pruneNode(this.root, X, y, alpha);
  }

  private pruneNode(node: TreeNode, X: number[][], y: number[], alpha: number): number {
    if (node.isLeaf) {
      const indices = this.getNodeIndices(node, X);
      const labels = indices.map(i => y[i]);
      return this.criterionFn(labels) * labels.length + alpha;
    }

    const leftCost = this.pruneNode(node.left!, X, y, alpha);
    const rightCost = this.pruneNode(node.right!, X, y, alpha);
    const subtreeCost = leftCost + rightCost;

    const indices = this.getNodeIndices(node, X);
    const labels = indices.map(i => y[i]);
    const leafCost = this.criterionFn(labels) * labels.length + alpha;

    if (leafCost <= subtreeCost) {
      node.isLeaf = true;
      node.left = null;
      node.right = null;
      node.value = this.config.task === 'classification' ? majorityVote(labels) : mean(labels);
      return leafCost;
    }
    return subtreeCost;
  }

  private getNodeIndices(node: TreeNode, X: number[][]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < X.length; i++) {
      if (this.predictOne(this.root!, X[i]) === node.value) indices.push(i);
    }
    return indices.length > 0 ? indices : [0];
  }
}

// ─── Random Forest ───────────────────────────────────────────────────────────

export interface RandomForestConfig {
  task: 'classification' | 'regression';
  nEstimators?: number;
  maxDepth?: number;
  minSamplesSplit?: number;
  minSamplesLeaf?: number;
  maxFeatures?: number | 'sqrt' | 'log2';
  randomSeed?: number;
  oobScore?: boolean;
}

export class RandomForest {
  private trees: DecisionTree[] = [];
  private oobPredictions: Map<number, number[]> = new Map();
  private config: Required<RandomForestConfig>;
  oobScore_: number = NaN;

  constructor(config: RandomForestConfig) {
    this.config = {
      task: config.task,
      nEstimators: config.nEstimators ?? 100,
      maxDepth: config.maxDepth ?? 15,
      minSamplesSplit: config.minSamplesSplit ?? 2,
      minSamplesLeaf: config.minSamplesLeaf ?? 1,
      maxFeatures: config.maxFeatures ?? 'sqrt',
      randomSeed: config.randomSeed ?? 42,
      oobScore: config.oobScore ?? true,
    };
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length;
    const rng = seededRng(this.config.randomSeed);
    this.trees = [];
    this.oobPredictions = new Map();

    for (let t = 0; t < this.config.nEstimators; t++) {
      const { inBag, oob } = bootstrapSample(n, rng);
      const Xb = inBag.map(i => X[i]);
      const yb = inBag.map(i => y[i]);

      const tree = new DecisionTree({
        task: this.config.task,
        maxDepth: this.config.maxDepth,
        minSamplesSplit: this.config.minSamplesSplit,
        minSamplesLeaf: this.config.minSamplesLeaf,
        maxFeatures: this.config.maxFeatures,
        randomSeed: Math.floor(rng() * 1e9),
      });
      tree.fit(Xb, yb);
      this.trees.push(tree);

      if (this.config.oobScore) {
        for (const i of oob) {
          const pred = tree.predict([X[i]]).predictions[0];
          if (!this.oobPredictions.has(i)) this.oobPredictions.set(i, []);
          this.oobPredictions.get(i)!.push(pred);
        }
      }
    }

    if (this.config.oobScore) this.computeOobScore(y);

    const yHat = this.predict(X).predictions;
    const metrics = this.computeMetrics(y, yHat);
    if (!isNaN(this.oobScore_)) metrics.oobScore = this.oobScore_;

    return {
      model: { type: ModelType.RandomForest, hyperparameters: { nEstimators: this.config.nEstimators, maxDepth: this.config.maxDepth } },
      trainMetrics: metrics,
      trainingTime: performance.now() - start,
      iterations: this.config.nEstimators,
      converged: true,
    };
  }

  private computeOobScore(y: number[]): void {
    let correct = 0, total = 0;
    let ssRes = 0, ssTot = 0;
    const yMean = mean(y);

    for (const [i, preds] of this.oobPredictions) {
      const avgPred = this.config.task === 'classification' ? majorityVote(preds) : mean(preds);
      if (this.config.task === 'classification') {
        if (avgPred === y[i]) correct++;
      } else {
        ssRes += (y[i] - avgPred) ** 2;
        ssTot += (y[i] - yMean) ** 2;
      }
      total++;
    }

    this.oobScore_ = this.config.task === 'classification'
      ? (total > 0 ? correct / total : NaN)
      : (ssTot > 0 ? 1 - ssRes / ssTot : NaN);
  }

  predict(X: number[][]): PredictionResult {
    const allPreds = this.trees.map(t => t.predict(X).predictions);
    const predictions = X.map((_, i) => {
      const preds = allPreds.map(p => p[i]);
      return this.config.task === 'classification' ? majorityVote(preds) : mean(preds);
    });
    return { predictions };
  }

  featureImportance(): FeatureImportance[] {
    const d = this.trees[0].featureImportance().length;
    const agg = new Array(d).fill(0);
    for (const t of this.trees) {
      const imp = t.featureImportance();
      for (const fi of imp) {
        const idx = fi.rank - 1;
        if (idx >= 0 && idx < d) agg[idx] += fi.importance;
      }
    }
    const total = agg.reduce((a, b) => a + b, 0) || 1;
    return agg.map((v, i) => ({
      featureName: `feature_${i}`,
      importance: v / total,
      rank: 0,
    })).sort((a, b) => b.importance - a.importance).map((fi, i) => ({ ...fi, rank: i + 1 }));
  }

  permutationImportance(X: number[][], y: number[], nRepeats = 5): FeatureImportance[] {
    const baseline = this.scoreInternal(X, y);
    const d = X[0].length;
    const rng = seededRng(this.config.randomSeed + 999);
    const importances: FeatureImportance[] = [];

    for (let f = 0; f < d; f++) {
      let totalDrop = 0;
      for (let rep = 0; rep < nRepeats; rep++) {
        const Xp = X.map(row => [...row]);
        for (let i = Xp.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [Xp[i][f], Xp[j][f]] = [Xp[j][f], Xp[i][f]];
        }
        totalDrop += baseline - this.scoreInternal(Xp, y);
      }
      importances.push({
        featureName: `feature_${f}`,
        importance: totalDrop / nRepeats,
        rank: 0,
      });
    }

    return importances
      .sort((a, b) => b.importance - a.importance)
      .map((fi, i) => ({ ...fi, rank: i + 1 }));
  }

  private scoreInternal(X: number[][], y: number[]): number {
    const yHat = this.predict(X).predictions;
    if (this.config.task === 'classification') {
      let c = 0;
      for (let i = 0; i < y.length; i++) if (y[i] === yHat[i]) c++;
      return c / y.length;
    }
    const m = mean(y);
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < y.length; i++) {
      ssRes += (y[i] - yHat[i]) ** 2;
      ssTot += (y[i] - m) ** 2;
    }
    return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  }

  private computeMetrics(y: number[], yHat: number[]): Record<string, number> {
    if (this.config.task === 'classification') {
      let c = 0;
      for (let i = 0; i < y.length; i++) if (y[i] === yHat[i]) c++;
      return { accuracy: c / y.length };
    }
    const m = mean(y);
    let ssRes = 0, ssTot = 0, mseVal = 0;
    for (let i = 0; i < y.length; i++) {
      ssRes += (y[i] - yHat[i]) ** 2;
      ssTot += (y[i] - m) ** 2;
      mseVal += (y[i] - yHat[i]) ** 2;
    }
    return { r2: 1 - ssRes / (ssTot || 1), mse: mseVal / y.length };
  }
}

// ─── Gradient Boosted Trees ──────────────────────────────────────────────────

export interface GradientBoostedTreesConfig {
  task: 'classification' | 'regression';
  nEstimators?: number;
  learningRate?: number;
  maxDepth?: number;
  minSamplesSplit?: number;
  subsample?: number;
  randomSeed?: number;
}

export class GradientBoostedTrees {
  private trees: DecisionTree[] = [];
  private initialPrediction = 0;
  private config: Required<GradientBoostedTreesConfig>;
  private learningRate: number;

  constructor(config: GradientBoostedTreesConfig) {
    this.config = {
      task: config.task,
      nEstimators: config.nEstimators ?? 100,
      learningRate: config.learningRate ?? 0.1,
      maxDepth: config.maxDepth ?? 3,
      minSamplesSplit: config.minSamplesSplit ?? 2,
      subsample: config.subsample ?? 0.8,
      randomSeed: config.randomSeed ?? 42,
    };
    this.learningRate = this.config.learningRate;
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length;
    const rng = seededRng(this.config.randomSeed);

    this.initialPrediction = mean(y);
    const currentPred = new Array(n).fill(this.initialPrediction);
    this.trees = [];

    for (let t = 0; t < this.config.nEstimators; t++) {
      const residuals = y.map((yi, i) => yi - currentPred[i]);

      let sampleIndices: number[];
      if (this.config.subsample < 1) {
        const k = Math.floor(n * this.config.subsample);
        sampleIndices = [];
        const allIdx = Array.from({ length: n }, (_, i) => i);
        for (let i = allIdx.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [allIdx[i], allIdx[j]] = [allIdx[j], allIdx[i]];
        }
        sampleIndices = allIdx.slice(0, k);
      } else {
        sampleIndices = Array.from({ length: n }, (_, i) => i);
      }

      const Xs = sampleIndices.map(i => X[i]);
      const rs = sampleIndices.map(i => residuals[i]);

      const tree = new DecisionTree({
        task: 'regression',
        criterion: 'mse',
        maxDepth: this.config.maxDepth,
        minSamplesSplit: this.config.minSamplesSplit,
        maxFeatures: 'sqrt',
        randomSeed: Math.floor(rng() * 1e9),
      });
      tree.fit(Xs, rs);
      this.trees.push(tree);

      const treePred = tree.predict(X).predictions;
      for (let i = 0; i < n; i++) currentPred[i] += this.learningRate * treePred[i];
    }

    const yHat = this.predict(X).predictions;
    const metrics = this.computeMetrics(y, yHat);

    return {
      model: { type: ModelType.GradientBoostedTrees, hyperparameters: { nEstimators: this.config.nEstimators, learningRate: this.learningRate, maxDepth: this.config.maxDepth } },
      trainMetrics: metrics,
      trainingTime: performance.now() - start,
      iterations: this.config.nEstimators,
      converged: true,
    };
  }

  predict(X: number[][]): PredictionResult {
    const preds = new Array(X.length).fill(this.initialPrediction);
    for (const tree of this.trees) {
      const tp = tree.predict(X).predictions;
      for (let i = 0; i < X.length; i++) preds[i] += this.learningRate * tp[i];
    }

    if (this.config.task === 'classification') {
      return { predictions: preds.map(p => p >= 0.5 ? 1 : 0) };
    }
    return { predictions: preds };
  }

  featureImportance(): FeatureImportance[] {
    if (this.trees.length === 0) return [];
    const d = this.trees[0].featureImportance().length;
    const agg = new Array(d).fill(0);
    for (const t of this.trees) {
      const imp = t.featureImportance();
      for (const fi of imp) {
        const idx = parseInt(fi.featureName.split('_')[1]) || 0;
        if (idx < d) agg[idx] += fi.importance;
      }
    }
    const total = agg.reduce((a, b) => a + b, 0) || 1;
    return agg.map((v, i) => ({
      featureName: `feature_${i}`,
      importance: v / total,
      rank: 0,
    })).sort((a, b) => b.importance - a.importance).map((fi, i) => ({ ...fi, rank: i + 1 }));
  }

  private computeMetrics(y: number[], yHat: number[]): Record<string, number> {
    if (this.config.task === 'classification') {
      let c = 0;
      for (let i = 0; i < y.length; i++) if (y[i] === yHat[i]) c++;
      return { accuracy: c / y.length };
    }
    const m = mean(y);
    let ssRes = 0, ssTot = 0, mseVal = 0;
    for (let i = 0; i < y.length; i++) {
      ssRes += (y[i] - yHat[i]) ** 2;
      ssTot += (y[i] - m) ** 2;
      mseVal += (y[i] - yHat[i]) ** 2;
    }
    return { r2: 1 - ssRes / (ssTot || 1), mse: mseVal / y.length };
  }
}
