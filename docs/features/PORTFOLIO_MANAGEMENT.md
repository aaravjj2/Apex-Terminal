# Portfolio Management

Apex Terminal's portfolio management system in `lib/portfolio/` provides comprehensive holdings tracking, sector and asset allocation analysis, rebalancing tools, benchmark comparison, and institutional-grade performance measurement.

## Table of Contents

- [Architecture](#architecture)
- [Holdings Management](#holdings-management)
- [Sector and Asset Allocation](#sector-and-asset-allocation)
- [Rebalancing](#rebalancing)
- [Benchmark Tracking](#benchmark-tracking)
- [Portfolio Analytics](#portfolio-analytics)
- [Performance Measurement](#performance-measurement)
- [Attribution Overview](#attribution-overview)

## Architecture

The portfolio module follows a layered design:

```
stores/portfolioStore.ts  ←  hooks/usePortfolio.ts  ←  lib/portfolio/
                                                          ├── performance.ts
                                                          ├── attribution.ts
                                                          ├── optimization.ts
                                                          ├── risk.ts
                                                          └── fixedIncome.ts
```

The Zustand store holds the authoritative portfolio state. The `usePortfolio` hook provides reactive access. Pure computation functions in `lib/portfolio/` handle analytics without side effects.

```typescript
// stores/portfolioStore.ts
interface PortfolioState {
  holdings: Holding[];
  cash: number;
  currency: string;
  benchmarkSymbol: string;
  history: PortfolioSnapshot[];
  addHolding(holding: Holding): void;
  removeHolding(symbol: string): void;
  rebalance(targets: AllocationTarget[]): RebalanceOrders;
}
```

## Holdings Management

Each holding tracks quantity, cost basis, and current market value:

```typescript
interface Holding {
  symbol: string;
  name: string;
  assetClass: 'equity' | 'fixed_income' | 'options' | 'futures' | 'forex' | 'crypto';
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  weight: number;          // percentage of total portfolio
  sector?: string;
  country?: string;
}
```

The holdings table supports inline editing, sorting by any column, and grouping by asset class, sector, or country. Real-time prices update market values and P&L continuously.

## Sector and Asset Allocation

Allocation views break down the portfolio across multiple dimensions:

| Dimension | Visualization |
|---|---|
| **Asset Class** | Donut chart — equity, fixed income, alternatives, cash |
| **Sector** | Treemap — GICS sectors weighted by market value |
| **Geography** | World map — country exposure heat map |
| **Currency** | Stacked bar — currency denomination breakdown |

```typescript
export function computeAllocation(
  holdings: Holding[],
  dimension: 'assetClass' | 'sector' | 'country' | 'currency'
): AllocationSlice[] {
  const groups = groupBy(holdings, dimension);
  const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  return Object.entries(groups).map(([key, items]) => ({
    label: key,
    value: items.reduce((sum, h) => sum + h.marketValue, 0),
    weight: items.reduce((sum, h) => sum + h.marketValue, 0) / total,
  }));
}
```

## Rebalancing

The rebalancing engine compares current weights against target allocations and generates trade orders:

```typescript
export function generateRebalanceOrders(
  holdings: Holding[],
  cash: number,
  targets: AllocationTarget[],
  options: RebalanceOptions
): RebalanceOrder[] {
  const totalValue = cash + holdings.reduce((s, h) => s + h.marketValue, 0);

  return targets.map(target => {
    const current = holdings.find(h => h.symbol === target.symbol);
    const currentValue = current?.marketValue ?? 0;
    const targetValue = totalValue * target.weight;
    const delta = targetValue - currentValue;

    if (Math.abs(delta) < options.minTradeValue) return null;

    const price = current?.currentPrice ?? target.referencePrice;
    const quantity = Math.round(delta / price);
    return { symbol: target.symbol, side: quantity > 0 ? 'buy' : 'sell', quantity: Math.abs(quantity) };
  }).filter(Boolean) as RebalanceOrder[];
}
```

Options include: minimum trade threshold (avoid tiny trades), round-lot enforcement, tax-aware rebalancing (prefer lots with losses), and cash reserve maintenance.

## Benchmark Tracking

Portfolios track against a configurable benchmark (e.g., SPY, AGG, 60/40 blend):

```typescript
export function trackingMetrics(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): TrackingMetrics {
  const activeReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  return {
    activeReturn: annualize(mean(activeReturns)),
    trackingError: annualize(stdDev(activeReturns)),
    informationRatio: annualize(mean(activeReturns)) / annualize(stdDev(activeReturns)),
    beta: covariance(portfolioReturns, benchmarkReturns) / variance(benchmarkReturns),
    alpha: jensensAlpha(portfolioReturns, benchmarkReturns),
    r2: correlationSquared(portfolioReturns, benchmarkReturns),
  };
}
```

The benchmark overlay appears on the equity curve chart as a dashed line for visual comparison.

## Portfolio Analytics

Real-time analytics computed from holdings and historical data:

| Metric | Description |
|---|---|
| **Total Value** | Cash + sum of market values |
| **Day P&L** | Today's change in portfolio value |
| **Total P&L** | Cumulative unrealized + realized gains |
| **Dividend Yield** | Weighted average of holding dividend yields |
| **Beta** | Portfolio beta to benchmark |
| **Sharpe Ratio** | Risk-adjusted return (rolling and since inception) |
| **Max Drawdown** | Largest peak-to-trough decline |

## Performance Measurement

The `performance.ts` module implements industry-standard return calculations:

**Time-Weighted Return (TWR)** — eliminates the effect of external cash flows, measuring pure investment performance:

```typescript
export function timeWeightedReturn(snapshots: PortfolioSnapshot[]): number {
  let cumulativeReturn = 1;
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const periodReturn = (curr.value - curr.cashFlow) / prev.value - 1;
    cumulativeReturn *= (1 + periodReturn);
  }
  return cumulativeReturn - 1;
}
```

**Money-Weighted Return (MWR / IRR)** — accounts for the timing and magnitude of cash flows, reflecting the investor's actual experience:

```typescript
export function moneyWeightedReturn(cashFlows: CashFlow[], finalValue: number): number {
  const irr = solveIRR([
    ...cashFlows,
    { date: cashFlows[cashFlows.length - 1].date, amount: finalValue },
  ]);
  return irr;
}
```

Both methods annualize returns and are available as rolling (1M, 3M, 6M, 1Y, 3Y, 5Y) and since-inception metrics.

## Attribution Overview

Performance attribution decomposes portfolio returns into explainable components. The full attribution framework — Brinson-Fachler, factor-based, and currency attribution — is detailed in the [Performance Attribution](./PERFORMANCE_ATTRIBUTION.md) documentation.
