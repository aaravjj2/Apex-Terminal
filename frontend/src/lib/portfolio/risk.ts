import type {
  ReturnSeries,
  RiskMetrics,
  VaRResult,
  ComponentVaR,
  DrawdownInfo,
  FactorRiskDecomposition,
  Position,
} from './types';

// ─── Linear Algebra Primitives ───────────────────────────────────────────────

export function matMul(a: number[][], b: number[][]): number[][] {
  const m = a.length;
  const n = b[0].length;
  const p = b.length;
  const c: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      const aik = a[i][k];
      for (let j = 0; j < n; j++) {
        c[i][j] += aik * b[k][j];
      }
    }
  }
  return c;
}

export function matVecMul(m: number[][], v: number[]): number[] {
  return m.map(row => row.reduce((s, val, j) => s + val * v[j], 0));
}

export function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const t: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) t[j][i] = m[i][j];
  return t;
}

export function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const diag = matrix[i][i] - sum;
        if (diag < 0) throw new Error('Matrix is not positive definite');
        L[i][j] = Math.sqrt(diag);
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

export function matInverse(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug: number[][] = matrix.map((row, i) => {
    const extended = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) extended[j] = row[j];
    extended[n + i] = 1;
    return extended;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error('Matrix is singular');
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

// ─── Statistical Helpers ─────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function variance(arr: number[], ddof = 1): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof);
}

export function stdDev(arr: number[], ddof = 1): number {
  return Math.sqrt(variance(arr, ddof));
}

export function covariance(x: number[], y: number[], ddof = 1): number {
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / (x.length - ddof);
}

export function skewness(arr: number[]): number {
  const n = arr.length;
  const m = mean(arr);
  const s = stdDev(arr, 1);
  if (s === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += ((arr[i] - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum;
}

export function kurtosis(arr: number[]): number {
  const n = arr.length;
  const m = mean(arr);
  const s = stdDev(arr, 1);
  if (s === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += ((arr[i] - m) / s) ** 4;
  const raw = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum;
  return raw - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function normalPPF(p: number): number {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));

  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return sign * (t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Box-Muller transform for normal random variates
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Covariance Matrix Estimation ────────────────────────────────────────────

export function sampleCovarianceMatrix(returnMatrix: number[][]): number[][] {
  const nAssets = returnMatrix[0].length;
  const nObs = returnMatrix.length;
  const means = new Array(nAssets).fill(0);

  for (let j = 0; j < nAssets; j++) {
    for (let i = 0; i < nObs; i++) means[j] += returnMatrix[i][j];
    means[j] /= nObs;
  }

  const cov: number[][] = Array.from({ length: nAssets }, () => new Array(nAssets).fill(0));
  for (let i = 0; i < nAssets; i++) {
    for (let j = i; j < nAssets; j++) {
      let sum = 0;
      for (let t = 0; t < nObs; t++) {
        sum += (returnMatrix[t][i] - means[i]) * (returnMatrix[t][j] - means[j]);
      }
      cov[i][j] = sum / (nObs - 1);
      cov[j][i] = cov[i][j];
    }
  }
  return cov;
}

export function ewmaCovarianceMatrix(returnMatrix: number[][], lambda = 0.94): number[][] {
  const nAssets = returnMatrix[0].length;
  const nObs = returnMatrix.length;
  const means = new Array(nAssets).fill(0);
  for (let j = 0; j < nAssets; j++) {
    for (let i = 0; i < nObs; i++) means[j] += returnMatrix[i][j];
    means[j] /= nObs;
  }

  const cov: number[][] = Array.from({ length: nAssets }, () => new Array(nAssets).fill(0));

  for (let t = 0; t < nObs; t++) {
    const w = (1 - lambda) * Math.pow(lambda, nObs - 1 - t);
    for (let i = 0; i < nAssets; i++) {
      for (let j = i; j < nAssets; j++) {
        const v = (returnMatrix[t][i] - means[i]) * (returnMatrix[t][j] - means[j]) * w;
        cov[i][j] += v;
        if (i !== j) cov[j][i] += v;
      }
    }
  }

  const wSum = (1 - Math.pow(lambda, nObs)) / (1 - lambda) * (1 - lambda);
  for (let i = 0; i < nAssets; i++)
    for (let j = 0; j < nAssets; j++) cov[i][j] /= wSum;

  return cov;
}

export function ledoitWolfShrinkage(returnMatrix: number[][]): number[][] {
  const nObs = returnMatrix.length;
  const nAssets = returnMatrix[0].length;
  const sample = sampleCovarianceMatrix(returnMatrix);

  const muTarget = sample.reduce((s, row, i) => s + row[i], 0) / nAssets;
  const target: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) => (i === j ? muTarget : 0))
  );

  const means = new Array(nAssets).fill(0);
  for (let j = 0; j < nAssets; j++) {
    for (let i = 0; i < nObs; i++) means[j] += returnMatrix[i][j];
    means[j] /= nObs;
  }

  let piSum = 0;
  for (let i = 0; i < nAssets; i++) {
    for (let j = 0; j < nAssets; j++) {
      let s = 0;
      for (let t = 0; t < nObs; t++) {
        const xij = (returnMatrix[t][i] - means[i]) * (returnMatrix[t][j] - means[j]) - sample[i][j];
        s += xij * xij;
      }
      piSum += s / nObs;
    }
  }
  const pi = piSum;

  let gammaSum = 0;
  for (let i = 0; i < nAssets; i++) {
    for (let j = 0; j < nAssets; j++) {
      gammaSum += (target[i][j] - sample[i][j]) ** 2;
    }
  }
  const gamma = gammaSum;

  const kappa = (pi - gamma) / gamma;
  const shrinkage = Math.max(0, Math.min(1, kappa / nObs));

  const result: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) =>
      shrinkage * target[i][j] + (1 - shrinkage) * sample[i][j]
    )
  );
  return result;
}

