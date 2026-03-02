/**
 * BacktestEngineUI2 — Strategy Backtesting & Performance Analysis
 * Equity curve, drawdown, trade log, monthly returns heatmap,
 * parameter optimization, walk-forward analysis, benchmark comparison.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Trade { id: number; symbol: string; side: 'LONG' | 'SHORT'; entryDate: string; exitDate: string; entryPrice: number; exitPrice: number; qty: number; pnl: number; pnlPct: number; duration: number; mfe: number; mae: number }
interface MonthlyReturn { year: number; month: number; ret: number }
interface BacktestConfig { strategy: string; symbol: string; startDate: string; endDate: string; initialCapital: number; commission: number; slippage: number }
interface PerformanceStats { totalReturn: number; cagr: number; sharpe: number; sortino: number; maxDrawdown: number; calmar: number; winRate: number; profitFactor: number; avgWin: number; avgLoss: number; payoffRatio: number; totalTrades: number; exposure: number; avgDuration: number }

/* ─── Generate Backtest Data ──────────────────────────────────────────── */
function generateBacktest(config: BacktestConfig): { equity: number[]; benchmark: number[]; drawdown: number[]; trades: Trade[]; monthly: MonthlyReturn[]; stats: PerformanceStats } {
  const days = 756; // ~3 years
  const equity: number[] = [config.initialCapital];
  const benchmark: number[] = [config.initialCapital];
  const drawdown: number[] = [0];
  const trades: Trade[] = [];
  const monthly: MonthlyReturn[] = [];

  let peak = config.initialCapital;
  let benchPeak = config.initialCapital;
  let tradeId = 0;
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH'];

  // Seed RNG
  let s = 42;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  for (let i = 1; i <= days; i++) {
    // Strategy returns (slight edge)
    const stratRet = (rng() - 0.47) * 0.02;
    const benchRet = (rng() - 0.48) * 0.015;

    equity.push(equity[i - 1] * (1 + stratRet));
    benchmark.push(benchmark[i - 1] * (1 + benchRet));

    peak = Math.max(peak, equity[i]);
    const dd = (equity[i] - peak) / peak;
    drawdown.push(dd);

    // Generate trades periodically
    if (i % 12 === 0) {
      const sym = symbols[Math.floor(rng() * symbols.length)];
      const side = rng() > 0.5 ? 'LONG' : 'SHORT' as const;
      const entry = 100 + rng() * 300;
      const pnlPct = (rng() - 0.42) * 0.08;
      const exit = entry * (1 + (side === 'LONG' ? pnlPct : -pnlPct));
      const qty = Math.floor(rng() * 100 + 10);
      const pnl = (exit - entry) * qty * (side === 'LONG' ? 1 : -1);
      const dur = Math.floor(rng() * 20 + 1);
      const mfe = Math.abs(pnlPct) + rng() * 0.02;
      const mae = -rng() * 0.03;

      const baseDate = new Date(2022, 0, 1);
      baseDate.setDate(baseDate.getDate() + i);
      const entryDate = baseDate.toISOString().split('T')[0];
      baseDate.setDate(baseDate.getDate() + dur);
      const exitDate = baseDate.toISOString().split('T')[0];

      trades.push({ id: ++tradeId, symbol: sym, side, entryDate, exitDate, entryPrice: entry, exitPrice: exit, qty, pnl, pnlPct: pnlPct * 100, duration: dur, mfe: mfe * 100, mae: mae * 100 });
    }
  }

  // Monthly returns
  for (let y = 2022; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2024 && m > 9) break;
      monthly.push({ year: y, month: m, ret: (rng() - 0.42) * 8 });
    }
  }

  const totalRet = (equity[days] / config.initialCapital - 1) * 100;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const stats: PerformanceStats = {
    totalReturn: totalRet,
    cagr: (Math.pow(equity[days] / config.initialCapital, 1 / 3) - 1) * 100,
    sharpe: totalRet / 15 * 0.7 + rng() * 0.3,
    sortino: totalRet / 10 * 0.8 + rng() * 0.2,
    maxDrawdown: Math.min(...drawdown) * 100,
    calmar: totalRet / Math.abs(Math.min(...drawdown) * 100 || 1),
    winRate: wins.length / trades.length * 100,
    profitFactor: Math.abs(wins.reduce((s, t) => s + t.pnl, 0) / (losses.reduce((s, t) => s + t.pnl, 0) || 1)),
    avgWin: wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0,
    avgLoss: losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0,
    payoffRatio: 0,
    totalTrades: trades.length,
    exposure: 65 + rng() * 20,
    avgDuration: trades.reduce((s, t) => s + t.duration, 0) / trades.length,
  };
  stats.payoffRatio = Math.abs(stats.avgWin / (stats.avgLoss || 1));

  return { equity, benchmark, drawdown, trades, monthly, stats };
}

