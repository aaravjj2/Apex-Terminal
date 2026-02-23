/**
 * Wave 13-14 Stores — v1.123-v1.142
 * Shared state for automation runs, workflows, incidents, replay, decisions.
 * All deterministic DEMO data, no external network calls.
 */

// ── Types ──────────────────────────────────────────────────────

export interface RunStep {
  step_id: string;
  action_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  finished_at: string | null;
  output: Record<string, unknown>;
}

export interface RunLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
}

export interface AutomationRun {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: RunStep[];
  logs: RunLog[];
  trigger_type: string;
  duration_ms: number | null;
}

export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  workflow: WorkflowData;
}

export interface WorkflowData {
  workflow_id: string;
  name: string;
  trigger: { type: string; config: Record<string, unknown> };
  actions: { type: string; config: Record<string, unknown> }[];
  enabled: boolean;
  last_run: string | null;
}

export interface Incident {
  incident_id: string;
  title: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'open' | 'resolved' | 'investigating';
  created_at: string;
  resolved_at: string | null;
  source_event_id: string | null;
  description: string;
  notes: string;
}

export interface ReplayState {
  status: 'playing' | 'paused';
  speed: number;
  position: number;
  total_events: number;
  mode: string;
}

export interface AutopilotDecision {
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
  risk_evaluation: {
    max_profit: number;
    max_loss: number;
    var_95: number;
    position_size: number;
  };
  explanation: string;
  portfolio_impact?: {
    old_weight: number;
    new_weight: number;
    concentration_warning: boolean;
  };
}

export interface SearchSuggestion {
  query: string;
  category: string;
  score: number;
}

export interface PlatformHealthV4 {
  version: string;
  status: string;
  timestamp: string;
  subsystems: Record<string, Record<string, unknown>>;
}

// ── DEMO Data ──────────────────────────────────────────────────

const BUILTIN_RUNS: AutomationRun[] = [
  {
    run_id: 'run-demo-001',
    workflow_id: 'wf-v3-001',
    workflow_name: 'Daily Export at Market Close',
    started_at: '2026-02-16T16:00:00Z',
    finished_at: '2026-02-16T16:00:05Z',
    status: 'completed',
    trigger_type: 'schedule',
    duration_ms: 5000,
    steps: [
      { step_id: 'step-1', action_type: 'export_bundle', status: 'completed', started_at: '2026-02-16T16:00:00Z', finished_at: '2026-02-16T16:00:03Z', output: { file: 'export-v3-20260216.zip', size_bytes: 24576 } },
      { step_id: 'step-2', action_type: 'notify', status: 'completed', started_at: '2026-02-16T16:00:03Z', finished_at: '2026-02-16T16:00:05Z', output: { channel: 'email', sent: true } },
    ],
    logs: [
      { timestamp: '2026-02-16T16:00:00Z', level: 'info', message: 'Workflow started: Daily Export at Market Close' },
      { timestamp: '2026-02-16T16:00:00Z', level: 'info', message: 'Step 1/2: export_bundle — starting' },
      { timestamp: '2026-02-16T16:00:03Z', level: 'info', message: 'Step 1/2: export_bundle — completed (24.0 KB)' },
      { timestamp: '2026-02-16T16:00:03Z', level: 'info', message: 'Step 2/2: notify — starting' },
      { timestamp: '2026-02-16T16:00:05Z', level: 'info', message: 'Step 2/2: notify — sent successfully' },
      { timestamp: '2026-02-16T16:00:05Z', level: 'info', message: 'Workflow completed in 5000ms' },
    ],
  },
  {
    run_id: 'run-demo-002',
    workflow_id: 'wf-v3-002',
    workflow_name: 'Stop Loss Trigger',
    started_at: '2026-02-16T15:30:00Z',
    finished_at: '2026-02-16T15:30:02Z',
    status: 'completed',
    trigger_type: 'pnl_threshold',
    duration_ms: 2000,
    steps: [
      { step_id: 'step-1', action_type: 'cancel_order', status: 'completed', started_at: '2026-02-16T15:30:00Z', finished_at: '2026-02-16T15:30:01Z', output: { cancelled_count: 3 } },
      { step_id: 'step-2', action_type: 'notify', status: 'completed', started_at: '2026-02-16T15:30:01Z', finished_at: '2026-02-16T15:30:02Z', output: { channel: 'sms', sent: true } },
    ],
    logs: [
      { timestamp: '2026-02-16T15:30:00Z', level: 'warning', message: 'PnL threshold breach: -$1,200 (limit: -$1,000)' },
      { timestamp: '2026-02-16T15:30:00Z', level: 'info', message: 'Step 1/2: cancel_order — starting' },
      { timestamp: '2026-02-16T15:30:01Z', level: 'info', message: 'Step 1/2: cancel_order — cancelled 3 orders' },
      { timestamp: '2026-02-16T15:30:02Z', level: 'info', message: 'Workflow completed in 2000ms' },
    ],
  },
  {
    run_id: 'run-demo-003',
    workflow_id: 'wf-v3-001',
    workflow_name: 'Daily Export at Market Close',
    started_at: '2026-02-15T16:00:00Z',
    finished_at: '2026-02-15T16:00:04Z',
    status: 'failed',
    trigger_type: 'schedule',
    duration_ms: 4000,
    steps: [
      { step_id: 'step-1', action_type: 'export_bundle', status: 'failed', started_at: '2026-02-15T16:00:00Z', finished_at: '2026-02-15T16:00:04Z', output: { error: 'Disk full' } },
    ],
    logs: [
      { timestamp: '2026-02-15T16:00:00Z', level: 'info', message: 'Workflow started: Daily Export at Market Close' },
      { timestamp: '2026-02-15T16:00:04Z', level: 'error', message: 'Step 1/2: export_bundle — FAILED: Disk full' },
      { timestamp: '2026-02-15T16:00:04Z', level: 'error', message: 'Workflow failed at step 1' },
    ],
  },
];

