/**
 * Waves 21-50 Stores — Backtest Engine v4 + Elasticsearch v3
 * createStore<T> factory pattern, useSyncExternalStore-compatible.
 */

const API_BT = '/api/v3/backtest';
const API_ES = '/api/v3/elasticsearch';

/** Safe JSON parse — never throws "Unexpected end of JSON input" */
async function safeJson<T = any>(r: Response): Promise<T> {
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 200) || r.statusText}`);
  }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    const text = await r.text().catch(() => '');
    throw new Error(`Expected JSON but got ${ct || 'no content-type'}: ${text.slice(0, 200)}`);
  }
  const text = await r.text();
  if (!text || text.trim().length === 0) {
    throw new Error('Empty response body');
  }
  return JSON.parse(text) as T;
}

// Generic store factory
function createStore<T extends object>(initialState: T) {
  let state = { ...initialState };
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getState(): T { return state; },
    setState(partial: Partial<T>) {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn());
    },
  };
}

// ═══════════════════════════════════════════════════
// Waves 21-26: Data Pipeline & Quality
// ═══════════════════════════════════════════════════

export interface DataHealthState {
  health: any | null;
  symbols: string[];
  quality: any | null;
  loading: boolean;
  error: string;
}

export const dataHealthStore = (() => {
  const store = createStore<DataHealthState>({ health: null, symbols: [], quality: null, loading: false, error: '' });
  return {
    ...store,
    async fetchHealth() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/data/health`);
        const data = await safeJson(r);
        store.setState({ health: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchSymbols() {
      try {
        const r = await fetch(`${API_BT}/data/symbols`);
        const data = await safeJson(r);
        store.setState({ symbols: data.symbols || [] });
      } catch {}
    },
    async fetchQuality(symbol: string) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/data/quality/${symbol}`);
        const data = await safeJson(r);
        store.setState({ quality: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async ingestSymbol(symbol: string) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/data/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol }) });
        await safeJson(r);
        store.setState({ loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();


// ═══════════════════════════════════════════════════
// Waves 27-33: Backtest Engine v4
// ═══════════════════════════════════════════════════

export interface BacktestV4State {
  result: any | null;
  runs: any[];
  trace: any | null;
  explain: any | null;
  costModels: string[];
  riskLimits: any | null;
  orderTypes: string[];
  loading: boolean;
  error: string;
}

export const backtestV4Store = (() => {
  const store = createStore<BacktestV4State>({ result: null, runs: [], trace: null, explain: null, costModels: [], riskLimits: null, orderTypes: [], loading: false, error: '' });
  return {
    ...store,
    async runBacktest(params: { symbols: string[]; initial_capital?: number; cost_model?: string; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ result: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchRuns() {
      try {
        const r = await fetch(`${API_BT}/runs`);
        const data = await safeJson(r);
        store.setState({ runs: data.runs || [] });
      } catch {}
    },
    async fetchTrace(runId: string) {
      try {
        const r = await fetch(`${API_BT}/runs/${runId}/trace`);
        const data = await safeJson(r);
        store.setState({ trace: data });
      } catch {}
    },
    async fetchExplain(runId: string) {
      try {
        const r = await fetch(`${API_BT}/runs/${runId}/explain`);
        const data = await safeJson(r);
        store.setState({ explain: data });
      } catch {}
    },
    async fetchCostModels() {
      try {
        const r = await fetch(`${API_BT}/cost-models`);
        const data = await safeJson(r);
        store.setState({ costModels: data.models || [] });
      } catch {}
    },
    async fetchRiskLimits() {
      try {
        const r = await fetch(`${API_BT}/risk-limits`);
        const data = await safeJson(r);
        store.setState({ riskLimits: data });
      } catch {}
    },
    async fetchOrderTypes() {
      try {
        const r = await fetch(`${API_BT}/order-types`);
        const data = await safeJson(r);
        store.setState({ orderTypes: data.order_types || [] });
      } catch {}
    },
  };
})();

// ═══════════════════════════════════════════════════
// Waves 34-40: Evaluation Suite
// ═══════════════════════════════════════════════════

export interface EvaluationState {
  sweep: any | null;
  walkForward: any | null;
  robustness: any | null;
  overfit: any | null;
  benchmark: any | null;
  monteCarlo: any | null;
  portfolioSelect: any | null;
  loading: boolean;
  error: string;
}

export const evaluationStore = (() => {
  const store = createStore<EvaluationState>({ sweep: null, walkForward: null, robustness: null, overfit: null, benchmark: null, monteCarlo: null, portfolioSelect: null, loading: false, error: '' });
  return {
    ...store,
    async runSweep(params: { symbols: string[]; params?: any[]; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/sweep`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ sweep: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runWalkForward(params: { symbols: string[]; n_folds?: number; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/walk-forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ walkForward: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runRobustness(params: { symbols: string[]; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/robustness`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ robustness: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runOverfit(params: { symbols: string[]; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/overfit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ overfit: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runBenchmark(params: { symbols: string[]; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/benchmark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ benchmark: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runMonteCarlo(params: { symbols: string[]; n_paths?: number; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/monte-carlo-v2`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ monteCarlo: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async runPortfolioSelect(params: { symbols: string[]; seed?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/portfolio-select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await safeJson(r);
        store.setState({ portfolioSelect: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ═══════════════════════════════════════════════════
// Waves 41-45: Strategy System
// ═══════════════════════════════════════════════════

export interface StrategyV2State {
  validation: any | null;
  aiAssist: any | null;
  candidates: any[];
  jobs: any[];
  loading: boolean;
  error: string;
}

export const strategyV2Store = (() => {
  const store = createStore<StrategyV2State>({ validation: null, aiAssist: null, candidates: [], jobs: [], loading: false, error: '' });
  return {
    ...store,
    async validateSpec(spec: any) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/strategy/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spec) });
        const data = await safeJson(r);
        store.setState({ validation: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async aiAssistParse(prompt: string) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/strategy/ai-assist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        const data = await safeJson(r);
        store.setState({ aiAssist: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async generateCandidates(baseSpec: any, n = 5) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/strategy/candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_spec: baseSpec, n_candidates: n }) });
        const data = await safeJson(r);
        store.setState({ candidates: data.candidates || [], loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async submitJob(params: any) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_BT}/jobs/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        await safeJson(r);
        store.setState({ loading: false });
        await this.fetchJobs();
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchJobs() {
      try {
        const r = await fetch(`${API_BT}/jobs`);
        const data = await safeJson(r);
        store.setState({ jobs: data.jobs || [] });
      } catch {}
    },
    async cancelJob(jobId: string) {
      try {
        await fetch(`${API_BT}/jobs/${jobId}/cancel`, { method: 'POST' });
        await this.fetchJobs();
      } catch {}
    },
  };
})();

// ═══════════════════════════════════════════════════
// Waves 46-50: Elasticsearch v3
// ═══════════════════════════════════════════════════

export interface ElasticV3State {
  templates: any[];
  aliases: any[];
  pipelineMetrics: any | null;
  dlq: any[];
  lag: any | null;
  searchResult: any | null;
  savedQueries: any[];
  semanticEnabled: boolean;
  artifacts: any[];
  loading: boolean;
  error: string;
}

export const elasticV3Store = (() => {
  const store = createStore<ElasticV3State>({ templates: [], aliases: [], pipelineMetrics: null, dlq: [], lag: null, searchResult: null, savedQueries: [], semanticEnabled: false, artifacts: [], loading: false, error: '' });
  return {
    ...store,
    async fetchTemplates() {
      try {
        const r = await fetch(`${API_ES}/index-templates`);
        const data = await safeJson(r);
        store.setState({ templates: data.templates || [] });
      } catch {}
    },
    async fetchAliases() {
      try {
        const r = await fetch(`${API_ES}/aliases`);
        const data = await safeJson(r);
        store.setState({ aliases: data.aliases || [] });
      } catch {}
    },
    async fetchPipelineMetrics() {
      try {
        const r = await fetch(`${API_ES}/pipeline/metrics`);
        const data = await safeJson(r);
        store.setState({ pipelineMetrics: data });
      } catch {}
    },
    async fetchDLQ() {
      try {
        const r = await fetch(`${API_ES}/pipeline/dlq`);
        const data = await safeJson(r);
        store.setState({ dlq: data.dlq || [] });
      } catch {}
    },
    async fetchLag() {
      try {
        const r = await fetch(`${API_ES}/pipeline/lag`);
        const data = await safeJson(r);
        store.setState({ lag: data });
      } catch {}
    },
    async search(query: string, index = 'apex-strategies', explain = false) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_ES}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, index, explain }) });
        const data = await safeJson(r);
        store.setState({ searchResult: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchSavedQueries() {
      try {
        const r = await fetch(`${API_ES}/saved-queries`);
        const data = await safeJson(r);
        store.setState({ savedQueries: data.queries || [] });
      } catch {}
    },
    async saveQuery(name: string, query: string, index: string) {
      try {
        await fetch(`${API_ES}/saved-queries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, query, index }) });
        await this.fetchSavedQueries();
      } catch {}
    },
    async fetchSemanticStatus() {
      try {
        const r = await fetch(`${API_ES}/semantic/status`);
        const data = await safeJson(r);
        store.setState({ semanticEnabled: data.enabled || false });
      } catch {}
    },
    async fetchArtifacts() {
      try {
        const r = await fetch(`${API_ES}/artifacts`);
        const data = await safeJson(r);
        store.setState({ artifacts: data.artifacts || [] });
      } catch {}
    },
    async exportArtifact(type: string, data: any) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API_ES}/artifacts/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artifact_type: type, data }) });
        await safeJson(r);
        store.setState({ loading: false });
        await this.fetchArtifacts();
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();
