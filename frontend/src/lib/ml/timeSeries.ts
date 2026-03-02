import type { ForecastResult, RegimeState } from './types';

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
  return s / (v.length - 1);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function solveLinear(A: number[][], b: number[]): number[] {
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
      const f = aug[row][col];
      for (let j = col; j <= n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}

function difference(series: number[], d: number): number[] {
  let result = [...series];
  for (let i = 0; i < d; i++) {
    const next = new Array(result.length - 1);
    for (let j = 0; j < next.length; j++) next[j] = result[j + 1] - result[j];
    result = next;
  }
  return result;
}

function undifference(diffed: number[], original: number[], d: number): number[] {
  let result = [...diffed];
  for (let i = d - 1; i >= 0; i--) {
    const restored = new Array(result.length + 1);
    restored[0] = original[i];
    for (let j = 0; j < result.length; j++) restored[j + 1] = restored[j] + result[j];
    result = restored;
  }
  return result;
}

// ─── Auto-correlation ────────────────────────────────────────────────────────

export function autocorrelation(series: number[], maxLag: number): number[] {
  const n = series.length;
  const m = mean(series);
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (series[i] - m) ** 2;

  const result: number[] = [1];
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = lag; i < n; i++) num += (series[i] - m) * (series[i - lag] - m);
    result.push(denom === 0 ? 0 : num / denom);
  }
  return result;
}

export function partialAutocorrelation(series: number[], maxLag: number): number[] {
  const acf = autocorrelation(series, maxLag);
  const pacf: number[] = [1];

  for (let k = 1; k <= maxLag; k++) {
    const A: number[][] = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => acf[Math.abs(i - j)])
    );
    const b = acf.slice(1, k + 1);
    const phi = solveLinear(A, b);
    pacf.push(phi[k - 1]);
  }
  return pacf;
}

// ─── AR Model ────────────────────────────────────────────────────────────────

export class ARModel {
  private coefficients: number[] = [];
  private intercept = 0;
  private order: number;

  constructor(order: number) { this.order = order; }

  fit(series: number[]): void {
    const n = series.length;
    const p = this.order;
    const X: number[][] = [];
    const y: number[] = [];

    for (let i = p; i < n; i++) {
      const row: number[] = [];
      for (let j = 1; j <= p; j++) row.push(series[i - j]);
      X.push(row);
      y.push(series[i]);
    }

    const Xa = X.map(row => [1, ...row]);
    const Xt = Xa[0].map((_, j) => Xa.map(row => row[j]));
    const XtX = Xt.map(ri => Xa[0].map((_, j) => dot(ri, Xa.map(r => r[j]))));
    const Xty = Xt.map(ri => dot(ri, y));
    const w = solveLinear(XtX, Xty);

    this.intercept = w[0];
    this.coefficients = w.slice(1);
  }

  predict(series: number[], horizon: number): ForecastResult {
    const extended = [...series];
    for (let h = 0; h < horizon; h++) {
      let pred = this.intercept;
      for (let j = 0; j < this.order; j++) pred += this.coefficients[j] * extended[extended.length - 1 - j];
      extended.push(pred);
    }

    const forecast = extended.slice(series.length);
    const residualVar = this.residualVariance(series);
    const ci = forecast.map((_, i) => 1.96 * Math.sqrt(residualVar * (i + 1)));

    return {
      forecast,
      lower: forecast.map((f, i) => f - ci[i]),
      upper: forecast.map((f, i) => f + ci[i]),
      horizon,
      confidenceLevel: 0.95,
    };
  }

  private residualVariance(series: number[]): number {
    let ss = 0, count = 0;
    for (let i = this.order; i < series.length; i++) {
      let pred = this.intercept;
      for (let j = 0; j < this.order; j++) pred += this.coefficients[j] * series[i - 1 - j];
      ss += (series[i] - pred) ** 2;
      count++;
    }
    return count > 0 ? ss / count : 0;
  }
}

// ─── MA Model ────────────────────────────────────────────────────────────────

