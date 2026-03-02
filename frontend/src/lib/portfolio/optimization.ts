import type {
  OptimizationResult,
  EfficientFrontierPoint,
  OptimizationConstraints,
  BlackLittermanInputs,
  RebalanceResult,
  TaxLot,
  TaxHarvestResult,
  Position,
} from './types';
import {
  matMul,
  matVecMul,
  transpose,
  matInverse,
  choleskyDecomposition,
  mean,
  stdDev,
  sampleCovarianceMatrix,
  correlationMatrix,
} from './risk';

// ─── Helper Utilities ───────────────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function scalarMul(scalar: number, vec: number[]): number[] {
  return vec.map(v => v * scalar);
}

function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function vecSub(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function onesVector(n: number): number[] {
  return new Array(n).fill(1);
}

function identityMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

function portfolioReturn(weights: number[], expectedReturns: number[]): number {
  return dotProduct(weights, expectedReturns);
}

function portfolioVariance(weights: number[], covMatrix: number[][]): number {
  return dotProduct(weights, matVecMul(covMatrix, weights));
}

function portfolioVol(weights: number[], covMatrix: number[][]): number {
  return Math.sqrt(portfolioVariance(weights, covMatrix));
}

// ─── Projection onto Constraints ────────────────────────────────────────────

function projectWeights(weights: number[], constraints: OptimizationConstraints): number[] {
  const n = weights.length;
  let w = [...weights];

  if (constraints.longOnly) {
    w = w.map(v => Math.max(0, v));
  }

  if (constraints.minWeight !== undefined) {
    w = w.map(v => Math.max(constraints.minWeight!, v));
  }
  if (constraints.maxWeight !== undefined) {
    w = w.map(v => Math.min(constraints.maxWeight!, v));
  }

  // Re-normalize to sum to 1
  const sum = w.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    w = w.map(v => v / sum);
  } else {
    w = new Array(n).fill(1 / n);
  }

  return w;
}

// ─── Mean-Variance Optimization (Markowitz) ─────────────────────────────────

export function minimumVariancePortfolio(
  covMatrix: number[][],
  constraints?: OptimizationConstraints
): { weights: number[]; variance: number } {
  const n = covMatrix.length;

  if (!constraints || (!constraints.longOnly && !constraints.minWeight && !constraints.maxWeight)) {
    // Analytical solution: w* = Σ⁻¹ * 1 / (1' * Σ⁻¹ * 1)
    const covInv = matInverse(covMatrix);
    const ones = onesVector(n);
    const covInvOnes = matVecMul(covInv, ones);
    const denom = dotProduct(ones, covInvOnes);
    const weights = covInvOnes.map(v => v / denom);
    return { weights, variance: portfolioVariance(weights, covMatrix) };
  }

  // Projected gradient descent for constrained case
  let w = new Array(n).fill(1 / n);
  const lr = 0.001;
  const iterations = 5000;

  for (let iter = 0; iter < iterations; iter++) {
    const grad = scalarMul(2, matVecMul(covMatrix, w));
    w = vecSub(w, scalarMul(lr, grad));
    w = projectWeights(w, constraints);
  }

  return { weights: w, variance: portfolioVariance(w, covMatrix) };
}

export function maxSharpePortfolio(
  expectedReturns: number[],
  covMatrix: number[][],
  riskFreeRate = 0,
  constraints?: OptimizationConstraints
): { weights: number[]; sharpe: number } {
  const n = expectedReturns.length;

  if (!constraints || (!constraints.longOnly && !constraints.minWeight && !constraints.maxWeight)) {
    // Analytical: w* = Σ⁻¹ * (μ - rf) / (1' * Σ⁻¹ * (μ - rf))
    const excessReturns = expectedReturns.map(r => r - riskFreeRate);
    const covInv = matInverse(covMatrix);
    const covInvExcess = matVecMul(covInv, excessReturns);
    const denom = dotProduct(onesVector(n), covInvExcess);
    const weights = covInvExcess.map(v => v / denom);
    const vol = portfolioVol(weights, covMatrix);
    const ret = portfolioReturn(weights, expectedReturns);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
    return { weights, sharpe };
  }

  // Gradient ascent on Sharpe ratio
  let w = new Array(n).fill(1 / n);
  const lr = 0.0005;
  const iterations = 8000;

  for (let iter = 0; iter < iterations; iter++) {
    const ret = portfolioReturn(w, expectedReturns);
    const vol = portfolioVol(w, covMatrix);
    const excessRet = ret - riskFreeRate;

    if (vol < 1e-12) break;

    // ∂S/∂w = (μ * vol - excessRet * ∂vol/∂w) / vol²
    const covW = matVecMul(covMatrix, w);
    const dVolDw = covW.map(v => v / vol);
    const grad = expectedReturns.map((mu, i) =>
      (mu * vol - excessRet * dVolDw[i]) / (vol * vol)
    );

    w = vecAdd(w, scalarMul(lr, grad));
    w = projectWeights(w, constraints ?? {});
  }

  const vol = portfolioVol(w, covMatrix);
  const ret = portfolioReturn(w, expectedReturns);
  return { weights: w, sharpe: vol > 0 ? (ret - riskFreeRate) / vol : 0 };
}

