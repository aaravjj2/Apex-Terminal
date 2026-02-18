/**
 * UI2 Demo Hooks
 * React hooks for accessing deterministic demo data
 * Simulates async queries with instant resolution
 */

import { useState, useEffect, useCallback } from 'react';
import * as store from './demoStore';

// Query status type
export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryResult<T> {
  data: T | null;
  status: QueryStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
}

// In-memory store for mutable state
let demoState = {
  portfolios: [...store.DEMO_PORTFOLIOS],
  positions: [...store.DEMO_POSITIONS],
  orders: [...store.DEMO_ORDERS],
  trades: [...store.DEMO_TRADES],
  strategies: [...store.DEMO_STRATEGIES],
  artifacts: [...store.DEMO_ARTIFACTS],
  backtests: [...store.DEMO_BACKTEST_RUNS],
  riskRuns: [...store.DEMO_RISK_RUNS],
  autopilotLogs: [...store.DEMO_AUTOPILOT_LOGS],
  incidents: [...store.DEMO_INCIDENTS],
  agents: [...store.DEMO_AGENTS],
};

// Subscribers for state changes
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(fn => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

// ──────────────────────────────────────────────────────────────
// QUERY HOOKS
// ──────────────────────────────────────────────────────────────

export function useDemoQuery<T>(
  key: string,
  fetcher: () => T,
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<QueryStatus>('loading');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate instant async resolution
    const timer = setTimeout(() => {
      try {
        const result = fetcher();
        setData(result);
        setStatus('success');
      } catch (err) {
        setError(err as Error);
        setStatus('error');
      }
    }, 10); // 10ms simulated latency

    return () => clearTimeout(timer);
  }, [key]);

  return {
    data,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
  };
}

// ──────────────────────────────────────────────────────────────
// SPECIFIC ENTITY HOOKS
// ──────────────────────────────────────────────────────────────

export function useInstruments() {
  return useDemoQuery('instruments', () => store.DEMO_INSTRUMENTS);
}

export function useQuotes() {
  return useDemoQuery('quotes', () => store.DEMO_QUOTES);
}

export function usePositions() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('positions', () => demoState.positions);
}

export function useOrders() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('orders', () => demoState.orders);
}

export function useTrades() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('trades', () => demoState.trades);
}

export function usePortfolios() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('portfolios', () => demoState.portfolios);
}

export function usePortfolio(id: string) {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery(`portfolio-${id}`, () => 
    demoState.portfolios.find(p => p.id === id) || null
  );
}

export function useStrategies() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('strategies', () => demoState.strategies);
}

export function useStrategy(id: string) {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery(`strategy-${id}`, () =>
    demoState.strategies.find(s => s.id === id) || null
  );
}

export function useArtifacts(strategyId?: string) {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery(`artifacts-${strategyId || 'all'}`, () =>
    strategyId
      ? demoState.artifacts.filter(a => a.strategyId === strategyId)
      : demoState.artifacts
  );
}

export function useBacktests(strategyId?: string) {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery(`backtests-${strategyId || 'all'}`, () =>
    strategyId
      ? demoState.backtests.filter(b => b.strategyId === strategyId)
      : demoState.backtests
  );
}

export function useRiskRuns(portfolioId?: string) {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery(`risk-${portfolioId || 'all'}`, () =>
    portfolioId
      ? demoState.riskRuns.filter(r => r.portfolioId === portfolioId)
      : demoState.riskRuns
  );
}

export function useAutopilotLogs() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('autopilot-logs', () => 
    [...demoState.autopilotLogs].sort((a, b) => b.timestamp - a.timestamp)
  );
}

export function useIncidents() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('incidents', () => demoState.incidents);
}

export function useAgents() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);
  return useDemoQuery('agents', () => demoState.agents);
}

export function useHealth() {
  return useDemoQuery('health', () => store.DEMO_HEALTH);
}

// ──────────────────────────────────────────────────────────────
// MUTATION ACTIONS
// ──────────────────────────────────────────────────────────────

