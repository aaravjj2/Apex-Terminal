/**
 * MonteCarloSimUI2 — Monte Carlo Simulation Dashboard
 * Equity curve fan charts, drawdown distributions, probability analysis,
 * VaR/CVaR visualization, multi-strategy comparison, parameter sensitivity.
 */
import { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface SimConfig { paths: number; horizon: number; initialCapital: number; annReturn: number; annVol: number; distribution: string }
interface SimResult { paths: number[][]; percentiles: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] }; finalWealth: number[]; maxDrawdowns: number[]; sharpes: number[]; calmarRatios: number[] }

/* ─── Simulation Engine ──────────────────────────────────────────────── */
function runSimulation(config: SimConfig): SimResult {
  const { paths: nPaths, horizon, initialCapital, annReturn, annVol } = config;
  const dt = 1 / 252; // daily
  const mu = annReturn * dt;
  const sigma = annVol * Math.sqrt(dt);
  const steps = horizon;
  const allPaths: number[][] = [];
  const finalWealth: number[] = [];
  const maxDrawdowns: number[] = [];
  const sharpes: number[] = [];
  const calmarRatios: number[] = [];

  // Box-Muller for normal random
  function randn(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  for (let p = 0; p < nPaths; p++) {
    const path = [initialCapital];
    let peak = initialCapital;
    let maxDD = 0;
    const returns: number[] = [];

    for (let t = 1; t <= steps; t++) {
      const z = randn();
      const ret = mu + sigma * z;
      const newVal = path[t - 1] * (1 + ret);
      path.push(Math.max(newVal, 0));
      returns.push(ret);
      if (newVal > peak) peak = newVal;
      const dd = (peak - newVal) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    allPaths.push(path);
    finalWealth.push(path[path.length - 1]);
    maxDrawdowns.push(maxDD);

    const avgRet = returns.reduce((s, r) => s + r, 0) / returns.length;
    const stdRet = Math.sqrt(returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / returns.length);
    sharpes.push(stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0);
    calmarRatios.push(maxDD > 0 ? (avgRet * 252) / maxDD : 0);
  }

  // Compute percentiles per step
  const percentiles = { p5: [] as number[], p25: [] as number[], p50: [] as number[], p75: [] as number[], p95: [] as number[] };
  for (let t = 0; t <= steps; t++) {
    const vals = allPaths.map(p => p[t]).sort((a, b) => a - b);
    const idx = (pct: number) => Math.floor(vals.length * pct);
    percentiles.p5.push(vals[idx(0.05)]);
    percentiles.p25.push(vals[idx(0.25)]);
    percentiles.p50.push(vals[idx(0.50)]);
    percentiles.p75.push(vals[idx(0.75)]);
    percentiles.p95.push(vals[idx(0.95)]);
  }

  return { paths: allPaths.slice(0, 50), percentiles, finalWealth, maxDrawdowns, sharpes, calmarRatios };
}

/* ─── Canvas: Fan Chart ──────────────────────────────────────────────── */
function FanChart({ result, config }: { result: SimResult; config: SimConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const { percentiles: pct, paths } = result;
    const allVals = [...pct.p5, ...pct.p95];
    const minV = Math.min(...allVals) * 0.95;
    const maxV = Math.max(...allVals) * 1.05;
    const steps = pct.p50.length;
    const px = (t: number) => 50 + (t / (steps - 1)) * (w - 60);
    const py = (v: number) => 20 + ((maxV - v) / (maxV - minV)) * (h - 40);

    // 5-95 band
    ctx.beginPath();
    for (let t = 0; t < steps; t++) ctx.lineTo(px(t), py(pct.p95[t]));
    for (let t = steps - 1; t >= 0; t--) ctx.lineTo(px(t), py(pct.p5[t]));
    ctx.closePath(); ctx.fillStyle = 'rgba(245,166,35,0.08)'; ctx.fill();

    // 25-75 band
    ctx.beginPath();
    for (let t = 0; t < steps; t++) ctx.lineTo(px(t), py(pct.p75[t]));
    for (let t = steps - 1; t >= 0; t--) ctx.lineTo(px(t), py(pct.p25[t]));
    ctx.closePath(); ctx.fillStyle = 'rgba(245,166,35,0.15)'; ctx.fill();

    // Sample paths (first 20)
    paths.slice(0, 20).forEach(path => {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
      ctx.beginPath();
      path.forEach((v, t) => t === 0 ? ctx.moveTo(px(t), py(v)) : ctx.lineTo(px(t), py(v)));
      ctx.stroke();
    });

    // Percentile lines
    const lines = [
      { data: pct.p5, color: RED, dash: [4, 4], label: 'P5' },
      { data: pct.p25, color: '#888', dash: [2, 2], label: 'P25' },
      { data: pct.p50, color: AMBER, dash: [], label: 'MEDIAN' },
      { data: pct.p75, color: '#888', dash: [2, 2], label: 'P75' },
      { data: pct.p95, color: GREEN, dash: [4, 4], label: 'P95' },
    ];
    lines.forEach(l => {
      ctx.setLineDash(l.dash); ctx.strokeStyle = l.color; ctx.lineWidth = l.dash.length ? 1 : 2;
      ctx.beginPath();
      l.data.forEach((v, t) => t === 0 ? ctx.moveTo(px(t), py(v)) : ctx.lineTo(px(t), py(v)));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Initial capital line
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(50, py(config.initialCapital)); ctx.lineTo(w - 10, py(config.initialCapital)); ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minV + (maxV - minV) * (1 - i / 4);
      ctx.fillText(`$${(v / 1000).toFixed(0)}K`, 46, 20 + i * (h - 40) / 4 + 3);
    }

    // X-axis
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = Math.floor((steps - 1) * i / 4);
      ctx.fillText(`${t}d`, px(t), h - 4);
    }

    // Legend
    ctx.textAlign = 'left';
    lines.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillRect(60 + i * 70, 8, 12, 2);
      ctx.font = '8px monospace';
      ctx.fillText(l.label, 74 + i * 70, 11);
    });
  }, [result, config]);
  return <canvas ref={ref} style={{ width: '100%', height: 280, borderRadius: 4 }} />;
}

