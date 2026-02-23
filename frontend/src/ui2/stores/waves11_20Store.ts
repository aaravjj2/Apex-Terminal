/**
 * Waves 11-20 Stores — Online-Only Swing Equities v1
 * createStore<T> factory pattern, useSyncExternalStore-compatible.
 */

const API = '/api/v2';

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

// ── Wave 11: Market Session ──
export interface MarketSessionState {
  session: { session_type: string; is_trading: boolean; market_open: string; market_close: string; next_open: string | null } | null;
  holidays: { date: string; name: string; early_close: boolean }[];
  loading: boolean;
  error: string;
}

export const marketSessionStore = (() => {
  const store = createStore<MarketSessionState>({ session: null, holidays: [], loading: false, error: '' });
  return {
    ...store,
    async fetchStatus() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/market-session/status`);
        const data = await r.json();
        store.setState({ session: data, loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchHolidays(year = 2025) {
      try {
        const r = await fetch(`${API}/market-session/holidays?year=${year}`);
        const data = await r.json();
        store.setState({ holidays: data.holidays || [] });
      } catch {}
    },
  };
})();

// ── Wave 11: Paper Broker ──
export interface BrokerState {
  readiness: { is_ready: boolean; kill_switch_active: boolean; session_type: string } | null;
  orders: { order_id: string; symbol: string; side: string; quantity: number; status: string }[];
  positions: { symbol: string; quantity: number; avg_cost: number; market_value: number; unrealized_pnl: number }[];
  killSwitch: { active: boolean; reason: string; activated_at: string } | null;
  dailyPnl: { realized: number; unrealized: number; total: number } | null;
  loading: boolean;
  error: string;
}

export const brokerStore = (() => {
  const store = createStore<BrokerState>({
    readiness: null, orders: [], positions: [], killSwitch: null, dailyPnl: null, loading: false, error: '',
  });
  return {
    ...store,
    async fetchReadiness() {
      try {
        const r = await fetch(`${API}/broker/readiness`);
        store.setState({ readiness: await r.json() });
      } catch {}
    },
    async fetchOrders() {
      store.setState({ loading: true });
      try {
        const r = await fetch(`${API}/broker/orders`);
        const data = await r.json();
        store.setState({ orders: data.orders || [], loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchPositions() {
      try {
        const r = await fetch(`${API}/broker/positions`);
        const data = await r.json();
        store.setState({ positions: data.positions || [] });
      } catch {}
    },
    async fetchKillSwitch() {
      try {
        const r = await fetch(`${API}/broker/kill-switch`);
        store.setState({ killSwitch: await r.json() });
      } catch {}
    },
    async activateKillSwitch(reason: string) {
      try {
        await fetch(`${API}/broker/kill-switch/activate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        await this.fetchKillSwitch();
      } catch {}
    },
    async deactivateKillSwitch() {
      try {
        await fetch(`${API}/broker/kill-switch/deactivate`, { method: 'POST' });
        await this.fetchKillSwitch();
      } catch {}
    },
    async fetchDailyPnl() {
      try {
        const r = await fetch(`${API}/broker/pnl/daily`);
        store.setState({ dailyPnl: await r.json() });
      } catch {}
    },
  };
})();

// ── Wave 11: Data Spine ──
export interface DataSpineState {
  universe: string[];
  completeness: Record<string, any>;
  loading: boolean;
  error: string;
}

