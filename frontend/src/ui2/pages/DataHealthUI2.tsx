import { useSyncExternalStore, useEffect } from 'react';
import { dataHealthStore } from '../stores/waves21_50Store';

function useDataHealth() {
  return useSyncExternalStore(dataHealthStore.subscribe, dataHealthStore.getState);
}

export function DataHealthUI2() {
  const { health, symbols, quality, loading, error } = useDataHealth();

  useEffect(() => { dataHealthStore.fetchHealth(); dataHealthStore.fetchSymbols(); }, []);

  return (
    <div data-testid="data-health-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Data Health — Waves 21-26</h1>
      {error && <p data-testid="data-health-error" style={{ color: '#ef4444' }}>{error}</p>}
      {loading && <p>Loading...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div data-testid="data-health-pipeline" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Pipeline Status</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{health ? 'Online' : 'Waiting'}</div>
        </div>
        <div data-testid="data-health-symbols" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Symbols Loaded</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{symbols.length}</div>
        </div>
        <div data-testid="data-health-quality" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Quality Grade</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: quality?.grade === 'A' ? '#22c55e' : '#f59e0b' }}>{quality?.grade || '—'}</div>
        </div>
      </div>

      {health && (
        <div data-testid="data-health-details" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Pipeline Details</h2>
          <pre style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'pre-wrap' }}>{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