export class MAModel {
  private thetas: number[] = [];
  private mu = 0;
  private order: number;
  private maxIter: number;

  constructor(order: number, maxIter = 200) {
    this.order = order;
    this.maxIter = maxIter;
  }

  fit(series: number[]): void {
    const n = series.length;
    this.mu = mean(series);
    const centered = series.map(v => v - this.mu);
    const q = this.order;

    this.thetas = new Array(q).fill(0);
    const lr = 0.001;

    for (let iter = 0; iter < this.maxIter; iter++) {
      const errors = new Array(n).fill(0);
      for (let t = 0; t < n; t++) {
        let pred = 0;
        for (let j = 1; j <= q; j++)
          if (t - j >= 0) pred += this.thetas[j - 1] * errors[t - j];
        errors[t] = centered[t] - pred;
      }

      const grads = new Array(q).fill(0);
      for (let t = q; t < n; t++) {
        for (let j = 0; j < q; j++) {
          grads[j] -= 2 * errors[t] * errors[t - 1 - j];
        }
      }

      for (let j = 0; j < q; j++) this.thetas[j] -= lr * grads[j] / n;
    }
  }

  predict(series: number[], horizon: number): ForecastResult {
    const n = series.length;
    const centered = series.map(v => v - this.mu);
    const errors = new Array(n).fill(0);

    for (let t = 0; t < n; t++) {
      let pred = 0;
      for (let j = 1; j <= this.order; j++)
        if (t - j >= 0) pred += this.thetas[j - 1] * errors[t - j];
      errors[t] = centered[t] - pred;
    }

    const forecast: number[] = [];
    const extErrors = [...errors];
    for (let h = 0; h < horizon; h++) {
      let pred = 0;
      for (let j = 1; j <= this.order; j++) {
        const idx = extErrors.length - j;
        if (idx >= 0) pred += this.thetas[j - 1] * extErrors[idx];
      }
      forecast.push(pred + this.mu);
      extErrors.push(0);
    }

    const errVar = variance(errors);
    const ci = forecast.map((_, i) => 1.96 * Math.sqrt(errVar * (1 + Math.min(i, this.order))));

    return {
      forecast,
      lower: forecast.map((f, i) => f - ci[i]),
      upper: forecast.map((f, i) => f + ci[i]),
      horizon,
      confidenceLevel: 0.95,
    };
  }
}

// ─── ARMA Model ──────────────────────────────────────────────────────────────

export class ARMAModel {
  private ar: ARModel;
  private ma: MAModel;
  private p: number;
  private q: number;

  constructor(p: number, q: number) {
    this.p = p;
    this.q = q;
    this.ar = new ARModel(p);
    this.ma = new MAModel(q);
  }

  fit(series: number[]): void {
    this.ar.fit(series);
    const arPred = this.ar.predict(series.slice(0, this.p), series.length - this.p);
    const residuals = series.slice(this.p).map((v, i) => v - arPred.forecast[i]);
    this.ma.fit(residuals);
  }

  predict(series: number[], horizon: number): ForecastResult {
    const arForecast = this.ar.predict(series, horizon);
    return arForecast;
  }
}

// ─── ARIMA Model ─────────────────────────────────────────────────────────────

export class ARIMAModel {
  private p: number;
  private d: number;
  private q: number;
  private arma: ARMAModel;
  private originalPrefix: number[] = [];

  constructor(p: number, d: number, q: number) {
    this.p = p;
    this.d = d;
    this.q = q;
    this.arma = new ARMAModel(p, q);
  }

  fit(series: number[]): void {
    this.originalPrefix = series.slice(0, this.d);
    const diffed = difference(series, this.d);
    this.arma.fit(diffed);
  }

