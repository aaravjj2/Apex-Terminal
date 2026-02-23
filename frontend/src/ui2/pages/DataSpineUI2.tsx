import { useSyncExternalStore, useEffect, useState } from 'react';
import { dataSpineStore } from '../stores/waves11_20Store';

function useDataSpine() {
  return useSyncExternalStore(dataSpineStore.subscribe, dataSpineStore.getState);
}

export function DataSpineUI2() {
  const { universe, completeness, loading, error } = useDataSpine();
  const [ingestSymbol, setIngestSymbol] = useState('');

  useEffect(() => {
    dataSpineStore.fetchUniverse();
    dataSpineStore.fetchCompleteness();
  }, []);

  const handleIngest = () => {
    if (ingestSymbol.trim()) {
      dataSpineStore.ingestSymbol(ingestSymbol.trim().toUpperCase());
      setIngestSymbol('');
    }
  };

  return (
    <div data-testid="data-spine-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Data Spine — Online Ingestion</h1>
      {loading && <p>Ingesting...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input
          data-testid="ds-ingest-input"
          value={ingestSymbol}
          onChange={e => setIngestSymbol(e.target.value)}
          placeholder="Symbol (e.g. AAPL)"
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14 }}
        />
        <button
          data-testid="ds-ingest-btn"
          onClick={handleIngest}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          Ingest
        </button>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Universe ({universe.length} symbols)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 24 }}>
        {universe.map(sym => (
          <div key={sym} data-testid={`ds-sym-${sym}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
            {sym}
          </div>
        ))}
      </div>

      {Object.keys(completeness).length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Data Completeness</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(completeness).map(([key, val]) => (
              <div key={key} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{key}</span>
                <span style={{ color: '#94a3b8' }}>{JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
