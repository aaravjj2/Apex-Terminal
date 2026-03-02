import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Settings, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FootprintLevel {
  price: number;
  bidVolume: number;
  askVolume: number;
  trades: number;
}

export interface FootprintBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  levels: FootprintLevel[];
}

export type FootprintMode = 'bidAsk' | 'delta' | 'profile';

export interface ImbalanceConfig {
  threshold: number;
  stackingMin: number;
}

export interface FootprintChartProps {
  bars: FootprintBar[];
  mode?: FootprintMode;
  imbalanceConfig?: ImbalanceConfig;
  largeTradeTreshold?: number;
  showCumulativeDelta?: boolean;
  showDiagonalDelta?: boolean;
  showPOC?: boolean;
  onPriceClick?: (price: number, timestamp: number) => void;
  className?: string;
}

interface ComputedBar {
  bar: FootprintBar;
  poc: number;
  cumulativeDelta: number;
  imbalances: Map<number, 'bid' | 'ask'>;
  absorbedLevels: Set<number>;
}

// ─── Computations ────────────────────────────────────────────────────────────

function computeBar(
  bar: FootprintBar,
  runningDelta: number,
  imbalanceCfg: ImbalanceConfig,
  largeTradeThreshold: number
): ComputedBar {
  let maxVol = 0;
  let pocPrice = bar.close;
  let barDelta = 0;

  for (const level of bar.levels) {
    const total = level.bidVolume + level.askVolume;
    if (total > maxVol) {
      maxVol = total;
      pocPrice = level.price;
    }
    barDelta += level.askVolume - level.bidVolume;
  }

  const imbalances = new Map<number, 'bid' | 'ask'>();
  const absorbedLevels = new Set<number>();
  const sortedLevels = [...bar.levels].sort((a, b) => b.price - a.price);

  for (const level of sortedLevels) {
    const total = level.bidVolume + level.askVolume;
    if (total === 0) continue;

    if (level.askVolume > 0 && level.bidVolume > 0) {
      const ratio = level.askVolume / level.bidVolume;
      if (ratio >= imbalanceCfg.threshold) {
        imbalances.set(level.price, 'ask');
      } else if (1 / ratio >= imbalanceCfg.threshold) {
        imbalances.set(level.price, 'bid');
      }
    } else if (level.askVolume > 0 && level.bidVolume === 0) {
      imbalances.set(level.price, 'ask');
    } else if (level.bidVolume > 0 && level.askVolume === 0) {
      imbalances.set(level.price, 'bid');
    }

    if (total >= largeTradeThreshold) {
      const priceMove = bar.close - bar.open;
      const isBuy = level.askVolume > level.bidVolume;
      if ((isBuy && priceMove <= 0) || (!isBuy && priceMove >= 0)) {
        absorbedLevels.add(level.price);
      }
    }
  }

  return {
    bar,
    poc: pocPrice,
    cumulativeDelta: runningDelta + barDelta,
    imbalances,
    absorbedLevels,
  };
}

