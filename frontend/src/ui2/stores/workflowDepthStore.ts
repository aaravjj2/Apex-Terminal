/**
 * workflowDepthStore.ts — Depth Upgrade C: Templates + RBAC + Scheduling + Audit
 * Pure deterministic DEMO store.
 */

function fnv32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'trader' | 'viewer';

export interface DemoUser {
  user_id: string;
  name: string;
  role: Role;
}

export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  tags: string[];
  trigger_type: string;
  actions: string[];
  created_by: string;
  created_at: string;
  use_count: number;
}

export interface ScheduledJob {
  job_id: string;
  workflow_id: string;
  workflow_name: string;
  schedule_cron: string;
  next_run: string;
  status: 'active' | 'paused' | 'completed';
  created_by: string;
  created_at: string;
}

export interface WorkflowRun {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  job_id: string | null;
  status: 'success' | 'failed' | 'running';
  started_at: string;
  completed_at: string;
  duration_ms: number;
  triggered_by: string;
  steps_completed: number;
  steps_total: number;
  output_hash: string;
}

export interface AuditExport {
  export_id: string;
  workflow_id: string;
  workflow_definition: object;
  template_metadata: object | null;
  validation_results: object;
  simulation_logs: string[];
  run_records: WorkflowRun[];
  hash: string;
  exported_at: string;
}

export interface RBACPermission {
  action: string;
  allowed_roles: Role[];
}

const BUILTIN_USERS: DemoUser[] = [
  { user_id: 'user-admin-001', name: 'Alice Admin', role: 'admin' },
  { user_id: 'user-trader-001', name: 'Bob Trader', role: 'trader' },
  { user_id: 'user-viewer-001', name: 'Carol Viewer', role: 'viewer' },
];

const RBAC_POLICIES: RBACPermission[] = [
  { action: 'create_template', allowed_roles: ['admin'] },
  { action: 'edit_template', allowed_roles: ['admin'] },
  { action: 'clone_template', allowed_roles: ['admin', 'trader'] },
  { action: 'create_schedule', allowed_roles: ['admin', 'trader'] },
  { action: 'run_workflow', allowed_roles: ['admin', 'trader'] },
  { action: 'view_workflow', allowed_roles: ['admin', 'trader', 'viewer'] },
  { action: 'export_audit', allowed_roles: ['admin'] },
];

function generateTemplates(): WorkflowTemplate[] {
  return [
    {
      template_id: 'tmpl-001',
      name: 'Daily Portfolio Export',
      description: 'Automated daily export of portfolio snapshot at market close',
      tags: ['export', 'portfolio', 'daily'],
      trigger_type: 'schedule',
      actions: ['snapshot_portfolio', 'export_csv', 'notify_slack'],
      created_by: 'user-admin-001',
      created_at: '2026-01-10T09:00:00Z',
      use_count: 12,
    },
    {
      template_id: 'tmpl-002',
      name: 'Stop Loss Guardian',
      description: 'Monitor positions and trigger stop-loss orders when thresholds breached',
      tags: ['risk', 'stop-loss', 'monitoring'],
      trigger_type: 'event',
      actions: ['check_positions', 'evaluate_stops', 'place_orders'],
      created_by: 'user-admin-001',
      created_at: '2026-01-15T10:00:00Z',
      use_count: 8,
    },
    {
      template_id: 'tmpl-003',
      name: 'Earnings Alert Pipeline',
      description: 'Pre-earnings alert with position review and risk assessment',
      tags: ['earnings', 'alert', 'research'],
      trigger_type: 'schedule',
      actions: ['scan_earnings_calendar', 'check_positions', 'send_alert'],
      created_by: 'user-trader-001',
      created_at: '2026-02-01T08:30:00Z',
      use_count: 5,
    },
    {
      template_id: 'tmpl-004',
      name: 'Rebalance Workflow',
      description: 'Periodic portfolio rebalancing based on target allocations',
      tags: ['rebalance', 'portfolio', 'allocation'],
      trigger_type: 'schedule',
      actions: ['get_current_weights', 'compute_rebalance', 'generate_orders'],
      created_by: 'user-admin-001',
      created_at: '2026-02-05T11:00:00Z',
      use_count: 3,
    },
  ];
}

