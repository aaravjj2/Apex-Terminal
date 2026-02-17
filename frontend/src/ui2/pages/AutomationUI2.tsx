/**
 * AutomationUI2 — Automation Studio (v1.63-v1.65)
 * Workflow list + run workflow + live progress + artifacts viewer
 */

import { useState, useSyncExternalStore } from 'react';
import { PageHeader, Panel, DataTable, Tabs, StatusBadge } from '../components';
import type { ColumnDef } from '../components';
import { automationStore } from '../stores/automationStore';
import type { WorkflowDef, WorkflowRun, RunArtifact } from '../stores/automationStore';

function useAutomation() {
  const workflows = useSyncExternalStore(automationStore.subscribe, automationStore.getWorkflows);
  const runs = useSyncExternalStore(automationStore.subscribe, automationStore.getRuns);
  const selectedWf = useSyncExternalStore(automationStore.subscribe, automationStore.getSelectedWorkflow);
  const selectedRun = useSyncExternalStore(automationStore.subscribe, automationStore.getSelectedRun);
  return { workflows, runs, selectedWf, selectedRun };
}

export function AutomationUI2() {
  const { workflows, runs, selectedWf, selectedRun } = useAutomation();
  const [tab, setTab] = useState('workflows');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  void workflows.find(w => w.id === selectedWf); // kept for future use
  const currentRun = runs.find(r => r.id === selectedRun);

  const wfColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'name', label: 'Workflow' },
    { key: 'description', label: 'Description', width: '30%' },
    { key: 'trigger', label: 'Trigger', render: (_v, row) => String((row as unknown as WorkflowDef).trigger.type) },
    { key: 'steps', label: 'Steps', render: (_v, row) => String((row as unknown as WorkflowDef).steps.length), align: 'center' },
    { key: 'version', label: 'Ver', align: 'center' },
    {
      key: 'actions', label: 'Actions', render: (_v, row) => {
        const wf = row as unknown as WorkflowDef;
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              data-testid={`automation-run-${wf.id}`}
              onClick={(e) => { e.stopPropagation(); automationStore.runWorkflow(wf.id); setTab('runs'); }}
              style={{ padding: '2px 8px', fontSize: 11, background: 'var(--ui2-accent)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
            >Run</button>
          </div>
        );
      },
    },
  ];

  const runColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'id', label: 'Run ID', width: '20%' },
    { key: 'workflow_name', label: 'Workflow' },
    {
      key: 'status', label: 'Status', render: (_v, row) => {
        const r = row as unknown as WorkflowRun;
        const variant = r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'working';
        return <StatusBadge variant={variant} testId={`run-status-${r.id}`}>{r.status}</StatusBadge>;
      },
    },
    {
      key: 'steps', label: 'Steps', align: 'center',
      render: (_v, row) => {
        const r = row as unknown as WorkflowRun;
        const passed = r.step_results.filter(s => s.status === 'completed').length;
        return `${passed}/${r.step_results.length}`;
      },
    },
    { key: 'deterministic_hash', label: 'Hash', width: '15%', render: (v) => <code style={{ fontSize: 11 }}>{String(v).slice(0, 12)}</code> },
  ];

  return (
    <div data-testid="automation-ui2-page" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto', padding: '0 4px' }}>
      <PageHeader title="Automation Studio" subtitle="Workflow automation engine" badge="v1.63" />

      <Tabs
        testId="automation-tabs"
        items={[
          { id: 'workflows', label: 'Workflows' },
          { id: 'runs', label: 'Runs' },
          { id: 'artifacts', label: 'Artifacts' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      {tab === 'workflows' && (
        <Panel testId="automation-workflows-panel" title={`Workflows (${workflows.length})`} actions={
          <button
            data-testid="automation-create-btn"
            onClick={() => setCreating(!creating)}
            style={{ padding: '4px 12px', fontSize: 12, background: 'var(--ui2-accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >{creating ? 'Cancel' : '+ Create'}</button>
        }>
          {creating && (
            <div data-testid="automation-create-form" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <input
                data-testid="automation-wf-name"
                placeholder="Workflow name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ padding: '4px 8px', flex: 1, background: 'var(--ui2-surface)', color: 'var(--ui2-text)', border: '1px solid var(--ui2-border)', borderRadius: 3 }}
              />
              <input
                data-testid="automation-wf-desc"
                placeholder="Description"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                style={{ padding: '4px 8px', flex: 1, background: 'var(--ui2-surface)', color: 'var(--ui2-text)', border: '1px solid var(--ui2-border)', borderRadius: 3 }}
              />
              <button
                data-testid="automation-wf-submit"
                disabled={!newName.trim()}
                onClick={() => {
                  automationStore.createWorkflow(newName.trim(), newDesc.trim(), [
                    { id: 'step-1', name: 'Generate Report', type: 'tool', tool_name: 'generate_report', tool_params: { type: 'portfolio' }, timeout_ms: 30000, continue_on_fail: false },
                  ]);
                  setNewName('');
                  setNewDesc('');
                  setCreating(false);
                }}
                style={{ padding: '4px 12px', fontSize: 12, background: newName.trim() ? 'var(--ui2-accent)' : '#555', color: '#fff', border: 'none', borderRadius: 3, cursor: newName.trim() ? 'pointer' : 'default' }}
              >Save</button>
            </div>
          )}
          <DataTable
            testId="automation-wf-table"
            columns={wfColumns}
            data={workflows as any}
            keyField="id"
            density="compact"
            onRowClick={(row) => automationStore.selectWorkflow((row as unknown as WorkflowDef).id)}
          />
        </Panel>
      )}

      {tab === 'runs' && (
        <Panel testId="automation-runs-panel" title={`Runs (${runs.length})`}>
          {runs.length === 0 ? (
            <div data-testid="automation-no-runs" style={{ color: 'var(--ui2-text-muted)', padding: 16, textAlign: 'center' }}>
              No runs yet. Select a workflow and click Run.
            </div>
          ) : (
            <>
              <DataTable
                testId="automation-runs-table"
                columns={runColumns}
                data={runs as any}
                keyField="id"
                density="compact"
                onRowClick={(row) => automationStore.selectRun((row as unknown as WorkflowRun).id)}
              />

              {currentRun && (
                <div data-testid="automation-run-detail" style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ui2-text)' }}>
                    Run: {currentRun.id}
                    <StatusBadge variant={currentRun.status === 'completed' ? 'success' : 'danger'} testId="automation-run-status">
                      {currentRun.status}
                    </StatusBadge>
                  </h4>

                  {/* Step timeline */}
                  <div data-testid="automation-step-timeline" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {currentRun.step_results.map((sr, i) => (
                      <div
                        key={sr.step_id}
                        data-testid={`automation-step-${sr.step_id}`}
                        style={{
                          flex: 1, padding: '6px 8px', borderRadius: 4, fontSize: 11,
                          background: sr.status === 'completed' ? 'rgba(34,197,94,0.15)' : sr.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${sr.status === 'completed' ? 'rgba(34,197,94,0.3)' : sr.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>Step {i + 1}: {sr.step_name}</div>
                        <div style={{ color: 'var(--ui2-text-muted)' }}>{sr.status}</div>
                      </div>
                    ))}
                  </div>

                  <div data-testid="automation-run-hash" style={{ fontSize: 11, color: 'var(--ui2-text-muted)' }}>
                    Hash: <code>{currentRun.deterministic_hash}</code>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {tab === 'artifacts' && (
        <Panel testId="automation-artifacts-panel" title="Artifacts">
          {(() => {
            const allArtifacts = runs.flatMap(r => r.artifacts);
            if (allArtifacts.length === 0) {
              return (
                <div data-testid="automation-no-artifacts" style={{ color: 'var(--ui2-text-muted)', padding: 16, textAlign: 'center' }}>
                  No artifacts. Run a workflow first.
                </div>
              );
            }

            const artColumns: ColumnDef<Record<string, unknown>>[] = [
              { key: 'name', label: 'Name' },
              { key: 'run_id', label: 'Run' },
              { key: 'summary', label: 'Summary', width: '40%' },
              { key: 'content_type', label: 'Type' },
            ];

            return (
              <>
                <DataTable
                  testId="automation-artifacts-table"
                  columns={artColumns}
                  data={allArtifacts as any}
                  keyField="id"
                  density="compact"
                  onRowClick={(row) => automationStore.selectRun((row as unknown as RunArtifact).run_id)}
                />

                {currentRun && currentRun.artifacts.length > 0 && (
                  <div data-testid="automation-artifact-viewer" style={{ marginTop: 12 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ui2-text)' }}>Artifact Preview</h4>
                    <pre
                      data-testid="automation-artifact-content"
                      style={{
                        background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 4,
                        fontSize: 11, maxHeight: 200, overflow: 'auto',
                        color: 'var(--ui2-text-muted)', fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(currentRun.artifacts[0].data, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            );
          })()}
        </Panel>
      )}

      <div data-testid="automation-ready" style={{ display: 'none' }}>ready</div>
    </div>
  );
}