export function correlationMatrix(covMatrix: number[][]): number[][] {
  const n = covMatrix.length;
  const corr: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = Math.sqrt(covMatrix[i][i] * covMatrix[j][j]);
      corr[i][j] = d > 0 ? covMatrix[i][j] / d : 0;
    }
  }
  return corr;
}

// ─── VaR Calculations ───────────────────────────────────────────────────────

export function historicalVaR(returns: number[], confidence = 0.95): VaRResult {
  const sorted = [...returns].sort((a, b) => a - b);
  const pct5 = percentile(sorted, (1 - confidence) * 100);
  const pct1 = percentile(sorted, 1);

  const tail5 = sorted.filter(r => r <= pct5);
  const tail1 = sorted.filter(r => r <= pct1);
  const cvar95 = tail5.length > 0 ? mean(tail5) : pct5;
  const cvar99 = tail1.length > 0 ? mean(tail1) : pct1;

  return {
    var95: -pct5,
    var99: -pct1,
    cvar95: -cvar95,
    cvar99: -cvar99,
    method: 'historical',
  };
}

export function parametricVaR(returns: number[], confidence = 0.95): VaRResult {
  const mu = mean(returns);
  const sigma = stdDev(returns);

  const z95 = normalPPF(1 - confidence);
  const z99 = normalPPF(0.01);

  const var95 = -(mu + z95 * sigma);
  const var99 = -(mu + z99 * sigma);

  const pdf95 = normalPDF(normalPPF(1 - confidence));
  const pdf99 = normalPDF(normalPPF(0.01));
  const cvar95 = -(mu - sigma * pdf95 / (1 - confidence));
  const cvar99 = -(mu - sigma * pdf99 / 0.01);

  return { var95, var99, cvar95, cvar99, method: 'parametric' };
}

