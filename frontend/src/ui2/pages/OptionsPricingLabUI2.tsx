import React, { useState, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// Normal distribution CDF
function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes
function bsPrice(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put'): number {
  if (T <= 0) return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === 'call') return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}
function bsGreeks(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put') {
  if (T <= 0) return { delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normPDF(d1);
  const gamma = nd1 / (S * sigma * sqrtT);
  const vega = S * nd1 * sqrtT / 100;
  if (type === 'call') {
    return {
      delta: normCDF(d1),
      gamma,
      theta: (-(S * nd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2)) / 365,
      vega,
      rho: K * T * Math.exp(-r * T) * normCDF(d2) / 100,
    };
  }
  return {
    delta: normCDF(d1) - 1,
    gamma,
    theta: (-(S * nd1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2)) / 365,
    vega,
    rho: -K * T * Math.exp(-r * T) * normCDF(-d2) / 100,
  };
}

// Binomial tree
function binomialPrice(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put', steps: number, american = false): number {
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp(r * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);

  const prices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const ST = S * Math.pow(u, steps - i) * Math.pow(d, i);
    prices.push(type === 'call' ? Math.max(ST - K, 0) : Math.max(K - ST, 0));
  }
  for (let j = steps - 1; j >= 0; j--) {
    for (let i = 0; i <= j; i++) {
      prices[i] = disc * (p * prices[i] + (1 - p) * prices[i + 1]);
      if (american) {
        const ST = S * Math.pow(u, j - i) * Math.pow(d, i);
        const intrinsic = type === 'call' ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
        prices[i] = Math.max(prices[i], intrinsic);
      }
    }
  }
  return prices[0];
}

// Monte Carlo
function monteCarloPrice(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put', sims: number): { price: number; se: number; paths: number[][] } {
  const dt = T / 50;
  const drift = (r - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);
  let sumPayoff = 0, sumSq = 0;
  const paths: number[][] = [];
  for (let i = 0; i < sims; i++) {
    let St = S;
    const path = [S];
    for (let j = 0; j < 50; j++) {
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      St *= Math.exp(drift + vol * z);
      path.push(St);
    }
    const payoff = type === 'call' ? Math.max(St - K, 0) : Math.max(K - St, 0);
    sumPayoff += payoff;
    sumSq += payoff * payoff;
    if (i < 50) paths.push(path);
  }
  const mean = sumPayoff / sims;
  const se = Math.sqrt((sumSq / sims - mean * mean) / sims);
  return { price: Math.exp(-r * T) * mean, se: Math.exp(-r * T) * se, paths };
}

// Exotic: Barrier option (down-and-out call)
function barrierOption(S: number, K: number, T: number, r: number, sigma: number, barrier: number, sims: number): number {
  const dt = T / 100;
  const drift = (r - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);
  let sum = 0;
  for (let i = 0; i < sims; i++) {
    let St = S; let alive = true;
    for (let j = 0; j < 100; j++) {
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      St *= Math.exp(drift + vol * z);
      if (St <= barrier) { alive = false; break; }
    }
    if (alive) sum += Math.max(St - K, 0);
  }
  return Math.exp(-r * T) * sum / sims;
}

// Asian option (arithmetic average)
function asianOption(S: number, K: number, T: number, r: number, sigma: number, sims: number): number {
  const dt = T / 100;
  const drift = (r - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);
  let sum = 0;
  for (let i = 0; i < sims; i++) {
    let St = S, avgSum = 0;
    for (let j = 0; j < 100; j++) {
      const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      St *= Math.exp(drift + vol * z);
      avgSum += St;
    }
    sum += Math.max(avgSum / 100 - K, 0);
  }
  return Math.exp(-r * T) * sum / sims;
}

const TABS = ['BSM Calculator', 'Binomial Tree', 'Monte Carlo', 'Exotic Options', 'P&L Profile'];

