// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const TYPE_COLORS: Record<string, string> = {
  strategy: AMBER,
  backtest: BLUE,
  risk_run: RED,
  validation: GREEN,
  export: PURPLE,
  signal: ORANGE,
  order: GREEN,
};

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description: string;
  score?: number;
  created_at?: string;
  meta?: Record<string, string | number>;
}

interface CitationItem {
  id: string;
  title: string;
  source: string;
  snippet?: string;
  relevance?: number;
}

const ResultRow: React.FC<{
  result: SearchResult;
  idx: number;
  selected: boolean;
  onClick: () => void;
}> = ({ result, idx, selected, onClick }) => {
  const [hov, setHov] = React.useState(false);
  const col = TYPE_COLORS[result.type] || SUBTLE;
  return (
    <div
      data-testid={`search-result-${idx}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? '#1a2a1a' : hov ? '#161616' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        transition: 'background 0.12s',
      }}
    >
      <div style={{
        minWidth: 72,
        fontSize: 10,
        fontFamily: MONO,
        color: col,
        background: col + '22',
        border: `1px solid ${col}44`,
        borderRadius: 2,
        padding: '2px 5px',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 2,
      }}>
        {result.type}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.title}
        </div>
        <div style={{ fontSize: 11, color: SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.description}
        </div>
        {result.meta && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {Object.entries(result.meta).slice(0, 4).map(([k, v]) => (
              <span key={k} style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>
                <span style={{ color: '#444' }}>{k}:</span> <span style={{ color: TEXT }}>{String(v)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {result.score != null && (
        <div style={{ fontSize: 11, fontFamily: MONO, color: GREEN, minWidth: 38, textAlign: 'right', marginTop: 2 }}>
          {(result.score * 100).toFixed(0)}%
        </div>
      )}
      {result.created_at && (
        <div style={{ fontSize: 10, color: SUBTLE, minWidth: 60, textAlign: 'right', marginTop: 2 }}>
          {result.created_at.slice(0, 10)}
        </div>
      )}
    </div>
  );
};

const CitationRow: React.FC<{ item: CitationItem; idx: number }> = ({ item, idx }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 10px',
        borderBottom: `1px solid ${BORDER}`,
        background: hov ? '#161616' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: AMBER, fontFamily: MONO }}>[{idx + 1}]</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>{item.source}</span>
      </div>
      <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{item.title}</div>
      {item.snippet && (
        <div style={{ fontSize: 11, color: SUBTLE, fontStyle: 'italic' }}>{item.snippet}</div>
      )}
      {item.relevance != null && (
        <div style={{ fontSize: 10, fontFamily: MONO, color: GREEN, marginTop: 3 }}>
          rel: {(item.relevance * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
};

/**
 * Bloomberg SS — Semantic Search Panel
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api/v1';

const RECENT_SEARCHES_KEY = 'apex_recent_searches';
const ALL_TYPES = ['all', 'strategy', 'backtest', 'risk_run', 'validation', 'export', 'signal', 'order'];

const loadRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { return []; }
};
const saveRecent = (q: string) => {
  try {
    const prev = loadRecent().filter(x => x !== q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([q, ...prev].slice(0, 10)));
  } catch { /* ignore */ }
};

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'title'>('score');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);
  const [showRecent, setShowRecent] = useState(false);
  const [citationsTab, setCitationsTab] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedResult(null); setShowRecent(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    setSelectedResult(null);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/search/query?q=${encodeURIComponent(query)}`),
        fetch(`${API_BASE}/citations/`),
      ]);
      const rData = rRes.ok ? await rRes.json() : [];
      const cData = cRes.ok ? await cRes.json() : [];
      setResults(Array.isArray(rData) ? rData : rData.results || []);
      setCitations(Array.isArray(cData) ? cData : cData.items || []);
      saveRecent(query.trim());
      setRecentSearches(loadRecent());
    } catch {
      setResults([]);
      setCitations([]);
    } finally {
      setLoading(false);
      setSearched(true);
      setShowRecent(false);
    }
  }, [query]);

  const filteredResults = results
    .filter(r => typeFilter === 'all' || r.type === typeFilter)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'date') return (b.created_at || '').localeCompare(a.created_at || '');
      return a.title.localeCompare(b.title);
    });

  const typeCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      data-testid="search-panel"
      data-ready="true"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>SS</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>SEMANTIC SEARCH</span>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: SUBTLE }}>
          <span style={{ border: `1px solid ${BORDER}`, borderRadius: 3, padding: '1px 5px', marginRight: 4 }}>Ctrl+K</span>
          focus
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            data-testid="search-query"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowRecent(true); }}
            onKeyDown={e => { if (e.key === 'Enter') doSearch(); if (e.key === 'Escape') setShowRecent(false); }}
            onFocus={() => setShowRecent(true)}
            placeholder="Search strategies, backtests, signals, orders... (Enter)"
            style={{
              flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 3,
              padding: '7px 10px', color: TEXT, fontFamily: MONO, fontSize: 13, outline: 'none',
            }}
          />
          <button
            data-testid="search-submit"
            onClick={doSearch}
            style={{
              background: AMBER, border: 'none', borderRadius: 3, padding: '7px 16px',
              color: BG, fontFamily: MONO, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
            }}
          >
            SEARCH
          </button>
          {searched && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); setSelectedResult(null); }}
              style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '7px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 12, cursor: 'pointer' }}
            >
              CLR
            </button>
          )}
        </div>
        {showRecent && recentSearches.length > 0 && !loading && (
          <div style={{
            position: 'absolute', top: 52, left: 14, right: 14, background: PANEL,
            border: `1px solid ${BORDER}`, borderRadius: 3, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          }}>
            <div style={{ padding: '5px 10px', fontSize: 10, color: SUBTLE, borderBottom: `1px solid ${BORDER}` }}>RECENT</div>
            {recentSearches.slice(0, 6).map((r, i) => (
              <div
                key={i}
                onClick={() => { setQuery(r); setShowRecent(false); }}
                style={{ padding: '7px 12px', fontSize: 12, color: TEXT, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}
                onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {r}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter/Sort bar */}
      {searched && (
        <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {ALL_TYPES.map(t => {
            const cnt = t === 'all' ? results.length : (typeCounts[t] || 0);
            const active = typeFilter === t;
            const col = t === 'all' ? TEXT : (TYPE_COLORS[t] || SUBTLE);
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  background: active ? col + '22' : 'transparent',
                  border: `1px solid ${active ? col : BORDER}`,
                  borderRadius: 2, padding: '2px 8px', color: active ? col : SUBTLE,
                  fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
                }}
              >
                {t} {cnt > 0 && <span style={{ opacity: 0.7 }}>({cnt})</span>}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: SUBTLE }}>SORT:</span>
            {(['score', 'date', 'title'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                background: sortBy === s ? '#222' : 'transparent',
                border: `1px solid ${sortBy === s ? AMBER : BORDER}`,
                borderRadius: 2, padding: '2px 7px', color: sortBy === s ? AMBER : SUBTLE,
                fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase',
              }}>{s}</button>
            ))}
            <button onClick={() => setCitationsTab(c => !c)} style={{
              background: citationsTab ? AMBER + '22' : 'transparent',
              border: `1px solid ${citationsTab ? AMBER : BORDER}`,
              borderRadius: 2, padding: '2px 7px', color: citationsTab ? AMBER : SUBTLE,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer', marginLeft: 8,
            }}>CITE ({citations.length})</button>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selectedResult ? '0 0 55%' : '1 1 auto', overflow: 'auto', borderRight: selectedResult ? `1px solid ${BORDER}` : 'none' }}>
          {loading && (
            <div data-testid="search-loading" style={{ padding: 24, textAlign: 'center', color: AMBER, fontFamily: MONO, fontSize: 13, letterSpacing: 2 }}>
              SEARCHING...
            </div>
          )}
          {!loading && searched && !citationsTab && filteredResults.length === 0 && (
            <div data-testid="search-empty" style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
              No results found for "{query}"
            </div>
          )}
          {!loading && !citationsTab && filteredResults.map((r, i) => (
            <ResultRow
              key={r.id || i}
              result={r}
              idx={i}
              selected={selectedResult?.id === r.id}
              onClick={() => setSelectedResult(prev => prev?.id === r.id ? null : r)}
            />
          ))}
          {!loading && citationsTab && (
            <>
              {citations.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>No citations available</div>
              )}
              {citations.map((c, i) => <CitationRow key={c.id || i} item={c} idx={i} />)}
            </>
          )}
          {!loading && !searched && (
            <div style={{ padding: 40, textAlign: 'center', color: SUBTLE }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>SS</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Enter a search query above</div>
              <div style={{ fontSize: 11, color: '#333' }}>Search across strategies, backtests, risk runs,<br />signals, orders and more</div>
            </div>
          )}
          <div data-testid="search-panel-ready" />
        </div>

        {selectedResult && (
          <div style={{ flex: '0 0 45%', overflow: 'auto', background: PANEL, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: TYPE_COLORS[selectedResult.type] || SUBTLE, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  {selectedResult.type}
                </div>
                <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{selectedResult.title}</div>
              </div>
              <button onClick={() => setSelectedResult(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 16, lineHeight: 1.6 }}>{selectedResult.description}</div>
            {selectedResult.score != null && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4, letterSpacing: 1 }}>RELEVANCE SCORE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: BORDER, borderRadius: 2 }}>
                    <div style={{ width: `${(selectedResult.score * 100).toFixed(0)}%`, height: '100%', background: GREEN, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: GREEN }}>{(selectedResult.score * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
            {selectedResult.created_at && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 4, letterSpacing: 1 }}>CREATED</div>
                <div style={{ fontSize: 12, fontFamily: MONO, color: TEXT }}>{selectedResult.created_at}</div>
              </div>
            )}
            {selectedResult.meta && Object.keys(selectedResult.meta).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 8, letterSpacing: 1 }}>METADATA</div>
                <div style={{ background: BG, borderRadius: 3, padding: 10 }}>
                  {Object.entries(selectedResult.meta).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontFamily: MONO }}>
                      <span style={{ color: SUBTLE }}>{k}</span>
                      <span style={{ color: TEXT }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, padding: '7px 0', color: AMBER, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
                OPEN
              </button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '7px 0', color: SUBTLE, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
                COPY ID
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;
