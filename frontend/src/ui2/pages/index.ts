/**
 * UI2 Page Exports — matches routes.tsx imports exactly
 */

// ── Core Trading ──
export { default as DashboardUI2 } from './DashboardUI2';
export { default as TradingUI2 } from './TradingUI2';
export { default as PortfolioUI2 } from './PortfolioUI2';
export { default as AutopilotUI2 } from './AutopilotUI2';
export { OrdersUI2 } from './OrdersUI2';
export { AlertsUI2 } from './AlertsUI2';
export { SettingsUI2 } from './SettingsUI2';
export { SearchUI2 } from './SearchUI2';
export { MonitorUI2 } from './MonitorUI2';
export { RiskUI2 } from './RiskUI2';

// ── Autopilot family ──
export { AutopilotV2UI2 } from './AutopilotV2UI2';

// ── Strategy / Backtest ──
export { BacktestUI2 } from './BacktestUI2';

// ── Markets ──
export { default as HeatmapUI2 } from './HeatmapUI2';
export { default as OptionsChainUI2 } from './OptionsChainUI2';
export { OptionsMatrixUI2 } from './OptionsMatrixUI2';
export { ScreenersUI2 } from './ScreenersUI2';
export { SentimentUI2 } from './SentimentUI2';
export { default as WatchlistManagerUI2 } from './WatchlistManagerUI2';
export { EconomicCalendarUI2 } from './EconomicCalendarUI2';

// ── Analysis ──
export { FactorModelUI2 } from './FactorModelUI2';
export { BlotterUI2 } from './BlotterUI2';

// ── Vol / Derivatives ──
export { VolSurfaceUI2 } from './VolSurfaceUI2';

// ── Model ──
export { ModelRouterUI2 } from './ModelRouterUI2';

// ── Husk placeholders (development / previews) ──
export { TradingUI2Husk } from '../husks/TradingUI2Husk';
export { PortfolioUI2Husk } from '../husks/PortfolioUI2Husk';
export { DashboardUI2Husk } from '../husks/DashboardUI2Husk';
