/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Runs Audit View (UI2)                             │
 * │  Complete run history with status tracking, execution details,     │
 * │  performance comparison, and audit trail                            │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface RunRecord {
  id: string; strategy: string; type: 'backtest' | 'paper' | 'live' | 'optimization';
  status: 'completed' | 'running' | 'failed' | 'cancelled';
  startTime: string; endTime: string; duration: string;
  sharpe: number; totalReturn: number; maxDrawdown: number;
  trades: number; winRate: number; pnl: number;
  params: Record<string, string>; tags: string[];
  equityCurve: number[];
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateRuns(): RunRecord[] {
  const strategies = [
    'Mean Reversion BB', 'Momentum RSI', 'Pairs MSFT/AAPL', 'Trend Following',
    'Vol Arb SPX', 'Sector Rotation', 'Statistical Arb', 'Breakout Scanner',
    'ML Ensemble Alpha', 'FX Carry G10', 'Event-Driven M&A', 'Options Straddle',
  ];
  const types: RunRecord['type'][] = ['backtest', 'paper', 'live', 'optimization'];
  const statuses: RunRecord['status'][] = ['completed', 'completed', 'completed', 'running', 'failed', 'completed', 'cancelled', 'completed'];

  return Array.from({ length: 24 }, (_, i) => {
    const curve = [100000];
    for (let j = 1; j < 60; j++) curve.push(curve[j-1] * (1 + (Math.random() - 0.46) * 0.012));
    const pnl = curve[curve.length-1] - 100000;
    const hour = 9 + Math.floor(i / 3);
    const tags = [['prod', 'v2'], ['dev', 'experimental'], ['staging'], ['backtest', 'param-sweep'], ['live', 'risk-off']][i % 5];

    return {
      id: `RUN-${String(2400 - i).padStart(4, '0')}`,
      strategy: strategies[i % strategies.length],
      type: types[i % types.length],
      status: statuses[i % statuses.length],
      startTime: `2024-03-${String(22 - Math.floor(i / 6)).padStart(2, '0')} ${hour}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      endTime: `2024-03-${String(22 - Math.floor(i / 6)).padStart(2, '0')} ${hour + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      duration: `${Math.floor(5 + Math.random() * 55)}m ${Math.floor(Math.random() * 60)}s`,
      sharpe: +(0.2 + Math.random() * 2.5).toFixed(2),
      totalReturn: +((pnl / 100000) * 100).toFixed(2),
      maxDrawdown: -(1 + Math.random() * 15),
      trades: Math.floor(10 + Math.random() * 500),
      winRate: +(40 + Math.random() * 30).toFixed(1),
      pnl,
      params: { lookback: String(10 + i * 2), threshold: (0.5 + i * 0.1).toFixed(1), stopLoss: (1 + Math.random() * 3).toFixed(1) + '%' },
      tags,
      equityCurve: curve,
    };
  });
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function MiniCurve({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 80, H = 24;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
    const positive = data[data.length-1] >= data[0];
    ctx.fillStyle = `${positive ? T.up : T.dn}15`;
    ctx.strokeStyle = positive ? T.up : T.dn; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H);
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - 1 - ((d - mn) / rng) * (H - 2);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - 1 - ((d - mn) / rng) * (H - 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);
  return <canvas ref={ref} style={{ width: 80, height: 24, verticalAlign: 'middle' }} />;
}

function ComparisonChart({ runs }: { runs: RunRecord[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const selected = runs.filter(r => r.status === 'completed').slice(0, 6);
  const colors = [T.brand, T.up, T.dn, T.warn, T.purple, T.info];
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);

    const allVals = selected.flatMap(r => r.equityCurve);
    const mn = Math.min(...allVals); const mx = Math.max(...allVals); const rng = mx - mn || 1;
    const maxLen = Math.max(...selected.map(r => r.equityCurve.length));

    selected.forEach((run, ri) => {
      ctx.strokeStyle = colors[ri]; ctx.lineWidth = 1.2;
      ctx.beginPath();
      run.equityCurve.forEach((v, i) => {
        const x = (i / (maxLen - 1)) * W;
        const y = H - 10 - ((v - mn) / rng) * (H - 20);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Legend
    selected.forEach((run, ri) => {
      const lx = 8, ly = 8 + ri * 12;
      ctx.fillStyle = colors[ri];
      ctx.fillRect(lx, ly, 8, 3);
      ctx.fillStyle = T.tx2; ctx.font = `6px ${T.mono}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${run.id} ${run.strategy}`, lx + 12, ly + 3);
    });
  }, [selected]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: T.r }} />;
}

/* ── Components ──────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: RunRecord['status'] }) {
  const colors: Record<string, string> = { completed: T.up, running: T.brand, failed: T.dn, cancelled: T.tx3 };
  const icons: Record<string, string> = { completed: '✓', running: '▶', failed: '✗', cancelled: '⊘' };
  return (
    <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, background: `${colors[status]}20`, color: colors[status] }}>
      {icons[status]} {status.toUpperCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: RunRecord['type'] }) {
  const colors: Record<string, string> = { backtest: T.brand, paper: T.warn, live: T.up, optimization: T.purple };
  return (
    <span style={{ fontSize: '6px', padding: '1px 3px', borderRadius: '2px', fontWeight: 600, background: `${colors[type]}15`, color: colors[type] }}>
      {type.toUpperCase()}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type RTab = 'history' | 'compare' | 'details';

export default function RunsUI2() {
  const [tab, setTab] = useState<RTab>('history');
  const [sel, setSel] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const runs = useMemo(() => generateRuns(), []);

  const filtered = useMemo(() => {
    return runs.filter(r =>
      (typeFilter === 'all' || r.type === typeFilter) &&
      (statusFilter === 'all' || r.status === statusFilter)
    );
  }, [runs, typeFilter, statusFilter]);

  const selected = runs[sel];
  const completed = runs.filter(r => r.status === 'completed');

  return (
    <div data-testid="runs-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>RUNS AUDIT</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Total: <span style={{ color: T.tx0 }}>{runs.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Running: <span style={{ color: T.brand }}>{runs.filter(r => r.status === 'running').length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Completed: <span style={{ color: T.up }}>{completed.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Failed: <span style={{ color: T.dn }}>{runs.filter(r => r.status === 'failed').length}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'history' as RTab, label: '📋 History' },
          { key: 'compare' as RTab, label: '📊 Compare' },
          { key: 'details' as RTab, label: '🔍 Details' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '4px', padding: '4px 8px' }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ background: T.bg2, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, fontSize: '7px', padding: '2px 4px' }}>
            <option value="all">All Types</option>
            <option value="backtest">Backtest</option>
            <option value="paper">Paper</option>
            <option value="live">Live</option>
            <option value="optimization">Optimization</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: T.bg2, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, fontSize: '7px', padding: '2px 4px' }}>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'history' && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead><tr style={{ background: T.bg2 }}>
                {['ID','Strategy','Type','Status','Curve','Sharpe','Return','MDD','Trades','WR','Duration','Started'].map(h => (
                  <th key={h} style={{ padding: '5px 3px', textAlign: h === 'ID' || h === 'Strategy' || h === 'Type' || h === 'Status' || h === 'Curve' ? 'left' : 'right', color: T.tx3, fontWeight: 600, fontSize: '7px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} onClick={() => { setSel(runs.indexOf(r)); setTab('details'); }} style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <td style={{ padding: '4px 3px', fontWeight: 700, color: T.brand, fontSize: '7px' }}>{r.id}</td>
                    <td style={{ padding: '4px 3px', fontWeight: 600, color: T.tx0 }}>{r.strategy}</td>
                    <td style={{ padding: '4px 3px' }}><TypeBadge type={r.type} /></td>
                    <td style={{ padding: '4px 3px' }}><StatusBadge status={r.status} /></td>
                    <td style={{ padding: '4px 3px' }}><MiniCurve data={r.equityCurve} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: r.sharpe > 1 ? T.up : T.tx1 }}>{r.sharpe}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: r.totalReturn >= 0 ? T.up : T.dn }}>{r.totalReturn >= 0 ? '+' : ''}{r.totalReturn}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.dn }}>{r.maxDrawdown.toFixed(1)}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx1 }}>{r.trades}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: r.winRate > 55 ? T.up : T.tx1 }}>{r.winRate}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx2 }}>{r.duration}</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx3, fontSize: '7px' }}>{r.startTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'compare' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Equity Curve Comparison (Top 6 Completed)</div>
            <ComparisonChart runs={runs} />
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden', marginTop: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['ID','Strategy','Sharpe','Return','MDD','Win Rate','Trades','P&L'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: h === 'ID' || h === 'Strategy' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {completed.slice(0, 8).map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', color: T.brand, fontWeight: 700, fontSize: '7px' }}>{r.id}</td>
                      <td style={{ padding: '4px', color: T.tx0 }}>{r.strategy}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: r.sharpe > 1.5 ? T.up : T.tx1, fontWeight: 700 }}>{r.sharpe}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: r.totalReturn >= 0 ? T.up : T.dn }}>{r.totalReturn >= 0 ? '+' : ''}{r.totalReturn}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.dn }}>{r.maxDrawdown.toFixed(1)}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: r.winRate > 55 ? T.up : T.tx1 }}>{r.winRate}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{r.trades}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700, color: r.pnl >= 0 ? T.up : T.dn }}>${r.pnl.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'details' && selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>{selected.strategy}</div>
                    <div style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>{selected.id} · {selected.startTime}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}><TypeBadge type={selected.type} /><StatusBadge status={selected.status} /></div>
                </div>
                <MiniCurve data={selected.equityCurve} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                {[
                  { label: 'Total Return', value: `${selected.totalReturn >= 0 ? '+' : ''}${selected.totalReturn}%`, color: selected.totalReturn >= 0 ? T.up : T.dn },
                  { label: 'Sharpe Ratio', value: String(selected.sharpe), color: selected.sharpe > 1 ? T.up : T.tx0 },
                  { label: 'Max Drawdown', value: `${selected.maxDrawdown.toFixed(1)}%`, color: T.dn },
                  { label: 'Win Rate', value: `${selected.winRate}%`, color: selected.winRate > 55 ? T.up : T.tx0 },
                  { label: 'Total P&L', value: `$${selected.pnl.toFixed(0)}`, color: selected.pnl >= 0 ? T.up : T.dn },
                  { label: 'Trades', value: String(selected.trades), color: T.tx0 },
                  { label: 'Duration', value: selected.duration, color: T.tx0 },
                  { label: 'Type', value: selected.type.toUpperCase(), color: T.brand },
                ].map(m => (
                  <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '6px', color: T.tx3 }}>{m.label}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: m.color, fontFamily: T.mono }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '6px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Parameters</div>
                {Object.entries(selected.params).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${T.border}`, fontSize: '7px' }}>
                    <span style={{ color: T.tx3 }}>{k}</span>
                    <span style={{ color: T.tx0, fontFamily: T.mono }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize: '7px', background: `${T.brand}15`, color: T.brand, borderRadius: '2px', padding: '1px 4px' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { RunsUI2 };
