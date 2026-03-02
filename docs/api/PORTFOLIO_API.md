# Portfolio API

Portfolio analytics including holdings, performance attribution, risk decomposition, and Markowitz mean-variance optimization.

## Table of Contents

- [Endpoints](#endpoints)
- [Holdings](#get-portfolio-holdings)
- [Performance](#get-performance-metrics)
- [Risk Analysis](#get-risk-analysis)
- [Attribution](#get-performance-attribution)
- [Optimization](#post-portfolio-optimization)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio/holdings` | Current portfolio holdings |
| GET | `/api/portfolio/performance` | Historical performance metrics |
| GET | `/api/portfolio/risk` | Risk decomposition and metrics |
| GET | `/api/portfolio/attribution` | Brinson performance attribution |
| POST | `/api/portfolio/optimize` | Markowitz portfolio optimization |

## GET Portfolio Holdings

Returns current holdings with weights, P&L, and sector classification.

```typescript
interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;           // Portfolio weight (0-1)
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  dailyChange: number;
  sector: string;
  assetClass: 'equity' | 'fixed_income' | 'commodity' | 'crypto' | 'forex';
}
interface HoldingsResponse {
  holdings: Holding[];
  totalValue: number;
  cashBalance: number;
  dayChange: number;
  dayChangePercent: number;
}
```

## GET Performance Metrics

**Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | No | `1D`, `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL` (default: `1M`) |
| `benchmark` | string | No | Benchmark symbol (default: `SPY`) |

```typescript
interface PerformanceResponse {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number; // days
  volatility: number;
  alpha: number;
  beta: number;
  informationRatio: number;
  calmarRatio: number;
  equityCurve: { date: string; value: number }[];
  drawdownCurve: { date: string; drawdown: number }[];
  benchmarkCurve: { date: string; value: number }[];
}
```

## GET Risk Analysis

Returns comprehensive risk metrics and factor exposures for the portfolio.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `confidence` | number | No | VaR confidence level: `0.95` or `0.99` (default: `0.95`) |
| `horizon` | number | No | Risk horizon in days (default: 1) |

```typescript
interface RiskResponse {
  var: number;              // Value at Risk
  cvar: number;             // Conditional VaR (Expected Shortfall)
  volatility: number;       // Annualized portfolio volatility
  beta: number;             // Portfolio beta to benchmark
  trackingError: number;
  diversificationRatio: number;
  concentrationIndex: number; // Herfindahl index of weights
  correlationMatrix: number[][];
  factorExposures: {
    market: number;
    size: number;
    value: number;
    momentum: number;
    quality: number;
    volatility: number;
  };
  sectorExposures: Record<string, number>;
}
```

## GET Performance Attribution

Brinson-Fachler attribution decomposing returns into allocation, selection, and interaction effects.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | No | Attribution period (default: `1M`) |
| `benchmark` | string | No | Benchmark symbol (default: `SPY`) |
| `groupBy` | string | No | `sector`, `assetClass`, `geography` (default: `sector`) |

```typescript
interface AttributionSegment {
  name: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  totalEffect: number;
}
interface AttributionResponse {
  segments: AttributionSegment[];
  totalAllocation: number;
  totalSelection: number;
  totalInteraction: number;
  activeReturn: number;
}
```

## POST Portfolio Optimization

Runs Markowitz mean-variance optimization to find optimal weights.

```typescript
interface OptimizationRequest {
  symbols: string[];
  objective: 'max_sharpe' | 'min_variance' | 'max_return' | 'risk_parity';
  constraints?: {
    maxWeight?: number;       // Per-asset cap (default: 0.30)
    minWeight?: number;       // Per-asset floor (default: 0.0)
    targetReturn?: number;    // For min-variance with return target
    maxSectorWeight?: number;
    longOnly?: boolean;       // Default: true
  };
  lookbackDays?: number;      // Historical window (default: 252)
  riskFreeRate?: number;      // Annualized (default: 0.05)
}

const result = await portfolioApi.optimize({
  symbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'BRK.B', 'JNJ', 'JPM'],
  objective: 'max_sharpe',
  constraints: { maxWeight: 0.25, longOnly: true },
});

interface OptimizationResponse {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  efficientFrontier: { volatility: number; return: number }[];
}
```

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `4001` | Invalid period parameter |
| 404 | `4002` | Portfolio not found |
| 400 | `4003` | Optimization infeasible (conflicting constraints) |
| 422 | `4004` | Insufficient historical data for requested symbols |
| 500 | `4005` | Optimization solver failed |

## Rate Limits

| Tier | Read/min | Optimization/min |
|------|---------|-------------------|
| Free | 30 | 2 |
| Pro | 120 | 10 |
| Enterprise | 600 | 60 |
