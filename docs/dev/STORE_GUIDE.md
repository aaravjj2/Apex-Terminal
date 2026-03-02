# Zustand Store Guide

Creating and maintaining Zustand stores with Immer middleware in Apex Terminal.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Store Template](#store-template)
- [State and Action Separation](#state-and-action-separation)
- [Selector Patterns](#selector-patterns)
- [Cross-Store Communication](#cross-store-communication)
- [Persistence](#persistence)
- [Testing Stores](#testing-stores)
- [Do's and Don'ts](#dos-and-donts)

## Architecture Overview

Apex Terminal has 11 Zustand stores, each owning a distinct domain:

| Store              | Domain                                      |
| ------------------ | ------------------------------------------- |
| `chartStore`       | Chart instances, indicators, drawings, layout |
| `orderStore`       | Active orders, order entry state             |
| `positionStore`    | Open positions, P&L tracking                 |
| `watchlistStore`   | Watchlists, symbol groups                    |
| `alertStore`       | Price/indicator alerts                       |
| `backtestStore`    | Strategy runs, optimization results          |
| `screeningStore`   | Screener filters, results                    |
| `newsStore`        | News feed, sentiment data                    |
| `settingsStore`    | User preferences, theme, layout persistence  |
| `workspaceStore`   | Panel layout, saved workspaces               |

All stores use **Zustand + Immer** for immutable updates with mutable syntax.

## Store Template

Use this template when creating a new store:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────

interface ExampleItem {
  id: string;
  name: string;
  value: number;
}

interface ExampleStoreState {
  items: Record<string, ExampleItem>;
  activeItemId: string | null;
  isLoading: boolean;
}

interface ExampleStoreActions {
  addItem: (item: ExampleItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ExampleItem>) => void;
  setActiveItem: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ─── Store ──────────────────────────────────────────────────

export const useExampleStore = create<ExampleStoreState & ExampleStoreActions>()(
  immer((set) => ({
    // State
    items: {},
    activeItemId: null,
    isLoading: false,

    // Actions
    addItem: (item) => {
      set((s) => {
        s.items[item.id] = item;
      });
    },

    removeItem: (id) => {
      set((s) => {
        delete s.items[id];
        if (s.activeItemId === id) s.activeItemId = null;
      });
    },

    updateItem: (id, updates) => {
      set((s) => {
        const item = s.items[id];
        if (item) Object.assign(item, updates);
      });
    },

    setActiveItem: (id) => {
      set((s) => { s.activeItemId = id; });
    },

    setLoading: (loading) => {
      set((s) => { s.isLoading = loading; });
    },
  })),
);

// ─── Selectors ──────────────────────────────────────────────

export const selectActiveItem = (s: ExampleStoreState) =>
  s.activeItemId ? s.items[s.activeItemId] ?? null : null;

export const selectItemCount = (s: ExampleStoreState) =>
  Object.keys(s.items).length;

export const selectItemById = (id: string) => (s: ExampleStoreState) =>
  s.items[id] ?? null;
```

## State and Action Separation

Define state and actions as separate interfaces, then merge them in `create`:

```typescript
interface ChartStoreState {
  charts: Record<string, ChartInstance>;
  activeChartId: string | null;
  layout: LayoutConfig;
}

interface ChartStoreActions {
  addChart: (symbol?: string) => string | null;
  removeChart: (chartId: string) => void;
  setActiveChart: (chartId: string) => void;
}

export const useChartStore = create<ChartStoreState & ChartStoreActions>()(
  immer((set, get) => ({
    // ... state + actions
  })),
);
```

Use `get()` when an action needs to read current state before writing:

```typescript
addChart: (symbol) => {
  const state = get();
  if (state.chartOrder.length >= state.maxCharts) return null;
  const id = `chart_${Date.now()}`;
  set((s) => {
    s.charts[id] = createChartInstance(id, symbol);
    s.chartOrder.push(id);
    s.activeChartId = id;
  });
  return id;
},
```

## Selector Patterns

**Simple selector** — inline in the component:

```typescript
const isLoading = useExampleStore((s) => s.isLoading);
```

**Parameterized selector** — factory function exported from the store file:

```typescript
export const selectChart = (chartId: string) => (s: ChartStoreState) =>
  s.charts[chartId] ?? null;

// Usage
const chart = useChartStore(selectChart('chart_1'));
```

**Derived selector** — computes a value from state:

```typescript
export const selectChartsInOrder = (s: ChartStoreState) =>
  s.chartOrder.map((id) => s.charts[id]).filter(Boolean);
```

**Avoid creating new objects/arrays inside selectors** without memoization — it causes unnecessary re-renders. For computed arrays, use `useMemo` at the component level:

```typescript
const chartOrder = useChartStore((s) => s.chartOrder);
const charts = useChartStore((s) => s.charts);
const orderedCharts = useMemo(
  () => chartOrder.map((id) => charts[id]).filter(Boolean),
  [chartOrder, charts],
);
```

## Cross-Store Communication

Stores can read each other via `getState()`:

```typescript
// Inside orderStore action
submitOrder: (order) => {
  const { activeChartId } = useChartStore.getState();
  const symbol = activeChartId
    ? useChartStore.getState().charts[activeChartId]?.symbol
    : order.symbol;
  // ... process order
},
```

For reactive cross-store subscriptions, use `subscribe` in a top-level effect:

```typescript
// In an initialization module or App component
useEffect(() => {
  return useChartStore.subscribe(
    (s) => s.activeChartId,
    (activeId) => {
      if (activeId) {
        const symbol = useChartStore.getState().charts[activeId]?.symbol;
        if (symbol) useWatchlistStore.getState().setActiveSymbol(symbol);
      }
    },
  );
}, []);
```

## Persistence

For stores that need persistence (settings, watchlists), use the `persist` middleware:

```typescript
import { persist } from 'zustand/middleware';

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    immer((set) => ({
      theme: 'dark',
      setTheme: (theme) => set((s) => { s.theme = theme; }),
    })),
    {
      name: 'apex-settings',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
```

Use `partialize` to persist only the subset of state that matters. Never persist loading flags, error states, or transient UI state.

## Testing Stores

Reset store state before each test and test actions + selectors independently:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useExampleStore, selectActiveItem } from './exampleStore';

beforeEach(() => {
  useExampleStore.setState({
    items: {},
    activeItemId: null,
    isLoading: false,
  });
});

describe('exampleStore', () => {
  it('adds an item', () => {
    useExampleStore.getState().addItem({ id: '1', name: 'Test', value: 42 });
    expect(useExampleStore.getState().items['1']).toEqual({ id: '1', name: 'Test', value: 42 });
  });

  it('selectActiveItem returns null when no active', () => {
    expect(selectActiveItem(useExampleStore.getState())).toBeNull();
  });

  it('selectActiveItem returns the active item', () => {
    const store = useExampleStore.getState();
    store.addItem({ id: 'a', name: 'Alpha', value: 1 });
    store.setActiveItem('a');
    expect(selectActiveItem(useExampleStore.getState())).toEqual({ id: 'a', name: 'Alpha', value: 1 });
  });
});
```

## Do's and Don'ts

**Do:**
- Use Immer's mutable draft syntax inside `set()` — that's why we have the middleware
- Export named selectors for any state derivation used in more than one component
- Use `Record<string, T>` for entity collections keyed by ID
- Keep action names as verbs: `addChart`, `removeIndicator`, `toggleVisibility`

**Don't:**
- Spread state inside `set()` — Immer handles immutability: `set((s) => { s.value = x; })`
- Store React component references or DOM nodes in Zustand state
- Put async logic (API calls) directly in store actions — call API in the component/hook, then dispatch the result to the store
- Create a new store for every feature — consider adding a slice to an existing domain store first
- Subscribe to the entire store object — always use a selector