/* ─── Canvas: Equity Curve ────────────────────────────────────────────── */
function EquityCurveChart({ equity, benchmark, drawdown }: { equity: number[]; benchmark: number[]; drawdown: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const eqH = h * 0.7, ddH = h * 0.28, gap = h * 0.02;
    const pad = { l: 55, r: 15, t: 15 };
    const cw = w - pad.l - pad.r;
    const n = equity.length;

    // Equity section
    const allEq = [...equity, ...benchmark];
    const minE = Math.min(...allEq) * 0.98, maxE = Math.max(...allEq) * 1.02;
    const px = (i: number) => pad.l + (i / (n - 1)) * cw;
    const pyE = (v: number) => pad.t + ((maxE - v) / (maxE - minE)) * (eqH - pad.t - gap);

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (eqH - pad.t - gap) * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      const val = maxE - (maxE - minE) * i / 4;
      ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`$${(val / 1000).toFixed(0)}K`, pad.l - 5, y + 3);
    }

    // Benchmark line
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath();
    benchmark.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), pyE(v)) : ctx.lineTo(px(i), pyE(v)));
    ctx.stroke();

    // Strategy equity area + line
    ctx.fillStyle = 'rgba(38,166,154,0.06)';
    ctx.beginPath();
    ctx.moveTo(px(0), eqH - gap);
    equity.forEach((v, i) => ctx.lineTo(px(i), pyE(v)));
    ctx.lineTo(px(n - 1), eqH - gap);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
    ctx.beginPath();
    equity.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), pyE(v)) : ctx.lineTo(px(i), pyE(v)));
    ctx.stroke();

    // Drawdown section
    const ddTop = eqH;
    const minDD = Math.min(...drawdown);
    const pyDD = (v: number) => ddTop + (v / (minDD || -0.01)) * (ddH - 10);

    ctx.fillStyle = 'rgba(239,83,80,0.15)';
    ctx.beginPath();
    ctx.moveTo(px(0), ddTop);
    drawdown.forEach((v, i) => ctx.lineTo(px(i), pyDD(v)));
    ctx.lineTo(px(n - 1), ddTop);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = RED; ctx.lineWidth = 1;
    ctx.beginPath();
    drawdown.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), pyDD(v)) : ctx.lineTo(px(i), pyDD(v)));
    ctx.stroke();

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${(minDD * 100).toFixed(1)}%`, pad.l - 5, ddTop + ddH - 10);

    // Legend
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = GREEN; ctx.fillRect(pad.l, 5, 10, 3); ctx.fillText('Strategy', pad.l + 14, 10);
    ctx.fillStyle = '#555'; ctx.fillRect(pad.l + 80, 5, 10, 3); ctx.fillText('Benchmark', pad.l + 94, 10);
  }, [equity, benchmark, drawdown]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', borderRadius: 4 }} />;
}

/* ─── Monthly Returns Heatmap ─────────────────────────────────────────── */
function MonthlyHeatmap({ monthly }: { monthly: MonthlyReturn[] }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = Array.from(new Set(monthly.map(m => m.year))).sort();

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
      <thead>
        <tr>
          <th style={{ padding: 4, color: MUTED }}></th>
          {months.map(m => <th key={m} style={{ padding: 4, color: MUTED, fontWeight: 600, width: '7%' }}>{m}</th>)}
          <th style={{ padding: 4, color: MUTED, fontWeight: 700 }}>YTD</th>
        </tr>
      </thead>
      <tbody>
        {years.map(year => {
          const yearData = monthly.filter(m => m.year === year);
          const ytd = yearData.reduce((s, m) => s * (1 + m.ret / 100), 1) - 1;
          return (
            <tr key={year}>
              <td style={{ padding: 4, fontWeight: 700, color: MUTED }}>{year}</td>
              {months.map((_, mi) => {
                const md = yearData.find(m => m.month === mi + 1);
                if (!md) return <td key={mi} style={{ padding: 4 }}></td>;
                const abs = Math.abs(md.ret);
                const bg = md.ret > 0 ? `rgba(38,166,154,${Math.min(0.5, abs / 10)})` : `rgba(239,83,80,${Math.min(0.5, abs / 10)})`;
                return (
                  <td key={mi} style={{ padding: 4, textAlign: 'center', background: bg, borderRadius: 2, fontWeight: 600, color: md.ret > 0 ? GREEN : RED }}>
                    {md.ret.toFixed(1)}%
                  </td>
                );
              })}
              <td style={{ padding: 4, textAlign: 'center', fontWeight: 700, color: ytd > 0 ? GREEN : RED }}>
                {(ytd * 100).toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['PERFORMANCE', 'TRADE LOG', 'MONTHLY RETURNS', 'OPTIMIZATION'] as const;
type Tab = typeof TABS[number];

const STRATEGIES = ['SMA Crossover', 'RSI Mean Reversion', 'MACD Momentum', 'Bollinger Bounce', 'Breakout', 'Pairs Trading', 'Momentum Factor', 'Mean Reversion'];

export default function BacktestEngineUI2() {
  const [tab, setTab] = useState<Tab>('PERFORMANCE');
  const [config, setConfig] = useState<BacktestConfig>({
    strategy: 'SMA Crossover', symbol: 'AAPL', startDate: '2022-01-01',
    endDate: '2024-09-30', initialCapital: 100000, commission: 0.001, slippage: 0.0005,
  });
  const [running, setRunning] = useState(false);
  const [sortCol, setSortCol] = useState<string>('id');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const data = useMemo(() => generateBacktest(config), [config]);

  const sortedTrades = useMemo(() => {
    return [...data.trades].sort((a, b) => {
      const va = (a as any)[sortCol]; const vb = (b as any)[sortCol];
      return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
    });
  }, [data.trades, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortCol(col); setSortDir(1); }
  };

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>⚡ BACKTEST ENGINE</span>
          <select value={config.strategy} onChange={e => setConfig(c => ({ ...c, strategy: e.target.value }))}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>
            {STRATEGIES.map(s => <option key={s}>{s}</option>)}
          </select>
          <span style={{ color: MUTED }}>on</span>
          <input value={config.symbol} onChange={e => setConfig(c => ({ ...c, symbol: e.target.value }))}
            style={{ width: 60, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 8px', fontSize: 11, fontWeight: 700 }} />
          <input type="date" value={config.startDate} onChange={e => setConfig(c => ({ ...c, startDate: e.target.value }))}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '4px 6px', fontSize: 10 }} />
          <span style={{ color: MUTED }}>→</span>
          <input type="date" value={config.endDate} onChange={e => setConfig(c => ({ ...c, endDate: e.target.value }))}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '4px 6px', fontSize: 10 }} />
        </div>
        <button onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 1500); }}
          style={{ background: running ? '#333' : GREEN, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 20px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          {running ? '⟳ RUNNING...' : '▶ RUN BACKTEST'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
        {[
          { l: 'Total Return', v: `${data.stats.totalReturn.toFixed(1)}%`, c: data.stats.totalReturn > 0 ? GREEN : RED },
          { l: 'CAGR', v: `${data.stats.cagr.toFixed(1)}%`, c: data.stats.cagr > 10 ? GREEN : AMBER },
          { l: 'Sharpe', v: data.stats.sharpe.toFixed(2), c: data.stats.sharpe > 1 ? GREEN : data.stats.sharpe > 0.5 ? AMBER : RED },
          { l: 'Sortino', v: data.stats.sortino.toFixed(2), c: data.stats.sortino > 1.5 ? GREEN : AMBER },
          { l: 'Max DD', v: `${data.stats.maxDrawdown.toFixed(1)}%`, c: data.stats.maxDrawdown > -15 ? GREEN : RED },
          { l: 'Calmar', v: data.stats.calmar.toFixed(2), c: data.stats.calmar > 1 ? GREEN : AMBER },
          { l: 'Win Rate', v: `${data.stats.winRate.toFixed(0)}%`, c: data.stats.winRate > 55 ? GREEN : AMBER },
          { l: 'Profit Factor', v: data.stats.profitFactor.toFixed(2), c: data.stats.profitFactor > 1.5 ? GREEN : AMBER },
          { l: 'Trades', v: data.stats.totalTrades.toString(), c: '#eee' },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ color: MUTED, fontSize: 9 }}>{s.l}</div>
            <div style={{ color: s.c, fontWeight: 700, fontSize: 13 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'PERFORMANCE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: 12, height: '100%' }}>
            <div style={{ ...panelStyle, height: '100%' }}>
              <div style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 4 }}>EQUITY CURVE & DRAWDOWN</div>
              <div style={{ height: 'calc(100% - 20px)' }}>
                <EquityCurveChart equity={data.equity} benchmark={data.benchmark} drawdown={data.drawdown} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>DETAILED STATS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {[
                    { l: 'Initial Capital', v: `$${config.initialCapital.toLocaleString()}` },
                    { l: 'Final Value', v: `$${(config.initialCapital * (1 + data.stats.totalReturn / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                    { l: 'Total P/L', v: `$${(config.initialCapital * data.stats.totalReturn / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: data.stats.totalReturn > 0 ? GREEN : RED },
                    { l: '—', v: '' },
                    { l: 'Avg Win', v: `${data.stats.avgWin.toFixed(2)}%`, c: GREEN },
                    { l: 'Avg Loss', v: `${data.stats.avgLoss.toFixed(2)}%`, c: RED },
                    { l: 'Payoff Ratio', v: data.stats.payoffRatio.toFixed(2) },
                    { l: 'Avg Duration', v: `${data.stats.avgDuration.toFixed(0)}d` },
                    { l: 'Exposure', v: `${data.stats.exposure.toFixed(0)}%` },
                    { l: 'Commission', v: `${(config.commission * 100).toFixed(2)}%` },
                    { l: 'Slippage', v: `${(config.slippage * 100).toFixed(2)}%` },
                  ].map((s, i) => s.l === '—' ? <div key={i} style={{ borderBottom: `1px solid ${BORDER}`, margin: '4px 0' }} /> : (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ fontWeight: 600, color: (s as any).c || '#eee' }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>WIN/LOSS DISTRIBUTION</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, height: 40 }}>
                  {Array.from({ length: 20 }, (_, i) => {
                    const bucket = -10 + i;
                    const count = data.trades.filter(t => t.pnlPct >= bucket && t.pnlPct < bucket + 1).length;
                    const maxCount = 8;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{
                          height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? 2 : 0,
                          background: bucket >= 0 ? GREEN : RED,
                          borderRadius: '2px 2px 0 0', opacity: 0.7,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: MUTED, marginTop: 2 }}>
                  <span>-10%</span><span>0%</span><span>+10%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'TRADE LOG' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TRADE LOG ({data.trades.length} trades)</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                <span style={{ color: GREEN }}>W: {data.trades.filter(t => t.pnl > 0).length}</span>
                <span style={{ color: RED }}>L: {data.trades.filter(t => t.pnl <= 0).length}</span>
                <span style={{ color: MUTED }}>Total P/L: <span style={{ color: data.trades.reduce((s, t) => s + t.pnl, 0) > 0 ? GREEN : RED, fontWeight: 700 }}>
                  ${data.trades.reduce((s, t) => s + t.pnl, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span></span>
              </div>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
                    {[
                      { key: 'id', label: '#' }, { key: 'symbol', label: 'Symbol' }, { key: 'side', label: 'Side' },
                      { key: 'entryDate', label: 'Entry' }, { key: 'exitDate', label: 'Exit' },
                      { key: 'entryPrice', label: 'Entry $' }, { key: 'exitPrice', label: 'Exit $' },
                      { key: 'qty', label: 'Qty' }, { key: 'pnl', label: 'P/L $' },
                      { key: 'pnlPct', label: 'P/L %' }, { key: 'duration', label: 'Days' },
                      { key: 'mfe', label: 'MFE %' }, { key: 'mae', label: 'MAE %' },
                    ].map(h => (
                      <th key={h.key} onClick={() => handleSort(h.key)} style={{
                        padding: '6px 6px', textAlign: 'right', color: sortCol === h.key ? AMBER : MUTED,
                        fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                      }}>{h.label} {sortCol === h.key ? (sortDir === 1 ? '▲' : '▼') : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{t.id}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{t.symbol}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <span style={{ padding: '1px 4px', borderRadius: 2, fontSize: 9, background: t.side === 'LONG' ? `${GREEN}22` : `${RED}22`, color: t.side === 'LONG' ? GREEN : RED }}>{t.side}</span>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{t.entryDate}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{t.exitDate}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>${t.entryPrice.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>${t.exitPrice.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{t.qty}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: t.pnl > 0 ? GREEN : RED, fontWeight: 600 }}>{t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(0)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: t.pnlPct > 0 ? GREEN : RED }}>{t.pnlPct > 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{t.duration}d</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: GREEN }}>+{t.mfe.toFixed(1)}%</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: RED }}>{t.mae.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'MONTHLY RETURNS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>MONTHLY RETURNS HEATMAP</span>
              <div style={{ marginTop: 8 }}>
                <MonthlyHeatmap monthly={data.monthly} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>BEST MONTHS</span>
                {[...data.monthly].sort((a, b) => b.ret - a.ret).slice(0, 5).map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ color: MUTED }}>{m.year}-{String(m.month).padStart(2, '0')}</span>
                    <span style={{ color: GREEN, fontWeight: 600 }}>+{m.ret.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>WORST MONTHS</span>
                {[...data.monthly].sort((a, b) => a.ret - b.ret).slice(0, 5).map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ color: MUTED }}>{m.year}-{String(m.month).padStart(2, '0')}</span>
                    <span style={{ color: RED, fontWeight: 600 }}>{m.ret.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>STREAKS</span>
                {[
                  { l: 'Current', v: '3 wins', c: GREEN },
                  { l: 'Best Win Streak', v: '7 months', c: GREEN },
                  { l: 'Worst Loss Streak', v: '3 months', c: RED },
                  { l: 'Positive Months', v: `${data.monthly.filter(m => m.ret > 0).length}/${data.monthly.length}`, c: GREEN },
                  { l: 'Avg Positive', v: `+${(data.monthly.filter(m => m.ret > 0).reduce((s, m) => s + m.ret, 0) / (data.monthly.filter(m => m.ret > 0).length || 1)).toFixed(1)}%`, c: GREEN },
                  { l: 'Avg Negative', v: `${(data.monthly.filter(m => m.ret < 0).reduce((s, m) => s + m.ret, 0) / (data.monthly.filter(m => m.ret < 0).length || 1)).toFixed(1)}%`, c: RED },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10, borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ color: MUTED }}>{s.l}</span>
                    <span style={{ color: s.c, fontWeight: 600 }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'OPTIMIZATION' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PARAMETER GRID SEARCH</span>
              <div style={{ marginTop: 12 }}>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {['Fast', 'Slow', 'Return%', 'Sharpe', 'MaxDD%', 'Trades'].map(h => (
                          <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [10, 50, 45.2, 1.82, -12.3, 85],
                        [10, 100, 38.5, 1.45, -15.8, 62],
                        [20, 50, 42.1, 1.65, -14.1, 78],
                        [20, 100, 35.8, 1.32, -16.5, 55],
                        [20, 200, 32.5, 1.18, -18.2, 42],
                        [50, 100, 28.3, 1.05, -20.1, 38],
                        [50, 200, 25.6, 0.92, -22.5, 28],
                        [10, 200, 48.3, 1.95, -11.2, 48], // Best
                        [30, 100, 33.2, 1.22, -17.8, 45],
                        [30, 200, 29.8, 1.08, -19.5, 32],
                      ].sort((a, b) => (b[3] as number) - (a[3] as number)).map((row, i) => (
                        <tr key={i} style={{
                          borderBottom: `1px solid ${BORDER}22`,
                          background: i === 0 ? 'rgba(38,166,154,0.08)' : 'transparent',
                        }}>
                          {row.map((v, j) => (
                            <td key={j} style={{
                              padding: '4px 6px', textAlign: 'right',
                              color: j === 3 ? ((v as number) > 1.5 ? GREEN : (v as number) > 1 ? AMBER : RED) :
                                     j === 4 ? RED : '#eee',
                              fontWeight: i === 0 ? 700 : 400,
                            }}>{typeof v === 'number' ? (j >= 2 ? v.toFixed(j === 3 ? 2 : 1) : v) : v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>WALK-FORWARD ANALYSIS</span>
              <div style={{ marginTop: 12, color: MUTED, fontSize: 10, marginBottom: 8 }}>
                In-sample optimization → Out-of-sample validation (6 windows)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Window', 'IS Return', 'OOS Return', 'IS Sharpe', 'OOS Sharpe', 'Efficiency'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { w: '1', isR: 32.5, oosR: 18.2, isS: 1.85, oosS: 1.12, eff: 0.61 },
                    { w: '2', isR: 28.3, oosR: 15.8, isS: 1.62, oosS: 0.95, eff: 0.59 },
                    { w: '3', isR: 35.1, oosR: 22.1, isS: 1.92, oosS: 1.28, eff: 0.67 },
                    { w: '4', isR: 30.8, oosR: 12.5, isS: 1.75, oosS: 0.82, eff: 0.47 },
                    { w: '5', isR: 33.2, oosR: 20.5, isS: 1.88, oosS: 1.18, eff: 0.63 },
                    { w: '6', isR: 29.5, oosR: 16.8, isS: 1.68, oosS: 1.05, eff: 0.63 },
                  ].map(row => (
                    <tr key={row.w} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{row.w}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: GREEN }}>{row.isR.toFixed(1)}%</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: row.oosR > 15 ? GREEN : AMBER }}>{row.oosR.toFixed(1)}%</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.isS.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: row.oosS > 1 ? GREEN : AMBER }}>{row.oosS.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                            <div style={{ width: `${row.eff * 100}%`, height: '100%', background: row.eff > 0.6 ? GREEN : AMBER, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 9 }}>{(row.eff * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: 8, background: '#0a0a0a', borderRadius: 4, fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: MUTED }}>Avg OOS Efficiency</span>
                  <span style={{ color: GREEN, fontWeight: 700 }}>60.0%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: MUTED }}>Strategy Robustness</span>
                  <span style={{ color: GREEN, fontWeight: 700 }}>GOOD</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
