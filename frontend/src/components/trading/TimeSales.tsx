import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Trade {
  id: string;
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  isDarkPool: boolean;
  cumVolume: number;
}

interface AggregatedTrade {
  price: number;
  totalSize: number;
  count: number;
  side: 'buy' | 'sell' | 'mixed';
  lastTime: number;
}

interface TimeSalesProps {
  symbol?: string;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  className?: string;
  onTradeClick?: (trade: Trade) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let tradeId = 0;
const genId = () => `t-${++tradeId}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtMs = (ts: number) => '.' + String(new Date(ts).getMilliseconds()).padStart(3, '0');
const fmtPrice = (n: number) => n.toFixed(2);
const fmtSize = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

function generateTrade(lastPrice: number, bid: number, ask: number, cumVol: number): Trade {
  const priceJitter = (Math.random() - 0.5) * (ask - bid) * 2;
  const price = +(lastPrice + priceJitter).toFixed(2);
  const size = Math.floor(Math.random() < 0.85 ? Math.random() * 500 + 10 : Math.random() * 5000 + 500);
  const side = price >= ask ? 'buy' as const : price <= bid ? 'sell' as const : 'unknown' as const;
  return {
    id: genId(),
    time: Date.now(),
    price,
    size,
    side,
    isDarkPool: Math.random() > 0.93,
    cumVolume: cumVol + size,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TimeSales({
  symbol = 'AAPL',
  lastPrice = 189.84,
  bid = 189.82,
  ask = 189.86,
  className = '',
  onTradeClick,
}: TimeSalesProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [minSizeFilter, setMinSizeFilter] = useState(0);
  const [aggregateMode, setAggregateMode] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDarkPool, setShowDarkPool] = useState(true);
  const [tradesPerSecond, setTradesPerSecond] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tpsCountRef = useRef(0);
  const cumVolRef = useRef(0);

  // VWAP
  const vwapRef = useRef({ sumPV: 0, sumV: 0 });

  useEffect(() => {
    const iv = setInterval(() => {
      const count = Math.floor(Math.random() * 4 + 1);
      const newTrades: Trade[] = [];
      for (let i = 0; i < count; i++) {
        const t = generateTrade(lastPrice, bid, ask, cumVolRef.current);
        cumVolRef.current = t.cumVolume;
        vwapRef.current.sumPV += t.price * t.size;
        vwapRef.current.sumV += t.size;
        newTrades.push(t);
      }
      tpsCountRef.current += count;
      setTrades(prev => [...prev.slice(-500), ...newTrades]);
    }, 150);

    const tpsIv = setInterval(() => {
      setTradesPerSecond(Math.round(tpsCountRef.current / 2));
      tpsCountRef.current = 0;
    }, 2000);

    return () => { clearInterval(iv); clearInterval(tpsIv); };
  }, [lastPrice, bid, ask]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [trades, autoScroll]);

  const vwap = useMemo(() => {
    if (vwapRef.current.sumV === 0) return lastPrice;
    return vwapRef.current.sumPV / vwapRef.current.sumV;
  }, [trades.length, lastPrice]);

  const filteredTrades = useMemo(() => {
    let t = trades;
    if (minSizeFilter > 0) t = t.filter(tr => tr.size >= minSizeFilter);
    if (!showDarkPool) t = t.filter(tr => !tr.isDarkPool);
    return t;
  }, [trades, minSizeFilter, showDarkPool]);

  const aggregated = useMemo((): AggregatedTrade[] => {
    if (!aggregateMode) return [];
    const map = new Map<number, AggregatedTrade>();
    for (const t of filteredTrades) {
      const key = t.price;
      if (map.has(key)) {
        const a = map.get(key)!;
        a.totalSize += t.size;
        a.count += 1;
        a.lastTime = Math.max(a.lastTime, t.time);
        if (a.side !== t.side && t.side !== 'unknown') a.side = 'mixed';
      } else {
        map.set(key, { price: key, totalSize: t.size, count: 1, side: t.side === 'unknown' ? 'mixed' : t.side, lastTime: t.time });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.price - a.price);
  }, [filteredTrades, aggregateMode]);

  const maxTradeSize = useMemo(() => Math.max(...filteredTrades.map(t => t.size), 1), [filteredTrades]);

  const handleExport = useCallback(() => {
    const csv = ['Time,Price,Size,Side,DarkPool']
      .concat(filteredTrades.map(t => `${fmtTime(t.time)}${fmtMs(t.time)},${t.price},${t.size},${t.side},${t.isDarkPool}`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_time_sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTrades, symbol]);

  const sideColor = (s: 'buy' | 'sell' | 'unknown' | 'mixed') => {
    if (s === 'buy') return 'text-emerald-400';
    if (s === 'sell') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">T&S</span>
          <span className="text-gray-400">{symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[10px]">{tradesPerSecond} t/s</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-500 text-[10px]">VWAP: <span className="text-amber-400">{fmtPrice(vwap)}</span></span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-500 text-[10px]">Vol: <span className="text-gray-300">{fmtSize(cumVolRef.current)}</span></span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/30 bg-[#0c0c18]">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-[10px]">Min:</span>
          <select
            value={minSizeFilter}
            onChange={e => setMinSizeFilter(Number(e.target.value))}
            className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none"
          >
            <option value={0}>All</option>
            <option value={100}>100+</option>
            <option value={500}>500+</option>
            <option value={1000}>1K+</option>
            <option value={5000}>5K+</option>
            <option value={10000}>10K+</option>
          </select>
        </div>
        <button
          onClick={() => setAggregateMode(a => !a)}
          className={`px-1.5 py-0.5 rounded text-[10px] border ${aggregateMode ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50 hover:text-gray-300'}`}
        >
          Agg
        </button>
        <button
          onClick={() => setShowDarkPool(d => !d)}
          className={`px-1.5 py-0.5 rounded text-[10px] border ${showDarkPool ? 'bg-purple-600/20 text-purple-400 border-purple-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50 hover:text-gray-300'}`}
        >
          DP
        </button>
        <button
          onClick={() => setAutoScroll(a => !a)}
          className={`px-1.5 py-0.5 rounded text-[10px] border ${autoScroll ? 'bg-blue-600/20 text-blue-400 border-blue-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50 hover:text-gray-300'}`}
        >
          Auto
        </button>
        <div className="flex-1" />
        <button onClick={handleExport} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">
          Export
        </button>
      </div>

      {/* Column Headers */}
      <div className={`grid ${aggregateMode ? 'grid-cols-[70px_1fr_80px_50px_60px]' : 'grid-cols-[90px_1fr_80px_50px_20px]'} px-2 py-1 border-b border-gray-800/30 text-[10px] text-gray-500 uppercase tracking-wider`}>
        <span>Time</span>
        <span className="text-center">Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Side</span>
        <span className="text-right">{aggregateMode ? 'Count' : ''}</span>
      </div>

      {/* Trade Tape */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '400px' }}>
        {aggregateMode ? (
          aggregated.map((a, i) => (
            <div
              key={`agg-${i}`}
              className="grid grid-cols-[70px_1fr_80px_50px_60px] px-2 py-[2px] hover:bg-[#12121f] transition-colors"
            >
              <span className="text-gray-600">{fmtTime(a.lastTime)}</span>
              <span className={`text-center font-mono tabular-nums ${sideColor(a.side)}`}>{fmtPrice(a.price)}</span>
              <span className="text-right font-mono tabular-nums text-gray-300 relative">
                <span
                  className={`absolute inset-y-0 right-0 ${a.side === 'buy' ? 'bg-emerald-900/15' : a.side === 'sell' ? 'bg-red-900/15' : 'bg-gray-800/20'}`}
                  style={{ width: `${Math.min(100, (a.totalSize / maxTradeSize) * 100)}%` }}
                />
                <span className="relative">{fmtSize(a.totalSize)}</span>
              </span>
              <span className={`text-right ${sideColor(a.side)}`}>{a.side.toUpperCase()}</span>
              <span className="text-right text-gray-500">{a.count}</span>
            </div>
          ))
        ) : (
          filteredTrades.map(t => {
            const isLarge = t.size >= 1000;
            return (
              <div
                key={t.id}
                onClick={() => onTradeClick?.(t)}
                className={`grid grid-cols-[90px_1fr_80px_50px_20px] px-2 py-[2px] cursor-pointer hover:bg-[#12121f] transition-colors ${isLarge ? 'font-bold' : ''}`}
              >
                <span className="text-gray-600 font-mono">
                  {fmtTime(t.time)}<span className="text-gray-700">{fmtMs(t.time)}</span>
                </span>
                <span className={`text-center font-mono tabular-nums ${sideColor(t.side)}`}>{fmtPrice(t.price)}</span>
                <span className={`text-right font-mono tabular-nums relative ${isLarge ? 'text-amber-300' : 'text-gray-300'}`}>
                  <span
                    className={`absolute inset-y-0 right-0 ${t.side === 'buy' ? 'bg-emerald-900/15' : t.side === 'sell' ? 'bg-red-900/15' : 'bg-gray-800/20'}`}
                    style={{ width: `${Math.min(100, (t.size / maxTradeSize) * 100)}%` }}
                  />
                  <span className="relative">{fmtSize(t.size)}</span>
                </span>
                <span className={`text-right text-[10px] ${sideColor(t.side)}`}>
                  {t.side === 'buy' ? 'B' : t.side === 'sell' ? 'S' : '—'}
                </span>
                <span className="text-right">
                  {t.isDarkPool && <span className="text-purple-400 text-[9px]" title="Dark Pool">●</span>}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-900/20 bg-[#0d0d1a] text-[10px]">
        <span className="text-gray-500">Trades: <span className="text-gray-300">{filteredTrades.length}</span></span>
        <div className="flex gap-3">
          <span className="text-gray-500">Buys: <span className="text-emerald-400">{filteredTrades.filter(t => t.side === 'buy').length}</span></span>
          <span className="text-gray-500">Sells: <span className="text-red-400">{filteredTrades.filter(t => t.side === 'sell').length}</span></span>
        </div>
      </div>
    </div>
  );
}
