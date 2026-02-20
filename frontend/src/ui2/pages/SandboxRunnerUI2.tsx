import { useSyncExternalStore, useEffect, useState } from 'react';
import { sandboxRunnerStore } from '../stores/waveStores';

function useSandboxRunner() {
  return useSyncExternalStore(sandboxRunnerStore.subscribe, sandboxRunnerStore.getState);
}

const TYPE_COLOR: Record<string, string> = {
  agent_start: '#6366f1',
  scan_complete: '#0ea5e9',
  signal_generated: '#22c55e',
  risk_check: '#f59e0b',
  order_simulated: '#a855f7',
  cycle_complete: '#ef4444',
};

export function SandboxRunnerUI2() {
  const { events, hash, status, loading, error } = useSandboxRunner();
  const [running, setRunning] = useState(false);
  useEffect(() => { sandboxRunnerStore.fetchAll(); }, []);

  const handleRun = async () => {
    setRunning(true);
    await sandboxRunnerStore.run();
    setRunning(false);
  };

  return (
    <div data-testid="sandbox-runner-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Sandbox Agent Runner</h1>
        <button data-testid="sandbox-run-btn" onClick={handleRun} disabled={running || loading} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
          {running ? 'Running…' : 'Run Agent'}
        </button>
      </div>
      {loading && <p data-testid="sr-loading">Loading events...</p>}
      {error && <p data-testid="sr-error" style={{ color: '#ef4444' }}>{error}</p>}
      <div data-testid="sr-status" style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
        Status: <strong data-testid="sr-status-text">{status}</strong>
        {hash && <span style={{ marginLeft: 16 }}>Hash: <code data-testid="sr-hash">{hash.slice(0, 16)}…</code></span>}
      </div>
      <div data-testid="sr-event-log" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map((e: any, i) => (
          <div key={e.event_id} data-testid={`sr-event-${i}`} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 12, fontSize: 12 }}>
            <span data-testid={`sr-seq-${i}`} style={{ color: '#475569', minWidth: 20 }}>#{e.seq}</span>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: TYPE_COLOR[e.type] ?? '#334155', color: '#fff', fontSize: 10, fontWeight: 700 }}>{e.type}</span>
            <code data-testid={`sr-agent-${i}`} style={{ color: '#a5b4fc' }}>{e.agent_id}</code>
            <span style={{ color: '#94a3b8', flex: 1 }}>{JSON.stringify(e.payload)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
