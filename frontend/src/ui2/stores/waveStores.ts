// Wave 6-10 UI2 Stores — Shared external store pattern
// Each store follows: subscribe/getState/fetch pattern for useSyncExternalStore

const API = '/api/v1';

// ── Generic Store Factory ─────────────────────────────────────────
type Listener = () => void;

function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState(): T {
      return state;
    },
    setState(partial: Partial<T>) {
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn());
    },
  };
}

// ── Monte Carlo Store ─────────────────────────────────────────────
export interface MCResult {
  config_hash: string;
  symbol: string;
  percentile_5: number;
  percentile_50: number;
  percentile_95: number;
  expected_return: number;
  max_drawdown_avg: number;
  var_95: number;
  paths: Array<{ path_id: number; prices: number[]; final_price: number; return_pct: number }>;
}

export const monteCarloStore = (() => {
  const store = createStore<{ result: MCResult | null; loading: boolean; error: string }>({
    result: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async run(config: Record<string, unknown> = {}) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/monte-carlo/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const data = await r.json();
        store.setState({ result: data, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Walk-Forward Store ────────────────────────────────────────────
export interface WFResult {
  config_hash: string;
  strategy_id: string;
  symbol: string;
  folds: Array<{
    fold_id: number;
    in_sample_sharpe: number;
    out_sample_sharpe: number;
    in_sample_return_pct: number;
    out_sample_return_pct: number;
  }>;
  avg_is_sharpe: number;
  avg_oos_sharpe: number;
  degradation_ratio: number;
  robust: boolean;
}

export const walkForwardStore = (() => {
  const store = createStore<{ result: WFResult | null; loading: boolean; error: string }>({
    result: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async run(config: Record<string, unknown> = {}) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/walk-forward/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        store.setState({ result: await r.json(), loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Scoring Store ─────────────────────────────────────────────────
export interface ScoreResult {
  symbol: string;
  strategy: string;
  total_score: number;
  grade: string;
  recommendation: string;
  breakdown: Record<string, number>;
}

export const scoringStore = (() => {
  const store = createStore<{ scores: ScoreResult[]; loading: boolean; error: string }>({
    scores: [],
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchDemo() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/scoring/demo`);
        const data = await r.json();
        store.setState({ scores: data.scores, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Sentiment Store ───────────────────────────────────────────────
export interface SymbolSentiment {
  symbol: string;
  overall_sentiment: string;
  score: number;
  article_count: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  top_headline: string;
}

export const sentimentStore = (() => {
  const store = createStore<{ sentiments: SymbolSentiment[]; mood: string; loading: boolean; error: string }>({
    sentiments: [],
    mood: '',
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [sentR, moodR] = await Promise.all([
          fetch(`${API}/sentiment/symbols`),
          fetch(`${API}/sentiment/market-mood`),
        ]);
        const sentData = await sentR.json();
        const moodData = await moodR.json();
        store.setState({ sentiments: sentData.sentiments, mood: moodData.mood, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Regime Store ──────────────────────────────────────────────────
export interface RegimeData {
  symbol: string;
  regime: string;
  confidence: number;
  vix_level: number;
  iv_rank: number;
}

export const regimeStore = (() => {
  const store = createStore<{ regimes: RegimeData[]; summary: Record<string, unknown> | null; loading: boolean; error: string }>({
    regimes: [],
    summary: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [regR, sumR] = await Promise.all([
          fetch(`${API}/regime`),
          fetch(`${API}/regime/summary`),
        ]);
        const regData = await regR.json();
        const sumData = await sumR.json();
        store.setState({ regimes: regData.regimes, summary: sumData, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Elasticsearch Store ───────────────────────────────────────────
export interface ESHit {
  id: string;
  index: string;
  score: number;
  source: Record<string, unknown>;
}

export const elasticsearchStore = (() => {
  const store = createStore<{ hits: ESHit[]; total: number; status: Record<string, unknown> | null; loading: boolean; error: string }>({
    hits: [],
    total: 0,
    status: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async search(query: string, index = 'trades') {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/elasticsearch/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, index }),
        });
        const data = await r.json();
        store.setState({ hits: data.hits, total: data.total, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
    async fetchStatus() {
      try {
        const r = await fetch(`${API}/elasticsearch/status`);
        store.setState({ status: await r.json() });
      } catch {}
    },
  };
})();

// ── Nova Store ────────────────────────────────────────────────────
export const novaStore = (() => {
  const store = createStore<{ response: string; status: Record<string, unknown> | null; loading: boolean; error: string }>({
    response: '',
    status: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async generate(prompt: string) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/nova/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await r.json();
        store.setState({ response: data.text, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
    async fetchStatus() {
      try {
        const r = await fetch(`${API}/nova/status`);
        store.setState({ status: await r.json() });
      } catch {}
    },
  };
})();

// ── Market Hours Store ────────────────────────────────────────────
export const marketHoursStore = (() => {
  const store = createStore<{ session: Record<string, unknown> | null; holidays: Array<Record<string, unknown>>; canTrade: boolean | null; loading: boolean; error: string }>({
    session: null,
    holidays: [],
    canTrade: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [sesR, holR, canR] = await Promise.all([
          fetch(`${API}/market-hours/status`),
          fetch(`${API}/market-hours/holidays`),
          fetch(`${API}/market-hours/can-trade`),
        ]);
        store.setState({
          session: await sesR.json(),
          holidays: (await holR.json()).holidays,
          canTrade: (await canR.json()).can_trade,
          loading: false,
        });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── System Health Store ───────────────────────────────────────────
export interface ComponentHealth {
  name: string;
  status: string;
  latency_ms: number;
  details: Record<string, unknown>;
}

export const systemHealthStore = (() => {
  const store = createStore<{ report: Record<string, unknown> | null; components: ComponentHealth[]; loading: boolean; error: string }>({
    report: null,
    components: [],
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/system-health`);
        const data = await r.json();
        store.setState({ report: data, components: data.components || [], loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Observability Store ───────────────────────────────────────────
export const observabilityStore = (() => {
  const store = createStore<{ metrics: Array<Record<string, unknown>>; performance: Record<string, unknown> | null; loading: boolean; error: string }>({
    metrics: [],
    performance: null,
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [metR, perfR] = await Promise.all([
          fetch(`${API}/observability/metrics`),
          fetch(`${API}/observability/performance`),
        ]);
        const metData = await metR.json();
        const perfData = await perfR.json();
        store.setState({ metrics: metData.metrics, performance: perfData, loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Compliance Store ──────────────────────────────────────────────
export const complianceStore = (() => {
  const store = createStore<{ report: Record<string, unknown> | null; checks: Array<Record<string, unknown>>; loading: boolean; error: string }>({
    report: null,
    checks: [],
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchReport() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/compliance/report`);
        const data = await r.json();
        store.setState({ report: data, checks: data.checks || [], loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Performance Analytics Store ───────────────────────────────────
export const performanceStore = (() => {
  const store = createStore<{ dashboard: Record<string, unknown> | null; periods: Array<Record<string, unknown>>; strategies: Array<Record<string, unknown>>; loading: boolean; error: string }>({
    dashboard: null,
    periods: [],
    strategies: [],
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/performance`);
        const data = await r.json();
        store.setState({
          dashboard: data,
          periods: data.periods || [],
          strategies: data.strategies || [],
          loading: false,
        });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
  };
})();

// ── Kill Switch Recovery Store ────────────────────────────────────
export const killSwitchRecoveryStore = (() => {
  const store = createStore<{ status: Record<string, unknown> | null; events: Array<Record<string, unknown>>; loading: boolean; error: string }>({
    status: null,
    events: [],
    loading: false,
    error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [statusR, eventsR] = await Promise.all([
          fetch(`${API}/kill-switch-recovery/status`),
          fetch(`${API}/kill-switch-recovery/events`),
        ]);
        const statusData = await statusR.json();
        const eventsData = await eventsR.json();
        store.setState({ status: statusData, events: eventsData.events || [], loading: false });
      } catch (e: any) {
        store.setState({ error: e.message, loading: false });
      }
    },
    async manualOverride() {
      try {
        await fetch(`${API}/kill-switch-recovery/manual-override`, { method: 'POST' });
      } catch {}
    },
  };
})();

// ── Strategy Optimizer Store (Wave 6) ─────────────────────────────
export const strategyOptimizerStore = (() => {
  const store = createStore<{ strategies: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    strategies: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/strategy-optimizer`);
        const d = await r.json();
        store.setState({ strategies: d.strategies || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Anomalies Store (Wave 7) ──────────────────────────────────────
export const anomaliesStore = (() => {
  const store = createStore<{ anomalies: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    anomalies: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/anomalies`);
        const d = await r.json();
        store.setState({ anomalies: d.anomalies || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Portfolio Optimizer Store (Wave 7) ────────────────────────────
export const portfolioOptimizerStore = (() => {
  const store = createStore<{ allocations: Array<Record<string, unknown>>; result: Record<string, unknown> | null; hash: string; loading: boolean; error: string }>({
    allocations: [], result: null, hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/portfolio-optimizer`);
        const d = await r.json();
        store.setState({ allocations: d.allocations || [], result: d, hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Sandbox Runner Store (Wave 7) ─────────────────────────────────
export const sandboxRunnerStore = (() => {
  const store = createStore<{ events: Array<Record<string, unknown>>; hash: string; status: string; loading: boolean; error: string }>({
    events: [], hash: '', status: 'idle', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/sandbox-runner/events`);
        const d = await r.json();
        store.setState({ events: d.events || [], hash: d.hash || '', status: 'complete', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async run() {
      store.setState({ loading: true });
      try {
        const r = await fetch(`${API}/sandbox-runner/run`, { method: 'POST' });
        const d = await r.json();
        store.setState({ events: d.events || [], hash: d.hash || '', status: d.status || 'complete', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Scenario Sim Store (Wave 8) ───────────────────────────────────
export const scenarioSimStore = (() => {
  const store = createStore<{ scenarios: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    scenarios: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/scenario-sim/scenarios`);
        const d = await r.json();
        store.setState({ scenarios: d.scenarios || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Alt Data Catalog Store (Wave 8) ──────────────────────────────
export const altDataStore = (() => {
  const store = createStore<{ datasets: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    datasets: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/alt-data/catalog`);
        const d = await r.json();
        store.setState({ datasets: d.datasets || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Signal Marketplace Store (Wave 8) ────────────────────────────
export const signalMarketStore = (() => {
  const store = createStore<{ signals: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    signals: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/signal-market/listings`);
        const d = await r.json();
        store.setState({ signals: d.signals || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Microstructure Store (Wave 9) ─────────────────────────────────
export const microstructureStore = (() => {
  const store = createStore<{ metrics: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    metrics: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/microstructure/metrics`);
        const d = await r.json();
        store.setState({ metrics: d.metrics || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Liquidity Heatmap Store (Wave 9) ─────────────────────────────
export const liquidityStore = (() => {
  const store = createStore<{ symbols: string[]; timeBuckets: string[]; grid: Record<string, Record<string, number>>; hash: string; loading: boolean; error: string }>({
    symbols: [], timeBuckets: [], grid: {}, hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/liquidity/heatmap`);
        const d = await r.json();
        store.setState({ symbols: d.symbols || [], timeBuckets: d.time_buckets || [], grid: d.grid || {}, hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Policy Signal Store (Wave 10) ─────────────────────────────────
export const policySignalStore = (() => {
  const store = createStore<{ events: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    events: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/policy-signal/events`);
        const d = await r.json();
        store.setState({ events: d.events || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Risk Network Store (Wave 10) ──────────────────────────────────
export const riskNetworkStore = (() => {
  const store = createStore<{ nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>>; hash: string; loading: boolean; error: string }>({
    nodes: [], edges: [], hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/risk-network/graph`);
        const d = await r.json();
        store.setState({ nodes: d.nodes || [], edges: d.edges || [], hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Hedge Fund Store (Wave 10) ────────────────────────────────────
export const hedgeFundStore = (() => {
  const store = createStore<{ allocations: Array<Record<string, unknown>>; summary: Record<string, unknown> | null; hash: string; loading: boolean; error: string }>({
    allocations: [], summary: null, hash: '', loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/hedge-fund/summary`);
        const d = await r.json();
        store.setState({ allocations: d.allocations || [], summary: d, hash: d.hash || '', loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();
