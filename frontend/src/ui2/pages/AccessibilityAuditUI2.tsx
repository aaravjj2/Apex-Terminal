/**
 * Wave 104  Accessibility Audit UI2
 * Shows axe-core audit results per page.
 * Route: /ui2/accessibility
 */

import { useState, useEffect, useCallback } from 'react';
import { PageShellUI2, DataTableUI2, type ColumnDefUI2 } from '../components';

const API = 'http://localhost:8090/api/v3/a11y';

interface AuditRun {
  id: string;
  page_id: string;
  page_url: string;
  timestamp: string;
  violations_critical: number;
  violations_serious: number;
  violations_moderate: number;
  violations_minor: number;
  passes_count: number;
  incomplete_count: number;
  axe_version: string;
  passed: boolean;
}

interface PageUnderTest {
  id: string;
  url: string;
}

const IMPACT_COLORS: Record<string, string> = {
  critical: '#ef4444',
  serious:  '#f97316',
  moderate: '#eab308',
  minor:    '#6b7280',
};

const TABLE_COLS: ColumnDefUI2<AuditRun>[] = [
  { key: 'page_id',             label: 'Page',     width: 160, sortable: true },
  {
    key: 'violations_critical', label: 'Critical', width: 90,  sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(val) > 0 ? IMPACT_COLORS.critical : '#6b7280' }}>
        {String(val)}
      </span>
    ),
  },
  {
    key: 'violations_serious',  label: 'Serious',  width: 90,  sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(val) > 0 ? IMPACT_COLORS.serious : '#6b7280' }}>
        {String(val)}
      </span>
    ),
  },
  {
    key: 'violations_moderate', label: 'Moderate', width: 90,  sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(val) > 0 ? IMPACT_COLORS.moderate : '#6b7280' }}>
        {String(val)}
      </span>
    ),
  },
  {
    key: 'violations_minor',    label: 'Minor',    width: 90,  sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#6b7280' }}>
        {String(val)}
      </span>
    ),
  },
  {
    key: 'passes_count',        label: 'Passes',   width: 90,  sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 600 }}>
        {String(val)}
      </span>
    ),
  },
  {
    key: 'passed',              label: 'Status',   width: 90,
    render: (val, row) => (val as boolean) ? (
      <span data-testid={`a11y-pass-${(row as AuditRun).page_id}`} style={{ color: '#22c55e', fontWeight: 700 }}>v Pass</span>
    ) : (
      <span data-testid={`a11y-fail-${(row as AuditRun).page_id}`} style={{ color: '#ef4444', fontWeight: 700 }}>x Fail</span>
    ),
  },
  {
    key: 'timestamp',           label: 'Timestamp', width: 200, sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{String(val).slice(0, 19)}</span>
    ),
  },
];

export function AccessibilityAuditUI2() {
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [pages, setPages] = useState<PageUnderTest[]>([]);
  const [summary, setSummary] = useState<{ total_critical: number; total_serious: number; overall_pass: boolean } | null>(null);
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [runsRes, pagesRes, summaryRes] = await Promise.all([
        fetch(`${API}/runs`),
        fetch(`${API}/pages-under-test`),
        fetch(`${API}/summary`),
      ]);
      if (!runsRes.ok || !pagesRes.ok) throw new Error(`API error ${runsRes.status}`);
      const runsData    = await runsRes.json();
      const pagesData   = await pagesRes.json();
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;
      setRuns(runsData.runs ?? []);
      setPages(pagesData.pages ?? []);
      setSummary(summaryData);
      setPageStatus('ready');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPageStatus('error');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const criticalCount = summary?.total_critical ?? 0;
  const seriousCount  = summary?.total_serious  ?? 0;
  const overallPass   = summary?.overall_pass   ?? true;

  return (
    <PageShellUI2
      status={pageStatus}
      testId="a11y-audit-page"
      errorMessage={error}
      emptyMessage="No audit runs yet. Run Playwright tests to populate."
    >
      <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1
            data-testid="a11y-audit-title"
            style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}
          >
            Accessibility Audit
          </h1>
          <span
            data-testid="a11y-audit-version"
            style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', fontFamily: 'monospace' }}
          >
            w104-v1.0
          </span>
          <button
            data-testid="a11y-refresh-btn"
            onClick={loadData}
            aria-label="Refresh accessibility audit results"
            style={{
              marginLeft: 'auto', padding: '6px 14px',
              background: 'var(--ui2-bg-elevated)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)', color: 'var(--ui2-text-primary)',
              fontSize: '12px', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {/* KPI row */}
        <div
          data-testid="a11y-kpi-row"
          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}
          role="region"
          aria-label="Accessibility audit KPIs"
        >
          {[
            { label: 'Critical', value: criticalCount, color: criticalCount > 0 ? '#ef4444' : '#22c55e', testid: 'a11y-kpi-critical' },
            { label: 'Serious',  value: seriousCount,  color: seriousCount  > 0 ? '#f97316' : '#22c55e', testid: 'a11y-kpi-serious'  },
            { label: 'Pages',    value: pages.length,  color: 'var(--ui2-text-primary)',                  testid: 'a11y-kpi-pages'    },
            { label: 'Runs',     value: runs.length,   color: 'var(--ui2-text-primary)',                  testid: 'a11y-kpi-runs'     },
          ].map(kpi => (
            <div key={kpi.label} data-testid={kpi.testid} aria-label={`${kpi.label}: ${kpi.value}`}
              style={{ padding: '10px 16px', background: 'var(--ui2-bg-elevated)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)', minWidth: '80px' }}
            >
              <div style={{ fontSize: '22px', fontWeight: 700, color: kpi.color, fontFamily: 'monospace' }}>{kpi.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginTop: '2px' }}>{kpi.label}</div>
            </div>
          ))}
          <div data-testid="a11y-overall-status"
            aria-label={`Overall accessibility status: ${overallPass ? 'Pass' : 'Fail'}`}
            style={{
              padding: '10px 16px', alignSelf: 'center',
              background: overallPass ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${overallPass ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 'var(--ui2-radius-md)',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: overallPass ? '#22c55e' : '#ef4444' }}>
              {overallPass ? 'All Pass' : 'Issues Found'}
            </span>
          </div>
        </div>

        {/* Pages under test */}
        <div role="region" aria-label="Pages under accessibility test">
          <h2 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-secondary)' }}>
            Pages Under Test ({pages.length})
          </h2>
          <div data-testid="a11y-pages-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="list">
            {pages.map(p => (
              <div key={p.id} data-testid={`a11y-page-chip-${p.id}`} role="listitem"
                style={{ padding: '4px 10px', background: 'var(--ui2-bg-surface)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px', color: 'var(--ui2-text-secondary)', fontFamily: 'monospace' }}
              >
                {p.id}
              </div>
            ))}
          </div>
        </div>

        {/* Audit runs table */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <DataTableUI2<AuditRun>
            testId="a11y-runs-table"
            columns={TABLE_COLS}
            data={runs}
            title="Audit Runs"
            exportFileName="a11y-audit-runs.csv"
          />
        </div>
      </div>
    </PageShellUI2>
  );
}