const BUILTIN_WORKFLOWS: WorkflowData[] = [
  {
    workflow_id: 'wf-v3-001',
    name: 'Daily Export at Market Close',
    trigger: { type: 'schedule', config: { cron: '0 16 * * 1-5' } },
    actions: [
      { type: 'export_bundle', config: { format: 'json' } },
      { type: 'notify', config: { message: 'Daily export complete' } },
    ],
    enabled: true,
    last_run: '2026-02-16T16:00:05Z',
  },
  {
    workflow_id: 'wf-v3-002',
    name: 'Stop Loss Trigger',
    trigger: { type: 'pnl_threshold', config: { threshold: -1000 } },
    actions: [
      { type: 'cancel_order', config: { cancel_all: true } },
      { type: 'notify', config: { message: 'Stop loss triggered' } },
    ],
    enabled: true,
    last_run: '2026-02-16T15:30:02Z',
  },
];

const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    template_id: 'tmpl-001', name: 'Daily Export',
    description: 'Export trading state at market close every weekday',
    workflow: { workflow_id: 'tmpl-wf-001', name: 'Daily Export Template', trigger: { type: 'schedule', config: { cron: '0 16 * * 1-5' } }, actions: [{ type: 'export_bundle', config: { format: 'json' } }], enabled: true, last_run: null },
  },
  {
    template_id: 'tmpl-002', name: 'Stop Loss Guard',
    description: 'Cancel all orders when PnL drops below threshold',
    workflow: { workflow_id: 'tmpl-wf-002', name: 'Stop Loss Guard Template', trigger: { type: 'pnl_threshold', config: { threshold: -500 } }, actions: [{ type: 'cancel_order', config: { cancel_all: true } }, { type: 'notify', config: { message: 'Stop loss activated' } }], enabled: true, last_run: null },
  },
  {
    template_id: 'tmpl-003', name: 'Order Fill Alert',
    description: 'Send notification when any order fills',
    workflow: { workflow_id: 'tmpl-wf-003', name: 'Order Fill Alert Template', trigger: { type: 'order_fill', config: { symbol: '*' } }, actions: [{ type: 'notify', config: { message: 'Order filled' } }], enabled: true, last_run: null },
  },
];

const BUILTIN_INCIDENTS: Incident[] = [
  {
    incident_id: 'inc-demo-001', title: 'Market data feed disconnected',
    severity: 'warning', status: 'resolved',
    created_at: '2026-02-16T14:00:00Z', resolved_at: '2026-02-16T14:05:00Z',
    source_event_id: 'system_health_check_0001',
    description: 'Market data feed lost connection for 5 minutes',
    notes: 'Auto-reconnected after 5 attempts',
  },
  {
    incident_id: 'inc-demo-002', title: 'Export disk space warning',
    severity: 'error', status: 'open',
    created_at: '2026-02-15T16:00:04Z', resolved_at: null,
    source_event_id: null,
    description: 'Disk space below 10% during export operation',
    notes: '',
  },
];

