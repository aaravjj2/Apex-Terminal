import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderLevel {
  price: number;
  size: number;
  orders: number;
  cumulative: number;
  isNew: boolean;
  changed: 'up' | 'down' | null;
}

interface OrderBookProps {
  symbol?: string;
  lastPrice?: number;
  tickSize?: number;
  className?: string;
  onPriceClick?: (price: number) => void;
}

type DepthLevel = 5 | 10 | 20 | 50;
type GroupingTick = 0.01 | 0.05 | 0.1 | 0.5 | 1;

// ─── Data Generation ────────────────────────────────────────────────────────

function generateLevels(basePrice: number, side: 'bid' | 'ask', count: number, tick: number): OrderLevel[] {
  const levels: OrderLevel[] = [];
  let cum = 0;
  for (let i = 0; i < count; i++) {
    const offset = (i + 1) * tick;
    const price = side === 'bid' ? basePrice - offset : basePrice + offset;
    const size = Math.floor(Math.random() * 8000 + 200);
    cum += size;
    levels.push({
      price: +price.toFixed(4),
      size,
      orders: Math.floor(Math.random() * 40 + 1),
      cumulative: cum,
      isNew: false,
      changed: null,
    });
  }
  return levels;
}

function perturbLevels(levels: OrderLevel[], maxChange: number): OrderLevel[] {
  return levels.map(l => {
    const delta = Math.floor((Math.random() - 0.5) * maxChange);
    const newSize = Math.max(50, l.size + delta);
    const changed = newSize > l.size ? 'up' as const : newSize < l.size ? 'down' as const : null;
    return { ...l, size: newSize, changed, isNew: Math.random() > 0.97 };
  });
}

