# Bracket Orders

Entry + take-profit + stop-loss as a single submission.

## API

```typescript
interface BracketOrderParams {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryType: 'market' | 'limit';
  limitPrice?: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  timeInForce?: OrderTimeInForce;
}

// POST /api/trading/orders/bracket
const { entry, takeProfit, stopLoss } = await submitBracketOrder(params);
```

## OCO (One-Cancels-Other)

Take-profit and stop-loss are OCO: when one fills, the other cancels.

## Modify

Use `modifyOrder` for individual legs:

```typescript
// PATCH /api/trading/orders/:id
await modifyOrder(orderId, { limitPrice: 180, quantity: 50 });
```
