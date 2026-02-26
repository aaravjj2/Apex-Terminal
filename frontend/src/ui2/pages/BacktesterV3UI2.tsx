/**
 * BacktesterV3UI2 — Execution Calibration Backtester
 *
 * Production-grade terminal interface for Wave 14 backtester with:
 *  1. Run Tab        — Strategy config + execution model + run
 *  2. Results Tab    — KPI metrics, trade log, execution model details
 *  3. Calibration Tab — Backtest-vs-paper comparison calibration
 *  4. Data Quality Tab — Survivorship & incomplete-history warnings
 *
 * Uses shared ui2 components: PageHeader, Tabs, Panel, KPIStrip, DataTable,
 * Button, StatusBadge, EmptyState, Skeleton, ProgressBar
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  PageHeader, Tabs, Panel, DataTable, StatusBadge, KPIStrip, Button, EmptyState, Skeleton,
} from '../components';
import type { ColumnDef, KPIItem } from '../components';
import { backtesterV3Store } from '../stores/waves11_20Store';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string { return n.toLocaleString('en-US'); }
function fmtPct(n: number, mult = 1): string { return `${(n * mult).toFixed(2)}%`; }
function fmtDollars(n: number): string { return `$${fmtNum(Math.round(n))}`; }

// ── Shared Styles ───────────────────────────────────────────────────────────

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
  dimText:   { fontSize: '11px', color: 'var(--ui2-text-muted)' } as React.CSSProperties,
  errorBox:  { background: 'var(--ui2-danger-bg)', border: '1px solid var(--ui2-danger-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-danger)', fontSize: '13px' } as React.CSSProperties,
  successBox: { background: 'var(--ui2-success-bg)', border: '1px solid var(--ui2-success-border)', borderRadius: 'var(--ui2-radius-sm)', padding: 'var(--ui2-space-3)', color: 'var(--ui2-success)', fontSize: '13px' } as React.CSSProperties,
};

const selectCss: React.CSSProperties = {
  ...S.input, appearance: 'none', cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23a1a1aa' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px',
};

// ── Strategies ──────────────────────────────────────────────────────────────

const STRATEGIES = [
  { id: 'sma-crossover',       name: 'SMA Crossover 20/50',  desc: 'Buy when SMA(20) > SMA(50), sell on reverse', type: 'crossover',       tags: ['trend'] },
  { id: 'rsi-mean-reversion',  name: 'RSI Mean Reversion',   desc: 'Buy RSI < 30, sell RSI > 70',                 type: 'mean_reversion',  tags: ['mean-reversion'] },
  { id: 'ema-crossover',       name: 'EMA Crossover 12/26',  desc: 'Buy when EMA(12) > EMA(26), sell on reverse', type: 'crossover',       tags: ['trend'] },
  { id: 'breakout-20d',        name: '20-Day Breakout',      desc: 'Buy above 20d high, sell below 20d low',      type: 'breakout',        tags: ['breakout'] },
];

// ── Sub components ──────────────────────────────────────────────────────────

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.flexBetween}>
      <span style={S.dimText}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ui2-text-primary)' }}>{value}</span>
    </div>
  );
}

// ── 1. RUN TAB ──────────────────────────────────────────────────────────────

function RunTab({ onResultReady }: { onResultReady: () => void }) {
  const state = useSyncExternalStore(backtesterV3Store.subscribe, backtesterV3Store.getState);

  const [symbol, setSymbol] = useState('AAPL');
  const [strategyId, setStrategyId] = useState('sma-crossover');
  const [capital, setCapital] = useState('100000');
  const [fee, setFee] = useState('1.0');
  const [slippage, setSlippage] = useState('5.0');
  const [spread, setSpread] = useState('2.0');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedStrat = STRATEGIES.find(s => s.id === strategyId);
  const canRun = symbol.length >= 1 && startDate && endDate && startDate < endDate;

  const handleRun = useCallback(async () => {
    await backtesterV3Store.runBacktest({
      symbol: symbol.toUpperCase(),
      strategy_id: strategyId,
      strategy_name: selectedStrat?.name ?? strategyId,
      start_date: startDate,
      end_date: endDate,
      initial_capital: Number(capital),
      fee_per_trade: Number(fee),
      slippage_bps: Number(slippage),
      spread_bps: Number(spread),
    });
    // Automatically switch to results tab if we got a result
    const s = backtesterV3Store.getState();
    if (s.result && !s.error) onResultReady();
  }, [symbol, strategyId, selectedStrat, startDate, endDate, capital, fee, slippage, spread, onResultReady]);

  return (
    <div style={S.sectionGap} data-testid="bt3-run-tab">
      <div style={S.grid2}>
        {/* Config panel */}
        <Panel title="Strategy Configuration" subtitle="Select strategy and parameters"
          variant="elevated" padding="md" testId="bt3-config-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-3)' }}>
            <div>
              <label style={S.label}>Symbol</label>
              <input
                style={S.input}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={10}
                data-testid="bt3-symbol"
              />
            </div>

            <div>
              <label style={S.label}>Strategy</label>
              <select style={selectCss} value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)} data-testid="bt3-strategy">
                {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {selectedStrat && (
              <div style={{ ...S.surface, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>{selectedStrat.desc}</div>
                <div style={S.flex}>
                  <StatusBadge variant="info">{selectedStrat.type}</StatusBadge>
                  {selectedStrat.tags.map(t => (
                    <StatusBadge key={t} variant="neutral">{t}</StatusBadge>
                  ))}
                </div>
              </div>
            )}

            <div style={S.grid2}>
              <div>
                <label style={S.label}>Start Date</label>
                <input type="date" style={S.input} value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} data-testid="bt3-start-date" />
              </div>
              <div>
                <label style={S.label}>End Date</label>
                <input type="date" style={S.input} value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} data-testid="bt3-end-date" />
              </div>
            </div>

            <div>
              <label style={S.label}>Initial Capital</label>
              <input type="number" style={S.input} value={capital}
                onChange={(e) => setCapital(e.target.value)} data-testid="bt3-capital" />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={state.loading}
              disabled={!canRun || state.loading}
              onClick={handleRun}
              testId="bt3-run-btn"
            >
              {state.loading ? 'Running Backtest…' : 'Run Backtest'}
            </Button>
          </div>
        </Panel>

        {/* Execution Model panel */}
        <Panel title="Execution Model" subtitle="Fee, slippage, and spread calibration"
          variant="elevated" padding="md" testId="bt3-exec-model-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-3)' }}>
            <div>
              <label style={S.label}>Fee per Trade ($)</label>
              <input type="number" step="0.1" style={S.input} value={fee}
                onChange={(e) => setFee(e.target.value)} data-testid="bt3-fee" />
            </div>

            <div>
              <label style={S.label}>Slippage (bps)</label>
              <input type="number" step="0.5" style={S.input} value={slippage}
                onChange={(e) => setSlippage(e.target.value)} data-testid="bt3-slippage" />
            </div>

            <div>
              <label style={S.label}>Spread (bps)</label>
              <input type="number" step="0.5" style={S.input} value={spread}
                onChange={(e) => setSpread(e.target.value)} data-testid="bt3-spread" />
            </div>

            {/* Execution model summary */}
            <div style={{ ...S.surface, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui2-text-secondary)', marginBottom: '4px' }}>
                COST MODEL PREVIEW
              </div>
              <InfoRow label="Commission" value={`$${Number(fee).toFixed(2)} / trade`} />
              <InfoRow label="Slippage" value={`${Number(slippage).toFixed(1)} bps`} />
              <InfoRow label="Spread" value={`${Number(spread).toFixed(1)} bps`} />
              <InfoRow label="Total Impact (100 shares @ $150)" value={
                `$${(Number(fee) + (150 * 100 * (Number(slippage) + Number(spread)) / 10000)).toFixed(2)}`
              } />
            </div>

            {/* Strategy cards */}
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ui2-text-secondary)', marginTop: '4px' }}>
              AVAILABLE STRATEGIES
            </div>
            {STRATEGIES.map(s => (
              <div key={s.id}
                onClick={() => setStrategyId(s.id)}
                style={{
                  ...S.surface,
                  cursor: 'pointer',
                  borderColor: strategyId === s.id ? 'var(--ui2-brand-primary)' : undefined,
                  transition: 'border-color var(--ui2-transition-fast)',
                }}
                data-testid={`bt3-strat-card-${s.id}`}
              >
                <div style={S.flexBetween}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{s.name}</span>
                  <StatusBadge variant={strategyId === s.id ? 'success' : 'neutral'}>
                    {strategyId === s.id ? 'Selected' : s.type}
                  </StatusBadge>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ui2-text-tertiary)', marginTop: '2px' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Error */}
      {state.error && (
        <div style={S.errorBox} data-testid="bt3-error">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Backtest Error</div>
          {state.error}
        </div>
      )}
    </div>
  );
}

// ── 2. RESULTS TAB ──────────────────────────────────────────────────────────

function ResultsTab() {
  const state = useSyncExternalStore(backtesterV3Store.subscribe, backtesterV3Store.getState);
  const result = state.result as Record<string, any> | null;

  if (state.loading) return <Skeleton height={300} />;

  if (!result) {
    return <EmptyState title="No backtest results" description="Run a backtest from the Run tab to see results here." />;
  }

  const totalReturn = result.total_return ?? 0;
  const sharpe = result.sharpe_ratio ?? 0;
  const maxDD = result.max_drawdown_pct ?? 0;
  const winRate = result.win_rate ?? 0;
  const totalTrades = result.total_trades ?? 0;
  const profitFactor = result.profit_factor ?? 0;
  const finalEquity = result.final_equity ?? 0;
  const initialCapital = result.initial_capital ?? 100000;
  const annualizedReturn = result.annualized_return ?? 0;

  const kpiItems: KPIItem[] = [
    {
      id: 'return', label: 'Total Return', value: fmtPct(totalReturn, 100),
      status: totalReturn >= 0 ? 'success' : 'danger',
      icon: <span style={{ fontSize: '16px' }}>📈</span>,
    },
    {
      id: 'sharpe', label: 'Sharpe Ratio', value: sharpe.toFixed(3),
      status: sharpe >= 1 ? 'success' : sharpe >= 0 ? 'warning' : 'danger',
      icon: <span style={{ fontSize: '16px' }}>📊</span>,
    },
    {
      id: 'dd', label: 'Max Drawdown', value: `${maxDD.toFixed(2)}%`,
      status: Math.abs(maxDD) < 10 ? 'success' : Math.abs(maxDD) < 25 ? 'warning' : 'danger',
      icon: <span style={{ fontSize: '16px' }}>📉</span>,
    },
    {
      id: 'trades', label: 'Total Trades', value: String(totalTrades),
      status: 'neutral',
      icon: <span style={{ fontSize: '16px' }}>🔄</span>,
    },
  ];

  const tradeColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'trade_id', label: 'ID', width: '110px', render: (_v, row) => <span style={S.mono}>{String(row.trade_id)}</span> },
    { key: 'symbol', label: 'Symbol', width: '70px', render: (_v, row) => <span style={{ fontWeight: 600, fontSize: '13px' }}>{String(row.symbol)}</span> },
    { key: 'side', label: 'Side', width: '60px', render: (_v, row) => <StatusBadge variant={row.side === 'long' ? 'success' : 'danger'}>{String(row.side)}</StatusBadge> },
    { key: 'entry_date', label: 'Entry', width: '100px', render: (_v, row) => <span style={{ fontSize: '12px' }}>{String(row.entry_date)}</span> },
    { key: 'exit_date', label: 'Exit', width: '100px', render: (_v, row) => <span style={{ fontSize: '12px' }}>{String(row.exit_date)}</span> },
    { key: 'entry_price', label: 'Entry $', width: '80px', align: 'right', render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>${Number(row.entry_price).toFixed(2)}</span> },
    { key: 'exit_price', label: 'Exit $', width: '80px', align: 'right', render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>${Number(row.exit_price).toFixed(2)}</span> },
    { key: 'qty', label: 'Qty', width: '60px', align: 'right', render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px' }}>{Number(row.qty)}</span> },
    { key: 'net_pnl', label: 'Net PnL', width: '90px', align: 'right', render: (_v, row) => {
      const pnl = Number(row.net_pnl);
      return <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', fontWeight: 600, color: pnl >= 0 ? 'var(--ui2-positive)' : 'var(--ui2-negative)' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</span>;
    }},
    { key: 'commission', label: 'Fees', width: '60px', align: 'right', render: (_v, row) => <span style={{ fontFamily: 'var(--ui2-font-mono)', fontSize: '12px', color: 'var(--ui2-text-tertiary)' }}>${Number(row.commission).toFixed(2)}</span> },
  ];

  const trades: Record<string, unknown>[] = Array.isArray(result.trades) ? result.trades : [];

  return (
    <div style={S.sectionGap} data-testid="bt3-results-tab">
      {/* KPI Strip */}
      <KPIStrip items={kpiItems} variant="hero" testId="bt3-kpi" />

      {/* Run info + Metrics */}
      <div style={S.grid2}>
        <Panel title="Run Summary" variant="elevated" padding="md" testId="bt3-run-summary"
          status={<StatusBadge variant="success">{result.strategy_name || result.strategy_id}</StatusBadge>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <InfoRow label="Backtest ID" value={result.backtest_id || '—'} />
            <InfoRow label="Symbol" value={(result.symbols || []).join(', ') || result.symbol || '—'} />
            <InfoRow label="Date Range" value={`${result.start_date || '—'} → ${result.end_date || '—'}`} />
            <InfoRow label="Initial Capital" value={fmtDollars(initialCapital)} />
            <InfoRow label="Final Equity" value={fmtDollars(finalEquity)} />
            <InfoRow label="Trade Count" value={String(result.trade_count ?? totalTrades)} />
            <InfoRow label="Corporate Actions" value={String(result.corporate_actions_applied ?? 0)} />
            <InfoRow label="Timestamp" value={result.timestamp ? new Date(result.timestamp).toLocaleString() : '—'} />
          </div>
        </Panel>

        <Panel title="Performance Metrics" variant="elevated" padding="md" testId="bt3-metrics-panel">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--ui2-space-3)' }}>
            <MetricCell label="Total Return" value={fmtPct(totalReturn, 100)} positive={totalReturn >= 0} />
            <MetricCell label="Annualized Return" value={fmtPct(annualizedReturn, 100)} positive={annualizedReturn >= 0} />
            <MetricCell label="Sharpe Ratio" value={sharpe.toFixed(4)} positive={sharpe >= 0} />
            <MetricCell label="Max Drawdown" value={`${maxDD.toFixed(2)}%`} positive={false} />
            <MetricCell label="Win Rate" value={fmtPct(winRate, 100)} positive={winRate >= 0.5} />
            <MetricCell label="Profit Factor" value={profitFactor.toFixed(4)} positive={profitFactor >= 1} />
            <MetricCell label="Final Equity" value={fmtDollars(finalEquity)} positive={finalEquity >= initialCapital} />
            <MetricCell label="Max Drawdown ($)" value={fmtDollars(result.max_drawdown)} />
          </div>
        </Panel>
      </div>

      {/* Execution Model Card */}
      {result.execution_model && (
        <Panel title="Execution Model" variant="bordered" padding="md" testId="bt3-exec-detail"
          status={<StatusBadge variant="info">Calibrated</StatusBadge>}
        >
          <div style={S.grid4}>
            <MetricCell label="Fee/Trade" value={`$${result.execution_model.fee_per_trade}`} />
            <MetricCell label="Slippage" value={`${result.execution_model.slippage_bps} bps`} />
            <MetricCell label="Spread" value={`${result.execution_model.spread_bps} bps`} />
            <MetricCell label="Fill Ratio" value={`${(result.execution_model.fill_ratio * 100).toFixed(0)}%`} />
          </div>
        </Panel>
      )}

      {/* Trade Log */}
      {trades.length > 0 ? (
        <Panel title={`Trade Log — ${trades.length} trades`} variant="default" padding="none" testId="bt3-trade-log">
          <div style={{ maxHeight: '360px', overflow: 'auto' }}>
            <DataTable
              columns={tradeColumns}
              data={trades}
              keyField="trade_id"
              density="compact"
              testId="bt3-trades-table"
            />
          </div>
        </Panel>
      ) : (
        <Panel title="Trade Log" variant="default" padding="md">
          <EmptyState title="No trades recorded" description="The backtest completed but generated no trades in this period." />
        </Panel>
      )}
    </div>
  );
}

