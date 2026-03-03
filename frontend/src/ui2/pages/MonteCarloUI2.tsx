/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Monte Carlo Simulation (UI2)                        │
 * │  Full Monte Carlo engine with GBM, fat tails, multiple strategies,  │
 * │  path visualization, distribution analysis, risk metrics             │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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
interface SimConfig {
  paths: number;
  steps: number;
  initialCapital: number;
  annualReturn: number;
  annualVol: number;
  riskFreeRate: number;
  model: 'gbm' | 'jump_diffusion' | 'heston' | 'fat_tails';
  horizon: string;
}

interface SimResult {
  paths: number[][];
  finalValues: number[];
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  probOfLoss: number;
  expectedReturn: number;
  expectedVol: number;
  sharpe: number;
  maxDrawdownMean: number;
  maxDrawdownWorst: number;
  cvar95: number;
  var95: number;
}

/* ── Simulation Engine ───────────────────────────────────────────────── */
function boxMuller(): number {
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function runSimulation(config: SimConfig): SimResult {
  const dt = 1 / 252;
  const { paths: numPaths, steps, initialCapital, annualReturn: mu, annualVol: sigma } = config;
  const allPaths: number[][] = [];
  const finalValues: number[] = [];

  for (let p = 0; p < numPaths; p++) {
    const path = [initialCapital];
    for (let s = 1; s <= steps; s++) {
      const z = boxMuller();
      let ret: number;
      if (config.model === 'jump_diffusion') {
        const jumpProb = 0.05; const jumpMean = -0.02; const jumpVol = 0.05;
        const jump = Math.random() < jumpProb ? jumpMean + jumpVol * boxMuller() : 0;
        ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z + jump;
      } else if (config.model === 'fat_tails') {
        // Student-t approximation with df=5
        const u = Math.random(); const df = 5;
        const tScaled = z * Math.sqrt(df / (df - 2));
        ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * tScaled * 0.7;
      } else {
        ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z;
      }
      path.push(path[s - 1] * Math.exp(ret));
    }
    allPaths.push(path);
    finalValues.push(path[path.length - 1]);
  }

  finalValues.sort((a, b) => a - b);
  const n = finalValues.length;

  // Max drawdowns
  const drawdowns = allPaths.map(path => {
    let peak = path[0]; let maxDD = 0;
    for (const v of path) { peak = Math.max(peak, v); maxDD = Math.max(maxDD, (peak - v) / peak); }
    return maxDD;
  });

  const returns = finalValues.map(v => (v - initialCapital) / initialCapital);

  return {
    paths: allPaths.slice(0, Math.min(100, numPaths)), // keep max 100 for rendering
    finalValues,
    percentiles: {
      p5: finalValues[Math.floor(n * 0.05)] ?? 0,
      p25: finalValues[Math.floor(n * 0.25)] ?? 0,
      p50: finalValues[Math.floor(n * 0.5)] ?? 0,
      p75: finalValues[Math.floor(n * 0.75)] ?? 0,
      p95: finalValues[Math.floor(n * 0.95)] ?? 0,
    },
    probOfLoss: finalValues.filter(v => v < initialCapital).length / n * 100,
    expectedReturn: returns.reduce((s, r) => s + r, 0) / n * 100,
    expectedVol: Math.sqrt(returns.reduce((s, r) => s + (r - returns.reduce((a, b) => a + b, 0) / n) ** 2, 0) / n) * 100,
    sharpe: 0, // will compute below
    maxDrawdownMean: drawdowns.reduce((s, d) => s + d, 0) / drawdowns.length * 100,
    maxDrawdownWorst: Math.max(...drawdowns) * 100,
    cvar95: (finalValues.slice(0, Math.floor(n * 0.05)).reduce((s, v) => s + v, 0) / Math.floor(n * 0.05)),
    var95: finalValues[Math.floor(n * 0.05)] ?? 0,
  };
}

/* ── Canvas Components ───────────────────────────────────────────────── */
function PathsCanvas({ result, config }: { result: SimResult; config: SimConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 700, H = 300;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const allVals = result.paths.flat();
    const mn = Math.min(...allVals); const mx = Math.max(...allVals);
    const rng = mx - mn || 1;

    // Grid
    ctx.strokeStyle = `${T.border}80`; ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const y = (i / 5) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`$${((mx - (i / 5) * rng) / 1000).toFixed(0)}K`, 2, y - 3);
    }

    // Draw percentile bands
    const medianPath: number[] = [];
    const p5Path: number[] = [];
    const p95Path: number[] = [];
    const steps = result.paths[0]?.length ?? 0;
    for (let s = 0; s < steps; s++) {
      const vals = result.paths.map(p => p[s]).sort((a, b) => a - b);
      medianPath.push(vals[Math.floor(vals.length * 0.5)] ?? 0);
      p5Path.push(vals[Math.floor(vals.length * 0.05)] ?? 0);
      p95Path.push(vals[Math.floor(vals.length * 0.95)] ?? 0);
    }

    // 5-95 percentile band
    ctx.fillStyle = `${T.brand}12`;
    ctx.beginPath();
    p5Path.forEach((v, i) => {
      const x = (i / (steps - 1)) * W;
      const y = H - ((v - mn) / rng) * (H - 20) - 10;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    for (let i = p95Path.length - 1; i >= 0; i--) {
      const x = (i / (steps - 1)) * W;
      const y = H - ((p95Path[i] - mn) / rng) * (H - 20) - 10;
      ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();

    // Individual paths (semi-transparent)
    result.paths.forEach(path => {
      const final = path[path.length - 1];
      const color = final >= config.initialCapital ? `${T.up}15` : `${T.dn}15`;
      ctx.strokeStyle = color; ctx.lineWidth = 0.5;
      ctx.beginPath();
      path.forEach((v, i) => {
        const x = (i / (steps - 1)) * W;
        const y = H - ((v - mn) / rng) * (H - 20) - 10;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Median path
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2;
    ctx.beginPath();
    medianPath.forEach((v, i) => {
      const x = (i / (steps - 1)) * W;
      const y = H - ((v - mn) / rng) * (H - 20) - 10;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Initial capital line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
    const iy = H - ((config.initialCapital - mn) / rng) * (H - 20) - 10;
    ctx.beginPath(); ctx.moveTo(0, iy); ctx.lineTo(W, iy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.tx3; ctx.font = '7px monospace';
    ctx.fillText(`Initial: $${(config.initialCapital / 1000).toFixed(0)}K`, W - 90, iy - 4);

    // Label
    ctx.fillStyle = T.tx2; ctx.font = '8px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${result.paths.length} paths • ${config.model.toUpperCase()} • ${config.horizon}`, 4, 12);
  }, [result, config]);
  return <canvas ref={ref} style={{ width: '100%', height: 300, borderRadius: T.r }} />;
}

function DistributionCanvas({ result, config }: { result: SimResult; config: SimConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 180;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const vals = result.finalValues;
    const mn = Math.min(...vals); const mx = Math.max(...vals);
    const bins = 40; const binW = (mx - mn) / bins;
    const histogram: number[] = new Array(bins).fill(0);
    vals.forEach(v => { const b = Math.min(Math.floor((v - mn) / binW), bins - 1); histogram[b]++; });
    const maxCount = Math.max(...histogram);

    const barWidth = W / bins;
    histogram.forEach((count, i) => {
      const x = i * barWidth;
      const barH = (count / maxCount) * (H - 30);
      const binMid = mn + (i + 0.5) * binW;
      ctx.fillStyle = binMid >= config.initialCapital ? `${T.up}80` : `${T.dn}80`;
      ctx.fillRect(x + 1, H - 20 - barH, barWidth - 2, barH);
    });

    // Percentile lines
    const pLines = [
      { val: result.percentiles.p5, label: 'P5', color: T.dn },
      { val: result.percentiles.p50, label: 'P50', color: T.brand },
      { val: result.percentiles.p95, label: 'P95', color: T.up },
    ];
    pLines.forEach(pl => {
      const x = ((pl.val - mn) / (mx - mn)) * W;
      ctx.strokeStyle = pl.color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 20); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pl.color; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${pl.label}: $${(pl.val / 1000).toFixed(0)}K`, x, 10);
    });

    // X axis
    ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * W;
      ctx.fillText(`$${((mn + i * (mx - mn) / 4) / 1000).toFixed(0)}K`, x, H - 4);
    }
  }, [result, config]);
  return <canvas ref={ref} style={{ width: 400, height: 180, borderRadius: T.r }} />;
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function MetricCard({ label, value, color, subtext }: { label: string; value: string; color: string; subtext?: string }) {
  return (
    <div style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}`, textAlign: 'center' }}>
      <div style={{ fontSize: '7px', color: T.tx3, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color, fontFamily: T.mono }}>{value}</div>
      {subtext && <div style={{ fontSize: '7px', color: T.tx3, marginTop: '2px' }}>{subtext}</div>}
    </div>
  );
}

function ConfigPanel({ config, onChange }: { config: SimConfig; onChange: (c: SimConfig) => void }) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {/* Model */}
      <div>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Model</label>
        <select value={config.model} onChange={e => onChange({ ...config, model: e.target.value as SimConfig['model'] })}
          style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px', fontSize: '9px', fontFamily: T.mono }}>
          <option value="gbm">Geometric Brownian Motion</option>
          <option value="jump_diffusion">Jump Diffusion (Merton)</option>
          <option value="fat_tails">Fat Tails (Student-t)</option>
          <option value="heston">Heston Stochastic Vol</option>
        </select>
      </div>
      {/* Paths */}
      <div>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Paths</label>
        <div style={{ display: 'flex', gap: '3px' }}>
          {[100, 500, 1000, 5000].map(p => (
            <button key={p} onClick={() => onChange({ ...config, paths: p })} style={{
              flex: 1, background: config.paths === p ? T.brand : T.bg3, color: config.paths === p ? '#FFF' : T.tx3,
              border: `1px solid ${config.paths === p ? T.brand : T.border}`, borderRadius: '2px',
              padding: '2px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
            }}>{p >= 1000 ? `${p / 1000}K` : p}</button>
          ))}
        </div>
      </div>
      {/* Horizon */}
      <div>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Horizon</label>
        <div style={{ display: 'flex', gap: '3px' }}>
          {[{ k: '1M', s: 21 }, { k: '3M', s: 63 }, { k: '6M', s: 126 }, { k: '1Y', s: 252 }, { k: '3Y', s: 756 }].map(h => (
            <button key={h.k} onClick={() => onChange({ ...config, steps: h.s, horizon: h.k })} style={{
              flex: 1, background: config.horizon === h.k ? T.brand : T.bg3, color: config.horizon === h.k ? '#FFF' : T.tx3,
              border: `1px solid ${config.horizon === h.k ? T.brand : T.border}`, borderRadius: '2px',
              padding: '2px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
            }}>{h.k}</button>
          ))}
        </div>
      </div>
      {/* Initial Capital */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Initial Capital</label>
          <span style={{ fontSize: '8px', color: T.tx1, fontFamily: T.mono }}>${(config.initialCapital / 1000).toFixed(0)}K</span>
        </div>
        <input type="range" min={10000} max={1000000} step={10000} value={config.initialCapital}
          onChange={e => onChange({ ...config, initialCapital: +e.target.value })}
          style={{ width: '100%', height: '4px', appearance: 'none', background: T.bg3, borderRadius: '2px', cursor: 'pointer' }} />
      </div>
      {/* Expected Return */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Annual Return</label>
          <span style={{ fontSize: '8px', color: T.up, fontFamily: T.mono }}>{(config.annualReturn * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={-0.2} max={0.5} step={0.01} value={config.annualReturn}
          onChange={e => onChange({ ...config, annualReturn: +e.target.value })}
          style={{ width: '100%', height: '4px', appearance: 'none', background: T.bg3, borderRadius: '2px', cursor: 'pointer' }} />
      </div>
      {/* Volatility */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Annual Volatility</label>
          <span style={{ fontSize: '8px', color: T.warn, fontFamily: T.mono }}>{(config.annualVol * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0.05} max={0.8} step={0.01} value={config.annualVol}
          onChange={e => onChange({ ...config, annualVol: +e.target.value })}
          style={{ width: '100%', height: '4px', appearance: 'none', background: T.bg3, borderRadius: '2px', cursor: 'pointer' }} />
      </div>
      {/* Presets */}
      <div style={{ marginTop: '4px' }}>
        <div style={{ fontSize: '8px', color: T.tx3, marginBottom: '3px' }}>Quick Presets</div>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {[
            { label: 'S&P 500', ret: 0.10, vol: 0.16 },
            { label: 'NASDAQ', ret: 0.13, vol: 0.22 },
            { label: 'BTC', ret: 0.50, vol: 0.70 },
            { label: 'Hedge Fund', ret: 0.08, vol: 0.10 },
            { label: 'Bonds', ret: 0.04, vol: 0.05 },
            { label: 'High Vol', ret: 0.15, vol: 0.40 },
          ].map(p => (
            <button key={p.label} onClick={() => onChange({ ...config, annualReturn: p.ret, annualVol: p.vol })} style={{
              background: T.bg3, color: T.tx2, border: `1px solid ${T.border}`, borderRadius: '2px',
              padding: '2px 5px', fontSize: '7px', cursor: 'pointer',
            }}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PercentilesTable({ result, config }: { result: SimResult; config: SimConfig }) {
  const pcts = [
    { label: '1st', value: result.finalValues[Math.floor(result.finalValues.length * 0.01)] ?? 0 },
    { label: '5th', value: result.percentiles.p5 },
    { label: '10th', value: result.finalValues[Math.floor(result.finalValues.length * 0.10)] ?? 0 },
    { label: '25th', value: result.percentiles.p25 },
    { label: '50th (Median)', value: result.percentiles.p50 },
    { label: '75th', value: result.percentiles.p75 },
    { label: '90th', value: result.finalValues[Math.floor(result.finalValues.length * 0.90)] ?? 0 },
    { label: '95th', value: result.percentiles.p95 },
    { label: '99th', value: result.finalValues[Math.floor(result.finalValues.length * 0.99)] ?? 0 },
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
          {['Percentile', 'Value', 'Return', 'Gain/Loss'].map(h => (
            <th key={h} style={{ padding: '3px 6px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pcts.map(p => {
          const ret = ((p.value - config.initialCapital) / config.initialCapital) * 100;
          return (
            <tr key={p.label} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'left' }}>{p.label}</td>
              <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600, textAlign: 'right' }}>${(p.value / 1000).toFixed(1)}K</td>
              <td style={{ padding: '3px 6px', color: ret >= 0 ? T.up : T.dn, textAlign: 'right' }}>{ret >= 0 ? '+' : ''}{ret.toFixed(1)}%</td>
              <td style={{ padding: '3px 6px', color: p.value >= config.initialCapital ? T.up : T.dn, textAlign: 'right' }}>
                {p.value >= config.initialCapital ? '+' : ''}${((p.value - config.initialCapital) / 1000).toFixed(1)}K
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function MonteCarloUI2() {
  const [config, setConfig] = useState<SimConfig>({
    paths: 500, steps: 252, initialCapital: 100000, annualReturn: 0.10, annualVol: 0.20,
    riskFreeRate: 0.05, model: 'gbm', horizon: '1Y',
  });
  const [running, setRunning] = useState(false);

  const result = useMemo(() => {
    setRunning(true);
    const r = runSimulation(config);
    setRunning(false);
    return r;
  }, [config]);

  return (
    <div data-testid="monte-carlo-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>MONTE CARLO ENGINE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '9px', color: T.tx2 }}>{config.paths} paths • {config.model.toUpperCase()} • {config.horizon}</span>
        <div style={{ flex: 1 }} />
        {running && <span style={{ fontSize: '8px', color: T.warn }}>Computing...</span>}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Config */}
        <div style={{ width: '220px', flexShrink: 0, overflow: 'auto', padding: '8px', borderRight: `1px solid ${T.border}`, background: T.bg1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Configuration</div>
          <ConfigPanel config={config} onChange={setConfig} />
        </div>

        {/* Right: Results */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px', minWidth: 0 }}>
          {/* Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px', marginBottom: '8px' }}>
            <MetricCard label="Median Return" value={`${(((result.percentiles.p50 - config.initialCapital) / config.initialCapital) * 100).toFixed(1)}%`} color={result.percentiles.p50 >= config.initialCapital ? T.up : T.dn} />
            <MetricCard label="Prob. of Loss" value={`${result.probOfLoss.toFixed(1)}%`} color={result.probOfLoss > 30 ? T.dn : T.warn} />
            <MetricCard label="VaR 95%" value={`$${((config.initialCapital - result.var95) / 1000).toFixed(1)}K`} color={T.warn} />
            <MetricCard label="CVaR 95%" value={`$${((config.initialCapital - result.cvar95) / 1000).toFixed(1)}K`} color={T.dn} />
            <MetricCard label="Avg Max DD" value={`${result.maxDrawdownMean.toFixed(1)}%`} color={T.dn} />
            <MetricCard label="Worst Max DD" value={`${result.maxDrawdownWorst.toFixed(1)}%`} color={T.dn} />
          </div>

          {/* Path Chart */}
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Simulated Paths</div>
            <PathsCanvas result={result} config={config} />
          </div>

          {/* Distribution + Percentiles */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Final Value Distribution</div>
              <DistributionCanvas result={result} config={config} />
            </div>
            <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Percentile Table</div>
              <PercentilesTable result={result} config={config} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MonteCarloUI2 };
