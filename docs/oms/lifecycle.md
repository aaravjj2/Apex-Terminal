# Order Lifecycle

Order status flow from `tradingApi.ts`.

## Status Enum

```typescript
type OrderStatus =
  | 'new'
  | 'pending'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'replaced';
```

## Lifecycle Diagram

```
new → pending → partially_filled → filled
  │       │              │
  ├───────┴──────────────┴→ cancelled
  │
  └→ rejected
  └→ expired
  └→ replaced (then new order)
```

## Helpers

```typescript
import { isOrderActive, isOrderTerminal } from '@/api/tradingApi';

isOrderActive(status);  // new | pending | partially_filled
isOrderTerminal(status); // filled | cancelled | rejected | expired
```

## WebSocket Events

```typescript
subscribeOrderUpdates((event) => {
  // event.type: 'order_new' | 'order_fill' | 'order_partial_fill' | 'order_cancelled' | ...
  // event.data: Order | Position | AccountInfo
});
```

Endpoint: `WS /ws/trading` — subscribe to `orders`, `positions`, `account`.