  predict(series: number[], horizon: number): ForecastResult {
    const diffed = difference(series, this.d);
    const forecastDiffed = this.arma.predict(diffed, horizon);

    const last = series.slice(-this.d);
    const restored: number[] = [];
    let prev = series[series.length - 1];
    for (let h = 0; h < horizon; h++) {
      prev = prev + forecastDiffed.forecast[h];
      restored.push(prev);
    }

    const ci = forecastDiffed.forecast.map((_, i) =>
      forecastDiffed.upper[i] - forecastDiffed.forecast[i]
    );

    return {
      forecast: restored,
      lower: restored.map((f, i) => f - ci[i]),
      upper: restored.map((f, i) => f + ci[i]),
      horizon,
      confidenceLevel: 0.95,
    };
  }
}

// ─── Exponential Smoothing ───────────────────────────────────────────────────

export class SimpleExponentialSmoothing {
  private alpha: number;
  private level = 0;

  constructor(alpha = 0.3) { this.alpha = alpha; }

  fit(series: number[]): void {
    this.level = series[0];
    for (let i = 1; i < series.length; i++)
      this.level = this.alpha * series[i] + (1 - this.alpha) * this.level;
  }

  predict(horizon: number): ForecastResult {
    const forecast = new Array(horizon).fill(this.level);
    return { forecast, lower: forecast, upper: forecast, horizon, confidenceLevel: 0.95 };
  }
}

export class HoltLinear {
  private alpha: number;
  private beta: number;
  private level = 0;
  private trend = 0;

  constructor(alpha = 0.3, beta = 0.1) {
    this.alpha = alpha;
    this.beta = beta;
  }

  fit(series: number[]): void {
    this.level = series[0];
    this.trend = series.length > 1 ? series[1] - series[0] : 0;

    for (let i = 1; i < series.length; i++) {
      const prevLevel = this.level;
      this.level = this.alpha * series[i] + (1 - this.alpha) * (this.level + this.trend);
      this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * this.trend;
    }
  }

  predict(horizon: number): ForecastResult {
    const forecast = Array.from({ length: horizon }, (_, h) => this.level + (h + 1) * this.trend);
    const ci = forecast.map((_, i) => 1.96 * Math.sqrt(i + 1) * Math.abs(this.trend));
    return {
      forecast,
      lower: forecast.map((f, i) => f - ci[i]),
      upper: forecast.map((f, i) => f + ci[i]),
      horizon,
      confidenceLevel: 0.95,
    };
  }
}

export class HoltWinters {
  private alpha: number;
  private beta: number;
  private gamma: number;
  private seasonalPeriod: number;
  private level = 0;
  private trend = 0;
  private seasonal: number[] = [];

  constructor(seasonalPeriod: number, alpha = 0.3, beta = 0.1, gamma = 0.1) {
    this.seasonalPeriod = seasonalPeriod;
    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;
  }

  fit(series: number[]): void {
    const m = this.seasonalPeriod;
    const nSeasons = Math.floor(series.length / m);

    this.seasonal = new Array(m).fill(0);
    if (nSeasons >= 2) {
      const seasonMeans = Array.from({ length: nSeasons }, (_, s) =>
        mean(series.slice(s * m, (s + 1) * m))
      );
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let s = 0; s < nSeasons; s++) sum += series[s * m + j] - seasonMeans[s];
        this.seasonal[j] = sum / nSeasons;
      }
    }

    this.level = mean(series.slice(0, m));
    this.trend = nSeasons >= 2
      ? (mean(series.slice(m, 2 * m)) - mean(series.slice(0, m))) / m
      : 0;

    for (let i = m; i < series.length; i++) {
      const si = i % m;
      const prevLevel = this.level;
      this.level = this.alpha * (series[i] - this.seasonal[si]) + (1 - this.alpha) * (this.level + this.trend);
      this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * this.trend;
      this.seasonal[si] = this.gamma * (series[i] - this.level) + (1 - this.gamma) * this.seasonal[si];
    }
  }

  predict(horizon: number): ForecastResult {
    const m = this.seasonalPeriod;
    const forecast = Array.from({ length: horizon }, (_, h) => {
      const si = h % m;
      return this.level + (h + 1) * this.trend + this.seasonal[si];
    });
    const ci = forecast.map((_, i) => 1.96 * Math.sqrt(i + 1));
    return {
      forecast,
      lower: forecast.map((f, i) => f - ci[i]),
      upper: forecast.map((f, i) => f + ci[i]),
      horizon,
      confidenceLevel: 0.95,
    };
  }
}

