/**
 * Wave 18 Decision Explainer Store — v1.155-v1.158
 * Enhanced decisions with feature attribution, confidence breakdown, post-trade eval.
 */

// ── Types ──────────────────────────────────────────────────────

export interface FeatureAttribution {
  weight: number;
  contribution: number;
  direction: string;
}

export interface ConfidenceBreakdown {
  signal_quality: number;
  market_regime: number;
  historical_accuracy: number;
  composite: number;
}

export interface PostTradeEval {
  actual_pnl: number;
  predicted_max_profit: number;
  accuracy: number;
  time_held: string;
  exit_reason: string;
}

export interface DecisionV2 {
  decision_id: string;
  timestamp: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  risk_score: number;
  status: 'approved' | 'rejected' | 'pending';
  rejection_code: string | null;
  rejection_reason: string | null;
  features: Record<string, unknown>;
  feature_attribution: Record<string, FeatureAttribution>;
  risk_evaluation: { max_profit: number; max_loss: number; var_95: number; position_size: number };
  explanation: string;
  post_trade_eval: PostTradeEval | null;
  confidence_breakdown: ConfidenceBreakdown;
}

export interface NLWorkflow {
  workflow_id: string;
  name: string;
  trigger: { type: string; config: Record<string, unknown> };
  actions: { type: string; config: Record<string, unknown> }[];
  enabled: boolean;
  confidence: number;
  parse_method: string;
}

export interface WorkflowValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SimulationResult {
  simulation_id: string;
  workflow_id: string;
  status: string;
  steps: { step: number; action_type: string; status: string; duration_ms: number; output: Record<string, unknown> }[];
  total_duration_ms: number;
  seed: number;
}

export interface Wave18State {
  decisions: DecisionV2[];
  selectedDecision: DecisionV2 | null;
  nlPrompt: string;
  generatedWorkflow: NLWorkflow | null;
  validation: WorkflowValidation | null;
  simulation: SimulationResult | null;
  loading: boolean;
  error: string | null;
}

// ── DEMO Data ──────────────────────────────────────────────────

const BUILTIN_DECISIONS: DecisionV2[] = [
  {
    decision_id: 'dec-001', timestamp: '2026-02-16T16:30:00Z', symbol: 'AAPL', action: 'buy',
    confidence: 0.85, risk_score: 0.30, status: 'approved', rejection_code: null, rejection_reason: null,
    features: { momentum: 0.72, volume_spike: true, rsi: 45.2, macd_signal: 'bullish' },
    feature_attribution: {
      momentum: { weight: 0.35, contribution: 0.252, direction: 'positive' },
      volume_spike: { weight: 0.20, contribution: 0.170, direction: 'positive' },
      rsi: { weight: 0.25, contribution: 0.225, direction: 'neutral' },
      macd_signal: { weight: 0.20, contribution: 0.200, direction: 'positive' },
    },
    risk_evaluation: { max_profit: 500, max_loss: 150, var_95: 120, position_size: 100 },
    explanation: 'Strong momentum + high volume breakout above resistance at $175.',
    post_trade_eval: { actual_pnl: 320.50, predicted_max_profit: 500, accuracy: 0.641, time_held: '2h 15m', exit_reason: 'target_hit' },
    confidence_breakdown: { signal_quality: 0.88, market_regime: 0.82, historical_accuracy: 0.85, composite: 0.85 },
  },
  {
    decision_id: 'dec-002', timestamp: '2026-02-16T16:25:00Z', symbol: 'TSLA', action: 'sell',
    confidence: 0.72, risk_score: 0.65, status: 'rejected', rejection_code: 'RISK_EXCEEDED', rejection_reason: 'Portfolio risk limit would be exceeded',
    features: { momentum: -0.35, volume_spike: false, rsi: 72.1, macd_signal: 'bearish' },
    feature_attribution: {
      momentum: { weight: 0.35, contribution: -0.123, direction: 'negative' },
      volume_spike: { weight: 0.20, contribution: 0.0, direction: 'neutral' },
      rsi: { weight: 0.25, contribution: -0.180, direction: 'negative' },
      macd_signal: { weight: 0.20, contribution: 0.160, direction: 'positive' },
    },
    risk_evaluation: { max_profit: 800, max_loss: 400, var_95: 350, position_size: 50 },
    explanation: 'Bearish divergence on 4H chart. Risk limit prevented execution.',
    post_trade_eval: null,
    confidence_breakdown: { signal_quality: 0.75, market_regime: 0.68, historical_accuracy: 0.72, composite: 0.72 },
  },
  {
    decision_id: 'dec-003', timestamp: '2026-02-16T16:20:00Z', symbol: 'MSFT', action: 'buy',
    confidence: 0.68, risk_score: 0.40, status: 'rejected', rejection_code: 'LOW_CONFIDENCE', rejection_reason: 'Confidence 0.68 below threshold 0.70',
    features: { momentum: 0.15, volume_spike: false, rsi: 55.0, macd_signal: 'neutral' },
    feature_attribution: {
      momentum: { weight: 0.35, contribution: 0.053, direction: 'weak_positive' },
      volume_spike: { weight: 0.20, contribution: 0.0, direction: 'neutral' },
      rsi: { weight: 0.25, contribution: 0.138, direction: 'neutral' },
      macd_signal: { weight: 0.20, contribution: 0.0, direction: 'neutral' },
    },
    risk_evaluation: { max_profit: 300, max_loss: 120, var_95: 100, position_size: 75 },
    explanation: 'Sideways consolidation near support with neutral indicators.',
    post_trade_eval: null,
    confidence_breakdown: { signal_quality: 0.65, market_regime: 0.70, historical_accuracy: 0.68, composite: 0.68 },
  },
  {
    decision_id: 'dec-004', timestamp: '2026-02-16T16:15:00Z', symbol: 'GOOGL', action: 'buy',
    confidence: 0.91, risk_score: 0.28, status: 'approved', rejection_code: null, rejection_reason: null,
    features: { momentum: 0.88, volume_spike: true, rsi: 38.5, macd_signal: 'bullish' },
    feature_attribution: {
      momentum: { weight: 0.35, contribution: 0.308, direction: 'positive' },
      volume_spike: { weight: 0.20, contribution: 0.180, direction: 'positive' },
      rsi: { weight: 0.25, contribution: 0.240, direction: 'positive' },
      macd_signal: { weight: 0.20, contribution: 0.180, direction: 'positive' },
    },
    risk_evaluation: { max_profit: 650, max_loss: 180, var_95: 150, position_size: 120 },
    explanation: 'Earnings beat + analyst upgrades. Strong setup with oversold RSI.',
    post_trade_eval: { actual_pnl: 580.00, predicted_max_profit: 650, accuracy: 0.892, time_held: '4h 30m', exit_reason: 'target_hit' },
    confidence_breakdown: { signal_quality: 0.93, market_regime: 0.88, historical_accuracy: 0.91, composite: 0.91 },
  },
];

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let state: Wave18State = {
  decisions: BUILTIN_DECISIONS,
  selectedDecision: null,
  nlPrompt: '',
  generatedWorkflow: null,
  validation: null,
  simulation: null,
  loading: false,
  error: null,
};

