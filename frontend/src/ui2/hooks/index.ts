/**
 * ui2/hooks barrel — re-exports every domain hook
 *
 * Import pattern:
 *   import { useBacktest, usePortfolio, usePlatform } from '@/ui2/hooks';
 */

// ── Backtest & Strategy ──────────────────────────────────────────────────────
export { useBacktest } from './useBacktest';
export type { BacktestState, BacktestActions } from './useBacktest';

// ── Options ──────────────────────────────────────────────────────────────────
export { useOptions } from './useOptions';
export type { OptionsState, OptionsActions } from './useOptions';

// ── Portfolio ────────────────────────────────────────────────────────────────
export { usePortfolio } from './usePortfolio';
export type { PortfolioState, PortfolioActions } from './usePortfolio';

// ── Risk ─────────────────────────────────────────────────────────────────────
export { useRisk } from './useRisk';
export type { RiskState, RiskActions } from './useRisk';

// ── Indicators ───────────────────────────────────────────────────────────────
export { useIndicators } from './useIndicators';
export type { IndicatorsState, IndicatorsActions } from './useIndicators';

// ── Orders & Execution ───────────────────────────────────────────────────────
export { useOrders } from './useOrders';
export type { OrdersState, OrdersActions } from './useOrders';

// ── Market Data ──────────────────────────────────────────────────────────────
export { useMarketData } from './useMarketData';
export type { MarketDataState, MarketDataActions } from './useMarketData';

// ── Machine Learning ─────────────────────────────────────────────────────────
export { useML } from './useML';
export type { MLState, MLActions } from './useML';

// ── Alerts ───────────────────────────────────────────────────────────────────
export { useAlerts } from './useAlerts';
export type { AlertsState, AlertsActions } from './useAlerts';

// ── Forex ────────────────────────────────────────────────────────────────────
export { useFX } from './useFX';
export type { FXState, FXActions } from './useFX';

// ── Commodities ──────────────────────────────────────────────────────────────
export { useCommodities } from './useCommodities';
export type { CommoditiesState, CommoditiesActions } from './useCommodities';

// ── Crypto ───────────────────────────────────────────────────────────────────
export { useCrypto } from './useCrypto';
export type { CryptoState, CryptoActions } from './useCrypto';

// ── Drawing Tools ────────────────────────────────────────────────────────────
export { useDrawing } from './useDrawing';
export type { DrawingState, DrawingActions } from './useDrawing';

// ── Chart Types ──────────────────────────────────────────────────────────────
export { useChartTypes } from './useChartTypes';
export type { ChartTypesState, ChartTypesActions } from './useChartTypes';

// ── Reporting ────────────────────────────────────────────────────────────────
export { useReporting } from './useReporting';
export type { ReportingState, ReportingActions } from './useReporting';

// ── Platform ─────────────────────────────────────────────────────────────────
export { usePlatform } from './usePlatform';
export type { PlatformState, PlatformActions } from './usePlatform';

// ── Social ───────────────────────────────────────────────────────────────────
export { useSocial } from './useSocial';
export type { SocialState, SocialActions } from './useSocial';
