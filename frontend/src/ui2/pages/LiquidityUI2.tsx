/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Liquidity Analytics (UI2)                         │
 * │  Real-time liquidity monitoring with depth analysis, spread         │
 * │  tracking, venue comparison, and liquidity scoring                  │
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
interface LiquidityProfile {
  symbol: string; avgSpread: number; depth5: number; depth10: number;
  dailyVolume: number; turnover: number; impactCost: number;
  resiliency: number; toxicity: number; score: number;
  spreadHistory: number[]; depthHistory: number[];
}

interface VenueStats {
  venue: string; volume: number; share: number; avgSpread: number;
  fillRate: number; latencyMs: number; rebate: number; toxicity: number;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateProfiles(): LiquidityProfile[] {
  const syms = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','JPM','XOM','JNJ','V','WMT','PG','MA','UNH','HD'];
  return syms.map(s => ({
    symbol: s,
    avgSpread: +(0.01 + Math.random() * 0.08).toFixed(3),
    depth5: Math.floor(50000 + Math.random() * 500000),
    depth10: Math.floor(100000 + Math.random() * 1000000),
    dailyVolume: Math.floor(5e6 + Math.random() * 100e6),
    turnover: +(0.5 + Math.random() * 3).toFixed(2),
    impactCost: +(0.5 + Math.random() * 5).toFixed(2),
    resiliency: +(0.3 + Math.random() * 0.6).toFixed(2),
    toxicity: +(0.1 + Math.random() * 0.5).toFixed(2),
    score: +(40 + Math.random() * 55).toFixed(0),
    spreadHistory: Array.from({ length: 60 }, () => 0.01 + Math.random() * 0.06),
    depthHistory: Array.from({ length: 60 }, () => 50000 + Math.random() * 400000),
  })).sort((a, b) => +b.score - +a.score);
}

function generateVenues(): VenueStats[] {
  return [
    { venue: 'NYSE', volume: 12500000, share: 25.3, avgSpread: 0.012, fillRate: 98.2, latencyMs: 0.45, rebate: 0.0025, toxicity: 0.15 },
    { venue: 'NASDAQ', volume: 15200000, share: 30.8, avgSpread: 0.011, fillRate: 97.8, latencyMs: 0.38, rebate: 0.0030, toxicity: 0.18 },
    { venue: 'BATS', volume: 8300000, share: 16.8, avgSpread: 0.014, fillRate: 96.5, latencyMs: 0.32, rebate: 0.0028, toxicity: 0.22 },
    { venue: 'IEX', volume: 3100000, share: 6.3, avgSpread: 0.015, fillRate: 99.1, latencyMs: 0.85, rebate: 0.0009, toxicity: 0.08 },
    { venue: 'ARCA', volume: 5400000, share: 10.9, avgSpread: 0.013, fillRate: 97.2, latencyMs: 0.42, rebate: 0.0026, toxicity: 0.19 },
    { venue: 'EDGX', volume: 3200000, share: 6.5, avgSpread: 0.016, fillRate: 95.8, latencyMs: 0.35, rebate: 0.0032, toxicity: 0.25 },
    { venue: 'Dark Pool A', volume: 900000, share: 1.8, avgSpread: 0.005, fillRate: 42.3, latencyMs: 1.20, rebate: 0.0000, toxicity: 0.05 },
    { venue: 'Dark Pool B', volume: 760000, share: 1.5, avgSpread: 0.004, fillRate: 38.7, latencyMs: 1.50, rebate: 0.0000, toxicity: 0.04 },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function DepthChart({ bids, asks }: { bids: number[]; asks: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 180;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);

    const mid = W / 2;
    const maxBid = Math.max(...bids); const maxAsk = Math.max(...asks);
    const maxVal = Math.max(maxBid, maxAsk) || 1;

    // Cumulative bids (left side)
    let cumBid = 0;
    const cumBids = bids.map(b => { cumBid += b; return cumBid; });
    ctx.fillStyle = `${T.up}30`; ctx.strokeStyle = T.up; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mid, H);
    cumBids.forEach((cb, i) => {
      const x = mid - (i / (bids.length-1)) * mid;
      const y = H - (cb / cumBid) * (H - 20);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mid, H);
    cumBids.forEach((cb, i) => {
      const x = mid - (i / (bids.length-1)) * mid;
      const y = H - (cb / cumBid) * (H - 20);
      ctx.lineTo(x, y);
    }); ctx.stroke();

    // Cumulative asks (right side)
    let cumAsk = 0;
    const cumAsks = asks.map(a => { cumAsk += a; return cumAsk; });
    ctx.fillStyle = `${T.dn}30`; ctx.strokeStyle = T.dn;
    ctx.beginPath(); ctx.moveTo(mid, H);
    cumAsks.forEach((ca, i) => {
      const x = mid + (i / (asks.length-1)) * mid;
      const y = H - (ca / cumAsk) * (H - 20);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mid, H);
    cumAsks.forEach((ca, i) => {
      const x = mid + (i / (asks.length-1)) * mid;
      const y = H - (ca / cumAsk) * (H - 20);
      ctx.lineTo(x, y);
    }); ctx.stroke();

    // Mid line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 0.5; ctx.setLineDash([3,2]);
    ctx.beginPath(); ctx.moveTo(mid, 0); ctx.lineTo(mid, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.tx2; ctx.font = `7px ${T.mono}`;
    ctx.textAlign = 'center'; ctx.fillText('MID', mid, 10);
    ctx.fillStyle = T.up; ctx.fillText('BIDS', mid / 2, 10);
    ctx.fillStyle = T.dn; ctx.fillText('ASKS', mid + mid / 2, 10);
  }, [bids, asks]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: T.r }} />;
}

function SpreadTimeline({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 100;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
    ctx.strokeStyle = T.warn; ctx.lineWidth = 1;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - ((d - mn) / rng) * (H - 10) - 5;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Mean line
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const my = H - ((mean - mn) / rng) * (H - 10) - 5;
    ctx.strokeStyle = `${T.brand}80`; ctx.lineWidth = 0.5; ctx.setLineDash([4,2]);
    ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.tx3; ctx.font = `6px ${T.mono}`;
    ctx.fillText(`AVG: ${mean.toFixed(3)}`, 5, my - 3);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 100, borderRadius: T.r }} />;
}

function VenueShareChart({ venues }: { venues: VenueStats[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = [T.brand, T.up, T.dn, T.warn, T.purple, T.info, '#FF6B6B', '#4ECDC4'];
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 300, H = 160;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const total = venues.reduce((s, v) => s + v.volume, 0);
    let angle = -Math.PI / 2;
    const cx = W / 2, cy = H / 2, r = 55;
    venues.forEach((v, i) => {
      const slice = (v.volume / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath(); ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      const mid = angle + slice / 2;
      if (slice > 0.15) {
        const tx = cx + Math.cos(mid) * (r + 15);
        const ty = cy + Math.sin(mid) * (r + 15);
        ctx.fillStyle = T.tx2; ctx.font = `6px ${T.mono}`;
        ctx.textAlign = 'center'; ctx.fillText(`${v.venue}`, tx, ty);
        ctx.fillText(`${v.share.toFixed(1)}%`, tx, ty + 8);
      }
      angle += slice;
    });
    // Donut hole
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = T.bg2; ctx.fill();
    ctx.fillStyle = T.tx0; ctx.font = `bold 9px ${T.sans}`; ctx.textAlign = 'center';
    ctx.fillText('VENUES', cx, cy + 3);
  }, [venues]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: T.r }} />;
}

/* ── Score Bar ────────────────────────────────────────────────────────── */
function ScoreBar({ score }: { score: number }) {
  const color = +score > 75 ? T.up : +score > 50 ? T.warn : T.dn;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '40px', height: 4, background: T.bg3, borderRadius: 2 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '8px', fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type LTab = 'overview' | 'depth' | 'venues' | 'spread';

export default function LiquidityUI2() {
  const [tab, setTab] = useState<LTab>('overview');
  const [sel, setSel] = useState(0);
  const profiles = useMemo(() => generateProfiles(), []);
  const venues = useMemo(() => generateVenues(), []);
  const mockBids = useMemo(() => Array.from({ length: 20 }, () => Math.floor(5000 + Math.random() * 50000)), []);
  const mockAsks = useMemo(() => Array.from({ length: 20 }, () => Math.floor(5000 + Math.random() * 50000)), []);

  return (
    <div data-testid="liquidity-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>LIQUIDITY ANALYTICS</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Instruments: <span style={{ color: T.tx0 }}>{profiles.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Venues: <span style={{ color: T.brand }}>{venues.length}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'overview' as LTab, label: '📊 Overview' },
          { key: 'depth' as LTab, label: '📈 Depth' },
          { key: 'venues' as LTab, label: '🏛️ Venues' },
          { key: 'spread' as LTab, label: '〰️ Spread' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'overview' && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead><tr style={{ background: T.bg2 }}>
                {['#','Symbol','Score','Avg Spread','Depth@5','Depth@10','Volume','Impact','Resiliency','Toxicity'].map(h => (
                  <th key={h} style={{ padding: '6px 4px', textAlign: h === 'Symbol' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {profiles.map((p, i) => (
                  <tr key={p.symbol} onClick={() => setSel(i)} style={{ background: sel === i ? `${T.brand}18` : 'transparent', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <td style={{ padding: '4px', textAlign: 'right', color: T.tx3 }}>{i+1}</td>
                    <td style={{ padding: '4px', fontWeight: 700, color: T.tx0 }}>{p.symbol}</td>
                    <td style={{ padding: '4px', textAlign: 'right' }}><ScoreBar score={+p.score} /></td>
                    <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>${p.avgSpread.toFixed(3)}</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{(p.depth5/1000).toFixed(0)}K</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{(p.depth10/1000).toFixed(0)}K</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{(p.dailyVolume/1e6).toFixed(1)}M</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: +p.impactCost < 2 ? T.up : T.warn }}>{p.impactCost}bp</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: +p.resiliency > 0.6 ? T.up : T.tx1 }}>{p.resiliency}</td>
                    <td style={{ padding: '4px', textAlign: 'right', color: +p.toxicity > 0.35 ? T.dn : T.tx1 }}>{p.toxicity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'depth' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {profiles.slice(0, 8).map((p, i) => (
                <button key={p.symbol} onClick={() => setSel(i)} style={{
                  background: sel === i ? T.brand : T.bg2, color: sel === i ? '#FFF' : T.tx2,
                  border: `1px solid ${sel === i ? T.brand : T.border}`, borderRadius: T.r,
                  padding: '3px 8px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
                }}>{p.symbol}</button>
              ))}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>{profiles[sel].symbol} — Order Book Depth</div>
            <DepthChart bids={mockBids} asks={mockAsks} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
              {[
                { label: 'Bid Depth @5', value: `$${(profiles[sel].depth5 / 1000).toFixed(0)}K`, color: T.up },
                { label: 'Ask Depth @5', value: `$${(profiles[sel].depth5 * 1.1 / 1000).toFixed(0)}K`, color: T.dn },
                { label: 'Bid Depth @10', value: `$${(profiles[sel].depth10 / 1000).toFixed(0)}K`, color: T.up },
                { label: 'Ask Depth @10', value: `$${(profiles[sel].depth10 * 1.05 / 1000).toFixed(0)}K`, color: T.dn },
              ].map(m => (
                <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: T.tx3 }}>{m.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: m.color, fontFamily: T.mono }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'venues' && (
          <div>
            <VenueShareChart venues={venues} />
            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden', marginTop: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead><tr style={{ background: T.bg2 }}>
                  {['Venue','Volume','Share','Avg Spread','Fill Rate','Latency','Rebate','Toxicity'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', textAlign: h === 'Venue' ? 'left' : 'right', color: T.tx3, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {venues.map(v => (
                    <tr key={v.venue} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '4px', fontWeight: 700, color: T.tx0 }}>{v.venue}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>{(v.volume / 1e6).toFixed(1)}M</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.brand, fontWeight: 700 }}>{v.share}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>${v.avgSpread.toFixed(3)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: v.fillRate > 95 ? T.up : T.warn }}>{v.fillRate}%</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: v.latencyMs < 0.5 ? T.up : T.tx1 }}>{v.latencyMs}ms</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: T.tx1 }}>${v.rebate.toFixed(4)}</td>
                      <td style={{ padding: '4px', textAlign: 'right', color: v.toxicity > 0.2 ? T.dn : T.up }}>{v.toxicity.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'spread' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {profiles.slice(0, 8).map((p, i) => (
                <button key={p.symbol} onClick={() => setSel(i)} style={{
                  background: sel === i ? T.brand : T.bg2, color: sel === i ? '#FFF' : T.tx2,
                  border: `1px solid ${sel === i ? T.brand : T.border}`, borderRadius: T.r,
                  padding: '3px 8px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
                }}>{p.symbol}</button>
              ))}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>{profiles[sel].symbol} — Spread History (60min)</div>
            <SpreadTimeline data={profiles[sel].spreadHistory} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
              {[
                { label: 'Current Spread', value: `$${profiles[sel].avgSpread.toFixed(3)}` },
                { label: 'Spread Volatility', value: `${(profiles[sel].avgSpread * 0.3).toFixed(4)}` },
                { label: 'Spread / Price', value: `${(profiles[sel].avgSpread * 0.01).toFixed(4)}%` },
              ].map(m => (
                <div key={m.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: T.tx3 }}>{m.label}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { LiquidityUI2 };
