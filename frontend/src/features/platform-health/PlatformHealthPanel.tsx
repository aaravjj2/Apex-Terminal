/**
 * v1.50 — Platform Health Dashboard Panel
 * DEMO-first component health, uptime, and metrics viewer.
 */
import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';

interface HealthComponent {
  id: string;
  name: string;
  status: string;
  uptime_pct: number;
  latency_p50_ms: number;
  latency_p99_ms: number;
  last_incident: string | null;
}

interface PlatformSummary {
  overall_status: string;
  total_components: number;
  operational: number;
  degraded: number;
  down: number;
  avg_uptime_pct: number;
  version: string;
  environment: string;
}

const statusColors: Record<string, string> = {
  operational: 'bg-green-500/20 text-green-400',
  degraded: 'bg-yellow-500/20 text-yellow-400',
  down: 'bg-red-500/20 text-red-400',
};

export function PlatformHealthPanel() {
  const [components, setComponents] = useState<HealthComponent[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/platform-health`).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/platform-health/summary`).then(r => r.json()),
    ])
      .then(([c, s]) => {
        setComponents(Array.isArray(c) ? c : []);
        setSummary(s);
      })
      .catch(() => { setComponents([]); setSummary(null); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="platform-health-panel" className="h-full flex flex-col bg-background p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-text">Platform Health</h2>
        <span className="text-xs text-text-muted bg-element-bg px-2 py-0.5 rounded">v1.50 — DEMO</span>
        {summary && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[summary.overall_status] || ''}`}>
            {summary.overall_status}
          </span>
        )}
      </div>

      {loading && (
        <div data-testid="platform-health-loading" className="animate-pulse space-y-3">
          <div className="h-20 bg-element-bg/50 rounded-lg" />
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && components.length === 0 && (
        <div data-testid="platform-health-empty" className="text-center py-12 text-text-muted">
          <p className="text-sm">No health data available</p>
        </div>
      )}

      {!loading && components.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Summary cards */}
          {summary && (
            <div data-testid="health-summary" className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Components</div>
                <div className="text-lg font-semibold text-text">{summary.total_components}</div>
              </div>
              <div className="p-3 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Operational</div>
                <div className="text-lg font-semibold text-green-400">{summary.operational}</div>
              </div>
              <div className="p-3 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Degraded</div>
                <div className="text-lg font-semibold text-yellow-400">{summary.degraded}</div>
              </div>
              <div className="p-3 bg-element-bg/30 rounded-lg text-center">
                <div className="text-xs text-text-muted">Avg Uptime</div>
                <div className="text-lg font-semibold text-text">{summary.avg_uptime_pct}%</div>
              </div>
            </div>
          )}

          {/* Version banner */}
          {summary && (
            <div data-testid="health-version" className="text-xs text-text-muted">
              v{summary.version} • {summary.environment}
            </div>
          )}

          {/* Component cards */}
          {components.map((c, idx) => (
            <div key={c.id} data-testid={`health-component-${idx}`} className="p-4 rounded-lg border border-border/50 bg-element-bg/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-text">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[c.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {c.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-text-muted">Uptime</span>
                  <div className="font-mono text-text">{c.uptime_pct}%</div>
                </div>
                <div>
                  <span className="text-text-muted">p50</span>
                  <div className="font-mono text-text">{c.latency_p50_ms}ms</div>
                </div>
                <div>
                  <span className="text-text-muted">p99</span>
                  <div className="font-mono text-text">{c.latency_p99_ms}ms</div>
                </div>
                <div>
                  <span className="text-text-muted">Last Incident</span>
                  <div className="font-mono text-text-secondary">{c.last_incident || 'None'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-testid="platform-health-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
