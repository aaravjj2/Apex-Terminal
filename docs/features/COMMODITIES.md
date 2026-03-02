# Commodity Analytics

Advanced commodity market analytics covering energy, metals, and agriculture sectors with futures pricing models, seasonal pattern detection, and supply/demand analysis.

## Table of Contents

- [Overview](#overview)
- [Futures Pricing Engine](#futures-pricing-engine)
- [Contango and Backwardation](#contango-and-backwardation)
- [Roll Yield Analysis](#roll-yield-analysis)
- [Seasonal Patterns](#seasonal-patterns)
- [Supply and Demand Analysis](#supply-and-demand-analysis)
- [Sector Coverage](#sector-coverage)
- [Commodity Indices](#commodity-indices)
- [API Reference](#api-reference)

## Overview

The commodity analytics module (`lib/assetClasses/commodities/`) provides institutional-grade tools for analyzing physical and financial commodity markets. It integrates with the broader Apex Terminal ecosystem through Zustand stores and the real-time market data feed.

```typescript
import { CommodityAnalyzer } from '@/lib/assetClasses/commodities/analytics';
import { FuturesCurve } from '@/lib/assetClasses/commodities/futures';

const analyzer = new CommodityAnalyzer({ sector: 'energy' });
const curve = analyzer.buildForwardCurve('CL', { depth: 12 });
```

## Futures Pricing Engine

The futures pricing engine models fair value for commodity contracts using cost-of-carry, convenience yield, and storage cost inputs.

```typescript
interface FuturesPricingParams {
  spotPrice: number;
  riskFreeRate: number;
  storageCost: number;
  convenienceYield: number;
  timeToExpiry: number;
}

function calculateFairValue(params: FuturesPricingParams): number {
  const { spotPrice, riskFreeRate, storageCost, convenienceYield, timeToExpiry } = params;
  return spotPrice * Math.exp((riskFreeRate + storageCost - convenienceYield) * timeToExpiry);
}
```

The engine supports multi-contract term structure construction across 24 months of expiries, enabling curve-relative trading strategies.

## Contango and Backwardation

Automatic detection of market structure states with quantified metrics:

```typescript
interface CurveStructure {
  state: 'contango' | 'backwardation' | 'mixed';
  spread: number;           // front-month vs second-month
  annualizedBasis: number;  // annualized percentage
  rollCost: number;         // estimated roll cost per period
  historicalPercentile: number;
}

const structure = analyzer.analyzeCurveStructure('CL');
// { state: 'backwardation', spread: -1.25, annualizedBasis: -8.4, ... }
```

The system maintains a 10-year historical database of curve structures for percentile ranking and regime detection.

## Roll Yield Analysis

Roll yield tracking helps quantify the cost or benefit of maintaining futures positions across contract expirations.

```typescript
const rollAnalysis = analyzer.calculateRollYield('NG', {
  strategy: 'front-month',    // 'front-month' | 'optimized' | 'calendar-spread'
  lookbackMonths: 36,
  includeSlippage: true,
});
// Returns annualized roll yield, cumulative P&L attribution, optimal roll timing
```

The optimizer suggests ideal roll dates based on historical liquidity patterns and open interest migration.

## Seasonal Patterns

Statistical seasonal decomposition identifies recurring price patterns driven by weather, planting cycles, and demand shifts.

```typescript
const seasonal = analyzer.seasonalDecomposition('ZW', {
  yearsOfData: 15,
  granularity: 'weekly',
  confidenceInterval: 0.95,
});

// seasonal.patterns: array of { weekOfYear, avgReturn, stdDev, winRate }
// seasonal.strongestPeriods: top 5 historically significant windows
```

Heatmap visualization displays monthly return distributions with statistical significance markers.

## Supply and Demand Analysis

Fundamental balance sheet modeling for physical commodity markets:

```typescript
interface SupplyDemandBalance {
  production: number;
  consumption: number;
  imports: number;
  exports: number;
  stockpiles: number;
  daysOfSupply: number;
  balanceSurplusDeficit: number;
}

const balance = analyzer.getSupplyDemandBalance('copper', { region: 'global' });
```

Data sourced from EIA, USDA, LME, and CFTC reports with automated parsing and historicalization.

## Sector Coverage

### Energy
Crude oil (WTI, Brent), natural gas, heating oil, gasoline, ethanol. Includes crack spread analytics and refining margin models.

### Metals
Gold, silver, platinum, palladium, copper, aluminum, zinc, nickel. Supports precious vs industrial metal ratio analysis and mining cost curves.

### Agriculture
Corn, wheat, soybeans, cotton, coffee, sugar, cocoa, cattle, hogs. Integrates USDA WASDE reports and crop condition data.

```typescript
const sectors = analyzer.listSectors();
// ['energy', 'precious-metals', 'industrial-metals', 'grains', 'softs', 'livestock']

const instruments = analyzer.getInstruments('energy');
// [{ symbol: 'CL', name: 'WTI Crude', exchange: 'NYMEX', ... }, ...]
```

## Commodity Indices

Composite index construction with customizable weighting methodologies:

```typescript
const index = analyzer.buildIndex({
  name: 'Custom Energy Basket',
  components: [
    { symbol: 'CL', weight: 0.5 },
    { symbol: 'NG', weight: 0.3 },
    { symbol: 'HO', weight: 0.2 },
  ],
  rebalanceFrequency: 'monthly',
  weightingMethod: 'production',  // 'equal' | 'production' | 'liquidity' | 'custom'
});
```

Pre-built indices include GSCI-style production-weighted and BCOM-style diversified commodity benchmarks.

## API Reference

| Function | Description |
|---|---|
| `buildForwardCurve(symbol, opts)` | Constructs futures term structure |
| `analyzeCurveStructure(symbol)` | Detects contango/backwardation state |
| `calculateRollYield(symbol, opts)` | Computes roll yield analytics |
| `seasonalDecomposition(symbol, opts)` | Extracts seasonal price patterns |
| `getSupplyDemandBalance(commodity, opts)` | Fetches fundamental balance sheet |
| `buildIndex(config)` | Creates custom commodity index |
| `getInstruments(sector)` | Lists available instruments per sector |
