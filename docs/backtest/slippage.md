# Slippage Models

Slippage simulation for realistic fill prices.

## Config

```typescript
interface SlippageConfig {
  model: 'none' | 'fixed' | 'percent' | 'random';
  fixedBps?: number;
  percentBps?: number;
  maxBps?: number;
}
```

## Implementation

Engine uses deterministic PRNG (xoshiro128**) for `random` model — same seed yields same fills.
