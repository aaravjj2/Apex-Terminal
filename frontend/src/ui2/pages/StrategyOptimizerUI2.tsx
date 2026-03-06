/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Strategy Optimizer (UI2)                           │
 * │  Grid search, genetic algorithm, Bayesian optimization,             │
 * │  parameter space visualization, objective function tuning           │
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
interface OptResult {
  id: number;
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  profitFactor: number;
  calmarRatio: number;
  objective: number;
  generation?: number;
}

interface ParamConfig {
  name: string;
  min: number;
  max: number;
  step: number;
  current: number;
  type: 'int' | 'float';
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateParamConfigs(): ParamConfig[] {
  return [
    { name: 'lookback', min: 5, max: 60, step: 1, current: 20, type: 'int' },
    { name: 'entryZ', min: 0.5, max: 4.0, step: 0.1, current: 2.0, type: 'float' },
    { name: 'exitZ', min: 0.0, max: 2.0, step: 0.1, current: 0.5, type: 'float' },
    { name: 'stopLoss', min: 0.5, max: 5.0, step: 0.1, current: 2.0, type: 'float' },
    { name: 'takeProfit', min: 1.0, max: 10.0, step: 0.5, current: 4.0, type: 'float' },
    { name: 'positionSize', min: 0.5, max: 10.0, step: 0.5, current: 2.0, type: 'float' },
    { name: 'rsiPeriod', min: 5, max: 30, step: 1, current: 14, type: 'int' },
    { name: 'macdFast', min: 5, max: 20, step: 1, current: 12, type: 'int' },
  ];
}

function generateResults(count: number): OptResult[] {
  return Array.from({ length: count }, (_, i) => {
    const sharpe = 0.2 + Math.random() * 2.5;
    const ret = -10 + Math.random() * 60;
    const mdd = -(5 + Math.random() * 30);
    return {
      id: i + 1,
      params: {
        lookback: Math.round(5 + Math.random() * 55),
        entryZ: +(0.5 + Math.random() * 3.5).toFixed(1),
        exitZ: +(Math.random() * 2).toFixed(1),
        stopLoss: +(0.5 + Math.random() * 4.5).toFixed(1),
        takeProfit: +(1 + Math.random() * 9).toFixed(1),
      },
      sharpe,
      totalReturn: ret,
      maxDrawdown: mdd,
      winRate: 35 + Math.random() * 35,
      trades: Math.floor(50 + Math.random() * 500),
      profitFactor: 0.5 + Math.random() * 2.5,
      calmarRatio: Math.abs(ret / mdd),
      objective: sharpe * 0.4 + (ret / 100) * 0.3 + (1 + mdd / 100) * 0.3,
      generation: Math.ceil((i + 1) / (count / 10)),
    };
  }).sort((a, b) => b.objective - a.objective);
}

function ConvergenceCanvas({ results }: { results: OptResult[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 450, H = 160;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    // Group by generation and find best per generation
    const gens = new Map<number, number>();
    results.forEach(r => {
      const g = r.generation || 1;
      gens.set(g, Math.max(gens.get(g) || 0, r.objective));
    });
    const genArr = Array.from(gens.entries()).sort((a, b) => a[0] - b[0]);
    const maxObj = Math.max(...genArr.map(g => g[1]));
    const minObj = Math.min(...genArr.map(g => g[1]));
    const rng = maxObj - minObj || 1;

    const pad = { l: 35, r: 10, t: 15, b: 25 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = `${T.border}80`; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'right';
      ctx.fillText((maxObj - (i / 4) * rng).toFixed(2), pad.l - 3, y + 3);
    }

    // Best-so-far line
    let bestSoFar = 0;
    const bestLine: [number, number][] = [];
    genArr.forEach(([g, obj], i) => {
      bestSoFar = Math.max(bestSoFar, obj);
      const x = pad.l + (i / (genArr.length - 1 || 1)) * plotW;
      const y = pad.t + ((maxObj - bestSoFar) / rng) * plotH;
      bestLine.push([x, y]);
    });

    ctx.strokeStyle = T.up; ctx.lineWidth = 2;
    ctx.beginPath();
    bestLine.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // All points
    genArr.forEach(([g, obj], i) => {
      const x = pad.l + (i / (genArr.length - 1 || 1)) * plotW;
      const y = pad.t + ((maxObj - obj) / rng) * plotH;
      ctx.fillStyle = `${T.brand}60`; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });

    // Labels
    ctx.fillStyle = T.tx2; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Generation / Iteration', W / 2, H - 3);
  }, [results]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type SOTab = 'config' | 'results' | 'convergence' | 'best';

export default function StrategyOptimizerUI2() {
  const [tab, setTab] = useState<SOTab>('results');
  const [method, setMethod] = useState('bayesian');
  const [objective, setObjective] = useState('sharpe');
  const params = useMemo(() => generateParamConfigs(), []);
  const results = useMemo(() => generateResults(200), []);
  const best = results[0];

  return (
    <div data-testid="strategy-optimizer-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none',width:1,height:1}} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>STRATEGY OPTIMIZER</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={method} onChange={e => setMethod(e.target.value)}
          style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '9px', fontFamily: T.mono }}>
          <option value="grid">Grid Search</option>
          <option value="genetic">Genetic Algorithm</option>
          <option value="bayesian">Bayesian Optimization</option>
          <option value="random">Random Search</option>
        </select>
        <select value={objective} onChange={e => setObjective(e.target.value)}
          style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '9px', fontFamily: T.mono }}>
          <option value="sharpe">Max Sharpe</option>
          <option value="return">Max Return</option>
          <option value="calmar">Max Calmar</option>
          <option value="composite">Composite</option>
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Evaluated: <span style={{ color: T.tx0 }}>{results.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Best: <span style={{ color: T.up }}>{best.sharpe.toFixed(2)}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'config' as SOTab, label: '⚙️ Parameters' },
          { key: 'results' as SOTab, label: '📋 Results' },
          { key: 'convergence' as SOTab, label: '📈 Convergence' },
          { key: 'best' as SOTab, label: '🏆 Best' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'config' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Parameter Space Configuration</div>
            {params.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ width: '100px', fontSize: '9px', color: T.brand, fontFamily: T.mono, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>[{p.min} — {p.max}]</span>
                <div style={{ flex: 1, height: 4, background: T.bg3, borderRadius: 2, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: `${((p.current - p.min) / (p.max - p.min)) * 100}%`, top: -3, width: 10, height: 10, borderRadius: '50%', background: T.brand, border: `1px solid ${T.tx0}` }} />
                </div>
                <span style={{ fontSize: '9px', color: T.tx0, fontFamily: T.mono, fontWeight: 700, width: '40px', textAlign: 'right' }}>{p.current}</span>
                <span style={{ fontSize: '7px', color: T.tx3, fontFamily: T.mono }}>step: {p.step}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button style={{ background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '6px 16px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>🚀 Run Optimization</button>
              <button style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px 16px', fontSize: '9px', cursor: 'pointer' }}>Reset</button>
            </div>
          </div>
        )}
        {tab === 'results' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Top 30 Results (of {results.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px', fontFamily: T.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                  {['#', 'Sharpe', 'Return', 'MDD', 'Win%', 'Trades', 'PF', 'Calmar', 'lookback', 'entryZ', 'stopLoss'].map(h => (
                    <th key={h} style={{ padding: '3px 3px', color: T.tx3, fontWeight: 600, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 30).map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}`, background: i === 0 ? `${T.up}08` : 'transparent' }}>
                    <td style={{ padding: '3px 3px', color: i < 3 ? T.warn : T.tx3, fontWeight: i < 3 ? 700 : 400, textAlign: 'right' }}>{i + 1}</td>
                    <td style={{ padding: '3px 3px', color: r.sharpe > 1.5 ? T.up : T.tx1, fontWeight: 700, textAlign: 'right' }}>{r.sharpe.toFixed(2)}</td>
                    <td style={{ padding: '3px 3px', color: r.totalReturn > 0 ? T.up : T.dn, textAlign: 'right' }}>{r.totalReturn.toFixed(1)}%</td>
                    <td style={{ padding: '3px 3px', color: T.dn, textAlign: 'right' }}>{r.maxDrawdown.toFixed(1)}%</td>
                    <td style={{ padding: '3px 3px', color: r.winRate > 55 ? T.up : T.tx2, textAlign: 'right' }}>{r.winRate.toFixed(1)}%</td>
                    <td style={{ padding: '3px 3px', color: T.tx2, textAlign: 'right' }}>{r.trades}</td>
                    <td style={{ padding: '3px 3px', color: r.profitFactor > 1.5 ? T.up : T.tx2, textAlign: 'right' }}>{r.profitFactor.toFixed(2)}</td>
                    <td style={{ padding: '3px 3px', color: T.info, textAlign: 'right' }}>{r.calmarRatio.toFixed(2)}</td>
                    <td style={{ padding: '3px 3px', color: T.tx1, textAlign: 'right' }}>{r.params.lookback}</td>
                    <td style={{ padding: '3px 3px', color: T.tx1, textAlign: 'right' }}>{r.params.entryZ}</td>
                    <td style={{ padding: '3px 3px', color: T.tx1, textAlign: 'right' }}>{r.params.stopLoss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'convergence' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Optimization Convergence</div>
            <ConvergenceCanvas results={results} />
          </div>
        )}
        {tab === 'best' && best && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: T.up, marginBottom: '8px' }}>🏆 Best Configuration (#{best.id})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              {[
                { label: 'Sharpe Ratio', value: best.sharpe.toFixed(2), color: T.up },
                { label: 'Total Return', value: `${best.totalReturn.toFixed(1)}%`, color: T.up },
                { label: 'Max Drawdown', value: `${best.maxDrawdown.toFixed(1)}%`, color: T.dn },
                { label: 'Win Rate', value: `${best.winRate.toFixed(1)}%`, color: T.info },
                { label: 'Profit Factor', value: best.profitFactor.toFixed(2), color: T.brand },
                { label: 'Calmar Ratio', value: best.calmarRatio.toFixed(2), color: T.purple },
                { label: 'Total Trades', value: String(best.trades), color: T.tx1 },
                { label: 'Objective Score', value: best.objective.toFixed(3), color: T.warn },
              ].map(s => (
                <div key={s.label} style={{ background: T.bg2, borderRadius: T.r, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: T.tx3 }}>{s.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: s.color, fontFamily: T.mono }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Optimal Parameters</div>
            {Object.entries(best.params).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${T.border}`, fontSize: '9px' }}>
                <span style={{ color: T.brand, fontFamily: T.mono }}>{k}</span>
                <span style={{ color: T.tx0, fontWeight: 700, fontFamily: T.mono }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { StrategyOptimizerUI2 };
