import type {
  ConfusionMatrix, ClassificationReport, ValidationResult,
  FeatureImportance, SplitIndices,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

function stdDevSample(v: number[]): number {
  const m = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) ** 2;
  return Math.sqrt(s / (v.length - 1));
}

// ─── Regression Metrics ──────────────────────────────────────────────────────

export function meanSquaredError(y: number[], yHat: number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += (y[i] - yHat[i]) ** 2;
  return s / y.length;
}

export function rootMeanSquaredError(y: number[], yHat: number[]): number {
  return Math.sqrt(meanSquaredError(y, yHat));
}

export function meanAbsoluteError(y: number[], yHat: number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - yHat[i]);
  return s / y.length;
}

export function meanAbsolutePercentageError(y: number[], yHat: number[]): number {
  let s = 0, count = 0;
  for (let i = 0; i < y.length; i++) {
    if (y[i] === 0) continue;
    s += Math.abs((y[i] - yHat[i]) / y[i]);
    count++;
  }
  return count > 0 ? s / count : 0;
}

export function rSquared(y: number[], yHat: number[]): number {
  const m = mean(y);
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    ssRes += (y[i] - yHat[i]) ** 2;
    ssTot += (y[i] - m) ** 2;
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

export function adjustedRSquared(y: number[], yHat: number[], nFeatures: number): number {
  const n = y.length;
  const r2 = rSquared(y, yHat);
  if (n <= nFeatures + 1) return r2;
  return 1 - (1 - r2) * (n - 1) / (n - nFeatures - 1);
}

// ─── Classification Metrics ──────────────────────────────────────────────────

export function accuracy(y: number[], yHat: number[]): number {
  let correct = 0;
  for (let i = 0; i < y.length; i++) if (y[i] === yHat[i]) correct++;
  return correct / y.length;
}

export function confusionMatrix(y: number[], yHat: number[]): ConfusionMatrix {
  const labels = [...new Set([...y, ...yHat])].sort((a, b) => a - b);
  const labelMap = new Map(labels.map((l, i) => [l, i]));
  const n = labels.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < y.length; i++) {
    const r = labelMap.get(y[i])!;
    const c = labelMap.get(yHat[i])!;
    matrix[r][c]++;
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;
  if (n === 2) {
    tp = matrix[1][1]; fp = matrix[0][1];
    fn = matrix[1][0]; tn = matrix[0][0];
  } else {
    tp = matrix[0][0];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === 0 && j === 0) continue;
        if (i !== 0 && j !== 0) tn++;
        else if (j === 0) fn++;
        else fp++;
      }
  }

  return {
    matrix,
    labels: labels.map(String),
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
  };
}

export function precision(y: number[], yHat: number[], posLabel = 1): number {
  let tp = 0, fp = 0;
  for (let i = 0; i < y.length; i++) {
    if (yHat[i] === posLabel) {
      if (y[i] === posLabel) tp++;
      else fp++;
    }
  }
  return tp + fp === 0 ? 0 : tp / (tp + fp);
}

export function recall(y: number[], yHat: number[], posLabel = 1): number {
  let tp = 0, fn = 0;
  for (let i = 0; i < y.length; i++) {
    if (y[i] === posLabel) {
      if (yHat[i] === posLabel) tp++;
      else fn++;
    }
  }
  return tp + fn === 0 ? 0 : tp / (tp + fn);
}

export function f1Score(y: number[], yHat: number[], posLabel = 1): number {
  const p = precision(y, yHat, posLabel);
  const r = recall(y, yHat, posLabel);
  return p + r === 0 ? 0 : 2 * p * r / (p + r);
}

