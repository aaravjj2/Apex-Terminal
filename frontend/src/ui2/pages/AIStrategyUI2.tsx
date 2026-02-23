import { useSyncExternalStore, useEffect } from 'react';
import { aiStrategyStore } from '../stores/waves11_20Store';

function useAIStrategy() {
  return useSyncExternalStore(aiStrategyStore.subscribe, aiStrategyStore.getState);
}

export function AIStrategyUI2() {
  const { specs, guardrails, sweeps, loading, error } = useAIStrategy();

  useEffect(() => {
    aiStrategyStore.fetchSpecs();
    aiStrategyStore.fetchSweeps();
  }, []);

  return (
    <div data-testid="ai-strategy-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>AI Strategy Builder</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Strategy Specs */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Strategy Specs ({specs.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {specs.map((s, i) => (
          <div key={i} data-testid={`spec-${i}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{s.name}</span>
              {s.ai_generated && <span style={{ background: '#6366f1', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>AI</span>}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{s.description}</div>
            <div style={{ marginTop: 8 }}>
              <button
                data-testid={`validate-${i}`}
                onClick={() => aiStrategyStore.validateSpec(s.spec_id)}
                style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
              >
                Validate
              </button>
            </div>
          </div>
        ))}
        {specs.length === 0 && <p style={{ color: '#94a3b8' }}>No specs created yet</p>}
      </div>

      {/* Guardrail Results */}
      {guardrails.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Guardrail Validation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {guardrails.map((g, i) => (
              <div key={i} data-testid={`guard-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', borderLeft: `4px solid ${g.status === 'pass' ? '#22c55e' : '#ef4444'}` }}>
                <span style={{ fontWeight: 600 }}>{g.rule_name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{g.message}</span>
                  <span style={{ color: g.status === 'pass' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{g.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sweeps */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Parameter Sweeps ({sweeps.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sweeps.map((s, i) => (
          <div key={i} data-testid={`sweep-${i}`} style={{ background: '#1e293b', padding: 14, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Job ID</span><div style={{ fontSize: 12 }}>{s.job_id.slice(0, 8)}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Spec</span><div style={{ fontSize: 12 }}>{s.spec_id.slice(0, 8)}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Status</span><div style={{ textTransform: 'uppercase', color: s.status === 'completed' ? '#22c55e' : '#f59e0b' }}>{s.status}</div></div>
            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Best Sharpe</span><div style={{ fontWeight: 700 }}>{s.best_sharpe.toFixed(2)}</div></div>
          </div>
        ))}
        {sweeps.length === 0 && <p style={{ color: '#94a3b8' }}>No sweeps run yet</p>}
      </div>
    </div>
  );
}