const BUILTIN_DECISIONS: AutopilotDecision[] = [
  {
    decision_id: 'dec-001', timestamp: '2026-02-16T16:30:00Z', symbol: 'AAPL', action: 'buy',
    confidence: 0.85, risk_score: 0.30, status: 'approved', rejection_code: null, rejection_reason: null,
    features: { momentum: 0.72, volume_spike: true, rsi: 45.2, macd_signal: 'bullish' },
    risk_evaluation: { max_profit: 500, max_loss: 150, var_95: 120, position_size: 100 },
    explanation: 'Strong momentum + high volume breakout above resistance at $175.',
    portfolio_impact: { old_weight: 0.175, new_weight: 0.25, concentration_warning: false },
  },
  {
    decision_id: 'dec-002', timestamp: '2026-02-16T16:25:00Z', symbol: 'TSLA', action: 'sell',
    confidence: 0.72, risk_score: 0.65, status: 'rejected', rejection_code: 'RISK_EXCEEDED',
    rejection_reason: 'Portfolio risk limit would be exceeded (current: 45%, limit: 50%)',
    features: { momentum: -0.35, volume_spike: false, rsi: 72.1, macd_signal: 'bearish' },
    risk_evaluation: { max_profit: 800, max_loss: 400, var_95: 350, position_size: 50 },
    explanation: 'Bearish divergence detected on 4H chart with declining volume.',
    portfolio_impact: { old_weight: 0.0, new_weight: 0.0, concentration_warning: false },
  },
  {
    decision_id: 'dec-003', timestamp: '2026-02-16T16:20:00Z', symbol: 'MSFT', action: 'buy',
    confidence: 0.68, risk_score: 0.40, status: 'rejected', rejection_code: 'LOW_CONFIDENCE',
    rejection_reason: 'Decision confidence 0.68 below minimum threshold 0.70',
    features: { momentum: 0.15, volume_spike: false, rsi: 55.0, macd_signal: 'neutral' },
    risk_evaluation: { max_profit: 300, max_loss: 120, var_95: 100, position_size: 75 },
    explanation: 'Sideways consolidation near support with neutral indicators.',
    portfolio_impact: { old_weight: 0.225, new_weight: 0.30, concentration_warning: true },
  },
  {
    decision_id: 'dec-004', timestamp: '2026-02-16T16:15:00Z', symbol: 'GOOGL', action: 'buy',
    confidence: 0.91, risk_score: 0.28, status: 'approved', rejection_code: null, rejection_reason: null,
    features: { momentum: 0.88, volume_spike: true, rsi: 38.5, macd_signal: 'bullish' },
    risk_evaluation: { max_profit: 650, max_loss: 180, var_95: 150, position_size: 120 },
    explanation: 'Earnings beat + analyst upgrades. Strong technical setup with oversold RSI.',
    portfolio_impact: { old_weight: 0.15, new_weight: 0.22, concentration_warning: false },
  },
];

const BUILTIN_REPLAY: ReplayState = {
  status: 'playing', speed: 1.0, position: 0, total_events: 10, mode: 'demo',
};

const BUILTIN_SUGGESTIONS: SearchSuggestion[] = [
  { query: 'AAPL', category: 'symbol', score: 1.0 },
  { query: 'TSLA', category: 'symbol', score: 0.95 },
  { query: 'MSFT', category: 'symbol', score: 0.90 },
  { query: 'GOOGL', category: 'symbol', score: 0.85 },
  { query: 'daily export', category: 'workflow', score: 0.80 },
  { query: 'stop loss', category: 'workflow', score: 0.75 },
  { query: 'momentum strategy', category: 'strategy', score: 0.70 },
  { query: 'portfolio risk', category: 'analysis', score: 0.65 },
];

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;

interface Wave1314State {
  runs: AutomationRun[];
  workflows: WorkflowData[];
  templates: WorkflowTemplate[];
  incidents: Incident[];
  decisions: AutopilotDecision[];
  replay: ReplayState;
  suggestions: SearchSuggestion[];
  searchBackend: string;
  llmProvider: string;
  healthV4: PlatformHealthV4 | null;
}

