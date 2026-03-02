import React, { useState, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Order {
  id: string; symbol: string; side: 'Buy' | 'Sell'; qty: number; filledQty: number;
  avgPrice: number; arrivalPrice: number; vwap: number; twap: number;
  algo: string; venue: string; startTime: number; endTime: number;
  slippage: number; implCost: number; spreadCost: number;
  marketImpact: number; timingCost: number; oppCost: number;
  participation: number; fills: number; rejects: number;
}

function genOrder(i: number): Order {
  const r = () => Math.random();
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'JPM', 'TSLA', 'V', 'JNJ', 'AMD', 'NFLX', 'BA', 'DIS', 'PYPL'];
  const algos = ['VWAP', 'TWAP', 'IS', 'POV', 'DarkSeek', 'SmartRoute', 'Iceberg', 'Sniper', 'Close', 'MOC'];
  const venues = ['NYSE', 'NASDAQ', 'BATS', 'IEX', 'EDGX', 'ARCA', 'Dark Pool', 'MEMX'];
  const side = r() > 0.5 ? 'Buy' as const : 'Sell' as const;
  const qty = Math.floor(1000 + r() * 50000);
  const filledQty = Math.floor(qty * (0.85 + r() * 0.15));
  const arrivalPrice = 50 + r() * 400;
  const slippage = -0.5 + r() * 1.0;
  const avgPrice = arrivalPrice * (1 + slippage / 100 * (side === 'Buy' ? 1 : -1));
  return {
    id: `ORD-${String(i).padStart(5, '0')}`,
    symbol: symbols[Math.floor(r() * symbols.length)],
    side, qty, filledQty,
    avgPrice, arrivalPrice, vwap: arrivalPrice * (1 + (r() * 0.5 - 0.25) / 100),
    twap: arrivalPrice * (1 + (r() * 0.4 - 0.2) / 100),
    algo: algos[Math.floor(r() * algos.length)],
    venue: venues[Math.floor(r() * venues.length)],
    startTime: Date.now() - Math.floor(r() * 86400000),
    endTime: Date.now() - Math.floor(r() * 3600000),
    slippage, implCost: slippage * 0.6 + r() * 0.3,
    spreadCost: 0.01 + r() * 0.08, marketImpact: r() * 0.5,
    timingCost: -0.2 + r() * 0.4, oppCost: r() * 0.3,
    participation: 3 + r() * 25, fills: Math.floor(10 + r() * 200),
    rejects: Math.floor(r() * 5),
  };
}

const ORDERS: Order[] = Array.from({ length: 40 }, (_, i) => genOrder(i));

interface BenchmarkSummary { name: string; avgBps: number; wins: number; total: number; best: number; worst: number; }

function computeBenchmarks(orders: Order[]): BenchmarkSummary[] {
  const benchmarks = [
    { name: 'Arrival Price', key: 'slippage' as const },
    { name: 'Implementation Shortfall', key: 'implCost' as const },
    { name: 'Spread Cost', key: 'spreadCost' as const },
    { name: 'Market Impact', key: 'marketImpact' as const },
    { name: 'Timing Cost', key: 'timingCost' as const },
    { name: 'Opportunity Cost', key: 'oppCost' as const },
  ];
  return benchmarks.map(b => {
    const vals = orders.map(o => o[b.key] * 100);
    return {
      name: b.name,
      avgBps: vals.reduce((a, v) => a + v, 0) / vals.length,
      wins: vals.filter(v => v < 0).length,
      total: vals.length,
      best: Math.min(...vals),
      worst: Math.max(...vals),
    };
  });
}

