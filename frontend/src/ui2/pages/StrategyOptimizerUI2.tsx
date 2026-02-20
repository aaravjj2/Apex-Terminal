import { useSyncExternalStore, useEffect } from 'react';
import { strategyOptimizerStore } from '../stores/waveStores';

function useStrategyOptimizer() {
  return useSyncExternalStore(strategyOptimizerStore.subscribe, strategyOptimizerStore.getState);
}

export function StrategyOptimizerUI2() {
  const { strategies, hash, loading, error } = useStrategyOptimizer();
  useEffect(() => { strategyOptimizerStore.fetchAll(); }, []);

  return (
    <div data-testid="strategy-optimizer-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Strategy Optimizer</h1>
      {loading && <p data-testid="so-loading">Optimizing strategies...</p>}
      {error && <p data-testid="so-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && (
        <p data-testid="so-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Determinism hash: <code>{hash.slice(0, 16)}…</code>
        </p>
      )}
      <div data-testid="so-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Strategy','Score','Grade','MC VaR 95%','WF Robust','Entry Rank'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.map((s: any, i) => (
              <tr key={s.id} data-testid={`so-row-${i}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td data-testid={`so-name-${i}`} style={{ padding: '8px 12px' }}>{(s as any).name || (s as any).strategy_id}</td>
                <td data-testid={`so-score-${i}`} style={{ padding: '8px 12px', color: '#22c55e' }}>{(s.composite_score * 100).toFixed(0)}</td>
                <td data-testid={`so-grade-${i}`} style={{ padding: '8px 12px' }}>{s.grade}</td>
                <td style={{ padding: '8px 12px', color: '#ef4444' }}>{(s.mc_var_95 * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px' }}>{s.wf_robust ? '✓' : '✗'}</td>
                <td style={{ padding: '8px 12px' }}>{s.entry_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
