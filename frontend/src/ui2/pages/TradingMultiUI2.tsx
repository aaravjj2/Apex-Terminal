/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Multi-Asset Trading (UI2)                           │
 * │  Bloomberg-grade multi-asset trading with order entry, depth of      │
 * │  market, time & sales, position management, and risk overlay         │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

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
interface Quote {
  symbol: string;
  name: string;
  assetClass: 'equity' | 'options' | 'futures' | 'crypto' | 'fx';
  last: number;
  change: number;
  changePct: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
  cumSize: number;
}

interface TimeSaleEntry {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  exchange: string;
}

interface OrderEntry {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP';
  qty: number;
  price: number;
  stopPrice: number;
  tif: 'DAY' | 'GTC' | 'IOC' | 'FOK' | 'GTD';
  status: 'pending' | 'submitted' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledQty: number;
  avgFillPrice: number;
  timestamp: string;
}

interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  avgEntry: number;
  current: number;
  pnl: number;
  pnlPct: number;
  marketValue: number;
  dayPnl: number;
}

interface RiskMetric {
  label: string;
  value: string | number;
  limit: string | number;
  utilization: number;
  status: 'ok' | 'warn' | 'breach';
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
const WATCHLIST: Quote[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'equity', last: 185.50, change: 2.35, changePct: 1.28, bid: 185.48, ask: 185.52, bidSize: 500, askSize: 300, volume: 45280000, high: 186.20, low: 183.15, open: 183.60, prevClose: 183.15 },
  { symbol: 'MSFT', name: 'Microsoft Corp', assetClass: 'equity', last: 420.85, change: -1.15, changePct: -0.27, bid: 420.82, ask: 420.88, bidSize: 200, askSize: 400, volume: 22150000, high: 423.50, low: 420.10, open: 422.00, prevClose: 422.00 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', assetClass: 'equity', last: 880.25, change: 12.50, changePct: 1.44, bid: 880.20, ask: 880.30, bidSize: 150, askSize: 200, volume: 38500000, high: 885.00, low: 867.75, open: 868.00, prevClose: 867.75 },
  { symbol: 'SPY', name: 'SPDR S&P 500', assetClass: 'equity', last: 510.35, change: 1.85, changePct: 0.36, bid: 510.33, ask: 510.37, bidSize: 2000, askSize: 1500, volume: 65000000, high: 511.50, low: 508.20, open: 508.50, prevClose: 508.50 },
  { symbol: 'BTC/USD', name: 'Bitcoin', assetClass: 'crypto', last: 67500, change: 1250, changePct: 1.89, bid: 67495, ask: 67505, bidSize: 5, askSize: 3, volume: 28000000000, high: 68200, low: 66100, open: 66250, prevClose: 66250 },
  { symbol: 'ETH/USD', name: 'Ethereum', assetClass: 'crypto', last: 3450, change: 85, changePct: 2.52, bid: 3449, ask: 3451, bidSize: 20, askSize: 15, volume: 12000000000, high: 3520, low: 3365, open: 3365, prevClose: 3365 },
  { symbol: 'ES', name: 'E-mini S&P 500', assetClass: 'futures', last: 5125.50, change: 18.25, changePct: 0.36, bid: 5125.25, ask: 5125.75, bidSize: 150, askSize: 200, volume: 1250000, high: 5140.00, low: 5107.25, open: 5107.25, prevClose: 5107.25 },
  { symbol: 'NQ', name: 'E-mini Nasdaq', assetClass: 'futures', last: 18250.00, change: 125.00, changePct: 0.69, bid: 18249.75, ask: 18250.25, bidSize: 100, askSize: 80, volume: 850000, high: 18350.00, low: 18125.00, open: 18125.00, prevClose: 18125.00 },
  { symbol: 'EUR/USD', name: 'Euro / Dollar', assetClass: 'fx', last: 1.0875, change: 0.0025, changePct: 0.23, bid: 1.0874, ask: 1.0876, bidSize: 1000000, askSize: 800000, volume: 0, high: 1.0895, low: 1.0850, open: 1.0850, prevClose: 1.0850 },
  { symbol: 'AAPL240119C185', name: 'AAPL Jan24 185C', assetClass: 'options', last: 5.25, change: 0.85, changePct: 19.32, bid: 5.20, ask: 5.30, bidSize: 50, askSize: 30, volume: 15000, high: 5.80, low: 4.40, open: 4.40, prevClose: 4.40 },
];

function generateOrderBook(quote: Quote): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
  const bids: OrderBookLevel[] = []; const asks: OrderBookLevel[] = [];
  let cumBid = 0, cumAsk = 0;
  const tick = quote.assetClass === 'fx' ? 0.0001 : quote.assetClass === 'crypto' ? 1 : 0.01;
  for (let i = 0; i < 15; i++) {
    const bidSize = Math.round(100 + Math.random() * 2000);
    cumBid += bidSize;
    bids.push({ price: +(quote.bid - i * tick).toFixed(tick < 0.01 ? 4 : 2), size: bidSize, orders: Math.round(1 + Math.random() * 10), cumSize: cumBid });
    const askSize = Math.round(100 + Math.random() * 2000);
    cumAsk += askSize;
    asks.push({ price: +(quote.ask + i * tick).toFixed(tick < 0.01 ? 4 : 2), size: askSize, orders: Math.round(1 + Math.random() * 10), cumSize: cumAsk });
  }
  return { bids, asks };
}

