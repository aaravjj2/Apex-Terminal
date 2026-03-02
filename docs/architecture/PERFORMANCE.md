# Performance Optimization

> Strategies for keeping Apex Terminal responsive under heavy real-time data loads, complex calculations, and large DOM surfaces.

---

## Table of Contents

- [Overview](#overview)
- [Web Worker Offloading](#web-worker-offloading)
- [Virtual Rendering](#virtual-rendering)
- [Canvas Rendering for Charts](#canvas-rendering-for-charts)
- [React 19 Concurrent Features](#react-19-concurrent-features)
- [Code Splitting & Lazy Routes](#code-splitting--lazy-routes)
- [Memoization Patterns](#memoization-patterns)
- [Debouncing Real-Time Updates](#debouncing-real-time-updates)
- [Bundle Optimization with Vite](#bundle-optimization-with-vite)
- [requestAnimationFrame for Price Ticks](#requestanimationframe-for-price-ticks)

---

## Overview

Apex Terminal processes thousands of price ticks per second, renders multi-thousand-candle charts, and runs computationally heavy backtests and indicator calculations — all in the browser. Performance is achieved through a layered strategy: offload CPU work to Web Workers, minimize DOM nodes with virtualization, render charts on Canvas, and use React 19 concurrent features to keep the main thread interactive.

---

## Web Worker Offloading

Five dedicated workers prevent indicator math, backtests, and screening from blocking the UI thread:

| Worker | Responsibility | Typical Duration |
|--------|---------------|-----------------|
| `indicatorWorker` | SMA, EMA, RSI, MACD, Bollinger, ATR, Stochastic, OBV, VWAP | 5–50ms |
| `backtestWorker` | Walk-forward analysis, Monte Carlo simulation, trade-by-trade P&L | 100ms–10s |
| `screeningWorker` | Multi-criteria stock filtering across full universe | 50–500ms |
| `optimizationWorker` | Parameter sweeps, genetic optimization, grid search | 1–60s |
| `dataWorker` | CSV parsing, time-series aggregation, data normalization | 10–100ms |

Workers communicate via a structured message protocol with `taskId` tracking and cancellation support:

```typescript
// Sending work to the indicator worker
workerRef.current.postMessage({
  type: 'batch',
  taskId: crypto.randomUUID(),
  indicators: [
    { type: 'sma', params: { period: 20 } },
    { type: 'rsi', params: { period: 14 } },
  ],
  bars: ohlcvData,
});

// Worker reports progress for long-running batch jobs
workerRef.current.onmessage = (e) => {
  if (e.data.type === 'progress') updateProgressBar(e.data.progress);
  if (e.data.type === 'result') applyIndicatorResults(e.data.data);
};
```

The `useWorker` hook manages worker lifecycle, including instantiation, message routing, and cleanup on component unmount.

---

## Virtual Rendering

Watchlists, screening results, and order blotters can contain thousands of rows. Only visible rows are rendered using the `useVirtualList` hook:

```typescript
function ScreenerResults({ results }: { results: ScreenerRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { virtualItems, totalSize } = useVirtualList({
    count: results.length,
    estimateSize: () => 36,
    overscan: 8,
    parentRef,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: totalSize, position: 'relative' }}>
        {virtualItems.map((item) => (
          <ScreenerRow
            key={item.key}
            style={{ transform: `translateY(${item.start}px)` }}
            data={results[item.index]}
          />
        ))}
      </div>
    </div>
  );
}
```

This keeps the DOM under 100 nodes regardless of dataset size. The `overscan` parameter pre-renders rows above and below the viewport for smooth scrolling.

---

## Canvas Rendering for Charts

All price charts render through lightweight-charts using the Canvas 2D API, avoiding DOM overhead entirely:

- **Main canvas** — Candles, lines, area fills, volume histogram
- **Overlay canvas** — Drawing tools (trendlines, Fibonacci, channels) on a separate layer
- **Crosshair canvas** — Interactive crosshair and tooltip rendering

The `ChartEngine` core manages canvas lifecycle, coordinate-to-price scale mapping, and double-buffered rendering for tear-free updates during live streaming.

---

## React 19 Concurrent Features

### Transitions for Non-Urgent Updates

Heavy filtering and sorting operations are wrapped in `useTransition` so the UI remains responsive:

```typescript
function OptionsChain({ chain }: { chain: OptionContract[] }) {
  const [filtered, setFiltered] = useState(chain);
  const [isPending, startTransition] = useTransition();

  const handleFilter = (criteria: FilterCriteria) => {
    startTransition(() => {
      setFiltered(applyFilters(chain, criteria));
    });
  };

  return (
    <div className={isPending ? 'opacity-70' : ''}>
      <FilterBar onChange={handleFilter} />
      <OptionsGrid data={filtered} />
    </div>
  );
}
```

### Suspense Boundaries

Every lazy-loaded route is wrapped in a `<Suspense>` boundary with a `<PageSkeleton />` fallback, preventing blank screens during chunk loads.

### Automatic Batching

React 19 batches state updates from promises, timeouts, and event handlers automatically — critical for WebSocket handlers that may trigger multiple store updates per message.

---

## Code Splitting & Lazy Routes

The 150+ routes are lazy-loaded, keeping the initial bundle under 200KB gzipped:

```typescript
const BloombergPage = lazy(() => import('./pages/BloombergPage'));
const RiskDashboard = lazy(() => import('./pages/RiskDashboard'));
const BacktestWorkspace = lazy(() => import('./pages/BacktestWorkspace'));
const CryptoAnalytics = lazy(() => import('./pages/CryptoAnalytics'));
```

Vite's `manualChunks` configuration groups vendor libraries into stable, cacheable chunks:

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'zustand', 'react-router-dom'],
        charts: ['lightweight-charts', 'recharts'],
      },
    },
  },
},
```

---

## Memoization Patterns

### Selector-Level Memoization

Zustand selectors prevent unnecessary re-renders by subscribing to specific fields:

```typescript
const indicators = useChartStore((s) => s.indicators);
const { symbol, timeframe } = useChartStore(
  (s) => ({ symbol: s.symbol, timeframe: s.timeframe }),
  shallow
);
```

### Computation Memoization

Expensive derived state is computed via `useMemo`:

```typescript
const portfolioMetrics = useMemo(
  () => computePortfolioMetrics(holdings, prices),
  [holdings, prices]
);
```

### Component Memoization

Heavy child components use `React.memo` with custom comparators for array/object props to prevent cascade re-renders in data-dense panels like the options chain grid.

---

## Debouncing Real-Time Updates

The `useDebounce` hook throttles rapid state changes from user input or streaming data:

```typescript
function SymbolSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (debouncedQuery) searchSymbols(debouncedQuery);
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

For WebSocket price updates, stores batch incoming ticks and flush at a capped interval (e.g., 100ms) to prevent render thrashing on high-frequency feeds.

---

## Bundle Optimization with Vite

| Technique | Implementation |
|-----------|---------------|
| Tree shaking | ESM imports ensure dead code is eliminated at build time |
| CSS purging | Tailwind v4 JIT removes unused utility classes |
| Asset hashing | Content-hash filenames enable aggressive CDN caching |
| Compression | `vite-plugin-compression` generates gzip/brotli assets |
| Source maps | External source maps in production — no bundle bloat |
| Dependency pre-bundling | Vite pre-bundles `node_modules` with esbuild for fast dev starts |

Build-time environment injection:

```bash
VITE_GIT_SHA=$(git rev-parse --short HEAD) vite build
```

This SHA appears in the UI footer and error reports for exact version tracing.

---

## requestAnimationFrame for Price Ticks

High-frequency price updates bypass React entirely and write to the DOM via `requestAnimationFrame`:

```typescript
function LivePrice({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pendingTick = useRef<PriceTick | null>(null);

  useEffect(() => {
    const unsub = wsClient.subscribe(`price:${symbol}`, (tick: PriceTick) => {
      pendingTick.current = tick;
    });

    let rafId: number;
    const render = () => {
      if (pendingTick.current && ref.current) {
        const tick = pendingTick.current;
        ref.current.textContent = tick.price.toFixed(2);
        ref.current.dataset.direction = tick.change >= 0 ? 'up' : 'down';
        pendingTick.current = null;
      }
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      unsub();
      cancelAnimationFrame(rafId);
    };
  }, [symbol]);

  return <span ref={ref} className="tabular-nums data-[direction=up]:text-green-400 data-[direction=down]:text-red-400" />;
}
```

This pattern coalesces multiple ticks into a single DOM write per frame, achieving smooth 60fps price displays even with 10+ subscriptions updating simultaneously.
