# Portfolio Optimization

Apex Terminal's optimization engine in `lib/portfolio/optimization.ts` constructs optimal portfolios using mean-variance analysis, the Black-Litterman model, risk parity, and constrained objective functions — enabling systematic portfolio construction grounded in modern portfolio theory.

## Table of Contents

- [Overview](#overview)
- [Mean-Variance Optimization](#mean-variance-optimization)
- [Efficient Frontier](#efficient-frontier)
- [Black-Litterman Model](#black-litterman-model)
- [Risk Parity](#risk-parity)
- [Minimum Variance Portfolio](#minimum-variance-portfolio)
- [Maximum Sharpe Portfolio](#maximum-sharpe-portfolio)
- [Constraint Handling](#constraint-handling)
- [Transaction Cost Awareness](#transaction-cost-awareness)

## Overview

Portfolio optimization answers: *what weights maximize return for a given risk level?* The optimization module supports multiple frameworks, each with different assumptions and strengths:

```typescript
// lib/portfolio/optimization.ts
export type OptimizationMethod =
  | 'mean_variance'
  | 'black_litterman'
  | 'risk_parity'
  | 'min_variance'
  | 'max_sharpe';

export interface OptimizationResult {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  method: OptimizationMethod;
  convergenceInfo: { iterations: number; converged: boolean };
}
```

## Mean-Variance Optimization

Markowitz mean-variance optimization finds the portfolio weights that minimize variance for a target return (or maximize return for a target variance):

```typescript
export function meanVarianceOptimize(
  expectedReturns: number[],
  covarianceMatrix: number[][],
  targetReturn: number,
  constraints: Constraint[] = []
): OptimizationResult {
  const n = expectedReturns.length;

  // Objective: minimize w'Σw subject to w'μ = targetReturn, Σw = 1
  const objective = (w: number[]) => {
    let variance = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        variance += w[i] * w[j] * covarianceMatrix[i][j];
    return variance;
  };

  const result = quadraticProgramming(objective, [
    { type: 'equality', fn: (w) => sum(w) - 1 },
    { type: 'equality', fn: (w) => dotProduct(w, expectedReturns) - targetReturn },
    ...constraints,
  ]);

  return buildResult(result, expectedReturns, covarianceMatrix, 'mean_variance');
}
```

Inputs:
- **Expected returns** — historical, analyst consensus, or Black-Litterman posterior.
- **Covariance matrix** — sample, shrinkage (Ledoit-Wolf), or factor-model-based.

## Efficient Frontier

The efficient frontier traces the set of optimal portfolios across all risk levels:

```typescript
export function computeEfficientFrontier(
  expectedReturns: number[],
  covarianceMatrix: number[][],
  constraints: Constraint[] = [],
  points: number = 50
): FrontierPoint[] {
  const minReturn = minVarianceReturn(expectedReturns, covarianceMatrix);
  const maxReturn = Math.max(...expectedReturns);
  const step = (maxReturn - minReturn) / points;

  return Array.from({ length: points }, (_, i) => {
    const target = minReturn + i * step;
    const result = meanVarianceOptimize(expectedReturns, covarianceMatrix, target, constraints);
    return { expectedReturn: target, volatility: result.expectedVolatility, weights: result.weights };
  });
}
```

The UI renders the frontier as an interactive curve. Clicking any point displays the corresponding portfolio weights. The current portfolio and individual assets are plotted for comparison.

## Black-Litterman Model

The Black-Litterman model combines market equilibrium returns with investor views to produce stable, intuitive expected returns:

```typescript
export function blackLitterman(
  marketCap: number[],
  covarianceMatrix: number[][],
  riskAversion: number,
  views: View[],
  viewConfidence: number[] = []
): number[] {
  // Step 1: Implied equilibrium returns (π = δΣw_mkt)
  const totalCap = sum(marketCap);
  const mktWeights = marketCap.map(c => c / totalCap);
  const impliedReturns = matVecMul(covarianceMatrix, mktWeights).map(r => r * riskAversion);

  // Step 2: Incorporate views via Bayesian update
  const P = buildPickMatrix(views, marketCap.length);
  const Q = views.map(v => v.expectedReturn);
  const omega = buildUncertaintyMatrix(P, covarianceMatrix, viewConfidence);
  const tau = 0.05;

  const tauSigma = scaleMatrix(covarianceMatrix, tau);
  const posteriorReturns = blPosterior(impliedReturns, tauSigma, P, Q, omega);

  return posteriorReturns;
}
```

Views express relative or absolute return expectations:

```typescript
const views: View[] = [
  { type: 'absolute', asset: 'AAPL', expectedReturn: 0.12 },
  { type: 'relative', long: 'MSFT', short: 'GOOG', expectedReturn: 0.03 },
];
```

## Risk Parity

Risk parity equalizes the risk contribution from each asset, producing a more balanced risk allocation:

```typescript
export function riskParityWeights(
  covarianceMatrix: number[][],
  riskBudget?: number[]
): number[] {
  const n = covarianceMatrix.length;
  const budget = riskBudget ?? Array(n).fill(1 / n);

  const riskContribution = (w: number[]) => {
    const portVol = portfolioVolatility(w, covarianceMatrix);
    return w.map((wi, i) => {
      const marginal = matVecMul(covarianceMatrix, w)[i];
      return wi * marginal / portVol;
    });
  };

  const objective = (w: number[]) => {
    const rc = riskContribution(w);
    const target = budget.map(b => b * portfolioVolatility(w, covarianceMatrix));
    return sum(rc.map((r, i) => (r - target[i]) ** 2));
  };

  return minimize(objective, Array(n).fill(1 / n), [{ type: 'equality', fn: w => sum(w) - 1 }]);
}
```

Risk parity portfolios tend to overweight bonds and underweight equities relative to market-cap weighting.

## Minimum Variance Portfolio

The minimum variance portfolio minimizes total portfolio volatility without a return target:

```typescript
export function minimumVariance(
  covarianceMatrix: number[][],
  constraints: Constraint[] = []
): OptimizationResult {
  return meanVarianceOptimize(
    Array(covarianceMatrix.length).fill(0),
    covarianceMatrix,
    0,
    [...constraints, { type: 'equality', fn: (w) => sum(w) - 1 }]
  );
}
```

This is useful when expected return estimates are unreliable — the covariance structure is generally more stable.

## Maximum Sharpe Portfolio

The tangency portfolio maximizes the Sharpe ratio (return per unit of risk):

```typescript
export function maximumSharpe(
  expectedReturns: number[],
  covarianceMatrix: number[][],
  riskFreeRate: number = 0,
  constraints: Constraint[] = []
): OptimizationResult {
  const objective = (w: number[]) => {
    const ret = dotProduct(w, expectedReturns);
    const vol = portfolioVolatility(w, covarianceMatrix);
    return -(ret - riskFreeRate) / vol;
  };

  const result = minimize(objective, equalWeightInit(expectedReturns.length), [
    { type: 'equality', fn: (w) => sum(w) - 1 },
    ...constraints,
  ]);

  return buildResult(result, expectedReturns, covarianceMatrix, 'max_sharpe');
}
```

## Constraint Handling

The optimizer supports a rich set of constraints:

| Constraint | Description |
|---|---|
| Long-only | All weights ≥ 0 |
| Box bounds | Min/max weight per asset |
| Sector caps | Max total weight per sector |
| Turnover limit | Max change from current weights |
| Cardinality | Max number of assets held |
| Group constraints | Sub-portfolio weight bounds |

```typescript
const constraints: Constraint[] = [
  { type: 'bounds', lower: 0, upper: 0.10 },            // 0–10% per asset
  { type: 'group', assets: techStocks, maxWeight: 0.30 }, // max 30% tech
  { type: 'turnover', maxTurnover: 0.20, currentWeights }, // max 20% turnover
];
```

## Transaction Cost Awareness

Optimization can incorporate transaction costs to avoid impractical rebalancing:

```typescript
export function costAwareOptimize(
  expectedReturns: number[],
  covarianceMatrix: number[][],
  currentWeights: number[],
  costPerTrade: number = 0.001,
  targetReturn: number
): OptimizationResult {
  const objective = (w: number[]) => {
    const variance = quadForm(w, covarianceMatrix);
    const turnoverCost = sum(w.map((wi, i) => Math.abs(wi - currentWeights[i]))) * costPerTrade;
    return variance + turnoverCost;
  };
  // ... solve with turnover penalty
}
```

The cost penalty discourages large weight changes unless justified by a significant improvement in the risk-return tradeoff.
