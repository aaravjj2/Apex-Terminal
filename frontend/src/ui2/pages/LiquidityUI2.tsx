import { useSyncExternalStore, useEffect } from 'react';
import { liquidityStore } from '../stores/waveStores';

function useLiquidity() {
  return useSyncExternalStore(liquidityStore.subscribe, liquidityStore.getState);
}

function scoreColor(n: number): string {
  if (n >= 80) return '#22c55e';
  if (n >= 60) return '#84cc16';
  if (n >= 40) return '#eab308';
  if (n >= 25) return '#f97316';
  return '#ef4444';
}

export function LiquidityUI2() {
  const { symbols, timeBuckets, grid, hash, loading, error } = useLiquidity();
  useEffect(() => { liquidityStore.fetchAll(); }, []);

  return (
    <div data-testid="liquidity-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Liquidity Heatmap</h1>
      {loading && <p data-testid="lq-loading">Loading heatmap...</p>}
      {error && <p data-testid="lq-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="lq-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="lq-heatmap" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 12px', color: '#94a3b8', textAlign: 'left' }}>Symbol</th>
              {timeBuckets.map(t => (
                <th key={t} style={{ padding: '6px 8px', color: '#64748b', fontWeight: 400, minWidth: 50 }}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym, ri) => (
              <tr key={sym} data-testid={`lq-row-${ri}`}>
                <td data-testid={`lq-sym-${ri}`} style={{ padding: '4px 12px', fontWeight: 700 }}>{sym}</td>
                {timeBuckets.map((t, ci) => {
                  const score = grid[sym]?.[t] ?? 0;
                  return (
                    <td key={t} data-testid={`lq-cell-${ri}-${ci}`}
                      style={{ padding: '4px 8px', background: scoreColor(score), color: '#fff', textAlign: 'center', borderRadius: 2, fontWeight: 600 }}>
                      {score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
