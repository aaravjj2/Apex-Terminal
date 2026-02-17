/**
 * Wave 15/17/18 Store Unit Tests
 * Tests for searchStore (v2), llmProviderStore, wave18Store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { searchStore, type SearchResult, type DocumentType } from '../../src/ui2/stores/searchStore';
import { llmProviderStore } from '../../src/ui2/stores/llmProviderStore';
import { wave18Store } from '../../src/ui2/stores/wave18Store';

// ── Wave 15: Search Store V2 ────────────────────────────────

describe('searchStore (v2)', () => {
  beforeEach(() => {
    searchStore.reset();
  });

  it('has initial state with empty query', () => {
    const s = searchStore.getState();
    expect(s.query).toBe('');
    expect(s.results).toEqual([]);
  });

  it('returns all entity types', () => {
    const types = searchStore.getEntityTypes();
    expect(types).toContain('all');
    expect(types).toContain('order');
    expect(types).toContain('trade');
    expect(types).toContain('decision');
    expect(types).toContain('incident');
  });

  it('search finds demo results for AAPL', () => {
    searchStore.search('AAPL');
    const s = searchStore.getState();
    expect(s.query).toBe('AAPL');
    expect(s.results.length).toBeGreaterThan(0);
    expect(s.results.some(r => r.title.includes('AAPL'))).toBe(true);
  });

  it('filters by entity type', () => {
    searchStore.search('', 'order');
    const s = searchStore.getState();
    // All results should be orders
    const nonOrders = s.results.filter(r => r.entity_type !== 'order');
    expect(nonOrders.length).toBe(0);
  });

  it('groups results correctly', () => {
    searchStore.search('');
    const s = searchStore.getState();
    expect(s.groupCounts).toBeDefined();
    expect(typeof s.groupCounts).toBe('object');
  });

  it('selects result and populates selectedEntity', () => {
    searchStore.search('AAPL');
    const s = searchStore.getState();
    if (s.results.length > 0) {
      searchStore.selectResult(s.results[0].id);
      const s2 = searchStore.getState();
      expect(s2.selectedEntity).not.toBeNull();
      expect(s2.selectedEntity!.id).toBe(s.results[0].id);
    }
  });

  it('computes related entities when selecting', () => {
    searchStore.search('AAPL');
    const s = searchStore.getState();
    if (s.results.length > 0) {
      searchStore.selectResult(s.results[0].id);
      const s2 = searchStore.getState();
      expect(s2.relatedEntities).toBeDefined();
    }
  });

  it('provides recent searches', () => {
    const recent = searchStore.getRecentSearches();
    expect(Array.isArray(recent)).toBe(true);
    expect(recent.length).toBeGreaterThan(0);
  });

  it('clears recent searches', () => {
    searchStore.clearRecentSearches();
    const recent = searchStore.getRecentSearches();
    expect(recent.length).toBe(0);
  });

  it('sets filters', () => {
    searchStore.setFilters({ symbol: 'AAPL' });
    const s = searchStore.getState();
    expect(s.filters.symbol).toBe('AAPL');
  });

  it('reset restores initial state', () => {
    searchStore.search('test');
    searchStore.reset();
    const s = searchStore.getState();
    expect(s.query).toBe('');
    expect(s.results).toEqual([]);
  });
});

// ── Wave 17: LLM Provider Store ─────────────────────────────

describe('llmProviderStore', () => {
  beforeEach(() => {
    llmProviderStore.reset();
  });

  it('has initial demo status (not null)', () => {
    const s = llmProviderStore.getState();
    expect(s.status).not.toBeNull();
    expect(s.status!.active_provider).toBe('deterministic');
  });

  it('fetchStatus populates demo status', async () => {
    await llmProviderStore.fetchStatus();
    const s = llmProviderStore.getState();
    expect(s.status).not.toBeNull();
    expect(s.status!.active_provider).toBeDefined();
    expect(s.status!.budget).toBeDefined();
    expect(s.status!.cache).toBeDefined();
    expect(s.status!.rate_limit).toBeDefined();
  });

  it('fetchReplay populates demo replay entries', async () => {
    await llmProviderStore.fetchReplay();
    const s = llmProviderStore.getState();
    expect(s.replayLog.length).toBeGreaterThan(0);
    expect(s.replayLog[0].prompt_hash).toBeDefined();
  });

  it('clearCache calls without error', async () => {
    await llmProviderStore.clearCache();
  });

  it('resetBudget calls without error', async () => {
    await llmProviderStore.resetBudget();
  });

  it('reset restores demo state', () => {
    llmProviderStore.reset();
    const s = llmProviderStore.getState();
    expect(s.status).not.toBeNull();
    expect(s.replayLog.length).toBeGreaterThan(0);
  });
});

// ── Wave 18: Decisions V2 Store ─────────────────────────────

describe('wave18Store — decisions', () => {
  beforeEach(() => {
    wave18Store.reset();
  });

  it('getDecisions returns 4 demo decisions sorted by timestamp desc', () => {
    const decisions = wave18Store.getDecisions();
    expect(decisions.length).toBe(4);
    for (let i = 0; i < decisions.length - 1; i++) {
      expect(decisions[i].timestamp >= decisions[i + 1].timestamp).toBe(true);
    }
  });

  it('each decision has feature_attribution', () => {
    const decisions = wave18Store.getDecisions();
    for (const d of decisions) {
      expect(d.feature_attribution).toBeDefined();
      expect(Object.keys(d.feature_attribution).length).toBeGreaterThan(0);
    }
  });

  it('each decision has confidence_breakdown', () => {
    const decisions = wave18Store.getDecisions();
    for (const d of decisions) {
      expect(d.confidence_breakdown).toBeDefined();
      expect(d.confidence_breakdown.composite).toBeDefined();
      expect(d.confidence_breakdown.signal_quality).toBeDefined();
    }
  });

  it('approved decisions have post_trade_eval', () => {
    const approved = wave18Store.getDecisions().filter(d => d.status === 'approved');
    expect(approved.length).toBeGreaterThan(0);
    for (const d of approved) {
      expect(d.post_trade_eval).not.toBeNull();
      expect(d.post_trade_eval!.actual_pnl).toBeDefined();
    }
  });

  it('rejected decisions have null post_trade_eval', () => {
    const rejected = wave18Store.getDecisions().filter(d => d.status === 'rejected');
    for (const d of rejected) {
      expect(d.post_trade_eval).toBeNull();
    }
  });

  it('selectDecision sets selectedDecision', () => {
    const decisions = wave18Store.getDecisions();
    wave18Store.selectDecision(decisions[0].decision_id);
    const s = wave18Store.getState();
    expect(s.selectedDecision).not.toBeNull();
    expect(s.selectedDecision!.decision_id).toBe(decisions[0].decision_id);
  });

  it('selectDecision(null) clears selected', () => {
    const decisions = wave18Store.getDecisions();
    wave18Store.selectDecision(decisions[0].decision_id);
    wave18Store.selectDecision(null);
    const s = wave18Store.getState();
    expect(s.selectedDecision).toBeNull();
  });
});

// ── Wave 18: NL Workflow Store ──────────────────────────────

describe('wave18Store — NL workflow', () => {
  beforeEach(() => {
    wave18Store.reset();
  });

  it('initial NL state is empty', () => {
    const s = wave18Store.getState();
    expect(s.nlPrompt).toBe('');
    expect(s.generatedWorkflow).toBeNull();
    expect(s.validation).toBeNull();
    expect(s.simulation).toBeNull();
  });

  it('setNLPrompt updates prompt', () => {
    wave18Store.setNLPrompt('Create a daily export');
    const s = wave18Store.getState();
    expect(s.nlPrompt).toBe('Create a daily export');
  });

  it('generateWorkflow creates workflow from prompt', async () => {
    await wave18Store.generateWorkflow('Create a daily report export');
    const s = wave18Store.getState();
    expect(s.generatedWorkflow).not.toBeNull();
    expect(s.generatedWorkflow!.name).toBeDefined();
    expect(s.generatedWorkflow!.trigger).toBeDefined();
    expect(s.generatedWorkflow!.actions.length).toBeGreaterThan(0);
  });

  it('validateWorkflow validates generated workflow', async () => {
    await wave18Store.generateWorkflow('daily export workflow');
    const s1 = wave18Store.getState();
    if (s1.generatedWorkflow) {
      await wave18Store.validateWorkflow(s1.generatedWorkflow);
      const s2 = wave18Store.getState();
      expect(s2.validation).not.toBeNull();
      expect(typeof s2.validation!.valid).toBe('boolean');
    }
  });

  it('simulateWorkflow runs simulation', async () => {
    await wave18Store.generateWorkflow('daily export workflow');
    const s1 = wave18Store.getState();
    if (s1.generatedWorkflow) {
      await wave18Store.simulateWorkflow(s1.generatedWorkflow, 42);
      const s2 = wave18Store.getState();
      expect(s2.simulation).not.toBeNull();
      expect(s2.simulation!.total_duration_ms).toBeGreaterThan(0);
      expect(s2.simulation!.seed).toBe(42);
    }
  });

  it('clearWorkflow resets NL state', async () => {
    await wave18Store.generateWorkflow('test');
    wave18Store.clearWorkflow();
    const s = wave18Store.getState();
    expect(s.generatedWorkflow).toBeNull();
    expect(s.validation).toBeNull();
    expect(s.simulation).toBeNull();
  });
});
