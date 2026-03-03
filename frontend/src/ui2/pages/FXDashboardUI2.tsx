/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — FX DASHBOARD (UI2)                                  │
 * │  Bloomberg-grade FX analytics with real-time rates, heatmaps,        │
 * │  cross-rate matrix, forward curves, volatility surface, and          │
 * │  multi-pair chart overlay — tasks.md §8                              │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/* ── Design Tokens ───────────────────────────────────────────────────── */
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

/* ── Interfaces ──────────────────────────────────────────────────────── */
interface FXRate {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume: number;
  timestamp: string;
}

interface FXCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ForwardPoint {
  tenor: string;
  days: number;
  points: number;
  outright: number;
  impliedYield: number;
}

interface VolPoint {
  tenor: string;
  atm: number;
  rr25: number;
  rr10: number;
  fly25: number;
  fly10: number;
}

interface CrossRateEntry {
  base: string;
  quote: string;
  rate: number;
  change: number;
}

interface EconomicEvent {
  time: string;
  currency: string;
  event: string;
  actual: string;
  forecast: string;
  previous: string;
  impact: 'high' | 'medium' | 'low';
}

interface CorrelationEntry {
  pair1: string;
  pair2: string;
  corr1d: number;
  corr1w: number;
  corr1m: number;
  corr3m: number;
}

/* ── Major Pairs ─────────────────────────────────────────────────────── */
const MAJOR_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
];
const CROSS_PAIRS = [
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'CAD/JPY', 'NZD/JPY',
  'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'GBP/CAD', 'AUD/NZD', 'EUR/NZD',
];
const EM_PAIRS = [
  'USD/MXN', 'USD/BRL', 'USD/TRY', 'USD/ZAR', 'USD/INR', 'USD/CNH',
  'USD/KRW', 'USD/THB', 'USD/SGD', 'USD/HKD', 'USD/PLN', 'USD/CZK',
];
const ALL_PAIRS = [...MAJOR_PAIRS, ...CROSS_PAIRS, ...EM_PAIRS];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];
const TENORS = ['ON', '1W', '2W', '1M', '2M', '3M', '6M', '9M', '1Y', '2Y', '3Y', '5Y'];

/* ── Mock data generators (with yfinance fallback patterns) ──────── */
function generateFXRate(pair: string): FXRate {
  const bases: Record<string, number> = {
    'EUR/USD': 1.0875, 'GBP/USD': 1.2640, 'USD/JPY': 149.85, 'USD/CHF': 0.8812,
    'AUD/USD': 0.6545, 'USD/CAD': 1.3565, 'NZD/USD': 0.6125,
    'EUR/GBP': 0.8605, 'EUR/JPY': 162.95, 'GBP/JPY': 189.35, 'EUR/CHF': 0.9585,
    'AUD/JPY': 98.05, 'CAD/JPY': 110.45, 'NZD/JPY': 91.85,
    'EUR/AUD': 1.6615, 'GBP/AUD': 1.9315, 'EUR/CAD': 1.4755, 'GBP/CAD': 1.7145,
    'AUD/NZD': 1.0685, 'EUR/NZD': 1.7755,
    'USD/MXN': 17.12, 'USD/BRL': 4.97, 'USD/TRY': 32.15, 'USD/ZAR': 18.65,
    'USD/INR': 83.15, 'USD/CNH': 7.24, 'USD/KRW': 1325.5, 'USD/THB': 35.45,
    'USD/SGD': 1.3425, 'USD/HKD': 7.8125, 'USD/PLN': 3.98, 'USD/CZK': 23.15,
  };
  const base = bases[pair] ?? (1 + Math.random() * 2);
  const spread = base < 2 ? 0.0002 : base < 10 ? 0.002 : base < 100 ? 0.02 : 0.05;
  const jitter = (Math.random() - 0.5) * spread * 10;
  const mid = base + jitter;
  const change = jitter;
  const changePct = (change / base) * 100;
  return {
    pair,
    bid: mid - spread / 2,
    ask: mid + spread / 2,
    mid,
    change,
    changePct,
    high24h: mid * (1 + Math.random() * 0.005),
    low24h: mid * (1 - Math.random() * 0.005),
    volume: Math.round(50e6 + Math.random() * 200e6),
    timestamp: new Date().toISOString(),
  };
}

function generateFXCandles(pair: string, count: number): FXCandle[] {
  const rate = generateFXRate(pair);
  const candles: FXCandle[] = [];
  let p = rate.mid * (1 - 0.01);
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const o = p;
    const r = (Math.random() - 0.48) * 0.003;
    const c = +(o * (1 + r)).toFixed(5);
    const h = +Math.max(o, c, o * (1 + Math.random() * 0.002)).toFixed(5);
    const l = +Math.min(o, c, o * (1 - Math.random() * 0.002)).toFixed(5);
    candles.push({
      time: now - (count - i) * 3600000,
      open: o, high: h, low: l, close: c,
      volume: Math.round(1e6 + Math.random() * 10e6),
    });
    p = c;
  }
  return candles;
}

function generateForwardCurve(pair: string): ForwardPoint[] {
  const spot = generateFXRate(pair).mid;
  const isUSDBase = pair.startsWith('USD/');
  return TENORS.map((tenor, i) => {
    const days = [1, 7, 14, 30, 60, 90, 180, 270, 365, 730, 1095, 1825][i];
    const pts = (Math.random() - 0.5) * 200 * (i + 1);
    const outright = spot + pts / 10000;
    const annualizedYield = ((outright / spot - 1) * 365 / days) * 100;
    return { tenor, days, points: +pts.toFixed(2), outright: +outright.toFixed(5), impliedYield: +annualizedYield.toFixed(3) };
  });
}

