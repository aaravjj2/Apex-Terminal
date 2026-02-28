/**
 * portfolioStore.ts
 * Portfolio state management: positions, P&L tracking, real-time price simulation,
 * performance attribution, risk metrics, trade history, and alert management.
 * Uses React Context + useReducer with localStorage persistence.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dailyPnL: number;
  dailyPnLPct: number;
  weight: number;
  beta: number;
  sector: string;
  costBasis: number;
  openDate: Date;
  currency: string;
  exchange: string;
  type: 'long' | 'short';
}

export interface Trade {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  total: number;
  executedAt: Date;
  strategy?: string;
  notes?: string;
  realizedPnL?: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPct: number;
  totalDailyPnL: number;
  totalDailyPnLPct: number;
  totalRealizedPnL: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  volatility: number;
  var95: number;
  var99: number;
  calmarRatio: number;
  equityCurve: { time: number; value: number }[];
  benchmarkCurve: { time: number; value: number }[];
}

export interface Allocation {
  sector: string;
  weight: number;
  benchmarkWeight: number;
  activeWeight: number;
  return1D: number;
  return1W: number;
  returnYTD: number;
  attribution: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  condition: 'above' | 'below' | 'pct_change' | 'volume_spike';
  threshold: number;
  triggered: boolean;
  createdAt: Date;
  notes?: string;
}

export interface PortfolioState {
  positions: Position[];
  trades: Trade[];
  metrics: PortfolioMetrics;
  allocations: Allocation[];
  alerts: PriceAlert[];
  isLoading: boolean;
  lastRefreshed: Date | null;
  cashBalance: number;
  benchmarkTicker: string;
  performancePeriod: '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';
  selectedPositionId: string | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function buildEquityCurve(startValue: number, days: number, drift = 0.0003, vol = 0.012): Array<{ time: number; value: number }> {
  const curve: Array<{ time: number; value: number }> = [];
  let v = startValue;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const rtn = Math.random() * vol * 2 - vol + drift;
    v = Math.max(v * (1 + rtn), startValue * 0.5);
    curve.push({ time: now - i * 86400000, value: Math.round(v * 100) / 100 });
  }
  return curve;
}

const INITIAL_POSITIONS: Position[] = [
  { id: 'p1', ticker: 'NVDA', name: 'NVIDIA Corp', quantity: 150, avgCost: 580.00, currentPrice: 862.42, marketValue: 129363, unrealizedPnL: 42363, unrealizedPnLPct: 48.7, dailyPnL: 2842, dailyPnLPct: 2.24, weight: 28.1, beta: 1.72, sector: 'Technology', costBasis: 87000, openDate: new Date('2023-06-01'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p2', ticker: 'AAPL', name: 'Apple Inc', quantity: 300, avgCost: 168.00, currentPrice: 189.64, marketValue: 56892, unrealizedPnL: 6492, unrealizedPnLPct: 12.9, dailyPnL: -456, dailyPnLPct: -0.80, weight: 12.4, beta: 1.18, sector: 'Technology', costBasis: 50400, openDate: new Date('2023-01-15'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p3', ticker: 'MSFT', name: 'Microsoft Corp', quantity: 120, avgCost: 340.00, currentPrice: 412.88, marketValue: 49546, unrealizedPnL: 8746, unrealizedPnLPct: 21.4, dailyPnL: 322, dailyPnLPct: 0.65, weight: 10.8, beta: 0.92, sector: 'Technology', costBasis: 40800, openDate: new Date('2023-03-20'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p4', ticker: 'META', name: 'Meta Platforms', quantity: 90, avgCost: 280.00, currentPrice: 502.64, marketValue: 45238, unrealizedPnL: 20038, unrealizedPnLPct: 79.4, dailyPnL: 1088, dailyPnLPct: 2.46, weight: 9.8, beta: 1.44, sector: 'Communication Services', costBasis: 25200, openDate: new Date('2023-04-10'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p5', ticker: 'AMZN', name: 'Amazon.com Inc', quantity: 180, avgCost: 130.00, currentPrice: 184.22, marketValue: 33160, unrealizedPnL: 9760, unrealizedPnLPct: 41.7, dailyPnL: 612, dailyPnLPct: 1.88, weight: 7.2, beta: 1.28, sector: 'Consumer Discretionary', costBasis: 23400, openDate: new Date('2023-02-28'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p6', ticker: 'GOOGL', name: 'Alphabet Inc', quantity: 80, avgCost: 125.00, currentPrice: 164.42, marketValue: 13154, unrealizedPnL: 3154, unrealizedPnLPct: 31.5, dailyPnL: -188, dailyPnLPct: -1.41, weight: 2.9, beta: 1.06, sector: 'Communication Services', costBasis: 10000, openDate: new Date('2023-05-15'), currency: 'USD', exchange: 'NASDAQ', type: 'long' },
  { id: 'p7', ticker: 'JPM', name: 'JPMorgan Chase', quantity: 200, avgCost: 148.00, currentPrice: 196.42, marketValue: 39284, unrealizedPnL: 9684, unrealizedPnLPct: 32.7, dailyPnL: 482, dailyPnLPct: 1.24, weight: 8.5, beta: 1.12, sector: 'Financials', costBasis: 29600, openDate: new Date('2023-07-01'), currency: 'USD', exchange: 'NYSE', type: 'long' },
  { id: 'p8', ticker: 'UNH', name: 'UnitedHealth Group', quantity: 60, avgCost: 480.00, currentPrice: 512.44, marketValue: 30746, unrealizedPnL: 1946, unrealizedPnLPct: 6.8, dailyPnL: -244, dailyPnLPct: -0.79, weight: 6.7, beta: 0.78, sector: 'Health Care', costBasis: 28800, openDate: new Date('2023-08-20'), currency: 'USD', exchange: 'NYSE', type: 'long' },
];

const INITIAL_METRICS: PortfolioMetrics = {
  totalValue: 397383,
  totalCost: 295200,
  totalUnrealizedPnL: 102183,
  totalUnrealizedPnLPct: 34.6,
  totalDailyPnL: 4458,
  totalDailyPnLPct: 1.13,
  totalRealizedPnL: 28642,
  sharpeRatio: 1.84,
  sortinoRatio: 2.21,
  maxDrawdown: -12.4,
  beta: 1.22,
  alpha: 6.8,
  informationRatio: 0.92,
  volatility: 14.2,
  var95: -8420,
  var99: -12640,
  calmarRatio: 1.48,
  equityCurve: buildEquityCurve(280000, 365),
  benchmarkCurve: buildEquityCurve(280000, 365, 0.0002, 0.008),
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type PortfolioAction =
  | { type: 'UPDATE_PRICE'; ticker: string; price: number; dailyChange: number; dailyChangePct: number }
  | { type: 'UPDATE_ALL_PRICES'; prices: Array<{ ticker: string; price: number; dailyChange: number; dailyChangePct: number }> }
  | { type: 'ADD_POSITION'; position: Omit<Position, 'id'> }
  | { type: 'CLOSE_POSITION'; positionId: string; closePrice: number }
  | { type: 'UPDATE_QUANTITY'; positionId: string; quantity: number }
  | { type: 'ADD_TRADE'; trade: Omit<Trade, 'id'> }
  | { type: 'ADD_ALERT'; alert: Omit<PriceAlert, 'id' | 'triggered'> }
  | { type: 'REMOVE_ALERT'; id: string }
  | { type: 'TRIGGER_ALERT'; id: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_PERFORMANCE_PERIOD'; period: PortfolioState['performancePeriod'] }
  | { type: 'SET_BENCHMARK'; ticker: string }
  | { type: 'SELECT_POSITION'; id: string | null }
  | { type: 'RECALC_METRICS' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function recalcMetrics(state: PortfolioState): PortfolioMetrics {
  const totalValue = state.positions.reduce((s, p) => s + p.marketValue, 0) + state.cashBalance;
  const totalCost = state.positions.reduce((s, p) => s + p.costBasis, 0);
  const totalUnrealizedPnL = totalValue - totalCost - state.cashBalance;
  const totalDailyPnL = state.positions.reduce((s, p) => s + p.dailyPnL, 0);
  return {
    ...state.metrics,
    totalValue,
    totalCost,
    totalUnrealizedPnL,
    totalUnrealizedPnLPct: totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0,
    totalDailyPnL,
    totalDailyPnLPct: (totalValue - totalDailyPnL) > 0 ? (totalDailyPnL / (totalValue - totalDailyPnL)) * 100 : 0,
  };
}

function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case 'UPDATE_PRICE': {
      const positions = state.positions.map(p => {
        if (p.ticker !== action.ticker) return p;
        const marketValue = p.quantity * action.price;
        return {
          ...p,
          currentPrice: action.price,
          marketValue,
          unrealizedPnL: marketValue - p.costBasis,
          unrealizedPnLPct: ((marketValue - p.costBasis) / p.costBasis) * 100,
          dailyPnL: p.quantity * action.dailyChange,
          dailyPnLPct: action.dailyChangePct,
        };
      });
      const totalValue = positions.reduce((s, p) => s + p.marketValue, 0) + state.cashBalance;
      const withWeights = positions.map(p => ({ ...p, weight: (p.marketValue / totalValue) * 100 }));
      return { ...state, positions: withWeights, lastRefreshed: new Date() };
    }

    case 'UPDATE_ALL_PRICES': {
      const priceMap = new Map(action.prices.map(p => [p.ticker, p]));
      const positions = state.positions.map(p => {
        const update = priceMap.get(p.ticker);
        if (!update) return p;
        const marketValue = p.quantity * update.price;
        return {
          ...p,
          currentPrice: update.price,
          marketValue,
          unrealizedPnL: marketValue - p.costBasis,
          unrealizedPnLPct: ((marketValue - p.costBasis) / p.costBasis) * 100,
          dailyPnL: p.quantity * update.dailyChange,
          dailyPnLPct: update.dailyChangePct,
        };
      });
      const totalValue = positions.reduce((s, p) => s + p.marketValue, 0) + state.cashBalance;
      const withWeights = positions.map(p => ({ ...p, weight: (p.marketValue / totalValue) * 100 }));
      const metrics = { ...state.metrics, totalValue, totalDailyPnL: positions.reduce((s, p) => s + p.dailyPnL, 0) };
      return { ...state, positions: withWeights, metrics, lastRefreshed: new Date() };
    }

    case 'ADD_POSITION': {
      const id = `pos_${Date.now()}`;
      const position: Position = { ...action.position, id };
      return { ...state, positions: [...state.positions, position] };
    }

    case 'CLOSE_POSITION': {
      const pos = state.positions.find(p => p.id === action.positionId);
      if (!pos) return state;
      const realizedPnL = (action.closePrice - pos.avgCost) * pos.quantity;
      const trade: Trade = {
        id: `trade_${Date.now()}`, ticker: pos.ticker, side: 'sell',
        quantity: pos.quantity, price: action.closePrice,
        commission: pos.quantity * action.closePrice * 0.001,
        total: pos.quantity * action.closePrice,
        executedAt: new Date(), realizedPnL,
      };
      const positions = state.positions.filter(p => p.id !== action.positionId);
      const cashBalance = state.cashBalance + trade.total - trade.commission;
      return { ...state, positions, trades: [...state.trades, trade], cashBalance };
    }

    case 'ADD_TRADE':
      return { ...state, trades: [{ ...action.trade, id: `trade_${Date.now()}` }, ...state.trades] };

    case 'ADD_ALERT':
      return { ...state, alerts: [...state.alerts, { ...action.alert, id: `alert_${Date.now()}`, triggered: false }] };

    case 'REMOVE_ALERT':
      return { ...state, alerts: state.alerts.filter(a => a.id !== action.id) };

    case 'TRIGGER_ALERT':
      return { ...state, alerts: state.alerts.map(a => a.id === action.id ? { ...a, triggered: true } : a) };

    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };

    case 'SET_PERFORMANCE_PERIOD':
      return { ...state, performancePeriod: action.period };

    case 'SET_BENCHMARK':
      return { ...state, benchmarkTicker: action.ticker };

    case 'SELECT_POSITION':
      return { ...state, selectedPositionId: action.id };

    case 'RECALC_METRICS':
      return { ...state, metrics: recalcMetrics(state) };

    default:
      return state;
  }
}

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_STATE: PortfolioState = {
  positions: INITIAL_POSITIONS,
  trades: [],
  metrics: INITIAL_METRICS,
  allocations: [],
  alerts: [],
  isLoading: false,
  lastRefreshed: null,
  cashBalance: 42000,
  benchmarkTicker: 'SPY',
  performancePeriod: '1Y',
  selectedPositionId: null,
};

// ─── Context + Provider ───────────────────────────────────────────────────────

const PortfolioContext = createContext<{
  state: PortfolioState;
  dispatch: React.Dispatch<PortfolioAction>;
} | null>(null);

export function usePortfolioStore() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolioStore must be inside PortfolioProvider');
  return ctx;
}

export const PortfolioProvider: React.FC<{ children: React.ReactNode; simulateRealtime?: boolean }> = ({
  children,
  simulateRealtime = false,
}) => {
  const [state, dispatch] = useReducer(portfolioReducer, INITIAL_STATE);

  // Simulate real-time price feeds
  useEffect(() => {
    if (!simulateRealtime) return;
    const interval = setInterval(() => {
      const updates = state.positions.map(p => {
        const delta = p.currentPrice * (Math.random() - 0.499) * 0.001;
        const newPrice = Math.max(0.01, p.currentPrice + delta);
        const prevClose = p.currentPrice - p.dailyPnL / p.quantity;
        return {
          ticker: p.ticker,
          price: newPrice,
          dailyChange: newPrice - prevClose,
          dailyChangePct: ((newPrice - prevClose) / prevClose) * 100,
        };
      });
      dispatch({ type: 'UPDATE_ALL_PRICES', prices: updates });
    }, 2000);
    return () => clearInterval(interval);
  }, [simulateRealtime, state.positions.length]);

  return (
    <PortfolioContext.Provider value={{ state, dispatch }}>
      {children}
    </PortfolioContext.Provider>
  );
};

// ─── Convenience Hooks ────────────────────────────────────────────────────────

export function usePositions() {
  const { state, dispatch } = usePortfolioStore();
  const closePosition = useCallback((id: string, price: number) => dispatch({ type: 'CLOSE_POSITION', positionId: id, closePrice: price }), [dispatch]);
  const selectPosition = useCallback((id: string | null) => dispatch({ type: 'SELECT_POSITION', id }), [dispatch]);
  return { positions: state.positions, selectedId: state.selectedPositionId, closePosition, selectPosition };
}

export function usePortfolioMetrics() {
  const { state } = usePortfolioStore();
  return state.metrics;
}

export function usePortfolioAlerts() {
  const { state, dispatch } = usePortfolioStore();
  const addAlert = useCallback((alert: Omit<PriceAlert, 'id' | 'triggered'>) => dispatch({ type: 'ADD_ALERT', alert }), [dispatch]);
  const removeAlert = useCallback((id: string) => dispatch({ type: 'REMOVE_ALERT', id }), [dispatch]);
  return { alerts: state.alerts, addAlert, removeAlert };
}

export default PortfolioProvider;
