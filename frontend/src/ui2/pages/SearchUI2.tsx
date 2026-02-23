/**
 * SearchUI2 — Search Workspace (v1.143-v1.148 Wave 15)
 * Global search with v2 backend pipeline, filters, grouped results,
 * recent searches, deep linking, related entities, detail drawer.
 */

import { useSyncExternalStore, useEffect, useState, useCallback } from 'react';
// W103 sentinel type
type _PageReady = boolean;
import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge } from '../components';
import type { ColumnDef } from '../components';
import { searchStore, type DocumentType, type SearchResult, type RecentSearch } from '../stores/searchStore';
import { searchDepthStore } from '../stores/searchDepthStore';

function useSearch() {
  return useSyncExternalStore(searchStore.subscribe, searchStore.getState);
}

// Navigation targets by entity type
const NAV_MAP: Record<string, string> = {
  telemetry: '/ui2/health',
  orders: '/ui2/orders',
  order: '/ui2/orders',
  trade: '/ui2/orders',
  positions: '/ui2/portfolio',
  position: '/ui2/portfolio',
  workflows: '/ui2/workflow-builder',
  workflow: '/ui2/workflow-builder',
  strategies: '/ui2/research',
  strategy: '/ui2/research',
  backtest: '/ui2/backtest',
  incident: '/ui2/incidents',
  decision: '/ui2/decisions',
  report: '/ui2/runs',
};

