import { useSyncExternalStore, useState } from 'react';
import { evaluationStore } from '../stores/waves21_50Store';

function useEvaluation() {
  return useSyncExternalStore(evaluationStore.subscribe, evaluationStore.getState);
}

export function MonteCarloV2UI2() {
  const { monteCarlo, benchmark, portfolioSelect, loading, error } = useEvaluation();
  const [symbols, setSymbols] = useState('AAPL');
  const [nPaths, setNPaths] = useState('1000');

  const handleMC = () => {
    evaluationStore.runMonteCarlo({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()), n_paths: Number(nPaths) });
  };
  const handleBenchmark = () => {
    evaluationStore.runBenchmark({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()) });
  };
  const handlePortfolio = () => {
    evaluationStore.runPortfolioSelect({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()) });
  };

  return (
    <div data-testid="monte-carlo-v2-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Monte Carlo & Benchmark — Waves 38-40</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input data-testid="mc2-symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="Symbols" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 180 }} />
        <input data-testid="mc2-paths" value={nPaths} onChange={e => setNPaths(e.target.value)} placeholder="Paths" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 100 }} />
        <button data-testid="mc2-run-btn" onClick={handleMC} disabled={loading} style={{ background: loading ? '#64748b' : '#06b6d4', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Monte Carlo</button>
        <button data-testid="mc2-bench-btn" onClick={handleBenchmark} disabled={loading} style={{ background: loading ? '#64748b' : '#14b8a6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Benchmark</button>
        <button data-testid="mc2-portfolio-btn" onClick={handlePortfolio} disabled={loading} style={{ background: loading ? '#64748b' : '#a855f7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Portfolio Select</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {monteCarlo && (
          <div data-testid="mc2-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Monte Carlo Simulation</h2>
            <div style={{ color: '#94a3b8' }}>Paths: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{monteCarlo.n_paths ?? 0}</span></div>
            <div style={{ color: '#94a3b8' }}>VaR 95: <span style={{ color: '#ef4444', fontWeight: 600 }}>{((monteCarlo.var_95 ?? 0) * 100).toFixed(2)}%</span></div>
            <div style={{ color: '#94a3b8' }}>CVaR 95: <span style={{ color: '#ef4444', fontWeight: 600 }}>{((monteCarlo.cvar_95 ?? 0) * 100).toFixed(2)}%</span></div>
          </div>
        )}
        {benchmark && (
          <div data-testid="mc2-bench-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Benchmark Comparison</h2>
            <div style={{ color: '#94a3b8' }}>Alpha: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(benchmark.alpha ?? 0).toFixed(4)}</span></div>
            <div style={{ color: '#94a3b8' }}>Beta: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(benchmark.beta ?? 0).toFixed(4)}</span></div>
            <div style={{ color: '#94a3b8' }}>Information Ratio: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(benchmark.information_ratio ?? 0).toFixed(4)}</span></div>
          </div>
        )}
        {portfolioSelect && (
          <div data-testid="mc2-portfolio-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Portfolio Selection</h2>
            <div style={{ color: '#94a3b8' }}>Selected: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{portfolioSelect.selected?.length ?? 0} symbols</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
