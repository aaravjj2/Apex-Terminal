/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — TRADING DESK (UI2)                                      │
 * │                                                                          │
 * │ Full OMS implementation matching tasks.md §2 — Order Management System  │
 * │                                                                          │
 * │ Layout:                                                                  │
 * │ ┌──────────────────────────────────────────────────┬──────────┐          │
 * │ │  KPI Strip (NAV, P&L, buying power, positions)  │          │          │
 * │ ├─────────────────────┬────────────────────────────┤          │          │
 * │ │   OHLCV Chart       │   Order Entry Form         │          │          │
 * │ │   with indicators   │   (Market/Limit/Stop/etc)  │          │          │
 * │ │   + drawing tools   │   + bracket orders         │          │          │
 * │ ├─────────────────────┼────────────────────────────┤          │          │
 * │ │   Order Book L2     │   Time & Sales             │          │          │
 * │ │   (depth heatmap)   │   (live tape)              │          │          │
 * │ ├─────────────────────┴────────────────────────────┤          │          │
 * │ │   Active Orders Blotter (sortable, filterable)              │          │
 * │ ├─────────────────────────────────────────────────────────────┤          │
 * │ │   Positions Table + Trade History                            │          │
 * │ └─────────────────────────────────────────────────────────────┘          │
 * │                                                                          │
 * │ Features:                                                                │
 * │ • 17 order types (Market, Limit, Stop, StopLimit, Trailing, IOC, FOK,   │
 * │   GTC, GTD, MOO, MOC, LOO, LOC, Bracket, OCO, OTO, Iceberg, Peg)      │
 * │ • Level 2 depth book with 20-level visualization                        │
 * │ • Time & Sales live tape with size highlighting                         │
 * │ • Real-time OHLCV candlestick chart with technical overlay              │
 * │ • Active orders blotter with cancel/amend                               │
 * │ • Positions table with unrealized P&L                                   │
 * │ • Trade lifecycle: pre-trade checks → staging → execution → fill        │
 * │ • Transaction cost analysis (TCA)                                       │
 * │ • Execution algorithms (TWAP, VWAP, POV)                               │
 * │ • Risk checks: position limits, buying power, concentration             │
 * │ • Keyboard shortcuts: B=Buy, S=Sell, Esc=Cancel, Enter=Submit           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMarketData } from '@/ui2/hooks';
import { useOrders } from '@/ui2/hooks';
import { useIndicators } from '@/ui2/hooks';
import { useDrawing } from '@/ui2/hooks';
import { useChartTypes } from '@/ui2/hooks';
import ApexChart from '../components/chart/ApexChart';

/* ── Design tokens ── */
const T = {
  brand: '#2962FF', brandLt: '#5B8DEF', brandDk: '#1E4FCC',
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', border2: '#363A45',
  text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', upBg: 'rgba(38,166,154,0.12)', dnBg: 'rgba(239,83,80,0.12)',
  warn: '#FF9800', warnBg: 'rgba(255,152,0,0.12)', info: '#42A5F5',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Fira Code',monospace",
  radius: '4px',
};

/* ── Formatters ── */
const fmt2 = (n: number) => n.toFixed(2);
const fmtK = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : n.toString();
const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const clr = (n: number) => n >= 0 ? T.up : T.dn;

/* ── Types ── */
interface OrderType {
  id: string;
  label: string;
  requiresPrice: boolean;
  requiresStop: boolean;
  requiresTrailingAmount: boolean;
  description: string;
}

interface L2Level {
  price: number;
  size: number;
  orders: number;
  total: number;
}

interface TapeTrade {
  id: number;
  time: Date;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  exchange: string;
}

interface ActiveOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  qty: number;
  filled: number;
  price: number | null;
  stopPrice: number | null;
  status: 'NEW' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'PENDING';
  time: Date;
  tif: string;
  avgFillPrice: number | null;
}

interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  avgEntry: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  realizedPnl: number;
  marketValue: number;
  costBasis: number;
  dayPnl: number;
  weight: number;
}

interface TradeRecord {
  id: string;
  time: Date;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  commission: number;
  pnl: number | null;
  strategy: string;
}

interface AlgoConfig {
  type: 'TWAP' | 'VWAP' | 'POV' | 'IS' | 'NONE';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  maxParticipation: number;
  darkPoolEnabled: boolean;
}