// ── 3. CALIBRATION TAB ──────────────────────────────────────────────────────

function CalibrationTab() {
  const state = useSyncExternalStore(backtesterV3Store.subscribe, backtesterV3Store.getState);
  const result = state.result as Record<string, any> | null;

  const [paperReturn, setPaperReturn] = useState('0.0');
  const [paperSharpe, setPaperSharpe] = useState('0.0');
  const [paperTrades, setPaperTrades] = useState('0');
  const [calibResult, setCalibResult] = useState<Record<string, any> | null>(null);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibError, setCalibError] = useState('');

  const handleCalibrate = useCallback(async () => {
    setCalibLoading(true);
    setCalibError('');
    try {
      const res = await fetch('/api/v2/backtester/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: (result?.symbols?.[0]) || 'AAPL',
          start_date: result?.start_date,
          end_date: result?.end_date,
          paper_return: Number(paperReturn),
          paper_sharpe: Number(paperSharpe),
          paper_trades: Number(paperTrades),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCalibResult(data);
    } catch (e: any) {
      setCalibError(e.message);
    } finally {
      setCalibLoading(false);
    }
  }, [result, paperReturn, paperSharpe, paperTrades]);

  return (
    <div style={S.sectionGap} data-testid="bt3-calibration-tab">
      <Panel title="Backtest vs Paper Trading Calibration"
        subtitle="Compare backtest results with actual paper trading performance to measure execution model fidelity"
        variant="elevated" padding="md" testId="bt3-calib-config"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui2-space-3)' }}>
          <div style={S.grid3}>
            <div>
              <label style={S.label}>Paper Return (0-1)</label>
              <input type="number" step="0.01" style={S.input} value={paperReturn}
                onChange={(e) => setPaperReturn(e.target.value)} data-testid="bt3-paper-return" />
            </div>
            <div>
              <label style={S.label}>Paper Sharpe</label>
              <input type="number" step="0.01" style={S.input} value={paperSharpe}
                onChange={(e) => setPaperSharpe(e.target.value)} data-testid="bt3-paper-sharpe" />
            </div>
            <div>
              <label style={S.label}>Paper Trades #</label>
              <input type="number" style={S.input} value={paperTrades}
                onChange={(e) => setPaperTrades(e.target.value)} data-testid="bt3-paper-trades" />
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            loading={calibLoading}
            disabled={calibLoading}
            onClick={handleCalibrate}
            testId="bt3-calibrate-btn"
          >
            {calibLoading ? 'Calibrating…' : 'Run Calibration Comparison'}
          </Button>
        </div>
      </Panel>

      {calibError && <div style={S.errorBox} data-testid="bt3-calib-error">{calibError}</div>}

      {calibResult && (
        <>
          {/* Calibration Score */}
          <Panel title="Calibration Score" variant="elevated" padding="md" testId="bt3-calib-score"
            status={
              <StatusBadge variant={
                (calibResult.calibration_score ?? 0) >= 0.8 ? 'success' :
                (calibResult.calibration_score ?? 0) >= 0.5 ? 'warning' : 'danger'
              }>
                {((calibResult.calibration_score ?? 0) * 100).toFixed(0)}%
              </StatusBadge>
            }
          >
            <div style={{ textAlign: 'center', padding: 'var(--ui2-space-4)' }}>
              <div style={{
                fontSize: '48px', fontWeight: 800, fontFamily: 'var(--ui2-font-mono)',
                color: (calibResult.calibration_score ?? 0) >= 0.8 ? 'var(--ui2-positive)' :
                       (calibResult.calibration_score ?? 0) >= 0.5 ? 'var(--ui2-warning)' : 'var(--ui2-negative)',
              }}>
                {((calibResult.calibration_score ?? 0) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ui2-text-secondary)', marginTop: '4px' }}>
                {(calibResult.calibration_score ?? 0) >= 0.8 ? 'Excellent calibration — execution model closely matches paper trading' :
                 (calibResult.calibration_score ?? 0) >= 0.5 ? 'Moderate calibration — consider adjusting execution parameters' :
                 'Poor calibration — significant divergence from paper trading'}
              </div>
            </div>
          </Panel>

          {/* Comparison grid */}
          <div style={S.grid3}>
            <Panel title="Returns" variant="bordered" padding="md" testId="bt3-calib-returns">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <InfoRow label="Backtest Return" value={fmtPct(calibResult.backtest_return ?? 0, 100)} />
                <InfoRow label="Paper Return" value={fmtPct(calibResult.paper_return ?? 0, 100)} />
                <InfoRow label="Difference" value={fmtPct(calibResult.return_diff ?? 0, 100)} />
              </div>
            </Panel>

            <Panel title="Risk-Adjusted" variant="bordered" padding="md" testId="bt3-calib-sharpe">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <InfoRow label="Backtest Sharpe" value={(calibResult.backtest_sharpe ?? 0).toFixed(4)} />
                <InfoRow label="Paper Sharpe" value={(calibResult.paper_sharpe ?? 0).toFixed(4)} />
                <InfoRow label="Difference" value={(calibResult.sharpe_diff ?? 0).toFixed(4)} />
              </div>
            </Panel>

            <Panel title="Trade Count" variant="bordered" padding="md" testId="bt3-calib-trades">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <InfoRow label="Backtest Trades" value={String(calibResult.backtest_trades ?? 0)} />
                <InfoRow label="Paper Trades" value={String(calibResult.paper_trades ?? 0)} />
                <InfoRow label="Difference" value={String((calibResult.backtest_trades ?? 0) - (calibResult.paper_trades ?? 0))} />
              </div>
            </Panel>
          </div>
        </>
      )}

      {!calibResult && !calibLoading && (
        <EmptyState title="No calibration results" description="Enter paper trading data and run calibration to compare with backtest results." />
      )}
    </div>
  );
}

