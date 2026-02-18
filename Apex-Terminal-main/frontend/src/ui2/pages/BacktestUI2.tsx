/**
 * v1.60 — BacktestUI2 Page (Enhanced)
 * Runs Manager + Offline Report Viewer Integration
 */

import { useState } from 'react';
import { PageHeader, Tabs, DataTable, StatusBadge, type ColumnDef } from '../components';
import { DEMO_BACKTEST_RUNS, type BacktestRun } from '../demo/demoStore';

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

export function BacktestUI2() {
  const [activeTab, setActiveTab] = useState('runs');
  const [runs] = useState<BacktestRun[]>(DEMO_BACKTEST_RUNS);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterStrategy, setFilterStrategy] = useState('');

  const filteredRuns = runs.filter(r => {
    if (filterSymbol && !r.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
    if (filterStrategy && !r.strategyId.toLowerCase().includes(filterStrategy.toLowerCase())) return false;
    return true;
  });

  const runColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'id', label: 'Run ID', width: '100px' },
    { key: 'symbol', label: 'Symbol', width: '80px' },
    { key: 'strategyId', label: 'Strategy', width: '100px' },
    { key: 'status', label: 'Status', width: '100px', render: (_v: unknown, row: Record<string, unknown>) => {
      const st = row['status'] as string;
      const variant = st === 'completed' ? 'success' : st === 'running' ? 'working' : st === 'failed' ? 'danger' : 'neutral';
      return <StatusBadge variant={variant} testId={`backtest-status-${row['id']}`}>{st}</StatusBadge>;
    }},
    { key: 'sharpeRatio', label: 'Sharpe', width: '80px', render: (v: unknown) => v != null ? (v as number).toFixed(2) : '-' },
    { key: 'totalReturn', label: 'Return %', width: '80px', render: (v: unknown) => {
      if (v == null) return '-';
      const n = v as number;
      return <span style={{ color: n >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>+{n.toFixed(1)}%</span>;
    }},
    { key: 'maxDrawdown', label: 'Max DD', width: '80px', render: (v: unknown) => v != null ? `${v}%` : '-' },
    { key: 'winRate', label: 'Win Rate', width: '80px', render: (v: unknown) => v != null ? `${v}%` : '-' },
    { key: 'tradeCount', label: 'Trades', width: '70px' },
    { key: 'id', label: 'Action', width: '80px', render: (_v: unknown, row: Record<string, unknown>) => (
      <button
        data-testid={`backtest-open-${row['id']}`}
        onClick={() => {
          const run = runs.find(r => r.id === row['id']);
          if (run) { setSelectedRun(run); setActiveTab('report'); }
        }}
        style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--ui2-brand-primary)', color: 'white', border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer' }}
      >
        Open
      </button>
    )},
  ];

  return (
    <div data-testid="backtest-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Backtest"
          subtitle="Run manager, results, and offline report viewer"
          icon="B"
          testId="backtest-header"
        />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'runs', label: 'Runs Manager' },
            { id: 'report', label: 'Report Viewer' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="backtest-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'runs' && (
          <div data-testid="backtest-runs-manager">
            {/* Filters */}
            <div data-testid="backtest-filters" style={{
              display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center',
            }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginRight: '6px' }}>Symbol:</label>
                <input data-testid="backtest-filter-symbol" value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)}
                  placeholder="Filter..." style={{ padding: '4px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px', width: '100px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginRight: '6px' }}>Strategy:</label>
                <input data-testid="backtest-filter-strategy" value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)}
                  placeholder="Filter..." style={{ padding: '4px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '12px', width: '100px' }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)' }}>
                {filteredRuns.length} of {runs.length} runs
              </div>
            </div>

            <DataTable data={filteredRuns as any} columns={runColumns} keyField="id" testId="backtest-runs-table" />
          </div>
        )}

        {activeTab === 'report' && (
          <div data-testid="backtest-report-viewer">
            {selectedRun ? (
              <div data-testid="backtest-report-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      Run: {selectedRun.id}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>
                      {selectedRun.symbol} | Strategy: {selectedRun.strategyId} | {formatDate(selectedRun.startDate)} to {formatDate(selectedRun.endDate)}
                    </div>
                  </div>
                  <StatusBadge variant={selectedRun.status === 'completed' ? 'success' : 'neutral'} testId="backtest-report-status">
                    {selectedRun.status}
                  </StatusBadge>
                </div>

                {/* Provenance Section */}
                <div data-testid="backtest-report-provenance" style={{
                  padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                  borderRadius: 'var(--ui2-radius-md)', marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>
                    Provenance
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', lineHeight: 1.8, fontFamily: 'monospace' }}>
                    <div>Run ID: {selectedRun.id}</div>
                    <div>Strategy: {selectedRun.strategyId}</div>
                    <div>Symbol: {selectedRun.symbol}</div>
                    <div>Period: {formatDate(selectedRun.startDate)} to {formatDate(selectedRun.endDate)}</div>
                    <div>Created: {new Date(selectedRun.createdAt).toISOString()}</div>
                    <div>Status: {selectedRun.status}</div>
                  </div>
                </div>

                {/* Results Summary */}
                {selectedRun.status === 'completed' && (
                  <div data-testid="backtest-report-results" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px',
                  }}>
                    {[
                      { label: 'Sharpe Ratio', value: selectedRun.sharpeRatio?.toFixed(2) || '-' },
                      { label: 'Total Return', value: selectedRun.totalReturn ? `+${selectedRun.totalReturn.toFixed(1)}%` : '-' },
                      { label: 'Max Drawdown', value: selectedRun.maxDrawdown ? `${selectedRun.maxDrawdown.toFixed(1)}%` : '-' },
                      { label: 'Win Rate', value: selectedRun.winRate ? `${selectedRun.winRate.toFixed(1)}%` : '-' },
                      { label: 'Trade Count', value: String(selectedRun.tradeCount || 0) },
                    ].map((stat, i) => (
                      <div key={i} data-testid={`backtest-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`} style={{
                        padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                        borderRadius: 'var(--ui2-radius-md)', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div data-testid="backtest-report-empty" style={{ padding: '40px', textAlign: 'center', color: 'var(--ui2-text-muted)', fontSize: '13px' }}>
                Select a run from the Runs Manager tab to view its report.
              </div>
            )}
          </div>
        )}
      </div>
      <div data-testid="backtest-ready" style={{ display: 'none' }} />
    </div>
  );
}
