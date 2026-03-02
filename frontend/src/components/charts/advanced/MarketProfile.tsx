import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Settings, ChevronLeft, ChevronRight, Layers, Eye, EyeOff } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TPOPeriod {
  letter: string;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  prices: number[];
}

export interface MarketProfileSession {
  id: string;
  date: string;
  openPrice: number;
  closePrice: number;
  tickSize: number;
  periods: TPOPeriod[];
  initialBalanceHigh: number;
  initialBalanceLow: number;
}

export type ProfileShape =
  | 'Normal'
  | 'Neutral'
  | 'Trend'
  | 'Double Distribution'
  | 'P-Shape'
  | 'b-Shape';

export type OpeningType = 'Open-Drive' | 'Open-Test-Drive' | 'Open-Rejection-Reverse' | 'Open-Auction';

export interface MarketProfileProps {
  sessions: MarketProfileSession[];
  compositeMode?: boolean;
  showValueArea?: boolean;
  showSinglePrints?: boolean;
  showInitialBalance?: boolean;
  showOpeningType?: boolean;
  valueAreaPercent?: number;
  onPriceClick?: (price: number) => void;
  className?: string;
}

interface ComputedSession {
  session: MarketProfileSession;
  tpoMap: Map<number, string[]>;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  tpoCounts: Map<number, number>;
  singlePrints: Set<number>;
  shape: ProfileShape;
  openingType: OpeningType;
  rangeExtensions: { price: number; period: string }[];
}

// ─── Computations ────────────────────────────────────────────────────────────

function computeSession(
  session: MarketProfileSession,
  valueAreaPct: number
): ComputedSession {
  const tpoMap = new Map<number, string[]>();
  const tpoCounts = new Map<number, number>();
  const tickSize = session.tickSize || 0.25;

  for (const period of session.periods) {
    for (const price of period.prices) {
      const rounded = Math.round(price / tickSize) * tickSize;
      const existing = tpoMap.get(rounded) ?? [];
      existing.push(period.letter);
      tpoMap.set(rounded, existing);
      tpoCounts.set(rounded, (tpoCounts.get(rounded) ?? 0) + 1);
    }
  }

  const prices = [...tpoCounts.keys()].sort((a, b) => b - a);
  if (prices.length === 0) {
    return {
      session,
      tpoMap,
      poc: session.openPrice,
      valueAreaHigh: session.openPrice,
      valueAreaLow: session.openPrice,
      tpoCounts,
      singlePrints: new Set(),
      shape: 'Neutral',
      openingType: 'Open-Auction',
      rangeExtensions: [],
    };
  }

  // POC
  let maxCount = 0;
  let poc = prices[0];
  for (const [price, count] of tpoCounts) {
    if (count > maxCount) {
      maxCount = count;
      poc = price;
    }
  }

  // Value Area
  const totalTPO = [...tpoCounts.values()].reduce((s, c) => s + c, 0);
  const targetTPO = totalTPO * (valueAreaPct / 100);

  const pocIdx = prices.indexOf(poc);
  let vaTPO = tpoCounts.get(poc) ?? 0;
  let hiIdx = pocIdx;
  let loIdx = pocIdx;

  while (vaTPO < targetTPO && (hiIdx > 0 || loIdx < prices.length - 1)) {
    const hiCount = hiIdx > 0 ? (tpoCounts.get(prices[hiIdx - 1]) ?? 0) : 0;
    const loCount = loIdx < prices.length - 1 ? (tpoCounts.get(prices[loIdx + 1]) ?? 0) : 0;

    if (hiCount >= loCount && hiIdx > 0) {
      hiIdx--;
      vaTPO += tpoCounts.get(prices[hiIdx]) ?? 0;
    } else if (loIdx < prices.length - 1) {
      loIdx++;
      vaTPO += tpoCounts.get(prices[loIdx]) ?? 0;
    } else {
      break;
    }
  }

  const valueAreaHigh = prices[hiIdx];
  const valueAreaLow = prices[loIdx];

  // Single prints (only one TPO letter at a price)
  const singlePrints = new Set<number>();
  for (const [price, letters] of tpoMap) {
    if (letters.length === 1) {
      singlePrints.add(price);
    }
  }

  // Profile shape identification
  const shape = identifyShape(prices, tpoCounts, poc, valueAreaHigh, valueAreaLow);

  // Opening type
  const openingType = identifyOpeningType(session);

  // Range extensions
  const rangeExtensions: { price: number; period: string }[] = [];
  let runningHigh = -Infinity;
  let runningLow = Infinity;

  for (const period of session.periods) {
    if (period.high > runningHigh) {
      if (runningHigh !== -Infinity) {
        rangeExtensions.push({ price: period.high, period: period.letter });
      }
      runningHigh = period.high;
    }
    if (period.low < runningLow) {
      if (runningLow !== Infinity) {
        rangeExtensions.push({ price: period.low, period: period.letter });
      }
      runningLow = period.low;
    }
  }

  return {
    session,
    tpoMap,
    poc,
    valueAreaHigh,
    valueAreaLow,
    tpoCounts,
    singlePrints,
    shape,
    openingType,
    rangeExtensions,
  };
}