export function targetReturnPortfolio(
  expectedReturns: number[],
  covMatrix: number[][],
  targetReturn: number,
  constraints?: OptimizationConstraints
): { weights: number[]; variance: number } {
  const n = expectedReturns.length;
  let w = new Array(n).fill(1 / n);
  const lr = 0.001;
  const lambda = 10;
  const iterations = 5000;

  for (let iter = 0; iter < iterations; iter++) {
    const ret = portfolioReturn(w, expectedReturns);
    const gradVar = scalarMul(2, matVecMul(covMatrix, w));
    const gradConstraint = scalarMul(2 * lambda * (ret - targetReturn), expectedReturns);
    const grad = vecAdd(gradVar, gradConstraint);

    w = vecSub(w, scalarMul(lr, grad));
    w = projectWeights(w, constraints ?? {});
  }

  return { weights: w, variance: portfolioVariance(w, covMatrix) };
}

export function targetRiskPortfolio(
  expectedReturns: number[],
  covMatrix: number[][],
  targetVol: number,
  constraints?: OptimizationConstraints
): { weights: number[]; expectedReturn: number } {
  const n = expectedReturns.length;
  let w = new Array(n).fill(1 / n);
  const lr = 0.001;
  const lambda = 10;
  const iterations = 5000;

  for (let iter = 0; iter < iterations; iter++) {
    const vol = portfolioVol(w, covMatrix);
    // Maximize return subject to vol = targetVol
    const gradReturn = scalarMul(-1, expectedReturns);
    const covW = matVecMul(covMatrix, w);
    const dVolDw = vol > 0 ? covW.map(v => v / vol) : new Array(n).fill(0);
    const gradConstraint = scalarMul(2 * lambda * (vol - targetVol), dVolDw);
    const grad = vecAdd(gradReturn, gradConstraint);

    w = vecSub(w, scalarMul(lr, grad));
    w = projectWeights(w, constraints ?? {});
  }

  return { weights: w, expectedReturn: portfolioReturn(w, expectedReturns) };
}

// ─── Efficient Frontier ─────────────────────────────────────────────────────

export function efficientFrontier(
  expectedReturns: number[],
  covMatrix: number[][],
  numPoints = 50,
  riskFreeRate = 0,
  constraints?: OptimizationConstraints
): EfficientFrontierPoint[] {
  const minVarResult = minimumVariancePortfolio(covMatrix, constraints);
  const minReturn = portfolioReturn(minVarResult.weights, expectedReturns);
  const maxReturn = Math.max(...expectedReturns);

  const points: EfficientFrontierPoint[] = [];
  const step = (maxReturn - minReturn) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const target = minReturn + i * step;
    const result = targetReturnPortfolio(expectedReturns, covMatrix, target, constraints);
    const vol = Math.sqrt(result.variance);
    const ret = portfolioReturn(result.weights, expectedReturns);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;

    points.push({
      risk: vol,
      return: ret,
      weights: result.weights,
      sharpe,
    });
  }

  return points;
}

export function meanVarianceOptimization(
  expectedReturns: number[],
  covMatrix: number[][],
  riskFreeRate = 0,
  constraints?: OptimizationConstraints
): OptimizationResult {
  const frontier = efficientFrontier(expectedReturns, covMatrix, 50, riskFreeRate, constraints);
  const maxSharpe = maxSharpePortfolio(expectedReturns, covMatrix, riskFreeRate, constraints);

  return {
    weights: maxSharpe.weights,
    expectedReturn: portfolioReturn(maxSharpe.weights, expectedReturns),
    expectedVolatility: portfolioVol(maxSharpe.weights, covMatrix),
    sharpe: maxSharpe.sharpe,
    efficientFrontier: frontier,
  };
}

