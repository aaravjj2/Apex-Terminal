/**
 * BacktesterV3UI2 â€” Bloomberg-Grade Backtesting Terminal
 * =======================================================
 * Full institutional backtesting suite using /api/v4/backtest:
 *  â€¢ Single-backtest run with equity curve + drawdown SVG tearsheet
 *  â€¢ Walk-Forward Optimization (WFO) across rolling windows
 *  â€¢ Monte Carlo simulation (1000 paths, 10/50/90 percentile bands)
 *  â€¢ Multi-strategy side-by-side comparison table
 *  â€¢ OHLCV data upload or sample generation
 *  â€¢ Commission / slippage / position sizing configuration
 *  â€¢ Full performance metrics: Sharpe, Sortino, Calmar, VaR, max DD
 */

import { useState, useCallback, type CSSProperties } from 'react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OHLCVBar { time: number; open: number; high: number; low: number; close: number; volume: number; }

interface BacktestMetrics {
  total_return:      number;
  annualized_return: number;
  sharpe_ratio:      number;
  sortino_ratio:     number;
  calmar_ratio:      number;
  max_drawdown:      number;
  win_rate:          number;
  profit_factor:     number;
  total_trades:      number;
  initial_capital:   number;
  final_equity:      number;
  volatility:        number;
  var_95:            number;
}

interface Trade {
  entry_time: number;
  exit_time:  number;
  side:       string;
  entry_price: number;
  exit_price:  number;
  quantity:   number;
  pnl:        number;
  pnl_pct:    number;
  return_pct: number;
}

interface BacktestResult extends BacktestMetrics {
  equity_curve:  number[];
  drawdown_series: number[];
  trades:        Trade[];
  strategy_name: string;
}

// â”€â”€â”€ Palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BG     = '#0a0a0a';
const PANEL  = '#111111';
const BORDER = '#1e1e1e';
const AMBER  = '#f5a623';
const GREEN  = '#26a69a';
const RED    = '#ef5350';
const BLUE   = '#42a5f5';
const SUBTLE = '#555';
const TEXT   = '#d1d4dc';
const MONO   = '"Roboto Mono","Courier New",monospace';

const inp: CSSProperties = {
  background: '#151515', border: `1px solid ${BORDER}`, color: TEXT,
  padding: '5px 8px', borderRadius: 3, fontFamily: MONO, fontSize: 11, outline: 'none', width: '100%',
};
const th: CSSProperties = {
  padding: '5px 8px', fontFamily: MONO, fontSize: 10, color: SUBTLE,
  fontWeight: 600, borderBottom: `1px solid ${BORDER}`,
  background: '#141414', position: 'sticky' as const, top: 0, zIndex: 5, whiteSpace: 'nowrap',
  textAlign: 'right' as const,
};
const td: CSSProperties = {
  padding: '4px 8px', fontFamily: MONO, fontSize: 11, textAlign: 'right' as const,
  borderBottom: `1px solid ${BORDER}22`, whiteSpace: 'nowrap',
};

