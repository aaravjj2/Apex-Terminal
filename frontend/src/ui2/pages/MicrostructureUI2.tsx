/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Market Microstructure Analytics (UI2)               │
 * │  Order flow analysis, market depth imbalance, tick data,             │
 * │  trade classification, liquidity fragmentation, venue analytics      │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC', cyan: '#00BCD4',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface OrderFlowBar {
  time: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumDelta: number;
  price: number;
  vwap: number;
  trades: number;
  avgSize: number;
}

interface DepthImbalance {
  price: number;
  bidVolume: number;
  askVolume: number;
  imbalance: number;
  level: number;
}

interface VenueStats {
  venue: string;
  marketShare: number;
  avgSpread: number;
  fillRate: number;
  avgLatency: number;
  toxicity: number;
  informedPct: number;
  darkPct: number;
}

interface TickData {
  time: number;
  price: number;
  size: number;
  aggressor: 'buy' | 'sell';
  venue: string;
  condition: string;
}

interface LiquidityMetric {
  label: string;
  value: string;
  change: number;
  description: string;
}

/* ── Mock Generators ─────────────────────────────────────────────────── */
function generateOrderFlow(bars: number): OrderFlowBar[] {
  const data: OrderFlowBar[] = [];
  let cumDelta = 0;
  let price = 185.00;
  for (let i = 0; i < bars; i++) {
    const buyVol = Math.round(10000 + Math.random() * 50000);
    const sellVol = Math.round(10000 + Math.random() * 50000);
    const delta = buyVol - sellVol;
    cumDelta += delta;
    price += (delta / 50000) * 0.5;
    data.push({
      time: Date.now() - (bars - i) * 60000,
      buyVolume: buyVol,
      sellVolume: sellVol,
      delta,
      cumDelta,
      price: +price.toFixed(2),
      vwap: +(price + (Math.random() - 0.5) * 0.1).toFixed(2),
      trades: Math.round(50 + Math.random() * 300),
      avgSize: Math.round(50 + Math.random() * 200),
    });
  }
  return data;
}

function generateDepthImbalance(): DepthImbalance[] {
  const data: DepthImbalance[] = [];
  for (let i = 0; i < 20; i++) {
    const bid = Math.round(1000 + Math.random() * 10000);
    const ask = Math.round(1000 + Math.random() * 10000);
    data.push({
      price: +(185.00 + (i - 10) * 0.01).toFixed(2),
      bidVolume: bid,
      askVolume: ask,
      imbalance: +((bid - ask) / (bid + ask)).toFixed(3),
      level: i - 10,
    });
  }
  return data;
}

function generateVenueStats(): VenueStats[] {
  return [
    { venue: 'NYSE', marketShare: 22.5, avgSpread: 0.8, fillRate: 95.2, avgLatency: 0.12, toxicity: 15.2, informedPct: 28, darkPct: 0 },
    { venue: 'NASDAQ', marketShare: 18.3, avgSpread: 0.9, fillRate: 93.8, avgLatency: 0.08, toxicity: 18.5, informedPct: 32, darkPct: 0 },
    { venue: 'ARCA', marketShare: 12.1, avgSpread: 1.1, fillRate: 88.5, avgLatency: 0.15, toxicity: 12.8, informedPct: 22, darkPct: 0 },
    { venue: 'BATS', marketShare: 10.5, avgSpread: 0.7, fillRate: 91.2, avgLatency: 0.06, toxicity: 20.1, informedPct: 35, darkPct: 0 },
    { venue: 'IEX', marketShare: 3.8, avgSpread: 0.5, fillRate: 82.1, avgLatency: 0.35, toxicity: 8.5, informedPct: 12, darkPct: 0 },
    { venue: 'EDGX', marketShare: 8.2, avgSpread: 0.9, fillRate: 89.5, avgLatency: 0.09, toxicity: 16.8, informedPct: 30, darkPct: 0 },
    { venue: 'FINRA ADF', marketShare: 15.8, avgSpread: 0, fillRate: 100, avgLatency: 0, toxicity: 22.5, informedPct: 38, darkPct: 100 },
    { venue: 'MEMX', marketShare: 5.2, avgSpread: 0.6, fillRate: 86.8, avgLatency: 0.05, toxicity: 14.2, informedPct: 25, darkPct: 0 },
    { venue: 'MIAX PEARL', marketShare: 3.6, avgSpread: 1.2, fillRate: 84.5, avgLatency: 0.18, toxicity: 11.5, informedPct: 18, darkPct: 0 },
  ];
}