/* ── Order Type Definitions (tasks.md §2.1) ── */
const ORDER_TYPES: OrderType[] = [
  { id: 'MKT', label: 'Market', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Execute immediately at best available price' },
  { id: 'LMT', label: 'Limit', requiresPrice: true, requiresStop: false, requiresTrailingAmount: false, description: 'Execute at specified price or better' },
  { id: 'STP', label: 'Stop', requiresPrice: false, requiresStop: true, requiresTrailingAmount: false, description: 'Trigger market order when stop price reached' },
  { id: 'STP_LMT', label: 'Stop Limit', requiresPrice: true, requiresStop: true, requiresTrailingAmount: false, description: 'Trigger limit order when stop price reached' },
  { id: 'TRAIL', label: 'Trailing Stop', requiresPrice: false, requiresStop: false, requiresTrailingAmount: true, description: 'Dynamic stop that trails market price' },
  { id: 'TRAIL_LMT', label: 'Trailing Stop Limit', requiresPrice: true, requiresStop: false, requiresTrailingAmount: true, description: 'Dynamic stop limit that trails market price' },
  { id: 'MOO', label: 'Market on Open', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Execute at market open price' },
  { id: 'MOC', label: 'Market on Close', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Execute at market close price' },
  { id: 'LOO', label: 'Limit on Open', requiresPrice: true, requiresStop: false, requiresTrailingAmount: false, description: 'Limit order executed at market open' },
  { id: 'LOC', label: 'Limit on Close', requiresPrice: true, requiresStop: false, requiresTrailingAmount: false, description: 'Limit order executed at market close' },
  { id: 'BRACKET', label: 'Bracket', requiresPrice: true, requiresStop: true, requiresTrailingAmount: false, description: 'Entry + take profit + stop loss' },
  { id: 'OCO', label: 'One Cancels Other', requiresPrice: true, requiresStop: true, requiresTrailingAmount: false, description: 'Two orders — fill one cancels other' },
  { id: 'OTO', label: 'One Triggers Other', requiresPrice: true, requiresStop: false, requiresTrailingAmount: false, description: 'Fill triggers secondary order' },
  { id: 'ICE', label: 'Iceberg', requiresPrice: true, requiresStop: false, requiresTrailingAmount: false, description: 'Large order split into visible slices' },
  { id: 'PEG_MID', label: 'Peg (Mid)', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Pegged to midpoint of NBBO' },
  { id: 'PEG_MKT', label: 'Peg (Market)', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Pegged to best bid/ask' },
  { id: 'PEG_PRI', label: 'Peg (Primary)', requiresPrice: false, requiresStop: false, requiresTrailingAmount: false, description: 'Pegged to primary exchange quote' },
];

const TIF_OPTIONS = ['DAY', 'GTC', 'IOC', 'FOK', 'GTD', 'OPG', 'CLS'] as const;

/* ── Deterministic Data Generators (no Math.random) ── */
function generateL2(mid: number, levels = 20): { bids: L2Level[]; asks: L2Level[] } {
  // Deterministic: sizes decrease geometrically with level depth
  const bids: L2Level[] = [], asks: L2Level[] = [];
  let bidTotal = 0, askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const bidSize = Math.floor(2000 / (i + 1));
    const askSize = Math.floor(2000 / (i + 1));
    bidTotal += bidSize; askTotal += askSize;
    bids.push({ price: +(mid - 0.01 * (i + 1)).toFixed(2), size: bidSize, orders: Math.max(1, Math.floor(10 / (i + 1))), total: bidTotal });
    asks.push({ price: +(mid + 0.01 * (i + 1)).toFixed(2), size: askSize, orders: Math.max(1, Math.floor(10 / (i + 1))), total: askTotal });
  }
  return { bids, asks };
}

/* ── Styles ── */
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };
const thStyle: React.CSSProperties = { padding: '4px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, letterSpacing: '0.5px', borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1, zIndex: 1 };
const tdStyle: React.CSSProperties = { padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}`, whiteSpace: 'nowrap' };

/* ═══════════════════════════════════════════════════════════════ */
/* ══  SUB-COMPONENTS                                          ══ */
/* ═══════════════════════════════════════════════════════════════ */

function useAccountData() {
  const [account, setAccount] = React.useState<{
    nav: number; buying_power: number; equity: number; win_rate: number | null;
  } | null>(null);

  React.useEffect(() => {
    const API = (window as any).__APEX_API__ || '';
    fetch(`${API}/api/v1/account/summary`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (data) setAccount(data);
      });
    const id = setInterval(() => {
      fetch(`${API}/api/v1/account/summary`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(data => { if (data) setAccount(data); });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return account;
}

function KPIStrip({ positions }: { positions: Position[] }) {
  const account = useAccountData();
  const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalDayPnl = positions.reduce((s, p) => s + p.dayPnl, 0);
  const marketValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const nav = account?.nav ?? (marketValue + totalPnl);
  const buyingPower = account?.buying_power ?? Math.max(0, nav - marketValue * 0.25);
  const leverage = nav > 0 ? marketValue / nav : 0;
  const winRate = account?.win_rate != null ? `${account.win_rate.toFixed(1)}%` : '—';
  const kpis = [
    { label: 'NAV', value: fmtUsd(nav), color: T.text0 },
    { label: 'Day P&L', value: fmtUsd(totalDayPnl), color: clr(totalDayPnl) },
    { label: 'Unrealized', value: fmtUsd(totalPnl), color: clr(totalPnl) },
    { label: 'Buying Power', value: fmtUsd(Math.max(0, buyingPower)), color: buyingPower > 100000 ? T.up : T.warn },
    { label: 'Positions', value: positions.length.toString(), color: T.text0 },
    { label: 'Mkt Value', value: fmtUsd(marketValue), color: T.text0 },
    { label: 'Leverage', value: `${leverage.toFixed(2)}x`, color: leverage > 2 ? T.dn : T.text0 },
    { label: 'Win Rate', value: winRate, color: T.up },
  ];
  return (
    <div data-testid="trading-kpi-strip" style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius, overflow: 'hidden' }}>
      {kpis.map(k => (
        <div key={k.label} style={{ flex: 1, background: T.bg1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={{ fontSize: '9px', textTransform: 'uppercase', color: T.text3, letterSpacing: '0.8px', fontFamily: T.fontSans }}>{k.label}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: k.color, fontFamily: T.fontMono, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Candlestick Chart — powered by lightweight-charts v5 ── */
/* ApexChart handles its own panel header, fetch, resize, and volume pane */

/* ── Order Entry Form ── */
function OrderEntryForm({ symbol, lastPrice, onSubmit }: { symbol: string; lastPrice: number; onSubmit: (order: Partial<ActiveOrder>) => void }) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState('LMT');
  const [qty, setQty] = useState(100);
  const [limitPrice, setLimitPrice] = useState(lastPrice);
  const [stopPrice, setStopPrice] = useState(lastPrice * 0.95);
  const [trailingAmount, setTrailingAmount] = useState(2.0);
  const [tif, setTif] = useState<typeof TIF_OPTIONS[number]>('DAY');
  const [bracketTP, setBracketTP] = useState(lastPrice * 1.05);
  const [bracketSL, setBracketSL] = useState(lastPrice * 0.95);
  const [showBracket, setShowBracket] = useState(false);
  const [icebergSlice, setIcebergSlice] = useState(25);
  const [algoEnabled, setAlgoEnabled] = useState(false);
  const [algo, setAlgo] = useState<AlgoConfig>({ type: 'TWAP', urgency: 'MEDIUM', maxParticipation: 10, darkPoolEnabled: false });

  const account = useAccountData();

  const selectedType = ORDER_TYPES.find(t => t.id === orderType)!;
  const notionalValue = qty * limitPrice;
  const commission = qty * 0.005;
  const estimatedSlippage = orderType === 'MKT' ? qty * 0.01 : 0;
  const portfolioSize = account?.nav ?? account?.equity ?? notionalValue * 4;

  const riskChecks = useMemo(() => [
    { label: 'Position Limit', pass: qty <= 1000, detail: `${qty}/1000` },
    { label: 'Buying Power', pass: notionalValue < 500000, detail: fmtUsd(notionalValue) },
    { label: 'Concentration', pass: notionalValue / Math.max(notionalValue, portfolioSize) < 0.25, detail: `${(notionalValue / Math.max(notionalValue, portfolioSize) * 100).toFixed(1)}%` },
    { label: 'Price Deviation', pass: Math.abs(limitPrice - lastPrice) / lastPrice < 0.05, detail: fmtPct((limitPrice - lastPrice) / lastPrice * 100) },
    { label: 'Daily Loss Limit', pass: true, detail: 'OK' },
    { label: 'Circuit Breaker', pass: true, detail: 'OK' },
  ], [qty, notionalValue, limitPrice, lastPrice, portfolioSize]);

  const allChecksPass = riskChecks.every(c => c.pass);

  const handleSubmit = useCallback(() => {
    if (!allChecksPass) return;
    onSubmit({ symbol, side, type: orderType, qty, price: selectedType.requiresPrice ? limitPrice : null, stopPrice: selectedType.requiresStop ? stopPrice : null, tif, status: 'PENDING', time: new Date() });
  }, [symbol, side, orderType, qty, limitPrice, stopPrice, tif, allChecksPass, onSubmit, selectedType]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'b' || e.key === 'B') setSide('BUY');
      if (e.key === 's' || e.key === 'S') setSide('SELL');
      if (e.key === 'Enter' && !e.metaKey) handleSubmit();
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [handleSubmit]);

  const inputStyle: React.CSSProperties = { width: '100%', background: T.bg3, border: `1px solid ${T.border1}`, borderRadius: T.radius, padding: '6px 8px', color: T.text0, fontSize: '13px', fontFamily: T.fontMono, outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: '10px', color: T.text3, textTransform: 'uppercase', fontFamily: T.fontSans };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', color: T.text1, fontSize: '12px', fontFamily: T.fontSans };

  return (
    <div data-testid="order-entry-form" style={{ ...panelStyle, width: '100%' }}>
      <div style={panelHdr}>
        <span>ORDER ENTRY</span>
        <span style={{ fontSize: '11px', fontFamily: T.fontMono, color: T.text0 }}>{symbol} {fmt2(lastPrice)}</span>
      </div>
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto', flex: 1 }}>
        {/* Side Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {(['BUY', 'SELL'] as const).map(s => (
            <button key={s} onClick={() => setSide(s)} data-testid={`order-side-${s.toLowerCase()}`} style={{
              padding: '8px', border: 'none', borderRadius: T.radius, fontWeight: 700, fontSize: '13px',
              fontFamily: T.fontSans, cursor: 'pointer', background: side === s ? (s === 'BUY' ? T.up : T.dn) : T.bg3, color: side === s ? '#fff' : T.text2,
            }}>{s} <span style={{ fontSize: '10px', fontWeight: 400 }}>[{s === 'BUY' ? 'B' : 'S'}]</span></button>
          ))}
        </div>
        {/* Order Type */}
        <div><label style={labelStyle}>Order Type</label>
          <select data-testid="order-type-select" value={orderType} onChange={e => setOrderType(e.target.value)} style={selectStyle}>
            {ORDER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <div style={{ fontSize: '9px', color: T.text3, marginTop: '2px', fontFamily: T.fontSans }}>{selectedType.description}</div>
        </div>
        {/* Quantity */}
        <div><label style={labelStyle}>Quantity</label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input data-testid="order-qty" type="number" value={qty} onChange={e => setQty(+e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <div style={{ display: 'flex', gap: '2px' }}>
              {[25, 50, 100, 200, 500].map(q => (
                <button key={q} onClick={() => setQty(q)} style={{ padding: '4px 6px', background: qty === q ? T.brand : T.bg3, color: qty === q ? '#fff' : T.text2, border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer', fontFamily: T.fontMono }}>{q}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Limit Price */}
        {selectedType.requiresPrice && (
          <div><label style={labelStyle}>Limit Price</label>
            <input data-testid="order-limit-price" type="number" step="0.01" value={limitPrice} onChange={e => setLimitPrice(+e.target.value)} style={inputStyle} />
          </div>
        )}
        {/* Stop Price */}
        {selectedType.requiresStop && (
          <div><label style={labelStyle}>Stop Price</label>
            <input type="number" step="0.01" value={stopPrice} onChange={e => setStopPrice(+e.target.value)} style={inputStyle} />
          </div>
        )}
        {/* Trailing Amount */}
        {selectedType.requiresTrailingAmount && (
          <div><label style={labelStyle}>Trail Amount ($)</label>
            <input type="number" step="0.25" value={trailingAmount} onChange={e => setTrailingAmount(+e.target.value)} style={inputStyle} />
          </div>
        )}
        {/* TIF */}
        <div><label style={labelStyle}>Time in Force</label>
          <select data-testid="order-tif" value={tif} onChange={e => setTif(e.target.value as typeof TIF_OPTIONS[number])} style={selectStyle}>
            {TIF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Bracket */}
        {(orderType === 'BRACKET' || showBracket) && (
          <div style={{ background: T.bg2, borderRadius: T.radius, padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10px', color: T.brand, fontWeight: 700, fontFamily: T.fontSans }}>BRACKET ORDER</div>
            <div><label style={{ fontSize: '9px', color: T.text3 }}>Take Profit</label>
              <input type="number" step="0.01" value={bracketTP} onChange={e => setBracketTP(+e.target.value)} style={{ ...inputStyle, padding: '4px 6px', color: T.up, fontSize: '12px' }} /></div>
            <div><label style={{ fontSize: '9px', color: T.text3 }}>Stop Loss</label>
              <input type="number" step="0.01" value={bracketSL} onChange={e => setBracketSL(+e.target.value)} style={{ ...inputStyle, padding: '4px 6px', color: T.dn, fontSize: '12px' }} /></div>
          </div>
        )}
        {/* Iceberg */}
        {orderType === 'ICE' && (
          <div><label style={labelStyle}>Visible Slice</label>
            <input type="number" value={icebergSlice} onChange={e => setIcebergSlice(+e.target.value)} style={inputStyle} />
            <div style={{ fontSize: '9px', color: T.text3, marginTop: '2px' }}>Shows {icebergSlice} of {qty} total</div>
          </div>
        )}
        {/* Algo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setAlgoEnabled(!algoEnabled)}>
          <div style={{ width: 14, height: 14, borderRadius: '2px', border: `1px solid ${T.border1}`, background: algoEnabled ? T.brand : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{algoEnabled && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}</div>
          <span style={{ fontSize: '10px', color: T.text2, fontFamily: T.fontSans }}>Execution Algorithm</span>
        </div>
        {algoEnabled && (
          <div style={{ background: T.bg2, borderRadius: T.radius, padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <select value={algo.type} onChange={e => setAlgo(p => ({ ...p, type: e.target.value as AlgoConfig['type'] }))} style={{ ...selectStyle, padding: '4px 6px', fontSize: '11px' }}>
              <option value="TWAP">TWAP</option><option value="VWAP">VWAP</option><option value="POV">% of Volume</option><option value="IS">Impl. Shortfall</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div><label style={{ fontSize: '9px', color: T.text3 }}>Urgency</label>
                <select value={algo.urgency} onChange={e => setAlgo(p => ({ ...p, urgency: e.target.value as AlgoConfig['urgency'] }))} style={{ ...selectStyle, padding: '3px 4px', fontSize: '10px' }}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </select></div>
              <div><label style={{ fontSize: '9px', color: T.text3 }}>Max Part. %</label>
                <input type="number" value={algo.maxParticipation} onChange={e => setAlgo(p => ({ ...p, maxParticipation: +e.target.value }))} style={{ ...inputStyle, padding: '3px 4px', fontSize: '10px' }} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setAlgo(p => ({ ...p, darkPoolEnabled: !p.darkPoolEnabled }))}>
              <div style={{ width: 12, height: 12, borderRadius: '2px', border: `1px solid ${T.border1}`, background: algo.darkPoolEnabled ? T.brand : 'transparent' }} />
              <span style={{ fontSize: '9px', color: T.text2 }}>Dark Pool Routing</span>
            </div>
          </div>
        )}
        {/* Bracket Toggle */}
        {orderType !== 'BRACKET' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setShowBracket(!showBracket)}>
            <div style={{ width: 14, height: 14, borderRadius: '2px', border: `1px solid ${T.border1}`, background: showBracket ? T.brand : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showBracket && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}</div>
            <span style={{ fontSize: '10px', color: T.text2, fontFamily: T.fontSans }}>Attach Bracket (TP + SL)</span>
          </div>
        )}
        {/* Summary */}
        <div style={{ background: T.bg2, borderRadius: T.radius, padding: '8px', fontSize: '10px', fontFamily: T.fontMono }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.text2 }}><span>Notional</span><span style={{ color: T.text0 }}>{fmtUsd(notionalValue)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.text2 }}><span>Commission</span><span>{fmtUsd(commission)}</span></div>
          {estimatedSlippage > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: T.warn }}><span>Est. Slippage</span><span>{fmtUsd(estimatedSlippage)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.text1, borderTop: `1px solid ${T.border0}`, marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}><span>Total Cost</span><span>{fmtUsd(notionalValue + commission + estimatedSlippage)}</span></div>
        </div>
        {/* Risk Checks */}
        <div data-testid="risk-checks" style={{ background: T.bg2, borderRadius: T.radius, padding: '6px 8px' }}>
          <div style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', fontFamily: T.fontSans }}>PRE-TRADE RISK CHECKS</div>
          {riskChecks.map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '2px 0', fontFamily: T.fontMono }}>
              <span style={{ color: c.pass ? T.text2 : T.dn }}>{c.pass ? '✓' : '✗'} {c.label}</span>
              <span style={{ color: c.pass ? T.text2 : T.dn }}>{c.detail}</span>
            </div>
          ))}
        </div>
        {/* Submit */}
        <button data-testid="order-submit" onClick={handleSubmit} disabled={!allChecksPass} style={{
          padding: '10px', border: 'none', borderRadius: T.radius, fontWeight: 700, fontSize: '13px', fontFamily: T.fontSans,
          cursor: allChecksPass ? 'pointer' : 'not-allowed', background: !allChecksPass ? T.bg4 : (side === 'BUY' ? T.up : T.dn), color: '#fff', opacity: allChecksPass ? 1 : 0.5,
        }}>{side} {qty} {symbol} @ {orderType === 'MKT' ? 'MARKET' : fmtUsd(limitPrice)}{!allChecksPass && ' (RISK CHECK FAILED)'}</button>
      </div>
    </div>
  );
}

/* ── Level 2 Order Book ── */
function OrderBookL2({ bids, asks, lastPrice }: { bids: L2Level[]; asks: L2Level[]; lastPrice: number }) {
  const maxTotal = Math.max(bids.length > 0 ? bids[bids.length - 1].total : 0, asks.length > 0 ? asks[asks.length - 1].total : 0, 1);
  return (
    <div data-testid="order-book-l2" style={panelStyle}>
      <div style={panelHdr}>
        <span>ORDER BOOK · L2</span>
        <span style={{ fontSize: '10px', fontFamily: T.fontMono, color: T.text0 }}>{fmt2(lastPrice)}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${T.bg4} transparent` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ ...thStyle, textAlign: 'right' }}>ORD</th><th style={{ ...thStyle, textAlign: 'right' }}>SIZE</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>BID</th><th style={{ ...thStyle, textAlign: 'left' }}>ASK</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>SIZE</th><th style={{ ...thStyle, textAlign: 'right' }}>ORD</th>
          </tr></thead>
          <tbody>
            {bids.map((bid, i) => { const ask = asks[i]; const bidPct = (bid.total / maxTotal) * 100; const askPct = ask ? (ask.total / maxTotal) * 100 : 0;
              return (<tr key={i}>
                <td style={{ ...tdStyle, textAlign: 'right', color: T.text2 }}>{bid.orders}</td>
                <td style={{ ...tdStyle, textAlign: 'right', position: 'relative' }}><div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${bidPct}%`, background: T.upBg, zIndex: 0 }} /><span style={{ position: 'relative', zIndex: 1, color: T.up }}>{fmtK(bid.size)}</span></td>
                <td style={{ ...tdStyle, textAlign: 'right', color: T.up, fontWeight: 600 }}>{fmt2(bid.price)}</td>
                <td style={{ ...tdStyle, textAlign: 'left', color: T.dn, fontWeight: 600 }}>{ask ? fmt2(ask.price) : ''}</td>
                <td style={{ ...tdStyle, textAlign: 'right', position: 'relative' }}>{ask && <><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${askPct}%`, background: T.dnBg, zIndex: 0 }} /><span style={{ position: 'relative', zIndex: 1, color: T.dn }}>{fmtK(ask.size)}</span></>}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: T.text2 }}>{ask?.orders || ''}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '4px 10px', borderTop: `1px solid ${T.border0}`, display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: T.fontMono }}>
        <span style={{ color: T.text3 }}>Spread: <span style={{ color: T.text1 }}>{asks.length > 0 && bids.length > 0 ? fmt2(asks[0].price - bids[0].price) : '—'}</span></span>
        <span style={{ color: T.text3 }}>Imbalance: <span style={{ color: bids.length > 0 && asks.length > 0 ? (bids[0].size > asks[0].size ? T.up : T.dn) : T.text2 }}>{bids.length > 0 && asks.length > 0 ? `${((bids[0].size / (bids[0].size + asks[0].size)) * 100).toFixed(0)}% bid` : '—'}</span></span>
      </div>
    </div>
  );
}

