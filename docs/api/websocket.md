# WebSocket API

Real-time streams.

## Endpoints

| Path | Purpose |
|------|---------|
| /ws/trading | Order, position, account updates |
| /ws/market-data | Quotes, trades, bars, level2 |
| /ws/alerts | Alert triggers |

## Connection

```typescript
import { createWebSocket } from '@/api/client';

const ws = createWebSocket('/ws/trading', {
  onMessage: (data) => console.log(data),
  onOpen: () => ws.send({ action: 'subscribe', channels: ['orders', 'positions'] }),
  reconnectMs: 1500,
  maxReconnects: 20,
});
```

## Trading Subscribe

```typescript
ws.send({ action: 'subscribe', channels: ['orders', 'positions', 'account'] });
```

## Market Data Subscribe

```typescript
ws.send({
  action: 'subscribe',
  symbols: ['AAPL', 'MSFT'],
  channels: ['quote', 'trade'],
});
```
