import { useSyncExternalStore, useEffect } from 'react';
import { scenarioSimStore } from '../stores/waveStores';

function useScenarioSim() {
  return useSyncExternalStore(scenarioSimStore.subscribe, scenarioSimStore.getState);
}

export function ScenarioSimUI2() {
  const { scenarios, hash, loading, error } = useScenarioSim();
  useEffect(() => { scenarioSimStore.fetchAll(); }, []);

  return (
    <div data-testid="scenario-sim-page" style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Scenario Simulation</h1>
      {loading && <p data-testid="ss-loading">Simulating scenarios...</p>}
      {error && <p data-testid="ss-error" style={{ color: '#ef4444' }}>{error}</p>}
      {hash && <p data-testid="ss-hash" style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Hash: {hash.slice(0, 16)}…</p>}
      <div data-testid="ss-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
        {scenarios.map((s: any, i) => (
          <div key={s.id} data-testid={`ss-card-${i}`} style={{ background: '#1e293b', borderRadius: 10, padding: 16 }}>
            <div data-testid={`ss-name-${i}`} style={{ fontWeight: 700, marginBottom: 8 }}>{s.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
              <div style={{ color: '#94a3b8' }}>Portfolio Return</div>
              <div data-testid={`ss-return-${i}`} style={{ color: s.portfolio_return >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {(s.portfolio_return * 100).toFixed(1)}%
              </div>
              <div style={{ color: '#94a3b8' }}>Max Drawdown</div>
              <div data-testid={`ss-dd-${i}`} style={{ color: '#ef4444' }}>{(s.max_drawdown * 100).toFixed(1)}%</div>
              <div style={{ color: '#94a3b8' }}>Sharpe</div>
              <div data-testid={`ss-sharpe-${i}`}>{s.sharpe.toFixed(2)}</div>
              <div style={{ color: '#94a3b8' }}>VaR 95%</div>
              <div style={{ color: '#f59e0b' }}>{(s.var_95 * 100).toFixed(1)}%</div>
              <div style={{ color: '#94a3b8' }}>Recession</div>
              <div>{s.recession ? '⚠ Yes' : 'No'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