// ─── Kalman Filter ───────────────────────────────────────────────────────────

export class KalmanFilter {
  private F: number;    // state transition
  private H: number;    // observation model
  private Q: number;    // process noise
  private R: number;    // measurement noise
  private x: number;    // state estimate
  private P: number;    // estimate uncertainty

  constructor(processNoise = 0.01, measurementNoise = 1, initialState = 0) {
    this.F = 1;
    this.H = 1;
    this.Q = processNoise;
    this.R = measurementNoise;
    this.x = initialState;
    this.P = 1;
  }

  filter(observations: number[]): { states: number[]; uncertainties: number[] } {
    const states: number[] = [];
    const uncertainties: number[] = [];

    for (const z of observations) {
      const xPred = this.F * this.x;
      const PPred = this.F * this.P * this.F + this.Q;

      const K = PPred * this.H / (this.H * PPred * this.H + this.R);
      this.x = xPred + K * (z - this.H * xPred);
      this.P = (1 - K * this.H) * PPred;

      states.push(this.x);
      uncertainties.push(this.P);
    }

    return { states, uncertainties };
  }

  smooth(observations: number[]): { states: number[]; uncertainties: number[] } {
    const n = observations.length;
    const fwdStates: number[] = [];
    const fwdP: number[] = [];
    const predStates: number[] = [];
    const predP: number[] = [];

    let x = this.x, P = this.P;
    for (const z of observations) {
      const xPred = this.F * x;
      const PPred = this.F * P * this.F + this.Q;
      predStates.push(xPred);
      predP.push(PPred);

      const K = PPred * this.H / (this.H * PPred * this.H + this.R);
      x = xPred + K * (z - this.H * xPred);
      P = (1 - K * this.H) * PPred;
      fwdStates.push(x);
      fwdP.push(P);
    }

    const smoothStates = [...fwdStates];
    const smoothP = [...fwdP];
    for (let t = n - 2; t >= 0; t--) {
      const L = fwdP[t] * this.F / predP[t + 1];
      smoothStates[t] = fwdStates[t] + L * (smoothStates[t + 1] - predStates[t + 1]);
      smoothP[t] = fwdP[t] + L * L * (smoothP[t + 1] - predP[t + 1]);
    }

    return { states: smoothStates, uncertainties: smoothP };
  }

  predict(steps: number): ForecastResult {
    const forecast: number[] = [];
    const uncertainties: number[] = [];
    let x = this.x, P = this.P;

    for (let i = 0; i < steps; i++) {
      x = this.F * x;
      P = this.F * P * this.F + this.Q;
      forecast.push(x);
      uncertainties.push(P);
    }

    return {
      forecast,
      lower: forecast.map((f, i) => f - 1.96 * Math.sqrt(uncertainties[i])),
      upper: forecast.map((f, i) => f + 1.96 * Math.sqrt(uncertainties[i])),
      horizon: steps,
      confidenceLevel: 0.95,
    };
  }
}

// ─── Hidden Markov Model ─────────────────────────────────────────────────────

export class HiddenMarkovModel {
  private nStates: number;
  private transitionMatrix: number[][];
  private means: number[];
  private variances: number[];
  private initialProbs: number[];
  private maxIter: number;
  private tol: number;

  constructor(nStates: number, maxIter = 100, tol = 1e-6) {
    this.nStates = nStates;
    this.maxIter = maxIter;
    this.tol = tol;
    this.transitionMatrix = [];
    this.means = [];
    this.variances = [];
    this.initialProbs = [];
  }

  private gaussianPdf(x: number, mu: number, sigma2: number): number {
    return Math.exp(-0.5 * (x - mu) ** 2 / sigma2) / Math.sqrt(2 * Math.PI * sigma2);
  }