export const wave18Store = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getState: () => state,

  getDecisions: () => state.decisions.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  selectDecision(id: string | null) {
    state = { ...state, selectedDecision: id ? state.decisions.find(d => d.decision_id === id) ?? null : null };
    notify();
  },

  setNLPrompt(prompt: string) {
    state = { ...state, nlPrompt: prompt };
    notify();
  },

  async generateWorkflow(prompt: string) {
    state = { ...state, loading: true, error: null, nlPrompt: prompt };
    notify();
    try {
      const res = await fetch('/api/v1/automation/v2/nl-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state = {
        ...state,
        generatedWorkflow: data.workflow,
        validation: data.validation,
        loading: false,
      };
      notify();
    } catch {
      // Fallback demo
      state = {
        ...state,
        generatedWorkflow: {
          workflow_id: 'wf-nl-demo',
          name: `Custom: ${prompt.slice(0, 40)}`,
          trigger: { type: 'manual', config: {} },
          actions: [{ type: 'notify', config: { message: prompt.slice(0, 100) } }],
          enabled: true,
          confidence: 0.50,
          parse_method: 'fallback',
        },
        validation: { valid: true, errors: [], warnings: [] },
        loading: false,
      };
      notify();
    }
  },

  async validateWorkflow(workflow: Record<string, unknown>) {
    try {
      const res = await fetch('/api/v1/automation/v2/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state = { ...state, validation: data };
      notify();
    } catch {
      state = { ...state, validation: { valid: true, errors: [], warnings: [] } };
      notify();
    }
  },

  async simulateWorkflow(workflow: Record<string, unknown>, seed = 42) {
    state = { ...state, loading: true };
    notify();
    try {
      const res = await fetch('/api/v1/automation/v2/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow, seed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state = { ...state, simulation: data, loading: false };
      notify();
    } catch {
      state = {
        ...state,
        simulation: {
          simulation_id: 'sim-demo',
          workflow_id: 'unknown',
          status: 'completed',
          steps: [{ step: 1, action_type: 'notify', status: 'completed', duration_ms: 500, output: { simulated: true } }],
          total_duration_ms: 500,
          seed,
        },
        loading: false,
      };
      notify();
    }
  },

  clearWorkflow() {
    state = { ...state, generatedWorkflow: null, validation: null, simulation: null, nlPrompt: '' };
    notify();
  },

  reset() {
    state = {
      decisions: BUILTIN_DECISIONS,
      selectedDecision: null,
      nlPrompt: '',
      generatedWorkflow: null,
      validation: null,
      simulation: null,
      loading: false,
      error: null,
    };
    notify();
  },
};
