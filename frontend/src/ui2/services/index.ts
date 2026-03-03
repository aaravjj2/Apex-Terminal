/**
 * Services barrel — re-exports all service classes
 */

export { MarketDataService, getMarketDataService, resetMarketDataService, BarAggregator, VwapCalculator, TickBuffer, MockMarketDataGenerator, timeframeToMs, timeframeLabel } from './MarketDataService';
export type { Tick, Quote, Bar, Timeframe, MarketDataSubscription, FeedConfig, MarketStatus } from './MarketDataService';

export { OrderExecutionService, getOrderExecutionService, resetOrderExecutionService } from './OrderExecutionService';
export type { Order, Fill, Position, OrderSide, OrderType, OrderStatus, TimeInForce, RiskCheck, ExecutionConfig, TCAResult } from './OrderExecutionService';

export { WebSocketService, getWebSocketService, removeWebSocketService, removeAllWebSocketServices } from './WebSocketService';
export type { ConnectionStatus, WebSocketConfig, Subscription, WebSocketMessage, WebSocketStats } from './WebSocketService';

export { AnalyticsService, getAnalyticsService, resetAnalyticsService } from './AnalyticsService';
export type { AnalyticsEvent, PageView, PerformanceMetric, UserJourney, AnalyticsConfig } from './AnalyticsService';