function detectImbalanceStacking(
  imbalances: Map<number, 'bid' | 'ask'>,
  prices: number[],
  minStack: number
): Set<number> {
  const stacked = new Set<number>();
  const sorted = prices.sort((a, b) => b - a);

  let streak = 0;
  let lastSide: 'bid' | 'ask' | null = null;
  const streakPrices: number[] = [];

  for (const price of sorted) {
    const side = imbalances.get(price);
    if (side && side === lastSide) {
      streak++;
      streakPrices.push(price);
    } else {
      if (streak >= minStack) {
        for (const p of streakPrices) stacked.add(p);
      }
      streak = side ? 1 : 0;
      lastSide = side ?? null;
      streakPrices.length = 0;
      if (side) streakPrices.push(price);
    }
  }
  if (streak >= minStack) {
    for (const p of streakPrices) stacked.add(p);
  }

  return stacked;
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderFootprint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  computed: ComputedBar[],
  mode: FootprintMode,
  showPOC: boolean,
  showCumDelta: boolean,
  zoom: number,
  scrollOffset: number,
  largeTradeThreshold: number,
  imbalanceCfg: ImbalanceConfig
) {
  ctx.clearRect(0, 0, width, height);

  if (computed.length === 0) {
    ctx.fillStyle = '#737373';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No footprint data', width / 2, height / 2);
    return;
  }

  const padding = { top: 10, bottom: showCumDelta ? 50 : 10, left: 50, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barWidth = Math.max(60 * zoom, 30);
  const visibleBars = Math.floor(chartW / barWidth);
  const startIdx = Math.max(0, Math.min(scrollOffset, computed.length - visibleBars));
  const visible = computed.slice(startIdx, startIdx + visibleBars);

  if (visible.length === 0) return;

  let allPrices: number[] = [];
  for (const cb of visible) {
    for (const level of cb.bar.levels) {
      allPrices.push(level.price);
    }
  }
  if (allPrices.length === 0) return;

  const priceMax = Math.max(...allPrices);
  const priceMin = Math.min(...allPrices);
  const priceRange = priceMax - priceMin || 1;

  const priceToY = (p: number) =>
    padding.top + ((priceMax - p) / priceRange) * chartH;

  const tickSize = allPrices.length > 1
    ? Math.min(...allPrices.slice(1).map((p, i) => Math.abs(p - allPrices[i])).filter(d => d > 0)) || 1
    : 1;
  const cellH = Math.max((chartH / ((priceMax - priceMin) / tickSize + 1)), 8);

  // Price axis
  ctx.fillStyle = '#525252';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'right';
  const priceStep = Math.max(tickSize, Math.ceil(priceRange / 15) * tickSize);
  for (let p = Math.ceil(priceMin / priceStep) * priceStep; p <= priceMax; p += priceStep) {
    const y = priceToY(p);
    ctx.fillText(p.toFixed(2), padding.left - 6, y + 3);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  // Bars
  for (let i = 0; i < visible.length; i++) {
    const cb = visible[i];
    const barX = padding.left + i * barWidth;
    const barCenterX = barX + barWidth / 2;

    const sortedLevels = [...cb.bar.levels].sort((a, b) => b.price - a.price);
    const stackedImbalances = detectImbalanceStacking(
      cb.imbalances,
      sortedLevels.map((l) => l.price),
      imbalanceCfg.stackingMin
    );

    const maxLevelVol = Math.max(
      ...sortedLevels.map((l) => l.bidVolume + l.askVolume),
      1
    );

    for (const level of sortedLevels) {
      const y = priceToY(level.price) - cellH / 2;
      const total = level.bidVolume + level.askVolume;
      const isPOC = level.price === cb.poc;
      const isLarge = total >= largeTradeThreshold;
      const isAbsorbed = cb.absorbedLevels.has(level.price);
      const isStacked = stackedImbalances.has(level.price);
      const imbalanceSide = cb.imbalances.get(level.price);

      // Cell background
      if (isPOC && showPOC) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(barX + 2, y, barWidth - 4, cellH);
      }

      if (isStacked) {
        ctx.fillStyle =
          imbalanceSide === 'ask'
            ? 'rgba(34, 197, 94, 0.12)'
            : 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(barX + 2, y, barWidth - 4, cellH);
      }

      if (isAbsorbed) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(barX + 3, y + 1, barWidth - 6, cellH - 2);
        ctx.setLineDash([]);
      }

      if (mode === 'bidAsk') {
        const halfW = (barWidth - 8) / 2;
        ctx.font = `${Math.min(cellH * 0.7, 10)}px system-ui`;
        ctx.textAlign = 'right';

        // Bid side
        const bidAlpha = Math.max(0.3, level.bidVolume / maxLevelVol);
        ctx.fillStyle =
          imbalanceSide === 'bid'
            ? `rgba(239, 68, 68, ${Math.min(bidAlpha + 0.3, 1)})`
            : `rgba(239, 68, 68, ${bidAlpha})`;
        ctx.fillText(
          level.bidVolume > 0 ? level.bidVolume.toString() : '',
          barCenterX - 2,
          y + cellH * 0.7
        );

        // Ask side
        ctx.textAlign = 'left';
        const askAlpha = Math.max(0.3, level.askVolume / maxLevelVol);
        ctx.fillStyle =
          imbalanceSide === 'ask'
            ? `rgba(34, 197, 94, ${Math.min(askAlpha + 0.3, 1)})`
            : `rgba(34, 197, 94, ${askAlpha})`;
        ctx.fillText(
          level.askVolume > 0 ? level.askVolume.toString() : '',
          barCenterX + 2,
          y + cellH * 0.7
        );

        // Separator
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(barCenterX, y + 1);
        ctx.lineTo(barCenterX, y + cellH - 1);
        ctx.stroke();
      } else if (mode === 'delta') {
        const delta = level.askVolume - level.bidVolume;
        ctx.font = `${Math.min(cellH * 0.7, 10)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillStyle = delta >= 0 ? '#22c55e' : '#ef4444';
        ctx.fillText(
          delta !== 0 ? (delta > 0 ? `+${delta}` : delta.toString()) : '',
          barCenterX,
          y + cellH * 0.7
        );
      } else {
        // Profile mode
        const w = ((total / maxLevelVol) * (barWidth - 8));
        ctx.fillStyle = isPOC
          ? 'rgba(59, 130, 246, 0.7)'
          : 'rgba(115, 115, 115, 0.4)';
        ctx.fillRect(barX + 4, y + 1, w, cellH - 2);
      }

      // Large trade marker
      if (isLarge) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(barX + barWidth - 6, y + cellH / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bar borders
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX + 1, padding.top, barWidth - 2, chartH);

    // Time label
    ctx.fillStyle = '#525252';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    const date = new Date(cb.bar.timestamp);
    ctx.fillText(
      date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      barCenterX,
      padding.top + chartH + 12
    );
  }

  // Cumulative delta subplot
  if (showCumDelta && visible.length > 0) {
    const deltaH = 35;
    const deltaY = height - deltaH - 5;
    const deltas = visible.map((cb) => cb.cumulativeDelta);
    const deltaMin = Math.min(...deltas);
    const deltaMax = Math.max(...deltas);
    const deltaRange = deltaMax - deltaMin || 1;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(padding.left, deltaY, chartW, deltaH);
    ctx.strokeStyle = '#1a1a1a';
    ctx.strokeRect(padding.left, deltaY, chartW, deltaH);

    ctx.beginPath();
    for (let i = 0; i < visible.length; i++) {
      const x = padding.left + i * barWidth + barWidth / 2;
      const y =
        deltaY + deltaH - ((visible[i].cumulativeDelta - deltaMin) / deltaRange) * deltaH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#525252';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Cum Δ', padding.left + 4, deltaY + 10);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const FootprintChart: React.FC<FootprintChartProps> = ({
  bars,
  mode: propMode,
  imbalanceConfig = { threshold: 3, stackingMin: 3 },
  largeTradeTreshold = 100,
  showCumulativeDelta: propShowCumDelta = true,
  showDiagonalDelta: propShowDiagDelta = false,
  showPOC: propShowPOC = true,
  onPriceClick,
  className = '',
}) => {
  const [mode, setMode] = useState<FootprintMode>(propMode ?? 'bidAsk');
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showCumDelta, setShowCumDelta] = useState(propShowCumDelta);
  const [showPOC, setShowPOC] = useState(propShowPOC);
  const [showSettings, setShowSettings] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => {
    let runningDelta = 0;
    return bars.map((bar) => {
      const cb = computeBar(bar, runningDelta, imbalanceConfig, largeTradeTreshold);
      runningDelta = cb.cumulativeDelta;
      return cb;
    });
  }, [bars, imbalanceConfig, largeTradeTreshold]);

  useEffect(() => {
    setScrollOffset(Math.max(0, computed.length - 10));
  }, [computed.length]);

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

    renderFootprint(
      ctx, size.width, size.height, computed, mode,
      showPOC, showCumDelta, zoom, scrollOffset,
      largeTradeTreshold, imbalanceConfig
    );
  }, [size, computed, mode, showPOC, showCumDelta, zoom, scrollOffset, largeTradeTreshold, imbalanceConfig]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.max(0.3, Math.min(3, z + (e.deltaY < 0 ? 0.1 : -0.1))));
      } else {
        setScrollOffset((s) =>
          Math.max(0, Math.min(computed.length - 1, s + (e.deltaY > 0 ? 2 : -2)))
        );
      }
    },
    [computed.length]
  );

  const modeOptions: { key: FootprintMode; label: string }[] = [
    { key: 'bidAsk', label: 'Bid×Ask' },
    { key: 'delta', label: 'Delta' },
    { key: 'profile', label: 'Profile' },
  ];

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500 font-medium">Footprint</span>

        <div className="flex items-center rounded bg-neutral-800 overflow-hidden ml-2">
          {modeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`px-2 py-0.5 text-xs transition-colors ${
                mode === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowCumDelta(!showCumDelta)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            showCumDelta ? 'bg-blue-900/30 text-blue-400' : 'text-neutral-500 hover:bg-neutral-800'
          }`}
        >
          Cum Δ
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          >
            <ZoomOut size={12} />
          </button>
          <button
            onClick={() => { setZoom(1); setScrollOffset(Math.max(0, computed.length - 10)); }}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          >
            <RotateCcw size={12} />
          </button>
        </div>

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
                  checked={showPOC}
                  onChange={(e) => setShowPOC(e.target.checked)}
                  className="accent-blue-500"
                />
                Show POC per bar
              </label>
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCumDelta}
                  onChange={(e) => setShowCumDelta(e.target.checked)}
                  className="accent-blue-500"
                />
                Cumulative Delta
              </label>
              <div className="text-neutral-500 mt-1">
                Imbalance Threshold: {imbalanceConfig.threshold}x
              </div>
              <div className="text-neutral-500">
                Stacking Min: {imbalanceConfig.stackingMin}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
      </div>
    </div>
  );
};

export default FootprintChart;
