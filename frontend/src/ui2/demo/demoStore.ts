/**
 * UI2 Demo Store
 * Deterministic in-memory state for all UI2 screens
 * No network calls, stable IDs, stable ordering
 */

import { DEMO_TIMESTAMP } from './constants';

// ──────────────────────────────────────────────────────────────
// INSTRUMENTS & QUOTES
// ──────────────────────────────────────────────────────────────

export interface Instrument {
  symbol: string;
  name: string;
  type: 'stock' | 'option' | 'crypto';
  sector?: string;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change: number;
  changePct: number;
  timestamp: number;
}

export const DEMO_INSTRUMENTS: Instrument[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'stock', sector: 'Financial' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', sector: 'Consumer Cyclical' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock', sector: 'Technology' },
];

export { DEMO_QUOTES } from './canonicalDemo';

// ──────────────────────────────────────────────────────────────
// POSITIONS, ORDERS, TRADES
// ──────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  marketValue: number;
  costBasis: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'partialFill' | 'canceled' | 'rejected';
  filledQty: number;
  timestamp: number;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  timestamp: number;
}

export const DEMO_POSITIONS: Position[] = [
  { id: 'pos-1', symbol: 'SPY', quantity: 150, avgPrice: 535.20, currentPrice: 547.23, unrealizedPL: 1804.50, unrealizedPLPct: 2.24, marketValue: 82084.50, costBasis: 80280.00 },
  { id: 'pos-2', symbol: 'AAPL', quantity: 200, avgPrice: 185.30, currentPrice: 182.41, unrealizedPL: -578.00, unrealizedPLPct: -1.56, marketValue: 36482.00, costBasis: 37060.00 },
  { id: 'pos-3', symbol: 'TSLA', quantity: 75, avgPrice: 210.15, currentPrice: 218.77, unrealizedPL: 646.50, unrealizedPLPct: 4.10, marketValue: 16407.75, costBasis: 15761.25 },
  { id: 'pos-4', symbol: 'NVDA', quantity: 50, avgPrice: 805.40, currentPrice: 789.55, unrealizedPL: -792.50, unrealizedPLPct: -1.97, marketValue: 39477.50, costBasis: 40270.00 },
];

export const DEMO_ORDERS: Order[] = [
  { id: 'ord-1', symbol: 'MSFT', side: 'buy', type: 'limit', quantity: 100, limitPrice: 410.00, status: 'pending', filledQty: 0, timestamp: DEMO_TIMESTAMP - 300000 },
  { id: 'ord-2', symbol: 'AMZN', side: 'sell', type: 'market', quantity: 50, status: 'filled', filledQty: 50, timestamp: DEMO_TIMESTAMP - 120000 },
  { id: 'ord-3', symbol: 'GOOGL', side: 'buy', type: 'stop', quantity: 25, stopPrice: 150.00, status: 'pending', filledQty: 0, timestamp: DEMO_TIMESTAMP - 60000 },
];

export const DEMO_TRADES: Trade[] = [
  { id: 'trd-1', orderId: 'ord-2', symbol: 'AMZN', side: 'sell', quantity: 50, price: 178.92, commission: 0.50, timestamp: DEMO_TIMESTAMP - 118000 },
  { id: 'trd-2', orderId: 'ord-5', symbol: 'SPY', side: 'buy', quantity: 150, price: 535.20, commission: 0.75, timestamp: DEMO_TIMESTAMP - 3600000 },
];

// ──────────────────────────────────────────────────────────────
// PORTFOLIOS & VALUATIONS
// ──────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  cash: number;
  totalValue: number;
  dayPL: number;
  dayPLPct: number;
  totalPL: number;
  totalPLPct: number;
  positionCount: number;
  createdAt: number;
}

export const DEMO_PORTFOLIOS: Portfolio[] = [
  {
    id: 'pf-1',
    name: 'Main Trading',
    description: 'Primary portfolio for active trading',
    cash: 25420.75,
    totalValue: 199872.50,
    dayPL: 1080.50,
    dayPLPct: 0.54,
    totalPL: 14872.50,
    totalPLPct: 8.04,
    positionCount: 4,
    createdAt: DEMO_TIMESTAMP - 86400000 * 30,
  },
  {
    id: 'pf-2',
    name: 'Long-term Growth',
    description: 'Buy and hold growth stocks',
    cash: 8320.00,
    totalValue: 85230.00,
    dayPL: -245.00,
    dayPLPct: -0.29,
    totalPL: 5230.00,
    totalPLPct: 6.54,
    positionCount: 6,
    createdAt: DEMO_TIMESTAMP - 86400000 * 90,
  },
];