function identifyShape(
  prices: number[],
  tpoCounts: Map<number, number>,
  poc: number,
  vah: number,
  val: number
): ProfileShape {
  if (prices.length < 3) return 'Neutral';

  const third = Math.floor(prices.length / 3);
  const topPrices = prices.slice(0, third);
  const midPrices = prices.slice(third, third * 2);
  const botPrices = prices.slice(third * 2);

  const topTPO = topPrices.reduce((s, p) => s + (tpoCounts.get(p) ?? 0), 0);
  const midTPO = midPrices.reduce((s, p) => s + (tpoCounts.get(p) ?? 0), 0);
  const botTPO = botPrices.reduce((s, p) => s + (tpoCounts.get(p) ?? 0), 0);

  const pocPosition = (prices[0] - poc) / (prices[0] - prices[prices.length - 1] || 1);

  if (midTPO > topTPO * 1.3 && midTPO > botTPO * 1.3) return 'Normal';
  if (topTPO > midTPO * 1.3 && botTPO > midTPO * 1.3) return 'Double Distribution';
  if (topTPO > botTPO * 1.5 && pocPosition < 0.35) return 'P-Shape';
  if (botTPO > topTPO * 1.5 && pocPosition > 0.65) return 'b-Shape';
  if (Math.abs(topTPO - botTPO) < topTPO * 0.3) return 'Neutral';
  return 'Trend';
}