export const dataSpineStore = (() => {
  const store = createStore<DataSpineState>({ universe: [], completeness: {}, loading: false, error: '' });
  return {
    ...store,
    async fetchUniverse() {
      try {
        const r = await fetch(`${API}/data-spine/universe`);
        const data = await r.json();
        store.setState({ universe: data.universe || [] });
      } catch {}
    },
    async ingestSymbol(symbol: string) {
      store.setState({ loading: true });
      try {
        await fetch(`${API}/data-spine/ingest/symbol`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        store.setState({ loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchCompleteness() {
      try {
        const r = await fetch(`${API}/data-spine/completeness`);
        store.setState({ completeness: await r.json() });
      } catch {}
    },
  };
})();

// ── Wave 12: Portfolio Allocator ──
export interface PortfolioV2State {
  allocation: { allocations: Record<string, any>; method: string } | null;
  exposure: { sector_exposure: Record<string, number>; total_exposure: number } | null;
  loading: boolean;
  error: string;
}

export const portfolioV2Store = (() => {
  const store = createStore<PortfolioV2State>({ allocation: null, exposure: null, loading: false, error: '' });
  return {
    ...store,
    async fetchAllocation(symbols: string[], capital: number, method = 'equal_weight') {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/portfolio/allocate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols, total_capital: capital, method }),
        });
        store.setState({ allocation: await r.json(), loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchExposure() {
      try {
        const r = await fetch(`${API}/portfolio/exposure/dashboard`);
        store.setState({ exposure: await r.json() });
      } catch {}
    },
  };
})();

// ── Wave 13: Performance Ledger ──
export interface PerformanceV2State {
  strategies: { strategy_id: string; sharpe_proxy: number; win_rate: number; total_pnl: number; trade_count: number; role: string }[];
  leaderboard: { rank: number; strategy_id: string; sharpe: number; win_rate: number; total_pnl: number }[];
  disableEvents: { strategy_id: string; rule_name: string; triggered_at: string }[];
  loading: boolean;
  error: string;
}

export const performanceV2Store = (() => {
  const store = createStore<PerformanceV2State>({
    strategies: [], leaderboard: [], disableEvents: [], loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [metricsR, lbR, eventsR] = await Promise.all([
          fetch(`${API}/performance/metrics`),
          fetch(`${API}/performance/leaderboard`),
          fetch(`${API}/performance/auto-disable/events`),
        ]);
        const metrics = await metricsR.json();
        const lb = await lbR.json();
        const events = await eventsR.json();
        store.setState({
          strategies: metrics.strategies || [],
          leaderboard: lb.leaderboard || [],
          disableEvents: events.events || [],
          loading: false,
        });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Wave 14: Backtester v3 ──
export interface BacktesterV3State {
  result: Record<string, any> | null;
  comparison: Record<string, any> | null;
  loading: boolean;
  error: string;
}

export const backtesterV3Store = (() => {
  const store = createStore<BacktesterV3State>({ result: null, comparison: null, loading: false, error: '' });
  return {
    ...store,
    async runBacktest(params: { symbol: string; fast_period?: number; slow_period?: number; initial_capital?: number }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/backtester/run`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        store.setState({ result: await r.json(), loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
  };
})();

// ── Wave 15: Discovery ──
export interface DiscoveryState {
  templates: { id: string; name: string }[];
  candidates: { candidate_id: string; template: string; params: Record<string, any> }[];
  reports: Record<string, any>[];
  loading: boolean;
  error: string;
}

export const discoveryStore = (() => {
  const store = createStore<DiscoveryState>({ templates: [], candidates: [], reports: [], loading: false, error: '' });
  return {
    ...store,
    async fetchTemplates() {
      try {
        const r = await fetch(`${API}/discovery/templates`);
        const data = await r.json();
        store.setState({ templates: data.templates || [] });
      } catch {}
    },
    async generateCandidates(template: string, max = 20) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/discovery/candidates/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, max_candidates: max }),
        });
        const data = await r.json();
        store.setState({ candidates: data.candidates || [], loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async generateReport() {
      try {
        const r = await fetch(`${API}/discovery/report`, { method: 'POST' });
        const report = await r.json();
        store.setState({ reports: [...store.getState().reports, report] });
      } catch {}
    },
    async fetchReports() {
      try {
        const r = await fetch(`${API}/discovery/reports`);
        const data = await r.json();
        store.setState({ reports: data.reports || [] });
      } catch {}
    },
  };
})();

// ── Wave 16: AI Strategy ──
export interface AIStrategyState {
  specs: { spec_id: string; name: string; description: string; ai_generated: boolean }[];
  currentSpec: Record<string, any> | null;
  guardrails: { rule_name: string; status: string; message: string }[];
  sweeps: { job_id: string; spec_id: string; status: string; best_sharpe: number }[];
  loading: boolean;
  error: string;
}

export const aiStrategyStore = (() => {
  const store = createStore<AIStrategyState>({
    specs: [], currentSpec: null, guardrails: [], sweeps: [], loading: false, error: '',
  });
  return {
    ...store,
    async fetchSpecs() {
      try {
        const r = await fetch(`${API}/ai-strategy/specs`);
        const data = await r.json();
        store.setState({ specs: data.specs || [] });
      } catch {}
    },
    async createSpec(spec: { name: string; description: string; indicators: any[]; signals: any[] }) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/ai-strategy/specs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spec),
        });
        const data = await r.json();
        store.setState({ currentSpec: data, loading: false });
        await this.fetchSpecs();
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async validateSpec(specId: string) {
      try {
        const r = await fetch(`${API}/ai-strategy/specs/${specId}/validate`, { method: 'POST' });
        const data = await r.json();
        store.setState({ guardrails: data.results || [] });
      } catch {}
    },
    async fetchSweeps() {
      try {
        const r = await fetch(`${API}/ai-strategy/sweeps`);
        const data = await r.json();
        store.setState({ sweeps: data.sweeps || [] });
      } catch {}
    },
  };
})();

// ── Wave 17: Sentiment ──
export interface SentimentV2State {
  articles: { article_id: string; headline: string; symbol: string; published_at: string }[];
  scores: { article_id: string; symbol: string; label: string; composite: number; confidence: number }[];
  dashboard: { symbol: string; articles_count: number; weighted_composite: number; label: string; trend: string }[];
  loading: boolean;
  error: string;
}

export const sentimentV2Store = (() => {
  const store = createStore<SentimentV2State>({
    articles: [], scores: [], dashboard: [], loading: false, error: '',
  });
  return {
    ...store,
    async fetchArticles(symbol?: string) {
      try {
        const url = symbol ? `${API}/sentiment/articles?symbol=${symbol}` : `${API}/sentiment/articles`;
        const r = await fetch(url);
        const data = await r.json();
        store.setState({ articles: data.articles || [] });
      } catch {}
    },
    async fetchDashboard(symbols: string[]) {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/sentiment/dashboard?symbols=${symbols.join(',')}`);
        const data = await r.json();
        store.setState({ dashboard: data.sentiments || [], loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchScores(symbol?: string) {
      try {
        const url = symbol ? `${API}/sentiment/scores?symbol=${symbol}` : `${API}/sentiment/scores`;
        const r = await fetch(url);
        const data = await r.json();
        store.setState({ scores: data.scores || [] });
      } catch {}
    },
  };
})();

// ── Wave 18: Workflows v3 ──
export interface WorkflowV3State {
  workflows: { workflow_id: string; name: string; status: string; steps: any[] }[];
  templates: Record<string, any>;
  runs: { run_id: string; workflow_id: string; status: string; started_at: string }[];
  audit: { entry_id: string; action: string; timestamp: string }[];
  loading: boolean;
  error: string;
}

export const workflowV3Store = (() => {
  const store = createStore<WorkflowV3State>({
    workflows: [], templates: {}, runs: [], audit: [], loading: false, error: '',
  });
  return {
    ...store,
    async fetchTemplates() {
      try {
        const r = await fetch(`${API}/workflows/templates`);
        store.setState({ templates: (await r.json()).templates || {} });
      } catch {}
    },
    async fetchWorkflows() {
      store.setState({ loading: true, error: '' });
      try {
        const r = await fetch(`${API}/workflows/list`);
        const data = await r.json();
        store.setState({ workflows: data.workflows || [], loading: false });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async createWorkflow(wf: { name: string; description: string; steps: any[]; schedule: any; template_id?: string }) {
      store.setState({ loading: true });
      try {
        await fetch(`${API}/workflows/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wf),
        });
        store.setState({ loading: false });
        await this.fetchWorkflows();
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async fetchRuns(workflowId?: string) {
      try {
        const url = workflowId ? `${API}/workflows/${workflowId}/runs` : `${API}/workflows/runs`;
        const r = await fetch(url);
        const data = await r.json();
        store.setState({ runs: data.runs || [] });
      } catch {}
    },
  };
})();

// ── Wave 19: Observability v2 ──
export interface ObservabilityV2State {
  health: { status: string; services: Record<string, string>; uptime_seconds: number; es_connected: boolean; error_count_1h: number } | null;
  alerts: { alert_id: string; severity: string; title: string; message: string; acknowledged: boolean }[];
  queryStats: { total: number; avg_ms: number; p95_ms: number; error_rate: number } | null;
  ilm: { policies: any[]; total_policies: number } | null;
  loading: boolean;
  error: string;
}

export const observabilityV2Store = (() => {
  const store = createStore<ObservabilityV2State>({
    health: null, alerts: [], queryStats: null, ilm: null, loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [healthR, alertsR, queryR, ilmR] = await Promise.all([
          fetch(`${API}/observability/health`),
          fetch(`${API}/observability/alerts`),
          fetch(`${API}/observability/queries/stats`),
          fetch(`${API}/observability/ilm`),
        ]);
        store.setState({
          health: await healthR.json(),
          alerts: (await alertsR.json()).alerts || [],
          queryStats: await queryR.json(),
          ilm: await ilmR.json(),
          loading: false,
        });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async ackAlert(alertId: string) {
      try {
        await fetch(`${API}/observability/alerts/${alertId}/ack`, { method: 'POST' });
        await this.fetchAll();
      } catch {}
    },
  };
})();

// ── Wave 20: Productization ──
export interface ProductizationState {
  universe: { symbol: string; name: string; sector: string; market_cap_b: number; enabled: boolean }[];
  universeStats: { total_symbols: number; enabled_symbols: number; sectors: Record<string, number> } | null;
  profiles: { profile_id: string; name: string; profile_type: string; is_active: boolean; settings: Record<string, any> }[];
  activeProfile: Record<string, any> | null;
  backups: { backup_id: string; backup_type: string; created_at: string }[];
  runbooks: { runbook_id: string; title: string; category: string; steps: string[] }[];
  releaseInfo: Record<string, any> | null;
  loading: boolean;
  error: string;
}

export const productizationStore = (() => {
  const store = createStore<ProductizationState>({
    universe: [], universeStats: null, profiles: [], activeProfile: null, backups: [], runbooks: [], releaseInfo: null, loading: false, error: '',
  });
  return {
    ...store,
    async fetchAll() {
      store.setState({ loading: true, error: '' });
      try {
        const [uniR, statsR, profR, activeR, bkR, rbR, relR] = await Promise.all([
          fetch(`${API}/productization/universe`),
          fetch(`${API}/productization/universe/stats`),
          fetch(`${API}/productization/profiles`),
          fetch(`${API}/productization/profiles/active`),
          fetch(`${API}/productization/backups`),
          fetch(`${API}/productization/runbooks`),
          fetch(`${API}/productization/release`),
        ]);
        store.setState({
          universe: (await uniR.json()).universe || [],
          universeStats: await statsR.json(),
          profiles: (await profR.json()).profiles || [],
          activeProfile: await activeR.json(),
          backups: (await bkR.json()).backups || [],
          runbooks: (await rbR.json()).runbooks || [],
          releaseInfo: await relR.json(),
          loading: false,
        });
      } catch (e: any) { store.setState({ error: e.message, loading: false }); }
    },
    async activateProfile(profileId: string) {
      try {
        await fetch(`${API}/productization/profiles/activate/${profileId}`, { method: 'POST' });
        await this.fetchAll();
      } catch {}
    },
    async createBackup(type = 'full') {
      try {
        await fetch(`${API}/productization/backup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup_type: type }),
        });
        await this.fetchAll();
      } catch {}
    },
    async toggleSymbol(symbol: string, enabled: boolean) {
      try {
        await fetch(`${API}/productization/universe/toggle`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, enabled }),
        });
        await this.fetchAll();
      } catch {}
    },
  };
})();
