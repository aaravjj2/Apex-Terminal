# Options Pricing Models

Pricing models in `frontend/src/lib/options/`.

## Black-Scholes-Merton

`blackScholes.ts` — analytical pricing for European options.

```typescript
import { blackScholes } from '@/lib/options/blackScholes';

const result = blackScholes({
  strike: 150,
  expiry: 0.25,  // years
  type: OptionType.CALL,
  underlyingPrice: 155,
  riskFreeRate: 0.05,
  dividendYield: 0.02,
  volatility: 0.25,
});
// result.theoreticalPrice, result.greeks
```

## Binomial

`binomial.ts` — CRR tree for American options.

```typescript
import { binomialTree } from '@/lib/options/binomial';

const result = binomialTree(contract, { steps: 100 });
```

## Models

| Model | File | Use Case |
|-------|------|----------|
| Black-Scholes | blackScholes.ts | European, analytical |
| Binomial | binomial.ts | American, early exercise |
| Monte Carlo | monteCarlo.ts | Path-dependent |
| BAW | baw.ts | American approximation |
