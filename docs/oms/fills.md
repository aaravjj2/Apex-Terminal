# Fills

Trade execution history.

## Types

```typescript
interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  fees: number;
  exchange: string;
  liquidityType: 'maker' | 'taker' | 'unknown';
  timestamp: string;
}
```

## API

```typescript
// GET /api/trading/fills?symbol=&order_id=&since=&until=&limit=&offset=
const { fills, total } = await getFills({
  symbol: 'AAPL',
  orderId: 'ORD-123',
  since: '2024-01-01T00:00:00Z',
  limit: 50,
});
```
