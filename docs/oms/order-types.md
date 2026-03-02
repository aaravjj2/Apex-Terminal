# Order Types

Supported order types from `frontend/src/api/tradingApi.ts`.

## Types

```typescript
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
type OrderSide = 'buy' | 'sell';
type OrderTimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';
```

## Submit Order Params

```typescript
interface SubmitOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;    // limit, stop_limit
  stopPrice?: number;    // stop, stop_limit
  trailPercent?: number; // trailing_stop
  trailAmount?: number;  // trailing_stop
  timeInForce?: OrderTimeInForce;
  extendedHours?: boolean;
  clientOrderId?: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  ocoGroupId?: string;
}
```

## API

```typescript
// POST /api/trading/orders
const order = await submitOrder({
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  limitPrice: 175.50,
  timeInForce: 'gtc',
});
```

## Validation

- quantity > 0
- limitPrice required for limit/stop_limit
- stopPrice required for stop/stop_limit
- trailPercent or trailAmount for trailing_stop
