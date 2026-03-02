# Performance Attribution

Apex Terminal's attribution engine in `lib/portfolio/attribution.ts` decomposes portfolio returns into explainable components using the Brinson-Fachler model, multi-factor regression, sector decomposition, and currency attribution — essential for understanding what drove performance and refining investment decisions.

## Table of Contents

- [Overview](#overview)
- [Brinson-Fachler Model](#brinson-fachler-model)
- [Allocation Effect](#allocation-effect)
- [Selection Effect](#selection-effect)
- [Interaction Effect](#interaction-effect)
- [Factor-Based Attribution](#factor-based-attribution)
- [Sector Attribution](#sector-attribution)
- [Currency Attribution](#currency-attribution)
- [Multi-Period Attribution](#multi-period-attribution)
- [Attribution Reporting](#attribution-reporting)

## Overview

Performance attribution answers the question: *why* did the portfolio return what it did? The attribution framework decomposes active return (portfolio return minus benchmark return) into actionable components:

```
Active Return = Allocation Effect + Selection Effect + Interaction Effect
```

```typescript
// lib/portfolio/attribution.ts
export interface AttributionResult {
  totalReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  allocation: number;
  selection: number;
  interaction: number;
  sectorDetails: SectorAttribution[];
  factorDetails?: FactorAttribution[];
  currencyDetails?: CurrencyAttribution[];
}
```

## Brinson-Fachler Model

The Brinson-Fachler model is the industry-standard single-period attribution framework. It requires portfolio and benchmark weights and returns at the sector level:

```typescript
export interface SectorData {
  sector: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export function brinsonFachler(sectors: SectorData[]): AttributionResult {
  const benchmarkReturn = sectors.reduce(
    (sum, s) => sum + s.benchmarkWeight * s.benchmarkReturn, 0
  );

  const sectorDetails = sectors.map(s => ({
    sector: s.sector,
    allocation: (s.portfolioWeight - s.benchmarkWeight) * (s.benchmarkReturn - benchmarkReturn),
    selection: s.benchmarkWeight * (s.portfolioReturn - s.benchmarkReturn),
    interaction: (s.portfolioWeight - s.benchmarkWeight) * (s.portfolioReturn - s.benchmarkReturn),
  }));

  return {
    totalReturn: sectors.reduce((s, d) => s + d.portfolioWeight * d.portfolioReturn, 0),
    benchmarkReturn,
    activeReturn: 0, // computed as sum of effects
    allocation: sectorDetails.reduce((s, d) => s + d.allocation, 0),
    selection: sectorDetails.reduce((s, d) => s + d.selection, 0),
    interaction: sectorDetails.reduce((s, d) => s + d.interaction, 0),
    sectorDetails,
  };
}
```

## Allocation Effect

The allocation effect captures value added from overweighting or underweighting sectors relative to the benchmark:

```
Allocation_i = (w_p,i − w_b,i) × (R_b,i − R_b)
```

A positive allocation effect for a sector means the portfolio overweighted a sector that outperformed the overall benchmark (or underweighted an underperforming sector).

| Scenario | Portfolio Weight | Benchmark Weight | Sector Return | Effect |
|---|---|---|---|---|
| Overweight winning sector | 15% | 10% | +8% (vs +5% avg) | **Positive** |
| Underweight losing sector | 5% | 12% | −2% (vs +5% avg) | **Positive** |
| Overweight losing sector | 18% | 10% | +2% (vs +5% avg) | **Negative** |

## Selection Effect

The selection effect measures value added from stock picking within each sector:

```
Selection_i = w_b,i × (R_p,i − R_b,i)
```

Positive selection means the portfolio's holdings within that sector returned more than the benchmark's equivalent sector holdings — evidence of superior security selection.

## Interaction Effect

The interaction effect captures the combined impact of simultaneous allocation and selection decisions:

```
Interaction_i = (w_p,i − w_b,i) × (R_p,i − R_b,i)
```

This term is positive when the portfolio overweights sectors where its selection was also strong. Some practitioners fold the interaction into either allocation or selection; the Brinson-Fachler model separates it explicitly.

## Factor-Based Attribution

Factor attribution regresses portfolio returns against systematic risk factors to identify return sources:

```typescript
export interface FactorModel {
  factors: string[];
  loadings: Record<string, number>;     // beta to each factor
  factorReturns: Record<string, number>;
  residual: number;
}

export function factorAttribution(
  portfolioReturns: number[],
  factorReturns: Record<string, number[]>
): FactorModel {
  const factorNames = Object.keys(factorReturns);
  const X = transpose(factorNames.map(f => factorReturns[f]));
  const betas = multipleRegression(X, portfolioReturns);

  const contributions = factorNames.reduce((acc, factor, i) => {
    acc[factor] = betas[i] * mean(factorReturns[factor]);
    return acc;
  }, {} as Record<string, number>);

  return { factors: factorNames, loadings: betas, factorReturns: contributions, residual: computeResidual(portfolioReturns, X, betas) };
}
```

Standard factor sets include:

| Model | Factors |
|---|---|
| **CAPM** | Market |
| **Fama-French 3** | Market, Size (SMB), Value (HML) |
| **Fama-French 5** | + Profitability (RMW), Investment (CMA) |
| **Carhart 4** | FF3 + Momentum (WML) |

## Sector Attribution

Sector attribution drills down into GICS sector-level allocation and selection effects. The visualization renders as a waterfall chart showing each sector's contribution to active return:

```typescript
export function sectorWaterfall(attribution: AttributionResult): WaterfallEntry[] {
  return attribution.sectorDetails
    .map(s => ({
      label: s.sector,
      total: s.allocation + s.selection + s.interaction,
      allocation: s.allocation,
      selection: s.selection,
    }))
    .sort((a, b) => b.total - a.total);
}
```

## Currency Attribution

For portfolios with international exposure, currency attribution separates local return from currency return:

```typescript
export function currencyAttribution(
  holdings: InternationalHolding[]
): CurrencyAttribution[] {
  return holdings.map(h => ({
    currency: h.currency,
    localReturn: h.localReturn,
    currencyReturn: h.fxReturn,
    totalReturn: (1 + h.localReturn) * (1 + h.fxReturn) - 1,
    currencyContribution: h.weight * h.fxReturn,
  }));
}
```

This reveals whether international positions added value through asset selection or merely through favorable currency movements.

## Multi-Period Attribution

Single-period Brinson attribution doesn't compound correctly across multiple periods. The engine uses the smoothing algorithm to link single-period attributions into multi-period results:

```typescript
export function multiPeriodAttribution(
  periods: AttributionResult[]
): AttributionResult {
  return linkAttributionPeriods(periods, 'carino');
  // Supported linking methods: 'carino', 'menchero', 'frongello'
}
```

The Carino method ensures allocation, selection, and interaction effects sum exactly to the multi-period active return.

## Attribution Reporting

Attribution results render as interactive reports:

- **Waterfall chart** — sector contributions to active return.
- **Factor exposure bar chart** — portfolio factor loadings vs. benchmark.
- **Time series** — rolling attribution effects over selectable windows.
- **Heat map** — sector × period attribution matrix.
- **Summary table** — numeric breakdown exportable to CSV/PDF.
