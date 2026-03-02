import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { ArrowUp, ArrowDown, Minus, Maximize2, Search, ChevronDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SparklineItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  sector?: string;
  sparklineData: number[];
}

export type SortField =
  | 'symbol'
  | 'name'
  | 'price'
  | 'change'
  | 'changePercent'
  | 'volume'
  | 'marketCap';

export type SortDirection = 'asc' | 'desc';

export interface SparklineGridProps {
  items: SparklineItem[];
  columns?: SortField[];
  onItemClick?: (item: SparklineItem) => void;
  onExpand?: (item: SparklineItem) => void;
  groupBySector?: boolean;
  refreshInterval?: number;
  className?: string;
}

// ─── Sparkline Canvas ────────────────────────────────────────────────────────

const SparklineMini: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
}> = ({ data, width = 80, height = 28, positive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const chartH = height - padding * 2;
    const step = (width - padding * 2) / (data.length - 1);

    // Area fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (positive) {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    ctx.beginPath();
    ctx.moveTo(padding, height);
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * step;
      const y = padding + chartH - ((data[i] - min) / range) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding + (data.length - 1) * step, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padding + i * step;
      const y = padding + chartH - ((data[i] - min) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = positive ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current dot
    const lastX = padding + (data.length - 1) * step;
    const lastY = padding + chartH - ((data[data.length - 1] - min) / range) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = positive ? '#22c55e' : '#ef4444';
    ctx.fill();
  }, [data, width, height, positive]);

  return <canvas ref={canvasRef} className="shrink-0" />;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(2);
}

const COLUMN_LABELS: Record<SortField, string> = {
  symbol: 'Symbol',
  name: 'Name',
  price: 'Price',
  change: 'Change',
  changePercent: '% Change',
  volume: 'Volume',
  marketCap: 'Mkt Cap',
};

const DEFAULT_COLUMNS: SortField[] = [
  'symbol',
  'price',
  'changePercent',
  'volume',
];

// ─── Main Component ──────────────────────────────────────────────────────────

