import { useSyncExternalStore, useEffect } from 'react';
import { altDataStore } from '../stores/waveStores';

function useAltData() {
  return useSyncExternalStore(altDataStore.subscribe, altDataStore.getState);
}

const TIER_COLOR: Record<string, string> = { premium: '#a855f7', standard: '#0ea5e9', free: '#22c55e' };

export function AltDataUI2() {
  const { datasets, hash, loading, error } = useAltData();
  useEffect(() => { altDataStore.fetchAll(); }, []);

  return (
    <div data-testid="alt-data-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Alternative Data Catalog</h1>
      {loading && <p data-testid="ad-loading">Loading catalog...</p>}
      {error && <p data-testid="ad-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="ad-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="ad-catalog" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {datasets.map((d: any, i) => (
          <div key={d.id} data-testid={`ad-item-${i}`} style={{ background: '#1e293b', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: TIER_COLOR[d.price_tier] ?? '#334155', color: '#fff', fontWeight: 700 }}>{d.price_tier}</span>
            <div style={{ flex: 1 }}>
              <div data-testid={`ad-name-${i}`} style={{ fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{d.vendor} · {d.frequency} · {d.coverage} · lag {d.lag_days}d</div>
            </div>
            <span data-testid={`ad-category-${i}`} style={{ fontSize: 11, background: '#0f172a', padding: '2px 8px', borderRadius: 4 }}>{d.category}</span>
            <span data-testid={`ad-active-${i}`} style={{ fontSize: 11, color: d.active ? '#22c55e' : '#ef4444' }}>{d.active ? 'Active' : 'Inactive'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
