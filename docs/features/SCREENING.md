# Stock Screener

Multi-criteria stock screening with fundamental, technical, and custom formula filters, preset screens, and export capabilities.

## Table of Contents

- [Overview](#overview)
- [Screening Engine](#screening-engine)
- [Fundamental Filters](#fundamental-filters)
- [Technical Filters](#technical-filters)
- [Custom Formulas](#custom-formulas)
- [Preset Screens](#preset-screens)
- [Saved Screeners](#saved-screeners)
- [Result Export](#result-export)
- [Store Integration](#store-integration)

## Overview

The stock screener (`lib/marketData/screening.ts`) provides a powerful filtering engine that scans the entire market universe against user-defined criteria. The `screeningStore` manages state, and results stream progressively as matches are found.

```typescript
import { ScreeningEngine } from '@/lib/marketData/screening';
import { useScreeningStore } from '@/stores/screeningStore';

const engine = new ScreeningEngine({ universe: 'us-equities' });
```

## Screening Engine

The core engine evaluates filter expressions against a symbol universe:

```typescript
interface ScreenerConfig {
  universe: 'us-equities' | 'global' | 'etfs' | 'crypto' | 'custom';
  filters: FilterCriteria[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  limit: number;
  columns: string[];
}

const results = await engine.screen({
  universe: 'us-equities',
  filters: [
    { field: 'marketCap', operator: 'gte', value: 1_000_000_000 },
    { field: 'peRatio', operator: 'between', value: [5, 20] },
    { field: 'rsi14', operator: 'lte', value: 30 },
  ],
  sortBy: 'volume',
  sortDirection: 'desc',
  limit: 50,
  columns: ['symbol', 'name', 'price', 'change', 'volume', 'marketCap', 'peRatio', 'rsi14'],
});
```

The engine processes filters in optimized order — indexed fields first, then computed indicators — to minimize scan time.

## Fundamental Filters

Pre-built fundamental data fields available for screening:

```typescript
const fundamentalFilters: FilterField[] = [
  { field: 'marketCap', label: 'Market Cap', type: 'number', unit: 'currency' },
  { field: 'peRatio', label: 'P/E Ratio', type: 'number' },
  { field: 'forwardPE', label: 'Forward P/E', type: 'number' },
  { field: 'pbRatio', label: 'P/B Ratio', type: 'number' },
  { field: 'psRatio', label: 'P/S Ratio', type: 'number' },
  { field: 'revenue', label: 'Revenue', type: 'number', unit: 'currency' },
  { field: 'revenueGrowth', label: 'Revenue Growth %', type: 'percent' },
  { field: 'epsGrowth', label: 'EPS Growth %', type: 'percent' },
  { field: 'dividendYield', label: 'Dividend Yield %', type: 'percent' },
  { field: 'debtToEquity', label: 'Debt/Equity', type: 'number' },
  { field: 'roe', label: 'ROE %', type: 'percent' },
  { field: 'freeCashFlow', label: 'Free Cash Flow', type: 'number', unit: 'currency' },
];
```

Operators supported: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `notIn`.

## Technical Filters

Screen by computed technical indicators calculated on-the-fly:

```typescript
const technicalFilters = [
  { field: 'rsi14', label: 'RSI (14)', range: [0, 100] },
  { field: 'macdSignal', label: 'MACD Signal', type: 'crossover' },
  { field: 'sma50_cross_sma200', label: 'Golden/Death Cross', type: 'boolean' },
  { field: 'priceAboveSMA200', label: 'Price > SMA 200', type: 'boolean' },
  { field: 'volumeRatio', label: 'Volume vs 20d Avg', type: 'number' },
  { field: 'atr14', label: 'ATR (14)', type: 'number' },
  { field: 'bollingerPosition', label: 'Bollinger Band %B', range: [0, 1] },
  { field: '52weekHighPercent', label: '% from 52W High', type: 'percent' },
];

// Example: Find oversold large caps near 52-week lows
const oversoldScreen = {
  filters: [
    { field: 'marketCap', operator: 'gte', value: 10_000_000_000 },
    { field: 'rsi14', operator: 'lte', value: 25 },
    { field: '52weekHighPercent', operator: 'lte', value: -30 },
  ],
};
```

## Custom Formulas

Write custom screening expressions using the built-in formula language:

```typescript
const customFilter: CustomFormula = {
  name: 'PEG Ratio Under 1',
  expression: 'peRatio / epsGrowth < 1 AND epsGrowth > 10',
};

const compositeFilter: CustomFormula = {
  name: 'Value Momentum Combo',
  expression: `
    (peRatio < 15 AND pbRatio < 2.5)
    AND (rsi14 > 40 AND rsi14 < 70)
    AND (priceAboveSMA50 = true)
    AND (volumeRatio > 1.2)
  `,
};

engine.addCustomFilter(compositeFilter);
```

The formula parser supports arithmetic operators, comparisons, logical AND/OR, parenthetical grouping, and built-in math functions (`abs`, `max`, `min`, `avg`).

## Preset Screens

Built-in screening templates for common strategies:

```typescript
const presetScreens = {
  'value-stocks': { filters: [/* low P/E, low P/B, high dividend */] },
  'growth-stocks': { filters: [/* high revenue growth, high EPS growth */] },
  'momentum-leaders': { filters: [/* high RSI, above MAs, strong volume */] },
  'dividend-aristocrats': { filters: [/* 25+ years dividend growth */] },
  'oversold-bounce': { filters: [/* RSI < 25, volume spike, near support */] },
  'breakout-candidates': { filters: [/* near 52W high, volume expanding */] },
  'small-cap-value': { filters: [/* market cap < 2B, low valuation */] },
};

const results = await engine.runPreset('momentum-leaders');
```

## Saved Screeners

Persist custom screener configurations for reuse:

```typescript
const { saveScreener, loadScreener, listScreeners } = useScreeningStore();

saveScreener({
  id: 'my-value-screen',
  name: 'My Value Screen',
  filters: [...],
  columns: [...],
  sortBy: 'dividendYield',
  notifications: { enabled: true, frequency: 'daily' },
});

const saved = listScreeners();
const loaded = loadScreener('my-value-screen');
```

Screeners with notifications enabled re-run on schedule and alert when new symbols match criteria.

## Result Export

Export screening results in multiple formats:

```typescript
import { exportScreenResults } from '@/lib/reporting/csv';

exportScreenResults(results, {
  format: 'csv',          // 'csv' | 'excel' | 'json'
  includeMetadata: true,
  filename: 'value_screen_2026',
});
```

Results integrate directly with the watchlist — add matched symbols to any watchlist with a single action.

## Store Integration

The `screeningStore` (Zustand) manages screener state:

```typescript
interface ScreeningState {
  activeFilters: FilterCriteria[];
  results: ScreenResult[];
  isScanning: boolean;
  progress: number;
  savedScreeners: SavedScreener[];
  presets: Record<string, ScreenerConfig>;
  addFilter: (filter: FilterCriteria) => void;
  removeFilter: (index: number) => void;
  runScreen: () => Promise<void>;
  exportResults: (format: string) => void;
}
```
