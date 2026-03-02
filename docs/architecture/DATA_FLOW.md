# Data Flow Architecture

> How data moves from external sources through the API layer, into stores, and ultimately to the rendered UI.

---

## Table of Contents

- [Overview](#overview)
- [Data Flow Diagram](#data-flow-diagram)
- [REST API Flow](#rest-api-flow)
- [WebSocket Real-Time Flow](#websocket-real-time-flow)
- [Worker Computation Flow](#worker-computation-flow)
- [User Action Flow](#user-action-flow)
- [Caching Layers](#caching-layers)
- [Error Propagation](#error-propagation)

---

## Overview

Apex Terminal manages three primary data flows:

1. **Request/Response** — User-initiated REST API calls for historical data, order submission, and configuration
2. **Real-Time Streaming** — Server-pushed market data, order updates, and alerts via WebSocket
3. **Background Computation** — CPU-intensive calculations offloaded to Web Workers

Each flow terminates in a Zustand store update, which triggers React component re-renders through selective subscriptions.

---

## Data Flow Diagram

```
External Data Sources
        │
        ▼
┌─────────────────────────────┐
│     FastAPI Backend          │
│  REST (/api)  │  WS (/ws)   │
└───────┬───────┴──────┬──────┘
        │              │
        ▼              ▼
┌──────────────┐ ┌─────────────────┐
│  API Client  │ │ WebSocket Client │
│  (data/)     │ │ (data/)          │
│  - Retry     │ │ - Auto-reconnect │
│  - Cache     │ │ - Heartbeat      │
│  - Auth      │ │ - Message queue  │
└──────┬───────┘ └────────┬────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────────┐
│        Zustand Stores            │
│  (chartStore, orderStore, etc.)  │
└────┬────────────────────┬───────┘
     │                    │
     ▼                    ▼
┌──────────┐    ┌─────────────────┐
│ Workers  │    │ React Components │
│ (5 types)│    │ (subscriptions)  │
└────┬─────┘    └────────┬────────┘
     │                   │
     └──────► Store ─────► UI Render
```

---

## REST API Flow

### Request Lifecycle

```
Component → Hook → API Module → HTTP Client → Backend → Response
                                                          │
                                              ┌───────────┤
                                              ▼           ▼
                                          Cache Store  Zustand Store
                                                          │
                                                          ▼
                                                    Re-render
```

### Implementation

```typescript
// 1. Component triggers data fetch via hook
function ChartPage() {
  const { data, isLoading } = useChartData('AAPL', '1D');
  // renders based on data state
}

// 2. Hook orchestrates the fetch
function useChartData(symbol: string, timeframe: string) {
  const [data, setData] = useState<OHLCV[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    marketDataApi.getHistorical(symbol, timeframe)
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [symbol, timeframe]);

  return { data, isLoading };
}

// 3. API module makes typed HTTP call
export const marketDataApi = {
  getHistorical: (symbol: string, timeframe: string) =>
    apiClient.get<OHLCV[]>(`/market-data/${symbol}/historical`, {
      params: { timeframe },
    }),
};

// 4. HTTP client handles transport concerns
class ApiClient {
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    const cached = this.cache.get(url, config?.params);
    if (cached) return cached;

    const response = await this.fetchWithRetry(url, config);
    this.cache.set(url, config?.params, response);
    return response;
  }
}
```

---

## WebSocket Real-Time Flow

### Message Lifecycle

```
Market Feed → Backend WS → Client WS → Message Router → Store → Component
```

### Channel Architecture

| Channel | Data | Frequency |
|---------|------|-----------|
| `price:{symbol}` | Last price, bid/ask, volume | ~10/sec per symbol |
| `depth:{symbol}` | Order book updates (L2) | ~50/sec per symbol |
| `trades:{symbol}` | Time & sales tick data | ~100/sec per symbol |
| `orders:{userId}` | Order status updates | On event |
| `alerts:{userId}` | Triggered alert notifications | On event |
| `news` | Breaking news headlines | On event |

### Implementation

```typescript
// WebSocket client routes messages to handlers
class WebSocketClient {
  private handlers = new Map<string, Set<(data: unknown) => void>>();

  subscribe(channel: string, handler: (data: unknown) => void) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      this.send({ type: 'subscribe', channel });
    }
    this.handlers.get(channel)!.add(handler);
  }

  private onMessage(event: MessageEvent) {
    const { channel, data } = JSON.parse(event.data);
    this.handlers.get(channel)?.forEach((handler) => handler(data));
  }
}

// Store subscribes to real-time updates
const wsClient = new WebSocketClient('ws://localhost:8000/ws');

wsClient.subscribe('price:AAPL', (tick) => {
  useWatchlistStore.getState().updateQuote('AAPL', tick);
});
```

### High-Frequency Update Strategy

For price ticks arriving at 10+ updates/second, direct store updates would cause excessive re-renders:

```typescript
function PriceDisplay({ symbol }: { symbol: string }) {
  const priceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Bypass React — write directly to DOM for real-time prices
    const unsub = wsClient.subscribe(`price:${symbol}`, (tick) => {
      if (priceRef.current) {
        priceRef.current.textContent = tick.price.toFixed(2);
        priceRef.current.className = tick.change > 0 ? 'text-green' : 'text-red';
      }
    });
    return unsub;
  }, [symbol]);

  return <span ref={priceRef} />;
}
```

---

## Worker Computation Flow

### Offloading Pattern

```
Store (input data) → Worker.postMessage() → Worker computes → Worker.postMessage(result) → Store update
```

### Worker Types

| Worker | Input | Output | Typical Duration |
|--------|-------|--------|-----------------|
| `indicatorWorker` | OHLCV data + indicator config | Computed indicator values | 5-50ms |
| `backtestWorker` | Strategy + historical data | Performance metrics, trades | 100ms-10s |
| `screeningWorker` | Universe + filter criteria | Matching symbols | 50-500ms |
| `optimizationWorker` | Strategy + parameter ranges | Optimal parameters | 1-60s |
| `dataWorker` | Raw data + transform spec | Processed datasets | 10-100ms |

### Implementation

```typescript
// Hook manages worker lifecycle
function useIndicatorWorker() {
  const workerRef = useRef<Worker>();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('@/workers/indicatorWorker.ts', import.meta.url),
      { type: 'module' }
    );
    return () => workerRef.current?.terminate();
  }, []);

  const compute = useCallback((data: OHLCV[], config: IndicatorConfig) => {
    return new Promise<IndicatorResult>((resolve) => {
      workerRef.current!.onmessage = (e) => resolve(e.data);
      workerRef.current!.postMessage({ data, config });
    });
  }, []);

  return { compute };
}
```

---

## User Action Flow

### Order Submission Example

```
User clicks "Buy" → OrderTicket validates → orderStore.submitOrder()
    → orderApi.create(order) → Backend validates → Exchange
    → WS: order:accepted → orderStore updates → UI shows confirmation
    → WS: order:filled → positionStore updates → Portfolio reflects fill
```

### Symbol Change Example

```
User types "TSLA" in search → chartStore.setSymbol('TSLA')
    → useEffect triggers:
        1. marketDataApi.getHistorical('TSLA') → chartStore.setData()
        2. wsClient.subscribe('price:TSLA') → watchlistStore updates
        3. newsApi.getNews('TSLA') → newsStore updates
        4. indicatorWorker recalculates → chartStore.setIndicators()
```

---

## Caching Layers

```
Component Request
      │
      ▼
┌─────────────┐  HIT   ┌──────────────┐
│ React State │ ◄────── │ useMemo/Ref  │
└──────┬──────┘         └──────────────┘
       │ MISS
       ▼
┌─────────────┐  HIT   ┌──────────────┐
│ Zustand     │ ◄────── │ Store Cache  │
└──────┬──────┘         └──────────────┘
       │ MISS
       ▼
┌─────────────┐  HIT   ┌──────────────┐
│ API Client  │ ◄────── │ HTTP Cache   │
└──────┬──────┘         └──────────────┘
       │ MISS
       ▼
┌─────────────┐
│ Backend API │
└─────────────┘
```

---

## Error Propagation

Errors bubble up through each layer with appropriate handling:

| Layer | Error Handling |
|-------|---------------|
| **API Client** | Retry with exponential backoff, circuit breaker |
| **WebSocket** | Auto-reconnect with backoff, message queue during disconnect |
| **Store** | Error state field, error clearing on retry |
| **Hook** | `isError` / `error` return values |
| **Component** | ErrorBoundary catch, inline error messages |
| **Global** | ErrorBanner for unhandled errors, toast notifications |
