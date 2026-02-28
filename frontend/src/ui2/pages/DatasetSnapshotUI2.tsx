/**
 * DatasetSnapshotUI2 — W14 Immutable Dataset Snapshot Command Center
 *
 * Production-grade institutional terminal interface for dataset lifecycle:
 *
 * Tabs:
 *  1. Dashboard   — KPI strip, symbol distribution, health overview
 *  2. Snapshots   — Sortable data table with inline status + verify
 *  3. Create      — Snapshot creation wizard with live preview
 *  4. Inspector   — Deep-dive: metadata, bar chart, OHLCV table
 *  5. Integrity   — Batch SHA-256 verification console
 *  6. Backtest    — Run backtest bound to immutable dataset
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import {
  PageHeader, Tabs, Panel, DataTable, StatusBadge, KPIStrip,
  Button, Skeleton, EmptyState, ProgressBar,
} from '../components';
import type { ColumnDef } from '../components';
import type { KPIItem } from '../components';
import {
  datasetSnapshotStore,
  type DatasetSnapshotInfo,
  type DatasetBar,
  type ChecksumVerification,
} from '../stores/datasetSnapshotStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function truncSha(sha: string, n = 16): string {
  return sha.length > n ? sha.slice(0, n) + '…' : sha;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round(Math.abs(d2 - d1) / 86400000);
}

// ── Shared inline style tokens aligned with ui2-tokens.css ──────────────────

const S = {
  panel:     { background: 'var(--ui2-bg-panel)',    border: '1px solid var(--ui2-border)',        borderRadius: 'var(--ui2-radius-md)',  padding: 'var(--ui2-space-4)' } as React.CSSProperties,
  elevated:  { background: 'var(--ui2-bg-elevated)', border: '1px solid var(--ui2-border-subtle)', borderRadius: 'var(--ui2-radius-md)',  padding: 'var(--ui2-space-4)', boxShadow: 'var(--ui2-shadow-sm)' } as React.CSSProperties,
  surface:   { background: 'var(--ui2-bg-surface)',  border: '1px solid var(--ui2-border)',        borderRadius: 'var(--ui2-radius-sm)',  padding: 'var(--ui2-space-3)' } as React.CSSProperties,
  input:     { padding: '8px 12px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%', outline: 'none', transition: 'border-color var(--ui2-transition-fast)' } as React.CSSProperties,
  label:     { fontSize: '11px', fontWeight: 600, color: 'var(--ui2-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', display: 'block' } as React.CSSProperties,
  mono:      { fontFamily: 'var(--ui2-font-mono)', fontSize: '11px', color: 'var(--ui2-text-tertiary)' } as React.CSSProperties,
  sectionGap: { display: 'flex', flexDirection: 'column' as const, gap: 'var(--ui2-space-4)' } as React.CSSProperties,
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ui2-space-3)' } as React.CSSProperties,
  grid3:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--ui2-space-3)' } as React.CSSProperties,
  grid4:     { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--ui2-space-3)' } as React.CSSProperties,
  flex:      { display: 'flex', alignItems: 'center', gap: 'var(--ui2-space-2)' } as React.CSSProperties,
  flexBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
  scrollY:   { flex: 1, overflowY: 'auto' as const, overflowX: 'hidden' as const } as React.CSSProperties,
  title:     { fontSize: '14px', fontWeight: 600, color: 'var(--ui2-text-primary)' } as React.CSSProperties,
  subtitle:  { fontSize: '12px', color: 'var(--ui2-text-secondary)' } as React.CSSProperties,
  dimText:   { fontSize: '11px', color: 'var(--ui2-text-muted)' } as React.CSSProperties,
  errorBox:  { background: 'var(--ui2-danger-bg)', border: '1px solid var(--ui2-danger-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-danger)', fontSize: '13px' } as React.CSSProperties,
  successBox: { background: 'var(--ui2-success-bg)', border: '1px solid var(--ui2-success-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-success)', fontSize: '13px' } as React.CSSProperties,
};

// ── 1. DASHBOARD TAB ────────────────────────────────────────────────────────

function DashboardTab() {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);

  useEffect(() => { datasetSnapshotStore.fetchSnapshots(); }, []);

  const stats = state.stats;
  if (state.loading && !stats) return <Skeleton height={300} />;

  const kpiItems: KPIItem[] = [
    {
      id: 'total', label: 'Total Snapshots', value: stats?.totalSnapshots ?? 0,
      status: (stats?.totalSnapshots ?? 0) > 0 ? 'success' : 'neutral',
      icon: <span style={{ fontSize: '16px' }}>📦</span>,
    },
    {
      id: 'rows', label: 'Total Rows', value: fmtNum(stats?.totalRows ?? 0),
      status: 'neutral',
      icon: <span style={{ fontSize: '16px' }}>📊</span>,
    },
    {
      id: 'symbols', label: 'Unique Symbols', value: stats?.uniqueSymbols ?? 0,
      status: 'neutral',
      icon: <span style={{ fontSize: '16px' }}>🏷️</span>,
    },
    {
      id: 'verified', label: 'Verified', value: `${stats?.verifiedCount ?? 0}/${stats?.totalSnapshots ?? 0}`,
      status: (stats?.corruptedCount ?? 0) > 0 ? 'danger' : (stats?.verifiedCount ?? 0) > 0 ? 'success' : 'warning',
      icon: <span style={{ fontSize: '16px' }}>🔒</span>,
    },
  ];

  const symbolDist = stats?.symbolDistribution ?? {};
  const maxCount = Math.max(...Object.values(symbolDist), 1);

  return (
    <div style={S.sectionGap} data-testid="w14-dashboard-tab">
      <KPIStrip items={kpiItems} variant="hero" testId="w14-dashboard-kpi" />

      <div style={S.grid2}>
        <Panel title="Symbol Distribution" variant="elevated" padding="md" testId="w14-symbol-dist">
          {Object.keys(symbolDist).length === 0 ? (
            <div style={S.dimText}>No snapshots yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(symbolDist).sort((a, b) => b[1] - a[1]).map(([sym, count]) => (
                <div key={sym}>
                  <div style={S.flexBetween}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{sym}</span>
                    <span style={S.dimText}>{count} snapshot{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--ui2-bg-hover)', marginTop: '4px' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      background: 'var(--ui2-brand-primary)',
                      width: `${(count / maxCount) * 100}%`,
                      transition: 'width var(--ui2-transition-base)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Quick Stats" variant="elevated" padding="md" testId="w14-quick-stats">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <QuickStatRow label="Avg Rows/Snapshot" value={fmtNum(stats?.avgRowCount ?? 0)} />
            <QuickStatRow label="Oldest Snapshot" value={stats?.oldestSnapshot ? fmtDateTime(stats.oldestSnapshot) : '—'} />
            <QuickStatRow label="Newest Snapshot" value={stats?.newestSnapshot ? fmtDateTime(stats.newestSnapshot) : '—'} />
            <QuickStatRow label="Last Refresh" value={state.lastRefresh ? fmtDateTime(new Date(state.lastRefresh).toISOString()) : 'Never'} />
            <QuickStatRow label="Integrity" value={
              (stats?.verifiedCount ?? 0) > 0
                ? `${stats!.verifiedCount} verified, ${stats!.corruptedCount} corrupted`
                : 'Not yet verified'
            } />
          </div>
        </Panel>
      </div>

      <Panel title="Recent Snapshots" variant="default" padding="none" testId="w14-recent-panel">
        {state.snapshots.length === 0 ? (
          <div style={{ padding: 'var(--ui2-space-6)' }}>
            <EmptyState title="No dataset snapshots" description="Create your first snapshot in the Create tab." />
          </div>
        ) : (
          <DataTable<DatasetSnapshotInfo>
            columns={snapshotColumns}
            data={state.snapshots.slice(0, 5)}
            keyField="dataset_id"
            density="compact"
            testId="w14-recent-table"
          />
        )}
      </Panel>
    </div>
  );
}

function QuickStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.flexBetween}>
      <span style={S.dimText}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }}>{value}</span>
    </div>
  );
}

// ── Shared snapshot columns for DataTable ───────────────────────────────────

const snapshotColumns: ColumnDef<DatasetSnapshotInfo>[] = [
  {
    key: 'symbol', label: 'Symbol', width: '80px',
    render: (_v, row) => (
      <span style={{ fontWeight: 600, color: 'var(--ui2-text-primary)', fontSize: '13px' }}>{row.symbol}</span>
    ),
  },
  {
    key: 'dataset_id', label: 'Dataset ID', width: '140px',
    render: (_v, row) => <span style={S.mono}>{row.dataset_id}</span>,
  },
  {
    key: 'start_date', label: 'Range', width: '180px',
    render: (_v, row) => (
      <span style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>
        {fmtDate(row.start_date)} → {fmtDate(row.end_date)}
      </span>
    ),
  },
  {
    key: 'row_count', label: 'Rows', width: '70px', align: 'right',
    render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>{fmtNum(row.row_count)}</span>,
  },
  {
    key: 'sha256', label: 'SHA-256', width: '150px',
    render: (_v, row) => (
      <span style={{ ...S.mono, fontSize: '10px', cursor: 'pointer' }} title={row.sha256}>
        {truncSha(row.sha256)}
      </span>
    ),
  },
  {
    key: 'provider', label: 'Provider', width: '80px',
    render: (_v, row) => <StatusBadge variant="info">{row.provider}</StatusBadge>,
  },
  {
    key: 'created_at', label: 'Created', width: '120px',
    render: (_v, row) => <span style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)' }}>{fmtDateTime(row.created_at)}</span>,
  },
];

// ── 2. SNAPSHOTS TAB ────────────────────────────────────────────────────────

function SnapshotsTab({ onInspect }: { onInspect: (snap: DatasetSnapshotInfo) => void }) {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);
  const [filter, setFilter] = useState('');

  useEffect(() => { datasetSnapshotStore.fetchSnapshots(); }, []);

  const filtered = filter
    ? state.snapshots.filter(s => s.symbol.toLowerCase().includes(filter.toLowerCase()) || s.dataset_id.includes(filter))
    : state.snapshots;

  if (state.loading && state.snapshots.length === 0) return <Skeleton height={300} />;

  const extendedCols: ColumnDef<DatasetSnapshotInfo>[] = [
    ...snapshotColumns,
    {
      key: '_actions', label: '', width: '120px', align: 'right',
      render: (_v, row) => {
        const v = state.batchVerification.get(row.dataset_id);
        return (
          <div style={S.flex}>
            {v && (
              <StatusBadge variant={v.integrity === 'verified' ? 'success' : 'danger'}>
                {v.integrity === 'verified' ? '✓' : '✗'}
              </StatusBadge>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onInspect(row); }}
              style={{
                padding: '3px 10px', fontSize: '11px', fontWeight: 500,
                background: 'var(--ui2-brand-subtle)', color: 'var(--ui2-brand-primary)',
                border: '1px solid var(--ui2-brand-primary)', borderRadius: 'var(--ui2-radius-sm)',
                cursor: 'pointer', transition: 'all var(--ui2-transition-fast)',
              }}
              data-testid={`inspect-${row.dataset_id}`}
            >
              Inspect
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={S.sectionGap} data-testid="w14-snapshot-list">
      <div style={S.flexBetween}>
        <div style={S.flex}>
          <input
            style={{ ...S.input, width: '240px' }}
            placeholder="Filter by symbol or ID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            data-testid="w14-snapshot-filter"
          />
          <span style={S.dimText}>{filtered.length} of {state.snapshots.length}</span>
        </div>
        <div style={S.flex}>
          <Button variant="ghost" size="sm" onClick={() => datasetSnapshotStore.fetchSnapshots()} testId="w14-refresh-btn">
            Refresh
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No snapshots found" description={filter ? 'Try a different filter.' : 'Create your first snapshot.'} />
      ) : (
        <Panel variant="default" padding="none">
          <DataTable<DatasetSnapshotInfo>
            columns={extendedCols}
            data={filtered}
            keyField="dataset_id"
            density="compact"
            onRowClick={(row) => onInspect(row)}
            testId="w14-snapshots-table"
          />
        </Panel>
      )}
    </div>
  );
}

// ── 3. CREATE TAB ───────────────────────────────────────────────────────────

function CreateTab() {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);

  const [symbol, setSymbol] = useState('AAPL');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2023-01-01');
  const [provider] = useState('yfinance');
  const [result, setResult] = useState<DatasetSnapshotInfo | null>(null);

  const days = daysBetween(startDate, endDate);
  const estimatedRows = Math.round(days * 0.71); // ~252 trading days / 365

  const handleCreate = useCallback(async () => {
    setResult(null);
    datasetSnapshotStore.clearError();
    const snap = await datasetSnapshotStore.createSnapshot({
      symbol, start_date: startDate, end_date: endDate, provider,
    });
    if (snap) setResult(snap);
  }, [symbol, startDate, endDate, provider]);

  const canCreate = symbol.length >= 1 && startDate && endDate && startDate < endDate;

  return (
    <div style={{ maxWidth: '640px', ...S.sectionGap }} data-testid="w14-create-form">
      <Panel title="Create Dataset Snapshot" subtitle="Ingest market data into an immutable, SHA-256 verified snapshot" variant="elevated" padding="md" testId="w14-create-panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-4)' }}>
          {/* Symbol */}
          <div>
            <label style={S.label}>Symbol</label>
            <input
              style={S.input}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={10}
              data-testid="w14-symbol-input"
            />
          </div>

          {/* Date range */}
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Start Date</label>
              <input type="date" style={S.input} value={startDate}
                onChange={(e) => setStartDate(e.target.value)} data-testid="w14-start-date" />
            </div>
            <div>
              <label style={S.label}>End Date</label>
              <input type="date" style={S.input} value={endDate}
                onChange={(e) => setEndDate(e.target.value)} data-testid="w14-end-date" />
            </div>
          </div>

          {/* Provider (locked) */}
          <div>
            <label style={S.label}>Provider</label>
            <input style={{ ...S.input, opacity: 0.5, cursor: 'not-allowed' }} value={provider} disabled data-testid="w14-provider" />
          </div>

          {/* Estimate bar */}
          <div style={S.surface}>
            <div style={S.flexBetween}>
              <span style={S.dimText}>Estimated</span>
              <div style={S.flex}>
                <span style={{ ...S.mono, color: 'var(--ui2-text-primary)' }}>~{fmtNum(estimatedRows)} rows</span>
                <span style={S.dimText}>·</span>
                <span style={S.dimText}>{fmtNum(days)} calendar days</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={state.creating}
            disabled={!canCreate || state.creating}
            onClick={handleCreate}
            testId="w14-create-btn"
          >
            {state.creating ? 'Ingesting Data…' : 'Create Snapshot'}
          </Button>
        </div>
      </Panel>

      {/* Error */}
      {state.error && (
        <div style={S.errorBox} data-testid="w14-error">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Error</div>
          {state.error}
        </div>
      )}

      {/* Success result */}
      {result && (
        <Panel title="Snapshot Created" variant="elevated" padding="md"
          status={<StatusBadge variant="success">Created</StatusBadge>}
          testId="w14-create-result"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ResultRow label="Dataset ID" value={result.dataset_id} testId="result-dataset-id" mono />
            <ResultRow label="Symbol" value={result.symbol} testId="result-symbol" />
            <ResultRow label="Rows" value={fmtNum(result.row_count)} testId="result-rows" />
            <ResultRow label="Provider" value={result.provider} testId="result-provider" />
            <div>
              <span style={S.label}>SHA-256 Fingerprint</span>
              <code style={{ ...S.mono, fontSize: '10px', wordBreak: 'break-all', display: 'block', marginTop: '2px', padding: '8px', background: 'var(--ui2-bg-sunken)', borderRadius: 'var(--ui2-radius-sm)' }} data-testid="result-sha256">
                {result.sha256}
              </code>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function ResultRow({ label, value, testId, mono }: { label: string; value: string; testId: string; mono?: boolean }) {
  return (
    <div style={S.flexBetween}>
      <span style={S.dimText}>{label}</span>
      <span style={mono ? { ...S.mono, color: 'var(--ui2-text-primary)' } : { fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

// ── 4. INSPECTOR TAB ────────────────────────────────────────────────────────

function InspectorTab({ initialId }: { initialId?: string }) {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);
  const [dsId, setDsId] = useState(initialId || '');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (initialId && initialId !== dsId) {
      setDsId(initialId);
      datasetSnapshotStore.selectSnapshot(state.snapshots.find(s => s.dataset_id === initialId) || null);
    }
  }, [initialId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = useCallback(async () => {
    datasetSnapshotStore.clearError();
    await datasetSnapshotStore.fetchSnapshotById(dsId);
    await datasetSnapshotStore.fetchSnapshotBars(dsId);
  }, [dsId]);

  const handleVerify = useCallback(async () => {
    await datasetSnapshotStore.verifyChecksum(dsId);
  }, [dsId]);

  const snap = state.selectedSnapshot;
  const bars = state.selectedBars?.bars ?? [];

  // Mini-chart drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bars.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const closes = bars.map(b => Number(b.close));
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const pad = 2;

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ui2-bg-sunken').trim() || '#0d0d10';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Area fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(99,102,241,0.25)');
    gradient.addColorStop(1, 'rgba(99,102,241,0.02)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(pad, h);
    for (let i = 0; i < closes.length; i++) {
      const x = pad + (i / (closes.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((closes[i] - min) / range) * (h - 2 * pad);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w - pad, h);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = 'var(--ui2-brand-primary)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < closes.length; i++) {
      const x = pad + (i / (closes.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((closes[i] - min) / range) * (h - 2 * pad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Price labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${max.toFixed(2)}`, w - 4, 14);
    ctx.fillText(`$${min.toFixed(2)}`, w - 4, h - 4);
  }, [bars]);

  const barColumns: ColumnDef<DatasetBar>[] = [
    { key: 'date', label: 'Date', width: '100px', render: (_v, r) => <span style={{ fontSize: '12px' }}>{String(r.date)}</span> },
    { key: 'open', label: 'Open', width: '80px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>{Number(r.open).toFixed(2)}</span> },
    { key: 'high', label: 'High', width: '80px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', color: 'var(--ui2-positive)' }}>{Number(r.high).toFixed(2)}</span> },
    { key: 'low', label: 'Low', width: '80px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', color: 'var(--ui2-negative)' }}>{Number(r.low).toFixed(2)}</span> },
    { key: 'close', label: 'Close', width: '80px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', fontWeight: 600 }}>{Number(r.close).toFixed(2)}</span> },
    { key: 'volume', label: 'Volume', width: '100px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', color: 'var(--ui2-text-tertiary)' }}>{fmtNum(Number(r.volume))}</span> },
  ];

  return (
    <div style={S.sectionGap} data-testid="w14-inspect-tab">
      {/* Search bar */}
      <Panel variant="elevated" padding="sm" testId="w14-inspect-search">
        <div style={{ display: 'flex', gap: 'var(--ui2-space-2)' }}>
          <input
            style={{ ...S.input, flex: 1 }}
            value={dsId}
            onChange={(e) => setDsId(e.target.value)}
            placeholder="Enter dataset ID (e.g. ds-720704c193fe)"
            data-testid="w14-inspect-id-input"
          />
          <Button variant="primary" onClick={handleLoad} disabled={!dsId} testId="w14-inspect-load-btn">
            Load
          </Button>
          <Button variant="secondary" onClick={handleVerify} disabled={!dsId} testId="w14-inspect-verify-btn">
            Verify Checksum
          </Button>
        </div>
      </Panel>

      {/* Error */}
      {state.error && <div style={S.errorBox} data-testid="w14-inspect-error">{state.error}</div>}

      {/* Loading */}
      {(state.loading || state.barsLoading) && <Skeleton height={200} />}

      {/* Metadata */}
      {snap && (
        <Panel title={`${snap.symbol} — ${snap.dataset_id}`}
          status={<StatusBadge variant="info">{snap.provider}</StatusBadge>}
          variant="elevated" padding="md" testId="w14-inspect-meta">
          <div style={S.grid4}>
            <MetaCell label="Date Range" value={`${fmtDate(snap.start_date)} → ${fmtDate(snap.end_date)}`} testId="inspect-range" />
            <MetaCell label="Rows" value={fmtNum(snap.row_count)} testId="inspect-rows" />
            <MetaCell label="Provider" value={snap.provider} testId="inspect-provider" />
            <MetaCell label="Created" value={fmtDateTime(snap.created_at)} testId="inspect-created" />
          </div>
          <div style={{ marginTop: 'var(--ui2-space-3)' }}>
            <span style={S.label}>SHA-256 Fingerprint</span>
            <code style={{
              ...S.mono, fontSize: '10px', wordBreak: 'break-all', display: 'block', marginTop: '2px',
              padding: '8px 10px', background: 'var(--ui2-bg-sunken)', borderRadius: 'var(--ui2-radius-sm)',
            }} data-testid="inspect-sha256">
              {snap.sha256}
            </code>
          </div>
          {snap.source_manifest && (
            <div style={{ marginTop: 'var(--ui2-space-3)', ...S.grid3 }}>
              <MetaCell label="Fetch Time" value={`${snap.source_manifest.fetch_ms.toFixed(1)}ms`} testId="inspect-fetch-ms" />
              <MetaCell label="Checksum Algo" value={snap.source_manifest.checksum_algorithm} testId="inspect-algo" />
              <MetaCell label="Manifest Integrity" value={snap.source_manifest.integrity} testId="inspect-manifest-integrity" />
            </div>
          )}
        </Panel>
      )}

      {/* Checksum verification */}
      {state.checksum && (
        <Panel
          title="Integrity Verification"
          status={<StatusBadge variant={state.checksum.integrity === 'verified' ? 'success' : 'danger'}>{state.checksum.integrity}</StatusBadge>}
          variant={state.checksum.integrity === 'verified' ? 'elevated' : 'bordered'}
          padding="md"
          testId="w14-checksum-result"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={S.label}>Stored SHA-256</span>
              <code style={{ ...S.mono, fontSize: '10px', wordBreak: 'break-all' }} data-testid="checksum-stored">{state.checksum.stored_sha256}</code>
            </div>
            <div>
              <span style={S.label}>Recomputed SHA-256</span>
              <code style={{ ...S.mono, fontSize: '10px', wordBreak: 'break-all' }} data-testid="checksum-recomputed">{state.checksum.recomputed_sha256}</code>
            </div>
            {state.checksum.integrity === 'verified' && (
              <div style={{ ...S.successBox, marginTop: '4px' }}>
                SHA-256 hashes match — data integrity confirmed. {fmtNum(state.checksum.row_count)} rows verified.
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Price chart */}
      {bars.length > 0 && (
        <Panel title={`Close Price — ${bars.length} bars`} variant="elevated" padding="sm" testId="w14-price-chart">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '180px', borderRadius: 'var(--ui2-radius-sm)' }}
            data-testid="w14-chart-canvas"
          />
        </Panel>
      )}

      {/* OHLCV table */}
      {bars.length > 0 && (
        <Panel title={`OHLCV Data${state.selectedBars?.truncated ? ' (truncated to 500)' : ''}`}
          variant="default" padding="none" testId="w14-bars-preview">
          <div style={{ maxHeight: '360px', overflow: 'auto' }}>
            <DataTable<DatasetBar>
              columns={barColumns}
              data={bars}
              keyField="date"
              density="compact"
              testId="w14-bars-table"
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

function MetaCell({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div>
      <span style={S.label}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--ui2-text-primary)' }} data-testid={testId}>{value}</span>
    </div>
  );
}

// ── 5. INTEGRITY TAB ────────────────────────────────────────────────────────

function IntegrityTab() {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);

  useEffect(() => {
    if (state.snapshots.length === 0) datasetSnapshotStore.fetchSnapshots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = state.snapshots.length;
  const verified = state.stats?.verifiedCount ?? 0;
  const corrupted = state.stats?.corruptedCount ?? 0;
  const checked = verified + corrupted;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  const integrityColumns: ColumnDef<DatasetSnapshotInfo>[] = [
    {
      key: 'symbol', label: 'Symbol', width: '80px',
      render: (_v, row) => <span style={{ fontWeight: 600, fontSize: '13px' }}>{row.symbol}</span>,
    },
    {
      key: 'dataset_id', label: 'Dataset ID', width: '140px',
      render: (_v, row) => <span style={S.mono}>{row.dataset_id}</span>,
    },
    {
      key: 'row_count', label: 'Rows', width: '80px', align: 'right',
      render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>{fmtNum(row.row_count)}</span>,
    },
    {
      key: 'sha256', label: 'SHA-256', width: '160px',
      render: (_v, row) => <span style={{ ...S.mono, fontSize: '10px' }} title={row.sha256}>{truncSha(row.sha256, 20)}</span>,
    },
    {
      key: '_status', label: 'Status', width: '120px', align: 'center',
      render: (_v, row) => {
        const v = state.batchVerification.get(row.dataset_id);
        if (!v) return <StatusBadge variant="neutral">Pending</StatusBadge>;
        return v.integrity === 'verified'
          ? <StatusBadge variant="success">Verified</StatusBadge>
          : <StatusBadge variant="danger">CORRUPTED</StatusBadge>;
      },
    },
    {
      key: '_action', label: '', width: '80px', align: 'right',
      render: (_v, row) => {
        const v = state.batchVerification.get(row.dataset_id);
        if (v) return null;
        return (
          <Button variant="ghost" size="sm"
            onClick={() => datasetSnapshotStore.verifyChecksum(row.dataset_id)}
            testId={`verify-single-${row.dataset_id}`}
          >
            Verify
          </Button>
        );
      },
    },
  ];

  return (
    <div style={S.sectionGap} data-testid="w14-integrity-tab">
      {/* Header panel */}
      <Panel title="SHA-256 Integrity Console" subtitle="Verify immutable dataset fingerprints"
        variant="elevated" padding="md" testId="w14-integrity-header"
        actions={
          <Button
            variant="primary"
            size="sm"
            loading={state.batchVerifying}
            disabled={state.batchVerifying || total === 0}
            onClick={() => datasetSnapshotStore.batchVerifyAll()}
            testId="w14-batch-verify-btn"
          >
            {state.batchVerifying ? 'Verifying All…' : 'Verify All Snapshots'}
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-3)' }}>
          <div style={S.grid3}>
            <div style={{ ...S.surface, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{total}</div>
              <div style={S.dimText}>Total</div>
            </div>
            <div style={{ ...S.surface, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ui2-success)' }}>{verified}</div>
              <div style={S.dimText}>Verified</div>
            </div>
            <div style={{ ...S.surface, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: corrupted > 0 ? 'var(--ui2-danger)' : 'var(--ui2-text-muted)' }}>{corrupted}</div>
              <div style={S.dimText}>Corrupted</div>
            </div>
          </div>

          <div>
            <div style={{ ...S.flexBetween, marginBottom: '4px' }}>
              <span style={S.dimText}>Verification Progress</span>
              <span style={{ ...S.mono, fontSize: '12px' }}>{checked}/{total} ({progress}%)</span>
            </div>
            <ProgressBar
              value={progress}
              variant={corrupted > 0 ? 'danger' : verified === total && total > 0 ? 'success' : 'default'}
              testId="w14-integrity-progress"
            />
          </div>
        </div>
      </Panel>

      {/* Table */}
      {total === 0 ? (
        <EmptyState title="No datasets to verify" description="Create snapshots first." />
      ) : (
        <Panel variant="default" padding="none">
          <DataTable<DatasetSnapshotInfo>
            columns={integrityColumns}
            data={state.snapshots}
            keyField="dataset_id"
            density="compact"
            testId="w14-integrity-table"
          />
        </Panel>
      )}
    </div>
  );
}

// ── 6. BACKTEST BINDING TAB ─────────────────────────────────────────────────

const STRATEGIES = [
  { id: 'sma-crossover', name: 'SMA Crossover' },
  { id: 'rsi-mean-reversion', name: 'RSI Mean Reversion' },
  { id: 'ema-crossover', name: 'EMA Crossover' },
  { id: 'breakout-20d', name: 'Breakout 20D' },
];

function BacktestBindingTab() {
  const state = useSyncExternalStore(datasetSnapshotStore.subscribe, datasetSnapshotStore.getSnapshot);
  const equityCanvasRef = useRef<HTMLCanvasElement>(null);

  const [datasetId, setDatasetId] = useState('');
  const [strategyId, setStrategyId] = useState('sma-crossover');
  const [capital, setCapital] = useState('100000');
  const [slippage, setSlippage] = useState('5');
  const [fee, setFee] = useState('1.0');

  // Auto-populate dataset if available
  useEffect(() => {
    if (!datasetId && state.snapshots.length > 0) {
      setDatasetId(state.snapshots[0].dataset_id);
    }
  }, [state.snapshots, datasetId]);

  useEffect(() => {
    if (state.snapshots.length === 0) datasetSnapshotStore.fetchSnapshots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSnap = state.snapshots.find(s => s.dataset_id === datasetId);

  const handleRun = useCallback(async () => {
    if (!selectedSnap) return;
    await datasetSnapshotStore.runBacktestWithDataset({
      dataset_id: datasetId,
      strategy_id: strategyId,
      symbol: selectedSnap.symbol,
      start_date: selectedSnap.start_date,
      end_date: selectedSnap.end_date,
      initial_capital: Number(capital),
      slippage_bps: Number(slippage),
      fee_per_trade: Number(fee),
    });
  }, [datasetId, strategyId, selectedSnap, capital, slippage, fee]);

  const result = state.backtestResult;

  // Draw equity curve
  useEffect(() => {
    const canvas = equityCanvasRef.current;
    if (!canvas || !result?.equity_curve?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const eq = result.equity_curve.map(p => p.equity);
    const min = Math.min(...eq);
    const max = Math.max(...eq);
    const range = max - min || 1;
    const pad = 4;

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ui2-bg-sunken').trim() || '#0d0d10';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Area gradient
    const isPositive = eq[eq.length - 1] >= eq[0];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pad, h);
    for (let i = 0; i < eq.length; i++) {
      const x = pad + (i / (eq.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((eq[i] - min) / range) * (h - 2 * pad);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w - pad, h);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = isPositive ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < eq.length; i++) {
      const x = pad + (i / (eq.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((eq[i] - min) / range) * (h - 2 * pad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${max.toLocaleString()}`, w - 4, 14);
    ctx.fillText(`$${min.toLocaleString()}`, w - 4, h - 4);
  }, [result]);

  const selectCss: React.CSSProperties = {
    ...S.input, appearance: 'none', cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23a1a1aa' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    paddingRight: '30px',
  };

  const metricsKpi: KPIItem[] = result?.metrics ? [
    { id: 'return', label: 'Total Return', value: `${result.metrics.total_return_pct.toFixed(2)}%`, status: result.metrics.total_return_pct >= 0 ? 'success' : 'danger' },
    { id: 'sharpe', label: 'Sharpe Ratio', value: result.metrics.sharpe_ratio.toFixed(3), status: result.metrics.sharpe_ratio >= 1 ? 'success' : result.metrics.sharpe_ratio >= 0 ? 'warning' : 'danger' },
    { id: 'dd', label: 'Max Drawdown', value: `${result.metrics.max_drawdown_pct.toFixed(2)}%`, status: Math.abs(result.metrics.max_drawdown_pct) < 10 ? 'success' : Math.abs(result.metrics.max_drawdown_pct) < 25 ? 'warning' : 'danger' },
    { id: 'trades', label: 'Trades', value: String(result.metrics.total_trades), status: 'neutral' },
  ] : [];

  const tradeColumns: ColumnDef<typeof result extends null ? never : NonNullable<typeof result>['trades'][number]>[] = [
    { key: 'timestamp', label: 'Time', width: '120px', render: (_v, r) => <span style={{ fontSize: '11px' }}>{fmtDate(r.timestamp)}</span> },
    { key: 'side', label: 'Side', width: '60px', render: (_v, r) => <StatusBadge variant={r.side === 'buy' ? 'success' : 'danger'}>{r.side}</StatusBadge> },
    { key: 'symbol', label: 'Symbol', width: '70px' },
    { key: 'quantity', label: 'Qty', width: '60px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>{r.quantity}</span> },
    { key: 'price', label: 'Price', width: '80px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>${r.price.toFixed(2)}</span> },
    { key: 'fees', label: 'Fees', width: '60px', align: 'right', render: (_v, r) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', color: 'var(--ui2-text-tertiary)' }}>${r.fees.toFixed(2)}</span> },
    { key: 'pnl', label: 'PnL', width: '80px', align: 'right', render: (_v, r) => {
      if (r.pnl === null) return <span style={{ color: 'var(--ui2-text-muted)' }}>—</span>;
      const c = r.pnl >= 0 ? 'var(--ui2-positive)' : 'var(--ui2-negative)';
      return <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', fontWeight: 600, color: c }}>{r.pnl >= 0 ? '+' : ''}{r.pnl.toFixed(2)}</span>;
    }},
  ];

  return (
    <div style={S.sectionGap} data-testid="w14-backtest-tab">
      <div style={S.grid2}>
        {/* Config panel */}
        <Panel title="Backtest Configuration" subtitle="Bind strategy to immutable dataset"
          variant="elevated" padding="md" testId="w14-bt-config">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-3)' }}>
            {/* Dataset select */}
            <div>
              <label style={S.label}>Dataset</label>
              <select style={selectCss} value={datasetId}
                onChange={e => setDatasetId(e.target.value)} data-testid="w14-bt-dataset">
                <option value="">Select dataset…</option>
                {state.snapshots.map(s => (
                  <option key={s.dataset_id} value={s.dataset_id}>
                    {s.symbol} ({s.dataset_id}) — {fmtNum(s.row_count)} rows
                  </option>
                ))}
              </select>
            </div>

            {/* Strategy select */}
            <div>
              <label style={S.label}>Strategy</label>
              <select style={selectCss} value={strategyId}
                onChange={e => setStrategyId(e.target.value)} data-testid="w14-bt-strategy">
                {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Parameters */}
            <div style={S.grid3}>
              <div>
                <label style={S.label}>Capital</label>
                <input style={S.input} type="number" value={capital}
                  onChange={e => setCapital(e.target.value)} data-testid="w14-bt-capital" />
              </div>
              <div>
                <label style={S.label}>Slippage (bps)</label>
                <input style={S.input} type="number" value={slippage}
                  onChange={e => setSlippage(e.target.value)} data-testid="w14-bt-slippage" />
              </div>
              <div>
                <label style={S.label}>Fee/Trade</label>
                <input style={S.input} type="number" step="0.1" value={fee}
                  onChange={e => setFee(e.target.value)} data-testid="w14-bt-fee" />
              </div>
            </div>

            <Button variant="primary" fullWidth loading={state.backtestRunning}
              disabled={!datasetId || state.backtestRunning}
              onClick={handleRun} testId="w14-bt-run-btn">
              {state.backtestRunning ? 'Running Backtest…' : 'Run Backtest with Dataset'}
            </Button>
          </div>
        </Panel>

        {/* Dataset info panel */}
        <Panel title="Bound Dataset" variant="elevated" padding="md" testId="w14-bt-dataset-info">
          {selectedSnap ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={S.flexBetween}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{selectedSnap.symbol}</span>
                <StatusBadge variant="info">{selectedSnap.provider}</StatusBadge>
              </div>
              <div style={S.grid2}>
                <MetaCell label="Dataset ID" value={selectedSnap.dataset_id} testId="bt-ds-id" />
                <MetaCell label="Rows" value={fmtNum(selectedSnap.row_count)} testId="bt-ds-rows" />
                <MetaCell label="Range" value={`${fmtDate(selectedSnap.start_date)} → ${fmtDate(selectedSnap.end_date)}`} testId="bt-ds-range" />
                <MetaCell label="Created" value={fmtDateTime(selectedSnap.created_at)} testId="bt-ds-created" />
              </div>
              <div>
                <span style={S.label}>SHA-256</span>
                <code style={{ ...S.mono, fontSize: '10px', wordBreak: 'break-all' }}>{truncSha(selectedSnap.sha256, 32)}</code>
              </div>
            </div>
          ) : (
            <EmptyState title="No dataset selected" description="Choose a dataset from the dropdown." />
          )}
        </Panel>
      </div>

      {/* Error */}
      {state.backtestError && <div style={S.errorBox} data-testid="w14-bt-error">{state.backtestError}</div>}

      {/* Results */}
      {result && result.status === 'completed' && (
        <>
          {/* Provenance proof */}
          <Panel title="Provenance" variant="bordered" padding="sm" testId="w14-bt-provenance"
            status={<StatusBadge variant={result.provenance?.source === 'DATASET_SNAPSHOT' ? 'success' : 'warning'}>
              {result.provenance?.source || 'UNKNOWN'}
            </StatusBadge>}>
            <div style={S.grid4}>
              <MetaCell label="Source" value={result.provenance?.source ?? '—'} testId="bt-prov-source" />
              <MetaCell label="Dataset ID" value={result.provenance?.dataset_id ?? '—'} testId="bt-prov-dataset" />
              <MetaCell label="Config Hash" value={truncSha(result.config_hash, 12)} testId="bt-config-hash" />
              <MetaCell label="Run ID" value={result.run_id} testId="bt-run-id" />
            </div>
          </Panel>

          {/* KPI strip */}
          {metricsKpi.length > 0 && (
            <KPIStrip items={metricsKpi} variant="hero" testId="w14-bt-kpi" />
          )}

          {/* Equity curve */}
          {result.equity_curve.length > 0 && (
            <Panel title="Equity Curve" variant="elevated" padding="sm" testId="w14-bt-equity">
              <canvas ref={equityCanvasRef}
                style={{ width: '100%', height: '200px', borderRadius: 'var(--ui2-radius-sm)' }}
                data-testid="w14-bt-equity-canvas" />
            </Panel>
          )}

          {/* Detailed metrics */}
          {result.metrics && (
            <Panel title="Performance Metrics" variant="elevated" padding="md" testId="w14-bt-metrics">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--ui2-space-3)' }}>
                <MetricCell label="Total Return" value={`${result.metrics.total_return_pct.toFixed(2)}%`} positive={result.metrics.total_return_pct >= 0} />
                <MetricCell label="Sharpe Ratio" value={result.metrics.sharpe_ratio.toFixed(3)} positive={result.metrics.sharpe_ratio >= 0} />
                <MetricCell label="Max Drawdown" value={`${result.metrics.max_drawdown_pct.toFixed(2)}%`} positive={false} />
                <MetricCell label="Win Rate" value={`${result.metrics.win_rate_pct.toFixed(1)}%`} positive={result.metrics.win_rate_pct >= 50} />
                <MetricCell label="Profit Factor" value={result.metrics.profit_factor.toFixed(2)} positive={result.metrics.profit_factor >= 1} />
                <MetricCell label="Total Trades" value={String(result.metrics.total_trades)} />
                <MetricCell label="Final Equity" value={`$${fmtNum(Math.round(result.metrics.final_equity))}`} positive={result.metrics.final_equity >= Number(capital)} />
                <MetricCell label="Exposure" value={`${(result.metrics.exposure_pct ?? 0).toFixed(1)}%`} />
              </div>
            </Panel>
          )}

          {/* Trade log */}
          {result.trades.length > 0 && (
            <Panel title={`Trade Log — ${result.trades.length} trades`} variant="default" padding="none" testId="w14-bt-trades">
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                <DataTable
                  columns={tradeColumns}
                  data={result.trades}
                  keyField="trade_id"
                  density="compact"
                  testId="w14-bt-trades-table"
                />
              </div>
            </Panel>
          )}
        </>
      )}

      {result && result.status === 'failed' && (
        <div style={S.errorBox} data-testid="w14-bt-failed">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Backtest Failed</div>
          {result.error || 'Unknown error'}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div style={S.surface}>
      <div style={S.dimText}>{label}</div>
      <div style={{
        fontSize: '16px', fontWeight: 700, fontFamily: 'var(--ui2-font-mono)',
        color: positive === undefined ? 'var(--ui2-text-primary)' : positive ? 'var(--ui2-positive)' : 'var(--ui2-negative)',
        marginTop: '2px',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'create',    label: 'Create' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'integrity', label: 'Integrity' },
  { id: 'backtest',  label: 'Backtest' },
];

export function DatasetSnapshotUI2() {
  const [tab, setTab] = useState('dashboard');
  const [inspectId, setInspectId] = useState<string | undefined>();

  const handleInspect = useCallback((snap: DatasetSnapshotInfo) => {
    setInspectId(snap.dataset_id);
    setTab('inspector');
  }, []);

  return (
    <div
      data-testid="w14-dataset-snapshot-page"
      data-ready="true"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Dataset Snapshots"
          subtitle="W14 — Immutable dataset snapshot management with SHA-256 integrity verification"
          testId="w14-page-header"
        />
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs items={TABS} activeTab={tab} onTabChange={setTab} testId="w14-tabs" />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'snapshots' && <SnapshotsTab onInspect={handleInspect} />}
        {tab === 'create'    && <CreateTab />}
        {tab === 'inspector' && <InspectorTab initialId={inspectId} />}
        {tab === 'integrity' && <IntegrityTab />}
        {tab === 'backtest'  && <BacktestBindingTab />}
      </div>

      {/* Hidden sentinel for E2E */}
      <div data-testid="w14-ready" style={{ display: 'none' }} />
    </div>
  );
}
