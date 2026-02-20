/**
 * Autopilot V2 Store (Wave 8 — v1.73-v1.75)
 * State machine with candidate generation, scoring, risk checks,
 * vol-target sizing, execution simulation, kill-switch, explainability.
 * Deterministic — no network required.
 */

// ── Types ───────────────────────────────────────────────────────

export type PipelineState = 'idle' | 'scanning' | 'scoring' | 'risk_check' | 'sizing' | 'submitting' | 'completed' | 'rejected';

export interface CandidateV2 {
  symbol: string;
  side: string;
  confidence: number;
  signal_tags: string[];
  features: Record<string, number>;
}

export interface ScoreBreakdown {
  raw_score: number;
  weighted_score: number;
  reason_codes: string[];
  feature_contributions: Record<string, number>;
}

export interface RiskCheckResult {
  passed: boolean;
  reason_codes: string[];
  details: Record<string, unknown>;
}

export interface SizedIntent {
  symbol: string;
  side: string;
  quantity: number;
  notional: number;
  vol_target_pct: number;
  confidence: number;
}

export interface OrderRecordV2 {
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  fill_price: number;
  fill_qty: number;
  status: string;
  pnl: number;
}

export interface PositionRecordV2 {
  symbol: string;
  side: string;
  quantity: number;
  avg_price: number;
  market_price: number;
  unrealized_pnl: number;
  sector: string;
}

export interface RejectionV2 {
  symbol: string;
  reason_code: string;
  reason_text: string;
  stage: string;
}

export interface StageResultV2 {
  stage_name: string;
  stage_number: number;
  status: string;
  duration_ms: number;
  input_count: number;
  output_count: number;
}

export interface ExplainEntry {
  symbol: string;
  score_breakdown: ScoreBreakdown;
  risk_result: RiskCheckResult;
  sizing: SizedIntent | null;
  final_action: string;
}

export interface AutopilotV2Run {
  run_id: string;
  state: PipelineState;
  seed: number;
  started_at: string;
  completed_at: string;
  candidates: CandidateV2[];
  scores: Record<string, ScoreBreakdown>;
  risk_results: Record<string, RiskCheckResult>;
  sized_intents: SizedIntent[];
  orders: OrderRecordV2[];
  positions: PositionRecordV2[];
  rejections: RejectionV2[];
  stages: StageResultV2[];
  deterministic_hash: string;
  explain: ExplainEntry[];
}

export interface KillSwitchStateV2 {
  armed: boolean;
  armed_at: string | null;
  armed_by: string;
  ttl_seconds: number;
  audit_trail: { action: string; timestamp: string; reason: string }[];
}

// ── Demo Timestamp ─────────────────────────────────────────────

const DEMO_TS = '2026-02-15T14:30:00Z';

// ── Store ───────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let runs: AutopilotV2Run[] = [];
let selectedRun: string | null = null;
let activeTab: string = 'candidates';
let seed: number = 42;

let killSwitch: KillSwitchStateV2 = {
  armed: false, armed_at: null, armed_by: 'system',
  ttl_seconds: 3600, audit_trail: [],
};

export const autopilotV2Store = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getRuns: () => runs,
  getSelectedRun: () => selectedRun,
  getActiveTab: () => activeTab,
  getSeed: () => seed,
  getKillSwitch: () => killSwitch,

  getCurrentRun: () => runs.find(r => r.run_id === selectedRun) ?? null,

  async execute(symbols?: string[], budget?: number) {
    if (killSwitch.armed) return null;
    const allSymbols = symbols ?? ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'];
    
    // Call backend API instead of local simulation
    try {
      const response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8090') + '/api/v1/autopilot/v2/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: allSymbols,
          budget: budget ?? 100000,
          seed: seed,
        }),
      });
      
      if (!response.ok) {
        console.error('Autopilot run failed:', response.statusText);
        return null;
      }
      
      const run = await response.json();
      
      // Normalize backend format to frontend format
      const normalizedRun: AutopilotV2Run = {
        run_id: run.run_id,
        state: run.state.toLowerCase() as PipelineState,
        seed: run.seed,
        started_at: run.inputs?.timestamp || DEMO_TS,
        completed_at: DEMO_TS,
        candidates: run.candidates || [],
        scores: run.scores ? Object.fromEntries(run.scores.map((s: any) => [s.symbol, s])) : {},
        risk_results: run.risk_results ? Object.fromEntries(run.risk_results.map((r: any) => [r.symbol || '', r])) : {},
        sized_intents: run.sized_intents || [],
        orders: run.orders || [],
        positions: run.positions || [],
        rejections: run.rejections || [],
        stages: run.stages || [],
        deterministic_hash: run.deterministic_hash || '',
        explain: run.explain || [],
      };
      
      runs = [...runs, normalizedRun];
      selectedRun = normalizedRun.run_id;
      notify();
      return normalizedRun;
    } catch (error) {
      console.error('Autopilot execute error:', error);
      return null;
    }
  },

  selectRun(id: string | null) { selectedRun = id; notify(); },
  setActiveTab(tab: string) { activeTab = tab; notify(); },
  setSeed(s: number) { seed = s; notify(); },

  armKillSwitch(reason: string = 'Manual arm') {
    killSwitch = {
      ...killSwitch, armed: true, armed_at: DEMO_TS, armed_by: 'user',
      audit_trail: [...killSwitch.audit_trail, { action: 'ARM', timestamp: DEMO_TS, reason }],
    };
    notify();
  },

  disarmKillSwitch(reason: string = 'Manual disarm') {
    killSwitch = {
      ...killSwitch, armed: false, armed_at: null,
      audit_trail: [...killSwitch.audit_trail, { action: 'DISARM', timestamp: DEMO_TS, reason }],
    };
    notify();
  },

  reset() {
    runs = []; selectedRun = null; activeTab = 'candidates'; seed = 42;
    killSwitch = { armed: false, armed_at: null, armed_by: 'system', ttl_seconds: 3600, audit_trail: [] };
    notify();
  },
};
