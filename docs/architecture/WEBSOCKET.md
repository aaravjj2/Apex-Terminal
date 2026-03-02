# WebSocket Architecture

> Real-time data streaming, connection management, and message routing for the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [WebSocket Client Implementation](#websocket-client-implementation)
- [Auto-Reconnection](#auto-reconnection)
- [Heartbeat](#heartbeat)
- [Message Routing by Channel](#message-routing-by-channel)
- [Subscription Management](#subscription-management)
- [Message Queuing During Disconnects](#message-queuing-during-disconnects)
- [Binary vs JSON Messages](#binary-vs-json-messages)
- [Backpressure Handling](#backpressure-handling)
- [Integration with Zustand Stores](#integration-with-zustand-stores)

---

## Overview

Apex Terminal maintains a persistent WebSocket connection to the FastAPI backend for real-time market data, order updates, alert notifications, and news. The `WebSocketClient` in `data/WebSocketClient.ts` manages connection lifecycle, automatic reconnection, subscription multiplexing, and message routing to Zustand stores. It supports 6 channel types handling data ranging from 10 ticks/second for price quotes to 100+/second for time-and-sales feeds.

---

## WebSocket Client Implementation

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<(data: unknown) => void>>();
  private subscriptions = new Set<string>();

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    const token = useAuthStore.getState().accessToken;
    this.ws = new WebSocket(`${this.url}?token=${token}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => this.onOpen();
    this.ws.onmessage = (event) => this.onMessage(event);
    this.ws.onclose = (event) => this.onClose(event);
    this.ws.onerror = () => this.ws?.close();
  }

  send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
    }
  }
}
```

The client is instantiated once at application startup and shared across all features through a module-level singleton.

---

## Auto-Reconnection

Disconnections trigger automatic reconnection with exponential backoff and jitter:

```typescript
private reconnectAttempt = 0;
private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

private onClose(event: CloseEvent) {
  if (event.code === 1000) return; // clean close, no reconnect

  this.stopHeartbeat();
  this.scheduleReconnect();
}

private scheduleReconnect() {
  const baseDelay = 1000;
  const maxDelay = 30_000;
  const delay = Math.min(
    baseDelay * Math.pow(2, this.reconnectAttempt) + Math.random() * 1000,
    maxDelay,
  );

  this.reconnectAttempt++;
  useErrorStore.getState().setGlobalError({
    code: 'WS_DISCONNECTED',
    message: `Connection lost. Reconnecting in ${Math.ceil(delay / 1000)}s...`,
  });

  this.reconnectTimer = setTimeout(() => this.connect(), delay);
}

private onOpen() {
  this.reconnectAttempt = 0;
  useErrorStore.getState().clearGlobalError();
  this.startHeartbeat();
  this.resubscribeAll();
  this.flushMessageQueue();
}
```

The reconnection counter resets on successful connection. A `GlobalErrorBanner` shows reconnection status to the user.

---

## Heartbeat

A ping/pong heartbeat detects silent connection failures (e.g., network cable unplugged):

```typescript
private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
private lastPong = Date.now();
private HEARTBEAT_INTERVAL = 15_000;
private PONG_TIMEOUT = 10_000;

private startHeartbeat() {
  this.heartbeatInterval = setInterval(() => {
    if (Date.now() - this.lastPong > this.HEARTBEAT_INTERVAL + this.PONG_TIMEOUT) {
      this.ws?.close(4000, 'Heartbeat timeout');
      return;
    }
    this.send({ type: 'ping', timestamp: Date.now() });
  }, this.HEARTBEAT_INTERVAL);
}

private handlePong(data: { timestamp: number }) {
  this.lastPong = Date.now();
  const latency = Date.now() - data.timestamp;
  useTelemetryStore.getState().recordWSLatency(latency);
}

private stopHeartbeat() {
  if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
}
```

If no pong is received within the timeout window, the connection is forcibly closed, triggering the reconnect flow.

---

## Message Routing by Channel

Inbound messages are dispatched to registered handlers by channel name:

```typescript
private onMessage(event: MessageEvent) {
  const message = typeof event.data === 'string'
    ? JSON.parse(event.data)
    : this.decodeBinaryMessage(event.data);

  if (message.type === 'pong') {
    this.handlePong(message);
    return;
  }

  const { channel, data } = message;
  const handlers = this.handlers.get(channel);
  handlers?.forEach((handler) => handler(data));
}
```

### Channel Types

| Channel Pattern | Data Shape | Frequency | Consumer |
|----------------|-----------|-----------|----------|
| `price:{symbol}` | `{ last, bid, ask, volume, change }` | ~10/sec | watchlistStore, chart |
| `depth:{symbol}` | `{ bids: [price, qty][], asks: [price, qty][] }` | ~50/sec | OrderBook component |
| `trades:{symbol}` | `{ price, qty, side, time }` | ~100/sec | TimeAndSales panel |
| `orders:{userId}` | `{ orderId, status, fills }` | On event | orderStore |
| `alerts:{userId}` | `{ alertId, triggered, message }` | On event | alertStore |
| `news` | `{ headline, source, sentiment, time }` | On event | newsStore |

---

## Subscription Management

Components subscribe to channels via a ref-counted system that avoids duplicate server-side subscriptions:

```typescript
subscribe(channel: string, handler: (data: unknown) => void): () => void {
  if (!this.handlers.has(channel)) {
    this.handlers.set(channel, new Set());
    this.send({ type: 'subscribe', channel });
    this.subscriptions.add(channel);
  }
  this.handlers.get(channel)!.add(handler);

  return () => {
    const handlers = this.handlers.get(channel);
    handlers?.delete(handler);
    if (handlers?.size === 0) {
      this.handlers.delete(channel);
      this.subscriptions.delete(channel);
      this.send({ type: 'unsubscribe', channel });
    }
  };
}
```

The `useWebSocket` hook manages subscription lifecycle tied to component mount/unmount:

```typescript
function useWebSocket<T>(channel: string, handler: (data: T) => void) {
  useEffect(() => {
    return wsClient.subscribe(channel, handler as (data: unknown) => void);
  }, [channel, handler]);
}
```

---

## Message Queuing During Disconnects

Outbound messages sent while disconnected are queued and flushed on reconnect:

```typescript
private messageQueue: unknown[] = [];
private MAX_QUEUE_SIZE = 100;

private flushMessageQueue() {
  while (this.messageQueue.length > 0) {
    const msg = this.messageQueue.shift();
    this.send(msg);
  }
}
```

The queue has a bounded size. If it overflows, the oldest messages are dropped and a warning is logged. For order submissions, the API client (HTTP) is used as the primary channel — WebSocket is only a notification transport, never the sole order submission path.

---

## Binary vs JSON Messages

High-frequency channels (price, depth, trades) can optionally use binary encoding for bandwidth reduction:

```typescript
private decodeBinaryMessage(buffer: ArrayBuffer): { channel: string; data: unknown } {
  const view = new DataView(buffer);
  const channelLength = view.getUint8(0);
  const channelBytes = new Uint8Array(buffer, 1, channelLength);
  const channel = new TextDecoder().decode(channelBytes);

  const payloadOffset = 1 + channelLength;
  const data = this.decodePayload(buffer, payloadOffset, channel);
  return { channel, data };
}
```

| Channel | Format | Reason |
|---------|--------|--------|
| `price:*` | JSON (default) or binary | Binary saves ~60% bandwidth at scale |
| `depth:*` | Binary | Order book snapshots are large and frequent |
| `trades:*` | Binary | High throughput requires compact encoding |
| `orders:*` | JSON | Low frequency, readability preferred |
| `alerts:*` | JSON | Low frequency |
| `news` | JSON | Text-heavy payloads, compression handles size |

Binary mode is negotiated during the initial handshake based on client capabilities.

---

## Backpressure Handling

When the client cannot process messages fast enough, a backpressure mechanism prevents memory exhaustion:

```typescript
private pendingUpdates = new Map<string, unknown>();
private processingScheduled = false;

private onHighFrequencyMessage(channel: string, data: unknown) {
  this.pendingUpdates.set(channel, data); // latest value wins

  if (!this.processingScheduled) {
    this.processingScheduled = true;
    requestAnimationFrame(() => {
      this.pendingUpdates.forEach((value, ch) => {
        this.handlers.get(ch)?.forEach((handler) => handler(value));
      });
      this.pendingUpdates.clear();
      this.processingScheduled = false;
    });
  }
}
```

For price and depth channels, only the **latest** value matters. Intermediate values are coalesced, ensuring the UI always reflects the most current data without processing stale intermediate updates.

---

## Integration with Zustand Stores

WebSocket handlers connect directly to Zustand store actions:

```typescript
wsClient.subscribe('price:AAPL', (tick: PriceTick) => {
  useWatchlistStore.getState().updateQuote('AAPL', tick);
});

wsClient.subscribe(`orders:${userId}`, (update: OrderUpdate) => {
  useOrderStore.getState().handleOrderUpdate(update);
  if (update.status === 'filled') {
    usePositionStore.getState().updatePosition(update);
    eventBus.emit('order:filled', update);
  }
});

wsClient.subscribe('news', (article: NewsArticle) => {
  useNewsStore.getState().addArticle(article);
});

wsClient.subscribe(`alerts:${userId}`, (alert: AlertNotification) => {
  useAlertStore.getState().markTriggered(alert.alertId);
  showToast({ title: 'Alert Triggered', message: alert.message });
});
```

Store updates from WebSocket handlers bypass React entirely (using `getState()`) to avoid hook dependency chains. Components subscribe to specific store slices and re-render only when their data changes.