function identifyOpeningType(session: MarketProfileSession): OpeningType {
  if (session.periods.length < 2) return 'Open-Auction';

  const firstPeriod = session.periods[0];
  const secondPeriod = session.periods[1];
  const openPrice = session.openPrice;

  const firstRange = firstPeriod.high - firstPeriod.low;
  const ibRange = session.initialBalanceHigh - session.initialBalanceLow;

  if (firstRange > ibRange * 0.6) {
    const direction = firstPeriod.high > openPrice ? 'up' : 'down';
    const continued =
      direction === 'up'
        ? secondPeriod.high >= firstPeriod.high
        : secondPeriod.low <= firstPeriod.low;
    return continued ? 'Open-Drive' : 'Open-Test-Drive';
  }

  const reversed =
    (firstPeriod.high > openPrice && secondPeriod.low < firstPeriod.low) ||
    (firstPeriod.low < openPrice && secondPeriod.high > firstPeriod.high);

  return reversed ? 'Open-Rejection-Reverse' : 'Open-Auction';
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderMarketProfile(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  computed: ComputedSession[],
  showVA: boolean,
  showSinglePrints: boolean,
  showIB: boolean,
  currentIdx: number
) {
  ctx.clearRect(0, 0, width, height);

  if (computed.length === 0) {
    ctx.fillStyle = '#737373';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No market profile data', width / 2, height / 2);
    return;
  }

  const cs = computed[currentIdx];
  if (!cs) return;

  const padding = { top: 30, bottom: 20, left: 60, right: 20 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const prices = [...cs.tpoMap.keys()].sort((a, b) => b - a);
  if (prices.length === 0) return;

  const priceMax = prices[0];
  const priceMin = prices[prices.length - 1];
  const priceRange = priceMax - priceMin || 1;
  const rowH = Math.min(chartH / prices.length, 16);
  const letterW = 9;

  const priceToY = (p: number) =>
    padding.top + ((priceMax - p) / priceRange) * chartH;

  // Date header
  ctx.fillStyle = '#e5e5e5';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(cs.session.date, width / 2, 18);

  // Value Area background
  if (showVA) {
    const vaTop = priceToY(cs.valueAreaHigh);
    const vaBot = priceToY(cs.valueAreaLow);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
    ctx.fillRect(padding.left, vaTop, chartW, vaBot - vaTop);

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#3b82f680';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, vaTop);
    ctx.lineTo(padding.left + chartW, vaTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding.left, vaBot);
    ctx.lineTo(padding.left + chartW, vaBot);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Initial Balance
  if (showIB) {
    const ibTop = priceToY(cs.session.initialBalanceHigh);
    const ibBot = priceToY(cs.session.initialBalanceLow);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
    ctx.fillRect(padding.left, ibTop, chartW, ibBot - ibTop);

    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = '#a855f780';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, ibTop);
    ctx.lineTo(padding.left + chartW, ibTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding.left, ibBot);
    ctx.lineTo(padding.left + chartW, ibBot);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // TPO letters
  for (const price of prices) {
    const letters = cs.tpoMap.get(price) ?? [];
    const y = priceToY(price);
    const isPOC = price === cs.poc;
    const inVA = price >= cs.valueAreaLow && price <= cs.valueAreaHigh;
    const isSingle = cs.singlePrints.has(price);

    // Price label
    ctx.fillStyle = isPOC ? '#3b82f6' : '#525252';
    ctx.font = `${isPOC ? 'bold ' : ''}9px system-ui`;
    ctx.textAlign = 'right';
    ctx.fillText(price.toFixed(2), padding.left - 6, y + rowH * 0.35);

    // POC marker
    if (isPOC) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(padding.left, y - rowH / 2, chartW, rowH);
    }

    // Letters
    for (let i = 0; i < letters.length; i++) {
      const lx = padding.left + 4 + i * letterW;
      if (lx + letterW > padding.left + chartW) break;

      const isInVA = showVA && inVA;
      const letterColor = isPOC
        ? '#60a5fa'
        : isSingle && showSinglePrints
          ? '#a855f7'
          : isInVA
            ? '#d4d4d4'
            : '#737373';

      ctx.fillStyle = letterColor;
      ctx.font = `${isPOC ? 'bold ' : ''}10px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(letters[i], lx, y + rowH * 0.35);
    }

    // Single print indicator
    if (isSingle && showSinglePrints) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
      const lx = padding.left + 4;
      ctx.fillRect(lx, y - rowH / 2, letterW, rowH);
    }
  }

  // Opening price marker
  const openY = priceToY(cs.session.openPrice);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(padding.left - 2, openY - 4);
  ctx.lineTo(padding.left + 4, openY);
  ctx.lineTo(padding.left - 2, openY + 4);
  ctx.fill();

  // Legend
  ctx.fillStyle = '#525252';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'right';
  const legendX = width - 10;
  let legendY = padding.top + 10;

  ctx.fillStyle = '#3b82f6';
  ctx.fillText(`POC: ${cs.poc.toFixed(2)}`, legendX, legendY);
  legendY += 14;
  ctx.fillStyle = '#737373';
  ctx.fillText(`VAH: ${cs.valueAreaHigh.toFixed(2)}`, legendX, legendY);
  legendY += 12;
  ctx.fillText(`VAL: ${cs.valueAreaLow.toFixed(2)}`, legendX, legendY);
  legendY += 14;
  ctx.fillStyle = '#a855f7';
  ctx.fillText(`Shape: ${cs.shape}`, legendX, legendY);
  legendY += 12;
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`Open: ${cs.openingType}`, legendX, legendY);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const MarketProfile: React.FC<MarketProfileProps> = ({
  sessions,
  compositeMode = false,
  showValueArea: propShowVA = true,
  showSinglePrints: propShowSP = true,
  showInitialBalance: propShowIB = true,
  showOpeningType: propShowOT = true,
  valueAreaPercent = 70,
  onPriceClick,
  className = '',
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showVA, setShowVA] = useState(propShowVA);
  const [showSP, setShowSP] = useState(propShowSP);
  const [showIB, setShowIB] = useState(propShowIB);
  const [showSettings, setShowSettings] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => {
    if (compositeMode && sessions.length > 1) {
      const merged: MarketProfileSession = {
        id: 'composite',
        date: `${sessions[0]?.date ?? ''} - ${sessions[sessions.length - 1]?.date ?? ''}`,
        openPrice: sessions[0]?.openPrice ?? 0,
        closePrice: sessions[sessions.length - 1]?.closePrice ?? 0,
        tickSize: sessions[0]?.tickSize ?? 0.25,
        periods: sessions.flatMap((s) => s.periods),
        initialBalanceHigh: Math.max(...sessions.map((s) => s.initialBalanceHigh)),
        initialBalanceLow: Math.min(...sessions.map((s) => s.initialBalanceLow)),
      };
      return [computeSession(merged, valueAreaPercent)];
    }
    return sessions.map((s) => computeSession(s, valueAreaPercent));
  }, [sessions, compositeMode, valueAreaPercent]);

  useEffect(() => {
    if (currentIdx >= computed.length) {
      setCurrentIdx(Math.max(0, computed.length - 1));
    }
  }, [computed.length, currentIdx]);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    renderMarketProfile(ctx, size.width, size.height, computed, showVA, showSP, showIB, currentIdx);
  }, [size, computed, showVA, showSP, showIB, currentIdx]);

  const currentComputed = computed[currentIdx];

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500 font-medium">Market Profile</span>

        {computed.length > 1 && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-neutral-400 min-w-[80px] text-center">
              {currentComputed?.session.date ?? ''}
            </span>
            <button
              onClick={() => setCurrentIdx((i) => Math.min(computed.length - 1, i + 1))}
              disabled={currentIdx === computed.length - 1}
              className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {currentComputed && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-purple-400">{currentComputed.shape}</span>
            <span className="text-yellow-400">{currentComputed.openingType}</span>
            <span className="text-neutral-500">
              TPO Count: {[...currentComputed.tpoCounts.values()].reduce((s, c) => s + c, 0)}
            </span>
          </div>
        )}

        <button
          onClick={() => setShowVA(!showVA)}
          className={`p-1 rounded transition-colors ${
            showVA ? 'text-blue-400 bg-blue-900/30' : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title="Value Area"
        >
          <Layers size={12} />
        </button>

        <button
          onClick={() => setShowSP(!showSP)}
          className={`p-1 rounded transition-colors ${
            showSP ? 'text-purple-400 bg-purple-900/30' : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title="Single Prints"
        >
          {showSP ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          >
            <Settings size={12} />
          </button>
          {showSettings && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-3 min-w-[180px] text-xs">
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVA}
                  onChange={(e) => setShowVA(e.target.checked)}
                  className="accent-blue-500"
                />
                Value Area
              </label>
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSP}
                  onChange={(e) => setShowSP(e.target.checked)}
                  className="accent-blue-500"
                />
                Single Prints
              </label>
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIB}
                  onChange={(e) => setShowIB(e.target.checked)}
                  className="accent-blue-500"
                />
                Initial Balance
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onClick={(e) => {
            if (!onPriceClick || !canvasRef.current || !currentComputed) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const padding = { top: 30, bottom: 20 };
            const chartH = size.height - padding.top - padding.bottom;
            const prices = [...currentComputed.tpoMap.keys()].sort((a, b) => b - a);
            if (prices.length === 0) return;
            const priceMax = prices[0];
            const priceMin = prices[prices.length - 1];
            const priceRange = priceMax - priceMin || 1;
            const price = priceMax - ((y - padding.top) / chartH) * priceRange;
            onPriceClick(price);
          }}
        />
      </div>
    </div>
  );
};

export default MarketProfile;
