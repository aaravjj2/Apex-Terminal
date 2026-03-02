# Risk Management

Apex Terminal's risk management framework in `lib/risk/` provides enterprise-grade risk measurement and monitoring — Value at Risk, Conditional VaR, stress testing, risk limits, margin analysis, counterparty exposure, and drawdown surveillance.

## Table of Contents

- [Architecture](#architecture)
- [Value at Risk](#value-at-risk)
- [Conditional VaR (CVaR)](#conditional-var-cvar)
- [Stress Testing](#stress-testing)
- [Risk Limits](#risk-limits)
- [Margin Requirements](#margin-requirements)
- [Counterparty Risk](#counterparty-risk)
- [Drawdown Monitoring](#drawdown-monitoring)
- [Risk Dashboard](#risk-dashboard)

## Architecture

The risk library is organized into six specialized modules:

| Module | Coverage |
|---|---|
| `market.ts` | VaR, CVaR, volatility, correlation, beta |
| `credit.ts` | Counterparty exposure, credit VaR, PD/LGD |
| `limits.ts` | Position limits, concentration, exposure thresholds |
| `operational.ts` | Error budgets, system risk monitoring |
| `regulatory.ts` | Capital adequacy, regulatory reporting metrics |
| `stressTesting.ts` | Scenario analysis, historical stress, custom shocks |

All risk computations operate on portfolio snapshots and return typed result objects suitable for dashboard rendering.

## Value at Risk

VaR estimates the maximum expected portfolio loss over a time horizon at a confidence level. Three methodologies are implemented:

### Historical VaR

```typescript
// lib/risk/market.ts
export function historicalVaR(
  returns: number[],
  confidence: number = 0.95,
  horizon: number = 1
): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);
  const dailyVaR = Math.abs(sorted[index]);
  return dailyVaR * Math.sqrt(horizon);
}
```

### Parametric (Variance-Covariance) VaR

Assumes normal distribution and uses the portfolio's volatility directly:

```typescript
export function parametricVaR(
  portfolioValue: number,
  portfolioVolatility: number,
  confidence: number = 0.95,
  horizon: number = 1
): number {
  const zScore = normalInverseCDF(confidence); // 1.645 for 95%
  return portfolioValue * portfolioVolatility * zScore * Math.sqrt(horizon);
}
```

### Monte Carlo VaR

Simulates thousands of portfolio return paths using correlated random draws:

```typescript
export function monteCarloVaR(
  holdings: Holding[],
  covarianceMatrix: number[][],
  simulations: number = 10000,
  confidence: number = 0.95,
  horizon: number = 1
): number {
  const weights = holdings.map(h => h.weight);
  const returns: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const randomReturns = correlatedNormalDraws(covarianceMatrix, horizon);
    const portReturn = dotProduct(weights, randomReturns);
    returns.push(portReturn);
  }

  returns.sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * returns.length);
  return Math.abs(returns[index]) * portfolioValue(holdings);
}
```

## Conditional VaR (CVaR)

CVaR (Expected Shortfall) measures the average loss in the worst tail scenarios beyond VaR:

```typescript
export function cvar(returns: number[], confidence: number = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const tailLosses = sorted.slice(0, cutoff);
  return Math.abs(mean(tailLosses));
}
```

CVaR is a coherent risk measure (sub-additive, unlike VaR) and is preferred by many risk managers for portfolio-level risk budgeting.

## Stress Testing

The `stressTesting.ts` module evaluates portfolio impact under extreme scenarios:

### Historical Scenarios

Pre-built scenarios replay market conditions from actual crises:

| Scenario | Period | Equity Shock | Vol Spike | Rate Δ |
|---|---|---|---|---|
| **2008 GFC** | Sep–Nov 2008 | −38% | +150% | −200bp |
| **COVID Crash** | Feb–Mar 2020 | −34% | +300% | −150bp |
| **Dot-Com Burst** | Mar 2000–Oct 2002 | −49% | +80% | −275bp |
| **Taper Tantrum** | May–Sep 2013 | −6% | +30% | +130bp |
| **Vol-mageddon** | Feb 2018 | −10% | +200% | +20bp |

```typescript
export function runStressTest(
  portfolio: Portfolio,
  scenario: StressScenario
): StressTestResult {
  const shockedValues = portfolio.holdings.map(h => {
    const shock = scenario.getShock(h.symbol, h.assetClass);
    return { ...h, stressedValue: h.marketValue * (1 + shock) };
  });
  const stressedTotal = shockedValues.reduce((s, h) => s + h.stressedValue, 0);
  return { portfolioLoss: portfolio.totalValue - stressedTotal, impactPct: (stressedTotal / portfolio.totalValue) - 1, details: shockedValues };
}
```

### Custom Scenarios

Users define custom shocks to individual factors — equity indices, volatility, interest rates, credit spreads, FX rates — and observe the propagated portfolio impact.

## Risk Limits

The `limits.ts` module enforces configurable risk boundaries:

```typescript
export interface RiskLimits {
  maxPositionSize: number;       // max $ in single name
  maxSectorConcentration: number; // max % in one sector
  maxAssetClassWeight: number;    // max % in one asset class
  maxLeverage: number;            // gross exposure / NAV ceiling
  maxVaR95: number;               // max daily VaR at 95%
  maxDrawdown: number;            // max tolerable drawdown %
}

export function checkLimits(portfolio: Portfolio, limits: RiskLimits): LimitBreaches {
  const breaches: LimitBreach[] = [];
  if (portfolio.maxPositionValue > limits.maxPositionSize)
    breaches.push({ type: 'position_size', current: portfolio.maxPositionValue, limit: limits.maxPositionSize });
  // ... additional limit checks
  return { breaches, inCompliance: breaches.length === 0 };
}
```

Breaches trigger visual alerts in the risk dashboard and can optionally block new order submission.

## Margin Requirements

Margin computation supports Reg-T (initial and maintenance) and portfolio margin methodologies:

| Margin Type | Initial | Maintenance |
|---|---|---|
| Long equity | 50% | 25% |
| Short equity | 50% | 30% |
| Options (naked) | Risk-based | Risk-based |
| Concentrated position | Up to 70% | Up to 50% |

The margin monitor displays buying power, excess margin, and a margin utilization gauge updated in real time.

## Counterparty Risk

The `credit.ts` module tracks counterparty exposure for OTC positions:

```typescript
export interface CounterpartyExposure {
  counterparty: string;
  currentExposure: number;       // current mark-to-market
  potentialFutureExposure: number; // 95th percentile PFE
  creditRating: string;
  probabilityOfDefault: number;
  expectedLoss: number;          // EAD × PD × LGD
}
```

Counterparty exposure aggregates across all OTC derivatives and displays a treemap visualization of exposure concentration.

## Drawdown Monitoring

Real-time drawdown surveillance tracks peak-to-trough portfolio declines:

```typescript
export function currentDrawdown(equityCurve: number[]): DrawdownInfo {
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let currentDd = 0;

  for (const value of equityCurve) {
    peak = Math.max(peak, value);
    currentDd = (value - peak) / peak;
    maxDrawdown = Math.min(maxDrawdown, currentDd);
  }

  return { current: currentDd, max: maxDrawdown, peak, trough: peak * (1 + maxDrawdown) };
}
```

The drawdown chart renders as a filled area below zero, with the maximum drawdown period highlighted. Configurable alert thresholds notify users when drawdown exceeds predefined levels.

## Risk Dashboard

The risk dashboard consolidates all metrics into a single view:

- **VaR gauge** — 1-day 95% and 99% VaR with historical trend.
- **Stress test matrix** — portfolio P&L under each scenario.
- **Limit status** — green/amber/red compliance indicators.
- **Correlation heatmap** — pairwise correlations across portfolio holdings.
- **Drawdown chart** — running and historical drawdown visualization.
- **Margin monitor** — buying power and utilization meter.
