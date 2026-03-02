import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Search, Filter, Plus, Trash2, Save, Download, Play, Pause,
  ChevronDown, ChevronRight, Star, TrendingUp, BarChart3, Settings2,
  SlidersHorizontal, Copy, Eye, ArrowUpDown, X,
} from 'lucide-react';

// --- Types ---

type ScreenerTab = 'fundamental' | 'technical' | 'custom';
type Operator = '>' | '<' | '>=' | '<=' | '=' | 'between' | 'top%' | 'bottom%';
type Universe = 'sp500' | 'russell2000' | 'nasdaq100' | 'all_us' | 'global';

interface Condition {
  id: string;
  field: string;
  operator: Operator;
  value: number;
  valueTo?: number;
}

interface ScreenTemplate {
  id: string;
  name: string;
  description: string;
  conditions: Condition[];
  icon: React.ReactNode;
}

interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  marketCap: string;
  pe: number;
  eps: number;
  dividend: number;
  rsi: number;
  sma50: number;
  sma200: number;
  sparkline: { v: number }[];
}

// --- Mock Data ---

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '>', label: 'Greater than' },
  { value: '<', label: 'Less than' },
  { value: '>=', label: 'Greater or equal' },
  { value: '<=', label: 'Less or equal' },
  { value: '=', label: 'Equal to' },
  { value: 'between', label: 'Between' },
  { value: 'top%', label: 'Top %' },
  { value: 'bottom%', label: 'Bottom %' },
];

const FUNDAMENTAL_FIELDS = [
  'Market Cap', 'P/E Ratio', 'EPS', 'Revenue Growth', 'Profit Margin',
  'Debt/Equity', 'ROE', 'ROA', 'Dividend Yield', 'Price/Book',
  'Price/Sales', 'Free Cash Flow', 'Current Ratio', 'Quick Ratio',
];

const TECHNICAL_FIELDS = [
  'RSI (14)', 'MACD Signal', 'SMA 50', 'SMA 200', 'EMA 20',
  'Bollinger %B', 'ATR (14)', 'ADX', 'Stochastic %K', 'Volume SMA 20',
  'OBV Trend', '52W High %', '52W Low %', 'Price vs SMA 200',
];

const UNIVERSES: { value: Universe; label: string; count: string }[] = [
  { value: 'sp500', label: 'S&P 500', count: '503' },
  { value: 'russell2000', label: 'Russell 2000', count: '1,979' },
  { value: 'nasdaq100', label: 'NASDAQ 100', count: '101' },
  { value: 'all_us', label: 'All US', count: '8,432' },
  { value: 'global', label: 'Global', count: '42,156' },
];

const sparkGen = () => Array.from({ length: 20 }, (_, i) => ({ v: 100 + Math.sin(i * 0.5) * 15 + Math.random() * 8 }));

