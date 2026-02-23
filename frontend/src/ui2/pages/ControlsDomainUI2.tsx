/**
 * Wave 106 - Controls Domain UI2
 * ES-first search for AP/AR and reconciliation controls with evidence graph.
 * Route: /ui2/controls-domain
 */

import { useState, useEffect, useCallback } from 'react';
import { PageShellUI2, type PageStatus } from '../components';

const API = 'http://localhost:8090/api/v3/controls';

interface ControlDoc {
  id: string;
  doc_type: string;
  reference?: string;
}

interface Edge {
  id: string;
  from_id: string;
  to_id: string;
  edge_type: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

function DocTypeChip({ type }: { type: string }) {
  const bg = type === 'ap-ar' ? '#1d4ed8' : '#7c3aed';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
      fontWeight: 600, color: '#fff', background: bg,
    }}>
      {type}
    </span>
  );
}

export function ControlsDomainUI2() {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<ControlDoc[]>([]);
  const [selected, setSelected]   = useState<ControlDoc | null>(null);
  const [edges, setEdges]         = useState<Edge[]>([]);
  const [status, setStatus]       = useState<PageStatus>('loading');
  const [errorMsg, setErrorMsg]   = useState<string | undefined>();

  const runSearch = useCallback(async (q: string) => {
    setStatus('loading');
    setErrorMsg(undefined);
    try {
      const res = await fetch(`${API}/controls/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      setResults(data.hits || []);
      setStatus('ready');
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => { runSearch(''); }, [runSearch]);

  const openEvidence = useCallback(async (doc: ControlDoc) => {
    setSelected(doc);
    try {
      const res = await fetch(`${API}/edges?from_id=${doc.id}`);
      if (!res.ok) throw new Error('Edges fetch failed');
      const data = await res.json();
      setEdges(data.edges || []);
    } catch {
      setEdges([]);
    }
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  }, [query, runSearch]);

  return (
    <PageShellUI2
      status={status}
      testId="controls-domain-page"
      errorMessage={errorMsg}
      emptyMessage="No controls found."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 data-testid="controls-domain-title"
              style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
            Controls Domain
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            ES-first BP/AR Reconciliation
          </span>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            data-testid="controls-search-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search controls (ES-first)..."
            aria-label="Search controls"
            style={{
              flex: 1, padding: '10px 14px',
              background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            data-testid="controls-search-btn"
            aria-label="Run control search"
            style={{
              padding: '10px 20px', background: 'var(--ui2-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px',
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div data-testid="controls-results-list"
               style={{
                 flex: 1, background: 'var(--ui2-bg-card)',
                 border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius)',
                 overflow: 'hidden',
               }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)',
                          fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              Results ({results.length})
            </div>
            {results.length === 0 ? (
              <div data-testid="controls-results-empty"
                   style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No results. Run a search above.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {results.map((doc) => (
                  <li
                    key={doc.id}
                    data-testid={`controls-result-${doc.id}`}
                    onClick={() => openEvidence(doc)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--ui2-border)',
                      background: selected?.id === doc.id ? 'var(--ui2-bg-hover)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}
                  >
                    <DocTypeChip type={doc.doc_type} />
                    <span style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                      {doc.id.slice(0, 8)}...
                    </span>
                    {doc.reference && (
                      <span style={{ fontSize: '13px', color: '#f1f5f9' }}>
                        {doc.reference}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-testid="controls-evidence-panel"
               style={{
                 width: '320px', background: 'var(--ui2-bg-card)',
                 border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius)',
                 overflow: 'hidden',
               }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)',
                          fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              Evidence / Edges
              {selected ? ` -- ${selected.id.slice(0, 8)}` : ''}
            </div>
            {!selected ? (
              <div style={{ padding: '32px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                Select a control to view linked events
              </div>
            ) : edges.length === 0 ? (
              <div data-testid="controls-evidence-empty"
                   style={{ padding: '32px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                No linked edges
              </div>
            ) : (
              <ul data-testid="controls-edges-list"
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {edges.map((edge) => (
                  <li key={edge.id}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
                      {edge.edge_type}
                    </div>
                    <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                      to: {edge.to_id.slice(0, 12)}...
                    </div>
                    {Object.keys(edge.metadata).length > 0 && (
                      <div style={{ color: '#64748b', marginTop: '4px', fontSize: '11px' }}>
                        {JSON.stringify(edge.metadata)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageShellUI2>
  );
}
