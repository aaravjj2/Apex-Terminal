import { useSyncExternalStore, useEffect } from 'react';
import { workflowV3Store } from '../stores/waves11_20Store';

function useWorkflowV3() {
  return useSyncExternalStore(workflowV3Store.subscribe, workflowV3Store.getState);
}

export function WorkflowsV3UI2() {
  const { workflows, templates, runs, loading, error } = useWorkflowV3();

  useEffect(() => {
    workflowV3Store.fetchTemplates();
    workflowV3Store.fetchWorkflows();
  }, []);

  const statusColor = (s: string) => s === 'active' ? '#22c55e' : s === 'paused' ? '#f59e0b' : s === 'completed' ? '#3b82f6' : '#94a3b8';

  return (
    <div data-testid="workflows-v3-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Workflows v3 — DAG Engine</h1>
      {loading && <p>Loading workflows...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Templates */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Templates</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(templates).map(([id, t]: [string, any]) => (
          <div key={id} data-testid={`tmpl-${id}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.name || id}</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{t.description || 'No description'}</div>
            <button
              onClick={() => workflowV3Store.createWorkflow({ name: `New ${id}`, description: `From ${id}`, steps: t.steps || [], schedule: t.schedule || {}, template_id: id })}
              data-testid={`wf3-create-${id}`}
              style={{ marginTop: 8, background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
            >
              Create from Template
            </button>
          </div>
        ))}
        {Object.keys(templates).length === 0 && <p style={{ color: '#94a3b8' }}>No templates loaded</p>}
      </div>

      {/* Workflows */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Workflows ({workflows.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {workflows.map((w, i) => (
          <div key={i} data-testid={`wf-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{w.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{w.workflow_id.slice(0, 12)}</div>
            </div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Status</span><div style={{ color: statusColor(w.status), fontWeight: 600, textTransform: 'uppercase' }}>{w.status}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Steps</span><div>{w.steps?.length || 0}</div></div>
            <button
              onClick={() => workflowV3Store.fetchRuns(w.workflow_id)}
              data-testid={`wf3-runs-${i}`}
              style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
            >
              View Runs
            </button>
          </div>
        ))}
        {workflows.length === 0 && <p style={{ color: '#94a3b8' }}>No workflows created yet</p>}
      </div>

      {/* Runs */}
      {runs.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Recent Runs ({runs.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {runs.map((r, i) => (
              <div key={i} data-testid={`run-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Run</span><div style={{ fontSize: 12 }}>{r.run_id.slice(0, 8)}</div></div>
                <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Workflow</span><div style={{ fontSize: 12 }}>{r.workflow_id.slice(0, 8)}</div></div>
                <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Status</span><div style={{ color: statusColor(r.status), fontWeight: 600 }}>{r.status}</div></div>
                <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Started</span><div style={{ fontSize: 12 }}>{r.started_at}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