const MOCK_RESULTS: ScreenerResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.84, change: 2.34, changePct: 1.25, volume: '52.3M', marketCap: '2.95T', pe: 31.2, eps: 6.08, dividend: 0.52, rsi: 62, sma50: 185.2, sma200: 178.6, sparkline: sparkGen() },
  { symbol: 'MSFT', name: 'Microsoft Corp', price: 378.91, change: -1.22, changePct: -0.32, volume: '21.1M', marketCap: '2.81T', pe: 36.8, eps: 10.3, dividend: 0.75, rsi: 58, sma50: 372.4, sma200: 355.8, sparkline: sparkGen() },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 495.22, change: 12.55, changePct: 2.60, volume: '44.8M', marketCap: '1.22T', pe: 65.1, eps: 7.61, dividend: 0.04, rsi: 71, sma50: 468.9, sma200: 410.2, sparkline: sparkGen() },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: 141.80, change: 0.95, changePct: 0.67, volume: '18.9M', marketCap: '1.78T', pe: 25.4, eps: 5.58, dividend: 0, rsi: 55, sma50: 138.1, sma200: 131.5, sparkline: sparkGen() },
  { symbol: 'AMZN', name: 'Amazon.com Inc', price: 153.42, change: 1.88, changePct: 1.24, volume: '38.2M', marketCap: '1.59T', pe: 62.3, eps: 2.46, dividend: 0, rsi: 64, sma50: 148.3, sma200: 135.9, sparkline: sparkGen() },
  { symbol: 'META', name: 'Meta Platforms', price: 326.49, change: -3.12, changePct: -0.95, volume: '15.4M', marketCap: '837B', pe: 23.1, eps: 14.13, dividend: 0, rsi: 49, sma50: 320.1, sma200: 298.4, sparkline: sparkGen() },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 248.48, change: 5.67, changePct: 2.33, volume: '98.1M', marketCap: '789B', pe: 77.4, eps: 3.21, dividend: 0, rsi: 68, sma50: 238.5, sma200: 225.1, sparkline: sparkGen() },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 171.62, change: 0.44, changePct: 0.26, volume: '8.2M', marketCap: '497B', pe: 11.2, eps: 15.32, dividend: 2.65, rsi: 53, sma50: 168.9, sma200: 155.2, sparkline: sparkGen() },
  { symbol: 'V', name: 'Visa Inc', price: 261.44, change: 1.02, changePct: 0.39, volume: '5.8M', marketCap: '537B', pe: 30.9, eps: 8.46, dividend: 0.72, rsi: 61, sma50: 257.8, sma200: 248.3, sparkline: sparkGen() },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 157.18, change: -0.56, changePct: -0.36, volume: '6.1M', marketCap: '378B', pe: 15.4, eps: 10.21, dividend: 3.04, rsi: 44, sma50: 159.2, sma200: 162.8, sparkline: sparkGen() },
];

const TEMPLATES: ScreenTemplate[] = [
  { id: '1', name: 'Value Stocks', description: 'Low P/E, high dividend yield', conditions: [{ id: 'v1', field: 'P/E Ratio', operator: '<', value: 15 }, { id: 'v2', field: 'Dividend Yield', operator: '>', value: 2 }], icon: <Star size={14} /> },
  { id: '2', name: 'Growth Momentum', description: 'High RSI, strong revenue growth', conditions: [{ id: 'g1', field: 'RSI (14)', operator: '>', value: 60 }, { id: 'g2', field: 'Revenue Growth', operator: '>', value: 20 }], icon: <TrendingUp size={14} /> },
  { id: '3', name: 'Oversold Bounce', description: 'RSI below 30, near 52W low', conditions: [{ id: 'o1', field: 'RSI (14)', operator: '<', value: 30 }, { id: 'o2', field: '52W Low %', operator: '<', value: 5 }], icon: <BarChart3 size={14} /> },
  { id: '4', name: 'Quality Large Cap', description: 'High ROE, low debt, large cap', conditions: [{ id: 'q1', field: 'ROE', operator: '>', value: 15 }, { id: 'q2', field: 'Debt/Equity', operator: '<', value: 0.5 }], icon: <Settings2 size={14} /> },
];

// --- Sub-components ---

