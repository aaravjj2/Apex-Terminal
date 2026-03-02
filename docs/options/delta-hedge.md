# Delta Hedging

Hedging options with underlying.

## Result

```typescript
interface DeltaHedgeResult {
  sharesNeeded: number;
  hedgeCost: number;
  portfolioDelta: number;
  rebalanceThreshold: number;
}
```

## Gamma Scalping

```typescript
interface GammaScalpResult {
  estimatedPnL: number;
  realizedGamma: number;
  hedgeAdjustments: number;
}
```
