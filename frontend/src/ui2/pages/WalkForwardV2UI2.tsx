import { useSyncExternalStore, useState } from 'react';
import { evaluationStore } from '../stores/waves21_50Store';

function useEvaluation() {
  return useSyncExternalStore(evaluationStore.subscribe, evaluationStore.getState);
}

export function WalkForwardV2UI2() {
  const { walkForward, loading, error } = useEvaluation();
  const [symbols, setSymbols] = useState('AAPL');
  const [folds, setFolds] = useState('5');

  const handleRun = () => {
    evaluationStore.runWalkForward({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()), n_folds: Number(folds) });
  };

  return (
    <div data-testid="walk-forward-v2-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Walk-Forward Analysis — Wave 35</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input data-testid="wf2-symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="Symbols" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 180 }} />
        <input data-testid="wf2-folds" value={folds} onChange={e => setFolds(e.target.value)} placeholder="Folds" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 80 }} />
        <button data-testid="wf2-run-btn" onClick={handleRun} disabled={loading} style={{ background: loading ? '#64748b' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Analyzing...' : 'Run Walk-Forward'}
        </button>
      </div>

      {walkForward && (
        <div data-testid="wf2-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Walk-Forward Results</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><span style={{ color: '#94a3b8' }}>Folds: </span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{walkForward.n_folds ?? 0}</span></div>
            <div><span style={{ color: '#94a3b8' }}>Avg OOS Sharpe: </span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(walkForward.avg_oos_sharpe ?? 0).toFixed(3)}</span></div>
            <div><span style={{ color: '#94a3b8' }}>Degradation: </span><span style={{ color: (walkForward.degradation_ratio ?? 0) < 0.5 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{((walkForward.degradation_ratio ?? 0) * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
