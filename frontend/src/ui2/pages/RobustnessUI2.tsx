import { useSyncExternalStore, useState } from 'react';
import { evaluationStore } from '../stores/waves21_50Store';

function useEvaluation() {
  return useSyncExternalStore(evaluationStore.subscribe, evaluationStore.getState);
}

export function RobustnessUI2() {
  const { robustness, overfit, loading, error } = useEvaluation();
  const [symbols, setSymbols] = useState('AAPL');

  const handleRobustness = () => {
    evaluationStore.runRobustness({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()) });
  };

  const handleOverfit = () => {
    evaluationStore.runOverfit({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()) });
  };

  return (
    <div data-testid="robustness-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Robustness & Overfit — Waves 36-37</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input data-testid="robust-symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="Symbols" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 180 }} />
        <button data-testid="robust-run-btn" onClick={handleRobustness} disabled={loading} style={{ background: loading ? '#64748b' : '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Testing...' : 'Stress Test'}
        </button>
        <button data-testid="overfit-run-btn" onClick={handleOverfit} disabled={loading} style={{ background: loading ? '#64748b' : '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          Overfit Check
        </button>
      </div>

      {robustness && (
        <div data-testid="robust-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Stress Test Results</h2>
          <div style={{ color: '#94a3b8' }}>Pass Rate: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{((robustness.pass_rate ?? 0) * 100).toFixed(0)}%</span></div>
          <div style={{ color: '#94a3b8' }}>Scenarios: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{robustness.total_scenarios ?? 0}</span></div>
        </div>
      )}

      {overfit && (
        <div data-testid="overfit-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Overfit Analysis</h2>
          <div style={{ color: '#94a3b8' }}>Grade: <span style={{ color: overfit.grade === 'A' ? '#22c55e' : '#f59e0b', fontWeight: 700, fontSize: 20 }}>{overfit.grade ?? '—'}</span></div>
          <div style={{ color: '#94a3b8' }}>PBO: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(overfit.pbo ?? 0).toFixed(3)}</span></div>
        </div>
      )}
    </div>
  );
}
