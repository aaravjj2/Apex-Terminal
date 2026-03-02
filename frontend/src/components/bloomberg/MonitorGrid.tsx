import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
type FlashState = 'up' | 'down' | null;

interface MonitorSecurity {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  prevPrice: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePct: number;
  volume: number;
  vwap: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  flash: FlashState;
  sparkline: number[];
  alert: string | null;
}

interface ColumnDef {
  key: keyof MonitorSecurity | 'miniChart';
  label: string;
  width: number;
  visible: boolean;
  align: 'left' | 'right' | 'center';
}

interface MonitorGridProps {
  className?: string;
  onSelectSecurity?: (ticker: string) => void;
}

// ─── Initial Data ───────────────────────────────────────────────────────────

function generateSparkline(): number[] {
  const points: number[] = [];
  let val = 100 + Math.random() * 50;
  for (let i = 0; i < 20; i++) {
    val += (Math.random() - 0.48) * 3;
    points.push(val);
  }
  return points;
}

function createSecurity(ticker: string, name: string, sector: string, price: number): MonitorSecurity {
  const change = (Math.random() - 0.45) * price * 0.04;
  return {
    ticker, name, sector,
    price,
    prevPrice: price,
    open: price - (Math.random() - 0.5) * 2,
    high: price + Math.random() * 3,
    low: price - Math.random() * 3,
    change,
    changePct: (change / price) * 100,
    volume: Math.floor(Math.random() * 80000000 + 5000000),
    vwap: price + (Math.random() - 0.5) * 0.5,
    bid: price - 0.01 - Math.random() * 0.05,
    ask: price + 0.01 + Math.random() * 0.05,
    bidSize: Math.floor(Math.random() * 5000 + 100),
    askSize: Math.floor(Math.random() * 5000 + 100),
    flash: null,
    sparkline: generateSparkline(),
    alert: Math.random() > 0.85 ? (Math.random() > 0.5 ? '52W HIGH' : 'HIGH VOL') : null,
  };
}

const INITIAL_SECURITIES: MonitorSecurity[] = [
  createSecurity('AAPL', 'Apple Inc', 'Technology', 189.84),
  createSecurity('MSFT', 'Microsoft Corp', 'Technology', 378.91),
  createSecurity('GOOGL', 'Alphabet Inc', 'Technology', 141.80),
  createSecurity('AMZN', 'Amazon.com', 'Consumer', 178.25),
  createSecurity('NVDA', 'NVIDIA Corp', 'Technology', 878.36),
  createSecurity('META', 'Meta Platforms', 'Technology', 505.48),
  createSecurity('TSLA', 'Tesla Inc', 'Auto', 248.42),
  createSecurity('JPM', 'JPMorgan Chase', 'Financials', 196.21),
  createSecurity('V', 'Visa Inc', 'Financials', 278.50),
  createSecurity('JNJ', 'Johnson & Johnson', 'Healthcare', 156.32),
  createSecurity('WMT', 'Walmart Inc', 'Consumer', 168.75),
  createSecurity('PG', 'Procter & Gamble', 'Consumer', 158.90),
  createSecurity('MA', 'Mastercard Inc', 'Financials', 458.20),
  createSecurity('UNH', 'UnitedHealth Group', 'Healthcare', 527.30),
  createSecurity('HD', 'Home Depot', 'Consumer', 352.45),
  createSecurity('XOM', 'Exxon Mobil', 'Energy', 104.20),
  createSecurity('BAC', 'Bank of America', 'Financials', 34.58),
  createSecurity('PFE', 'Pfizer Inc', 'Healthcare', 27.45),
  createSecurity('ABBV', 'AbbVie Inc', 'Healthcare', 170.85),
  createSecurity('KO', 'Coca-Cola Co', 'Consumer', 60.12),
];

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'ticker', label: 'TICKER', width: 80, visible: true, align: 'left' },
  { key: 'name', label: 'NAME', width: 140, visible: true, align: 'left' },
  { key: 'price', label: 'LAST', width: 85, visible: true, align: 'right' },
  { key: 'change', label: 'CHG', width: 75, visible: true, align: 'right' },
  { key: 'changePct', label: 'CHG%', width: 70, visible: true, align: 'right' },
  { key: 'volume', label: 'VOLUME', width: 90, visible: true, align: 'right' },
  { key: 'vwap', label: 'VWAP', width: 85, visible: true, align: 'right' },
  { key: 'bid', label: 'BID', width: 80, visible: true, align: 'right' },
  { key: 'ask', label: 'ASK', width: 80, visible: true, align: 'right' },
  { key: 'open', label: 'OPEN', width: 80, visible: false, align: 'right' },
  { key: 'high', label: 'HIGH', width: 80, visible: true, align: 'right' },
  { key: 'low', label: 'LOW', width: 80, visible: true, align: 'right' },
  { key: 'miniChart', label: 'CHART', width: 80, visible: true, align: 'center' },
  { key: 'sector', label: 'SECTOR', width: 100, visible: true, align: 'left' },
];