function generateTimeSales(quote: Quote, count: number): TimeSaleEntry[] {
  const exchanges = ['NYSE', 'ARCA', 'BATS', 'IEX', 'EDGX'];
  const entries: TimeSaleEntry[] = [];
  let p = quote.last;
  for (let i = 0; i < count; i++) {
    const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell';
    p += (Math.random() - 0.5) * 0.02;
    entries.push({
      time: Date.now() - i * (1000 + Math.random() * 3000),
      price: +p.toFixed(2), size: Math.round(10 + Math.random() * 500),
      side, exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
    });
  }
  return entries;
}

function generateOrders(): OrderEntry[] {
  return [
    { id: 'ORD-001', symbol: 'AAPL', side: 'BUY', type: 'LIMIT', qty: 100, price: 184.50, stopPrice: 0, tif: 'DAY', status: 'submitted', filledQty: 0, avgFillPrice: 0, timestamp: new Date().toISOString() },
    { id: 'ORD-002', symbol: 'MSFT', side: 'SELL', type: 'MARKET', qty: 50, price: 0, stopPrice: 0, tif: 'DAY', status: 'filled', filledQty: 50, avgFillPrice: 420.85, timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: 'ORD-003', symbol: 'NVDA', side: 'BUY', type: 'STOP_LIMIT', qty: 25, price: 890.00, stopPrice: 885.00, tif: 'GTC', status: 'submitted', filledQty: 0, avgFillPrice: 0, timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 'ORD-004', symbol: 'SPY', side: 'BUY', type: 'LIMIT', qty: 200, price: 509.00, stopPrice: 0, tif: 'DAY', status: 'partial', filledQty: 120, avgFillPrice: 509.00, timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: 'ORD-005', symbol: 'AAPL', side: 'SELL', type: 'TRAILING_STOP', qty: 50, price: 0, stopPrice: 183.00, tif: 'GTC', status: 'submitted', filledQty: 0, avgFillPrice: 0, timestamp: new Date(Date.now() - 1200000).toISOString() },
  ];
}

function generatePositions(): Position[] {
  return [
    { symbol: 'AAPL', side: 'LONG', qty: 200, avgEntry: 180.25, current: 185.50, pnl: 1050, pnlPct: 2.91, marketValue: 37100, dayPnl: 470 },
    { symbol: 'MSFT', side: 'LONG', qty: 50, avgEntry: 415.00, current: 420.85, pnl: 292.50, pnlPct: 1.41, marketValue: 21042.50, dayPnl: -57.50 },
    { symbol: 'NVDA', side: 'SHORT', qty: 10, avgEntry: 895.00, current: 880.25, pnl: 147.50, pnlPct: 1.65, marketValue: -8802.50, dayPnl: 125 },
    { symbol: 'SPY', side: 'LONG', qty: 100, avgEntry: 505.20, current: 510.35, pnl: 515, pnlPct: 1.02, marketValue: 51035, dayPnl: 185 },
    { symbol: 'BTC/USD', side: 'LONG', qty: 0.5, avgEntry: 64000, current: 67500, pnl: 1750, pnlPct: 5.47, marketValue: 33750, dayPnl: 625 },
  ];
}