// ─── Black-Litterman Model ──────────────────────────────────────────────────

export function blackLittermanEquilibriumReturns(
  covMatrix: number[][],
  marketWeights: number[],
  riskAversion: number
): number[] {
  // π = δ * Σ * w_mkt
  return scalarMul(riskAversion, matVecMul(covMatrix, marketWeights));
}

export function blackLittermanPosterior(
  covMatrix: number[][],
  equilibriumReturns: number[],
  viewMatrix: number[][],
  viewReturns: number[],
  viewConfidence: number[],
  tau = 0.05
): { posteriorReturns: number[]; posteriorCov: number[][] } {
  const n = covMatrix.length;
  const k = viewReturns.length;

  // Ω = diag(confidence)⁻¹ — uncertainty of views
  const omega: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? 1 / viewConfidence[i] : 0))
  );

  // τΣ
  const tauCov: number[][] = covMatrix.map(row => row.map(v => v * tau));
  const tauCovInv = matInverse(tauCov);

  // P' * Ω⁻¹ * P
  const P = viewMatrix;
  const Pt = transpose(P);
  const omegaInv = matInverse(omega);
  const PtOmegaInvP = matMul(matMul(Pt, omegaInv), P);

  // Posterior precision = (τΣ)⁻¹ + P' Ω⁻¹ P
  const posteriorPrecision: number[][] = tauCovInv.map((row, i) =>
    row.map((v, j) => v + PtOmegaInvP[i][j])
  );
  const posteriorCov = matInverse(posteriorPrecision);

  // Posterior mean = posteriorCov * ((τΣ)⁻¹ π + P' Ω⁻¹ q)
  const term1 = matVecMul(tauCovInv, equilibriumReturns);
  const term2 = matVecMul(matMul(Pt, omegaInv), viewReturns);
  const combined = vecAdd(term1, term2);
  const posteriorReturns = matVecMul(posteriorCov, combined);

  return { posteriorReturns, posteriorCov };
}

export function blackLittermanOptimization(
  inputs: BlackLittermanInputs,
  covMatrix: number[][],
  riskFreeRate = 0,
  constraints?: OptimizationConstraints
): OptimizationResult {
  const equilibriumReturns = blackLittermanEquilibriumReturns(
    covMatrix, inputs.marketCap.map(mc => mc / inputs.marketCap.reduce((s, v) => s + v, 0)),
    inputs.riskAversion
  );

  const { posteriorReturns, posteriorCov } = blackLittermanPosterior(
    covMatrix,
    equilibriumReturns,
    inputs.viewMatrix,
    inputs.viewReturns,
    inputs.viewConfidence,
    inputs.tau
  );

  return meanVarianceOptimization(posteriorReturns, posteriorCov, riskFreeRate, constraints);
}

// ─── Risk Parity ────────────────────────────────────────────────────────────

export function riskParity(
  covMatrix: number[][],
  riskBudget?: number[]
): { weights: number[]; riskContributions: number[] } {
  const n = covMatrix.length;
  const budget = riskBudget ?? new Array(n).fill(1 / n);
  let w = new Array(n).fill(1 / n);
  const lr = 0.0001;
  const iterations = 10000;

  for (let iter = 0; iter < iterations; iter++) {
    const sigma = portfolioVol(w, covMatrix);
    if (sigma < 1e-12) break;

    const covW = matVecMul(covMatrix, w);
    const marginal = covW.map(v => v / sigma);
    const riskContrib = w.map((wi, i) => wi * marginal[i]);
    const totalRC = riskContrib.reduce((s, v) => s + v, 0);

    const grad = new Array(n);
    for (let i = 0; i < n; i++) {
      const targetRC = budget[i] * totalRC;
      grad[i] = riskContrib[i] - targetRC;
    }

    w = vecSub(w, scalarMul(lr, grad));
    w = w.map(v => Math.max(1e-8, v));
    const sum = w.reduce((s, v) => s + v, 0);
    w = w.map(v => v / sum);
  }

  const sigma = portfolioVol(w, covMatrix);
  const covW = matVecMul(covMatrix, w);
  const riskContributions = w.map((wi, i) => (wi * covW[i]) / (sigma * sigma));

  return { weights: w, riskContributions };
}