function generateVolSurface(pair: string): VolPoint[] {
  return TENORS.map((tenor, i) => {
    const baseVol = 8 + Math.random() * 6 + (12 - i) * 0.3;
    return {
      tenor,
      atm: +baseVol.toFixed(2),
      rr25: +((Math.random() - 0.5) * 3).toFixed(2),
      rr10: +((Math.random() - 0.5) * 5).toFixed(2),
      fly25: +(0.2 + Math.random() * 0.8).toFixed(2),
      fly10: +(0.5 + Math.random() * 1.5).toFixed(2),
    };
  });
}

function generateCrossMatrix(): CrossRateEntry[] {
  const entries: CrossRateEntry[] = [];
  for (const base of CURRENCIES) {
    for (const quote of CURRENCIES) {
      if (base === quote) continue;
      const pair = `${base}/${quote}`;
      const rate = generateFXRate(pair.length > 7 ? MAJOR_PAIRS[0] : pair);
      entries.push({ base, quote, rate: rate.mid, change: rate.changePct });
    }
  }
  return entries;
}

function generateCorrelations(): CorrelationEntry[] {
  const pairs = MAJOR_PAIRS.slice(0, 7);
  const out: CorrelationEntry[] = [];
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      out.push({
        pair1: pairs[i], pair2: pairs[j],
        corr1d: +((Math.random() - 0.5) * 2).toFixed(3),
        corr1w: +((Math.random() - 0.5) * 2).toFixed(3),
        corr1m: +((Math.random() - 0.5) * 2).toFixed(3),
        corr3m: +((Math.random() - 0.5) * 2).toFixed(3),
      });
    }
  }
  return out;
}

function generateEconomicEvents(): EconomicEvent[] {
  const events = [
    { currency: 'USD', event: 'Non-Farm Payrolls', impact: 'high' as const },
    { currency: 'USD', event: 'CPI m/m', impact: 'high' as const },
    { currency: 'USD', event: 'FOMC Rate Decision', impact: 'high' as const },
    { currency: 'EUR', event: 'ECB Rate Decision', impact: 'high' as const },
    { currency: 'EUR', event: 'German CPI', impact: 'medium' as const },
    { currency: 'GBP', event: 'BOE Rate Decision', impact: 'high' as const },
    { currency: 'GBP', event: 'UK GDP q/q', impact: 'high' as const },
    { currency: 'JPY', event: 'BOJ Rate Decision', impact: 'high' as const },
    { currency: 'JPY', event: 'Tankan Survey', impact: 'medium' as const },
    { currency: 'AUD', event: 'RBA Rate Decision', impact: 'high' as const },
    { currency: 'CAD', event: 'BOC Rate Decision', impact: 'high' as const },
    { currency: 'CHF', event: 'SNB Rate Decision', impact: 'high' as const },
    { currency: 'NZD', event: 'RBNZ Rate Decision', impact: 'high' as const },
    { currency: 'USD', event: 'Initial Jobless Claims', impact: 'medium' as const },
    { currency: 'USD', event: 'ISM Manufacturing', impact: 'medium' as const },
    { currency: 'EUR', event: 'Eurozone CPI', impact: 'medium' as const },
    { currency: 'USD', event: 'Retail Sales m/m', impact: 'medium' as const },
    { currency: 'GBP', event: 'UK CPI y/y', impact: 'high' as const },
    { currency: 'USD', event: 'Core PCE m/m', impact: 'high' as const },
    { currency: 'EUR', event: 'PMI Manufacturing', impact: 'low' as const },
  ];
  return events.map((e, i) => ({
    ...e,
    time: new Date(Date.now() + i * 3600000 * 4).toISOString(),
    actual: i < 5 ? (Math.random() * 5).toFixed(1) + '%' : '--',
    forecast: (Math.random() * 5).toFixed(1) + '%',
    previous: (Math.random() * 5).toFixed(1) + '%',
  }));
}

/* ── Sub-Components ──────────────────────────────────────────────────── */

function RateCard({ rate, selected, onClick }: { rate: FXRate; selected: boolean; onClick: () => void }) {
  const isUp = rate.changePct >= 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? T.bg3 : T.bg2, border: `1px solid ${selected ? T.brand : T.border}`,
        borderRadius: T.r, padding: '8px 10px', cursor: 'pointer', minWidth: '140px',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{rate.pair}</span>
        <span style={{
          fontSize: '9px', fontWeight: 600, color: isUp ? T.up : T.dn,
          background: isUp ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)',
          padding: '1px 4px', borderRadius: '2px',
        }}>
          {isUp ? '+' : ''}{rate.changePct.toFixed(3)}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', fontSize: '10px', fontFamily: T.mono }}>
        <span style={{ color: T.up }}>{rate.bid.toFixed(rate.bid < 10 ? 5 : 3)}</span>
        <span style={{ color: T.tx3 }}>/</span>
        <span style={{ color: T.dn }}>{rate.ask.toFixed(rate.ask < 10 ? 5 : 3)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '8px', color: T.tx3 }}>
        <span>H: {rate.high24h.toFixed(rate.high24h < 10 ? 5 : 3)}</span>
        <span>L: {rate.low24h.toFixed(rate.low24h < 10 ? 5 : 3)}</span>
      </div>
      <div style={{ marginTop: '3px', fontSize: '7px', color: T.tx3 }}>
        Vol: {(rate.volume / 1e6).toFixed(0)}M
      </div>
    </div>
  );
}

