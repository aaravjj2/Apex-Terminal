# Implied Volatility

Newton-Raphson or bisection to solve for IV given market price.

## Usage

```typescript
import { impliedVolatility } from '@/lib/options/blackScholes';

const iv = impliedVolatility(
  marketPrice: number,
  contract: OptionContract,
  { maxIterations: 100, tolerance: 1e-6 }
);
```

## Vol Surface

```typescript
interface VolSurface {
  points: VolSurfacePoint[];
  strikes: number[];
  expiries: number[];
  grid: number[][];
  atmVol: (expiry: number) => number;
  getVol: (strike: number, expiry: number) => number;
}
```
