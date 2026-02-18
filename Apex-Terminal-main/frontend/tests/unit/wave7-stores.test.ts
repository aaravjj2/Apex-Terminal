/**
 * Wave 7 Store Tests (v1.63-v1.72)
 * automationStore, searchStore, autopilot2Store, agentStore
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Automation Store ──────────────────────────────────────────

describe('automationStore', () => {
  let store: typeof import('../../src/ui2/stores/automationStore').automationStore;

  beforeEach(async () => {
    const mod = await import('../../src/ui2/stores/automationStore');
    store = mod.automationStore;
    store.reset();
  });

  it('starts with 3 demo workflows', () => {
    expect(store.getWorkflows().length).toBe(3);
  });

  it('starts with 0 runs', () => {
    expect(store.getRuns().length).toBe(0);
  });

  it('creates a workflow', () => {
    store.createWorkflow('Test WF', 'A test');
    expect(store.getWorkflows().length).toBe(4);
    const created = store.getWorkflows().find(w => w.name === 'Test WF');
    expect(created).toBeDefined();
    expect(created!.description).toBe('A test');
  });

  it('runs a workflow and produces steps', () => {
    const wfs = store.getWorkflows();
    store.runWorkflow(wfs[0].id);
    const runs = store.getRuns();
    expect(runs.length).toBe(1);
    expect(runs[0].status).toBe('completed');
    expect(runs[0].step_results.length).toBeGreaterThan(0);
  });

  it('run generates deterministic hash', () => {
    const wfs = store.getWorkflows();
    store.runWorkflow(wfs[0].id);
    const r1 = store.getRuns()[0];
    expect(r1.deterministic_hash).toBeDefined();
    expect(r1.deterministic_hash.length).toBeGreaterThan(0);
  });

  it('deletes a workflow', () => {
    const wfs = store.getWorkflows();
    const id = wfs[0].id;
    store.deleteWorkflow(id);
    expect(store.getWorkflows().find(w => w.id === id)).toBeUndefined();
  });

  it('notifies subscribers', () => {
    let called = false;
    const unsub = store.subscribe(() => { called = true; });
    store.createWorkflow('Notify Test', '');
    expect(called).toBe(true);
    unsub();
  });
});

// ── Search Store ──────────────────────────────────────────────

describe('searchStore', () => {
  let store: typeof import('../../src/ui2/stores/searchStore').searchStore;

  beforeEach(async () => {
    const mod = await import('../../src/ui2/stores/searchStore');
    store = mod.searchStore;
    store.reset();
  });

  it('returns entity types', () => {
    const types = store.getEntityTypes();
    expect(types.length).toBeGreaterThan(5);
    expect(types).toContain('position');
    expect(types).toContain('order');
  });

  it('searches and returns results for SPY', () => {
    store.search('SPY');
    const state = store.getState();
    expect(state.results.length).toBeGreaterThan(0);
    expect(state.total).toBeGreaterThan(0);
  });

  it('filters by entity type', () => {
    store.setEntityType('position');
    store.search('SPY');
    const state = store.getState();
    for (const r of state.results) {
      expect(r.entity_type).toBe('position');
    }
  });

  it('selects a result', () => {
    store.search('SPY');
    const state = store.getState();
    const id = state.results[0]?.id;
    if (id) {
      store.selectResult(id);
      expect(store.getState().selectedResult).toBe(id);
      store.selectResult(null);
      expect(store.getState().selectedResult).toBeNull();
    }
  });

  it('scores exact matches higher', () => {
    store.search('SPY');
    const state = store.getState();
    if (state.results.length >= 2) {
      expect(state.results[0].score).toBeGreaterThanOrEqual(state.results[1].score);
    }
  });
});

// ── Autopilot 2.0 Store ──────────────────────────────────────

describe('autopilot2Store', () => {
  let store: typeof import('../../src/ui2/stores/autopilot2Store').autopilot2Store;

  beforeEach(async () => {
    const mod = await import('../../src/ui2/stores/autopilot2Store');
    store = mod.autopilot2Store;
    store.reset();
  });

  it('starts with 0 runs', () => {
    expect(store.getRuns().length).toBe(0);
  });

  it('executes pipeline and produces run', () => {
    const run = store.execute();
    expect(run.status).toBe('completed');
    expect(run.stages.length).toBe(6);
    expect(store.getRuns().length).toBe(1);
  });

  it('produces decisions and rejections', () => {
    const run = store.execute();
    expect(run.decisions.length).toBeGreaterThan(0);
    expect(run.rejections.length).toBeGreaterThan(0);
  });

  it('produces orders matching decisions', () => {
    const run = store.execute();
    expect(run.orders.length).toBe(run.decisions.length);
  });

  it('generates deterministic hash', () => {
    const r1 = store.execute();
    store.reset();
    const r2 = store.execute();
    expect(r1.deterministic_hash).toBe(r2.deterministic_hash);
    expect(r1.deterministic_hash.length).toBeGreaterThan(0);
  });

  it('has postmortem', () => {
    const run = store.execute();
    expect(run.postmortem).toContain('Post-Trade Summary');
  });

  it('selects run', () => {
    const run = store.execute();
    expect(store.getSelectedRun()).toBe(run.run_id);
    store.selectRun(null);
    expect(store.getSelectedRun()).toBeNull();
  });
});

// ── Agent Store ──────────────────────────────────────────────

describe('agentStore', () => {
  let store: typeof import('../../src/ui2/stores/agentStore').agentStore;

  beforeEach(async () => {
    const mod = await import('../../src/ui2/stores/agentStore');
    store = mod.agentStore;
    store.reset();
  });

  it('starts empty', () => {
    expect(store.getMessages().length).toBe(0);
  });

  it('has tools', () => {
    expect(store.getTools().length).toBeGreaterThanOrEqual(10);
  });

  it('invokes and returns user + assistant messages', () => {
    store.invoke('test prompt');
    expect(store.getMessages().length).toBe(2);
    expect(store.getMessages()[0].role).toBe('user');
    expect(store.getMessages()[1].role).toBe('assistant');
  });

  it('risk prompt triggers tool calls', () => {
    const msg = store.invoke('Generate a risk report');
    expect(msg.tool_calls.length).toBeGreaterThan(0);
    expect(msg.tool_calls[0].tool_name).toBe('generate_report');
  });

  it('backtest prompt triggers tool calls', () => {
    const msg = store.invoke('Run a backtest on the strategy');
    expect(msg.tool_calls.length).toBeGreaterThan(0);
  });

  it('search prompt triggers tool calls', () => {
    const msg = store.invoke('Search for SPY');
    expect(msg.tool_calls.length).toBeGreaterThan(0);
  });

  it('clears messages', () => {
    store.invoke('test');
    store.clear();
    expect(store.getMessages().length).toBe(0);
  });

  it('calls tool directly', () => {
    const result = store.callTool('generate_report', {});
    expect(result).toBeDefined();
    expect(result!.status).toBe('ok');
  });

  it('returns null for unknown tool', () => {
    const result = store.callTool('nonexistent', {});
    expect(result).toBeNull();
  });
});