function generateRiskMetrics(): RiskMetric[] {
  return [
    { label: 'Net Exposure', value: '$134,125', limit: '$500,000', utilization: 26.8, status: 'ok' },
    { label: 'Gross Exposure', value: '$151,730', limit: '$750,000', utilization: 20.2, status: 'ok' },
    { label: 'Day P&L', value: '+$1,347', limit: '-$5,000', utilization: 0, status: 'ok' },
    { label: 'Max Loss', value: '-$850', limit: '-$10,000', utilization: 8.5, status: 'ok' },
    { label: 'Open Orders', value: '4', limit: '50', utilization: 8, status: 'ok' },
    { label: 'Position Count', value: '5', limit: '25', utilization: 20, status: 'ok' },
    { label: 'Buying Power', value: '$245,000', limit: '$500,000', utilization: 51, status: 'ok' },
    { label: 'Margin Used', value: '$75,000', limit: '$250,000', utilization: 30, status: 'ok' },
    { label: 'Concentration', value: '35%', limit: '40%', utilization: 87.5, status: 'warn' },
    { label: 'Beta Exposure', value: '1.15', limit: '2.0', utilization: 57.5, status: 'ok' },
  ];
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function OrderBookPanel({ quote }: { quote: Quote }) {
  const { bids, asks } = useMemo(() => generateOrderBook(quote), [quote]);
  const maxCum = Math.max(bids[bids.length - 1]?.cumSize ?? 1, asks[asks.length - 1]?.cumSize ?? 1);
  const dec = quote.assetClass === 'fx' ? 4 : 2;

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Order Book — {quote.symbol}</div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {/* Bids */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontSize: '7px', color: T.tx3, borderBottom: `1px solid ${T.border}` }}>
            <span>CUM</span><span>SIZE</span><span>#</span><span>BID</span>
          </div>
          {bids.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '8px', fontFamily: T.mono, position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(b.cumSize / maxCum) * 100}%`, background: 'rgba(38,166,154,0.1)' }} />
              <span style={{ color: T.tx3, zIndex: 1 }}>{b.cumSize}</span>
              <span style={{ color: T.tx1, zIndex: 1 }}>{b.size}</span>
              <span style={{ color: T.tx3, zIndex: 1 }}>{b.orders}</span>
              <span style={{ color: T.up, fontWeight: 600, zIndex: 1 }}>{b.price.toFixed(dec)}</span>
            </div>
          ))}
        </div>
        {/* Asks */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', fontSize: '7px', color: T.tx3, borderBottom: `1px solid ${T.border}` }}>
            <span>ASK</span><span>#</span><span>SIZE</span><span>CUM</span>
          </div>
          {asks.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', fontSize: '8px', fontFamily: T.mono, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(a.cumSize / maxCum) * 100}%`, background: 'rgba(239,83,80,0.1)' }} />
              <span style={{ color: T.dn, fontWeight: 600, zIndex: 1 }}>{a.price.toFixed(dec)}</span>
              <span style={{ color: T.tx3, zIndex: 1 }}>{a.orders}</span>
              <span style={{ color: T.tx1, zIndex: 1 }}>{a.size}</span>
              <span style={{ color: T.tx3, zIndex: 1 }}>{a.cumSize}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px', gap: '12px', borderTop: `1px solid ${T.border}`, marginTop: '4px' }}>
        <span style={{ fontSize: '8px', color: T.tx3 }}>Spread: {((quote.ask - quote.bid) * (quote.assetClass === 'fx' ? 10000 : 100)).toFixed(1)} {quote.assetClass === 'fx' ? 'pips' : '¢'}</span>
        <span style={{ fontSize: '8px', color: T.tx3 }}>Mid: {((quote.bid + quote.ask) / 2).toFixed(dec)}</span>
      </div>
    </div>
  );
}

