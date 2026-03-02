import type {
  Portfolio,
  Position,
  VaRResult,
  VaRBacktestResult,
  EVTResult,
  SensitivityResult,
  PnLAttribution,
  RiskMetric,
  ConfidenceLevel,
  Horizon,
  VaRMethod,
  SensitivityLadder,
} from './types';

// ─── Statistical Utilities ──────────────────────────────────────────────────

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Rational approximation of the standard normal CDF (Abramowitz & Stegun 26.2.17). */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

/** Beasley-Springer-Moro algorithm for the inverse normal CDF. */
function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function skewness(arr: number[]): number {
  const n = arr.length;
  if (n < 3) return 0;
  const m = mean(arr);
  const s = stddev(arr);
  if (s === 0) return 0;
  const sum3 = arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum3;
}

function kurtosisExcess(arr: number[]): number {
  const n = arr.length;
  if (n < 4) return 0;
  const m = mean(arr);
  const s = stddev(arr);
  if (s === 0) return 0;
  const sum4 = arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const k = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4;
  return k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function covarianceMatrix(returnsSeries: number[][]): number[][] {
  const n = returnsSeries.length;
  const T = returnsSeries[0]?.length ?? 0;
  const means = returnsSeries.map(r => mean(r));
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) {
        s += (returnsSeries[i][t] - means[i]) * (returnsSeries[j][t] - means[j]);
      }
      const c = s / (T - 1);
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }
  return cov;
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];

      if (i === j) {
        const diag = matrix[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(diag, 1e-12));
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

function horizonScaleFactor(horizon: Horizon): number {
  switch (horizon) {
    case '1d': return 1;
    case '10d': return Math.sqrt(10);
    case '1m': return Math.sqrt(21);
  }
}

function boxMullerNormal(): number {
  let u1: number, u2: number;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── VaR Calculators ────────────────────────────────────────────────────────

export function historicalVaR(
  returns: number[],
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): { var: number; es: number } {
  if (returns.length === 0) return { var: 0, es: 0 };

  const sorted = [...returns].sort((a, b) => a - b);
  const scale = horizonScaleFactor(horizon);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const idx = Math.max(cutoff - 1, 0);

  const varValue = -sorted[idx] * scale;
  const tailSlice = sorted.slice(0, cutoff);
  const es = tailSlice.length > 0 ? -mean(tailSlice) * scale : varValue;

  return { var: Math.max(varValue, 0), es: Math.max(es, 0) };
}

export function parametricVaR(
  returns: number[],
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): { var: number; es: number } {
  if (returns.length === 0) return { var: 0, es: 0 };

  const mu = mean(returns);
  const sigma = stddev(returns);
  const z = normalInv(1 - confidence);
  const scale = horizonScaleFactor(horizon);

  const varValue = -(mu + z * sigma) * scale;
  const esZ = normalPDF(normalInv(confidence)) / (1 - confidence);
  const es = (sigma * esZ - mu) * scale;

  return { var: Math.max(varValue, 0), es: Math.max(es, 0) };
}

export function cornishFisherVaR(
  returns: number[],
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): { var: number; es: number } {
  if (returns.length < 4) return parametricVaR(returns, confidence, horizon);

  const mu = mean(returns);
  const sigma = stddev(returns);
  const s = skewness(returns);
  const k = kurtosisExcess(returns);
  const z = normalInv(1 - confidence);
  const scale = horizonScaleFactor(horizon);

  const zCF = z
    + (z * z - 1) * s / 6
    + (z ** 3 - 3 * z) * k / 24
    - (2 * z ** 3 - 5 * z) * s * s / 36;

  const varValue = -(mu + zCF * sigma) * scale;
  const { es: paramES } = parametricVaR(returns, confidence, horizon);

  return { var: Math.max(varValue, 0), es: Math.max(paramES, 0) };
}

export function monteCarloVaR(
  returns: number[],
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
  simulations: number = 10000,
): { var: number; es: number } {
  if (returns.length === 0) return { var: 0, es: 0 };

  const mu = mean(returns);
  const sigma = stddev(returns);
  const daysAhead = horizon === '1d' ? 1 : horizon === '10d' ? 10 : 21;

  const simPnl: number[] = [];
  for (let i = 0; i < simulations; i++) {
    let cumReturn = 0;
    for (let d = 0; d < daysAhead; d++) {
      cumReturn += mu + sigma * boxMullerNormal();
    }
    simPnl.push(cumReturn);
  }

  simPnl.sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * simulations);
  const varValue = -simPnl[Math.max(cutoff - 1, 0)];
  const tail = simPnl.slice(0, cutoff);
  const es = tail.length > 0 ? -mean(tail) : varValue;

  return { var: Math.max(varValue, 0), es: Math.max(es, 0) };
}

/** Portfolio-level VaR using correlated Monte Carlo simulation. */
export function portfolioMonteCarloVaR(
  portfolio: Portfolio,
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
  simulations: number = 10000,
): VaRResult {
  const positions = portfolio.positions;
  const n = positions.length;
  if (n === 0) {
    return emptyVaRResult('monte_carlo', confidence, horizon);
  }

  const returnsSeries = positions.map(p => {
    const factorReturns = portfolio.historicalReturns;
    return factorReturns.length > 0 ? factorReturns : [0];
  });

  const minLen = Math.min(...returnsSeries.map(r => r.length));
  const trimmed = returnsSeries.map(r => r.slice(0, minLen));
  const cov = covarianceMatrix(trimmed);
  const L = choleskyDecomposition(cov);
  const means = trimmed.map(r => mean(r));
  const weights = positions.map(p => p.weight);
  const daysAhead = horizon === '1d' ? 1 : horizon === '10d' ? 10 : 21;

  const portfolioPnl: number[] = [];
  const componentPnl: Record<string, number[]> = {};
  positions.forEach(p => { componentPnl[p.id] = []; });

  for (let sim = 0; sim < simulations; sim++) {
    const z = Array.from({ length: n }, () => boxMullerNormal());
    const correlated: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        correlated[i] += L[i][j] * z[j];
      }
    }

    let portReturn = 0;
    for (let i = 0; i < n; i++) {
      const assetReturn = (means[i] + correlated[i]) * daysAhead;
      const contribution = weights[i] * assetReturn;
      portReturn += contribution;
      componentPnl[positions[i].id].push(contribution * portfolio.totalValue);
    }
    portfolioPnl.push(portReturn * portfolio.totalValue);
  }

  portfolioPnl.sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * simulations);
  const varValue = -portfolioPnl[Math.max(cutoff - 1, 0)];
  const tail = portfolioPnl.slice(0, cutoff);
  const es = tail.length > 0 ? -mean(tail) : varValue;

  const compVaR: Record<string, number> = {};
  for (const [id, pnls] of Object.entries(componentPnl)) {
    const sortedComp = [...pnls].sort((a, b) => a - b);
    compVaR[id] = -sortedComp[Math.max(cutoff - 1, 0)];
  }

  return {
    method: 'monte_carlo',
    confidenceLevel: confidence,
    horizon,
    var: Math.max(varValue, 0),
    expectedShortfall: Math.max(es, 0),
    componentVaR: compVaR,
    timestamp: Date.now(),
  };
}

