import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  Search,
  Download,
  ChevronLeft,
  Clock,
  BarChart3,
  Palette,
  Maximize2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HeatmapItem {
  id: string;
  name: string;
  ticker?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  volume?: number;
  volatility?: number;
  performance: number;
  rsi?: number;
  peRatio?: number;
  price?: number;
  children?: HeatmapItem[];
}

export type TimePeriod = '1D' | '1W' | '1M' | 'YTD' | '1Y';
export type SizeMetric = 'marketCap' | 'volume' | 'volatility';
export type ColorMetric = 'performance' | 'rsi' | 'peRatio';

export interface HeatmapChartProps {
  data: HeatmapItem[];
  timePeriod?: TimePeriod;
  sizeBy?: SizeMetric;
  colorBy?: ColorMetric;
  onItemClick?: (item: HeatmapItem) => void;
  onTimePeriodChange?: (period: TimePeriod) => void;
  onExport?: () => void;
  className?: string;
}

interface TreemapRect {
  item: HeatmapItem;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TooltipData {
  item: HeatmapItem;
  x: number;
  y: number;
}

// ─── Color Utilities ─────────────────────────────────────────────────────────

function performanceToColor(value: number, metric: ColorMetric): string {
  if (metric === 'rsi') {
    if (value >= 70) return '#dc2626';
    if (value >= 60) return '#f97316';
    if (value >= 40) return '#737373';
    if (value >= 30) return '#22c55e';
    return '#15803d';
  }

  if (metric === 'peRatio') {
    if (value > 40) return '#dc2626';
    if (value > 25) return '#f97316';
    if (value > 15) return '#eab308';
    if (value > 0) return '#22c55e';
    return '#737373';
  }

  // performance
  const clamped = Math.max(-10, Math.min(10, value));
  if (clamped >= 3) return '#15803d';
  if (clamped >= 1.5) return '#22c55e';
  if (clamped >= 0.5) return '#4ade80';
  if (clamped >= 0) return '#86efac';
  if (clamped >= -0.5) return '#fca5a5';
  if (clamped >= -1.5) return '#f87171';
  if (clamped >= -3) return '#ef4444';
  return '#dc2626';
}

function getTextColor(bgColor: string): string {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ─── Treemap Layout (Squarified) ─────────────────────────────────────────────

function getItemSize(item: HeatmapItem, sizeBy: SizeMetric): number {
  switch (sizeBy) {
    case 'marketCap':
      return Math.max(item.marketCap ?? 1, 1);
    case 'volume':
      return Math.max(item.volume ?? 1, 1);
    case 'volatility':
      return Math.max(item.volatility ?? 1, 1);
    default:
      return Math.max(item.marketCap ?? 1, 1);
  }
}

function getItemColor(item: HeatmapItem, colorBy: ColorMetric): number {
  switch (colorBy) {
    case 'performance':
      return item.performance;
    case 'rsi':
      return item.rsi ?? 50;
    case 'peRatio':
      return item.peRatio ?? 0;
    default:
      return item.performance;
  }
}

function squarify(
  items: HeatmapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  sizeBy: SizeMetric
): TreemapRect[] {
  if (items.length === 0 || w <= 0 || h <= 0) return [];

  const totalSize = items.reduce((s, it) => s + getItemSize(it, sizeBy), 0);
  if (totalSize === 0) return [];

  const rects: TreemapRect[] = [];
  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  let remaining = [...items].sort(
    (a, b) => getItemSize(b, sizeBy) - getItemSize(a, sizeBy)
  );
  let remainingTotal = totalSize;

  while (remaining.length > 0) {
    const isHorizontal = cw >= ch;
    const side = isHorizontal ? ch : cw;
    let row: HeatmapItem[] = [];
    let rowSize = 0;
    let bestRatio = Infinity;

    for (const item of remaining) {
      const testRow = [...row, item];
      const testSize = rowSize + getItemSize(item, sizeBy);
      const rowFraction = testSize / remainingTotal;
      const rowLength = isHorizontal ? cw * rowFraction : ch * rowFraction;

      let worstRatio = 0;
      for (const ri of testRow) {
        const itemFraction = getItemSize(ri, sizeBy) / testSize;
        const itemLength = side * itemFraction;
        const ratio = Math.max(rowLength / itemLength, itemLength / rowLength);
        worstRatio = Math.max(worstRatio, ratio);
      }

      if (worstRatio <= bestRatio || row.length === 0) {
        row = testRow;
        rowSize = testSize;
        bestRatio = worstRatio;
      } else {
        break;
      }
    }

    const rowFraction = rowSize / remainingTotal;
    let rx = cx;
    let ry = cy;

    for (const item of row) {
      const itemFraction = getItemSize(item, sizeBy) / rowSize;
      let rw: number, rh: number;

      if (isHorizontal) {
        rw = cw * rowFraction;
        rh = ch * itemFraction;
        rects.push({ item, x: rx, y: ry, w: rw, h: rh });
        ry += rh;
      } else {
        rw = cw * itemFraction;
        rh = ch * rowFraction;
        rects.push({ item, x: rx, y: ry, w: rw, h: rh });
        rx += rw;
      }
    }

    if (isHorizontal) {
      cx += cw * rowFraction;
      cw -= cw * rowFraction;
    } else {
      cy += ch * rowFraction;
      ch -= ch * rowFraction;
    }

    remainingTotal -= rowSize;
    remaining = remaining.filter((it) => !row.includes(it));
  }

  return rects;
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderHeatmapCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rects: TreemapRect[],
  colorBy: ColorMetric,
  hoverItem: string | null
) {
  ctx.clearRect(0, 0, width, height);

  for (const r of rects) {
    const color = performanceToColor(getItemColor(r.item, colorBy), colorBy);
    const isHovered = hoverItem === r.item.id;

    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // Border
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }

    // Labels
    const textColor = getTextColor(color);
    const minW = 40;
    const minH = 25;

    if (r.w > minW && r.h > minH) {
      ctx.fillStyle = textColor;

      const maxFontSize = Math.min(r.w / 6, r.h / 3, 14);
      const tickerSize = Math.max(maxFontSize, 8);
      ctx.font = `bold ${tickerSize}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = r.item.ticker ?? r.item.name;
      const centerX = r.x + r.w / 2;
      const centerY = r.y + r.h / 2;

      ctx.fillText(label, centerX, centerY - tickerSize * 0.6, r.w - 8);

      // Value below
      if (r.h > 40) {
        const valSize = Math.max(tickerSize * 0.75, 7);
        ctx.font = `${valSize}px system-ui`;
        ctx.globalAlpha = 0.8;
        const val = r.item.performance;
        ctx.fillText(
          `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
          centerX,
          centerY + tickerSize * 0.5,
          r.w - 8
        );
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  timePeriod: propPeriod,
  sizeBy: propSizeBy,
  colorBy: propColorBy,
  onItemClick,
  onTimePeriodChange,
  onExport,
  className = '',
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(propPeriod ?? '1D');
  const [sizeBy, setSizeBy] = useState<SizeMetric>(propSizeBy ?? 'marketCap');
  const [colorBy, setColorBy] = useState<ColorMetric>(propColorBy ?? 'performance');
  const [searchQuery, setSearchQuery] = useState('');
  const [drillStack, setDrillStack] = useState<HeatmapItem[][]>([]);
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rectsRef = useRef<TreemapRect[]>([]);

  const currentData = useMemo(() => {
    if (drillStack.length > 0) return drillStack[drillStack.length - 1];
    return data;
  }, [data, drillStack]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return currentData;
    const q = searchQuery.toLowerCase();
    return currentData.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.ticker?.toLowerCase().includes(q) ?? false) ||
        (item.sector?.toLowerCase().includes(q) ?? false)
    );
  }, [currentData, searchQuery]);

  const rects = useMemo(
    () => squarify(filteredData, 0, 0, size.width, size.height, sizeBy),
    [filteredData, size, sizeBy]
  );

  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);

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
    renderHeatmapCanvas(ctx, size.width, size.height, rects, colorBy, hoverItem);
  }, [size, rects, colorBy, hoverItem]);

  const findRectAt = useCallback(
    (x: number, y: number): TreemapRect | null => {
      for (const r of rectsRef.current) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          return r;
        }
      }
      return null;
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = findRectAt(x, y);

      if (hit) {
        setHoverItem(hit.item.id);
        setTooltip({ item: hit.item, x, y });
      } else {
        setHoverItem(null);
        setTooltip(null);
      }
    },
    [findRectAt]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = findRectAt(x, y);
      if (!hit) return;

      if (hit.item.children && hit.item.children.length > 0) {
        setDrillStack((prev) => [...prev, hit.item.children!]);
        setSearchQuery('');
      }

      onItemClick?.(hit.item);
    },
    [findRectAt, onItemClick]
  );

  const handleBack = useCallback(() => {
    setDrillStack((prev) => prev.slice(0, -1));
    setSearchQuery('');
  }, []);

  const handleTimePeriodChange = useCallback(
    (p: TimePeriod) => {
      setTimePeriod(p);
      onTimePeriodChange?.(p);
    },
    [onTimePeriodChange]
  );

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `heatmap-${timePeriod}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [onExport, timePeriod]);

  const periods: TimePeriod[] = ['1D', '1W', '1M', 'YTD', '1Y'];
  const sizeOptions: { key: SizeMetric; label: string }[] = [
    { key: 'marketCap', label: 'Mkt Cap' },
    { key: 'volume', label: 'Volume' },
    { key: 'volatility', label: 'Volatility' },
  ];
  const colorOptions: { key: ColorMetric; label: string }[] = [
    { key: 'performance', label: 'Perf' },
    { key: 'rsi', label: 'RSI' },
    { key: 'peRatio', label: 'P/E' },
  ];

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0 flex-wrap">
        {drillStack.length > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <ChevronLeft size={12} />
            Back
          </button>
        )}

        {/* Time period */}
        <div className="flex items-center gap-0.5">
          <Clock size={12} className="text-neutral-500 mr-1" />
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => handleTimePeriodChange(p)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                timePeriod === p
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Size by */}
        <div className="flex items-center gap-0.5 ml-2">
          <BarChart3 size={12} className="text-neutral-500 mr-1" />
          {sizeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSizeBy(opt.key)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                sizeBy === opt.key
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Color by */}
        <div className="flex items-center gap-0.5 ml-2">
          <Palette size={12} className="text-neutral-500 mr-1" />
          {colorOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setColorBy(opt.key)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                colorBy === opt.key
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1">
          <Search size={12} className="text-neutral-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-xs text-white outline-none w-24 placeholder:text-neutral-600"
          />
        </div>

        <button
          onClick={handleExport}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          title="Export as image"
        >
          <Download size={14} />
        </button>
      </div>

      {/* Heatmap Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoverItem(null);
          setTooltip(null);
        }}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-30 pointer-events-none bg-neutral-900/95 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl text-xs min-w-[160px]"
            style={{
              left: Math.min(tooltip.x + 16, size.width - 180),
              top: Math.min(tooltip.y + 16, size.height - 120),
            }}
          >
            <div className="font-semibold text-white mb-1">
              {tooltip.item.ticker ?? tooltip.item.name}
              {tooltip.item.ticker && (
                <span className="text-neutral-500 font-normal ml-1">{tooltip.item.name}</span>
              )}
            </div>
            {tooltip.item.sector && (
              <div className="text-neutral-500 mb-1">{tooltip.item.sector}</div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {tooltip.item.price !== undefined && (
                <>
                  <span className="text-neutral-500">Price</span>
                  <span className="text-white text-right">${tooltip.item.price.toFixed(2)}</span>
                </>
              )}
              <span className="text-neutral-500">Change</span>
              <span
                className={`text-right font-medium ${
                  tooltip.item.performance >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {tooltip.item.performance >= 0 ? '+' : ''}
                {tooltip.item.performance.toFixed(2)}%
              </span>
              {tooltip.item.volume !== undefined && (
                <>
                  <span className="text-neutral-500">Volume</span>
                  <span className="text-white text-right">
                    {(tooltip.item.volume / 1e6).toFixed(1)}M
                  </span>
                </>
              )}
              {tooltip.item.marketCap !== undefined && (
                <>
                  <span className="text-neutral-500">Mkt Cap</span>
                  <span className="text-white text-right">
                    ${(tooltip.item.marketCap / 1e9).toFixed(1)}B
                  </span>
                </>
              )}
            </div>
            {tooltip.item.children && (
              <div className="mt-1 text-blue-400 text-[10px] flex items-center gap-1">
                <Maximize2 size={10} />
                Click to zoom in
              </div>
            )}
          </div>
        )}

        {filteredData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
            {searchQuery ? 'No results found' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapChart;
