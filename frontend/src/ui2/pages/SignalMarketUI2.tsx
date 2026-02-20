import { useSyncExternalStore, useEffect } from 'react';
import { signalMarketStore } from '../stores/waveStores';

function useSignalMarket() {
  return useSyncExternalStore(signalMarketStore.subscribe, signalMarketStore.getState);
}

export function SignalMarketUI2() {
  const { signals, hash, loading, error } = useSignalMarket();
  useEffect(() => { signalMarketStore.fetchAll(); }, []);

  return (
    <div data-testid="signal-market-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Signal Marketplace</h1>
      {loading && <p data-testid="sm-loading">Loading signals...</p>}
      {error && <p data-testid="sm-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="sm-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="sm-listings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {signals.map((s: any, i) => (
          <div key={s.id} data-testid={`sm-card-${i}`} style={{ background: '#1e293b', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div data-testid={`sm-name-${i}`} style={{ fontWeight: 700 }}>{s.name}</div>
              <div style={{ color: s.price_usd === 0 ? '#22c55e' : '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                {s.price_usd === 0 ? 'Free' : `$${s.price_usd}/mo`}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>by {s.author} · {s.asset_class} · {s.type}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
              <div style={{ color: '#64748b' }}>Sharpe (3Y)</div>
              <div data-testid={`sm-sharpe-${i}`} style={{ color: '#22c55e' }}>{s.sharpe_3y}</div>
              <div style={{ color: '#64748b' }}>Win Rate</div>
              <div data-testid={`sm-winrate-${i}`}>{(s.win_rate * 100).toFixed(0)}%</div>
              <div style={{ color: '#64748b' }}>Subscribers</div>
              <div data-testid={`sm-subs-${i}`}>{s.subscribers}</div>
            </div>
            <button data-testid={`sm-subscribe-${i}`} style={{ marginTop: 10, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, width: '100%' }}>
              Subscribe
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
