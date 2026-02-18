/**
 * v1.48 — Data Quality Monitor Panel
 * DEMO-first data feed freshness/gaps/integrity viewer.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface DataFeed {
  id: string;
  name: string;
  type: string;
  status: string;
  latency_ms: number;
  last_update: string;
  gaps_24h: number;
  integrity_score: number;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-500/20 text-green-400',
  degraded: 'bg-yellow-500/20 text-yellow-400',
  stale: 'bg-red-500/20 text-red-400',
};

export function DataQualityPanel() {
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/data-quality`)
      .then(r => r.json())
      .then(data => setFeeds(Array.isArray(data) ? data : []))
      .catch(() => setFeeds([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="data-quality-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Data Quality Monitor</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.48 — DEMO</span>
      </div>

      {loading && (
        <div data-testid="data-quality-loading" className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && feeds.length === 0 && (
        <div data-testid="data-quality-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No data feeds configured</p>
        </div>
      )}

      {!loading && feeds.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {feeds.map((f, idx) => (
            <div key={f.id} data-testid={`feed-card-${idx}`} className="p-4 rounded-lg border border-border/50 bg-element-bg/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-text">{f.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[f.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {f.status}
                </span>
                <span className="text-[10px] text-text-muted ml-auto">{f.type}</span>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] text-text-muted">Latency</div>
                  <div className={`text-sm font-mono ${f.latency_ms > 1000 ? 'text-red-400' : f.latency_ms > 200 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {f.latency_ms}ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Gaps (24h)</div>
                  <div className={`text-sm font-mono ${f.gaps_24h > 5 ? 'text-red-400' : f.gaps_24h > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {f.gaps_24h}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Integrity</div>
                  <div className={`text-sm font-mono ${f.integrity_score >= 0.99 ? 'text-green-400' : f.integrity_score >= 0.95 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(f.integrity_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Last Update</div>
                  <div className="text-[10px] font-mono text-text-secondary">{f.last_update}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-testid="data-quality-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