function drawSlippageChart(ctx: CanvasRenderingContext2D, w: number, h: number, orders: Order[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 15, bottom: 35, left: 55 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  const slippages = orders.map(o => o.slippage * 100);
  const maxAbs = Math.max(...slippages.map(Math.abs), 1);

  ctx.fillStyle = AMBER; ctx.font = 'bold 11px monospace';
  ctx.fillText('SLIPPAGE DISTRIBUTION (bps)', pad.left, 16);

  // Zero line
  const zeroY = pad.top + plotH / 2;
  ctx.strokeStyle = AMBER; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(w - pad.right, zeroY); ctx.stroke();

  // Bars
  const barW = Math.max(3, (plotW / orders.length) - 1);
  orders.forEach((o, i) => {
    const v = o.slippage * 100;
    const barH = (Math.abs(v) / maxAbs) * (plotH / 2);
    const x = pad.left + i * (plotW / orders.length);
    const y = v >= 0 ? zeroY - barH : zeroY;
    ctx.fillStyle = v >= 0 ? RED : GREEN;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y, barW, barH || 1);
    ctx.globalAlpha = 1;
  });

  // Stats
  const avg = slippages.reduce((a, b) => a + b, 0) / slippages.length;
  ctx.fillStyle = DIM; ctx.font = '10px monospace';
  ctx.fillText(`Avg: ${avg.toFixed(2)} bps`, w - 160, 16);
}