// ─── Stressed VaR ───────────────────────────────────────────────────────────

export function stressedVaR(
  historicalReturns: number[],
  stressPeriodReturns: number[],
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): number {
  const { var: currentVar } = historicalVaR(historicalReturns, confidence, horizon);
  const { var: stressVar } = historicalVaR(stressPeriodReturns, confidence, horizon);
  return Math.max(currentVar, stressVar);
}

// ─── VaR Backtesting ────────────────────────────────────────────────────────

export function backtestVaR(
  actualPnl: number[],
  varEstimates: number[],
  confidence: ConfidenceLevel,
  method: VaRMethod = 'historical',
): VaRBacktestResult {
  const n = Math.min(actualPnl.length, varEstimates.length);
  const exceptions: number[] = [];
  const exceptionIndicator: number[] = [];

  for (let i = 0; i < n; i++) {
    const exceeded = actualPnl[i] < -varEstimates[i];
    exceptionIndicator.push(exceeded ? 1 : 0);
    if (exceeded) exceptions.push(i);
  }

  const x = exceptions.length;
  const p = 1 - confidence;
  const expectedExceptions = n * p;

  const kupiecLR = x === 0
    ? -2 * n * Math.log(1 - p)
    : -2 * (n * Math.log(1 - p) + (x > 0 ? x * Math.log(p) : 0)
        - (n - x) * Math.log(1 - x / n) - x * Math.log(x / n));
  const kupiecPValue = 1 - chi2CDF(Math.abs(kupiecLR), 1);

  const { stat: ccStat } = christoffersenTest(exceptionIndicator);
  const christoffersenPValue = 1 - chi2CDF(Math.abs(ccStat), 2);

  const { zone, multiplier } = baselTrafficLight(x, n, confidence);

  return {
    method,
    confidenceLevel: confidence,
    observationPeriod: n,
    exceptions: x,
    expectedExceptions,
    kupiecPValue,
    kupiecPass: kupiecPValue > 0.05,
    christoffersenPValue,
    christoffersenPass: christoffersenPValue > 0.05,
    baselZone: zone,
    baselMultiplier: multiplier,
    exceptionDates: exceptions,
  };
}

