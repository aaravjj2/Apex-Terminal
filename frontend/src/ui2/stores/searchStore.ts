/**
 * Search Store (v1.66-v1.68 + v1.104 + v1.143-v1.148 Wave 15)
 * Global search across multiple document types with backend integration.
 * Wave 15: filters, deep linking, recent searches, grouped results, related entities.
 */

// ── Types ──────────────────────────────────────────────────────

export type DocumentType = 'telemetry' | 'orders' | 'positions' | 'workflows' | 'strategies' | 'all' | 'order' | 'position' | 'trade' | 'strategy' | 'workflow' | 'decision' | 'incident' | 'report';

export interface SearchResult {
  id: string;
  entity_type: string;
  title: string;
  snippet: string;
  score: number;
  data: Record<string, unknown>;
  symbol?: string;
  severity?: string;
  timestamp?: string;
  tags?: string[];
}

export interface GroupedResults {
  telemetry: SearchResult[];
  orders: SearchResult[];
  positions: SearchResult[];
  workflows: SearchResult[];
  strategies: SearchResult[];
  [key: string]: SearchResult[];
}

export interface SearchFilters {
  entityType: DocumentType;
  symbol: string;
  severity: string;
  timeFrom: string;
  timeTo: string;
}

export interface RecentSearch {
  query: string;
  timestamp: string;
  result_count: number;
}

export interface RelatedEntity {
  id: string;
  entity_type: string;
  title: string;
  score?: number;
}

export interface SearchState {
  query: string;
  entityType: DocumentType;
  filters: SearchFilters;
  results: SearchResult[];
  groupedResults: GroupedResults;
  groupCounts: Record<string, number>;
  total: number;
  loading: boolean;
  selectedResult: string | null;
  selectedEntity: SearchResult | null;
  relatedEntities: RelatedEntity[];
  recentSearches: RecentSearch[];
  error: string | null;
}

// ── Built-in Search Entities ──────────────────────────────────────────

const BUILTIN_ENTITIES: SearchResult[] = [
  { id: 'ord-1', entity_type: 'order', title: 'Buy MSFT limit 100 @ $410', snippet: 'Pending limit order for Microsoft', score: 0.95, data: { symbol: 'MSFT', side: 'buy', status: 'pending' }, symbol: 'MSFT', timestamp: '2026-02-16T10:00:00Z', tags: ['limit', 'buy'] },
  { id: 'ord-2', entity_type: 'order', title: 'Sell AMZN market 50', snippet: 'Filled market sell for Amazon', score: 0.90, data: { symbol: 'AMZN', side: 'sell', status: 'filled' }, symbol: 'AMZN', timestamp: '2026-02-16T09:30:00Z', tags: ['market', 'sell'] },
  { id: 'trd-1', entity_type: 'trade', title: 'Sell AMZN 50 @ $178.92', snippet: 'Market sell executed', score: 0.88, data: { symbol: 'AMZN', price: 178.92 }, symbol: 'AMZN', timestamp: '2026-02-16T09:30:05Z' },
  { id: 'trd-2', entity_type: 'trade', title: 'Buy SPY 150 @ $535.20', snippet: 'Limit buy filled', score: 0.85, data: { symbol: 'SPY', price: 535.20 }, symbol: 'SPY', timestamp: '2026-02-16T09:15:00Z' },
  { id: 'pos-1', entity_type: 'position', title: 'SPY long 150 shares', snippet: 'P&L: +$1,804.50 (+2.24%)', score: 0.82, data: { symbol: 'SPY', pnl: 1804.50 }, symbol: 'SPY', timestamp: '2026-02-16T09:15:00Z' },
  { id: 'pos-2', entity_type: 'position', title: 'AAPL long 200 shares', snippet: 'P&L: -$578.00 (-1.56%)', score: 0.80, data: { symbol: 'AAPL', pnl: -578 }, symbol: 'AAPL', timestamp: '2026-02-15T10:00:00Z' },
  { id: 'pos-3', entity_type: 'position', title: 'TSLA long 75 shares', snippet: 'P&L: +$646.50 (+4.10%)', score: 0.78, data: { symbol: 'TSLA', pnl: 646.50 }, symbol: 'TSLA', timestamp: '2026-02-15T11:00:00Z' },
  { id: 'strat-1', entity_type: 'strategy', title: 'RSI Oversold Bounce', snippet: 'Mean reversion strategy on MSFT', score: 0.76, data: { type: 'meanReversion', symbol: 'MSFT' }, symbol: 'MSFT', timestamp: '2026-02-14T14:00:00Z' },
  { id: 'strat-2', entity_type: 'strategy', title: 'Momentum Breakout', snippet: 'Breakout strategy on NVDA', score: 0.74, data: { type: 'breakout', symbol: 'NVDA' }, symbol: 'NVDA', timestamp: '2026-02-14T12:00:00Z' },
  { id: 'bt-1', entity_type: 'backtest', title: 'RSI Oversold Bounce on MSFT', snippet: 'Sharpe=1.85, Return=24.5%', score: 0.72, data: { sharpe: 1.85, return: 24.5 }, symbol: 'MSFT' },
  { id: 'wf-builtin-1', entity_type: 'workflow', title: 'Daily Risk Report', snippet: 'Automated daily risk assessment', score: 0.70, data: { steps: 3, trigger: 'schedule' }, timestamp: '2026-02-16T16:00:00Z' },
  { id: 'wf-builtin-2', entity_type: 'workflow', title: 'Backtest Pipeline', snippet: 'Run backtest and create order', score: 0.68, data: { steps: 2, trigger: 'manual' }, timestamp: '2026-02-16T15:00:00Z' },
  { id: 'inc-1', entity_type: 'incident', title: 'High API latency detected', snippet: 'Market data feed latency 150ms', score: 0.66, data: { severity: 'warning' }, severity: 'warning', timestamp: '2026-02-16T14:00:00Z' },
  { id: 'dec-001', entity_type: 'decision', title: 'AAPL buy — approved', snippet: 'Strong momentum + high volume breakout', score: 0.92, data: { confidence: 0.85, status: 'approved' }, symbol: 'AAPL', timestamp: '2026-02-16T16:30:00Z' },
  { id: 'dec-002', entity_type: 'decision', title: 'TSLA sell — rejected', snippet: 'Portfolio risk limit would be exceeded', score: 0.88, data: { confidence: 0.72, status: 'rejected' }, symbol: 'TSLA', timestamp: '2026-02-16T16:25:00Z' },
  { id: 'rpt-1', entity_type: 'report', title: 'Daily Risk Assessment', snippet: 'VaR=$4,850, Sharpe=1.45', score: 0.62, data: { type: 'risk' }, timestamp: '2026-02-16T16:00:00Z' },
];

