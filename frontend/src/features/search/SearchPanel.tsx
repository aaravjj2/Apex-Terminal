/**
 * v1.39 — Search Panel
 * DEMO-first search interface with deterministic results.
 */
import { useState, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { CitationsPanel, type CitationItem } from '../shared/CitationsPanel';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  summary: string;
  score: number;
  timestamp: string;
  metadata: Record<string, any>;
}

const typeColors: Record<string, string> = {
  strategy: 'bg-purple-500/20 text-purple-400',
  backtest: 'bg-blue-500/20 text-blue-400',
  risk_run: 'bg-red-500/20 text-red-400',
  validation: 'bg-green-500/20 text-green-400',
  export: 'bg-yellow-500/20 text-yellow-400',
};

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [searchRes, citRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/search/query?q=${encodeURIComponent(query)}`).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/citations/`).then(r => r.json()),
      ]);
      setResults(Array.isArray(searchRes) ? searchRes : []);
      setCitations(Array.isArray(citRes) ? citRes : []);
    } catch {
      setResults([]);
      setCitations([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  return (
    <div data-testid="search-panel" data-ready="true" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Search</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.39 — DEMO Index</span>
      </div>

      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <input
          data-testid="search-query"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search strategies, backtests, risk runs..."
          className="flex-1 bg-element-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-brand"
        />
        <button
          data-testid="search-submit"
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto space-y-3">
        {loading && (
          <div data-testid="search-loading" className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-element-bg/50 rounded-lg" />)}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div data-testid="search-empty" className="text-center py-8 text-text-muted text-sm">
            No results found for "{query}"
          </div>
        )}

        {!loading && results.map((r, idx) => (
          <div
            key={r.id}
            data-testid={`search-result-${idx}`}
            className="p-3 rounded-lg border border-border bg-panel-bg hover:border-brand/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[r.type] || 'bg-gray-500/20 text-gray-400'}`}>
                {r.type}
              </span>
              <span className="text-sm font-medium text-text flex-1">{r.title}</span>
              <span className="text-xs text-text-muted font-mono">{(r.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-text-secondary">{r.summary}</p>
          </div>
        ))}

        {/* Citations for search results */}
        {!loading && citations.length > 0 && searched && (
          <div className="mt-4">
            <CitationsPanel citations={citations} maxVisible={3} />
          </div>
        )}
      </div>

      {/* Ready marker */}
      <div data-testid="search-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