// ──────────────────────────────────────────────────────────────
// STRATEGIES & ARTIFACTS
// ──────────────────────────────────────────────────────────────

export interface Strategy {
  id: string;
  name: string;
  type: 'momentum' | 'meanReversion' | 'breakout' | 'custom';
  symbol: string;
  status: 'draft' | 'validated' | 'backtested' | 'live';
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Artifact {
  id: string;
  strategyId: string;
  type: 'backtest' | 'validation' | 'export';
  name: string;
  status: 'running' | 'completed' | 'failed';
  size: number;
  createdAt: number;
}

export const DEMO_STRATEGIES: Strategy[] = [
  { id: 'strat-1', name: 'RSI Oversold Bounce', type: 'meanReversion', symbol: 'MSFT', status: 'backtested', version: 3, createdAt: DEMO_TIMESTAMP - 86400000 * 7, updatedAt: DEMO_TIMESTAMP - 3600000 },
  { id: 'strat-2', name: 'Momentum Breakout', type: 'breakout', symbol: 'NVDA', status: 'validated', version: 2, createdAt: DEMO_TIMESTAMP - 86400000 * 5, updatedAt: DEMO_TIMESTAMP - 7200000 },
  { id: 'strat-3', name: 'VWAP Mean Reversion', type: 'meanReversion', symbol: 'SPY', status: 'draft', version: 1, createdAt: DEMO_TIMESTAMP - 86400000 * 2, updatedAt: DEMO_TIMESTAMP - 3600000 },
];

export const DEMO_ARTIFACTS: Artifact[] = [
  { id: 'art-1', strategyId: 'strat-1', type: 'backtest', name: 'RSI_MSFT_20260208.zip', status: 'completed', size: 2_450_000, createdAt: DEMO_TIMESTAMP - 3600000 },
  { id: 'art-2', strategyId: 'strat-1', type: 'validation', name: 'RSI_MSFT_validate.json', status: 'completed', size: 45_000, createdAt: DEMO_TIMESTAMP - 7200000 },
  { id: 'art-3', strategyId: 'strat-2', type: 'backtest', name: 'Momentum_NVDA_20260210.zip', status: 'completed', size: 1_850_000, createdAt: DEMO_TIMESTAMP - 10800000 },
];

// ──────────────────────────────────────────────────────────────
// BACKTESTS & RISK RUNS
// ──────────────────────────────────────────────────────────────

export interface BacktestRun {
  id: string;
  strategyId: string;
  symbol: string;
  startDate: number;
  endDate: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sharpeRatio?: number;
  totalReturn?: number;
  maxDrawdown?: number;
  winRate?: number;
  tradeCount?: number;
  createdAt: number;
}

export interface RiskRun {
  id: string;
  portfolioId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  var95?: number; // Value at Risk 95%
  cvar95?: number; // Conditional VaR 95%
  sharpe?: number;
  maxDrawdown?: number;
  createdAt: number;
}

export const DEMO_BACKTEST_RUNS: BacktestRun[] = [
  {
    id: 'bt-1',
    strategyId: 'strat-1',
    symbol: 'MSFT',
    startDate: DEMO_TIMESTAMP - 86400000 * 365,
    endDate: DEMO_TIMESTAMP - 86400000 * 30,
    status: 'completed',
    sharpeRatio: 1.85,
    totalReturn: 24.5,
    maxDrawdown: 8.2,
    winRate: 62.5,
    tradeCount: 48,
    createdAt: DEMO_TIMESTAMP - 3600000,
  },
  {
    id: 'bt-2',
    strategyId: 'strat-2',
    symbol: 'NVDA',
    startDate: DEMO_TIMESTAMP - 86400000 * 180,
    endDate: DEMO_TIMESTAMP - 86400000 * 10,
    status: 'completed',
    sharpeRatio: 2.15,
    totalReturn: 38.2,
    maxDrawdown: 12.4,
    winRate: 58.3,
    tradeCount: 36,
    createdAt: DEMO_TIMESTAMP - 10800000,
  },
];

export const DEMO_RISK_RUNS: RiskRun[] = [
  {
    id: 'risk-1',
    portfolioId: 'pf-1',
    name: 'Main Trading Risk Assessment',
    status: 'completed',
    var95: 4850.00,
    cvar95: 6200.00,
    sharpe: 1.45,
    maxDrawdown: 7.8,
    createdAt: DEMO_TIMESTAMP - 1800000,
  },
  {
    id: 'risk-2',
    portfolioId: 'pf-2',
    name: 'Long-term Growth Stress Test',
    status: 'completed',
    var95: 2100.00,
    cvar95: 2850.00,
    sharpe: 1.92,
    maxDrawdown: 5.2,
    createdAt: DEMO_TIMESTAMP - 3600000,
  },
];

// ──────────────────────────────────────────────────────────────
// AUTOPILOT
// ──────────────────────────────────────────────────────────────

export interface AutopilotLog {
  id: string;
  timestamp: number;
  agent: 'sentiment' | 'technical' | 'fundamental' | 'orchestrator';
  level: 'info' | 'decision' | 'trade' | 'error';
  symbol?: string;
  message: string;
  confidence?: number;
  action?: 'buy' | 'sell' | 'hold';
}

export const DEMO_AUTOPILOT_LOGS: AutopilotLog[] = [
  { id: 'ap-1', timestamp: DEMO_TIMESTAMP - 60000, agent: 'technical', level: 'decision', symbol: 'SPY', message: 'RSI oversold (28.5), momentum turning', confidence: 0.78, action: 'buy' },
  { id: 'ap-2', timestamp: DEMO_TIMESTAMP - 120000, agent: 'sentiment', level: 'info', symbol: 'TSLA', message: 'Social sentiment positive (score: 0.72)', confidence: 0.72 },
  { id: 'ap-3', timestamp: DEMO_TIMESTAMP - 180000, agent: 'orchestrator', level: 'trade', symbol: 'AMZN', message: 'Sold 50 shares at $178.92', action: 'sell' },
  { id: 'ap-4', timestamp: DEMO_TIMESTAMP - 240000, agent: 'fundamental', level: 'info', symbol: 'AAPL', message: 'Earnings beat expected, revenue +8%', confidence: 0.85 },
  { id: 'ap-5', timestamp: DEMO_TIMESTAMP - 300000, agent: 'technical', level: 'decision', symbol: 'NVDA', message: 'MACD bearish crossover, avoid longs', confidence: 0.65, action: 'hold' },
];

// ──────────────────────────────────────────────────────────────
// INCIDENTS & AGENTS
// ──────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  type: 'sentiment' | 'technical' | 'fundamental' | 'orchestrator';
  status: 'active' | 'idle' | 'error';
  uptime: number; // seconds
  requestCount: number;
  errorCount: number;
}