export const SparklineGrid: React.FC<SparklineGridProps> = ({
  items,
  columns = DEFAULT_COLUMNS,
  onItemClick,
  onExpand,
  groupBySector = false,
  className = '',
}) => {
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(new Set());

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.symbol.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.sector?.toLowerCase().includes(q) ?? false)
    );
  }, [items, searchQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortField) {
        case 'symbol':
          return a.symbol.localeCompare(b.symbol) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'price':
          return (a.price - b.price) * dir;
        case 'change':
          return (a.change - b.change) * dir;
        case 'changePercent':
          return (a.changePercent - b.changePercent) * dir;
        case 'volume':
          return ((a.volume ?? 0) - (b.volume ?? 0)) * dir;
        case 'marketCap':
          return ((a.marketCap ?? 0) - (b.marketCap ?? 0)) * dir;
        default:
          return 0;
      }
    });

    return arr;
  }, [filtered, sortField, sortDir]);

  const grouped = useMemo(() => {
    if (!groupBySector) return null;
    const groups = new Map<string, SparklineItem[]>();
    for (const item of sorted) {
      const sector = item.sector ?? 'Other';
      const existing = groups.get(sector) ?? [];
      existing.push(item);
      groups.set(sector, existing);
    }
    return groups;
  }, [sorted, groupBySector]);

  const toggleSector = useCallback((sector: string) => {
    setCollapsedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  const renderRow = useCallback(
    (item: SparklineItem) => {
      const positive = item.changePercent >= 0;
      const changeColor = positive
        ? 'text-emerald-400'
        : item.changePercent < 0
          ? 'text-red-400'
          : 'text-neutral-500';

      return (
        <div
          key={item.symbol}
          onClick={() => onItemClick?.(item)}
          className="grid items-center gap-2 px-3 py-1.5 border-b border-neutral-900/30
            hover:bg-neutral-900/50 transition-colors cursor-pointer group"
          style={{
            gridTemplateColumns: `minmax(70px, 1fr) 80px repeat(${columns.length - 1}, minmax(60px, 1fr)) 40px`,
          }}
        >
          {/* Symbol + Sparkline */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{item.symbol}</div>
              <div className="text-[10px] text-neutral-600 truncate">{item.name}</div>
            </div>
          </div>

          {/* Sparkline */}
          <SparklineMini data={item.sparklineData} positive={positive} />

          {/* Dynamic columns */}
          {columns.map((col) => {
            if (col === 'symbol' || col === 'name') return null;
            return (
              <div key={col} className="text-right text-xs tabular-nums">
                {col === 'price' && (
                  <span className="text-white font-medium">{item.price.toFixed(2)}</span>
                )}
                {col === 'change' && (
                  <span className={changeColor}>
                    {positive ? '+' : ''}{item.change.toFixed(2)}
                  </span>
                )}
                {col === 'changePercent' && (
                  <div className="flex items-center justify-end gap-0.5">
                    {positive ? (
                      <ArrowUp size={10} className="text-emerald-500" />
                    ) : item.changePercent < 0 ? (
                      <ArrowDown size={10} className="text-red-500" />
                    ) : (
                      <Minus size={10} className="text-neutral-600" />
                    )}
                    <span className={`font-medium ${changeColor}`}>
                      {Math.abs(item.changePercent).toFixed(2)}%
                    </span>
                  </div>
                )}
                {col === 'volume' && (
                  <span className="text-neutral-400">{formatNumber(item.volume ?? 0)}</span>
                )}
                {col === 'marketCap' && (
                  <span className="text-neutral-400">{formatNumber(item.marketCap ?? 0)}</span>
                )}
              </div>
            );
          })}

          {/* Expand button */}
          {onExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand(item);
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-all"
            >
              <Maximize2 size={10} />
            </button>
          )}
        </div>
      );
    },
    [columns, onItemClick, onExpand]
  );

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500 font-medium">Watchlist</span>

        <div className="text-[10px] text-neutral-600">
          {filtered.length} symbol{filtered.length !== 1 ? 's' : ''}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1">
          <Search size={12} className="text-neutral-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-xs text-white outline-none w-24 placeholder:text-neutral-600"
          />
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center gap-2 px-3 py-1 bg-neutral-900/50 border-b border-neutral-800/50 shrink-0"
        style={{
          gridTemplateColumns: `minmax(70px, 1fr) 80px repeat(${columns.length - 1}, minmax(60px, 1fr)) 40px`,
        }}
      >
        <button
          onClick={() => handleSort('symbol')}
          className="text-left text-[10px] text-neutral-600 hover:text-neutral-400 font-medium flex items-center gap-0.5"
        >
          Symbol
          {sortField === 'symbol' && (
            <ChevronDown size={8} className={sortDir === 'asc' ? 'rotate-180' : ''} />
          )}
        </button>
        <span className="text-[10px] text-neutral-600 text-center">Chart</span>
        {columns.map((col) => {
          if (col === 'symbol' || col === 'name') return null;
          return (
            <button
              key={col}
              onClick={() => handleSort(col)}
              className="text-right text-[10px] text-neutral-600 hover:text-neutral-400 font-medium flex items-center justify-end gap-0.5"
            >
              {COLUMN_LABELS[col]}
              {sortField === col && (
                <ChevronDown size={8} className={sortDir === 'asc' ? 'rotate-180' : ''} />
              )}
            </button>
          );
        })}
        <span />
      </div>

      {/* Data rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {grouped ? (
          [...grouped.entries()].map(([sector, sectorItems]) => (
            <div key={sector}>
              <button
                onClick={() => toggleSector(sector)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-neutral-900/30 border-b border-neutral-800/30
                  text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <ChevronDown
                  size={12}
                  className={`transition-transform ${collapsedSectors.has(sector) ? '-rotate-90' : ''}`}
                />
                <span>{sector}</span>
                <span className="text-neutral-600 font-normal">({sectorItems.length})</span>
                <div className="flex-1" />
                <span
                  className={`text-[10px] font-medium ${
                    sectorItems.reduce((s, i) => s + i.changePercent, 0) / sectorItems.length >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  avg{' '}
                  {(sectorItems.reduce((s, i) => s + i.changePercent, 0) / sectorItems.length).toFixed(2)}%
                </span>
              </button>
              {!collapsedSectors.has(sector) && sectorItems.map(renderRow)}
            </div>
          ))
        ) : (
          sorted.map(renderRow)
        )}

        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-xs">
            {searchQuery ? 'No results found' : 'No data'}
          </div>
        )}
      </div>
    </div>
  );
};

export default SparklineGrid;
