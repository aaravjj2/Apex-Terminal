import { useSyncExternalStore, useEffect } from 'react';
import { policySignalStore } from '../stores/waveStores';

function usePolicySignal() {
  return useSyncExternalStore(policySignalStore.subscribe, policySignalStore.getState);
}

const SIGNAL_COLOR: Record<string, string> = { bullish: '#22c55e', bearish: '#ef4444', neutral: '#94a3b8' };

export function PolicySignalUI2() {
  const { events, hash, loading, error } = usePolicySignal();
  useEffect(() => { policySignalStore.fetchAll(); }, []);

  return (
    <div data-testid="policy-signal-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Policy Signal Generator</h1>
      {loading && <p data-testid="ps-loading">Loading policy events...</p>}
      {error && <p data-testid="ps-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="ps-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="ps-event-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((e: any, i) => (
          <div key={e.id} data-testid={`ps-event-${i}`} style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <span data-testid={`ps-date-${i}`} style={{ fontSize: 11, color: '#64748b' }}>{e.date}</span>
              <span data-testid={`ps-source-${i}`} style={{ fontWeight: 700, fontSize: 12 }}>{e.source}</span>
              <span data-testid={`ps-signal-${i}`} style={{ marginLeft: 'auto', color: SIGNAL_COLOR[e.signal] ?? '#94a3b8', fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>
                ▲ {e.signal}
              </span>
            </div>
            <div data-testid={`ps-event-desc-${i}`} style={{ fontSize: 13 }}>{e.event}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
              <span>Asset: {e.asset_class}</span>
              <span>Strength: <strong style={{ color: '#f59e0b' }}>{(e.strength * 100).toFixed(0)}%</strong></span>
              <span>Confidence: {(e.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
