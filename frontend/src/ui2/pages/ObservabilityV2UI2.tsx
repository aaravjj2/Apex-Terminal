import { useSyncExternalStore, useEffect } from 'react';
import { observabilityV2Store } from '../stores/waves11_20Store';

function useObservabilityV2() {
  return useSyncExternalStore(observabilityV2Store.subscribe, observabilityV2Store.getState);
}

export function ObservabilityV2UI2() {
  const { health, alerts, queryStats, ilm, loading, error } = useObservabilityV2();

  useEffect(() => {
    observabilityV2Store.fetchAll();
  }, []);

  const severityColor = (sev: string) => sev === 'critical' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#3b82f6';

  return (
    <div data-testid="observability-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Observability v2</h1>
      {loading && <p>Loading health data...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* System Health */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div data-testid="obs-status" style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${health.status === 'healthy' ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>System Status</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: health.status === 'healthy' ? '#22c55e' : '#ef4444', textTransform: 'uppercase' }}>{health.status}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Uptime</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{Math.floor(health.uptime_seconds / 3600)}h {Math.floor((health.uptime_seconds % 3600) / 60)}m</div>
          </div>
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: `4px solid ${health.es_connected ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Elasticsearch</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: health.es_connected ? '#22c55e' : '#ef4444' }}>{health.es_connected ? 'Connected' : 'Disconnected'}</div>
          </div>
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Errors (1h)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: health.error_count_1h > 0 ? '#ef4444' : '#22c55e' }}>{health.error_count_1h}</div>
          </div>
        </div>
      )}

      {/* Query Performance */}
      {queryStats && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Query Performance</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Total Queries</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{queryStats.total}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Avg (ms)</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{queryStats.avg_ms.toFixed(1)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>P95 (ms)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: queryStats.p95_ms > 5000 ? '#ef4444' : '#e2e8f0' }}>{queryStats.p95_ms.toFixed(1)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Error Rate</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: queryStats.error_rate > 0.05 ? '#ef4444' : '#22c55e' }}>{(queryStats.error_rate * 100).toFixed(1)}%</div>
            </div>
          </div>
        </>
      )}

      {/* Alerts */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Alerts ({alerts.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {alerts.map((a, i) => (
          <div key={i} data-testid={`alert-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, borderLeft: `4px solid ${severityColor(a.severity)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{a.message}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: severityColor(a.severity), fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{a.severity}</span>
              {!a.acknowledged && (
                <button
                  onClick={() => observabilityV2Store.ackAlert(a.alert_id)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                >
                  Ack
                </button>
              )}
              {a.acknowledged && <span style={{ color: '#22c55e', fontSize: 12 }}>Acked</span>}
            </div>
          </div>
        ))}
        {alerts.length === 0 && <p style={{ color: '#94a3b8' }}>No active alerts</p>}
      </div>

      {/* ILM */}
      {ilm && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>ILM Policies ({ilm.total_policies})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ilm.policies?.map((p: any, i: number) => (
              <div key={i} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{p.name || p.policy_name}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>{p.description || JSON.stringify(p)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
