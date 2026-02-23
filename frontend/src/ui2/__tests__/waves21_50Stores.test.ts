/**
 * Waves 21-50 Store Unit Tests — Vitest
 * Tests all wave stores for state management correctness.
 */
import { describe, it, expect } from 'vitest';

import {
  dataHealthStore,
  backtestV4Store,
  evaluationStore,
  strategyV2Store,
  elasticV3Store,
} from '../stores/waves21_50Store';

// ──────────────────────────────────────────────────────────────────────────
// Data Health Store (Waves 21-26)
// ──────────────────────────────────────────────────────────────────────────
describe('dataHealthStore', () => {
  it('has correct initial state', () => {
    const state = dataHealthStore.getState();
    expect(state.health).toBeNull();
    expect(state.symbols).toEqual([]);
    expect(state.quality).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('');
  });

  it('supports subscribe/unsubscribe', () => {
    let called = false;
    const unsub = dataHealthStore.subscribe(() => { called = true; });
    dataHealthStore.setState({ loading: true });
    expect(called).toBe(true);
    unsub();
  });

  it('updates state immutably', () => {
    const before = dataHealthStore.getState();
    dataHealthStore.setState({ symbols: ['AAPL', 'MSFT'] });
    const after = dataHealthStore.getState();
    expect(after.symbols).toEqual(['AAPL', 'MSFT']);
    expect(before.symbols).toEqual([]); // not mutated since createStore spreads
  });

  it('has fetchHealth method', () => {
    expect(typeof dataHealthStore.fetchHealth).toBe('function');
  });

  it('has fetchSymbols method', () => {
    expect(typeof dataHealthStore.fetchSymbols).toBe('function');
  });

  it('has fetchQuality method', () => {
    expect(typeof dataHealthStore.fetchQuality).toBe('function');
  });

  it('has ingestSymbol method', () => {
    expect(typeof dataHealthStore.ingestSymbol).toBe('function');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Backtest V4 Store (Waves 27-33)
// ──────────────────────────────────────────────────────────────────────────
describe('backtestV4Store', () => {
  it('has correct initial state', () => {
    const state = backtestV4Store.getState();
    expect(state.result).toBeNull();
    expect(state.runs).toEqual([]);
    expect(state.trace).toBeNull();
    expect(state.explain).toBeNull();
    expect(state.costModels).toEqual([]);
    expect(state.riskLimits).toBeNull();
    expect(state.orderTypes).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('');
  });

  it('supports subscribe/unsubscribe', () => {
    let count = 0;
    const unsub = backtestV4Store.subscribe(() => { count++; });
    backtestV4Store.setState({ loading: true });
    backtestV4Store.setState({ loading: false });
    expect(count).toBe(2);
    unsub();
  });

  it('has runBacktest method', () => {
    expect(typeof backtestV4Store.runBacktest).toBe('function');
  });

  it('has fetchRuns method', () => {
    expect(typeof backtestV4Store.fetchRuns).toBe('function');
  });

  it('has fetchTrace method', () => {
    expect(typeof backtestV4Store.fetchTrace).toBe('function');
  });

  it('has fetchExplain method', () => {
    expect(typeof backtestV4Store.fetchExplain).toBe('function');
  });

  it('has fetchCostModels method', () => {
    expect(typeof backtestV4Store.fetchCostModels).toBe('function');
  });

  it('has fetchRiskLimits method', () => {
    expect(typeof backtestV4Store.fetchRiskLimits).toBe('function');
  });

  it('has fetchOrderTypes method', () => {
    expect(typeof backtestV4Store.fetchOrderTypes).toBe('function');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Evaluation Store (Waves 34-40)
// ──────────────────────────────────────────────────────────────────────────
describe('evaluationStore', () => {
  it('has correct initial state', () => {
    const state = evaluationStore.getState();
    expect(state.sweep).toBeNull();
    expect(state.walkForward).toBeNull();
    expect(state.robustness).toBeNull();
    expect(state.overfit).toBeNull();
    expect(state.benchmark).toBeNull();
    expect(state.monteCarlo).toBeNull();
    expect(state.portfolioSelect).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('');
  });

  it('has runSweep method', () => {
    expect(typeof evaluationStore.runSweep).toBe('function');
  });

  it('has runWalkForward method', () => {
    expect(typeof evaluationStore.runWalkForward).toBe('function');
  });

  it('has runRobustness method', () => {
    expect(typeof evaluationStore.runRobustness).toBe('function');
  });

  it('has runOverfit method', () => {
    expect(typeof evaluationStore.runOverfit).toBe('function');
  });

  it('has runBenchmark method', () => {
    expect(typeof evaluationStore.runBenchmark).toBe('function');
  });

  it('has runMonteCarlo method', () => {
    expect(typeof evaluationStore.runMonteCarlo).toBe('function');
  });

  it('has runPortfolioSelect method', () => {
    expect(typeof evaluationStore.runPortfolioSelect).toBe('function');
  });

  it('updates state correctly', () => {
    evaluationStore.setState({ sweep: { total_cells: 12 } });
    expect(evaluationStore.getState().sweep).toEqual({ total_cells: 12 });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Strategy V2 Store (Waves 41-45)
// ──────────────────────────────────────────────────────────────────────────
describe('strategyV2Store', () => {
  it('has correct initial state', () => {
    const state = strategyV2Store.getState();
    expect(state.validation).toBeNull();
    expect(state.aiAssist).toBeNull();
    expect(state.candidates).toEqual([]);
    expect(state.jobs).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('');
  });

  it('has validateSpec method', () => {
    expect(typeof strategyV2Store.validateSpec).toBe('function');
  });

  it('has aiAssistParse method', () => {
    expect(typeof strategyV2Store.aiAssistParse).toBe('function');
  });

  it('has generateCandidates method', () => {
    expect(typeof strategyV2Store.generateCandidates).toBe('function');
  });

  it('has submitJob method', () => {
    expect(typeof strategyV2Store.submitJob).toBe('function');
  });

  it('has fetchJobs method', () => {
    expect(typeof strategyV2Store.fetchJobs).toBe('function');
  });

  it('has cancelJob method', () => {
    expect(typeof strategyV2Store.cancelJob).toBe('function');
  });

  it('updates candidates correctly', () => {
    strategyV2Store.setState({ candidates: [{ name: 'c1' }, { name: 'c2' }] });
    expect(strategyV2Store.getState().candidates).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Elastic V3 Store (Waves 46-50)
// ──────────────────────────────────────────────────────────────────────────
describe('elasticV3Store', () => {
  it('has correct initial state', () => {
    const state = elasticV3Store.getState();
    expect(state.templates).toEqual([]);
    expect(state.aliases).toEqual([]);
    expect(state.pipelineMetrics).toBeNull();
    expect(state.dlq).toEqual([]);
    expect(state.lag).toBeNull();
    expect(state.searchResult).toBeNull();
    expect(state.savedQueries).toEqual([]);
    expect(state.semanticEnabled).toBe(false);
    expect(state.artifacts).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('');
  });

  it('has fetchTemplates method', () => {
    expect(typeof elasticV3Store.fetchTemplates).toBe('function');
  });

  it('has fetchAliases method', () => {
    expect(typeof elasticV3Store.fetchAliases).toBe('function');
  });

  it('has fetchPipelineMetrics method', () => {
    expect(typeof elasticV3Store.fetchPipelineMetrics).toBe('function');
  });

  it('has search method', () => {
    expect(typeof elasticV3Store.search).toBe('function');
  });

  it('has fetchSavedQueries method', () => {
    expect(typeof elasticV3Store.fetchSavedQueries).toBe('function');
  });

  it('has saveQuery method', () => {
    expect(typeof elasticV3Store.saveQuery).toBe('function');
  });

  it('has fetchSemanticStatus method', () => {
    expect(typeof elasticV3Store.fetchSemanticStatus).toBe('function');
  });

  it('has fetchArtifacts method', () => {
    expect(typeof elasticV3Store.fetchArtifacts).toBe('function');
  });

  it('has exportArtifact method', () => {
    expect(typeof elasticV3Store.exportArtifact).toBe('function');
  });

  it('updates templates correctly', () => {
    elasticV3Store.setState({ templates: [{ name: 'test' }] });
    expect(elasticV3Store.getState().templates).toHaveLength(1);
  });

  it('supports subscribe', () => {
    let notified = false;
    const unsub = elasticV3Store.subscribe(() => { notified = true; });
    elasticV3Store.setState({ loading: true });
    expect(notified).toBe(true);
    unsub();
  });
});