let state: Wave1314State = {
  runs: BUILTIN_RUNS,
  workflows: BUILTIN_WORKFLOWS,
  templates: BUILTIN_TEMPLATES,
  incidents: BUILTIN_INCIDENTS,
  decisions: BUILTIN_DECISIONS,
  replay: { ...BUILTIN_REPLAY },
  suggestions: BUILTIN_SUGGESTIONS,
  searchBackend: 'local',
  llmProvider: 'deterministic',
  healthV4: {
    version: '4.0.0',
    status: 'healthy',
    timestamp: '2026-02-16T18:00:00Z',
    subsystems: {
      websocket: { status: 'healthy', channels: 3, connected: true, last_check: '2026-02-16T18:00:00Z' },
      trading: { status: 'healthy', order_count: 5, position_count: 4, last_update: '2026-02-16T18:00:00Z' },
      telemetry: { status: 'healthy', event_count: 10, last_sequence: 10, last_check: '2026-02-16T18:00:00Z' },
      search: { status: 'healthy', backend: 'local', index_count: 3, last_indexed: '2026-02-16T18:00:00Z' },
      llm: { status: 'healthy', provider: 'deterministic', nova_enabled: false, last_query: '2026-02-16T18:00:00Z' },
      autopilot: { status: 'healthy', mode: 'shadow', last_cycle: '2026-02-16T18:00:00Z', decision_count: 4 },
      automation: { status: 'healthy', workflow_count: 2, active_runs: 0, last_execution: '2026-02-16T16:00:05Z' },
      replay: { status: 'playing', speed: 1.0 },
    },
  },
};

const listeners = new Set<Listener>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export const wave1314Store = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => state,

  // ── Automation Runs ────────────────────────────────────────
  getRuns: () => state.runs.slice().sort((a, b) => b.started_at.localeCompare(a.started_at)),
  getRun: (id: string) => state.runs.find((r) => r.run_id === id) ?? null,

  // ── Workflows CRUD ─────────────────────────────────────────
  getWorkflows: () => state.workflows,
  getWorkflow: (id: string) => state.workflows.find((w) => w.workflow_id === id) ?? null,
  createWorkflow(name: string, trigger: WorkflowData['trigger'], actions: WorkflowData['actions']) {
    const id = `wf-new-${Date.now().toString(36)}`;
    const wf: WorkflowData = { workflow_id: id, name, trigger, actions, enabled: true, last_run: null };
    state.workflows = [...state.workflows, wf];
    emit();
    return wf;
  },
  deleteWorkflow(id: string) {
    state.workflows = state.workflows.filter((w) => w.workflow_id !== id);
    emit();
  },

  // ── Templates ──────────────────────────────────────────────
  getTemplates: () => state.templates,
  applyTemplate(tid: string) {
    const tmpl = state.templates.find((t) => t.template_id === tid);
    if (!tmpl) return null;
    const id = `wf-tmpl-${Date.now().toString(36)}`;
    const wf: WorkflowData = { ...tmpl.workflow, workflow_id: id };
    state.workflows = [...state.workflows, wf];
    emit();
    return wf;
  },

  // ── Incidents ──────────────────────────────────────────────
  getIncidents: () => state.incidents.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
  getIncident: (id: string) => state.incidents.find((i) => i.incident_id === id) ?? null,
  createIncident(title: string, severity: Incident['severity'], description: string, sourceEventId?: string) {
    const id = `inc-new-${Date.now().toString(36)}`;
    const inc: Incident = {
      incident_id: id, title, severity, status: 'open',
      created_at: '2026-02-16T18:00:00Z', resolved_at: null,
      source_event_id: sourceEventId ?? null, description, notes: '',
    };
    state.incidents = [...state.incidents, inc];
    emit();
    return inc;
  },

  // ── Replay Controls ────────────────────────────────────────
  getReplay: () => state.replay,
  toggleReplayPause() {
    state.replay = { ...state.replay, status: state.replay.status === 'playing' ? 'paused' : 'playing' };
    emit();
  },
  setReplaySpeed(speed: number) {
    state.replay = { ...state.replay, speed };
    emit();
  },

  // ── Decisions ──────────────────────────────────────────────
  getDecisions: () => state.decisions.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  getDecision: (id: string) => state.decisions.find((d) => d.decision_id === id) ?? null,

  // ── Search ─────────────────────────────────────────────────
  getSuggestions: (q: string) => {
    if (!q) return state.suggestions.slice(0, 5);
    return state.suggestions.filter((s) => s.query.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  },
  getSearchBackend: () => state.searchBackend,
  getLLMProvider: () => state.llmProvider,

  // ── Health V4 ──────────────────────────────────────────────
  getHealthV4: () => state.healthV4,
};
