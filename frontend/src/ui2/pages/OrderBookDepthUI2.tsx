/**
 * OrderBookDepthUI2 — Level 2 Market Depth, Time & Sales, Order Flow
 * Comprehensive order book visualization with DOM ladder, volume profile,
 * cumulative delta, and trade reconstruction.
 */
import { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface OrderLevel { price: number; bidQty: number; askQty: number; bidOrders: number; askOrders: number; }
interface Trade { id: number; time: string; price: number; qty: number; side: 'buy' | 'sell'; exchange: string; }
interface ImbalanceBar { price: number; delta: number; cumDelta: number; buyVol: number; sellVol: number; }

/* ─── Mock Data Generation ───────────────────────────────────────────── */
const BASE_PRICE = 187.42;
const TICK = 0.01;

function generateOrderBook(levels: number = 25): OrderLevel[] {
  const book: OrderLevel[] = [];
  for (let i = levels - 1; i >= 0; i--) {
    const askPrice = BASE_PRICE + (i + 1) * TICK;
    const bidPrice = BASE_PRICE - i * TICK;
    const askQty = Math.floor(Math.random() * 5000 + 100);
    const bidQty = Math.floor(Math.random() * 5000 + 100);
    book.push({
      price: Number(((askPrice + bidPrice) / 2 + (i - levels / 2) * TICK).toFixed(2)),
      bidQty: i < levels ? bidQty : 0,
      askQty: i < levels ? askQty : 0,
      bidOrders: Math.floor(Math.random() * 50 + 1),
      askOrders: Math.floor(Math.random() * 50 + 1),
    });
  }
  // Sort by price descending for display
  book.sort((a, b) => b.price - a.price);
  // Assign bid/ask properly: top half = asks, bottom half = bids
  const mid = Math.floor(book.length / 2);
  for (let i = 0; i < book.length; i++) {
    if (i < mid) { book[i].bidQty = 0; book[i].bidOrders = 0; }
    else { book[i].askQty = 0; book[i].askOrders = 0; }
  }
  return book;
}

function generateTrades(count: number = 100): Trade[] {
  const exchanges = ['NYSE', 'ARCA', 'BATS', 'IEX', 'EDGX', 'DARK'];
  const trades: Trade[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.48 ? 'buy' : 'sell';
    const offset = (Math.random() - 0.5) * 0.5;
    trades.push({
      id: i,
      time: new Date(now - i * 1200).toLocaleTimeString('en-US', { hour12: false }),
      price: Number((BASE_PRICE + offset).toFixed(2)),
      qty: Math.floor(Math.random() * 2000 + 10),
      side,
      exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
    });
  }
  return trades;
}

function generateImbalance(): ImbalanceBar[] {
  const bars: ImbalanceBar[] = [];
  let cumDelta = 0;
  for (let i = 0; i < 40; i++) {
    const price = Number((BASE_PRICE - 0.20 + i * TICK).toFixed(2));
    const buyVol = Math.floor(Math.random() * 8000 + 500);
    const sellVol = Math.floor(Math.random() * 8000 + 500);
    const delta = buyVol - sellVol;
    cumDelta += delta;
    bars.push({ price, delta, cumDelta, buyVol, sellVol });
  }
  return bars;
}

const BOOK = generateOrderBook(40);
const TRADES = generateTrades(200);
const IMBALANCE = generateImbalance();

/* ─── Canvas: Depth Chart ────────────────────────────────────────────── */
function DepthChart({ book }: { book: OrderLevel[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const bids = book.filter(l => l.bidQty > 0).sort((a, b) => b.price - a.price);
    const asks = book.filter(l => l.askQty > 0).sort((a, b) => a.price - b.price);
    
    // Accumulate
    let bidCum: { price: number; cum: number }[] = [];
    let askCum: { price: number; cum: number }[] = [];
    let sum = 0;
    bids.forEach(l => { sum += l.bidQty; bidCum.push({ price: l.price, cum: sum }); });
    sum = 0;
    asks.forEach(l => { sum += l.askQty; askCum.push({ price: l.price, cum: sum }); });
    
    const allPrices = [...bidCum, ...askCum].map(p => p.price);
    const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
    const maxCum = Math.max(...bidCum.map(b => b.cum), ...askCum.map(a => a.cum));
    const px = (p: number) => ((p - minP) / (maxP - minP)) * w;
    const py = (v: number) => h - 30 - (v / maxCum) * (h - 50);

    // Bid fill
    ctx.beginPath();
    ctx.moveTo(px(bids[0]?.price ?? minP), h - 30);
    bidCum.forEach(b => ctx.lineTo(px(b.price), py(b.cum)));
    ctx.lineTo(px(bidCum[bidCum.length - 1]?.price ?? minP), h - 30);
    ctx.closePath();
    ctx.fillStyle = 'rgba(38,166,154,0.2)'; ctx.fill();
    ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5; ctx.beginPath();
    bidCum.forEach((b, i) => i === 0 ? ctx.moveTo(px(b.price), py(b.cum)) : ctx.lineTo(px(b.price), py(b.cum)));
    ctx.stroke();

    // Ask fill
    ctx.beginPath();
    ctx.moveTo(px(asks[0]?.price ?? maxP), h - 30);
    askCum.forEach(a => ctx.lineTo(px(a.price), py(a.cum)));
    ctx.lineTo(px(askCum[askCum.length - 1]?.price ?? maxP), h - 30);
    ctx.closePath();
    ctx.fillStyle = 'rgba(239,83,80,0.2)'; ctx.fill();
    ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.beginPath();
    askCum.forEach((a, i) => i === 0 ? ctx.moveTo(px(a.price), py(a.cum)) : ctx.lineTo(px(a.price), py(a.cum)));
    ctx.stroke();

    // Mid price line
    const midPrice = (bids[0]?.price ?? BASE_PRICE + (asks[0]?.price ?? BASE_PRICE)) / 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(midPrice), 10); ctx.lineTo(px(midPrice), h - 30); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const p = minP + (maxP - minP) * (i / 4);
      ctx.fillText(p.toFixed(2), px(p), h - 12);
    }
    ctx.fillStyle = GREEN; ctx.textAlign = 'left';
    ctx.fillText('BIDS', 8, 16);
    ctx.fillStyle = RED; ctx.textAlign = 'right';
    ctx.fillText('ASKS', w - 8, 16);
  }, [book]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: 4 }} />;
}