/* ─── Canvas: Histogram ──────────────────────────────────────────────── */
function HistogramChart({ data, label, unit, bins = 30 }: { data: number[]; label: string; unit: string; bins?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const sorted = [...data].sort((a, b) => a - b);
    const min = sorted[0], max = sorted[sorted.length - 1];
    const binWidth = (max - min) / bins;
    const histogram: number[] = new Array(bins).fill(0);
    data.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[idx]++;
    });
    const maxCount = Math.max(...histogram);
    const barW = (w - 60) / bins;

    histogram.forEach((count, i) => {
      const x = 40 + i * barW;
      const barH = (count / maxCount) * (h - 40);
      const val = min + (i + 0.5) * binWidth;
      // Color based on value
      const isNeg = unit === '$' ? val < data.reduce((s, v) => s + v, 0) / data.length * 0.8 :
                    unit === '%' ? val > 0.15 : val < 0;
      ctx.fillStyle = isNeg ? 'rgba(239,83,80,0.5)' : 'rgba(38,166,154,0.5)';
      ctx.fillRect(x, h - 25 - barH, barW - 1, barH);
    });

    // VaR line (5th percentile)
    const var5 = sorted[Math.floor(sorted.length * 0.05)];
    const varX = 40 + ((var5 - min) / (max - min)) * (w - 60);
    ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(varX, 10); ctx.lineTo(varX, h - 25); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = RED; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`VaR 5%`, varX, 8);

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * (i / 4);
      const x = 40 + (i / 4) * (w - 60);
      if (unit === '$') ctx.fillText(`$${(v / 1000).toFixed(0)}K`, x, h - 8);
      else if (unit === '%') ctx.fillText(`${(v * 100).toFixed(0)}%`, x, h - 8);
      else ctx.fillText(v.toFixed(2), x, h - 8);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = AMBER; ctx.font = '10px monospace';
    ctx.fillText(label, 8, 14);
  }, [data, label, unit, bins]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['SIMULATION', 'DISTRIBUTIONS', 'RISK METRICS', 'SENSITIVITY'] as const;
type Tab = typeof TABS[number];

