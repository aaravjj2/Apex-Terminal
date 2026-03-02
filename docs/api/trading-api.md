# Trading API

`frontend/src/api/tradingApi.ts`

## Submit Order

```typescript
const order = await submitOrder({
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  quantity: 100,
  limitPrice: 175,
  timeInForce: 'gtc',
});
```

## Order Types

market, limit, stop, stop_limit, trailing_stop

## Time in Force

day, gtc, ioc, fok, opg, cls
