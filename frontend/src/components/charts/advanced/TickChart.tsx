import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Filter, Volume2, VolumeX, ArrowUp, ArrowDown, Activity } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TickData {
  id: string;
  timestamp: number;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  isDarkPool?: boolean;
  exchange?: string;
}

export interface TickChartProps {
  ticks: TickData[];
  currentPrice?: number;
  minSizeFilter?: number;
  largeTradeTreshold?: number;
  showDarkPool?: boolean;
  maxVisibleTicks?: number;
  onTickClick?: (tick: TickData) => void;
  className?: string;
}

interface AggregatedLevel {
  price: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  lastTime: number;
}

// ─── Lee-Ready Algorithm ─────────────────────────────────────────────────────

function classifyTrade(
  price: number,
  prevPrice: number,
  midQuote?: number
): 'buy' | 'sell' | 'unknown' {
  if (midQuote !== undefined) {
    if (price > midQuote) return 'buy';
    if (price < midQuote) return 'sell';
  }
  if (price > prevPrice) return 'buy';
  if (price < prevPrice) return 'sell';
  return 'unknown';
}

// ─── Tape Speed ──────────────────────────────────────────────────────────────

function computeTapeSpeed(ticks: TickData[], windowMs: number = 5000): number {
  if (ticks.length < 2) return 0;
  const now = ticks[ticks.length - 1].timestamp;
  const recent = ticks.filter((t) => t.timestamp >= now - windowMs);
  return recent.length;
}

// ─── Running VWAP ────────────────────────────────────────────────────────────

function computeVWAP(ticks: TickData[]): number {
  if (ticks.length === 0) return 0;
  let sumPV = 0;
  let sumV = 0;
  for (const t of ticks) {
    sumPV += t.price * t.size;
    sumV += t.size;
  }
  return sumV > 0 ? sumPV / sumV : 0;
}

// ─── Cumulative Delta ────────────────────────────────────────────────────────