// ─── Hierarchical Risk Parity (HRP) ────────────────────────────────────────

function distanceMatrix(corrMatrix: number[][]): number[][] {
  const n = corrMatrix.length;
  return corrMatrix.map(row =>
    row.map(c => Math.sqrt(0.5 * (1 - c)))
  );
}

function singleLinkageClustering(distMatrix: number[][]): number[][] {
  const n = distMatrix.length;
  const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const active = new Set(Array.from({ length: n }, (_, i) => i));
  const merges: number[][] = [];

  const dist = distMatrix.map(row => [...row]);

  while (active.size > 1) {
    let minDist = Infinity;
    let mi = -1, mj = -1;

    const activeArr = Array.from(active);
    for (let ii = 0; ii < activeArr.length; ii++) {
      for (let jj = ii + 1; jj < activeArr.length; jj++) {
        const i = activeArr[ii];
        const j = activeArr[jj];
        if (dist[i][j] < minDist) {
          minDist = dist[i][j];
          mi = i;
          mj = j;
        }
      }
    }

    clusters[mi] = [...clusters[mi], ...clusters[mj]];
    merges.push([mi, mj, minDist]);

    for (const k of active) {
      if (k !== mi && k !== mj) {
        dist[mi][k] = Math.min(dist[mi][k], dist[mj][k]);
        dist[k][mi] = dist[mi][k];
      }
    }

    active.delete(mj);
  }

  return merges;
}

function getQuasiDiagOrder(merges: number[][], n: number): number[] {
  if (n === 1) return [0];
  if (merges.length === 0) return Array.from({ length: n }, (_, i) => i);

  const clusterMembers: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) clusterMembers.set(i, [i]);

  for (const [i, j] of merges) {
    const membersI = clusterMembers.get(i) ?? [i];
    const membersJ = clusterMembers.get(j) ?? [j];
    clusterMembers.set(i, [...membersI, ...membersJ]);
  }

  const lastMerge = merges[merges.length - 1];
  return clusterMembers.get(lastMerge[0]) ?? Array.from({ length: n }, (_, i) => i);
}

function recursiveBisection(
  covMatrix: number[][],
  sortedIndices: number[]
): number[] {
  const n = covMatrix.length;
  const weights = new Array(n).fill(1);

  const bisect = (indices: number[]) => {
    if (indices.length <= 1) return;

    const mid = Math.floor(indices.length / 2);
    const left = indices.slice(0, mid);
    const right = indices.slice(mid);

    // Inverse-variance allocation
    const leftVar = left.reduce((s, i) => s + covMatrix[i][i], 0) / left.length;
    const rightVar = right.reduce((s, i) => s + covMatrix[i][i], 0) / right.length;
    const totalInvVar = 1 / leftVar + 1 / rightVar;
    const leftAlloc = (1 / leftVar) / totalInvVar;
    const rightAlloc = 1 - leftAlloc;

    for (const i of left) weights[i] *= leftAlloc;
    for (const i of right) weights[i] *= rightAlloc;

    bisect(left);
    bisect(right);
  };

  bisect(sortedIndices);

  const sum = weights.reduce((s, v) => s + v, 0);
  return weights.map(w => w / sum);
}

export function hierarchicalRiskParity(
  covMatrix: number[][]
): { weights: number[]; clusterOrder: number[] } {
  const n = covMatrix.length;
  const corrMat = correlationMatrix(covMatrix);
  const distMat = distanceMatrix(corrMat);
  const merges = singleLinkageClustering(distMat);
  const order = getQuasiDiagOrder(merges, n);
  const weights = recursiveBisection(covMatrix, order);

  return { weights, clusterOrder: order };
}

// ─── Maximum Diversification ────────────────────────────────────────────────

