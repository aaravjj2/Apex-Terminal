/**
 * AuditorUI2 — W103 Audit Log Viewer
 * Displays ES audit trail events with filter/export DataTableUI2.
 * Demonstrates PageShellUI2 + DataTableUI2 standardisation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PageShellUI2 } from '../components/PageShellUI2';
import { DataTableUI2 } from '../components/DataTableUI2';
import type { ColumnDefUI2 } from '../components/DataTableUI2';
import type { PageStatus } from '../components/PageShellUI2';

const API_BASE = '';

interface AuditEvent {
  id: string;
  event_type: string;
  source: string;
  severity: string;
  message: string;
  timestamp: string;
}

const COLUMNS: ColumnDefUI2<AuditEvent>[] = [
  { key: 'id', label: 'ID', width: 90, sortable: false },
  { key: 'event_type', label: 'Type', width: 130, sortable: true, filterable: true },
  { key: 'source', label: 'Source', width: 120, sortable: true, filterable: true },
  {
    key: 'severity', label: 'Severity', width: 90, sortable: true,
    render: (val) => {
      const sev = String(val);
      const color = sev === 'critical' ? '#F87171' : sev === 'warning' ? '#FCD34D' : '#4ADE80';
      return <span style={{ color, fontWeight: 600, fontSize: 12 }}>{sev}</span>;
    },
  },
  { key: 'message', label: 'Message', sortable: false },
  {
    key: 'timestamp', label: 'Time', width: 150, sortable: true,
    render: (val) => <span style={{ color: '#64748B', fontSize: 12 }}>{new Date(String(val)).toLocaleTimeString()}</span>,
  },
];

function generateMockAuditEvents(): AuditEvent[] {
  const types = ['es.index', 'api.call', 'auth.login', 'job.run', 'eval.run'];
  const sources = ['backend', 'frontend', 'agent', 'worker', 'scheduler'];
  const severities = ['info', 'info', 'info', 'warning', 'critical'];
  const messages = [
    'Document indexed successfully', 'API request completed', 'User authenticated',
    'Job completed with result', 'Eval run finished', 'High latency detected',
    'Agent citation coverage low', 'ES cluster health degraded',
  ];
  return Array.from({ length: 40 }, (_, i) => ({
    id: `audit-${String(i + 1).padStart(4, '0')}`,
    event_type: types[i % types.length],
    source: sources[i % sources.length],
    severity: severities[i % severities.length],
    message: messages[i % messages.length],
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
  }));
}

export function AuditorUI2() {
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);

  const loadAuditEvents = useCallback(async () => {
    setPageStatus('loading');
    try {
      // Try real endpoint; fall back to mock data
      const r = await fetch(`${API_BASE}/api/v3/pages/audit-events`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const text = await r.text();
        const data = text ? JSON.parse(text) : {};
        setEvents(data.events || []);
      } else {
        throw new Error('fallback');
      }
    } catch {
      // No data available — show empty state
      setEvents([]);
    } finally {
      setPageStatus('ready');
    }
  }, []);

  useEffect(() => {
    loadAuditEvents();
  }, [loadAuditEvents, refreshCount]);

  return (
    <PageShellUI2
      status={pageStatus}
      testId="auditor-ui2-page"
      style={{ background: '#0F172A', padding: 24, fontFamily: 'Inter, sans-serif' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 data-testid="auditor-title" style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginBottom: 4, margin: 0 }}>
              Audit Log
            </h1>
            <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>
              System-wide event audit trail
            </p>
          </div>
          <button
            data-testid="auditor-refresh-btn"
            onClick={() => setRefreshCount(c => c + 1)}
            style={{ background: '#1E3A5F', color: '#93C5FD', border: '1px solid #1D4ED8', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            Refresh
          </button>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Events', val: events.length, color: '#3B82F6' },
            { label: 'Critical', val: events.filter(e => e.severity === 'critical').length, color: '#F87171' },
            { label: 'Warnings', val: events.filter(e => e.severity === 'warning').length, color: '#FCD34D' },
            { label: 'Info', val: events.filter(e => e.severity === 'info').length, color: '#4ADE80' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: '#1E293B', borderRadius: 10, padding: 14, border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Data table */}
        <DataTableUI2<AuditEvent>
          testId="auditor-events-table"
          title="Audit Events"
          columns={COLUMNS}
          data={events}
          keyField="id"
          virtualize={events.length > 20}
          rowHeight={36}
          visibleRows={15}
          exportFileName="audit-events.csv"
          emptyMessage="No audit events found."
        />
      </div>
    </PageShellUI2>
  );
}

export default AuditorUI2;
