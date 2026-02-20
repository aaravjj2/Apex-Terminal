import { useSyncExternalStore, useEffect, useState } from 'react';
import { novaStore } from '../stores/waveStores';

function useNova() {
  return useSyncExternalStore(novaStore.subscribe, novaStore.getState);
}

export function NovaUI2() {
  const { response, status, loading, error } = useNova();
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    novaStore.fetchStatus();
  }, []);

  const handleGenerate = () => {
    if (prompt.trim()) {
      novaStore.generate(prompt);
    }
  };

  return (
    <div data-testid="nova-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Nova LLM Gateway</h1>
      {status && (
        <div data-testid="nova-status" style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
          <span>Mode: <strong style={{ color: '#e2e8f0' }}>{(status as any).mode}</strong></span>
          <span>Model: <strong style={{ color: '#e2e8f0' }}>{(status as any).model}</strong></span>
          <span>Available: <strong style={{ color: (status as any).available ? '#22c55e' : '#ef4444' }}>{(status as any).available ? 'Yes' : 'No'}</strong></span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <textarea
          data-testid="nova-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your trading analysis prompt..."
          rows={4}
          style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, resize: 'vertical' }}
        />
        <button
          data-testid="nova-generate-btn"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{ alignSelf: 'flex-start', padding: '10px 28px', background: loading ? '#475569' : '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {response && (
        <div data-testid="nova-response" style={{ background: '#1e293b', padding: 20, borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>
          {response}
        </div>
      )}
    </div>
  );
}
