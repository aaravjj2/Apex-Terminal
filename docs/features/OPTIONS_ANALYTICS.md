# Options Analytics

Apex Terminal delivers comprehensive options analytics through `lib/options/`, including Black-Scholes and binomial pricing, full Greeks computation, implied volatility calculation, options chain display, position aggregation, and visual strategy payoff diagrams.

## Table of Contents

- [Architecture](#architecture)
- [Black-Scholes Model](#black-scholes-model)
- [Binomial Tree Model](#binomial-tree-model)
- [Greeks](#greeks)
- [Implied Volatility](#implied-volatility)
- [Options Chain Display](#options-chain-display)
- [Position Greeks Aggregation](#position-greeks-aggregation)
- [Strategy Payoff Diagrams](#strategy-payoff-diagrams)

## Architecture

The options analytics library is organized into four core modules:

| Module | Responsibility |
|---|---|
| `blackScholes.ts` | Closed-form European option pricing and Greeks |
| `binomial.ts` | Cox-Ross-Rubinstein tree for American options |
| `greeks.ts` | Unified Greeks interface and higher-order Greeks |
| `monteCarlo.ts` | Monte Carlo pricing for exotic payoffs |
| `volatilitySurface.ts` | IV surface construction and interpolation |

All modules operate as pure functions with no side effects, suitable for Web Worker execution.

## Black-Scholes Model

The Black-Scholes-Merton model prices European calls and puts:

```typescript
// lib/options/blackScholes.ts
export interface BSInput {
  spot: number;         // current underlying price
  strike: number;       // option strike price
  timeToExpiry: number; // years to expiration
  riskFreeRate: number; // annualized risk-free rate
  volatility: number;   // annualized implied volatility
  dividendYield: number;
}

export function blackScholesPrice(input: BSInput, type: 'call' | 'put'): number {
  const { spot, strike, timeToExpiry: T, riskFreeRate: r, volatility: σ, dividendYield: q } = input;
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * σ ** 2) * T) / (σ * Math.sqrt(T));
  const d2 = d1 - σ * Math.sqrt(T);

  if (type === 'call') {
    return spot * Math.exp(-q * T) * normalCDF(d1) - strike * Math.exp(-r * T) * normalCDF(d2);
  }
  return strike * Math.exp(-r * T) * normalCDF(-d2) - spot * Math.exp(-q * T) * normalCDF(-d1);
}
```

## Binomial Tree Model

The Cox-Ross-Rubinstein binomial tree handles American-style options with early exercise:

```typescript
// lib/options/binomial.ts
export function binomialPrice(input: BSInput, type: 'call' | 'put', steps: number = 200): number {
  const { spot, strike, timeToExpiry: T, riskFreeRate: r, volatility: σ } = input;
  const dt = T / steps;
  const u = Math.exp(σ * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp(r * dt) - d) / (u - d);

  let prices = Array.from({ length: steps + 1 }, (_, i) =>
    Math.max(0, type === 'call'
      ? spot * u ** (steps - i) * d ** i - strike
      : strike - spot * u ** (steps - i) * d ** i)
  );

  for (let step = steps - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const hold = Math.exp(-r * dt) * (p * prices[i] + (1 - p) * prices[i + 1]);
      const exercise = type === 'call'
        ? spot * u ** (step - i) * d ** i - strike
        : strike - spot * u ** (step - i) * d ** i;
      prices[i] = Math.max(hold, exercise);
    }
  }
  return prices[0];
}
```

Step count defaults to 200 for a balance of accuracy and performance. For quick estimates the UI offers 50 steps; for precise pricing, 500+.

## Greeks

The `greeks.ts` module computes first- and second-order sensitivities:

| Greek | Symbol | Measures |
|---|---|---|
| **Delta** | Δ | Price sensitivity to underlying move ($1) |
| **Gamma** | Γ | Delta sensitivity to underlying move ($1) |
| **Theta** | Θ | Price decay per day (time decay) |
| **Vega** | ν | Price sensitivity to 1% IV change |
| **Rho** | ρ | Price sensitivity to 1% rate change |

```typescript
// lib/options/greeks.ts
export function computeGreeks(input: BSInput, type: 'call' | 'put'): Greeks {
  const { spot, strike, timeToExpiry: T, riskFreeRate: r, volatility: σ, dividendYield: q } = input;
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * σ ** 2) * T) / (σ * Math.sqrt(T));
  const d2 = d1 - σ * Math.sqrt(T);

  const delta = type === 'call'
    ? Math.exp(-q * T) * normalCDF(d1)
    : -Math.exp(-q * T) * normalCDF(-d1);

  const gamma = Math.exp(-q * T) * normalPDF(d1) / (spot * σ * Math.sqrt(T));
  const theta = computeTheta(spot, strike, T, r, σ, q, d1, d2, type);
  const vega = spot * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T) / 100;
  const rho = computeRho(strike, T, r, d2, type);

  return { delta, gamma, theta, vega, rho };
}
```

Higher-order Greeks (vanna, charm, volga, color, speed) are available through `higherOrderGreeks()` for advanced risk management.

## Implied Volatility

IV is solved numerically from market prices using Newton-Raphson iteration:

```typescript
export function impliedVolatility(
  marketPrice: number, input: Omit<BSInput, 'volatility'>, type: 'call' | 'put'
): number {
  let σ = 0.3; // initial guess
  for (let i = 0; i < 100; i++) {
    const price = blackScholesPrice({ ...input, volatility: σ }, type);
    const vega = computeGreeks({ ...input, volatility: σ }, type).vega * 100;
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-8) break;
    σ -= diff / vega;
  }
  return σ;
}
```

Convergence typically occurs within 5–10 iterations for liquid options.

## Options Chain Display

The options chain component renders a tabular view of all strikes for a selected expiry:

- **Columns** — bid, ask, last, volume, open interest, IV, delta, gamma, theta, vega.
- **Color coding** — ITM options highlighted with a subtle background tint.
- **Filters** — strike range (ATM ± N strikes), moneyness (ITM/OTM/all), minimum volume.
- **Multi-expiry** — tab bar for switching between expiration dates.

Clicking a strike populates the order ticket; selecting multiple strikes builds a multi-leg strategy.

## Position Greeks Aggregation

For portfolios containing multiple options positions, the system aggregates Greeks:

```typescript
export function aggregateGreeks(positions: OptionPosition[]): AggregatedGreeks {
  return positions.reduce((acc, pos) => {
    const g = computeGreeks(pos.input, pos.type);
    const mult = pos.quantity * pos.multiplier * (pos.side === 'long' ? 1 : -1);
    return {
      delta: acc.delta + g.delta * mult,
      gamma: acc.gamma + g.gamma * mult,
      theta: acc.theta + g.theta * mult,
      vega: acc.vega + g.vega * mult,
      rho: acc.rho + g.rho * mult,
    };
  }, { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });
}
```

The aggregated view shows net Greeks across all positions and breaks down by underlying, expiry, and strategy.

## Strategy Payoff Diagrams

The payoff diagram component renders profit/loss at expiration for multi-leg strategies:

Supported strategies include: covered call, protective put, bull/bear call spread, bull/bear put spread, straddle, strangle, iron condor, iron butterfly, calendar spread, diagonal spread, ratio spread, and custom combinations.

The diagram plots P&L on the y-axis against underlying price on the x-axis, with break-even points, max profit, max loss, and probability of profit annotations. An interactive slider adjusts days-to-expiry to visualize time decay effects on the position.