function generateTickData(count: number): TickData[] {
  const venues = ['NYSE', 'NASDAQ', 'ARCA', 'BATS', 'IEX', 'EDGX'];
  const conditions = ['@', 'F', 'T', 'I', 'W', 'Z'];
  let price = 185.00;
  return Array.from({ length: count }, (_, i) => {
    const agg: 'buy' | 'sell' = Math.random() > 0.48 ? 'buy' : 'sell';
    price += (agg === 'buy' ? 0.01 : -0.01) * (Math.random() > 0.5 ? 1 : 0);
    return {
      time: Date.now() - (count - i) * (200 + Math.random() * 1000),
      price: +price.toFixed(2),
      size: Math.round(10 + Math.random() * 500),
      aggressor: agg,
      venue: venues[Math.floor(Math.random() * venues.length)],
      condition: conditions[Math.floor(Math.random() * conditions.length)],
    };
  });
}

function getLiquidityMetrics(): LiquidityMetric[] {
  return [
    { label: 'Effective Spread', value: '0.82¢', change: -3.2, description: 'Cost to cross the spread' },
    { label: 'Quoted Spread', value: '1.05¢', change: 1.5, description: 'NBBO bid-ask spread' },
    { label: 'Realized Spread', value: '0.45¢', change: -8.5, description: 'Midpoint reversion profit' },
    { label: 'Price Impact', value: '0.37¢', change: 5.2, description: 'Permanent price change per trade' },
    { label: 'Kyle Lambda', value: '0.012', change: 2.1, description: 'Price impact per unit volume' },
    { label: 'Amihud Illiq', value: '0.0045', change: -1.8, description: 'Return per dollar volume' },
    { label: 'Roll Spread', value: '0.68¢', change: -4.5, description: 'Implied spread from autocovariance' },
    { label: 'Depth @ BBO', value: '2,450', change: 8.2, description: 'Shares at best bid/offer' },
    { label: 'Depth @ 5lvl', value: '18,200', change: 3.5, description: 'Shares across top 5 levels' },
    { label: 'Fill Rate', value: '92.1%', change: 1.2, description: 'Limit order execution rate' },
    { label: 'VPIN', value: '0.38', change: 12.5, description: 'Volume-synchronized PIN' },
    { label: 'Trade-to-Order', value: '0.15', change: -2.8, description: 'Ratio of trades to orders' },
  ];
}

/* ── Canvas Components ───────────────────────────────────────────────── */
function OrderFlowCanvas({ data }: { data: OrderFlowBar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 600, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const maxVol = Math.max(...data.map(d => Math.max(d.buyVolume, d.sellVolume)));
    const barW = W / data.length;
    const midY = H / 2;

    data.forEach((d, i) => {
      const x = i * barW;
      const buyH = (d.buyVolume / maxVol) * (H / 2 - 10);
      const sellH = (d.sellVolume / maxVol) * (H / 2 - 10);
      // Buy bars (up)
      ctx.fillStyle = `${T.up}80`;
      ctx.fillRect(x + 1, midY - buyH, barW - 2, buyH);
      // Sell bars (down)
      ctx.fillStyle = `${T.dn}80`;
      ctx.fillRect(x + 1, midY, barW - 2, sellH);
    });

    // Zero line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();

    // Labels
    ctx.fillStyle = T.tx3; ctx.font = '8px sans-serif';
    ctx.fillText('Buy Volume ▲', 4, 12);
    ctx.fillText('Sell Volume ▼', 4, H - 4);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: T.r }} />;
}

function CumDeltaCanvas({ data }: { data: OrderFlowBar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 600, H = 120;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const mn = Math.min(...data.map(d => d.cumDelta));
    const mx = Math.max(...data.map(d => d.cumDelta));
    const rng = mx - mn || 1;

    // Area
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d.cumDelta - mn) / rng) * (H - 20) - 10;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const last = data[data.length - 1];
    const color = last && last.cumDelta >= 0 ? T.up : T.dn;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d.cumDelta - mn) / rng) * (H - 20) - 10;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Label
    ctx.fillStyle = T.tx3; ctx.font = '8px sans-serif';
    ctx.fillText('Cumulative Delta', 4, 12);
    ctx.fillStyle = color; ctx.font = 'bold 10px monospace';
    ctx.fillText(`${last && last.cumDelta >= 0 ? '+' : ''}${last?.cumDelta.toLocaleString()}`, W - 80, 14);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 120, borderRadius: T.r }} />;
}

