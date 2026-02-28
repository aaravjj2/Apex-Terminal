import { useSyncExternalStore, useEffect, useState, useCallback } from 'react';

const API = '/api/v1';

interface FeedReport {
  id: string;
  name: string;
  type: string;
  status: string;
  latency_ms: number;
  last_update: string | null;
  integrity_score: number;
  bar_count: number;
  provider: string | null;
  sha256: string | null;
}

interface ProviderEntry {
  name: string;
  mode: string;
  enabled: boolean;
  subsystem: string;
  metadata: Record<string, any>;
}

interface QualitySummary {
  total_feeds: number;
  healthy: number;
  degraded: number;
  no_data: number;
  avg_integrity: number;
}

function statusColor(s: string) {
  if (s === 'healthy') return '#22c55e';
  if (s === 'degraded') return '#f59e0b';
  if (s === 'no_data') return '#64748b';
  return '#ef4444';
}

export function DataHealthUI2() {
  const [feeds, setFeeds] = useState<FeedReport[]>([]);
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fRes, sRes, pRes] = await Promise.all([
        fetch(`${API}/data-quality`),
        fetch(`${API}/data-quality/summary`),
        fetch(`${API}/provider-registry/providers`),
      ]);
      setFeeds(await fRes.json());
      setSummary(await sRes.json());
      setProviders(await pRes.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load data health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div data-testid="data-health-ui2-page" data-ready="true" style={{ height: '100%', overflow: 'auto', padding: 24, color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Data Health — Market Pipeline</h1>
      {error && <p data-testid="data-health-error" style={{ color: '#ef4444' }}>{error}</p>}
      {loading && <p data-testid="data-health-loading">Loading...</p>}

      {/* ── Summary Cards ─────────────────────────────── */}
      <div data-testid="data-health-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div data-testid="data-health-pipeline" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Pipeline Status</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: providers.length > 0 ? '#22c55e' : '#f59e0b' }}>
            {providers.length > 0 ? 'Online' : 'No Providers'}
          </div>
        </div>
        <div data-testid="data-health-symbols" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Symbols Tracked</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary?.total_feeds ?? '—'}</div>
        </div>
        <div data-testid="data-health-quality" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Avg Integrity</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: (summary?.avg_integrity ?? 0) > 0.9 ? '#22c55e' : '#f59e0b' }}>
            {summary ? `${(summary.avg_integrity * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div data-testid="data-health-healthy-count" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Healthy / Total</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
            {summary ? `${summary.healthy} / ${summary.total_feeds}` : '—'}
          </div>
        </div>
      </div>

      {/* ── Providers ─────────────────────────────────── */}
      <div data-testid="data-health-providers" style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Registered Providers</h2>
        {providers.length === 0 ? (
          <p style={{ color: '#64748b' }}>No providers registered</p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {providers.map((p) => (
              <div key={p.name} data-testid={`provider-${p.name}`} style={{
                background: '#0f172a', padding: '10px 16px', borderRadius: 6,
                border: `1px solid ${p.enabled ? '#22c55e' : '#475569'}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: p.enabled ? '#22c55e' : '#64748b' }}>
                  {p.mode} • {p.enabled ? 'enabled' : 'disabled'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Per-Symbol Feed Table ──────────────────────── */}
      <div data-testid="data-health-details" style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Symbol Feed Status</h2>
        <table data-testid="data-health-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Symbol</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Status</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Bars</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Provider</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Integrity</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Last Update</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <tr key={f.id} data-testid={`feed-row-${f.id}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.name}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span data-testid={`feed-status-${f.id}`} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: statusColor(f.status) + '22', color: statusColor(f.status),
                  }}>
                    {f.status}
                  </span>
                </td>
                <td data-testid={`feed-bars-${f.id}`} style={{ padding: '8px 12px' }}>{f.bar_count.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{f.provider ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ color: f.integrity_score > 0.9 ? '#22c55e' : '#f59e0b' }}>
                    {(f.integrity_score * 100).toFixed(1)}%
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11 }}>
                  {f.last_update ? new Date(f.last_update).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>
                  {f.sha256 ? f.sha256.slice(0, 12) + '...' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
