import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Plus, X, Search, BarChart3, TrendingUp, Percent } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComparisonDataPoint {
  timestamp: number;
  [symbol: string]: number;
}

export type ComparisonMode = 'percent' | 'absolute' | 'ratio' | 'spread';

export interface SymbolSeries {
  symbol: string;
  color: string;
  visible: boolean;
  data: { timestamp: number; price: number }[];
}

export interface ComparisonChartProps {
  series: SymbolSeries[];
  mode?: ComparisonMode;
  benchmarkSymbol?: string;
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  onModeChange?: (mode: ComparisonMode) => void;
  availableSymbols?: string[];
  timeRanges?: string[];
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  className?: string;
}

const SYMBOL_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

const DEFAULT_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

// ─── Symbol Search ───────────────────────────────────────────────────────────

const SymbolSearch: React.FC<{
  onSelect: (symbol: string) => void;
  onClose: () => void;
  available: string[];
  existing: string[];
}> = ({ onSelect, onClose, available, existing }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toUpperCase().trim();
    if (!q) return available.filter((s) => !existing.includes(s)).slice(0, 20);
    return available
      .filter((s) => s.toUpperCase().includes(q) && !existing.includes(s))
      .slice(0, 20);
  }, [query, available, existing]);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-64">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
        <Search size={14} className="text-neutral-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              onSelect(query.trim().toUpperCase());
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Search symbol..."
          className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-neutral-600"
        />
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-neutral-600">
            {query.trim() ? (
              <button
                onClick={() => onSelect(query.trim().toUpperCase())}
                className="text-blue-400 hover:text-blue-300"
              >
                Add "{query.trim().toUpperCase()}"
              </button>
            ) : (
              'No symbols available'
            )}
          </div>
        ) : (
          filtered.map((s) => (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              {s}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Legend Item ──────────────────────────────────────────────────────────────

const LegendItem: React.FC<{
  series: SymbolSeries;
  currentValue: number | null;
  percentChange: number | null;
  onRemove: () => void;
  onToggle: () => void;
}> = ({ series, currentValue, percentChange, onRemove, onToggle }) => (
  <div
    className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-opacity ${
      series.visible ? 'opacity-100' : 'opacity-40'
    }`}
  >
    <button
      onClick={onToggle}
      className="w-3 h-3 rounded-sm shrink-0"
      style={{ backgroundColor: series.color }}
    />
    <span className="text-neutral-300 font-medium cursor-pointer" onClick={onToggle}>
      {series.symbol}
    </span>
    {currentValue !== null && (
      <span className="text-neutral-400">{currentValue.toFixed(2)}</span>
    )}
    {percentChange !== null && (
      <span className={percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        {percentChange >= 0 ? '+' : ''}
        {percentChange.toFixed(2)}%
      </span>
    )}
    <button
      onClick={onRemove}
      className="ml-auto text-neutral-600 hover:text-red-400 transition-colors"
    >
      <X size={12} />
    </button>
  </div>
);

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const ComparisonTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: number;
  mode: ComparisonMode;
}> = ({ active, payload, label, mode }) => {
  if (!active || !payload?.length) return null;

  const formatValue = (val: number) => {
    if (mode === 'percent') return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    if (mode === 'ratio') return val.toFixed(4);
    if (mode === 'spread') return val.toFixed(2);
    return val.toFixed(2);
  };

  return (
    <div className="bg-neutral-900/95 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[10px] text-neutral-500 mb-1">
        {label ? new Date(label).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        }) : ''}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-neutral-400">{entry.name}</span>
          <span className="ml-auto font-medium text-white">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Data Processing ─────────────────────────────────────────────────────────

function normalizeToPercent(series: SymbolSeries[]): ComparisonDataPoint[] {
  const timestamps = new Set<number>();
  const baseValues: Record<string, number> = {};

  for (const s of series) {
    if (!s.visible || s.data.length === 0) continue;
    baseValues[s.symbol] = s.data[0].price;
    for (const d of s.data) timestamps.add(d.timestamp);
  }

  const sorted = [...timestamps].sort((a, b) => a - b);
  const lookup: Record<string, Map<number, number>> = {};
  for (const s of series) {
    if (!s.visible) continue;
    lookup[s.symbol] = new Map(s.data.map((d) => [d.timestamp, d.price]));
  }

  return sorted.map((ts) => {
    const point: ComparisonDataPoint = { timestamp: ts };
    for (const s of series) {
      if (!s.visible) continue;
      const price = lookup[s.symbol]?.get(ts);
      if (price !== undefined && baseValues[s.symbol]) {
        point[s.symbol] = ((price - baseValues[s.symbol]) / baseValues[s.symbol]) * 100;
      }
    }
    return point;
  });
}

function toAbsoluteData(series: SymbolSeries[]): ComparisonDataPoint[] {
  const timestamps = new Set<number>();
  for (const s of series) {
    if (!s.visible) continue;
    for (const d of s.data) timestamps.add(d.timestamp);
  }

  const sorted = [...timestamps].sort((a, b) => a - b);
  const lookup: Record<string, Map<number, number>> = {};
  for (const s of series) {
    if (!s.visible) continue;
    lookup[s.symbol] = new Map(s.data.map((d) => [d.timestamp, d.price]));
  }

  return sorted.map((ts) => {
    const point: ComparisonDataPoint = { timestamp: ts };
    for (const s of series) {
      if (!s.visible) continue;
      const price = lookup[s.symbol]?.get(ts);
      if (price !== undefined) point[s.symbol] = price;
    }
    return point;
  });
}

function toRatioData(series: SymbolSeries[]): ComparisonDataPoint[] {
  if (series.filter((s) => s.visible).length < 2) return [];
  const visible = series.filter((s) => s.visible);
  const a = visible[0];
  const b = visible[1];
  const lookupB = new Map(b.data.map((d) => [d.timestamp, d.price]));

  return a.data
    .filter((d) => lookupB.has(d.timestamp))
    .map((d) => ({
      timestamp: d.timestamp,
      [`${a.symbol}/${b.symbol}`]: d.price / (lookupB.get(d.timestamp) ?? 1),
    }));
}

function toSpreadData(series: SymbolSeries[]): ComparisonDataPoint[] {
  if (series.filter((s) => s.visible).length < 2) return [];
  const visible = series.filter((s) => s.visible);
  const a = visible[0];
  const b = visible[1];
  const lookupB = new Map(b.data.map((d) => [d.timestamp, d.price]));

  return a.data
    .filter((d) => lookupB.has(d.timestamp))
    .map((d) => ({
      timestamp: d.timestamp,
      [`${a.symbol}-${b.symbol}`]: d.price - (lookupB.get(d.timestamp) ?? 0),
    }));
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  series: propSeries,
  mode: propMode,
  onAddSymbol,
  onRemoveSymbol,
  onModeChange,
  availableSymbols = [],
  timeRanges = DEFAULT_RANGES,
  selectedRange = '1Y',
  onRangeChange,
  className = '',
}) => {
  const [mode, setMode] = useState<ComparisonMode>(propMode ?? 'percent');
  const [showSearch, setShowSearch] = useState(false);
  const [localSeries, setLocalSeries] = useState<SymbolSeries[]>(propSeries);
  const [activeRange, setActiveRange] = useState(selectedRange);

  useEffect(() => {
    setLocalSeries(propSeries);
  }, [propSeries]);

  const handleModeChange = useCallback(
    (m: ComparisonMode) => {
      setMode(m);
      onModeChange?.(m);
    },
    [onModeChange]
  );

  const handleAddSymbol = useCallback(
    (symbol: string) => {
      if (localSeries.some((s) => s.symbol === symbol)) return;
      const color = SYMBOL_COLORS[localSeries.length % SYMBOL_COLORS.length];
      setLocalSeries((prev) => [...prev, { symbol, color, visible: true, data: [] }]);
      onAddSymbol?.(symbol);
      setShowSearch(false);
    },
    [localSeries, onAddSymbol]
  );

  const handleRemoveSymbol = useCallback(
    (symbol: string) => {
      setLocalSeries((prev) => prev.filter((s) => s.symbol !== symbol));
      onRemoveSymbol?.(symbol);
    },
    [onRemoveSymbol]
  );

  const toggleVisibility = useCallback((symbol: string) => {
    setLocalSeries((prev) =>
      prev.map((s) => (s.symbol === symbol ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const handleRangeChange = useCallback(
    (range: string) => {
      setActiveRange(range);
      onRangeChange?.(range);
    },
    [onRangeChange]
  );

  const { chartData, dataKeys } = useMemo(() => {
    switch (mode) {
      case 'percent':
        return {
          chartData: normalizeToPercent(localSeries),
          dataKeys: localSeries.filter((s) => s.visible).map((s) => s.symbol),
        };
      case 'absolute':
        return {
          chartData: toAbsoluteData(localSeries),
          dataKeys: localSeries.filter((s) => s.visible).map((s) => s.symbol),
        };
      case 'ratio': {
        const data = toRatioData(localSeries);
        const keys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== 'timestamp') : [];
        return { chartData: data, dataKeys: keys };
      }
      case 'spread': {
        const data = toSpreadData(localSeries);
        const keys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== 'timestamp') : [];
        return { chartData: data, dataKeys: keys };
      }
    }
  }, [mode, localSeries]);

  const currentValues = useMemo(() => {
    const vals: Record<string, { current: number | null; pctChange: number | null }> = {};
    for (const s of localSeries) {
      if (s.data.length === 0) {
        vals[s.symbol] = { current: null, pctChange: null };
        continue;
      }
      const first = s.data[0].price;
      const last = s.data[s.data.length - 1].price;
      vals[s.symbol] = {
        current: last,
        pctChange: first !== 0 ? ((last - first) / first) * 100 : null,
      };
    }
    return vals;
  }, [localSeries]);

  const modeButtons: { key: ComparisonMode; label: string; icon: React.ReactNode }[] = [
    { key: 'percent', label: '%', icon: <Percent size={12} /> },
    { key: 'absolute', label: 'Abs', icon: <BarChart3 size={12} /> },
    { key: 'ratio', label: 'Ratio', icon: <TrendingUp size={12} /> },
    { key: 'spread', label: 'Spread', icon: <BarChart3 size={12} /> },
  ];

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0 flex-wrap">
        {/* Mode selector */}
        <div className="flex items-center rounded bg-neutral-800 overflow-hidden">
          {modeButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => handleModeChange(btn.key)}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                mode === btn.key
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Add symbol */}
        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <Plus size={12} />
            <span>Compare</span>
          </button>
          {showSearch && (
            <SymbolSearch
              onSelect={handleAddSymbol}
              onClose={() => setShowSearch(false)}
              available={availableSymbols}
              existing={localSeries.map((s) => s.symbol)}
            />
          )}
        </div>

        <div className="flex-1" />

        {/* Time range */}
        <div className="flex items-center gap-0.5">
          {timeRanges.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeRange === r
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 px-3 py-1 bg-neutral-900/50 border-b border-neutral-800/50 shrink-0 flex-wrap">
        {localSeries.map((s) => (
          <LegendItem
            key={s.symbol}
            series={s}
            currentValue={currentValues[s.symbol]?.current ?? null}
            percentChange={currentValues[s.symbol]?.pctChange ?? null}
            onRemove={() => handleRemoveSymbol(s.symbol)}
            onToggle={() => toggleVisibility(s.symbol)}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 p-2">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm">
            Add symbols to compare
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                }
                stroke="#525252"
                tick={{ fontSize: 10, fill: '#737373' }}
              />
              <YAxis
                stroke="#525252"
                tick={{ fontSize: 10, fill: '#737373' }}
                tickFormatter={(v: number) =>
                  mode === 'percent' ? `${v.toFixed(1)}%` : v.toFixed(2)
                }
              />
              {mode === 'percent' && (
                <ReferenceLine y={0} stroke="#525252" strokeDasharray="4 4" />
              )}
              <Tooltip content={<ComparisonTooltip mode={mode} />} />
              {dataKeys.map((key, i) => {
                const color =
                  localSeries.find((s) => s.symbol === key)?.color ??
                  SYMBOL_COLORS[i % SYMBOL_COLORS.length];
                return (
                  <Line
                    key={key}
                    dataKey={key}
                    name={key}
                    type="monotone"
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: color }}
                    connectNulls
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ComparisonChart;
