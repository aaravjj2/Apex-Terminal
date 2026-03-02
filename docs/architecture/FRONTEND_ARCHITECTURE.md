# Frontend Architecture

> React component architecture, module organization, and rendering strategy for the Apex Terminal platform.

---

## Table of Contents

- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [Module Organization](#module-organization)
- [Component Categories](#component-categories)
- [Rendering Strategy](#rendering-strategy)
- [Code Splitting](#code-splitting)
- [Composition Patterns](#composition-patterns)
- [Component Communication](#component-communication)

---

## Overview

The frontend is a React 19 SPA built with TypeScript 5.9 and Vite 5. It follows a feature-based architecture where each domain (charting, trading, options, etc.) is a self-contained module with its own components, state, and logic. The primary UI layer (`ui2/`) contains 223+ page components organized into a route-driven layout system.

---

## Component Hierarchy

```
App.tsx
├── ErrorBoundary
│   ├── Router (react-router-dom v7)
│   │   ├── Layout Shell (ui2/husks/)
│   │   │   ├── TopBar (logo, search, clock, user)
│   │   │   ├── LeftNav (icon sidebar)
│   │   │   ├── MainContent (routed pages)
│   │   │   │   ├── DashboardPage
│   │   │   │   ├── ChartPage
│   │   │   │   ├── TradingPage
│   │   │   │   ├── OptionsPage
│   │   │   │   ├── PortfolioPage
│   │   │   │   ├── BacktestPage
│   │   │   │   ├── BloombergPage
│   │   │   │   └── ... (150+ routes)
│   │   │   └── CommandPalette (cmdk)
│   │   └── Notifications / Toasts
│   └── GlobalErrorBanner
```

---

## Module Organization

### Core Modules (`src/`)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `api/` | 17 | HTTP API client modules with typed request/response |
| `components/` | 40+ | Reusable UI components organized by domain |
| `core/` | 5+ | ChartEngine, Scales, core type definitions |
| `data/` | 3 | ApiClient, ClockClient, WebSocketClient |
| `features/` | 200+ | Self-contained feature modules |
| `hooks/` | 25 | Custom React hooks for common patterns |
| `lib/` | 117 | Pure computation libraries (no React dependency) |
| `stores/` | 11+26 | Zustand state management stores |
| `ui2/` | 223+ | Primary UI pages, layouts, routes |
| `workers/` | 5 | Web Worker scripts for background computation |

### Feature Module Structure

Each feature module follows a consistent structure:

```
features/options/
├── components/        # React components specific to this feature
│   ├── OptionsChain.tsx
│   ├── GreeksDisplay.tsx
│   └── StrategyBuilder.tsx
├── riskDesk/          # Sub-feature modules
├── strategyLab/       # Sub-feature modules
├── hooks.ts           # Feature-specific hooks
├── store.ts           # Feature-specific Zustand store
├── types.ts           # TypeScript interfaces
└── index.ts           # Public API barrel export
```

---

## Component Categories

### 1. Page Components (`ui2/pages/`)

Full-page views rendered by the router. Each page composes multiple feature components.

```tsx
// Example page component pattern
export function OptionsChainPage() {
  const { symbol } = useParams();
  const options = useOptionsStore((s) => s.chain);

  return (
    <PageLayout title="Options Chain">
      <OptionsToolbar symbol={symbol} />
      <OptionsGrid data={options} />
      <GreeksSummary />
    </PageLayout>
  );
}
```

### 2. Feature Components (`components/`)

Domain-specific components grouped by capability:

- **bloomberg/** — CommandLine, SecurityFinder, FormulaGrid, MonitorGrid, Launchpad
- **charts/** — VolatilitySurface, CorrelationMatrix, YieldCurveChart, VaRHistogram
- **charts/advanced/** — FootprintChart, DepthChart, MarketProfile, VolumeProfile
- **trading/** — OrderTicket, OrderBook, ExecutionBlotter, WatchlistPanel, AlertsManager
- **pages/** — AdvancedScreener, BacktestWorkspace, CryptoAnalytics, RiskDashboard

### 3. Shared Components (`components/shared/`)

Reusable primitives used across the application:

- **Skeleton** — Loading placeholder with shimmer animation
- **EmptyState** — Empty state illustrations with action prompts
- **SeverityBanner** — Contextual alert banners (info, warning, error)

### 4. Layout Components (`ui2/husks/`)

Shell components that provide the application frame:

- **AppShell** — Main layout with sidebar, topbar, content area
- **PanelLayout** — Resizable panel system using react-resizable-panels
- **TabLayout** — Tabbed content areas with drag-and-drop reordering

---

## Rendering Strategy

### Concurrent Features (React 19)

The application leverages React 19's concurrent rendering:

- **Automatic batching** — State updates from event handlers, timeouts, and promises are batched
- **Transitions** — `useTransition` marks non-urgent updates (e.g., filtering large lists)
- **Suspense boundaries** — Lazy-loaded routes and data fetching with fallback UI

### Virtual Rendering

Large datasets use virtualization to render only visible items:

```tsx
function WatchlistPanel({ symbols }: { symbols: Symbol[] }) {
  const { virtualItems, totalSize } = useVirtualList({
    count: symbols.length,
    estimateSize: () => 32,
    overscan: 5,
  });

  return (
    <div style={{ height: totalSize }}>
      {virtualItems.map((item) => (
        <WatchlistRow key={item.key} symbol={symbols[item.index]} />
      ))}
    </div>
  );
}
```

### Canvas Rendering

Charts use Canvas 2D for high-performance rendering via lightweight-charts:

- Price charts render thousands of candles at 60fps
- Drawing tools use a separate overlay canvas layer
- Indicators compute in Web Workers, results rendered on the chart canvas

---

## Code Splitting

Routes are lazy-loaded to minimize initial bundle size:

```tsx
const OptionsChainPage = lazy(() => import('./pages/OptionsChainPage'));
const BacktestWorkspace = lazy(() => import('./pages/BacktestWorkspace'));
const RiskDashboard = lazy(() => import('./pages/RiskDashboard'));

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/options" element={<OptionsChainPage />} />
        <Route path="/backtest" element={<BacktestWorkspace />} />
        <Route path="/risk" element={<RiskDashboard />} />
      </Routes>
    </Suspense>
  );
}
```

### Bundle Strategy

| Chunk | Contents | Typical Size |
|-------|----------|-------------|
| `vendor` | React, Zustand, router | ~120KB gzipped |
| `charts` | lightweight-charts, Recharts | ~80KB gzipped |
| `core` | Shared components, hooks, utils | ~50KB gzipped |
| `feature-*` | Lazy-loaded feature chunks | ~15-40KB each |

---

## Composition Patterns

### Compound Components

Complex UI elements use the compound component pattern:

```tsx
<OrderTicket>
  <OrderTicket.Header symbol="AAPL" />
  <OrderTicket.Body>
    <OrderTicket.TypeSelector />
    <OrderTicket.QuantityInput />
    <OrderTicket.PriceInput />
  </OrderTicket.Body>
  <OrderTicket.Actions onSubmit={handleSubmit} />
</OrderTicket>
```

### Render Props & Hooks

Data fetching is abstracted into hooks, keeping components presentational:

```tsx
function PortfolioView() {
  const { holdings, performance, isLoading } = usePortfolio();

  if (isLoading) return <Skeleton variant="table" />;

  return (
    <>
      <HoldingsTable data={holdings} />
      <PerformanceChart data={performance} />
    </>
  );
}
```

---

## Component Communication

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Props** | Parent → child data | `<ChartComponent data={ohlcv} />` |
| **Zustand stores** | Cross-component shared state | `useChartStore(s => s.indicators)` |
| **Event Bus** | Decoupled cross-module events | `eventBus.emit('symbol:changed', 'AAPL')` |
| **Context** | Theme, locale, auth tokens | `useTheme()` provides current theme |
| **URL params** | Route-driven state | `useParams()` for symbol, timeframe |
| **WebSocket** | Real-time server → client | Price updates, order fills |
