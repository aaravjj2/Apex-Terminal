/**
 * v1.62 — OpsUI2 Page (Enhanced)
 * Platform Health Dashboard, Incidents, Reports
 */

import { useState } from 'react';
import { PageHeader, Tabs, StatusBadge, DataTable, type ColumnDef } from '../components';
import { DEMO_TIMESTAMP } from '../demo/constants';

interface HealthCheck {
  id: string;
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: string;
  lastCheck: string;
}

const HEALTH_CHECKS: HealthCheck[] = [
  { id: 'h-1', service: 'Backend API', status: 'healthy', latency: 12, uptime: '99.97%', lastCheck: new Date(DEMO_TIMESTAMP).toISOString() },
  { id: 'h-2', service: 'WebSocket Feed', status: 'healthy', latency: 3, uptime: '99.95%', lastCheck: new Date(DEMO_TIMESTAMP).toISOString() },
  { id: 'h-3', service: 'Demo Data Engine', status: 'healthy', latency: 1, uptime: '100.0%', lastCheck: new Date(DEMO_TIMESTAMP).toISOString() },
  { id: 'h-4', service: 'Replay Cache', status: 'healthy', latency: 5, uptime: '99.99%', lastCheck: new Date(DEMO_TIMESTAMP).toISOString() },
  { id: 'h-5', service: 'Strategy Validator', status: 'healthy', latency: 8, uptime: '99.90%', lastCheck: new Date(DEMO_TIMESTAMP).toISOString() },
];

const PLATFORM_INFO = {
  version: '1.62.0',
  buildHash: 'dde87004',
  mode: 'DEMO',
  nodeEnv: 'production',
  uptime: '4d 12h 33m',
  lastDeploy: new Date(DEMO_TIMESTAMP - 86400000 * 4).toISOString().split('T')[0],
};

interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'investigating';
  createdAt: string;
}

const DEMO_INCIDENTS: Incident[] = [
  { id: 'inc-1', title: 'Elevated latency on WebSocket feed', severity: 'medium', status: 'resolved', createdAt: new Date(DEMO_TIMESTAMP - 86400000 * 2).toISOString().split('T')[0] },
  { id: 'inc-2', title: 'Scheduled maintenance window', severity: 'low', status: 'resolved', createdAt: new Date(DEMO_TIMESTAMP - 86400000 * 5).toISOString().split('T')[0] },
  { id: 'inc-3', title: 'Replay cache cold start delay', severity: 'low', status: 'resolved', createdAt: new Date(DEMO_TIMESTAMP - 86400000 * 7).toISOString().split('T')[0] },
];

export function OpsUI2() {
  const [activeTab, setActiveTab] = useState('health');

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
    <div data-testid="ops-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader title="Operations" subtitle="Platform health, incidents, and system info" icon="O" testId="ops-header" />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'health', label: 'Health Dashboard' },
            { id: 'incidents', label: 'Incidents' },
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
            {/* Summary cards */}
            <div data-testid="ops-health-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Services', value: String(HEALTH_CHECKS.length), status: 'All Healthy' },
                { label: 'Avg Latency', value: `${Math.round(HEALTH_CHECKS.reduce((a, c) => a + c.latency, 0) / HEALTH_CHECKS.length)}ms`, status: 'Normal' },
                { label: 'Mode', value: PLATFORM_INFO.mode, status: 'Demo Active' },
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
      <div data-testid="ops-ready" style={{ display: 'none' }} />
    </div>
  );
}
