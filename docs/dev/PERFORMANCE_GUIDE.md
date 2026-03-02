# Performance Optimization Guide

Keeping Apex Terminal fast with large datasets and real-time updates.

## Table of Contents

- [Profiling Tools](#profiling-tools)
- [Identifying Unnecessary Re-renders](#identifying-unnecessary-re-renders)
- [Memoization Patterns](#memoization-patterns)
- [Virtual Lists](#virtual-lists)
- [Web Worker Offloading](#web-worker-offloading)
- [Bundle Analysis](#bundle-analysis)
- [Chart Rendering Performance](#chart-rendering-performance)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Profiling Tools

### React DevTools Profiler

1. Open React DevTools → Profiler tab.
2. Click record, interact with the UI, stop recording.
3. Flamegraph shows component render times. Look for:
   - Components rendering when their props haven't changed.
   - Long renders (> 16ms blocks the frame).

### Chrome Performance tab

1. Open DevTools → Performance → Record.
2. Interact with the chart (zoom, pan, indicator toggle).
3. Look for long tasks (red corners) and JS execution spikes.

### `why-did-you-render` (dev only)

Enable in `main.tsx` behind a flag:

```typescript
if (import.meta.env.DEV) {
  const { default: wdyr } = await import('@welldone-software/why-did-you-render');
  wdyr(React, { trackAllPureComponents: true });
}
```

## Identifying Unnecessary Re-renders

The most common causes in Apex Terminal:

1. **Subscribing to the full store** instead of a narrow selector:

```typescript
// BAD — re-renders on any store change
const store = useChartStore();

// GOOD — re-renders only when activeChartId changes
const activeId = useChartStore((s) => s.activeChartId);
```

2. **Creating new objects/arrays in render**:

```typescript
// BAD — new array reference every render
const items = charts.filter((c) => c.visible);

// GOOD — memoize derived data
const items = useMemo(() => charts.filter((c) => c.visible), [charts]);
```

3. **Inline callback props**:

```typescript
// BAD — new function each render
<Button onClick={() => handleClick(id)} />

// GOOD — stable reference
const handleClick = useCallback((id: string) => { /* ... */ }, []);
```

## Memoization Patterns

### `React.memo` — prevent re-render when props are unchanged

```typescript
export const PriceCell = memo(function PriceCell({ value, prevValue }: PriceCellProps) {
  const color = value >= prevValue ? 'text-green-400' : 'text-red-400';
  return <span className={color}>{value.toFixed(2)}</span>;
});
```

Use `memo` for components that:
- Render inside lists (watchlist rows, order book levels).
- Receive stable primitive props.
- Are expensive to render.

### `useMemo` — cache computed values

```typescript
const sortedPositions = useMemo(
  () => positions.sort((a, b) => b.pnl - a.pnl),
  [positions],
);
```

### `useCallback` — cache function references

```typescript
const handleTimeframeChange = useCallback((tf: Timeframe) => {
  updateChartTimeframe(chartId, tf);
}, [chartId, updateChartTimeframe]);
```

Only wrap with `useCallback` when the function is passed as a prop to a `memo`'d child or used in a dependency array.

## Virtual Lists

For long lists (watchlists, screener results, trade history), use `useVirtualList`:

```typescript
import { useVirtualList } from '@/hooks/useVirtualList';

function TradeHistory({ trades }: { trades: Trade[] }) {
  const { containerRef, virtualItems, totalHeight } = useVirtualList({
    count: trades.length,
    estimateSize: () => 36,
    overscan: 10,
  });

  return (
    <div ref={containerRef} className="overflow-auto h-full">
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map((vi) => (
          <div key={vi.index} style={{ position: 'absolute', top: vi.start, height: vi.size, width: '100%' }}>
            <TradeRow trade={trades[vi.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

This renders only visible rows + overscan, keeping DOM node count low even for 10K+ items.

## Web Worker Offloading

Heavy computations must run off the main thread. The project has 5 workers:

| Worker                | Responsibility                          |
| --------------------- | --------------------------------------- |
| `indicatorWorker`     | SMA, EMA, RSI, MACD, Bollinger, etc.   |
| `backtestWorker`      | Strategy simulation over historical data|
| `screeningWorker`     | Multi-criteria stock screening          |
| `optimizationWorker`  | Parameter optimization (grid/genetic)   |
| `dataWorker`          | Data transformation and aggregation     |

Use `useWorker` for single-worker tasks:

```typescript
const { postMessage, isReady } = useWorker(
  () => new Worker(new URL('@/workers/indicatorWorker.ts', import.meta.url), { type: 'module' }),
);

const result = await postMessage('batch', { indicators, bars });
```

Use `useWorkerPool` for parallel tasks:

```typescript
const pool = useWorkerPool(
  () => new Worker(new URL('@/workers/screeningWorker.ts', import.meta.url), { type: 'module' }),
  { poolSize: 4, timeout: 60000 },
);

const results = await pool.executeAll(tasks.map((t) => ({ type: 'screen', payload: t })));
```

## Bundle Analysis

Check bundle size after adding dependencies:

```bash
npm run build
npx vite-bundle-visualizer
```

Guidelines:
- Main chunk should be < 250KB gzipped.
- Lazy-load pages and heavy components with `React.lazy()`.
- Use dynamic imports for rarely-used features (options pricing, ML models).

```typescript
const OptionsChain = lazy(() => import('@/components/trading/OptionsChain'));
```

## Chart Rendering Performance

- Use `requestAnimationFrame` for continuous chart updates (crosshair, real-time bars).
- Batch lightweight-charts API calls — don't call `series.update()` for every tick; throttle to 60fps.
- Offload indicator recalculation to `indicatorWorker` to avoid blocking the render loop.
- Keep canvas layer count minimal — one main layer, one overlay layer, one crosshair layer.

## Conventions

- Profile before optimizing — don't memo everything speculatively.
- Add a `// perf:` comment when memoization solves a measured problem.
- Performance-critical paths (chart render, order book update) should be tested with 10K+ data points.

## Do's and Don'ts

**Do:**
- Use narrow Zustand selectors that return primitives or stable references
- Virtualize any list that can exceed ~50 items
- Offload computation > 5ms to a Web Worker
- Lazy-load route-level components
- Measure before and after when claiming a perf improvement

**Don't:**
- Wrap every component in `memo` — it adds overhead for components that already re-render cheaply
- Use `JSON.stringify` for deep equality checks — it's slower than the re-render it prevents
- Store derived data in state — compute it with `useMemo` from source data
- Create closures in render that capture large objects
- Block the main thread with synchronous loops over 10K+ items