export function classificationReport(y: number[], yHat: number[]): ClassificationReport {
  const labels = [...new Set([...y, ...yHat])].sort((a, b) => a - b);
  const prec: Record<string, number> = {};
  const rec: Record<string, number> = {};
  const f1: Record<string, number> = {};
  const support: Record<string, number> = {};

  for (const label of labels) {
    const key = String(label);
    prec[key] = precision(y, yHat, label);
    rec[key] = recall(y, yHat, label);
    f1[key] = f1Score(y, yHat, label);
    support[key] = y.filter(v => v === label).length;
  }

  const totalSupport = y.length;
  let macroP = 0, macroR = 0, macroF = 0;
  let weightedP = 0, weightedR = 0, weightedF = 0;

  for (const key of Object.keys(prec)) {
    macroP += prec[key];
    macroR += rec[key];
    macroF += f1[key];
    const w = support[key] / totalSupport;
    weightedP += prec[key] * w;
    weightedR += rec[key] * w;
    weightedF += f1[key] * w;
  }
  const nLabels = Object.keys(prec).length;

  return {
    precision: prec,
    recall: rec,
    f1Score: f1,
    support,
    accuracy: accuracy(y, yHat),
    macroAvg: { precision: macroP / nLabels, recall: macroR / nLabels, f1: macroF / nLabels },
    weightedAvg: { precision: weightedP, recall: weightedR, f1: weightedF },
  };
}

// ─── AUC-ROC ─────────────────────────────────────────────────────────────────

export function aucRoc(yTrue: number[], scores: number[]): number {
  const n = yTrue.length;
  const pairs = scores.map((s, i) => ({ score: s, label: yTrue[i] }))
    .sort((a, b) => b.score - a.score);

  let tp = 0, fp = 0;
  const nPos = yTrue.filter(y => y === 1).length;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;

  let auc = 0;
  let prevTPR = 0, prevFPR = 0;

  for (let i = 0; i < n; i++) {
    if (pairs[i].label === 1) tp++;
    else fp++;

    const tpr = tp / nPos;
    const fpr = fp / nNeg;
    auc += (fpr - prevFPR) * (tpr + prevTPR) / 2;
    prevTPR = tpr;
    prevFPR = fpr;
  }

  return auc;
}

// ─── Cross-Validation ────────────────────────────────────────────────────────

export function kFoldSplit(n: number, k: number, shuffle = false, seed = 42): SplitIndices[] {
  let indices = Array.from({ length: n }, (_, i) => i);
  if (shuffle) {
    let s = seed;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }

  const foldSize = Math.floor(n / k);
  const splits: SplitIndices[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === k - 1 ? n : (fold + 1) * foldSize;
    const testIndices = indices.slice(testStart, testEnd);
    const trainIndices = [...indices.slice(0, testStart), ...indices.slice(testEnd)];
    splits.push({ trainIndices, testIndices });
  }

  return splits;
}

export function timeSeriesCVSplit(n: number, minTrain: number, step: number): SplitIndices[] {
  const splits: SplitIndices[] = [];
  for (let trainEnd = minTrain; trainEnd < n; trainEnd += step) {
    const testEnd = Math.min(trainEnd + step, n);
    splits.push({
      trainIndices: Array.from({ length: trainEnd }, (_, i) => i),
      testIndices: Array.from({ length: testEnd - trainEnd }, (_, i) => i + trainEnd),
    });
  }
  return splits;
}

export function purgedCVSplit(
  n: number,
  k: number,
  embargoSize: number,
): SplitIndices[] {
  const foldSize = Math.floor(n / k);
  const splits: SplitIndices[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === k - 1 ? n : (fold + 1) * foldSize;
    const embargoEnd = Math.min(testEnd + embargoSize, n);

    const trainIndices: number[] = [];
    for (let i = 0; i < testStart; i++) trainIndices.push(i);
    for (let i = embargoEnd; i < n; i++) trainIndices.push(i);

    const testIndices = Array.from({ length: testEnd - testStart }, (_, i) => i + testStart);
    splits.push({ trainIndices, testIndices });
  }

  return splits;
}

export function crossValidate(
  fitPredict: (trainX: number[][], trainY: number[], testX: number[][]) => number[],
  X: number[][],
  y: number[],
  splits: SplitIndices[],
  metricFn: (y: number[], yHat: number[]) => number,
): ValidationResult {
  const foldMetrics: Record<string, number>[] = [];

  for (const split of splits) {
    const trainX = split.trainIndices.map(i => X[i]);
    const trainY = split.trainIndices.map(i => y[i]);
    const testX = split.testIndices.map(i => X[i]);
    const testY = split.testIndices.map(i => y[i]);

    const predictions = fitPredict(trainX, trainY, testX);
    foldMetrics.push({ score: metricFn(testY, predictions) });
  }

  const scores = foldMetrics.map(m => m.score);
  const meanScore = mean(scores);
  const stdScore = scores.length > 1 ? stdDevSample(scores) : 0;

  let bestFold = 0, worstFold = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestFold]) bestFold = i;
    if (scores[i] < scores[worstFold]) worstFold = i;
  }

  return {
    foldMetrics,
    meanMetrics: { score: meanScore },
    stdMetrics: { score: stdScore },
    bestFold,
    worstFold,
  };
}

