/**
 * AlgoExecutionUI2 — Algorithmic Execution Dashboard
 * TWAP, VWAP, POV, Implementation Shortfall, Arrival Price algorithms
 * with live progress, benchmark comparison, TCA, basket trading.
 */
import { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface AlgoOrder {
  id: string; symbol: string; side: 'BUY' | 'SELL'; algo: string;
  totalQty: number; filledQty: number; avgPrice: number; limitPrice: number;
  startTime: string; endTime: string; status: 'ACTIVE' | 'COMPLETE' | 'PAUSED' | 'CANCELLED';
  participation: number; slippage: number; marketImpact: number;
  vwapBenchmark: number; arrivalPrice: number;
  fills: { time: string; qty: number; price: number; venue: string }[];
}

interface AlgoConfig {
  name: string; description: string; params: { key: string; label: string; type: 'number' | 'select' | 'toggle'; default: any; options?: string[] }[];
}

/* ─── Algo Configs ───────────────────────────────────────────────────── */
const ALGOS: AlgoConfig[] = [
  { name: 'TWAP', description: 'Time-Weighted Average Price — spreads order evenly over time window',
    params: [
      { key: 'duration', label: 'Duration (min)', type: 'number', default: 60 },
      { key: 'maxParticipation', label: 'Max Participation %', type: 'number', default: 10 },
      { key: 'urgency', label: 'Urgency', type: 'select', default: 'Medium', options: ['Low', 'Medium', 'High', 'Aggressive'] },
      { key: 'darkPool', label: 'Include Dark Pools', type: 'toggle', default: true },
    ]
  },
  { name: 'VWAP', description: 'Volume-Weighted Average Price — follows historical volume curve',
    params: [
      { key: 'startTime', label: 'Start Time', type: 'select', default: '09:30', options: ['09:30', '10:00', '10:30', '11:00'] },
      { key: 'endTime', label: 'End Time', type: 'select', default: '16:00', options: ['14:00', '15:00', '15:30', '16:00'] },
      { key: 'maxDeviation', label: 'Max Deviation %', type: 'number', default: 5 },
      { key: 'minFillSize', label: 'Min Fill Size', type: 'number', default: 100 },
    ]
  },
  { name: 'POV', description: 'Percentage of Volume — targets a fixed share of market volume',
    params: [
      { key: 'targetPov', label: 'Target POV %', type: 'number', default: 15 },
      { key: 'maxPrice', label: 'Price Limit', type: 'number', default: 0 },
      { key: 'minSize', label: 'Min Clip Size', type: 'number', default: 50 },
    ]
  },
  { name: 'IS', description: 'Implementation Shortfall — minimizes cost vs arrival price',
    params: [
      { key: 'riskAversion', label: 'Risk Aversion', type: 'select', default: 'Neutral', options: ['Passive', 'Neutral', 'Aggressive'] },
      { key: 'alphaDecay', label: 'Alpha Decay (min)', type: 'number', default: 30 },
      { key: 'tradingCost', label: 'Est. Cost (bps)', type: 'number', default: 5 },
    ]
  },
  { name: 'Arrival', description: 'Arrival Price — benchmarks against price at order entry',
    params: [
      { key: 'aggressiveness', label: 'Aggressiveness', type: 'select', default: 'Medium', options: ['Passive', 'Medium', 'Aggressive', 'Hyper'] },
      { key: 'maxSpread', label: 'Max Spread (ticks)', type: 'number', default: 3 },
    ]
  },
  { name: 'SOR', description: 'Smart Order Router — routes across venues for best execution',
    params: [
      { key: 'darkPoolPref', label: 'Dark Pool %', type: 'number', default: 30 },
      { key: 'venueExclude', label: 'Exclude Venues', type: 'select', default: 'None', options: ['None', 'IEX', 'BATS', 'DARK'] },
      { key: 'antiGaming', label: 'Anti-Gaming', type: 'toggle', default: true },
    ]
  },
];

/* ─── Mock Orders ────────────────────────────────────────────────────── */
function generateOrders(): AlgoOrder[] {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM'];
  const statuses: AlgoOrder['status'][] = ['ACTIVE', 'COMPLETE', 'COMPLETE', 'ACTIVE', 'PAUSED', 'COMPLETE', 'ACTIVE', 'CANCELLED'];
  return symbols.map((sym, i) => {
    const total = Math.floor(Math.random() * 50000 + 5000);
    const filled = statuses[i] === 'COMPLETE' ? total : Math.floor(total * Math.random() * 0.8);
    const arrP = 180 + Math.random() * 40;
    const avgP = arrP + (Math.random() - 0.5) * 2;
    const vwap = arrP + (Math.random() - 0.3) * 1.5;
    const fills = Array.from({ length: Math.floor(Math.random() * 15 + 3) }, (_, j) => ({
      time: `${9 + Math.floor(j / 2)}:${String(j * 4 % 60).padStart(2, '0')}`,
      qty: Math.floor(filled / 10 + Math.random() * 200),
      price: avgP + (Math.random() - 0.5) * 0.5,
      venue: ['NYSE', 'ARCA', 'BATS', 'IEX', 'DARK'][Math.floor(Math.random() * 5)],
    }));
    return {
      id: `ALGO-${1000 + i}`, symbol: sym,
      side: i % 3 === 0 ? 'SELL' : 'BUY',
      algo: ALGOS[i % ALGOS.length].name,
      totalQty: total, filledQty: filled,
      avgPrice: Number(avgP.toFixed(2)), limitPrice: Number((arrP + 2).toFixed(2)),
      startTime: `09:${String(30 + i * 3).padStart(2, '0')}`, endTime: '16:00',
      status: statuses[i],
      participation: Number((Math.random() * 15 + 2).toFixed(1)),
      slippage: Number(((avgP - arrP) / arrP * 10000).toFixed(2)),
      marketImpact: Number((Math.random() * 8 + 0.5).toFixed(2)),
      vwapBenchmark: Number(vwap.toFixed(2)),
      arrivalPrice: Number(arrP.toFixed(2)),
      fills,
    };
  });
}

const ORDERS = generateOrders();

/* ─── Canvas: Execution Progress ─────────────────────────────────────── */
function ExecutionProgressChart({ order }: { order: AlgoOrder }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const fills = order.fills;
    if (fills.length === 0) return;
    const cumQty: number[] = [];
    fills.reduce((s, f) => { const v = s + f.qty; cumQty.push(v); return v; }, 0);
    const maxQ = order.totalQty;

    // Target line (linear for TWAP)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, h - 25); ctx.lineTo(w - 10, 15); ctx.stroke();
    ctx.setLineDash([]);

    // Actual fill curve
    ctx.strokeStyle = order.side === 'BUY' ? GREEN : RED; ctx.lineWidth = 2;
    ctx.beginPath();
    fills.forEach((_, i) => {
      const x = 40 + (i / (fills.length - 1)) * (w - 50);
      const y = h - 25 - (cumQty[i] / maxQ) * (h - 40);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area
    ctx.lineTo(40 + ((fills.length - 1) / (fills.length - 1)) * (w - 50), h - 25);
    ctx.lineTo(40, h - 25); ctx.closePath();
    ctx.fillStyle = order.side === 'BUY' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)';
    ctx.fill();

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Start', 40, h - 8); ctx.fillText('End', w - 10, h - 8);
    ctx.textAlign = 'right'; ctx.fillText('0%', 36, h - 25);
    ctx.fillText('100%', 36, 18);
    ctx.fillStyle = '#aaa'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${((order.filledQty / order.totalQty) * 100).toFixed(0)}% filled`, 45, 16);
  }, [order]);
  return <canvas ref={ref} style={{ width: '100%', height: 140, borderRadius: 4 }} />;
}

/* ─── Canvas: Benchmark Comparison ───────────────────────────────────── */
function BenchmarkChart({ order }: { order: AlgoOrder }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const fills = order.fills;
    if (fills.length === 0) return;
    const prices = fills.map(f => f.price);
    const minP = Math.min(...prices, order.arrivalPrice, order.vwapBenchmark) - 0.5;
    const maxP = Math.max(...prices, order.arrivalPrice, order.vwapBenchmark) + 0.5;
    const py = (p: number) => 20 + ((maxP - p) / (maxP - minP)) * (h - 40);

    // Arrival Price line
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, py(order.arrivalPrice)); ctx.lineTo(w - 10, py(order.arrivalPrice)); ctx.stroke();

    // VWAP line
    ctx.strokeStyle = '#6366f1';
    ctx.beginPath(); ctx.moveTo(40, py(order.vwapBenchmark)); ctx.lineTo(w - 10, py(order.vwapBenchmark)); ctx.stroke();
    ctx.setLineDash([]);

    // Fill prices
    ctx.fillStyle = order.side === 'BUY' ? GREEN : RED;
    fills.forEach((f, i) => {
      const x = 40 + (i / (fills.length - 1)) * (w - 50);
      ctx.beginPath(); ctx.arc(x, py(f.price), 3, 0, Math.PI * 2); ctx.fill();
    });

    // Avg price line
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(40, py(order.avgPrice)); ctx.lineTo(w - 10, py(order.avgPrice)); ctx.stroke();

    // Legend
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    const leg = [
      { label: `Arrival $${order.arrivalPrice.toFixed(2)}`, color: AMBER },
      { label: `VWAP $${order.vwapBenchmark.toFixed(2)}`, color: '#6366f1' },
      { label: `Avg $${order.avgPrice.toFixed(2)}`, color: '#fff' },
    ];
    leg.forEach((l, i) => {
      ctx.fillStyle = l.color; ctx.fillRect(50 + i * 100, 6, 8, 2);
      ctx.fillText(l.label, 60 + i * 100, 10);
    });
  }, [order]);
  return <canvas ref={ref} style={{ width: '100%', height: 140, borderRadius: 4 }} />;
}

/* ─── Canvas: Venue Distribution ─────────────────────────────────────── */
function VenueDonut({ order }: { order: AlgoOrder }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const venues: Record<string, number> = {};
    order.fills.forEach(f => { venues[f.venue] = (venues[f.venue] || 0) + f.qty; });
    const entries = Object.entries(venues).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    const colors = ['#26a69a', '#ef5350', '#f5a623', '#6366f1', '#ec4899', '#14b8a6'];
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 30, ir = r * 0.55;
    let angle = -Math.PI / 2;

    entries.forEach(([venue, qty], i) => {
      const sweep = (qty / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx + ir * Math.cos(angle), cy + ir * Math.sin(angle));
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.arc(cx, cy, ir, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();

      // Label
      const mid = angle + sweep / 2;
      const lx = cx + (r + 14) * Math.cos(mid);
      const ly = cy + (r + 14) * Math.sin(mid);
      ctx.fillStyle = '#ccc'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${venue} ${(qty / total * 100).toFixed(0)}%`, lx, ly);
      angle += sweep;
    });

    ctx.fillStyle = '#eee'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(total.toLocaleString(), cx, cy + 4);
    ctx.fillStyle = MUTED; ctx.font = '8px monospace';
    ctx.fillText('FILLS', cx, cy + 14);
  }, [order]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['ACTIVE ORDERS', 'NEW ORDER', 'TCA ANALYTICS', 'BASKET'] as const;
