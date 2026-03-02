# Bloomberg-Style Terminal

Professional terminal interface with command-line navigation, multi-panel layouts, security analysis, and keyboard-driven workflows inspired by the Bloomberg Terminal.

## Table of Contents

- [Overview](#overview)
- [Command Line](#command-line)
- [Launchpad](#launchpad)
- [MonitorGrid](#monitorgrid)
- [MatrixView](#matrixview)
- [FormulaGrid](#formulagrid)
- [SecurityFinder](#securityfinder)
- [EquityAnalysis](#equityanalysis)
- [FixedIncomePanel](#fixedincomepanel)
- [NewsPanel](#newspanel)
- [Multi-Panel Layouts](#multi-panel-layouts)
- [Keyboard-Driven Workflows](#keyboard-driven-workflows)

## Overview

The Bloomberg-style terminal (`components/bloomberg/`) delivers an institutional trading interface. All components are designed for keyboard-first interaction, high information density, and multi-monitor support.

```typescript
import { CommandLine } from '@/components/bloomberg/CommandLine';
import { Launchpad } from '@/components/bloomberg/Launchpad';
import { MonitorGrid } from '@/components/bloomberg/MonitorGrid';
```

## Command Line

The `CommandLine` component provides a Bloomberg-style command input for rapid navigation:

```typescript
// Command syntax follows Bloomberg conventions
// <TICKER> <FUNCTION> pattern

// Examples:
// AAPL EQUITY → Load Apple equity analysis
// SPX INDEX → S&P 500 index overview
// EUR CURNCY → Euro currency page
// AAPL EQUITY GP → Apple price graph
// WEI → World Equity Index monitor
// ECO → Economic calendar
// TOP → Top news
// SRCH → Security search

interface CommandResult {
  command: string;
  parsedTicker: string;
  parsedFunction: string;
  securityType: 'equity' | 'index' | 'currency' | 'commodity' | 'bond';
  targetPanel: string;
  params: Record<string, string>;
}
```

The command line features autocomplete, command history (up/down arrows), and fuzzy matching for tickers and function mnemonics.

## Launchpad

The `Launchpad` component provides a customizable grid of quick-access widgets:

```tsx
<Launchpad
  layout={[
    { id: 'market-overview', x: 0, y: 0, w: 4, h: 2, component: 'MarketOverview' },
    { id: 'top-movers', x: 4, y: 0, w: 4, h: 2, component: 'TopMovers' },
    { id: 'news-ticker', x: 0, y: 2, w: 8, h: 1, component: 'NewsTicker' },
    { id: 'watchlist', x: 8, y: 0, w: 4, h: 3, component: 'MiniWatchlist' },
  ]}
  gridCols={12}
  editable={true}
/>
```

Widgets snap to a 12-column grid and can be added, removed, resized, and rearranged via drag-and-drop. The layout persists across sessions.

## MonitorGrid

Real-time market monitor displaying a dense grid of securities with streaming quotes:

```tsx
<MonitorGrid
  securities={['SPX', 'NDX', 'DJI', 'VIX', 'EURUSD', 'USDJPY', 'CL1', 'GC1', 'ZN1']}
  columns={['last', 'change', 'changePct', 'high', 'low', 'volume']}
  refreshInterval={1000}
  flashOnChange={true}
  compactMode={true}
/>
```

The grid supports hundreds of securities with virtual scrolling. Color intensity scales with the magnitude of price changes.

## MatrixView

Cross-asset correlation and comparison matrix:

```tsx
<MatrixView
  assets={['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'USO', 'UUP']}
  metric="correlation"           // 'correlation' | 'relative-performance' | 'beta'
  period="90d"
  colorScale="diverging"         // blue (negative) → white → red (positive)
  showValues={true}
/>
```

The matrix dynamically recalculates as the time period slider is adjusted. Clicking a cell drills into the pair's scatter plot and rolling correlation chart.

## FormulaGrid

Spreadsheet-like grid for custom calculations referencing live market data:

```typescript
interface FormulaCell {
  row: number;
  col: number;
  formula: string;         // e.g., '=BDP("AAPL", "PX_LAST")' or '=A1 * B1'
  format: 'number' | 'percent' | 'currency';
}

// Bloomberg-style BDP (Bloomberg Data Point) function
// =BDP("AAPL US Equity", "PX_LAST")          → current price
// =BDP("AAPL US Equity", "PE_RATIO")         → P/E ratio
// =BDP("AAPL US Equity", "CUR_MKT_CAP")     → market cap
// =BDH("AAPL US Equity", "PX_LAST", "2025-01-01", "2026-01-01")  → historical
```

Formulas update in real-time as underlying data changes. Standard spreadsheet functions (`SUM`, `AVG`, `IF`, `VLOOKUP`) are supported alongside market data functions.

## SecurityFinder

Universal security search across all asset classes:

```tsx
<SecurityFinder
  onSelect={(security) => loadSecurity(security)}
  assetClasses={['equity', 'etf', 'index', 'forex', 'commodity', 'bond', 'crypto']}
  showRecentSearches={true}
  maxResults={50}
/>
```

Search is fuzzy-matched against ticker, company name, ISIN, CUSIP, and SEDOL. Results group by asset class with type-ahead suggestions appearing after 1 character.

## EquityAnalysis

Comprehensive single-stock analysis panel:

```tsx
<EquityAnalysis
  symbol="AAPL"
  sections={[
    'overview',          // price, market cap, sector, key stats
    'financials',        // income statement, balance sheet, cash flow
    'valuation',         // multiples, DCF, peer comparison
    'technicals',        // chart with indicators
    'ownership',         // institutional holders, insider transactions
    'earnings',          // history, estimates, surprise chart
    'analysts',          // ratings, price targets, consensus
  ]}
  defaultSection="overview"
/>
```

Each section provides drill-down capability. The financials tab includes a 10-year historical view with quarterly and annual granularity.

## FixedIncomePanel

Bond and fixed income analytics:

```tsx
<FixedIncomePanel
  security="US10Y"
  features={[
    'yield-curve',       // interactive yield curve with historical overlay
    'spread-analysis',   // credit spreads, OAS, Z-spread
    'duration-convexity', // risk metrics
    'scenario-analysis', // rate shock scenarios
  ]}
/>
```

The yield curve component displays the current term structure with configurable historical overlays (1m ago, 1y ago, pre-crisis). Drag handles allow interactive parallel and twist shift scenarios.

## NewsPanel

See [NEWS_RESEARCH.md](./NEWS_RESEARCH.md) for the complete NewsPanel documentation. Within the Bloomberg terminal context, the NewsPanel integrates with the command line — typing `TOP` loads top news, `N AAPL` loads AAPL-specific news.

## Multi-Panel Layouts

Configurable multi-panel workspace layouts:

```typescript
interface PanelLayout {
  id: string;
  name: string;
  panels: Array<{
    component: string;
    props: Record<string, unknown>;
    position: { x: number; y: number; w: number; h: number };
  }>;
  hotkey?: string;
}

const layouts: PanelLayout[] = [
  { id: 'trading', name: 'Trading', hotkey: 'F1', panels: [/* chart, order book, positions */] },
  { id: 'research', name: 'Research', hotkey: 'F2', panels: [/* news, analysis, filings */] },
  { id: 'monitor', name: 'Monitor', hotkey: 'F3', panels: [/* grid, heatmap, alerts */] },
];
```

Layouts save and restore via function keys. Panels can be popped out into separate browser windows for multi-monitor setups, with state synchronized across windows.

## Keyboard-Driven Workflows

Every action is accessible via keyboard:

| Key | Action |
|---|---|
| `/` | Focus command line |
| `Esc` | Clear command / close panel |
| `Tab` | Cycle between panels |
| `Enter` | Execute command / select |
| `F1`-`F12` | Load saved layouts |
| `Ctrl+N` | New panel |
| `Ctrl+W` | Close active panel |
| `Ctrl+Shift+F` | Full-screen active panel |
| `Alt+1`-`9` | Jump to panel by index |

Command history is navigable with up/down arrows and searchable with `Ctrl+R`.
