/**
 * UI2 Routes Configuration
 * React Router routes for UI v2 — all routes lazy-loaded for optimal bundle size.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShellUI2 } from './AppShellUI2';

// ── Loading skeleton shown during lazy-load ──────────────────────────────────
function RouteSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 200, color: '#787B86', fontSize: '11px',
      fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em',
    }}>
      Loading…
    </div>
  );
}

// ── Lazy page imports ────────────────────────────────────────────────────────
const DashboardUI2        = lazy(() => import('./pages').then(m => ({ default: m.DashboardUI2 })));
const TradingUI2          = lazy(() => import('./pages').then(m => ({ default: m.TradingUI2 })));
const PortfolioUI2        = lazy(() => import('./pages').then(m => ({ default: m.PortfolioUI2 })));
const AutopilotUI2        = lazy(() => import('./pages').then(m => ({ default: m.AutopilotUI2 })));
const OptionsChainUI2     = lazy(() => import('./pages').then(m => ({ default: m.OptionsChainUI2 })));
const HeatmapUI2          = lazy(() => import('./pages').then(m => ({ default: m.HeatmapUI2 })));
const WatchlistManagerUI2 = lazy(() => import('./pages').then(m => ({ default: m.WatchlistManagerUI2 })));
const BacktestUI2         = lazy(() => import('./pages').then(m => ({ default: m.BacktestUI2 })));
const ScreenersUI2        = lazy(() => import('./pages').then(m => ({ default: m.ScreenersUI2 })));
const RiskUI2             = lazy(() => import('./pages').then(m => ({ default: m.RiskUI2 })));
const SettingsUI2         = lazy(() => import('./pages').then(m => ({ default: m.SettingsUI2 })));
const OrdersUI2           = lazy(() => import('./pages').then(m => ({ default: m.OrdersUI2 })));
const AlertsUI2           = lazy(() => import('./pages').then(m => ({ default: m.AlertsUI2 })));
const SentimentUI2        = lazy(() => import('./pages').then(m => ({ default: m.SentimentUI2 })));
const OptionsMatrixUI2    = lazy(() => import('./pages').then(m => ({ default: m.OptionsMatrixUI2 })));
const EconomicCalendarUI2 = lazy(() => import('./pages').then(m => ({ default: m.EconomicCalendarUI2 })));
const FactorModelUI2      = lazy(() => import('./pages').then(m => ({ default: m.FactorModelUI2 })));
const VolSurfaceUI2       = lazy(() => import('./pages').then(m => ({ default: m.VolSurfaceUI2 })));
const BlotterUI2          = lazy(() => import('./pages').then(m => ({ default: m.BlotterUI2 })));
const SearchUI2           = lazy(() => import('./pages').then(m => ({ default: m.SearchUI2 })));
const MonitorUI2          = lazy(() => import('./pages').then(m => ({ default: m.MonitorUI2 })));
const ModelRouterUI2      = lazy(() => import('./pages').then(m => ({ default: m.ModelRouterUI2 })));
const AutopilotV2UI2      = lazy(() => import('./pages').then(m => ({ default: m.AutopilotV2UI2 })));
const NovaUI2             = lazy(() => import('./pages').then(m => ({ default: m.NovaUI2 })));
// Husk preview components
const TradingUI2Husk      = lazy(() => import('./pages').then(m => ({ default: m.TradingUI2Husk })));
const PortfolioUI2Husk    = lazy(() => import('./pages').then(m => ({ default: m.PortfolioUI2Husk })));
const DashboardUI2Husk    = lazy(() => import('./pages').then(m => ({ default: m.DashboardUI2Husk })));
const TerraCodeJudge      = lazy(() => import('./pages/TerraCodeJudge'));

// ── Suspense wrapper helper ──────────────────────────────────────────────────
const S = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
);

export function UI2Routes() {
  return (
    <Routes>
      <Route path="/" element={<AppShellUI2 />}>
        <Route index element={<Navigate to="/ui2/dashboard" replace />} />

        {/* ── Husk preview routes ── */}
        <Route path="husk/dashboard" element={<S><DashboardUI2Husk /></S>} />
        <Route path="husk/trading"   element={<S><TradingUI2Husk /></S>} />
        <Route path="husk/portfolio" element={<S><PortfolioUI2Husk /></S>} />

        {/* ── Core Trading ── */}
        <Route path="dashboard"         element={<S><DashboardUI2 /></S>} />
        <Route path="trading"           element={<S><TradingUI2 /></S>} />
        <Route path="portfolio"         element={<S><PortfolioUI2 /></S>} />
        <Route path="orders"            element={<S><OrdersUI2 /></S>} />
        <Route path="risk"              element={<S><RiskUI2 /></S>} />
        <Route path="alerts"            element={<S><AlertsUI2 /></S>} />
        <Route path="settings"          element={<S><SettingsUI2 /></S>} />
        <Route path="search"            element={<S><SearchUI2 /></S>} />
        <Route path="monitor"           element={<S><MonitorUI2 /></S>} />

        {/* ── Autopilot ── */}
        <Route path="autopilot"         element={<S><AutopilotUI2 /></S>} />
        <Route path="autopilot-v2"      element={<S><AutopilotV2UI2 /></S>} />

        {/* ── Strategy / Backtest ── */}
        <Route path="backtest"          element={<S><BacktestUI2 /></S>} />

        {/* ── Markets ── */}
        <Route path="heatmap"           element={<S><HeatmapUI2 /></S>} />
        <Route path="options-chain"     element={<S><OptionsChainUI2 /></S>} />
        <Route path="options-matrix"    element={<S><OptionsMatrixUI2 /></S>} />
        <Route path="screeners"         element={<S><ScreenersUI2 /></S>} />
        <Route path="sentiment"         element={<S><SentimentUI2 /></S>} />
        <Route path="watchlist-manager" element={<S><WatchlistManagerUI2 /></S>} />
        <Route path="economic-calendar" element={<S><EconomicCalendarUI2 /></S>} />

        {/* ── Analysis ── */}
        <Route path="factor-model"      element={<S><FactorModelUI2 /></S>} />
        <Route path="blotter"           element={<S><BlotterUI2 /></S>} />

        {/* ── Vol / Derivatives ── */}
        <Route path="vol-surface"       element={<S><VolSurfaceUI2 /></S>} />

        {/* ── Model ── */}
        <Route path="model-router"      element={<S><ModelRouterUI2 /></S>} />

        {/* ── Nova AI Hub ── */}
        <Route path="nova"              element={<S><NovaUI2 /></S>} />

        <Route path="judge"             element={<S><TerraCodeJudge /></S>} />

      </Route>
    </Routes>
  );
}