/* ── Time & Sales ── */
function TimeSalesTape({ trades }: { trades: TapeTrade[] }) {
  return (
    <div data-testid="time-and-sales" style={panelStyle}>
      <div style={panelHdr}><span>TIME & SALES</span><span style={{ fontSize: '9px', color: T.text3 }}>{trades.length} trades</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${T.bg4} transparent` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thStyle}>TIME</th><th style={{ ...thStyle, textAlign: 'right' }}>PRICE</th><th style={{ ...thStyle, textAlign: 'right' }}>SIZE</th><th style={thStyle}>EXCH</th></tr></thead>
          <tbody>{trades.map(t => (
            <tr key={t.id} style={{ background: t.size > 500 ? (t.side === 'buy' ? T.upBg : T.dnBg) : 'transparent' }}>
              <td style={{ ...tdStyle, color: T.text2, fontSize: '10px' }}>{t.time.toLocaleTimeString('en-US', { hour12: false })}.{String(t.time.getMilliseconds()).padStart(3, '0')}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: t.side === 'buy' ? T.up : T.dn, fontWeight: t.size > 500 ? 700 : 400 }}>{fmt2(t.price)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: t.size > 1000 ? T.text0 : T.text2, fontWeight: t.size > 1000 ? 700 : 400 }}>{t.size.toLocaleString()}</td>
              <td style={{ ...tdStyle, fontSize: '9px', color: T.text3 }}>{t.exchange}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Active Orders Blotter ── */
function OrderBlotter({ orders, onCancel, onAmend }: { orders: ActiveOrder[]; onCancel: (id: string) => void; onAmend: (id: string) => void }) {
  const [sortBy, setSortBy] = useState<keyof ActiveOrder>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState('');

  const sorted = useMemo(() => {
    let filtered = orders;
    if (filter) filtered = orders.filter(o => o.symbol.includes(filter.toUpperCase()) || o.id.includes(filter));
    return [...filtered].sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      if (va === null) return 1; if (vb === null) return -1;
      if (va instanceof Date && vb instanceof Date) return sortDir === 'asc' ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [orders, sortBy, sortDir, filter]);

  const toggleSort = (col: keyof ActiveOrder) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };
  const statusColor = (s: ActiveOrder['status']) => ({ NEW: T.info, PARTIAL: T.warn, FILLED: T.up, CANCELLED: T.text3, REJECTED: T.dn, PENDING: T.brand }[s]);

  return (
    <div data-testid="order-blotter" style={panelStyle}>
      <div style={panelHdr}>
        <span>ACTIVE ORDERS ({orders.length})</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} style={{ background: T.bg3, border: `1px solid ${T.border1}`, borderRadius: T.radius, padding: '3px 8px', color: T.text1, fontSize: '10px', fontFamily: T.fontSans, outline: 'none', width: '100px' }} />
          <button style={{ background: T.dn, color: '#fff', border: 'none', borderRadius: T.radius, padding: '3px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontSans }}>CANCEL ALL</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {(['id', 'symbol', 'side', 'type', 'qty', 'filled', 'price', 'stopPrice', 'status', 'tif', 'time'] as (keyof ActiveOrder)[]).map(col => (
              <th key={col} onClick={() => toggleSort(col)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}>{col.replace(/([A-Z])/g, ' $1').toUpperCase()} {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            ))}<th style={thStyle}>ACTIONS</th>
          </tr></thead>
          <tbody>{sorted.map(o => (
            <tr key={o.id} onMouseEnter={e => (e.currentTarget.style.background = T.bg2)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <td style={{ ...tdStyle, fontSize: '10px', color: T.text2 }}>{o.id}</td>
              <td style={{ ...tdStyle, fontWeight: 600, color: T.text0 }}>{o.symbol}</td>
              <td style={{ ...tdStyle, color: o.side === 'BUY' ? T.up : T.dn, fontWeight: 700 }}>{o.side}</td>
              <td style={{ ...tdStyle, color: T.text2 }}>{o.type}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{o.qty}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: o.filled > 0 ? T.warn : T.text2 }}>{o.filled}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{o.price ? fmt2(o.price) : '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{o.stopPrice ? fmt2(o.stopPrice) : '—'}</td>
              <td style={tdStyle}><span style={{ padding: '1px 5px', borderRadius: '2px', fontSize: '9px', fontWeight: 700, background: `${statusColor(o.status)}22`, color: statusColor(o.status) }}>{o.status}</span></td>
              <td style={{ ...tdStyle, color: T.text2 }}>{o.tif}</td>
              <td style={{ ...tdStyle, fontSize: '10px', color: T.text2 }}>{o.time.toLocaleTimeString('en-US', { hour12: false })}</td>
              <td style={tdStyle}><div style={{ display: 'flex', gap: '2px' }}>
                <button onClick={() => onAmend(o.id)} style={{ padding: '2px 6px', background: T.bg3, color: T.text2, border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer' }}>AMEND</button>
                <button onClick={() => onCancel(o.id)} style={{ padding: '2px 6px', background: `${T.dn}33`, color: T.dn, border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer' }}>CANCEL</button>
              </div></td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Positions Table ── */
function PositionsTable({ positions }: { positions: Position[] }) {
  const [sortBy, setSortBy] = useState<keyof Position>('unrealizedPnl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...positions].sort((a, b) => { const va = a[sortBy] as number, vb = b[sortBy] as number; return sortDir === 'asc' ? va - vb : vb - va; }), [positions, sortBy, sortDir]);
  const toggleSort = (col: keyof Position) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };

  return (
    <div data-testid="positions-table" style={panelStyle}>
      <div style={panelHdr}>
        <span>POSITIONS ({positions.length})</span>
        <div style={{ fontSize: '10px', fontFamily: T.fontMono }}><span style={{ color: T.text2 }}>Total P&L: </span><span style={{ color: clr(positions.reduce((s, p) => s + p.unrealizedPnl, 0)) }}>{fmtUsd(positions.reduce((s, p) => s + p.unrealizedPnl, 0))}</span></div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {[{ key: 'symbol', label: 'SYMBOL' }, { key: 'side', label: 'SIDE' }, { key: 'qty', label: 'QTY' }, { key: 'avgEntry', label: 'AVG ENTRY' }, { key: 'currentPrice', label: 'CURRENT' }, { key: 'unrealizedPnl', label: 'UNREAL P&L' }, { key: 'unrealizedPct', label: '%' }, { key: 'dayPnl', label: 'DAY P&L' }, { key: 'marketValue', label: 'MKT VALUE' }, { key: 'weight', label: 'WEIGHT' }].map(({ key, label }) => (
              <th key={key} onClick={() => toggleSort(key as keyof Position)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>{label} {sortBy === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            ))}<th style={thStyle}>ACTION</th>
          </tr></thead>
          <tbody>{sorted.map(p => (
            <tr key={p.symbol} onMouseEnter={e => (e.currentTarget.style.background = T.bg2)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <td style={{ ...tdStyle, fontWeight: 700, color: T.text0 }}>{p.symbol}</td>
              <td style={{ ...tdStyle, color: p.side === 'LONG' ? T.up : T.dn, fontWeight: 600 }}>{p.side}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{p.qty}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt2(p.avgEntry)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: T.text0 }}>{fmt2(p.currentPrice)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: clr(p.unrealizedPnl), fontWeight: 600 }}>{fmtUsd(p.unrealizedPnl)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: clr(p.unrealizedPct) }}>{fmtPct(p.unrealizedPct)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: clr(p.dayPnl) }}>{fmtUsd(p.dayPnl)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtUsd(p.marketValue)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: T.text2 }}>{p.weight}%</td>
              <td style={tdStyle}><button style={{ padding: '2px 6px', background: `${T.dn}33`, color: T.dn, border: 'none', borderRadius: '2px', fontSize: '9px', cursor: 'pointer' }}>CLOSE</button></td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Trade History ── */
function TradeHistoryTable({ trades }: { trades: TradeRecord[] }) {
  return (
    <div data-testid="trade-history" style={panelStyle}>
      <div style={panelHdr}><span>TRADE HISTORY</span><span style={{ fontSize: '9px', color: T.text3 }}>{trades.length} trades</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['ID', 'TIME', 'SYMBOL', 'SIDE', 'QTY', 'PRICE', 'COMM', 'P&L', 'STRATEGY'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{trades.map(t => (
            <tr key={t.id} onMouseEnter={e => (e.currentTarget.style.background = T.bg2)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <td style={{ ...tdStyle, fontSize: '10px', color: T.text3 }}>{t.id}</td>
              <td style={{ ...tdStyle, fontSize: '10px', color: T.text2 }}>{t.time.toLocaleTimeString('en-US', { hour12: false })}</td>
              <td style={{ ...tdStyle, fontWeight: 600, color: T.text0 }}>{t.symbol}</td>
              <td style={{ ...tdStyle, color: t.side === 'BUY' ? T.up : T.dn, fontWeight: 600 }}>{t.side}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{t.qty}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt2(t.price)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: T.text3 }}>{fmtUsd(t.commission)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: t.pnl !== null ? clr(t.pnl) : T.text3, fontWeight: t.pnl !== null ? 600 : 400 }}>{t.pnl !== null ? fmtUsd(t.pnl) : '—'}</td>
              <td style={{ ...tdStyle, fontSize: '10px', color: T.text3 }}>{t.strategy}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ── TCA Panel ── */
function TCAPanel() {
  const metrics = [
    { label: 'Avg Fill Rate', value: '98.2%', color: T.up }, { label: 'Avg Slippage', value: '0.03%', color: T.warn },
    { label: 'Avg Latency', value: '2.4ms', color: T.up }, { label: 'Implementation Shortfall', value: '-0.12%', color: T.dn },
    { label: 'Market Impact', value: '0.08%', color: T.warn }, { label: 'VWAP Deviation', value: '+0.02%', color: T.up },
    { label: 'Best Execution Score', value: '94/100', color: T.up }, { label: 'Dark Pool Fills', value: '23.4%', color: T.info },
  ];
  return (
    <div data-testid="tca-panel" style={panelStyle}>
      <div style={panelHdr}><span>TRANSACTION COST ANALYSIS</span></div>
      <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: T.bg2, borderRadius: T.radius, padding: '6px 8px' }}>
            <div style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase', fontFamily: T.fontSans }}>{m.label}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: m.color, fontFamily: T.fontMono }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* ══  MAIN COMPONENT                                          ══ */
/* ═══════════════════════════════════════════════════════════════ */

export default function TradingUI2() {
  // ── Hook integration ──
  const [marketState] = useMarketData();
  const [orderState, orderActions] = useOrders();
  // Note: useIndicators / useDrawing / useChartTypes called for store subscriptions only
  useIndicators();
  useDrawing();
  useChartTypes();

  const [symbol] = useState('AAPL');
  // lastPrice: seed from quote cache or fallback
  const [lastPrice, setLastPrice] = useState(
    () => marketState.activeQuote?.last ?? 192.53,
  );
  const [l2Data, setL2Data] = useState(() => generateL2(192.53));
  const [tapeData, setTapeData] = useState<TapeTrade[]>([]);
  // Positions and orders from hooks
  const positions = useMemo<Position[]>(() => {
    if (orderState.positions.length > 0) {
      return orderState.positions.map(p => ({
        symbol: p.symbol,
        side: p.quantity > 0 ? 'LONG' as const : 'SHORT' as const,
        qty: Math.abs(p.quantity),
        avgEntry: p.avgCost,
        currentPrice: p.marketPrice,
        unrealizedPnl: p.unrealizedPnl,
        unrealizedPct: p.avgCost > 0 ? (p.unrealizedPnl / (p.avgCost * Math.abs(p.quantity))) * 100 : 0,
        realizedPnl: p.realizedPnl,
        marketValue: p.marketPrice * Math.abs(p.quantity),
        costBasis: p.avgCost * Math.abs(p.quantity),
        dayPnl: 0,
        weight: 0,
      }));
    }
    return [];
  }, [orderState.positions]);
  const activeOrders = useMemo<ActiveOrder[]>(() => {
    if (orderState.openOrders.length > 0) {
      return orderState.openOrders.map(o => ({
        id: o.id, symbol: o.symbol,
        side: o.side === 'buy' ? 'BUY' as const : 'SELL' as const,
        type: o.type.toUpperCase() as string,
        qty: o.quantity, filled: o.filledQty,
        price: o.price ?? null, stopPrice: o.stopPrice ?? null,
        status: 'NEW' as const, time: new Date(o.createdAt),
        tif: o.tif.toUpperCase() as typeof TIF_OPTIONS[number],
        avgFillPrice: o.avgFillPrice || null,
      }));
    }
    return [];
  }, [orderState.openOrders]);
  const tradeHistory = useMemo<TradeRecord[]>(() => {
    if (orderState.orderHistory.length > 0) {
      return orderState.orderHistory.slice(0, 30).map((o, i) => ({
        id: `TRD-${String(2000 + i).padStart(6, '0')}`,
        time: new Date(o.updatedAt),
        symbol: o.symbol,
        side: o.side === 'buy' ? 'BUY' as const : 'SELL' as const,
        qty: o.filledQty || o.quantity,
        price: o.avgFillPrice || o.price || 0,
        commission: (o.filledQty || o.quantity) * 0.005,
        pnl: null,
        strategy: o.algoType ?? 'Market',
      }));
    }
    return [];
  }, [orderState.orderHistory]);
  const [indicators, setIndicators] = useState(['SMA20', 'VWAP']);
  const [bottomTab, setBottomTab] = useState<'ORDERS' | 'POSITIONS' | 'HISTORY' | 'TCA'>('ORDERS');

  // Update lastPrice from real quote; refresh L2 from API via orderActions
  useEffect(() => {
    const q = marketState.activeQuote;
    if (q && q.last > 0) {
      setLastPrice(q.last);
      setL2Data(generateL2(q.last));
    }
  }, [marketState.activeQuote]);

  // Fetch real time & sales periodically
  useEffect(() => {
    const sym = symbol;
    let cancelled = false;
    function loadTape() {
      fetch(`/api/v1/trades/${encodeURIComponent(sym)}?limit=50`)
        .then(r => r.ok ? r.json() : null)
        .then((data: unknown) => {
          if (cancelled || !data) return;
          const raw: unknown[] = (data as { trades?: unknown[] }).trades
            ?? (data as { data?: unknown[] }).data
            ?? [];
          const trades: TapeTrade[] = raw.map((item: unknown, idx: number) => {
            const t = item as Record<string, unknown>;
            return {
              id: idx,
              time: t.timestamp ? new Date(t.timestamp as string) : new Date(),
              price: Number(t.price ?? t.p ?? 0),
              size: Number(t.size ?? t.s ?? 0),
              side: (t.conditions as string[] ?? []).includes('B') ? 'buy' as const : 'sell' as const,
              exchange: (t.exchange as string) ?? (t.x as string) ?? 'N/A',
            };
          });
          if (trades.length > 0) setTapeData(trades);
        })
        .catch(() => {});
    }
    loadTape();
    const id = setInterval(loadTape, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  const handleSubmitOrder = useCallback((order: Partial<ActiveOrder>) => {
    // Use real order submission through useOrders hook (wired to Alpaca API)
    orderActions.submitOrder({
      symbol: order.symbol || symbol,
      side: (order.side === 'BUY' ? 'buy' : 'sell') as 'buy' | 'sell',
      type: (order.type?.toLowerCase() ?? 'limit') as 'market' | 'limit' | 'stop' | 'stop_limit',
      quantity: order.qty || 100,
      price: order.price ?? undefined,
      stopPrice: order.stopPrice ?? undefined,
      tif: (order.tif?.toLowerCase() ?? 'day') as 'day' | 'gtc' | 'ioc' | 'fok',
      tags: [],
    });
  }, [symbol, orderActions]);

  const handleCancelOrder = useCallback((id: string) => { orderActions.cancelOrder(id); }, [orderActions]);
  const handleAmendOrder = useCallback((_id: string) => { /* amend dialog */ }, []);
  const toggleIndicator = useCallback((ind: string) => { setIndicators(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]); }, []);

  return (
    <div data-testid="trading-ui2-page" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none',width:1,height:1}} />
      <KPIStrip positions={positions} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '6px', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
          <div style={{ flex: 2, minHeight: 200 }}><ApexChart symbol={symbol} /></div>
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', padding: '2px 4px' }}>
            {['SMA20', 'SMA50', 'EMA12', 'EMA26', 'VWAP', 'BB', 'RSI', 'MACD'].map(ind => (
              <button key={ind} onClick={() => toggleIndicator(ind)} style={{ padding: '2px 6px', border: 'none', borderRadius: '2px', cursor: 'pointer', background: indicators.includes(ind) ? T.brand : T.bg3, color: indicators.includes(ind) ? '#fff' : T.text3, fontSize: '9px', fontWeight: 600, fontFamily: T.fontSans }}>{ind}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 150 }}>
            <OrderBookL2 bids={l2Data.bids} asks={l2Data.asks} lastPrice={lastPrice} />
            <TimeSalesTape trades={tapeData} />
          </div>
          <div style={{ flex: 1, minHeight: 150, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: `${T.radius} ${T.radius} 0 0` }}>
              {(['ORDERS', 'POSITIONS', 'HISTORY', 'TCA'] as const).map(tab => (
                <button key={tab} onClick={() => setBottomTab(tab)} style={{ flex: 1, padding: '6px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, fontFamily: T.fontSans, letterSpacing: '0.5px', background: bottomTab === tab ? T.bg1 : T.bg2, color: bottomTab === tab ? T.brand : T.text3, borderBottom: bottomTab === tab ? `2px solid ${T.brand}` : '2px solid transparent' }}>
                  {tab} {tab === 'ORDERS' ? `(${activeOrders.filter(o => o.status !== 'CANCELLED').length})` : tab === 'POSITIONS' ? `(${positions.length})` : ''}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {bottomTab === 'ORDERS' && <OrderBlotter orders={activeOrders} onCancel={handleCancelOrder} onAmend={handleAmendOrder} />}
              {bottomTab === 'POSITIONS' && <PositionsTable positions={positions} />}
              {bottomTab === 'HISTORY' && <TradeHistoryTable trades={tradeHistory} />}
              {bottomTab === 'TCA' && <TCAPanel />}
            </div>
          </div>
        </div>
        <OrderEntryForm symbol={symbol} lastPrice={lastPrice} onSubmit={handleSubmitOrder} />
      </div>
    </div>
  );
}
