import { useSyncExternalStore, useEffect } from 'react';
import { walkForwardStore } from '../stores/waveStores';

function useWalkForward() {
  return useSyncExternalStore(walkForwardStore.subscribe, walkForwardStore.getState);
}

export function WalkForwardUI2() {
  const { result, loading, error } = useWalkForward();

  useEffect(() => {
    walkForwardStore.run({ strategy_id: 'momentum_v1', symbol: 'SPY', folds: 5 });
  }, []);

  return (
    <div data-testid="walk-forward-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Walk-Forward Analysis</h1>
      {loading && <p>Analyzing folds...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Strategy</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{result.strategy_id}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Avg IS Sharpe</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{result.avg_is_sharpe?.toFixed(3)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Avg OOS Sharpe</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{result.avg_oos_sharpe?.toFixed(3)}</div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Degradation</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: result.degradation_ratio > 0.5 ? '#ef4444' : '#22c55e' }}>
                {(result.degradation_ratio * 100)?.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Robust</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: result.robust ? '#22c55e' : '#ef4444' }}>
                {result.robust ? 'YES' : 'NO'}
              </div>
            </div>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Folds</h2>
          <table data-testid="wf-folds-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8' }}>Fold</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>IS Sharpe</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>OOS Sharpe</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>IS Return</th>
                <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8' }}>OOS Return</th>
              </tr>
            </thead>
            <tbody>
              {result.folds?.map((f) => (
                <tr key={f.fold_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: 8 }}>#{f.fold_id}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{f.in_sample_sharpe?.toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{f.out_sample_sharpe?.toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{f.in_sample_return_pct?.toFixed(2)}%</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{f.out_sample_return_pct?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
