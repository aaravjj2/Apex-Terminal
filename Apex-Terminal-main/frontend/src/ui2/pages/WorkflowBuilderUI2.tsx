/**
 * Workflow Builder UI2 — v1.124-v1.125
 * Create/edit workflows with triggers + actions, templates, import/export.
 */
import { useState, useSyncExternalStore } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Plus, Trash2, Save, Upload, Download, CheckCircle, FileText } from 'lucide-react';
import { wave1314Store, type WorkflowData } from '../stores/wave1314Store';

const TRIGGER_TYPES = ['schedule', 'market_event', 'pnl_threshold', 'order_fill'] as const;
const ACTION_TYPES = ['place_order', 'cancel_order', 'export_bundle', 'notify'] as const;

export function WorkflowBuilderUI2() {
  useSyncExternalStore(wave1314Store.subscribe, wave1314Store.getSnapshot);
  const workflows = wave1314Store.getWorkflows();
  const templates = wave1314Store.getTemplates();

  const [tab, setTab] = useState<'workflows' | 'templates' | 'import'>('workflows');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTriggerType, setFormTriggerType] = useState<string>('schedule');
  const [formTriggerConfig, setFormTriggerConfig] = useState('{}');
  const [formActions, setFormActions] = useState<{ type: string; config: string }[]>([]);
  const [importJson, setImportJson] = useState('');
  const [exportJson, setExportJson] = useState('');
  const [saved, setSaved] = useState(false);

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
      setTimeout(() => setSaved(false), 2000);
      resetForm();
    } catch { /* ignore parse errors */ }
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

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 px-4" data-testid="ui2-workflow-tabs">
        {(['workflows', 'templates', 'import'] as const).map((t) => (
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
                  <button onClick={handleSave}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                    data-testid="ui2-workflow-save-btn"
                  >
                    {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? 'Saved!' : 'Save'}
                  </button>
                  <button onClick={resetForm} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm">Cancel</button>
                </div>
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

        {/* Templates tab */}
        {tab === 'templates' && (
          <div className="space-y-3" data-testid="ui2-workflow-templates-list">
            {templates.map((tmpl) => (
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
      </div>
    </div>
  );
}
