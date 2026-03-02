# Watchlist Management

Full-featured watchlist system with custom columns, real-time streaming quotes, sorting, filtering, color coding, symbol grouping, and import/export.

## Table of Contents

- [Overview](#overview)
- [Creating Watchlists](#creating-watchlists)
- [Custom Columns](#custom-columns)
- [Real-Time Quotes](#real-time-quotes)
- [Sorting and Filtering](#sorting-and-filtering)
- [Color Coding](#color-coding)
- [Symbol Grouping](#symbol-grouping)
- [Import and Export](#import-and-export)
- [Store Integration](#store-integration)

## Overview

The watchlist module provides a persistent, real-time symbol monitoring system. The `watchlistStore` manages data, and the `WatchlistPanel` component renders an interactive table with streaming price updates.

```typescript
import { useWatchlistStore } from '@/stores/watchlistStore';
import { WatchlistPanel } from '@/components/trading/WatchlistPanel';
```

## Creating Watchlists

Create and manage multiple independent watchlists:

```typescript
const { createWatchlist, addSymbol, removeSymbol, renameWatchlist } = useWatchlistStore();

const watchlistId = createWatchlist({
  name: 'Tech Momentum',
  description: 'High-momentum technology stocks',
  symbols: ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'META'],
  icon: 'rocket',
  color: '#3b82f6',
});

addSymbol(watchlistId, 'AMZN');
addSymbol(watchlistId, 'TSLA', { notes: 'Watch for earnings breakout', tags: ['earnings'] });
removeSymbol(watchlistId, 'META');
```

Each symbol entry can carry per-watchlist metadata: notes, tags, cost basis, target price, and custom fields.

## Custom Columns

Configure visible columns per watchlist with computed and custom fields:

```typescript
interface WatchlistColumn {
  id: string;
  label: string;
  field: string;
  width: number;
  align: 'left' | 'center' | 'right';
  format: 'number' | 'percent' | 'currency' | 'compact' | 'custom';
  sortable: boolean;
  colorCoded: boolean;
}

const columns: WatchlistColumn[] = [
  { id: 'symbol', label: 'Symbol', field: 'symbol', width: 80, align: 'left', format: 'custom', sortable: true, colorCoded: false },
  { id: 'last', label: 'Last', field: 'lastPrice', width: 90, align: 'right', format: 'currency', sortable: true, colorCoded: false },
  { id: 'change', label: 'Chg%', field: 'changePercent', width: 75, align: 'right', format: 'percent', sortable: true, colorCoded: true },
  { id: 'volume', label: 'Volume', field: 'volume', width: 90, align: 'right', format: 'compact', sortable: true, colorCoded: false },
  { id: 'rsi', label: 'RSI', field: 'indicators.rsi14', width: 60, align: 'right', format: 'number', sortable: true, colorCoded: true },
  { id: 'mktcap', label: 'Mkt Cap', field: 'marketCap', width: 100, align: 'right', format: 'compact', sortable: true, colorCoded: false },
];
```

Columns are drag-reorderable and resizable. Custom formula columns can reference any data field.

## Real-Time Quotes

Prices stream via the market data feed with configurable update frequency:

```typescript
const panel = (
  <WatchlistPanel
    watchlistId="tech-momentum"
    streamingMode="realtime"     // 'realtime' | 'delayed' | 'snapshot'
    flashDuration={300}          // ms to flash on price change
    sparklineEnabled={true}      // inline mini chart per row
    sparklinePeriod="1D"
  />
);
```

Price cells flash green/red on updates. The streaming connection automatically subscribes only to symbols currently visible in the viewport, optimizing bandwidth for large watchlists.

## Sorting and Filtering

Multi-column sorting with persistent quick filters:

```typescript
const { setSortConfig, setFilter } = useWatchlistStore();

setSortConfig(watchlistId, [
  { field: 'changePercent', direction: 'desc' },
  { field: 'volume', direction: 'desc' },
]);

setFilter(watchlistId, {
  text: 'NVD',                          // symbol/name search
  changePercent: { min: -5, max: 5 },   // range filter
  tags: ['earnings'],                    // tag filter
  sector: ['Technology'],               // sector filter
});
```

Filters compose additively — all conditions must match. A filter bar above the table provides instant text search.

## Color Coding

Visual differentiation through color rules:

```typescript
interface ColorRule {
  field: string;
  conditions: Array<{
    operator: 'gt' | 'lt' | 'between' | 'eq';
    value: number | [number, number];
    backgroundColor: string;
    textColor: string;
  }>;
}

const colorRules: ColorRule[] = [
  {
    field: 'changePercent',
    conditions: [
      { operator: 'gt', value: 5, backgroundColor: '#16a34a22', textColor: '#16a34a' },
      { operator: 'lt', value: -5, backgroundColor: '#dc262622', textColor: '#dc2626' },
    ],
  },
  {
    field: 'indicators.rsi14',
    conditions: [
      { operator: 'lt', value: 30, backgroundColor: '#2563eb22', textColor: '#2563eb' },
      { operator: 'gt', value: 70, backgroundColor: '#ea580c22', textColor: '#ea580c' },
    ],
  },
];
```

Entire rows or individual cells can be colored. A built-in heatmap mode colors all numeric cells on a gradient scale.

## Symbol Grouping

Organize symbols within a watchlist by category:

```typescript
const { setGrouping } = useWatchlistStore();

setGrouping(watchlistId, {
  mode: 'custom',    // 'sector' | 'industry' | 'custom' | 'tag' | 'none'
  customGroups: [
    { name: 'Mega Cap', symbols: ['AAPL', 'MSFT', 'GOOGL'] },
    { name: 'Semiconductors', symbols: ['NVDA', 'AMD', 'AVGO'] },
    { name: 'Watchlist Ideas', symbols: ['TSLA', 'AMZN'] },
  ],
  collapsible: true,
  showGroupSummary: true,  // aggregate change%, volume, avg RSI per group
});
```

Groups display collapsed summary rows that expand on click, with aggregate statistics.

## Import and Export

Bulk symbol management across formats:

```typescript
import { exportWatchlist, importWatchlist } from '@/lib/utils/watchlistIO';

// Export
exportWatchlist(watchlistId, { format: 'csv' });    // symbol, name, notes, tags
exportWatchlist(watchlistId, { format: 'json' });   // full watchlist config + metadata
exportWatchlist(watchlistId, { format: 'txt' });    // plain symbol list, one per line

// Import
const imported = await importWatchlist(file);       // auto-detect format
// Validates symbols, warns on unrecognized tickers, merges or replaces
```

Supports paste-from-clipboard: paste a comma-separated or newline-separated list of symbols directly into the panel.

## Store Integration

The `watchlistStore` (Zustand) manages all watchlist state:

```typescript
interface WatchlistState {
  watchlists: Record<string, Watchlist>;
  activeWatchlistId: string | null;
  createWatchlist: (config: WatchlistConfig) => string;
  deleteWatchlist: (id: string) => void;
  addSymbol: (watchlistId: string, symbol: string, meta?: SymbolMeta) => void;
  removeSymbol: (watchlistId: string, symbol: string) => void;
  reorderSymbols: (watchlistId: string, fromIndex: number, toIndex: number) => void;
  setSortConfig: (watchlistId: string, sort: SortConfig[]) => void;
  setFilter: (watchlistId: string, filter: FilterConfig) => void;
  setGrouping: (watchlistId: string, grouping: GroupConfig) => void;
}
```

State persists to IndexedDB. Watchlists sync across tabs via BroadcastChannel.
