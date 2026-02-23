import { useSyncExternalStore, useState } from 'react';
import { strategyV2Store } from '../stores/waves21_50Store';

function useStrategyV2() {
  return useSyncExternalStore(strategyV2Store.subscribe, strategyV2Store.getState);
}

export function StrategyBuilderV2UI2() {
  const { validation, aiAssist, candidates, loading, error } = useStrategyV2();
  const [name, setName] = useState('My Strategy');
  const [prompt, setPrompt] = useState('');
  const [universe, setUniverse] = useState('AAPL,MSFT');

  const handleValidate = () => {
    strategyV2Store.validateSpec({
      name,
      universe: universe.split(',').map(s => s.trim().toUpperCase()),
      signal_type: 'crossover',
      position_size_pct: 0.10,
    });
  };

  const handleAIAssist = () => {
    if (prompt.trim()) {
      strategyV2Store.aiAssistParse(prompt.trim());
    }
  };

  const handleGenCandidates = () => {
    strategyV2Store.generateCandidates({
      name,
      universe: universe.split(',').map(s => s.trim().toUpperCase()),
      signal_type: 'crossover',
      position_size_pct: 0.10,
    });
  };

  return (
    <div data-testid="strategy-builder-v2-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Strategy Builder v2 — Waves 41-43</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>Strategy Spec</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input data-testid="sb2-name" value={name} onChange={e => setName(e.target.value)} placeholder="Strategy Name" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0' }} />
            <input data-testid="sb2-universe" value={universe} onChange={e => setUniverse(e.target.value)} placeholder="Universe (comma-sep)" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-testid="sb2-validate-btn" onClick={handleValidate} disabled={loading} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Validate</button>
              <button data-testid="sb2-gen-btn" onClick={handleGenCandidates} disabled={loading} style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Generate Candidates</button>
            </div>
          </div>
          {validation && (
            <div data-testid="sb2-validation" style={{ marginTop: 12, color: validation.valid ? '#22c55e' : '#ef4444' }}>
              {validation.valid ? '✓ Valid' : `✗ ${validation.errors?.length || 0} errors`}
            </div>
          )}
        </div>

        <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>AI Assist</h2>
          <textarea data-testid="sb2-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your strategy in natural language..." rows={3} style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', resize: 'vertical' }} />
          <button data-testid="sb2-ai-btn" onClick={handleAIAssist} disabled={loading || !prompt.trim()} style={{ marginTop: 8, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Parse with AI</button>
          {aiAssist && (
            <div data-testid="sb2-ai-result" style={{ marginTop: 12 }}>
              <pre style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(aiAssist, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {candidates.length > 0 && (
        <div data-testid="sb2-candidates" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>Generated Candidates ({candidates.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {candidates.map((c: any, i: number) => (
              <div key={i} style={{ background: '#0f172a', padding: 12, borderRadius: 6, border: '1px solid #334155' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{c.name || `Candidate ${i + 1}`}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{c.signal_type || 'crossover'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