export default function MonteCarloSimUI2() {
  const [tab, setTab] = useState<Tab>('SIMULATION');
  const [config, setConfig] = useState<SimConfig>({
    paths: 500, horizon: 252, initialCapital: 100000, annReturn: 0.12, annVol: 0.20, distribution: 'Normal'
  });

  const result = useMemo(() => runSimulation(config), [config]);

  // Statistics
  const stats = useMemo(() => {
    const fw = result.finalWealth;
    const sorted = [...fw].sort((a, b) => a - b);
    const mean = fw.reduce((s, v) => s + v, 0) / fw.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const std = Math.sqrt(fw.reduce((s, v) => s + (v - mean) ** 2, 0) / fw.length);
    const var5 = sorted[Math.floor(sorted.length * 0.05)];
    const cvar5 = sorted.slice(0, Math.floor(sorted.length * 0.05)).reduce((s, v) => s + v, 0) / Math.floor(sorted.length * 0.05);
    const probProfit = fw.filter(v => v > config.initialCapital).length / fw.length;
    const probDouble = fw.filter(v => v > config.initialCapital * 2).length / fw.length;
    const probRuin = fw.filter(v => v < config.initialCapital * 0.5).length / fw.length;
    const best = sorted[sorted.length - 1];
    const worst = sorted[0];
    const avgDD = result.maxDrawdowns.reduce((s, v) => s + v, 0) / result.maxDrawdowns.length;
    const avgSharpe = result.sharpes.reduce((s, v) => s + v, 0) / result.sharpes.length;
    return { mean, median, std, var5, cvar5, probProfit, probDouble, probRuin, best, worst, avgDD, avgSharpe };
  }, [result, config]);

  // Sensitivity data
  const sensitivity = useMemo(() => {
    const volRange = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40];
    const retRange = [0.04, 0.08, 0.12, 0.16, 0.20, 0.24];
    const grid: { vol: number; ret: number; medianWealth: number; probProfit: number; sharpe: number }[] = [];
    for (const vol of volRange) {
      for (const ret of retRange) {
        const sim = runSimulation({ ...config, paths: 100, annVol: vol, annReturn: ret });
        const fw = sim.finalWealth;
        const sorted = [...fw].sort((a, b) => a - b);
        grid.push({
          vol, ret,
          medianWealth: sorted[Math.floor(sorted.length / 2)],
          probProfit: fw.filter(v => v > config.initialCapital).length / fw.length,
          sharpe: sim.sharpes.reduce((s, v) => s + v, 0) / sim.sharpes.length,
        });
      }
    }
    return { volRange, retRange, grid };
  }, [config]);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>🎲 MONTE CARLO SIMULATION</span>
          <span style={{ color: MUTED, fontSize: 11 }}>
            {config.paths} paths × {config.horizon} days
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <span><span style={{ color: MUTED }}>P(Profit) </span><span style={{ color: GREEN, fontWeight: 700 }}>{(stats.probProfit * 100).toFixed(1)}%</span></span>
          <span><span style={{ color: MUTED }}>Median </span><span style={{ color: AMBER, fontWeight: 700 }}>${(stats.median / 1000).toFixed(1)}K</span></span>
          <span><span style={{ color: MUTED }}>VaR 5% </span><span style={{ color: RED, fontWeight: 700 }}>${(stats.var5 / 1000).toFixed(1)}K</span></span>
        </div>
      </div>

      {/* Config bar */}
      <div style={{ display: 'flex', gap: 12, padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Paths', key: 'paths', val: config.paths, options: [100, 250, 500, 1000, 2000] },
          { label: 'Horizon', key: 'horizon', val: config.horizon, options: [63, 126, 252, 504, 756] },
          { label: 'Capital', key: 'initialCapital', val: config.initialCapital, options: [50000, 100000, 250000, 500000, 1000000] },
        ].map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: MUTED, fontSize: 10 }}>{f.label}:</span>
            <select value={f.val} onChange={e => setConfig(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '2px 6px', fontSize: 10 }}>
              {f.options.map(o => <option key={o} value={o}>{f.key === 'initialCapital' ? `$${(o / 1000)}K` : f.key === 'horizon' ? `${o}d` : o}</option>)}
            </select>
          </div>
        ))}
        {[
          { label: 'Return', key: 'annReturn', val: config.annReturn, step: 0.02, min: -0.10, max: 0.50 },
          { label: 'Vol', key: 'annVol', val: config.annVol, step: 0.05, min: 0.05, max: 0.60 },
        ].map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: MUTED, fontSize: 10 }}>{f.label}:</span>
            <input type="range" min={f.min} max={f.max} step={f.step} value={f.val}
              onChange={e => setConfig(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              style={{ width: 60, accentColor: AMBER }} />
            <span style={{ color: AMBER, fontSize: 10, fontWeight: 600, minWidth: 35 }}>{(f.val * 100).toFixed(0)}%</span>
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
        {tab === 'SIMULATION' && (
          <div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EQUITY CURVE FAN CHART — {config.paths} PATHS</span>
              <FanChart result={result} config={config} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Mean Final', val: `$${(stats.mean / 1000).toFixed(1)}K`, color: '#eee' },
                { label: 'Median Final', val: `$${(stats.median / 1000).toFixed(1)}K`, color: AMBER },
                { label: 'Best Case', val: `$${(stats.best / 1000).toFixed(1)}K`, color: GREEN },
                { label: 'Worst Case', val: `$${(stats.worst / 1000).toFixed(1)}K`, color: RED },
                { label: 'Std Dev', val: `$${(stats.std / 1000).toFixed(1)}K`, color: MUTED },
                { label: 'Avg Sharpe', val: stats.avgSharpe.toFixed(2), color: stats.avgSharpe > 0.5 ? GREEN : AMBER },
              ].map(m => (
                <div key={m.label} style={{ background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 4, padding: 10, textAlign: 'center' }}>
                  <div style={{ color: MUTED, fontSize: 9, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ color: m.color, fontWeight: 700, fontSize: 14 }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'DISTRIBUTIONS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <HistogramChart data={result.finalWealth} label="FINAL WEALTH DISTRIBUTION" unit="$" bins={35} />
            </div>
            <div style={panelStyle}>
              <HistogramChart data={result.maxDrawdowns} label="MAX DRAWDOWN DISTRIBUTION" unit="%" bins={25} />
            </div>
            <div style={panelStyle}>
              <HistogramChart data={result.sharpes} label="SHARPE RATIO DISTRIBUTION" unit="" bins={25} />
            </div>
            <div style={panelStyle}>
              <HistogramChart data={result.calmarRatios} label="CALMAR RATIO DISTRIBUTION" unit="" bins={25} />
            </div>
          </div>
        )}

        {tab === 'RISK METRICS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PROBABILITY ANALYSIS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { label: 'P(Profit)', desc: 'End above initial capital', val: stats.probProfit, color: GREEN },
                  { label: 'P(>10% Return)', desc: 'End above $110K', val: result.finalWealth.filter(v => v > config.initialCapital * 1.10).length / result.finalWealth.length, color: GREEN },
                  { label: 'P(>25% Return)', desc: 'End above $125K', val: result.finalWealth.filter(v => v > config.initialCapital * 1.25).length / result.finalWealth.length, color: '#6366f1' },
                  { label: 'P(Double)', desc: 'End above $200K', val: stats.probDouble, color: AMBER },
                  { label: 'P(Ruin <50%)', desc: 'Lose more than half', val: stats.probRuin, color: RED },
                  { label: 'P(Loss >20%)', desc: 'End below $80K', val: result.finalWealth.filter(v => v < config.initialCapital * 0.80).length / result.finalWealth.length, color: RED },
                ].map(p => (
                  <div key={p.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <div>
                        <span style={{ color: '#eee', fontSize: 12, fontWeight: 600 }}>{p.label}</span>
                        <span style={{ color: MUTED, fontSize: 10, marginLeft: 8 }}>{p.desc}</span>
                      </div>
                      <span style={{ color: p.color, fontWeight: 700, fontSize: 13 }}>{(p.val * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, background: '#222', borderRadius: 3 }}>
                      <div style={{ width: `${p.val * 100}%`, height: '100%', background: p.color, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>VALUE AT RISK</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { label: 'VaR 1%', val: [...result.finalWealth].sort((a, b) => a - b)[Math.floor(result.finalWealth.length * 0.01)] },
                  { label: 'VaR 5%', val: stats.var5 },
                  { label: 'CVaR 5%', val: stats.cvar5 },
                  { label: 'VaR 10%', val: [...result.finalWealth].sort((a, b) => a - b)[Math.floor(result.finalWealth.length * 0.10)] },
                ].map(v => {
                  const loss = config.initialCapital - v.val;
                  const lossPct = loss / config.initialCapital;
                  return (
                    <div key={v.label} style={{ background: '#0a0a0a', borderRadius: 6, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: MUTED }}>{v.label}</span>
                        <span style={{ color: RED, fontWeight: 700 }}>-${(loss / 1000).toFixed(1)}K ({(lossPct * 100).toFixed(1)}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                        <span style={{ color: '#666' }}>Portfolio Value</span>
                        <span style={{ color: '#aaa' }}>${(v.val / 1000).toFixed(1)}K</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16 }}>
                <span style={{ color: MUTED, fontSize: 10 }}>DRAWDOWN STATS</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {[
                    { l: 'Avg Max DD', v: `${(stats.avgDD * 100).toFixed(1)}%`, c: RED },
                    { l: 'Median DD', v: `${([...result.maxDrawdowns].sort((a, b) => a - b)[Math.floor(result.maxDrawdowns.length / 2)] * 100).toFixed(1)}%`, c: RED },
                    { l: 'Worst DD', v: `${(Math.max(...result.maxDrawdowns) * 100).toFixed(1)}%`, c: RED },
                    { l: 'Best DD', v: `${(Math.min(...result.maxDrawdowns) * 100).toFixed(1)}%`, c: GREEN },
                  ].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ color: s.c, fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'SENSITIVITY' && (
          <div style={panelStyle}>
            <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PARAMETER SENSITIVITY — PROBABILITY OF PROFIT</span>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Vol\Return</th>
                    {sensitivity.retRange.map(r => (
                      <th key={r} style={{ padding: '6px 10px', color: AMBER, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{(r * 100).toFixed(0)}%</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.volRange.map(vol => (
                    <tr key={vol}>
                      <td style={{ padding: '6px 10px', color: AMBER, fontWeight: 600, borderRight: `1px solid ${BORDER}` }}>{(vol * 100).toFixed(0)}%</td>
                      {sensitivity.retRange.map(ret => {
                        const cell = sensitivity.grid.find(g => g.vol === vol && g.ret === ret);
                        const prob = cell?.probProfit ?? 0;
                        const bg = prob > 0.7 ? `rgba(38,166,154,${prob * 0.4})` : prob > 0.5 ? `rgba(245,166,35,${prob * 0.3})` : `rgba(239,83,80,${(1 - prob) * 0.3})`;
                        return (
                          <td key={`${vol}-${ret}`} style={{
                            padding: '6px 10px', textAlign: 'center', fontWeight: 600,
                            background: bg, color: prob > 0.6 ? GREEN : prob > 0.4 ? AMBER : RED,
                          }}>
                            {(prob * 100).toFixed(0)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16 }}>
              <span style={{ color: MUTED, fontSize: 10 }}>MEDIAN FINAL WEALTH</span>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 10px', color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Vol\Return</th>
                      {sensitivity.retRange.map(r => (
                        <th key={r} style={{ padding: '6px 10px', color: AMBER, borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{(r * 100).toFixed(0)}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.volRange.map(vol => (
                      <tr key={vol}>
                        <td style={{ padding: '6px 10px', color: AMBER, fontWeight: 600, borderRight: `1px solid ${BORDER}` }}>{(vol * 100).toFixed(0)}%</td>
                        {sensitivity.retRange.map(ret => {
                          const cell = sensitivity.grid.find(g => g.vol === vol && g.ret === ret);
                          const wealth = cell?.medianWealth ?? 0;
                          const gain = wealth > config.initialCapital;
                          return (
                            <td key={`${vol}-${ret}`} style={{
                              padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace',
                              color: gain ? GREEN : RED,
                            }}>
                              ${(wealth / 1000).toFixed(0)}K
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