export function maxDiversification(
  covMatrix: number[][],
  constraints?: OptimizationConstraints
): { weights: number[]; diversificationRatio: number } {
  const n = covMatrix.length;
  const vols = covMatrix.map((_, i) => Math.sqrt(covMatrix[i][i]));
  let w = new Array(n).fill(1 / n);
  const lr = 0.001;
  const iterations = 5000;

  // Maximize DR = (w' σ) / sqrt(w' Σ w)
  for (let iter = 0; iter < iterations; iter++) {
    const portVol = portfolioVol(w, covMatrix);
    if (portVol < 1e-12) break;

    const wVol = dotProduct(w, vols);
    const covW = matVecMul(covMatrix, w);
    const dPortVolDw = covW.map(v => v / portVol);

    const grad = vols.map((vol, i) =>
      (vol * portVol - wVol * dPortVolDw[i]) / (portVol * portVol)
    );

    w = vecAdd(w, scalarMul(lr, grad));
    w = projectWeights(w, constraints ?? { longOnly: true });
  }

  const portVol = portfolioVol(w, covMatrix);
  const wVol = dotProduct(w, vols);
  const dr = portVol > 0 ? wVol / portVol : 1;

  return { weights: w, diversificationRatio: dr };
}

// ─── Rebalancing ────────────────────────────────────────────────────────────

export function calendarRebalance(
  currentWeights: number[],
  targetWeights: number[],
  symbols: string[],
  totalValue: number,
  prices: number[]
): RebalanceResult {
  const trades = symbols.map((symbol, i) => {
    const tradeWeight = targetWeights[i] - currentWeights[i];
    const tradeValue = tradeWeight * totalValue;
    const shares = prices[i] > 0 ? Math.round(tradeValue / prices[i]) : 0;
    return {
      symbol,
      currentWeight: currentWeights[i],
      targetWeight: targetWeights[i],
      tradeWeight,
      shares,
    };
  });

  const turnover = trades.reduce((s, t) => s + Math.abs(t.tradeWeight), 0) / 2;
  const estimatedCost = trades.reduce((s, t) => s + Math.abs(t.shares) * 0.005, 0);

  return { trades, turnover, estimatedCost };
}

export function thresholdRebalance(
  currentWeights: number[],
  targetWeights: number[],
  symbols: string[],
  totalValue: number,
  prices: number[],
  threshold = 0.05
): RebalanceResult | null {
  const maxDeviation = Math.max(
    ...currentWeights.map((w, i) => Math.abs(w - targetWeights[i]))
  );

  if (maxDeviation < threshold) return null;
  return calendarRebalance(currentWeights, targetWeights, symbols, totalValue, prices);
}

export function optimalRebalance(
  currentWeights: number[],
  targetWeights: number[],
  symbols: string[],
  totalValue: number,
  prices: number[],
  covMatrix: number[][],
  transactionCostBps = 10
): RebalanceResult {
  const n = symbols.length;
  const costPerUnit = transactionCostBps / 10000;

  // Balance between tracking error to target and transaction costs
  // Use gradient descent on: min (w-target)'Σ(w-target) + λ * Σ|w_i - current_i| * cost
  let w = [...currentWeights];
  const lr = 0.0005;
  const lambda = costPerUnit * totalValue;
  const iterations = 3000;

  for (let iter = 0; iter < iterations; iter++) {
    const diff = vecSub(w, targetWeights);
    const gradTE = scalarMul(2, matVecMul(covMatrix, diff));

    const gradCost = w.map((wi, i) => {
      const d = wi - currentWeights[i];
      return lambda * Math.sign(d);
    });

    const grad = vecAdd(gradTE, gradCost);
    w = vecSub(w, scalarMul(lr, grad));

    // Project to simplex
    const sum = w.reduce((s, v) => s + Math.max(0, v), 0);
    w = w.map(v => Math.max(0, v) / (sum || 1));
  }

  const trades = symbols.map((symbol, i) => {
    const tradeWeight = w[i] - currentWeights[i];
    const tradeValue = tradeWeight * totalValue;
    const shares = prices[i] > 0 ? Math.round(tradeValue / prices[i]) : 0;
    return { symbol, currentWeight: currentWeights[i], targetWeight: w[i], tradeWeight, shares };
  });

  const turnover = trades.reduce((s, t) => s + Math.abs(t.tradeWeight), 0) / 2;
  const estimatedCost = trades.reduce((s, t) => s + Math.abs(t.shares * prices[symbols.indexOf(t.symbol)] * costPerUnit), 0);

  return { trades, turnover, estimatedCost };
}

// ─── Tax-Loss Harvesting ────────────────────────────────────────────────────