export function monteCarloVaR(
  returns: number[],
  covMatrix: number[][] | null,
  weights: number[],
  numSimulations = 10000,
  horizon = 1
): VaRResult {
  const nAssets = weights.length;
  const isPortfolio = covMatrix !== null && nAssets > 1;

  let simulatedReturns: number[];

  if (isPortfolio && covMatrix) {
    const L = choleskyDecomposition(covMatrix);
    const means = new Array(nAssets).fill(mean(returns) / nAssets);
    simulatedReturns = new Array(numSimulations);

    for (let sim = 0; sim < numSimulations; sim++) {
      const z = Array.from({ length: nAssets }, () => randn());
      const correlated = matVecMul(L, z);
      let portfolioReturn = 0;
      for (let j = 0; j < nAssets; j++) {
        portfolioReturn += weights[j] * (means[j] * horizon + correlated[j] * Math.sqrt(horizon));
      }
      simulatedReturns[sim] = portfolioReturn;
    }
  } else {
    const mu = mean(returns);
    const sigma = stdDev(returns);
    simulatedReturns = new Array(numSimulations);
    for (let sim = 0; sim < numSimulations; sim++) {
      simulatedReturns[sim] = mu * horizon + sigma * Math.sqrt(horizon) * randn();
    }
  }

  simulatedReturns.sort((a, b) => a - b);
  const var95 = -percentile(simulatedReturns, 5);
  const var99 = -percentile(simulatedReturns, 1);

  const tail5 = simulatedReturns.filter(r => r <= -var95);
  const tail1 = simulatedReturns.filter(r => r <= -var99);
  const cvar95 = tail5.length > 0 ? -mean(tail5) : var95;
  const cvar99 = tail1.length > 0 ? -mean(tail1) : var99;

  return { var95, var99, cvar95, cvar99, method: 'monteCarlo' };
}

export function cornishFisherVaR(returns: number[]): VaRResult {
  const mu = mean(returns);
  const sigma = stdDev(returns);
  const s = skewness(returns);
  const k = kurtosis(returns);

  function cfQuantile(alpha: number): number {
    const z = normalPPF(alpha);
    const adjusted = z
      + (z * z - 1) * s / 6
      + (z ** 3 - 3 * z) * k / 24
      - (2 * z ** 3 - 5 * z) * s * s / 36;
    return mu + adjusted * sigma;
  }

  const q05 = cfQuantile(0.05);
  const q01 = cfQuantile(0.01);

  const sorted = [...returns].sort((a, b) => a - b);
  const tail5 = sorted.filter(r => r <= q05);
  const tail1 = sorted.filter(r => r <= q01);

  return {
    var95: -q05,
    var99: -q01,
    cvar95: tail5.length > 0 ? -mean(tail5) : -q05,
    cvar99: tail1.length > 0 ? -mean(tail1) : -q01,
    method: 'cornishFisher',
  };
}

export function expectedShortfall(returns: number[], confidence = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.floor(sorted.length * (1 - confidence));
  const tail = sorted.slice(0, Math.max(cutoff, 1));
  return -mean(tail);
}

// ─── Component & Incremental VaR ─────────────────────────────────────────────

export function componentVaR(
  weights: number[],
  covMatrix: number[][],
  symbols: string[],
  confidence = 0.95
): ComponentVaR[] {
  const n = weights.length;
  const portfolioVariance = dotProduct(weights, matVecMul(covMatrix, weights));
  const portfolioVol = Math.sqrt(portfolioVariance);
  const z = -normalPPF(1 - confidence);
  const portfolioVaR = z * portfolioVol;

  const marginalVaRs = matVecMul(covMatrix, weights).map(v => (z * v) / portfolioVol);
  const totalComponentVaR = weights.reduce((s, w, i) => s + w * marginalVaRs[i], 0);

  return symbols.map((symbol, i) => ({
    symbol,
    marginalVaR: marginalVaRs[i],
    componentVaR: weights[i] * marginalVaRs[i],
    percentContribution: totalComponentVaR !== 0
      ? (weights[i] * marginalVaRs[i]) / portfolioVaR * 100
      : 0,
  }));
}

