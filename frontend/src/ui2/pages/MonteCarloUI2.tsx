import { useSyncExternalStore, useEffect } from 'react';
import { monteCarloStore } from '../stores/waveStores';

function useMonteCarlo() {
  return useSyncExternalStore(monteCarloStore.subscribe, monteCarloStore.getState);
}

export function MonteCarloUI2() {
  const { result, loading, error } = useMonteCarlo();

  useEffect(() => {
    monteCarloStore.run({ symbol: 'SPY', initial_price: 450, days: 30, num_paths: 50, seed: 42 });
  }, []);

  return (
    <div data-testid="monte-carlo-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Monte Carlo Simulation</h1>
      {loading && <p>Running simulation...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div data-testid="mc-symbol" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Symbol</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{result.symbol}</div>
          </div>
          <div data-testid="mc-p5" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>5th Percentile</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>${result.percentile_5}</div>
          </div>
          <div data-testid="mc-p50" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Median</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>${result.percentile_50}</div>
          </div>
          <div data-testid="mc-p95" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>95th Percentile</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#22c55e' }}>${result.percentile_95}</div>
          </div>
          <div data-testid="mc-var" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>VaR (95%)</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#f59e0b' }}>${result.var_95}</div>
          </div>
          <div data-testid="mc-return" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Expected Return</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{result.expected_return}%</div>
          </div>
          <div data-testid="mc-drawdown" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Avg Max Drawdown</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>{result.max_drawdown_avg}%</div>
          </div>
          <div data-testid="mc-paths" style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Paths Simulated</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{result.paths?.length ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
