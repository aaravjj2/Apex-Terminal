# Options API

Options chain data, Greeks computation, implied volatility surface modeling, and strategy payoff analysis. Supports Black-Scholes and binomial tree pricing models.

## Table of Contents

- [Endpoints](#endpoints)
- [Options Chain](#get-options-chain)
- [Greeks](#get-greeks)
- [IV Surface](#get-iv-surface)
- [Price Option](#post-price-option)
- [Strategy Analysis](#post-strategy-analysis)
- [Data Structures](#data-structures)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/options/:symbol/chain` | Full options chain for symbol |
| GET | `/api/options/:symbol/greeks` | Greeks for specific contract |
| GET | `/api/options/:symbol/surface` | Implied volatility surface |
| POST | `/api/options/price` | Price option via Black-Scholes or binomial |
| POST | `/api/options/strategy/analyze` | Analyze multi-leg strategy payoff |

## GET Options Chain

Returns all available expirations and strikes for the underlying.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Underlying ticker |
| `expiration` | string | No | Specific expiration date (YYYY-MM-DD) |
| `type` | string | No | `call`, `put`, or `all` (default: `all`) |
| `moneyness` | string | No | `itm`, `otm`, `atm`, `all` (default: `all`) |
| `strikeRange` | number | No | Number of strikes around ATM (default: 10) |

```typescript
interface OptionContract {
  contractSymbol: string;
  expiration: string;
  strike: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  inTheMoney: boolean;
  daysToExpiry: number;
}
interface ChainResponse {
  underlying: string;
  underlyingPrice: number;
  expirations: string[];
  calls: OptionContract[];
  puts: OptionContract[];
}
```

## GET Greeks

Computes Greeks for a specific options contract with real-time underlying data.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Underlying ticker |
| `contractId` | string | Yes | Contract symbol (query param) |

```typescript
interface GreeksResponse {
  contractSymbol: string;
  delta: number;    // Rate of change vs underlying price
  gamma: number;    // Rate of change of delta
  theta: number;    // Time decay per day
  vega: number;     // Sensitivity to 1% IV change
  rho: number;      // Sensitivity to interest rate change
  lambda: number;   // Leverage ratio (elasticity)
  vanna: number;    // d(delta)/d(vol)
  charm: number;    // d(delta)/d(time)
  impliedVolatility: number;
  theoreticalPrice: number;
}
```

## GET IV Surface

Returns the implied volatility surface across strikes and expirations.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Underlying ticker |
| `model` | string | No | `raw`, `svi`, `sabr` (default: `raw`) |

```typescript
interface IVSurfaceResponse {
  underlying: string;
  surface: {
    expiration: string;
    daysToExpiry: number;
    strikes: number[];
    ivs: number[];           // IV at each strike
    forwardPrice: number;
    atmIV: number;
    skew: number;            // 25-delta risk reversal
    kurtosis: number;        // Butterfly spread measure
  }[];
  timestamp: number;
}
```

## POST Price Option

Prices an option using Black-Scholes closed-form or Cox-Ross-Rubinstein binomial tree.

```typescript
interface PriceRequest {
  spot: number;
  strike: number;
  expiry: number;          // Days to expiration
  volatility: number;      // Annualized IV (e.g., 0.30)
  riskFreeRate: number;    // Annualized (e.g., 0.05)
  dividendYield?: number;  // Continuous yield (default: 0)
  type: 'call' | 'put';
  model: 'black_scholes' | 'binomial';
  steps?: number;          // Binomial tree steps (default: 200)
  style?: 'european' | 'american'; // Default: american for binomial
}

const result = await optionsApi.price({
  spot: 185.0, strike: 190.0, expiry: 30,
  volatility: 0.28, riskFreeRate: 0.05,
  type: 'call', model: 'black_scholes',
});
// { price: 3.42, delta: 0.41, gamma: 0.032, theta: -0.12, vega: 0.21, rho: 0.06 }
```

## POST Strategy Analysis

Analyzes a multi-leg options strategy, computing net payoff, breakeven, max profit/loss, and P&L at various underlying prices.

```typescript
interface StrategyLeg {
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  side: 'buy' | 'sell';
  quantity: number;
  premium: number;
}
interface StrategyRequest {
  underlying: string;
  legs: StrategyLeg[];
  priceRange?: [number, number]; // Underlying price range for payoff curve
  steps?: number;                // Points in payoff curve (default: 100)
}
interface StrategyResponse {
  name: string;                  // Auto-detected: "Bull Call Spread", "Iron Condor", etc.
  maxProfit: number | 'unlimited';
  maxLoss: number | 'unlimited';
  breakevens: number[];
  netDebit: number;              // Negative = net credit
  payoffCurve: { price: number; pnl: number }[];
  greeksSummary: { delta: number; gamma: number; theta: number; vega: number };
}
```

## Data Structures

### Common Strategy Templates

| Strategy | Legs |
|----------|------|
| Covered Call | Long stock + sell call |
| Protective Put | Long stock + buy put |
| Bull Call Spread | Buy lower call + sell higher call |
| Iron Condor | Bull put spread + bear call spread |
| Straddle | Buy call + buy put (same strike) |
| Strangle | Buy OTM call + buy OTM put |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 404 | `3100` | No options available for symbol |
| 400 | `3101` | Invalid expiration date |
| 400 | `3102` | Strike out of available range |
| 422 | `3103` | Pricing model failed to converge |
| 400 | `3104` | Invalid strategy (must have at least one leg) |

## Rate Limits

| Tier | Chain/min | Pricing/min | Strategy/min |
|------|----------|-------------|--------------|
| Free | 15 | 10 | 5 |
| Pro | 60 | 60 | 30 |
| Enterprise | 300 | 300 | 150 |