// ─── Learning Curves ─────────────────────────────────────────────────────────

export function learningCurve(
  fitPredict: (trainX: number[][], trainY: number[], testX: number[][]) => number[],
  X: number[][],
  y: number[],
  trainSizes: number[],
  metricFn: (y: number[], yHat: number[]) => number,
  nSplits = 5,
): { trainSizes: number[]; trainScores: number[]; testScores: number[] } {
  const n = X.length;
  const testSize = Math.floor(n * 0.2);
  const testX = X.slice(n - testSize);
  const testY = y.slice(n - testSize);
  const trainPool = X.slice(0, n - testSize);
  const trainPoolY = y.slice(0, n - testSize);

  const trainScores: number[] = [];
  const testScores: number[] = [];

  for (const size of trainSizes) {
    const actualSize = Math.min(size, trainPool.length);
    const tX = trainPool.slice(0, actualSize);
    const tY = trainPoolY.slice(0, actualSize);

    const trainPred = fitPredict(tX, tY, tX);
    const testPred = fitPredict(tX, tY, testX);

    trainScores.push(metricFn(tY, trainPred));
    testScores.push(metricFn(testY, testPred));
  }

  return { trainSizes, trainScores, testScores };
}

// ─── Feature Importance (Permutation) ────────────────────────────────────────

export function permutationImportance(
  predict: (X: number[][]) => number[],
  X: number[][],
  y: number[],
  metricFn: (y: number[], yHat: number[]) => number,
  nRepeats = 5,
  seed = 42,
): FeatureImportance[] {
  const baseline = metricFn(y, predict(X));
  const d = X[0].length;
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  const importances: FeatureImportance[] = [];

  for (let f = 0; f < d; f++) {
    const drops: number[] = [];
    for (let rep = 0; rep < nRepeats; rep++) {
      const Xp = X.map(row => [...row]);
      for (let i = Xp.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [Xp[i][f], Xp[j][f]] = [Xp[j][f], Xp[i][f]];
      }
      drops.push(baseline - metricFn(y, predict(Xp)));
    }
    importances.push({
      featureName: `feature_${f}`,
      importance: mean(drops),
      rank: 0,
      stdDev: drops.length > 1 ? stdDevSample(drops) : 0,
    });
  }

  return importances
    .sort((a, b) => b.importance - a.importance)
    .map((fi, i) => ({ ...fi, rank: i + 1 }));
}

// ─── SHAP Approximation (Kernel SHAP) ───────────────────────────────────────

