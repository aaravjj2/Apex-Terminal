import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { ZoomIn, ZoomOut, Crosshair, RotateCcw, Layers } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total?: number;
}

export interface DepthChartProps {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice?: number;
  spread?: number;
  decimals?: number;
  showPriceLadder?: boolean;
  wallThreshold?: number;
  onPriceClick?: (price: number) => void;
  className?: string;
}

interface TooltipData {
  x: number;
  y: number;
  price: number;
  quantity: number;
  total: number;
  side: 'bid' | 'ask';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCumulativeDepth(
  levels: OrderBookLevel[],
  ascending: boolean
): OrderBookLevel[] {
  const sorted = [...levels].sort((a, b) =>
    ascending ? a.price - b.price : b.price - a.price
  );
  let cumulative = 0;
  return sorted.map((l) => {
    cumulative += l.quantity;
    return { ...l, total: cumulative };
  });
}

function detectWalls(
  levels: OrderBookLevel[],
  threshold: number
): Set<number> {
  if (levels.length === 0) return new Set();
  const avgQty = levels.reduce((s, l) => s + l.quantity, 0) / levels.length;
  const wallPrices = new Set<number>();
  for (const l of levels) {
    if (l.quantity >= avgQty * threshold) {
      wallPrices.add(l.price);
    }
  }
  return wallPrices;
}

function computeImbalance(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[]
): number {
  const bidTotal = bids.reduce((s, l) => s + l.quantity, 0);
  const askTotal = asks.reduce((s, l) => s + l.quantity, 0);
  const total = bidTotal + askTotal;
  if (total === 0) return 0;
  return (bidTotal - askTotal) / total;
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderDepthCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bidDepth: OrderBookLevel[],
  askDepth: OrderBookLevel[],
  midPrice: number,
  zoom: number,
  wallPrices: Set<number>,
  isDark: boolean
) {
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 20, bottom: 30, left: 60, right: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (bidDepth.length === 0 && askDepth.length === 0) {
    ctx.fillStyle = isDark ? '#737373' : '#a3a3a3';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No depth data', width / 2, height / 2);
    return;
  }

  const allPrices = [
    ...bidDepth.map((l) => l.price),
    ...askDepth.map((l) => l.price),
  ];
  const priceMid = midPrice;
  const priceRange = (Math.max(...allPrices) - Math.min(...allPrices)) / zoom;
  const priceMin = priceMid - priceRange / 2;
  const priceMax = priceMid + priceRange / 2;

  const maxTotal = Math.max(
    ...bidDepth.map((l) => l.total ?? 0),
    ...askDepth.map((l) => l.total ?? 0),
    1
  );

  const priceToX = (p: number) =>
    padding.left + ((p - priceMin) / (priceMax - priceMin)) * chartW;
  const totalToY = (t: number) =>
    padding.top + chartH - (t / maxTotal) * chartH;

  // Grid
  ctx.strokeStyle = isDark ? '#262626' : '#e5e5e5';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  // Bid area (green)
  const bidVisible = bidDepth
    .filter((l) => l.price >= priceMin && l.price <= priceMax)
    .sort((a, b) => b.price - a.price);

  if (bidVisible.length > 0) {
    ctx.beginPath();
    ctx.moveTo(priceToX(bidVisible[0].price), totalToY(0));
    for (const level of bidVisible) {
      ctx.lineTo(priceToX(level.price), totalToY(level.total ?? 0));
    }
    ctx.lineTo(priceToX(bidVisible[bidVisible.length - 1].price), totalToY(0));
    ctx.closePath();

    const bidGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    bidGrad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
    bidGrad.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
    ctx.fillStyle = bidGrad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < bidVisible.length; i++) {
      const x = priceToX(bidVisible[i].price);
      const y = totalToY(bidVisible[i].total ?? 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Ask area (red)
  const askVisible = askDepth
    .filter((l) => l.price >= priceMin && l.price <= priceMax)
    .sort((a, b) => a.price - b.price);

  if (askVisible.length > 0) {
    ctx.beginPath();
    ctx.moveTo(priceToX(askVisible[0].price), totalToY(0));
    for (const level of askVisible) {
      ctx.lineTo(priceToX(level.price), totalToY(level.total ?? 0));
    }
    ctx.lineTo(priceToX(askVisible[askVisible.length - 1].price), totalToY(0));
    ctx.closePath();

    const askGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    askGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    askGrad.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
    ctx.fillStyle = askGrad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < askVisible.length; i++) {
      const x = priceToX(askVisible[i].price);
      const y = totalToY(askVisible[i].total ?? 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Mid price line
  const midX = priceToX(priceMid);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(midX, padding.top);
  ctx.lineTo(midX, padding.top + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Mid price label
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(priceMid.toFixed(2), midX, padding.top - 6);

  // Wall indicators
  ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
  for (const wp of wallPrices) {
    if (wp < priceMin || wp > priceMax) continue;
    const wx = priceToX(wp);
    ctx.beginPath();
    ctx.arc(wx, padding.top + chartH - 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Y-axis labels
  ctx.fillStyle = isDark ? '#737373' : '#a3a3a3';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const val = (maxTotal / 5) * (5 - i);
    const y = padding.top + (chartH / 5) * i;
    ctx.fillText(val.toFixed(0), padding.left - 8, y + 3);
  }

  // X-axis labels
  ctx.textAlign = 'center';
  const priceStep = (priceMax - priceMin) / 6;
  for (let i = 0; i <= 6; i++) {
    const price = priceMin + priceStep * i;
    const x = priceToX(price);
    ctx.fillText(price.toFixed(2), x, padding.top + chartH + 16);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const DepthChart: React.FC<DepthChartProps> = ({
  bids,
  asks,
  midPrice: propMidPrice,
  spread: propSpread,
  decimals = 2,
  showPriceLadder = false,
  wallThreshold = 3,
  onPriceClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const animRef = useRef<number>(0);

  const bidDepth = useMemo(() => computeCumulativeDepth(bids, false), [bids]);
  const askDepth = useMemo(() => computeCumulativeDepth(asks, true), [asks]);

  const midPrice = useMemo(() => {
    if (propMidPrice !== undefined) return propMidPrice;
    const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.price)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => a.price)) : 0;
    return (bestBid + bestAsk) / 2;
  }, [propMidPrice, bids, asks]);

  const spread = useMemo(() => {
    if (propSpread !== undefined) return propSpread;
    const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => b.price)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => a.price)) : 0;
    return bestAsk - bestBid;
  }, [propSpread, bids, asks]);

  const wallPrices = useMemo(
    () => detectWalls([...bids, ...asks], wallThreshold),
    [bids, asks, wallThreshold]
  );

  const imbalance = useMemo(() => computeImbalance(bids, asks), [bids, asks]);

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
    if (!canvas || size.width === 0 || size.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(() => {
      renderDepthCanvas(
        ctx,
        size.width,
        size.height,
        bidDepth,
        askDepth,
        midPrice,
        zoom,
        wallPrices,
        true
      );
    });

    return () => cancelAnimationFrame(animRef.current);
  }, [size, bidDepth, askDepth, midPrice, zoom, wallPrices]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const padding = { top: 20, bottom: 30, left: 60, right: 60 };
      const chartW = size.width - padding.left - padding.right;

      if (x < padding.left || x > padding.left + chartW) {
        setTooltip(null);
        return;
      }

      const allPrices = [...bidDepth.map((l) => l.price), ...askDepth.map((l) => l.price)];
      const priceRange = (Math.max(...allPrices) - Math.min(...allPrices)) / zoom;
      const priceMin = midPrice - priceRange / 2;
      const priceMax = midPrice + priceRange / 2;
      const price = priceMin + ((x - padding.left) / chartW) * (priceMax - priceMin);

      const side: 'bid' | 'ask' = price <= midPrice ? 'bid' : 'ask';
      const levels = side === 'bid' ? bidDepth : askDepth;
      const closest = levels.reduce(
        (best, l) =>
          Math.abs(l.price - price) < Math.abs(best.price - price) ? l : best,
        levels[0] ?? { price: 0, quantity: 0, total: 0 }
      );

      if (closest) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          price: closest.price,
          quantity: closest.quantity,
          total: closest.total ?? 0,
          side,
        });
      }
    },
    [bidDepth, askDepth, midPrice, zoom, size]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!tooltip || !onPriceClick) return;
      onPriceClick(tooltip.price);
    },
    [tooltip, onPriceClick]
  );

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500">Depth</span>

        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-neutral-800 text-xs">
          <span className="text-neutral-500">Spread:</span>
          <span className="text-yellow-400 font-medium">{spread.toFixed(decimals)}</span>
          <span className="text-neutral-600 ml-1">
            ({midPrice > 0 ? ((spread / midPrice) * 100).toFixed(3) : '0'}%)
          </span>
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-xs">
          <span className="text-neutral-500">Imbalance:</span>
          <span
            className={`font-medium ${
              imbalance > 0.1
                ? 'text-emerald-400'
                : imbalance < -0.1
                  ? 'text-red-400'
                  : 'text-neutral-400'
            }`}
          >
            {(imbalance * 100).toFixed(1)}%
          </span>
          <div className="w-16 h-1.5 rounded-full bg-neutral-700 overflow-hidden ml-1">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                imbalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.abs(imbalance) * 100}%`, marginLeft: imbalance < 0 ? 'auto' : 0 }}
            />
          </div>
        </div>

        {wallPrices.size > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-900/30 text-xs text-purple-400">
            <Layers size={12} />
            <span>{wallPrices.size} wall{wallPrices.size !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.5, 10))}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.5, 0.2))}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            title="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 pointer-events-none bg-neutral-900/95 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl text-xs"
            style={{
              left: Math.min(tooltip.x + 12, size.width - 160),
              top: Math.min(tooltip.y - 40, size.height - 80),
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  tooltip.side === 'bid' ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="text-neutral-400 capitalize">{tooltip.side}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-neutral-500">Price</span>
              <span className="text-white font-medium text-right">
                {tooltip.price.toFixed(decimals)}
              </span>
              <span className="text-neutral-500">Qty</span>
              <span className="text-white font-medium text-right">
                {tooltip.quantity.toFixed(2)}
              </span>
              <span className="text-neutral-500">Total</span>
              <span className="text-white font-medium text-right">
                {tooltip.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Price Ladder Overlay */}
        {showPriceLadder && (
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-neutral-900/80 border-l border-neutral-800 overflow-y-auto text-[10px]">
            {[...askDepth]
              .sort((a, b) => b.price - a.price)
              .slice(0, 15)
              .map((l) => (
                <div
                  key={`a-${l.price}`}
                  className="flex justify-between px-2 py-0.5 text-red-400 hover:bg-neutral-800"
                >
                  <span>{l.price.toFixed(decimals)}</span>
                  <span>{l.quantity.toFixed(1)}</span>
                </div>
              ))}
            <div className="px-2 py-1 bg-yellow-900/30 text-yellow-400 font-bold text-center">
              {midPrice.toFixed(decimals)}
            </div>
            {[...bidDepth]
              .sort((a, b) => b.price - a.price)
              .slice(0, 15)
              .map((l) => (
                <div
                  key={`b-${l.price}`}
                  className="flex justify-between px-2 py-0.5 text-emerald-400 hover:bg-neutral-800"
                >
                  <span>{l.price.toFixed(decimals)}</span>
                  <span>{l.quantity.toFixed(1)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepthChart;
