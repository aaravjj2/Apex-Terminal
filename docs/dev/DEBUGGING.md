# Debugging Guide

Tools and techniques for debugging Apex Terminal.

## Table of Contents

- [React DevTools](#react-devtools)
- [Zustand Devtools](#zustand-devtools)
- [Vite HMR Debugging](#vite-hmr-debugging)
- [WebSocket Message Inspection](#websocket-message-inspection)
- [Worker Debugging](#worker-debugging)
- [Playwright Trace Viewer](#playwright-trace-viewer)
- [Performance Profiling](#performance-profiling)
- [Common Debugging Workflows](#common-debugging-workflows)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## React DevTools

### Component inspection

1. Open React DevTools → Components tab.
2. Click any component to inspect its props, state, and hooks.
3. Use the search bar to find components by name (e.g., "ChartToolbar").

### Profiler for render analysis

1. Open React DevTools → Profiler tab.
2. Record, interact, stop.
3. Look for components that rendered but didn't need to (gray = skipped, colored = rendered).
4. Click a component to see why it rendered: "Props changed", "State changed", "Parent rendered".

### Highlight updates

Enable "Highlight updates when components render" in React DevTools settings. Flashing borders show which components re-render — useful for spotting unnecessary renders in the chart panel.

## Zustand Devtools

The stores integrate with Redux DevTools for time-travel debugging:

```typescript
import { devtools } from 'zustand/middleware';

export const useChartStore = create<State & Actions>()(
  devtools(
    immer((set) => ({ /* ... */ })),
    { name: 'ChartStore' },
  ),
);
```

In production builds, devtools are stripped. In development:

1. Install the Redux DevTools browser extension.
2. Open Redux DevTools panel.
3. Each store appears as a separate instance.
4. See action names, state diffs, and time-travel through state changes.

Inspect specific store state in the console:

```javascript
// In browser console
const chartState = useChartStore.getState();
console.log(chartState.charts);
console.log(chartState.activeChartId);
```

## Vite HMR Debugging

### HMR not working

If hot module replacement stops updating:

1. Check the terminal — look for HMR error messages.
2. Verify the file has a default export (for React components) or uses `import.meta.hot`.
3. Full page reload: sometimes stores or workers need a fresh start.

### HMR breaking state

When HMR replaces a module that initializes state, the store resets. To preserve state across HMR:

```typescript
if (import.meta.hot) {
  import.meta.hot.accept();
  // Don't re-initialize stores on HMR
}
```

### Debugging the dev server

```bash
# Verbose Vite output
npx vite --debug

# Check which files trigger rebuilds
npx vite --debug hmr
```

## WebSocket Message Inspection

### Chrome DevTools Network tab

1. Open DevTools → Network → WS filter.
2. Click the WebSocket connection.
3. Messages tab shows all sent/received frames with timestamps.
4. Click a message to see the full JSON payload.

### Logging WebSocket traffic

The `useWebSocket` hook accepts `onMessage` for tapping into the stream:

```typescript
const { wsState, send, subscribe } = useWebSocket({
  url: 'ws://localhost:8000/ws/market-data',
  onMessage: (msg) => {
    if (import.meta.env.DEV) {
      console.log('[WS]', msg.type, msg.symbol, msg.data);
    }
  },
});
```

### Simulating connection failures

In Chrome DevTools → Network tab, use the throttling dropdown to select "Offline" and observe reconnection behavior. Or use the Network Conditions panel to simulate latency.

## Worker Debugging

### Chrome DevTools Sources

1. Open DevTools → Sources.
2. Under the "Threads" panel (left sidebar), you'll see worker threads listed.
3. Click a worker thread to switch context — you can set breakpoints, inspect variables.

### Console logging from workers

Workers have access to `console.log`, which appears in the main browser console:

```typescript
// In indicatorWorker.ts
console.log('[IndicatorWorker] Processing batch of', msg.indicators.length, 'indicators');
```

### Debugging worker messages

Add a global message interceptor in development:

```typescript
if (import.meta.env.DEV) {
  const origPostMessage = worker.postMessage.bind(worker);
  worker.postMessage = (data: any) => {
    console.log('[Worker OUT]', data.type, data.taskId);
    origPostMessage(data);
  };

  const origOnMessage = worker.onmessage;
  worker.onmessage = (e: MessageEvent) => {
    console.log('[Worker IN]', e.data.type, e.data.taskId);
    origOnMessage?.call(worker, e);
  };
}
```

## Playwright Trace Viewer

When E2E tests fail, use Playwright's trace viewer for a full recording:

```bash
# Run tests with trace enabled
npx playwright test --trace on

# Open the trace viewer
npx playwright show-trace test-results/chart-basics-chromium/trace.zip
```

The trace viewer shows:
- Screenshots at each action.
- Network requests and responses.
- Console logs.
- DOM snapshots (you can inspect elements at any point in time).

For CI, configure traces on failure only:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

## Performance Profiling

### React Profiler API

Wrap a subtree to measure render performance programmatically:

```typescript
import { Profiler } from 'react';

function onRender(id: string, phase: string, actualDuration: number) {
  if (actualDuration > 16) {
    console.warn(`[Perf] ${id} ${phase} took ${actualDuration.toFixed(1)}ms`);
  }
}

<Profiler id="ChartPanel" onRender={onRender}>
  <ChartPanel />
</Profiler>
```

### Chrome Performance tab

1. Record while interacting with the chart (zoom, pan, indicator toggle).
2. Look for: long tasks (> 50ms), layout thrashing, forced reflows.
3. The bottom-up view shows which functions consumed the most time.

### Memory profiling

1. DevTools → Memory → Take heap snapshot.
2. Look for detached DOM trees (memory leaks from unmounted components).
3. Compare snapshots before and after switching chart symbols to find leaks.

## Common Debugging Workflows

### "The chart isn't updating"

1. Check `useChartStore.getState().activeChartId` — is a chart active?
2. Inspect the WebSocket in Network tab — are messages arriving?
3. Check the indicatorWorker in Sources → Threads — is it processing?
4. Look at React DevTools — is the ChartPanel component receiving new props?

### "An indicator shows wrong values"

1. Open `lib/indicators/` and find the implementation.
2. Write a unit test with known input/output values.
3. Compare against TradingView or Bloomberg for the same data.
4. Check the worker dispatch — is the correct function being called?

### "Store state seems stale"

1. Open Redux DevTools — check if the action was dispatched.
2. Verify the selector is narrow enough (not subscribing to unrelated state).
3. Check if the component is wrapped in `memo` and the selector returns the same reference.
4. Log `useChartStore.subscribe((s) => console.log('state changed', s))` temporarily.

### "E2E test is flaky"

1. Run with trace: `npx playwright test --trace on <test-file>`.
2. Check if the test waits for the right condition (`waitForSelector`, `expect(...).toBeVisible()`).
3. Look for race conditions — does the test assume data loads instantly?
4. Add explicit waits for network requests: `page.waitForResponse('**/api/...')`.

## Conventions

- Use `console.warn` and `console.error` for issues that should be noticed — `console.log` for informational messages in dev only.
- Gate verbose logging behind `import.meta.env.DEV`.
- Remove all debugging code before merging to `main`.
- Document the debugging steps you followed in PR descriptions for tricky bugs.

## Do's and Don'ts

**Do:**
- Use React DevTools Profiler before guessing at performance problems
- Inspect WebSocket frames in the Network tab for real-time data issues
- Use Playwright trace viewer for E2E failures — it's faster than re-running
- Check worker threads in Sources → Threads when indicator computation fails
- Use Redux DevTools for time-travel debugging of store state

**Don't:**
- Leave `console.log` statements in production code
- Debug by adding `alert()` calls — use breakpoints instead
- Ignore TypeScript errors during debugging — they often point to the real bug
- Skip the Network tab when debugging API issues — check status codes and response bodies
- Modify production builds to debug — reproduce issues in the dev environment