function TimeSalesPanel({ quote }: { quote: Quote }) {
  const entries = useMemo(() => generateTimeSales(quote, 40), [quote]);
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '4px' }}>Time & Sales — {quote.symbol}</div>
      <div style={{ overflow: 'auto', maxHeight: '300px', fontFamily: T.mono, fontSize: '8px' }}>
        {entries.map((e, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '1px 4px',
            background: i % 2 === 0 ? T.bg1 : T.bg2,
          }}>
            <span style={{ color: T.tx3, minWidth: '55px' }}>{new Date(e.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span style={{ color: e.side === 'buy' ? T.up : T.dn, fontWeight: 600, minWidth: '50px', textAlign: 'right' }}>{e.price.toFixed(2)}</span>
            <span style={{ color: T.tx1, minWidth: '35px', textAlign: 'right' }}>{e.size}</span>
            <span style={{ color: T.tx3, minWidth: '35px', textAlign: 'right' }}>{e.exchange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderEntryPanel({ quote, onSubmit }: { quote: Quote; onSubmit: (order: Partial<OrderEntry>) => void }) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderEntry['type']>('LIMIT');
  const [qty, setQty] = useState(100);
  const [price, setPrice] = useState(quote.last);
  const [stopPrice, setStopPrice] = useState(0);
  const [tif, setTif] = useState<OrderEntry['tif']>('DAY');

  useEffect(() => { setPrice(side === 'BUY' ? quote.bid : quote.ask); }, [quote, side]);

  const estimatedCost = qty * (orderType === 'MARKET' ? quote.last : price);

  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Order Entry — {quote.symbol}</div>
      {/* Side Toggle */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '6px' }}>
        {(['BUY', 'SELL'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{
            flex: 1, padding: '6px', border: 'none', borderRadius: T.r, cursor: 'pointer',
            background: side === s ? (s === 'BUY' ? T.up : T.dn) : T.bg3,
            color: side === s ? '#FFF' : T.tx3, fontSize: '11px', fontWeight: 800,
          }}>{s}</button>
        ))}
      </div>
      {/* Order Type */}
      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Type</label>
        <select value={orderType} onChange={e => setOrderType(e.target.value as OrderEntry['type'])}
          style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px 6px', fontSize: '9px', fontFamily: T.mono }}>
          {['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {/* Quantity */}
      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Quantity</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input type="number" value={qty} onChange={e => setQty(+e.target.value)} min={1}
            style={{ flex: 1, background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px 6px', fontSize: '10px', fontFamily: T.mono }} />
          <div style={{ display: 'flex', gap: '2px' }}>
            {[25, 50, 100, 500].map(q => (
              <button key={q} onClick={() => setQty(q)} style={{ background: qty === q ? T.brand : T.bg3, color: qty === q ? '#FFF' : T.tx3, border: `1px solid ${T.border}`, borderRadius: '2px', padding: '2px 4px', fontSize: '7px', cursor: 'pointer' }}>{q}</button>
            ))}
          </div>
        </div>
      </div>
      {/* Price */}
      {orderType !== 'MARKET' && (
        <div style={{ marginBottom: '6px' }}>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Price</label>
          <input type="number" value={price} onChange={e => setPrice(+e.target.value)} step={0.01}
            style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px 6px', fontSize: '10px', fontFamily: T.mono }} />
        </div>
      )}
      {/* Stop Price */}
      {(orderType === 'STOP' || orderType === 'STOP_LIMIT' || orderType === 'TRAILING_STOP') && (
        <div style={{ marginBottom: '6px' }}>
          <label style={{ fontSize: '8px', color: T.tx3 }}>Stop Price</label>
          <input type="number" value={stopPrice} onChange={e => setStopPrice(+e.target.value)} step={0.01}
            style={{ width: '100%', background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '4px 6px', fontSize: '10px', fontFamily: T.mono }} />
        </div>
      )}
      {/* TIF */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '8px', color: T.tx3 }}>Time in Force</label>
        <div style={{ display: 'flex', gap: '3px' }}>
          {(['DAY', 'GTC', 'IOC', 'FOK'] as const).map(t => (
            <button key={t} onClick={() => setTif(t)} style={{
              flex: 1, background: tif === t ? T.brand : T.bg3, color: tif === t ? '#FFF' : T.tx3,
              border: `1px solid ${tif === t ? T.brand : T.border}`, borderRadius: '2px',
              padding: '2px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
      </div>
      {/* Estimated Cost */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${T.border}`, marginBottom: '6px' }}>
        <span style={{ fontSize: '8px', color: T.tx3 }}>Est. Cost</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      {/* Submit */}
      <button onClick={() => onSubmit({ symbol: quote.symbol, side, type: orderType, qty, price, stopPrice, tif })} style={{
        width: '100%', padding: '8px', border: 'none', borderRadius: T.r, cursor: 'pointer',
        background: side === 'BUY' ? T.up : T.dn, color: '#FFF', fontSize: '11px', fontWeight: 800,
      }}>
        {side} {qty} {quote.symbol} @ {orderType === 'MARKET' ? 'MKT' : `$${price.toFixed(2)}`}
      </button>
    </div>
  );
}

function PositionsPanel({ positions }: { positions: Position[] }) {
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalDayPnl = positions.reduce((s, p) => s + p.dayPnl, 0);
  const totalMV = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>Positions</span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '8px', fontFamily: T.mono }}>
          <span style={{ color: totalPnl >= 0 ? T.up : T.dn }}>Total: ${totalPnl.toFixed(2)}</span>
          <span style={{ color: totalDayPnl >= 0 ? T.up : T.dn }}>Day: ${totalDayPnl.toFixed(2)}</span>
          <span style={{ color: T.tx2 }}>MV: ${totalMV.toLocaleString()}</span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Symbol', 'Side', 'Qty', 'Avg Entry', 'Current', 'P&L', '%', 'Day P&L'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <tr key={p.symbol} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 700, textAlign: 'left' }}>{p.symbol}</td>
              <td style={{ padding: '3px 4px', color: p.side === 'LONG' ? T.up : T.dn, textAlign: 'right', fontWeight: 600 }}>{p.side}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{p.qty}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>${p.avgEntry.toFixed(2)}</td>
              <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'right' }}>${p.current.toFixed(2)}</td>
              <td style={{ padding: '3px 4px', color: p.pnl >= 0 ? T.up : T.dn, textAlign: 'right' }}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}</td>
              <td style={{ padding: '3px 4px', color: p.pnlPct >= 0 ? T.up : T.dn, textAlign: 'right' }}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%</td>
              <td style={{ padding: '3px 4px', color: p.dayPnl >= 0 ? T.up : T.dn, textAlign: 'right' }}>{p.dayPnl >= 0 ? '+' : ''}${p.dayPnl.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersPanel({ orders }: { orders: OrderEntry[] }) {
  const statusColors: Record<string, string> = { pending: T.tx3, submitted: T.info, filled: T.up, partial: T.warn, cancelled: T.tx3, rejected: T.dn };
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Open Orders</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['ID', 'Symbol', 'Side', 'Type', 'Qty', 'Price', 'Filled', 'Status', 'TIF'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'left' }}>{o.id}</td>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'right' }}>{o.symbol}</td>
              <td style={{ padding: '3px 4px', color: o.side === 'BUY' ? T.up : T.dn, textAlign: 'right', fontWeight: 700 }}>{o.side}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{o.type}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{o.qty}</td>
              <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'right' }}>{o.price > 0 ? `$${o.price.toFixed(2)}` : 'MKT'}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{o.filledQty}/{o.qty}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                <span style={{ color: statusColors[o.status], fontWeight: 600, background: `${statusColors[o.status]}15`, padding: '1px 4px', borderRadius: '2px' }}>{o.status.toUpperCase()}</span>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right' }}>{o.tif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskOverlay({ metrics }: { metrics: RiskMetric[] }) {
  const statusColors = { ok: T.up, warn: T.warn, breach: T.dn };
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Risk Overlay</div>
      {metrics.map(m => (
        <div key={m.label} style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '2px' }}>
            <span style={{ color: T.tx2 }}>{m.label}</span>
            <span style={{ color: statusColors[m.status], fontFamily: T.mono, fontWeight: 600 }}>{m.value} / {m.limit}</span>
          </div>
          <div style={{ height: '4px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(m.utilization, 100)}%`, height: '100%', borderRadius: '2px',
              background: m.utilization > 90 ? T.dn : m.utilization > 70 ? T.warn : T.up,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function TradingMultiUI2() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [quotes, setQuotes] = useState<Quote[]>(WATCHLIST);
  const [orders, setOrders] = useState<OrderEntry[]>(generateOrders());
  const [positions] = useState<Position[]>(generatePositions());
  const [riskMetrics] = useState<RiskMetric[]>(generateRiskMetrics());
  const [bottomTab, setBottomTab] = useState<'positions' | 'orders' | 'risk'>('positions');

  const selectedQuote = quotes.find(q => q.symbol === selectedSymbol) ?? quotes[0];

  // Auto-refresh quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setQuotes(prev => prev.map(q => {
        const jitter = (Math.random() - 0.5) * q.last * 0.001;
        const newLast = +(q.last + jitter).toFixed(q.assetClass === 'fx' ? 4 : 2);
        return { ...q, last: newLast, bid: +(newLast - (q.ask - q.bid) / 2).toFixed(q.assetClass === 'fx' ? 4 : 2), ask: +(newLast + (q.ask - q.bid) / 2).toFixed(q.assetClass === 'fx' ? 4 : 2) };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOrderSubmit = useCallback((order: Partial<OrderEntry>) => {
    const newOrder: OrderEntry = {
      id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
      symbol: order.symbol ?? selectedSymbol,
      side: order.side ?? 'BUY',
      type: order.type ?? 'LIMIT',
      qty: order.qty ?? 100,
      price: order.price ?? 0,
      stopPrice: order.stopPrice ?? 0,
      tif: order.tif ?? 'DAY',
      status: 'submitted',
      filledQty: 0,
      avgFillPrice: 0,
      timestamp: new Date().toISOString(),
    };
    setOrders(prev => [newOrder, ...prev]);
  }, [orders.length, selectedSymbol]);

  return (
    <div data-testid="trading-multi-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>MULTI-ASSET TRADING</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{selectedQuote.symbol}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>${selectedQuote.last.toFixed(selectedQuote.assetClass === 'fx' ? 4 : 2)}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: selectedQuote.changePct >= 0 ? T.up : T.dn, fontFamily: T.mono }}>
          {selectedQuote.changePct >= 0 ? '+' : ''}{selectedQuote.changePct.toFixed(2)}%
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3 }}>Vol: {(selectedQuote.volume / 1e6).toFixed(1)}M</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Watchlist */}
        <div style={{ width: '180px', flexShrink: 0, overflow: 'auto', borderRight: `1px solid ${T.border}`, background: T.bg1 }}>
          <div style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 700, color: T.tx2, borderBottom: `1px solid ${T.border}` }}>WATCHLIST</div>
          {quotes.map(q => (
            <div key={q.symbol} onClick={() => setSelectedSymbol(q.symbol)}
              style={{
                display: 'flex', justifyContent: 'space-between', padding: '4px 6px', cursor: 'pointer',
                background: q.symbol === selectedSymbol ? T.bg3 : 'transparent',
                borderBottom: `1px solid ${T.border}`,
              }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0 }}>{q.symbol}</div>
                <div style={{ fontSize: '7px', color: T.tx3 }}>{q.assetClass.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, fontFamily: T.mono }}>{q.last.toFixed(q.assetClass === 'fx' ? 4 : 2)}</div>
                <div style={{ fontSize: '7px', color: q.changePct >= 0 ? T.up : T.dn, fontFamily: T.mono }}>
                  {q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', gap: '4px', padding: '4px', overflow: 'hidden', minHeight: 0 }}>
            {/* Order Book */}
            <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', overflow: 'auto' }}>
              <OrderBookPanel quote={selectedQuote} />
            </div>
            {/* Time & Sales */}
            <div style={{ flex: 1, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', overflow: 'auto' }}>
              <TimeSalesPanel quote={selectedQuote} />
            </div>
          </div>
          {/* Bottom Panel */}
          <div style={{ height: '200px', flexShrink: 0, background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, margin: '0 4px 4px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
              {(['positions', 'orders', 'risk'] as const).map(t => (
                <button key={t} onClick={() => setBottomTab(t)} style={{
                  background: bottomTab === t ? T.bg3 : 'transparent', color: bottomTab === t ? T.tx0 : T.tx3,
                  border: 'none', padding: '4px 10px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
                  borderBottom: bottomTab === t ? `2px solid ${T.brand}` : '2px solid transparent',
                }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
            <div style={{ padding: '8px', overflow: 'auto', maxHeight: '170px' }}>
              {bottomTab === 'positions' && <PositionsPanel positions={positions} />}
              {bottomTab === 'orders' && <OrdersPanel orders={orders} />}
              {bottomTab === 'risk' && <RiskOverlay metrics={riskMetrics} />}
            </div>
          </div>
        </div>

        {/* Right: Order Entry */}
        <div style={{ width: '220px', flexShrink: 0, overflow: 'auto', padding: '8px', borderLeft: `1px solid ${T.border}`, background: T.bg1 }}>
          <OrderEntryPanel quote={selectedQuote} onSubmit={handleOrderSubmit} />
        </div>
      </div>
    </div>
  );
}

export { TradingMultiUI2 };
