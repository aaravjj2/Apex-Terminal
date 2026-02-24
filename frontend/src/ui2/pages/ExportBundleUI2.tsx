/**
 * Wave 108 — Export Bundle UI2
 * One-click judge bundle with manifest, ES templates, DB tables.
 * Route: /ui2/export-bundle
 */

import { useState, useCallback } from 'react';
import { PageShellUI2, type PageStatus } from '../components';

const API = '/api/v3/export';

interface BundleResult {
  filename: string;
  manifest: {
    version: string;
    files: Record<string, { sha256: string; size_bytes: number }>;
    bundle_hash: string;
  };
  file_sizes: Record<string, number>;
  created_at: number;
  status: string;
}

function HashBadge({ hash }: { hash: string }) {
  return (
    <code style={{
      fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace',
      background: 'rgba(148,163,184,0.1)', padding: '2px 6px', borderRadius: '4px',
    }}>
      {hash.slice(0, 16)}…
    </code>
  );
}

export function ExportBundleUI2() {
  const [status, setStatus]   = useState<PageStatus>('ready');
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [result, setResult]   = useState<BundleResult | null>(null);
  const [creating, setCreating] = useState(false);

  const handleExport = useCallback(async () => {
    setCreating(true);
    setErrorMsg(undefined);
    setStatus('loading');
    try {
      const res = await fetch(`${API}/bundle`, { method: 'POST' });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const data = await res.json();
      setResult(data);
      setStatus('ready');
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    } finally {
      setCreating(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    window.open(`${API}/bundle/download`, '_blank');
  }, []);

  const fileEntries = result
    ? Object.entries(result.manifest.files).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <PageShellUI2
      status={status}
      testId="export-bundle-page"
      errorMessage={errorMsg}
      emptyMessage="No export yet."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 data-testid="export-bundle-title"
              style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
            Export Bundle
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            Judge-grade reproducible artifacts
          </span>
        </div>

        {/* Export trigger */}
        <div data-testid="export-control-panel"
             style={{ background: 'var(--ui2-bg-card)', border: '1px solid var(--ui2-border)',
               borderRadius: 'var(--ui2-radius)', padding: '20px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>
            Create a reproducible judge bundle containing:
          </div>
          <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px' }}>
            <li>manifest.json — SHA256 hashes of all files</li>
            <li>es_templates.json — Elasticsearch index templates</li>
            <li>db_tables.json — Database table snapshots</li>
            <li>README.md — Reproduction instructions</li>
          </ul>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              data-testid="create-bundle-btn"
              onClick={handleExport}
              disabled={creating}
              aria-label="Create export bundle"
              style={{
                padding: '10px 20px', background: 'var(--ui2-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: creating ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '14px', opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? 'Creating…' : 'Create Bundle'}
            </button>
            {result && (
              <button
                data-testid="download-bundle-btn"
                onClick={handleDownload}
                aria-label="Download export bundle ZIP"
                style={{
                  padding: '10px 20px', background: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px',
                }}
              >
                Download ZIP
              </button>
            )}
          </div>
        </div>

        {/* Bundle result */}
        {result && (
          <div data-testid="bundle-result"
               style={{ background: 'var(--ui2-bg-card)', border: '1px solid var(--ui2-border)',
                 borderRadius: 'var(--ui2-radius)', padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                Bundle: {result.filename}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                Bundle hash: <HashBadge hash={result.manifest.bundle_hash} />
              </div>
            </div>

            <div data-testid="manifest-files-list"
                 style={{ border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                   overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                            borderBottom: '1px solid var(--ui2-border)', fontSize: '12px',
                            fontWeight: 600, color: '#64748b', display: 'grid',
                            gridTemplateColumns: '1fr 120px 140px' }}>
                <span>File</span>
                <span>Size</span>
                <span>SHA256</span>
              </div>
              {fileEntries.map(([name, info]) => (
                <div key={name}
                     data-testid={`manifest-file-${name.replace('.', '-')}`}
                     style={{ padding: '10px 12px', borderBottom: '1px solid var(--ui2-border)',
                               display: 'grid', gridTemplateColumns: '1fr 120px 140px',
                               fontSize: '13px', alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{name}</span>
                  <span style={{ color: '#64748b' }}>{(info.size_bytes / 1024).toFixed(1)} KB</span>
                  <HashBadge hash={info.sha256} />
                </div>
              ))}
            </div>

            <div data-testid="bundle-created-at"
                 style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
              Created: {new Date(result.created_at * 1000).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </PageShellUI2>
  );
}
