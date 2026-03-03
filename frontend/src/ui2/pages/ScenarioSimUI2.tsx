/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Scenario Simulation Engine (UI2)                    │
 * │  Multi-factor scenario analysis with stress testing, what-if,       │
 * │  historical replay, Monte Carlo paths, P&L impact, and Greeks       │
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
interface ScenarioParam {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
}

interface ScenarioResult {
  name: string;
  pnl: number;
  pnlPct: number;
  var95: number;
  cvar: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  avgDuration: number;
  details: { asset: string; impact: number; weight: number }[];
}

interface HistoricalScenario {
  name: string;
  date: string;
  spxChange: number;
  vixLevel: number;
  duration: string;
  portfolioImpact: number;
  recovery: string;
  description: string;
}

interface StressTest {
  factor: string;
  shock: number;
  unit: string;
  portfolioImpact: number;
  worstAsset: string;
  worstImpact: number;
  bestAsset: string;
  bestImpact: number;
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
function defaultParams(): ScenarioParam[] {
  return [
    { name: 'spx_shock', label: 'S&P 500 Shock', min: -30, max: 30, step: 1, value: -5, unit: '%' },
    { name: 'vol_shock', label: 'VIX Change', min: -50, max: 200, step: 5, value: 50, unit: '%' },
    { name: 'rate_shock', label: 'Rate Shock', min: -200, max: 200, step: 10, value: 50, unit: 'bps' },
    { name: 'usd_shock', label: 'USD/DXY', min: -10, max: 10, step: 0.5, value: 2, unit: '%' },
    { name: 'oil_shock', label: 'Crude Oil', min: -40, max: 40, step: 2, value: -10, unit: '%' },
    { name: 'credit_shock', label: 'IG Spread', min: -50, max: 200, step: 5, value: 25, unit: 'bps' },
    { name: 'btc_shock', label: 'Bitcoin', min: -50, max: 100, step: 5, value: -15, unit: '%' },
    { name: 'gold_shock', label: 'Gold', min: -20, max: 20, step: 1, value: 5, unit: '%' },
  ];
}

function computeScenarioResult(params: ScenarioParam[]): ScenarioResult {
  const spx = params.find(p => p.name === 'spx_shock')?.value ?? 0;
  const vol = params.find(p => p.name === 'vol_shock')?.value ?? 0;
  const rate = params.find(p => p.name === 'rate_shock')?.value ?? 0;
  // Simplified P&L model
  const equityImpact = spx * 0.6;
  const volImpact = vol * -0.05;
  const rateImpact = rate * -0.01;
  const totalPnl = (equityImpact + volImpact + rateImpact) * 1000; // per $100K portfolio
  return {
    name: 'Custom Scenario',
    pnl: totalPnl,
    pnlPct: equityImpact + volImpact + rateImpact,
    var95: Math.abs(totalPnl) * 1.65,
    cvar: Math.abs(totalPnl) * 2.1,
    maxDrawdown: Math.abs(totalPnl) * 1.2,
    sharpe: totalPnl > 0 ? 1.2 : -0.8,
    winRate: totalPnl > 0 ? 62 : 38,
    avgDuration: 12,
    details: [
      { asset: 'AAPL', impact: equityImpact * 350, weight: 0.15 },
      { asset: 'MSFT', impact: equityImpact * 250, weight: 0.12 },
      { asset: 'NVDA', impact: equityImpact * 450, weight: 0.20 },
      { asset: 'SPY Puts', impact: -equityImpact * 200, weight: 0.08 },
      { asset: 'TLT', impact: rateImpact * -150, weight: 0.10 },
      { asset: 'GLD', impact: spx < 0 ? 120 : -50, weight: 0.05 },
      { asset: 'BTC', impact: (spx * 1.5 + vol * -0.1) * 100, weight: 0.08 },
      { asset: 'Cash', impact: 0, weight: 0.22 },
    ],
  };
}

function getHistoricalScenarios(): HistoricalScenario[] {
  return [
    { name: 'COVID Crash', date: 'Mar 2020', spxChange: -33.9, vixLevel: 82.69, duration: '23 trading days', portfolioImpact: -28500, recovery: '5 months', description: 'Global pandemic lockdowns trigger fastest bear market in history' },
    { name: 'GFC 2008', date: 'Sep-Mar 2009', spxChange: -56.8, vixLevel: 89.53, duration: '17 months', portfolioImpact: -48200, recovery: '4 years', description: 'Housing crisis cascades through global financial system' },
    { name: 'Volmageddon', date: 'Feb 2018', spxChange: -10.2, vixLevel: 50.30, duration: '9 trading days', portfolioImpact: -8500, recovery: '6 months', description: 'XIV/SVXY implosion, VIX spikes 116% in one day' },
    { name: 'Flash Crash', date: 'May 2010', spxChange: -9.2, vixLevel: 40.95, duration: '1 day (intraday)', portfolioImpact: -7800, recovery: '2 weeks', description: 'Dow drops 1000+ points in minutes, liquidity vacuum' },
    { name: 'Black Monday', date: 'Oct 1987', spxChange: -22.6, vixLevel: 150.19, duration: '1 day', portfolioImpact: -19200, recovery: '2 years', description: 'Single-day 22.6% crash, portfolio insurance cascade' },
    { name: '2022 Bear', date: 'Jan-Oct 2022', spxChange: -25.4, vixLevel: 36.45, duration: '10 months', portfolioImpact: -21500, recovery: '14 months', description: 'Fed rate hiking cycle, growth → value rotation' },
    { name: 'SVB Crisis', date: 'Mar 2023', spxChange: -7.8, vixLevel: 30.81, duration: '5 trading days', portfolioImpact: -6200, recovery: '3 weeks', description: 'Regional bank contagion fear, FDIC intervention' },
    { name: 'China Deval', date: 'Aug 2015', spxChange: -12.4, vixLevel: 53.29, duration: '6 trading days', portfolioImpact: -10500, recovery: '4 months', description: 'PBoC devalues Yuan, EM contagion fears' },
  ];
}

function getStressTests(): StressTest[] {
  return [
    { factor: 'Equity Market', shock: -20, unit: '%', portfolioImpact: -18500, worstAsset: 'NVDA', worstImpact: -5200, bestAsset: 'SPY Puts', bestImpact: 3800 },
    { factor: 'Volatility', shock: 100, unit: '%', portfolioImpact: -2800, worstAsset: 'Short Straddle', worstImpact: -4500, bestAsset: 'VIX Calls', bestImpact: 6200 },
    { factor: 'Interest Rates', shock: 150, unit: 'bps', portfolioImpact: -3200, worstAsset: 'TLT', worstImpact: -2800, bestAsset: 'Financials', bestImpact: 1500 },
    { factor: 'Credit Spreads', shock: 100, unit: 'bps', portfolioImpact: -4100, worstAsset: 'HYG', worstImpact: -3200, bestAsset: 'Treasuries', bestImpact: 800 },
    { factor: 'USD Strength', shock: 8, unit: '%', portfolioImpact: -1500, worstAsset: 'EM Equity', worstImpact: -2100, bestAsset: 'USD Cash', bestImpact: 400 },
    { factor: 'Oil Crash', shock: -40, unit: '%', portfolioImpact: -2200, worstAsset: 'XLE', worstImpact: -3800, bestAsset: 'Airlines', bestImpact: 1200 },
    { factor: 'Inflation Spike', shock: 200, unit: 'bps', portfolioImpact: -5500, worstAsset: 'Growth', worstImpact: -4800, bestAsset: 'TIPS', bestImpact: 1800 },
    { factor: 'Crypto Crash', shock: -50, unit: '%', portfolioImpact: -4500, worstAsset: 'BTC', worstImpact: -8000, bestAsset: 'Gold', bestImpact: 500 },
  ];
}

/* ── Canvas Components ───────────────────────────────────────────────── */
function ScenarioPnLChart({ result }: { result: ScenarioResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    // background
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * H / 4); ctx.lineTo(W, i * H / 4); ctx.stroke(); }
    // bars
    const details = result.details;
    const maxAbs = Math.max(...details.map(d => Math.abs(d.impact)), 1);
    const barW = (W - 40) / details.length;
    const midY = H / 2;
    details.forEach((d, i) => {
      const x = 20 + i * barW;
      const barH = (d.impact / maxAbs) * (H / 2 - 20);
      ctx.fillStyle = d.impact >= 0 ? T.up : T.dn;
      ctx.fillRect(x + 2, d.impact >= 0 ? midY - barH : midY, barW - 4, Math.abs(barH));
      // label
      ctx.fillStyle = T.tx3; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.asset.slice(0, 5), x + barW / 2, H - 4);
      // value
      ctx.fillStyle = d.impact >= 0 ? T.up : T.dn; ctx.font = 'bold 7px monospace';
      ctx.fillText(`${d.impact >= 0 ? '+' : ''}${d.impact.toFixed(0)}`, x + barW / 2, d.impact >= 0 ? midY - barH - 4 : midY + Math.abs(barH) + 10);
    });
    // zero line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();
    ctx.setLineDash([]);
  }, [result]);
  return <canvas ref={ref} style={{ width: 400, height: 200, borderRadius: T.r }} />;
}

function MonteCarloPathsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 180;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);
    // Draw 50 Monte Carlo paths
    const paths = 50; const steps = 100; const dt = 1 / 252; const mu = 0.08; const sigma = 0.20;
    const allPaths: number[][] = [];
    for (let p = 0; p < paths; p++) {
      const path = [100000]; // $100K starting capital
      for (let s = 1; s < steps; s++) {
        const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
        path.push(path[s - 1] * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z));
      }
      allPaths.push(path);
    }
    const allVals = allPaths.flat();
    const mn = Math.min(...allVals), mx = Math.max(...allVals);
    // Draw paths
    allPaths.forEach((path, pi) => {
      ctx.strokeStyle = pi < 5 ? `${T.up}60` : pi > paths - 5 ? `${T.dn}60` : `${T.brand}20`;
      ctx.lineWidth = pi < 5 || pi > paths - 5 ? 1.5 : 0.5;
      ctx.beginPath();
      path.forEach((v, i) => {
        const x = (i / (steps - 1)) * W;
        const y = H - ((v - mn) / (mx - mn)) * (H - 20) - 10;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    // Labels
    ctx.fillStyle = T.tx3; ctx.font = '8px sans-serif';
    ctx.fillText(`$${(mn / 1000).toFixed(0)}K`, 2, H - 4);
    ctx.fillText(`$${(mx / 1000).toFixed(0)}K`, 2, 12);
    ctx.fillText('50 paths • 1Y horizon', W - 100, H - 4);
  }, []);
  return <canvas ref={ref} style={{ width: 400, height: 180, borderRadius: T.r }} />;
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function ParamSlider({ param, onChange }: { param: ScenarioParam; onChange: (v: number) => void }) {
  const pct = ((param.value - param.min) / (param.max - param.min)) * 100;
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '8px', color: T.tx2 }}>{param.label}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: param.value >= 0 ? (param.name.includes('vol') || param.name.includes('credit') ? T.dn : T.up) : (param.name.includes('vol') || param.name.includes('credit') ? T.up : T.dn), fontFamily: T.mono }}>
          {param.value >= 0 ? '+' : ''}{param.value}{param.unit}
        </span>
      </div>
      <input type="range" min={param.min} max={param.max} step={param.step} value={param.value} onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', height: '4px', appearance: 'none', background: `linear-gradient(to right, ${T.dn} 0%, ${T.dn} ${50 - (50 * param.value / param.max)}%, ${T.bg3} ${50 - (50 * param.value / param.max)}%, ${T.bg3} ${50 + (50 * param.value / param.max)}%, ${T.up} ${50 + (50 * param.value / param.max)}%, ${T.up} 100%)`, borderRadius: '2px', cursor: 'pointer' }} />
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}`, textAlign: 'center' }}>
      <div style={{ fontSize: '7px', color: T.tx3, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color, fontFamily: T.mono }}>{value}</div>
    </div>
  );
}

function HistoricalPanel({ scenarios }: { scenarios: HistoricalScenario[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
      {scenarios.map(s => (
        <div key={s.name} style={{ background: T.bg2, borderRadius: T.r, padding: '10px', border: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0 }}>{s.name}</div>
              <div style={{ fontSize: '8px', color: T.tx3 }}>{s.date}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: T.dn, fontFamily: T.mono }}>${(s.portfolioImpact / 1000).toFixed(1)}K</div>
              <div style={{ fontSize: '8px', color: T.dn, fontFamily: T.mono }}>{s.spxChange.toFixed(1)}% SPX</div>
            </div>
          </div>
          <div style={{ fontSize: '8px', color: T.tx2, marginBottom: '6px' }}>{s.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '7px', fontFamily: T.mono }}>
            <div><span style={{ color: T.tx3 }}>VIX: </span><span style={{ color: T.warn }}>{s.vixLevel}</span></div>
            <div><span style={{ color: T.tx3 }}>Duration: </span><span style={{ color: T.tx1 }}>{s.duration}</span></div>
            <div><span style={{ color: T.tx3 }}>Recovery: </span><span style={{ color: T.up }}>{s.recovery}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StressTestPanel({ tests }: { tests: StressTest[] }) {
  const maxImpact = Math.max(...tests.map(t => Math.abs(t.portfolioImpact)));
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Factor', 'Shock', 'Portfolio Impact', 'Worst Asset', 'Best Asset'].map(h => (
              <th key={h} style={{ padding: '4px 6px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tests.map(t => (
            <tr key={t.factor} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '4px 6px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{t.factor}</td>
              <td style={{ padding: '4px 6px', color: T.warn, textAlign: 'right' }}>{t.shock >= 0 ? '+' : ''}{t.shock}{t.unit}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  <div style={{ width: '80px', height: '6px', background: T.bg3, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(Math.abs(t.portfolioImpact) / maxImpact) * 100}%`, height: '100%', background: T.dn, borderRadius: '3px' }} />
                  </div>
                  <span style={{ color: T.dn, fontWeight: 700, minWidth: '50px' }}>${(t.portfolioImpact / 1000).toFixed(1)}K</span>
                </div>
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                <span style={{ color: T.tx2 }}>{t.worstAsset}: </span>
                <span style={{ color: T.dn, fontWeight: 600 }}>${(t.worstImpact / 1000).toFixed(1)}K</span>
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                <span style={{ color: T.tx2 }}>{t.bestAsset}: </span>
                <span style={{ color: T.up, fontWeight: 600 }}>+${(t.bestImpact / 1000).toFixed(1)}K</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