export const DEMO_INCIDENTS: Incident[] = [
  { id: 'inc-1', severity: 'warning', title: 'High API latency detected', description: 'Market data feed latency increased to 150ms', status: 'investigating', timestamp: DEMO_TIMESTAMP - 300000 },
  { id: 'inc-2', severity: 'info', title: 'WebSocket reconnect', description: 'Primary WS connection reestablished after 2s downtime', status: 'resolved', timestamp: DEMO_TIMESTAMP - 1800000 },
];

export const DEMO_AGENTS: Agent[] = [
  { id: 'agent-1', name: 'Sentiment Analyzer', type: 'sentiment', status: 'active', uptime: 3600, requestCount: 245, errorCount: 0 },
  { id: 'agent-2', name: 'Technical Scanner', type: 'technical', status: 'active', uptime: 3600, requestCount: 512, errorCount: 2 },
  { id: 'agent-3', name: 'Fundamental Screener', type: 'fundamental', status: 'idle', uptime: 3600, requestCount: 128, errorCount: 0 },
  { id: 'agent-4', name: 'Orchestrator', type: 'orchestrator', status: 'active', uptime: 3600, requestCount: 98, errorCount: 0 },
];

// ──────────────────────────────────────────────────────────────
// PLATFORM HEALTH
// ──────────────────────────────────────────────────────────────

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number; // ms
  uptime: number; // %
  lastCheck: number;
}

export const DEMO_HEALTH: HealthCheck[] = [
  { service: 'API Gateway', status: 'healthy', latency: 23, uptime: 99.98, lastCheck: DEMO_TIMESTAMP },
  { service: 'Market Data', status: 'healthy', latency: 45, uptime: 99.95, lastCheck: DEMO_TIMESTAMP },
  { service: 'Order Execution', status: 'healthy', latency: 18, uptime: 99.99, lastCheck: DEMO_TIMESTAMP },
  { service: 'Risk Engine', status: 'degraded', latency: 120, uptime: 98.50, lastCheck: DEMO_TIMESTAMP },
  { service: 'WebSocket', status: 'healthy', latency: 12, uptime: 99.92, lastCheck: DEMO_TIMESTAMP },
];
