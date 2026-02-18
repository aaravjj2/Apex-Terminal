/**
 * Wave 17 LLM Provider Store — v1.149-v1.154
 * Provider status, budget, cache stats, rate limiting, replay log.
 * All deterministic in DEMO mode.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ProviderBudget {
  allowed: boolean;
  remaining: number;
  calls_this_hour: number;
  max_per_hour: number;
  total_calls: number;
  total_tokens: number;
}

export interface RateLimit {
  allowed: boolean;
  remaining: number;
  window_size: number;
  limit_per_minute: number;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  hit_rate: number;
}

export interface ProviderStatus {
  active_provider: string;
  nova_enabled: boolean;
  guard_reasons: string[];
  budget: ProviderBudget;
  rate_limit: RateLimit;
  cache: CacheStats;
  replay_count: number;
}

export interface ReplayEntry {
  prompt_hash: string;
  prompt: string;
  response_summary: string;
  provider: string;
  timestamp: number;
}

export interface LLMProviderState {
  status: ProviderStatus | null;
  replayLog: ReplayEntry[];
  loading: boolean;
  error: string | null;
}

// ── Demo Data ──────────────────────────────────────────────────

const DEMO_STATUS: ProviderStatus = {
  active_provider: 'deterministic',
  nova_enabled: false,
  guard_reasons: ['LLM_PROVIDER != nova', 'NOVA_API_KEY not set', 'Running in DEMO mode'],
  budget: {
    allowed: true,
    remaining: 98,
    calls_this_hour: 2,
    max_per_hour: 100,
    total_calls: 2,
    total_tokens: 64,
  },
  rate_limit: {
    allowed: true,
    remaining: 28,
    window_size: 2,
    limit_per_minute: 30,
  },
  cache: {
    entries: 2,
    hits: 1,
    misses: 2,
    hit_rate: 0.3333,
  },
  replay_count: 2,
};

const DEMO_REPLAY: ReplayEntry[] = [
  { prompt_hash: 'abc123', prompt: 'Summarize run with 3 orders and P&L $450', response_summary: 'Deterministic summary: All risk guardrails functioning...', provider: 'deterministic', timestamp: 1739721600 },
  { prompt_hash: 'def456', prompt: 'Explain rejection RISK_001 for TSLA', response_summary: 'Deterministic explanation: The decision was based on risk...', provider: 'deterministic', timestamp: 1739721300 },
];

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let state: LLMProviderState = {
  status: DEMO_STATUS,
  replayLog: DEMO_REPLAY,
  loading: false,
  error: null,
};

export const llmProviderStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getState: () => state,

  async fetchStatus() {
    state = { ...state, loading: true, error: null };
    notify();
    try {
      const res = await fetch('/api/v1/llm/v2/provider-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state = { ...state, status: data, loading: false };
      notify();
    } catch {
      // Use DEMO fallback
      state = { ...state, status: DEMO_STATUS, loading: false };
      notify();
    }
  },

  async fetchReplay() {
    try {
      const res = await fetch('/api/v1/llm/v2/replay?limit=20');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state = { ...state, replayLog: data.replay || [] };
      notify();
    } catch {
      state = { ...state, replayLog: DEMO_REPLAY };
      notify();
    }
  },

  async clearCache() {
    try {
      await fetch('/api/v1/llm/v2/cache/clear', { method: 'POST' });
      await llmProviderStore.fetchStatus();
    } catch { /* ignore */ }
  },

  async resetBudget() {
    try {
      await fetch('/api/v1/llm/v2/budget/reset', { method: 'POST' });
      await llmProviderStore.fetchStatus();
    } catch { /* ignore */ }
  },

  reset() {
    state = { status: DEMO_STATUS, replayLog: DEMO_REPLAY, loading: false, error: null };
    notify();
  },
};
