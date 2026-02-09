/**
 * Cache Viewer Panel (v1.16)
 * 
 * LOCAL-only panel for viewing cache entries and manifests.
 * DEMO mode shows "Not available in DEMO mode" message.
 */

import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface CacheEntry {
  cache_key: string;
  request_type: string;
  params: Record<string, any>;
  checksum: string;
  captured_at: string;
}

interface CacheListResponse {
  mode: string;
  entries: CacheEntry[];
  total: number;
}

export function CacheViewerPanel() {
  const [response, setResponse] = useState<CacheListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  useEffect(() => {
    loadCacheEntries();
  }, []);

  const loadCacheEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/cache/entries`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ mode: 'DEMO', entries: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const copyChecksum = async (checksum: string, cache_key: string) => {
    try {
      await navigator.clipboard.writeText(checksum);
      setCopiedChecksum(cache_key);
      setTimeout(() => setCopiedChecksum(null), 2000);
    } catch (err) {
      console.error('Failed to copy checksum:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-4" data-testid="cache-viewer-loading">
        <div className="text-text-secondary">Loading cache entries...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-4" data-testid="cache-viewer-error">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!response) {
    return null;
  }

  // DEMO mode - no cache exposure
  if (response.mode === 'DEMO') {
    return (
      <div className="h-full flex flex-col bg-background p-4" data-testid="cache-viewer-demo">
        <h2 className="text-xl font-bold text-text mb-4">Cache Viewer</h2>
        <div className="bg-amber-100 border border-amber-300 rounded p-4 text-center" data-testid="cache-viewer-demo-message">
          <div className="text-amber-900 font-medium">Not available in DEMO mode</div>
          <div className="text-amber-700 text-sm mt-2">
            Cache inspection is only available in LOCAL mode to prevent vendor data exposure.
          </div>
        </div>
      </div>
    );
  }

  // LOCAL mode - show entries
  return (
    <div className="h-full flex flex-col bg-background" data-testid="cache-viewer-ready">
      <div className="border-b border-border px-4 py-3 bg-panel-bg">
        <h2 className="text-lg font-semibold text-text">Cache Viewer (LOCAL)</h2>
        <div className="text-sm text-text-secondary mt-1">
          {response.entries?.length || 0} {(response.entries?.length || 0) === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!response.entries || response.entries.length === 0 ? (
          <div className="bg-panel-bg border border-border rounded p-8 text-center" data-testid="cache-viewer-empty">
            <div className="text-text-secondary">No cache entries found</div>
            <div className="text-sm text-text-secondary/70 mt-2">
              Cache entries will appear here when replay artifacts are saved in LOCAL mode.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="cache-viewer-table">
              <thead>
                <tr className="bg-element-bg border-b border-border">
                  <th className="px-4 py-2 text-left text-sm font-medium text-text" data-testid="cache-table-header-cache-key">
                    Cache Key
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-text" data-testid="cache-table-header-type">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-text" data-testid="cache-table-header-params">
                    Params
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-text" data-testid="cache-table-header-checksum">
                    Checksum
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-text" data-testid="cache-table-header-captured">
                    Captured
                  </th>
                </tr>
              </thead>
              <tbody>
                {response.entries.map((entry, index) => (
                  <tr
                    key={entry.cache_key}
                    className="border-b border-border hover:bg-element-bg/50"
                    data-testid={`cache-entry-${index}`}
                  >
                    <td className="px-4 py-2 text-sm font-mono text-text" data-testid={`cache-entry-${index}-cache-key`}>
                      {entry.cache_key}
                    </td>
                    <td className="px-4 py-2 text-sm text-text" data-testid={`cache-entry-${index}-type`}>
                      {entry.request_type}
                    </td>
                    <td className="px-4 py-2 text-sm text-text-secondary" data-testid={`cache-entry-${index}-params`}>
                      <code className="text-xs">
                        {JSON.stringify(entry.params).substring(0, 80)}
                        {JSON.stringify(entry.params).length > 80 ? '...' : ''}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-sm" data-testid={`cache-entry-${index}-checksum`}>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-text-secondary">
                          {entry.checksum.substring(0, 12)}...
                        </code>
                        <button
                          onClick={() => copyChecksum(entry.checksum, entry.cache_key)}
                          data-testid={`copy-checksum-${index}`}
                          className="px-2 py-1 text-xs bg-element-bg border border-border rounded hover:bg-brand hover:border-brand hover:text-white transition-colors"
                        >
                          {copiedChecksum === entry.cache_key ? '✓' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-text-secondary" data-testid={`cache-entry-${index}-captured`}>
                      {new Date(entry.captured_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
