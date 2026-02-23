import { useSyncExternalStore, useEffect, useState } from 'react';
import { productizationStore } from '../stores/waves11_20Store';

function useProductization() {
  return useSyncExternalStore(productizationStore.subscribe, productizationStore.getState);
}

export function ProductizationUI2() {
  const { universe, universeStats, profiles, activeProfile, backups, runbooks, releaseInfo, loading, error } = useProductization();
  const [tab, setTab] = useState<'universe' | 'profiles' | 'runbooks' | 'release'>('universe');

  useEffect(() => {
    productizationStore.fetchAll();
  }, []);

  const tabStyle = (t: string) => ({
    background: tab === t ? '#3b82f6' : '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer' as const,
    fontWeight: 600 as const,
    fontSize: 14,
  });

  return (
    <div data-testid="productization-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Productization — Ops Center</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button data-testid="tab-universe" onClick={() => setTab('universe')} style={tabStyle('universe')}>Universe</button>
        <button data-testid="tab-profiles" onClick={() => setTab('profiles')} style={tabStyle('profiles')}>Profiles</button>
        <button data-testid="tab-runbooks" onClick={() => setTab('runbooks')} style={tabStyle('runbooks')}>Runbooks</button>
        <button data-testid="tab-release" onClick={() => setTab('release')} style={tabStyle('release')}>Release</button>
      </div>

      {/* Universe Tab */}
      {tab === 'universe' && (
        <>
          {universeStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Total Symbols</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{universeStats.total_symbols}</div>
              </div>
              <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Enabled</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{universeStats.enabled_symbols}</div>
              </div>
              {Object.entries(universeStats.sectors || {}).map(([s, c]) => (
                <div key={s} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{s}</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{c as number}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {universe.map((u, i) => (
              <div key={i} data-testid={`uni-${u.symbol}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 80px', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{u.symbol}</div>
                <div style={{ color: '#94a3b8' }}>{u.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{u.sector}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>${u.market_cap_b.toFixed(1)}B</div>
                <button
                  onClick={() => productizationStore.toggleSymbol(u.symbol, !u.enabled)}
                  style={{ background: u.enabled ? '#22c55e' : '#64748b', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                >
                  {u.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Profiles Tab */}
      {tab === 'profiles' && (
        <>
          {activeProfile && (
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, borderLeft: '4px solid #22c55e', marginBottom: 16 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Active Profile</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{(activeProfile as any).name || 'Default'}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
            {profiles.map((p, i) => (
              <div key={i} data-testid={`profile-${i}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderLeft: `4px solid ${p.is_active ? '#22c55e' : '#334155'}` }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{p.profile_type}</div>
                {!p.is_active && (
                  <button
                    onClick={() => productizationStore.activateProfile(p.profile_id)}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Backups ({backups.length})</h3>
          <button
            data-testid="create-backup-btn"
            onClick={() => productizationStore.createBackup()}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}
          >
            Create Backup
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {backups.map((b, i) => (
              <div key={i} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{b.backup_type}</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>{b.created_at}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Runbooks Tab */}
      {tab === 'runbooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {runbooks.map((r, i) => (
            <div key={i} data-testid={`runbook-${i}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{r.title}</span>
                <span style={{ background: '#334155', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#94a3b8' }}>{r.category}</span>
              </div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {r.steps.map((s, si) => (
                  <li key={si} style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
          {runbooks.length === 0 && <p style={{ color: '#94a3b8' }}>No runbooks available</p>}
        </div>
      )}

      {/* Release Tab */}
      {tab === 'release' && releaseInfo && (
        <div style={{ background: '#1e293b', padding: 24, borderRadius: 8 }}>
          <pre style={{ fontSize: 13, color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(releaseInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
