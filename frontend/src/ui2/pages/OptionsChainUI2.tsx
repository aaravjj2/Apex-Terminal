/**
 * OptionsChainUI2.tsx — Bloomberg OMON / TradingView Options Chain
 * ================================================================
 * Full-featured options chain with:
 * - Call/Put chain with greeks (Delta, Gamma, Theta, Vega, Rho)
 * - Multiple expiry selection
 * - Volatility surface canvas chart (3D-like)
 * - Put-Call ratio indicator
 * - Options strategy builder (spreads, straddles, etc.)
 * - P&L diagram canvas chart
 * - Open interest analysis
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Option data structures ───────────────────────────────────────────────────
interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  change: number;
  volume: number;
  openInterest: number;
  impliedVol: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  inTheMoney: boolean;
}

interface OptionExpiry {
  date: string;
  daysToExpiry: number;
  calls: OptionContract[];
  puts: OptionContract[];
}

// ── Mock data generation ─────────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function blackScholes(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean) {
  if (T <= 0) return { price: Math.max(isCall ? S - K : K - S, 0), delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const nd1 = normalCDF(d1);
  const nd2 = normalCDF(d2);
  const nnd1 = normalCDF(-d1);
  const nnd2 = normalCDF(-d2);
  const pdf_d1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);

  const delta = isCall ? nd1 : nd1 - 1;
  const gamma = pdf_d1 / (S * sigma * Math.sqrt(T));
  const theta = isCall
    ? -(S * pdf_d1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nd2
    : -(S * pdf_d1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * nnd2;
  const vega = S * Math.sqrt(T) * pdf_d1;
  const rho = isCall ? K * T * Math.exp(-r * T) * nd2 : -K * T * Math.exp(-r * T) * nnd2;
  const price = isCall
    ? S * nd1 - K * Math.exp(-r * T) * nd2
    : K * Math.exp(-r * T) * nnd2 - S * nnd1;

  return { price: Math.max(price, 0.01), delta, gamma, theta: theta / 365, vega: vega / 100, rho: rho / 100 };
}

function generateOptionChain(spotPrice: number): OptionExpiry[] {
  const expiries = [
    { date: '2024-07-19', dte: 7 },
    { date: '2024-07-26', dte: 14 },
    { date: '2024-08-02', dte: 21 },
    { date: '2024-08-16', dte: 35 },
    { date: '2024-09-20', dte: 70 },
    { date: '2024-10-18', dte: 98 },
    { date: '2024-12-20', dte: 161 },
    { date: '2025-01-17', dte: 189 },
    { date: '2025-03-21', dte: 252 },
    { date: '2025-06-20', dte: 343 },
  ];

  const r = 0.053; // risk-free rate
  const baseIV = 0.25 + Math.random() * 0.1;

  return expiries.map(exp => {
    const T = exp.dte / 365;
    const strikes: number[] = [];
    const step = spotPrice > 200 ? 5 : spotPrice > 50 ? 2.5 : 1;
    const atm = Math.round(spotPrice / step) * step;
    for (let k = atm - step * 12; k <= atm + step * 12; k += step) {
      if (k > 0) strikes.push(k);
    }

    const calls: OptionContract[] = [];
    const puts: OptionContract[] = [];

    strikes.forEach(K => {
      const moneyness = Math.abs(K - spotPrice) / spotPrice;
      const skew = 0.1 * moneyness * (K < spotPrice ? 1.2 : 0.8);
      const iv = baseIV + skew + (Math.random() - 0.5) * 0.02;

      const callBS = blackScholes(spotPrice, K, T, r, iv, true);
      const putBS = blackScholes(spotPrice, K, T, r, iv, false);

      const spread = Math.max(0.01, callBS.price * 0.02 + 0.01);
      const vol = Math.floor(Math.random() * 5000 * Math.exp(-moneyness * 5));
      const oi = Math.floor(Math.random() * 20000 * Math.exp(-moneyness * 3));

      calls.push({
        strike: K,
        bid: +Math.max(callBS.price - spread, 0.01).toFixed(2),
        ask: +(callBS.price + spread).toFixed(2),
        last: +callBS.price.toFixed(2),
        change: +((Math.random() - 0.45) * callBS.price * 0.15).toFixed(2),
        volume: vol,
        openInterest: oi,
        impliedVol: +(iv * 100).toFixed(1),
        delta: +callBS.delta.toFixed(4),
        gamma: +callBS.gamma.toFixed(4),
        theta: +callBS.theta.toFixed(4),
        vega: +callBS.vega.toFixed(4),
        rho: +callBS.rho.toFixed(4),
        inTheMoney: K < spotPrice,
      });

      puts.push({
        strike: K,
        bid: +Math.max(putBS.price - spread, 0.01).toFixed(2),
        ask: +(putBS.price + spread).toFixed(2),
        last: +putBS.price.toFixed(2),
        change: +((Math.random() - 0.5) * putBS.price * 0.15).toFixed(2),
        volume: Math.floor(vol * (0.6 + Math.random() * 0.8)),
        openInterest: Math.floor(oi * (0.5 + Math.random())),
        impliedVol: +(iv * 100).toFixed(1),
        delta: +putBS.delta.toFixed(4),
        gamma: +putBS.gamma.toFixed(4),
        theta: +putBS.theta.toFixed(4),
        vega: +putBS.vega.toFixed(4),
        rho: +putBS.rho.toFixed(4),
        inTheMoney: K > spotPrice,
      });
    });

    return { date: exp.date, daysToExpiry: exp.dte, calls, puts };
  });
}

// ── Vol Surface chart ────────────────────────────────────────────────────────
function VolSurface({ expiries, spotPrice, width = 600, height = 250 }: {
  expiries: OptionExpiry[]; spotPrice: number; width?: number; height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Draw grid
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + w, y);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = MUTED;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    const ivMax = 60, ivMin = 15;
    for (let i = 0; i <= 4; i++) {
      const v = ivMax - i * (ivMax - ivMin) / 4;
      const y = margin.top + (i / 4) * h;
      ctx.fillText(`${v.toFixed(0)}%`, margin.left - 4, y + 3);
    }

    ctx.textAlign = 'center';
    ctx.fillText('IV', margin.left - 30, margin.top + h / 2);

    // Plot IV smile for each expiry
    const colors = ['#f5a623', '#42a5f5', '#26a69a', '#ef5350', '#ab47bc', '#69f0ae'];

    expiries.slice(0, 6).forEach((exp, ei) => {
      const color = colors[ei % colors.length];
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;

      exp.calls.forEach((c, ci) => {
        const x = margin.left + (ci / (exp.calls.length - 1)) * w;
        const iv = c.impliedVol;
        const y = margin.top + ((ivMax - iv) / (ivMax - ivMin)) * h;

        if (ci === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Legend
      ctx.fillStyle = color;
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${exp.daysToExpiry}DTE`, width - margin.right - 60, margin.top + 12 + ei * 12);
    });

    // ATM line
    const atmX = margin.left + w / 2;
    ctx.strokeStyle = AMBER;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(atmX, margin.top);
    ctx.lineTo(atmX, margin.top + h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = AMBER;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ATM $${spotPrice.toFixed(0)}`, atmX, margin.top + h + 14);

    // X-axis
    ctx.fillStyle = MUTED;
    ctx.fillText('OTM Puts', margin.left + w * 0.15, height - 4);
    ctx.fillText('OTM Calls', margin.left + w * 0.85, height - 4);
  }, [expiries, spotPrice, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── P&L diagram ──────────────────────────────────────────────────────────────
function PnLDiagram({ legs, spotPrice, width = 500, height = 200 }: {
  legs: Array<{ strike: number; premium: number; type: 'call' | 'put'; side: 'buy' | 'sell' }>;
  spotPrice: number;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || legs.length === 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 10, right: 10, bottom: 20, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const allStrikes = legs.map(l => l.strike);
    const minPrice = Math.min(...allStrikes) * 0.85;
    const maxPrice = Math.max(...allStrikes) * 1.15;

    // Calculate P&L at expiry
    const points: Array<{ price: number; pnl: number }> = [];
    for (let p = minPrice; p <= maxPrice; p += (maxPrice - minPrice) / 200) {
      let pnl = 0;
      legs.forEach(leg => {
        const intrinsic = leg.type === 'call'
          ? Math.max(p - leg.strike, 0)
          : Math.max(leg.strike - p, 0);
        const mult = leg.side === 'buy' ? 1 : -1;
        pnl += mult * (intrinsic - leg.premium) * 100;
      });
      points.push({ price: p, pnl });
    }

    const pnlMin = Math.min(...points.map(p => p.pnl));
    const pnlMax = Math.max(...points.map(p => p.pnl));
    const pnlRange = pnlMax - pnlMin || 1;

    // Zero line
    const zeroY = margin.top + ((pnlMax) / pnlRange) * h;
    ctx.strokeStyle = MUTED;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(margin.left + w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = MUTED;
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('$0', margin.left - 4, zeroY + 3);

    // Plot P&L
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = margin.left + ((pt.price - minPrice) / (maxPrice - minPrice)) * w;
      const y = margin.top + ((pnlMax - pt.pnl) / pnlRange) * h;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill positive green, negative red
    points.forEach((pt, i) => {
      if (i === 0) return;
      const prev = points[i - 1];
      const x1 = margin.left + ((prev.price - minPrice) / (maxPrice - minPrice)) * w;
      const x2 = margin.left + ((pt.price - minPrice) / (maxPrice - minPrice)) * w;
      const y1 = margin.top + ((pnlMax - prev.pnl) / pnlRange) * h;
      const y2 = margin.top + ((pnlMax - pt.pnl) / pnlRange) * h;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, zeroY);
      ctx.lineTo(x1, zeroY);
      ctx.closePath();
      ctx.fillStyle = pt.pnl >= 0 ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)';
      ctx.fill();
    });

    // Spot price line
    const spotX = margin.left + ((spotPrice - minPrice) / (maxPrice - minPrice)) * w;
    ctx.strokeStyle = BLUE;
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spotX, margin.top);
    ctx.lineTo(spotX, margin.top + h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = BLUE;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Spot $${spotPrice.toFixed(0)}`, spotX, margin.top + h + 14);

    // Max profit/loss labels
    ctx.fillStyle = GREEN;
    ctx.textAlign = 'right';
    ctx.fillText(`Max: $${pnlMax.toFixed(0)}`, margin.left - 4, margin.top + 10);
    ctx.fillStyle = RED;
    ctx.fillText(`Min: $${pnlMin.toFixed(0)}`, margin.left - 4, margin.top + h);
  }, [legs, spotPrice, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Strategy types ───────────────────────────────────────────────────────────
type Strategy = 'long_call' | 'long_put' | 'covered_call' | 'bull_spread' | 'bear_spread' | 'straddle' | 'strangle' | 'iron_condor' | 'butterfly' | 'custom';

const STRATEGIES: Array<{ id: Strategy; name: string; icon: string; description: string }> = [
  { id: 'long_call', name: 'Long Call', icon: '📈', description: 'Bullish directional' },
  { id: 'long_put', name: 'Long Put', icon: '📉', description: 'Bearish directional' },
  { id: 'covered_call', name: 'Covered Call', icon: '🛡️', description: 'Income on holdings' },
  { id: 'bull_spread', name: 'Bull Call Spread', icon: '🐂', description: 'Limited risk bullish' },
  { id: 'bear_spread', name: 'Bear Put Spread', icon: '🐻', description: 'Limited risk bearish' },
  { id: 'straddle', name: 'Straddle', icon: '↕️', description: 'Volatility play' },
  { id: 'strangle', name: 'Strangle', icon: '⬆️', description: 'Wide volatility' },
  { id: 'iron_condor', name: 'Iron Condor', icon: '🦅', description: 'Range-bound' },
  { id: 'butterfly', name: 'Butterfly', icon: '🦋', description: 'Pinned price' },
  { id: 'custom', name: 'Custom', icon: '⚙️', description: 'Build your own' },
];

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'chain' | 'surface' | 'strategies' | 'analysis';
type ChainView = 'all' | 'calls' | 'puts';

export default function OptionsChainUI2() {
  const spotPrice = useMemo(() => 185 + Math.random() * 10, []);
  const [chain] = useState<OptionExpiry[]>(() => generateOptionChain(spotPrice));
  const [selectedExpiry, setSelectedExpiry] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('chain');
  const [chainView, setChainView] = useState<ChainView>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('long_call');
  const [showGreeks, setShowGreeks] = useState(true);
  const [symbol] = useState('AAPL');

  const expiry = chain[selectedExpiry];

  // ── Strategy legs ──
  const strategyLegs = useMemo(() => {
    if (!expiry) return [];
    const atm = expiry.calls.reduce((best, c) => Math.abs(c.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? c : best).strike;
    const step = expiry.calls.length > 1 ? expiry.calls[1].strike - expiry.calls[0].strike : 5;

    switch (selectedStrategy) {
      case 'long_call': {
        const c = expiry.calls.find(x => x.strike === atm);
        return c ? [{ strike: atm, premium: c.ask, type: 'call' as const, side: 'buy' as const }] : [];
      }
      case 'long_put': {
        const p = expiry.puts.find(x => x.strike === atm);
        return p ? [{ strike: atm, premium: p.ask, type: 'put' as const, side: 'buy' as const }] : [];
      }
      case 'bull_spread': {
        const c1 = expiry.calls.find(x => x.strike === atm);
        const c2 = expiry.calls.find(x => x.strike === atm + step * 2);
        if (!c1 || !c2) return [];
        return [
          { strike: atm, premium: c1.ask, type: 'call' as const, side: 'buy' as const },
          { strike: atm + step * 2, premium: c2.bid, type: 'call' as const, side: 'sell' as const },
        ];
      }
      case 'bear_spread': {
        const p1 = expiry.puts.find(x => x.strike === atm);
        const p2 = expiry.puts.find(x => x.strike === atm - step * 2);
        if (!p1 || !p2) return [];
        return [
          { strike: atm, premium: p1.ask, type: 'put' as const, side: 'buy' as const },
          { strike: atm - step * 2, premium: p2.bid, type: 'put' as const, side: 'sell' as const },
        ];
      }
      case 'straddle': {
        const c = expiry.calls.find(x => x.strike === atm);
        const p = expiry.puts.find(x => x.strike === atm);
        if (!c || !p) return [];
        return [
          { strike: atm, premium: c.ask, type: 'call' as const, side: 'buy' as const },
          { strike: atm, premium: p.ask, type: 'put' as const, side: 'buy' as const },
        ];
      }
      case 'iron_condor': {
        const c1 = expiry.calls.find(x => x.strike === atm + step);
        const c2 = expiry.calls.find(x => x.strike === atm + step * 3);
        const p1 = expiry.puts.find(x => x.strike === atm - step);
        const p2 = expiry.puts.find(x => x.strike === atm - step * 3);
        if (!c1 || !c2 || !p1 || !p2) return [];
        return [
          { strike: atm - step * 3, premium: p2.ask, type: 'put' as const, side: 'buy' as const },
          { strike: atm - step, premium: p1.bid, type: 'put' as const, side: 'sell' as const },
          { strike: atm + step, premium: c1.bid, type: 'call' as const, side: 'sell' as const },
          { strike: atm + step * 3, premium: c2.ask, type: 'call' as const, side: 'buy' as const },
        ];
      }
      default: return [];
    }
  }, [expiry, selectedStrategy, spotPrice]);

  // ── Put-Call ratio ──
  const pcRatio = useMemo(() => {
    if (!expiry) return 0;
    const callVol = expiry.calls.reduce((a, c) => a + c.volume, 0);
    const putVol = expiry.puts.reduce((a, p) => a + p.volume, 0);
    return callVol > 0 ? putVol / callVol : 0;
  }, [expiry]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chain', label: 'OPTIONS CHAIN' },
    { key: 'surface', label: 'VOL SURFACE' },
    { key: 'strategies', label: 'STRATEGIES' },
    { key: 'analysis', label: 'ANALYSIS' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* ── Header ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>
          OPTIONS — {symbol}
        </span>
        <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>${spotPrice.toFixed(2)}</span>

        {/* P/C Ratio */}
        <div style={{
          padding: '2px 8px',
          borderRadius: 3,
          border: `1px solid ${pcRatio > 1 ? RED : GREEN}`,
          fontSize: 9,
        }}>
          <span style={{ color: MUTED }}>P/C: </span>
          <span style={{ color: pcRatio > 1 ? RED : GREEN }}>{pcRatio.toFixed(2)}</span>
        </div>

        {/* Tabs */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Expiry selector ── */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
      }}>
        <span style={{ color: MUTED, fontSize: 9, marginRight: 4 }}>EXPIRY:</span>
        {chain.map((exp, i) => (
          <button
            key={exp.date}
            style={{
              background: selectedExpiry === i ? 'rgba(245,166,35,0.12)' : 'transparent',
              border: `1px solid ${selectedExpiry === i ? AMBER : BORDER}`,
              color: selectedExpiry === i ? AMBER : MUTED,
              padding: '3px 8px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 9,
              fontFamily: '"Roboto Mono", monospace',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setSelectedExpiry(i)}
          >
            {exp.date} ({exp.daysToExpiry}d)
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['all', 'calls', 'puts'] as ChainView[]).map(v => (
            <button
              key={v}
              style={{
                background: chainView === v ? 'rgba(245,166,35,0.12)' : 'transparent',
                border: `1px solid ${chainView === v ? AMBER : BORDER}`,
                color: chainView === v ? AMBER : MUTED,
                padding: '3px 6px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
                textTransform: 'uppercase',
              }}
              onClick={() => setChainView(v)}
            >
              {v}
            </button>
          ))}
          <button
            style={{
              background: showGreeks ? 'rgba(245,166,35,0.12)' : 'transparent',
              border: `1px solid ${showGreeks ? AMBER : BORDER}`,
              color: showGreeks ? AMBER : MUTED,
              padding: '3px 6px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 9,
              fontFamily: '"Roboto Mono", monospace',
            }}
            onClick={() => setShowGreeks(!showGreeks)}
          >
            GREEKS
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'chain' && expiry && (
          <div>
            {/* Chain table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}`, position: 'sticky', top: 0, background: BG, zIndex: 1 }}>
                  {(chainView === 'all' || chainView === 'calls') && (
                    <>
                      {showGreeks && (
                        <>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>DELTA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>GAMMA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>THETA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>VEGA</th>
                        </>
                      )}
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>IV%</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>OI</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>VOL</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>CHG</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>LAST</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>ASK</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'right' }}>BID</th>
                      <th style={{ padding: '5px 4px', color: GREEN, fontSize: 8, textAlign: 'center' }}>CALLS</th>
                    </>
                  )}
                  <th style={{ padding: '5px 6px', color: AMBER, fontSize: 9, textAlign: 'center', borderLeft: `2px solid ${AMBER}`, borderRight: `2px solid ${AMBER}` }}>STRIKE</th>
                  {(chainView === 'all' || chainView === 'puts') && (
                    <>
                      <th style={{ padding: '5px 4px', color: RED, fontSize: 8, textAlign: 'center' }}>PUTS</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>BID</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>ASK</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>LAST</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>CHG</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>VOL</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>OI</th>
                      <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>IV%</th>
                      {showGreeks && (
                        <>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>DELTA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>GAMMA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>THETA</th>
                          <th style={{ padding: '5px 4px', color: MUTED, fontSize: 8, textAlign: 'left' }}>VEGA</th>
                        </>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {expiry.calls.map((call, i) => {
                  const put = expiry.puts[i];
                  const isATM = Math.abs(call.strike - spotPrice) < (expiry.calls[1]?.strike - expiry.calls[0]?.strike || 5) / 2;
                  return (
                    <tr
                      key={call.strike}
                      style={{
                        borderBottom: `1px solid ${BORDER}`,
                        background: isATM ? 'rgba(245,166,35,0.06)' : i % 2 === 0 ? PANEL : BG,
                      }}
                    >
                      {(chainView === 'all' || chainView === 'calls') && (
                        <>
                          {showGreeks && (
                            <>
                              <td style={{ padding: '4px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{call.delta.toFixed(3)}</td>
                              <td style={{ padding: '4px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{call.gamma.toFixed(4)}</td>
                              <td style={{ padding: '4px', textAlign: 'right', color: RED, fontSize: 9 }}>{call.theta.toFixed(4)}</td>
                              <td style={{ padding: '4px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{call.vega.toFixed(4)}</td>
                            </>
                          )}
                          <td style={{ padding: '4px', textAlign: 'right', fontSize: 9, color: PURPLE }}>{call.impliedVol}%</td>
                          <td style={{ padding: '4px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{call.openInterest.toLocaleString()}</td>
                          <td style={{ padding: '4px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{call.volume.toLocaleString()}</td>
                          <td style={{ padding: '4px', textAlign: 'right', color: call.change >= 0 ? GREEN : RED, fontSize: 9 }}>
                            {call.change >= 0 ? '+' : ''}{call.change.toFixed(2)}
                          </td>
                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600, fontSize: 9 }}>{call.last.toFixed(2)}</td>
                          <td style={{ padding: '4px', textAlign: 'right', color: RED, fontSize: 9 }}>{call.ask.toFixed(2)}</td>
                          <td style={{ padding: '4px', textAlign: 'right', color: GREEN, fontSize: 9 }}>{call.bid.toFixed(2)}</td>
                          <td style={{
                            padding: '4px',
                            textAlign: 'center',
                            background: call.inTheMoney ? 'rgba(38,166,154,0.06)' : 'transparent',
                            fontSize: 8,
                            color: GREEN,
                          }}>
                            {call.inTheMoney ? 'ITM' : ''}
                          </td>
                        </>
                      )}
                      <td style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        color: AMBER,
                        fontWeight: 700,
                        fontSize: 10,
                        borderLeft: `2px solid ${AMBER}`,
                        borderRight: `2px solid ${AMBER}`,
                        background: isATM ? 'rgba(245,166,35,0.1)' : 'transparent',
                      }}>
                        {call.strike.toFixed(call.strike % 1 ? 1 : 0)}
                      </td>
                      {(chainView === 'all' || chainView === 'puts') && put && (
                        <>
                          <td style={{
                            padding: '4px',
                            textAlign: 'center',
                            background: put.inTheMoney ? 'rgba(239,83,80,0.06)' : 'transparent',
                            fontSize: 8,
                            color: RED,
                          }}>
                            {put.inTheMoney ? 'ITM' : ''}
                          </td>
                          <td style={{ padding: '4px', textAlign: 'left', color: GREEN, fontSize: 9 }}>{put.bid.toFixed(2)}</td>
                          <td style={{ padding: '4px', textAlign: 'left', color: RED, fontSize: 9 }}>{put.ask.toFixed(2)}</td>
                          <td style={{ padding: '4px', textAlign: 'left', fontWeight: 600, fontSize: 9 }}>{put.last.toFixed(2)}</td>
                          <td style={{ padding: '4px', textAlign: 'left', color: put.change >= 0 ? GREEN : RED, fontSize: 9 }}>
                            {put.change >= 0 ? '+' : ''}{put.change.toFixed(2)}
                          </td>
                          <td style={{ padding: '4px', textAlign: 'left', color: MUTED, fontSize: 9 }}>{put.volume.toLocaleString()}</td>
                          <td style={{ padding: '4px', textAlign: 'left', color: MUTED, fontSize: 9 }}>{put.openInterest.toLocaleString()}</td>
                          <td style={{ padding: '4px', textAlign: 'left', fontSize: 9, color: PURPLE }}>{put.impliedVol}%</td>
                          {showGreeks && (
                            <>
                              <td style={{ padding: '4px', textAlign: 'left', color: MUTED, fontSize: 9 }}>{put.delta.toFixed(3)}</td>
                              <td style={{ padding: '4px', textAlign: 'left', color: MUTED, fontSize: 9 }}>{put.gamma.toFixed(4)}</td>
                              <td style={{ padding: '4px', textAlign: 'left', color: RED, fontSize: 9 }}>{put.theta.toFixed(4)}</td>
                              <td style={{ padding: '4px', textAlign: 'left', color: MUTED, fontSize: 9 }}>{put.vega.toFixed(4)}</td>
                            </>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'surface' && (
          <div style={{ padding: 16 }}>
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>
                IMPLIED VOLATILITY SURFACE — {symbol}
              </div>
              <VolSurface expiries={chain} spotPrice={spotPrice} width={800} height={300} />
            </div>
          </div>
        )}

        {activeTab === 'strategies' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Strategy selector */}
              <div style={{ width: 200 }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>SELECT STRATEGY</div>
                {STRATEGIES.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '8px 10px',
                      borderBottom: `1px solid ${BORDER}`,
                      background: selectedStrategy === s.id ? 'rgba(245,166,35,0.08)' : 'transparent',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${selectedStrategy === s.id ? AMBER : 'transparent'}`,
                    }}
                    onClick={() => setSelectedStrategy(s.id)}
                  >
                    <div style={{ color: selectedStrategy === s.id ? AMBER : TEXT, fontSize: 10 }}>
                      {s.icon} {s.name}
                    </div>
                    <div style={{ color: MUTED, fontSize: 8 }}>{s.description}</div>
                  </div>
                ))}
              </div>

              {/* P&L diagram */}
              <div style={{ flex: 1 }}>
                <div style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>
                    P&L AT EXPIRY — {STRATEGIES.find(s => s.id === selectedStrategy)?.name}
                  </div>
                  <PnLDiagram legs={strategyLegs} spotPrice={spotPrice} width={600} height={250} />
                </div>

                {/* Legs detail */}
                <div style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 12,
                }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>LEGS</div>
                  {strategyLegs.map((leg, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      gap: 12,
                      padding: '6px 0',
                      borderBottom: `1px solid ${BORDER}`,
                      fontSize: 10,
                    }}>
                      <span style={{
                        color: leg.side === 'buy' ? GREEN : RED,
                        fontWeight: 600,
                        width: 40,
                      }}>
                        {leg.side.toUpperCase()}
                      </span>
                      <span style={{ color: leg.type === 'call' ? GREEN : RED, width: 40 }}>
                        {leg.type.toUpperCase()}
                      </span>
                      <span style={{ color: AMBER, width: 60 }}>Strike: ${leg.strike}</span>
                      <span style={{ color: TEXT }}>Premium: ${leg.premium.toFixed(2)}</span>
                      <span style={{ color: MUTED }}>
                        Cost: ${(leg.premium * 100 * (leg.side === 'buy' ? -1 : 1)).toFixed(0)}
                      </span>
                    </div>
                  ))}
                  {strategyLegs.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 10 }}>
                      <span style={{ color: MUTED }}>Net Premium: </span>
                      <span style={{
                        color: strategyLegs.reduce((a, l) => a + l.premium * (l.side === 'buy' ? -1 : 1), 0) >= 0 ? GREEN : RED,
                        fontWeight: 700,
                      }}>
                        ${(strategyLegs.reduce((a, l) => a + l.premium * (l.side === 'buy' ? -1 : 1), 0) * 100).toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && expiry && (
          <div style={{ padding: 16 }}>
            {/* Open Interest Analysis */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>
                OPEN INTEREST BY STRIKE
              </div>
              {expiry.calls.filter((_, i) => i % 2 === 0).map((call, i) => {
                const put = expiry.puts[i * 2];
                const maxOI = Math.max(...expiry.calls.map(c => c.openInterest), ...expiry.puts.map(p => p.openInterest));
                return (
                  <div key={call.strike} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                    <div style={{ width: 200, display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        height: 10,
                        width: `${(call.openInterest / maxOI) * 100}%`,
                        background: GREEN,
                        opacity: 0.6,
                        borderRadius: '2px 0 0 2px',
                      }} />
                    </div>
                    <span style={{ color: MUTED, fontSize: 8, width: 35, textAlign: 'right' }}>
                      {(call.openInterest / 1000).toFixed(1)}K
                    </span>
                    <span style={{ color: AMBER, fontSize: 9, width: 40, textAlign: 'center', fontWeight: 600 }}>
                      {call.strike}
                    </span>
                    <span style={{ color: MUTED, fontSize: 8, width: 35 }}>
                      {put ? `${(put.openInterest / 1000).toFixed(1)}K` : ''}
                    </span>
                    <div style={{ width: 200 }}>
                      <div style={{
                        height: 10,
                        width: put ? `${(put.openInterest / maxOI) * 100}%` : '0%',
                        background: RED,
                        opacity: 0.6,
                        borderRadius: '0 2px 2px 0',
                      }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, fontSize: 9, color: MUTED }}>
                <span><span style={{ color: GREEN }}>■</span> Call OI</span>
                <span><span style={{ color: RED }}>■</span> Put OI</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
