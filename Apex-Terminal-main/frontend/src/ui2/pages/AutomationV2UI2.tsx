/**
 * Wave 8 — AutomationV2UI2 Page (v1.76)
 * DAG-based workflow automation with triggers, node execution logs, run viewer.
 */

import { useSyncExternalStore } from 'react';
import { PageHeader, StatusBadge, DataTable, type ColumnDef } from '../components';
import { Tabs } from '../components/Tabs';
import { automationV2Store, type WorkflowDefV2, type AutomationRunLogV2, type NodeExecutionV2 } from '../stores/automationV2Store';

export function AutomationV2UI2() {
  const workflows = useSyncExternalStore(automationV2Store.subscribe, automationV2Store.getWorkflows);
  const runs = useSyncExternalStore(automationV2Store.subscribe, automationV2Store.getRuns);
  const selectedWorkflow = useSyncExternalStore(automationV2Store.subscribe, automationV2Store.getSelectedWorkflow);
  const selectedRunId = useSyncExternalStore(automationV2Store.subscribe, automationV2Store.getSelectedRun);

  const currentRunLog = runs.find(r => r.run_id === selectedRunId) ?? null;

  const tabItems = [
    { id: 'workflows', label: 'Workflows' },
    { id: 'runs', label: 'Runs' },
    { id: 'runlog', label: 'Run Log' },
  ];

  const activeTab: string = currentRunLog ? 'runlog' : runs.length > 0 && !selectedWorkflow ? 'runs' : 'workflows';

  const wfColumns: ColumnDef<WorkflowDefV2>[] = [
    { key: 'name', label: 'Name', width: '200px' },
    { key: 'trigger', label: 'Trigger', width: '120px', render: (val: unknown) => (
      <StatusBadge variant="info" testId="">{val as string}</StatusBadge>
    )},
    { key: 'nodes', label: 'Nodes', width: '60px', render: (val: unknown) => `${(val as unknown[]).length}` },
    { key: 'description', label: 'Description' },
  ];

  const runColumns: ColumnDef<AutomationRunLogV2>[] = [
    { key: 'run_id', label: 'Run ID', width: '200px' },
    { key: 'workflow_name', label: 'Workflow', width: '160px' },
    { key: 'status', label: 'Status', width: '100px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'completed' ? 'success' : 'danger'} testId="">{v}</StatusBadge>;
    }},
    { key: 'trigger', label: 'Trigger', width: '100px' },
    { key: 'node_executions', label: 'Nodes', width: '60px', render: (val: unknown) => `${(val as unknown[]).length}` },
    { key: 'deterministic_hash', label: 'Hash', width: '100px' },
  ];

  const nodeColumns: ColumnDef<NodeExecutionV2>[] = [
    { key: 'node_id', label: 'Node', width: '80px' },
    { key: 'action', label: 'Action', width: '160px' },
    { key: 'status', label: 'Status', width: '100px', render: (val: unknown) => {
      const v = val as string;
      return <StatusBadge variant={v === 'completed' ? 'success' : v === 'failed' ? 'danger' : 'info'} testId="">{v}</StatusBadge>;
    }},
    { key: 'duration_ms', label: 'ms', width: '60px' },
    { key: 'error', label: 'Error', render: (val: unknown) => (val as string) || '—' },
  ];

  return (
    <div data-testid="automation-v2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Automation V2"
          subtitle="DAG-Based Workflow Automation · Triggers · Actions · Conditions"
          testId="ui2-automation-v2-header"
        />
      </div>

      {/* Controls */}
      <div data-testid="ui2-automation-controls" style={{ padding: '8px 16px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--ui2-border)' }}>
        <button
          data-testid="ui2-automation-create-btn"
          onClick={() => automationV2Store.createWorkflow({ name: `Workflow ${workflows.length + 1}` })}
          style={{
            padding: '6px 16px', fontSize: '13px', fontWeight: 600,
            background: 'var(--ui2-brand)', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          + Create
        </button>

        {selectedWorkflow && (
          <button
            data-testid="ui2-automation-run-btn"
            onClick={() => automationV2Store.runWorkflow(selectedWorkflow)}
            style={{
              padding: '6px 16px', fontSize: '13px', fontWeight: 600,
              background: 'var(--ui2-green, #27ae60)', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            ▶ Run
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px' }}>
        <Tabs
          items={tabItems}
          activeTab={activeTab}
          onTabChange={() => {}}
          testId="ui2-automation-tabs"
        />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'workflows' && (
          <div data-testid="ui2-automation-workflow-list">
            <DataTable
              columns={wfColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={workflows as unknown as Record<string, unknown>[]}
              testId="ui2-automation-wf-dt"
              density="compact"
              onRowClick={(row) => automationV2Store.selectWorkflow((row as unknown as WorkflowDefV2).workflow_id)}
            />
          </div>
        )}

        {activeTab === 'runs' && (
          <DataTable
            columns={runColumns as unknown as ColumnDef<Record<string, unknown>>[]}
            data={runs as unknown as Record<string, unknown>[]}
            testId="ui2-automation-runs-dt"
            density="compact"
            onRowClick={(row) => automationV2Store.selectRun((row as unknown as AutomationRunLogV2).run_id)}
          />
        )}

        {activeTab === 'runlog' && currentRunLog && (
          <div data-testid="ui2-automation-runlog">
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--ui2-text-secondary)' }}>
              <strong>Run:</strong> {currentRunLog.run_id} &middot; <strong>Status:</strong> {currentRunLog.status} &middot;
              <strong> Hash:</strong> {currentRunLog.deterministic_hash}
            </div>
            <DataTable
              columns={nodeColumns as unknown as ColumnDef<Record<string, unknown>>[]}
              data={currentRunLog.node_executions as unknown as Record<string, unknown>[]}
              testId="ui2-automation-runlog-dt"
              density="compact"
            />
          </div>
        )}
      </div>

      {/* Ready marker */}
      <div data-testid="automation-v2-ready" style={{ display: 'none' }} />
    </div>
  );
}
