import { useSyncExternalStore, useState } from 'react';
import { elasticV3Store } from '../stores/waves21_50Store';

function useElasticV3() {
  return useSyncExternalStore(elasticV3Store.subscribe, elasticV3Store.getState);
}

export function SearchV2UI2() {
  const { searchResult, savedQueries, loading, error } = useElasticV3();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState('apex-strategies');

  const handleSearch = () => {
    if (query.trim()) {
      elasticV3Store.search(query.trim(), index, true);
    }
  };

  const handleSave = () => {
    if (query.trim()) {
      elasticV3Store.saveQuery(`Query: ${query.substring(0, 30)}`, query, index);
    }
  };

  return (
    <div data-testid="search-v2-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Search v2 — Waves 48-49</h1>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input data-testid="s2-query" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search (e.g., type:crossover symbol:AAPL)" onKeyDown={e => e.key === 'Enter' && handleSearch()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', flex: 1, minWidth: 200 }} />
        <select data-testid="s2-index" value={index} onChange={e => setIndex(e.target.value)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0' }}>
          <option value="apex-strategies">Strategies</option>
          <option value="apex-trades">Trades</option>
          <option value="apex-runs">Runs</option>
        </select>
        <button data-testid="s2-search-btn" onClick={handleSearch} disabled={loading} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Search</button>
        <button data-testid="s2-save-btn" onClick={handleSave} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
      </div>

      {searchResult && (
        <div data-testid="s2-result" style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Results ({searchResult.total ?? 0} hits)</h2>
          {searchResult.facets?.map((f: any) => (
            <div key={f.field} style={{ marginBottom: 8 }}>
              <span style={{ color: '#94a3b8' }}>{f.field}: </span>
              {f.buckets?.map((b: any) => (
                <span key={b.key} style={{ color: '#e2e8f0', marginRight: 8, fontSize: 13 }}>{b.key} ({b.count})</span>
              ))}
            </div>
          ))}
          {searchResult.explain && (
            <pre style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(searchResult.explain, null, 2)}</pre>
          )}
        </div>
      )}

      {savedQueries.length > 0 && (
        <div data-testid="s2-saved" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Saved Queries ({savedQueries.length})</h2>
          {savedQueries.map((sq: any) => (
            <div key={sq.query_id} style={{ color: '#94a3b8', padding: '4px 0' }}>{sq.name} — {sq.query}</div>
          ))}
        </div>
      )}
    </div>
  );
}
