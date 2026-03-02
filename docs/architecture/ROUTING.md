# Routing Architecture

> Route structure, navigation patterns, and deep linking in Apex Terminal.

---

## Table of Contents

- [Overview](#overview)
- [Route Hierarchy](#route-hierarchy)
- [Route Configuration](#route-configuration)
- [Navigation Patterns](#navigation-patterns)
- [Deep Linking](#deep-linking)
- [Route Guards](#route-guards)
- [Lazy Loading](#lazy-loading)
- [URL State Synchronization](#url-state-synchronization)

---

## Overview

Apex Terminal uses **react-router-dom v7** for client-side routing with 150+ routes organized into a nested layout structure. Routes are defined in `ui2/routes.tsx` and rendered within layout shells (`ui2/husks/`) that provide the persistent application frame (sidebar, topbar, command palette).

---

## Route Hierarchy

```
/                           → Dashboard (default landing)
├── /chart                  → Chart workspace
│   └── /chart/:symbol      → Chart with specific symbol
├── /trading                → Trading workspace
│   ├── /trading/orders     → Order management
│   ├── /trading/positions  → Position manager
│   ├── /trading/blotter    → Execution blotter
│   └── /trading/journal    → Trade journal
├── /options                → Options analytics
│   ├── /options/chain      → Options chain
│   ├── /options/strategy   → Strategy builder
│   ├── /options/risk-desk  → Risk desk
│   └── /options/surface    → Volatility surface
├── /portfolio              → Portfolio dashboard
│   ├── /portfolio/holdings → Holdings view
│   ├── /portfolio/risk     → Risk analytics
│   └── /portfolio/optimize → Optimization
├── /backtest               → Backtesting workspace
│   ├── /backtest/builder   → Strategy builder
│   ├── /backtest/results   → Results viewer
│   └── /backtest/optimize  → Parameter optimization
├── /screener               → Stock screener
├── /scanner                → Real-time scanner
├── /bloomberg              → Bloomberg terminal mode
│   ├── /bloomberg/launchpad → Launchpad
│   ├── /bloomberg/monitor  → Monitor grid
│   └── /bloomberg/matrix   → Matrix view
├── /risk                   → Risk dashboard
├── /news                   → News & research
├── /crypto                 → Crypto analytics
├── /fx                     → Forex dashboard
├── /fixed-income           → Fixed income
├── /economic               → Economic calendar
├── /alerts                 → Alerts management
├── /watchlists             → Watchlist management
├── /settings               → User settings
│   ├── /settings/general   → General preferences
│   ├── /settings/theme     → Theme customization
│   ├── /settings/shortcuts → Keyboard shortcuts
│   └── /settings/data      → Data source configuration
└── /workspace/:id          → Custom workspace layout
```

---

## Route Configuration

```tsx
// ui2/routes.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'chart',
        children: [
          { index: true, element: <ChartPage /> },
          { path: ':symbol', element: <ChartPage /> },
        ],
      },
      {
        path: 'trading',
        element: <TradingLayout />,
        children: [
          { index: true, element: <TradingOverview /> },
          { path: 'orders', element: <OrderManagement /> },
          { path: 'positions', element: <PositionManager /> },
          { path: 'blotter', element: <ExecutionBlotter /> },
          { path: 'journal', element: <TradeJournal /> },
        ],
      },
      {
        path: 'options',
        element: <OptionsLayout />,
        children: [
          { path: 'chain', element: <OptionsChain /> },
          { path: 'strategy', element: <StrategyBuilder /> },
          { path: 'risk-desk', element: <RiskDesk /> },
          { path: 'surface', element: <VolSurface /> },
        ],
      },
      // ... 100+ more routes
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

---

## Navigation Patterns

### Sidebar Navigation

The primary navigation uses an icon sidebar that maps to top-level routes:

```tsx
const navItems = [
  { icon: LayoutDashboard, path: '/', label: 'Dashboard' },
  { icon: CandlestickChart, path: '/chart', label: 'Charts' },
  { icon: ArrowRightLeft, path: '/trading', label: 'Trading' },
  { icon: Target, path: '/options', label: 'Options' },
  { icon: PieChart, path: '/portfolio', label: 'Portfolio' },
  { icon: FlaskConical, path: '/backtest', label: 'Backtest' },
  { icon: Search, path: '/screener', label: 'Screener' },
  { icon: Terminal, path: '/bloomberg', label: 'Terminal' },
  { icon: Shield, path: '/risk', label: 'Risk' },
];
```

### Command Palette Navigation

The `Ctrl+K` command palette provides keyboard-driven navigation:

```tsx
// Registered navigation commands
commandRegistry.register({
  id: 'nav:chart',
  label: 'Go to Charts',
  shortcut: ['g', 'c'],
  action: () => navigate('/chart'),
  category: 'navigation',
});
```

### Programmatic Navigation

```typescript
import { useNavigate } from 'react-router-dom';

function SymbolLink({ symbol }: { symbol: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/chart/${symbol}`)}>
      {symbol}
    </button>
  );
}
```

---

## Deep Linking

URLs encode enough state to reconstruct the view:

| URL Pattern | State Encoded |
|-------------|---------------|
| `/chart/AAPL?tf=1D&indicators=SMA:20,RSI:14` | Symbol, timeframe, indicators |
| `/options/chain?symbol=TSLA&expiry=2026-03-20` | Symbol, expiration date |
| `/screener?preset=high-volume&sort=change` | Preset filter, sort order |
| `/backtest/results/abc123` | Specific backtest run ID |
| `/workspace/my-layout` | Named workspace configuration |

### URL ↔ Store Synchronization

```typescript
function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { symbol, timeframe } = useChartStore();

  // URL → Store (on mount / URL change)
  useEffect(() => {
    const urlSymbol = searchParams.get('symbol');
    if (urlSymbol && urlSymbol !== symbol) {
      useChartStore.getState().setSymbol(urlSymbol);
    }
  }, [searchParams]);

  // Store → URL (on state change)
  useEffect(() => {
    setSearchParams({ symbol, tf: timeframe }, { replace: true });
  }, [symbol, timeframe]);
}
```

---

## Route Guards

### Authentication Guard

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
```

### Permission Guard

```tsx
function RequirePermission({ permission, children }: GuardProps) {
  const { permissions } = useAuthStore();

  if (!permissions.includes(permission)) {
    return <AccessDenied requiredPermission={permission} />;
  }

  return children;
}

// Usage
<Route
  path="/trading/orders"
  element={
    <RequirePermission permission="trading:orders:write">
      <OrderManagement />
    </RequirePermission>
  }
/>
```

---

## Lazy Loading

All route components are lazy-loaded with Suspense boundaries:

```tsx
const ChartPage = lazy(() => import('./pages/ChartPage'));
const TradingPage = lazy(() => import('./pages/TradingPage'));
const OptionsPage = lazy(() => import('./pages/OptionsPage'));

// In route config
{
  path: 'chart',
  element: (
    <Suspense fallback={<PageSkeleton />}>
      <ChartPage />
    </Suspense>
  ),
}
```

### Prefetching

Hover-based route prefetching reduces perceived load times:

```typescript
function NavItem({ path, label, icon: Icon }: NavItemProps) {
  const prefetch = useCallback(() => {
    const routeModule = routeModules[path];
    if (routeModule) routeModule.preload();
  }, [path]);

  return (
    <NavLink to={path} onMouseEnter={prefetch}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}
```

---

## URL State Synchronization

The platform maintains a bidirectional sync between URL parameters and application state for shareable, bookmarkable views:

```typescript
// Shared utility for URL ↔ store sync
function createUrlSync<T>(config: {
  store: StoreApi<T>;
  paramMap: Record<string, keyof T>;
  serialize?: Partial<Record<keyof T, (val: any) => string>>;
  deserialize?: Partial<Record<keyof T, (val: string) => any>>;
}) {
  return function UrlSyncProvider({ children }: { children: React.ReactNode }) {
    const [params, setParams] = useSearchParams();

    // Sync both directions on mount and changes
    useSyncEffect(config, params, setParams);

    return children;
  };
}
```