function recalcCumulative(levels: OrderLevel[]): OrderLevel[] {
  let cum = 0;
  return levels.map(l => { cum += l.size; return { ...l, cumulative: cum }; });
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const fmtPrice = (n: number) => n.toFixed(2);
const fmtSize = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
const fmtInt = (n: number) => n.toLocaleString();

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrderBook({
  symbol = 'AAPL',
  lastPrice = 189.84,
  tickSize: initialTick = 0.01,
  className = '',
  onPriceClick,
}: OrderBookProps) {
  const [depth, setDepth] = useState<DepthLevel>(20);
  const [grouping, setGrouping] = useState<GroupingTick>(initialTick as GroupingTick);
  const [centerLock, setCenterLock] = useState(true);
  const [bids, setBids] = useState<OrderLevel[]>(() => recalcCumulative(generateLevels(lastPrice, 'bid', 50, initialTick)));
  const [asks, setAsks] = useState<OrderLevel[]>(() => recalcCumulative(generateLevels(lastPrice, 'ask', 50, initialTick)));
  const [spread, setSpread] = useState({ value: 0.04, bps: 2.1, ticks: 4 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setBids(prev => recalcCumulative(perturbLevels(prev, 500)));
      setAsks(prev => recalcCumulative(perturbLevels(prev, 500)));
      const s = +(0.01 + Math.random() * 0.08).toFixed(2);
      setSpread({ value: s, bps: +((s / lastPrice) * 10000).toFixed(1), ticks: Math.round(s / initialTick) });
    }, 300);
    return () => clearInterval(iv);
  }, [lastPrice, initialTick]);

  useEffect(() => {
    if (centerLock && containerRef.current) {
      const el = containerRef.current;
      const mid = el.scrollHeight / 2 - el.clientHeight / 2;
      el.scrollTop = mid;
    }
  }, [bids, asks, centerLock]);

  const groupLevels = useCallback((levels: OrderLevel[], tick: GroupingTick): OrderLevel[] => {
    if (tick <= initialTick) return levels.slice(0, depth);
    const grouped: Map<number, OrderLevel> = new Map();
    for (const l of levels) {
      const key = Math.floor(l.price / tick) * tick;
      const roundedKey = +key.toFixed(4);
      if (grouped.has(roundedKey)) {
        const g = grouped.get(roundedKey)!;
        g.size += l.size;
        g.orders += l.orders;
        g.cumulative = Math.max(g.cumulative, l.cumulative);
      } else {
        grouped.set(roundedKey, { ...l, price: roundedKey });
      }
    }
    return recalcCumulative(Array.from(grouped.values()).slice(0, depth));
  }, [depth, initialTick]);

  const displayBids = useMemo(() => groupLevels(bids, grouping), [bids, grouping, groupLevels]);
  const displayAsks = useMemo(() => groupLevels(asks, grouping), [asks, grouping, groupLevels]);

  const maxCum = useMemo(() => Math.max(
    displayBids[displayBids.length - 1]?.cumulative || 1,
    displayAsks[displayAsks.length - 1]?.cumulative || 1
  ), [displayBids, displayAsks]);

  const handleClick = useCallback((price: number) => {
    onPriceClick?.(price);
  }, [onPriceClick]);

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">L2</span>
          <span className="text-gray-400">{symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={depth}
            onChange={e => setDepth(Number(e.target.value) as DepthLevel)}
            className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none"
          >
            {([5, 10, 20, 50] as DepthLevel[]).map(d => (
              <option key={d} value={d}>{d} lvl</option>
            ))}
          </select>
          <select
            value={grouping}
            onChange={e => setGrouping(Number(e.target.value) as GroupingTick)}
            className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none"
          >
            {([0.01, 0.05, 0.1, 0.5, 1] as GroupingTick[]).map(g => (
              <option key={g} value={g}>{g.toFixed(2)}</option>
            ))}
          </select>
          <button
            onClick={() => setCenterLock(c => !c)}
            className={`px-1.5 py-0.5 rounded text-[10px] border ${centerLock ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50'}`}
          >
            ⊕
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_80px_60px_60px_80px_1fr] px-2 py-1 border-b border-gray-800/30 text-[10px] text-gray-500 uppercase tracking-wider">
        <span className="text-right">Cum Bid</span>
        <span className="text-right">Bid Size</span>
        <span className="text-right">#</span>
        <span className="text-center">Price</span>
        <span className="text-left">Ask Size</span>
        <span className="text-left">Cum Ask</span>
      </div>

      {/* Order Book Body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '500px' }}>
        {/* Asks (reversed so best ask is at bottom) */}
        {[...displayAsks].reverse().map((level, i) => {
          const barW = (level.cumulative / maxCum) * 100;
          return (
            <div
              key={`a-${i}`}
              onClick={() => handleClick(level.price)}
              className={`grid grid-cols-[1fr_80px_60px_60px_80px_1fr] px-2 py-[3px] cursor-pointer hover:bg-red-900/10 relative group transition-colors ${
                level.isNew ? 'animate-pulse' : ''
              }`}
            >
              <span />
              <span />
              <span />
              <span className={`text-center font-mono tabular-nums ${
                level.changed === 'up' ? 'text-red-300' : level.changed === 'down' ? 'text-red-500' : 'text-red-400'
              }`}>
                {fmtPrice(level.price)}
              </span>
              <span className="text-left text-red-400/80 font-mono tabular-nums relative">
                <span className="absolute inset-y-0 left-0 bg-red-900/20 transition-all duration-200" style={{ width: `${barW}%` }} />
                <span className="relative">{fmtSize(level.size)}</span>
              </span>
              <span className="text-left text-red-400/40 font-mono tabular-nums">{fmtInt(level.cumulative)}</span>
            </div>
          );
        })}

        {/* Spread */}
        <div className="grid grid-cols-[1fr_80px_60px_60px_80px_1fr] px-2 py-1.5 bg-[#0d0d1a] border-y border-amber-900/20">
          <span />
          <span />
          <span />
          <div className="text-center">
            <span className="text-amber-400 font-bold">{fmtPrice(lastPrice)}</span>
            <div className="text-[9px] text-gray-500">
              Spd: {spread.value.toFixed(2)} ({spread.bps}bps / {spread.ticks}t)
            </div>
          </div>
          <span />
          <span />
        </div>

        {/* Bids */}
        {displayBids.map((level, i) => {
          const barW = (level.cumulative / maxCum) * 100;
          return (
            <div
              key={`b-${i}`}
              onClick={() => handleClick(level.price)}
              className={`grid grid-cols-[1fr_80px_60px_60px_80px_1fr] px-2 py-[3px] cursor-pointer hover:bg-blue-900/10 relative group transition-colors ${
                level.isNew ? 'animate-pulse' : ''
              }`}
            >
              <span className="text-right text-blue-400/40 font-mono tabular-nums">{fmtInt(level.cumulative)}</span>
              <span className="text-right text-blue-400/80 font-mono tabular-nums relative">
                <span className="absolute inset-y-0 right-0 bg-blue-900/20 transition-all duration-200" style={{ width: `${barW}%` }} />
                <span className="relative">{fmtSize(level.size)}</span>
              </span>
              <span className="text-right text-gray-600 font-mono tabular-nums">{level.orders}</span>
              <span className={`text-center font-mono tabular-nums ${
                level.changed === 'up' ? 'text-blue-300' : level.changed === 'down' ? 'text-blue-500' : 'text-blue-400'
              }`}>
                {fmtPrice(level.price)}
              </span>
              <span />
              <span />
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-900/20 bg-[#0d0d1a] text-[10px]">
        <div className="flex gap-3">
          <span className="text-gray-500">Bid Total: <span className="text-blue-400">{fmtSize(displayBids.reduce((s, l) => s + l.size, 0))}</span></span>
          <span className="text-gray-500">Ask Total: <span className="text-red-400">{fmtSize(displayAsks.reduce((s, l) => s + l.size, 0))}</span></span>
        </div>
        <div className="flex gap-3">
          <span className="text-gray-500">Imbalance: <span className={`${
            displayBids.reduce((s, l) => s + l.size, 0) > displayAsks.reduce((s, l) => s + l.size, 0) ? 'text-blue-400' : 'text-red-400'
          }`}>
            {((displayBids.reduce((s, l) => s + l.size, 0) / (displayBids.reduce((s, l) => s + l.size, 0) + displayAsks.reduce((s, l) => s + l.size, 0))) * 100).toFixed(1)}%
          </span></span>
        </div>
      </div>
    </div>
  );
}