function christoffersenTest(indicators: number[]): { stat: number } {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
  for (let i = 1; i < indicators.length; i++) {
    const prev = indicators[i - 1], curr = indicators[i];
    if (prev === 0 && curr === 0) n00++;
    else if (prev === 0 && curr === 1) n01++;
    else if (prev === 1 && curr === 0) n10++;
    else n11++;
  }

  const pi01 = n01 / Math.max(n00 + n01, 1);
  const pi11 = n11 / Math.max(n10 + n11, 1);
  const pi = (n01 + n11) / Math.max(n00 + n01 + n10 + n11, 1);

  if (pi === 0 || pi === 1 || pi01 === 0 || pi01 === 1) return { stat: 0 };

  const lrInd = -2 * (
    (n00 + n10) * Math.log(1 - pi) + (n01 + n11) * Math.log(pi)
    - n00 * Math.log(1 - pi01) - n01 * Math.log(pi01)
    - n10 * Math.log(1 - (pi11 || 1e-10)) - n11 * Math.log(pi11 || 1e-10)
  );

  return { stat: isFinite(lrInd) ? lrInd : 0 };
}

function baselTrafficLight(
  exceptions: number,
  observations: number,
  _confidence: ConfidenceLevel,
): { zone: 'green' | 'yellow' | 'red'; multiplier: number } {
  const ratio = (exceptions / observations) * 250;
  if (ratio <= 4) return { zone: 'green', multiplier: 3.0 };
  if (ratio <= 9) {
    const add = [0.4, 0.5, 0.65, 0.75, 0.85][Math.min(Math.floor(ratio) - 5, 4)] ?? 0.85;
    return { zone: 'yellow', multiplier: 3.0 + add };
  }
  return { zone: 'red', multiplier: 4.0 };
}

function chi2CDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return lowerIncompleteGamma(k / 2, x / 2) / gammaFunction(k / 2);
}

