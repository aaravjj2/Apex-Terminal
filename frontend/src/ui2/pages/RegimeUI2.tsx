import { useSyncExternalStore, useEffect } from 'react';
import { regimeStore } from '../stores/waveStores';
import type { RegimeData } from '../stores/waveStores';

function useRegime() {
  return useSyncExternalStore(regimeStore.subscribe, regimeStore.getState);
}

function regimeColor(r: string): string {
  switch (r) {
    case 'bullish': return '#22c55e';
    case 'bearish': return '#ef4444';
    case 'volatile': return '#f59e0b';
    default: return '#64748b';
  }
}

export function RegimeUI2() {
  const { regimes, summary, loading, error } = useRegime();

  useEffect(() => {
    regimeStore.fetchAll();
  }, []);

  return (
    <div data-testid="regime-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Market Regime Detection</h1>
      {loading && <p>Detecting regimes...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {summary && (
        <div data-testid="regime-summary" style={{ background: '#1e293b', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Market Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {Object.entries(summary).map(([k, v]) => (
              <div key={k}>
                <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{typeof v === 'number' ? v : String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {regimes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {regimes.map((r: RegimeData) => (
            <div key={r.symbol} data-testid={`regime-${r.symbol}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderTop: `3px solid ${regimeColor(r.regime)}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{r.symbol}</div>
              <div style={{ color: regimeColor(r.regime), fontWeight: 600, textTransform: 'uppercase', fontSize: 13, marginBottom: 12 }}>{r.regime}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Confidence</div>
                  <div>{(r.confidence * 100)?.toFixed(0)}%</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>VIX Level</div>
                  <div>{r.vix_level?.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>IV Rank</div>
                  <div>{r.iv_rank?.toFixed(1)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
