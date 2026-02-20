/**
 * Workflow Builder UI2 — v1.124-v1.125
 * Create/edit workflows with triggers + actions, templates, import/export.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Plus, Trash2, Save, Upload, Download, CheckCircle, FileText, Clock, Play, Shield, FileDown } from 'lucide-react';
import { wave1314Store, type WorkflowData } from '../stores/wave1314Store';
import { workflowDepthStore, type ScheduledJob } from '../stores/workflowDepthStore';

const TRIGGER_TYPES = ['schedule', 'market_event', 'pnl_threshold', 'order_fill'] as const;
const ACTION_TYPES = ['place_order', 'cancel_order', 'export_bundle', 'notify'] as const;

export function WorkflowBuilderUI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const workflows = wave1314Store.getWorkflows();
  const templates = wave1314Store.getTemplates();

  const [tab, setTab] = useState<'workflows' | 'templates' | 'import' | 'scheduling' | 'runs' | 'audit'>('workflows');

  // Depth stores
  const depthState = useSyncExternalStore(workflowDepthStore.subscribe, workflowDepthStore.getSnapshot);
  const [schedCron, setSchedCron] = useState('0 9 * * 1-5');
  const [schedWfId, setSchedWfId] = useState('');
  const [schedWfName, setSchedWfName] = useState('');
  const [auditJson, setAuditJson] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTriggerType, setFormTriggerType] = useState<string>('schedule');
  const [formTriggerConfig, setFormTriggerConfig] = useState('{}');
  const [formActions, setFormActions] = useState<{ type: string; config: string }[]>([]);
  const [importJson, setImportJson] = useState('');
  const [exportJson, setExportJson] = useState('');
  const [saved, setSaved] = useState(false);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; message: string } | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormTriggerType('schedule');
    setFormTriggerConfig('{}');
    setFormActions([]);
  };

  const startNew = () => {
    resetForm();
    setFormActions([{ type: 'notify', config: '{"message":"Hello"}' }]);
    setEditingId('__new__');
  };

  const handleSave = () => {
    try {
      const trigger = { type: formTriggerType, config: JSON.parse(formTriggerConfig) };
      const actions = formActions.map((a) => ({ type: a.type, config: JSON.parse(a.config) }));
      wave1314Store.createWorkflow(formName || 'Untitled Workflow', trigger, actions);
      setSaved(true);
      setValidateResult(null);
      setTimeout(() => setSaved(false), 2000);
      resetForm();
    } catch { /* ignore parse errors */ }
  };

  const handleValidate = () => {
    const errors: string[] = [];
    if (!formName.trim()) errors.push('Workflow name is required');
    try { JSON.parse(formTriggerConfig); } catch { errors.push('Trigger config is not valid JSON'); }
    formActions.forEach((a, i) => {
      try { JSON.parse(a.config); } catch { errors.push(`Action ${i + 1} config is not valid JSON`); }
    });
    if (formActions.length === 0) errors.push('At least one action is required');
    setValidateResult(errors.length === 0
      ? { ok: true, message: `Workflow valid: trigger=${formTriggerType}, ${formActions.length} action(s)` }
      : { ok: false, message: errors.join('; ') }
    );
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      const trigger = data.trigger || { type: 'schedule', config: {} };
      const actions = data.actions || [];
      wave1314Store.createWorkflow(data.name || 'Imported', trigger, actions);
      setImportJson('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  const handleExport = (wf: WorkflowData) => {
    setExportJson(JSON.stringify(wf, null, 2));
    setTab('import');
  };

  return (
    <div className="flex flex-col h-full" data-testid="ui2-workflow-builder-page" data-ready="true">
      <PageHeader
        title="Workflow Builder"
        subtitle={`${workflows.length} workflows · ${templates.length} templates`}
        testId="ui2-workflow-builder-header"
        actions={
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
            data-testid="ui2-workflow-create-btn"
          >
            <Plus className="w-4 h-4" /> New Workflow
          </button>
        }
      />

      {/* RBAC User Switcher */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-950" data-testid="ui2-workflow-rbac-bar">
        <Shield className="w-4 h-4 text-neutral-500" />
        <span className="text-xs text-neutral-500">Role:</span>
        <select
          value={depthState.currentUser.user_id}
          onChange={(e) => workflowDepthStore.setCurrentUser(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
          data-testid="ui2-workflow-role-select"
        >
          {workflowDepthStore.getUsers().map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.name} ({u.role})</option>
          ))}
        </select>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${depthState.currentUser.role === 'admin' ? 'bg-purple-900 text-purple-300' : depthState.currentUser.role === 'trader' ? 'bg-blue-900 text-blue-300' : 'bg-neutral-800 text-neutral-400'}`} data-testid="ui2-workflow-role-badge">
          {depthState.currentUser.role}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 px-4" data-testid="ui2-workflow-tabs">
        {(['workflows', 'templates', 'import', 'scheduling', 'runs', 'audit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
            data-testid={`ui2-workflow-tab-${t}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Workflows tab */}
        {tab === 'workflows' && (
          <div className="space-y-3" data-testid="ui2-workflow-list">
            {editingId === '__new__' && (
              <div className="bg-neutral-900 border border-blue-600 rounded-lg p-4 space-y-3" data-testid="ui2-workflow-form">
                <input
                  value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="Workflow name" className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 outline-none"
                  data-testid="ui2-workflow-name-input"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Trigger Type</label>
                    <select value={formTriggerType} onChange={(e) => setFormTriggerType(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200"
                      data-testid="ui2-workflow-trigger-select"
                    >
                      {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Trigger Config (JSON)</label>
                    <input value={formTriggerConfig} onChange={(e) => setFormTriggerConfig(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm font-mono text-neutral-200"
                      data-testid="ui2-workflow-trigger-config"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-neutral-500">Actions</label>
                    <button onClick={() => setFormActions([...formActions, { type: 'notify', config: '{}' }])}
                      className="text-xs text-blue-400 hover:text-blue-300" data-testid="ui2-workflow-add-action-btn"
                    >+ Add Action</button>
                  </div>
                  {formActions.map((a, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <select value={a.type} onChange={(e) => { const n = [...formActions]; n[i] = { ...a, type: e.target.value }; setFormActions(n); }}
                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
                        data-testid={`ui2-workflow-action-type-${i}`}
                      >
                        {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={a.config} onChange={(e) => { const n = [...formActions]; n[i] = { ...a, config: e.target.value }; setFormActions(n); }}
                        className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200"
                        data-testid={`ui2-workflow-action-config-${i}`}
                      />
                      <button onClick={() => setFormActions(formActions.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleValidate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                    data-testid="ui2-workflow-validate-btn"
                  >Validate</button>
                  <button onClick={handleSave}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                    data-testid="ui2-workflow-save-btn"
                  >
                    {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? 'Saved!' : 'Save'}
                  </button>
                  <button onClick={resetForm} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm">Cancel</button>
                </div>
                {validateResult && (
                  <div
                    data-testid="ui2-workflow-validate-result"
                    className={`text-xs px-3 py-2 rounded ${validateResult.ok ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-red-900 text-red-300 border border-red-700'}`}
                  >
                    {validateResult.ok ? '✓ ' : '✗ '}{validateResult.message}
                  </div>
                )}
              </div>
            )}
            {workflows.map((wf) => (
              <div key={wf.workflow_id} className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-between"
                data-testid={`ui2-workflow-item-${wf.workflow_id}`}
              >
                <div>
                  <div className="text-sm font-semibold text-neutral-100">{wf.name}</div>
                  <div className="flex gap-3 text-xs text-neutral-500 mt-1">
                    <span className="font-mono">{wf.workflow_id}</span>
                    <span className="px-1.5 py-0.5 bg-neutral-800 rounded">{wf.trigger.type}</span>
                    <span>{wf.actions.length} action(s)</span>
                    {wf.enabled ? <span className="text-green-400">enabled</span> : <span className="text-red-400">disabled</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleExport(wf)} className="p-1.5 text-neutral-500 hover:text-neutral-300" data-testid={`ui2-workflow-export-${wf.workflow_id}`}><Download className="w-4 h-4" /></button>
                  <button onClick={() => wave1314Store.deleteWorkflow(wf.workflow_id)} className="p-1.5 text-red-500 hover:text-red-300" data-testid={`ui2-workflow-delete-${wf.workflow_id}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Templates tab (enhanced with search, clone, tags) */}
        {tab === 'templates' && (
          <div className="space-y-3" data-testid="ui2-workflow-templates-list">
            {/* Template search */}
            <div className="flex gap-2 mb-3">
              <input
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates by name or tag…"
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-500"
                data-testid="ui2-workflow-search-templates"
              />
            </div>

            {/* Depth templates */}
            {(templateSearch
              ? workflowDepthStore.searchTemplates(templateSearch)
              : depthState.templates
            ).map((tmpl) => (
              <div key={tmpl.template_id} className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3"
                data-testid={`ui2-workflow-depth-template-${tmpl.template_id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-neutral-100">{tmpl.name}</span>
                      <span className="text-xs text-neutral-600 font-mono">×{tmpl.use_count}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{tmpl.description}</p>
                    <div className="flex gap-1 mt-1">
                      {tmpl.tags.map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded" data-testid={`ui2-workflow-tag-${tag}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {workflowDepthStore.canPerform('clone_template') && (
                      <button
                        onClick={() => workflowDepthStore.cloneTemplate(tmpl.template_id)}
                        className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs"
                        data-testid={`ui2-workflow-clone-${tmpl.template_id}`}
                      >Clone</button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Original wave1314 templates */}
            {!templateSearch && templates.map((tmpl) => (
              <div key={tmpl.template_id} className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3"
                data-testid={`ui2-workflow-template-${tmpl.template_id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-neutral-100">{tmpl.name}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{tmpl.description}</p>
                  </div>
                  <button
                    onClick={() => wave1314Store.applyTemplate(tmpl.template_id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                    data-testid={`ui2-workflow-apply-template-${tmpl.template_id}`}
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import/Export tab */}
        {tab === 'import' && (
          <div className="space-y-4" data-testid="ui2-workflow-import-section">
            <div>
              <label className="text-sm text-neutral-400 block mb-2">Import Workflow JSON</label>
              <textarea
                value={importJson} onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"name": "My Workflow", "trigger": {...}, "actions": [...]}'
                className="w-full h-32 bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm font-mono text-neutral-200 resize-none focus:border-blue-500 outline-none"
                data-testid="ui2-workflow-import-textarea"
              />
              <button onClick={handleImport}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                data-testid="ui2-workflow-import-btn"
              ><Upload className="w-4 h-4" /> Import</button>
            </div>
            {exportJson && (
              <div>
                <label className="text-sm text-neutral-400 block mb-2">Exported Workflow JSON</label>
                <pre className="bg-neutral-950 border border-neutral-800 rounded p-3 text-xs font-mono text-neutral-300 overflow-x-auto" data-testid="ui2-workflow-export-json">{exportJson}</pre>
              </div>
            )}
          </div>
        )}

        {/* ── Scheduling Tab ── */}
        {tab === 'scheduling' && (
          <div className="space-y-4" data-testid="ui2-workflow-scheduling-panel">
            <div className="text-sm font-semibold text-neutral-200 mb-2">Scheduled Jobs</div>

            {/* Create schedule form */}
            {workflowDepthStore.canPerform('create_schedule') && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3" data-testid="ui2-workflow-schedule-form">
                <div className="text-xs text-neutral-500 font-medium">Create Schedule</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Workflow ID</label>
                    <input value={schedWfId} onChange={(e) => setSchedWfId(e.target.value)}
                      placeholder="wf-my-workflow" className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 outline-none"
                      data-testid="ui2-workflow-schedule-wfid" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Name</label>
                    <input value={schedWfName} onChange={(e) => setSchedWfName(e.target.value)}
                      placeholder="My Workflow" className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 outline-none"
                      data-testid="ui2-workflow-schedule-name" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Cron</label>
                    <input value={schedCron} onChange={(e) => setSchedCron(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm font-mono text-neutral-200 outline-none"
                      data-testid="ui2-workflow-schedule-cron" />
                  </div>
                </div>
                <button
                  onClick={() => { if (schedWfId && schedWfName) workflowDepthStore.createSchedule(schedWfId, schedWfName, schedCron); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                  data-testid="ui2-workflow-schedule-create-btn"
                ><Clock className="w-4 h-4" /> Schedule</button>
              </div>
            )}

            {/* Scheduled jobs table */}
            <table className="w-full text-sm" data-testid="ui2-workflow-jobs-table">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="text-left py-2 px-3">Job ID</th>
                  <th className="text-left py-2 px-3">Workflow</th>
                  <th className="text-left py-2 px-3">Cron</th>
                  <th className="text-left py-2 px-3">Next Run</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-right py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {depthState.scheduledJobs.map((job) => (
                  <tr key={job.job_id} className="border-b border-neutral-800/50" data-testid={`ui2-workflow-job-${job.job_id}`}>
                    <td className="py-2 px-3 font-mono text-xs text-neutral-400">{job.job_id}</td>
                    <td className="py-2 px-3 text-neutral-200">{job.workflow_name}</td>
                    <td className="py-2 px-3 font-mono text-xs text-neutral-400">{job.schedule_cron}</td>
                    <td className="py-2 px-3 text-xs text-neutral-400">{job.next_run.split('T')[0]}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === 'active' ? 'bg-green-900 text-green-300' :
                        job.status === 'paused' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-neutral-800 text-neutral-400'
                      }`} data-testid={`ui2-workflow-job-status-${job.job_id}`}>{job.status}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {workflowDepthStore.canPerform('create_schedule') && (
                        <button
                          onClick={() => workflowDepthStore.toggleJobStatus(job.job_id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                          data-testid={`ui2-workflow-job-toggle-${job.job_id}`}
                        >{job.status === 'active' ? 'Pause' : 'Resume'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Runs Tab ── */}
        {tab === 'runs' && (
          <div className="space-y-4" data-testid="ui2-workflow-runs-panel">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-neutral-200">Run History ({depthState.runHistory.length} runs)</div>
              {workflowDepthStore.canPerform('run_workflow') && (
                <button
                  onClick={() => workflowDepthStore.triggerDeterministicRun('wf-daily-export', 'Daily Portfolio Export')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                  data-testid="ui2-workflow-trigger-run-btn"
                ><Play className="w-4 h-4" /> Trigger Run</button>
              )}
            </div>

            <table className="w-full text-sm" data-testid="ui2-workflow-runs-table">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="text-left py-2 px-3">Run ID</th>
                  <th className="text-left py-2 px-3">Workflow</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Started</th>
                  <th className="text-right py-2 px-3">Duration</th>
                  <th className="text-left py-2 px-3">Steps</th>
                  <th className="text-left py-2 px-3">Triggered</th>
                  <th className="text-left py-2 px-3">Hash</th>
                </tr>
              </thead>
              <tbody>
                {depthState.runHistory.map((run) => (
                  <tr key={run.run_id} className="border-b border-neutral-800/50" data-testid={`ui2-workflow-run-${run.run_id}`}>
                    <td className="py-2 px-3 font-mono text-xs text-neutral-400">{run.run_id}</td>
                    <td className="py-2 px-3 text-neutral-200">{run.workflow_name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        run.status === 'success' ? 'bg-green-900 text-green-300' :
                        run.status === 'failed' ? 'bg-red-900 text-red-300' :
                        'bg-blue-900 text-blue-300'
                      }`} data-testid={`ui2-workflow-run-status-${run.run_id}`}>{run.status}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-neutral-400">{run.started_at.split('T')[0]}</td>
                    <td className="py-2 px-3 text-right text-xs text-neutral-400">{(run.duration_ms / 1000).toFixed(1)}s</td>
                    <td className="py-2 px-3 text-xs text-neutral-400">{run.steps_completed}/{run.steps_total}</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">{run.triggered_by}</td>
                    <td className="py-2 px-3 font-mono text-xs text-neutral-600">{run.output_hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Audit Tab ── */}
        {tab === 'audit' && (
          <div className="space-y-4" data-testid="ui2-workflow-audit-panel">
            <div className="text-sm font-semibold text-neutral-200 mb-2">Audit Export</div>
            {!workflowDepthStore.canPerform('export_audit') ? (
              <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-3 py-2" data-testid="ui2-workflow-audit-denied">
                Access denied — admin role required to export audit bundles.
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const exp = workflowDepthStore.exportAudit('wf-daily-export');
                      setAuditJson(JSON.stringify(exp, null, 2));
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                    data-testid="ui2-workflow-audit-export-btn"
                  ><FileDown className="w-4 h-4" /> Export Daily Portfolio Audit</button>
                  <button
                    onClick={() => {
                      const exp = workflowDepthStore.exportAudit('wf-stop-loss');
                      setAuditJson(JSON.stringify(exp, null, 2));
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                    data-testid="ui2-workflow-audit-export-stoploss-btn"
                  ><FileDown className="w-4 h-4" /> Export Stop Loss Audit</button>
                </div>
                {auditJson && (
                  <div data-testid="ui2-workflow-audit-json">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-neutral-400">Audit Bundle</label>
                      <span className="text-xs font-mono text-neutral-600" data-testid="ui2-workflow-audit-hash">
                        Hash: {JSON.parse(auditJson).hash}
                      </span>
                    </div>
                    <pre className="bg-neutral-950 border border-neutral-800 rounded p-3 text-xs font-mono text-neutral-300 overflow-auto max-h-96">{auditJson}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