export function useDemoActions() {
  // Portfolio actions
  const createPortfolio = useCallback((name: string, description: string) => {
    const newPortfolio: store.Portfolio = {
      id: `pf-${Date.now()}`,
      name,
      description,
      cash: 100000,
      totalValue: 100000,
      dayPL: 0,
      dayPLPct: 0,
      totalPL: 0,
      totalPLPct: 0,
      positionCount: 0,
      createdAt: Date.now(),
    };
    demoState.portfolios.push(newPortfolio);
    notifySubscribers();
    return newPortfolio;
  }, []);

  const deletePortfolio = useCallback((id: string) => {
    demoState.portfolios = demoState.portfolios.filter(p => p.id !== id);
    notifySubscribers();
  }, []);

  // Strategy actions
  const createStrategy = useCallback((name: string, type: store.Strategy['type'], symbol: string) => {
    const newStrategy: store.Strategy = {
      id: `strat-${Date.now()}`,
      name,
      type,
      symbol,
      status: 'draft',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    demoState.strategies.push(newStrategy);
    notifySubscribers();
    return newStrategy;
  }, []);

  const validateStrategy = useCallback((id: string) => {
    const strategy = demoState.strategies.find(s => s.id === id);
    if (strategy) {
      strategy.status = 'validated';
      strategy.updatedAt = Date.now();
      notifySubscribers();
    }
  }, []);

  const deleteStrategy = useCallback((id: string) => {
    demoState.strategies = demoState.strategies.filter(s => s.id !== id);
    demoState.artifacts = demoState.artifacts.filter(a => a.strategyId !== id);
    demoState.backtests = demoState.backtests.filter(b => b.strategyId !== id);
    notifySubscribers();
  }, []);

  // Backtest actions
  const runBacktest = useCallback((strategyId: string, symbol: string, startDate: number, endDate: number) => {
    const newBacktest: store.BacktestRun = {
      id: `bt-${Date.now()}`,
      strategyId,
      symbol,
      startDate,
      endDate,
      status: 'running',
      createdAt: Date.now(),
    };
    demoState.backtests.push(newBacktest);
    notifySubscribers();

    // Simulate completion after 2 seconds
    setTimeout(() => {
      newBacktest.status = 'completed';
      newBacktest.sharpeRatio = 1.5 + Math.random();
      newBacktest.totalReturn = 15 + Math.random() * 20;
      newBacktest.maxDrawdown = 5 + Math.random() * 10;
      newBacktest.winRate = 55 + Math.random() * 15;
      newBacktest.tradeCount = Math.floor(30 + Math.random() * 50);
      notifySubscribers();
    }, 2000);

    return newBacktest;
  }, []);

  // Risk run actions
  const runRiskAnalysis = useCallback((portfolioId: string, name: string) => {
    const newRun: store.RiskRun = {
      id: `risk-${Date.now()}`,
      portfolioId,
      name,
      status: 'running',
      createdAt: Date.now(),
    };
    demoState.riskRuns.push(newRun);
    notifySubscribers();

    // Simulate completion after 3 seconds
    setTimeout(() => {
      newRun.status = 'completed';
      newRun.var95 = 2000 + Math.random() * 4000;
      newRun.cvar95 = 3000 + Math.random() * 5000;
      newRun.sharpe = 1.0 + Math.random() * 1.5;
      newRun.maxDrawdown = 4 + Math.random() * 8;
      notifySubscribers();
    }, 3000);

    return newRun;
  }, []);

  // Order actions
  const placeOrder = useCallback((symbol: string, side: 'buy' | 'sell', quantity: number, type: 'market' | 'limit', limitPrice?: number) => {
    const newOrder: store.Order = {
      id: `ord-${Date.now()}`,
      symbol,
      side,
      type,
      quantity,
      limitPrice,
      status: 'pending',
      filledQty: 0,
      timestamp: Date.now(),
    };
    demoState.orders.push(newOrder);
    notifySubscribers();

    // Simulate fill for market orders
    if (type === 'market') {
      setTimeout(() => {
        newOrder.status = 'filled';
        newOrder.filledQty = quantity;
        notifySubscribers();
      }, 500);
    }

    return newOrder;
  }, []);

  const cancelOrder = useCallback((id: string) => {
    const order = demoState.orders.find(o => o.id === id);
    if (order && order.status === 'pending') {
      order.status = 'canceled';
      notifySubscribers();
    }
  }, []);

  return {
    // Portfolio
    createPortfolio,
    deletePortfolio,
    // Strategy
    createStrategy,
    validateStrategy,
    deleteStrategy,
    // Backtest
    runBacktest,
    // Risk
    runRiskAnalysis,
    // Orders
    placeOrder,
    cancelOrder,
  };
}
