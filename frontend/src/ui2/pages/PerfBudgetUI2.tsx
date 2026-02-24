/**
 * Wave 105 — Performance Budget UI2
 * Shows per-page load metrics collected by the Playwright perf spec.
 * Route: /ui2/perf-budget
 */

import { useState, useEffect, useCallback } from 'react';
import { PageShellUI2, DataTableUI2, type ColumnDefUI2 } from '../components';

const API = '/api/v3/perf';

interface PerfSample {
  id: string;
  page_id: string;
  page_url: string;
  sampled_at: number;
  fcp_ms: number | null;
  lcp_ms: number | null;
  dom_content_loaded_ms: number | null;
  load_time_ms: number | null;
  budget_passed: boolean;
  violations: Array<{ metric: string; value: number; budget: number }>;
}

interface Summary {
  total_samples: number;
  pages_sampled: number;
  pages_passing: number;
  avg_lcp_ms: number | null;
  avg_fcp_ms: number | null;
  avg_dom_content_loaded_ms: number | null;
  avg_load_time_ms: number | null;
  budgets: Record<string, number>;
}

interface Budget {
  timing_budgets: Record<string, number>;
  bundle_budgets: Record<string, number>;
  pages: Array<{ id: string; path: string }>;
}

const fmt = (v: number | null) =>
  v == null ? '—' : `${v.toFixed(0)} ms`;

const passColor = (passed: boolean) =>
  passed ? '#22c55e' : '#ef4444';

const TABLE_COLS: ColumnDefUI2<PerfSample>[] = [
  { key: 'page_id', label: 'Page', width: 160, sortable: true },
  {
    key: 'fcp_ms', label: 'FCP', width: 100, sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', color: Number(val) > 8000 ? '#ef4444' : '#e2e8f0' }}>
        {fmt(val as number | null)}
      </span>
    ),
  },
  {
    key: 'lcp_ms', label: 'LCP', width: 100, sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', color: Number(val) > 10000 ? '#ef4444' : '#e2e8f0' }}>
        {fmt(val as number | null)}
      </span>
    ),
  },
  {
    key: 'dom_content_loaded_ms', label: 'DCL', width: 100, sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', color: Number(val) > 8000 ? '#ef4444' : '#e2e8f0' }}>
        {fmt(val as number | null)}
      </span>
    ),
  },
  {
    key: 'load_time_ms', label: 'Load', width: 100, sortable: true,
    render: (val) => (
      <span style={{ fontFamily: 'monospace', color: Number(val) > 10000 ? '#ef4444' : '#e2e8f0' }}>
        {fmt(val as number | null)}
      </span>
    ),
  },
  {
    key: 'budget_passed', label: 'Pass', width: 80, sortable: true,
    render: (val) => (
      <span style={{ fontWeight: 700, color: passColor(val as boolean) }}>
        {val ? '✓' : '✗'}
      </span>
    ),
  },
  {
    key: 'sampled_at', label: 'Sampled', width: 180, sortable: true,
    render: (val) => (
      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
        {new Date((val as number) * 1000).toLocaleString()}
      </span>
    ),
  },
];

export function PerfBudgetUI2() {
  const [samples, setSamples] = useState<PerfSample[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgets, setBudgets] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [samplesRes, summaryRes, budgetsRes] = await Promise.all([
        fetch(`${API}/samples`),
        fetch(`${API}/summary`),
        fetch(`${API}/budgets`),
      ]);
      if (!samplesRes.ok || !summaryRes.ok || !budgetsRes.ok) {
        throw new Error('API error');
      }
      setSamples(await samplesRes.json());
      setSummary(await summaryRes.json());
      setBudgets(await budgetsRes.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <PageShellUI2
      testId="perf-budget-page"
      loading={loading}
      error={error}
      onRetry={load}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 data-testid="perf-budget-title"
              style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
            Performance Budget
          </h2>
          <button
            data-testid="perf-budget-refresh-btn"
            onClick={load}
            aria-label="Refresh performance samples"
            style={{
              padding: '8px 16px', background: 'var(--ui2-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Refresh
          </button>
        </div>

        {/* KPI row */}
        {summary && (
          <div data-testid="perf-budget-kpi-row"
               style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'samples',  label: 'Samples',       value: summary.total_samples },
              { id: 'pages',    label: 'Pages sampled', value: summary.pages_sampled },
              { id: 'passing',  label: 'Pages passing', value: summary.pages_passing },
              { id: 'avg-lcp',  label: 'Avg LCP',       value: fmt(summary.avg_lcp_ms) },
              { id: 'avg-fcp',  label: 'Avg FCP',       value: fmt(summary.avg_fcp_ms) },
              { id: 'avg-load', label: 'Avg Load',      value: fmt(summary.avg_load_time_ms) },
            ].map(({ id, label, value }) => (
              <div key={id} data-testid={`perf-budget-kpi-${id}`}
                   style={{
                     padding: '12px 20px', background: 'var(--ui2-bg-card)',
                     borderRadius: 'var(--ui2-radius)', border: '1px solid var(--ui2-border)',
                     minWidth: '110px',
                   }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Budget thresholds */}
        {budgets && (
          <div data-testid="perf-budget-thresholds"
               style={{
                 padding: '16px', background: 'var(--ui2-bg-card)',
                 borderRadius: 'var(--ui2-radius)', border: '1px solid var(--ui2-border)',
               }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '10px' }}>
              Budget Thresholds (ms)
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {Object.entries(budgets.timing_budgets).map(([key, limit]) => (
                <div key={key} style={{ fontSize: '12px', color: '#e2e8f0' }}>
                  <span style={{ color: '#94a3b8' }}>{key}: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>≤ {limit} ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Samples table */}
        <DataTableUI2<PerfSample>
          testId="perf-budget-samples-table"
          columns={TABLE_COLS}
          data={samples}
          title="Performance Samples"
          exportFileName="perf-budget-samples.csv"
        />
      </div>
    </PageShellUI2>
  );
}
