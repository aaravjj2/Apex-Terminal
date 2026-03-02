/**
 * MarketMakerUI2 — Market Making Simulation Dashboard
 * Order book management, spread analysis, inventory risk,
 * P&L from spread capture, adverse selection, quoting engine.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';
const CYAN = '#00bcd4';

interface QuoteLevel {
  price: number; bidSize: number; askSize: number; imbalance: number;
}
interface MMStats {
  spread: number; midPrice: number; bidVol: number; askVol: number;
  inventory: number; inventoryPnl: number; spreadCapture: number;
  totalPnl: number; adverseSelection: number; quoteRate: number;
  fillRate: number; cancelRate: number; positionLimit: number;
  avgHoldTime: number; turnover: number; sharpe: number;
}
interface Fill {
  id: number; time: string; side: 'BUY' | 'SELL'; price: number;
  size: number; pnl: number; spread: number; adverse: number;
}
interface InventoryPoint { time: number; inventory: number; pnl: number }

/* ─── Mock ──────────────────────────────────────────────────────────── */
function genData() {
  let s = 55;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const mid = 185.50;

  const levels: QuoteLevel[] = [];
  for (let i = 0; i < 20; i++) {
    const offset = (i + 1) * 0.01;
    const bidSize = Math.floor(rng() * 500 + 50);
    const askSize = Math.floor(rng() * 500 + 50);
    levels.push({
      price: mid - offset, bidSize, askSize: 0,
      imbalance: bidSize / (bidSize + askSize),
    });
  }
  for (let i = 0; i < 20; i++) {
    const offset = (i + 1) * 0.01;
    const askSize = Math.floor(rng() * 500 + 50);
    const bidSize = Math.floor(rng() * 500 + 50);
    levels.push({
      price: mid + offset, bidSize: 0, askSize,
      imbalance: bidSize / (bidSize + askSize),
    });
  }

  const stats: MMStats = {
    spread: 0.02, midPrice: mid,
    bidVol: levels.filter(l => l.bidSize > 0).reduce((s2, l) => s2 + l.bidSize, 0),
    askVol: levels.filter(l => l.askSize > 0).reduce((s2, l) => s2 + l.askSize, 0),
    inventory: Math.floor((rng() - 0.5) * 2000),
    inventoryPnl: (rng() - 0.4) * 5000,
    spreadCapture: 3247.50 + rng() * 2000,
    totalPnl: 4521.80 + rng() * 3000,
    adverseSelection: -(800 + rng() * 1500),
    quoteRate: 94 + rng() * 5,
    fillRate: 12 + rng() * 15,
    cancelRate: 78 + rng() * 15,
    positionLimit: 5000,
    avgHoldTime: 2.3 + rng() * 8,
    turnover: 150000 + rng() * 200000,
    sharpe: 1.2 + rng() * 2,
  };

  const fills: Fill[] = [];
  for (let i = 0; i < 60; i++) {
    const h = Math.floor(9 + (i / 60) * 7);
    const m = Math.floor(rng() * 60);
    const sec = Math.floor(rng() * 60);
    const ms = Math.floor(rng() * 999);
    const side = rng() > 0.5 ? 'BUY' : 'SELL' as const;
    const spr = 0.01 + rng() * 0.03;
    fills.push({
      id: i, time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`,
      side, price: mid + (rng() - 0.5) * 0.1, size: Math.floor(rng() * 200 + 10),
      pnl: (rng() - 0.35) * 50, spread: spr, adverse: -(rng() * spr * 0.5),
    });
  }
  fills.sort((a, b) => b.time.localeCompare(a.time));

  const invHistory: InventoryPoint[] = [];
  let inv = 0, cpnl = 0;
  for (let i = 0; i < 200; i++) {
    inv += (rng() - 0.5) * 100;
    inv = Math.max(-3000, Math.min(3000, inv));
    cpnl += (rng() - 0.4) * 30;
    invHistory.push({ time: i, inventory: inv, pnl: cpnl });
  }

  return { levels, stats, fills, invHistory };
}

/* ─── Canvas: Inventory over Time ────────────────────────────────────── */
function InventoryChart({ history }: { history: InventoryPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 45, r: 10, t: 10, b: 20 };
    const maxInv = Math.max(...history.map(p => Math.abs(p.inventory)));
    const maxPnl = Math.max(...history.map(p => Math.abs(p.pnl)));
    const px = (i: number) => pad.l + (i / (history.length - 1)) * (w - pad.l - pad.r);
    const pyInv = (v: number) => pad.t + ((maxInv - v) / (2 * maxInv)) * (h - pad.t - pad.b);
    const pyPnl = (v: number) => pad.t + ((maxPnl - v) / (2 * maxPnl)) * (h - pad.t - pad.b);

    // Zero line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, h / 2); ctx.lineTo(w - pad.r, h / 2); ctx.stroke();

    // Inventory area
    ctx.beginPath();
    ctx.moveTo(px(0), pyInv(0));
    history.forEach((p, i) => ctx.lineTo(px(i), pyInv(p.inventory)));
    ctx.lineTo(px(history.length - 1), pyInv(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,188,212,0.06)'; ctx.fill();

    // Inventory line
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.2;
    ctx.beginPath();
    history.forEach((p, i) => i === 0 ? ctx.moveTo(px(i), pyInv(p.inventory)) : ctx.lineTo(px(i), pyInv(p.inventory)));
    ctx.stroke();

    // PnL line
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.beginPath();
    history.forEach((p, i) => i === 0 ? ctx.moveTo(px(i), pyPnl(p.pnl)) : ctx.lineTo(px(i), pyPnl(p.pnl)));
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = CYAN; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('INVENTORY', pad.l + 5, pad.t + 10);
    ctx.fillStyle = AMBER; ctx.fillText('P/L', pad.l + 75, pad.t + 10);

    // Axis
    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`+${maxInv.toFixed(0)}`, pad.l - 4, pad.t + 8);
    ctx.fillText(`-${maxInv.toFixed(0)}`, pad.l - 4, h - pad.b);
  }, [history]);
  return <canvas ref={ref} style={{ width: '100%', height: 220, borderRadius: 4 }} />;
}

/* ─── Canvas: Spread Chart ───────────────────────────────────────────── */
function SpreadChart({ fills }: { fills: Fill[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 40, r: 10, t: 10, b: 20 };
    const spreads = fills.map(f => f.spread * 100);
    const maxS = Math.max(...spreads);
    const barW = (w - pad.l - pad.r) / spreads.length - 1;

    spreads.forEach((sp, i) => {
      const x = pad.l + i * (barW + 1);
      const barH = (sp / maxS) * (h - pad.t - pad.b);
      const y = h - pad.b - barH;
      ctx.fillStyle = sp > 2 ? GREEN : sp > 1 ? AMBER : RED;
      ctx.fillRect(x, y, barW, barH);
    });

    ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${maxS.toFixed(1)}¢`, pad.l - 4, pad.t + 8);
    ctx.fillText('0¢', pad.l - 4, h - pad.b);
    ctx.fillStyle = AMBER; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SPREAD CAPTURED (¢)', w / 2, h - 4);
  }, [fills]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: 4 }} />;
}