function DepthImbalanceCanvas({ data }: { data: DepthImbalance[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 300, H = 300;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const maxVol = Math.max(...data.map(d => Math.max(d.bidVolume, d.askVolume)));
    const rowH = H / data.length;

    data.forEach((d, i) => {
      const y = i * rowH;
      const midX = W / 2;
      const bidW = (d.bidVolume / maxVol) * (W / 2 - 10);
      const askW = (d.askVolume / maxVol) * (W / 2 - 10);

      // Bid bar (left)
      ctx.fillStyle = `${T.up}50`;
      ctx.fillRect(midX - bidW, y + 1, bidW, rowH - 2);
      // Ask bar (right)
      ctx.fillStyle = `${T.dn}50`;
      ctx.fillRect(midX, y + 1, askW, rowH - 2);

      // Price label
      ctx.fillStyle = d.level === 0 ? T.brand : T.tx3;
      ctx.font = `${d.level === 0 ? 'bold' : ''} 7px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(d.price.toFixed(2), midX, y + rowH / 2 + 3);

      // Imbalance indicator
      if (Math.abs(d.imbalance) > 0.3) {
        ctx.fillStyle = d.imbalance > 0 ? T.up : T.dn;
        ctx.fillText(d.imbalance > 0 ? '▶' : '◀', d.imbalance > 0 ? W - 15 : 15, y + rowH / 2 + 3);
      }
    });

    // Center line
    ctx.strokeStyle = T.tx3; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  }, [data]);
  return <canvas ref={ref} style={{ width: 300, height: 300, borderRadius: T.r }} />;
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function VenueTable({ venues }: { venues: VenueStats[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
          {['Venue', 'Mkt Share', 'Spread', 'Fill%', 'Latency', 'Toxicity', 'Informed', 'Dark%'].map(h => (
            <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {venues.map(v => (
          <tr key={v.venue} style={{ borderBottom: `1px solid ${T.border}` }}>
            <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{v.venue}</td>
            <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                <div style={{ width: '40px', height: '4px', background: T.bg3, borderRadius: '2px' }}>
                  <div style={{ width: `${(v.marketShare / 25) * 100}%`, height: '100%', background: T.brand, borderRadius: '2px' }} />
                </div>
                <span>{v.marketShare}%</span>
              </div>
            </td>
            <td style={{ padding: '3px 4px', color: v.avgSpread < 0.8 ? T.up : T.tx1, textAlign: 'right' }}>{v.avgSpread}¢</td>
            <td style={{ padding: '3px 4px', color: v.fillRate > 90 ? T.up : T.warn, textAlign: 'right' }}>{v.fillRate}%</td>
            <td style={{ padding: '3px 4px', color: v.avgLatency < 0.1 ? T.up : T.tx1, textAlign: 'right' }}>{v.avgLatency}ms</td>
            <td style={{ padding: '3px 4px', color: v.toxicity > 18 ? T.dn : T.tx1, textAlign: 'right' }}>{v.toxicity}%</td>
            <td style={{ padding: '3px 4px', color: v.informedPct > 30 ? T.warn : T.tx2, textAlign: 'right' }}>{v.informedPct}%</td>
            <td style={{ padding: '3px 4px', color: v.darkPct > 0 ? T.purple : T.tx3, textAlign: 'right' }}>{v.darkPct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TickTape({ ticks }: { ticks: TickData[] }) {
  return (
    <div style={{ overflow: 'auto', maxHeight: '250px', fontFamily: T.mono, fontSize: '7px' }}>
      {ticks.slice(0, 80).map((t, i) => (
        <div key={i} style={{
          display: 'flex', gap: '6px', padding: '1px 4px',
          background: i % 2 === 0 ? T.bg1 : T.bg2,
        }}>
          <span style={{ color: T.tx3, minWidth: '60px' }}>{new Date(t.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any)}</span>
          <span style={{ color: t.aggressor === 'buy' ? T.up : T.dn, fontWeight: 600, minWidth: '45px', textAlign: 'right' }}>{t.price.toFixed(2)}</span>
          <span style={{ color: T.tx1, minWidth: '35px', textAlign: 'right' }}>{t.size}</span>
          <span style={{ color: t.aggressor === 'buy' ? T.up : T.dn, minWidth: '20px', textAlign: 'center' }}>{t.aggressor === 'buy' ? '▲' : '▼'}</span>
          <span style={{ color: T.tx3, minWidth: '40px' }}>{t.venue}</span>
          <span style={{ color: T.tx3, minWidth: '10px', textAlign: 'center' }}>{t.condition}</span>
        </div>
      ))}
    </div>
  );
}

function LiquidityGrid({ metrics }: { metrics: LiquidityMetric[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
      {metrics.map(m => (
        <div key={m.label} style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: '7px', color: T.tx3, marginBottom: '2px', textTransform: 'uppercase' }}>{m.label}</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: T.tx0, fontFamily: T.mono }}>{m.value}</div>
          <div style={{ fontSize: '7px', color: m.change >= 0 ? T.up : T.dn, fontFamily: T.mono }}>
            {m.change >= 0 ? '▲' : '▼'} {Math.abs(m.change).toFixed(1)}%
          </div>
          <div style={{ fontSize: '7px', color: T.tx3, marginTop: '2px' }}>{m.description}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
type MicroTab = 'orderflow' | 'depth' | 'venues' | 'ticks' | 'liquidity';

export default function MicrostructureUI2() {
  const [tab, setTab] = useState<MicroTab>('orderflow');
  const [symbol] = useState('AAPL');
  const orderFlow = useMemo(() => generateOrderFlow(60), []);
  const depthImb = useMemo(() => generateDepthImbalance(), []);
  const venues = useMemo(() => generateVenueStats(), []);
  const ticks = useMemo(() => generateTickData(200), []);
  const liqMetrics = useMemo(() => getLiquidityMetrics(), []);

  return (
    <div data-testid="microstructure-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>MICROSTRUCTURE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{symbol}</span>
        <span style={{ fontSize: '9px', color: T.tx2 }}>Order flow · Depth · Venue analytics</span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'orderflow' as MicroTab, label: '📊 Order Flow' },
          { key: 'depth' as MicroTab, label: '📐 Depth Imbalance' },
          { key: 'venues' as MicroTab, label: '🏛️ Venues' },
          { key: 'ticks' as MicroTab, label: '⚡ Tick Data' },
          { key: 'liquidity' as MicroTab, label: '💧 Liquidity' },
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
        {tab === 'orderflow' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Buy/Sell Volume Profile (1-min bars)</div>
              <OrderFlowCanvas data={orderFlow} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <CumDeltaCanvas data={orderFlow} />
            </div>
          </div>
        )}
        {tab === 'depth' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Depth Imbalance Heatmap</div>
              <DepthImbalanceCanvas data={depthImb} />
            </div>
            <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Imbalance Table</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                    {['Level', 'Price', 'Bid Vol', 'Ask Vol', 'Imbalance'].map(h => (
                      <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {depthImb.map(d => (
                    <tr key={d.level} style={{ borderBottom: `1px solid ${T.border}`, background: d.level === 0 ? `${T.brand}10` : 'transparent' }}>
                      <td style={{ padding: '3px 4px', color: d.level === 0 ? T.brand : T.tx3, textAlign: 'right' }}>{d.level}</td>
                      <td style={{ padding: '3px 4px', color: d.level === 0 ? T.brand : T.tx0, fontWeight: 600, textAlign: 'right' }}>{d.price.toFixed(2)}</td>
                      <td style={{ padding: '3px 4px', color: T.up, textAlign: 'right' }}>{d.bidVolume.toLocaleString()}</td>
                      <td style={{ padding: '3px 4px', color: T.dn, textAlign: 'right' }}>{d.askVolume.toLocaleString()}</td>
                      <td style={{ padding: '3px 4px', color: d.imbalance > 0.2 ? T.up : d.imbalance < -0.2 ? T.dn : T.tx2, fontWeight: 600, textAlign: 'right' }}>
                        {d.imbalance > 0 ? '+' : ''}{(d.imbalance * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'venues' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Venue Analytics — Market Share & Execution Quality</div>
            <VenueTable venues={venues} />
          </div>
        )}
        {tab === 'ticks' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Tick-by-Tick Tape — {symbol}</div>
            <TickTape ticks={ticks} />
          </div>
        )}
        {tab === 'liquidity' && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '8px' }}>💧 Liquidity Metrics — {symbol}</div>
            <LiquidityGrid metrics={liqMetrics} />
          </div>
        )}
      </div>
    </div>
  );
}

export { MicrostructureUI2 };
