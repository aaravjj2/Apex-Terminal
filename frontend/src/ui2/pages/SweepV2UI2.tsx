import { useSyncExternalStore, useState } from 'react';
import { evaluationStore } from '../stores/waves21_50Store';

function useEvaluation() {
  return useSyncExternalStore(evaluationStore.subscribe, evaluationStore.getState);
}

export function SweepV2UI2() {
  const { sweep, loading, error } = useEvaluation();
  const [symbols, setSymbols] = useState('AAPL');

  const handleRun = () => {
    evaluationStore.runSweep({ symbols: symbols.split(',').map(s => s.trim().toUpperCase()) });
  };

  return (
    <div data-testid="sweep-v2-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Parameter Sweep — Wave 34</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input data-testid="sweep-symbols" value={symbols} onChange={e => setSymbols(e.target.value)} placeholder="Symbols" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', width: 180 }} />
        <button data-testid="sweep-run-btn" onClick={handleRun} disabled={loading} style={{ background: loading ? '#64748b' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Sweeping...' : 'Run Sweep'}
        </button>
      </div>

      {sweep && (
        <div data-testid="sweep-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Sweep Results ({sweep.total_cells ?? 0} cells)</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Best Sharpe: {(sweep.best_sharpe ?? 0).toFixed(3)}</div>
          <pre style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(sweep.best_params ?? {}, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