function gammaFunction(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  z -= 1;
  const g = 7;
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = coefficients[0];
  for (let i = 1; i < g + 2; i++) x += coefficients[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function lowerIncompleteGamma(s: number, x: number): number {
  if (x === 0) return 0;
  let sum = 0, term = 1 / s;
  for (let n = 1; n < 200; n++) {
    sum += term;
    term *= x / (s + n);
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.pow(x, s) * Math.exp(-x) * sum;
}

// ─── P&L Attribution ────────────────────────────────────────────────────────

export function attributePnL(
  portfolio: Portfolio,
  previousPositions: Position[],
  factorReturns: Record<string, number>,
): PnLAttribution {
  const byAsset: Record<string, number> = {};
  const byFactor: Record<string, number> = {};
  let totalPnl = 0;

  let deltaPnl = 0, gammaPnl = 0, vegaPnl = 0, thetaPnl = 0, rhoPnl = 0;

  for (const pos of portfolio.positions) {
    const prev = previousPositions.find(p => p.id === pos.id);
    const prevPrice = prev?.currentPrice ?? pos.entryPrice;
    const pricePnl = (pos.currentPrice - prevPrice) * pos.quantity;
    byAsset[pos.symbol] = (byAsset[pos.symbol] ?? 0) + pricePnl;
    totalPnl += pricePnl;

    if (pos.Greeks) {
      const dS = pos.currentPrice - prevPrice;
      deltaPnl += (pos.Greeks.delta ?? 0) * dS;
      gammaPnl += 0.5 * (pos.Greeks.gamma ?? 0) * dS * dS;
      vegaPnl += pos.Greeks.vega ?? 0;
      thetaPnl += pos.Greeks.theta ?? 0;
      rhoPnl += pos.Greeks.rho ?? 0;
    }
  }

  for (const [factor, ret] of Object.entries(factorReturns)) {
    byFactor[factor] = ret * portfolio.totalValue;
  }

  const explained = deltaPnl + gammaPnl + vegaPnl + thetaPnl + rhoPnl;

  return {
    total: totalPnl,
    byAsset,
    byFactor,
    byGreek: {
      delta: deltaPnl,
      gamma: gammaPnl,
      vega: vegaPnl,
      theta: thetaPnl,
      rho: rhoPnl,
      unexplained: totalPnl - explained,
    },
    period: { start: Date.now() - 86400000, end: Date.now() },
  };
}

// ─── Sensitivity Analysis ───────────────────────────────────────────────────

export function computeSensitivities(
  position: Position,
  pricingFn: (price: number, vol: number, rate: number, time: number) => number,
  spotPrice: number,
  vol: number,
  rate: number,
  timeToExpiry: number,
  bumpSize: number = 0.01,
): SensitivityResult {
  const baseValue = pricingFn(spotPrice, vol, rate, timeToExpiry);
  const upPrice = pricingFn(spotPrice * (1 + bumpSize), vol, rate, timeToExpiry);
  const downPrice = pricingFn(spotPrice * (1 - bumpSize), vol, rate, timeToExpiry);

  const dS = spotPrice * bumpSize;
  const delta = (upPrice - downPrice) / (2 * dS);
  const gamma = (upPrice - 2 * baseValue + downPrice) / (dS * dS);

  const volBump = 0.01;
  const upVol = pricingFn(spotPrice, vol + volBump, rate, timeToExpiry);
  const vega = (upVol - baseValue) / volBump;

  const dt = 1 / 365;
  const futureValue = pricingFn(spotPrice, vol, rate, Math.max(timeToExpiry - dt, 0));
  const theta = (futureValue - baseValue) / dt;

  const rateBump = 0.0001;
  const upRate = pricingFn(spotPrice, vol, rate + rateBump, timeToExpiry);
  const rho = (upRate - baseValue) / rateBump;

  return {
    positionId: position.id,
    delta: delta * position.quantity,
    gamma: gamma * position.quantity,
    vega: vega * position.quantity,
    theta: theta * position.quantity,
    rho: rho * position.quantity,
    timestamp: Date.now(),
  };
}

export function sensitivityLadder(
  portfolio: Portfolio,
  factorId: string,
  shockRange: number[],
): SensitivityLadder {
  const pnlResults = shockRange.map(shock => {
    let pnl = 0;
    for (const pos of portfolio.positions) {
      const delta = pos.Greeks?.delta ?? 1;
      const gamma = pos.Greeks?.gamma ?? 0;
      const dS = pos.currentPrice * shock;
      pnl += delta * dS + 0.5 * gamma * dS * dS;
    }
    return pnl;
  });

  return {
    factorId,
    factorName: factorId,
    shockLevels: shockRange,
    pnlResults,
  };
}

// ─── Factor Decomposition & Risk Contributions ─────────────────────────────

export function factorRiskDecomposition(
  portfolioReturns: number[],
  factorReturns: number[][],
  factorNames: string[],
): { factorBetas: Record<string, number>; factorContributions: Record<string, number>; specificRisk: number } {
  const n = factorReturns.length;
  const T = portfolioReturns.length;
  const betas: number[] = new Array(n).fill(0);
  const portMean = mean(portfolioReturns);

  for (let i = 0; i < n; i++) {
    const fMean = mean(factorReturns[i]);
    let cov = 0, fVar = 0;
    for (let t = 0; t < T; t++) {
      const dp = portfolioReturns[t] - portMean;
      const df = factorReturns[i][t] - fMean;
      cov += dp * df;
      fVar += df * df;
    }
    betas[i] = fVar > 0 ? cov / fVar : 0;
  }

  const portVar = portfolioReturns.reduce((s, r) => s + (r - portMean) ** 2, 0) / (T - 1);
  let explainedVar = 0;
  const factorBetas: Record<string, number> = {};
  const factorContributions: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const fVar = factorReturns[i].reduce((s, r) => s + (r - mean(factorReturns[i])) ** 2, 0) / (T - 1);
    const contrib = betas[i] ** 2 * fVar;
    explainedVar += contrib;
    factorBetas[factorNames[i]] = betas[i];
    factorContributions[factorNames[i]] = portVar > 0 ? contrib / portVar : 0;
  }

  return {
    factorBetas,
    factorContributions,
    specificRisk: Math.max(1 - explainedVar / (portVar || 1), 0),
  };
}

export function marginalRiskContribution(
  weights: number[],
  covMatrix: number[][],
): number[] {
  const n = weights.length;
  const portVar = portfolioVariance(weights, covMatrix);
  const portVol = Math.sqrt(portVar);
  if (portVol === 0) return new Array(n).fill(0);

  const mrc: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let covSum = 0;
    for (let j = 0; j < n; j++) {
      covSum += weights[j] * covMatrix[i][j];
    }
    mrc[i] = covSum / portVol;
  }
  return mrc;
}

export function componentRiskContribution(
  weights: number[],
  covMatrix: number[][],
): number[] {
  const mrc = marginalRiskContribution(weights, covMatrix);
  return mrc.map((m, i) => weights[i] * m);
}

export function incrementalVaR(
  portfolio: Portfolio,
  newPosition: Position,
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): number {
  const currentReturns = portfolio.historicalReturns;
  const { var: currentVar } = historicalVaR(currentReturns, confidence, horizon);

  const newWeight = newPosition.marketValue / (portfolio.totalValue + newPosition.marketValue);
  const adjustedReturns = currentReturns.map(r => r * (1 - newWeight) + r * newWeight);
  const { var: newVar } = historicalVaR(adjustedReturns, confidence, horizon);

  return newVar - currentVar;
}

function portfolioVariance(weights: number[], covMatrix: number[][]): number {
  const n = weights.length;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return variance;
}

// ─── Risk Budgeting ─────────────────────────────────────────────────────────

export function riskBudget(
  weights: number[],
  covMatrix: number[][],
  riskBudgets: number[],
  maxIterations: number = 500,
  tolerance: number = 1e-8,
): number[] {
  const n = weights.length;
  let w = weights.map(x => Math.max(x, 1e-6));
  const totalBudget = riskBudgets.reduce((s, b) => s + b, 0);
  const normalizedBudgets = riskBudgets.map(b => b / totalBudget);

  for (let iter = 0; iter < maxIterations; iter++) {
    const portVol = Math.sqrt(portfolioVariance(w, covMatrix));
    if (portVol === 0) break;

    const mrc = marginalRiskContribution(w, covMatrix);
    const crc = w.map((wi, i) => wi * mrc[i]);
    const totalRisk = crc.reduce((s, c) => s + c, 0);

    let maxDiff = 0;
    const newW = new Array(n);
    for (let i = 0; i < n; i++) {
      const targetRC = normalizedBudgets[i] * totalRisk;
      const currentRC = crc[i];
      const ratio = targetRC / (currentRC || 1e-12);
      newW[i] = w[i] * Math.pow(ratio, 0.5);
      maxDiff = Math.max(maxDiff, Math.abs(newW[i] - w[i]));
    }

    const sumW = newW.reduce((s: number, x: number) => s + x, 0);
    w = newW.map((x: number) => x / sumW);

    if (maxDiff < tolerance) break;
  }

  return w;
}

// ─── Concentration Risk ─────────────────────────────────────────────────────

export function herfindahlIndex(weights: number[]): number {
  return weights.reduce((s, w) => s + w * w, 0);
}

export function effectiveN(weights: number[]): number {
  const hhi = herfindahlIndex(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

export function topNExposure(
  positions: Position[],
  n: number,
): { positions: Position[]; totalExposure: number; portfolioPercent: number } {
  const totalValue = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const sorted = [...positions].sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));
  const topN = sorted.slice(0, n);
  const topExposure = topN.reduce((s, p) => s + Math.abs(p.marketValue), 0);

  return {
    positions: topN,
    totalExposure: topExposure,
    portfolioPercent: totalValue > 0 ? topExposure / totalValue : 0,
  };
}

export function sectorConcentration(
  positions: Position[],
): Record<string, { exposure: number; weight: number; count: number }> {
  const totalValue = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const sectors: Record<string, { exposure: number; weight: number; count: number }> = {};

  for (const pos of positions) {
    const sector = pos.sector ?? 'Unknown';
    if (!sectors[sector]) sectors[sector] = { exposure: 0, weight: 0, count: 0 };
    sectors[sector].exposure += Math.abs(pos.marketValue);
    sectors[sector].count++;
  }

  for (const sec of Object.values(sectors)) {
    sec.weight = totalValue > 0 ? sec.exposure / totalValue : 0;
  }

  return sectors;
}

// ─── Correlation Risk ───────────────────────────────────────────────────────

export function rollingCorrelation(
  series1: number[],
  series2: number[],
  windowSize: number,
): number[] {
  const n = Math.min(series1.length, series2.length);
  const correlations: number[] = [];

  for (let i = windowSize; i <= n; i++) {
    const s1 = series1.slice(i - windowSize, i);
    const s2 = series2.slice(i - windowSize, i);
    const m1 = mean(s1), m2 = mean(s2);
    const std1 = stddev(s1), std2 = stddev(s2);

    if (std1 === 0 || std2 === 0) {
      correlations.push(0);
      continue;
    }

    let cov = 0;
    for (let j = 0; j < windowSize; j++) {
      cov += (s1[j] - m1) * (s2[j] - m2);
    }
    correlations.push(cov / ((windowSize - 1) * std1 * std2));
  }

  return correlations;
}

export function regimeDependentCorrelation(
  series1: number[],
  series2: number[],
  regimeThreshold: number = 0,
): { bullCorrelation: number; bearCorrelation: number; fullCorrelation: number } {
  const marketReturns = series1;
  const bull1: number[] = [], bull2: number[] = [];
  const bear1: number[] = [], bear2: number[] = [];

  for (let i = 0; i < Math.min(series1.length, series2.length); i++) {
    if (marketReturns[i] >= regimeThreshold) {
      bull1.push(series1[i]);
      bull2.push(series2[i]);
    } else {
      bear1.push(series1[i]);
      bear2.push(series2[i]);
    }
  }

  return {
    bullCorrelation: pairCorrelation(bull1, bull2),
    bearCorrelation: pairCorrelation(bear1, bear2),
    fullCorrelation: pairCorrelation(series1, series2),
  };
}

function pairCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  const sa = stddev(a.slice(0, n)), sb = stddev(b.slice(0, n));
  if (sa === 0 || sb === 0) return 0;
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (a[i] - ma) * (b[i] - mb);
  return cov / ((n - 1) * sa * sb);
}