function generateScheduledJobs(): ScheduledJob[] {
  return [
    {
      job_id: 'job-001',
      workflow_id: 'wf-daily-export',
      workflow_name: 'Daily Portfolio Export',
      schedule_cron: '0 16 * * 1-5',
      next_run: '2026-02-16T16:00:00Z',
      status: 'active',
      created_by: 'user-admin-001',
      created_at: '2026-01-10T09:00:00Z',
    },
    {
      job_id: 'job-002',
      workflow_id: 'wf-stop-loss',
      workflow_name: 'Stop Loss Guardian',
      schedule_cron: '*/5 9-16 * * 1-5',
      next_run: '2026-02-16T09:00:00Z',
      status: 'active',
      created_by: 'user-trader-001',
      created_at: '2026-01-15T10:00:00Z',
    },
    {
      job_id: 'job-003',
      workflow_id: 'wf-rebalance',
      workflow_name: 'Monthly Rebalance',
      schedule_cron: '0 9 1 * *',
      next_run: '2026-03-01T09:00:00Z',
      status: 'paused',
      created_by: 'user-admin-001',
      created_at: '2026-02-01T08:00:00Z',
    },
  ];
}

function generateRunHistory(): WorkflowRun[] {
  const runs: WorkflowRun[] = [];
  const workflows = [
    { id: 'wf-daily-export', name: 'Daily Portfolio Export', job: 'job-001' },
    { id: 'wf-stop-loss', name: 'Stop Loss Guardian', job: 'job-002' },
  ];

  for (let i = 0; i < 8; i++) {
    const wf = workflows[i % 2];
    const seed = fnv32(`${wf.id}:run:${i}:${new Date().toISOString()}`);
    const startH = 9 + (i % 8);
    runs.push({
      run_id: `run-${seed.toString(16).slice(0, 8)}`,
      workflow_id: wf.id,
      workflow_name: wf.name,
      job_id: wf.job,
      status: i === 5 ? 'failed' : 'success',
      started_at: `2026-02-${String(10 + i).padStart(2, '0')}T${String(startH).padStart(2, '0')}:00:00Z`,
      completed_at: `2026-02-${String(10 + i).padStart(2, '0')}T${String(startH).padStart(2, '0')}:00:${String(2 + (seed % 8)).padStart(2, '0')}Z`,
      duration_ms: 2000 + (seed % 6000),
      triggered_by: i % 3 === 0 ? 'manual' : 'scheduler',
      steps_completed: i === 5 ? 2 : 3,
      steps_total: 3,
      output_hash: seed.toString(16).padStart(8, '0'),
    });
  }
  return runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

// ─── Store ──────────────────────────────────────────────────────────────────
type Listener = () => void;

interface State {
  currentUser: DemoUser;
  templates: WorkflowTemplate[];
  scheduledJobs: ScheduledJob[];
  runHistory: WorkflowRun[];
}

let state: State = {
  currentUser: BUILTIN_USERS[0], // admin by default
  templates: generateTemplates(),
  scheduledJobs: generateScheduledJobs(),
  runHistory: generateRunHistory(),
};

const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

export const workflowDepthStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  // ── Users / RBAC ──────────────────────────────────────────────────────
  getCurrentUser: () => state.currentUser,
  getUsers: () => BUILTIN_USERS,
  setCurrentUser(userId: string) {
    const u = BUILTIN_USERS.find((u) => u.user_id === userId);
    if (u) { state = { ...state, currentUser: u }; emit(); }
  },
  getRBACPolicies: () => RBAC_POLICIES,
  canPerform(action: string): boolean {
    const policy = RBAC_POLICIES.find((p) => p.action === action);
    if (!policy) return false;
    return policy.allowed_roles.includes(state.currentUser.role);
  },

  // ── Templates ─────────────────────────────────────────────────────────
  getTemplates: () => state.templates,
  getTemplate: (id: string) => state.templates.find((t) => t.template_id === id),
  searchTemplates(query: string): WorkflowTemplate[] {
    const q = query.toLowerCase();
    return state.templates.filter((t) =>
      t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)) || t.description.toLowerCase().includes(q)
    );
  },
  saveAsTemplate(name: string, description: string, tags: string[], triggerType: string, actions: string[]): WorkflowTemplate {
    const tmpl: WorkflowTemplate = {
      template_id: `tmpl-${fnv32(`${name}:${new Date().toISOString()}`).toString(16).slice(0, 6)}`,
      name,
      description,
      tags,
      trigger_type: triggerType,
      actions,
      created_by: state.currentUser.user_id,
      created_at: new Date().toISOString(),
      use_count: 0,
    };
    state = { ...state, templates: [...state.templates, tmpl] };
    emit();
    return tmpl;
  },
  cloneTemplate(templateId: string): WorkflowTemplate | null {
    const src = state.templates.find((t) => t.template_id === templateId);
    if (!src) return null;
    const cloned: WorkflowTemplate = {
      ...src,
      template_id: `tmpl-${fnv32(`clone:${templateId}:${new Date().toISOString()}`).toString(16).slice(0, 6)}`,
      name: `${src.name} (Copy)`,
      created_by: state.currentUser.user_id,
      created_at: new Date().toISOString(),
      use_count: 0,
    };
    state = { ...state, templates: [...state.templates, cloned] };
    emit();
    return cloned;
  },

  // ── Scheduling ────────────────────────────────────────────────────────
  getScheduledJobs: () => state.scheduledJobs,
  createSchedule(workflowId: string, workflowName: string, cron: string): ScheduledJob {
    const job: ScheduledJob = {
      job_id: `job-${fnv32(`${workflowId}:${cron}:${new Date().toISOString()}`).toString(16).slice(0, 6)}`,
      workflow_id: workflowId,
      workflow_name: workflowName,
      schedule_cron: cron,
      next_run: '2026-02-16T09:00:00Z',
      status: 'active',
      created_by: state.currentUser.user_id,
      created_at: new Date().toISOString(),
    };
    state = { ...state, scheduledJobs: [...state.scheduledJobs, job] };
    emit();
    return job;
  },
  toggleJobStatus(jobId: string) {
    state = {
      ...state,
      scheduledJobs: state.scheduledJobs.map((j) =>
        j.job_id === jobId ? { ...j, status: j.status === 'active' ? 'paused' : 'active' } : j
      ),
    };
    emit();
  },

  // ── Run History ───────────────────────────────────────────────────────
  getRunHistory: () => state.runHistory,
  getRunById: (runId: string) => state.runHistory.find((r) => r.run_id === runId),

  triggerDeterministicRun(workflowId: string, workflowName: string): WorkflowRun {
    const seed = fnv32(`${workflowId}:trigger:${state.runHistory.length}:${new Date().toISOString()}`);
    const run: WorkflowRun = {
      run_id: `run-${seed.toString(16).slice(0, 8)}`,
      workflow_id: workflowId,
      workflow_name: workflowName,
      job_id: null,
      status: 'success',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 2000 + (seed % 5000),
      triggered_by: 'manual',
      steps_completed: 3,
      steps_total: 3,
      output_hash: seed.toString(16).padStart(8, '0'),
    };
    state = { ...state, runHistory: [run, ...state.runHistory] };
    emit();
    return run;
  },

  // ── Audit Export ──────────────────────────────────────────────────────
  exportAudit(workflowId: string): AuditExport {
    const runs = state.runHistory.filter((r) => r.workflow_id === workflowId);
    const exportData: AuditExport = {
      export_id: `export-${fnv32(`${workflowId}:export:${new Date().toISOString()}`).toString(16).slice(0, 8)}`,
      workflow_id: workflowId,
      workflow_definition: { id: workflowId, type: 'demo' },
      template_metadata: null,
      validation_results: { valid: true, checks: ['syntax', 'permissions', 'trigger'] },
      simulation_logs: ['[INFO] Workflow validated', '[INFO] Simulation started', '[INFO] All steps passed'],
      run_records: runs,
      hash: fnv32(JSON.stringify(runs)).toString(16).padStart(8, '0'),
      exported_at: new Date().toISOString(),
    };
    return exportData;
  },

  getExportHash(workflowId: string): string {
    const exp = this.exportAudit(workflowId);
    return exp.hash;
  },

  reset() {
    state = {
      currentUser: BUILTIN_USERS[0],
      templates: generateTemplates(),
      scheduledJobs: generateScheduledJobs(),
      runHistory: generateRunHistory(),
    };
    emit();
  },
};