const fmtPct = (v: number | undefined) => v == null ? 'â€”' : `${(v * 100).toFixed(2)}%`;
const fmt    = (v: number | undefined, d = 3) => v == null ? 'â€”' : v.toFixed(d);
const fmtK   = (v: number | undefined) => v == null ? 'â€”' : v > 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${v.toLocaleString('en', { maximumFractionDigits: 0 })}`;

// â”€â”€â”€ Equity Curve SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EquityCurveSVG({ curve, initial }: { curve: number[]; initial: number }) {
  if (!curve.length) return null;
  const H = 120, W = 600;
  const min = Math.min(...curve); const max = Math.max(...curve);
  const range = max - min || 1;
  const pts = curve.map((v, i) => {
    const x = (i / (curve.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const zero_y = H - ((initial - min) / range) * H;
  const finalVal = curve[curve.length - 1];
  const color = finalVal >= initial ? GREEN : RED;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H }}>
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="eqClip"><rect x={0} y={0} width={W} height={H} /></clipPath>
      </defs>
      <line x1={0} y1={zero_y} x2={W} y2={zero_y} stroke={BORDER} strokeWidth={1} strokeDasharray="4,4" />
      <polyline points={`0,${zero_y} ${pts} ${W},${zero_y}`} fill="url(#eqGrad)" stroke="none" clipPath="url(#eqClip)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} clipPath="url(#eqClip)" />
      <circle cx={(curve.length - 1) / (curve.length - 1) * W} cy={H - ((finalVal - min) / range) * H} r={3} fill={color} />
    </svg>
  );
}

function DrawdownSVG({ series }: { series: number[] }) {
  if (!series.length) return null;
  const H = 60, W = 600;
  const min = Math.min(...series, 0); const range = Math.abs(min) || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * W},${(Math.abs(v) / range) * H}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H }}>
      <defs>
        <linearGradient id="ddGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED} stopOpacity="0.3" />
          <stop offset="100%" stopColor={RED} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={0} y1={0} x2={W} y2={0} stroke={BORDER} strokeWidth={1} />
      <polyline points={`0,0 ${pts} ${W},0`} fill="url(#ddGrad2)" stroke="none" />
      <polyline points={pts} fill="none" stroke={RED} strokeWidth={1.5} />
      <text x={4} y={H - 3} fontSize="9" fill={SUBTLE} fontFamily={MONO}>
        Max DD: {fmtPct(Math.min(...series))}
      </text>
    </svg>
  );
}

// â”€â”€â”€ MC Simulation SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MCSvg({ p10, p50, p90 }: { p10: number[]; p50: number[]; p90: number[] }) {
  if (!p50.length) return null;
  const H = 100, W = 600;
  const allVals = [...p10, ...p50, ...p90];
  const min = Math.min(...allVals); const max = Math.max(...allVals);
  const range = max - min || 1;
  const toPath = (arr: number[]) => arr.map((v, i) =>
    `${(i / (arr.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H }}>
      <defs>
        <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.10" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* Band between p10 and p90 */}
      <polyline
        points={`${toPath(p90)} ${p10.slice().reverse().map(
          (v, i) => `${((p10.length - 1 - i) / (p10.length - 1)) * W},${H - ((v - min) / range) * H}`
        ).join(' ')}`}
        fill={BLUE} fillOpacity={0.07} stroke="none"
      />
      <polyline points={toPath(p10)} fill="none" stroke={BLUE} strokeWidth={1} strokeOpacity={0.5} strokeDasharray="3,3" />
      <polyline points={toPath(p90)} fill="none" stroke={BLUE} strokeWidth={1} strokeOpacity={0.5} strokeDasharray="3,3" />
      <polyline points={toPath(p50)} fill="none" stroke={AMBER} strokeWidth={2} />
    </svg>
  );
}