  fit(observations: number[]): void {
    const T = observations.length;
    const K = this.nStates;

    this.initialProbs = new Array(K).fill(1 / K);
    this.transitionMatrix = Array.from({ length: K }, () => new Array(K).fill(1 / K));

    const sorted = [...observations].sort((a, b) => a - b);
    this.means = Array.from({ length: K }, (_, i) =>
      sorted[Math.floor((i + 0.5) * T / K)]
    );
    const v = variance(observations);
    this.variances = new Array(K).fill(v);

    for (let iter = 0; iter < this.maxIter; iter++) {
      const { alpha, scalingFactors } = this.forward(observations);
      const beta = this.backward(observations, scalingFactors);

      const gamma: number[][] = Array.from({ length: T }, () => new Array(K));
      const xi: number[][][] = Array.from({ length: T - 1 }, () =>
        Array.from({ length: K }, () => new Array(K))
      );

      for (let t = 0; t < T; t++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t][i] * beta[t][i];
        if (sum === 0) sum = 1e-300;
        for (let i = 0; i < K; i++) gamma[t][i] = alpha[t][i] * beta[t][i] / sum;
      }

      for (let t = 0; t < T - 1; t++) {
        let sum = 0;
        for (let i = 0; i < K; i++)
          for (let j = 0; j < K; j++) {
            xi[t][i][j] = alpha[t][i] * this.transitionMatrix[i][j]
              * this.gaussianPdf(observations[t + 1], this.means[j], this.variances[j])
              * beta[t + 1][j];
            sum += xi[t][i][j];
          }
        if (sum === 0) sum = 1e-300;
        for (let i = 0; i < K; i++)
          for (let j = 0; j < K; j++) xi[t][i][j] /= sum;
      }

      const prevMeans = [...this.means];

      for (let i = 0; i < K; i++) this.initialProbs[i] = gamma[0][i];

      for (let i = 0; i < K; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T - 1; t++) gammaSum += gamma[t][i];
        if (gammaSum === 0) gammaSum = 1e-300;

        for (let j = 0; j < K; j++) {
          let xiSum = 0;
          for (let t = 0; t < T - 1; t++) xiSum += xi[t][i][j];
          this.transitionMatrix[i][j] = xiSum / gammaSum;
        }
      }

      for (let j = 0; j < K; j++) {
        let gammaSum = 0, weightedSum = 0, varSum = 0;
        for (let t = 0; t < T; t++) {
          gammaSum += gamma[t][j];
          weightedSum += gamma[t][j] * observations[t];
        }
        if (gammaSum === 0) gammaSum = 1e-300;
        this.means[j] = weightedSum / gammaSum;
        for (let t = 0; t < T; t++)
          varSum += gamma[t][j] * (observations[t] - this.means[j]) ** 2;
        this.variances[j] = Math.max(1e-6, varSum / gammaSum);
      }

