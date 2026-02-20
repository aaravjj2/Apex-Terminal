/**
 * v1.60-v1.61 — BacktestUI2 Page (Enhanced with Run Submission)
 * Runs Manager + Offline Report Viewer + New Run Form (deterministic)
 */

import { useState, useSyncExternalStore } from 'react';
import { PageHeader, Tabs, DataTable, StatusBadge, type ColumnDef } from '../components';
import { DEMO_BACKTEST_RUNS, type BacktestRun } from '../demo/demoStore';
import { backtestDepthStore, type SweepConfig } from '../stores/backtestDepthStore';

// ── Deterministic runner ──────────────────────────────────────

function fnv32(data: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const BACKTEST_SYMBOLS = ['AAPL', 'AMZN', 'MSFT', 'NVDA', 'SPY', 'TSLA', 'GOOGL', 'META'];
const BACKTEST_STRATEGIES = ['strat-1', 'strat-2', 'strat-3', 'strat-4'];
const STRATEGY_LABELS: Record<string, string> = {
  'strat-1': 'RSI Oversold Bounce',
  'strat-2': 'Momentum + MACD',
  'strat-3': 'Mean Reversion VWAPBand',
  'strat-4': 'Breakout + Volume Filter',
};

function createDeterministicRun(symbol: string, strategyId: string, months: number): BacktestRun {
  const seed = fnv32(`${symbol}:${strategyId}:${months}`);
  const sharpeRatio = 0.5 + ((seed & 0xFF) / 255) * 2.5;        // 0.5 – 3.0
  const totalReturn = -5 + ((seed >> 8 & 0xFF) / 255) * 60;     // -5% – 55%
  const maxDrawdown = 3 + ((seed >> 16 & 0xFF) / 255) * 25;     // 3% – 28%
  const winRate = 40 + ((seed >> 24 & 0xFF) / 255) * 30;        // 40% – 70%
  const tradeCount = 10 + (seed % 90);                           // 10 – 99
  const now = 1771165800000; // DEMO_TIMESTAMP — deterministic "now"
  const msPerMonth = 30 * 86400000;
  const id = `bt-${seed.toString(16).slice(0, 8)}`;
  return {
    id,
    strategyId,
    symbol,
    startDate: now - msPerMonth * months,
    endDate: now - msPerMonth,
    status: 'completed',
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    totalReturn: Math.round(totalReturn * 10) / 10,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
    tradeCount,
    createdAt: now,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

export function BacktestUI2() {
  const [activeTab, setActiveTab] = useState('runs');
  const [runs, setRuns] = useState<BacktestRun[]>(DEMO_BACKTEST_RUNS);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterStrategy, setFilterStrategy] = useState('');

  // New Run form state
  const [newSymbol, setNewSymbol] = useState(BACKTEST_SYMBOLS[0]);
  const [newStrategy, setNewStrategy] = useState(BACKTEST_STRATEGIES[0]);
  const [newMonths, setNewMonths] = useState(12);
  const [submitResult, setSubmitResult] = useState<BacktestRun | null>(null);

  // Depth stores
  const depthState = useSyncExternalStore(backtestDepthStore.subscribe, backtestDepthStore.getSnapshot);
  const [sweepSymbol, setSweepSymbol] = useState(BACKTEST_SYMBOLS[0]);
  const [sweepStrategy, setSweepStrategy] = useState(BACKTEST_STRATEGIES[0]);
  const [wfSymbol, setWfSymbol] = useState(BACKTEST_SYMBOLS[0]);
  const [wfStrategy, setWfStrategy] = useState(BACKTEST_STRATEGIES[0]);
  const [robSymbol, setRobSymbol] = useState(BACKTEST_SYMBOLS[0]);
  const [robStrategy, setRobStrategy] = useState(BACKTEST_STRATEGIES[0]);
  const [activeSweepId, setActiveSweepId] = useState<string | null>(null);
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [activeRobId, setActiveRobId] = useState<string | null>(null);

  const filteredRuns = runs.filter(r => {
    if (filterSymbol && !r.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
    if (filterStrategy && !r.strategyId.toLowerCase().includes(filterStrategy.toLowerCase())) return false;
    return true;
  });

  const handleSubmitRun = () => {
    const run = createDeterministicRun(newSymbol, newStrategy, newMonths);
    // Only add if not duplicate (same run_id = same deterministic result)
    setRuns(prev => prev.find(r => r.id === run.id) ? prev : [...prev, run]);
    setSubmitResult(run);
  };

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
            { id: 'new-run', label: 'New Run' },
            { id: 'sweeps', label: 'Param Sweep' },
            { id: 'walkforward', label: 'Walk-Forward' },
            { id: 'robustness', label: 'Robustness' },
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

        {activeTab === 'new-run' && (
          <div data-testid="backtest-new-run-form">
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '4px' }}>
                Submit Backtest Run
              </div>

              {/* Symbol */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Symbol</label>
                <select
                  data-testid="backtest-new-symbol"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}
                >
                  {BACKTEST_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Strategy */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Strategy</label>
                <select
                  data-testid="backtest-new-strategy"
                  value={newStrategy}
                  onChange={e => setNewStrategy(e.target.value)}
                  style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}
                >
                  {BACKTEST_STRATEGIES.map(s => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Period */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Lookback Period</label>
                <select
                  data-testid="backtest-new-months"
                  value={newMonths}
                  onChange={e => setNewMonths(Number(e.target.value))}
                  style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}
                >
                  {[3, 6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} months</option>)}
                </select>
              </div>

              <button
                data-testid="backtest-submit-btn"
                onClick={handleSubmitRun}
                style={{
                  padding: '8px 20px', background: 'var(--ui2-brand-primary)', color: 'white',
                  border: 'none', borderRadius: 'var(--ui2-radius-md)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', alignSelf: 'flex-start',
                }}
              >
                Run Backtest
              </button>

              {/* Result */}
              {submitResult && (
                <div data-testid="backtest-submit-result" style={{
                  padding: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 'var(--ui2-radius-md)',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-success)', marginBottom: '8px' }}>
                    ✓ Backtest Queued: {submitResult.id}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', fontFamily: 'monospace', lineHeight: 1.8 }}>
                    <div>Symbol: <strong data-testid="backtest-result-symbol">{submitResult.symbol}</strong></div>
                    <div>Strategy: <strong data-testid="backtest-result-strategy">{submitResult.strategyId}</strong></div>
                    <div>Period: {formatDate(submitResult.startDate)} → {formatDate(submitResult.endDate)}</div>
                    <div>Sharpe: <strong data-testid="backtest-result-sharpe">{submitResult.sharpeRatio?.toFixed(2)}</strong></div>
                    <div>Return: <strong data-testid="backtest-result-return" style={{ color: (submitResult.totalReturn ?? 0) >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>
                      {(submitResult.totalReturn ?? 0) >= 0 ? '+' : ''}{submitResult.totalReturn?.toFixed(1)}%
                    </strong></div>
                    <div>Trades: <strong data-testid="backtest-result-trades">{submitResult.tradeCount}</strong></div>
                  </div>
                  <button
                    data-testid="backtest-view-new-run-btn"
                    onClick={() => { setSelectedRun(submitResult); setActiveTab('report'); }}
                    style={{
                      marginTop: '8px', padding: '6px 14px', background: 'var(--ui2-accent)', color: 'white',
                      border: 'none', borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    View Report →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Param Sweep Tab ── */}
        {activeTab === 'sweeps' && (
          <div data-testid="backtest-sweep-panel">
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '4px' }}>
                Parameter Sweep Builder
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Symbol</label>
                  <select data-testid="backtest-sweep-symbol" value={sweepSymbol} onChange={e => setSweepSymbol(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Strategy</label>
                  <select data-testid="backtest-sweep-strategy" value={sweepStrategy} onChange={e => setSweepStrategy(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_STRATEGIES.map(s => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div data-testid="backtest-sweep-params" style={{ padding: '12px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '8px' }}>Grid Parameters (fixed for determinism)</div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-secondary)', lineHeight: 1.6 }}>
                  <div>SMA Fast: 5 → 25 (step 5)</div>
                  <div>SMA Slow: 20 → 60 (step 10)</div>
                </div>
              </div>
              <button data-testid="backtest-sweep-run-btn" onClick={() => {
                const config: SweepConfig = {
                  sweep_id: `sweep-${fnv32(`${sweepSymbol}:${sweepStrategy}:sweep`).toString(16).slice(0, 8)}`,
                  symbol: sweepSymbol,
                  strategy_id: sweepStrategy,
                  params: [
                    { name: 'sma_fast', min: 5, max: 25, step: 5 },
                    { name: 'sma_slow', min: 20, max: 60, step: 10 },
                  ],
                  metric: 'sharpe',
                };
                const result = backtestDepthStore.runSweep(config);
                setActiveSweepId(result.sweep_id);
              }} style={{
                padding: '8px 20px', background: 'var(--ui2-brand-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--ui2-radius-md)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>Run Sweep</button>
            </div>

            {/* Sweep Results */}
            {activeSweepId && depthState.sweeps[activeSweepId] && (() => {
              const sweep = depthState.sweeps[activeSweepId];
              return (
                <div data-testid="backtest-sweep-results" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      Sweep Results — {sweep.cells.length} cells
                    </div>
                    <span data-testid="backtest-sweep-hash" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-muted)' }}>
                      Hash: {sweep.hash}
                    </span>
                  </div>

                  {/* Heatmap grid */}
                  <div data-testid="backtest-sweep-heatmap" style={{ overflowX: 'auto', marginBottom: '16px' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 10px', color: 'var(--ui2-text-muted)', textAlign: 'left' }}>Fast \ Slow</th>
                          {[20, 30, 40, 50, 60].map(v => (
                            <th key={v} style={{ padding: '6px 10px', color: 'var(--ui2-text-muted)', textAlign: 'center' }}>{v}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[5, 10, 15, 20, 25].map(fast => (
                          <tr key={fast}>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{fast}</td>
                            {[20, 30, 40, 50, 60].map(slow => {
                              const cell = sweep.cells.find(c => c.param_values['sma_fast'] === fast && c.param_values['sma_slow'] === slow);
                              const sharpe = cell?.sharpe ?? 0;
                              const bg = sharpe > 1.5 ? 'rgba(34,197,94,0.25)' : sharpe > 0.5 ? 'rgba(34,197,94,0.1)' : sharpe > 0 ? 'rgba(250,204,21,0.15)' : 'rgba(239,68,68,0.15)';
                              return (
                                <td key={slow} data-testid={`backtest-sweep-cell-${fast}-${slow}`} style={{
                                  padding: '8px 12px', textAlign: 'center', background: bg,
                                  border: '1px solid var(--ui2-border)',
                                  fontWeight: cell?.cell_id === sweep.best_cell_id ? 700 : 400,
                                  color: cell?.cell_id === sweep.best_cell_id ? 'var(--ui2-accent)' : 'var(--ui2-text-primary)',
                                }}>
                                  {sharpe.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Best cell */}
                  <div data-testid="backtest-sweep-best" style={{
                    padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 'var(--ui2-radius-sm)', fontSize: '12px', marginBottom: '12px',
                  }}>
                    Best: {sweep.best_cell_id} — Sharpe {sweep.cells.find(c => c.cell_id === sweep.best_cell_id)?.sharpe.toFixed(2)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Walk-Forward Tab ── */}
        {activeTab === 'walkforward' && (
          <div data-testid="backtest-wf-panel">
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>Walk-Forward Validation</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Symbol</label>
                  <select data-testid="backtest-wf-symbol" value={wfSymbol} onChange={e => setWfSymbol(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Strategy</label>
                  <select data-testid="backtest-wf-strategy" value={wfStrategy} onChange={e => setWfStrategy(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_STRATEGIES.map(s => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <button data-testid="backtest-wf-run-btn" onClick={() => {
                const result = backtestDepthStore.runWalkForward(wfSymbol, wfStrategy);
                setActiveWfId(result.wf_id);
              }} style={{
                padding: '8px 20px', background: 'var(--ui2-brand-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--ui2-radius-md)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>Run Walk-Forward</button>
            </div>

            {activeWfId && depthState.walkForwards[activeWfId] && (() => {
              const wf = depthState.walkForwards[activeWfId];
              return (
                <div data-testid="backtest-wf-results" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      Walk-Forward Results — {wf.windows.length} windows
                    </div>
                    <span data-testid="backtest-wf-hash" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-muted)' }}>
                      Hash: {wf.hash}
                    </span>
                  </div>

                  {/* Summary */}
                  <div data-testid="backtest-wf-summary" style={{
                    display: 'flex', gap: '16px', padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
                    borderRadius: 'var(--ui2-radius-md)',
                  }}>
                    <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>OOS Sharpe</span><br/>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ui2-text-primary)' }}>{wf.aggregate_sharpe.toFixed(2)}</span></div>
                    <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>OOS Return</span><br/>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: wf.aggregate_return >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{wf.aggregate_return.toFixed(2)}%</span></div>
                    <div><span style={{ fontSize: '11px', color: 'var(--ui2-text-muted)' }}>OOS Degradation</span><br/>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: wf.oos_degradation > 50 ? 'var(--ui2-danger)' : 'var(--ui2-text-primary)' }}>{wf.oos_degradation.toFixed(1)}%</span></div>
                  </div>

                  {/* Windows table */}
                  <table data-testid="backtest-wf-windows" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Train</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Test</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>IS Sharpe</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>OOS Sharpe</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>IS Return</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>OOS Return</th>
                    </tr></thead>
                    <tbody>
                      {wf.windows.map(w => (
                        <tr key={w.window_id} data-testid={`backtest-wf-window-${w.window_id}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-primary)', fontWeight: 600 }}>{w.window_id}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-secondary)', fontSize: '11px' }}>{w.train_start} → {w.train_end}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-secondary)', fontSize: '11px' }}>{w.test_start} → {w.test_end}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-primary)' }}>{w.in_sample_sharpe.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: w.out_of_sample_sharpe >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{w.out_of_sample_sharpe.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>{w.in_sample_return.toFixed(2)}%</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: w.out_of_sample_return >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{w.out_of_sample_return.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Robustness Tab ── */}
        {activeTab === 'robustness' && (
          <div data-testid="backtest-rob-panel">
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>Robustness Checks</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Symbol</label>
                  <select data-testid="backtest-rob-symbol" value={robSymbol} onChange={e => setRobSymbol(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', display: 'block', marginBottom: '4px' }}>Strategy</label>
                  <select data-testid="backtest-rob-strategy" value={robStrategy} onChange={e => setRobStrategy(e.target.value)}
                    style={{ padding: '6px 10px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px', width: '100%' }}>
                    {BACKTEST_STRATEGIES.map(s => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <button data-testid="backtest-rob-run-btn" onClick={() => {
                const result = backtestDepthStore.runRobustness(robSymbol, robStrategy);
                setActiveRobId(result.rob_id);
              }} style={{
                padding: '8px 20px', background: 'var(--ui2-brand-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--ui2-radius-md)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>Run Robustness</button>
            </div>

            {activeRobId && depthState.robustness[activeRobId] && (() => {
              const rob = depthState.robustness[activeRobId];
              return (
                <div data-testid="backtest-rob-results" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                      Robustness Score: <span style={{ color: rob.robustness_score >= 75 ? 'var(--ui2-success)' : rob.robustness_score >= 50 ? 'var(--ui2-warning, #f59e0b)' : 'var(--ui2-danger)' }}>{rob.robustness_score}%</span>
                    </div>
                    <span data-testid="backtest-rob-hash" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--ui2-text-muted)' }}>
                      Hash: {rob.hash}
                    </span>
                  </div>

                  <table data-testid="backtest-rob-scenarios" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Scenario</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Fee×</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Slip×</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Delay</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Sharpe</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>ΔSharpe</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-muted)' }}>Return</th>
                    </tr></thead>
                    <tbody>
                      {rob.scenarios.map((s, i) => (
                        <tr key={s.scenario_id} data-testid={`backtest-rob-scenario-${i}`} style={{ borderBottom: '1px solid var(--ui2-border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--ui2-text-primary)', fontWeight: s.label === 'Base Case' ? 700 : 400 }}>{s.label}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>{s.fee_multiplier}×</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>{s.slippage_multiplier}×</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ui2-text-secondary)' }}>{s.delay_ms}ms</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: s.sharpe >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{s.sharpe.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: s.delta_sharpe >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{s.delta_sharpe >= 0 ? '+' : ''}{s.delta_sharpe.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: s.total_return >= 0 ? 'var(--ui2-success)' : 'var(--ui2-danger)' }}>{s.total_return.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <div data-testid="backtest-ready" style={{ display: 'none' }} />
    </div>
  );
}
