/**
 * Unified Run Ledger Panel (v1.5 A1 + A2)
 * - Ledger subtab: merged table of Risk + Backtest runs
 * - Compare subtab: overlay comparison of 2-4 selected runs
 */

import { useState, useEffect, useCallback } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from 'recharts';
import type { UnifiedRun, LedgerFilters, RunType, DateFilter } from './types';
import { formatNumberSafe, formatCurrencySafe, formatPercentSafe } from '../../../utils/formatters';

type RunsSubTab = 'ledger' | 'compare';

const COMPARE_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444'];

export function RunsPanel() {
  const [subTab, setSubTab] = useState<RunsSubTab>('ledger');
  const [runs, setRuns] = useState<UnifiedRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [compareData, setCompareData] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [filters, setFilters] = useState<LedgerFilters>({
    runType: 'all',
    dateFilter: 'all',
    search: '',
  });

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.runType !== 'all') params.set('run_type', filters.runType);
      if (filters.dateFilter !== 'all') params.set('date_filter', filters.dateFilter);
      if (filters.search) params.set('search', filters.search);
      const url = `/api/unified-runs${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to fetch unified runs:', e);
      setError(e.message || 'Failed to load runs');
      // Demo fallback data
      setRuns(getDemoRuns());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else if (next.size < 4) {
        next.add(runId);
      }
      return next;
    });
  };

  const canCompare = selectedRunIds.size >= 2 && selectedRunIds.size <= 4;

  const handleCompare = useCallback(async () => {
    if (!canCompare) return;
    setCompareLoading(true);
    const selected = runs.filter(r => selectedRunIds.has(r.run_id));
    // Build comparison data from selected runs
    const comparisonMetrics = selected.map((run, idx) => ({
      run_id: run.run_id.slice(0, 8),
      run_type: run.run_type,
      scenario_or_strategy: run.scenario_or_strategy,
      color: COMPARE_COLORS[idx],
      worst_case_pnl: run.key_metrics.worst_case_pnl ?? null,
      total_return_pct: run.key_metrics.total_return_pct ?? null,
      max_drawdown_pct: run.key_metrics.max_drawdown_pct ?? null,
      sharpe_ratio: run.key_metrics.sharpe_ratio ?? null,
      max_loss: run.key_metrics.max_loss ?? null,
    }));

    setCompareData({
      runs: selected,
      metrics: comparisonMetrics,
    });
    setCompareLoading(false);
    setSubTab('compare');
  }, [canCompare, runs, selectedRunIds]);

  const subTabs = [
    { id: 'ledger' as const, label: 'Ledger' },
    { id: 'compare' as const, label: `Compare${canCompare ? ` (${selectedRunIds.size})` : ''}`, disabled: !canCompare && subTab !== 'compare' },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-500/20 text-green-400',
      blocked: 'bg-yellow-500/20 text-yellow-400',
      error: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const typeBadge = (type: RunType) => {
    const colors: Record<string, string> = {
      risk: 'bg-blue-500/20 text-blue-400',
      backtest: 'bg-purple-500/20 text-purple-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || ''}`}>
        {type.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="runs-panel">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-panel-bg">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'compare' && canCompare) handleCompare();
              else if (tab.id === 'ledger') setSubTab('ledger');
            }}
            disabled={tab.disabled}
            data-testid={`runs-subtab-${tab.id}`}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              subTab === tab.id
                ? 'bg-brand text-white'
                : tab.disabled
                ? 'bg-element-bg text-text-muted cursor-not-allowed opacity-50'
                : 'bg-element-bg text-text-secondary hover:text-text hover:bg-element-bg/80'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {selectedRunIds.size > 0 && (
          <button
            onClick={() => setSelectedRunIds(new Set())}
            className="ml-2 px-3 py-1.5 text-xs bg-element-bg text-text-secondary hover:text-text rounded"
            data-testid="runs-clear-selection"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {subTab === 'ledger' ? (
          <LedgerView
            runs={runs}
            loading={loading}
            error={error}
            filters={filters}
            setFilters={setFilters}
            selectedRunIds={selectedRunIds}
            toggleRunSelection={toggleRunSelection}
            statusBadge={statusBadge}
            typeBadge={typeBadge}
            onRefresh={fetchRuns}
          />
        ) : (
          <CompareView
            compareData={compareData}
            loading={compareLoading}
            statusBadge={statusBadge}
            typeBadge={typeBadge}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Ledger View ──────────────────────────────────────────── */
interface LedgerViewProps {
  runs: UnifiedRun[];
  loading: boolean;
  error: string | null;
  filters: LedgerFilters;
  setFilters: (f: LedgerFilters) => void;
  selectedRunIds: Set<string>;
  toggleRunSelection: (id: string) => void;
  statusBadge: (status: string) => React.ReactElement;
  typeBadge: (type: RunType) => React.ReactElement;
  onRefresh: () => void;
}

function LedgerView({
  runs, loading, error, filters, setFilters,
  selectedRunIds, toggleRunSelection, statusBadge, typeBadge, onRefresh,
}: LedgerViewProps) {
  return (
    <div className="space-y-4" data-testid="runs-ledger">
      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="runs-filters">
        <select
          value={filters.runType}
          onChange={e => setFilters({ ...filters, runType: e.target.value as RunType | 'all' })}
          className="px-3 py-1.5 bg-element-bg border border-border rounded text-sm text-text focus:ring-1 focus:ring-brand"
          data-testid="runs-filter-type"
        >
          <option value="all">All Types</option>
          <option value="risk">Risk Only</option>
          <option value="backtest">Backtest Only</option>
        </select>

        <select
          value={filters.dateFilter}
          onChange={e => setFilters({ ...filters, dateFilter: e.target.value as DateFilter })}
          className="px-3 py-1.5 bg-element-bg border border-border rounded text-sm text-text focus:ring-1 focus:ring-brand"
          data-testid="runs-filter-date"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <input
          type="text"
          placeholder="Search by run ID or strategy..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="px-3 py-1.5 bg-element-bg border border-border rounded text-sm text-text w-64 focus:ring-1 focus:ring-brand"
          data-testid="runs-filter-search"
        />

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand rounded text-sm font-medium transition-colors"
          data-testid="runs-refresh"
        >
          Refresh
        </button>

        <span className="text-xs text-text-secondary ml-auto" data-testid="runs-count">
          {runs.length} run{runs.length !== 1 ? 's' : ''}
          {selectedRunIds.size > 0 && ` · ${selectedRunIds.size} selected`}
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-text-secondary animate-pulse">Loading runs...</div>
      )}

      {/* Empty State */}
      {!loading && runs.length === 0 && (
        <div className="text-center py-12" data-testid="runs-empty">
          <div className="text-text-secondary text-lg mb-2">No runs found</div>
          <div className="text-text-muted text-sm">
            Run a Risk Desk scenario or Backtest to see results here.
          </div>
        </div>
      )}

      {/* Runs Table */}
      {!loading && runs.length > 0 && (
        <div className="bg-panel-bg border border-border rounded overflow-hidden">
          <table className="w-full" data-testid="runs-table">
            <thead className="bg-element-bg">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary w-10">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Run ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Created</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Scenario / Strategy</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Hash</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Key Metrics</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const isSelected = selectedRunIds.has(run.run_id);
                return (
                  <tr
                    key={run.run_id}
                    className={`border-t border-border hover:bg-element-bg/50 cursor-pointer ${
                      isSelected ? 'bg-brand/5' : ''
                    }`}
                    onClick={() => toggleRunSelection(run.run_id)}
                    data-testid={`runs-row-${run.run_id}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRunSelection(run.run_id)}
                        className="rounded border-border"
                        data-testid={`runs-checkbox-${run.run_id}`}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">{typeBadge(run.run_type)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text" data-testid="run-id-cell">
                      {run.run_id.slice(0, 12)}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-secondary">
                      {formatDate(run.created_at)}
                    </td>
                    <td className="px-3 py-2 text-sm text-text">{run.scenario_or_strategy}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-muted">{run.determinism_hash}</td>
                    <td className="px-3 py-2 text-xs text-text">
                      <MetricsSummary run={run} />
                    </td>
                    <td className="px-3 py-2">{statusBadge(run.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Metrics Summary ──────────────────────────────────────── */
function MetricsSummary({ run }: { run: UnifiedRun }) {
  const m = run.key_metrics;
  if (run.run_type === 'risk') {
    return (
      <span data-testid="metric-summary">
        PnL: <span className={`font-mono ${(m.worst_case_pnl ?? 0) < 0 ? 'text-down' : 'text-up'}`}>
          {formatCurrencySafe(m.worst_case_pnl)}
        </span>
      </span>
    );
  }
  return (
    <span data-testid="metric-summary">
      Ret: <span className={`font-mono ${(m.total_return_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
        {formatPercentSafe(m.total_return_pct)}
      </span>
      {' · '}
      SR: <span className="font-mono">{formatNumberSafe(m.sharpe_ratio)}</span>
    </span>
  );
}

/* ─── Compare View ─────────────────────────────────────────── */
interface CompareViewProps {
  compareData: any;
  loading: boolean;
  statusBadge: (status: string) => React.ReactElement;
  typeBadge: (type: RunType) => React.ReactElement;
}

function CompareView({ compareData, loading, statusBadge, typeBadge }: CompareViewProps) {
  if (loading) {
    return <div className="text-center py-8 text-text-secondary animate-pulse">Loading comparison...</div>;
  }
  if (!compareData || !compareData.metrics) {
    return (
      <div className="text-center py-12 text-text-secondary" data-testid="compare-empty">
        Select 2-4 runs in the Ledger and click Compare to begin.
      </div>
    );
  }

  const { metrics, runs: selectedRuns } = compareData;

  // Separate risk and backtest runs for type-appropriate charts
  const riskRuns = metrics.filter((m: any) => m.run_type === 'risk');
  const backtestRuns = metrics.filter((m: any) => m.run_type === 'backtest');
  const hasMixed = riskRuns.length > 0 && backtestRuns.length > 0;

  return (
    <div className="space-y-6" data-testid="runs-compare">
      {/* Run Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m: any, idx: number) => (
          <div
            key={m.run_id}
            className="bg-panel-bg border border-border rounded p-4"
            style={{ borderLeftColor: m.color, borderLeftWidth: 4 }}
            data-testid={`compare-card-${idx}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {typeBadge(m.run_type)}
              {statusBadge(selectedRuns[idx]?.status || 'success')}
            </div>
            <div className="font-mono text-sm text-text mb-1">{m.run_id}</div>
            <div className="text-xs text-text-secondary">{m.scenario_or_strategy}</div>
          </div>
        ))}
      </div>

      {/* Metric Comparison Table */}
      <div className="bg-panel-bg border border-border rounded p-4" data-testid="compare-metrics-table">
        <h3 className="text-sm font-semibold text-text mb-3">Metric Comparison</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-2 px-3">Metric</th>
              {metrics.map((m: any) => (
                <th key={m.run_id} className="text-right py-2 px-3">
                  <span style={{ color: m.color }}>{m.run_id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-text">
            {riskRuns.length > 0 && (
              <tr className="border-t border-border/30">
                <td className="py-2 px-3 text-text-secondary">Worst-Case PnL</td>
                {metrics.map((m: any) => (
                  <td key={m.run_id} className="text-right py-2 px-3 font-mono">
                    {m.run_type === 'risk' ? formatCurrencySafe(m.worst_case_pnl) : '—'}
                  </td>
                ))}
              </tr>
            )}
            {backtestRuns.length > 0 && (
              <>
                <tr className="border-t border-border/30">
                  <td className="py-2 px-3 text-text-secondary">Total Return</td>
                  {metrics.map((m: any) => (
                    <td key={m.run_id} className="text-right py-2 px-3 font-mono">
                      {m.run_type === 'backtest' ? formatPercentSafe(m.total_return_pct) : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border/30">
                  <td className="py-2 px-3 text-text-secondary">Max Drawdown</td>
                  {metrics.map((m: any) => (
                    <td key={m.run_id} className="text-right py-2 px-3 font-mono">
                      {m.run_type === 'backtest' ? formatPercentSafe(m.max_drawdown_pct) : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border/30">
                  <td className="py-2 px-3 text-text-secondary">Sharpe Ratio</td>
                  {metrics.map((m: any) => (
                    <td key={m.run_id} className="text-right py-2 px-3 font-mono">
                      {m.run_type === 'backtest' ? formatNumberSafe(m.sharpe_ratio) : '—'}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Stress PnL Bar Chart (Risk runs) */}
      {riskRuns.length > 0 && (
        <div className="bg-panel-bg border border-border rounded p-4" data-testid="compare-risk-chart">
          <h3 className="text-sm font-semibold text-text mb-3">Stress PnL Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={riskRuns} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="run_id" stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-element)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                }}
              />
              <Bar dataKey="worst_case_pnl" name="Worst-Case PnL">
                {riskRuns.map((entry: any, idx: number) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Return / Drawdown Comparison (Backtest runs) */}
      {backtestRuns.length > 0 && (
        <div className="bg-panel-bg border border-border rounded p-4" data-testid="compare-backtest-chart">
          <h3 className="text-sm font-semibold text-text mb-3">Return vs Drawdown Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={backtestRuns} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="run_id" stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-element)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                }}
              />
              <Legend />
              <Bar dataKey="total_return_pct" name="Return %" fill="#10b981" />
              <Bar dataKey="max_drawdown_pct" name="Max DD %" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mixed-type notice */}
      {hasMixed && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm text-yellow-400" data-testid="compare-mixed-notice">
          Mixed run types selected. Only metric diff is shown — overlay equity curves are available for same-type runs.
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function getDemoRuns(): UnifiedRun[] {
  const now = new Date();
  return [
    {
      run_type: 'risk',
      run_id: 'risk-demo-001',
      created_at: now.toISOString(),
      scenario_or_strategy: 'SPY -20% Crash',
      determinism_hash: 'a1b2c3d4e5f6',
      key_metrics: { worst_case_pnl: -15420.50, max_loss: -15420.50 },
      status: 'success',
    },
    {
      run_type: 'risk',
      run_id: 'risk-demo-002',
      created_at: new Date(now.getTime() - 3600000).toISOString(),
      scenario_or_strategy: 'Vol Spike +50%',
      determinism_hash: 'f6e5d4c3b2a1',
      key_metrics: { worst_case_pnl: -8200.00, max_loss: -8200.00 },
      status: 'blocked',
    },
    {
      run_type: 'backtest',
      run_id: 'bt-demo-001',
      created_at: new Date(now.getTime() - 7200000).toISOString(),
      scenario_or_strategy: 'iron_condor',
      determinism_hash: '112233445566',
      key_metrics: { total_return_pct: 12.45, max_drawdown_pct: -5.20, sharpe_ratio: 1.85 },
      status: 'success',
    },
    {
      run_type: 'backtest',
      run_id: 'bt-demo-002',
      created_at: new Date(now.getTime() - 10800000).toISOString(),
      scenario_or_strategy: 'covered_call',
      determinism_hash: '665544332211',
      key_metrics: { total_return_pct: 8.30, max_drawdown_pct: -3.10, sharpe_ratio: 2.10 },
      status: 'success',
    },
    {
      run_type: 'risk',
      run_id: 'risk-demo-003',
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      scenario_or_strategy: 'Rates +200bps',
      determinism_hash: 'aabbccddeeff',
      key_metrics: { worst_case_pnl: -3580.00, max_loss: -3580.00 },
      status: 'success',
    },
  ];
}
