# Fixed Income Analytics

Apex Terminal's fixed income module in `lib/portfolio/fixedIncome.ts` provides comprehensive bond analytics — yield calculations, duration and convexity measures, spread analysis, yield curve construction, and bond pricing — supporting institutional-grade fixed income portfolio management.

## Table of Contents

- [Overview](#overview)
- [Bond Pricing](#bond-pricing)
- [Yield Calculations](#yield-calculations)
- [Duration](#duration)
- [Convexity](#convexity)
- [Spread Analysis](#spread-analysis)
- [Yield Curve Construction](#yield-curve-construction)
- [Bond Portfolio Analytics](#bond-portfolio-analytics)

## Overview

The fixed income module models coupon-bearing and zero-coupon bonds with support for different day-count conventions, coupon frequencies, and embedded options:

```typescript
// lib/portfolio/fixedIncome.ts
export interface Bond {
  faceValue: number;
  couponRate: number;         // annual coupon as decimal
  frequency: 1 | 2 | 4 | 12; // annual, semi-annual, quarterly, monthly
  maturityDate: Date;
  issueDate: Date;
  dayCount: '30/360' | 'ACT/360' | 'ACT/365' | 'ACT/ACT';
  callable?: CallSchedule;
  putable?: PutSchedule;
  creditRating?: string;
}
```

## Bond Pricing

Bond price is the present value of all future cash flows discounted at the required yield:

```typescript
export function priceBond(bond: Bond, yieldToMaturity: number): number {
  const periods = periodsRemaining(bond);
  const coupon = (bond.couponRate / bond.frequency) * bond.faceValue;
  const yieldPerPeriod = yieldToMaturity / bond.frequency;

  let price = 0;
  for (let t = 1; t <= periods; t++) {
    price += coupon / (1 + yieldPerPeriod) ** t;
  }
  price += bond.faceValue / (1 + yieldPerPeriod) ** periods;

  return price;
}
```

The function handles accrued interest and supports clean (flat) and dirty (full) pricing:

```typescript
export function dirtyPrice(bond: Bond, ytm: number): number {
  return priceBond(bond, ytm);
}

export function cleanPrice(bond: Bond, ytm: number): number {
  return dirtyPrice(bond, ytm) - accruedInterest(bond);
}

export function accruedInterest(bond: Bond): number {
  const daysSinceLastCoupon = dayCount(bond.dayCount, lastCouponDate(bond), new Date());
  const daysBetweenCoupons = dayCount(bond.dayCount, lastCouponDate(bond), nextCouponDate(bond));
  return (bond.couponRate / bond.frequency) * bond.faceValue * (daysSinceLastCoupon / daysBetweenCoupons);
}
```

## Yield Calculations

Four yield measures serve different analytical purposes:

### Yield to Maturity (YTM)

The internal rate of return assuming the bond is held to maturity:

```typescript
export function yieldToMaturity(bond: Bond, marketPrice: number): number {
  let ytm = bond.couponRate; // initial guess
  for (let i = 0; i < 100; i++) {
    const price = priceBond(bond, ytm);
    const duration = macaulayDuration(bond, ytm);
    const adjustment = (price - marketPrice) / (price * duration / (1 + ytm / bond.frequency));
    ytm += adjustment;
    if (Math.abs(price - marketPrice) < 0.0001) break;
  }
  return ytm;
}
```

### Yield to Call (YTC)

YTM computed to the earliest call date and price for callable bonds.

### Current Yield

Simple annual coupon income divided by market price:

```typescript
export function currentYield(bond: Bond, marketPrice: number): number {
  return (bond.couponRate * bond.faceValue) / marketPrice;
}
```

### Yield to Worst (YTW)

The minimum yield across all possible call and put dates — the most conservative yield estimate for callable/putable bonds.

## Duration

Duration measures price sensitivity to interest rate changes:

### Macaulay Duration

Weighted average time to receive cash flows:

```typescript
export function macaulayDuration(bond: Bond, ytm: number): number {
  const periods = periodsRemaining(bond);
  const coupon = (bond.couponRate / bond.frequency) * bond.faceValue;
  const y = ytm / bond.frequency;
  const price = priceBond(bond, ytm);

  let weightedTime = 0;
  for (let t = 1; t <= periods; t++) {
    const pv = coupon / (1 + y) ** t;
    weightedTime += (t / bond.frequency) * pv;
  }
  weightedTime += (periods / bond.frequency) * bond.faceValue / (1 + y) ** periods;

  return weightedTime / price;
}
```

### Modified Duration

Adjusts Macaulay duration for the compounding period:

```typescript
export function modifiedDuration(bond: Bond, ytm: number): number {
  return macaulayDuration(bond, ytm) / (1 + ytm / bond.frequency);
}
```

A modified duration of 5.2 means a 1% yield increase causes approximately a 5.2% price decline.

### Effective Duration

For bonds with embedded options, effective duration uses numerical price shifts:

```typescript
export function effectiveDuration(bond: Bond, ytm: number, shiftBps: number = 10): number {
  const dy = shiftBps / 10000;
  const priceUp = priceBondWithOptions(bond, ytm - dy);
  const priceDown = priceBondWithOptions(bond, ytm + dy);
  const priceBase = priceBondWithOptions(bond, ytm);
  return (priceUp - priceDown) / (2 * priceBase * dy);
}
```

## Convexity

Convexity captures the curvature of the price-yield relationship — the second-order effect that duration misses:

```typescript
export function convexity(bond: Bond, ytm: number): number {
  const periods = periodsRemaining(bond);
  const coupon = (bond.couponRate / bond.frequency) * bond.faceValue;
  const y = ytm / bond.frequency;
  const price = priceBond(bond, ytm);

  let conv = 0;
  for (let t = 1; t <= periods; t++) {
    conv += t * (t + 1) * coupon / (1 + y) ** (t + 2);
  }
  conv += periods * (periods + 1) * bond.faceValue / (1 + y) ** (periods + 2);

  return conv / (price * bond.frequency ** 2);
}
```

Price change estimate using both duration and convexity: `ΔP/P ≈ -D × Δy + 0.5 × C × (Δy)²`.

## Spread Analysis

Spread measures quantify the credit and liquidity premium over risk-free rates:

| Spread | Description | Calculation |
|---|---|---|
| **Nominal Spread** | YTM minus matched-maturity Treasury yield | Simple subtraction |
| **Z-Spread** | Constant spread over the Treasury spot curve | Iterative solve |
| **OAS** | Spread over spot curve after removing option value | Lattice-based |
| **I-Spread** | Spread over swap rate curve | Interpolated swap rate |

```typescript
export function zSpread(bond: Bond, marketPrice: number, spotCurve: SpotCurve): number {
  let spread = 0.01;
  for (let iter = 0; iter < 100; iter++) {
    const modelPrice = discountCashFlows(bond, spotCurve, spread);
    const error = modelPrice - marketPrice;
    if (Math.abs(error) < 0.0001) break;
    spread += error / durationAdjustedSensitivity(bond, spotCurve, spread);
  }
  return spread;
}
```

## Yield Curve Construction

The module constructs yield curves from market instruments using bootstrap methodology:

```typescript
export function bootstrapSpotCurve(instruments: CurveInstrument[]): SpotCurve {
  const spots: SpotRate[] = [];

  for (const inst of instruments.sort((a, b) => a.maturity - b.maturity)) {
    if (inst.type === 'zero') {
      spots.push({ maturity: inst.maturity, rate: inst.yield });
    } else {
      const spotRate = bootstrapFromCouponBond(inst, spots);
      spots.push({ maturity: inst.maturity, rate: spotRate });
    }
  }
  return { spots, interpolation: 'cubic_spline' };
}
```

Supported curve types: par curve, spot (zero) curve, forward curve, and discount function. Interpolation methods include linear, cubic spline, and Nelson-Siegel-Svensson parametric fitting.

## Bond Portfolio Analytics

Portfolio-level fixed income metrics aggregate across all bond holdings:

| Metric | Description |
|---|---|
| **Portfolio Duration** | Market-value-weighted average modified duration |
| **Portfolio Convexity** | Weighted average convexity |
| **Yield to Maturity** | Weighted average YTM across holdings |
| **Average Credit Quality** | Numerical average of credit ratings |
| **Sector Allocation** | Government, corporate, MBS, ABS breakdown |
| **Maturity Profile** | Distribution of holdings by maturity bucket |
| **Key Rate Durations** | Sensitivity to yield curve shifts at specific tenors |

Key rate duration analysis reveals where along the curve the portfolio is most exposed, enabling targeted hedging at specific tenors (2Y, 5Y, 10Y, 30Y).
