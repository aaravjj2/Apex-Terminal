// RunsAuditView.tsx - Runs / Audit Log page (A2 requirement)
import React, { useState, useEffect } from 'react';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';

interface RunRecord {
  run_id: string;
  type: 'autopilot' | 'monitoring' | 'manual';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'warning' | 'failed';
  duration_ms: number | null;
  actions_taken: number;
  errors: number;
  summary: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  run_id: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

export const RunsAuditView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'runs' | 'audit'>('runs');
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [runsRes, auditRes] = await Promise.all([
        fetch('/api/v1/autopilot/runs'),
        fetch('/api/v1/autopilot/logs?limit=200')
      ]);

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData.runs || []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        const raw = (auditData.logs || auditData || []);
        const normalized = raw.map((e: any) => ({
          id: e.id || `${e.timestamp}-${e.event_type}`,
          timestamp: e.timestamp || e.created_at || new Date().toISOString(),
          run_id: e.run_id || null,
          event_type: e.event_type || e.event || 'event',
          severity: (e.severity || e.level || 'info'),
          message: e.message || e.msg || '',
          details: e.details || {},
        }));
        setAuditEvents(normalized);
      }
    } catch (err) {
      console.error('Failed to fetch runs/audit data:', err);
      // Mock data for development
      setRuns([
        {
          run_id: 'run_20260114_093000',
          type: 'autopilot',
          started_at: '2026-01-14T09:30:00Z',
          completed_at: '2026-01-14T09:30:45Z',
          status: 'success',
          duration_ms: 45000,
          actions_taken: 2,
          errors: 0,
          summary: 'Opened 1 PCS on SPY, closed 1 CCS on QQQ'
        },
        {
          run_id: 'run_20260114_100000',
          type: 'monitoring',
          started_at: '2026-01-14T10:00:00Z',
          completed_at: '2026-01-14T10:00:12Z',
          status: 'success',
          duration_ms: 12000,
          actions_taken: 0,
          errors: 0,
          summary: 'No exit conditions met'
        },
        {
          run_id: 'run_20260114_103000',
          type: 'autopilot',
          started_at: '2026-01-14T10:30:00Z',
          completed_at: '2026-01-14T10:30:38Z',
          status: 'warning',
          duration_ms: 38000,
          actions_taken: 1,
          errors: 1,
          summary: 'Partial fill on SPY order, retrying'
        },
        {
          run_id: 'run_20260114_110000',
          type: 'monitoring',
          started_at: '2026-01-14T11:00:00Z',
          completed_at: null,
          status: 'running',
          duration_ms: null,
          actions_taken: 0,
          errors: 0,
          summary: 'Checking exit conditions...'
        }
      ]);

      setAuditEvents([
        {
          id: 'evt_001',
          timestamp: '2026-01-14T09:30:00Z',
          run_id: 'run_20260114_093000',
          event_type: 'autopilot_started',
          severity: 'info',
          message: 'Autopilot cycle started',
          details: { trigger: 'scheduled' }
        },
        {
          id: 'evt_002',
          timestamp: '2026-01-14T09:30:15Z',
          run_id: 'run_20260114_093000',
          event_type: 'order_placed',
          severity: 'info',
          message: 'Order placed: PCS SPY 580/575 @ $1.25 credit',
          details: { symbol: 'SPY', strategy: 'PCS', client_order_id: 'pcs_spy_20260114_1' }
        },
        {
          id: 'evt_003',
          timestamp: '2026-01-14T09:30:18Z',
          run_id: 'run_20260114_093000',
          event_type: 'order_filled',
          severity: 'info',
          message: 'Order filled: PCS SPY @ $1.24 credit',
          details: { fill_price: 1.24, qty: 1 }
        },
        {
          id: 'evt_004',
          timestamp: '2026-01-14T09:30:30Z',
          run_id: 'run_20260114_093000',
          event_type: 'position_closed',
          severity: 'info',
          message: 'Position closed: CCS QQQ +$45 realized',
          details: { symbol: 'QQQ', pnl: 45 }
        },
        {
          id: 'evt_005',
          timestamp: '2026-01-14T10:30:20Z',
          run_id: 'run_20260114_103000',
          event_type: 'order_partial',
          severity: 'warning',
          message: 'Partial fill: SPY order 50% filled, retrying',
          details: { filled_qty: 1, total_qty: 2 }
        },
        {
          id: 'evt_006',
          timestamp: '2026-01-14T10:45:00Z',
          run_id: null,
          event_type: 'provider_degraded',
          severity: 'warning',
          message: 'Finnhub API rate limited, using cached data',
          details: { provider: 'finnhub', fallback: 'cache' }
        },
        {
          id: 'evt_007',
          timestamp: '2026-01-14T11:00:00Z',
          run_id: 'run_20260114_110000',
          event_type: 'monitoring_started',
          severity: 'info',
          message: 'Monitoring pass started',
          details: { positions_to_check: 3 }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = runs.filter(run => {
    if (typeFilter !== 'all' && run.type !== typeFilter) return false;
    if (statusFilter !== 'all' && run.status !== statusFilter) return false;
    if (searchQuery && !run.run_id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !run.summary.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredAuditEvents = auditEvents.filter(evt => {
    if (severityFilter !== 'all' && evt.severity !== severityFilter) return false;
    if (searchQuery && !evt.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !evt.event_type.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(evt.run_id || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      success: 'success',
      warning: 'warning',
      failed: 'error',
      running: 'default'
    };
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'text-text-secondary',
      warning: 'text-yellow-400',
      error: 'text-down',
      critical: 'text-red-600'
    };
    return (
      <span className={`text-xs font-medium ${colors[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 space-y-6 bg-surface min-h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Runs & Audit Log</h1>
          <p className="text-sm text-text-secondary mt-1">
            View autopilot execution history and system events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
          <Button variant="secondary" size="sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('runs')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'runs'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-secondary hover:text-text'
            }`}
        >
          Runs ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'audit'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-secondary hover:text-text'
            }`}
        >
          Audit Log ({auditEvents.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search runs, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50 w-64"
          />
        </div>

        {activeTab === 'runs' ? (
          <>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="all">All Types</option>
              <option value="autopilot">Autopilot</option>
              <option value="monitoring">Monitoring</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="all">All Statuses</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="failed">Failed</option>
            </select>
          </>
        ) : (
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : activeTab === 'runs' ? (
        /* Runs Table */
        <div className="bg-surface-elevated rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Errors</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRuns.map((run) => (
                <tr
                  key={run.run_id}
                  onClick={() => setSelectedRun(run)}
                  className="hover:bg-surface cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-brand">{run.run_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={run.type === 'autopilot' ? 'default' : run.type === 'monitoring' ? 'success' : 'warning'}>
                      {run.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-text">{formatTime(run.started_at)}</div>
                    <div className="text-xs text-text-secondary">{formatDate(run.started_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {run.status === 'running' ? (
                      <span className="text-brand animate-pulse">Running...</span>
                    ) : (
                      formatDuration(run.duration_ms)
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(run.status)}</td>
                  <td className="px-4 py-3 text-sm text-text">{run.actions_taken}</td>
                  <td className="px-4 py-3">
                    {run.errors > 0 ? (
                      <span className="text-down font-medium">{run.errors}</span>
                    ) : (
                      <span className="text-text-secondary">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
                    {run.summary}
                  </td>
                </tr>
              ))}
              {filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    No runs found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Audit Log */
        <div className="bg-surface-elevated rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Event Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAuditEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-text">{formatTime(evt.timestamp)}</div>
                    <div className="text-xs text-text-secondary">{formatDate(evt.timestamp)}</div>
                  </td>
                  <td className="px-4 py-3">{getSeverityBadge(evt.severity)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-text-secondary bg-surface px-2 py-1 rounded">
                      {evt.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {evt.run_id ? (
                      <button
                        onClick={() => {
                          setActiveTab('runs');
                          setSearchQuery(evt.run_id || '');
                        }}
                        className="font-mono text-xs text-brand hover:underline"
                      >
                        {evt.run_id}
                      </button>
                    ) : (
                      <span className="text-text-secondary text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">{evt.message}</td>
                </tr>
              ))}
              {filteredAuditEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    No audit events found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Run Details Drawer */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRun(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-[500px] bg-surface-elevated border-l border-border overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Run Details</h2>
                <button
                  onClick={() => setSelectedRun(null)}
                  className="p-2 hover:bg-surface rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-brand">{selectedRun.run_id}</span>
                  {getStatusBadge(selectedRun.status)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface p-3 rounded-lg">
                    <div className="text-xs text-text-secondary mb-1">Type</div>
                    <div className="text-sm text-text capitalize">{selectedRun.type}</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <div className="text-xs text-text-secondary mb-1">Duration</div>
                    <div className="text-sm text-text">{formatDuration(selectedRun.duration_ms)}</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <div className="text-xs text-text-secondary mb-1">Actions Taken</div>
                    <div className="text-sm text-text">{selectedRun.actions_taken}</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <div className="text-xs text-text-secondary mb-1">Errors</div>
                    <div className={`text-sm ${selectedRun.errors > 0 ? 'text-down' : 'text-text'}`}>
                      {selectedRun.errors}
                    </div>
                  </div>
                </div>

                <div className="bg-surface p-3 rounded-lg">
                  <div className="text-xs text-text-secondary mb-1">Summary</div>
                  <div className="text-sm text-text">{selectedRun.summary}</div>
                </div>

                <div className="bg-surface p-3 rounded-lg">
                  <div className="text-xs text-text-secondary mb-1">Timeline</div>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-up rounded-full"></div>
                      <span className="text-text-secondary">Started:</span>
                      <span className="text-text">{formatTime(selectedRun.started_at)}</span>
                    </div>
                    {selectedRun.completed_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-brand rounded-full"></div>
                        <span className="text-text-secondary">Completed:</span>
                        <span className="text-text">{formatTime(selectedRun.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Related Events */}
                <div>
                  <div className="text-sm font-medium text-text mb-2">Related Events</div>
                  <div className="space-y-2">
                    {auditEvents
                      .filter(evt => evt.run_id === selectedRun.run_id)
                      .map(evt => (
                        <div key={evt.id} className="bg-surface p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-text-secondary">{evt.event_type}</span>
                            {getSeverityBadge(evt.severity)}
                          </div>
                          <div className="text-sm text-text">{evt.message}</div>
                          <div className="text-xs text-text-secondary mt-1">{formatTime(evt.timestamp)}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunsAuditView;
