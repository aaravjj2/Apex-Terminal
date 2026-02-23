/**
 * Automation V2 Store (Wave 8 â€” v1.76)
 * DAG-based workflow automation with triggers, actions, node execution logs.
 * Deterministic â€” no network required.
 */

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WorkflowNodeV2 {
  node_id: string;
  action: string;
  label: string;
  config: Record<string, unknown>;
  depends_on: string[];
}

export interface WorkflowConditionV2 {
  field: string;
  operator: string;
  value: unknown;
}

export interface WorkflowDefV2 {
  workflow_id: string;
  name: string;
  description: string;
  trigger: string;
  nodes: WorkflowNodeV2[];
  conditions: WorkflowConditionV2[];
  created_at: string;
  updated_at: string;
}

export interface NodeExecutionV2 {
  node_id: string;
  action: string;
  status: string;
  started_at: string;
  completed_at: string;
  output: unknown;
  error: string;
  duration_ms: number;
}

export interface AutomationRunLogV2 {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  status: string;
  started_at: string;
  completed_at: string;
  seed: number;
  trigger: string;
  node_executions: NodeExecutionV2[];
  outputs: Record<string, unknown>;
  deterministic_hash: string;
  linked_autopilot_run: string;
}

// â”€â”€ Hash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function stableHash(data: unknown): string {
  const raw = JSON.stringify(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const BUILTIN_WORKFLOWS: WorkflowDefV2[] = [
  {
    workflow_id: 'wf-autopilot-daily',
    name: 'Daily Autopilot Scan',
    description: 'Triggers autopilot pipeline on market open',
    trigger: 'on_interval',
    nodes: [
      { node_id: 'n1', action: 'run_autopilot', label: 'Run Autopilot', config: { seed: 42 }, depends_on: [] },
      { node_id: 'n2', action: 'export_report', label: 'Export Report', config: { format: 'json' }, depends_on: ['n1'] },
      { node_id: 'n3', action: 'log_message', label: 'Log Completion', config: { message: 'Daily scan complete' }, depends_on: ['n2'] },
    ],
    conditions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    workflow_id: 'wf-alert-pipeline',
    name: 'Risk Alert Pipeline',
    description: 'Raises alert when risk conditions are met',
    trigger: 'manual',
    nodes: [
      { node_id: 'a1', action: 'raise_alert', label: 'Check Risk', config: { severity: 'warning', message: 'Risk threshold exceeded' }, depends_on: [] },
      { node_id: 'a2', action: 'create_watchlist_entry', label: 'Add to Watchlist', config: { symbol: 'SPY' }, depends_on: ['a1'] },
    ],
    conditions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    workflow_id: 'wf-simple-log',
    name: 'Simple Logging Workflow',
    description: 'A minimal workflow for testing',
    trigger: 'manual',
    nodes: [
      { node_id: 'l1', action: 'log_message', label: 'Log Start', config: { message: 'Workflow started' }, depends_on: [] },
    ],
    conditions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// â”€â”€ Deterministic Executor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function executeAction(action: string, config: Record<string, unknown>, seed: number): unknown {
  if (action === 'run_autopilot') {
    return { autopilot_run_id: `apv2-run-${stableHash({ seed })}`, state: 'completed', orders: 3 };
  }
  if (action === 'export_report') {
    return { report_id: `rpt-${stableHash({ action, seed })}`, format: config.format ?? 'json', status: 'generated' };
  }
  if (action === 'raise_alert') {
    return { alert_id: `alt-${stableHash({ action, seed })}`, severity: config.severity ?? 'info', message: config.message ?? 'Alert' };
  }
  if (action === 'create_watchlist_entry') {
    return { watchlist_entry: config.symbol ?? 'SPY', status: 'added' };
  }
  if (action === 'log_message') {
    return { message: config.message ?? 'Step executed', level: config.level ?? 'info' };
  }
  return { status: 'unknown_action' };
}

function runWorkflowV2(wf: WorkflowDefV2, seed: number, counter: number): AutomationRunLogV2 {
  const runId = `auto-run-${stableHash({ wf: wf.workflow_id, n: counter, seed })}`;

  const nodeExecs: NodeExecutionV2[] = wf.nodes.map(n => {
    const output = executeAction(n.action, n.config as Record<string, unknown>, seed);
    return {
      node_id: n.node_id, action: n.action, status: 'completed',
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      output, error: '', duration_ms: 42,
    };
  });

  const outputs: Record<string, unknown> = {};
  for (const ne of nodeExecs) { outputs[ne.node_id] = ne.output; }

  const linked = (nodeExecs.find(ne => ne.action === 'run_autopilot')?.output as Record<string, string>)?.autopilot_run_id ?? '';

  return {
    run_id: runId, workflow_id: wf.workflow_id, workflow_name: wf.name,
    status: 'completed', started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    seed, trigger: wf.trigger, node_executions: nodeExecs, outputs,
    deterministic_hash: stableHash({ wf: wf.workflow_id, seed, nodeExecs: nodeExecs.map(e => ({ id: e.node_id, status: e.status })) }),
    linked_autopilot_run: linked,
  };
}

// â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let workflows: WorkflowDefV2[] = [...BUILTIN_WORKFLOWS];
let runs: AutomationRunLogV2[] = [];
let selectedWorkflow: string | null = null;
let selectedRun: string | null = null;
let runCounter = 0;

export const automationV2Store = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  getWorkflows: () => workflows,
  getRuns: () => runs,
  getSelectedWorkflow: () => selectedWorkflow,
  getSelectedRun: () => selectedRun,

  selectWorkflow(id: string | null) { selectedWorkflow = id; notify(); },
  selectRun(id: string | null) { selectedRun = id; notify(); },

  runWorkflow(wfId: string, seed: number = 42) {
    const wf = workflows.find(w => w.workflow_id === wfId);
    if (!wf) return null;
    runCounter++;
    const log = runWorkflowV2(wf, seed, runCounter);
    runs = [...runs, log];
    selectedRun = log.run_id;
    notify();
    return log;
  },

  createWorkflow(data: { name: string; description?: string; trigger?: string; nodes?: WorkflowNodeV2[] }) {
    const wfId = `wf-${stableHash({ name: data.name, ts: new Date().toISOString() })}`;
    const wf: WorkflowDefV2 = {
      workflow_id: wfId, name: data.name,
      description: data.description ?? '',
      trigger: data.trigger ?? 'manual',
      nodes: data.nodes ?? [],
      conditions: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    workflows = [...workflows, wf];
    selectedWorkflow = wfId;
    notify();
    return wf;
  },

  deleteWorkflow(wfId: string) {
    workflows = workflows.filter(w => w.workflow_id !== wfId);
    if (selectedWorkflow === wfId) selectedWorkflow = null;
    notify();
  },

  reset() {
    workflows = [...BUILTIN_WORKFLOWS]; runs = [];
    selectedWorkflow = null; selectedRun = null; runCounter = 0;
    notify();
  },
};
