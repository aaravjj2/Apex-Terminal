/**
 * v1.53 — Platform Health Dashboard Panel
 * Professional component health, uptime, and metrics viewer.
 */
import { useState, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { API_BASE } from '../../config/api';
import { PageHeader } from '../../ui/PageHeader';
import { Badge } from '../../ui/Badge';

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
    <div data-testid="platform-health-panel" className="h-full flex flex-col bg-background overflow-hidden">
      {/* Professional PageHeader */}
      <PageHeader
        title="Platform Health"
        subtitle="Component status, uptime, and performance metrics"
        icon={<HeartPulse size={20} />}
        badge={summary ? (
          <Badge
            variant={summary.overall_status === 'operational' ? 'success' : summary.overall_status === 'degraded' ? 'warning' : 'error'}
            dot
          >
            {summary.overall_status}
          </Badge>
        ) : undefined}
        data-testid="platform-health-header"
      />

      <div className="flex-1 overflow-y-auto p-5">
      {loading && (
        <div data-testid="platform-health-loading" className="animate-pulse space-y-3">
          <div className="h-20 bg-element-bg/50 rounded-lg" />
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-element-bg/50 rounded-lg" />)}
        </div>
      )}

      {!loading && components.length === 0 && (
        <div data-testid="platform-health-empty" className="text-center py-16 text-text-muted">
          <HeartPulse size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No health data available</p>
          <p className="text-xs mt-1">Health telemetry will appear here when services report in</p>
        </div>
      )}

      {!loading && components.length > 0 && (
        <div className="space-y-5">
          {/* Summary cards */}
          {summary && (
            <div data-testid="health-summary" className="summary-grid cols-4">
              <div className="stat-card">
                <div className="stat-card-label">Components</div>
                <div className="stat-card-value">{summary.total_components}</div>
              </div>
              <div className="stat-card accent-success">
                <div className="stat-card-label">Operational</div>
                <div className="stat-card-value text-green-400">{summary.operational}</div>
              </div>
              <div className="stat-card accent-warning">
                <div className="stat-card-label">Degraded</div>
                <div className="stat-card-value text-yellow-400">{summary.degraded}</div>
              </div>
              <div className="stat-card accent-info">
                <div className="stat-card-label">Avg Uptime</div>
                <div className="stat-card-value">{summary.avg_uptime_pct}%</div>
              </div>
            </div>
          )}

          {/* Version banner */}
          {summary && (
            <div data-testid="health-version" className="flex items-center gap-2 text-xs text-text-muted px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand/50" />
              v{summary.version} • {summary.environment}
            </div>
          )}

          {/* Component cards */}
          <div className="space-y-3">
          {components.map((c, idx) => (
            <div key={c.id} data-testid={`health-component-${idx}`} className="health-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-text">{c.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${statusColors[c.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {c.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-text-muted block mb-0.5">Uptime</span>
                  <div className="font-mono font-medium text-text tabular-nums">{c.uptime_pct}%</div>
                </div>
                <div>
                  <span className="text-text-muted block mb-0.5">p50</span>
                  <div className="font-mono font-medium text-text tabular-nums">{c.latency_p50_ms}ms</div>
                </div>
                <div>
                  <span className="text-text-muted block mb-0.5">p99</span>
                  <div className="font-mono font-medium text-text tabular-nums">{c.latency_p99_ms}ms</div>
                </div>
                <div>
                  <span className="text-text-muted block mb-0.5">Last Incident</span>
                  <div className="font-mono text-text-secondary">{c.last_incident || 'None'}</div>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
      </div>

      <div data-testid="platform-health-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
