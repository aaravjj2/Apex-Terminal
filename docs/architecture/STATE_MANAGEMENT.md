# State Management

> Zustand store architecture, patterns, and conventions used across the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [Store Inventory](#store-inventory)
- [Store Design Patterns](#store-design-patterns)
- [Middleware Stack](#middleware-stack)
- [Selector Patterns](#selector-patterns)
- [Cross-Store Communication](#cross-store-communication)
- [Persistence Strategy](#persistence-strategy)
- [Performance Optimization](#performance-optimization)
- [Testing Stores](#testing-stores)

---

## Overview

Apex Terminal uses **Zustand** as its primary state management solution, chosen for its minimal API surface, excellent TypeScript support, and lack of boilerplate compared to Redux. The platform manages 37 stores total — 11 core stores and 26 UI2 stores — each responsible for a specific domain.

State is organized by domain rather than by type (no separate "actions" and "reducers"). Each store contains its state, computed values, and mutation functions in a single unit.

---

## Store Inventory

### Core Stores (`stores/`)

| Store | Key State | Purpose |
|-------|-----------|---------|
| `alertStore` | alerts, triggers, conditions, sounds | Alert creation, management, and notification |
| `backtestStore` | runs, strategies, optimization, bookmarks | Backtest execution and results |
| `chartStore` | chartType, scale, indicators, layout, replay | Chart configuration and interaction state |
| `newsStore` | articles, categories, sentiment, alerts | News feed and sentiment analysis |
| `orderStore` | tickets, validation, bracket/OCO config | Order entry and management |
| `positionStore` | positions, pnl, stopLoss, takeProfit | Position tracking and P&L |
| `screeningStore` | screens, criteria, scanner config | Stock screening and scanning |
| `settingsStore` | theme, chartDefaults, keyboardShortcuts | User preferences and configuration |
| `watchlistStore` | watchlists, quotes, columns | Watchlist management and real-time quotes |
| `workspaceStore` | workspaces, layouts, widgets | Workspace layout persistence |

### UI2 Stores (`ui2/stores/`)

| Store | Purpose |
|-------|---------|
| `agentStore` | AI agent state and conversations |
| `automationStore` / `automationV2Store` | Workflow automation pipelines |
| `autopilotStore` / `autopilot2Store` / `autopilotV2Store` | Auto-trading state |
| `backtestDepthStore` / `backtestEngineStore` | Extended backtest state |
| `commandRegistry` | Command palette registry |
| `contextBusStore` | Cross-module context sharing |
| `exportStore` | Data export state |
| `insightsStore` | AI-generated insights |
| `orderTicketStore` | Extended order ticket state |
| `platformHealthStore` | System health monitoring |
| `scenarioStore` | Risk scenario management |
| `searchStore` / `searchDepthStore` | Search state and results |
| `streamSimulator` | Market data simulation |
| `telemetryStore` | Usage telemetry |
| `tradingStore` | Extended trading state |
| `workspaceStore` | Extended workspace state |

---

## Store Design Patterns

### Standard Store Template

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface ChartState {
  chartType: 'candlestick' | 'line' | 'area';
  indicators: Indicator[];
  timeframe: string;
  symbol: string;

  setChartType: (type: ChartState['chartType']) => void;
  addIndicator: (indicator: Indicator) => void;
  removeIndicator: (id: string) => void;
  setTimeframe: (tf: string) => void;
}

export const useChartStore = create<ChartState>()(
  devtools(
    immer((set) => ({
      chartType: 'candlestick',
      indicators: [],
      timeframe: '1D',
      symbol: 'AAPL',

      setChartType: (type) =>
        set((state) => {
          state.chartType = type;
        }),

      addIndicator: (indicator) =>
        set((state) => {
          state.indicators.push(indicator);
        }),

      removeIndicator: (id) =>
        set((state) => {
          state.indicators = state.indicators.filter((i) => i.id !== id);
        }),

      setTimeframe: (tf) =>
        set((state) => {
          state.timeframe = tf;
        }),
    })),
    { name: 'chart-store' }
  )
);
```

### Computed Values

Derived state is computed via selectors rather than stored:

```typescript
// In the store — only raw state
interface PortfolioState {
  holdings: Holding[];
  prices: Record<string, number>;
}

// Outside the store — derived selectors
export const selectTotalValue = (state: PortfolioState) =>
  state.holdings.reduce(
    (sum, h) => sum + h.quantity * (state.prices[h.symbol] ?? 0),
    0
  );

export const selectPnL = (state: PortfolioState) =>
  state.holdings.reduce(
    (sum, h) =>
      sum + h.quantity * ((state.prices[h.symbol] ?? 0) - h.avgCost),
    0
  );
```

---

## Middleware Stack

Stores compose multiple middleware layers:

```typescript
create<State>()(
  devtools(           // Redux DevTools integration (dev only)
    persist(          // LocalStorage/IndexedDB persistence
      immer(          // Immutable updates with mutable syntax
        (set, get) => ({
          // ... store definition
        })
      ),
      { name: 'store-key', storage: createJSONStorage(() => localStorage) }
    ),
    { name: 'store-name' }
  )
);
```

| Middleware | Purpose | Used In |
|-----------|---------|---------|
| `immer` | Mutable-style immutable updates | All stores |
| `devtools` | Redux DevTools inspection | All stores (dev) |
| `persist` | State persistence | settings, workspace, watchlist |
| `subscribeWithSelector` | Fine-grained subscriptions | Stores needing external listeners |

---

## Selector Patterns

### Basic Selectors

```typescript
// Single field — component re-renders only when chartType changes
const chartType = useChartStore((s) => s.chartType);

// Multiple fields with shallow equality
import { shallow } from 'zustand/shallow';
const { symbol, timeframe } = useChartStore(
  (s) => ({ symbol: s.symbol, timeframe: s.timeframe }),
  shallow
);
```

### Memoized Selectors

For expensive derivations, memoize the selector:

```typescript
import { useMemo } from 'react';

function PortfolioSummary() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);

  const metrics = useMemo(
    () => computePortfolioMetrics(holdings, prices),
    [holdings, prices]
  );

  return <MetricsGrid data={metrics} />;
}
```

---

## Cross-Store Communication

### Direct Store Access

Stores can read from other stores without React:

```typescript
// Inside orderStore action
submitOrder: (order) => set((state) => {
  const symbol = useChartStore.getState().symbol;
  const position = usePositionStore.getState().positions[symbol];
  // ... validate and submit
});
```

### Event Bus Pattern

Decoupled communication for loosely-related modules:

```typescript
import { eventBus } from '@/lib/utils/eventBus';

// Publisher (in orderStore)
eventBus.emit('order:filled', { orderId, symbol, price, quantity });

// Subscriber (in positionStore initialization)
eventBus.on('order:filled', (fill) => {
  usePositionStore.getState().updatePosition(fill);
});
```

### Store Subscriptions

React-external subscriptions for side effects:

```typescript
useChartStore.subscribe(
  (state) => state.symbol,
  (symbol) => {
    useMarketDataStore.getState().subscribe(symbol);
    useNewsStore.getState().fetchNews(symbol);
  }
);
```

---

## Persistence Strategy

| Store | Storage | Scope |
|-------|---------|-------|
| `settingsStore` | localStorage | Theme, defaults, shortcuts |
| `workspaceStore` | IndexedDB | Layouts, widget positions |
| `watchlistStore` | localStorage | Watchlist symbols, columns |
| `chartStore` | localStorage | Chart preferences (partial) |
| `backtestStore` | IndexedDB | Backtest results (large data) |

### IndexedDB for Large Data

```typescript
import { createJSONStorage } from 'zustand/middleware';

const indexedDBStorage = createJSONStorage(() => ({
  getItem: async (name) => {
    const db = await openDB('apex-terminal', 1);
    return db.get('stores', name);
  },
  setItem: async (name, value) => {
    const db = await openDB('apex-terminal', 1);
    await db.put('stores', value, name);
  },
  removeItem: async (name) => {
    const db = await openDB('apex-terminal', 1);
    await db.delete('stores', name);
  },
}));
```

---

## Performance Optimization

1. **Granular selectors** — Select only the fields your component needs
2. **Shallow equality** — Use `shallow` comparator for object/array selectors
3. **Transient updates** — For high-frequency data (price ticks), use `useRef` + `requestAnimationFrame` instead of store updates
4. **Batched updates** — Group related mutations in a single `set()` call
5. **Computed outside render** — Heavy derivations in `useMemo`, not in store

```typescript
// BAD: Re-renders on any store change
const store = useChartStore();

// GOOD: Re-renders only when indicators change
const indicators = useChartStore((s) => s.indicators);
```

---

## Testing Stores

Stores are tested in isolation using Vitest:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useChartStore } from '@/stores/chartStore';

describe('chartStore', () => {
  beforeEach(() => {
    useChartStore.setState({
      chartType: 'candlestick',
      indicators: [],
      timeframe: '1D',
    });
  });

  it('should add an indicator', () => {
    const indicator = { id: '1', type: 'SMA', params: { period: 20 } };
    useChartStore.getState().addIndicator(indicator);
    expect(useChartStore.getState().indicators).toHaveLength(1);
  });

  it('should remove an indicator', () => {
    useChartStore.setState({ indicators: [{ id: '1', type: 'SMA' }] });
    useChartStore.getState().removeIndicator('1');
    expect(useChartStore.getState().indicators).toHaveLength(0);
  });
});
```
