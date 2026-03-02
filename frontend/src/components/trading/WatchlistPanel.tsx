import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WatchlistSecurity {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  prevPrice: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  rsi: number;
  sparkline: number[];
  flash: 'up' | 'down' | null;
  alertActive: boolean;
}

interface Watchlist {
  id: string;
  name: string;
  items: WatchlistSecurity[];
}

interface WatchlistPanelProps {
  className?: string;
  onSelectSymbol?: (ticker: string) => void;
}

type SortKey = 'ticker' | 'price' | 'change' | 'changePct' | 'volume' | 'rsi';
type SortDir = 'asc' | 'desc';
type ColumnId = 'price' | 'change' | 'changePct' | 'volume' | 'high' | 'low' | 'rsi' | 'miniChart' | 'alert';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  visible: boolean;
  width: string;
}

// ─── Data ───────────────────────────────────────────────────────────────────

function genSparkline(): number[] {
  const pts: number[] = [];
  let v = 100 + Math.random() * 50;
  for (let i = 0; i < 20; i++) { v += (Math.random() - 0.48) * 3; pts.push(v); }
  return pts;
}

function createSec(ticker: string, name: string, sector: string, price: number): WatchlistSecurity {
  const chg = (Math.random() - 0.42) * price * 0.04;
  return {
    ticker, name, sector, price,
    prevPrice: price,
    change: +chg.toFixed(2),
    changePct: +((chg / price) * 100).toFixed(2),
    volume: Math.floor(Math.random() * 60000000 + 2000000),
    high: +(price + Math.random() * 3).toFixed(2),
    low: +(price - Math.random() * 3).toFixed(2),
    rsi: +(30 + Math.random() * 40).toFixed(1),
    sparkline: genSparkline(),
    flash: null,
    alertActive: Math.random() > 0.7,
  };
}