// ─── Extreme Value Theory ───────────────────────────────────────────────────

/**
 * Peaks-Over-Threshold (POT) method using the Generalized Pareto Distribution.
 * Fits GPD parameters via probability-weighted moments.
 */
export function peaksOverThreshold(
  losses: number[],
  thresholdQuantile: number = 0.95,
): EVTResult {
  const sorted = [...losses].sort((a, b) => a - b);
  const threshold = percentile(sorted, thresholdQuantile);
  const exceedances = sorted.filter(x => x > threshold).map(x => x - threshold);
  const nExceed = exceedances.length;

  if (nExceed < 10) {
    return {
      method: 'pot',
      threshold,
      shapeParameter: 0,
      scaleParameter: stddev(losses),
      tailIndex: 0,
      expectedTailLoss: mean(losses),
      tailVaR: { 0.90: 0, 0.95: 0, 0.975: 0, 0.99: 0, 0.995: 0 },
    };
  }

  exceedances.sort((a, b) => a - b);
  const meanExcess = mean(exceedances);
  let b0 = meanExcess;
  let b1 = 0;
  for (let i = 0; i < nExceed; i++) {
    b1 += ((i) / (nExceed - 1)) * exceedances[i];
  }
  b1 /= nExceed;

  const xi = 2 - b0 / (b0 - 2 * b1);
  const sigma = (2 * b0 * b1) / (b0 - 2 * b1);
  const clampedXi = Math.max(Math.min(xi, 0.5), -0.5);

  const n = losses.length;
  const nu = nExceed;
  const tailVaR: Record<ConfidenceLevel, number> = {} as Record<ConfidenceLevel, number>;

  for (const cl of [0.90, 0.95, 0.975, 0.99, 0.995] as ConfidenceLevel[]) {
    if (Math.abs(clampedXi) < 1e-6) {
      tailVaR[cl] = threshold + sigma * Math.log((n / nu) * (1 - cl));
    } else {
      tailVaR[cl] = threshold + (sigma / clampedXi) * (Math.pow((n / nu) * (1 - cl), -clampedXi) - 1);
    }
  }

  const etl = clampedXi < 1
    ? (tailVaR[0.99] + sigma - clampedXi * threshold) / (1 - clampedXi)
    : Infinity;

  return {
    method: 'pot',
    threshold,
    shapeParameter: clampedXi,
    scaleParameter: Math.max(sigma, 0),
    tailIndex: clampedXi,
    expectedTailLoss: Math.max(etl, 0),
    tailVaR,
  };
}