export function incrementalVaR(
  weights: number[],
  covMatrix: number[][],
  newAssetCov: number[],
  newAssetVar: number,
  newWeight: number,
  confidence = 0.95
): number {
  const z = -normalPPF(1 - confidence);
  const currentVar = dotProduct(weights, matVecMul(covMatrix, weights));
  const currentVaR = z * Math.sqrt(currentVar);

  const n = weights.length;
  const adjustedWeights = weights.map(w => w * (1 - newWeight));
  const newCov: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => {
      if (i < n && j < n) return covMatrix[i][j];
      if (i < n) return newAssetCov[i];
      if (j < n) return newAssetCov[j];
      return newAssetVar;
    })
  );
  const fullWeights = [...adjustedWeights, newWeight];
  const newVar = dotProduct(fullWeights, matVecMul(newCov, fullWeights));
  const newVaR = z * Math.sqrt(newVar);

  return newVaR - currentVaR;
}

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ─── Drawdown Analysis ──────────────────────────────────────────────────────

export function calculateDrawdowns(returns: number[], dates: number[]): DrawdownInfo[] {
  const n = returns.length;
  const cumulative = new Array(n);
  cumulative[0] = 1 + returns[0];
  for (let i = 1; i < n; i++) cumulative[i] = cumulative[i - 1] * (1 + returns[i]);

  const drawdowns: DrawdownInfo[] = [];
  let peak = cumulative[0];
  let peakIdx = 0;
  let troughIdx = 0;
  let maxDD = 0;
  let inDrawdown = false;

  for (let i = 0; i < n; i++) {
    if (cumulative[i] > peak) {
      if (inDrawdown) {
        drawdowns.push({
          maxDrawdown: peak - cumulative[troughIdx],
          maxDrawdownPct: maxDD,
          peakDate: dates[peakIdx],
          troughDate: dates[troughIdx],
          recoveryDate: dates[i],
          duration: i - peakIdx,
          recoveryDuration: i - troughIdx,
        });
      }
      peak = cumulative[i];
      peakIdx = i;
      maxDD = 0;
      inDrawdown = false;
    }

    const dd = (peak - cumulative[i]) / peak;
    if (dd > 0) {
      inDrawdown = true;
      if (dd > maxDD) {
        maxDD = dd;
        troughIdx = i;
      }
    }
  }

  if (inDrawdown) {
    drawdowns.push({
      maxDrawdown: peak - cumulative[troughIdx],
      maxDrawdownPct: maxDD,
      peakDate: dates[peakIdx],
      troughDate: dates[troughIdx],
      recoveryDate: null,
      duration: n - 1 - peakIdx,
      recoveryDuration: null,
    });
  }

  return drawdowns.sort((a, b) => b.maxDrawdownPct - a.maxDrawdownPct);
}

export function maxDrawdown(returns: number[]): number {
  let peak = 1;
  let maxDD = 0;
  let cum = 1;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    const dd = (peak - cum) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ─── Beta & Tracking Error ──────────────────────────────────────────────────

export function calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const cov = covariance(portfolioReturns, benchmarkReturns);
  const benchVar = variance(benchmarkReturns);
  return benchVar > 0 ? cov / benchVar : 0;
}

export function trackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const excess = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  return stdDev(excess) * Math.sqrt(252);
}

// ─── Factor Risk Decomposition ──────────────────────────────────────────────