function computeCumulativeDelta(ticks: TickData[]): number {
  let delta = 0;
  for (const t of ticks) {
    if (t.side === 'buy') delta += t.size;
    else if (t.side === 'sell') delta -= t.size;
  }
  return delta;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const TickChart: React.FC<TickChartProps> = ({
  ticks,
  currentPrice,
  minSizeFilter: propMinSize,
  largeTradeTreshold = 1000,
  showDarkPool = true,
  maxVisibleTicks = 200,
  onTickClick,
  className = '',
}) => {
  const [minSize, setMinSize] = useState(propMinSize ?? 0);
  const [showFilter, setShowFilter] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showAggregated, setShowAggregated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTickCount = useRef(ticks.length);

  const filteredTicks = useMemo(() => {
    let result = ticks;
    if (minSize > 0) {
      result = result.filter((t) => t.size >= minSize);
    }
    if (!showDarkPool) {
      result = result.filter((t) => !t.isDarkPool);
    }
    return result.slice(-maxVisibleTicks);
  }, [ticks, minSize, showDarkPool, maxVisibleTicks]);

  const tapeSpeed = useMemo(() => computeTapeSpeed(ticks), [ticks]);
  const vwap = useMemo(() => computeVWAP(ticks), [ticks]);
  const cumDelta = useMemo(() => computeCumulativeDelta(ticks), [ticks]);

  const totalBuyVol = useMemo(
    () => ticks.filter((t) => t.side === 'buy').reduce((s, t) => s + t.size, 0),
    [ticks]
  );
  const totalSellVol = useMemo(
    () => ticks.filter((t) => t.side === 'sell').reduce((s, t) => s + t.size, 0),
    [ticks]
  );

  const aggregated = useMemo(() => {
    const map = new Map<number, AggregatedLevel>();
    for (const t of filteredTicks) {
      const existing = map.get(t.price);
      if (existing) {
        if (t.side === 'buy') existing.buyVolume += t.size;
        else if (t.side === 'sell') existing.sellVolume += t.size;
        existing.tradeCount++;
        existing.lastTime = Math.max(existing.lastTime, t.timestamp);
      } else {
        map.set(t.price, {
          price: t.price,
          buyVolume: t.side === 'buy' ? t.size : 0,
          sellVolume: t.side === 'sell' ? t.size : 0,
          tradeCount: 1,
          lastTime: t.timestamp,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.price - a.price);
  }, [filteredTicks]);

  useEffect(() => {
    if (autoScroll && scrollRef.current && ticks.length > prevTickCount.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevTickCount.current = ticks.length;
  }, [ticks.length, autoScroll]);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const formatSize = useCallback((size: number) => {
    if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`;
    if (size >= 1_000) return `${(size / 1_000).toFixed(1)}K`;
    return size.toString();
  }, []);

  const speedLevel =
    tapeSpeed > 100 ? 'fast' : tapeSpeed > 30 ? 'medium' : 'slow';

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500 font-medium">Time & Sales</span>

        {/* Tape speed */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            speedLevel === 'fast'
              ? 'bg-red-900/30 text-red-400'
              : speedLevel === 'medium'
                ? 'bg-yellow-900/30 text-yellow-400'
                : 'bg-neutral-800 text-neutral-500'
          }`}
        >
          <Activity size={10} />
          <span>{tapeSpeed}/5s</span>
        </div>

        {/* VWAP */}
        <div className="text-[10px] text-neutral-500">
          VWAP: <span className="text-neutral-300 font-medium">{vwap.toFixed(2)}</span>
        </div>

        {/* Cum Delta */}
        <div className="text-[10px] text-neutral-500">
          CΔ:{' '}
          <span className={`font-medium ${cumDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {cumDelta >= 0 ? '+' : ''}{formatSize(cumDelta)}
          </span>
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <button
          onClick={() => setShowAggregated(!showAggregated)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            showAggregated
              ? 'bg-blue-900/30 text-blue-400'
              : 'text-neutral-500 hover:bg-neutral-800'
          }`}
        >
          Agg
        </button>

        {/* Filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-1 rounded transition-colors ${
              minSize > 0 ? 'text-blue-400 bg-blue-900/30' : 'text-neutral-500 hover:bg-neutral-800'
            }`}
          >
            <Filter size={12} />
          </button>
          {showFilter && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-3 min-w-[160px] text-xs">
              <label className="text-neutral-400 block mb-1">Min Size</label>
              <input
                type="number"
                value={minSize}
                onChange={(e) => setMinSize(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-neutral-800 text-white px-2 py-1 rounded border border-neutral-700 outline-none text-xs"
              />
              <div className="flex gap-1 mt-2">
                {[0, 100, 500, 1000, 5000].map((s) => (
                  <button
                    key={s}
                    onClick={() => setMinSize(s)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      minSize === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {s === 0 ? 'All' : formatSize(s)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auto-scroll */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`p-1 rounded transition-colors ${
            autoScroll ? 'text-emerald-400 bg-emerald-900/30' : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          {autoScroll ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </button>
      </div>

      {/* Volume summary bar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900/50 border-b border-neutral-800/50 shrink-0 text-[10px]">
        <span className="text-neutral-500">Vol:</span>
        <span className="text-emerald-400">{formatSize(totalBuyVol)} buy</span>
        <span className="text-neutral-600">/</span>
        <span className="text-red-400">{formatSize(totalSellVol)} sell</span>
        <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden mx-2">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: `${totalBuyVol + totalSellVol > 0 ? (totalBuyVol / (totalBuyVol + totalSellVol)) * 100 : 50}%`,
            }}
          />
        </div>
        <span className="text-neutral-500">
          {totalBuyVol + totalSellVol > 0
            ? `${((totalBuyVol / (totalBuyVol + totalSellVol)) * 100).toFixed(0)}%`
            : '50%'}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[70px_1fr_80px_80px] gap-0 px-1 py-1 bg-neutral-900/30 border-b border-neutral-800/30 text-[10px] text-neutral-600 font-medium shrink-0">
        <span className="px-2">Time</span>
        <span className="px-2">Price</span>
        <span className="px-2 text-right">Size</span>
        <span className="px-2 text-right">{showAggregated ? 'Trades' : 'Exchange'}</span>
      </div>

      {/* Tick list */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        onScroll={() => {
          if (!scrollRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          if (scrollHeight - scrollTop - clientHeight > 50) {
            setAutoScroll(false);
          }
        }}
      >
        {showAggregated ? (
          aggregated.map((level) => (
            <div
              key={level.price}
              className="grid grid-cols-[70px_1fr_80px_80px] gap-0 px-1 py-0.5 text-xs
                hover:bg-neutral-900/50 border-b border-neutral-900/30 transition-colors"
            >
              <span className="px-2 text-neutral-600 tabular-nums">
                {formatTime(level.lastTime)}
              </span>
              <span className="px-2 text-white font-medium tabular-nums">
                {level.price.toFixed(2)}
              </span>
              <div className="px-2 text-right flex items-center justify-end gap-1">
                <span className="text-emerald-400 tabular-nums">{formatSize(level.buyVolume)}</span>
                <span className="text-neutral-700">/</span>
                <span className="text-red-400 tabular-nums">{formatSize(level.sellVolume)}</span>
              </div>
              <span className="px-2 text-right text-neutral-500 tabular-nums">
                {level.tradeCount}
              </span>
            </div>
          ))
        ) : (
          filteredTicks.map((tick) => {
            const isLarge = tick.size >= largeTradeTreshold;
            const isBuy = tick.side === 'buy';
            const isSell = tick.side === 'sell';

            return (
              <div
                key={tick.id}
                onClick={() => onTickClick?.(tick)}
                className={`grid grid-cols-[70px_1fr_80px_80px] gap-0 px-1 py-0.5 text-xs
                  border-b border-neutral-900/30 transition-colors cursor-pointer
                  ${isLarge ? 'bg-yellow-900/10 hover:bg-yellow-900/20' : 'hover:bg-neutral-900/50'}
                  ${tick.isDarkPool ? 'italic' : ''}`}
              >
                <span className="px-2 text-neutral-600 tabular-nums">
                  {formatTime(tick.timestamp)}
                </span>
                <div className="px-2 flex items-center gap-1">
                  {isBuy && <ArrowUp size={10} className="text-emerald-500" />}
                  {isSell && <ArrowDown size={10} className="text-red-500" />}
                  <span
                    className={`font-medium tabular-nums ${
                      isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-neutral-400'
                    }`}
                  >
                    {tick.price.toFixed(2)}
                  </span>
                  {tick.isDarkPool && (
                    <span className="text-[8px] px-1 py-0 rounded bg-purple-900/40 text-purple-400">
                      DP
                    </span>
                  )}
                </div>
                <span
                  className={`px-2 text-right tabular-nums font-medium ${
                    isLarge ? 'text-yellow-400' : 'text-neutral-300'
                  }`}
                >
                  {formatSize(tick.size)}
                </span>
                <span className="px-2 text-right text-neutral-600 tabular-nums">
                  {tick.exchange ?? '—'}
                </span>
              </div>
            );
          })
        )}

        {filteredTicks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-xs">
            {minSize > 0 ? `No trades ≥ ${formatSize(minSize)}` : 'Waiting for trades...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TickChart;