/**
 * Block Maxima method using the Generalized Extreme Value distribution.
 * Fits GEV parameters via L-moments.
 */
export function blockMaxima(
  losses: number[],
  blockSize: number = 21,
): EVTResult {
  const blocks: number[] = [];
  for (let i = 0; i < losses.length; i += blockSize) {
    const block = losses.slice(i, i + blockSize);
    if (block.length >= blockSize / 2) {
      blocks.push(Math.max(...block));
    }
  }

  if (blocks.length < 5) {
    return {
      method: 'block_maxima',
      shapeParameter: 0,
      scaleParameter: stddev(losses),
      locationParameter: mean(losses),
      tailIndex: 0,
      expectedTailLoss: mean(losses),
      tailVaR: { 0.90: 0, 0.95: 0, 0.975: 0, 0.99: 0, 0.995: 0 },
    };
  }

  blocks.sort((a, b) => a - b);
  const nB = blocks.length;

  let l1 = 0, l2 = 0, l3 = 0;
  for (let i = 0; i < nB; i++) {
    l1 += blocks[i];
    l2 += ((2 * (i + 1) - nB - 1) / (nB * (nB - 1))) * blocks[i];
    if (nB > 2) {
      const c3 = ((i) * (i - 1)) / ((nB - 1) * (nB - 2))
               - (2 * i * (nB - 1 - i)) / ((nB - 1) * (nB - 2))
               + ((nB - 1 - i) * (nB - 2 - i)) / ((nB - 1) * (nB - 2));
      l3 += c3 * blocks[i];
    }
  }
  l1 /= nB;
  l3 /= nB;

  const t3 = l2 !== 0 ? l3 / l2 : 0;
  const c = (2 / (3 + t3)) - Math.log(2) / Math.log(3);
  const xi = 7.8590 * c + 2.9554 * c * c;
  const clampedXi = Math.max(Math.min(xi, 0.5), -0.5);

  const gXi = clampedXi !== 0 ? gammaFunction(1 - clampedXi) : 1;
  const sigma = l2 * clampedXi / (gXi * (1 - Math.pow(2, -clampedXi)));
  const mu = l1 - sigma * (gXi - 1) / clampedXi;

  const tailVaR: Record<ConfidenceLevel, number> = {} as Record<ConfidenceLevel, number>;
  for (const cl of [0.90, 0.95, 0.975, 0.99, 0.995] as ConfidenceLevel[]) {
    const yp = -Math.log(cl);
    if (Math.abs(clampedXi) < 1e-6) {
      tailVaR[cl] = mu - sigma * Math.log(yp);
    } else {
      tailVaR[cl] = mu + (sigma / clampedXi) * (Math.pow(yp, -clampedXi) - 1);
    }
  }

  return {
    method: 'block_maxima',
    shapeParameter: clampedXi,
    scaleParameter: Math.max(sigma, 0),
    locationParameter: mu,
    tailIndex: clampedXi,
    expectedTailLoss: mu + sigma * (gammaFunction(1 - clampedXi) - 1) / clampedXi,
    tailVaR,
  };
}

