/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Sandbox Strategy Runner (UI2)                     │
 * │  Isolated execution environment for strategy testing with           │
 * │  paper trading, simulation controls, and performance tracking       │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

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
interface SandboxRun {
  id: string;
  strategyName: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'queued';
  startTime: string;
  duration: string;
  progress: number;
  capital: number;
  pnl: number;
  trades: number;
  sharpe: number;
  maxDrawdown: number;
  equityCurve: number[];
  logs: LogEntry[];
}

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error' | 'trade' | 'signal';
  message: string;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateRuns(): SandboxRun[] {
  const strategies = [
    'Mean Reversion BB', 'Momentum Crossover', 'Pairs Trading MSFT/AAPL',
    'Vol Arb SPX Gamma', 'Sector Rotation CTA', 'Earnings Drift NLP',
    'FX Carry G10', 'Crypto Trend BTC',
  ];

  return strategies.map((name, i) => {
    const curve = [100000];
    for (let j = 1; j < 100; j++) curve.push(curve[j-1] * (1 + (Math.random() - 0.45) * 0.008));
    const pnl = curve[curve.length-1] - 100000;
    const logs: LogEntry[] = Array.from({ length: 20 }, (_, k) => ({
      time: `${9 + Math.floor(k / 3)}:${String(30 + (k * 5) % 60).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      level: (['info', 'info', 'trade', 'signal', 'warn'] as const)[Math.floor(Math.random() * 5)],
      message: [
        `Position opened: LONG ${['AAPL', 'MSFT', 'NVDA', 'TSLA'][k % 4]} x100 @${(150 + Math.random() * 700).toFixed(2)}`,
        `Signal: RSI crossed below 30, BB squeeze detected`,
        `Stop loss triggered @${(140 + Math.random() * 100).toFixed(2)}, PnL: $${(-200 + Math.random() * 1000).toFixed(0)}`,
        `Risk check: Position within VaR limits (2.1% vs 3% limit)`,
        `Market data: Spread widened to ${(0.03 + Math.random() * 0.1).toFixed(3)}, slippage possible`,
        `Trade filled: SELL ${['SPY', 'QQQ', 'IWM', 'DIA'][k % 4]} x50 @${(400 + Math.random() * 100).toFixed(2)}`,
        `Rebalance triggered: Target weight deviation > 5%`,
      ][k % 7],
    }));

    return {
      id: `SB-${String(i + 1).padStart(3, '0')}`,
      strategyName: name,
      status: (['running', 'completed', 'completed', 'paused', 'completed', 'running', 'queued', 'failed'] as const)[i],
      startTime: `2024-03-22 ${9 + i}:00`,
      duration: `${Math.floor(Math.random() * 4)}h ${Math.floor(Math.random() * 60)}m`,
      progress: i < 2 ? Math.round(30 + Math.random() * 60) : i === 7 ? 45 : 100,
      capital: 100000,
      pnl,
      trades: Math.floor(20 + Math.random() * 180),
      sharpe: +(0.3 + Math.random() * 2.2).toFixed(2),
      maxDrawdown: -(2 + Math.random() * 12),
      equityCurve: curve,
      logs,
    };
  });
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function EquityCurveCanvas({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 350, H = 120;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
    const positive = data[data.length-1] >= data[0];

    // Area
    ctx.beginPath(); ctx.moveTo(0, H);
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - ((d - mn) / rng) * (H - 10) - 5;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = positive ? `${T.up}15` : `${T.dn}15`; ctx.fill();

    // Line
    ctx.strokeStyle = positive ? T.up : T.dn; ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - ((d - mn) / rng) * (H - 10) - 5;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Starting capital line
    ctx.strokeStyle = `${T.tx3}40`; ctx.lineWidth = 0.5; ctx.setLineDash([3,2]);
    const startY = H - ((data[0] - mn) / rng) * (H - 10) - 5;
    ctx.beginPath(); ctx.moveTo(0, startY); ctx.lineTo(W, startY); ctx.stroke();
    ctx.setLineDash([]);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 120, borderRadius: T.r }} />;
}

/* ── Sub Components ──────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: SandboxRun['status'] }) {
  const colors: Record<string, string> = { running: T.up, completed: T.brand, failed: T.dn, paused: T.warn, queued: T.tx3 };
  const icons: Record<string, string> = { running: '▶', completed: '✓', failed: '✗', paused: '⏸', queued: '⏳' };
  return (
    <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: `${colors[status]}20`, color: colors[status], fontWeight: 700 }}>
      {icons[status]} {status.toUpperCase()}
    </span>
  );
}

function RunCard({ run }: { run: SandboxRun }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>{run.strategyName}</div>
          <div style={{ fontSize: '7px', color: T.tx3, fontFamily: T.mono }}>{run.id} · Started {run.startTime}</div>
        </div>
        <StatusBadge status={run.status} />
      </div>
      {run.status === 'running' && (
        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: T.tx3, marginBottom: '2px' }}>
            <span>Progress</span><span>{run.progress}%</span>
          </div>
          <div style={{ height: 3, background: T.bg3, borderRadius: 2 }}>
            <div style={{ width: `${run.progress}%`, height: '100%', background: T.brand, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      <EquityCurveCanvas data={run.equityCurve} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '6px', fontSize: '7px', fontFamily: T.mono }}>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>P&L</div><div style={{ color: run.pnl > 0 ? T.up : T.dn, fontWeight: 700 }}>${run.pnl.toFixed(0)}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>Sharpe</div><div style={{ color: run.sharpe > 1 ? T.up : T.tx1 }}>{run.sharpe}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>MDD</div><div style={{ color: T.dn }}>{run.maxDrawdown.toFixed(1)}%</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>Trades</div><div style={{ color: T.tx1 }}>{run.trades}</div></div>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
        {run.status === 'running' && <button style={{ flex: 1, background: T.warn, color: '#000', border: 'none', borderRadius: T.r, padding: '3px', fontSize: '8px', fontWeight: 600, cursor: 'pointer' }}>⏸ Pause</button>}
        {run.status === 'paused' && <button style={{ flex: 1, background: T.up, color: '#FFF', border: 'none', borderRadius: T.r, padding: '3px', fontSize: '8px', fontWeight: 600, cursor: 'pointer' }}>▶ Resume</button>}
        {run.status === 'completed' && <button style={{ flex: 1, background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '3px', fontSize: '8px', fontWeight: 600, cursor: 'pointer' }}>📊 Report</button>}
        <button style={{ flex: 1, background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '3px', fontSize: '8px', cursor: 'pointer' }}>Logs</button>
      </div>
    </div>
  );
}

function LogViewer({ run }: { run: SandboxRun }) {
  const levelColors: Record<string, string> = { info: T.tx2, warn: T.warn, error: T.dn, trade: T.up, signal: T.brand };
  return (
    <div style={{ background: T.bg0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', fontFamily: T.mono, fontSize: '7px', maxHeight: '400px', overflow: 'auto' }}>
      {run.logs.map((log, i) => (
        <div key={i} style={{ padding: '2px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: '6px' }}>
          <span style={{ color: T.tx3, minWidth: '55px' }}>{log.time}</span>
          <span style={{ minWidth: '35px', color: levelColors[log.level], fontWeight: 700 }}>[{log.level.toUpperCase()}]</span>
          <span style={{ color: T.tx1 }}>{log.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type SBTab = 'runs' | 'logs' | 'new';

export default function SandboxRunnerUI2() {
  const [tab, setTab] = useState<SBTab>('runs');
  const [selectedRun, setSelectedRun] = useState(0);
  const runs = useMemo(() => generateRuns(), []);
  const active = runs.filter(r => r.status === 'running').length;

  return (
    <div data-testid="sandbox-runner-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SANDBOX RUNNER</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Active: <span style={{ color: T.up }}>{active}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Total: <span style={{ color: T.tx0 }}>{runs.length}</span></span>
        <div style={{ flex: 1 }} />
        <button style={{ background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '3px 10px', fontSize: '8px', fontWeight: 700, cursor: 'pointer' }}>+ New Run</button>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'runs' as SBTab, label: '🚀 Runs' },
          { key: 'logs' as SBTab, label: '📜 Logs' },
          { key: 'new' as SBTab, label: '➕ New Strategy' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'runs' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
            {runs.map(r => <RunCard key={r.id} run={r} />)}
          </div>
        )}
        {tab === 'logs' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {runs.map((r, i) => (
                <button key={r.id} onClick={() => setSelectedRun(i)} style={{
                  background: selectedRun === i ? T.bg3 : T.bg2, color: selectedRun === i ? T.tx0 : T.tx3,
                  border: `1px solid ${selectedRun === i ? T.brand : T.border}`, borderRadius: T.r,
                  padding: '3px 8px', fontSize: '8px', cursor: 'pointer',
                }}>{r.strategyName}</button>
              ))}
            </div>
            <LogViewer run={runs[selectedRun]} />
          </div>
        )}
        {tab === 'new' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px', maxWidth: '500px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>New Sandbox Run</div>
            {[
              { label: 'Strategy Name', placeholder: 'My Strategy v1' },
              { label: 'Initial Capital', placeholder: '100000' },
              { label: 'Start Date', placeholder: '2023-01-01' },
              { label: 'End Date', placeholder: '2024-03-22' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '8px', color: T.tx2, display: 'block', marginBottom: '2px' }}>{f.label}</label>
                <input placeholder={f.placeholder} style={{ width: '100%', background: T.bg2, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '5px 8px', fontSize: '9px', fontFamily: T.mono, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '8px', color: T.tx2, display: 'block', marginBottom: '2px' }}>Execution Mode</label>
              <select style={{ width: '100%', background: T.bg2, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '5px 8px', fontSize: '9px', fontFamily: T.mono }}>
                <option>Paper Trading (Simulated)</option>
                <option>Historical Backtest</option>
                <option>Live Sandbox (Delayed Data)</option>
              </select>
            </div>
            <button style={{ width: '100%', background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>🚀 Launch Sandbox</button>
          </div>
        )}
      </div>
    </div>
  );
}

export { SandboxRunnerUI2 };
