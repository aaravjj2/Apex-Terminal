# Monitoring

> Observability, performance metrics, error tracking, and user behavior analytics powered by the `AnalyticsEngine` in `lib/platform/analytics.ts` and the `telemetryStore`.

---

## Table of Contents

- [Overview](#overview)
- [Analytics Engine](#analytics-engine)
- [Core Web Vitals](#core-web-vitals)
- [Performance Metrics](#performance-metrics)
- [Error Tracking](#error-tracking)
- [User Behavior Analytics](#user-behavior-analytics)
- [Feature Usage Tracking](#feature-usage-tracking)
- [WebSocket Connection Health](#websocket-connection-health)
- [API Latency Monitoring](#api-latency-monitoring)
- [Bundle Size Tracking](#bundle-size-tracking)
- [Telemetry Store](#telemetry-store)
- [Analytics Providers](#analytics-providers)

---

## Overview

Apex Terminal's monitoring stack runs entirely in the browser. The `AnalyticsEngine` collects Core Web Vitals via `PerformanceObserver`, tracks user journeys and feature usage, captures errors with breadcrumb context, and flushes event batches to configurable analytics providers. The `telemetryStore` (Zustand) aggregates real-time platform health metrics for the admin dashboard.

Key design constraints: user consent is required before any data leaves the browser, events are batched to minimize network overhead, and the engine gracefully degrades when `PerformanceObserver` APIs are unavailable.

---

## Analytics Engine

The `AnalyticsEngine` initializes with sensible defaults and auto-starts three tracking subsystems:

```typescript
const analytics = new AnalyticsEngine({
  flushSize: 20,              // batch size before auto-flush
  flushIntervalMs: 30_000,    // flush timer (30s)
  maxBreadcrumbs: 50,         // error context trail
  autoTrackPageViews: true,   // history.pushState / popstate hooks
  autoTrackPerformance: true, // PerformanceObserver registration
  autoTrackErrors: true,      // window.onerror + unhandledrejection
  debugMode: false,           // console.debug output
});
```

Events are queued in memory and flushed either when the batch reaches `flushSize`, the interval fires, or the page becomes hidden (`visibilitychange`). Flushing requires `consent === true` — otherwise events accumulate but never ship.

---

## Core Web Vitals

The engine registers `PerformanceObserver` instances for all standard Web Vitals:

| Metric | Observer Type | Good | Needs Improvement | Poor |
|--------|--------------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | `largest-contentful-paint` | ≤2500ms | ≤4000ms | >4000ms |
| **FID** (First Input Delay) | `first-input` | ≤100ms | ≤300ms | >300ms |
| **CLS** (Cumulative Layout Shift) | `layout-shift` | ≤0.1 | ≤0.25 | >0.25 |
| **FCP** (First Contentful Paint) | `paint` | — | — | — |
| **INP** (Interaction to Next Paint) | tracked via `inp` field | — | — | — |
| **TTFB** (Time to First Byte) | `navigation` timing | — | — | — |

Additionally, `longtask` observers count tasks exceeding 50ms. Navigation timing provides `domContentLoaded` and `loadComplete` timestamps.

```typescript
const vitals = analytics.getWebVitalsScore();
// { score: 'good', details: { lcp: '1850ms (good)', fid: '45ms (good)', cls: '0.0320 (good)' } }
```

The composite score is the worst individual rating — a single "poor" metric makes the overall score "poor".

---

## Performance Metrics

The full `PerformanceMetrics` snapshot includes resource loading stats:

```typescript
interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
  inp: number | null;
  domContentLoaded: number | null;
  loadComplete: number | null;
  longTasks: number;           // count of tasks > 50ms
  resourceCount: number;       // total loaded resources
  totalTransferSize: number;   // bytes transferred (all resources)
}

const metrics = analytics.getPerformanceMetrics();
```

Resource metrics are captured on `window.load` by aggregating `PerformanceResourceTiming` entries. This powers the admin panel's bundle and network performance views.

---

## Error Tracking

Two global handlers capture unhandled errors and promise rejections:

```typescript
// Runtime errors → window.onerror
// Unhandled promises → window.onunhandledrejection

interface ErrorEvent {
  message: string;
  stack?: string;
  type: 'runtime' | 'unhandled_promise';
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
  sessionId: string;
  breadcrumbs: string[];    // last 50 user actions for context
}
```

Breadcrumbs are automatically collected from page views, tracked events, and journey steps. Each breadcrumb is timestamped (`[HH:mm:ss.SSS] Event: trading/order_placed`). When an error fires, the current breadcrumb trail is snapshot and attached.

Manual error tracking is also available:

```typescript
analytics.trackError({
  message: 'WebSocket reconnection failed after 5 attempts',
  type: 'runtime',
  timestamp: Date.now(),
  sessionId: analytics.getSession().id,
  breadcrumbs: analytics.getBreadcrumbs(),
});
```

---

## User Behavior Analytics

### Page Views

Auto-tracked via monkey-patching `history.pushState` and `history.replaceState`, plus listening to `popstate`. Each page view records path, title, referrer, and session context.

### User Journey

Journey steps capture the sequential flow of user actions across pages:

```typescript
analytics.trackJourneyStep('opened_chart', { symbol: 'AAPL' });
analytics.trackJourneyStep('added_indicator', { type: 'RSI' });
analytics.trackJourneyStep('placed_order', { side: 'buy', qty: 100 });

const journey = analytics.getJourney();
// Each step has duration calculated from the next step's timestamp
```

### Funnel Analysis

Measure conversion through defined step sequences:

```typescript
const funnel = analytics.analyzeFunnel([
  'opened_chart',
  'analyzed_indicator',
  'opened_order_ticket',
  'confirmed_order',
]);
// [{ id: 'opened_chart', count: 100, dropoff: 0, conversionRate: 100 },
//  { id: 'analyzed_indicator', count: 72, dropoff: 28, conversionRate: 72 },
//  { id: 'opened_order_ticket', count: 45, dropoff: 27, conversionRate: 62 },
//  { id: 'confirmed_order', count: 31, dropoff: 14, conversionRate: 69 }]
```

---

## Feature Usage Tracking

Track which platform features are adopted and how frequently:

```typescript
analytics.trackFeatureUsage('options_chain', 'opened');
analytics.trackFeatureUsage('backtest_engine', 'ran_simulation');
analytics.trackFeatureUsage('drawing_tools', 'fibonacci_retracement');

const usage = analytics.getFeatureUsage();
// [{ featureId: 'options_chain', action: 'opened', count: 14, firstUsed: ..., lastUsed: ... }]
```

Usage data feeds into the feature flag system to measure adoption rates for gradual rollouts.

---

## WebSocket Connection Health

The `useWebSocket` hook and `telemetryStore` collaborate to monitor real-time data connections:

| Metric | Source | Description |
|--------|--------|-------------|
| Connection state | `useWebSocket` | `connecting`, `open`, `closing`, `closed` |
| Reconnection count | `useWebSocket` | Number of automatic reconnects |
| Message throughput | `telemetryStore` | Messages per second (rolling average) |
| Last heartbeat | `telemetryStore` | Timestamp of last server ping response |
| Latency | `telemetryStore` | Round-trip time of ping/pong messages |

Connection state changes are tracked as analytics events, enabling correlation of WebSocket drops with user experience degradation.

---

## API Latency Monitoring

HTTP request performance is tracked through interceptors or manual instrumentation:

```typescript
analytics.track('api_request', 'performance', {
  endpoint: '/api/v1/orders',
  method: 'POST',
  status: 200,
  duration: 145,      // ms
  payloadSize: 1024,  // bytes
});
```

The `telemetryStore` aggregates API metrics into percentile distributions (p50, p95, p99) for display in the platform health dashboard. Slow endpoints (>1000ms) trigger automatic alerts.

---

## Bundle Size Tracking

Resource timing data captures transfer sizes for all loaded assets:

```typescript
const metrics = analytics.getPerformanceMetrics();
console.log(`Resources: ${metrics.resourceCount}`);
console.log(`Total transfer: ${(metrics.totalTransferSize / 1024).toFixed(0)} KB`);
```

Build-time size tracking is handled by the Vite build pipeline, while runtime tracking via `PerformanceResourceTiming` captures actual compressed transfer sizes including cache hits.

---

## Telemetry Store

The `telemetryStore` (Zustand) provides a reactive view of platform health for the admin dashboard and `platformHealthStore`:

```typescript
interface TelemetryState {
  wsConnected: boolean;
  wsLatency: number;
  wsReconnects: number;
  apiLatencyP50: number;
  apiLatencyP95: number;
  apiErrorRate: number;
  memoryUsage: number;
  longTaskCount: number;
  activeWorkers: number;
  webVitalsScore: 'good' | 'needs-improvement' | 'poor';
}
```

---

## Analytics Providers

Events are shipped to external services via pluggable providers:

### Beacon Provider (Production)

Uses `navigator.sendBeacon` for reliable delivery on page unload, with `fetch` fallback:

```typescript
analytics.addProvider(createBeaconProvider('https://analytics.apexterminal.io/v1/events'));
```

### Console Provider (Development)

Logs events to the browser console for local debugging:

```typescript
analytics.addProvider(createConsoleProvider());
```

### Custom Provider

Any async function matching `(events: AnalyticsEvent[]) => Promise<void>` can be registered:

```typescript
analytics.addProvider(async (events) => {
  await fetch('/internal/telemetry', {
    method: 'POST',
    body: JSON.stringify(events),
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Multiple providers can be registered simultaneously. Failed flushes re-queue events for the next batch cycle.
