# Volatility Analysis

Apex Terminal provides deep volatility modeling through `lib/options/volatilitySurface.ts` and supporting modules, enabling traders to analyze implied volatility surfaces, smile dynamics, term structure, and compare implied vs. realized volatility.

## Table of Contents

- [Overview](#overview)
- [IV Surface Construction](#iv-surface-construction)
- [Smile and Skew Analysis](#smile-and-skew-analysis)
- [Term Structure](#term-structure)
- [SABR Model](#sabr-model)
- [Local Volatility](#local-volatility)
- [Implied vs. Realized Volatility](#implied-vs-realized-volatility)
- [Volatility Cone](#volatility-cone)
- [Variance Swaps](#variance-swaps)

## Overview

Volatility is the central input to option pricing and the most actively traded "asset" in derivatives markets. Apex Terminal's volatility module transforms raw option market data into actionable analytics:

```
Market Quotes → IV Extraction → Surface Fitting → Model Calibration → Trading Signals
```

## IV Surface Construction

The implied volatility surface maps IV across two dimensions — strike (or moneyness) and time to expiration. Construction proceeds in three steps:

```typescript
// lib/options/volatilitySurface.ts
export interface IVSurfacePoint {
  strike: number;
  expiry: number;        // years to expiration
  moneyness: number;     // strike / forward price
  iv: number;
}

export function buildIVSurface(
  chains: OptionChain[],
  spot: number,
  riskFreeRate: number
): IVSurface {
  const points: IVSurfacePoint[] = [];

  for (const chain of chains) {
    for (const option of chain.options) {
      const midPrice = (option.bid + option.ask) / 2;
      if (midPrice <= 0 || option.openInterest < 10) continue;

      const iv = impliedVolatility(midPrice, {
        spot, strike: option.strike,
        timeToExpiry: chain.daysToExpiry / 365,
        riskFreeRate, dividendYield: 0,
      }, option.type);

      points.push({
        strike: option.strike,
        expiry: chain.daysToExpiry / 365,
        moneyness: option.strike / spot,
        iv,
      });
    }
  }

  return fitSurface(points);
}
```

The `fitSurface` function applies cubic spline interpolation in the strike dimension and linear interpolation across expiries, with arbitrage-free constraints ensuring no calendar spread or butterfly arbitrage.

## Smile and Skew Analysis

The volatility smile describes IV variation across strikes for a single expiry. Key metrics extracted:

| Metric | Definition |
|---|---|
| **ATM IV** | Implied volatility at the at-the-money strike |
| **25Δ Risk Reversal** | IV(25Δ call) − IV(25Δ put); measures directional skew |
| **25Δ Butterfly** | 0.5 × (IV(25Δ call) + IV(25Δ put)) − ATM IV; measures smile curvature |
| **Skew Slope** | dIV/dK at ATM; first derivative of smile |

```typescript
export function smileMetrics(surface: IVSurface, expiry: number): SmileMetrics {
  const slice = surface.getSlice(expiry);
  const atm = slice.ivAtMoneyness(1.0);
  const call25d = slice.ivAtDelta(0.25, 'call');
  const put25d = slice.ivAtDelta(-0.25, 'put');

  return {
    atmIV: atm,
    riskReversal25: call25d - put25d,
    butterfly25: 0.5 * (call25d + put25d) - atm,
    skewSlope: slice.derivative(1.0),
  };
}
```

Equity markets typically exhibit a negative skew (puts more expensive) reflecting crash protection demand.

## Term Structure

The volatility term structure plots ATM IV across expirations. It reveals:

- **Contango** — IV increases with expiry (normal state).
- **Backwardation** — Near-term IV exceeds long-term (event-driven, elevated short-term risk).
- **Kinks** — IV spikes around earnings, FOMC, or other known events.

```typescript
export function termStructure(surface: IVSurface): TermStructurePoint[] {
  return surface.expiries.map(expiry => ({
    daysToExpiry: expiry * 365,
    atmIV: surface.getSlice(expiry).ivAtMoneyness(1.0),
  }));
}
```

## SABR Model

The SABR (Stochastic Alpha Beta Rho) model calibrates a parametric smile to market data with four parameters:

```typescript
export interface SABRParams {
  alpha: number;   // initial volatility level
  beta: number;    // CEV exponent (typically 0, 0.5, or 1)
  rho: number;     // correlation between spot and vol (drives skew)
  volvol: number;  // volatility of volatility (drives curvature)
}

export function calibrateSABR(
  marketSmile: SmilePoint[],
  forward: number,
  expiry: number,
  beta: number = 0.5
): SABRParams {
  const objective = (params: number[]) => {
    const [alpha, rho, volvol] = params;
    return marketSmile.reduce((sse, pt) => {
      const modelIV = sabrImpliedVol(forward, pt.strike, expiry, alpha, beta, rho, volvol);
      return sse + (modelIV - pt.iv) ** 2;
    }, 0);
  };
  return minimize(objective, initialGuess);
}
```

SABR is the industry standard for interest rate and FX smile modeling and works well for equity index options.

## Local Volatility

The Dupire local volatility surface is derived from the implied volatility surface, giving the instantaneous volatility at each price level and time:

```typescript
export function localVolatility(
  surface: IVSurface, spot: number, strike: number, expiry: number
): number {
  const { iv, dIVdT, dIVdK, d2IVdK2 } = surface.derivatives(strike, expiry);
  const y = Math.log(strike / spot);
  const numerator = iv ** 2 + 2 * iv * expiry * dIVdT;
  const denominator = (1 - y * dIVdK / iv) ** 2
    + expiry * iv * (d2IVdK2 - (dIVdK ** 2) * (1 / iv + 0.25 * expiry * iv));
  return Math.sqrt(numerator / denominator);
}
```

Local vol is useful for pricing path-dependent exotics and serves as input to Monte Carlo simulations.

## Implied vs. Realized Volatility

The IV-RV spread tracks the premium (or discount) of option-implied volatility over historical realized volatility:

```typescript
export function ivRvSpread(ivSeries: TimeSeries, rvSeries: TimeSeries): TimeSeries {
  return ivSeries.map((point, i) => ({
    time: point.time,
    value: point.value - rvSeries[i].value,
  }));
}
```

A persistently positive spread indicates the "volatility risk premium" — options tend to be priced above subsequent realized volatility, creating opportunities for systematic vol sellers.

## Volatility Cone

The volatility cone plots the historical distribution of realized volatility across multiple lookback windows, overlaid with current IV:

| Lookback | 10th %ile | 25th %ile | 50th %ile | 75th %ile | 90th %ile |
|---|---|---|---|---|---|
| 1M | 12.1% | 15.8% | 19.5% | 24.2% | 31.0% |
| 3M | 13.5% | 16.4% | 20.1% | 25.0% | 30.2% |
| 6M | 14.2% | 17.0% | 20.8% | 25.5% | 29.8% |
| 1Y | 15.0% | 17.8% | 21.2% | 25.8% | 29.5% |

If current 1M IV sits at 28% (near the 90th percentile), options appear expensive relative to history — a potential signal for vol selling strategies.

## Variance Swaps

Variance swap analytics compute fair variance strike and mark-to-market valuation:

```typescript
export function varianceSwapFairStrike(surface: IVSurface, expiry: number): number {
  const strikes = surface.getSlice(expiry).allStrikes();
  let integral = 0;
  for (let i = 1; i < strikes.length; i++) {
    const dk = strikes[i] - strikes[i - 1];
    const k = (strikes[i] + strikes[i - 1]) / 2;
    const iv = surface.getSlice(expiry).ivAtStrike(k);
    integral += (iv ** 2) * dk / (k ** 2);
  }
  return Math.sqrt((2 * Math.exp(0) / expiry) * integral) * 100;
}
```

The fair strike represents the market's expectation of future variance and is derived from the full strip of option prices via the replication formula.