const DEFAULT_WATCHLISTS: Watchlist[] = [
  {
    id: 'w1', name: 'Tech Leaders',
    items: [
      createSec('AAPL', 'Apple Inc', 'Technology', 189.84),
      createSec('MSFT', 'Microsoft Corp', 'Technology', 378.91),
      createSec('GOOGL', 'Alphabet Inc', 'Technology', 141.80),
      createSec('AMZN', 'Amazon.com', 'Technology', 182.10),
      createSec('NVDA', 'NVIDIA Corp', 'Technology', 695.40),
      createSec('META', 'Meta Platforms', 'Technology', 525.80),
      createSec('TSM', 'Taiwan Semi', 'Technology', 168.20),
      createSec('AVGO', 'Broadcom Inc', 'Technology', 162.50),
    ],
  },
  {
    id: 'w2', name: 'Financials',
    items: [
      createSec('JPM', 'JPMorgan Chase', 'Financials', 198.75),
      createSec('BAC', 'Bank of America', 'Financials', 38.20),
      createSec('GS', 'Goldman Sachs', 'Financials', 468.30),
      createSec('MS', 'Morgan Stanley', 'Financials', 96.80),
      createSec('WFC', 'Wells Fargo', 'Financials', 58.90),
    ],
  },
  {
    id: 'w3', name: 'Macro',
    items: [
      createSec('SPY', 'S&P 500 ETF', 'Index', 520.40),
      createSec('QQQ', 'Nasdaq 100 ETF', 'Index', 438.20),
      createSec('IWM', 'Russell 2000 ETF', 'Index', 218.50),
      createSec('TLT', 'Treasury 20Y+ ETF', 'Fixed Income', 95.30),
      createSec('GLD', 'Gold ETF', 'Commodity', 212.80),
      createSec('USO', 'Oil ETF', 'Commodity', 74.20),
    ],
  },
];

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'price', label: 'Price', visible: true, width: '70px' },
  { id: 'change', label: 'Chg', visible: true, width: '60px' },
  { id: 'changePct', label: 'Chg%', visible: true, width: '55px' },
  { id: 'volume', label: 'Vol', visible: true, width: '65px' },
  { id: 'high', label: 'High', visible: false, width: '60px' },
  { id: 'low', label: 'Low', visible: false, width: '60px' },
  { id: 'rsi', label: 'RSI', visible: true, width: '40px' },
  { id: 'miniChart', label: 'Chart', visible: true, width: '65px' },
  { id: 'alert', label: '!', visible: true, width: '20px' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtVol = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toString();
const chgColor = (n: number) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-400';
const flashBg = (f: 'up' | 'down' | null) => f === 'up' ? 'bg-emerald-900/20' : f === 'down' ? 'bg-red-900/20' : '';

function MiniChart({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 60, h = 18;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={pts} fill="none" stroke={positive ? '#34d399' : '#f87171'} strokeWidth="1.2" />
    </svg>
  );
}

function rsiColor(rsi: number): string {
  if (rsi >= 70) return 'text-red-400';
  if (rsi <= 30) return 'text-emerald-400';
  return 'text-gray-400';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WatchlistPanel({ className = '', onSelectSymbol }: WatchlistPanelProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(DEFAULT_WATCHLISTS);
  const [activeId, setActiveId] = useState('w1');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showColConfig, setShowColConfig] = useState(false);
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [addSymbolInput, setAddSymbolInput] = useState('');
  const [groupBySector, setGroupBySector] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeList = useMemo(() => watchlists.find(w => w.id === activeId) ?? watchlists[0], [watchlists, activeId]);

  useEffect(() => {
    const iv = setInterval(() => {
      setWatchlists(prev => prev.map(wl => ({
        ...wl,
        items: wl.items.map(sec => {
          const delta = (Math.random() - 0.48) * sec.price * 0.002;
          const newPrice = +(sec.price + delta).toFixed(2);
          const flash = delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : null;
          return {
            ...sec,
            prevPrice: sec.price,
            price: newPrice,
            change: +(sec.change + delta).toFixed(2),
            changePct: +(((sec.change + delta) / newPrice) * 100).toFixed(2),
            flash,
          };
        }),
      })));
    }, 1500);

    const flashClear = setInterval(() => {
      setWatchlists(prev => prev.map(wl => ({ ...wl, items: wl.items.map(s => ({ ...s, flash: null })) })));
    }, 600);

    return () => { clearInterval(iv); clearInterval(flashClear); };
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'ticker' ? 'asc' : 'desc'); }
  }, [sortKey]);

  const filtered = useMemo(() => {
    let items = activeList.items;
    if (searchTerm) items = items.filter(s => s.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return [...items].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [activeList, searchTerm, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (!groupBySector) return { All: filtered };
    const g: Record<string, WatchlistSecurity[]> = {};
    for (const s of filtered) (g[s.sector] ??= []).push(s);
    return g;
  }, [filtered, groupBySector]);

  const handleAddSymbol = useCallback(() => {
    if (!addSymbolInput.trim()) return;
    const ticker = addSymbolInput.toUpperCase().trim();
    setWatchlists(prev => prev.map(wl => wl.id === activeId ? {
      ...wl,
      items: [...wl.items, createSec(ticker, ticker + ' Corp', 'Unknown', 100 + Math.random() * 200)],
    } : wl));
    setAddSymbolInput('');
    setShowAddSymbol(false);
  }, [addSymbolInput, activeId]);

  const handleRemoveSymbol = useCallback((ticker: string) => {
    setWatchlists(prev => prev.map(wl => wl.id === activeId ? { ...wl, items: wl.items.filter(s => s.ticker !== ticker) } : wl));
  }, [activeId]);

  const handleExport = useCallback(() => {
    const csv = ['Ticker,Name,Price,Change,Change%,Volume,RSI']
      .concat(filtered.map(s => `${s.ticker},${s.name},${s.price},${s.change},${s.changePct},${s.volume},${s.rsi}`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeList.name.replace(/\s/g, '_')}_watchlist.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, activeList]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const lines = text.split('\n').slice(1);
        const newItems = lines.filter(l => l.trim()).map(l => {
          const [ticker, name] = l.split(',');
          return createSec(ticker?.trim() ?? 'UNK', name?.trim() ?? 'Unknown', 'Imported', 100 + Math.random() * 200);
        });
        setWatchlists(prev => prev.map(wl => wl.id === activeId ? { ...wl, items: [...wl.items, ...newItems] } : wl));
      };
      reader.readAsText(file);
    };
    input.click();
  }, [activeId]);

  const toggleColumn = useCallback((id: ColumnId) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  }, []);

  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);
  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setWatchlists(prev => prev.map(wl => {
      if (wl.id !== activeId) return wl;
      const arr = [...wl.items];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, item);
      return { ...wl, items: arr };
    }));
    setDragIdx(null);
  }, [dragIdx, activeId]);

  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns]);

  const SortBtn = ({ label, field }: { label: string; field: SortKey }) => (
    <button onClick={() => handleSort(field)} className={`text-[10px] uppercase tracking-wider ${sortKey === field ? 'text-amber-400' : 'text-gray-500'} hover:text-amber-300`}>
      {label}{sortKey === field && (sortDir === 'asc' ? '↑' : '↓')}
    </button>
  );

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <span className="text-amber-400 font-bold text-sm">Watchlist</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setGroupBySector(g => !g)} className={`px-1.5 py-0.5 rounded text-[10px] border ${groupBySector ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50'}`}>Grp</button>
          <button onClick={() => setShowColConfig(c => !c)} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">Col</button>
          <button onClick={handleExport} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">Exp</button>
          <button onClick={handleImport} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">Imp</button>
        </div>
      </div>

      {/* Watchlist Tabs */}
      <div className="flex items-center border-b border-gray-800/30 px-1 overflow-x-auto">
        {watchlists.map(wl => (
          <button
            key={wl.id}
            onClick={() => setActiveId(wl.id)}
            className={`px-3 py-1.5 text-[10px] whitespace-nowrap border-b-2 transition-colors ${
              activeId === wl.id ? 'text-amber-400 border-amber-500' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {wl.name} ({wl.items.length})
          </button>
        ))}
      </div>

      {/* Column Config Dropdown */}
      {showColConfig && (
        <div className="px-3 py-2 bg-[#0c0c18] border-b border-gray-800/30 flex flex-wrap gap-1">
          {columns.map(c => (
            <button key={c.id} onClick={() => toggleColumn(c.id)} className={`px-1.5 py-0.5 rounded text-[10px] ${c.visible ? 'bg-amber-600/20 text-amber-400 border border-amber-700/30' : 'bg-[#12121f] text-gray-500 border border-gray-800/50'}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Search & Add */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800/30 bg-[#0c0c18]">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-[#12121f] border border-gray-800/50 rounded px-2 py-0.5 text-amber-300 text-[10px] placeholder-gray-600 focus:outline-none focus:border-amber-600/50"
        />
        {showAddSymbol ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={addSymbolInput}
              onChange={e => setAddSymbolInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSymbol()}
              placeholder="TICKER"
              className="w-16 bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-amber-300 text-[10px] placeholder-gray-600 focus:outline-none"
            />
            <button onClick={handleAddSymbol} className="px-1.5 py-0.5 bg-amber-600 text-black rounded text-[10px] font-medium">Add</button>
            <button onClick={() => setShowAddSymbol(false)} className="text-gray-500 text-[10px]">×</button>
          </div>
        ) : (
          <button onClick={() => setShowAddSymbol(true)} className="px-1.5 py-0.5 bg-amber-600 text-black rounded text-[10px] font-medium">+</button>
        )}
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-2 py-1 border-b border-gray-800/30 gap-1">
        <div className="w-[55px]"><SortBtn label="Sym" field="ticker" /></div>
        {visibleCols.map(c => (
          <div key={c.id} style={{ width: c.width }} className="text-right">
            {(c.id === 'price' || c.id === 'change' || c.id === 'changePct' || c.id === 'volume' || c.id === 'rsi') ? (
              <SortBtn label={c.label} field={c.id === 'changePct' ? 'changePct' : c.id as SortKey} />
            ) : (
              <span className="text-gray-500 text-[10px]">{c.label}</span>
            )}
          </div>
        ))}
        <div className="w-5" />
      </div>

      {/* Watchlist Body */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '450px' }}>
        {Object.entries(grouped).map(([group, items]) => (
          <React.Fragment key={group}>
            {groupBySector && (
              <div className="px-2 py-1 bg-[#0d0d1a] border-b border-gray-800/30 text-[10px] text-amber-500 font-medium uppercase tracking-wider">
                {group}
              </div>
            )}
            {items.map((s, idx) => (
              <div
                key={s.ticker}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                onClick={() => onSelectSymbol?.(s.ticker)}
                className={`flex items-center px-2 py-1 gap-1 cursor-pointer border-b border-gray-800/10 hover:bg-[#12121f] transition-all ${flashBg(s.flash)} ${dragIdx === idx ? 'opacity-50' : ''}`}
              >
                <div className="w-[55px]">
                  <span className="text-amber-300 font-medium">{s.ticker}</span>
                </div>
                {visibleCols.map(c => (
                  <div key={c.id} style={{ width: c.width }} className="text-right font-mono tabular-nums">
                    {c.id === 'price' && <span className="text-gray-300">{s.price.toFixed(2)}</span>}
                    {c.id === 'change' && <span className={chgColor(s.change)}>{s.change > 0 ? '+' : ''}{s.change.toFixed(2)}</span>}
                    {c.id === 'changePct' && <span className={chgColor(s.changePct)}>{s.changePct > 0 ? '+' : ''}{s.changePct.toFixed(2)}%</span>}
                    {c.id === 'volume' && <span className="text-gray-400">{fmtVol(s.volume)}</span>}
                    {c.id === 'high' && <span className="text-gray-400">{s.high.toFixed(2)}</span>}
                    {c.id === 'low' && <span className="text-gray-400">{s.low.toFixed(2)}</span>}
                    {c.id === 'rsi' && <span className={rsiColor(s.rsi)}>{s.rsi}</span>}
                    {c.id === 'miniChart' && <MiniChart data={s.sparkline} positive={s.change >= 0} />}
                    {c.id === 'alert' && s.alertActive && <span className="text-amber-400 text-[9px]" title="Alert active">●</span>}
                  </div>
                ))}
                <button
                  onClick={e => { e.stopPropagation(); handleRemoveSymbol(s.ticker); }}
                  className="w-5 text-center text-gray-700 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-900/20 bg-[#0d0d1a] text-[10px]">
        <span className="text-gray-500">{filtered.length} symbols</span>
        <div className="flex gap-3">
          <span className="text-gray-500">
            Up: <span className="text-emerald-400">{filtered.filter(s => s.change > 0).length}</span>
          </span>
          <span className="text-gray-500">
            Down: <span className="text-red-400">{filtered.filter(s => s.change < 0).length}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