const TABS = ['DASHBOARD', 'ORDER BOOK', 'FILLS', 'RISK'] as const;
type Tab = typeof TABS[number];

export default function MarketMakerUI2() {
  const [tab, setTab] = useState<Tab>('DASHBOARD');
  const [data] = useState(() => genData());
  const [quoting, setQuoting] = useState(true);
  const [spreadBps, setSpreadBps] = useState(2);
  const [skewBps, setSkewBps] = useState(0);
  const [sizeQty, setSizeQty] = useState(100);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CYAN }}>⚡ MARKET MAKER</span>
          <span style={{ color: MUTED, fontSize: 11 }}>AAPL • ${data.stats.midPrice.toFixed(2)}</span>
          <span style={{ color: MUTED, fontSize: 10 }}>Spread: {(data.stats.spread * 100).toFixed(1)}¢</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setQuoting(!quoting)} style={{
            padding: '4px 14px', borderRadius: 4, fontWeight: 700, fontSize: 11, cursor: 'pointer', border: 'none',
            background: quoting ? GREEN : RED, color: '#fff',
          }}>{quoting ? '● QUOTING' : '○ PAUSED'}</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: MUTED }}>P/L</div>
            <div style={{ fontWeight: 700, color: data.stats.totalPnl > 0 ? GREEN : RED, fontSize: 14 }}>
              ${data.stats.totalPnl.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? CYAN : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${CYAN}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'DASHBOARD' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {/* Stats Grid */}
            <div style={panelStyle}>
              <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>PERFORMANCE</span>
              {[
                { l: 'Spread Capture', v: `$${data.stats.spreadCapture.toFixed(2)}`, c: GREEN },
                { l: 'Adverse Selection', v: `$${data.stats.adverseSelection.toFixed(2)}`, c: RED },
                { l: 'Inventory P/L', v: `$${data.stats.inventoryPnl.toFixed(2)}`, c: data.stats.inventoryPnl > 0 ? GREEN : RED },
                { l: 'Total P/L', v: `$${data.stats.totalPnl.toFixed(2)}`, c: data.stats.totalPnl > 0 ? GREEN : RED },
                { l: 'Sharpe Ratio', v: data.stats.sharpe.toFixed(2), c: data.stats.sharpe > 2 ? GREEN : AMBER },
                { l: 'Turnover', v: `$${(data.stats.turnover / 1000).toFixed(0)}K` },
              ].map(m => (
                <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                  <span style={{ color: MUTED }}>{m.l}</span>
                  <span style={{ color: (m as any).c || '#eee', fontWeight: 700 }}>{m.v}</span>
                </div>
              ))}
            </div>

            <div style={panelStyle}>
              <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>QUOTING ENGINE</span>
              {[
                { l: 'Quote Rate', v: `${data.stats.quoteRate.toFixed(1)}%` },
                { l: 'Fill Rate', v: `${data.stats.fillRate.toFixed(1)}%` },
                { l: 'Cancel Rate', v: `${data.stats.cancelRate.toFixed(1)}%` },
                { l: 'Avg Hold Time', v: `${data.stats.avgHoldTime.toFixed(1)}s` },
              ].map(m => (
                <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                  <span style={{ color: MUTED }}>{m.l}</span>
                  <span style={{ fontWeight: 600 }}>{m.v}</span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 10 }}>PARAMETERS</span>
                {[
                  { l: 'Spread (bps)', v: spreadBps, set: setSpreadBps, min: 1, max: 10 },
                  { l: 'Skew (bps)', v: skewBps, set: setSkewBps, min: -5, max: 5 },
                  { l: 'Size', v: sizeQty, set: setSizeQty, min: 10, max: 500 },
                ].map(p => (
                  <div key={p.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 10 }}>
                    <span style={{ color: MUTED }}>{p.l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="range" min={p.min} max={p.max} value={p.v} onChange={e => p.set(+e.target.value)}
                        style={{ width: 80, accentColor: CYAN }} />
                      <span style={{ fontWeight: 600, width: 30, textAlign: 'right' }}>{p.v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={panelStyle}>
              <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>INVENTORY</span>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: data.stats.inventory > 0 ? GREEN : data.stats.inventory < 0 ? RED : '#eee' }}>
                  {data.stats.inventory > 0 ? '+' : ''}{data.stats.inventory}
                </div>
                <div style={{ fontSize: 9, color: MUTED }}>shares</div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#444',
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: data.stats.inventory > 0 ? '50%' : `${50 + (data.stats.inventory / data.stats.positionLimit) * 50}%`,
                      width: `${Math.abs(data.stats.inventory) / data.stats.positionLimit * 50}%`,
                      height: '100%', borderRadius: 4,
                      background: Math.abs(data.stats.inventory) / data.stats.positionLimit > 0.7 ? RED : CYAN,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: MUTED, marginTop: 2 }}>
                    <span>-{data.stats.positionLimit}</span><span>0</span><span>+{data.stats.positionLimit}</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <InventoryChart history={data.invHistory} />
              </div>
            </div>
          </div>
        )}

        {tab === 'ORDER BOOK' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: GREEN, fontWeight: 600, fontSize: 11 }}>BIDS</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 6 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Price', 'Size', 'Total', 'My Qty'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.levels.filter(l => l.bidSize > 0).sort((a, b) => b.price - a.price).map((l, i) => {
                    const maxSize = Math.max(...data.levels.filter(lv => lv.bidSize > 0).map(lv => lv.bidSize));
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22`, position: 'relative' }}>
                        <td style={{ padding: '3px 6px', textAlign: 'right', position: 'relative', zIndex: 1 }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(l.bidSize / maxSize) * 100}%`, background: `${GREEN}11` }} />
                          <span style={{ color: GREEN, fontWeight: i === 0 ? 700 : 400, position: 'relative' }}>${l.price.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right' }}>{l.bidSize}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: MUTED }}>
                          {data.levels.filter(lv => lv.bidSize > 0 && lv.price >= l.price).reduce((s2, lv) => s2 + lv.bidSize, 0)}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: i < 3 ? CYAN : MUTED }}>
                          {i < 3 ? sizeQty : 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={panelStyle}>
              <span style={{ color: RED, fontWeight: 600, fontSize: 11 }}>ASKS</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 6 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['My Qty', 'Total', 'Size', 'Price'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.levels.filter(l => l.askSize > 0).sort((a, b) => a.price - b.price).map((l, i) => {
                    const maxSize = Math.max(...data.levels.filter(lv => lv.askSize > 0).map(lv => lv.askSize));
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: i < 3 ? CYAN : MUTED }}>
                          {i < 3 ? sizeQty : 0}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: MUTED }}>
                          {data.levels.filter(lv => lv.askSize > 0 && lv.price <= l.price).reduce((s2, lv) => s2 + lv.askSize, 0)}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right' }}>{l.askSize}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', position: 'relative' }}>
                          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(l.askSize / maxSize) * 100}%`, background: `${RED}11` }} />
                          <span style={{ color: RED, fontWeight: i === 0 ? 700 : 400, position: 'relative' }}>${l.price.toFixed(2)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'FILLS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>FILL LOG</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 6 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Time', 'Side', 'Price', 'Size', 'Spread', 'Adverse', 'P/L'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.fills.map(f => (
                    <tr key={f.id} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9, color: MUTED }}>{f.time}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        <span style={{ color: f.side === 'BUY' ? GREEN : RED, fontWeight: 600, padding: '1px 4px', borderRadius: 2, background: f.side === 'BUY' ? `${GREEN}11` : `${RED}11`, fontSize: 9 }}>{f.side}</span>
                      </td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>${f.price.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{f.size}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: GREEN }}>{(f.spread * 100).toFixed(1)}¢</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: RED }}>{(f.adverse * 100).toFixed(1)}¢</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: f.pnl > 0 ? GREEN : RED, fontWeight: 700 }}>
                        {f.pnl > 0 ? '+' : ''}${f.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={panelStyle}>
                <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>SPREAD CAPTURE</span>
                <SpreadChart fills={data.fills} />
              </div>
              <div style={panelStyle}>
                <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>FILL SUMMARY</span>
                {[
                  { l: 'Total Fills', v: data.fills.length },
                  { l: 'Buy Fills', v: data.fills.filter(f => f.side === 'BUY').length, c: GREEN },
                  { l: 'Sell Fills', v: data.fills.filter(f => f.side === 'SELL').length, c: RED },
                  { l: 'Avg Spread', v: `${(data.fills.reduce((s2, f) => s2 + f.spread, 0) / data.fills.length * 100).toFixed(1)}¢` },
                  { l: 'Total P/L', v: `$${data.fills.reduce((s2, f) => s2 + f.pnl, 0).toFixed(2)}`, c: data.fills.reduce((s2, f) => s2 + f.pnl, 0) > 0 ? GREEN : RED },
                ].map(m => (
                  <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ color: MUTED }}>{m.l}</span>
                    <span style={{ color: (m as any).c || '#eee', fontWeight: 600 }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'RISK' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: RED, fontWeight: 600, fontSize: 11 }}>RISK LIMITS</span>
              {[
                { l: 'Position Limit', v: `±${data.stats.positionLimit}`, cur: Math.abs(data.stats.inventory), max: data.stats.positionLimit },
                { l: 'Daily Loss Limit', v: '$5,000', cur: Math.max(0, -data.stats.totalPnl), max: 5000 },
                { l: 'Quote Utilization', v: `${data.stats.quoteRate.toFixed(0)}%`, cur: data.stats.quoteRate, max: 100 },
              ].map(m => (
                <div key={m.l} style={{ padding: '6px 0', borderBottom: `1px solid ${BORDER}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: MUTED }}>{m.l}</span>
                    <span style={{ fontWeight: 600, color: m.cur / m.max > 0.8 ? RED : m.cur / m.max > 0.5 ? AMBER : GREEN }}>{m.v}</span>
                  </div>
                  <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                    <div style={{ width: `${Math.min(100, (m.cur / m.max) * 100)}%`, height: '100%', borderRadius: 3,
                      background: m.cur / m.max > 0.8 ? RED : m.cur / m.max > 0.5 ? AMBER : GREEN }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>MICROSTRUCTURE</span>
              {[
                { l: 'Bid-Ask Imbalance', v: `${((data.stats.bidVol / (data.stats.bidVol + data.stats.askVol)) * 100).toFixed(0)}% / ${((data.stats.askVol / (data.stats.bidVol + data.stats.askVol)) * 100).toFixed(0)}%` },
                { l: 'Bid Volume', v: data.stats.bidVol.toLocaleString(), c: GREEN },
                { l: 'Ask Volume', v: data.stats.askVol.toLocaleString(), c: RED },
                { l: 'Effective Spread', v: `${(data.stats.spread * 100).toFixed(1)}¢` },
                { l: 'Quoted Spread', v: `${(data.stats.spread * 100 * 1.1).toFixed(1)}¢` },
                { l: 'Price Impact', v: `${(data.stats.spread * 100 * 0.3).toFixed(2)}¢` },
                { l: 'Realized Spread', v: `${(data.stats.spread * 100 * 0.7).toFixed(2)}¢` },
              ].map(m => (
                <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                  <span style={{ color: MUTED }}>{m.l}</span>
                  <span style={{ color: (m as any).c || '#eee', fontWeight: 600 }}>{m.v}</span>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: CYAN, fontWeight: 600, fontSize: 11 }}>INVENTORY RISK</span>
              <InventoryChart history={data.invHistory} />
              <div style={{ marginTop: 8, fontSize: 10 }}>
                {[
                  { l: 'Current Position', v: `${data.stats.inventory > 0 ? '+' : ''}${data.stats.inventory}`, c: data.stats.inventory > 0 ? GREEN : RED },
                  { l: 'Inventory P/L', v: `$${data.stats.inventoryPnl.toFixed(0)}`, c: data.stats.inventoryPnl > 0 ? GREEN : RED },
                  { l: 'Avg Hold Time', v: `${data.stats.avgHoldTime.toFixed(1)}s` },
                  { l: 'Position Util', v: `${(Math.abs(data.stats.inventory) / data.stats.positionLimit * 100).toFixed(0)}%` },
                ].map(m => (
                  <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ color: MUTED }}>{m.l}</span>
                    <span style={{ color: (m as any).c || '#eee', fontWeight: 600 }}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
