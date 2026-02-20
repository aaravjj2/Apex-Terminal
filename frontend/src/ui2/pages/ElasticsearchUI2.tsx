import { useSyncExternalStore, useEffect, useState } from 'react';
import { elasticsearchStore } from '../stores/waveStores';

function useElasticsearch() {
  return useSyncExternalStore(elasticsearchStore.subscribe, elasticsearchStore.getState);
}

export function ElasticsearchUI2() {
  const { hits, total, status, loading, error } = useElasticsearch();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    elasticsearchStore.fetchStatus();
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      elasticsearchStore.search(query);
      setSearched(true);
    }
  };

  return (
    <div data-testid="elasticsearch-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Elasticsearch Gateway</h1>
      {status && (
        <div data-testid="es-status" style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
          <span>Mode: <strong style={{ color: '#e2e8f0' }}>{(status as any).mode}</strong></span>
          <span>Cluster: <strong style={{ color: (status as any).cluster_status === 'green' ? '#22c55e' : '#f59e0b' }}>{(status as any).cluster_status}</strong></span>
          {(status as any).document_count != null && <span>Docs: {(status as any).document_count}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          data-testid="es-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search trades, logs, events..."
          style={{ flex: 1, padding: '10px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 14 }}
        />
        <button
          data-testid="es-search-btn"
          onClick={handleSearch}
          style={{ padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
        >
          Search
        </button>
      </div>
      {loading && <p>Searching...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {searched && !loading && (
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
          Found <strong>{total}</strong> results
        </div>
      )}
      {hits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hits.map((hit) => (
            <div key={hit.id} data-testid={`es-hit-${hit.id}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{hit.id}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>score: {hit.score?.toFixed(2)} | {hit.index}</span>
              </div>
              <pre style={{ fontSize: 12, color: '#94a3b8', margin: 0, overflow: 'auto', maxHeight: 120 }}>
                {JSON.stringify(hit.source, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
