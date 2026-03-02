import type { TrainingResult, PredictionResult, ModelConfig } from './types';
import { ModelType } from './types';

// ─── Linear Algebra Helpers ──────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(A: number[][], v: number[]): number[] {
  return A.map(row => dot(row, v));
}

function transpose(A: number[][]): number[][] {
  const m = A.length, n = A[0].length;
  const T: number[][] = Array.from({ length: n }, () => new Array(m));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      T[j][i] = A[i][j];
  return T;
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

function addDiag(A: number[][], lambda: number): number[][] {
  return A.map((row, i) => row.map((v, j) => v + (i === j ? lambda : 0)));
}

function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-15) continue;
    for (let j = col; j <= n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}

function mean(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

function addIntercept(X: number[][]): number[][] {
  return X.map(row => [1, ...row]);
}

function mse(y: number[], yHat: number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += (y[i] - yHat[i]) ** 2;
  return s / y.length;
}

function mae(y: number[], yHat: number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - yHat[i]);
  return s / y.length;
}

function rSquared(y: number[], yHat: number[]): number {
  const yMean = mean(y);
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    ssRes += (y[i] - yHat[i]) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

// ─── Linear Regression (OLS) ────────────────────────────────────────────────

export class LinearRegression {
  weights: number[] = [];
  bias = 0;

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const Xa = addIntercept(X);
    const Xt = transpose(Xa);
    const XtX = matMul(Xt, Xa);
    const Xty = matVec(Xt, y);
    const w = solve(XtX, Xty);

    this.bias = w[0];
    this.weights = w.slice(1);

    const yHat = this.predict(X).predictions;
    return {
      model: { type: ModelType.LinearRegression, hyperparameters: {} },
      trainMetrics: { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: 1,
      converged: true,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predict(X: number[][]): PredictionResult {
    return {
      predictions: X.map(row => this.bias + dot(row, this.weights)),
    };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Ridge Regression (L2) ──────────────────────────────────────────────────

export class RidgeRegression {
  weights: number[] = [];
  bias = 0;
  private alpha: number;

  constructor(alpha = 1.0) { this.alpha = alpha; }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const Xa = addIntercept(X);
    const Xt = transpose(Xa);
    const XtX = addDiag(matMul(Xt, Xa), this.alpha);
    const Xty = matVec(Xt, y);
    const w = solve(XtX, Xty);

    this.bias = w[0];
    this.weights = w.slice(1);

    const yHat = this.predict(X).predictions;
    return {
      model: { type: ModelType.RidgeRegression, hyperparameters: { alpha: this.alpha } },
      trainMetrics: { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: 1,
      converged: true,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.bias + dot(row, this.weights)) };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Lasso Regression (L1, Coordinate Descent) ─────────────────────────────

export class LassoRegression {
  weights: number[] = [];
  bias = 0;
  private alpha: number;
  private maxIter: number;
  private tol: number;

  constructor(alpha = 1.0, maxIter = 1000, tol = 1e-6) {
    this.alpha = alpha; this.maxIter = maxIter; this.tol = tol;
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length, d = X[0].length;
    const w = new Array(d).fill(0);
    let b = mean(y);
    let converged = false;
    let iter = 0;

    const colNorms = new Array(d).fill(0);
    for (let j = 0; j < d; j++)
      for (let i = 0; i < n; i++) colNorms[j] += X[i][j] ** 2;

    for (iter = 0; iter < this.maxIter; iter++) {
      const wOld = [...w];
      const bOld = b;

      for (let j = 0; j < d; j++) {
        let rho = 0;
        for (let i = 0; i < n; i++) {
          let pred = b;
          for (let k = 0; k < d; k++) if (k !== j) pred += X[i][k] * w[k];
          rho += X[i][j] * (y[i] - pred);
        }
        w[j] = this.softThreshold(rho, this.alpha * n) / (colNorms[j] || 1);
      }

      let resSum = 0;
      for (let i = 0; i < n; i++) resSum += y[i] - dot(X[i], w);
      b = resSum / n;

      let maxChange = Math.abs(b - bOld);
      for (let j = 0; j < d; j++) maxChange = Math.max(maxChange, Math.abs(w[j] - wOld[j]));
      if (maxChange < this.tol) { converged = true; break; }
    }

    this.weights = w;
    this.bias = b;
    const yHat = this.predict(X).predictions;

    return {
      model: { type: ModelType.LassoRegression, hyperparameters: { alpha: this.alpha } },
      trainMetrics: { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: iter,
      converged,
      weights: this.weights,
      bias: this.bias,
    };
  }

  private softThreshold(x: number, lambda: number): number {
    if (x > lambda) return x - lambda;
    if (x < -lambda) return x + lambda;
    return 0;
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.bias + dot(row, this.weights)) };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Elastic Net ─────────────────────────────────────────────────────────────

export class ElasticNet {
  weights: number[] = [];
  bias = 0;
  private alpha: number;
  private l1Ratio: number;
  private maxIter: number;
  private tol: number;

  constructor(alpha = 1.0, l1Ratio = 0.5, maxIter = 1000, tol = 1e-6) {
    this.alpha = alpha; this.l1Ratio = l1Ratio;
    this.maxIter = maxIter; this.tol = tol;
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length, d = X[0].length;
    const w = new Array(d).fill(0);
    let b = mean(y);
    let converged = false;
    let iter = 0;

    const l1 = this.alpha * this.l1Ratio;
    const l2 = this.alpha * (1 - this.l1Ratio);
    const colNorms = new Array(d).fill(0);
    for (let j = 0; j < d; j++)
      for (let i = 0; i < n; i++) colNorms[j] += X[i][j] ** 2;

    for (iter = 0; iter < this.maxIter; iter++) {
      const wOld = [...w];

      for (let j = 0; j < d; j++) {
        let rho = 0;
        for (let i = 0; i < n; i++) {
          let pred = b;
          for (let k = 0; k < d; k++) if (k !== j) pred += X[i][k] * w[k];
          rho += X[i][j] * (y[i] - pred);
        }
        const denom = colNorms[j] + l2 * n;
        if (rho > l1 * n) w[j] = (rho - l1 * n) / denom;
        else if (rho < -l1 * n) w[j] = (rho + l1 * n) / denom;
        else w[j] = 0;
      }

      let resSum = 0;
      for (let i = 0; i < n; i++) resSum += y[i] - dot(X[i], w);
      b = resSum / n;

      let maxChange = 0;
      for (let j = 0; j < d; j++) maxChange = Math.max(maxChange, Math.abs(w[j] - wOld[j]));
      if (maxChange < this.tol) { converged = true; break; }
    }

    this.weights = w;
    this.bias = b;
    const yHat = this.predict(X).predictions;

    return {
      model: { type: ModelType.ElasticNet, hyperparameters: { alpha: this.alpha, l1Ratio: this.l1Ratio } },
      trainMetrics: { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: iter,
      converged,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.bias + dot(row, this.weights)) };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Logistic Regression (Gradient Descent) ──────────────────────────────────

export class LogisticRegression {
  weights: number[] = [];
  bias = 0;
  private lr: number;
  private maxIter: number;
  private tol: number;
  private lambda: number;

  constructor(lr = 0.01, maxIter = 1000, tol = 1e-6, lambda = 0) {
    this.lr = lr; this.maxIter = maxIter; this.tol = tol; this.lambda = lambda;
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length, d = X[0].length;
    this.weights = new Array(d).fill(0);
    this.bias = 0;
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < this.maxIter; iter++) {
      const grads = new Array(d).fill(0);
      let gradBias = 0;

      for (let i = 0; i < n; i++) {
        const z = this.bias + dot(X[i], this.weights);
        const p = sigmoid(z);
        const err = p - y[i];
        gradBias += err;
        for (let j = 0; j < d; j++) grads[j] += err * X[i][j];
      }

      const prevWeights = [...this.weights];
      this.bias -= this.lr * gradBias / n;
      for (let j = 0; j < d; j++)
        this.weights[j] -= this.lr * (grads[j] / n + this.lambda * this.weights[j]);

      let maxChange = 0;
      for (let j = 0; j < d; j++)
        maxChange = Math.max(maxChange, Math.abs(this.weights[j] - prevWeights[j]));
      if (maxChange < this.tol) { converged = true; break; }
    }

    const yHat = this.predict(X);
    let correct = 0;
    for (let i = 0; i < n; i++) if (yHat.predictions[i] === y[i]) correct++;

    return {
      model: { type: ModelType.LogisticRegression, hyperparameters: { lr: this.lr, lambda: this.lambda } },
      trainMetrics: { accuracy: correct / n },
      trainingTime: performance.now() - start,
      iterations: iter,
      converged,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predictProbability(X: number[][]): number[] {
    return X.map(row => sigmoid(this.bias + dot(row, this.weights)));
  }

  predict(X: number[][], threshold = 0.5): PredictionResult {
    const probs = this.predictProbability(X);
    return {
      predictions: probs.map(p => p >= threshold ? 1 : 0),
      probabilities: probs.map(p => [1 - p, p]),
    };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    let correct = 0;
    for (let i = 0; i < y.length; i++) if (yHat[i] === y[i]) correct++;
    return { accuracy: correct / y.length };
  }
}

// ─── Robust Regression (Huber Loss) ─────────────────────────────────────────

export class HuberRegression {
  weights: number[] = [];
  bias = 0;
  private delta: number;
  private lr: number;
  private maxIter: number;
  private tol: number;

  constructor(delta = 1.35, lr = 0.001, maxIter = 1000, tol = 1e-6) {
    this.delta = delta; this.lr = lr; this.maxIter = maxIter; this.tol = tol;
  }

  private huberGrad(residual: number): number {
    return Math.abs(residual) <= this.delta
      ? residual
      : this.delta * Math.sign(residual);
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length, d = X[0].length;
    this.weights = new Array(d).fill(0);
    this.bias = 0;
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < this.maxIter; iter++) {
      const grads = new Array(d).fill(0);
      let gradBias = 0;

      for (let i = 0; i < n; i++) {
        const pred = this.bias + dot(X[i], this.weights);
        const r = y[i] - pred;
        const g = this.huberGrad(r);
        gradBias -= g;
        for (let j = 0; j < d; j++) grads[j] -= g * X[i][j];
      }

      const prev = [...this.weights];
      this.bias -= this.lr * gradBias / n;
      for (let j = 0; j < d; j++) this.weights[j] -= this.lr * grads[j] / n;

      let maxChange = 0;
      for (let j = 0; j < d; j++) maxChange = Math.max(maxChange, Math.abs(this.weights[j] - prev[j]));
      if (maxChange < this.tol) { converged = true; break; }
    }

    const yHat = this.predict(X).predictions;
    return {
      model: { type: ModelType.LinearRegression, hyperparameters: { huberDelta: this.delta } },
      trainMetrics: { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: iter,
      converged,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.bias + dot(row, this.weights)) };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { r2: rSquared(y, yHat), mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Quantile Regression (Gradient Descent on Pinball Loss) ──────────────────

export class QuantileRegression {
  weights: number[] = [];
  bias = 0;
  private quantile: number;
  private lr: number;
  private maxIter: number;
  private tol: number;

  constructor(quantile = 0.5, lr = 0.001, maxIter = 1000, tol = 1e-6) {
    this.quantile = quantile; this.lr = lr; this.maxIter = maxIter; this.tol = tol;
  }

  fit(X: number[][], y: number[]): TrainingResult {
    const start = performance.now();
    const n = X.length, d = X[0].length;
    this.weights = new Array(d).fill(0);
    this.bias = 0;
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < this.maxIter; iter++) {
      const grads = new Array(d).fill(0);
      let gradBias = 0;

      for (let i = 0; i < n; i++) {
        const pred = this.bias + dot(X[i], this.weights);
        const r = y[i] - pred;
        const g = r >= 0 ? -this.quantile : (1 - this.quantile);
        gradBias += g;
        for (let j = 0; j < d; j++) grads[j] += g * X[i][j];
      }

      const prev = [...this.weights];
      this.bias -= this.lr * gradBias / n;
      for (let j = 0; j < d; j++) this.weights[j] -= this.lr * grads[j] / n;

      let maxChange = 0;
      for (let j = 0; j < d; j++) maxChange = Math.max(maxChange, Math.abs(this.weights[j] - prev[j]));
      if (maxChange < this.tol) { converged = true; break; }
    }

    const yHat = this.predict(X).predictions;
    return {
      model: { type: ModelType.LinearRegression, hyperparameters: { quantile: this.quantile } },
      trainMetrics: { mse: mse(y, yHat), mae: mae(y, yHat) },
      trainingTime: performance.now() - start,
      iterations: iter,
      converged,
      weights: this.weights,
      bias: this.bias,
    };
  }

  predict(X: number[][]): PredictionResult {
    return { predictions: X.map(row => this.bias + dot(row, this.weights)) };
  }

  score(X: number[][], y: number[]): Record<string, number> {
    const yHat = this.predict(X).predictions;
    return { mse: mse(y, yHat), mae: mae(y, yHat) };
  }
}

// ─── Fama-MacBeth Regression ─────────────────────────────────────────────────

export interface FamaMacBethResult {
  meanCoefficients: number[];
  tStatistics: number[];
  standardErrors: number[];
  rSquaredSeries: number[];
}

export function famaMacBeth(
  crossSections: { X: number[][]; y: number[] }[],
): FamaMacBethResult {
  const T = crossSections.length;
  const d = crossSections[0].X[0].length;
  const allCoefs: number[][] = [];
  const r2Series: number[] = [];

  for (const cs of crossSections) {
    const model = new LinearRegression();
    model.fit(cs.X, cs.y);
    allCoefs.push([model.bias, ...model.weights]);
    const scores = model.score(cs.X, cs.y);
    r2Series.push(scores.r2);
  }

  const nCoefs = allCoefs[0].length;
  const meanCoefs = new Array(nCoefs).fill(0);
  for (const c of allCoefs) for (let j = 0; j < nCoefs; j++) meanCoefs[j] += c[j];
  for (let j = 0; j < nCoefs; j++) meanCoefs[j] /= T;

  const se = new Array(nCoefs).fill(0);
  for (const c of allCoefs)
    for (let j = 0; j < nCoefs; j++) se[j] += (c[j] - meanCoefs[j]) ** 2;
  for (let j = 0; j < nCoefs; j++) se[j] = Math.sqrt(se[j] / (T * (T - 1)));

  const tStats = meanCoefs.map((m, j) => se[j] === 0 ? 0 : m / se[j]);

  return {
    meanCoefficients: meanCoefs,
    tStatistics: tStats,
    standardErrors: se,
    rSquaredSeries: r2Series,
  };
}

// ─── Factor Model Estimation ─────────────────────────────────────────────────

export interface FactorModelResult {
  betas: number[][];
  alphas: number[];
  residuals: number[][];
  factorPremiums: number[];
  rSquared: number[];
}

export function estimateFactorModel(
  returns: number[][],
  factors: number[][],
): FactorModelResult {
  const nAssets = returns[0].length;
  const T = returns.length;
  const nFactors = factors[0].length;

  const betas: number[][] = [];
  const alphas: number[] = [];
  const residuals: number[][] = Array.from({ length: T }, () => new Array(nAssets));
  const r2s: number[] = [];

  for (let a = 0; a < nAssets; a++) {
    const y = returns.map(row => row[a]);
    const model = new LinearRegression();
    model.fit(factors, y);
    betas.push(model.weights);
    alphas.push(model.bias);

    const yHat = model.predict(factors).predictions;
    for (let t = 0; t < T; t++) residuals[t][a] = y[t] - yHat[t];
    r2s.push(model.score(factors, y).r2);
  }

  const factorPremiums = new Array(nFactors).fill(0);
  for (let f = 0; f < nFactors; f++) {
    for (let t = 0; t < T; t++) factorPremiums[f] += factors[t][f];
    factorPremiums[f] /= T;
  }

  return { betas, alphas, residuals, factorPremiums, rSquared: r2s };
}