export function SearchUI2() {
  const navigate = useNavigate();
  const [queryInput, setQueryInput] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [showRecent, setShowRecent] = useState(false);
  const {
    query, entityType, results, total, selectedResult, loading, error,
    groupCounts, selectedEntity, relatedEntities, recentSearches,
  } = useSearch();
  const entityTypes = searchStore.getEntityTypes();
  const depthState = useSyncExternalStore(searchDepthStore.subscribe, searchDepthStore.getSnapshot);
  const providerStatus = depthState.providerStatus;
  const [showMappings, setShowMappings] = useState(false);
  const [_pageReady, _setPageReady] = useState(false);
  useEffect(() => { _setPageReady(true); }, []);

  // Initial load — show all results
  useEffect(() => {
    if (results.length === 0 && !query) {
      searchStore.search('');
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!queryInput.trim()) return;
    setShowRecent(false);
    await searchStore.searchBackend(queryInput, entityType);
  }, [queryInput, entityType]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    searchStore.selectResult(result.id);
  }, []);

  const handleDeepLink = useCallback((result: SearchResult) => {
    const target = NAV_MAP[result.entity_type];
    if (target) navigate(target);
  }, [navigate]);

  const handleRecentClick = useCallback((recent: RecentSearch) => {
    setQueryInput(recent.query);
    setShowRecent(false);
    searchStore.search(recent.query);
  }, []);

  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      key: 'entity_type', label: 'Type', width: '10%',
      render: (_v, row) => {
        const r = row as unknown as SearchResult;
        const colors: Record<string, string> = {
          order: 'info', trade: 'success', position: 'working',
          strategy: 'warning', workflow: 'filled', decision: 'queued',
          incident: 'danger', report: 'neutral', backtest: 'info',
          telemetry: 'info',
        };
        return <StatusBadge variant={(colors[r.entity_type] || 'neutral') as any} testId={`search-type-${r.id}`}>{r.entity_type}</StatusBadge>;
      },
    },
    { key: 'title', label: 'Title', width: '28%' },
    { key: 'snippet', label: 'Details', width: '32%' },
    {
      key: 'symbol', label: 'Symbol', width: '10%',
      render: (v) => v ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ui2-accent)' }}>{String(v)}</span> : <span style={{ fontSize: 11, color: 'var(--ui2-text-muted)' }}>—</span>,
    },
    {
      key: 'score', label: 'Score', align: 'right' as const, width: '8%',
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{Number(v).toFixed(2)}</span>,
    },
  ];

  return (
    <>
    {!_pageReady && <div data-testid="page-loading" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    {_pageReady && <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    <div data-testid="search-ui2-page" data-ready="true" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto', padding: '0 4px' }}>
      <PageHeader title="Search" subtitle="Global search — orders, positions, strategies, workflows, decisions" badge="v1.148" />

      {/* Provider Status Bar */}
      <div data-testid="search-provider-status" style={{
        display: 'flex', gap: 16, alignItems: 'center', padding: '6px 12px',
        background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
        borderRadius: 'var(--ui2-radius-sm)', fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: providerStatus.health === 'green' ? '#22c55e' : providerStatus.health === 'yellow' ? '#f59e0b' : '#ef4444', display: 'inline-block' }} />
          <span data-testid="search-provider-backend" style={{ color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{providerStatus.active_backend}</span>
        </div>
        <span style={{ color: 'var(--ui2-text-muted)' }} data-testid="search-provider-docs">{providerStatus.doc_count} docs</span>
        <span style={{ color: 'var(--ui2-text-muted)' }} data-testid="search-provider-indexes">{providerStatus.index_count} indexes</span>
        <span style={{ color: 'var(--ui2-text-muted)', fontFamily: 'monospace', fontSize: 11 }} data-testid="search-provider-version">v{providerStatus.version}</span>
        <span style={{
          padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: providerStatus.is_reachable ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: providerStatus.is_reachable ? '#22c55e' : '#ef4444',
        }} data-testid="search-provider-reachable">{providerStatus.is_reachable ? 'REACHABLE' : 'OFFLINE'}</span>
        <button onClick={() => setShowMappings(!showMappings)} style={{
          marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ui2-accent)',
          cursor: 'pointer', fontSize: 11,
        }} data-testid="search-toggle-mappings">{showMappings ? 'Hide' : 'Show'} Mappings</button>
      </div>

      {/* Index Mappings */}
      {showMappings && (
        <div data-testid="search-mappings-panel" style={{
          padding: '10px 14px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
          borderRadius: 'var(--ui2-radius-sm)', fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: 8 }}>Index Mappings</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {depthState.mappings.map(m => (
              <div key={m.index_name} data-testid={`search-mapping-${m.index_name}`} style={{
                flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--ui2-radius-sm)', border: '1px solid var(--ui2-border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{m.index_name}</div>
                <div style={{ fontSize: 11, color: 'var(--ui2-text-muted)', marginBottom: 4 }}>{m.doc_count} docs</div>
                {m.fields.map(f => (
                  <div key={f.field_name} style={{ fontSize: 10, color: 'var(--ui2-text-secondary)', fontFamily: 'monospace', lineHeight: 1.6 }}>
                    {f.field_name}: <span style={{ color: 'var(--ui2-text-muted)' }}>{f.field_type}</span>
                    {f.analyzed && <span style={{ marginLeft: 4, color: 'var(--ui2-accent)', fontSize: 9 }}>[analyzed]</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div data-testid="search-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search across all entity types..."
            value={queryInput}
            onChange={e => {
              setQueryInput(e.target.value);
              searchStore.search(e.target.value);
              if (!e.target.value.trim()) setShowRecent(true);
            }}
            onFocus={() => { if (!queryInput.trim()) setShowRecent(true); }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%', padding: '8px 12px', fontSize: 14,
              background: 'var(--ui2-surface)', color: 'var(--ui2-text)',
              border: '1px solid var(--ui2-border)', borderRadius: 6, outline: 'none',
            }}
          />
          {/* Recent searches dropdown */}
          {showRecent && recentSearches.length > 0 && (
            <div data-testid="search-recent-dropdown" style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--ui2-surface)', border: '1px solid var(--ui2-border)',
              borderRadius: 6, marginTop: 4, maxHeight: 200, overflow: 'auto',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--ui2-text-muted)', borderBottom: '1px solid var(--ui2-border)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Recent Searches</span>
                <button data-testid="search-clear-recent" onClick={() => { searchStore.clearRecentSearches(); setShowRecent(false); }} style={{ background: 'none', border: 'none', color: 'var(--ui2-accent)', cursor: 'pointer', fontSize: 11 }}>Clear</button>
              </div>
              {recentSearches.map((r, i) => (
                <button
                  key={`${r.query}-${i}`}
                  data-testid={`search-recent-item-${i}`}
                  onClick={() => handleRecentClick(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                    background: 'transparent', border: 'none', color: 'var(--ui2-text)',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  <span>{r.query}</span>
                  <span style={{ float: 'right', fontSize: 11, color: 'var(--ui2-text-muted)' }}>{r.result_count} results</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Symbol filter */}
        <input
          data-testid="search-symbol-filter"
          type="text"
          placeholder="Symbol"
          value={symbolFilter}
          onChange={e => {
            setSymbolFilter(e.target.value.toUpperCase());
            searchStore.setFilters({ symbol: e.target.value.toUpperCase() });
          }}
          style={{
            width: 90, padding: '8px 10px', fontSize: 13,
            background: 'var(--ui2-surface)', color: 'var(--ui2-text)',
            border: '1px solid var(--ui2-border)', borderRadius: 6, outline: 'none',
            fontFamily: 'monospace',
          }}
        />
        <button
          data-testid="search-button"
          onClick={() => { setShowRecent(false); handleSearch(); }}
          disabled={!queryInput.trim() || loading}
          style={{
            padding: '8px 16px',
            background: loading ? 'var(--ui2-surface)' : 'var(--ui2-accent)',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        <span data-testid="search-count" style={{ fontSize: 12, color: 'var(--ui2-text-muted)', minWidth: 80 }}>
          {total} results
        </span>
      </div>

      {/* Entity type filter chips */}
      <div data-testid="search-filters" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {entityTypes.map(et => {
          const count = groupCounts[et] ?? 0;
          return (
            <button
              key={et}
              data-testid={`search-filter-${et}`}
              onClick={() => { searchStore.setEntityType(et as DocumentType); setShowRecent(false); }}
              style={{
                padding: '3px 10px', fontSize: 11, borderRadius: 12, cursor: 'pointer',
                background: et === entityType ? 'var(--ui2-accent)' : 'rgba(255,255,255,0.06)',
                color: et === entityType ? '#fff' : 'var(--ui2-text-muted)',
                border: `1px solid ${et === entityType ? 'var(--ui2-accent)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {et}{et !== 'all' && count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div data-testid="search-loading" style={{ padding: 20, textAlign: 'center', color: 'var(--ui2-text-muted)' }}>
          Searching...
        </div>
      )}

      {/* Error */}
      {error && (
        <div data-testid="search-error" style={{ padding: 20, background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: 6, color: 'var(--ui2-text)' }}>
          {error}
        </div>
      )}

      {/* Results + Detail */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Results table */}
          <div data-testid="search-results-panel" data-ready={results.length > 0 ? 'true' : 'false'} style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ui2-border)', fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
              Results ({total})
            </div>
            <DataTable
              testId="search-results-table"
              columns={columns}
              data={results as any}
              keyField="id"
              density="compact"
              onRowClick={handleResultClick as any}
              selectedRowKey={selectedResult || undefined}
            />
          </div>

          {/* Detail drawer */}
          {selectedEntity && (
            <div data-testid="search-detail-drawer" style={{
              flex: 1, background: 'var(--ui2-surface)', borderRadius: 6,
              border: '1px solid var(--ui2-border)', padding: 16, overflow: 'auto',
              maxWidth: 420,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 data-testid="search-detail-title" style={{ margin: 0, fontSize: 14, color: 'var(--ui2-text)' }}>{selectedEntity.title}</h4>
                <button
                  data-testid="search-detail-close"
                  onClick={() => searchStore.selectResult(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--ui2-text-muted)', cursor: 'pointer', fontSize: 16 }}
                >×</button>
              </div>

              <div data-testid="search-detail-type" style={{ marginBottom: 8 }}>
                <StatusBadge variant="info">{selectedEntity.entity_type}</StatusBadge>
                {selectedEntity.symbol && (
                  <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 13, color: 'var(--ui2-accent)' }}>{selectedEntity.symbol}</span>
                )}
              </div>

              <p data-testid="search-detail-snippet" style={{ fontSize: 12, color: 'var(--ui2-text-muted)', marginBottom: 12 }}>{selectedEntity.snippet}</p>
              <div data-testid="search-detail-id" style={{ fontSize: 11, color: 'var(--ui2-text-muted)', marginBottom: 4 }}>ID: {selectedEntity.id}</div>
              <div data-testid="search-detail-score" style={{ fontSize: 11, color: 'var(--ui2-text-muted)', marginBottom: 8 }}>Score: {selectedEntity.score.toFixed(2)}</div>

              {/* Deep link button */}
              <button
                data-testid="search-deep-link-btn"
                onClick={() => handleDeepLink(selectedEntity)}
                style={{
                  display: 'block', width: '100%', padding: '6px 12px', marginBottom: 12,
                  background: 'var(--ui2-accent)', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'center',
                }}
              >
                Open in {NAV_MAP[selectedEntity.entity_type]?.split('/').pop() || 'page'} →
              </button>

              {/* Data JSON */}
              <pre
                data-testid="search-detail-data"
                style={{
                  background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4,
                  fontSize: 11, maxHeight: 150, overflow: 'auto',
                  color: 'var(--ui2-text-muted)', fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(selectedEntity.data, null, 2)}
              </pre>

              {/* Related entities */}
              {relatedEntities.length > 0 && (
                <div data-testid="search-related-entities" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--ui2-text-muted)', marginBottom: 6 }}>Related Entities</div>
                  {relatedEntities.map(rel => (
                    <button
                      key={rel.id}
                      data-testid={`search-related-${rel.id}`}
                      onClick={() => searchStore.selectResult(rel.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4, marginBottom: 4, cursor: 'pointer', color: 'var(--ui2-text)',
                        fontSize: 12,
                      }}
                    >
                      <StatusBadge variant="neutral" testId={`search-related-type-${rel.id}`}>{rel.entity_type}</StatusBadge>
                      <span style={{ marginLeft: 6 }}>{rel.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Explain View — ranking factor breakdown */}
              {queryInput.trim() && (() => {
                const explain = searchDepthStore.getExplain(selectedEntity.id, queryInput);
                return (
                  <div data-testid="search-explain-panel" style={{ marginTop: 12, padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--ui2-radius-sm)', border: '1px solid var(--ui2-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ui2-text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Ranking Explain</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--ui2-text-secondary)' }} data-testid="search-explain-hash">{explain.explain_hash}</span>
                    </div>
                    <div data-testid="search-explain-score" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ui2-text-primary)', marginBottom: 8 }}>
                      Total: {explain.total_score.toFixed(2)}
                      <span style={{ fontSize: 10, color: 'var(--ui2-text-muted)', fontWeight: 400, marginLeft: 8 }}>via {explain.backend}</span>
                    </div>
                    {explain.factors.map((f, i) => (
                      <div key={f.factor} data-testid={`search-explain-factor-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
                        <span style={{ width: 60, fontFamily: 'monospace', color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{f.score.toFixed(2)}</span>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 2, height: 6 }}>
                          <div style={{ width: `${Math.min(f.score / f.weight * 100, 100)}%`, height: '100%', background: 'var(--ui2-accent)', borderRadius: 2 }} />
                        </div>
                        <span style={{ width: 120, color: 'var(--ui2-text-muted)' }}>{f.factor} (w={f.weight})</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div data-testid="search-ready" style={{ display: 'none' }}>ready</div>
    </div>
    </>
  );
}
