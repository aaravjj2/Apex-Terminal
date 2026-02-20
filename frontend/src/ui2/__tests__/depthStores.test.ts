/**
 * Depth Store Unit Tests — Vitest
 * Tests all 4 depth stores for determinism, correctness, and export hash stability.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// We import directly — these are pure TS modules, no React needed
import { autopilotDepthStore } from '../stores/autopilotDepthStore';
import { backtestDepthStore, type SweepConfig } from '../stores/backtestDepthStore';
import { workflowDepthStore } from '../stores/workflowDepthStore';
import { searchDepthStore } from '../stores/searchDepthStore';

// ──────────────────────────────────────────────────────────────────────────
// A: Autopilot Depth Store
// ──────────────────────────────────────────────────────────────────────────
describe('autopilotDepthStore', () => {
  beforeEach(() => autopilotDepthStore.reset());

  it('returns default risk controls', () => {
    const rc = autopilotDepthStore.getRiskControls();
    expect(rc.max_position_notional).toBe(50000);
    expect(rc.max_gross_exposure).toBe(200000);
    expect(rc.max_daily_loss).toBe(5000);
    expect(rc.max_trades_per_run).toBe(20);
  });

  it('updates risk controls immutably', () => {
    const before = autopilotDepthStore.getRiskControls();
    autopilotDepthStore.updateRiskControls({ max_daily_loss: 8000 });
    const after = autopilotDepthStore.getRiskControls();
    expect(after.max_daily_loss).toBe(8000);
    expect(before.max_daily_loss).toBe(5000); // original untouched
  });

  it('returns default execution params', () => {
    const ep = autopilotDepthStore.getExecutionParams();
    expect(ep.fee_per_order).toBe(1.50);
    expect(ep.bps_fee).toBe(2.5);
    expect(ep.slippage_base_bps).toBe(1.0);
    expect(ep.slippage_vol_multiplier).toBe(1.5);
  });

  it('updates execution params', () => {
    autopilotDepthStore.updateExecutionParams({ fee_per_order: 2.0 });
    expect(autopilotDepthStore.getExecutionParams().fee_per_order).toBe(2.0);
  });

  it('runs evaluation deterministically', () => {
    const eval1 = autopilotDepthStore.runEvaluation('run-abc');
    const eval2 = autopilotDepthStore.runEvaluation('run-abc');
    expect(eval1.hash).toBe(eval2.hash);
    expect(eval1.attribution.length).toBeGreaterThan(0);
    expect(eval1.fills.length).toBeGreaterThan(0);
    expect(Object.keys(eval1.risk_budget_remaining).length).toBe(8);
  });

  it('caches evaluations by run_id', () => {
    autopilotDepthStore.runEvaluation('run-xyz');
    const cached = autopilotDepthStore.getEvaluation('run-xyz');
    expect(cached).not.toBeNull();
    expect(cached!.run_id).toBe('run-xyz');
  });

  it('export hash is stable across calls', () => {
    autopilotDepthStore.runEvaluation('run-stable');
    const h1 = autopilotDepthStore.getExportHash('run-stable');
    const h2 = autopilotDepthStore.getExportHash('run-stable');
    expect(h1).toBe(h2);
    expect(typeof h1).toBe('string');
    expect(h1.length).toBeGreaterThan(4);
  });

  it('different run_ids produce different evaluations', () => {
    const e1 = autopilotDepthStore.runEvaluation('run-aaa');
    const e2 = autopilotDepthStore.runEvaluation('run-bbb');
    expect(e1.hash).not.toBe(e2.hash);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// B: Backtest Depth Store
// ──────────────────────────────────────────────────────────────────────────
describe('backtestDepthStore', () => {
  beforeEach(() => backtestDepthStore.reset());

  it('runs a parameter sweep with correct grid size', () => {
    const config: SweepConfig = {
      sweep_id: 'test-sweep',
      symbol: 'AAPL',
      strategy_id: 'strat-1',
      params: [
        { name: 'sma_fast', min: 5, max: 25, step: 5 },
        { name: 'sma_slow', min: 20, max: 60, step: 10 },
      ],
      metric: 'sharpe',
    };
    const result = backtestDepthStore.runSweep(config);
    // 5 values × 5 values = 25 cells
    expect(result.cells.length).toBe(25);
    expect(result.best_cell_id).toBeTruthy();
    expect(result.hash.length).toBeGreaterThan(4);
  });

  it('sweep results are deterministic', () => {
    const config: SweepConfig = {
      sweep_id: 'det-test',
      symbol: 'SPY',
      strategy_id: 'strat-2',
      params: [
        { name: 'sma_fast', min: 5, max: 15, step: 5 },
        { name: 'sma_slow', min: 20, max: 40, step: 10 },
      ],
      metric: 'sharpe',
    };
    const r1 = backtestDepthStore.runSweep(config);
    backtestDepthStore.reset();
    const r2 = backtestDepthStore.runSweep(config);
    expect(r1.hash).toBe(r2.hash);
    expect(r1.best_cell_id).toBe(r2.best_cell_id);
  });

  it('runs walk-forward with 6 windows', () => {
    const result = backtestDepthStore.runWalkForward('AAPL', 'strat-1');
    expect(result.windows.length).toBe(6);
    expect(result.aggregate_sharpe).toBeGreaterThan(0);
    expect(typeof result.oos_degradation).toBe('number');
    expect(result.hash.length).toBeGreaterThan(4);
  });

  it('walk-forward is deterministic', () => {
    const r1 = backtestDepthStore.runWalkForward('NVDA', 'strat-3');
    backtestDepthStore.reset();
    const r2 = backtestDepthStore.runWalkForward('NVDA', 'strat-3');
    expect(r1.hash).toBe(r2.hash);
  });

  it('runs robustness with 8 scenarios', () => {
    const result = backtestDepthStore.runRobustness('AAPL', 'strat-1');
    expect(result.scenarios.length).toBe(8);
    expect(result.scenarios[0].label).toBe('Base Case');
    expect(result.robustness_score).toBeGreaterThanOrEqual(0);
    expect(result.robustness_score).toBeLessThanOrEqual(100);
  });

  it('robustness is deterministic', () => {
    const r1 = backtestDepthStore.runRobustness('TSLA', 'strat-4');
    backtestDepthStore.reset();
    const r2 = backtestDepthStore.runRobustness('TSLA', 'strat-4');
    expect(r1.hash).toBe(r2.hash);
    expect(r1.robustness_score).toBe(r2.robustness_score);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// C: Workflow Depth Store
// ──────────────────────────────────────────────────────────────────────────
describe('workflowDepthStore', () => {
  beforeEach(() => workflowDepthStore.reset());

  it('starts with admin user', () => {
    expect(workflowDepthStore.getCurrentUser().role).toBe('admin');
  });

  it('switches users correctly', () => {
    workflowDepthStore.setCurrentUser('user-viewer-001');
    expect(workflowDepthStore.getCurrentUser().role).toBe('viewer');
  });

  it('enforces RBAC policies', () => {
    // Admin can do everything
    expect(workflowDepthStore.canPerform('create_template')).toBe(true);
    expect(workflowDepthStore.canPerform('export_audit')).toBe(true);
    // Trader can clone but not create templates
    workflowDepthStore.setCurrentUser('user-trader-001');
    expect(workflowDepthStore.canPerform('clone_template')).toBe(true);
    expect(workflowDepthStore.canPerform('create_template')).toBe(false);
    // Viewer can only view
    workflowDepthStore.setCurrentUser('user-viewer-001');
    expect(workflowDepthStore.canPerform('view_workflow')).toBe(true);
    expect(workflowDepthStore.canPerform('run_workflow')).toBe(false);
  });

  it('has 4 initial templates', () => {
    expect(workflowDepthStore.getTemplates().length).toBe(4);
  });

  it('searches templates by name and tag', () => {
    expect(workflowDepthStore.searchTemplates('export').length).toBeGreaterThan(0);
    expect(workflowDepthStore.searchTemplates('risk').length).toBeGreaterThan(0);
    expect(workflowDepthStore.searchTemplates('nonexistent-xyz').length).toBe(0);
  });

  it('clones a template', () => {
    const before = workflowDepthStore.getTemplates().length;
    const cloned = workflowDepthStore.cloneTemplate('tmpl-001');
    expect(cloned).not.toBeNull();
    expect(cloned!.name).toContain('Copy');
    expect(workflowDepthStore.getTemplates().length).toBe(before + 1);
  });

  it('has 3 initial scheduled jobs', () => {
    expect(workflowDepthStore.getScheduledJobs().length).toBe(3);
  });

  it('creates a schedule', () => {
    const job = workflowDepthStore.createSchedule('wf-test', 'Test WF', '0 9 * * *');
    expect(job.status).toBe('active');
    expect(workflowDepthStore.getScheduledJobs().length).toBe(4);
  });

  it('toggles job status', () => {
    workflowDepthStore.toggleJobStatus('job-001');
    const job = workflowDepthStore.getScheduledJobs().find(j => j.job_id === 'job-001');
    expect(job!.status).toBe('paused');
    workflowDepthStore.toggleJobStatus('job-001');
    const job2 = workflowDepthStore.getScheduledJobs().find(j => j.job_id === 'job-001');
    expect(job2!.status).toBe('active');
  });

  it('has 8 initial run history records', () => {
    expect(workflowDepthStore.getRunHistory().length).toBe(8);
  });

  it('triggers deterministic run', () => {
    const before = workflowDepthStore.getRunHistory().length;
    const r = workflowDepthStore.triggerDeterministicRun('wf-daily-export', 'Export');
    expect(r.status).toBe('success');
    expect(workflowDepthStore.getRunHistory().length).toBe(before + 1);
  });

  it('exports audit with hash', () => {
    const exp = workflowDepthStore.exportAudit('wf-daily-export');
    expect(exp.hash.length).toBeGreaterThan(4);
    expect(exp.run_records.length).toBeGreaterThan(0);
  });

  it('export hash is deterministic', () => {
    const h1 = workflowDepthStore.getExportHash('wf-daily-export');
    const h2 = workflowDepthStore.getExportHash('wf-daily-export');
    expect(h1).toBe(h2);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// D: Search Depth Store
// ──────────────────────────────────────────────────────────────────────────
describe('searchDepthStore', () => {
  beforeEach(() => searchDepthStore.reset());

  it('provider status defaults to local backend', () => {
    const ps = searchDepthStore.getProviderStatus();
    expect(ps.active_backend).toBe('local');
    expect(ps.health).toBe('green');
    expect(ps.is_reachable).toBe(true);
  });

  it('has doc count from all mapped indices', () => {
    const ps = searchDepthStore.getProviderStatus();
    expect(ps.doc_count).toBe(156 + 42 + 28); // orders + strategies + workflows
    expect(ps.index_count).toBe(3);
  });

  it('has 3 index mappings', () => {
    const mappings = searchDepthStore.getMappings();
    expect(mappings.length).toBe(3);
    expect(mappings.map(m => m.index_name)).toContain('apex-orders');
    expect(mappings.map(m => m.index_name)).toContain('apex-strategies');
    expect(mappings.map(m => m.index_name)).toContain('apex-workflows');
  });

  it('generates explain with 4 factors', () => {
    const explain = searchDepthStore.getExplain('doc-001', 'AAPL momentum');
    expect(explain.factors.length).toBe(4);
    expect(explain.total_score).toBeGreaterThan(0);
    expect(explain.backend).toBe('local');
  });

  it('explain is deterministic', () => {
    const e1 = searchDepthStore.getExplain('doc-123', 'test query');
    const e2 = searchDepthStore.getExplain('doc-123', 'test query');
    expect(e1.explain_hash).toBe(e2.explain_hash);
    expect(e1.total_score).toBe(e2.total_score);
  });

  it('different queries produce different explains', () => {
    const e1 = searchDepthStore.getExplain('doc-abc', 'query1');
    const e2 = searchDepthStore.getExplain('doc-abc', 'query2');
    expect(e1.explain_hash).not.toBe(e2.explain_hash);
  });

  it('generates stable doc IDs', () => {
    const id1 = searchDepthStore.generateStableDocId('order', 'Buy AAPL');
    const id2 = searchDepthStore.generateStableDocId('order', 'Buy AAPL');
    expect(id1).toBe(id2);
  });

  it('returns search config with elastic OFF', () => {
    const config = searchDepthStore.getSearchConfig();
    expect(config.provider).toBe('local');
    expect(config.elastic_configured).toBe(false);
    expect(config.elastic_url).toBeNull();
  });

  it('doc schema matches first index mapping', () => {
    const schema = searchDepthStore.getDocSchema();
    expect(schema.length).toBeGreaterThan(0);
    expect(schema.find(f => f.field_name === 'title')).toBeTruthy();
    expect(schema.find(f => f.field_name === 'body')).toBeTruthy();
  });
});