// â”€â”€â”€ Metrics panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MetricsGrid({ r }: { r: BacktestMetrics }) {
  const cells: [string, string, string?][] = [
    ['TOTAL RETURN',  fmtPct(r.total_return),      r.total_return >= 0 ? GREEN : RED],
    ['CAGR',          fmtPct(r.annualized_return),  r.annualized_return >= 0 ? GREEN : RED],
    ['SHARPE',        fmt(r.sharpe_ratio),           r.sharpe_ratio >= 1 ? GREEN : r.sharpe_ratio >= 0 ? AMBER : RED],
    ['SORTINO',       fmt(r.sortino_ratio),          r.sortino_ratio >= 1 ? GREEN : AMBER],
    ['CALMAR',        fmt(r.calmar_ratio),           r.calmar_ratio >= 0.5 ? GREEN : AMBER],
    ['MAX DRAWDOWN',  fmtPct(r.max_drawdown),        RED],
    ['WIN RATE',      fmtPct(r.win_rate),            r.win_rate >= 0.5 ? GREEN : RED],
    ['PROFIT FACTOR', fmt(r.profit_factor),          r.profit_factor >= 1 ? GREEN : RED],
    ['TOTAL TRADES',  String(r.total_trades ?? 0),  SUBTLE],
    ['VOLATILITY',    fmtPct(r.volatility),          AMBER],
    ['VaR 95%',       fmtPct(r.var_95),             RED],
    ['FINAL EQUITY',  fmtK(r.final_equity),          r.final_equity >= r.initial_capital ? GREEN : RED],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {cells.map(([label, value, color]) => (
        <div key={label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO, letterSpacing: '0.08em' }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: color ?? TEXT, marginTop: 3 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Trade log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TradeLog({ trades }: { trades: Trade[] }) {
  const [page, setPage] = useState(0);
  const PAGE = 20;
  const sliced = trades.slice(page * PAGE, (page + 1) * PAGE);
  return (
    <div>
      <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>SIDE</th>
              <th style={th}>ENTRY</th><th style={th}>EXIT</th>
              <th style={th}>ENTRY $</th><th style={th}>EXIT $</th>
              <th style={th}>QTY</th><th style={th}>P&L</th><th style={th}>P&L%</th>
            </tr>
          </thead>
          <tbody>
            {sliced.map((t, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{page * PAGE + i + 1}</td>
                <td style={{ ...td, textAlign: 'left', color: t.side === 'long' ? GREEN : RED, fontWeight: 700 }}>{t.side?.toUpperCase()}</td>
                <td style={{ ...td, fontSize: 10, color: SUBTLE }}>{t.entry_time ? new Date(t.entry_time * 1000).toLocaleDateString() : 'â€”'}</td>
                <td style={{ ...td, fontSize: 10, color: SUBTLE }}>{t.exit_time  ? new Date(t.exit_time  * 1000).toLocaleDateString() : 'â€”'}</td>
                <td style={td}>{t.entry_price?.toFixed(2)}</td>
                <td style={td}>{t.exit_price?.toFixed(2)}</td>
                <td style={td}>{t.quantity}</td>
                <td style={{ ...td, color: t.pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>${t.pnl?.toFixed(0)}</td>
                <td style={{ ...td, color: t.pnl_pct >= 0 ? GREEN : RED }}>{fmtPct(t.pnl_pct / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades.length > PAGE && (
        <div style={{ display: 'flex', gap: 8, padding: '6px 10px', justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ ...inp, width: 'auto', padding: '2px 10px', cursor: 'pointer', color: AMBER }}>â†</button>
          <span style={{ fontSize: 10, color: SUBTLE, fontFamily: MONO, padding: '2px 8px' }}>
            {page + 1} / {Math.ceil(trades.length / PAGE)}
          </span>
          <button onClick={() => setPage(p => Math.min(Math.ceil(trades.length / PAGE) - 1, p + 1))}
            disabled={page >= Math.ceil(trades.length / PAGE) - 1}
            style={{ ...inp, width: 'auto', padding: '2px 10px', cursor: 'pointer', color: AMBER }}>â†’</button>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Sample OHLCV generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function generateSampleBars(n = 252): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let price = 150;
  const now = Math.floor(Date.now() / 1000);
  for (let i = n; i >= 0; i--) {
    const ret    = (Math.random() - 0.48) * 0.02;
    price        = Math.max(price * (1 + ret), 1);
    const vol    = price * (0.005 + Math.random() * 0.01);
    const open   = price;
    const high   = price + Math.abs(Math.random() * vol);
    const low    = price - Math.abs(Math.random() * vol);
    const close  = low + Math.random() * (high - low);
    const volume = Math.floor(1e6 + Math.random() * 5e6);
    bars.push({ time: now - i * 86400, open, high, low, close, volume });
  }
  return bars;
}

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BTab = 'run' | 'tearsheet' | 'wfo' | 'mc' | 'compare';

const STRATEGIES_V4 = [
  { id: 'MovingAverageCrossStrategy',   label: 'MA Cross (20/50 SMA)' },
  { id: 'RSIMeanReversionStrategy',     label: 'RSI Mean Reversion (30/70)' },
  { id: 'BollingerBandStrategy',        label: 'Bollinger Band Breakout' },
  { id: 'BreakoutStrategy',             label: '20-Day Channel Breakout' },
];

export function BacktesterV3UI2() {
  const [tab,    setTab]    = useState<BTab>('run');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error,  setError]  = useState('');

  // Run tab state
  const [strategy,   setStrategy]   = useState('MovingAverageCrossStrategy');
  const [capital,    setCapital]     = useState(100000);
  const [commType,   setCommType]    = useState('per_trade');
  const [commValue,  setCommValue]   = useState(1.0);
  const [slipBps,    setSlipBps]     = useState(5.0);
  const [sizePct,    setSizePct]     = useState(0.95);

  // WFO state
  const [wfoWindows, setWfoWindows]  = useState(5);
  const [wfoResult,  setWfoResult]   = useState<Record<string, unknown> | null>(null);

  // MC state
  const [mcSims,     setMcSims]      = useState(500);
  const [mcResult,   setMcResult]    = useState<{p10: number[]; p50: number[]; p90: number[]; summary: Record<string,number>} | null>(null);

  // Compare state
  const [compareResult, setCompareResult] = useState<BacktestResult[] | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['MovingAverageCrossStrategy', 'RSIMeanReversionStrategy']);

  const setLoad = (k: string, v: boolean) => setLoading(prev => ({ ...prev, [k]: v }));

  const buildBars = (): OHLCVBar[] => generateSampleBars(500);

  // â”€â”€â”€ Run single backtest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const runBacktest = useCallback(async () => {
    setLoad('run', true);
    setError('');
    try {
      const bars = buildBars();
      const res = await fetch('/api/v4/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ohlcv: bars,
          strategy_name: strategy,
          initial_capital: capital,
          commission: { commission_type: commType, value: commValue },
          slippage: { slippage_type: 'fixed_bps', bps: slipBps },
          position_sizer: { sizer_type: 'fixed_pct', pct: sizePct },
          strategy_params: {},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data as BacktestResult);
      setTab('tearsheet');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoad('run', false);
    }
  }, [strategy, capital, commType, commValue, slipBps, sizePct]);

  // â”€â”€â”€ WFO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const runWFO = useCallback(async () => {
    setLoad('wfo', true);
    setError('');
    try {
      const bars = buildBars();
      const res = await fetch('/api/v4/backtest/wfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ohlcv: bars,
          strategy_name: strategy,
          initial_capital: capital,
          n_windows: wfoWindows,
          test_pct: 0.3,
          commission: { commission_type: commType, value: commValue },
          slippage: { slippage_type: 'fixed_bps', bps: slipBps },
          position_sizer: { sizer_type: 'fixed_pct', pct: sizePct },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWfoResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoad('wfo', false);
    }
  }, [strategy, capital, wfoWindows, commType, commValue, slipBps, sizePct]);

  // â”€â”€â”€ Monte Carlo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const runMC = useCallback(async () => {
    if (!result) { setError('Run a backtest first to generate Monte Carlo simulation'); return; }
    setLoad('mc', true);
    setError('');
    try {
      const bars = buildBars();
      const res = await fetch('/api/v4/backtest/montecarlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ohlcv: bars,
          strategy_name: strategy,
          initial_capital: capital,
          n_simulations: mcSims,
          commission: { commission_type: commType, value: commValue },
          slippage: { slippage_type: 'fixed_bps', bps: slipBps },
          position_sizer: { sizer_type: 'fixed_pct', pct: sizePct },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMcResult({
        p10: data.percentile_10  ?? [],
        p50: data.percentile_50  ?? [],
        p90: data.percentile_90  ?? [],
        summary: data.summary ?? {},
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoad('mc', false);
    }
  }, [result, strategy, capital, mcSims, commType, commValue, slipBps, sizePct]);

  // â”€â”€â”€ Compare â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const runCompare = useCallback(async () => {
    setLoad('compare', true);
    setError('');
    try {
      const bars = buildBars();
      const res = await fetch('/api/v4/backtest/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ohlcv: bars,
          strategy_names: selectedStrategies,
          initial_capital: capital,
          commission: { commission_type: commType, value: commValue },
          slippage: { slippage_type: 'fixed_bps', bps: slipBps },
          position_sizer: { sizer_type: 'fixed_pct', pct: sizePct },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompareResult(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoad('compare', false);
    }
  }, [selectedStrategies, capital, commType, commValue, slipBps, sizePct]);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const tabBtn = (t: BTab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '5px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: MONO, fontSize: 11, fontWeight: tab === t ? 700 : 400,
        color: tab === t ? AMBER : SUBTLE,
        borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
      }}
    >{label}</button>
  );

  const Btn = ({ label, k, onClick_ }: { label: string; k: string; onClick_: () => void }) => (
    <button
      onClick={onClick_}
      disabled={!!loading[k]}
      style={{
        padding: '6px 16px', border: `1px solid ${AMBER}44`, background: '#1a1200',
        color: loading[k] ? SUBTLE : AMBER, borderRadius: 4, cursor: 'pointer',
        fontFamily: MONO, fontSize: 11, fontWeight: 700, opacity: loading[k] ? 0.7 : 1,
      }}
    >{loading[k] ? 'âŸ³ Runningâ€¦' : label}</button>
  );

  const selInp = { ...inp, cursor: 'pointer' };

  return (
    <div
      data-testid="bt3-page"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: MONO, overflow: 'hidden' }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 14px', background: '#0d0d0d', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <span style={{ color: AMBER, fontWeight: 700, fontSize: 14 }}>BACKTESTER v4</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>Bloomberg-Grade Event-Driven Engine</span>
        {result && <span style={{ fontSize: 10, color: GREEN }}>â–² {result.strategy_name} â€” {fmtPct(result.total_return)} total return</span>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: SUBTLE }}>Engine: backtest_engine.py</span>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: '#0d0d0d', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {tabBtn('run',      'CONFIGURE & RUN')}
        {tabBtn('tearsheet','TEARSHEET')}
        {tabBtn('wfo',      'WALK-FORWARD')}
        {tabBtn('mc',       'MONTE CARLO')}
        {tabBtn('compare',  'COMPARE')}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {error && (
          <div style={{ color: RED, fontSize: 10, marginBottom: 12, fontFamily: MONO, background: '#1a0505', border: `1px solid ${RED}44`, borderRadius: 4, padding: '6px 10px' }}>
            {error}
          </div>
        )}

        {/* â”€â”€ RUN TAB â”€â”€ */}
        {tab === 'run' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Strategy & Capital */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, color: AMBER, fontWeight: 700, marginBottom: 4 }}>STRATEGY</div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>STRATEGY</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)} style={selInp}>
                  {STRATEGIES_V4.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>INITIAL CAPITAL $</label>
                <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>POSITION SIZE (% equity)</label>
                <input type="number" min={0.01} max={1} step={0.05} value={sizePct}
                  onChange={e => setSizePct(Number(e.target.value))} style={inp} />
              </div>
              <div style={{ marginTop: 6 }}>
                <Btn label="RUN BACKTEST" k="run" onClick_={runBacktest} />
              </div>
            </div>
            {/* Execution model */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, color: AMBER, fontWeight: 700, marginBottom: 4 }}>EXECUTION MODEL</div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>COMMISSION TYPE</label>
                <select value={commType} onChange={e => setCommType(e.target.value)} style={selInp}>
                  <option value="per_trade">Per Trade ($)</option>
                  <option value="per_share">Per Share ($)</option>
                  <option value="pct_of_trade">% of Trade</option>
                  <option value="zero">Zero Commission</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>COMMISSION VALUE</label>
                <input type="number" min={0} step={0.1} value={commValue}
                  onChange={e => setCommValue(Number(e.target.value))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>SLIPPAGE (bps)</label>
                <input type="number" min={0} step={0.5} value={slipBps}
                  onChange={e => setSlipBps(Number(e.target.value))} style={inp} />
              </div>
              {/* Preview */}
              <div style={{ background: '#0d0d0d', borderRadius: 4, padding: '8px 10px', marginTop: 4 }}>
                <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>COST PREVIEW â€” 100 SHARES @ $150</div>
                {[
                  ['Commission', commType === 'per_share' ? `$${(commValue * 100).toFixed(2)}` : commType === 'pct_of_trade' ? `$${(commValue / 100 * 150 * 100).toFixed(2)}` : `$${commValue.toFixed(2)}`],
                  ['Slippage', `$${(150 * 100 * slipBps / 10000).toFixed(2)}`],
                  ['Position Sizer', `${(sizePct * 100).toFixed(0)}% of equity`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT, marginBottom: 3 }}>
                    <span style={{ color: SUBTLE }}>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ TEARSHEET TAB â”€â”€ */}
        {tab === 'tearsheet' && (
          !result
            ? <div style={{ color: SUBTLE, textAlign: 'center', padding: '40px', fontSize: 11 }}>Run a backtest to generate tearsheet</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MetricsGrid r={result} />
                {/* Equity curve */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                    EQUITY CURVE
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {result.equity_curve?.length
                      ? <EquityCurveSVG curve={result.equity_curve} initial={result.initial_capital} />
                      : <div style={{ color: SUBTLE, fontSize: 10 }}>No equity curve data</div>}
                  </div>
                </div>
                {/* Drawdown */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                    DRAWDOWN SERIES
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {result.drawdown_series?.length
                      ? <DrawdownSVG series={result.drawdown_series} />
                      : <div style={{ color: SUBTLE, fontSize: 10 }}>No drawdown data</div>}
                  </div>
                </div>
                {/* Trades table */}
                {result.trades?.length > 0 && (
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                      TRADE LOG â€” {result.trades.length} TRADES
                    </div>
                    <TradeLog trades={result.trades} />
                  </div>
                )}
              </div>
        )}

        {/* â”€â”€ WFO TAB â”€â”€ */}
        {tab === 'wfo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 10, color: SUBTLE }}>
              Walk-Forward Optimization tests the strategy on rolling in-sample/out-of-sample windows to detect overfitting.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>NUMBER OF WINDOWS</label>
                <input type="number" min={2} max={20} value={wfoWindows}
                  onChange={e => setWfoWindows(Number(e.target.value))} style={{ ...inp, width: 80 }} />
              </div>
              <Btn label="RUN WALK-FORWARD" k="wfo" onClick_={runWFO} />
            </div>
            {wfoResult && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                  WFO RESULTS â€” {wfoWindows} WINDOWS
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>WINDOW</th>
                        <th style={th}>IN-SAMPLE SHARPE</th>
                        <th style={th}>OOS SHARPE</th>
                        <th style={th}>IN-SAMPLE RETURN</th>
                        <th style={th}>OOS RETURN</th>
                        <th style={th}>EFFICIENCY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((wfoResult.windows ?? []) as Record<string, unknown>[]).map((w, i) => {
                        const isr = w.in_sample_return as number ?? 0;
                        const oor = w.oos_return as number ?? 0;
                        const eff = isr !== 0 ? oor / isr : 0;
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: AMBER }}>{i + 1}</td>
                            <td style={td}>{fmt(w.in_sample_sharpe as number)}</td>
                            <td style={{ ...td, color: (w.oos_sharpe as number ?? 0) >= 0 ? GREEN : RED }}>
                              {fmt(w.oos_sharpe as number)}
                            </td>
                            <td style={{ ...td, color: isr >= 0 ? GREEN : RED }}>{fmtPct(isr)}</td>
                            <td style={{ ...td, color: oor >= 0 ? GREEN : RED }}>{fmtPct(oor)}</td>
                            <td style={{ ...td, color: eff >= 0.5 ? GREEN : eff >= 0.2 ? AMBER : RED }}>
                              {(eff * 100).toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(wfoResult as Record<string, unknown>).summary && (
                  <div style={{ padding: '8px 12px', display: 'flex', gap: 20, fontSize: 10, color: SUBTLE }}>
                    <span>Avg OOS Sharpe: <span style={{ color: BLUE }}>{fmt(((wfoResult as Record<string, unknown>).summary as Record<string, number>).avg_oos_sharpe)}</span></span>
                    <span>OOS Win Rate: <span style={{ color: GREEN }}>{fmtPct(((wfoResult as Record<string, unknown>).summary as Record<string, number>).oos_win_rate)}</span></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ MONTE CARLO TAB â”€â”€ */}
        {tab === 'mc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 10, color: SUBTLE }}>
              Monte Carlo simulation randomizes trade order/timing to generate a distribution of outcomes. Shows 10th, 50th, and 90th percentile equity paths.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 9, color: SUBTLE, display: 'block', marginBottom: 3 }}>SIMULATIONS</label>
                <select value={mcSims} onChange={e => setMcSims(Number(e.target.value))} style={{ ...inp, cursor: 'pointer', width: 100 }}>
                  {[100, 250, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <Btn label="RUN MONTE CARLO" k="mc" onClick_={runMC} />
            </div>
            {mcResult && (
              <>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                    MC EQUITY PATHS â€” P10 / <span style={{ color: AMBER }}>P50</span> / P90
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    <MCSvg p10={mcResult.p10} p50={mcResult.p50} p90={mcResult.p90} />
                  </div>
                </div>
                {mcResult.summary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {Object.entries(mcResult.summary).map(([k, v]) => (
                      <div key={k} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: SUBTLE }}>{k.replace(/_/g, ' ').toUpperCase()}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, fontFamily: MONO, marginTop: 3 }}>
                          {typeof v === 'number' ? v.toFixed(3) : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* â”€â”€ COMPARE TAB â”€â”€ */}
        {tab === 'compare' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>SELECT STRATEGIES TO COMPARE</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STRATEGIES_V4.map(s => {
                  const active = selectedStrategies.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStrategies(prev =>
                        active ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                      style={{
                        padding: '5px 12px', border: `1px solid ${active ? AMBER : BORDER}`,
                        background: active ? '#1a1200' : '#131313',
                        color: active ? AMBER : SUBTLE, borderRadius: 4, cursor: 'pointer',
                        fontFamily: MONO, fontSize: 10, fontWeight: active ? 700 : 400,
                      }}
                    >{s.label}</button>
                  );
                })}
              </div>
            </div>
            <Btn label={`COMPARE ${selectedStrategies.length} STRATEGIES`} k="compare" onClick_={runCompare} />
            {compareResult && compareResult.length > 0 && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '5px 10px', background: '#141414', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: SUBTLE, fontWeight: 700 }}>
                  STRATEGY COMPARISON â€” {compareResult.length} STRATEGIES
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>STRATEGY</th>
                      <th style={th}>RETURN</th><th style={th}>SHARPE</th><th style={th}>SORTINO</th>
                      <th style={th}>CALMAR</th><th style={th}>MAX DD</th><th style={th}>WIN%</th>
                      <th style={th}>PROFIT F</th><th style={th}>TRADES</th><th style={th}>FINAL EQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResult.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                        <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{r.strategy_name}</td>
                        <td style={{ ...td, color: r.total_return >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmtPct(r.total_return)}</td>
                        <td style={{ ...td, color: r.sharpe_ratio >= 1 ? GREEN : AMBER }}>{fmt(r.sharpe_ratio)}</td>
                        <td style={{ ...td, color: r.sortino_ratio >= 1 ? GREEN : AMBER }}>{fmt(r.sortino_ratio)}</td>
                        <td style={td}>{fmt(r.calmar_ratio)}</td>
                        <td style={{ ...td, color: RED }}>{fmtPct(r.max_drawdown)}</td>
                        <td style={{ ...td, color: r.win_rate >= 0.5 ? GREEN : RED }}>{fmtPct(r.win_rate)}</td>
                        <td style={{ ...td, color: r.profit_factor >= 1 ? GREEN : RED }}>{fmt(r.profit_factor)}</td>
                        <td style={{ ...td, color: SUBTLE }}>{r.total_trades}</td>
                        <td style={{ ...td, color: r.final_equity >= r.initial_capital ? GREEN : RED }}>{fmtK(r.final_equity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div data-testid="bt3-ready" style={{ display: 'none' }} />
    </div>
  );
}