export function approximateShap(
  predict: (X: number[][]) => number[],
  X: number[][],
  backgroundData: number[][],
  nSamples = 100,
  seed = 42,
): { featureIndex: number; meanAbsShap: number }[] {
  const d = X[0].length;
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

  const shapValues = new Array(d).fill(0);
  const nBg = backgroundData.length;

  for (let sample = 0; sample < nSamples; sample++) {
    const xi = X[Math.floor(rng() * X.length)];
    const bg = backgroundData[Math.floor(rng() * nBg)];

    const perm = Array.from({ length: d }, (_, i) => i);
    for (let i = d - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    const current = [...bg];
    let prevPred = predict([current])[0];

    for (const f of perm) {
      current[f] = xi[f];
      const newPred = predict([current])[0];
      shapValues[f] += Math.abs(newPred - prevPred);
      prevPred = newPred;
    }
  }

  for (let f = 0; f < d; f++) shapValues[f] /= nSamples;

  return shapValues
    .map((v, i) => ({ featureIndex: i, meanAbsShap: v }))
    .sort((a, b) => b.meanAbsShap - a.meanAbsShap);
}

// ─── Bias-Variance Decomposition ─────────────────────────────────────────────

export function biasVarianceDecomposition(
  fitPredict: (trainX: number[][], trainY: number[], testX: number[][]) => number[],
  X: number[][],
  y: number[],
  nBootstraps = 50,
  seed = 42,
): { bias: number; variance: number; noise: number; totalError: number } {
  const n = X.length;
  const testSize = Math.floor(n * 0.2);
  const testX = X.slice(n - testSize);
  const testY = y.slice(n - testSize);
  const trainPool = X.slice(0, n - testSize);
  const trainPoolY = y.slice(0, n - testSize);

  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  const allPredictions: number[][] = [];

  for (let b = 0; b < nBootstraps; b++) {
    const indices: number[] = [];
    for (let i = 0; i < trainPool.length; i++) indices.push(Math.floor(rng() * trainPool.length));
    const bX = indices.map(i => trainPool[i]);
    const bY = indices.map(i => trainPoolY[i]);
    allPredictions.push(fitPredict(bX, bY, testX));
  }

  let biasSum = 0, varSum = 0;
  for (let i = 0; i < testSize; i++) {
    const preds = allPredictions.map(p => p[i]);
    const meanPred = mean(preds);
    biasSum += (testY[i] - meanPred) ** 2;
    let v = 0;
    for (const p of preds) v += (p - meanPred) ** 2;
    varSum += v / nBootstraps;
  }

  const bias = biasSum / testSize;
  const variance = varSum / testSize;
  const totalError = bias + variance;

  return { bias, variance, noise: 0, totalError };
}

// ─── Information Criteria ────────────────────────────────────────────────────

export function aic(nParams: number, logLikelihood: number): number {
  return 2 * nParams - 2 * logLikelihood;
}

export function bic(nParams: number, logLikelihood: number, nSamples: number): number {
  return nParams * Math.log(nSamples) - 2 * logLikelihood;
}

export function logLikelihoodGaussian(y: number[], yHat: number[]): number {
  const n = y.length;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (y[i] - yHat[i]) ** 2;
  const sigma2 = ss / n;
  if (sigma2 === 0) return 0;
  return -n / 2 * Math.log(2 * Math.PI * sigma2) - ss / (2 * sigma2);
}

// ─── Statistical Tests ───────────────────────────────────────────────────────

export function pairedTTest(
  scoresA: number[],
  scoresB: number[],
): { tStatistic: number; pValue: number; significant: boolean } {
  const n = scoresA.length;
  const diffs = scoresA.map((a, i) => a - scoresB[i]);
  const d = mean(diffs);
  const sd = stdDevSample(diffs);
  const se = sd / Math.sqrt(n);
  const t = se === 0 ? 0 : d / se;

  const df = n - 1;
  const pValue = 2 * tDistCdf(-Math.abs(t), df);

  return { tStatistic: t, pValue, significant: pValue < 0.05 };
}

export function wilcoxonSignedRank(
  scoresA: number[],
  scoresB: number[],
): { statistic: number; pValue: number; significant: boolean } {
  const diffs = scoresA.map((a, i) => a - scoresB[i]).filter(d => d !== 0);
  const n = diffs.length;
  if (n === 0) return { statistic: 0, pValue: 1, significant: false };

  const absDiffs = diffs.map(Math.abs);
  const ranks = rankData(absDiffs);

  let wPlus = 0, wMinus = 0;
  for (let i = 0; i < n; i++) {
    if (diffs[i] > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }

  const W = Math.min(wPlus, wMinus);
  const expectedW = n * (n + 1) / 4;
  const stdW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  const z = stdW === 0 ? 0 : (W - expectedW) / stdW;
  const pValue = 2 * normalCdf(-Math.abs(z));

  return { statistic: W, pValue, significant: pValue < 0.05 };
}

function rankData(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

function normalCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

function tDistCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let result = 0;
  const steps = 200;
  const dt = x / steps;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    result += Math.pow(t, a - 1) * Math.pow(1 - t, b - 1) * dt;
  }
  const beta = gammaLn(a) + gammaLn(b) - gammaLn(a + b);
  return result / Math.exp(beta);
}

function gammaLn(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