// ─── Comprehensive VaR Calculation ──────────────────────────────────────────

export function calculateVaR(
  portfolio: Portfolio,
  method: VaRMethod,
  confidence: ConfidenceLevel,
  horizon: Horizon = '1d',
): VaRResult {
  const returns = portfolio.historicalReturns;

  if (returns.length === 0) return emptyVaRResult(method, confidence, horizon);

  let result: { var: number; es: number };

  switch (method) {
    case 'historical':
      result = historicalVaR(returns, confidence, horizon);
      break;
    case 'parametric':
      result = parametricVaR(returns, confidence, horizon);
      break;
    case 'cornish_fisher':
      result = cornishFisherVaR(returns, confidence, horizon);
      break;
    case 'monte_carlo':
      result = monteCarloVaR(returns, confidence, horizon);
      break;
    default:
      result = historicalVaR(returns, confidence, horizon);
  }

  const weights = portfolio.positions.map(p => p.weight);
  const returnsSeries = portfolio.positions.map(() => returns);
  const cov = covarianceMatrix(returnsSeries.length > 0 ? returnsSeries : [[0]]);
  const compRisk = componentRiskContribution(weights, cov);
  const margRisk = marginalRiskContribution(weights, cov);

  const componentVaR: Record<string, number> = {};
  const marginalVaR: Record<string, number> = {};
  portfolio.positions.forEach((p, i) => {
    componentVaR[p.id] = (compRisk[i] ?? 0) * result.var;
    marginalVaR[p.id] = (margRisk[i] ?? 0) * result.var;
  });

  return {
    method,
    confidenceLevel: confidence,
    horizon,
    var: result.var * portfolio.totalValue,
    expectedShortfall: result.es * portfolio.totalValue,
    componentVaR,
    marginalVaR,
    timestamp: Date.now(),
  };
}

