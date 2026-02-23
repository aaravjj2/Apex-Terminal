/**
 * Automation Store (v1.63-v1.65)
 * Client-side state for workflow automation studio.
 * Deterministic demo data â€” no network required.
 */

// Deterministic â€” no external deps

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'tool' | 'condition' | 'delay';
  tool_name: string;
  tool_params: Record<string, unknown>;
  timeout_ms: number;
  continue_on_fail: boolean;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; config: Record<string, unknown> };
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface StepResult {
  step_id: string;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: unknown;
  error: string | null;
}

export interface RunArtifact {
  id: string;
  run_id: string;
  name: string;
  content_type: string;
  data: unknown;
  summary: string;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at: string;
  step_results: StepResult[];
  artifacts: RunArtifact[];
  params: Record<string, unknown>;
  error: string | null;
  deterministic_hash: string;
}

// â”€â”€ Deterministic hash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function stableHash(data: unknown): string {
  const raw = JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const BUILTIN_WORKFLOWS: WorkflowDef[] = [
  {
    id: 'wf-demo-1',
    name: 'Daily Risk Report',
    description: 'Generate portfolio risk assessment and update watchlist',
    trigger: { type: 'schedule', config: { cron: '0 9 * * 1-5' } },
    steps: [
      { id: 'step-1', name: 'Generate Report', type: 'tool', tool_name: 'generate_report', tool_params: { type: 'risk' }, timeout_ms: 30000, continue_on_fail: false },
      { id: 'step-2', name: 'Update Watchlist', type: 'tool', tool_name: 'update_watchlist', tool_params: { symbols: ['SPY', 'AAPL', 'TSLA'] }, timeout_ms: 30000, continue_on_fail: false },
      { id: 'step-3', name: 'Classify Status', type: 'tool', tool_name: 'classify_incident', tool_params: { title: 'Daily check' }, timeout_ms: 30000, continue_on_fail: true },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 'wf-demo-2',
    name: 'Backtest Pipeline',
    description: 'Run backtest and create order ticket if profitable',
    trigger: { type: 'manual', config: {} },
    steps: [
      { id: 'step-1', name: 'Run Backtest', type: 'tool', tool_name: 'run_backtest', tool_params: { strategy: 'RSI Oversold Bounce', symbol: 'MSFT' }, timeout_ms: 30000, continue_on_fail: false },
      { id: 'step-2', name: 'Create Order', type: 'tool', tool_name: 'create_order_ticket', tool_params: { symbol: 'MSFT', side: 'buy', quantity: 50 }, timeout_ms: 30000, continue_on_fail: false },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 'wf-demo-3',
    name: 'Autopilot Execution',
    description: 'Execute full autopilot pipeline with candidate generation',
    trigger: { type: 'manual', config: {} },
    steps: [
      { id: 'step-1', name: 'Autopilot Pipeline', type: 'tool', tool_name: 'execute_autopilot_run', tool_params: { symbols: ['SPY', 'AAPL', 'TSLA', 'NVDA'] }, timeout_ms: 60000, continue_on_fail: false },
      { id: 'step-2', name: 'Generate Report', type: 'tool', tool_name: 'generate_report', tool_params: { type: 'autopilot' }, timeout_ms: 30000, continue_on_fail: false },
      { id: 'step-3', name: 'Summarize Run', type: 'tool', tool_name: 'summarize_run', tool_params: {}, timeout_ms: 30000, continue_on_fail: true },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
];

// Built-in tool list
const AVAILABLE_TOOLS = [
  'classify_incident', 'create_order_ticket', 'execute_autopilot_run',
  'fetch_artifact', 'generate_report', 'run_backtest', 'run_workflow',
  'search', 'summarize_run', 'update_watchlist',
];

// â”€â”€ Deterministic Demo Runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function runWorkflowDemo(wf: WorkflowDef): WorkflowRun {
  const runId = `run-${stableHash({ wf: wf.id, t: new Date().toISOString() })}`;

  const stepResults: StepResult[] = wf.steps.map(s => ({
    step_id: s.id,
    step_name: s.name,
    status: 'completed' as const,
    output: { status: 'success', summary: `${s.name} completed`, hash: stableHash({ tool: s.tool_name, params: s.tool_params }) },
    error: null,
  }));

  const hash = stableHash({ wf: wf.id, steps: stepResults.map(sr => ({ id: sr.step_id, status: sr.status })) });

  const artifacts: RunArtifact[] = [
    {
      id: `${runId}-summary`,
      run_id: runId,
      name: 'run_summary.json',
      content_type: 'application/json',
      data: { workflow: wf.name, steps_total: wf.steps.length, steps_passed: wf.steps.length, status: 'completed' },
      summary: `Run ${runId}: ${wf.steps.length}/${wf.steps.length} steps passed`,
      created_at: new Date().toISOString(),
    },
    {
      id: `${runId}-outputs`,
      run_id: runId,
      name: 'step_outputs.json',
      content_type: 'application/json',
      data: Object.fromEntries(stepResults.map(sr => [sr.step_id, sr.output])),
      summary: `Outputs from ${wf.steps.length} steps`,
      created_at: new Date().toISOString(),
    },
  ];

  return {
    id: runId,
    workflow_id: wf.id,
    workflow_name: wf.name,
    status: 'completed',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    step_results: stepResults,
    artifacts,
    params: {},
    error: null,
    deterministic_hash: hash,
  };
}

// â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let workflows: WorkflowDef[] = [...BUILTIN_WORKFLOWS];
let runs: WorkflowRun[] = [];
let selectedWorkflow: string | null = null;
let selectedRun: string | null = null;

export const automationStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getWorkflows: () => workflows,
  getRuns: () => runs,
  getSelectedWorkflow: () => selectedWorkflow,
  getSelectedRun: () => selectedRun,
  getAvailableTools: () => AVAILABLE_TOOLS,

  selectWorkflow(id: string | null) {
    selectedWorkflow = id;
    notify();
  },

  selectRun(id: string | null) {
    selectedRun = id;
    notify();
  },

  createWorkflow(name: string, description: string, steps: WorkflowStep[]) {
    const id = `wf-${stableHash({ name, v: Date.now() })}`;
    const wf: WorkflowDef = {
      id,
      name,
      description,
      trigger: { type: 'manual', config: {} },
      steps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    workflows = [...workflows, wf];
    selectedWorkflow = id;
    notify();
    return wf;
  },

  runWorkflow(workflowId: string) {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) return null;

    const run = runWorkflowDemo(wf);
    runs = [...runs, run];
    selectedRun = run.id;
    notify();
    return run;
  },

  deleteWorkflow(id: string) {
    workflows = workflows.filter(w => w.id !== id);
    if (selectedWorkflow === id) selectedWorkflow = null;
    notify();
  },

  reset() {
    workflows = [...BUILTIN_WORKFLOWS];
    runs = [];
    selectedWorkflow = null;
    selectedRun = null;
    notify();
  },
};