      let maxDiff = 0;
      for (let j = 0; j < K; j++) maxDiff = Math.max(maxDiff, Math.abs(this.means[j] - prevMeans[j]));
      if (maxDiff < this.tol) break;
    }
  }

  private forward(obs: number[]): { alpha: number[][]; scalingFactors: number[] } {
    const T = obs.length, K = this.nStates;
    const alpha: number[][] = Array.from({ length: T }, () => new Array(K));
    const scalingFactors: number[] = [];

    for (let j = 0; j < K; j++)
      alpha[0][j] = this.initialProbs[j] * this.gaussianPdf(obs[0], this.means[j], this.variances[j]);
    let c = alpha[0].reduce((a, b) => a + b, 0) || 1e-300;
    for (let j = 0; j < K; j++) alpha[0][j] /= c;
    scalingFactors.push(c);

    for (let t = 1; t < T; t++) {
      for (let j = 0; j < K; j++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * this.transitionMatrix[i][j];
        alpha[t][j] = sum * this.gaussianPdf(obs[t], this.means[j], this.variances[j]);
      }
      c = alpha[t].reduce((a, b) => a + b, 0) || 1e-300;
      for (let j = 0; j < K; j++) alpha[t][j] /= c;
      scalingFactors.push(c);
    }

    return { alpha, scalingFactors };
  }

  private backward(obs: number[], sf: number[]): number[][] {
    const T = obs.length, K = this.nStates;
    const beta: number[][] = Array.from({ length: T }, () => new Array(K));
    for (let j = 0; j < K; j++) beta[T - 1][j] = 1;

    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < K; i++) {
        let sum = 0;
        for (let j = 0; j < K; j++)
          sum += this.transitionMatrix[i][j]
            * this.gaussianPdf(obs[t + 1], this.means[j], this.variances[j])
            * beta[t + 1][j];
        beta[t][i] = sum;
      }
      const c = sf[t + 1] || 1e-300;
      for (let i = 0; i < K; i++) beta[t][i] /= c;
    }
    return beta;
  }

  viterbi(observations: number[]): number[] {
    const T = observations.length, K = this.nStates;
    const dp: number[][] = Array.from({ length: T }, () => new Array(K));
    const ptr: number[][] = Array.from({ length: T }, () => new Array(K));

    for (let j = 0; j < K; j++) {
      dp[0][j] = Math.log(this.initialProbs[j] + 1e-300)
        + Math.log(this.gaussianPdf(observations[0], this.means[j], this.variances[j]) + 1e-300);
      ptr[0][j] = 0;
    }

    for (let t = 1; t < T; t++) {
      for (let j = 0; j < K; j++) {
        let best = -Infinity, bestI = 0;
        for (let i = 0; i < K; i++) {
          const score = dp[t - 1][i] + Math.log(this.transitionMatrix[i][j] + 1e-300);
          if (score > best) { best = score; bestI = i; }
        }
        dp[t][j] = best + Math.log(this.gaussianPdf(observations[t], this.means[j], this.variances[j]) + 1e-300);
        ptr[t][j] = bestI;
      }
    }

    const path = new Array(T);
    let best = -Infinity;
    for (let j = 0; j < K; j++)
      if (dp[T - 1][j] > best) { best = dp[T - 1][j]; path[T - 1] = j; }

    for (let t = T - 2; t >= 0; t--) path[t] = ptr[t + 1][path[t + 1]];
    return path;
  }

  detectRegimes(observations: number[]): RegimeState[] {
    const states = this.viterbi(observations);
    const regimes: RegimeState[] = [];
    let start = 0;

    for (let i = 1; i <= states.length; i++) {
      if (i === states.length || states[i] !== states[i - 1]) {
        const segment = observations.slice(start, i);
        const ret = segment.length > 1
          ? segment.slice(1).map((v, j) => v - segment[j])
          : [0];

        regimes.push({
          regime: states[start],
          probability: 1,
          startIndex: start,
          endIndex: i - 1,
          characteristics: {
            meanReturn: mean(ret),
            volatility: Math.sqrt(variance(ret)),
            duration: i - start,
          },
        });
        start = i;
      }
    }
    return regimes;
  }
}

// ─── Change Point Detection ──────────────────────────────────────────────────

export function cusumChangePoint(series: number[], threshold = 5, drift = 0): number[] {
  const m = mean(series);
  let sPos = 0, sNeg = 0;
  const changePoints: number[] = [];

  for (let i = 0; i < series.length; i++) {
    sPos = Math.max(0, sPos + (series[i] - m) - drift);
    sNeg = Math.max(0, sNeg - (series[i] - m) - drift);
    if (sPos > threshold || sNeg > threshold) {
      changePoints.push(i);
      sPos = 0;
      sNeg = 0;
    }
  }
  return changePoints;
}

