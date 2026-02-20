import { useSyncExternalStore, useEffect } from 'react';
import { killSwitchRecoveryStore } from '../stores/waveStores';

function useKillSwitchRecovery() {
  return useSyncExternalStore(killSwitchRecoveryStore.subscribe, killSwitchRecoveryStore.getState);
}

export function KillSwitchRecoveryUI2() {
  const { status, events, loading, error } = useKillSwitchRecovery();

  useEffect(() => {
    killSwitchRecoveryStore.fetchAll();
  }, []);

  const handleOverride = () => {
    if (confirm('Are you sure you want to manually override the kill switch?')) {
      killSwitchRecoveryStore.manualOverride();
      setTimeout(() => killSwitchRecoveryStore.fetchAll(), 500);
    }
  };

  return (
    <div data-testid="kill-switch-recovery-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Kill Switch Recovery</h1>
        <button
          data-testid="ks-override-btn"
          onClick={handleOverride}
          style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
        >
          Manual Override
        </button>
      </div>
      {loading && <p>Loading recovery status...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderLeft: `4px solid ${(status as any).active ? '#ef4444' : '#22c55e'}` }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Kill Switch</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (status as any).active ? '#ef4444' : '#22c55e' }}>
              {(status as any).active ? 'ACTIVE' : 'INACTIVE'}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Auto-Recovery</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (status as any).auto_recovery_enabled ? '#22c55e' : '#64748b' }}>
              {(status as any).auto_recovery_enabled ? 'ENABLED' : 'DISABLED'}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Recovery Time</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{(status as any).recovery_countdown_min ?? '—'} min</div>
          </div>
          <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Daily Activations</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{(status as any).daily_activations ?? 0} / {(status as any).max_daily ?? 5}</div>
          </div>
        </div>
      )}
      {events.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Recovery Events</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((e: any, i: number) => (
              <div key={i} data-testid={`ks-event-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{e.event_type?.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{e.reason}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#94a3b8' }}>
                  <div>{e.timestamp}</div>
                  <div style={{ fontWeight: 600, color: e.resolved ? '#22c55e' : '#f59e0b' }}>{e.resolved ? 'Resolved' : 'Pending'}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
