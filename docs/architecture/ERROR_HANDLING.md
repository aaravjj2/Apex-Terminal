# Error Handling

> Patterns for catching, reporting, and recovering from errors across the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [Error Boundary Component](#error-boundary-component)
- [ErrorBanner & SeverityBanner](#errorbanner--severitybanner)
- [API Client Retry Logic](#api-client-retry-logic)
- [WebSocket Reconnection](#websocket-reconnection)
- [Global Error Handlers](#global-error-handlers)
- [Error Reporting & Monitoring](#error-reporting--monitoring)
- [Graceful Degradation](#graceful-degradation)
- [User-Facing Error Messages](#user-facing-error-messages)
- [Error Codes System](#error-codes-system)

---

## Overview

Apex Terminal uses a defense-in-depth approach to error handling. React ErrorBoundaries catch rendering failures, the API client retries transient network errors, WebSocket clients auto-reconnect, and a global error handler captures unhandled exceptions. Every error is classified by severity and surfaced to the user in context-appropriate ways — from inline validation messages to full-page recovery screens.

---

## Error Boundary Component

The root `ErrorBoundary` wraps the entire application and catches any unhandled rendering error:

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      error,
      componentStack: info.componentStack,
      buildVersion: import.meta.env.VITE_GIT_SHA,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorRecoveryScreen
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
```

Feature-level boundaries wrap individual panels so a crash in the options chain does not take down the entire application:

```tsx
<ErrorBoundary fallback={<PanelErrorFallback />}>
  <OptionsChain symbol={symbol} />
</ErrorBoundary>
```

---

## ErrorBanner & SeverityBanner

### GlobalErrorBanner

Displayed at the top of the application when a critical, app-wide issue occurs (e.g., WebSocket disconnect, auth failure):

```tsx
function GlobalErrorBanner() {
  const error = useErrorStore((s) => s.globalError);
  if (!error) return null;

  return (
    <div className="bg-red-900/80 text-red-100 px-4 py-2 text-sm flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      <span>{error.message}</span>
      <button onClick={useErrorStore.getState().clearGlobalError}>Dismiss</button>
    </div>
  );
}
```

### SeverityBanner

Context-sensitive inline banners used within feature panels:

```tsx
type Severity = 'info' | 'warning' | 'error';

function SeverityBanner({ severity, message, action }: SeverityBannerProps) {
  const styles = {
    info: 'bg-blue-900/30 text-blue-200 border-blue-700',
    warning: 'bg-yellow-900/30 text-yellow-200 border-yellow-700',
    error: 'bg-red-900/30 text-red-200 border-red-700',
  };

  return (
    <div className={`border-l-2 px-3 py-2 text-sm ${styles[severity]}`}>
      {message}
      {action && <button className="ml-2 underline" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
```

Usage: validation failures in the order ticket, data staleness warnings in the portfolio view, degraded API notifications.

---

## API Client Retry Logic

The `ApiClient` retries transient failures with exponential backoff:

```typescript
class ApiClient {
  private async fetchWithRetry<T>(
    url: string,
    config: RequestConfig,
    attempt = 0,
  ): Promise<T> {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;

    try {
      const response = await fetch(url, config);
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        throw new RetryableError(response.status);
      }
      if (!response.ok) throw new ApiError(response.status, await response.text());
      return response.json();
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      if (err instanceof RetryableError || err instanceof TypeError) {
        const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 500;
        await sleep(delay);
        return this.fetchWithRetry(url, config, attempt + 1);
      }
      throw err;
    }
  }
}
```

Only 5xx server errors and network failures (`TypeError`) trigger retries. Client errors (4xx) fail immediately. A jitter component prevents thundering herds after backend restarts.

---

## WebSocket Reconnection

The `WebSocketClient` implements automatic reconnection with backoff:

```typescript
class WebSocketClient {
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30_000;
  private messageQueue: unknown[] = [];

  private scheduleReconnect() {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt) + Math.random() * 1000,
      this.maxReconnectDelay,
    );
    this.reconnectAttempt++;

    setTimeout(() => {
      this.connect();
    }, delay);

    useErrorStore.getState().setGlobalError({
      code: 'WS_DISCONNECTED',
      message: `Reconnecting in ${Math.round(delay / 1000)}s...`,
    });
  }

  private onOpen() {
    this.reconnectAttempt = 0;
    useErrorStore.getState().clearGlobalError();
    this.resubscribeAll();
    this.flushMessageQueue();
  }
}
```

During disconnection, outbound messages are queued and flushed on reconnect. Active subscriptions are automatically resubscribed.

---

## Global Error Handlers

Unhandled errors and promise rejections are captured at the window level:

```typescript
window.addEventListener('error', (event) => {
  reportError({
    type: 'uncaught',
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportError({
    type: 'unhandled_rejection',
    reason: String(event.reason),
    stack: event.reason?.stack,
  });
});
```

These handlers act as the final safety net, logging errors that escape both React's ErrorBoundary and try-catch blocks in async code.

---

## Error Reporting & Monitoring

All captured errors are sent to the monitoring service with rich context:

```typescript
function reportError(error: ErrorReport) {
  const payload = {
    ...error,
    buildVersion: import.meta.env.VITE_GIT_SHA,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    storeSnapshot: {
      symbol: useChartStore.getState().symbol,
      route: window.location.pathname,
    },
  };

  navigator.sendBeacon('/api/errors', JSON.stringify(payload));
}
```

`navigator.sendBeacon` ensures error reports are sent even during page unload. The backend aggregates errors by code, frequency, and build version.

---

## Graceful Degradation

When non-critical features fail, the platform continues operating with reduced functionality:

| Failure | Degradation Response |
|---------|---------------------|
| News feed API down | Show cached headlines with "Data may be stale" banner |
| Indicator worker crash | Fall back to main-thread calculation with warning |
| IndexedDB unavailable | Use in-memory storage (data lost on refresh) |
| WebSocket disconnect | Switch to polling mode (1s interval) for price data |
| Chart library error | Render data table fallback instead of chart |

```tsx
function ChartPanel({ symbol }: { symbol: string }) {
  return (
    <ErrorBoundary fallback={<DataTableFallback symbol={symbol} />}>
      <Suspense fallback={<ChartSkeleton />}>
        <CandlestickChart symbol={symbol} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## User-Facing Error Messages

Error messages follow a consistent pattern — what went wrong, and what the user can do:

```typescript
const USER_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and try again.',
  ORDER_REJECTED: 'Your order was rejected. Please verify the quantity and price.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  MARKET_CLOSED: 'Market is currently closed. Orders will be queued for the next session.',
  INSUFFICIENT_FUNDS: 'Insufficient buying power for this order.',
  DATA_UNAVAILABLE: 'Market data is temporarily unavailable. Retrying automatically.',
};
```

Technical details (stack traces, HTTP status codes) are logged but never shown to the user.

---

## Error Codes System

Every error produced by the platform carries a structured code for tracking and aggregation:

| Code Prefix | Domain | Examples |
|-------------|--------|---------|
| `AUTH_*` | Authentication | `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS` |
| `ORDER_*` | Trading | `ORDER_REJECTED`, `ORDER_INSUFFICIENT_FUNDS` |
| `WS_*` | WebSocket | `WS_DISCONNECTED`, `WS_AUTH_FAILED` |
| `DATA_*` | Market Data | `DATA_UNAVAILABLE`, `DATA_STALE` |
| `CALC_*` | Computation | `CALC_WORKER_CRASH`, `CALC_TIMEOUT` |
| `STORE_*` | State | `STORE_PERSISTENCE_FAILED`, `STORE_HYDRATION_ERROR` |

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
    public recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

The `recoverable` flag determines whether the UI shows a "Retry" button or a "Contact support" link.
