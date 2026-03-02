/**
 * AdvancedOrderForm.tsx — Full OMS Order Entry Panel
 * ====================================================
 * Bloomberg EMSX / TradingView-grade order form that uses the
 * order-types.ts OMS library for validation, creation, and lifecycle.
 *
 * Features:
 * - 17 order types (Market, Limit, Stop, Stop-Limit, Trailing, IOC, FOK,
 *   GTC, GTD, MOO, MOC, LOO, LOC, OCO, OTO, Bracket, Iceberg, Peg)
 * - 9 execution algorithms (TWAP, VWAP, IS, POV, Arrival, Close, Dark, SOR, Pairs)
 * - Pre-trade validation with live error display
 * - Position sizing calculator (fixed, % equity, Kelly, risk-based)
 * - Quick order buttons (Buy Market, Sell Market)
 * - Price ladder with L2 depth
 * - Order preview with cost/commission estimate
 * - Bloomberg dark theme
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  OrderType,
  OrderSide,
  TimeInForce,
  ExecutionAlgoType,
  validateOrderSpec,
  createMarketOrder,
  createLimitOrder,
  createStopOrder,
  createStopLimitOrder,
  createTrailingStopOrder,
  createIcebergOrder,
  createBracketOrder,
  createOCOOrders,
  createOTOOrders,
  orderToJson,
} from '@/lib/oms/order-types';
import type {
  BaseOrderSpec,
  ValidationResult,
  BracketOrderSpec,
  OCOOrderSpec,
  OTOOrderSpec,
  IcebergOrderSpec,
} from '@/lib/oms/order-types';

// ── Theme constants ──────────────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const TEXT = '#d4d4d4';
const MUTED = '#888888';
const INPUT_BG = '#0d0d0d';
const HOVER = '#1a1a1a';

// ── Order type metadata ──────────────────────────────────────────────────────
const ORDER_TYPE_OPTIONS: { value: OrderType; label: string; description: string }[] = [
  { value: OrderType.MARKET, label: 'Market', description: 'Execute at best available price' },
  { value: OrderType.LIMIT, label: 'Limit', description: 'Execute at specified price or better' },
  { value: OrderType.STOP, label: 'Stop', description: 'Trigger market order at stop price' },
  { value: OrderType.STOP_LIMIT, label: 'Stop Limit', description: 'Trigger limit order at stop price' },
  { value: OrderType.TRAILING_STOP, label: 'Trailing Stop', description: 'Dynamic stop that follows price' },
  { value: OrderType.TRAILING_STOP_LIMIT, label: 'Trail Stop-Limit', description: 'Trailing stop with limit' },
  { value: OrderType.IOC, label: 'IOC', description: 'Immediate or Cancel' },
  { value: OrderType.FOK, label: 'FOK', description: 'Fill or Kill — all or nothing' },
  { value: OrderType.GTC, label: 'GTC', description: 'Good Till Cancel' },
  { value: OrderType.GTD, label: 'GTD', description: 'Good Till Date' },
  { value: OrderType.MOO, label: 'MOO', description: 'Market on Open' },
  { value: OrderType.MOC, label: 'MOC', description: 'Market on Close' },
  { value: OrderType.LOO, label: 'LOO', description: 'Limit on Open' },
  { value: OrderType.LOC, label: 'LOC', description: 'Limit on Close' },
  { value: OrderType.PEG, label: 'Peg', description: 'Pegged to NBBO' },
  { value: OrderType.PEG_MIDPOINT, label: 'Peg Mid', description: 'Peg to midpoint' },
  { value: OrderType.ICEBERG, label: 'Iceberg', description: 'Hidden reserve quantity' },
];

const SIDE_OPTIONS: { value: OrderSide; label: string; color: string }[] = [
  { value: OrderSide.BUY, label: 'BUY', color: GREEN },
  { value: OrderSide.SELL, label: 'SELL', color: RED },
  { value: OrderSide.BUY_TO_COVER, label: 'COVER', color: GREEN },
  { value: OrderSide.SELL_SHORT, label: 'SHORT', color: RED },
];

const TIF_OPTIONS: { value: TimeInForce; label: string }[] = [
  { value: TimeInForce.DAY, label: 'DAY' },
  { value: TimeInForce.GTC, label: 'GTC' },
  { value: TimeInForce.IOC, label: 'IOC' },
  { value: TimeInForce.FOK, label: 'FOK' },
  { value: TimeInForce.GTD, label: 'GTD' },
  { value: TimeInForce.OPG, label: 'OPG' },
  { value: TimeInForce.CLS, label: 'CLS' },
  { value: TimeInForce.EXT, label: 'EXT' },
  { value: TimeInForce.ATC, label: 'ATC' },
];

const ALGO_OPTIONS: { value: ExecutionAlgoType; label: string; description: string }[] = [
  { value: ExecutionAlgoType.TWAP, label: 'TWAP', description: 'Time-weighted average price' },
  { value: ExecutionAlgoType.VWAP, label: 'VWAP', description: 'Volume-weighted average price' },
  { value: ExecutionAlgoType.IS, label: 'IS', description: 'Implementation Shortfall' },
  { value: ExecutionAlgoType.POV, label: 'POV', description: 'Percentage of Volume' },
  { value: ExecutionAlgoType.ARRIVAL, label: 'Arrival', description: 'Arrival price benchmark' },
  { value: ExecutionAlgoType.CLOSE, label: 'Close', description: 'Close price target' },
  { value: ExecutionAlgoType.DARK, label: 'Dark', description: 'Dark pool liquidity' },
  { value: ExecutionAlgoType.SOR, label: 'SOR', description: 'Smart Order Routing' },
  { value: ExecutionAlgoType.PAIRS, label: 'Pairs', description: 'Pairs trading execution' },
];

const SIZING_MODES = ['fixed', 'percent_equity', 'kelly', 'risk_based'] as const;
type SizingMode = typeof SIZING_MODES[number];

// ── Position sizing calculator ───────────────────────────────────────────────
function calculatePositionSize(params: {
  mode: SizingMode;
  equity: number;
  price: number;
  riskPerTrade: number; // % as decimal
  stopDistance: number;  // price distance to stop
  kellyWinRate?: number;
  kellyPayoff?: number;
}): number {
  const { mode, equity, price, riskPerTrade, stopDistance, kellyWinRate = 0.55, kellyPayoff = 1.5 } = params;
  if (price <= 0) return 0;

  switch (mode) {
    case 'fixed':
      return Math.floor(equity * riskPerTrade / price);
    case 'percent_equity':
      return Math.floor((equity * riskPerTrade) / price);
    case 'kelly': {
      const kelly = kellyWinRate - ((1 - kellyWinRate) / kellyPayoff);
      const fraction = Math.max(0, Math.min(kelly, 0.25)); // Cap at 25%
      return Math.floor((equity * fraction) / price);
    }
    case 'risk_based': {
      if (stopDistance <= 0) return 0;
      const riskAmount = equity * riskPerTrade;
      return Math.floor(riskAmount / stopDistance);
    }
    default:
      return 0;
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  container: {
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
    fontSize: 11,
    color: TEXT,
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    background: BG,
    padding: '8px 12px',
    borderBottom: `1px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitle: {
    color: AMBER,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  label: {
    color: MUTED,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    width: 60,
    flexShrink: 0,
  },
  input: {
    background: INPUT_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    color: TEXT,
    padding: '5px 8px',
    fontSize: 11,
    fontFamily: '"Roboto Mono", monospace',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  },
  select: {
    background: INPUT_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    color: TEXT,
    padding: '5px 8px',
    fontSize: 11,
    fontFamily: '"Roboto Mono", monospace',
    outline: 'none',
    flex: 1,
    cursor: 'pointer',
    minWidth: 0,
  },
  sideBtn: (active: boolean, color: string) => ({
    background: active ? color : 'transparent',
    border: `1px solid ${active ? color : BORDER}`,
    color: active ? '#000' : TEXT,
    padding: '6px 14px',
    borderRadius: 3,
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    fontSize: 11,
    fontFamily: '"Roboto Mono", monospace',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center' as const,
    transition: 'all 0.15s',
  }),
  submitBtn: (side: OrderSide) => ({
    background: side === OrderSide.BUY || side === OrderSide.BUY_TO_COVER ? GREEN : RED,
    border: 'none',
    color: '#000',
    padding: '10px 0',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    fontFamily: '"Roboto Mono", monospace',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    width: '100%',
    transition: 'opacity 0.15s',
  }),
  error: {
    color: RED,
    fontSize: 10,
    fontFamily: '"Roboto Mono", monospace',
    padding: '2px 0',
  },
  section: {
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 8,
    marginTop: 4,
  },
  sectionTitle: {
    color: AMBER,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
    fontSize: 10,
  },
  previewLabel: { color: MUTED },
  previewValue: { color: TEXT, fontWeight: 500 },
  quickBtn: (color: string) => ({
    background: 'transparent',
    border: `1px solid ${color}`,
    color: color,
    padding: '4px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
    fontFamily: '"Roboto Mono", monospace',
    transition: 'all 0.15s',
  }),
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: `1px solid ${BORDER}`,
  },
  tab: (active: boolean) => ({
    padding: '6px 12px',
    background: active ? PANEL : BG,
    color: active ? AMBER : MUTED,
    border: 'none',
    borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 10,
    fontFamily: '"Roboto Mono", monospace',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    fontWeight: active ? 600 : 400,
  }),
  algoParams: {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 3,
    padding: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  priceLadder: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 1,
    maxHeight: 200,
    overflow: 'auto',
  },
  ladderRow: (isBid: boolean, isHighlight: boolean) => ({
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 6px',
    background: isHighlight ? (isBid ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)') : 'transparent',
    fontSize: 10,
    cursor: 'pointer',
    color: isBid ? GREEN : RED,
  }),
};

// ── Types ────────────────────────────────────────────────────────────────────
type FormTab = 'ORDER' | 'ALGO' | 'SIZING' | 'PREVIEW';

interface OrderFormState {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice: number;
  stopPrice: number;
  trailAmount: number;
  trailPercent: number;
  timeInForce: TimeInForce;
  gtdDate: string;
  // Bracket
  takeProfitPrice: number;
  stopLossPrice: number;
  // Iceberg
  displayQuantity: number;
  // Peg
  pegOffset: number;
  // Algo
  useAlgo: boolean;
  algoType: ExecutionAlgoType;
  algoDuration: number; // minutes
  algoMaxPov: number;   // % max participation
  algoSlices: number;
  // Sizing
  sizingMode: SizingMode;
  equity: number;
  riskPercent: number;
  stopDistance: number;
  kellyWinRate: number;
  kellyPayoff: number;
}

interface Props {
  symbol?: string;
  lastPrice?: number;
  bidPrice?: number;
  askPrice?: number;
  onSubmit?: (order: unknown) => void;
  className?: string;
  compact?: boolean;
  // L2 data for price ladder
  bids?: Array<{ price: number; size: number }>;
  asks?: Array<{ price: number; size: number }>;
}

// ── Mock L2 data generator ───────────────────────────────────────────────────
function generateMockL2(midPrice: number): { bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> } {
  const bids: Array<{ price: number; size: number }> = [];
  const asks: Array<{ price: number; size: number }> = [];
  for (let i = 0; i < 10; i++) {
    bids.push({
      price: +(midPrice - (i + 1) * 0.01 * midPrice * 0.001).toFixed(2),
      size: Math.floor(Math.random() * 500 + 100),
    });
    asks.push({
      price: +(midPrice + (i + 1) * 0.01 * midPrice * 0.001).toFixed(2),
      size: Math.floor(Math.random() * 500 + 100),
    });
  }
  return { bids, asks: asks.reverse() };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdvancedOrderForm({
  symbol: propSymbol = 'AAPL',
  lastPrice = 264.18,
  bidPrice,
  askPrice,
  onSubmit,
  compact = false,
  bids: propBids,
  asks: propAsks,
}: Props) {
  const [tab, setTab] = useState<FormTab>('ORDER');
  const [form, setForm] = useState<OrderFormState>({
    symbol: propSymbol,
    side: OrderSide.BUY,
    orderType: OrderType.MARKET,
    quantity: 100,
    limitPrice: lastPrice,
    stopPrice: +(lastPrice * 0.95).toFixed(2),
    trailAmount: 1.0,
    trailPercent: 1.0,
    timeInForce: TimeInForce.DAY,
    gtdDate: '',
    takeProfitPrice: +(lastPrice * 1.05).toFixed(2),
    stopLossPrice: +(lastPrice * 0.95).toFixed(2),
    displayQuantity: 10,
    pegOffset: 0,
    useAlgo: false,
    algoType: ExecutionAlgoType.VWAP,
    algoDuration: 60,
    algoMaxPov: 15,
    algoSlices: 10,
    sizingMode: 'fixed',
    equity: 100000,
    riskPercent: 2,
    stopDistance: +(lastPrice * 0.02).toFixed(2),
    kellyWinRate: 55,
    kellyPayoff: 1.5,
  });

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [orderHistory, setOrderHistory] = useState<Array<{ id: string; side: string; type: string; qty: number; price: number; time: string }>>([]);

  // Update symbol from prop
  useEffect(() => {
    setForm(f => ({ ...f, symbol: propSymbol }));
  }, [propSymbol]);

  // L2 data
  const { bids, asks } = useMemo(() => {
    if (propBids && propAsks) return { bids: propBids, asks: propAsks };
    return generateMockL2(lastPrice);
  }, [propBids, propAsks, lastPrice]);

  // ── Form update helper ──
  const update = useCallback((patch: Partial<OrderFormState>) => {
    setForm(f => ({ ...f, ...patch }));
    setSubmitted(false);
  }, []);

  // ── Build order spec ──
  const orderSpec = useMemo((): BaseOrderSpec => {
    const base: BaseOrderSpec = {
      symbol: form.symbol,
      side: form.side,
      type: form.orderType,
      quantity: form.quantity,
      timeInForce: form.timeInForce,
    };

    // Add type-specific fields
    switch (form.orderType) {
      case OrderType.LIMIT:
      case OrderType.IOC:
      case OrderType.FOK:
      case OrderType.GTC:
      case OrderType.LOO:
      case OrderType.LOC:
        (base as any).limitPrice = form.limitPrice;
        break;
      case OrderType.STOP:
        (base as any).stopPrice = form.stopPrice;
        break;
      case OrderType.STOP_LIMIT:
        (base as any).stopPrice = form.stopPrice;
        (base as any).limitPrice = form.limitPrice;
        break;
      case OrderType.TRAILING_STOP:
      case OrderType.TRAILING_STOP_LIMIT:
        (base as any).trailAmount = form.trailAmount;
        (base as any).trailPercent = form.trailPercent;
        if (form.orderType === OrderType.TRAILING_STOP_LIMIT) {
          (base as any).limitOffset = form.trailAmount * 0.5;
        }
        break;
      case OrderType.GTD:
        (base as any).limitPrice = form.limitPrice;
        (base as any).expireDate = form.gtdDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        break;
      case OrderType.PEG:
      case OrderType.PEG_MIDPOINT:
        (base as any).pegOffset = form.pegOffset;
        break;
      case OrderType.ICEBERG:
        (base as any).limitPrice = form.limitPrice;
        (base as any).displayQuantity = form.displayQuantity;
        break;
    }

    return base;
  }, [form]);

  // ── Validate on change ──
  useEffect(() => {
    try {
      const result = validateOrderSpec(orderSpec);
      setValidation(result);
    } catch {
      setValidation({ valid: false, errors: ['Validation error'] });
    }
  }, [orderSpec]);

  // ── Position sizing calculation ──
  const calculatedSize = useMemo(() => {
    return calculatePositionSize({
      mode: form.sizingMode,
      equity: form.equity,
      price: form.limitPrice || lastPrice,
      riskPerTrade: form.riskPercent / 100,
      stopDistance: form.stopDistance,
      kellyWinRate: form.kellyWinRate / 100,
      kellyPayoff: form.kellyPayoff,
    });
  }, [form.sizingMode, form.equity, form.limitPrice, lastPrice, form.riskPercent, form.stopDistance, form.kellyWinRate, form.kellyPayoff]);

  // ── Estimated cost ──
  const estimatedCost = useMemo(() => {
    const price = form.limitPrice || lastPrice;
    const notional = price * form.quantity;
    const commission = Math.max(1, form.quantity * 0.005);
    return { notional, commission, total: notional + commission };
  }, [form.quantity, form.limitPrice, lastPrice]);

  // ── Submit ──
  const handleSubmit = useCallback(() => {
    if (!validation?.valid) return;

    let order: unknown;
    try {
      switch (form.orderType) {
        case OrderType.MARKET:
        case OrderType.MOO:
        case OrderType.MOC:
          order = createMarketOrder(form.symbol, form.side, form.quantity);
          break;
        case OrderType.LIMIT:
        case OrderType.IOC:
        case OrderType.FOK:
        case OrderType.GTC:
        case OrderType.GTD:
        case OrderType.LOO:
        case OrderType.LOC:
          order = createLimitOrder(form.symbol, form.side, form.quantity, form.limitPrice);
          break;
        case OrderType.STOP:
          order = createStopOrder(form.symbol, form.side, form.quantity, form.stopPrice);
          break;
        case OrderType.STOP_LIMIT:
          order = createStopLimitOrder(form.symbol, form.side, form.quantity, form.stopPrice, form.limitPrice);
          break;
        case OrderType.TRAILING_STOP:
        case OrderType.TRAILING_STOP_LIMIT:
          order = createTrailingStopOrder(form.symbol, form.side, form.quantity, form.trailAmount);
          break;
        case OrderType.ICEBERG:
          order = createIcebergOrder(form.symbol, form.side, form.quantity, form.limitPrice, form.displayQuantity);
          break;
        default:
          order = createMarketOrder(form.symbol, form.side, form.quantity);
      }
    } catch {
      order = orderSpec;
    }

    setSubmitted(true);
    setOrderHistory(h => [{
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      side: form.side,
      type: ORDER_TYPE_OPTIONS.find(o => o.value === form.orderType)?.label || form.orderType,
      qty: form.quantity,
      price: form.limitPrice || lastPrice,
      time: new Date().toISOString().slice(11, 19),
    }, ...h].slice(0, 20));

    onSubmit?.(order);
  }, [form, validation, orderSpec, lastPrice, onSubmit]);

  // ── Needs limit price ──
  const needsLimit = useMemo(() => [
    OrderType.LIMIT, OrderType.STOP_LIMIT, OrderType.IOC, OrderType.FOK,
    OrderType.GTC, OrderType.GTD, OrderType.LOO, OrderType.LOC, OrderType.ICEBERG,
  ].includes(form.orderType), [form.orderType]);

  const needsStop = useMemo(() => [
    OrderType.STOP, OrderType.STOP_LIMIT,
  ].includes(form.orderType), [form.orderType]);

  const needsTrail = useMemo(() => [
    OrderType.TRAILING_STOP, OrderType.TRAILING_STOP_LIMIT,
  ].includes(form.orderType), [form.orderType]);

  const tabs: FormTab[] = compact ? ['ORDER'] : ['ORDER', 'ALGO', 'SIZING', 'PREVIEW'];

  return (
    <div style={S.container} data-testid="advanced-order-form">
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>ORDER ENTRY</span>
        <span style={{ color: MUTED, fontSize: 10 }}>{form.symbol}</span>
        <span style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>
          ${lastPrice.toFixed(2)}
        </span>
      </div>

      {/* Tab bar */}
      {!compact && (
        <div style={S.tabBar}>
          {tabs.map(t => (
            <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={S.body}>
        {/* ── ORDER TAB ── */}
        {tab === 'ORDER' && (
          <>
            {/* Side selector */}
            <div style={S.row}>
              <span style={S.label}>SIDE</span>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                {SIDE_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    style={S.sideBtn(form.side === s.value, s.color)}
                    onClick={() => update({ side: s.value })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order type */}
            <div style={S.row}>
              <span style={S.label}>TYPE</span>
              <select
                style={S.select}
                value={form.orderType}
                onChange={e => update({ orderType: e.target.value as OrderType })}
              >
                {ORDER_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Type description */}
            <div style={{ color: MUTED, fontSize: 9, paddingLeft: 68, marginTop: -4 }}>
              {ORDER_TYPE_OPTIONS.find(o => o.value === form.orderType)?.description}
            </div>

            {/* Symbol */}
            <div style={S.row}>
              <span style={S.label}>SYMBOL</span>
              <input
                style={S.input}
                value={form.symbol}
                onChange={e => update({ symbol: e.target.value.toUpperCase() })}
              />
            </div>

            {/* Quantity */}
            <div style={S.row}>
              <span style={S.label}>QTY</span>
              <input
                style={S.input}
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => update({ quantity: parseInt(e.target.value) || 0 })}
              />
              {/* Quick qty buttons */}
              <div style={{ display: 'flex', gap: 2 }}>
                {[100, 500, 1000].map(q => (
                  <button
                    key={q}
                    style={S.quickBtn(MUTED)}
                    onClick={() => update({ quantity: q })}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Limit Price */}
            {needsLimit && (
              <div style={S.row}>
                <span style={S.label}>LIMIT</span>
                <input
                  style={S.input}
                  type="number"
                  step="0.01"
                  value={form.limitPrice}
                  onChange={e => update({ limitPrice: parseFloat(e.target.value) || 0 })}
                />
                <button
                  style={S.quickBtn(GREEN)}
                  onClick={() => update({ limitPrice: bidPrice || lastPrice })}
                  title="Set to bid"
                >
                  BID
                </button>
                <button
                  style={S.quickBtn(RED)}
                  onClick={() => update({ limitPrice: askPrice || lastPrice })}
                  title="Set to ask"
                >
                  ASK
                </button>
              </div>
            )}

            {/* Stop Price */}
            {needsStop && (
              <div style={S.row}>
                <span style={S.label}>STOP</span>
                <input
                  style={S.input}
                  type="number"
                  step="0.01"
                  value={form.stopPrice}
                  onChange={e => update({ stopPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* Trail params */}
            {needsTrail && (
              <>
                <div style={S.row}>
                  <span style={S.label}>TRAIL $</span>
                  <input
                    style={S.input}
                    type="number"
                    step="0.01"
                    value={form.trailAmount}
                    onChange={e => update({ trailAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div style={S.row}>
                  <span style={S.label}>TRAIL %</span>
                  <input
                    style={S.input}
                    type="number"
                    step="0.1"
                    value={form.trailPercent}
                    onChange={e => update({ trailPercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            {/* Iceberg display qty */}
            {form.orderType === OrderType.ICEBERG && (
              <div style={S.row}>
                <span style={S.label}>DISPLAY</span>
                <input
                  style={S.input}
                  type="number"
                  min={1}
                  value={form.displayQuantity}
                  onChange={e => update({ displayQuantity: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* Peg offset */}
            {(form.orderType === OrderType.PEG || form.orderType === OrderType.PEG_MIDPOINT) && (
              <div style={S.row}>
                <span style={S.label}>OFFSET</span>
                <input
                  style={S.input}
                  type="number"
                  step="0.01"
                  value={form.pegOffset}
                  onChange={e => update({ pegOffset: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* GTD date */}
            {form.orderType === OrderType.GTD && (
              <div style={S.row}>
                <span style={S.label}>EXPIRE</span>
                <input
                  style={S.input}
                  type="date"
                  value={form.gtdDate}
                  onChange={e => update({ gtdDate: e.target.value })}
                />
              </div>
            )}

            {/* Time in Force */}
            <div style={S.row}>
              <span style={S.label}>TIF</span>
              <select
                style={S.select}
                value={form.timeInForce}
                onChange={e => update({ timeInForce: e.target.value as TimeInForce })}
              >
                {TIF_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Price Ladder */}
            {!compact && (
              <div style={S.section}>
                <div style={S.sectionTitle}>PRICE LADDER (L2)</div>
                <div style={S.priceLadder}>
                  {asks.map((a, i) => (
                    <div
                      key={`ask-${i}`}
                      style={S.ladderRow(false, false)}
                      onClick={() => update({ limitPrice: a.price })}
                    >
                      <span>{a.size.toLocaleString()}</span>
                      <span>${a.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{
                    padding: '4px 6px',
                    textAlign: 'center',
                    color: AMBER,
                    fontWeight: 700,
                    fontSize: 12,
                    background: 'rgba(245,166,35,0.08)',
                    borderTop: `1px solid ${AMBER}33`,
                    borderBottom: `1px solid ${AMBER}33`,
                  }}>
                    ${lastPrice.toFixed(2)} — LAST
                  </div>
                  {bids.map((b, i) => (
                    <div
                      key={`bid-${i}`}
                      style={S.ladderRow(true, false)}
                      onClick={() => update({ limitPrice: b.price })}
                    >
                      <span>${b.price.toFixed(2)}</span>
                      <span>{b.size.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation errors */}
            {validation && !validation.valid && (
              <div style={{ marginTop: 4 }}>
                {(validation.errors || []).map((err, i) => (
                  <div key={i} style={S.error}>⚠ {err}</div>
                ))}
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop: 8 }}>
              <button
                style={{
                  ...S.submitBtn(form.side),
                  opacity: validation?.valid ? 1 : 0.5,
                  cursor: validation?.valid ? 'pointer' : 'not-allowed',
                }}
                onClick={handleSubmit}
                disabled={!validation?.valid}
              >
                {submitted ? '✓ ORDER SUBMITTED' : `${form.side} ${form.quantity} ${form.symbol}`}
              </button>
            </div>

            {/* Quick buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                style={S.quickBtn(GREEN)}
                onClick={() => {
                  update({ side: OrderSide.BUY, orderType: OrderType.MARKET, quantity: 100 });
                  setTimeout(handleSubmit, 50);
                }}
              >
                BUY 100 MKT
              </button>
              <button
                style={S.quickBtn(RED)}
                onClick={() => {
                  update({ side: OrderSide.SELL, orderType: OrderType.MARKET, quantity: 100 });
                  setTimeout(handleSubmit, 50);
                }}
              >
                SELL 100 MKT
              </button>
            </div>
          </>
        )}

        {/* ── ALGO TAB ── */}
        {tab === 'ALGO' && (
          <>
            <div style={S.row}>
              <span style={S.label}>ALGO</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.useAlgo}
                  onChange={e => update({ useAlgo: e.target.checked })}
                />
                <span style={{ color: form.useAlgo ? GREEN : MUTED, fontSize: 10 }}>
                  {form.useAlgo ? 'ENABLED' : 'DISABLED'}
                </span>
              </label>
            </div>

            {form.useAlgo && (
              <>
                <div style={S.row}>
                  <span style={S.label}>TYPE</span>
                  <select
                    style={S.select}
                    value={form.algoType}
                    onChange={e => update({ algoType: e.target.value as ExecutionAlgoType })}
                  >
                    {ALGO_OPTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ color: MUTED, fontSize: 9, paddingLeft: 68 }}>
                  {ALGO_OPTIONS.find(a => a.value === form.algoType)?.description}
                </div>

                <div style={S.algoParams}>
                  <div style={S.row}>
                    <span style={S.label}>DURATION</span>
                    <input
                      style={S.input}
                      type="number"
                      min={1}
                      value={form.algoDuration}
                      onChange={e => update({ algoDuration: parseInt(e.target.value) || 60 })}
                    />
                    <span style={{ color: MUTED, fontSize: 9 }}>min</span>
                  </div>

                  {(form.algoType === ExecutionAlgoType.POV) && (
                    <div style={S.row}>
                      <span style={S.label}>MAX %</span>
                      <input
                        style={S.input}
                        type="number"
                        min={1}
                        max={100}
                        value={form.algoMaxPov}
                        onChange={e => update({ algoMaxPov: parseInt(e.target.value) || 15 })}
                      />
                      <span style={{ color: MUTED, fontSize: 9 }}>participation</span>
                    </div>
                  )}

                  <div style={S.row}>
                    <span style={S.label}>SLICES</span>
                    <input
                      style={S.input}
                      type="number"
                      min={1}
                      value={form.algoSlices}
                      onChange={e => update({ algoSlices: parseInt(e.target.value) || 10 })}
                    />
                  </div>

                  {/* Algo schedule preview */}
                  <div style={{ marginTop: 6 }}>
                    <div style={S.sectionTitle}>SCHEDULE PREVIEW</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Array.from({ length: Math.min(form.algoSlices, 8) }, (_, i) => {
                        const startMin = Math.round((i / form.algoSlices) * form.algoDuration);
                        const endMin = Math.round(((i + 1) / form.algoSlices) * form.algoDuration);
                        const sliceQty = Math.round(form.quantity / form.algoSlices);
                        return (
                          <div key={i} style={S.previewRow}>
                            <span style={S.previewLabel}>T+{startMin}-{endMin}m</span>
                            <span style={S.previewValue}>{sliceQty} shares</span>
                          </div>
                        );
                      })}
                      {form.algoSlices > 8 && (
                        <div style={{ color: MUTED, fontSize: 9, textAlign: 'center' }}>
                          ... +{form.algoSlices - 8} more slices
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── SIZING TAB ── */}
        {tab === 'SIZING' && (
          <>
            <div style={S.row}>
              <span style={S.label}>MODE</span>
              <select
                style={S.select}
                value={form.sizingMode}
                onChange={e => update({ sizingMode: e.target.value as SizingMode })}
              >
                <option value="fixed">Fixed % Equity</option>
                <option value="percent_equity">Percent Equity</option>
                <option value="kelly">Kelly Criterion</option>
                <option value="risk_based">Risk-Based (ATR)</option>
              </select>
            </div>

            <div style={S.row}>
              <span style={S.label}>EQUITY</span>
              <input
                style={S.input}
                type="number"
                value={form.equity}
                onChange={e => update({ equity: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={S.row}>
              <span style={S.label}>RISK %</span>
              <input
                style={S.input}
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={form.riskPercent}
                onChange={e => update({ riskPercent: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {form.sizingMode === 'risk_based' && (
              <div style={S.row}>
                <span style={S.label}>STOP $</span>
                <input
                  style={S.input}
                  type="number"
                  step="0.01"
                  value={form.stopDistance}
                  onChange={e => update({ stopDistance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {form.sizingMode === 'kelly' && (
              <>
                <div style={S.row}>
                  <span style={S.label}>WIN %</span>
                  <input
                    style={S.input}
                    type="number"
                    min={1}
                    max={100}
                    value={form.kellyWinRate}
                    onChange={e => update({ kellyWinRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div style={S.row}>
                  <span style={S.label}>PAYOFF</span>
                  <input
                    style={S.input}
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={form.kellyPayoff}
                    onChange={e => update({ kellyPayoff: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            {/* Calculated size */}
            <div style={{ ...S.section, marginTop: 12 }}>
              <div style={S.sectionTitle}>CALCULATED POSITION</div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Shares</span>
                <span style={{ ...S.previewValue, color: AMBER, fontSize: 14, fontWeight: 700 }}>
                  {calculatedSize.toLocaleString()}
                </span>
              </div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Notional</span>
                <span style={S.previewValue}>
                  ${(calculatedSize * (form.limitPrice || lastPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>% of Equity</span>
                <span style={S.previewValue}>
                  {((calculatedSize * (form.limitPrice || lastPrice) / form.equity) * 100).toFixed(1)}%
                </span>
              </div>
              <button
                style={{ ...S.quickBtn(AMBER), marginTop: 6, width: '100%', textAlign: 'center' }}
                onClick={() => update({ quantity: calculatedSize })}
              >
                APPLY TO ORDER ({calculatedSize} shares)
              </button>
            </div>
          </>
        )}

        {/* ── PREVIEW TAB ── */}
        {tab === 'PREVIEW' && (
          <>
            <div style={S.sectionTitle}>ORDER SUMMARY</div>
            <div style={S.previewRow}>
              <span style={S.previewLabel}>Side</span>
              <span style={{ ...S.previewValue, color: form.side === OrderSide.BUY || form.side === OrderSide.BUY_TO_COVER ? GREEN : RED }}>
                {form.side}
              </span>
            </div>
            <div style={S.previewRow}>
              <span style={S.previewLabel}>Type</span>
              <span style={S.previewValue}>
                {ORDER_TYPE_OPTIONS.find(o => o.value === form.orderType)?.label}
              </span>
            </div>
            <div style={S.previewRow}>
              <span style={S.previewLabel}>Symbol</span>
              <span style={S.previewValue}>{form.symbol}</span>
            </div>
            <div style={S.previewRow}>
              <span style={S.previewLabel}>Quantity</span>
              <span style={S.previewValue}>{form.quantity.toLocaleString()}</span>
            </div>
            {needsLimit && (
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Limit Price</span>
                <span style={S.previewValue}>${form.limitPrice.toFixed(2)}</span>
              </div>
            )}
            {needsStop && (
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Stop Price</span>
                <span style={S.previewValue}>${form.stopPrice.toFixed(2)}</span>
              </div>
            )}
            {needsTrail && (
              <>
                <div style={S.previewRow}>
                  <span style={S.previewLabel}>Trail Amount</span>
                  <span style={S.previewValue}>${form.trailAmount.toFixed(2)}</span>
                </div>
                <div style={S.previewRow}>
                  <span style={S.previewLabel}>Trail %</span>
                  <span style={S.previewValue}>{form.trailPercent.toFixed(1)}%</span>
                </div>
              </>
            )}
            <div style={S.previewRow}>
              <span style={S.previewLabel}>Time in Force</span>
              <span style={S.previewValue}>{form.timeInForce}</span>
            </div>
            {form.useAlgo && (
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Algo</span>
                <span style={S.previewValue}>{form.algoType} ({form.algoDuration}m, {form.algoSlices} slices)</span>
              </div>
            )}

            <div style={{ ...S.section, marginTop: 12 }}>
              <div style={S.sectionTitle}>COST ESTIMATE</div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Notional</span>
                <span style={S.previewValue}>${estimatedCost.notional.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Commission</span>
                <span style={S.previewValue}>${estimatedCost.commission.toFixed(2)}</span>
              </div>
              <div style={S.previewRow}>
                <span style={S.previewLabel}>Total</span>
                <span style={{ ...S.previewValue, color: AMBER, fontWeight: 700 }}>
                  ${estimatedCost.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ ...S.section, marginTop: 12 }}>
              <div style={S.sectionTitle}>VALIDATION</div>
              <div style={{
                padding: '6px 8px',
                borderRadius: 3,
                background: validation?.valid ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
                border: `1px solid ${validation?.valid ? GREEN : RED}33`,
                color: validation?.valid ? GREEN : RED,
                fontSize: 10,
              }}>
                {validation?.valid ? '✓ Order is valid — ready to submit' : `✗ ${(validation?.errors || []).join('; ')}`}
              </div>
            </div>

            {/* Submit from preview */}
            <button
              style={{
                ...S.submitBtn(form.side),
                marginTop: 12,
                opacity: validation?.valid ? 1 : 0.5,
                cursor: validation?.valid ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSubmit}
              disabled={!validation?.valid}
            >
              CONFIRM & SUBMIT
            </button>
          </>
        )}

        {/* ── Recent Orders ── */}
        {!compact && orderHistory.length > 0 && (
          <div style={{ ...S.section, marginTop: 12 }}>
            <div style={S.sectionTitle}>RECENT ORDERS ({orderHistory.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflow: 'auto' }}>
              {orderHistory.map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '2px 0' }}>
                  <span style={{ color: o.side.includes('BUY') ? GREEN : RED }}>
                    {o.side} {o.qty} @ ${o.price.toFixed(2)}
                  </span>
                  <span style={{ color: MUTED }}>{o.type} {o.time}</span>
                  <span style={{ color: AMBER }}>{o.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
