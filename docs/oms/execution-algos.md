# Execution Algorithms

Algorithmic order execution for large orders.

## TWAP (Time-Weighted Average Price)

Splits order over time to minimize market impact.

```typescript
// Concept: divide quantity into N child orders over duration
const duration = endTime - startTime;
const interval = duration / numSlices;
for (let i = 0; i < numSlices; i++) {
  const sliceQty = Math.floor(totalQty / numSlices);
  await submitOrder({ symbol, side, type: 'market', quantity: sliceQty });
  await sleep(interval);
}
```

## VWAP (Volume-Weighted Average Price)

Match market volume profile. API: `GET /api/market-data/vwap/:symbol`

## Iceberg / Hidden

Submit visible quantity; refill as filled.

## Implementation Shortfall

TCA metric: `(arrivalPrice - avgFillPrice) * quantity`. API: `GET /api/trading/tca/:orderId`
