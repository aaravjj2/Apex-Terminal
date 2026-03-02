import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Execution {
  id: string;
  time: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commission: number;
  venue: string;
  algo: string;
  orderId: string;
}

interface ExecutionBlotterProps {
  className?: string;
}

type SortKey = 'time' | 'symbol' | 'side' | 'quantity' | 'price' | 'commission' | 'venue';
type SortDir = 'asc' | 'desc';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const VENUES = ['NYSE', 'NASDAQ', 'ARCA', 'BATS', 'IEX', 'EDGX', 'DARK'];
const ALGOS = ['VWAP', 'TWAP', 'DMA', 'IS', 'POV', 'ARRIVAL', 'CLOSE'];
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'BAC', 'XOM'];

function genExecutions(count: number): Execution[] {
  const execs: Execution[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const side = Math.random() > 0.5 ? 'BUY' as const : 'SELL' as const;
    const basePrice = 100 + Math.random() * 600;
    const qty = Math.floor(Math.random() * 500 + 10) * 10;
    execs.push({
      id: `ex-${i}`,
      time: now - Math.floor(Math.random() * 86400000 * 5),
      symbol: sym,
      side,
      quantity: qty,
      price: +(basePrice + (Math.random() - 0.5) * 5).toFixed(2),
      commission: +(qty * 0.005 + Math.random() * 2).toFixed(2),
      venue: VENUES[Math.floor(Math.random() * VENUES.length)],
      algo: ALGOS[Math.floor(Math.random() * ALGOS.length)],
      orderId: `ORD-${1000 + i}`,
    });
  }
  return execs.sort((a, b) => b.time - a.time);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDateTime = (ts: number) => `${fmtDate(ts)} ${fmtTime(ts)}`;

// ─── Component ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function ExecutionBlotter({ className = '' }: ExecutionBlotterProps) {
  const [executions] = useState<Execution[]>(() => genExecutions(200));
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSide, setFilterSide] = useState<'' | 'BUY' | 'SELL'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [showStats, setShowStats] = useState(true);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'time' ? 'desc' : 'asc'); }
  }, [sortKey]);

  const filtered = useMemo(() => {
    let f = executions;
    if (filterSymbol) f = f.filter(e => e.symbol.toLowerCase().includes(filterSymbol.toLowerCase()));
    if (filterSide) f = f.filter(e => e.side === filterSide);
    if (dateFrom) { const d = new Date(dateFrom).getTime(); f = f.filter(e => e.time >= d); }
    if (dateTo) { const d = new Date(dateTo).getTime() + 86400000; f = f.filter(e => e.time < d); }
    return f;
  }, [executions, filterSymbol, filterSide, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  const stats = useMemo(() => {
    const bySymbol: Record<string, { buys: number; sells: number; buyVal: number; sellVal: number; buyQty: number; sellQty: number; comm: number }> = {};
    let totalComm = 0;
    let totalPnl = 0;

    for (const e of filtered) {
      if (!bySymbol[e.symbol]) bySymbol[e.symbol] = { buys: 0, sells: 0, buyVal: 0, sellVal: 0, buyQty: 0, sellQty: 0, comm: 0 };
      const s = bySymbol[e.symbol];
      s.comm += e.commission;
      totalComm += e.commission;
      if (e.side === 'BUY') { s.buys++; s.buyVal += e.price * e.quantity; s.buyQty += e.quantity; }
      else { s.sells++; s.sellVal += e.price * e.quantity; s.sellQty += e.quantity; }
    }

    for (const sym in bySymbol) {
      const s = bySymbol[sym];
      const avgBuy = s.buyQty > 0 ? s.buyVal / s.buyQty : 0;
      const avgSell = s.sellQty > 0 ? s.sellVal / s.sellQty : 0;
      const minQty = Math.min(s.buyQty, s.sellQty);
      if (avgBuy > 0 && avgSell > 0) totalPnl += (avgSell - avgBuy) * minQty;
    }

    const avgFillBySymbol: Record<string, { avgBuy: number; avgSell: number }> = {};
    for (const sym in bySymbol) {
      const s = bySymbol[sym];
      avgFillBySymbol[sym] = {
        avgBuy: s.buyQty > 0 ? s.buyVal / s.buyQty : 0,
        avgSell: s.sellQty > 0 ? s.sellVal / s.sellQty : 0,
      };
    }

    return { totalComm, totalPnl, bySymbol, avgFillBySymbol, totalFills: filtered.length };
  }, [filtered]);

  const handleExport = useCallback((format: 'csv' | 'tsv') => {
    const sep = format === 'csv' ? ',' : '\t';
    const header = ['Time', 'Symbol', 'Side', 'Qty', 'Price', 'Commission', 'Venue', 'Algo', 'OrderID'].join(sep);
    const rows = sorted.map(e =>
      [fmtDateTime(e.time), e.symbol, e.side, e.quantity, e.price, e.commission, e.venue, e.algo, e.orderId].join(sep)
    );
    const content = [header, ...rows].join('\n');
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executions_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  const SortHeader = ({ label, field, align = 'left' }: { label: string; field: SortKey; align?: string }) => (
    <button onClick={() => handleSort(field)} className={`text-${align} text-[10px] uppercase tracking-wider ${sortKey === field ? 'text-amber-400' : 'text-gray-500'} hover:text-amber-300`}>
      {label} {sortKey === field && (sortDir === 'asc' ? '↑' : '↓')}
    </button>
  );

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">Executions</span>
          <span className="text-gray-500">({filtered.length} fills)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowStats(s => !s)} className={`px-1.5 py-0.5 rounded text-[10px] border ${showStats ? 'bg-amber-600/20 text-amber-400 border-amber-700/30' : 'bg-[#12121f] text-gray-500 border-gray-800/50'}`}>Stats</button>
          <button onClick={() => handleExport('csv')} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">CSV</button>
          <button onClick={() => handleExport('tsv')} className="px-1.5 py-0.5 rounded text-[10px] bg-[#12121f] text-gray-500 border border-gray-800/50 hover:text-amber-400">TSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/30 bg-[#0c0c18] flex-wrap">
        <input
          type="text"
          placeholder="Symbol..."
          value={filterSymbol}
          onChange={e => { setFilterSymbol(e.target.value); setPage(0); }}
          className="w-20 bg-[#12121f] border border-gray-800/50 rounded px-2 py-0.5 text-amber-300 text-[10px] placeholder-gray-600 focus:outline-none focus:border-amber-600/50"
        />
        <select value={filterSide} onChange={e => { setFilterSide(e.target.value as '' | 'BUY' | 'SELL'); setPage(0); }} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none">
          <option value="">All Sides</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <span className="text-gray-600 text-[10px]">From:</span>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none" />
        <span className="text-gray-600 text-[10px]">To:</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none" />
        {(filterSymbol || filterSide || dateFrom || dateTo) && (
          <button onClick={() => { setFilterSymbol(''); setFilterSide(''); setDateFrom(''); setDateTo(''); setPage(0); }} className="text-amber-500 text-[10px] hover:text-amber-300">Clear</button>
        )}
      </div>

      {/* Stats Panel */}
      {showStats && (
        <div className="grid grid-cols-4 gap-3 px-3 py-2 border-b border-gray-800/30 bg-[#0c0c18] text-[10px]">
          <div>
            <span className="text-gray-500">Total Fills</span>
            <p className="text-amber-300 text-sm font-bold">{stats.totalFills}</p>
          </div>
          <div>
            <span className="text-gray-500">Commission</span>
            <p className="text-orange-400 text-sm font-bold">{fmtUsd(stats.totalComm)}</p>
          </div>
          <div>
            <span className="text-gray-500">Est. P&L</span>
            <p className={`text-sm font-bold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtUsd(stats.totalPnl)}</p>
          </div>
          <div>
            <span className="text-gray-500">Avg Fill Symbols</span>
            <div className="mt-0.5 space-y-0.5">
              {Object.entries(stats.avgFillBySymbol).slice(0, 3).map(([sym, avg]) => (
                <div key={sym} className="flex justify-between">
                  <span className="text-gray-400">{sym}</span>
                  <span className="text-gray-300">B:{avg.avgBuy.toFixed(2)} S:{avg.avgSell.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-[100px_55px_40px_55px_70px_60px_50px_50px_70px] gap-1 px-2 py-1 border-b border-gray-800/30">
        <SortHeader label="Time" field="time" />
        <SortHeader label="Symbol" field="symbol" />
        <SortHeader label="Side" field="side" />
        <SortHeader label="Qty" field="quantity" align="right" />
        <SortHeader label="Price" field="price" align="right" />
        <SortHeader label="Comm" field="commission" align="right" />
        <SortHeader label="Venue" field="venue" />
        <span className="text-gray-500 text-[10px]">Algo</span>
        <span className="text-gray-500 text-[10px]">Order</span>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '400px' }}>
        {pageData.map(e => (
          <div key={e.id} className="grid grid-cols-[100px_55px_40px_55px_70px_60px_50px_50px_70px] gap-1 px-2 py-1 hover:bg-[#12121f] border-b border-gray-800/10 transition-colors">
            <span className="text-gray-500 font-mono">{fmtDateTime(e.time)}</span>
            <span className="text-amber-300 font-medium">{e.symbol}</span>
            <span className={e.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{e.side}</span>
            <span className="text-right text-gray-300 font-mono tabular-nums">{e.quantity.toLocaleString()}</span>
            <span className="text-right text-gray-300 font-mono tabular-nums">{fmtUsd(e.price)}</span>
            <span className="text-right text-orange-400/70 font-mono tabular-nums">{fmtUsd(e.commission)}</span>
            <span className="text-gray-500">{e.venue}</span>
            <span className="text-gray-500">{e.algo}</span>
            <span className="text-gray-600 font-mono text-[9px]">{e.orderId}</span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-900/20 bg-[#0d0d1a] text-[10px]">
        <span className="text-gray-500">
          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(0)} disabled={page === 0} className="px-1.5 py-0.5 bg-[#12121f] text-gray-400 rounded border border-gray-800/50 disabled:opacity-30 hover:text-amber-400">⟨⟨</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-1.5 py-0.5 bg-[#12121f] text-gray-400 rounded border border-gray-800/50 disabled:opacity-30 hover:text-amber-400">⟨</button>
          <span className="text-gray-400 px-2">{page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-1.5 py-0.5 bg-[#12121f] text-gray-400 rounded border border-gray-800/50 disabled:opacity-30 hover:text-amber-400">⟩</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-1.5 py-0.5 bg-[#12121f] text-gray-400 rounded border border-gray-800/50 disabled:opacity-30 hover:text-amber-400">⟩⟩</button>
        </div>
      </div>
    </div>
  );
}