function emptyVaRResult(method: VaRMethod, confidence: ConfidenceLevel, horizon: Horizon): VaRResult {
  return {
    method,
    confidenceLevel: confidence,
    horizon,
    var: 0,
    expectedShortfall: 0,
    timestamp: Date.now(),
  };
}

// ─── Tail Risk Metrics ──────────────────────────────────────────────────────

export function tailRiskMetrics(
  returns: number[],
): { expectedTailLoss95: number; expectedTailLoss99: number; tailRatio: number; maxDrawdown: number } {
  if (returns.length === 0) {
    return { expectedTailLoss95: 0, expectedTailLoss99: 0, tailRatio: 0, maxDrawdown: 0 };
  }

  const sorted = [...returns].sort((a, b) => a - b);
  const cut95 = Math.max(Math.floor(0.05 * sorted.length), 1);
  const cut99 = Math.max(Math.floor(0.01 * sorted.length), 1);

  const etl95 = -mean(sorted.slice(0, cut95));
  const etl99 = -mean(sorted.slice(0, cut99));

  const sigma = stddev(returns);
  const tailRatio = sigma > 0 ? etl99 / sigma : 0;

  let peak = 0, maxDD = 0, cumulative = 0;
  for (const r of returns) {
    cumulative += r;
    peak = Math.max(peak, cumulative);
    maxDD = Math.max(maxDD, peak - cumulative);
  }

  return {
    expectedTailLoss95: etl95,
    expectedTailLoss99: etl99,
    tailRatio,
    maxDrawdown: maxDD,
  };
}

// ─── Multi-Method VaR Summary ───────────────────────────────────────────────

export function fullVaRReport(
  portfolio: Portfolio,
  confidenceLevels: ConfidenceLevel[] = [0.95, 0.99],
  horizons: Horizon[] = ['1d', '10d'],
): VaRResult[] {
  const methods: VaRMethod[] = ['historical', 'parametric', 'cornish_fisher', 'monte_carlo'];
  const results: VaRResult[] = [];

  for (const method of methods) {
    for (const cl of confidenceLevels) {
      for (const h of horizons) {
        results.push(calculateVaR(portfolio, method, cl, h));
      }
    }
  }

  return results;
}