export default function OptionsPricingLabUI2() {
  const [tab, setTab] = useState(TABS[0]);
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [T, setT] = useState(0.25);
  const [r, setR] = useState(0.05);
  const [sigma, setSigma] = useState(0.2);
  const [optType, setOptType] = useState<'call' | 'put'>('call');
  const [steps, setSteps] = useState(100);
  const [sims, setSims] = useState(10000);
  const [mcResult, setMcResult] = useState<{ price: number; se: number; paths: number[][] } | null>(null);
  const mcCanvasRef = useRef<HTMLCanvasElement>(null);
  const plCanvasRef = useRef<HTMLCanvasElement>(null);

  const price = bsPrice(S, K, T, r, sigma, optType);
  const greeks = bsGreeks(S, K, T, r, sigma, optType);
  const binPrice = binomialPrice(S, K, T, r, sigma, optType, steps, false);
  const binAmPrice = binomialPrice(S, K, T, r, sigma, optType, steps, true);

  const runMC = () => {
    const result = monteCarloPrice(S, K, T, r, sigma, optType, sims);
    setMcResult(result);
  };

  // Draw MC paths
  useEffect(() => {
    if (!mcResult || !mcCanvasRef.current) return;
    const c = mcCanvasRef.current;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const rect = c.parentElement!.getBoundingClientRect();
    c.width = rect.width; c.height = rect.height;
    ctx.clearRect(0, 0, c.width, c.height);

    const paths = mcResult.paths;
    const allVals = paths.flat();
    const maxV = Math.max(...allVals); const minV = Math.min(...allVals);
    const range = maxV - minV || 1;
    const steps = paths[0]?.length || 1;

    // Strike line
    const strikeY = c.height - 20 - ((K - minV) / range) * (c.height - 40);
    ctx.strokeStyle = AMBER; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, strikeY); ctx.lineTo(c.width, strikeY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = AMBER; ctx.font = '9px monospace'; ctx.fillText(`K=${K}`, 5, strikeY - 4);

    paths.forEach((path, idx) => {
      ctx.strokeStyle = path[path.length - 1] > K ? (optType === 'call' ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)') : (optType === 'call' ? 'rgba(239,83,80,0.2)' : 'rgba(38,166,154,0.2)');
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path.forEach((v, i) => {
        const x = (i / (steps - 1)) * c.width;
        const y = c.height - 20 - ((v - minV) / range) * (c.height - 40);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }, [mcResult, K, optType]);

  // P&L profile
  useEffect(() => {
    if (tab !== 'P&L Profile' || !plCanvasRef.current) return;
    const c = plCanvasRef.current;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const rect = c.parentElement!.getBoundingClientRect();
    c.width = rect.width; c.height = rect.height;
    ctx.clearRect(0, 0, c.width, c.height);

    const premium = price;
    const spotMin = S * 0.7; const spotMax = S * 1.3;
    const points: { x: number; y: number }[] = [];
    let minPL = Infinity, maxPL = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const spot = spotMin + (i / 200) * (spotMax - spotMin);
      const exerciseVal = optType === 'call' ? Math.max(spot - K, 0) : Math.max(K - spot, 0);
      const pl = exerciseVal - premium;
      points.push({ x: spot, y: pl });
      minPL = Math.min(minPL, pl); maxPL = Math.max(maxPL, pl);
    }
    const plRange = maxPL - minPL || 1;
    const pad = { top: 20, right: 40, bottom: 30, left: 60 };
    const cw = c.width - pad.left - pad.right;
    const ch = c.height - pad.top - pad.bottom;

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (ch * i) / 5;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
      const val = maxPL - (plRange * i) / 5;
      ctx.fillStyle = DIM; ctx.font = '9px monospace'; ctx.textAlign = 'right';
      ctx.fillText('$' + val.toFixed(2), pad.left - 4, y + 3);
    }

    // Zero line
    const zeroY = pad.top + (maxPL / plRange) * ch;
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + cw, zeroY); ctx.stroke();

    // At-expiry P&L
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad.left + ((p.x - spotMin) / (spotMax - spotMin)) * cw;
      const y = pad.top + ((maxPL - p.y) / plRange) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = optType === 'call' ? GREEN : RED;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Current value P&L (before expiry)
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const spot = spotMin + (i / 200) * (spotMax - spotMin);
      const val = bsPrice(spot, K, T, r, sigma, optType) - premium;
      const x = pad.left + ((spot - spotMin) / (spotMax - spotMin)) * cw;
      const y = pad.top + ((maxPL - val) / plRange) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Strike line
    const strikeX = pad.left + ((K - spotMin) / (spotMax - spotMin)) * cw;
    ctx.strokeStyle = AMBER; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(strikeX, pad.top); ctx.lineTo(strikeX, pad.top + ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = AMBER; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`K=${K}`, strikeX, pad.top + ch + 15);

    // Current spot
    const spotX = pad.left + ((S - spotMin) / (spotMax - spotMin)) * cw;
    ctx.strokeStyle = WHITE; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(spotX, pad.top); ctx.lineTo(spotX, pad.top + ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = WHITE; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`S=${S}`, spotX, pad.top - 5);

    // Legend
    ctx.fillStyle = optType === 'call' ? GREEN : RED; ctx.fillRect(c.width - 140, 10, 10, 10);
    ctx.fillStyle = TEXT; ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.fillText('At Expiry', c.width - 126, 19);
    ctx.fillStyle = CYAN; ctx.fillRect(c.width - 140, 24, 10, 10);
    ctx.fillStyle = TEXT; ctx.fillText('Current Value', c.width - 126, 33);
  }, [tab, S, K, T, r, sigma, optType, price]);

  const inputStyle: React.CSSProperties = { padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 12, width: 80, textAlign: 'right' };
  const labelStyle: React.CSSProperties = { color: DIM, fontSize: 10, marginBottom: 2 };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>⚙ OPTIONS PRICING LAB</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 10px', background: tab === t ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${tab === t ? AMBER : 'transparent'}`, color: tab === t ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Input panel */}
        <div style={{ width: 220, borderRight: `1px solid ${BORDER}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>PARAMETERS</div>
          {[
            { label: 'Spot Price (S)', value: S, set: setS, min: 1, max: 500, step: 1 },
            { label: 'Strike (K)', value: K, set: setK, min: 1, max: 500, step: 1 },
            { label: 'Time to Exp (T)', value: T, set: setT, min: 0.01, max: 5, step: 0.01 },
            { label: 'Risk-Free Rate (r)', value: r, set: setR, min: 0, max: 0.2, step: 0.005 },
            { label: 'Volatility (σ)', value: sigma, set: setSigma, min: 0.01, max: 1, step: 0.01 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label}>
              <div style={labelStyle}>{label}</div>
              <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)} min={min} max={max} step={step} style={inputStyle} />
              <input type="range" value={value} onChange={e => set(parseFloat(e.target.value))} min={min} max={max} step={step} style={{ width: '100%', accentColor: AMBER, marginTop: 2 }} />
            </div>
          ))}
          <div>
            <div style={labelStyle}>Option Type</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['call', 'put'] as const).map(t => (
                <button key={t} onClick={() => setOptType(t)} style={{
                  flex: 1, padding: '4px', background: optType === t ? (t === 'call' ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)') : '#1a1a1a',
                  border: `1px solid ${optType === t ? (t === 'call' ? GREEN : RED) : BORDER}`,
                  color: optType === t ? (t === 'call' ? GREEN : RED) : DIM, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, textTransform: 'uppercase'
                }}>{t}</button>
              ))}
            </div>
          </div>
          {tab === 'Binomial Tree' && (
            <div>
              <div style={labelStyle}>Tree Steps</div>
              <input type="number" value={steps} onChange={e => setSteps(parseInt(e.target.value) || 10)} min={10} max={1000} step={10} style={inputStyle} />
            </div>
          )}
          {tab === 'Monte Carlo' && (
            <div>
              <div style={labelStyle}>Simulations</div>
              <input type="number" value={sims} onChange={e => setSims(parseInt(e.target.value) || 1000)} min={100} max={100000} step={1000} style={inputStyle} />
              <button onClick={runMC} style={{ marginTop: 4, padding: '6px 12px', background: 'rgba(38,166,154,0.2)', border: `1px solid ${GREEN}`, color: GREEN, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, width: '100%' }}>▶ Run Simulation</button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 'BSM Calculator' && (
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>OPTION PRICE</div>
                  <div style={{ color: optType === 'call' ? GREEN : RED, fontSize: 28, fontWeight: 'bold' }}>${price.toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>{optType.toUpperCase()} | BSM Model</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>INTRINSIC VALUE</div>
                  <div style={{ color: WHITE, fontSize: 28, fontWeight: 'bold' }}>${Math.max(optType === 'call' ? S - K : K - S, 0).toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>{optType === 'call' ? 'max(S-K, 0)' : 'max(K-S, 0)'}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>TIME VALUE</div>
                  <div style={{ color: AMBER, fontSize: 28, fontWeight: 'bold' }}>${(price - Math.max(optType === 'call' ? S - K : K - S, 0)).toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>Premium - Intrinsic</div>
                </div>
              </div>
              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>GREEKS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { name: 'Delta (Δ)', value: greeks.delta, fmt: 4, desc: '∂V/∂S' },
                  { name: 'Gamma (Γ)', value: greeks.gamma, fmt: 6, desc: '∂²V/∂S²' },
                  { name: 'Theta (Θ)', value: greeks.theta, fmt: 4, desc: '∂V/∂t (daily)' },
                  { name: 'Vega (ν)', value: greeks.vega, fmt: 4, desc: '∂V/∂σ (per 1%)' },
                  { name: 'Rho (ρ)', value: greeks.rho, fmt: 4, desc: '∂V/∂r (per 1%)' },
                ].map(g => (
                  <div key={g.name} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                    <div style={{ color: DIM, fontSize: 9, marginBottom: 2 }}>{g.name}</div>
                    <div style={{ color: g.value >= 0 ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>{g.value.toFixed(g.fmt)}</div>
                    <div style={{ color: DIM, fontSize: 8, marginTop: 2 }}>{g.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>SENSITIVITY ANALYSIS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ background: '#1a1a1a', padding: '6px', textAlign: 'left', color: DIM, borderBottom: `1px solid ${BORDER}` }}>Spot</th>
                    {[-10, -5, -2, -1, 0, 1, 2, 5, 10].map(d => (
                      <th key={d} style={{ background: d === 0 ? 'rgba(245,166,35,0.1)' : '#1a1a1a', padding: '6px', textAlign: 'right', color: d === 0 ? AMBER : DIM, borderBottom: `1px solid ${BORDER}` }}>
                        {d >= 0 ? '+' : ''}{d}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Price', fn: (s: number) => bsPrice(s, K, T, r, sigma, optType).toFixed(3) },
                    { label: 'Delta', fn: (s: number) => bsGreeks(s, K, T, r, sigma, optType).delta.toFixed(4) },
                    { label: 'Gamma', fn: (s: number) => bsGreeks(s, K, T, r, sigma, optType).gamma.toFixed(6) },
                  ].map(row => (
                    <tr key={row.label}>
                      <td style={{ padding: '4px 6px', borderBottom: `1px solid ${BORDER}`, color: TEXT }}>{row.label}</td>
                      {[-10, -5, -2, -1, 0, 1, 2, 5, 10].map(d => {
                        const s = S * (1 + d / 100);
                        return <td key={d} style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: d === 0 ? AMBER : TEXT, background: d === 0 ? 'rgba(245,166,35,0.05)' : 'transparent' }}>{row.fn(s)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Binomial Tree' && (
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>EUROPEAN (BINOMIAL)</div>
                  <div style={{ color: GREEN, fontSize: 24, fontWeight: 'bold' }}>${binPrice.toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>{steps} steps</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>AMERICAN (BINOMIAL)</div>
                  <div style={{ color: CYAN, fontSize: 24, fontWeight: 'bold' }}>${binAmPrice.toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>Early exercise premium: ${(binAmPrice - binPrice).toFixed(4)}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>BSM REFERENCE</div>
                  <div style={{ color: AMBER, fontSize: 24, fontWeight: 'bold' }}>${price.toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>Difference: ${Math.abs(binPrice - price).toFixed(6)}</div>
                </div>
              </div>
              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>CONVERGENCE TABLE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    {['Steps', 'European', 'American', 'BSM', 'Eur Error', 'Am Premium'].map(h => (
                      <th key={h} style={{ background: '#1a1a1a', padding: '6px', textAlign: 'right', color: DIM, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[10, 25, 50, 100, 200, 500].map(n => {
                    const eu = binomialPrice(S, K, T, r, sigma, optType, n, false);
                    const am = binomialPrice(S, K, T, r, sigma, optType, n, true);
                    return (
                      <tr key={n}>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: TEXT }}>{n}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: GREEN }}>${eu.toFixed(4)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: CYAN }}>${am.toFixed(4)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: AMBER }}>${price.toFixed(4)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: Math.abs(eu - price) < 0.01 ? GREEN : RED }}>{Math.abs(eu - price).toFixed(6)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: `1px solid ${BORDER}`, color: TEXT }}>${(am - eu).toFixed(4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Monte Carlo' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16, paddingBottom: 0 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>MC PRICE</div>
                  <div style={{ color: GREEN, fontSize: 20, fontWeight: 'bold' }}>{mcResult ? '$' + mcResult.price.toFixed(4) : '—'}</div>
                  <div style={{ color: DIM, fontSize: 9 }}>SE: {mcResult ? mcResult.se.toFixed(6) : '—'}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>BSM REFERENCE</div>
                  <div style={{ color: AMBER, fontSize: 20, fontWeight: 'bold' }}>${price.toFixed(4)}</div>
                  <div style={{ color: DIM, fontSize: 9 }}>Error: {mcResult ? Math.abs(mcResult.price - price).toFixed(6) : '—'}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10 }}>95% CI</div>
                  <div style={{ color: CYAN, fontSize: 14, fontWeight: 'bold' }}>{mcResult ? `$${(mcResult.price - 1.96 * mcResult.se).toFixed(3)} — $${(mcResult.price + 1.96 * mcResult.se).toFixed(3)}` : '—'}</div>
                  <div style={{ color: DIM, fontSize: 9 }}>{sims.toLocaleString()} simulations</div>
                </div>
              </div>
              <div style={{ flex: 1, padding: '12px 16px', position: 'relative' }}>
                <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>Sample Paths ({mcResult ? mcResult.paths.length : 0})</div>
                <div style={{ height: 'calc(100% - 20px)', position: 'relative' }}>
                  <canvas ref={mcCanvasRef} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {tab === 'Exotic Options' && (
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {/* Barrier Option */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>BARRIER OPTION (Down-and-Out Call)</div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Knock-out barrier at {(S * 0.9).toFixed(0)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Barrier Price</div>
                      <div style={{ color: GREEN, fontSize: 18, fontWeight: 'bold' }}>${barrierOption(S, K, T, r, sigma, S * 0.9, 5000).toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Vanilla Call</div>
                      <div style={{ color: CYAN, fontSize: 18, fontWeight: 'bold' }}>${bsPrice(S, K, T, r, sigma, 'call').toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Rebate Value</div>
                      <div style={{ color: TEXT, fontSize: 14 }}>${(bsPrice(S, K, T, r, sigma, 'call') - barrierOption(S, K, T, r, sigma, S * 0.9, 5000)).toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Barrier Level</div>
                      <div style={{ color: RED, fontSize: 14 }}>${(S * 0.9).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Asian Option */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>ASIAN OPTION (Arithmetic Average Call)</div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Average-rate option (arithmetic mean)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Asian Call Price</div>
                      <div style={{ color: GREEN, fontSize: 18, fontWeight: 'bold' }}>${asianOption(S, K, T, r, sigma, 5000).toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Vanilla Call</div>
                      <div style={{ color: CYAN, fontSize: 18, fontWeight: 'bold' }}>${bsPrice(S, K, T, r, sigma, 'call').toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Averaging Discount</div>
                      <div style={{ color: AMBER, fontSize: 14 }}>{((1 - asianOption(S, K, T, r, sigma, 5000) / bsPrice(S, K, T, r, sigma, 'call')) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Averaging Points</div>
                      <div style={{ color: TEXT, fontSize: 14 }}>100 daily</div>
                    </div>
                  </div>
                </div>

                {/* Lookback Option */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>LOOKBACK OPTION (Floating Strike)</div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Strike = min(S) for call, max(S) for put</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Lookback Call</div>
                      <div style={{ color: GREEN, fontSize: 18, fontWeight: 'bold' }}>≈${(bsPrice(S, K, T, r, sigma, 'call') * 1.8).toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Lookback Put</div>
                      <div style={{ color: RED, fontSize: 18, fontWeight: 'bold' }}>≈${(bsPrice(S, K, T, r, sigma, 'put') * 1.8).toFixed(4)}</div>
                    </div>
                  </div>
                </div>

                {/* Chooser Option */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>CHOOSER OPTION</div>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 12 }}>Choose call or put at T/2</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Chooser Price</div>
                      <div style={{ color: CYAN, fontSize: 18, fontWeight: 'bold' }}>${(bsPrice(S, K, T, r, sigma, 'call') + bsPrice(S, K, T / 2, r, sigma, 'put') * Math.exp(-r * T / 2)).toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: DIM, fontSize: 9 }}>Value vs Straddle</div>
                      <div style={{ color: TEXT, fontSize: 14 }}>{((1 - (bsPrice(S, K, T, r, sigma, 'call') + bsPrice(S, K, T / 2, r, sigma, 'put') * Math.exp(-r * T / 2)) / (bsPrice(S, K, T, r, sigma, 'call') + bsPrice(S, K, T, r, sigma, 'put'))) * 100).toFixed(1)}% discount</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'P&L Profile' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>
                {optType.toUpperCase()} P&L PROFILE | S={S} K={K} Premium=${price.toFixed(2)}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <canvas ref={plCanvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>Max Profit</div>
                  <div style={{ color: GREEN, fontSize: 14, fontWeight: 'bold' }}>{optType === 'call' ? '∞' : '$' + (K - price).toFixed(2)}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>Max Loss</div>
                  <div style={{ color: RED, fontSize: 14, fontWeight: 'bold' }}>-${price.toFixed(2)}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>Breakeven</div>
                  <div style={{ color: AMBER, fontSize: 14, fontWeight: 'bold' }}>${(optType === 'call' ? K + price : K - price).toFixed(2)}</div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 8, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 9 }}>Prob ITM</div>
                  <div style={{ color: CYAN, fontSize: 14, fontWeight: 'bold' }}>{(Math.abs(greeks.delta) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
