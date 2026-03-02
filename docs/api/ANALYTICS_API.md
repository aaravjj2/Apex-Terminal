# Analytics API

Portfolio risk analytics, correlation analysis, factor exposure decomposition, and stress testing. Designed for institutional-grade risk management workflows.

## Table of Contents

- [Endpoints](#endpoints)
- [Risk Metrics](#get-risk-metrics)
- [Correlation Matrix](#get-correlation-matrix)
- [Factor Exposure](#get-factor-exposure)
- [Stress Test](#get-stress-test)
- [Data Structures](#data-structures)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/risk/:portfolio` | VaR, CVaR, and risk metrics |
| GET | `/api/analytics/correlation` | Cross-asset correlation matrix |
| GET | `/api/analytics/factor-exposure` | Fama-French factor decomposition |
| GET | `/api/analytics/stress-test` | Historical and hypothetical stress scenarios |

## GET Risk Metrics

Computes Value at Risk, Conditional VaR, and supplementary risk statistics.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `portfolio` | string | Yes | Portfolio ID (path param) |
| `method` | string | No | `historical`, `parametric`, `montecarlo` (default: `historical`) |
| `confidence` | number | No | Confidence level: `0.90`, `0.95`, `0.99` (default: `0.95`) |
| `horizon` | number | No | Holding period in days (default: 1) |
| `lookback` | number | No | Historical window in days (default: 252) |
| `simulations` | number | No | Monte Carlo runs (default: 10000, max: 100000) |

```typescript
const risk = await analyticsApi.getRisk('pf_main', {
  method: 'montecarlo',
  confidence: 0.99,
  horizon: 10,
  simulations: 50000,
});

interface RiskResponse {
  portfolioId: string;
  method: string;
  confidence: number;
  horizon: number;
  var: number;                  // Value at Risk (absolute $)
  varPercent: number;           // VaR as % of portfolio value
  cvar: number;                 // Conditional VaR / Expected Shortfall
  cvarPercent: number;
  volatility: number;           // Annualized portfolio vol
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  componentVar: {               // Per-holding VaR contribution
    symbol: string;
    weight: number;
    marginalVar: number;
    componentVar: number;
    percentContribution: number;
  }[];
}
```

## GET Correlation Matrix

Computes pairwise correlations between assets or portfolio constituents.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbols` | string | Yes | Comma-separated tickers (min 2, max 50) |
| `period` | string | No | `1M`, `3M`, `6M`, `1Y`, `3Y` (default: `1Y`) |
| `method` | string | No | `pearson`, `spearman`, `kendall` (default: `pearson`) |
| `frequency` | string | No | `daily`, `weekly`, `monthly` (default: `daily`) |

```typescript
const corr = await analyticsApi.getCorrelation({
  symbols: 'AAPL,GOOGL,MSFT,AMZN,TSLA,JPM,GLD,TLT',
  period: '1Y',
  method: 'pearson',
});

interface CorrelationResponse {
  symbols: string[];
  matrix: number[][];           // N x N correlation matrix
  eigenvalues: number[];        // PCA eigenvalues
  principalComponents: number; // Effective dimensions (eigenvalue > 1)
  period: { start: string; end: string };
  observations: number;
}
```

## GET Factor Exposure

Decomposes portfolio returns into Fama-French factor exposures.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `portfolio` | string | No | Portfolio ID (uses default if omitted) |
| `symbols` | string | No | Comma-separated tickers (alternative to portfolio) |
| `model` | string | No | `ff3` (3-factor), `ff5` (5-factor), `carhart` (default: `ff5`) |
| `period` | string | No | Lookback (default: `3Y`) |

```typescript
interface FactorExposureResponse {
  model: string;
  factors: {
    name: string;               // 'Market', 'SMB', 'HML', 'RMW', 'CMA', 'Momentum'
    beta: number;               // Factor loading
    tStat: number;
    pValue: number;
    contribution: number;       // Return contribution (annualized)
  }[];
  alpha: number;                // Annualized alpha (intercept)
  alphaTStat: number;
  rSquared: number;
  adjustedRSquared: number;
  residualVol: number;          // Idiosyncratic volatility
}
```

## GET Stress Test

Applies historical or hypothetical stress scenarios to the portfolio.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `portfolio` | string | Yes | Portfolio ID |
| `scenarios` | string | No | Comma-separated scenario IDs, or `all` (default: `all`) |

```typescript
interface StressTestResponse {
  portfolioValue: number;
  scenarios: {
    id: string;
    name: string;
    description: string;
    category: 'historical' | 'hypothetical';
    portfolioImpact: number;          // $ impact
    portfolioImpactPercent: number;
    holdingImpacts: {
      symbol: string;
      impact: number;
      impactPercent: number;
    }[];
  }[];
}
```

### Built-In Scenarios

| ID | Name | Description |
|----|------|-------------|
| `gfc_2008` | Global Financial Crisis | Sep-Nov 2008 drawdown |
| `covid_2020` | COVID-19 Crash | Feb-Mar 2020 selloff |
| `dot_com` | Dot-Com Bust | Mar 2000 - Oct 2002 |
| `taper_tantrum` | Taper Tantrum 2013 | May-Sep 2013 bond selloff |
| `rates_up_200` | Rates +200bps | Hypothetical parallel rate shift |
| `equity_down_20` | Equity -20% | Hypothetical broad market drop |
| `vol_spike_2x` | Volatility 2x | Hypothetical VIX doubling |
| `usd_down_10` | USD -10% | Hypothetical dollar depreciation |
| `oil_spike_50` | Oil +50% | Hypothetical crude oil shock |

## Data Structures

### Risk Methods Comparison

| Method | Speed | Assumptions | Best For |
|--------|-------|-------------|----------|
| `historical` | Fast | None (empirical) | General use, fat tails |
| `parametric` | Fastest | Normal distribution | Quick estimates |
| `montecarlo` | Slow | Configurable | Complex portfolios, options |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 404 | `9001` | Portfolio not found |
| 400 | `9002` | Fewer than 2 symbols for correlation |
| 400 | `9003` | Insufficient data for requested period |
| 400 | `9004` | Invalid scenario ID |
| 408 | `9005` | Monte Carlo simulation timeout |
| 422 | `9006` | Factor model regression failed (multicollinearity) |

## Rate Limits

| Tier | Risk/min | Correlation/min | Stress/min |
|------|---------|-----------------|------------|
| Free | 5 | 5 | 2 |
| Pro | 30 | 30 | 15 |
| Enterprise | 150 | 150 | 60 |