type SimTab = 'whatif' | 'stress' | 'historical' | 'montecarlo';

export default function ScenarioSimUI2() {
  const [tab, setTab] = useState<SimTab>('whatif');
  const [params, setParams] = useState<ScenarioParam[]>(defaultParams());
  const historical = useMemo(() => getHistoricalScenarios(), []);
  const stressTests = useMemo(() => getStressTests(), []);

  const handleParamChange = useCallback((name: string, value: number) => {
    setParams(prev => prev.map(p => p.name === name ? { ...p, value } : p));
  }, []);

  const result = useMemo(() => computeScenarioResult(params), [params]);

  const presets = [
    { label: 'Mild Bear', values: { spx_shock: -10, vol_shock: 80, rate_shock: -25, usd_shock: 3, oil_shock: -15, credit_shock: 50, btc_shock: -25, gold_shock: 5 } },
    { label: 'Severe Bear', values: { spx_shock: -25, vol_shock: 150, rate_shock: -100, usd_shock: 5, oil_shock: -35, credit_shock: 150, btc_shock: -45, gold_shock: 12 } },
    { label: 'Stagflation', values: { spx_shock: -15, vol_shock: 60, rate_shock: 100, usd_shock: -3, oil_shock: 30, credit_shock: 80, btc_shock: -20, gold_shock: 15 } },
    { label: 'Bull Run', values: { spx_shock: 15, vol_shock: -30, rate_shock: -50, usd_shock: -2, oil_shock: 10, credit_shock: -20, btc_shock: 40, gold_shock: -3 } },
    { label: 'Rate Shock', values: { spx_shock: -8, vol_shock: 40, rate_shock: 150, usd_shock: 4, oil_shock: -5, credit_shock: 60, btc_shock: -10, gold_shock: -2 } },
    { label: 'Reset', values: { spx_shock: 0, vol_shock: 0, rate_shock: 0, usd_shock: 0, oil_shock: 0, credit_shock: 0, btc_shock: 0, gold_shock: 0 } },
  ];

  const applyPreset = (values: Record<string, number>) => {
    setParams(prev => prev.map(p => ({ ...p, value: values[p.name] ?? p.value })));
  };

  return (
    <div data-testid="scenario-sim-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SCENARIO SIMULATOR</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '9px', color: T.tx2 }}>Multi-factor stress testing & scenario analysis</span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'whatif' as SimTab, label: '🎛️ What-If' },
          { key: 'stress' as SimTab, label: '⚡ Stress Tests' },
          { key: 'historical' as SimTab, label: '📚 Historical' },
          { key: 'montecarlo' as SimTab, label: '🎲 Monte Carlo' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'whatif' && (
          <div style={{ display: 'flex', gap: '8px', height: '100%' }}>
            {/* Left: Parameters */}
            <div style={{ width: '280px', flexShrink: 0, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', overflow: 'auto' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Scenario Parameters</div>
              {/* Presets */}
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {presets.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.values)} style={{
                    background: T.bg3, color: T.tx2, border: `1px solid ${T.border}`, borderRadius: '2px',
                    padding: '2px 6px', fontSize: '7px', fontWeight: 600, cursor: 'pointer',
                  }}>{p.label}</button>
                ))}
              </div>
              {params.map(p => (
                <ParamSlider key={p.name} param={p} onChange={(v) => handleParamChange(p.name, v)} />
              ))}
            </div>
            {/* Right: Results */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px', marginBottom: '8px' }}>
                <ResultCard label="Portfolio P&L" value={`${result.pnl >= 0 ? '+' : ''}$${(result.pnl / 1000).toFixed(1)}K`} color={result.pnl >= 0 ? T.up : T.dn} />
                <ResultCard label="P&L %" value={`${result.pnlPct >= 0 ? '+' : ''}${result.pnlPct.toFixed(2)}%`} color={result.pnlPct >= 0 ? T.up : T.dn} />
                <ResultCard label="VaR 95%" value={`$${(result.var95 / 1000).toFixed(1)}K`} color={T.warn} />
                <ResultCard label="CVaR" value={`$${(result.cvar / 1000).toFixed(1)}K`} color={T.dn} />
                <ResultCard label="Max DD" value={`$${(result.maxDrawdown / 1000).toFixed(1)}K`} color={T.dn} />
                <ResultCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 0 ? T.up : T.dn} />
              </div>
              {/* Chart */}
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Asset Impact Breakdown</div>
                <ScenarioPnLChart result={result} />
              </div>
              {/* Detail table */}
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Position-Level Detail</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                      {['Asset', 'Weight', 'Impact ($)', 'Impact (%)'].map(h => (
                        <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.map(d => (
                      <tr key={d.asset} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{d.asset}</td>
                        <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{(d.weight * 100).toFixed(0)}%</td>
                        <td style={{ padding: '3px 4px', color: d.impact >= 0 ? T.up : T.dn, textAlign: 'right' }}>
                          {d.impact >= 0 ? '+' : ''}${d.impact.toFixed(0)}
                        </td>
                        <td style={{ padding: '3px 4px', color: d.impact >= 0 ? T.up : T.dn, textAlign: 'right' }}>
                          {d.impact >= 0 ? '+' : ''}{((d.impact / 100000) * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {tab === 'stress' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '8px' }}>⚡ Predefined Stress Tests</div>
            <StressTestPanel tests={stressTests} />
          </div>
        )}
        {tab === 'historical' && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '8px' }}>📚 Historical Scenario Analysis</div>
            <HistoricalPanel scenarios={historical} />
          </div>
        )}
        {tab === 'montecarlo' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '8px' }}>🎲 Monte Carlo Simulation</div>
              <MonteCarloPathsCanvas />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <ResultCard label="Median Return" value="+7.8%" color={T.up} />
              <ResultCard label="5th Percentile" value="-18.5%" color={T.dn} />
              <ResultCard label="95th Percentile" value="+32.1%" color={T.up} />
              <ResultCard label="Prob of Loss" value="22%" color={T.warn} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { ScenarioSimUI2 };
