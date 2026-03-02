import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO' | 'BRACKET';
type OrderSide = 'BUY' | 'SELL';
type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK' | 'GTD';

interface OrderTicketProps {
  symbol?: string;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  accountBalance?: number;
  buyingPower?: number;
  currentPosition?: number;
  commission?: number;
  className?: string;
  onSubmitOrder?: (order: OrderPayload) => void;
}

interface OrderPayload {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  trailAmount?: number;
  tif: TimeInForce;
  takeProfit?: number;
  stopLoss?: number;
  ocoPrice1?: number;
  ocoPrice2?: number;
  gtdDate?: string;
}

interface BracketConfig {
  takeProfitOffset: number;
  stopLossOffset: number;
}

interface OcoConfig {
  price1: number;
  side1: OrderSide;
  price2: number;
  side2: OrderSide;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ORDER_TYPES: { value: OrderType; label: string; desc: string }[] = [
  { value: 'MARKET', label: 'Market', desc: 'Execute immediately at best available price' },
  { value: 'LIMIT', label: 'Limit', desc: 'Execute at specified price or better' },
  { value: 'STOP', label: 'Stop', desc: 'Trigger market order at stop price' },
  { value: 'STOP_LIMIT', label: 'Stop-Limit', desc: 'Trigger limit order at stop price' },
  { value: 'TRAILING_STOP', label: 'Trail Stop', desc: 'Dynamic stop that follows price' },
  { value: 'OCO', label: 'OCO', desc: 'One-Cancels-Other: dual linked orders' },
  { value: 'BRACKET', label: 'Bracket', desc: 'Entry + Take Profit + Stop Loss' },
];

const TIF_OPTIONS: { value: TimeInForce; label: string; desc: string }[] = [
  { value: 'DAY', label: 'DAY', desc: 'Valid for current session' },
  { value: 'GTC', label: 'GTC', desc: 'Good till cancelled' },
  { value: 'IOC', label: 'IOC', desc: 'Immediate or cancel' },
  { value: 'FOK', label: 'FOK', desc: 'Fill or kill' },
  { value: 'GTD', label: 'GTD', desc: 'Good till date' },
];

const LOT_SIZES = [1, 5, 10, 25, 50, 100, 500, 1000];

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUsd = (n: number) => '$' + fmt(n);

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrderTicket({
  symbol = 'AAPL',
  lastPrice = 189.84,
  bid = 189.82,
  ask = 189.86,
  accountBalance = 125000,
  buyingPower = 250000,
  currentPosition = 0,
  commission = 0.65,
  className = '',
  onSubmitOrder,
}: OrderTicketProps) {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [quantity, setQuantity] = useState(100);
  const [lotSize, setLotSize] = useState(100);
  const [price, setPrice] = useState(lastPrice);
  const [stopPrice, setStopPrice] = useState(lastPrice * 0.98);
  const [trailAmount, setTrailAmount] = useState(1.0);
  const [tif, setTif] = useState<TimeInForce>('DAY');
  const [gtdDate, setGtdDate] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [showTypeInfo, setShowTypeInfo] = useState(false);
  const [bracket, setBracket] = useState<BracketConfig>({ takeProfitOffset: 2.0, stopLossOffset: 1.5 });
  const [oco, setOco] = useState<OcoConfig>({ price1: lastPrice * 1.02, side1: 'SELL', price2: lastPrice * 0.98, side2: 'SELL' });

  const priceRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orderType === 'MARKET') setPrice(side === 'BUY' ? ask : bid);
  }, [orderType, side, ask, bid]);

  const tickSize = useMemo(() => (lastPrice > 100 ? 0.05 : 0.01), [lastPrice]);

  const estimatedCost = useMemo(() => {
    const p = orderType === 'MARKET' ? (side === 'BUY' ? ask : bid) : price;
    return quantity * p;
  }, [quantity, price, orderType, side, ask, bid]);

  const commissionTotal = useMemo(() => commission * quantity, [commission, quantity]);

  const marginImpact = useMemo(() => {
    const cost = estimatedCost;
    return side === 'BUY' ? cost * 0.5 : cost * 0.3;
  }, [estimatedCost, side]);

  const positionImpact = useMemo(() => {
    const newPos = side === 'BUY' ? currentPosition + quantity : currentPosition - quantity;
    let action: string;
    if (currentPosition === 0) action = 'Open New';
    else if ((currentPosition > 0 && side === 'BUY') || (currentPosition < 0 && side === 'SELL')) action = 'Add to';
    else if (Math.abs(quantity) >= Math.abs(currentPosition) && ((currentPosition > 0 && side === 'SELL') || (currentPosition < 0 && side === 'BUY'))) action = quantity > Math.abs(currentPosition) ? 'Reverse' : 'Close';
    else action = 'Reduce';
    return { action, newPos };
  }, [currentPosition, quantity, side]);

  const handlePriceKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setPrice(p => +(p + tickSize).toFixed(4)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setPrice(p => +(p - tickSize).toFixed(4)); }
  }, [tickSize]);

  const handleQtyKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setQuantity(q => q + lotSize); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setQuantity(q => Math.max(lotSize, q - lotSize)); }
  }, [lotSize]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'b' || e.key === 'B') { setSide('BUY'); }
      if (e.key === 's' || e.key === 'S') { setSide('SELL'); }
      if (e.key === 'Enter' && e.ctrlKey) { setShowReview(true); }
      if (e.key === 'Escape') { setShowReview(false); }
      if (e.key === 'p' || e.key === 'P') { priceRef.current?.focus(); }
      if (e.key === 'q' || e.key === 'Q') { qtyRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const buildPayload = useCallback((): OrderPayload => {
    const payload: OrderPayload = { symbol, side, type: orderType, quantity, tif };
    if (orderType !== 'MARKET') payload.price = price;
    if (orderType === 'STOP' || orderType === 'STOP_LIMIT') payload.stopPrice = stopPrice;
    if (orderType === 'TRAILING_STOP') payload.trailAmount = trailAmount;
    if (orderType === 'BRACKET') {
      payload.takeProfit = price + bracket.takeProfitOffset * (side === 'BUY' ? 1 : -1);
      payload.stopLoss = price - bracket.stopLossOffset * (side === 'BUY' ? 1 : -1);
    }
    if (orderType === 'OCO') { payload.ocoPrice1 = oco.price1; payload.ocoPrice2 = oco.price2; }
    if (tif === 'GTD') payload.gtdDate = gtdDate;
    return payload;
  }, [symbol, side, orderType, quantity, price, stopPrice, trailAmount, tif, gtdDate, bracket, oco]);

  const handleSubmit = useCallback(() => {
    onSubmitOrder?.(buildPayload());
    setShowReview(false);
  }, [buildPayload, onSubmitOrder]);

  const handleQuickOrder = useCallback((quickSide: OrderSide) => {
    const payload: OrderPayload = { symbol, side: quickSide, type: 'MARKET', quantity, tif: 'DAY' };
    onSubmitOrder?.(payload);
  }, [symbol, quantity, onSubmitOrder]);

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">{symbol}</span>
          <span className="text-gray-400">{fmtUsd(lastPrice)}</span>
          <span className="text-gray-500">|</span>
          <span className="text-blue-400">{fmtUsd(bid)}</span>
          <span className="text-gray-600">×</span>
          <span className="text-red-400">{fmtUsd(ask)}</span>
        </div>
        <span className="text-gray-500 text-[10px]">Ctrl+Enter to review</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Side Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide('BUY')}
            className={`py-2 rounded font-bold text-sm transition-all ${
              side === 'BUY'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-emerald-900/20 text-emerald-500 border border-emerald-800/40 hover:bg-emerald-900/40'
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`py-2 rounded font-bold text-sm transition-all ${
              side === 'SELL'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                : 'bg-red-900/20 text-red-500 border border-red-800/40 hover:bg-red-900/40'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Order Type */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-gray-500 uppercase tracking-wider text-[10px]">Order Type</label>
            <button onClick={() => setShowTypeInfo(!showTypeInfo)} className="text-amber-600 hover:text-amber-400 text-[10px]">
              {showTypeInfo ? 'Hide Info' : 'Info'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {ORDER_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setOrderType(t.value)}
                className={`py-1.5 px-1 rounded text-[10px] font-medium transition-all ${
                  orderType === t.value
                    ? 'bg-amber-600 text-black'
                    : 'bg-[#12121f] text-gray-400 hover:bg-[#1a1a2e] border border-gray-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {showTypeInfo && (
            <p className="mt-1 text-gray-500 text-[10px] italic">
              {ORDER_TYPES.find(t => t.value === orderType)?.desc}
            </p>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">Quantity</label>
          <div className="flex gap-1">
            <input
              ref={qtyRef}
              type="number"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              onKeyDown={handleQtyKey}
              className="flex-1 bg-[#12121f] border border-gray-800/50 rounded px-2 py-1.5 text-amber-300 text-right focus:border-amber-600/50 focus:outline-none"
            />
            <select
              value={lotSize}
              onChange={e => setLotSize(Number(e.target.value))}
              className="bg-[#12121f] border border-gray-800/50 rounded px-1 text-gray-400 text-[10px] focus:outline-none"
            >
              {LOT_SIZES.map(l => (
                <option key={l} value={l}>±{l}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 mt-1">
            {[25, 50, 100, 200, 500].map(q => (
              <button key={q} onClick={() => setQuantity(q)} className="flex-1 py-0.5 bg-[#12121f] text-gray-500 rounded text-[10px] hover:bg-[#1a1a2e] hover:text-gray-300">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        {orderType !== 'MARKET' && (
          <div>
            <label className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">
              {orderType === 'TRAILING_STOP' ? 'Trail Amount' : 'Limit Price'}
            </label>
            {orderType === 'TRAILING_STOP' ? (
              <input
                type="number"
                step="0.01"
                value={trailAmount}
                onChange={e => setTrailAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1.5 text-amber-300 text-right focus:border-amber-600/50 focus:outline-none"
              />
            ) : (
              <div className="flex gap-1">
                <input
                  ref={priceRef}
                  type="number"
                  step={tickSize}
                  value={price}
                  onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                  onKeyDown={handlePriceKey}
                  className="flex-1 bg-[#12121f] border border-gray-800/50 rounded px-2 py-1.5 text-amber-300 text-right focus:border-amber-600/50 focus:outline-none"
                />
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => setPrice(p => +(p + tickSize).toFixed(4))} className="bg-[#12121f] border border-gray-800/50 rounded px-1.5 text-gray-400 hover:text-amber-400 text-[10px]">▲</button>
                  <button onClick={() => setPrice(p => +(p - tickSize).toFixed(4))} className="bg-[#12121f] border border-gray-800/50 rounded px-1.5 text-gray-400 hover:text-amber-400 text-[10px]">▼</button>
                </div>
              </div>
            )}
            <div className="flex gap-1 mt-1">
              <button onClick={() => setPrice(bid)} className="flex-1 py-0.5 bg-blue-900/20 text-blue-400 rounded text-[10px] hover:bg-blue-900/40">Bid</button>
              <button onClick={() => setPrice(lastPrice)} className="flex-1 py-0.5 bg-gray-800/40 text-gray-300 rounded text-[10px] hover:bg-gray-700/40">Last</button>
              <button onClick={() => setPrice(ask)} className="flex-1 py-0.5 bg-red-900/20 text-red-400 rounded text-[10px] hover:bg-red-900/40">Ask</button>
              <button onClick={() => setPrice(+(lastPrice * 1.001).toFixed(2))} className="flex-1 py-0.5 bg-[#12121f] text-gray-500 rounded text-[10px] hover:bg-[#1a1a2e]">+0.1%</button>
            </div>
          </div>
        )}

        {/* Stop Price (for STOP and STOP_LIMIT) */}
        {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
          <div>
            <label className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">Stop Price</label>
            <input
              type="number"
              step={tickSize}
              value={stopPrice}
              onChange={e => setStopPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1.5 text-orange-300 text-right focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        )}

        {/* Bracket Builder */}
        {orderType === 'BRACKET' && (
          <div className="bg-[#0d0d1a] border border-amber-900/20 rounded p-2 space-y-2">
            <p className="text-amber-500 text-[10px] font-medium uppercase tracking-wider">Bracket Order</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-emerald-400 text-[10px] block mb-0.5">Take Profit Offset</label>
                <input
                  type="number"
                  step="0.1"
                  value={bracket.takeProfitOffset}
                  onChange={e => setBracket(b => ({ ...b, takeProfitOffset: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-emerald-300 text-right text-[11px] focus:outline-none"
                />
                <p className="text-gray-600 text-[9px] mt-0.5">TP: {fmtUsd(price + bracket.takeProfitOffset * (side === 'BUY' ? 1 : -1))}</p>
              </div>
              <div>
                <label className="text-red-400 text-[10px] block mb-0.5">Stop Loss Offset</label>
                <input
                  type="number"
                  step="0.1"
                  value={bracket.stopLossOffset}
                  onChange={e => setBracket(b => ({ ...b, stopLossOffset: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-red-300 text-right text-[11px] focus:outline-none"
                />
                <p className="text-gray-600 text-[9px] mt-0.5">SL: {fmtUsd(price - bracket.stopLossOffset * (side === 'BUY' ? 1 : -1))}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Risk/Reward</span>
              <span className="text-amber-400">{(bracket.takeProfitOffset / bracket.stopLossOffset).toFixed(2)}:1</span>
            </div>
          </div>
        )}

        {/* OCO Builder */}
        {orderType === 'OCO' && (
          <div className="bg-[#0d0d1a] border border-amber-900/20 rounded p-2 space-y-2">
            <p className="text-amber-500 text-[10px] font-medium uppercase tracking-wider">OCO — One Cancels Other</p>
            <div className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <span className="text-gray-500 text-[10px] w-6">Leg1</span>
                <select value={oco.side1} onChange={e => setOco(o => ({ ...o, side1: e.target.value as OrderSide }))} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-[10px] text-gray-300 focus:outline-none">
                  <option value="BUY">BUY</option><option value="SELL">SELL</option>
                </select>
                <input type="number" step={tickSize} value={oco.price1} onChange={e => setOco(o => ({ ...o, price1: parseFloat(e.target.value) || 0 }))} className="flex-1 bg-[#12121f] border border-gray-800/50 rounded px-2 py-0.5 text-amber-300 text-right text-[11px] focus:outline-none" />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-gray-500 text-[10px] w-6">Leg2</span>
                <select value={oco.side2} onChange={e => setOco(o => ({ ...o, side2: e.target.value as OrderSide }))} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-[10px] text-gray-300 focus:outline-none">
                  <option value="BUY">BUY</option><option value="SELL">SELL</option>
                </select>
                <input type="number" step={tickSize} value={oco.price2} onChange={e => setOco(o => ({ ...o, price2: parseFloat(e.target.value) || 0 }))} className="flex-1 bg-[#12121f] border border-gray-800/50 rounded px-2 py-0.5 text-amber-300 text-right text-[11px] focus:outline-none" />
              </div>
            </div>
          </div>
        )}

        {/* Time in Force */}
        <div>
          <label className="text-gray-500 uppercase tracking-wider text-[10px] block mb-1">Time in Force</label>
          <div className="flex gap-1">
            {TIF_OPTIONS.map(t => (
              <button
                key={t.value}
                onClick={() => setTif(t.value)}
                title={t.desc}
                className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                  tif === t.value
                    ? 'bg-amber-600 text-black'
                    : 'bg-[#12121f] text-gray-400 hover:bg-[#1a1a2e] border border-gray-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tif === 'GTD' && (
            <input
              type="date"
              value={gtdDate}
              onChange={e => setGtdDate(e.target.value)}
              className="mt-1 w-full bg-[#12121f] border border-gray-800/50 rounded px-2 py-1 text-gray-300 text-[10px] focus:outline-none"
            />
          )}
        </div>

        {/* Estimates Panel */}
        <div className="bg-[#0d0d1a] border border-gray-800/40 rounded p-2 space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Est. {side === 'BUY' ? 'Cost' : 'Proceeds'}</span><span className="text-amber-300">{fmtUsd(estimatedCost)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Commission</span><span className="text-gray-400">{fmtUsd(commissionTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="text-amber-400 font-medium">{fmtUsd(estimatedCost + commissionTotal)}</span></div>
          <div className="border-t border-gray-800/40 my-1" />
          <div className="flex justify-between"><span className="text-gray-500">Margin Impact</span><span className="text-orange-400">{fmtUsd(marginImpact)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Account Balance</span><span className="text-gray-300">{fmtUsd(accountBalance)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Buying Power</span><span className="text-gray-300">{fmtUsd(buyingPower)}</span></div>
          <div className="border-t border-gray-800/40 my-1" />
          <div className="flex justify-between">
            <span className="text-gray-500">Position Impact</span>
            <span className={`font-medium ${positionImpact.action === 'Close' ? 'text-orange-400' : positionImpact.action === 'Reverse' ? 'text-purple-400' : side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
              {positionImpact.action} → {positionImpact.newPos > 0 ? '+' : ''}{positionImpact.newPos}
            </span>
          </div>
        </div>

        {/* Quick Order Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleQuickOrder('BUY')}
            className="py-1.5 bg-emerald-800/30 text-emerald-400 rounded text-[10px] font-medium hover:bg-emerald-700/40 border border-emerald-800/30 transition-all"
          >
            MKT BUY {quantity}
          </button>
          <button
            onClick={() => handleQuickOrder('SELL')}
            className="py-1.5 bg-red-800/30 text-red-400 rounded text-[10px] font-medium hover:bg-red-700/40 border border-red-800/30 transition-all"
          >
            MKT SELL {quantity}
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={() => setShowReview(true)}
          className={`w-full py-2.5 rounded font-bold text-sm transition-all ${
            side === 'BUY'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
          }`}
        >
          Review {side} Order
        </button>

        {/* Keyboard Shortcuts */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-gray-600">
          <span><kbd className="px-1 bg-gray-800/50 rounded">B</kbd> Buy</span>
          <span><kbd className="px-1 bg-gray-800/50 rounded">S</kbd> Sell</span>
          <span><kbd className="px-1 bg-gray-800/50 rounded">P</kbd> Price</span>
          <span><kbd className="px-1 bg-gray-800/50 rounded">Q</kbd> Qty</span>
          <span><kbd className="px-1 bg-gray-800/50 rounded">↑↓</kbd> Adjust</span>
        </div>
      </div>

      {/* Review Dialog */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowReview(false)}>
          <div className="bg-[#0d0d1a] border border-amber-900/40 rounded-lg p-4 w-80 max-w-[90vw] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-400 font-bold text-sm">Order Confirmation</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Symbol</span><span className="text-amber-300">{symbol}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Side</span><span className={side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{side}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-300">{ORDER_TYPES.find(t => t.value === orderType)?.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Quantity</span><span className="text-gray-300">{quantity.toLocaleString()}</span></div>
              {orderType !== 'MARKET' && <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-amber-300">{fmtUsd(price)}</span></div>}
              {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && <div className="flex justify-between"><span className="text-gray-500">Stop</span><span className="text-orange-300">{fmtUsd(stopPrice)}</span></div>}
              {orderType === 'TRAILING_STOP' && <div className="flex justify-between"><span className="text-gray-500">Trail</span><span className="text-orange-300">{fmtUsd(trailAmount)}</span></div>}
              {orderType === 'BRACKET' && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Take Profit</span><span className="text-emerald-300">{fmtUsd(price + bracket.takeProfitOffset * (side === 'BUY' ? 1 : -1))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Stop Loss</span><span className="text-red-300">{fmtUsd(price - bracket.stopLossOffset * (side === 'BUY' ? 1 : -1))}</span></div>
                </>
              )}
              <div className="flex justify-between"><span className="text-gray-500">TIF</span><span className="text-gray-300">{tif}{tif === 'GTD' ? ` (${gtdDate})` : ''}</span></div>
              <div className="border-t border-gray-800/40 my-1" />
              <div className="flex justify-between"><span className="text-gray-500">Est. Total</span><span className="text-amber-400 font-medium">{fmtUsd(estimatedCost + commissionTotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Position</span><span className="text-gray-300">{positionImpact.action} → {positionImpact.newPos}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setShowReview(false)} className="py-2 bg-gray-800 text-gray-300 rounded text-xs hover:bg-gray-700">Cancel</button>
              <button
                onClick={handleSubmit}
                className={`py-2 rounded text-xs font-bold ${
                  side === 'BUY' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'
                }`}
              >
                Confirm {side}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
