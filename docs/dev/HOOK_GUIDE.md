# Custom Hook Guide

Patterns and conventions for creating hooks in Apex Terminal.

## Table of Contents

- [Hook Inventory](#hook-inventory)
- [Naming and Parameters](#naming-and-parameters)
- [Return Value Patterns](#return-value-patterns)
- [Cleanup and Teardown](#cleanup-and-teardown)
- [Dependency Management](#dependency-management)
- [Common Patterns](#common-patterns)
- [Testing Hooks](#testing-hooks)
- [Do's and Don'ts](#dos-and-donts)

## Hook Inventory

The project has 25 hooks in `frontend/src/hooks/`:

| Hook                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `useChart`          | Chart instance lifecycle, indicators, zoom |
| `useChartData`      | Fetching and caching OHLCV data            |
| `useMarketData`     | Real-time quotes, snapshots                |
| `useWebSocket`      | WS connection, subscriptions, heartbeat    |
| `useBacktest`       | Strategy execution, results                |
| `useWorker`         | Web Worker messaging and pool management   |
| `useHotkeys`        | Keyboard shortcut registration             |
| `useDebounce`       | Debounced value or callback                |
| `useAlerts`         | Price/indicator alert CRUD                 |
| `useOrderExecution` | Order submission and status tracking       |
| `usePortfolio`      | Holdings, P&L, allocation                  |
| `useScreener`       | Screener filters and results               |
| `useNews`           | News feed subscription                     |
| `useTheme`          | Theme switching and CSS property access     |
| `useDragDrop`       | Drag-and-drop panel reordering             |
| `useClipboard`      | Copy/paste utilities                       |
| `useMediaQuery`     | Responsive breakpoint detection            |
| `useAnimationFrame` | requestAnimationFrame loop                 |
| `useInfiniteScroll` | Paginated list loading                     |
| `useIndexedDB`      | IndexedDB read/write for offline data      |
| `useVirtualList`    | Virtualized list rendering                 |
| `useResizeObserver` | Element size tracking                      |
| `useLocalStorage`   | Typed localStorage read/write              |
| `useEventBus`       | Cross-component event pub/sub              |
| `useKeyboard`       | Raw keyboard event handling                |

## Naming and Parameters

- Always prefix with `use`.
- Name describes the capability, not the implementation: `useDebounce` not `useSetTimeout`.
- Accept an options object for hooks with more than two parameters:

```typescript
// Good — options object
export function useWebSocket(options: UseWebSocketOptions) { ... }

// Good — simple hooks with 1-2 params can use positional args
export function useDebounce<T>(value: T, delayMs: number): T { ... }
```

- Define the options interface in the same file, exported for consumers:

```typescript
export interface UseWorkerOptions {
  maxPoolSize?: number;
  timeout?: number;
  onMessage?: (response: WorkerResponse) => void;
  onError?: (error: string) => void;
}
```

## Return Value Patterns

**Object return** for hooks with many values (named access, no positional mistakes):

```typescript
export function useWebSocket(options: UseWebSocketOptions) {
  // ...
  return { wsState, send, subscribe, disconnect, reconnectNow };
}
```

**Tuple return** for simple stateful hooks (mirrors `useState`):

```typescript
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  // ...
  return debounced;
}
```

**Include status fields** for async hooks:

```typescript
return {
  data,
  isLoading,
  error,
  refetch,
};
```

## Cleanup and Teardown

Every hook that creates subscriptions, timers, or workers **must** clean up:

```typescript
export function useAnimationFrame(callback: (dt: number) => void) {
  const rafRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  useEffect(() => {
    function loop(time: number) {
      if (prevTimeRef.current) callback(time - prevTimeRef.current);
      prevTimeRef.current = time;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [callback]);
}
```

For WebSocket hooks, close the connection and clear reconnect timers:

```typescript
useEffect(() => {
  connect();
  return () => {
    unmountedRef.current = true;
    stopHeartbeat();
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close(1000, 'Component unmounted');
  };
}, [url]);
```

## Dependency Management

- **Stable callbacks**: wrap event handlers in `useCallback` so consumers can safely include them in dependency arrays.
- **Ref for latest value**: when a callback needs to reference changing values without re-subscribing:

```typescript
const callbackRef = useRef(onMessage);
useEffect(() => { callbackRef.current = onMessage; }, [onMessage]);

// Inside the effect, use callbackRef.current instead of onMessage
```

- Don't list the entire options object as a dependency. Destructure and depend on individual values.

## Common Patterns

### Debounced value

```typescript
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

### Worker hook (promise-based messaging)

```typescript
const { postMessage, status, isReady } = useWorker(
  () => new Worker(new URL('@/workers/indicatorWorker.ts', import.meta.url), { type: 'module' }),
  { timeout: 15000 },
);

const result = await postMessage('calculate', { indicators, bars });
```

### Event bus hook

```typescript
const { emit, on } = useEventBus();

useEffect(() => {
  return on('symbol:changed', (symbol: string) => {
    console.log('Symbol changed to', symbol);
  });
}, [on]);
```

## Testing Hooks

Use `@testing-library/react`'s `renderHook`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('b');
  });
});
```

For hooks that use Web Workers, mock the Worker constructor:

```typescript
vi.mock('@/workers/indicatorWorker.ts', () => ({
  default: class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    postMessage(data: any) {
      setTimeout(() => this.onmessage?.({ data: { id: data.id, payload: [1, 2, 3] } } as any), 0);
    }
    terminate() {}
  },
}));
```

## Do's and Don'ts

**Do:**
- Return cleanup functions from every `useEffect` that creates side effects
- Document the hook's purpose and return type with JSDoc
- Use `useRef` for values that shouldn't trigger re-renders (timers, counters, previous values)
- Export the options interface so consumers can compose it

**Don't:**
- Call hooks conditionally — React's rules of hooks forbid it
- Use `useEffect` as a state synchronization mechanism — derive state instead
- Return unstable object references — memoize with `useMemo` or return the pieces individually
- Put business logic in hooks that belongs in lib/ — hooks connect UI to logic, they don't implement it
- Create hooks that only wrap a single `useState` — just use `useState` directly