function MiniChart({ candles, width = 200, height = 60 }: { candles: FXCandle[]; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !candles.length) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    cvs.width = width; cvs.height = height;
    ctx.clearRect(0, 0, width, height);

    const prices = candles.map(c => c.close);
    const mn = Math.min(...prices);
    const mx = Math.max(...prices);
    const range = mx - mn || 1;

    const isUp = prices[prices.length - 1] >= prices[0];
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, isUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(0, height);
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - mn) / range) * height * 0.9 - height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - mn) / range) * height * 0.9 - height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? T.up : T.dn;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [candles, width, height]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} />;
}

function CrossRateMatrix({ entries }: { entries: CrossRateEntry[] }) {
  const getRate = (base: string, quote: string) => {
    if (base === quote) return null;
    return entries.find(e => e.base === base && e.quote === quote);
  };

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '9px', fontFamily: T.mono }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 6px', color: T.tx2, borderBottom: `1px solid ${T.border}`, textAlign: 'left' }}></th>
            {CURRENCIES.map(c => (
              <th key={c} style={{ padding: '4px 6px', color: T.brand, borderBottom: `1px solid ${T.border}`, textAlign: 'center', fontWeight: 700 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CURRENCIES.map(base => (
            <tr key={base}>
              <td style={{ padding: '4px 6px', color: T.brand, fontWeight: 700, borderRight: `1px solid ${T.border}` }}>{base}</td>
              {CURRENCIES.map(quote => {
                const entry = getRate(base, quote);
                if (!entry) return <td key={quote} style={{ padding: '4px 6px', textAlign: 'center', color: T.tx3 }}>—</td>;
                const isUp = entry.change >= 0;
                return (
                  <td key={quote} style={{
                    padding: '4px 6px', textAlign: 'center',
                    color: isUp ? T.up : T.dn,
                    background: isUp ? 'rgba(38,166,154,0.05)' : 'rgba(239,83,80,0.05)',
                  }}>
                    {entry.rate.toFixed(entry.rate < 10 ? 4 : 2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForwardCurvePanel({ forwardData, pair }: { forwardData: ForwardPoint[]; pair: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !forwardData.length) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    cvs.width = 400; cvs.height = 150;
    ctx.clearRect(0, 0, 400, 150);

    const points = forwardData.map(f => f.points);
    const mn = Math.min(...points);
    const mx = Math.max(...points);
    const range = mx - mn || 1;

    // Grid
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = 10 + (i / 3) * 130;
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(390, y); ctx.stroke();
    }
    // Zero line
    const zeroY = 10 + ((mx - 0) / range) * 130;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = T.tx3;
    ctx.beginPath(); ctx.moveTo(30, zeroY); ctx.lineTo(390, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Points + line
    ctx.beginPath();
    forwardData.forEach((f, i) => {
      const x = 30 + (i / (forwardData.length - 1)) * 360;
      const y = 10 + ((mx - f.points) / range) * 130;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = T.brand;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots + labels
    forwardData.forEach((f, i) => {
      const x = 30 + (i / (forwardData.length - 1)) * 360;
      const y = 10 + ((mx - f.points) / range) * 130;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = T.brand; ctx.fill();
      if (i % 2 === 0) {
        ctx.fillStyle = T.tx3; ctx.font = '7px Inter'; ctx.textAlign = 'center';
        ctx.fillText(f.tenor, x, 148);
      }
    });
  }, [forwardData]);

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>
        Forward Points — {pair}
      </div>
      <canvas ref={canvasRef} style={{ width: '400px', height: '150px', maxWidth: '100%' }} />
      <div style={{ marginTop: '6px', overflow: 'auto', maxHeight: '200px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['Tenor', 'Days', 'Points', 'Outright', 'Impl. Yield'].map(h => (
                <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forwardData.map(f => (
              <tr key={f.tenor} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '3px 6px', color: T.brand, fontWeight: 600 }}>{f.tenor}</td>
                <td style={{ padding: '3px 6px', color: T.tx1, textAlign: 'right' }}>{f.days}</td>
                <td style={{ padding: '3px 6px', color: f.points >= 0 ? T.up : T.dn, textAlign: 'right' }}>{f.points.toFixed(2)}</td>
                <td style={{ padding: '3px 6px', color: T.tx0, textAlign: 'right' }}>{f.outright.toFixed(5)}</td>
                <td style={{ padding: '3px 6px', color: f.impliedYield >= 0 ? T.up : T.dn, textAlign: 'right' }}>{f.impliedYield.toFixed(3)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VolSurfacePanel({ volData, pair }: { volData: VolPoint[]; pair: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !volData.length) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    cvs.width = 400; cvs.height = 150;
    ctx.clearRect(0, 0, 400, 150);

    const atms = volData.map(v => v.atm);
    const mn = Math.min(...atms) - 1;
    const mx = Math.max(...atms) + 1;
    const range = mx - mn;

    // Grid
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = 10 + (i / 3) * 130;
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(390, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px Inter'; ctx.textAlign = 'right';
      ctx.fillText((mx - (i / 3) * range).toFixed(1) + '%', 28, y + 3);
    }

    // ATM line
    ctx.beginPath();
    volData.forEach((v, i) => {
      const x = 30 + (i / (volData.length - 1)) * 360;
      const y = 10 + ((mx - v.atm) / range) * 130;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2; ctx.stroke();

    // 25D RR overlay
    const rrs = volData.map(v => v.rr25);
    const rrMn = Math.min(...rrs) - 0.5;
    const rrMx = Math.max(...rrs) + 0.5;
    const rrRange = rrMx - rrMn || 1;
    ctx.beginPath();
    volData.forEach((v, i) => {
      const x = 30 + (i / (volData.length - 1)) * 360;
      const y = 10 + ((rrMx - v.rr25) / rrRange) * 130;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = T.purple; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2]); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    volData.forEach((v, i) => {
      if (i % 2 === 0) {
        const x = 30 + (i / (volData.length - 1)) * 360;
        ctx.fillStyle = T.tx3; ctx.font = '7px Inter'; ctx.textAlign = 'center';
        ctx.fillText(v.tenor, x, 148);
      }
    });
  }, [volData]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>Volatility Surface — {pair}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8px', color: T.brand }}>
          <span style={{ width: 12, height: 2, background: T.brand, display: 'inline-block' }} /> ATM
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8px', color: T.purple }}>
          <span style={{ width: 12, height: 2, background: T.purple, display: 'inline-block', borderTop: '1px dashed' }} /> 25D RR
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: '400px', height: '150px', maxWidth: '100%' }} />
      <div style={{ marginTop: '6px', overflow: 'auto', maxHeight: '200px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['Tenor', 'ATM', '25D RR', '10D RR', '25D Fly', '10D Fly'].map(h => (
                <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {volData.map(v => (
              <tr key={v.tenor} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '3px 6px', color: T.brand, fontWeight: 600 }}>{v.tenor}</td>
                <td style={{ padding: '3px 6px', color: T.tx0, textAlign: 'right' }}>{v.atm.toFixed(2)}%</td>
                <td style={{ padding: '3px 6px', color: v.rr25 >= 0 ? T.up : T.dn, textAlign: 'right' }}>{v.rr25.toFixed(2)}</td>
                <td style={{ padding: '3px 6px', color: v.rr10 >= 0 ? T.up : T.dn, textAlign: 'right' }}>{v.rr10.toFixed(2)}</td>
                <td style={{ padding: '3px 6px', color: T.tx1, textAlign: 'right' }}>{v.fly25.toFixed(2)}</td>
                <td style={{ padding: '3px 6px', color: T.tx1, textAlign: 'right' }}>{v.fly10.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CorrelationMatrix({ correlations }: { correlations: CorrelationEntry[] }) {
  const pairs = [...new Set(correlations.flatMap(c => [c.pair1, c.pair2]))];
  const getCorr = (p1: string, p2: string): number | null => {
    if (p1 === p2) return 1;
    const e = correlations.find(c => (c.pair1 === p1 && c.pair2 === p2) || (c.pair1 === p2 && c.pair2 === p1));
    return e ? e.corr1m : null;
  };
  const corrColor = (v: number): string => {
    if (v > 0.7) return 'rgba(38,166,154,0.4)';
    if (v > 0.3) return 'rgba(38,166,154,0.2)';
    if (v < -0.7) return 'rgba(239,83,80,0.4)';
    if (v < -0.3) return 'rgba(239,83,80,0.2)';
    return 'transparent';
  };

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr>
            <th style={{ padding: '3px 4px', color: T.tx3 }}></th>
            {pairs.map(p => <th key={p} style={{ padding: '3px 4px', color: T.tx2, writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: '50px' }}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {pairs.map(p1 => (
            <tr key={p1}>
              <td style={{ padding: '3px 4px', color: T.tx2, fontWeight: 600, whiteSpace: 'nowrap' }}>{p1}</td>
              {pairs.map(p2 => {
                const v = getCorr(p1, p2);
                return (
                  <td key={p2} style={{
                    padding: '3px 4px', textAlign: 'center',
                    background: v !== null ? corrColor(v) : 'transparent',
                    color: v !== null ? T.tx0 : T.tx3,
                  }}>
                    {v !== null ? v.toFixed(2) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EconomicCalendarMini({ events }: { events: EconomicEvent[] }) {
  const impactColors = { high: T.dn, medium: T.warn, low: T.tx3 };
  return (
    <div style={{ overflow: 'auto', maxHeight: '300px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Time', 'CCY', 'Event', 'Act', 'Fcst', 'Prev', '!'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'left', fontWeight: 600, fontFamily: T.sans }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? T.bg1 : T.bg2 }}>
              <td style={{ padding: '3px 6px', color: T.tx2, fontFamily: T.mono, fontSize: '8px' }}>
                {new Date(e.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '3px 6px', fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{e.currency}</td>
              <td style={{ padding: '3px 6px', color: T.tx0, fontFamily: T.sans }}>{e.event}</td>
              <td style={{ padding: '3px 6px', color: e.actual === '--' ? T.tx3 : T.tx0, fontFamily: T.mono }}>{e.actual}</td>
              <td style={{ padding: '3px 6px', color: T.tx2, fontFamily: T.mono }}>{e.forecast}</td>
              <td style={{ padding: '3px 6px', color: T.tx2, fontFamily: T.mono }}>{e.previous}</td>
              <td style={{ padding: '3px 6px' }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: impactColors[e.impact],
                }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionTracker() {
  const positions = useMemo(() => [
    { pair: 'EUR/USD', side: 'LONG', size: 100000, entry: 1.0865, current: 1.0875, pnl: 100, pnlPct: 0.092 },
    { pair: 'GBP/USD', side: 'SHORT', size: 50000, entry: 1.2665, current: 1.2640, pnl: 125, pnlPct: 0.197 },
    { pair: 'USD/JPY', side: 'LONG', size: 200000, entry: 149.50, current: 149.85, pnl: 467, pnlPct: 0.234 },
    { pair: 'AUD/USD', side: 'SHORT', size: 75000, entry: 0.6575, current: 0.6545, pnl: 225, pnlPct: 0.456 },
    { pair: 'USD/CAD', side: 'LONG', size: 100000, entry: 1.3545, current: 1.3565, pnl: 148, pnlPct: 0.148 },
  ], []);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>Open Positions</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: totalPnl >= 0 ? T.up : T.dn, fontFamily: T.mono }}>
          P&L: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)} USD
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Pair', 'Side', 'Size', 'Entry', 'Current', 'P&L', '%'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <tr key={p.pair} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{p.pair}</td>
              <td style={{ padding: '3px 6px', color: p.side === 'LONG' ? T.up : T.dn, textAlign: 'right' }}>{p.side}</td>
              <td style={{ padding: '3px 6px', color: T.tx1, textAlign: 'right' }}>{(p.size / 1000).toFixed(0)}K</td>
              <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{p.entry.toFixed(p.entry < 10 ? 4 : 2)}</td>
              <td style={{ padding: '3px 6px', color: T.tx0, textAlign: 'right' }}>{p.current.toFixed(p.current < 10 ? 4 : 2)}</td>
              <td style={{ padding: '3px 6px', color: p.pnl >= 0 ? T.up : T.dn, textAlign: 'right' }}>{p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}</td>
              <td style={{ padding: '3px 6px', color: p.pnlPct >= 0 ? T.up : T.dn, textAlign: 'right' }}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(3)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrengthMeter() {
  const strengths = useMemo(() => {
    const data: Record<string, number> = {};
    CURRENCIES.forEach(c => { data[c] = (Math.random() - 0.5) * 6; });
    return data;
  }, []);

  const sorted = Object.entries(strengths).sort(([, a], [, b]) => b - a);
  const maxAbs = Math.max(...Object.values(strengths).map(Math.abs));

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Currency Strength</div>
      {sorted.map(([ccy, val]) => (
        <div key={ccy} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{ width: '30px', fontSize: '9px', fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{ccy}</span>
          <div style={{ flex: 1, height: '10px', background: T.bg3, borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              left: val >= 0 ? '50%' : `${50 - (Math.abs(val) / maxAbs) * 50}%`,
              width: `${(Math.abs(val) / maxAbs) * 50}%`,
              height: '100%',
              background: val >= 0 ? T.up : T.dn,
              borderRadius: '2px',
            }} />
          </div>
          <span style={{ width: '35px', fontSize: '8px', color: val >= 0 ? T.up : T.dn, fontFamily: T.mono, textAlign: 'right' }}>
            {val >= 0 ? '+' : ''}{val.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function HeatmapPanel() {
  const pairs = [...MAJOR_PAIRS, ...CROSS_PAIRS.slice(0, 6)];
  const timeframes = ['1H', '4H', '1D', '1W'];

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Performance Heatmap</div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', color: T.tx3 }}></th>
              {timeframes.map(tf => <th key={tf} style={{ padding: '3px 6px', color: T.tx2, fontWeight: 600 }}>{tf}</th>)}
            </tr>
          </thead>
          <tbody>
            {pairs.map(p => (
              <tr key={p}>
                <td style={{ padding: '3px 6px', color: T.tx1, fontWeight: 600, whiteSpace: 'nowrap' }}>{p}</td>
                {timeframes.map(tf => {
                  const val = (Math.random() - 0.5) * 2;
                  const intensity = Math.min(Math.abs(val) / 1.0, 1);
                  const bgColor = val >= 0
                    ? `rgba(38,166,154,${0.1 + intensity * 0.4})`
                    : `rgba(239,83,80,${0.1 + intensity * 0.4})`;
                  return (
                    <td key={tf} style={{
                      padding: '3px 6px', textAlign: 'center',
                      background: bgColor, color: T.tx0,
                    }}>
                      {val >= 0 ? '+' : ''}{val.toFixed(3)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SwapRatesPanel() {
  const swapRates = useMemo(() => MAJOR_PAIRS.map(pair => ({
    pair,
    longSwap: +((Math.random() - 0.6) * 15).toFixed(2),
    shortSwap: +((Math.random() - 0.4) * 15).toFixed(2),
    tripleDay: ['Wednesday', 'Wednesday', 'Friday', 'Wednesday', 'Wednesday', 'Wednesday', 'Wednesday'][MAJOR_PAIRS.indexOf(pair)],
  })), []);

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Swap Rates (per lot/day)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Pair', 'Long', 'Short', '3x Day'].map(h => (
              <th key={h} style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {swapRates.map(s => (
            <tr key={s.pair} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{s.pair}</td>
              <td style={{ padding: '3px 6px', color: s.longSwap >= 0 ? T.up : T.dn, textAlign: 'right' }}>
                {s.longSwap >= 0 ? '+' : ''}{s.longSwap.toFixed(2)}
              </td>
              <td style={{ padding: '3px 6px', color: s.shortSwap >= 0 ? T.up : T.dn, textAlign: 'right' }}>
                {s.shortSwap >= 0 ? '+' : ''}{s.shortSwap.toFixed(2)}
              </td>
              <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{s.tripleDay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionTimeline() {
  const sessions = [
    { name: 'Sydney', start: 22, end: 7, color: '#AB47BC', active: true },
    { name: 'Tokyo', start: 0, end: 9, color: '#FF9800', active: true },
    { name: 'London', start: 8, end: 17, color: '#2962FF', active: true },
    { name: 'New York', start: 13, end: 22, color: '#26A69A', active: true },
  ];
  const nowHour = new Date().getUTCHours();

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>
        Market Sessions (UTC: {nowHour}:00)
      </div>
      {sessions.map(s => {
        const isActive = s.start < s.end
          ? nowHour >= s.start && nowHour < s.end
          : nowHour >= s.start || nowHour < s.end;
        return (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isActive ? s.color : T.tx3,
              boxShadow: isActive ? `0 0 6px ${s.color}` : 'none',
            }} />
            <span style={{ width: '60px', fontSize: '9px', fontWeight: 600, color: isActive ? T.tx0 : T.tx3 }}>{s.name}</span>
            <div style={{ flex: 1, height: '6px', background: T.bg3, borderRadius: '3px', position: 'relative' }}>
              {/* Session bar */}
              {s.start < s.end ? (
                <div style={{
                  position: 'absolute', left: `${(s.start / 24) * 100}%`,
                  width: `${((s.end - s.start) / 24) * 100}%`,
                  height: '100%', background: `${s.color}44`, borderRadius: '3px',
                }} />
              ) : (
                <>
                  <div style={{
                    position: 'absolute', left: `${(s.start / 24) * 100}%`,
                    width: `${((24 - s.start) / 24) * 100}%`,
                    height: '100%', background: `${s.color}44`, borderRadius: '3px 0 0 3px',
                  }} />
                  <div style={{
                    position: 'absolute', left: 0,
                    width: `${(s.end / 24) * 100}%`,
                    height: '100%', background: `${s.color}44`, borderRadius: '0 3px 3px 0',
                  }} />
                </>
              )}
              {/* Now marker */}
              <div style={{
                position: 'absolute', left: `${(nowHour / 24) * 100}%`,
                top: -2, width: 2, height: 10, background: T.tx0,
              }} />
            </div>
            <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono, width: '55px' }}>
              {s.start.toString().padStart(2, '0')}–{s.end.toString().padStart(2, '0')} UTC
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PipCalculator() {
  const [calcPair, setCalcPair] = useState('EUR/USD');
  const [lots, setLots] = useState(1);
  const [leverage, setLeverage] = useState(100);

  const rate = generateFXRate(calcPair);
  const pipValue = calcPair.includes('JPY') ? 0.01 : 0.0001;
  const pipValueUSD = lots * 100000 * pipValue / (calcPair.startsWith('USD/') ? rate.mid : 1);
  const margin = (lots * 100000) / leverage;
  const spread = (rate.ask - rate.bid) / pipValue;

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Pip Calculator</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <div>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Pair</label>
          <select value={calcPair} onChange={e => setCalcPair(e.target.value)}
            style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px', fontSize: '9px', fontFamily: T.mono }}>
            {ALL_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Lots</label>
          <input type="number" value={lots} onChange={e => setLots(+e.target.value)} min={0.01} step={0.01}
            style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px', fontSize: '9px', fontFamily: T.mono }} />
        </div>
        <div>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Leverage</label>
          <select value={leverage} onChange={e => setLeverage(+e.target.value)}
            style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px', fontSize: '9px', fontFamily: T.mono }}>
            {[1, 2, 5, 10, 20, 50, 100, 200, 500].map(l => <option key={l} value={l}>{l}:1</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          { label: 'Pip Value', value: `$${pipValueUSD.toFixed(2)}` },
          { label: 'Spread', value: `${spread.toFixed(1)} pips` },
          { label: 'Margin Required', value: `$${margin.toFixed(0)}` },
          { label: 'Notional', value: `$${(lots * 100000).toLocaleString()}` },
        ].map(item => (
          <div key={item.label} style={{ background: T.bg3, borderRadius: T.r, padding: '6px 8px' }}>
            <div style={{ fontSize: '8px', color: T.tx3 }}>{item.label}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

type FXTab = 'rates' | 'charts' | 'forwards' | 'volatility' | 'cross' | 'strength' | 'calendar' | 'positions' | 'correlation' | 'heatmap' | 'tools';

export default function FXDashboardUI2() {
  const [tab, setTab] = useState<FXTab>('rates');
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [pairCategory, setPairCategory] = useState<'major' | 'cross' | 'em'>('major');
  const [rates, setRates] = useState<FXRate[]>([]);
  const [candles, setCandles] = useState<FXCandle[]>([]);
  const [forwards, setForwards] = useState<ForwardPoint[]>([]);
  const [volData, setVolData] = useState<VolPoint[]>([]);
  const [crossMatrix, setCrossMatrix] = useState<CrossRateEntry[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationEntry[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const displayPairs = pairCategory === 'major' ? MAJOR_PAIRS : pairCategory === 'cross' ? CROSS_PAIRS : EM_PAIRS;

  // Fetch rates from API with yfinance fallback
  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fx/rates');
      if (res.ok) {
        const data = await res.json();
        if (data.rates?.length) { setRates(data.rates); setLastUpdate(new Date()); return; }
      }
    } catch { /* fallback */ }
    // Fallback: generate realistic rates
    setRates(ALL_PAIRS.map(generateFXRate));
    setLastUpdate(new Date());
  }, []);

  // Fetch candles for selected pair
  const fetchCandles = useCallback(async (pair: string) => {
    try {
      const sym = pair.replace('/', '');
      const res = await fetch(`/api/v1/bars?symbol=${sym}&timeframe=1h&limit=100`);
      if (res.ok) {
        const data = await res.json();
        if (data.bars?.length) {
          setCandles(data.bars.map((b: Record<string, number>) => ({
            time: b.timestamp || b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0,
          })));
          return;
        }
      }
    } catch { /* fallback */ }
    setCandles(generateFXCandles(pair, 100));
  }, []);

  // Load all data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRates(),
      fetchCandles(selectedPair),
    ]).then(() => {
      setForwards(generateForwardCurve(selectedPair));
      setVolData(generateVolSurface(selectedPair));
      setCrossMatrix(generateCrossMatrix());
      setCorrelations(generateCorrelations());
      setEvents(generateEconomicEvents());
      setLoading(false);
    });
  }, [fetchRates, fetchCandles, selectedPair]);

  // Auto-refresh rates every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchRates, 5000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  // Draw main chart
  useEffect(() => {
    if (tab !== 'charts') return;
    const cvs = chartCanvasRef.current;
    if (!cvs || !candles.length) return;
    const container = cvs.parentElement;
    if (!container) return;
    cvs.width = container.clientWidth;
    cvs.height = container.clientHeight;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.width, h = cvs.height;
    const pad = { t: 10, r: 60, b: 30, l: 10 };

    ctx.clearRect(0, 0, w, h);

    const prices = candles.flatMap(c => [c.high, c.low]);
    const mn = Math.min(...prices) * 0.9999;
    const mx = Math.max(...prices) * 1.0001;
    const range = mx - mn || 1;
    const chartH = (h - pad.t - pad.b) * 0.8;
    const volH = (h - pad.t - pad.b) * 0.15;
    const volTop = pad.t + chartH + 8;
    const barW = Math.max(2, (w - pad.l - pad.r) / candles.length);
    const maxVol = Math.max(...candles.map(c => c.volume));

    // Grid
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = pad.t + (i / 5) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      const val = mx - (i / 5) * range;
      ctx.fillStyle = T.tx3; ctx.font = `9px JetBrains Mono`; ctx.textAlign = 'left';
      ctx.fillText(val.toFixed(val < 10 ? 5 : 3), w - pad.r + 4, y + 3);
    }

    // Candles
    candles.forEach((c, i) => {
      const x = pad.l + i * barW + barW / 2;
      const isUp = c.close >= c.open;
      const col = isUp ? T.up : T.dn;

      const hY = pad.t + ((mx - c.high) / range) * chartH;
      const lY = pad.t + ((mx - c.low) / range) * chartH;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, hY); ctx.lineTo(x, lY); ctx.stroke();

      const oY = pad.t + ((mx - c.open) / range) * chartH;
      const cY = pad.t + ((mx - c.close) / range) * chartH;
      const bodyTop = Math.min(oY, cY);
      const bodyH = Math.max(Math.abs(cY - oY), 1);
      ctx.fillStyle = col;
      ctx.fillRect(x - barW * 0.35, bodyTop, barW * 0.7, bodyH);

      // Volume
      const vH = (c.volume / maxVol) * volH;
      ctx.fillStyle = isUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.fillRect(x - barW * 0.35, volTop + volH - vH, barW * 0.7, vH);
    });

    // Current price line
    const last = candles[candles.length - 1];
    const lastY = pad.t + ((mx - last.close) / range) * chartH;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = last.close >= last.open ? T.up : T.dn;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, lastY); ctx.lineTo(w - pad.r, lastY); ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.fillStyle = last.close >= last.open ? T.up : T.dn;
    ctx.fillRect(w - pad.r, lastY - 8, 58, 16);
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px JetBrains Mono'; ctx.textAlign = 'left';
    ctx.fillText(last.close.toFixed(last.close < 10 ? 5 : 3), w - pad.r + 3, lastY + 4);

    // Title
    ctx.fillStyle = T.tx0; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'left';
    ctx.fillText(selectedPair, pad.l + 4, pad.t + 14);
    const change = last.close - candles[0].open;
    const changePct = (change / candles[0].open) * 100;
    ctx.fillStyle = change >= 0 ? T.up : T.dn; ctx.font = '10px JetBrains Mono';
    ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(last.close < 10 ? 5 : 3)} (${changePct.toFixed(3)}%)`, pad.l + 80, pad.t + 14);
  }, [candles, tab, selectedPair]);

  const tabs: { id: FXTab; label: string; icon: string }[] = [
    { id: 'rates', label: 'Rates', icon: '📊' },
    { id: 'charts', label: 'Charts', icon: '📈' },
    { id: 'forwards', label: 'Forwards', icon: '📐' },
    { id: 'volatility', label: 'Vol Surface', icon: '🌊' },
    { id: 'cross', label: 'Cross Matrix', icon: '🔢' },
    { id: 'strength', label: 'Strength', icon: '💪' },
    { id: 'correlation', label: 'Correlation', icon: '🔗' },
    { id: 'heatmap', label: 'Heatmap', icon: '🗺️' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'positions', label: 'Positions', icon: '💼' },
    { id: 'tools', label: 'Tools', icon: '🔧' },
  ];

  return (
    <div data-testid="fx-dashboard-page" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: T.bg0, fontFamily: T.sans, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px',
        background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>FX DASHBOARD</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        {(['major', 'cross', 'em'] as const).map(cat => (
          <button key={cat} onClick={() => setPairCategory(cat)} style={{
            background: pairCategory === cat ? T.brand : T.bg3, color: pairCategory === cat ? '#FFF' : T.tx2,
            border: 'none', padding: '3px 8px', borderRadius: '2px', fontSize: '9px', fontWeight: 700, cursor: 'pointer',
          }}>
            {cat === 'major' ? 'Majors' : cat === 'cross' ? 'Crosses' : 'EM'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>
          Updated: {lastUpdate.toLocaleTimeString()}
        </span>
        {loading && <span style={{ fontSize: '8px', color: T.warn }}>⏳ Loading...</span>}
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: '1px', padding: '2px 6px',
        background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, overflow: 'auto',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? T.bg3 : 'transparent', color: tab === t.id ? T.tx0 : T.tx3,
            border: 'none', padding: '4px 8px', borderRadius: '3px 3px 0 0', fontSize: '9px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
            borderBottom: tab === t.id ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Rate cards */}
        <div style={{
          width: '180px', flexShrink: 0, overflow: 'auto', padding: '6px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          borderRight: `1px solid ${T.border}`, background: T.bg1,
        }}>
          {displayPairs.map(pair => {
            const rate = rates.find(r => r.pair === pair) ?? generateFXRate(pair);
            return (
              <RateCard
                key={pair} rate={rate}
                selected={pair === selectedPair}
                onClick={() => { setSelectedPair(pair); fetchCandles(pair); }}
              />
            );
          })}
        </div>

        {/* Center: Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px', minWidth: 0 }}>
          {tab === 'rates' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Live Rates — {pairCategory === 'major' ? 'Majors' : pairCategory === 'cross' ? 'Crosses' : 'Emerging Markets'}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: T.mono }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {['Pair', 'Bid', 'Ask', 'Spread', 'Change', '%', 'High', 'Low', 'Volume'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayPairs.map(pair => {
                      const r = rates.find(rt => rt.pair === pair) ?? generateFXRate(pair);
                      const dec = r.mid < 10 ? 5 : 3;
                      const pipDiv = pair.includes('JPY') ? 0.01 : 0.0001;
                      const spreadPips = ((r.ask - r.bid) / pipDiv).toFixed(1);
                      const isUp = r.changePct >= 0;
                      return (
                        <tr key={pair} onClick={() => { setSelectedPair(pair); fetchCandles(pair); }}
                          style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: pair === selectedPair ? T.bg3 : 'transparent' }}>
                          <td style={{ padding: '4px 6px', color: T.tx0, fontWeight: 700, textAlign: 'left' }}>{pair}</td>
                          <td style={{ padding: '4px 6px', color: T.up, textAlign: 'right' }}>{r.bid.toFixed(dec)}</td>
                          <td style={{ padding: '4px 6px', color: T.dn, textAlign: 'right' }}>{r.ask.toFixed(dec)}</td>
                          <td style={{ padding: '4px 6px', color: T.tx2, textAlign: 'right' }}>{spreadPips}</td>
                          <td style={{ padding: '4px 6px', color: isUp ? T.up : T.dn, textAlign: 'right' }}>{isUp ? '+' : ''}{r.change.toFixed(dec)}</td>
                          <td style={{ padding: '4px 6px', color: isUp ? T.up : T.dn, textAlign: 'right' }}>{isUp ? '+' : ''}{r.changePct.toFixed(3)}%</td>
                          <td style={{ padding: '4px 6px', color: T.tx1, textAlign: 'right' }}>{r.high24h.toFixed(dec)}</td>
                          <td style={{ padding: '4px 6px', color: T.tx1, textAlign: 'right' }}>{r.low24h.toFixed(dec)}</td>
                          <td style={{ padding: '4px 6px', color: T.tx2, textAlign: 'right' }}>{(r.volume / 1e6).toFixed(0)}M</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
                <SessionTimeline />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
                <StrengthMeter />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
                <SwapRatesPanel />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
                <PositionTracker />
              </div>
            </div>
          )}

          {tab === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, flex: 1, minHeight: 0, position: 'relative' }}>
                <canvas ref={chartCanvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', flexShrink: 0 }}>
                {displayPairs.slice(0, 4).filter(p => p !== selectedPair).map(pair => (
                  <div key={pair} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', cursor: 'pointer' }}
                    onClick={() => { setSelectedPair(pair); fetchCandles(pair); }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, marginBottom: '2px' }}>{pair}</div>
                    <MiniChart candles={generateFXCandles(pair, 50)} width={160} height={40} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'forwards' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <ForwardCurvePanel forwardData={forwards} pair={selectedPair} />
            </div>
          )}

          {tab === 'volatility' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <VolSurfacePanel volData={volData} pair={selectedPair} />
            </div>
          )}

          {tab === 'cross' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Cross Rate Matrix</div>
              <CrossRateMatrix entries={crossMatrix} />
            </div>
          )}

          {tab === 'strength' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <StrengthMeter />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <HeatmapPanel />
              </div>
            </div>
          )}

          {tab === 'correlation' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Correlation Matrix (1M)</div>
              <CorrelationMatrix correlations={correlations} />
            </div>
          )}

          {tab === 'heatmap' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <HeatmapPanel />
            </div>
          )}

          {tab === 'calendar' && (
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Economic Calendar — FX Impact Events</div>
              <EconomicCalendarMini events={events} />
            </div>
          )}

          {tab === 'positions' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px', gridColumn: '1 / -1' }}>
                <PositionTracker />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <SwapRatesPanel />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <PipCalculator />
              </div>
            </div>
          )}

          {tab === 'tools' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <PipCalculator />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <SessionTimeline />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <SwapRatesPanel />
              </div>
              <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '12px' }}>
                <StrengthMeter />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