const SECTORS = ['All', 'Technology', 'Financials', 'Consumer', 'Healthcare', 'Energy', 'Auto'];

// ─── Mini Sparkline ─────────────────────────────────────────────────────────

function MiniSparkline({ data, width = 70, height = 18 }: { data: number[]; width?: number; height?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const up = data[data.length - 1] >= data[0];

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={up ? '#00cc66' : '#ff3333'}
        strokeWidth="1.2"
        points={points}
      />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MonitorGrid({ className = '', onSelectSecurity }: MonitorGridProps) {
  const [securities, setSecurities] = useState<MonitorSecurity[]>(INITIAL_SECURITIES);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState<string>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showColConfig, setShowColConfig] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulated real-time updates
  useEffect(() => {
    if (!isLive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecurities(prev =>
        prev.map(sec => {
          if (Math.random() > 0.4) return { ...sec, flash: null };
          const delta = (Math.random() - 0.48) * sec.price * 0.002;
          const newPrice = Math.max(0.01, sec.price + delta);
          const newChange = newPrice - sec.open;
          const sparkline = [...sec.sparkline.slice(1), newPrice];
          return {
            ...sec,
            prevPrice: sec.price,
            price: newPrice,
            change: newChange,
            changePct: (newChange / sec.open) * 100,
            high: Math.max(sec.high, newPrice),
            low: Math.min(sec.low, newPrice),
            volume: sec.volume + Math.floor(Math.random() * 50000),
            bid: newPrice - 0.01 - Math.random() * 0.05,
            ask: newPrice + 0.01 + Math.random() * 0.05,
            flash: delta > 0 ? 'up' : 'down',
            sparkline,
          };
        })
      );
    }, 1200);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLive]);

  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns]);

  const filtered = useMemo(() => {
    let list = securities;
    if (sectorFilter !== 'All') list = list.filter(s => s.sector === sectorFilter);
    if (searchFilter) {
      const q = searchFilter.toUpperCase();
      list = list.filter(s => s.ticker.includes(q) || s.name.toUpperCase().includes(q));
    }
    return list;
  }, [securities, sectorFilter, searchFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sortKey as keyof MonitorSecurity;
      const aVal = a[key];
      const bVal = b[key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = useCallback((key: string) => {
    if (key === 'miniChart') return;
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }, [sortKey]);

  const toggleColumn = useCallback((idx: number) => {
    setColumns(prev => prev.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c));
  }, []);

  const handleExport = useCallback(() => {
    const header = visibleCols.map(c => c.label).join(',');
    const rows = sorted.map(sec =>
      visibleCols.map(c => {
        if (c.key === 'miniChart') return '';
        const val = sec[c.key as keyof MonitorSecurity];
        if (typeof val === 'number') return val.toFixed(2);
        return String(val ?? '');
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'monitor-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [visibleCols, sorted]);

  const flashBg = (flash: FlashState) => {
    if (flash === 'up') return 'bg-[#00cc66]/10';
    if (flash === 'down') return 'bg-[#ff3333]/10';
    return '';
  };

  const formatNum = (val: number, decimals = 2) =>
    val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const formatVolume = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(v);
  };

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center gap-3">
          <span className="text-[#ff9900] font-bold text-xs tracking-wider">MONITOR</span>
          <div className="flex gap-1">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => setSectorFilter(s)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  sectorFilter === s ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555] hover:text-[#888]'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Filter..."
            className="w-28 bg-[#0a0a14] border border-[#1a1a2e] text-[#ff9900] text-[10px] px-2 py-0.5 rounded outline-none"
          />
          <button
            onClick={() => setIsLive(!isLive)}
            className={`text-[10px] px-2 py-0.5 rounded ${isLive ? 'bg-[#00cc66]/20 text-[#00cc66]' : 'bg-[#ff3333]/20 text-[#ff3333]'}`}
          >{isLive ? '● LIVE' : '○ PAUSED'}</button>
          <button
            onClick={() => setShowColConfig(!showColConfig)}
            className="text-[10px] text-[#555] hover:text-[#ff9900]"
          >COLS</button>
          <button onClick={handleExport} className="text-[10px] text-[#555] hover:text-[#ff9900]">EXPORT</button>
        </div>
      </div>

      {/* Column Config */}
      {showColConfig && (
        <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e] flex flex-wrap gap-2">
          {columns.map((col, i) => (
            <label key={col.key} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => toggleColumn(i)}
                className="accent-[#ff9900]"
              />
              <span className="text-[10px] text-[#888]">{col.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0f0f1e]">
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`border-b border-[#1a1a2e] px-2 py-1 text-[10px] text-[#555] cursor-pointer hover:text-[#ff9900] select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-0.5 text-[#ff9900]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(sec => (
              <tr
                key={sec.ticker}
                onClick={() => { setSelectedTicker(sec.ticker); onSelectSecurity?.(sec.ticker); }}
                className={`transition-colors cursor-pointer ${flashBg(sec.flash)} ${
                  selectedTicker === sec.ticker ? 'bg-[#1a1a2e]' : 'hover:bg-[#0f0f1e]'
                }`}
              >
                {visibleCols.map(col => {
                  if (col.key === 'miniChart') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-center">
                        <MiniSparkline data={sec.sparkline} />
                      </td>
                    );
                  }
                  if (col.key === 'ticker') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[#ff9900] text-xs font-bold">{sec.ticker}</span>
                          {sec.alert && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-[#ff3333]/20 text-[#ff3333] font-bold">
                              {sec.alert}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  }
                  if (col.key === 'name') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-[#888] text-[11px] truncate">
                        {sec.name}
                      </td>
                    );
                  }
                  if (col.key === 'sector') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-[#666] text-[10px]">
                        {sec.sector}
                      </td>
                    );
                  }
                  if (col.key === 'price') {
                    return (
                      <td key={col.key} className={`border-b border-[#1a1a2e]/30 px-2 py-0.5 text-right text-xs font-bold transition-colors ${
                        sec.flash === 'up' ? 'text-[#00cc66]' : sec.flash === 'down' ? 'text-[#ff3333]' : 'text-[#ccc]'
                      }`}>
                        {formatNum(sec.price)}
                      </td>
                    );
                  }
                  if (col.key === 'change') {
                    return (
                      <td key={col.key} className={`border-b border-[#1a1a2e]/30 px-2 py-0.5 text-right text-xs ${
                        sec.change >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'
                      }`}>
                        {sec.change >= 0 ? '+' : ''}{formatNum(sec.change)}
                      </td>
                    );
                  }
                  if (col.key === 'changePct') {
                    return (
                      <td key={col.key} className={`border-b border-[#1a1a2e]/30 px-2 py-0.5 text-right text-xs font-bold ${
                        sec.changePct >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'
                      }`}>
                        {sec.changePct >= 0 ? '+' : ''}{formatNum(sec.changePct)}%
                      </td>
                    );
                  }
                  if (col.key === 'volume') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-right text-[#888] text-xs">
                        {formatVolume(sec.volume)}
                      </td>
                    );
                  }

                  const numVal = sec[col.key as keyof MonitorSecurity];
                  if (typeof numVal === 'number') {
                    return (
                      <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-right text-[#ccc] text-xs">
                        {formatNum(numVal)}
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} className="border-b border-[#1a1a2e]/30 px-2 py-0.5 text-[#888] text-xs">
                      {String(numVal ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#1a1a2e] bg-[#0f0f1e] text-[10px] text-[#555]">
        <span>{sorted.length} securities{sectorFilter !== 'All' ? ` • ${sectorFilter}` : ''}</span>
        <div className="flex items-center gap-3">
          <span className="text-[#00cc66]">▲ {sorted.filter(s => s.change > 0).length}</span>
          <span className="text-[#888]">━ {sorted.filter(s => s.change === 0).length}</span>
          <span className="text-[#ff3333]">▼ {sorted.filter(s => s.change < 0).length}</span>
        </div>
      </div>
    </div>
  );
}
