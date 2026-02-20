import { useSyncExternalStore, useEffect } from 'react';
import { systemHealthStore } from '../stores/waveStores';
import type { ComponentHealth } from '../stores/waveStores';

function useSystemHealth() {
  return useSyncExternalStore(systemHealthStore.subscribe, systemHealthStore.getState);
}

function statusColor(s: string): string {
  switch (s) {
    case 'healthy': return '#22c55e';
    case 'degraded': return '#f59e0b';
    case 'unhealthy': return '#ef4444';
    default: return '#64748b';
  }
}

export function SystemHealthUI2() {
  const { report, components, loading, error } = useSystemHealth();

  useEffect(() => {
    systemHealthStore.fetchAll();
  }, []);

  return (
    <div data-testid="system-health-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>System Health</h1>
      {loading && <p>Checking systems...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderLeft: `4px solid ${statusColor((report as any).overall_status)}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Overall</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: statusColor((report as any).overall_status), textTransform: 'uppercase' }}>
              {(report as any).overall_status}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Healthy</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{(report as any).healthy_count}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Degraded</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{(report as any).degraded_count}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Uptime</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{(report as any).uptime_seconds ? `${Math.floor((report as any).uptime_seconds / 3600)}h` : '—'}</div>
          </div>
        </div>
      )}
      {components.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Components</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {components.map((c: ComponentHealth) => (
              <div key={c.name} data-testid={`health-${c.name}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderTop: `3px solid ${statusColor(c.status)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.name?.replace(/_/g, ' ')}</span>
                  <span style={{ color: statusColor(c.status), fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>{c.status}</span>
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Latency: {c.latency_ms?.toFixed(0)}ms</div>
                {c.details && Object.keys(c.details).length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    {Object.entries(c.details).slice(0, 3).map(([k, v]) => (
                      <div key={k}>{k}: {String(v)}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