export function factorRiskDecomposition(
  assetReturns: number[],
  factorReturns: number[][],
  factorNames: string[]
): FactorRiskDecomposition {
  const nObs = assetReturns.length;
  const nFactors = factorReturns[0].length;

  // OLS regression: assetReturns = alpha + beta * factors + epsilon
  const X: number[][] = factorReturns.map(row => [1, ...row]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInverse(XtX);
  const y = assetReturns.map(v => [v]);
  const Xty = matMul(Xt, y);
  const betaMatrix = matMul(XtXinv, Xty);
  const betas = betaMatrix.map(row => row[0]);

  const residuals = assetReturns.map((r, t) => {
    let predicted = betas[0];
    for (let f = 0; f < nFactors; f++) predicted += betas[f + 1] * factorReturns[t][f];
    return r - predicted;
  });

  const totalVar = variance(assetReturns);
  const idiosyncraticVar = variance(residuals);
  const systematicVar = totalVar - idiosyncraticVar;

  const contributions: Record<string, number> = {};
  for (let f = 0; f < nFactors; f++) {
    const factorCol = factorReturns.map(row => row[f]);
    const factorVar = variance(factorCol);
    contributions[factorNames[f]] = betas[f + 1] ** 2 * factorVar;
  }

  return {
    systematicRisk: Math.sqrt(Math.max(0, systematicVar)) * Math.sqrt(252),
    idiosyncraticRisk: Math.sqrt(idiosyncraticVar) * Math.sqrt(252),
    totalRisk: Math.sqrt(totalVar) * Math.sqrt(252),
    factorContributions: contributions,
  };
}

// ─── Concentration Risk ─────────────────────────────────────────────────────

export function herfindahlIndex(weights: number[]): number {
  return weights.reduce((s, w) => s + w * w, 0);
}

export function effectiveNumPositions(weights: number[]): number {
  const hhi = herfindahlIndex(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

// ─── Downside Deviation & Semi-Variance ─────────────────────────────────────

export function downsideDeviation(returns: number[], mar = 0): number {
  const downside = returns.filter(r => r < mar).map(r => (r - mar) ** 2);
  if (downside.length === 0) return 0;
  return Math.sqrt(downside.reduce((s, v) => s + v, 0) / returns.length);
}

export function semiVariance(returns: number[], mar = 0): number {
  const downside = returns.filter(r => r < mar).map(r => (r - mar) ** 2);
  if (downside.length === 0) return 0;
  return downside.reduce((s, v) => s + v, 0) / returns.length;
}

// ─── Aggregate Risk Metrics ─────────────────────────────────────────────────

export function calculateRiskMetrics(
  returns: number[],
  positions?: Position[]
): RiskMetrics {
  const vol = stdDev(returns) * Math.sqrt(252);
  const dailyVaR = historicalVaR(returns);
  const weights = positions ? positions.map(p => p.weight) : [];

  return {
    var1d: dailyVaR.var95,
    var10d: dailyVaR.var95 * Math.sqrt(10),
    cvar: dailyVaR.cvar95,
    volatility: vol,
    downsideDeviation: downsideDeviation(returns) * Math.sqrt(252),
    semiVariance: semiVariance(returns) * 252,
    skewness: skewness(returns),
    kurtosis: kurtosis(returns),
    herfindahlIndex: weights.length > 0 ? herfindahlIndex(weights) : 0,
  };
}

// ─── Tail Risk Metrics ──────────────────────────────────────────────────────

export function tailRatio(returns: number[], percentileLevel = 5): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const leftTail = Math.abs(percentile(sorted, percentileLevel));
  const rightTail = Math.abs(percentile(sorted, 100 - percentileLevel));
  return rightTail > 0 ? leftTail / rightTail : 0;
}

export function gainToPainRatio(returns: number[]): number {
  const totalGain = returns.reduce((s, r) => s + r, 0);
  const totalPain = returns.reduce((s, r) => s + Math.abs(Math.min(0, r)), 0);
  return totalPain > 0 ? totalGain / totalPain : 0;
}

export function ulcerIndex(returns: number[]): number {
  let peak = 1;
  let cum = 1;
  let sumSqDD = 0;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    const dd = ((peak - cum) / peak) * 100;
    sumSqDD += dd * dd;
  }
  return Math.sqrt(sumSqDD / returns.length);
}

// ─── Stress Testing ─────────────────────────────────────────────────────────

export interface StressScenario {
  name: string;
  factorShocks: Record<string, number>;
}

export function stressTest(
  weights: number[],
  factorBetas: number[][],
  scenarios: StressScenario[]
): { scenario: string; portfolioImpact: number }[] {
  return scenarios.map(scenario => {
    let impact = 0;
    for (let i = 0; i < weights.length; i++) {
      let assetImpact = 0;
      const factors = Object.keys(scenario.factorShocks);
      for (let f = 0; f < factors.length; f++) {
        assetImpact += (factorBetas[i]?.[f] ?? 0) * scenario.factorShocks[factors[f]];
      }
      impact += weights[i] * assetImpact;
    }
    return { scenario: scenario.name, portfolioImpact: impact };
  });
}

// Re-export statistical helpers needed by other modules
export { normalPPF, normalCDF, normalPDF, percentile, randn };