type Tab = typeof TABS[number];

export default function AlgoExecutionUI2() {
  const [tab, setTab] = useState<Tab>('ACTIVE ORDERS');
  const [selectedOrder, setSelectedOrder] = useState<AlgoOrder>(ORDERS[0]);
  const [selectedAlgo, setSelectedAlgo] = useState<string>('TWAP');
  const [basketMode, setBasketMode] = useState<'single' | 'csv'>('single');

  const activeOrders = useMemo(() => ORDERS.filter(o => o.status === 'ACTIVE'), []);
  const completedOrders = useMemo(() => ORDERS.filter(o => o.status === 'COMPLETE'), []);

  const algoConfig = useMemo(() => ALGOS.find(a => a.name === selectedAlgo) ?? ALGOS[0], [selectedAlgo]);

  // TCA aggregates
  const avgSlippage = useMemo(() => completedOrders.length > 0 ? completedOrders.reduce((s, o) => s + o.slippage, 0) / completedOrders.length : 0, [completedOrders]);
  const avgImpact = useMemo(() => completedOrders.length > 0 ? completedOrders.reduce((s, o) => s + o.marketImpact, 0) / completedOrders.length : 0, [completedOrders]);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 8 };

  const statusColor = (s: string) => s === 'ACTIVE' ? GREEN : s === 'COMPLETE' ? '#6366f1' : s === 'PAUSED' ? AMBER : RED;

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>⚡ ALGO EXECUTION</span>
          <span style={{ fontSize: 11, color: MUTED }}>
            Active: <span style={{ color: GREEN, fontWeight: 600 }}>{activeOrders.length}</span> | 
            Completed: <span style={{ color: '#6366f1', fontWeight: 600 }}>{completedOrders.length}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <div>
            <span style={{ color: MUTED }}>AVG SLIPPAGE </span>
            <span style={{ color: avgSlippage > 0 ? RED : GREEN, fontWeight: 600 }}>{avgSlippage.toFixed(2)} bps</span>
          </div>
          <div>
            <span style={{ color: MUTED }}>AVG IMPACT </span>
            <span style={{ color: AMBER, fontWeight: 600 }}>{avgImpact.toFixed(2)} bps</span>
          </div>
        </div>
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
        {tab === 'ACTIVE ORDERS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 12, height: '100%' }}>
            {/* Orders table */}
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>ALGO ORDERS</span>
              <div style={{ overflowY: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: PANEL }}>
                      {['ID', 'SYMBOL', 'SIDE', 'ALGO', 'QTY', 'FILLED', 'AVG PX', 'SLIP (bps)', 'STATUS'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: MUTED, textAlign: 'left', fontSize: 9, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ORDERS.map(o => (
                      <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{
                        cursor: 'pointer', borderBottom: `1px solid ${BORDER}22`,
                        background: selectedOrder.id === o.id ? '#1a1a1a' : 'transparent'
                      }}>
                        <td style={{ padding: '4px 6px', color: MUTED, fontFamily: 'monospace' }}>{o.id}</td>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>{o.symbol}</td>
                        <td style={{ padding: '4px 6px', color: o.side === 'BUY' ? GREEN : RED, fontWeight: 600 }}>{o.side}</td>
                        <td style={{ padding: '4px 6px', color: AMBER }}>{o.algo}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{o.totalQty.toLocaleString()}</td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>
                          {o.filledQty.toLocaleString()}
                          <span style={{ color: MUTED }}> ({(o.filledQty / o.totalQty * 100).toFixed(0)}%)</span>
                        </td>
                        <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>${o.avgPrice.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', color: o.slippage > 0 ? RED : GREEN, fontFamily: 'monospace' }}>{o.slippage.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, background: `${statusColor(o.status)}22`, color: statusColor(o.status), fontWeight: 600 }}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected order details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>{selectedOrder.symbol} — {selectedOrder.algo}</span>
                  <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, background: `${statusColor(selectedOrder.status)}22`, color: statusColor(selectedOrder.status), fontWeight: 600 }}>
                    {selectedOrder.status}
                  </span>
                </div>
                <ExecutionProgressChart order={selectedOrder} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 10 }}>
                  {[
                    { l: 'Total Qty', v: selectedOrder.totalQty.toLocaleString() },
                    { l: 'Filled', v: `${selectedOrder.filledQty.toLocaleString()} (${(selectedOrder.filledQty / selectedOrder.totalQty * 100).toFixed(0)}%)` },
                    { l: 'Avg Price', v: `$${selectedOrder.avgPrice.toFixed(2)}` },
                    { l: 'Participation', v: `${selectedOrder.participation}%` },
                  ].map(m => (
                    <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{m.l}</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>BENCHMARK</span>
                <BenchmarkChart order={selectedOrder} />
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>VENUE MIX</span>
                <VenueDonut order={selectedOrder} />
              </div>
            </div>
          </div>
        )}

        {tab === 'NEW ORDER' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Algo selector */}
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SELECT ALGORITHM</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                {ALGOS.map(a => (
                  <button key={a.name} onClick={() => setSelectedAlgo(a.name)} style={{
                    background: selectedAlgo === a.name ? 'rgba(245,166,35,0.15)' : '#0a0a0a',
                    border: `1px solid ${selectedAlgo === a.name ? AMBER : BORDER}`,
                    borderRadius: 6, padding: 12, cursor: 'pointer', textAlign: 'left'
                  }}>
                    <div style={{ color: selectedAlgo === a.name ? AMBER : '#eee', fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                    <div style={{ color: MUTED, fontSize: 9, marginTop: 4, lineHeight: 1.3 }}>{a.description.slice(0, 60)}...</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: 12, background: '#0a0a0a', borderRadius: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#eee', marginBottom: 4 }}>{algoConfig.name}</div>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 12 }}>{algoConfig.description}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {algoConfig.params.map(p => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ color: '#ccc', fontSize: 11 }}>{p.label}</label>
                      {p.type === 'number' && (
                        <input type="number" defaultValue={p.default} style={{
                          width: 80, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
                          color: '#eee', padding: '4px 8px', fontSize: 11, textAlign: 'right'
                        }} />
                      )}
                      {p.type === 'select' && (
                        <select defaultValue={p.default} style={{
                          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
                          color: '#eee', padding: '4px 8px', fontSize: 11
                        }}>
                          {p.options?.map(o => <option key={o}>{o}</option>)}
                        </select>
                      )}
                      {p.type === 'toggle' && (
                        <input type="checkbox" defaultChecked={p.default} style={{ accentColor: AMBER }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order entry */}
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>ORDER DETAILS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {[
                  { label: 'Symbol', type: 'text', placeholder: 'AAPL', def: 'AAPL' },
                  { label: 'Side', type: 'select', options: ['BUY', 'SELL'] },
                  { label: 'Quantity', type: 'number', placeholder: '10000', def: '10000' },
                  { label: 'Limit Price', type: 'number', placeholder: '0 = Market', def: '' },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ color: '#ccc', fontSize: 11 }}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 8px', fontSize: 11 }}>
                        {f.options?.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} defaultValue={f.def} placeholder={f.placeholder} style={{
                        width: 120, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
                        color: '#eee', padding: '4px 8px', fontSize: 11, textAlign: 'right'
                      }} />
                    )}
                  </div>
                ))}

                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                  <span style={{ color: MUTED, fontSize: 10 }}>ESTIMATED EXECUTION</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 11 }}>
                    {[
                      { l: 'Est. Duration', v: '45 min' },
                      { l: 'Est. Slippage', v: '2.3 bps' },
                      { l: 'Est. Cost', v: '$1,840' },
                      { l: 'Participation', v: '8.2%' },
                    ].map(m => (
                      <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: MUTED }}>{m.l}</span>
                        <span style={{ fontWeight: 600 }}>{m.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={{
                    flex: 1, padding: '10px 16px', background: GREEN, color: '#fff',
                    border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer'
                  }}>SUBMIT ORDER</button>
                  <button style={{
                    padding: '10px 16px', background: '#333', color: '#eee',
                    border: `1px solid ${BORDER}`, borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer'
                  }}>PREVIEW</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'TCA ANALYTICS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TRANSACTION COST ANALYSIS</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'Avg Slippage', val: `${avgSlippage.toFixed(2)} bps`, color: avgSlippage > 0 ? RED : GREEN },
                  { label: 'Avg Impact', val: `${avgImpact.toFixed(2)} bps`, color: AMBER },
                  { label: 'Total Cost', val: '$12,450', color: RED },
                  { label: 'Orders Complete', val: completedOrders.length.toString(), color: '#6366f1' },
                  { label: 'Fill Rate', val: '94.2%', color: GREEN },
                  { label: 'Venue Score', val: 'A+', color: GREEN },
                ].map(m => (
                  <div key={m.label} style={{ background: '#0a0a0a', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ color: MUTED, fontSize: 9, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ color: m.color, fontWeight: 700, fontSize: 16 }}>{m.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <span style={{ color: MUTED, fontSize: 10 }}>SLIPPAGE BY ALGO</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {ALGOS.map(a => {
                    const algoOrders = ORDERS.filter(o => o.algo === a.name);
                    const slip = algoOrders.length > 0 ? algoOrders.reduce((s, o) => s + o.slippage, 0) / algoOrders.length : 0;
                    return (
                      <div key={a.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: '#ccc' }}>{a.name}</span>
                          <span style={{ color: slip > 3 ? RED : slip > 0 ? AMBER : GREEN, fontWeight: 600 }}>{slip.toFixed(2)} bps</span>
                        </div>
                        <div style={{ height: 4, background: '#222', borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(Math.abs(slip) / 10 * 100, 100)}%`, height: '100%', background: slip > 3 ? RED : slip > 0 ? AMBER : GREEN, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>COMPLETED ORDER ANALYSIS</span>
              <div style={{ overflowY: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: PANEL }}>
                      {['SYMBOL', 'ALGO', 'QTY', 'ARRIVAL', 'AVG PX', 'VWAP', 'SLIP', 'IMPACT'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: MUTED, textAlign: 'right', fontSize: 9, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ORDERS.map(o => (
                      <tr key={o.id} style={{ borderBottom: `1px solid ${BORDER}11` }}>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{o.symbol}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: AMBER }}>{o.algo}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{o.totalQty.toLocaleString()}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>${o.arrivalPrice.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>${o.avgPrice.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>${o.vwapBenchmark.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: o.slippage > 0 ? RED : GREEN, fontWeight: 600 }}>{o.slippage.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: AMBER }}>{o.marketImpact.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'BASKET' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>BASKET TRADING</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['single', 'csv'] as const).map(m => (
                    <button key={m} onClick={() => setBasketMode(m)} style={{
                      padding: '3px 10px', fontSize: 10, border: `1px solid ${basketMode === m ? AMBER : BORDER}`,
                      background: basketMode === m ? 'rgba(245,166,35,0.1)' : 'transparent',
                      color: basketMode === m ? AMBER : MUTED, borderRadius: 4, cursor: 'pointer', textTransform: 'uppercase'
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              {basketMode === 'single' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#0a0a0a' }}>
                      {['SYMBOL', 'SIDE', 'QTY', 'ALGO', 'LIMIT', 'ACTION'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', color: MUTED, textAlign: 'left', fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'].map((sym, i) => (
                      <tr key={sym} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{sym}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <select style={{ background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: i % 2 === 0 ? GREEN : RED, padding: '2px 6px', fontSize: 10 }}>
                            <option>BUY</option><option>SELL</option>
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" defaultValue={5000 + i * 1000} style={{ width: 70, background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '2px 6px', fontSize: 10, textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select style={{ background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '2px 6px', fontSize: 10 }}>
                            {ALGOS.map(a => <option key={a.name}>{a.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" placeholder="MKT" style={{ width: 60, background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '2px 6px', fontSize: 10, textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <button style={{ background: 'transparent', border: `1px solid ${RED}`, borderRadius: 3, color: RED, padding: '2px 6px', fontSize: 9, cursor: 'pointer' }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {basketMode === 'csv' && (
                <div style={{ padding: 24, border: `2px dashed ${BORDER}`, borderRadius: 8, textAlign: 'center', marginTop: 8 }}>
                  <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>Drop CSV file or click to upload</div>
                  <div style={{ color: '#555', fontSize: 10 }}>Format: Symbol, Side, Qty, Algo, Limit</div>
                  <button style={{ marginTop: 12, padding: '8px 24px', background: AMBER, color: '#000', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Browse Files</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ flex: 1, padding: '10px 16px', background: GREEN, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>EXECUTE BASKET</button>
                <button style={{ padding: '10px 16px', background: '#333', color: '#eee', border: `1px solid ${BORDER}`, borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>PREVIEW ALL</button>
                <button style={{ padding: '10px 16px', background: '#333', color: '#eee', border: `1px solid ${BORDER}`, borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>+ ADD ROW</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>BASKET SUMMARY</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 11 }}>
                  {[
                    { l: 'Symbols', v: '5', c: '#eee' },
                    { l: 'Net Buy Qty', v: '25,000', c: GREEN },
                    { l: 'Net Sell Qty', v: '12,000', c: RED },
                    { l: 'Est. Notional', v: '$6.2M', c: '#eee' },
                    { l: 'Est. Fees', v: '$3,100', c: AMBER },
                    { l: 'Est. Duration', v: '25 min', c: MUTED },
                    { l: 'Algos Used', v: '3', c: '#6366f1' },
                  ].map(m => (
                    <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{m.l}</span>
                      <span style={{ color: m.c, fontWeight: 600, fontFamily: 'monospace' }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EXECUTION SETTINGS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, fontSize: 11 }}>
                  {[
                    { l: 'Execution Mode', v: 'Parallel' },
                    { l: 'Max Participation', v: '10%' },
                    { l: 'Dark Pool Usage', v: 'Enabled' },
                    { l: 'Anti-Gaming', v: 'On' },
                    { l: 'Auto-Pause on Vol', v: 'Enabled' },
                  ].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ color: '#eee', fontWeight: 500 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