// ── 4. DATA QUALITY TAB ─────────────────────────────────────────────────────

function DataQualityTab() {
  const state = useSyncExternalStore(backtesterV3Store.subscribe, backtesterV3Store.getState);
  const result = state.result as Record<string, any> | null;

  const [warnSymbol, setWarnSymbol] = useState('AAPL');
  const [warnings, setWarnings] = useState<Record<string, any> | null>(null);
  const [warnLoading, setWarnLoading] = useState(false);

  const handleCheckWarnings = useCallback(async () => {
    setWarnLoading(true);
    try {
      const res = await fetch(`/api/v2/backtester/warnings/${warnSymbol}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWarnings(await res.json());
    } catch { /* ignore */ }
    finally { setWarnLoading(false); }
  }, [warnSymbol]);

  const survWarnings: string[] = result?.survivorship_warnings ?? warnings?.survivorship_warnings ?? [];
  const histWarnings: string[] = result?.incomplete_history_warnings ?? warnings?.incomplete_history_warnings ?? [];

  return (
    <div style={S.sectionGap} data-testid="bt3-quality-tab">
      {/* Check warnings */}
      <Panel title="Data Quality Warnings" subtitle="Check for survivorship bias and incomplete history"
        variant="elevated" padding="md" testId="bt3-warnings-panel">
        <div style={{ display: 'flex', gap: 'var(--ui2-space-2)', marginBottom: 'var(--ui2-space-3)' }}>
          <input style={{ ...S.input, flex: 1 }} value={warnSymbol}
            onChange={(e) => setWarnSymbol(e.target.value.toUpperCase())}
            placeholder="Enter symbol" data-testid="bt3-warn-symbol" />
          <Button variant="primary" onClick={handleCheckWarnings}
            loading={warnLoading} testId="bt3-check-warnings-btn">
            Check Warnings
          </Button>
        </div>
      </Panel>

      <div style={S.grid2}>
        {/* Survivorship */}
        <Panel title="Survivorship Warnings" variant="bordered" padding="md" testId="bt3-surv-warnings"
          status={<StatusBadge variant={survWarnings.length > 0 ? 'warning' : 'success'}>
            {survWarnings.length > 0 ? `${survWarnings.length} warning${survWarnings.length !== 1 ? 's' : ''}` : 'Clean'}
          </StatusBadge>}
        >
          {survWarnings.length === 0 ? (
            <div style={{ ...S.successBox }}>No survivorship bias warnings detected.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {survWarnings.map((w, i) => (
                <div key={i} style={{ ...S.surface, fontSize: '12px', color: 'var(--ui2-warning)' }}>
                  ⚠️ {w}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Incomplete History */}
        <Panel title="Incomplete History Warnings" variant="bordered" padding="md" testId="bt3-hist-warnings"
          status={<StatusBadge variant={histWarnings.length > 0 ? 'warning' : 'success'}>
            {histWarnings.length > 0 ? `${histWarnings.length} warning${histWarnings.length !== 1 ? 's' : ''}` : 'Clean'}
          </StatusBadge>}
        >
          {histWarnings.length === 0 ? (
            <div style={{ ...S.successBox }}>No incomplete history warnings.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {histWarnings.map((w, i) => (
                <div key={i} style={{ ...S.surface, fontSize: '12px', color: 'var(--ui2-warning)' }}>
                  ⚠️ {w}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Execution model info */}
      <Panel title="Execution Model Defaults" variant="elevated" padding="md" testId="bt3-exec-defaults">
        <div style={S.grid4}>
          <MetricCell label="Commission/Share" value="$0.00" />
          <MetricCell label="Fee/Trade" value="$1.00" />
          <MetricCell label="Slippage" value="5.0 bps" />
          <MetricCell label="Market Impact" value="2.0 bps" />
        </div>
      </Panel>

      {/* Corporate actions */}
      <Panel title="Corporate Actions" variant="bordered" padding="md" testId="bt3-corp-actions"
        status={<StatusBadge variant="neutral">Registry</StatusBadge>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={S.dimText}>
            Corporate actions (splits, dividends, mergers, spinoffs) are automatically adjusted during backtesting.
            The engine applies ratio adjustments to historical prices for accurate simulation.
          </div>
          {result && (
            <InfoRow label="Actions Applied This Run" value={String(result.corporate_actions_applied ?? 0)} />
          )}
        </div>
      </Panel>
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────

const BT3_TABS = [
  { id: 'run',         label: 'Run' },
  { id: 'results',     label: 'Results' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'quality',     label: 'Data Quality' },
];

export function BacktesterV3UI2() {
  const [tab, setTab] = useState('run');

  const handleResultReady = useCallback(() => {
    setTab('results');
  }, []);

  return (
    <div
      data-testid="backtester-v3-ui2-page"
      data-ready="true"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Backtester V3"
          subtitle="Execution calibration · corporate actions · survivorship bias detection · backtest-vs-paper comparison"
          testId="bt3-page-header"
        />
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs items={BT3_TABS} activeTab={tab} onTabChange={setTab} testId="bt3-tabs" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {tab === 'run'         && <RunTab onResultReady={handleResultReady} />}
        {tab === 'results'     && <ResultsTab />}
        {tab === 'calibration' && <CalibrationTab />}
        {tab === 'quality'     && <DataQualityTab />}
      </div>

      {/* Hidden sentinel */}
      <div data-testid="bt3-ready" style={{ display: 'none' }} />
    </div>
  );
}