const ENTITY_TYPES: DocumentType[] = ['all', 'order', 'trade', 'position', 'strategy', 'workflow', 'decision', 'incident', 'report'];

const DEFAULT_RECENT: RecentSearch[] = [
  { query: 'AAPL', timestamp: '2026-02-16T16:00:00Z', result_count: 3 },
  { query: 'stop loss', timestamp: '2026-02-16T15:30:00Z', result_count: 1 },
  { query: 'momentum', timestamp: '2026-02-16T15:00:00Z', result_count: 2 },
];

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

const defaultFilters: SearchFilters = {
  entityType: 'all',
  symbol: '',
  severity: '',
  timeFrom: '',
  timeTo: '',
};

const emptyGrouped: GroupedResults = {
  telemetry: [],
  orders: [],
  positions: [],
  workflows: [],
  strategies: [],
};

let state: SearchState = {
  query: '',
  entityType: 'all',
  filters: { ...defaultFilters },
  results: [],
  groupedResults: { ...emptyGrouped },
  groupCounts: {},
  total: 0,
  loading: false,
  selectedResult: null,
  selectedEntity: null,
  relatedEntities: [],
  recentSearches: [...DEFAULT_RECENT],
  error: null,
};

/**
 * Search backend API — Wave 15 v2 pipeline.
 * Posts to /api/v1/search/v2/query with filters.
 * Falls back to local search on failure.
 */
async function searchBackendV2(query: string, filters: SearchFilters): Promise<{ results: SearchResult[]; total: number; groups: Record<string, number> }> {
  try {
    const body: Record<string, unknown> = { query, limit: 50, offset: 0 };
    if (filters.entityType && filters.entityType !== 'all') body.entity_type = filters.entityType;
    if (filters.symbol) body.symbol = filters.symbol;
    if (filters.severity) body.severity = filters.severity;
    if (filters.timeFrom) body.time_from = filters.timeFrom;
    if (filters.timeTo) body.time_to = filters.timeTo;

    const response = await fetch('/api/v1/search/v2/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const results: SearchResult[] = (data.results || []).map((r: any) => ({
      id: r.id,
      entity_type: r.entity_type,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
      data: r,
      symbol: r.symbol,
      severity: r.severity,
      timestamp: r.timestamp,
      tags: r.tags,
    }));
    return { results, total: data.total ?? results.length, groups: data.groups ?? {} };
  } catch {
    // Fallback to local search
    const results = performSearch(query, filters.entityType);
    return { results, total: results.length, groups: {} };
  }
}