export function peltChangePoint(series: number[], penalty = 1): number[] {
  const n = series.length;
  const cost = (start: number, end: number): number => {
    const seg = series.slice(start, end);
    const m = mean(seg);
    let c = 0;
    for (const v of seg) c += (v - m) ** 2;
    return c;
  };

  const F = new Array(n + 1).fill(0);
  const cp: number[][] = Array.from({ length: n + 1 }, () => []);
  F[0] = -penalty;

  for (let tStar = 1; tStar <= n; tStar++) {
    let bestCost = Infinity;
    let bestTau = 0;

    for (let tau = 0; tau < tStar; tau++) {
      const c = F[tau] + cost(tau, tStar) + penalty;
      if (c < bestCost) { bestCost = c; bestTau = tau; }
    }

    F[tStar] = bestCost;
    cp[tStar] = [...cp[bestTau], bestTau];
  }

  return cp[n].filter(p => p > 0);
}

// ─── Spectral Analysis ──────────────────────────────────────────────────────

export function fftPeriodDetection(series: number[]): { periods: number[]; powers: number[] } {
  const n = series.length;
  const m = mean(series);
  const centered = series.map(v => v - m);

  const nextPow2 = 1 << Math.ceil(Math.log2(n));
  const padded = [...centered, ...new Array(nextPow2 - n).fill(0)];

  const { real, imag } = fft(padded);
  const powers = real.map((r, i) => r * r + imag[i] * imag[i]);

  const halfN = Math.floor(nextPow2 / 2);
  const indices = Array.from({ length: halfN - 1 }, (_, i) => i + 1);
  indices.sort((a, b) => powers[b] - powers[a]);

  const topK = Math.min(5, indices.length);
  const topIndices = indices.slice(0, topK);

  return {
    periods: topIndices.map(i => nextPow2 / i),
    powers: topIndices.map(i => powers[i]),
  };
}

function fft(data: number[]): { real: number[]; imag: number[] } {
  const n = data.length;
  if (n === 1) return { real: [data[0]], imag: [0] };

  const even = data.filter((_, i) => i % 2 === 0);
  const odd = data.filter((_, i) => i % 2 === 1);

  const { real: eR, imag: eI } = fft(even);
  const { real: oR, imag: oI } = fft(odd);

  const real = new Array(n);
  const imag = new Array(n);
  const half = n / 2;

  for (let k = 0; k < half; k++) {
    const angle = -2 * Math.PI * k / n;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const tR = cos * oR[k] - sin * oI[k];
    const tI = sin * oR[k] + cos * oI[k];
    real[k] = eR[k] + tR;
    imag[k] = eI[k] + tI;
    real[k + half] = eR[k] - tR;
    imag[k + half] = eI[k] - tI;
  }
  return { real, imag };
}

// ─── Stationarity Test (ADF Approximation) ──────────────────────────────────

export function adfTest(series: number[]): { statistic: number; pValue: number; isStationary: boolean } {
  const n = series.length;
  const dy = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) dy[i] = series[i + 1] - series[i];

  const yLag = series.slice(0, n - 1);
  const yMean = mean(yLag);
  const dyMean = mean(dy);

  let num = 0, den = 0;
  for (let i = 0; i < dy.length; i++) {
    num += (yLag[i] - yMean) * (dy[i] - dyMean);
    den += (yLag[i] - yMean) ** 2;
  }
  const gamma = den === 0 ? 0 : num / den;

  let ssRes = 0;
  for (let i = 0; i < dy.length; i++) ssRes += (dy[i] - dyMean - gamma * (yLag[i] - yMean)) ** 2;
  const se = Math.sqrt(ssRes / ((dy.length - 2) * (den || 1)));
  const tStat = se === 0 ? 0 : gamma / se;

  const criticalValues = { '1%': -3.43, '5%': -2.86, '10%': -2.57 };
  const isStationary = tStat < criticalValues['5%'];
  const pValue = tStat < criticalValues['1%'] ? 0.01
    : tStat < criticalValues['5%'] ? 0.05
    : tStat < criticalValues['10%'] ? 0.10
    : 0.5;

  return { statistic: tStat, pValue, isStationary };
}