export function identifyTaxLots(
  lots: TaxLot[],
  method: 'fifo' | 'lifo' | 'highest_cost' | 'specific_id',
  sharesToSell: number
): TaxLot[] {
  let sorted: TaxLot[];
  switch (method) {
    case 'fifo':
      sorted = [...lots].sort((a, b) => a.purchaseDate - b.purchaseDate);
      break;
    case 'lifo':
      sorted = [...lots].sort((a, b) => b.purchaseDate - a.purchaseDate);
      break;
    case 'highest_cost':
      sorted = [...lots].sort((a, b) => b.costBasis - a.costBasis);
      break;
    case 'specific_id':
      sorted = [...lots];
      break;
  }

  const selected: TaxLot[] = [];
  let remaining = sharesToSell;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const qty = Math.min(lot.quantity, remaining);
    selected.push({ ...lot, quantity: qty });
    remaining -= qty;
  }

  return selected;
}

export function checkWashSale(
  soldLot: TaxLot,
  recentPurchases: { symbol: string; date: number }[],
  currentDate: number
): boolean {
  const WASH_SALE_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  return recentPurchases.some(
    purchase =>
      purchase.symbol === soldLot.symbol &&
      Math.abs(purchase.date - currentDate) <= WASH_SALE_WINDOW
  );
}

export function taxLossHarvesting(
  positions: Position[],
  taxLots: TaxLot[],
  currentDate: number,
  recentPurchases: { symbol: string; date: number }[],
  shortTermRate = 0.37,
  longTermRate = 0.20
): TaxHarvestResult {
  const lotsWithLoss = taxLots.filter(lot => {
    const position = positions.find(p => p.symbol === lot.symbol);
    if (!position) return false;
    return position.currentPrice < lot.costBasis;
  });

  const lotsToSell: TaxLot[] = [];
  const washSaleRestrictions: string[] = [];
  let estimatedTaxSavings = 0;

  for (const lot of lotsWithLoss) {
    const position = positions.find(p => p.symbol === lot.symbol)!;
    const lossPerShare = position.currentPrice - lot.costBasis;
    const totalLoss = lossPerShare * lot.quantity;

    const isWashSale = checkWashSale(lot, recentPurchases, currentDate);
    if (isWashSale) {
      washSaleRestrictions.push(
        `${lot.symbol}: Wash sale - purchased within 30 days`
      );
      continue;
    }

    const taxRate = lot.isShortTerm ? shortTermRate : longTermRate;
    const saving = Math.abs(totalLoss) * taxRate;
    estimatedTaxSavings += saving;
    lotsToSell.push(lot);
  }

  const portfolioValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const taxAlpha = portfolioValue > 0 ? estimatedTaxSavings / portfolioValue : 0;

  return { lotsToSell, estimatedTaxSavings, washSaleRestrictions, taxAlpha };
}

// ─── Constraint Validation ──────────────────────────────────────────────────

export function validateConstraints(
  weights: number[],
  constraints: OptimizationConstraints,
  positions?: Position[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (constraints.longOnly) {
    const negatives = weights.filter(w => w < -1e-8);
    if (negatives.length > 0) violations.push(`Long-only violated: ${negatives.length} negative weights`);
  }

  if (constraints.minWeight !== undefined) {
    const below = weights.filter(w => w < constraints.minWeight! - 1e-8);
    if (below.length > 0) violations.push(`Min weight violated: ${below.length} positions below ${constraints.minWeight}`);
  }

  if (constraints.maxWeight !== undefined) {
    const above = weights.filter(w => w > constraints.maxWeight! + 1e-8);
    if (above.length > 0) violations.push(`Max weight violated: ${above.length} positions above ${constraints.maxWeight}`);
  }

  const sumW = weights.reduce((s, w) => s + w, 0);
  if (Math.abs(sumW - 1) > 0.01) violations.push(`Weights sum to ${sumW.toFixed(4)}, not 1.0`);

  if (constraints.sectorLimits && positions) {
    const sectorWeights: Record<string, number> = {};
    for (let i = 0; i < positions.length; i++) {
      const sector = positions[i].sector;
      sectorWeights[sector] = (sectorWeights[sector] ?? 0) + weights[i];
    }
    for (const [sector, limits] of Object.entries(constraints.sectorLimits)) {
      const sw = sectorWeights[sector] ?? 0;
      if (sw < limits.min - 1e-8) violations.push(`Sector ${sector} below min: ${sw.toFixed(4)} < ${limits.min}`);
      if (sw > limits.max + 1e-8) violations.push(`Sector ${sector} above max: ${sw.toFixed(4)} > ${limits.max}`);
    }
  }

  return { valid: violations.length === 0, violations };
}
