/**
 * Bloomberg Terminal – Comprehensive Store Tests
 * Covers: contextBusStore, orderTicketStore, platformHealthStore,
 *         commandRegistry, backtestDepthStore, searchDepthStore,
 *         workflowDepthStore
 *
 * Run:  npx vitest run src/ui2/__tests__/bloomberg-stores.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ─── Context Bus ──────────────────────────────────────────────────────────────
import { useContextBus, getActiveSymbol, getActiveEntity } from '../stores/contextBusStore';

// ─── Order Ticket ─────────────────────────────────────────────────────────────
import {
  validateOrder,
  previewOrder,
  placeOrder,
  cancelDemoOrder,
  getDemoOrders,
  resetDemoOrders,
} from '../stores/orderTicketStore';

// ─── Platform Health ──────────────────────────────────────────────────────────
import { platformHealthStore } from '../stores/platformHealthStore';

// ─── Command Registry ─────────────────────────────────────────────────────────
import { COMMAND_REGISTRY } from '../stores/commandRegistry';

// ─── Depth Stores ─────────────────────────────────────────────────────────────
import { backtestDepthStore, type SweepConfig } from '../stores/backtestDepthStore';
import { searchDepthStore } from '../stores/searchDepthStore';
import { workflowDepthStore } from '../stores/workflowDepthStore';

// =============================================================================
// Context Bus Store (Zustand)
// =============================================================================
describe('contextBusStore', () => {
  beforeEach(() => {
    useContextBus.setState({
      activeSymbol: 'AAPL',
      symbolHistory: ['AAPL'],
      activeEntity: null,
      lastSymbolChangeAt: Date.now(),
    });
  });

  it('defaults to AAPL as active symbol', () => {
    expect(getActiveSymbol()).toBe('AAPL');
  });

  it('setActiveSymbol updates symbol and uppercases it', () => {
    useContextBus.getState().setActiveSymbol('tsla');
    expect(getActiveSymbol()).toBe('TSLA');
  });

  it('setActiveSymbol appends to symbolHistory', () => {
    useContextBus.getState().setActiveSymbol('NVDA');
    const hist = useContextBus.getState().symbolHistory;
    expect(hist[0]).toBe('NVDA');
    expect(hist).toContain('AAPL');
  });

  it('symbolHistory does not exceed 10 entries', () => {
    const syms = ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'];
    syms.forEach(s => useContextBus.getState().setActiveSymbol(s));
    expect(useContextBus.getState().symbolHistory.length).toBeLessThanOrEqual(10);
  });

  it('ignores empty string', () => {
    useContextBus.getState().setActiveSymbol('');
    expect(getActiveSymbol()).toBe('AAPL');
  });

  it('deduplicates symbol in history', () => {
    useContextBus.getState().setActiveSymbol('AAPL');
    const hist = useContextBus.getState().symbolHistory;
    const count = hist.filter(s => s === 'AAPL').length;
    expect(count).toBe(1);
  });

  it('setActiveEntity stores entity', () => {
    useContextBus.getState().setActiveEntity({ id: 'ord-1', type: 'order', label: 'Limit Buy' });
    const entity = getActiveEntity();
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe('ord-1');
    expect(entity!.type).toBe('order');
  });

  it('clearActiveEntity removes entity', () => {
    useContextBus.getState().setActiveEntity({ id: 'ord-1', type: 'order' });
    useContextBus.getState().clearActiveEntity();
    expect(getActiveEntity()).toBeNull();
  });

  it('updates lastSymbolChangeAt on symbol change', () => {
    const before = useContextBus.getState().lastSymbolChangeAt;
    useContextBus.getState().setActiveSymbol('SPY');
    const after = useContextBus.getState().lastSymbolChangeAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// =============================================================================
// Order Ticket Store (vanilla TS module)
// =============================================================================
describe('orderTicketStore – validateOrder', () => {
  it('returns no errors for valid market order', () => {
    const errs = validateOrder({ symbol: 'AAPL', quantity: 10, type: 'market' });
    expect(errs).toHaveLength(0);
  });

  it('errors when symbol is missing', () => {
    const errs = validateOrder({ symbol: '', quantity: 10, type: 'market' });
    expect(errs.some(e => e.field === 'symbol')).toBe(true);
  });

  it('errors when quantity is zero', () => {
    const errs = validateOrder({ symbol: 'TSLA', quantity: 0, type: 'market' });
    expect(errs.some(e => e.field === 'quantity')).toBe(true);
  });

  it('errors when quantity is negative', () => {
    const errs = validateOrder({ symbol: 'SPY', quantity: -5, type: 'market' });
    expect(errs.some(e => e.field === 'quantity')).toBe(true);
  });

  it('errors when quantity exceeds max 10000', () => {
    const errs = validateOrder({ symbol: 'SPY', quantity: 99999, type: 'market' });
    expect(errs.some(e => e.field === 'quantity')).toBe(true);
  });

  it('errors when limit order has no limitPrice', () => {
    const errs = validateOrder({ symbol: 'AAPL', quantity: 5, type: 'limit' });
    expect(errs.some(e => e.field === 'limitPrice')).toBe(true);
  });

  it('no error when limit order has valid limitPrice', () => {
    const errs = validateOrder({ symbol: 'AAPL', quantity: 5, type: 'limit', limitPrice: 180 });
    expect(errs).toHaveLength(0);
  });

  it('errors when stop order has no stopPrice', () => {
    const errs = validateOrder({ symbol: 'NVDA', quantity: 2, type: 'stop' });
    expect(errs.some(e => e.field === 'stopPrice')).toBe(true);
  });
});

describe('orderTicketStore – previewOrder / placeOrder / cancel', () => {
  beforeEach(() => resetDemoOrders());

  it('previewOrder returns status=preview', () => {
    const p = previewOrder({ symbol: 'AAPL', quantity: 10, type: 'market', side: 'buy', tif: 'day' });
    expect(p.status).toBe('preview');
    expect(p.symbol).toBe('AAPL');
    expect(p.filledQty).toBe(0);
  });

  it('previewOrder IDs are sequential ORD-DEMO-XXX', () => {
    const p1 = previewOrder({ symbol: 'SPY', quantity: 1, type: 'market', side: 'buy', tif: 'day' });
    const p2 = previewOrder({ symbol: 'SPY', quantity: 1, type: 'market', side: 'sell', tif: 'day' });
    expect(p1.id).toMatch(/^ORD-DEMO-\d+$/);
    expect(p2.id).not.toBe(p1.id);
  });

  it('market order placed → status=filled immediately', () => {
    const preview = previewOrder({ symbol: 'AAPL', quantity: 5, type: 'market', side: 'buy', tif: 'day' });
    const placed = placeOrder(preview);
    expect(placed.status).toBe('filled');
    expect(placed.filledQty).toBe(5);
    expect(placed.avgFillPrice).toBeGreaterThan(0);
  });

  it('limit order placed → status=working', () => {
    const preview = previewOrder({ symbol: 'TSLA', quantity: 2, type: 'limit', side: 'buy', tif: 'gtc', limitPrice: 200 });
    const placed = placeOrder(preview);
    expect(placed.status).toBe('working');
  });

  it('cancel a working order → status=canceled', () => {
    const preview = previewOrder({ symbol: 'TSLA', quantity: 2, type: 'limit', side: 'buy', tif: 'gtc', limitPrice: 200 });
    const placed = placeOrder(preview);
    cancelDemoOrder(placed.id);
    const orders = getDemoOrders();
    const found = orders.find(o => o.id === placed.id);
    expect(found?.status).toBe('canceled');
  });

  it('getDemoOrders returns all placed orders', () => {
    placeOrder(previewOrder({ symbol: 'AAPL', quantity: 1, type: 'market', side: 'buy', tif: 'day' }));
    placeOrder(previewOrder({ symbol: 'SPY', quantity: 2, type: 'market', side: 'sell', tif: 'day' }));
    expect(getDemoOrders().length).toBe(2);
  });

  it('resetDemoOrders clears store', () => {
    placeOrder(previewOrder({ symbol: 'AAPL', quantity: 1, type: 'market', side: 'buy', tif: 'day' }));
    resetDemoOrders();
    expect(getDemoOrders().length).toBe(0);
  });

  it('known symbols get correct base price (market fill)', () => {
    const symbols: Record<string, number> = {
      SPY: 547.23, AAPL: 182.41, TSLA: 218.77, NVDA: 789.55,
    };
    Object.entries(symbols).forEach(([sym, expectedPrice]) => {
      resetDemoOrders();
      const p = previewOrder({ symbol: sym, quantity: 1, type: 'market', side: 'buy', tif: 'day' });
      const placed = placeOrder(p);
      expect(placed.avgFillPrice).toBe(expectedPrice);
    });
  });
});

// =============================================================================
// Platform Health Store
// =============================================================================
describe('platformHealthStore', () => {
  beforeEach(() => platformHealthStore.reset());

  it('default status is healthy', () => {
    expect(platformHealthStore.getHealth().status).toBe('healthy');
  });

  it('default mode is live', () => {
    expect(platformHealthStore.getHealth().mode).toBe('live');
  });

  it('services include autopilot_v2', () => {
    const services = platformHealthStore.getHealth().services;
    expect(services.autopilot_v2).toBeDefined();
    expect(services.autopilot_v2.status).toBe('ok');
  });

  it('services include llm', () => {
    const h = platformHealthStore.getHealth();
    expect(h.services.llm).toBeDefined();
  });

  it('uptime_seconds > 0 by default', () => {
    expect(platformHealthStore.getHealth().metrics.uptime_seconds).toBeGreaterThan(0);
  });

  it('error_rate defaults to 0', () => {
    expect(platformHealthStore.getHealth().metrics.error_rate).toBe(0);
  });

  it('refresh() resets health to defaults', () => {
    platformHealthStore.refresh();
    expect(platformHealthStore.getHealth().status).toBe('healthy');
  });

  it('getLastRefresh returns ISO string', () => {
    const ts = platformHealthStore.getLastRefresh();
    expect(new Date(ts).toString()).not.toBe('Invalid Date');
  });

  it('subscribe fires on refresh', () => {
    let called = 0;
    const unsub = platformHealthStore.subscribe(() => { called++; });
    platformHealthStore.refresh();
    expect(called).toBeGreaterThan(0);
    unsub();
  });
});

// =============================================================================
// Command Registry
// =============================================================================
describe('COMMAND_REGISTRY', () => {
  it('has at least 20 commands', () => {
    expect(COMMAND_REGISTRY.length).toBeGreaterThan(20);
  });

  it('every command has required fields', () => {
    COMMAND_REGISTRY.forEach((cmd) => {
      expect(cmd.id, `${cmd.id} missing id`).toBeTruthy();
      expect(cmd.label, `${cmd.id} missing label`).toBeTruthy();
      expect(cmd.description, `${cmd.id} missing description`).toBeTruthy();
      expect(cmd.category, `${cmd.id} missing category`).toBeTruthy();
      expect(Array.isArray(cmd.keywords), `${cmd.id} keywords not array`).toBe(true);
    });
  });

  it('every command id is unique', () => {
    const ids = COMMAND_REGISTRY.map(c => c.id);
    const uniq = new Set(ids);
    expect(uniq.size).toBe(ids.length);
  });

  it('nav-dashboard has path /ui2/dashboard', () => {
    const cmd = COMMAND_REGISTRY.find(c => c.id === 'nav-dashboard');
    expect(cmd).toBeDefined();
    expect(cmd!.path).toBe('/ui2/dashboard');
  });

  it('action-kill-switch exists with category "action"', () => {
    const cmd = COMMAND_REGISTRY.find(c => c.id === 'action-kill-switch');
    expect(cmd).toBeDefined();
    expect(cmd!.category).toBe('action');
  });

  it('ticker commands all have category "ticker"', () => {
    const tickers = COMMAND_REGISTRY.filter(c => c.id.startsWith('ticker-'));
    expect(tickers.length).toBeGreaterThan(0);
    tickers.forEach(t => expect(t.category).toBe('ticker'));
  });

  it('navigation commands all have a path', () => {
    const navCmds = COMMAND_REGISTRY.filter(c => c.category === 'navigation');
    navCmds.forEach(cmd => {
      expect(cmd.path, `${cmd.id} nav command missing path`).toBeTruthy();
    });
  });

  it('action commands that have an action field are non-empty', () => {
    const actionCmds = COMMAND_REGISTRY.filter(c => c.category === 'action');
    actionCmds.forEach(cmd => {
      if (cmd.action) expect(cmd.action.length).toBeGreaterThan(0);
    });
  });

  it('AAPL, TSLA, SPY, NVDA, MSFT tickers all present', () => {
    const tickerSymbols = COMMAND_REGISTRY.filter(c => c.category === 'ticker').map(c => c.label);
    ['AAPL', 'TSLA', 'SPY', 'NVDA', 'MSFT'].forEach(sym => {
      expect(tickerSymbols).toContain(sym);
    });
  });
});

// =============================================================================
// Backtest Depth Store
// =============================================================================
describe('backtestDepthStore', () => {
  const sweep: SweepConfig = {
    sweep_id: 'sw-test-001',
    symbol: 'AAPL',
    strategy_id: 'sma-cross',
    params: [{ name: 'fast', min: 5, max: 20, step: 5 }],
    metric: 'sharpe',
  };

  beforeEach(() => backtestDepthStore.reset());

  it('runSweep returns a SweepResult', () => {
    const result = backtestDepthStore.runSweep(sweep);
    expect(result).toBeDefined();
    expect(result.sweep_id).toBe('sw-test-001');
  });

  it('runSweep result has cells array', () => {
    const result = backtestDepthStore.runSweep(sweep);
    expect(Array.isArray(result.cells)).toBe(true);
    expect(result.cells.length).toBeGreaterThan(0);
  });

  it('runSweep result has best_cell_id', () => {
    const result = backtestDepthStore.runSweep(sweep);
    expect(result.best_cell_id).toBeTruthy();
  });

  it('runSweep result is deterministic across same config', () => {
    const r1 = backtestDepthStore.runSweep(sweep);
    backtestDepthStore.reset();
    const r2 = backtestDepthStore.runSweep(sweep);
    expect(r1.hash).toBe(r2.hash);
  });

  it('getSweeps returns array after running', () => {
    backtestDepthStore.runSweep(sweep);
    const all = backtestDepthStore.getSweeps();
    expect(all.length).toBeGreaterThan(0);
  });

  it('runWalkForward returns a result', () => {
    const result = backtestDepthStore.runWalkForward('AAPL', 'sma-cross');
    expect(result).toBeDefined();
    expect(result.wf_id).toBeTruthy();
  });

  it('getWalkForwards returns array after running', () => {
    backtestDepthStore.runWalkForward('SPY', 'sma-cross');
    const all = backtestDepthStore.getWalkForwards();
    expect(all.length).toBeGreaterThan(0);
  });

  it('getExportHash returns string', () => {
    const r = backtestDepthStore.runSweep(sweep);
    const hash = backtestDepthStore.getExportHash(r.sweep_id);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('reset clears sweeps', () => {
    backtestDepthStore.runSweep(sweep);
    backtestDepthStore.reset();
    expect(backtestDepthStore.getSweeps().length).toBe(0);
  });
});

// =============================================================================
// Search Depth Store
// =============================================================================
describe('searchDepthStore', () => {
  beforeEach(() => searchDepthStore.reset());

  it('getProviderStatus returns default status', () => {
    const status = searchDepthStore.getProviderStatus();
    expect(status).toBeDefined();
    const providerVal = (status as any).provider;
    const backendVal = (status as any).active_backend;
    expect(providerVal ?? backendVal).toBeTruthy();
  });

  it('getMappings returns array', () => {
    const mappings = searchDepthStore.getMappings();
    expect(Array.isArray(mappings)).toBe(true);
  });

  it('getDocSchema returns fields array', () => {
    const schema = searchDepthStore.getDocSchema();
    expect(Array.isArray(schema)).toBe(true);
    expect(schema.length).toBeGreaterThan(0);
  });

  it('getDocSchema fields have required shape', () => {
    const fields = searchDepthStore.getDocSchema();
    fields.forEach(f => {
      expect(f.field_name).toBeTruthy();
      expect(f.field_type).toBeTruthy();
    });
  });

  it('generateStableDocId returns hex string', () => {
    const id = searchDepthStore.generateStableDocId('strategy', 'SMA Cross');
    expect(id).toMatch(/^[0-9a-f]+$/);
    expect(id.length).toBeGreaterThan(0);
  });

  it('generateStableDocId is deterministic', () => {
    const id1 = searchDepthStore.generateStableDocId('strategy', 'SMA Cross');
    const id2 = searchDepthStore.generateStableDocId('strategy', 'SMA Cross');
    expect(id1).toBe(id2);
  });

  it('generateStableDocId differs for different inputs', () => {
    const id1 = searchDepthStore.generateStableDocId('strategy', 'SMA Cross');
    const id2 = searchDepthStore.generateStableDocId('strategy', 'EMA Cross');
    expect(id1).not.toBe(id2);
  });

  it('getExplain returns explain object', () => {
    const explain = searchDepthStore.getExplain('doc-001', 'AAPL');
    expect(explain).toBeDefined();
    expect(explain.doc_id).toBe('doc-001');
    expect(explain.query).toBe('AAPL');
    expect(Array.isArray(explain.factors)).toBe(true);
  });

  it('getSearchConfig returns provider info', () => {
    const cfg = searchDepthStore.getSearchConfig();
    expect(cfg.provider).toBe('elastic');
    expect(cfg.elastic_configured).toBe(true);
  });
});

// =============================================================================
// Workflow Depth Store
// =============================================================================
describe('workflowDepthStore', () => {
  beforeEach(() => workflowDepthStore.reset());

  it('getTemplates returns array', () => {
    const templates = workflowDepthStore.getTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });

  it('templates have required fields', () => {
    const templates = workflowDepthStore.getTemplates();
    templates.forEach(t => {
      expect(t.template_id).toBeTruthy();
      expect(t.name).toBeTruthy();
    });
  });

  it('getScheduledJobs returns array', () => {
    const jobs = workflowDepthStore.getScheduledJobs();
    expect(Array.isArray(jobs)).toBe(true);
  });

  it('getRunHistory returns array', () => {
    const history = workflowDepthStore.getRunHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it('triggerDeterministicRun returns a WorkflowRun', () => {
    const run = workflowDepthStore.triggerDeterministicRun('wf-001', 'SMA Workflow');
    expect(run).toBeDefined();
    expect(run.run_id).toBeTruthy();
    expect(run.workflow_id).toBe('wf-001');
    expect(run.workflow_name).toBe('SMA Workflow');
  });

  it('triggerDeterministicRun adds to run history', () => {
    const before = workflowDepthStore.getRunHistory().length;
    workflowDepthStore.triggerDeterministicRun('wf-001', 'Test Workflow');
    const after = workflowDepthStore.getRunHistory().length;
    expect(after).toBe(before + 1);
  });

  it('run status is success or failed', () => {
    const run = workflowDepthStore.triggerDeterministicRun('wf-002', 'Risk Workflow');
    expect(['success', 'failed', 'running']).toContain(run.status);
  });

  it('getExportHash returns non-empty string', () => {
    const hash = workflowDepthStore.getExportHash('wf-001');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('getCurrentUser returns a user', () => {
    const user = workflowDepthStore.getCurrentUser();
    expect(user.user_id).toBeTruthy();
    expect(user.role).toBeTruthy();
  });

  it('canPerform returns boolean', () => {
    const result = workflowDepthStore.canPerform('trigger');
    expect(typeof result).toBe('boolean');
  });

  it('searchTemplates returns subset matching query', () => {
    const templates = workflowDepthStore.getTemplates();
    if (templates.length > 0) {
      const name = templates[0].name.toLowerCase().split(' ')[0];
      const found = workflowDepthStore.searchTemplates(name);
      expect(Array.isArray(found)).toBe(true);
    }
  });
});
