import { useSyncExternalStore, useEffect } from 'react';
import { anomaliesStore } from '../stores/waveStores';

function useAnomalies() {
  return useSyncExternalStore(anomaliesStore.subscribe, anomaliesStore.getState);
}

const SEVERITY_COLOR: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

export function AnomaliesUI2() {
  const { anomalies, hash, loading, error } = useAnomalies();
  useEffect(() => { anomaliesStore.fetchAll(); }, []);

  return (
    <div data-testid="anomalies-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Anomaly Detection</h1>
      {loading && <p data-testid="an-loading">Scanning for anomalies...</p>}
      {error && <p data-testid="an-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="an-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="an-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {anomalies.map((a: any, i) => (
          <div key={a.id} data-testid={`an-item-${i}`} style={{ background: '#1e293b', borderRadius: 8, padding: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
            <span data-testid={`an-severity-${i}`} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: SEVERITY_COLOR[a.severity] ?? '#64748b', color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>{a.severity}</span>
            <span data-testid={`an-symbol-${i}`} style={{ fontWeight: 600 }}>{a.symbol}</span>
            <span style={{ color: '#94a3b8', flex: 1 }}>{a.type}</span>
            <span data-testid={`an-zscore-${i}`} style={{ color: '#f59e0b' }}>z={a.z_score}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{a.resolved ? '✓ resolved' : '● active'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