function drawVenueChart(ctx: CanvasRenderingContext2D, w: number, h: number, orders: Order[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 15, bottom: 50, left: 55 };
  ctx.fillStyle = AMBER; ctx.font = 'bold 11px monospace';
  ctx.fillText('VENUE ANALYSIS', pad.left, 16);

  const venues: Record<string, { fills: number; avgSlip: number; count: number }> = {};
  orders.forEach(o => {
    if (!venues[o.venue]) venues[o.venue] = { fills: 0, avgSlip: 0, count: 0 };
    venues[o.venue].fills += o.fills;
    venues[o.venue].avgSlip += o.slippage * 100;
    venues[o.venue].count++;
  });
  Object.values(venues).forEach(v => { v.avgSlip /= v.count; });

  const sorted = Object.entries(venues).sort((a, b) => b[1].fills - a[1].fills);
  const maxFills = Math.max(...sorted.map(([, v]) => v.fills), 1);
  const barH = Math.min(24, (h - pad.top - pad.bottom) / sorted.length - 4);

  sorted.forEach(([name, data], i) => {
    const y = pad.top + i * (barH + 4);
    const barW = (data.fills / maxFills) * (w - pad.left - pad.right - 120);

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(pad.left, y, w - pad.left - pad.right - 120, barH);
    ctx.fillStyle = data.avgSlip <= 0 ? GREEN : AMBER;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(pad.left, y, barW, barH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = WHITE; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(name, pad.left - 5, y + barH / 2 + 3);

    ctx.fillStyle = DIM; ctx.textAlign = 'left';
    ctx.fillText(`${data.fills} fills | ${data.avgSlip.toFixed(2)} bps`, pad.left + barW + 5, y + barH / 2 + 3);
  });
  ctx.textAlign = 'left';
}

const TABS = ['Orders', 'Benchmarks', 'Charts', 'Venue Analysis', 'Algo Performance'];

export default function TransactionCostAnalysisUI2() {
  const [tab, setTab] = useState(0);
  const [selectedAlgo, setSelectedAlgo] = useState('All');
  const [selectedSide, setSelectedSide] = useState('All');
  const [sortKey, setSortKey] = useState<keyof Order>('startTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const slipRef = useRef<HTMLCanvasElement>(null);
  const venueRef = useRef<HTMLCanvasElement>(null);

  const allAlgos = ['All', ...new Set(ORDERS.map(o => o.algo))];
  const filtered = ORDERS.filter(o => {
    if (selectedAlgo !== 'All' && o.algo !== selectedAlgo) return false;
    if (selectedSide !== 'All' && o.side !== selectedSide) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const benchmarks = computeBenchmarks(filtered);

  useEffect(() => {
    if (tab === 2) {
      const c = slipRef.current; if (!c) return;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const r = c.parentElement!.getBoundingClientRect();
      c.width = r.width; c.height = r.height;
      drawSlippageChart(ctx, r.width, r.height, filtered);
    }
    if (tab === 3) {
      const c = venueRef.current; if (!c) return;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const r = c.parentElement!.getBoundingClientRect();
      c.width = r.width; c.height = r.height;
      drawVenueChart(ctx, r.width, r.height, filtered);
    }
  }, [tab, filtered]);

  // Summary stats
  const totalShares = filtered.reduce((a, o) => a + o.filledQty, 0);
  const avgSlip = filtered.reduce((a, o) => a + o.slippage, 0) / filtered.length * 100;
  const totalFills = filtered.reduce((a, o) => a + o.fills, 0);
  const fillRate = filtered.reduce((a, o) => a + o.filledQty / o.qty, 0) / filtered.length * 100;

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📈 TRANSACTION COST ANALYSIS</span>
        <span style={{ color: DIM }}>|</span>
        <select value={selectedAlgo} onChange={e => setSelectedAlgo(e.target.value)} style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
          {allAlgos.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={selectedSide} onChange={e => setSelectedSide(e.target.value)} style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, fontFamily: 'monospace', fontSize: 11 }}>
          <option>All</option><option>Buy</option><option>Sell</option>
        </select>
      </div>

      {/* Summary Strip */}
      <div style={{ display: 'flex', padding: '6px 16px', gap: 24, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {[
          { label: 'Orders', value: filtered.length.toString(), color: WHITE },
          { label: 'Shares', value: totalShares.toLocaleString(), color: WHITE },
          { label: 'Avg Slippage', value: avgSlip.toFixed(2) + ' bps', color: avgSlip <= 0 ? GREEN : RED },
          { label: 'Fill Rate', value: fillRate.toFixed(1) + '%', color: fillRate >= 95 ? GREEN : AMBER },
          { label: 'Total Fills', value: totalFills.toLocaleString(), color: WHITE },
        ].map(s => (
          <div key={s.label}>
            <div style={{ color: DIM, fontSize: 9 }}>{s.label}</div>
            <div style={{ color: s.color, fontWeight: 'bold' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '6px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Orders table */}
        {tab === 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                {[
                  { key: 'id', label: 'Order ID' }, { key: 'symbol', label: 'Symbol' },
                  { key: 'side', label: 'Side' }, { key: 'algo', label: 'Algo' },
                  { key: 'qty', label: 'Qty' }, { key: 'filledQty', label: 'Filled' },
                  { key: 'arrivalPrice', label: 'Arrival' }, { key: 'avgPrice', label: 'Avg Price' },
                  { key: 'vwap', label: 'VWAP' }, { key: 'slippage', label: 'Slip (bps)' },
                  { key: 'implCost', label: 'IS (bps)' }, { key: 'venue', label: 'Venue' },
                  { key: 'participation', label: 'Part %' }, { key: 'fills', label: 'Fills' },
                ].map(col => (
                  <th key={col.key} onClick={() => {
                    if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortKey(col.key as keyof Order); setSortDir('desc'); }
                  }} style={{
                    padding: '5px 6px', textAlign: col.key === 'id' || col.key === 'symbol' || col.key === 'side' || col.key === 'algo' || col.key === 'venue' ? 'left' : 'right',
                    color: sortKey === col.key ? AMBER : DIM, fontSize: 10, borderBottom: `1px solid ${BORDER}`, cursor: 'pointer'
                  }}>{col.label} {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(o => (
                <tr key={o.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '4px 6px', color: DIM, fontSize: 10 }}>{o.id}</td>
                  <td style={{ padding: '4px 6px', color: AMBER, fontWeight: 'bold' }}>{o.symbol}</td>
                  <td style={{ padding: '4px 6px', color: o.side === 'Buy' ? GREEN : RED }}>{o.side}</td>
                  <td style={{ padding: '4px 6px', color: CYAN }}>{o.algo}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: TEXT }}>{o.qty.toLocaleString()}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: o.filledQty === o.qty ? GREEN : AMBER }}>{o.filledQty.toLocaleString()}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: TEXT }}>${o.arrivalPrice.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: WHITE }}>${o.avgPrice.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: DIM }}>${o.vwap.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: o.slippage <= 0 ? GREEN : RED, fontWeight: 'bold' }}>
                    {(o.slippage * 100).toFixed(2)}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: o.implCost <= 0 ? GREEN : RED }}>
                    {(o.implCost * 100).toFixed(2)}
                  </td>
                  <td style={{ padding: '4px 6px', color: DIM }}>{o.venue}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: o.participation > 15 ? AMBER : TEXT }}>
                    {o.participation.toFixed(1)}%
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: DIM }}>{o.fills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Benchmarks */}
        {tab === 1 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 16 }}>BENCHMARK ANALYSIS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {benchmarks.map(b => (
                <div key={b.name} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
                  <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 8 }}>{b.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: b.avgBps <= 0 ? GREEN : RED, marginBottom: 12 }}>
                    {b.avgBps.toFixed(2)} <span style={{ fontSize: 12, color: DIM }}>bps avg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: DIM }}>Win Rate</span>
                    <span style={{ color: b.wins / b.total > 0.5 ? GREEN : RED }}>{(b.wins / b.total * 100).toFixed(0)}% ({b.wins}/{b.total})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: DIM }}>Best</span>
                    <span style={{ color: GREEN }}>{b.best.toFixed(2)} bps</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: DIM }}>Worst</span>
                    <span style={{ color: RED }}>{b.worst.toFixed(2)} bps</span>
                  </div>
                  {/* Visual bar */}
                  <div style={{ marginTop: 8, height: 6, background: '#1a1a1a', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '50%', top: 0, width: 2, height: '100%', background: AMBER
                    }} />
                    <div style={{
                      position: 'absolute', top: 0, height: '100%',
                      left: `${50 + (b.best / (Math.max(Math.abs(b.best), Math.abs(b.worst)) * 2)) * 50}%`,
                      width: `${((b.worst - b.best) / (Math.max(Math.abs(b.best), Math.abs(b.worst)) * 2)) * 50}%`,
                      background: `linear-gradient(90deg, ${GREEN}, ${RED})`,
                      opacity: 0.6
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {tab === 2 && (
          <div style={{ height: '100%', position: 'relative' }}>
            <canvas ref={slipRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* Venue Analysis */}
        {tab === 3 && (
          <div style={{ height: '100%', position: 'relative' }}>
            <canvas ref={venueRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* Algo Performance */}
        {tab === 4 && (
          <div style={{ padding: 16 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>ALGO PERFORMANCE COMPARISON</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Algo', 'Orders', 'Shares', 'Avg Slip (bps)', 'Avg IS (bps)', 'Avg Part %', 'Fill Rate', 'Win Rate'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Algo' ? 'left' : 'right', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(ORDERS.map(o => o.algo))].map(algo => {
                  const ao = ORDERS.filter(o => o.algo === algo);
                  const avgSlip = ao.reduce((a, o) => a + o.slippage, 0) / ao.length * 100;
                  const avgIS = ao.reduce((a, o) => a + o.implCost, 0) / ao.length * 100;
                  const avgPart = ao.reduce((a, o) => a + o.participation, 0) / ao.length;
                  const fillRate = ao.reduce((a, o) => a + o.filledQty / o.qty, 0) / ao.length * 100;
                  const winRate = ao.filter(o => o.slippage <= 0).length / ao.length * 100;
                  return (
                    <tr key={algo} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '5px 8px', color: CYAN, fontWeight: 'bold' }}>{algo}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>{ao.length}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>{ao.reduce((a, o) => a + o.filledQty, 0).toLocaleString()}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: avgSlip <= 0 ? GREEN : RED, fontWeight: 'bold' }}>{avgSlip.toFixed(2)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: avgIS <= 0 ? GREEN : RED }}>{avgIS.toFixed(2)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: TEXT }}>{avgPart.toFixed(1)}%</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: fillRate >= 95 ? GREEN : AMBER }}>{fillRate.toFixed(1)}%</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: winRate >= 50 ? GREEN : RED }}>{winRate.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Filter: {selectedAlgo} | {selectedSide}</span>
        <span style={{ color: DIM }}>{filtered.length} orders analyzed</span>
        <span style={{ color: DIM }}>Best Execution TCA Dashboard</span>
      </div>
    </div>
  );
}
