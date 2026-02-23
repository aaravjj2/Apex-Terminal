/**
 * v1.92 — OpsUI2 Page (W92: Bulk Ingest + DLQ + Lag Metrics tab)
 * Platform Health Dashboard with real ES/WS/Broker/Template/Ingest data
 */

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Tabs, StatusBadge, DataTable, type ColumnDef } from '../components';

const API = 'http://localhost:8090';

// ── W91: ES Template health hook ───────────────────────────────────────────
interface EsTemplateRow {
  entity: string;
  template_name: string;
  template_exists: boolean;
  template_version: string | null;
  write_alias: string;
  read_alias: string;
  write_alias_ok: boolean;
  read_alias_ok: boolean;
}

function useEsTemplates() {
  const [rows, setRows] = useState<EsTemplateRow[]>([]);
  const [templatesHealthy, setTemplatesHealthy] = useState(false);
  const [aliasesHealthy, setAliasesHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/api/v3/ops/es/templates`).then(r => r.json());
      const templates: any[] = data.templates ?? [];
      const aliases: any[] = data.aliases ?? [];
      const aliasMap: Record<string, any> = {};
      for (const a of aliases) aliasMap[a.entity] = a;

      setRows(templates.map((t: any) => {
        const a = aliasMap[t.entity] ?? {};
        return {
          entity: t.entity,
          template_name: t.template_name,
          template_exists: t.exists,
          template_version: t.version,
          write_alias: a.write_alias ?? `apex-${t.entity}-write`,
          read_alias: a.read_alias ?? `apex-${t.entity}-read`,
          write_alias_ok: a.write_alias_exists === true,
          read_alias_ok: a.read_alias_exists === true,
        };
      }));
      setTemplatesHealthy(data.templates_healthy === true);
      setAliasesHealthy(data.aliases_healthy === true);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { rows, templatesHealthy, aliasesHealthy, loading, refresh };
}

// ── W92: Ingest / DLQ hook ─────────────────────────────────────────────────

interface DlqStat {
  entity: string;
  pending: number;
  total: number;
  drained: number;
}

interface LagMetric {
  entity: string;
  dlq_pending: number;
  es_count: number;
  lag: number;
}

function useIngestDlq() {
  const [dlqStats, setDlqStats] = useState<DlqStat[]>([]);
  const [lagMetrics, setLagMetrics] = useState<LagMetric[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dlqRes, lagRes] = await Promise.allSettled([
        fetch(`${API}/api/v3/ops/ingest/dlq`).then(r => r.json()),
        fetch(`${API}/api/v3/ops/ingest/lag`).then(r => r.json()),
      ]);
      if (dlqRes.status === 'fulfilled') {
        setDlqStats(dlqRes.value.stats ?? []);
        setTotalPending(dlqRes.value.total_pending ?? 0);
      }
      if (lagRes.status === 'fulfilled') {
        setLagMetrics(lagRes.value.metrics ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { dlqStats, lagMetrics, totalPending, loading, refresh };
}

// ── W88: Live service health hook ──────────────────────────────────────────

interface ServiceStatus {
  label: string;
  ready: boolean;
  detail: string;
  correlationId?: string;
  testId: string;
}

// ── W88: Live service health hook ──────────────────────────────────────────
function useOpsHealth() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, wsRes] = await Promise.allSettled([
        fetch(`${API}/api/v3/ops/health`).then(r => r.json()),
        fetch(`${API}/api/v3/ops/ws/health`).then(r => r.json()),
      ]);

      const health = healthRes.status === 'fulfilled' ? healthRes.value : null;
      const ws = wsRes.status === 'fulfilled' ? wsRes.value : null;

      const cid: string = health?.correlation_id ?? '';

      setServices([
        {
          label: 'Elasticsearch',
          ready: health?.dependencies?.elasticsearch?.connected === true,
          detail: health?.dependencies?.elasticsearch?.connected
            ? `Connected · ${health.dependencies.elasticsearch.cluster_name ?? 'apex-local'}`
            : 'Not connected',
          correlationId: cid,
          testId: 'ops-es-card',
        },
        {
          label: 'Broker',
          ready: health?.dependencies?.broker?.status === 'ACTIVE',
          detail: health?.dependencies?.broker?.status === 'ACTIVE'
            ? `Active · ${health.dependencies.broker.account_id ?? 'alpaca'}`
            : health?.dependencies?.broker?.status ?? 'Unknown',
          correlationId: cid,
          testId: 'ops-broker-card',
        },
        {
          label: 'WebSocket',
          ready: ws?.running === true,
          detail: ws?.running
            ? `Running · ${ws.active_clients ?? 0} clients · heartbeat ${ws.heartbeat_interval_s ?? 30}s`
            : 'Not running',
          correlationId: cid,
          testId: 'ops-ws-card',
        },
        {
          label: 'Jobs',
          ready: health?.ready === true,
          detail: health?.ready ? 'All systems nominal' : 'Degraded',
          correlationId: cid,
          testId: 'ops-jobs-card',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { services, loading, refresh };
}

interface HealthCheck {
  id: string;
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: string;
  lastCheck: string;
}

// Use real timestamps instead of DEMO_TIMESTAMP
const now = Date.now();

const HEALTH_CHECKS: HealthCheck[] = [
  { id: 'h-1', service: 'Backend API', status: 'healthy', latency: 12, uptime: '99.97%', lastCheck: new Date(now).toISOString() },
  { id: 'h-2', service: 'WebSocket Feed', status: 'healthy', latency: 3, uptime: '99.95%', lastCheck: new Date(now).toISOString() },
  { id: 'h-3', service: 'Demo Data Engine', status: 'healthy', latency: 1, uptime: '100.0%', lastCheck: new Date(now).toISOString() },
  { id: 'h-4', service: 'Replay Cache', status: 'healthy', latency: 5, uptime: '99.99%', lastCheck: new Date(now).toISOString() },
  { id: 'h-5', service: 'Strategy Validator', status: 'healthy', latency: 8, uptime: '99.90%', lastCheck: new Date(now).toISOString() },
];

const PLATFORM_INFO = {
  version: '1.83.0',
  buildHash: 'c686eab9',
  mode: 'DEMO',
  nodeEnv: 'production',
  uptime: '4d 12h 33m',
  lastDeploy: new Date(now - 86400000 * 4).toISOString().split('T')[0],
};

interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'investigating';
  createdAt: string;
}

const DEMO_INCIDENTS: Incident[] = [
  { id: 'inc-1', title: 'Elevated latency on WebSocket feed', severity: 'medium', status: 'resolved', createdAt: new Date(now - 86400000 * 2).toISOString().split('T')[0] },
  { id: 'inc-2', title: 'Scheduled maintenance window', severity: 'low', status: 'resolved', createdAt: new Date(now - 86400000 * 5).toISOString().split('T')[0] },
  { id: 'inc-3', title: 'Replay cache cold start delay', severity: 'low', status: 'resolved', createdAt: new Date(now - 86400000 * 7).toISOString().split('T')[0] },
];

export function OpsUI2() {
  const [activeTab, setActiveTab] = useState('health');
  const [_pageReady, _setPageReady] = useState(false);
  useEffect(() => { _setPageReady(true); }, []);
  const { services, loading, refresh } = useOpsHealth();
  const esTemplates = useEsTemplates();
  const ingestDlq = useIngestDlq();

  const healthColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'service', label: 'Service', width: '180px' },
    { key: 'status', label: 'Status', width: '100px', render: (_v: unknown, row: Record<string, unknown>) => {
      const st = row['status'] as string;
      const variant = st === 'healthy' ? 'success' : st === 'degraded' ? 'working' : 'danger';
      return <StatusBadge variant={variant} testId={`health-status-${row['id']}`}>{st.toUpperCase()}</StatusBadge>;
    }},
    { key: 'latency', label: 'Latency', width: '80px', render: (v: unknown) => `${v}ms` },
    { key: 'uptime', label: 'Uptime', width: '80px' },
    { key: 'lastCheck', label: 'Last Check', width: '200px', render: (v: unknown) => (v as string).replace('T', ' ').replace('Z', '') },
  ];

  const incidentColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', width: '70px' },
    { key: 'title', label: 'Title', width: '280px' },
    { key: 'severity', label: 'Severity', width: '80px', render: (_v: unknown, row: Record<string, unknown>) => {
      const sev = row['severity'] as string;
      const variant = sev === 'critical' ? 'danger' : sev === 'high' ? 'danger' : sev === 'medium' ? 'working' : 'neutral';
      return <StatusBadge variant={variant} testId={`incident-severity-${row['id']}`}>{sev}</StatusBadge>;
    }},
    { key: 'status', label: 'Status', width: '100px', render: (_v: unknown, row: Record<string, unknown>) => {
      const st = row['status'] as string;
      const variant = st === 'resolved' ? 'success' : st === 'investigating' ? 'working' : 'danger';
      return <StatusBadge variant={variant} testId={`incident-status-${row['id']}`}>{st}</StatusBadge>;
    }},
    { key: 'createdAt', label: 'Created', width: '120px' },
  ];

  return (
    <>
    {!_pageReady && <div data-testid="page-loading" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    {_pageReady && <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    <div data-testid="ops-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader title="Operations" subtitle="Platform health, incidents, and system info" icon="O" testId="ops-header" />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'health', label: 'Health Dashboard' },
            { id: 'incidents', label: 'Incidents' },
            { id: 'es-templates', label: 'ES Templates' },
            { id: 'ingest-dlq', label: 'Ingest & DLQ' },
            { id: 'about', label: 'About' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="ops-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'health' && (
          <div data-testid="ops-health-dashboard">
            {/* Live service cards — data-ready gated */}
            <div data-testid="ops-live-services" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Live Services
                <button
                  data-testid="ops-refresh-btn"
                  onClick={refresh}
                  style={{ fontSize: '11px', padding: '2px 8px', cursor: 'pointer', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: '4px', color: 'var(--ui2-text-muted)' }}
                >
                  Refresh
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {loading
                  ? [0,1,2,3].map(i => (
                    <div key={i} style={{ padding: '14px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)', minHeight: '90px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>Loading…</div>
                    </div>
                  ))
                  : services.map(svc => (
                    <div
                      key={svc.testId}
                      data-testid={svc.testId}
                      data-ready={svc.ready ? 'true' : 'false'}
                      style={{
                        padding: '14px', background: 'var(--ui2-bg-panel)',
                        border: `1px solid ${svc.ready ? 'var(--ui2-success)' : 'var(--ui2-error, #f44336)'}`,
                        borderRadius: 'var(--ui2-radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{svc.label}</span>
                        <StatusBadge
                          variant={svc.ready ? 'success' : 'danger'}
                          testId={`${svc.testId}-status`}
                        >
                          {svc.ready ? 'OK' : 'DOWN'}
                        </StatusBadge>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '8px' }}>{svc.detail}</div>
                      {svc.correlationId && (
                        <button
                          data-testid={`${svc.testId}-copy-cid`}
                          title={`correlation_id: ${svc.correlationId}`}
                          onClick={() => navigator.clipboard.writeText(svc.correlationId!)}
                          style={{
                            fontSize: '10px', padding: '2px 6px', cursor: 'pointer',
                            background: 'transparent', border: '1px solid var(--ui2-border)',
                            borderRadius: '3px', color: 'var(--ui2-text-muted)', fontFamily: 'monospace',
                          }}
                        >
                          copy cid
                        </button>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Summary cards */}
            <div data-testid="ops-health-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Services', value: String(services.length || HEALTH_CHECKS.length), status: services.every(s => s.ready) ? 'All Healthy' : 'Degraded' },
                { label: 'Avg Latency', value: `${Math.round(HEALTH_CHECKS.reduce((a, c) => a + c.latency, 0) / HEALTH_CHECKS.length)}ms`, status: 'Normal' },
                { label: 'Mode', value: PLATFORM_INFO.mode, status: 'Live' },
                { label: 'Uptime', value: PLATFORM_INFO.uptime, status: 'Stable' },
              ].map((card, i) => (
                <div key={i} data-testid={`ops-summary-${card.label.toLowerCase().replace(/\s+/g, '-')}`} style={{
                  padding: '14px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>{card.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{card.value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--ui2-success)', marginTop: '4px' }}>{card.status}</div>
                </div>
              ))}
            </div>

            <DataTable data={HEALTH_CHECKS as unknown as Record<string, unknown>[]} columns={healthColumns} keyField="id" testId="ops-health-table" />
          </div>
        )}

        {activeTab === 'incidents' && (
          <div data-testid="ops-incidents-panel">
            <DataTable data={DEMO_INCIDENTS as unknown as Record<string, unknown>[]} columns={incidentColumns} keyField="id" testId="ops-incidents-table" />
          </div>
        )}

        {activeTab === 'es-templates' && (
          <div data-testid="ops-es-templates-panel">
            {/* Header row with health summary + install button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div data-testid="ops-templates-healthy" data-ready={esTemplates.templatesHealthy ? 'true' : 'false'}>
                <StatusBadge variant={esTemplates.templatesHealthy ? 'success' : 'danger'} testId="ops-templates-status">
                  Templates: {esTemplates.templatesHealthy ? 'OK' : 'MISSING'}
                </StatusBadge>
              </div>
              <div data-testid="ops-aliases-healthy" data-ready={esTemplates.aliasesHealthy ? 'true' : 'false'}>
                <StatusBadge variant={esTemplates.aliasesHealthy ? 'success' : 'danger'} testId="ops-aliases-status">
                  Aliases: {esTemplates.aliasesHealthy ? 'OK' : 'MISSING'}
                </StatusBadge>
              </div>
              <button
                data-testid="ops-es-install-btn"
                onClick={async () => {
                  await fetch(`${API}/api/v3/ops/es/templates/install`, { method: 'POST' });
                  esTemplates.refresh();
                }}
                style={{ fontSize: '11px', padding: '3px 10px', cursor: 'pointer', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: '4px', color: 'var(--ui2-text-muted)' }}
              >
                Install / Re-apply Templates
              </button>
              <button
                data-testid="ops-es-templates-refresh"
                onClick={esTemplates.refresh}
                style={{ fontSize: '11px', padding: '3px 10px', cursor: 'pointer', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: '4px', color: 'var(--ui2-text-muted)' }}
              >
                Refresh
              </button>
            </div>

            {/* Template + alias table */}
            {esTemplates.loading ? (
              <div style={{ color: 'var(--ui2-text-muted)', fontSize: '12px' }}>Loading…</div>
            ) : (
              <div data-testid="ops-templates-table" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                      {['Entity', 'Template', 'Version', 'Write Alias', 'Read Alias'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--ui2-text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {esTemplates.rows.map(row => (
                      <tr key={row.entity} data-testid={`ops-template-row-${row.entity}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{row.entity}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <StatusBadge variant={row.template_exists ? 'success' : 'danger'} testId={`ops-template-${row.entity}`}>
                            {row.template_exists ? 'EXISTS' : 'MISSING'}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--ui2-text-muted)' }}>
                          {row.template_version ?? '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <StatusBadge variant={row.write_alias_ok ? 'success' : 'danger'} testId={`ops-walias-${row.entity}`}>
                            {row.write_alias_ok ? row.write_alias : 'MISSING'}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <StatusBadge variant={row.read_alias_ok ? 'success' : 'danger'} testId={`ops-ralias-${row.entity}`}>
                            {row.read_alias_ok ? row.read_alias : 'MISSING'}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ingest-dlq' && (
          <div data-testid="ops-ingest-dlq-panel">
            {/* Header row: health summary + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div data-testid="ops-dlq-pending-badge"
                data-ready={ingestDlq.totalPending === 0 ? 'true' : 'false'}
                style={{
                  padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                  background: ingestDlq.totalPending === 0
                    ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: ingestDlq.totalPending === 0 ? '#22c55e' : '#ef4444',
                }}>
                DLQ Pending: {ingestDlq.totalPending}
              </div>
              <button
                data-testid="ops-dlq-drain-btn"
                onClick={async () => {
                  await fetch(`${API}/api/v3/ops/ingest/dlq/drain`, { method: 'POST' });
                  ingestDlq.refresh();
                }}
                style={{
                  padding: '4px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  background: 'var(--ui2-accent)', color: 'var(--ui2-text-primary)',
                  border: 'none', cursor: 'pointer',
                }}>
                Drain All DLQ
              </button>
              <button
                data-testid="ops-ingest-dlq-refresh"
                onClick={ingestDlq.refresh}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                  background: 'var(--ui2-bg-secondary)', color: 'var(--ui2-text-muted)',
                  border: '1px solid var(--ui2-border)', cursor: 'pointer',
                }}>
                Refresh
              </button>
            </div>

            {/* DLQ Stats Table */}
            <div style={{
              background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)', marginBottom: '20px',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)', fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                DLQ Stats
              </div>
              <div data-testid="ops-dlq-stats-table" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--ui2-bg-secondary)' }}>
                      {['Entity', 'Pending', 'Drained', 'Total'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--ui2-text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingestDlq.dlqStats.map((stat) => (
                      <tr key={stat.entity} data-testid={`ops-dlq-row-${stat.entity}`}
                        style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{stat.entity}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span data-testid={`ops-dlq-pending-${stat.entity}`} style={{ color: stat.pending > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                            {stat.pending}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', color: 'var(--ui2-text-muted)' }}>{stat.drained}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--ui2-text-muted)' }}>{stat.total}</td>
                      </tr>
                    ))}
                    {ingestDlq.dlqStats.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--ui2-text-muted)', fontStyle: 'italic' }}>
                        {ingestDlq.loading ? 'Loading…' : 'No DLQ data'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lag Metrics Table */}
            <div style={{
              background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)', fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                Lag Metrics (DLQ Pending vs ES Count)
              </div>
              <div data-testid="ops-lag-metrics-table" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--ui2-bg-secondary)' }}>
                      {['Entity', 'Lag', 'DLQ Pending', 'ES Count'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--ui2-text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingestDlq.lagMetrics.map((m) => (
                      <tr key={m.entity} data-testid={`ops-lag-row-${m.entity}`}
                        style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{m.entity}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span data-testid={`ops-lag-${m.entity}`} style={{ color: m.lag > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                            {m.lag}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', color: 'var(--ui2-text-muted)' }}>{m.dlq_pending}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--ui2-text-muted)' }}>{m.es_count}</td>
                      </tr>
                    ))}
                    {ingestDlq.lagMetrics.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--ui2-text-muted)', fontStyle: 'italic' }}>
                        {ingestDlq.loading ? 'Loading…' : 'No lag data'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div data-testid="ops-about-panel">
            <div style={{
              padding: '20px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-text-primary)', marginBottom: '16px' }}>
                Platform Info
              </div>
              <div data-testid="ops-platform-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '13px' }}>
                {Object.entries(PLATFORM_INFO).map(([key, val]) => (
                  <div key={key} data-testid={`ops-info-${key}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ui2-text-muted)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span style={{ color: 'var(--ui2-text-primary)', fontFamily: 'monospace' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div data-testid="ops-ready" data-ready={!loading && services.length > 0 ? 'true' : 'false'} style={{ display: 'none' }} />
    </div>
    </>
  );
}
