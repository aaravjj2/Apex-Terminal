/**
 * AutopilotPlaybookUI2 — W41: Autopilot Playbook
 * Autopilot playbook engine with strategy templates and execution rules
 *
 * Production-grade terminal interface using ui2 design system.
 * Tabs: Overview | Data | Analytics | Configuration
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Tabs, Panel, DataTable, StatusBadge, KPIStrip, Button, EmptyState, Skeleton,
} from '../components';
import type { ColumnDef, KPIItem } from '../components';

const API = '/api/v4/autopilot-playbook';

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'data',      label: 'Data' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'config',    label: 'Configuration' },
];

const S = {
  page:    { height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  content: { flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' },
  gap:     { display: 'flex', flexDirection: 'column' as const, gap: 'var(--ui2-space-4)' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ui2-space-3)' },
  grid3:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--ui2-space-3)' },
  surface: { background: 'var(--ui2-bg-surface)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)' } as React.CSSProperties,
  mono:    { fontFamily: 'var(--ui2-font-mono)', fontSize: '11px', color: 'var(--ui2-text-tertiary)' } as React.CSSProperties,
  dimText: { fontSize: '11px', color: 'var(--ui2-text-muted)' } as React.CSSProperties,
  label:   { fontSize: '11px', fontWeight: 600, color: 'var(--ui2-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', display: 'block' } as React.CSSProperties,
  errorBox:  { background: 'var(--ui2-danger-bg)', border: '1px solid var(--ui2-danger-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-danger)', fontSize: '13px' } as React.CSSProperties,
};

interface DataItem { [key: string]: unknown }

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={S.dimText}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }}>{value}</span>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.surface}>
      <div style={S.dimText}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--ui2-font-mono)', color: 'var(--ui2-text-primary)', marginTop: '2px' }}>{value}</div>
    </div>
  );
}

export function AutopilotPlaybookUI2() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({ });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/playbooks` );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(Array.isArray(json.data) ? json.data : []);
      setStats(json.metadata || {});
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnDef<DataItem>[] = [
    { key: 'id', label: 'ID', width: '120px', render: (_v, row) => <span style={S.mono}>{String(row.id || '—')}</span> },
    { key: 'name', label: 'Name', width: '200px' },
    { key: 'status', label: 'Status', width: '100px', render: (_v, row) => <StatusBadge variant={String(row.status) === 'active' ? 'success' : 'neutral'}>{String(row.status || 'pending')}</StatusBadge> },
    { key: 'updated', label: 'Updated', width: '140px', render: (_v, row) => <span style={{ fontSize: '12px' }}>{String(row.updated || '—')}</span> },
  ];

  const kpiItems: KPIItem[] = [
    { id: 'total', label: 'Total Items', value: String(data.length), status: 'neutral', icon: <span style={{ fontSize: '16px' }}>📊</span> },
    { id: 'active', label: 'Active', value: String(data.filter((d: any) => d.status === 'active').length), status: 'success', icon: <span style={{ fontSize: '16px' }}>✅</span> },
    { id: 'week', label: 'Week', value: 'W41', status: 'neutral', icon: <span style={{ fontSize: '16px' }}>📖</span> },
    { id: 'version', label: 'API Version', value: 'v4', status: 'neutral', icon: <span style={{ fontSize: '16px' }}>🔗</span> },
  ];

  return (
    <div data-testid="autopilot-playbook-page" data-ready="true" style={S.page}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader title="Autopilot Playbook" subtitle="Autopilot playbook engine with strategy templates and execution rules" testId="autopilot-playbook-header" />
      </div>
      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs items={TABS} activeTab={tab} onTabChange={setTab} testId="autopilot-playbook-tabs" />
      </div>
      <div style={S.content}>
        {error && <div style={S.errorBox}>{error}</div>}

        {tab === 'overview' && (
          <div style={S.gap}>
            <KPIStrip items={kpiItems} variant="hero" testId="autopilot-playbook-kpi" />
            <div style={S.grid2}>
              <Panel title="Service Status" variant="elevated" padding="md" testId="autopilot-playbook-status"
                status={<StatusBadge variant="success">Operational</StatusBadge>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <InfoRow label="Feature" value="Autopilot Playbook" />
                  <InfoRow label="Week" value="W41" />
                  <InfoRow label="API Prefix" value="/api/v4/autopilot-playbook" />
                  <InfoRow label="Endpoints" value="5" />
                  <InfoRow label="Version" value="v4" />
                </div>
              </Panel>
              <Panel title="Quick Actions" variant="elevated" padding="md" testId="autopilot-playbook-actions">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-2)' }}>
                  <Button variant="primary" fullWidth onClick={fetchData} loading={loading} testId="autopilot-playbook-refresh">
                    Refresh Data
                  </Button>
                  <Button variant="secondary" fullWidth testId="autopilot-playbook-export">
                    Export Report
                  </Button>
                  <Button variant="ghost" fullWidth testId="autopilot-playbook-docs">
                    View Documentation
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div style={S.gap}>
            {loading ? <Skeleton height={300} /> : data.length > 0 ? (
              <Panel title="Autopilot Playbook Data" variant="default" padding="none" testId="autopilot-playbook-data-panel">
                <DataTable columns={columns} data={data} keyField="id" density="compact" testId="autopilot-playbook-table" />
              </Panel>
            ) : (
              <EmptyState title="No data available" description="Run a refresh or check the API connection to load data." />
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <div style={S.gap}>
            <Panel title="Analytics Overview" variant="elevated" padding="md" testId="autopilot-playbook-analytics">
              <div style={S.grid3}>
                <MetricCell label="Data Points" value={String(data.length)} />
                <MetricCell label="API Calls" value="—" />
                <MetricCell label="Latency (p99)" value="—" />
                <MetricCell label="Error Rate" value="0%" />
                <MetricCell label="Throughput" value="—" />
                <MetricCell label="Cache Hit" value="—" />
              </div>
            </Panel>
            <Panel title="Recent Activity" variant="bordered" padding="md" testId="autopilot-playbook-activity">
              <EmptyState title="No recent activity" description="Analytics data will populate as the service processes requests." />
            </Panel>
          </div>
        )}

        {tab === 'config' && (
          <div style={S.gap}>
            <Panel title="Service Configuration" variant="elevated" padding="md" testId="autopilot-playbook-config">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <InfoRow label="API Endpoint" value="/api/v4/autopilot-playbook" />
                <InfoRow label="Week" value="W41" />
                <InfoRow label="Section" value="tools" />
                <InfoRow label="Auto-refresh" value="Enabled" />
                <InfoRow label="Cache TTL" value="60s" />
              </div>
            </Panel>
            <Panel title="Endpoints" variant="bordered" padding="md" testId="autopilot-playbook-endpoints">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={S.surface}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      <StatusBadge variant="success">GET</StatusBadge>
                      {' '}/playbooks
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>List playbooks</div>
                </div>
                <div style={S.surface}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      <StatusBadge variant="warning">POST</StatusBadge>
                      {' '}/playbooks
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>Create playbook</div>
                </div>
                <div style={S.surface}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      <StatusBadge variant="success">GET</StatusBadge>
                      {' '}/playbooks/{id}/runs
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>Get playbook runs</div>
                </div>
                <div style={S.surface}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      <StatusBadge variant="warning">POST</StatusBadge>
                      {' '}/execute
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>Execute playbook</div>
                </div>
                <div style={S.surface}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      <StatusBadge variant="success">GET</StatusBadge>
                      {' '}/templates
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>List playbook templates</div>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