/* ─── Canvas: Cumulative Delta ───────────────────────────────────────── */
function CumulativeDeltaChart({ data }: { data: ImbalanceBar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const deltas = data.map(d => d.cumDelta);
    const maxD = Math.max(...deltas.map(Math.abs));
    const midY = h / 2;
    const step = w / data.length;

    // Zero line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    // Delta bars
    data.forEach((d, i) => {
      const x = i * step;
      const barH = (d.cumDelta / maxD) * (h / 2 - 20);
      ctx.fillStyle = d.cumDelta >= 0 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)';
      if (d.cumDelta >= 0) {
        ctx.fillRect(x + 1, midY - barH, step - 2, barH);
      } else {
        ctx.fillRect(x + 1, midY, step - 2, -barH);
      }
    });

    // Line overlay
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = i * step + step / 2;
      const y = midY - (d.cumDelta / maxD) * (h / 2 - 20);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = MUTED; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText('CUMULATIVE DELTA', 8, 14);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: 4 }} />;
}

/* ─── Canvas: Volume Profile ─────────────────────────────────────────── */
function VolumeProfileChart({ data }: { data: ImbalanceBar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const maxVol = Math.max(...data.map(d => d.buyVol + d.sellVol));
    const barH = (h - 30) / data.length;

    data.forEach((d, i) => {
      const y = i * barH + 15;
      const totalW = ((d.buyVol + d.sellVol) / maxVol) * (w - 80);
      const buyW = (d.buyVol / (d.buyVol + d.sellVol)) * totalW;
      const sellW = totalW - buyW;

      // Price label
      ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'right';
      ctx.fillText(d.price.toFixed(2), 50, y + barH / 2 + 3);

      // Buy bar (left to right from 55)
      ctx.fillStyle = 'rgba(38,166,154,0.6)';
      ctx.fillRect(55, y + 1, buyW, barH - 2);

      // Sell bar (continues from buy)
      ctx.fillStyle = 'rgba(239,83,80,0.6)';
      ctx.fillRect(55 + buyW, y + 1, sellW, barH - 2);

      // POC highlight (point of control — highest volume)
      if (d.buyVol + d.sellVol === maxVol) {
        ctx.strokeStyle = AMBER; ctx.lineWidth = 1;
        ctx.strokeRect(55, y, totalW, barH);
        ctx.fillStyle = AMBER; ctx.font = '8px monospace'; ctx.textAlign = 'left';
        ctx.fillText('POC', 55 + totalW + 4, y + barH / 2 + 3);
      }
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 300, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['DEPTH LADDER', 'TIME & SALES', 'ORDER FLOW', 'VOLUME PROFILE'] as const;
type Tab = typeof TABS[number];

export default function OrderBookDepthUI2() {
  const [tab, setTab] = useState<Tab>('DEPTH LADDER');
  const [highlight, setHighlight] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterExchange, setFilterExchange] = useState<string>('ALL');
  const [showOrders, setShowOrders] = useState(true);

  const maxQty = useMemo(() => Math.max(...BOOK.map(l => Math.max(l.bidQty, l.askQty))), []);
  const midIdx = useMemo(() => BOOK.findIndex(l => l.bidQty > 0), []);

  const totalBidVol = useMemo(() => BOOK.reduce((s, l) => s + l.bidQty, 0), []);
  const totalAskVol = useMemo(() => BOOK.reduce((s, l) => s + l.askQty, 0), []);
  const imbalanceRatio = totalBidVol / (totalBidVol + totalAskVol);
  const spread = useMemo(() => {
    const bestBid = BOOK.filter(l => l.bidQty > 0).sort((a, b) => b.price - a.price)[0]?.price ?? 0;
    const bestAsk = BOOK.filter(l => l.askQty > 0).sort((a, b) => a.price - b.price)[0]?.price ?? 0;
    return bestAsk - bestBid;
  }, []);

  const filteredTrades = useMemo(() =>
    filterExchange === 'ALL' ? TRADES : TRADES.filter(t => t.exchange === filterExchange)
  , [filterExchange]);

  const exchanges = useMemo(() => ['ALL', ...new Set(TRADES.map(t => t.exchange))], []);

  const buyVol = useMemo(() => TRADES.reduce((s, t) => s + (t.side === 'buy' ? t.qty : 0), 0), []);
  const sellVol = useMemo(() => TRADES.reduce((s, t) => s + (t.side === 'sell' ? t.qty : 0), 0), []);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 8 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>⬡ ORDER BOOK — AAPL</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>${BASE_PRICE.toFixed(2)}</span>
          <span style={{ color: GREEN, fontSize: 12 }}>+1.24 (+0.67%)</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11 }}>
          <div>
            <span style={{ color: MUTED }}>SPREAD </span>
            <span style={{ color: AMBER, fontWeight: 600 }}>${spread.toFixed(2)} ({(spread / BASE_PRICE * 100).toFixed(3)}%)</span>
          </div>
          <div>
            <span style={{ color: MUTED }}>BID/ASK </span>
            <span style={{ color: GREEN }}>{(totalBidVol / 1000).toFixed(0)}K</span>
            <span style={{ color: MUTED }}>/</span>
            <span style={{ color: RED }}>{(totalAskVol / 1000).toFixed(0)}K</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: MUTED }}>IMBALANCE</span>
            <div style={{ width: 60, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${imbalanceRatio * 100}%`, height: '100%', background: imbalanceRatio > 0.5 ? GREEN : RED, borderRadius: 4 }} />
            </div>
            <span style={{ color: imbalanceRatio > 0.5 ? GREEN : RED, fontWeight: 600 }}>
              {(imbalanceRatio * 100).toFixed(1)}%
            </span>
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

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'DEPTH LADDER' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, height: '100%' }}>
            {/* Main DOM Ladder */}
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>DOM LADDER</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: MUTED, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showOrders} onChange={() => setShowOrders(!showOrders)} style={{ accentColor: AMBER }} />
                  Show Orders
                </label>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: PANEL, zIndex: 1 }}>
                      {showOrders && <th style={{ padding: '4px 6px', color: MUTED, textAlign: 'right', fontSize: 10 }}>#BID</th>}
                      <th style={{ padding: '4px 6px', color: GREEN, textAlign: 'right', fontSize: 10 }}>BID SIZE</th>
                      <th style={{ padding: '4px 6px', color: GREEN, textAlign: 'right', fontSize: 10 }}>BID</th>
                      <th style={{ padding: '4px 6px', color: AMBER, textAlign: 'center', fontSize: 10 }}>PRICE</th>
                      <th style={{ padding: '4px 6px', color: RED, textAlign: 'left', fontSize: 10 }}>ASK</th>
                      <th style={{ padding: '4px 6px', color: RED, textAlign: 'left', fontSize: 10 }}>ASK SIZE</th>
                      {showOrders && <th style={{ padding: '4px 6px', color: MUTED, textAlign: 'left', fontSize: 10 }}>#ASK</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {BOOK.map((level, i) => {
                      const isMid = i === midIdx;
                      const bidBar = (level.bidQty / maxQty) * 100;
                      const askBar = (level.askQty / maxQty) * 100;
                      return (
                        <tr key={i}
                          onMouseEnter={() => setHighlight(i)}
                          onMouseLeave={() => setHighlight(null)}
                          style={{
                            background: highlight === i ? '#1a1a1a' : isMid ? 'rgba(245,166,35,0.08)' : 'transparent',
                            borderBottom: isMid ? `1px solid ${AMBER}` : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {showOrders && (
                            <td style={{ padding: '3px 6px', textAlign: 'right', color: '#555', fontSize: 10 }}>
                              {level.bidOrders > 0 ? level.bidOrders : ''}
                            </td>
                          )}
                          <td style={{ padding: '3px 6px', textAlign: 'right', position: 'relative' }}>
                            {level.bidQty > 0 && (
                              <>
                                <div style={{
                                  position: 'absolute', right: 0, top: 0, bottom: 0,
                                  width: `${bidBar}%`, background: 'rgba(38,166,154,0.15)',
                                }} />
                                <span style={{ position: 'relative', color: GREEN, fontWeight: level.bidQty > maxQty * 0.7 ? 700 : 400 }}>
                                  {level.bidQty.toLocaleString()}
                                </span>
                              </>
                            )}
                          </td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: GREEN, fontFamily: 'monospace' }}>
                            {level.bidQty > 0 ? level.price.toFixed(2) : ''}
                          </td>
                          <td style={{
                            padding: '3px 6px', textAlign: 'center',
                            color: isMid ? AMBER : '#aaa',
                            fontWeight: isMid ? 700 : 500,
                            fontFamily: 'monospace', fontSize: isMid ? 12 : 11
                          }}>
                            {level.price.toFixed(2)}
                          </td>
                          <td style={{ padding: '3px 6px', textAlign: 'left', color: RED, fontFamily: 'monospace' }}>
                            {level.askQty > 0 ? level.price.toFixed(2) : ''}
                          </td>
                          <td style={{ padding: '3px 6px', textAlign: 'left', position: 'relative' }}>
                            {level.askQty > 0 && (
                              <>
                                <div style={{
                                  position: 'absolute', left: 0, top: 0, bottom: 0,
                                  width: `${askBar}%`, background: 'rgba(239,83,80,0.15)',
                                }} />
                                <span style={{ position: 'relative', color: RED, fontWeight: level.askQty > maxQty * 0.7 ? 700 : 400 }}>
                                  {level.askQty.toLocaleString()}
                                </span>
                              </>
                            )}
                          </td>
                          {showOrders && (
                            <td style={{ padding: '3px 6px', textAlign: 'left', color: '#555', fontSize: 10 }}>
                              {level.askOrders > 0 ? level.askOrders : ''}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Side Panel: Depth Chart + Pressure */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>DEPTH CHART</span>
                <DepthChart book={BOOK} />
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>BOOK PRESSURE</span>
                <div style={{ marginTop: 8 }}>
                  {/* Pressure gauge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: GREEN }}>BUY {(imbalanceRatio * 100).toFixed(0)}%</span>
                    <span style={{ color: RED }}>SELL {((1 - imbalanceRatio) * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 12, background: '#333', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${imbalanceRatio * 100}%`, background: GREEN, transition: 'width 0.3s' }} />
                    <div style={{ width: `${(1 - imbalanceRatio) * 100}%`, background: RED }} />
                  </div>
                  {/* Level breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 10 }}>
                    {[
                      { label: 'Bid Volume', val: totalBidVol, color: GREEN },
                      { label: 'Ask Volume', val: totalAskVol, color: RED },
                      { label: 'Bid Levels', val: BOOK.filter(l => l.bidQty > 0).length, color: GREEN },
                      { label: 'Ask Levels', val: BOOK.filter(l => l.askQty > 0).length, color: RED },
                      { label: 'Max Bid', val: Math.max(...BOOK.map(l => l.bidQty)), color: GREEN },
                      { label: 'Max Ask', val: Math.max(...BOOK.map(l => l.askQty)), color: RED },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: MUTED }}>{m.label}</span>
                        <span style={{ color: m.color, fontWeight: 600 }}>{m.val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'TIME & SALES' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, height: '100%' }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TAPE — TIME & SALES</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={filterExchange} onChange={e => setFilterExchange(e.target.value)}
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '2px 8px', fontSize: 10 }}>
                    {exchanges.map(ex => <option key={ex}>{ex}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: MUTED, cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} style={{ accentColor: AMBER }} />
                    Auto-scroll
                  </label>
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: PANEL }}>
                      {['TIME', 'PRICE', 'SIZE', 'SIDE', 'EXCHANGE'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', color: MUTED, textAlign: 'left', fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                        <td style={{ padding: '3px 8px', color: MUTED, fontFamily: 'monospace', fontSize: 10 }}>{t.time}</td>
                        <td style={{ padding: '3px 8px', color: t.side === 'buy' ? GREEN : RED, fontFamily: 'monospace', fontWeight: 600 }}>{t.price.toFixed(2)}</td>
                        <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{t.qty.toLocaleString()}</td>
                        <td style={{ padding: '3px 8px' }}>
                          <span style={{
                            display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 9,
                            background: t.side === 'buy' ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)',
                            color: t.side === 'buy' ? GREEN : RED, fontWeight: 600, textTransform: 'uppercase'
                          }}>{t.side}</span>
                        </td>
                        <td style={{ padding: '3px 8px', color: '#666', fontSize: 10 }}>{t.exchange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>TRADE STATS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {[
                    { label: 'Total Trades', val: filteredTrades.length.toLocaleString(), color: '#eee' },
                    { label: 'Buy Volume', val: buyVol.toLocaleString(), color: GREEN },
                    { label: 'Sell Volume', val: sellVol.toLocaleString(), color: RED },
                    { label: 'Net Delta', val: (buyVol - sellVol).toLocaleString(), color: buyVol > sellVol ? GREEN : RED },
                    { label: 'VWAP', val: `$${(TRADES.reduce((s, t) => s + t.price * t.qty, 0) / TRADES.reduce((s, t) => s + t.qty, 0)).toFixed(2)}`, color: AMBER },
                    { label: 'Avg Size', val: Math.floor(TRADES.reduce((s, t) => s + t.qty, 0) / TRADES.length).toLocaleString(), color: '#eee' },
                    { label: 'High', val: `$${Math.max(...TRADES.map(t => t.price)).toFixed(2)}`, color: GREEN },
                    { label: 'Low', val: `$${Math.min(...TRADES.map(t => t.price)).toFixed(2)}`, color: RED },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: MUTED }}>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 600, fontFamily: 'monospace' }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EXCHANGE BREAKDOWN</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {exchanges.filter(e => e !== 'ALL').map(ex => {
                    const exTrades = TRADES.filter(t => t.exchange === ex);
                    const exVol = exTrades.reduce((s, t) => s + t.qty, 0);
                    const pct = (exVol / TRADES.reduce((s, t) => s + t.qty, 0)) * 100;
                    return (
                      <div key={ex}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: '#ccc' }}>{ex}</span>
                          <span style={{ color: MUTED }}>{pct.toFixed(1)}% ({exTrades.length})</span>
                        </div>
                        <div style={{ height: 4, background: '#222', borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: AMBER, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'ORDER FLOW' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CUMULATIVE DELTA</span>
              <CumulativeDeltaChart data={IMBALANCE} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, fontSize: 10 }}>
                {[
                  { label: 'Net Delta', val: IMBALANCE[IMBALANCE.length - 1].cumDelta.toLocaleString(), c: IMBALANCE[IMBALANCE.length - 1].cumDelta >= 0 ? GREEN : RED },
                  { label: 'Peak +', val: Math.max(...IMBALANCE.map(d => d.cumDelta)).toLocaleString(), c: GREEN },
                  { label: 'Peak −', val: Math.min(...IMBALANCE.map(d => d.cumDelta)).toLocaleString(), c: RED },
                ].map(m => (
                  <div key={m.label} style={{ background: '#0a0a0a', borderRadius: 4, padding: 8, textAlign: 'center' }}>
                    <div style={{ color: MUTED, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ color: m.c, fontWeight: 700, fontSize: 13 }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>IMBALANCE TABLE</span>
              <div style={{ overflowY: 'auto', maxHeight: 400, marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: PANEL }}>
                      {['PRICE', 'BUY VOL', 'SELL VOL', 'DELTA', 'CUM Δ', 'IMBAL %'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: MUTED, textAlign: 'right', fontSize: 9, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {IMBALANCE.map((d, i) => {
                      const imbal = d.buyVol / (d.buyVol + d.sellVol) * 100;
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${BORDER}11` }}>
                          <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#ccc' }}>{d.price.toFixed(2)}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: GREEN }}>{d.buyVol.toLocaleString()}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: RED }}>{d.sellVol.toLocaleString()}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: d.delta >= 0 ? GREEN : RED, fontWeight: 600 }}>{d.delta.toLocaleString()}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: d.cumDelta >= 0 ? GREEN : RED }}>{d.cumDelta.toLocaleString()}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-block', minWidth: 40, padding: '1px 4px', borderRadius: 3,
                              background: imbal > 60 ? 'rgba(38,166,154,0.15)' : imbal < 40 ? 'rgba(239,83,80,0.15)' : 'transparent',
                              color: imbal > 60 ? GREEN : imbal < 40 ? RED : MUTED, fontWeight: 600, textAlign: 'center'
                            }}>{imbal.toFixed(0)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'VOLUME PROFILE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>VOLUME AT PRICE</span>
              <VolumeProfileChart data={IMBALANCE} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(38,166,154,0.6)', marginRight: 4 }} />Buy Volume</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(239,83,80,0.6)', marginRight: 4 }} />Sell Volume</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, border: `1px solid ${AMBER}`, marginRight: 4 }} />POC</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PROFILE STATS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 11 }}>
                  {(() => {
                    const poc = IMBALANCE.reduce((m, d) => d.buyVol + d.sellVol > m.buyVol + m.sellVol ? d : m, IMBALANCE[0]);
                    const totalVol = IMBALANCE.reduce((s, d) => s + d.buyVol + d.sellVol, 0);
                    const vah = IMBALANCE.filter(d => d.buyVol + d.sellVol > totalVol / IMBALANCE.length * 0.7);
                    return [
                      { label: 'POC Price', val: `$${poc.price.toFixed(2)}`, color: AMBER },
                      { label: 'POC Volume', val: (poc.buyVol + poc.sellVol).toLocaleString(), color: '#eee' },
                      { label: 'Total Volume', val: totalVol.toLocaleString(), color: '#eee' },
                      { label: 'Value Area High', val: `$${(vah[vah.length - 1]?.price ?? 0).toFixed(2)}`, color: GREEN },
                      { label: 'Value Area Low', val: `$${(vah[0]?.price ?? 0).toFixed(2)}`, color: RED },
                      { label: 'VA Width', val: `$${((vah[vah.length - 1]?.price ?? 0) - (vah[0]?.price ?? 0)).toFixed(2)}`, color: MUTED },
                      { label: 'Buy Dominance', val: `${(IMBALANCE.reduce((s, d) => s + d.buyVol, 0) / totalVol * 100).toFixed(1)}%`, color: GREEN },
                    ];
                  })().map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: MUTED }}>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 600, fontFamily: 'monospace' }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>LEGEND</span>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                  <div><strong style={{ color: AMBER }}>POC</strong> — Point of Control: highest volume price level</div>
                  <div><strong style={{ color: GREEN }}>VAH</strong> — Value Area High: upper boundary where 70% of volume traded</div>
                  <div><strong style={{ color: RED }}>VAL</strong> — Value Area Low: lower boundary of the value area</div>
                  <div><strong style={{ color: '#eee' }}>Volume Profile</strong> — Distribution of volume across price levels</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