const MiniSparkline: React.FC<{ data: { v: number }[]; positive: boolean }> = ({ data, positive }) => (
  <div className="w-16 h-8">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line type="monotone" dataKey="v" stroke={positive ? '#00cc66' : '#ff3333'} strokeWidth={1.2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

const ConditionRow: React.FC<{
  condition: Condition;
  fields: string[];
  onChange: (id: string, updates: Partial<Condition>) => void;
  onRemove: (id: string) => void;
}> = ({ condition, fields, onChange, onRemove }) => (
  <div className="flex items-center gap-2 p-2 bg-[#0d0d1a] rounded border border-[#1a1a2e] group">
    <select
      value={condition.field}
      onChange={(e) => onChange(condition.id, { field: e.target.value })}
      className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded flex-1 min-w-[140px] focus:border-amber-500/50 focus:outline-none"
    >
      {fields.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
    <select
      value={condition.operator}
      onChange={(e) => onChange(condition.id, { operator: e.target.value as Operator })}
      className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded w-32 focus:border-amber-500/50 focus:outline-none"
    >
      {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
    </select>
    <input
      type="number"
      value={condition.value}
      onChange={(e) => onChange(condition.id, { value: +e.target.value })}
      className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded w-20 focus:border-amber-500/50 focus:outline-none"
    />
    {condition.operator === 'between' && (
      <>
        <span className="text-gray-500 text-xs">to</span>
        <input
          type="number"
          value={condition.valueTo ?? 0}
          onChange={(e) => onChange(condition.id, { valueTo: +e.target.value })}
          className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded w-20 focus:border-amber-500/50 focus:outline-none"
        />
      </>
    )}
    <button onClick={() => onRemove(condition.id)} className="text-gray-600 hover:text-[#ff3333] transition-colors p-1 opacity-0 group-hover:opacity-100">
      <Trash2 size={14} />
    </button>
  </div>
);

// --- Main Component ---

export const AdvancedScreener: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<ScreenerTab>('fundamental');
  const [universe, setUniverse] = useState<Universe>('sp500');
  const [conditions, setConditions] = useState<Condition[]>([
    { id: 'c1', field: 'P/E Ratio', operator: '<', value: 30 },
    { id: 'c2', field: 'Market Cap', operator: '>', value: 10 },
  ]);
  const [sortCol, setSortCol] = useState<string>('changePct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [savedScreens] = useState<string[]>(['My Value Screen', 'Tech Momentum']);

  const fields = activeTab === 'technical' ? TECHNICAL_FIELDS : FUNDAMENTAL_FIELDS;

  const addCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      { id: `c${Date.now()}`, field: fields[0], operator: '>', value: 0 },
    ]);
  }, [fields]);

  const updateCondition = useCallback((id: string, updates: Partial<Condition>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const loadTemplate = useCallback((template: ScreenTemplate) => {
    setConditions(template.conditions);
  }, []);

  const sortedResults = useMemo(() => {
    const filtered = searchQuery
      ? MOCK_RESULTS.filter((r) => r.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : MOCK_RESULTS;
    return [...filtered].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortCol] as number;
      const bVal = (b as Record<string, unknown>)[sortCol] as number;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [searchQuery, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const TABS: { key: ScreenerTab; label: string }[] = [
    { key: 'fundamental', label: 'Fundamental' },
    { key: 'technical', label: 'Technical' },
    { key: 'custom', label: 'Custom Formula' },
  ];

  const TABLE_COLS: { key: string; label: string; align?: string }[] = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'changePct', label: 'Chg%', align: 'right' },
    { key: 'volume', label: 'Volume', align: 'right' },
    { key: 'marketCap', label: 'Mkt Cap', align: 'right' },
    { key: 'pe', label: 'P/E', align: 'right' },
    { key: 'eps', label: 'EPS', align: 'right' },
    { key: 'rsi', label: 'RSI', align: 'right' },
    { key: 'sparkline', label: '20D', align: 'center' },
  ];

  return (
    <div className={`flex h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Sidebar: Templates & Saved */}
      {showTemplates && (
        <div className="w-56 border-r border-[#1a1a2e] flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-[#1a1a2e] flex items-center justify-between">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Templates</span>
            <button onClick={() => setShowTemplates(false)} className="text-gray-600 hover:text-gray-400"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="w-full text-left p-2.5 rounded bg-[#0d0d1a] border border-[#1a1a2e] hover:border-amber-900/40 transition-colors group"
              >
                <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                  {t.icon}
                  {t.name}
                </div>
                <div className="text-gray-500 text-[10px] mt-1">{t.description}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-[#1a1a2e] p-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 px-1">Saved Screens</div>
            {savedScreens.map((s) => (
              <button key={s} className="w-full text-left text-xs text-gray-400 hover:text-amber-400 px-2 py-1.5 rounded hover:bg-[#12121f] transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
          {!showTemplates && (
            <button onClick={() => setShowTemplates(true)} className="text-gray-500 hover:text-amber-400 p-1"><SlidersHorizontal size={14} /></button>
          )}
          <div className="flex items-center gap-0.5 bg-[#0a0a14] rounded p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#1a1a2e] mx-1" />

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 uppercase">Universe:</span>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value as Universe)}
              className="bg-[#12121f] border border-[#1a1a2e] text-amber-400 text-xs px-2 py-1 rounded focus:outline-none focus:border-amber-500/50"
            >
              {UNIVERSES.map((u) => (
                <option key={u.value} value={u.value}>{u.label} ({u.count})</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter results…"
              className="bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs pl-7 pr-2 py-1.5 rounded w-40 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600"
            />
          </div>

          <button
            onClick={() => setScanning((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${scanning ? 'bg-[#ff3333]/20 text-[#ff3333]' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}
          >
            {scanning ? <Pause size={12} /> : <Play size={12} />}
            {scanning ? 'Stop' : 'Scan'}
          </button>
        </div>

        {/* Criteria Builder */}
        <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0c0c18]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Criteria ({conditions.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={addCondition} className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
                <Plus size={10} /> Add
              </button>
              <button className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-[#1a1a2e] transition-colors">
                <Copy size={10} /> Duplicate
              </button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {conditions.map((c) => (
              <ConditionRow
                key={c.id}
                condition={c}
                fields={fields}
                onChange={updateCondition}
                onRemove={removeCondition}
              />
            ))}
            {conditions.length === 0 && (
              <div className="text-center text-gray-600 text-xs py-3">No criteria. Add conditions or load a template.</div>
            )}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a2e] bg-[#0d0d1a]">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-gray-600" />
            <span className="text-xs text-gray-400">
              <span className="text-amber-400 font-medium">{sortedResults.length}</span> results
            </span>
            {scanning && (
              <span className="flex items-center gap-1 text-[10px] text-[#00cc66]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00cc66] animate-pulse" />
                Live scanning
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-[#1a1a2e] transition-colors">
              <Save size={10} /> Save
            </button>
            <button className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-[#1a1a2e] transition-colors">
              <Download size={10} /> Export
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0d0d1a] z-10">
              <tr>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== 'sparkline' && handleSort(col.key)}
                    className={`px-3 py-2 font-medium text-gray-500 border-b border-[#1a1a2e] cursor-pointer hover:text-gray-300 transition-colors whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key && <ArrowUpDown size={10} className="text-amber-400" />}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((row) => (
                <tr
                  key={row.symbol}
                  onClick={() => setSelectedRow(selectedRow === row.symbol ? null : row.symbol)}
                  className={`border-b border-[#1a1a2e]/50 cursor-pointer transition-colors ${selectedRow === row.symbol ? 'bg-amber-500/10' : 'hover:bg-[#0d0d1a]'}`}
                >
                  <td className="px-3 py-2">
                    <div className="text-amber-400 font-medium">{row.symbol}</div>
                    <div className="text-gray-600 text-[10px]">{row.name}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{row.price.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${row.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                    {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">{row.volume}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{row.marketCap}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{row.pe.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{row.eps.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right ${row.rsi > 70 ? 'text-[#ff3333]' : row.rsi < 30 ? 'text-[#00cc66]' : 'text-gray-300'}`}>
                    {row.rsi}
                  </td>
                  <td className="px-3 py-2">
                    <MiniSparkline data={row.sparkline} positive={row.changePct >= 0} />
                  </td>
                  <td className="px-3 py-2">
                    <button className="text-gray-600 hover:text-amber-400 transition-colors"><Eye size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedRow && (() => {
          const row = MOCK_RESULTS.find((r) => r.symbol === selectedRow);
          if (!row) return null;
          return (
            <div className="border-t border-[#1a1a2e] bg-[#0c0c18] px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-sm">{row.symbol}</span>
                    <span className="text-gray-500 text-xs">{row.name}</span>
                    <span className={`text-xs font-medium ${row.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'}`}>
                      {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px]">
                    <div><span className="text-gray-500">P/E:</span> <span className="text-gray-300">{row.pe}</span></div>
                    <div><span className="text-gray-500">EPS:</span> <span className="text-gray-300">{row.eps}</span></div>
                    <div><span className="text-gray-500">Div:</span> <span className="text-gray-300">{row.dividend}%</span></div>
                    <div><span className="text-gray-500">RSI:</span> <span className="text-gray-300">{row.rsi}</span></div>
                    <div><span className="text-gray-500">SMA50:</span> <span className="text-gray-300">{row.sma50}</span></div>
                    <div><span className="text-gray-500">SMA200:</span> <span className="text-gray-300">{row.sma200}</span></div>
                  </div>
                </div>
                <button onClick={() => setSelectedRow(null)} className="text-gray-600 hover:text-gray-400"><X size={14} /></button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default AdvancedScreener;
