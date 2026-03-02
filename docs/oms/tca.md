# Transaction Cost Analysis (TCA)

Post-trade execution quality metrics.

## TCA Report

```typescript
interface TCAReport {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  avgFillPrice: number;
  arrivalPrice: number;
  vwapBenchmark: number;
  twapBenchmark: number;
  implementationShortfall: number;
  slippageBps: number;
  marketImpactBps: number;
  timingCostBps: number;
  totalCostBps: number;
  participationRate: number;
  fillRate: number;
  executionDuration: number;
  numFills: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}
```

## API

```typescript
// GET /api/trading/tca/:orderId
const report = await getTCA(orderId);
```
