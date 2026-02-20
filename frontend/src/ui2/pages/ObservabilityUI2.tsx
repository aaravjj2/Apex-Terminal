import { useSyncExternalStore, useEffect } from 'react';
import { observabilityStore } from '../stores/waveStores';

function useObservability() {
  return useSyncExternalStore(observabilityStore.subscribe, observabilityStore.getState);
}

export function ObservabilityUI2() {
  const { metrics, performance, loading, error } = useObservability();

  useEffect(() => {
    observabilityStore.fetchAll();
  }, []);

  return (
    <div data-testid="observability-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Observability</h1>
      {loading && <p>Loading metrics...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {performance && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div data-testid="obs-rps" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Requests/sec</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{(performance as any).requests_per_second?.toFixed(1)}</div>
          </div>
          <div data-testid="obs-p50" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>P50 Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{(performance as any).p50_ms?.toFixed(0)}ms</div>
          </div>
          <div data-testid="obs-p95" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>P95 Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (performance as any).p95_ms > 200 ? '#f59e0b' : '#22c55e' }}>{(performance as any).p95_ms?.toFixed(0)}ms</div>
          </div>
          <div data-testid="obs-p99" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>P99 Latency</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (performance as any).p99_ms > 500 ? '#ef4444' : '#f59e0b' }}>{(performance as any).p99_ms?.toFixed(0)}ms</div>
          </div>
          <div data-testid="obs-errors" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Error Rate</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (performance as any).error_rate > 1 ? '#ef4444' : '#22c55e' }}>{(performance as any).error_rate?.toFixed(2)}%</div>
          </div>
          <div data-testid="obs-uptime" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Uptime</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{(performance as any).uptime_pct?.toFixed(2)}%</div>
          </div>
        </div>
      )}
      {metrics.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Metrics</h2>
          <table data-testid="obs-metrics-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8' }}>Name</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8' }}>Type</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>Value</th>
                <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8' }}>Labels</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: 8, fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: 8, color: '#94a3b8', fontSize: 13 }}>{m.type}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontFamily: 'monospace' }}>{m.value?.toFixed(2)}</td>
                  <td style={{ padding: 8, color: '#64748b', fontSize: 12 }}>
                    {m.labels && Object.entries(m.labels).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
