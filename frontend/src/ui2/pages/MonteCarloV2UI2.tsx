/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Monte Carlo V2 Advanced Simulation (UI2)          │
 * │  Multi-model stochastic simulation with stress scenarios,          │
 * │  tail risk analysis, and convergence diagnostics                    │
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
interface MCConfig {
  model: string; paths: number; steps: number; horizon: string;
  mu: number; sigma: number; kappa?: number; theta?: number;
  rho?: number; jumpIntensity?: number; jumpMean?: number;
}

interface MCResult {
  pathData: number[][]; // 20 sample paths
  percentiles: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] };
  finalStats: { mean: number; median: number; std: number; skew: number; kurtosis: number; var95: number; cvar95: number; maxDD: number; probLoss: number };
  convergence: { n: number[]; meanEst: number[]; stdEst: number[] };
}

interface StressResult {
  scenario: string; impact: number; probability: number; recovery: string; var95: number; description: string;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateMCResult(): MCResult {
  const paths: number[][] = [];
  for (let p = 0; p < 20; p++) {
    const path = [100];
    for (let s = 1; s <= 252; s++) {
      const drift = 0.08 / 252;
      const vol = 0.22 / Math.sqrt(252);
      const jump = Math.random() < 0.02 ? (Math.random() - 0.5) * 0.08 : 0;
      path.push(path[s-1] * Math.exp(drift - 0.5 * vol * vol + vol * (Math.random() * 2 - 1) * 1.5 + jump));
    }
    paths.push(path);
  }

  const pctSteps = 252;
  const gen = (mul: number, drift: number) => {
    const arr = [100]; for (let i = 1; i <= pctSteps; i++) arr.push(arr[i-1] * (1 + drift / pctSteps + mul * (Math.random() - 0.5) * 0.01)); return arr;
  };

  return {
    pathData: paths,
    percentiles: {
      p5: gen(1.8, -0.15),
      p25: gen(0.8, -0.02),
      p50: gen(0.3, 0.08),
      p75: gen(0.8, 0.18),
      p95: gen(1.5, 0.30),
    },
    finalStats: {
      mean: 108.23, median: 106.89, std: 22.15, skew: -0.34,
      kurtosis: 3.82, var95: -18.5, cvar95: -24.3, maxDD: -32.1, probLoss: 38.7,
    },
    convergence: {
      n: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
      meanEst: [106.8, 107.9, 108.1, 108.0, 108.2, 108.21, 108.23, 108.22, 108.23],
      stdEst: [23.5, 22.8, 22.4, 22.2, 22.18, 22.16, 22.15, 22.15, 22.15],
    },
  };
}

function generateStress(): StressResult[] {
  return [
    { scenario: '2008 Financial Crisis', impact: -42.3, probability: 0.8, recovery: '18 months', var95: -38.5, description: 'SPX-like drawdown with credit contagion' },
    { scenario: 'COVID March 2020', impact: -33.9, probability: 1.5, recovery: '5 months', var95: -30.2, description: 'Sudden vol spike with V-shaped recovery' },
    { scenario: 'Dot-Com Bust', impact: -49.1, probability: 0.5, recovery: '30 months', var95: -45.8, description: 'Prolonged tech deflation with sector rotation' },
    { scenario: 'Flash Crash', impact: -8.7, probability: 3.0, recovery: '2 days', var95: -7.5, description: 'Intraday liquidity evaporation' },
    { scenario: 'Rate Shock +200bp', impact: -18.5, probability: 5.0, recovery: '6 months', var95: -16.2, description: 'Sudden rate hike with duration repricing' },
    { scenario: 'Geopolitical Crisis', impact: -22.4, probability: 2.0, recovery: '4 months', var95: -19.8, description: 'Trade war escalation or conflict premium' },
    { scenario: 'Inflation Surge', impact: -15.2, probability: 4.0, recovery: '12 months', var95: -13.1, description: 'Persistent inflation above 6%' },
    { scenario: 'Black Swan (6σ)', impact: -58.7, probability: 0.1, recovery: '36 months', var95: -52.3, description: 'Extreme tail event beyond models' },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function FanChart({ result }: { result: MCResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 250;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);

    const all = [...result.percentiles.p5, ...result.percentiles.p95];
    const mn = Math.min(...all); const mx = Math.max(...all); const rng = mx - mn || 1;
    const steps = result.percentiles.p50.length;
    const toX = (i: number) => (i / (steps - 1)) * W;
    const toY = (v: number) => H - 10 - ((v - mn) / rng) * (H - 20);

    // 5-95 band
    ctx.fillStyle = `${T.brand}10`;
    ctx.beginPath();
    for (let i = 0; i < steps; i++) ctx.lineTo(toX(i), toY(result.percentiles.p95[i]));
    for (let i = steps - 1; i >= 0; i--) ctx.lineTo(toX(i), toY(result.percentiles.p5[i]));
    ctx.closePath(); ctx.fill();

    // 25-75 band
    ctx.fillStyle = `${T.brand}20`;
    ctx.beginPath();
    for (let i = 0; i < steps; i++) ctx.lineTo(toX(i), toY(result.percentiles.p75[i]));
    for (let i = steps - 1; i >= 0; i--) ctx.lineTo(toX(i), toY(result.percentiles.p25[i]));
    ctx.closePath(); ctx.fill();

    // Sample paths
    result.pathData.forEach((path, pi) => {
      ctx.strokeStyle = `${[T.tx3, T.up, T.dn, T.warn, T.info][pi % 5]}30`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path.forEach((v, i) => { const x = toX(i); const y = toY(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();
    });

    // Median line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 1.5;
    ctx.beginPath();
    result.percentiles.p50.forEach((v, i) => { const x = toX(i); const y = toY(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();

    // P5/P95 lines
    [{ d: result.percentiles.p5, c: T.dn, l: 'P5' }, { d: result.percentiles.p95, c: T.up, l: 'P95' }].forEach(({ d, c, l }) => {
      ctx.strokeStyle = c; ctx.lineWidth = 0.8; ctx.setLineDash([3, 2]);
      ctx.beginPath(); d.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Start line
    ctx.strokeStyle = `${T.tx3}40`; ctx.lineWidth = 0.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(0, toY(100)); ctx.lineTo(W, toY(100)); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = T.tx3; ctx.font = `6px ${T.mono}`; ctx.textAlign = 'left';
    ctx.fillText('P95', 5, toY(result.percentiles.p95[0]) - 3);
    ctx.fillText('P50', 5, toY(result.percentiles.p50[0]) - 3);
    ctx.fillText('P5', 5, toY(result.percentiles.p5[0]) - 3);
  }, [result]);
  return <canvas ref={ref} style={{ width: '100%', height: 250, borderRadius: T.r }} />;
}

function ConvergenceChart({ data }: { data: MCResult['convergence'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 150;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const mn = Math.min(...data.meanEst) - 1; const mx = Math.max(...data.meanEst) + 1; const rng = mx - mn || 1;
    const toX = (i: number) => 10 + (i / (data.n.length - 1)) * (W - 20);
    const toY = (v: number) => H - 10 - ((v - mn) / rng) * (H - 20);

    // True value
    const trueY = toY(108.23);
    ctx.strokeStyle = `${T.up}50`; ctx.lineWidth = 0.5; ctx.setLineDash([4, 2]);
    ctx.beginPath(); ctx.moveTo(10, trueY); ctx.lineTo(W - 10, trueY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.tx3; ctx.font = `6px ${T.mono}`; ctx.fillText('TRUE', W - 32, trueY - 3);

    // Mean convergence line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.meanEst.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
    ctx.stroke();

    // Points
    data.meanEst.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(toX(i), toY(v), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = T.brand; ctx.fill();
    });

    // X axis labels
    ctx.fillStyle = T.tx3; ctx.font = `5px ${T.mono}`; ctx.textAlign = 'center';
    data.n.forEach((n, i) => {
      ctx.fillText(n >= 1000 ? `${n/1000}K` : String(n), toX(i), H - 2);
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 150, borderRadius: T.r }} />;
}

function TailDistChart() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 140;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    // Simulated return distribution
    const bins = 50; const barW = W / bins;
    const data: number[] = [];
    for (let i = 0; i < bins; i++) {
      const x = (i - bins / 2) / (bins / 6);
      data.push(Math.exp(-x * x / 2) * (1 + (i < 8 || i > 42 ? 0.3 : 0)));
    }
    const mx = Math.max(...data);

    data.forEach((d, i) => {
      const h = (d / mx) * (H - 20);
      const x = i * barW;
      const isLeft = i < 5; const isRight = i > bins - 6;
      ctx.fillStyle = isLeft ? `${T.dn}80` : isRight ? `${T.up}60` : `${T.brand}50`;
      ctx.fillRect(x + 0.5, H - h, barW - 1, h);
    });

    // VaR line
    const varBin = 5;
    ctx.strokeStyle = T.dn; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(varBin * barW, 0); ctx.lineTo(varBin * barW, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.dn; ctx.font = `bold 7px ${T.mono}`; ctx.textAlign = 'left';
    ctx.fillText('VaR 95%', varBin * barW + 3, 12);

    ctx.fillStyle = T.tx3; ctx.font = `6px ${T.mono}`; ctx.textAlign = 'center';
    ctx.fillText('← Losses', 30, H - 3);
    ctx.fillText('Gains →', W - 30, H - 3);
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 140, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type MCTab = 'simulation' | 'stress' | 'convergence' | 'stats';

const models = ['Geometric Brownian Motion', 'Heston Stochastic Vol', 'Merton Jump Diffusion', 'SABR', 'Variance Gamma', 'NIG'];

export default function MonteCarloV2UI2() {
  const [tab, setTab] = useState<MCTab>('simulation');
  const [model, setModel] = useState(0);
  const result = useMemo(() => generateMCResult(), []);
  const stress = useMemo(() => generateStress(), []);

  return (
    <div data-testid="montecarlo-v2-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>MONTE CARLO V2</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={model} onChange={e => setModel(+e.target.value)} style={{ background: T.bg2, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '8px', fontFamily: T.mono }}>
          {models.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Paths: <span style={{ color: T.brand }}>100,000</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'simulation' as MCTab, label: '📊 Simulation' },
          { key: 'stress' as MCTab, label: '⚡ Stress' },
          { key: 'convergence' as MCTab, label: '📈 Convergence' },
          { key: 'stats' as MCTab, label: '📋 Statistics' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'simulation' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Fan Chart — {models[model]}</div>
            <FanChart result={result} />
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Return Distribution</div>
              <TailDistChart />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '8px' }}>
              {[
                { label: 'E[Return]', value: `${(result.finalStats.mean - 100).toFixed(2)}%`, color: T.up },
                { label: 'Std Dev', value: `${result.finalStats.std.toFixed(2)}%`, color: T.tx0 },
                { label: 'VaR 95%', value: `${result.finalStats.var95.toFixed(1)}%`, color: T.dn },
                { label: 'CVaR 95%', value: `${result.finalStats.cvar95.toFixed(1)}%`, color: T.dn },
                { label: 'P(Loss)', value: `${result.finalStats.probLoss.toFixed(1)}%`, color: T.warn },
              ].map(m => (
                <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '6px', color: T.tx3 }}>{m.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: m.color, fontFamily: T.mono }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'stress' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Historical Stress Scenarios</div>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['Scenario','Impact','VaR 95%','P(Occur)','Recovery','Description'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: h === 'Scenario' || h === 'Description' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {stress.map(s => (
                    <tr key={s.scenario} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', fontWeight: 700, color: T.tx0 }}>{s.scenario}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.dn, fontWeight: 700 }}>{s.impact.toFixed(1)}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.dn }}>{s.var95.toFixed(1)}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.warn }}>{s.probability}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{s.recovery}</td>
                      <td style={{ padding: '4px', color: T.tx2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'convergence' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Mean Estimate Convergence</div>
            <ConvergenceChart data={result.convergence} />
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden', marginTop: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['# Paths','Mean Est.','Std Est.','Mean Error','Converged'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.convergence.n.map((n, i) => (
                    <tr key={n} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx0 }}>{n.toLocaleString()}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{result.convergence.meanEst[i].toFixed(3)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{result.convergence.stdEst[i].toFixed(3)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: Math.abs(result.convergence.meanEst[i] - 108.23) < 0.1 ? T.up : T.warn }}>
                        {Math.abs(result.convergence.meanEst[i] - 108.23).toFixed(3)}
                      </td>
                      <td style={{ padding: '4px', textAlign: 'right', color: Math.abs(result.convergence.meanEst[i] - 108.23) < 0.05 ? T.up : T.tx3 }}>
                        {Math.abs(result.convergence.meanEst[i] - 108.23) < 0.05 ? '✓' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
            {[
              { group: 'Central Tendency', items: [
                { k: 'Mean', v: result.finalStats.mean.toFixed(2) },
                { k: 'Median', v: result.finalStats.median.toFixed(2) },
              ]},
              { group: 'Dispersion', items: [
                { k: 'Std Deviation', v: result.finalStats.std.toFixed(2) },
                { k: 'Skewness', v: result.finalStats.skew.toFixed(3) },
                { k: 'Kurtosis', v: result.finalStats.kurtosis.toFixed(3) },
              ]},
              { group: 'Risk Measures', items: [
                { k: 'VaR (95%)', v: `${result.finalStats.var95.toFixed(1)}%` },
                { k: 'CVaR (95%)', v: `${result.finalStats.cvar95.toFixed(1)}%` },
                { k: 'Max Drawdown', v: `${result.finalStats.maxDD.toFixed(1)}%` },
                { k: 'P(Loss)', v: `${result.finalStats.probLoss.toFixed(1)}%` },
              ]},
              { group: 'Simulation Config', items: [
                { k: 'Model', v: models[model] },
                { k: 'Paths', v: '100,000' },
                { k: 'Steps/Path', v: '252' },
                { k: 'Horizon', v: '1 Year' },
              ]},
            ].map(g => (
              <div key={g.group} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: T.brand, marginBottom: '6px', borderBottom: `1px solid ${T.border}`, paddingBottom: '4px' }}>{g.group}</div>
                {g.items.map(item => (
                  <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '8px' }}>
                    <span style={{ color: T.tx3 }}>{item.k}</span>
                    <span style={{ color: T.tx0, fontFamily: T.mono, fontWeight: 600 }}>{item.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { MonteCarloV2UI2 };
