/**
 * UI2 Demo Store Tests
 * Verify deterministic behavior: stable timestamps, IDs, ordering
 */

import { describe, it, expect } from 'vitest';
import { DEMO_TIMESTAMP, DEMO_USER } from '../demo/constants';
import * as store from '../demo/demoStore';

describe('UI2 Demo Store - Determinism', () => {
  it('should have stable DEMO_TIMESTAMP', () => {
    expect(DEMO_TIMESTAMP).toBe(new Date('2026-02-15T14:30:00Z').getTime());
    expect(DEMO_TIMESTAMP).toBe(1771165800000);
  });

  it('should have stable DEMO_USER', () => {
    expect(DEMO_USER).toEqual({
      id: 'demo-user-1',
      name: 'Demo Trader',
      email: 'demo@apexterminal.io',
      avatar: null,
    });
  });

  it('should have 8 demo instruments with stable symbols', () => {
    expect(store.DEMO_INSTRUMENTS).toHaveLength(8);
    const symbols = store.DEMO_INSTRUMENTS.map(i => i.symbol);
    expect(symbols).toEqual(['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META']);
  });

  it('should have stable quote timestamps', () => {
    store.DEMO_QUOTES.forEach(quote => {
      expect(quote.timestamp).toBe(DEMO_TIMESTAMP);
    });
  });

  it('should have stable position IDs', () => {
    const ids = store.DEMO_POSITIONS.map(p => p.id);
    expect(ids).toEqual(['pos-1', 'pos-2', 'pos-3', 'pos-4']);
  });

  it('should have stable order IDs', () => {
    const ids = store.DEMO_ORDERS.map(o => o.id);
    expect(ids).toEqual(['ord-1', 'ord-2', 'ord-3']);
  });

  it('should have stable trade IDs', () => {
    const ids = store.DEMO_TRADES.map(t => t.id);
    expect(ids).toEqual(['trd-1', 'trd-2']);
  });

  it('should have stable portfolio IDs', () => {
    const ids = store.DEMO_PORTFOLIOS.map(p => p.id);
    expect(ids).toEqual(['pf-1', 'pf-2']);
  });

  it('should have stable strategy IDs', () => {
    const ids = store.DEMO_STRATEGIES.map(s => s.id);
    expect(ids).toEqual(['strat-1', 'strat-2', 'strat-3']);
  });

  it('should have stable artifact IDs', () => {
    const ids = store.DEMO_ARTIFACTS.map(a => a.id);
    expect(ids).toEqual(['art-1', 'art-2', 'art-3']);
  });

  it('should have stable backtest run IDs', () => {
    const ids = store.DEMO_BACKTEST_RUNS.map(b => b.id);
    expect(ids).toEqual(['bt-1', 'bt-2']);
  });

  it('should have stable risk run IDs', () => {
    const ids = store.DEMO_RISK_RUNS.map(r => r.id);
    expect(ids).toEqual(['risk-1', 'risk-2']);
  });

  it('should have stable autopilot log IDs', () => {
    const ids = store.DEMO_AUTOPILOT_LOGS.map(l => l.id);
    expect(ids).toEqual(['ap-1', 'ap-2', 'ap-3', 'ap-4', 'ap-5']);
  });

  it('should have stable incident IDs', () => {
    const ids = store.DEMO_INCIDENTS.map(i => i.id);
    expect(ids).toEqual(['inc-1', 'inc-2']);
  });

  it('should have stable agent IDs', () => {
    const ids = store.DEMO_AGENTS.map(a => a.id);
    expect(ids).toEqual(['agent-1', 'agent-2', 'agent-3', 'agent-4']);
  });

  it('should have stable health check services', () => {
    const services = store.DEMO_HEALTH.map(h => h.service);
    expect(services).toEqual([
      'API Gateway',
      'Market Data',
      'Order Execution',
      'Risk Engine',
      'WebSocket',
    ]);
  });
});
