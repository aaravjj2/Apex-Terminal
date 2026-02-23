/**
 * Wave 8 Store Unit Tests (v1.73-v1.82, updated v1.93)
 * Tests for: autopilotV2Store, automationV2Store, exportStore, platformHealthStore
 * Updated for backend-driven autopilotV2Store.execute() (now async with fetch)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { autopilotV2Store } from '../../src/ui2/stores/autopilotV2Store';
import { automationV2Store } from '../../src/ui2/stores/automationV2Store';
import { exportStore } from '../../src/ui2/stores/exportStore';
import { platformHealthStore } from '../../src/ui2/stores/platformHealthStore';

// ── Mock Backend Response (Deterministic) ──────────────────────

const MOCK_AUTOPILOT_RUN = {
  run_id: 'mock-run-12345',
  state: 'COMPLETED',
  seed: 42,
  inputs: { symbols: ['SPY', 'AAPL'], budget: 100000, timestamp: '2026-02-15T14:30:00Z' },
  candidates: [
    { symbol: 'SPY', side: 'buy', confidence: 0.85, signal_tags: ['momentum'], features: { rsi: 65 } },
    { symbol: 'AAPL', side: 'buy', confidence: 0.72, signal_tags: ['mean_reversion'], features: { rsi: 32 } },
  ],
  scores: [
    { symbol: 'SPY', raw_score: 0.85, weighted_score: 0.82, reason_codes: ['HIGH_MOMENTUM'], feature_contributions: { momentum: 0.5 } },
  ],
  risk_results: [
    { symbol: 'SPY', passed: true, reason_codes: [], details: {} },
  ],
  sized_intents: [
    { symbol: 'SPY', side: 'buy', quantity: 100, notional: 50000, vol_target_pct: 0.15, confidence: 0.85 },
  ],
  orders: [
    { order_id: 'ord-1', symbol: 'SPY', side: 'buy', quantity: 100, price: 500, fill_price: 500.5, fill_qty: 100, status: 'filled', pnl: 0 },
  ],
  positions: [
    { symbol: 'SPY', side: 'long', quantity: 100, avg_price: 500.5, market_price: 501, unrealized_pnl: 50, sector: 'ETF' },
  ],
  rejections: [
    { symbol: 'AAPL', reason_code: 'LOW_CONFIDENCE', reason_text: 'Confidence below threshold', stage: 'scoring' },
  ],
  stages: [
    { stage_name: 'scanning', stage_number: 1, status: 'completed', duration_ms: 10, input_count: 2, output_count: 2 },
    { stage_name: 'scoring', stage_number: 2, status: 'completed', duration_ms: 20, input_count: 2, output_count: 1 },
    { stage_name: 'risk_check', stage_number: 3, status: 'completed', duration_ms: 15, input_count: 1, output_count: 1 },
    { stage_name: 'sizing', stage_number: 4, status: 'completed', duration_ms: 5, input_count: 1, output_count: 1 },
    { stage_name: 'submitting', stage_number: 5, status: 'completed', duration_ms: 30, input_count: 1, output_count: 1 },
    { stage_name: 'completed', stage_number: 6, status: 'completed', duration_ms: 0, input_count: 1, output_count: 1 },
  ],
  explain: [
    { symbol: 'SPY', score_breakdown: {}, risk_result: { passed: true, reason_codes: [], details: {} }, sizing: null, final_action: 'ACCEPTED' },
  ],
  deterministic_hash: 'mock-hash-stable-12345',
};

// ── Autopilot V2 Store ─────────────────────────────────────────

describe('autopilotV2Store', () => {
  beforeEach(() => {
    autopilotV2Store.reset();
    // Mock global fetch for all tests in this suite
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_AUTOPILOT_RUN,
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with empty runs', () => {
    expect(autopilotV2Store.getRuns()).toHaveLength(0);
  });

  it('starts with seed 42', () => {
    expect(autopilotV2Store.getSeed()).toBe(42);
  });

  it('kill switch starts disarmed', () => {
    const ks = autopilotV2Store.getKillSwitch();
    expect(ks.armed).toBe(false);
  });

  it('execute creates a run (async backend call)', async () => {
    await autopilotV2Store.execute();
    expect(autopilotV2Store.getRuns()).toHaveLength(1);
    const run = autopilotV2Store.getCurrentRun();
    expect(run).not.toBeNull();
    expect(run!.state).toBe('completed'); // normalized to lowercase
  });

  it('execute produces candidates', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.candidates.length).toBeGreaterThan(0);
  });

  it('execute produces orders', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.orders.length).toBeGreaterThan(0);
  });

  it('execute produces positions', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.positions.length).toBeGreaterThan(0);
  });

  it('execute produces stages', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.stages).toHaveLength(6);
  });

  it('execute produces explain entries', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.explain.length).toBeGreaterThan(0);
  });

  it('execute produces rejections for low confidence', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getCurrentRun();
    expect(run!.rejections.length).toBeGreaterThan(0);
    expect(run!.rejections.some(r => r.reason_code === 'LOW_CONFIDENCE')).toBe(true);
  });

  it('deterministic hash is stable (backend guarantees)', async () => {
    await autopilotV2Store.execute();
    const h1 = autopilotV2Store.getCurrentRun()!.deterministic_hash;
    autopilotV2Store.reset();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_AUTOPILOT_RUN, // same response
    } as Response);
    await autopilotV2Store.execute();
    const h2 = autopilotV2Store.getCurrentRun()!.deterministic_hash;
    expect(h1).toBe(h2);
  });

  it('can change seed', () => {
    autopilotV2Store.setSeed(123);
    expect(autopilotV2Store.getSeed()).toBe(123);
  });

  it('arm kill switch', () => {
    autopilotV2Store.armKillSwitch('test');
    expect(autopilotV2Store.getKillSwitch().armed).toBe(true);
  });

  it('disarm kill switch', () => {
    autopilotV2Store.armKillSwitch('test');
    autopilotV2Store.disarmKillSwitch('test');
    expect(autopilotV2Store.getKillSwitch().armed).toBe(false);
  });

  it('armed kill switch blocks execute', async () => {
    autopilotV2Store.armKillSwitch('test');
    const result = await autopilotV2Store.execute();
    expect(result).toBeNull();
    expect(autopilotV2Store.getRuns()).toHaveLength(0);
  });

  it('armed kill switch blocks execute', async () => {
    autopilotV2Store.armKillSwitch('test');
    const result = await autopilotV2Store.execute();
    expect(result).toBeNull();
    expect(autopilotV2Store.getRuns()).toHaveLength(0);
  });

  it('selectRun works', async () => {
    await autopilotV2Store.execute();
    const run = autopilotV2Store.getRuns()[0];
    autopilotV2Store.selectRun(null);
    expect(autopilotV2Store.getSelectedRun()).toBeNull();
    autopilotV2Store.selectRun(run.run_id);
    expect(autopilotV2Store.getSelectedRun()).toBe(run.run_id);
  });

  it('setActiveTab works', () => {
    autopilotV2Store.setActiveTab('orders');
    expect(autopilotV2Store.getActiveTab()).toBe('orders');
  });

  it('reset clears everything', async () => {
    await autopilotV2Store.execute();
    autopilotV2Store.armKillSwitch('test');
    autopilotV2Store.reset();
    expect(autopilotV2Store.getRuns()).toHaveLength(0);
    expect(autopilotV2Store.getKillSwitch().armed).toBe(false);
    expect(autopilotV2Store.getSeed()).toBe(42);
  });

  it('backend API failure returns null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response);
    const result = await autopilotV2Store.execute();
    expect(result).toBeNull();
  });

  it('backend network error returns null', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await autopilotV2Store.execute();
    expect(result).toBeNull();
  });
});

// ── Automation V2 Store ────────────────────────────────────────

describe('automationV2Store', () => {
  beforeEach(() => { automationV2Store.reset(); });

  it('starts with 3 demo workflows', () => {
    expect(automationV2Store.getWorkflows()).toHaveLength(3);
  });

  it('starts with 0 runs', () => {
    expect(automationV2Store.getRuns()).toHaveLength(0);
  });

  it('can select a workflow', () => {
    automationV2Store.selectWorkflow('wf-autopilot-daily');
    expect(automationV2Store.getSelectedWorkflow()).toBe('wf-autopilot-daily');
  });

  it('run workflow creates a run log', () => {
    const run = automationV2Store.runWorkflow('wf-simple-log');
    expect(run).not.toBeNull();
    expect(run!.status).toBe('completed');
    expect(automationV2Store.getRuns()).toHaveLength(1);
  });

  it('run workflow with dependencies', () => {
    const run = automationV2Store.runWorkflow('wf-autopilot-daily');
    expect(run).not.toBeNull();
    expect(run!.node_executions).toHaveLength(3);
  });

  it('run log has deterministic hash', () => {
    const r1 = automationV2Store.runWorkflow('wf-simple-log');
    automationV2Store.reset();
    const r2 = automationV2Store.runWorkflow('wf-simple-log');
    expect(r1!.deterministic_hash).toBe(r2!.deterministic_hash);
  });

  it('create workflow adds a new workflow', () => {
    const wf = automationV2Store.createWorkflow({ name: 'Test' });
    expect(wf.name).toBe('Test');
    expect(automationV2Store.getWorkflows()).toHaveLength(4);
  });

  it('delete workflow removes it', () => {
    automationV2Store.deleteWorkflow('wf-simple-log');
    expect(automationV2Store.getWorkflows()).toHaveLength(2);
  });

  it('run nonexistent workflow returns null', () => {
    const result = automationV2Store.runWorkflow('nonexistent');
    expect(result).toBeNull();
  });

  it('reset restores demo state', () => {
    automationV2Store.runWorkflow('wf-simple-log');
    automationV2Store.deleteWorkflow('wf-simple-log');
    automationV2Store.reset();
    expect(automationV2Store.getWorkflows()).toHaveLength(3);
    expect(automationV2Store.getRuns()).toHaveLength(0);
  });
});

// ── Export Store ───────────────────────────────────────────────

describe('exportStore', () => {
  beforeEach(() => { exportStore.reset(); });

  it('starts with manifest', () => {
    const m = exportStore.getManifest();
    expect(m.sections).toHaveLength(3);
    expect(m.manifest_version).toBe('1.0.0');
  });

  it('starts with no bundle', () => {
    expect(exportStore.getBundle()).toBeNull();
  });

  it('generate bundle creates one', () => {
    const bundle = exportStore.generateBundle();
    expect(bundle).not.toBeNull();
    expect(bundle!.mode).toBe('live');
    expect(bundle!.deterministic_hash).toBeTruthy();
  });

  it('isExporting is false after generation', () => {
    exportStore.generateBundle();
    expect(exportStore.getIsExporting()).toBe(false);
  });

  it('reset clears bundle', () => {
    exportStore.generateBundle();
    exportStore.reset();
    expect(exportStore.getBundle()).toBeNull();
  });
});

// ── Platform Health Store ─────────────────────────────────────

describe('platformHealthStore', () => {
  beforeEach(() => { platformHealthStore.reset(); });

  it('starts healthy', () => {
    const h = platformHealthStore.getHealth();
    expect(h.status).toBe('healthy');
    expect(h.mode).toBe('live');
  });

  it('has 4 services', () => {
    const h = platformHealthStore.getHealth();
    expect(Object.keys(h.services)).toHaveLength(4);
  });

  it('has metrics', () => {
    const h = platformHealthStore.getHealth();
    expect(h.metrics.uptime_seconds).toBe(86400);
    expect(h.metrics.error_rate).toBe(0);
  });

  it('refresh updates timestamp', () => {
    platformHealthStore.refresh();
    expect(platformHealthStore.getLastRefresh()).toBeTruthy();
  });

  it('services include autopilot_v2', () => {
    const h = platformHealthStore.getHealth();
    expect(h.services.autopilot_v2.status).toBe('ok');
    expect(h.services.autopilot_v2.version).toBe('2.0.0');
  });

  it('reset restores defaults', () => {
    platformHealthStore.refresh();
    platformHealthStore.reset();
    const h = platformHealthStore.getHealth();
    expect(h.status).toBe('healthy');
  });
});