function performSearch(query: string, entityType: DocumentType): SearchResult[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  let results = BUILTIN_ENTITIES.filter(e => {
    if (entityType !== 'all' && e.entity_type !== entityType) return false;
    if (!q) return true;

    const searchable = `${e.id} ${e.title} ${e.snippet} ${JSON.stringify(e.data)} ${e.symbol ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
    return words.every(w => searchable.includes(w));
  });

  results = results.map(r => {
    let score = r.score;
    const searchable = `${r.title} ${r.snippet}`.toLowerCase();
    if (q && searchable.includes(q)) score += 0.1;
    return { ...r, score: Math.min(score, 1.0) };
  });

  results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return results;
}

function groupResults(results: SearchResult[]): { grouped: GroupedResults; counts: Record<string, number> } {
  const grouped: GroupedResults = { telemetry: [], orders: [], positions: [], workflows: [], strategies: [] };
  const counts: Record<string, number> = {};
  for (const r of results) {
    const et = r.entity_type;
    counts[et] = (counts[et] || 0) + 1;
    if (et in grouped) {
      grouped[et].push(r);
    } else {
      grouped[et] = grouped[et] || [];
      grouped[et].push(r);
    }
  }
  return { grouped, counts };
}

export const searchStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getState: () => state,
  getEntityTypes: () => ENTITY_TYPES,

  /**
   * Synchronous search using local data (instant, for typing).
   */
  search(query: string, entityType?: DocumentType) {
    const et = entityType ?? state.entityType;
    const results = performSearch(query, et);
    const { grouped, counts } = groupResults(results);
    state = {
      ...state,
      query,
      entityType: et,
      results,
      groupedResults: grouped,
      groupCounts: counts,
      total: results.length,
      loading: false,
      selectedResult: null,
      selectedEntity: null,
      relatedEntities: [],
      error: null,
    };
    notify();
  },

  /**
   * Async search with v2 backend pipeline (Wave 15).
   * Uses filters, returns grouped results.
   */
  async searchBackend(query: string, typeFilter?: DocumentType) {
    if (!query.trim()) {
      searchStore.search('');
      return;
    }

    const filters: SearchFilters = {
      ...state.filters,
      entityType: typeFilter ?? state.filters.entityType,
    };

    state = { ...state, query, loading: true, error: null };
    notify();

    try {
      const { results, total, groups } = await searchBackendV2(query, filters);
      const { grouped } = groupResults(results);

      // Record in recent searches
      const recent = [
        { query: query.trim(), timestamp: new Date().toISOString(), result_count: total },
        ...state.recentSearches.filter(r => r.query !== query.trim()),
      ].slice(0, 20);

      state = {
        ...state,
        results,
        groupedResults: grouped,
        groupCounts: groups,
        total,
        loading: false,
        recentSearches: recent,
      };
      notify();
    } catch (error) {
      state = {
        ...state,
        error: error instanceof Error ? error.message : 'Search failed',
        loading: false,
      };
      notify();
    }
  },

  setEntityType(et: DocumentType) {
    state = { ...state, entityType: et, filters: { ...state.filters, entityType: et } };
    if (state.query) {
      const results = performSearch(state.query, et);
      const { grouped, counts } = groupResults(results);
      state = { ...state, results, groupedResults: grouped, groupCounts: counts, total: results.length };
    }
    notify();
  },

  setFilters(filters: Partial<SearchFilters>) {
    state = { ...state, filters: { ...state.filters, ...filters } };
    notify();
  },

  selectResult(id: string | null) {
    const entity = id ? BUILTIN_ENTITIES.find(e => e.id === id) ?? null : null;
    // Compute related entities
    let related: RelatedEntity[] = [];
    if (entity && entity.symbol) {
      related = BUILTIN_ENTITIES
        .filter(e => e.id !== id && e.symbol === entity.symbol)
        .map(e => ({ id: e.id, entity_type: e.entity_type, title: e.title, score: 0.5 }))
        .slice(0, 5);
    }
    state = { ...state, selectedResult: id, selectedEntity: entity, relatedEntities: related };
    notify();
  },

  getRecentSearches: () => state.recentSearches,

  clearRecentSearches() {
    state = { ...state, recentSearches: [] };
    notify();
  },

  reset() {
    state = {
      query: '',
      entityType: 'all',
      filters: { ...defaultFilters },
      results: [],
      groupedResults: { ...emptyGrouped },
      groupCounts: {},
      total: 0,
      loading: false,
      selectedResult: null,
      selectedEntity: null,
      relatedEntities: [],
      recentSearches: [...DEFAULT_RECENT],
      error: null,
    };
    notify();
  },
};
