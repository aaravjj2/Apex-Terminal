import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Position {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  weight: number;
  pnlHistory: number[];
  openDate: string;
}

interface PositionManagerProps {
  className?: string;
  onClosePosition?: (id: string) => void;
  onModifyPosition?: (id: string, action: string, value?: number) => void;
}

type SortKey = keyof Pick<Position, 'symbol' | 'unrealizedPnl' | 'unrealizedPnlPct' | 'marketValue' | 'weight' | 'quantity'>;
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'sector' | 'side';

// ─── Mock Data ──────────────────────────────────────────────────────────────

function genHistory(): number[] {
  const pts: number[] = [];
  let v = 0;
  for (let i = 0; i < 30; i++) { v += (Math.random() - 0.48) * 50; pts.push(v); }
  return pts;
}

const MOCK_POSITIONS: Position[] = [
  { id: 'p1', symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', side: 'LONG', quantity: 500, entryPrice: 178.50, currentPrice: 189.84, marketValue: 94920, unrealizedPnl: 5670, unrealizedPnlPct: 6.35, realizedPnl: 1200, stopLoss: 175.00, takeProfit: 200.00, weight: 18.5, pnlHistory: genHistory(), openDate: '2025-11-15' },
  { id: 'p2', symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', side: 'LONG', quantity: 200, entryPrice: 365.20, currentPrice: 378.91, marketValue: 75782, unrealizedPnl: 2742, unrealizedPnlPct: 3.75, realizedPnl: 800, stopLoss: 355.00, takeProfit: 400.00, weight: 14.8, pnlHistory: genHistory(), openDate: '2025-12-02' },
  { id: 'p3', symbol: 'TSLA', name: 'Tesla Inc', sector: 'Consumer Disc.', side: 'SHORT', quantity: 100, entryPrice: 255.00, currentPrice: 248.30, marketValue: 24830, unrealizedPnl: 670, unrealizedPnlPct: 2.63, realizedPnl: -350, stopLoss: 265.00, takeProfit: 230.00, weight: 4.8, pnlHistory: genHistory(), openDate: '2026-01-10' },
  { id: 'p4', symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', side: 'LONG', quantity: 300, entryPrice: 720.00, currentPrice: 695.40, marketValue: 208620, unrealizedPnl: -7380, unrealizedPnlPct: -3.42, realizedPnl: 5600, stopLoss: 680.00, takeProfit: 800.00, weight: 40.7, pnlHistory: genHistory(), openDate: '2025-10-20' },
  { id: 'p5', symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', side: 'LONG', quantity: 150, entryPrice: 192.00, currentPrice: 198.75, marketValue: 29812.50, unrealizedPnl: 1012.50, unrealizedPnlPct: 3.52, realizedPnl: 450, stopLoss: 185.00, takeProfit: 215.00, weight: 5.8, pnlHistory: genHistory(), openDate: '2026-01-05' },
  { id: 'p6', symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer Disc.', side: 'LONG', quantity: 80, entryPrice: 175.40, currentPrice: 182.10, marketValue: 14568, unrealizedPnl: 536, unrealizedPnlPct: 3.82, realizedPnl: 200, stopLoss: 168.00, takeProfit: 195.00, weight: 2.8, pnlHistory: genHistory(), openDate: '2026-02-01' },
  { id: 'p7', symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', side: 'SHORT', quantity: 250, entryPrice: 108.50, currentPrice: 112.30, marketValue: 28075, unrealizedPnl: -950, unrealizedPnlPct: -3.50, realizedPnl: -120, stopLoss: 115.00, takeProfit: 98.00, weight: 5.5, pnlHistory: genHistory(), openDate: '2026-01-20' },
  { id: 'p8', symbol: 'META', name: 'Meta Platforms', sector: 'Technology', side: 'LONG', quantity: 60, entryPrice: 510.00, currentPrice: 525.80, marketValue: 31548, unrealizedPnl: 948, unrealizedPnlPct: 3.10, realizedPnl: 1500, stopLoss: 490.00, takeProfit: 560.00, weight: 6.2, pnlHistory: genHistory(), openDate: '2025-12-18' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const pnlColor = (n: number) => n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-400';

function MiniPnlChart({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60, h = 20;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const lastVal = data[data.length - 1];
  const color = lastVal >= 0 ? '#34d399' : '#f87171';
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PositionManager({
  className = '',
  onClosePosition,
  onModifyPosition,
}: PositionManagerProps) {
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [sortKey, setSortKey] = useState<SortKey>('unrealizedPnl');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editSL, setEditSL] = useState<{ id: string; val: string } | null>(null);
  const [editTP, setEditTP] = useState<{ id: string; val: string } | null>(null);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => { if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return key; });
    setSortKey(key);
  }, []);

  const sorted = useMemo(() => {
    const s = [...positions].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return s;
  }, [positions, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { All: sorted };
    const g: Record<string, Position[]> = {};
    for (const p of sorted) {
      const key = groupBy === 'sector' ? p.sector : p.side;
      (g[key] ??= []).push(p);
    }
    return g;
  }, [sorted, groupBy]);

  const totals = useMemo(() => ({
    marketValue: positions.reduce((s, p) => s + p.marketValue, 0),
    unrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
    realizedPnl: positions.reduce((s, p) => s + p.realizedPnl, 0),
  }), [positions]);

  const handleClose = useCallback((id: string) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    onClosePosition?.(id);
  }, [onClosePosition]);

  const handleReduce = useCallback((id: string) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.max(1, Math.floor(p.quantity / 2)), marketValue: p.currentPrice * Math.floor(p.quantity / 2), weight: p.weight / 2 } : p));
    onModifyPosition?.(id, 'reduce');
  }, [onModifyPosition]);

  const handleReverse = useCallback((id: string) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, side: p.side === 'LONG' ? 'SHORT' : 'LONG', entryPrice: p.currentPrice, unrealizedPnl: 0, unrealizedPnlPct: 0 } : p));
    onModifyPosition?.(id, 'reverse');
  }, [onModifyPosition]);

  const handleDouble = useCallback((id: string) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, quantity: p.quantity * 2, marketValue: p.marketValue * 2, weight: Math.min(100, p.weight * 2) } : p));
    onModifyPosition?.(id, 'add');
  }, [onModifyPosition]);

  const handleSetSL = useCallback((id: string, val: number) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, stopLoss: val } : p));
    setEditSL(null);
  }, []);

  const handleSetTP = useCallback((id: string, val: number) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, takeProfit: val } : p));
    setEditTP(null);
  }, []);

  const handleDragStart = useCallback((id: string) => setDragId(id), []);
  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setPositions(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(p => p.id === dragId);
      const toIdx = arr.findIndex(p => p.id === targetId);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragId(null);
  }, [dragId]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button onClick={() => handleSort(field)} className={`text-left text-[10px] uppercase tracking-wider ${sortKey === field ? 'text-amber-400' : 'text-gray-500'} hover:text-amber-300`}>
      {label} {sortKey === field && (sortDir === 'asc' ? '↑' : '↓')}
    </button>
  );

  return (
    <div className={`bg-[#0a0a14] border border-amber-900/30 rounded text-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/20 bg-[#0d0d1a]">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm">Positions</span>
          <span className="text-gray-500">({positions.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[10px]">Group:</span>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className="bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-gray-400 text-[10px] focus:outline-none">
            <option value="none">None</option>
            <option value="sector">Sector</option>
            <option value="side">Side</option>
          </select>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-800/30 bg-[#0c0c18] text-[10px]">
        <span className="text-gray-500">MV: <span className="text-amber-300">{fmtUsd(totals.marketValue)}</span></span>
        <span className="text-gray-500">Unr P&L: <span className={pnlColor(totals.unrealizedPnl)}>{fmtUsd(totals.unrealizedPnl)}</span></span>
        <span className="text-gray-500">Rlz P&L: <span className={pnlColor(totals.realizedPnl)}>{fmtUsd(totals.realizedPnl)}</span></span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[50px_120px_60px_70px_80px_80px_70px_60px_50px] gap-1 px-2 py-1 border-b border-gray-800/30">
        <SortHeader label="Sym" field="symbol" />
        <span className="text-gray-500 text-[10px]">Name</span>
        <SortHeader label="Qty" field="quantity" />
        <span className="text-gray-500 text-[10px]">Entry</span>
        <SortHeader label="Mkt Val" field="marketValue" />
        <SortHeader label="Unr P&L" field="unrealizedPnl" />
        <SortHeader label="P&L %" field="unrealizedPnlPct" />
        <SortHeader label="Wt%" field="weight" />
        <span className="text-gray-500 text-[10px]">Chart</span>
      </div>

      {/* Position Rows */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '450px' }}>
        {Object.entries(grouped).map(([group, items]) => (
          <React.Fragment key={group}>
            {groupBy !== 'none' && (
              <div className="px-2 py-1 bg-[#0d0d1a] border-b border-gray-800/30 text-[10px] text-amber-500 font-medium uppercase tracking-wider">
                {group} <span className="text-gray-600">({items.length})</span>
              </div>
            )}
            {items.map(p => (
              <React.Fragment key={p.id}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(p.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(p.id)}
                  onClick={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                  className={`grid grid-cols-[50px_120px_60px_70px_80px_80px_70px_60px_50px] gap-1 px-2 py-1.5 cursor-pointer hover:bg-[#12121f] border-b border-gray-800/20 transition-colors ${dragId === p.id ? 'opacity-50' : ''}`}
                >
                  <span className="text-amber-300 font-medium">{p.symbol}</span>
                  <span className="text-gray-500 truncate">{p.name}</span>
                  <span className={`${p.side === 'LONG' ? 'text-blue-400' : 'text-orange-400'}`}>
                    {p.side === 'SHORT' ? '-' : ''}{p.quantity}
                  </span>
                  <span className="text-gray-400 font-mono tabular-nums">{p.entryPrice.toFixed(2)}</span>
                  <span className="text-gray-300 font-mono tabular-nums">{fmtUsd(p.marketValue)}</span>
                  <span className={`font-mono tabular-nums ${pnlColor(p.unrealizedPnl)}`}>{fmtUsd(p.unrealizedPnl)}</span>
                  <span className={`font-mono tabular-nums ${pnlColor(p.unrealizedPnlPct)}`}>{fmtPct(p.unrealizedPnlPct)}</span>
                  <span className="text-gray-400">{p.weight.toFixed(1)}%</span>
                  <MiniPnlChart data={p.pnlHistory} />
                </div>

                {/* Expanded Detail */}
                {expandedId === p.id && (
                  <div className="bg-[#0c0c18] border-b border-amber-900/20 px-3 py-2 space-y-2">
                    <div className="grid grid-cols-4 gap-3 text-[10px]">
                      <div><span className="text-gray-500">Current</span><br /><span className="text-amber-300">${p.currentPrice.toFixed(2)}</span></div>
                      <div><span className="text-gray-500">Realized P&L</span><br /><span className={pnlColor(p.realizedPnl)}>{fmtUsd(p.realizedPnl)}</span></div>
                      <div><span className="text-gray-500">Opened</span><br /><span className="text-gray-300">{p.openDate}</span></div>
                      <div><span className="text-gray-500">Sector</span><br /><span className="text-gray-300">{p.sector}</span></div>
                    </div>

                    {/* SL / TP Inline Edit */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="text-red-400 w-6">SL:</span>
                        {editSL?.id === p.id ? (
                          <input autoFocus type="number" step="0.01" value={editSL.val} onChange={e => setEditSL({ id: p.id, val: e.target.value })} onBlur={() => handleSetSL(p.id, parseFloat(editSL.val) || 0)} onKeyDown={e => e.key === 'Enter' && handleSetSL(p.id, parseFloat(editSL.val) || 0)} className="w-20 bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-red-300 text-right focus:outline-none" />
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setEditSL({ id: p.id, val: String(p.stopLoss ?? '') }); }} className="text-red-400/70 hover:text-red-300">
                            {p.stopLoss ? `$${p.stopLoss.toFixed(2)}` : 'Set'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 w-6">TP:</span>
                        {editTP?.id === p.id ? (
                          <input autoFocus type="number" step="0.01" value={editTP.val} onChange={e => setEditTP({ id: p.id, val: e.target.value })} onBlur={() => handleSetTP(p.id, parseFloat(editTP.val) || 0)} onKeyDown={e => e.key === 'Enter' && handleSetTP(p.id, parseFloat(editTP.val) || 0)} className="w-20 bg-[#12121f] border border-gray-800/50 rounded px-1 py-0.5 text-emerald-300 text-right focus:outline-none" />
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setEditTP({ id: p.id, val: String(p.takeProfit ?? '') }); }} className="text-emerald-400/70 hover:text-emerald-300">
                            {p.takeProfit ? `$${p.takeProfit.toFixed(2)}` : 'Set'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={() => handleClose(p.id)} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-[10px] hover:bg-red-800/40 border border-red-800/30">Close</button>
                      <button onClick={() => handleReduce(p.id)} className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-[10px] hover:bg-orange-800/40 border border-orange-800/30">Reduce 50%</button>
                      <button onClick={() => handleReverse(p.id)} className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-[10px] hover:bg-purple-800/40 border border-purple-800/30">Reverse</button>
                      <button onClick={() => handleDouble(p.id)} className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-[10px] hover:bg-blue-800/40 border border-blue-800/30">Add 2×</button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-900/20 bg-[#0d0d1a] text-[10px]">
        <span className="text-gray-500">Long: <span className="text-blue-400">{positions.filter(p => p.side === 'LONG').length}</span></span>
        <span className="text-gray-500">Short: <span className="text-orange-400">{positions.filter(p => p.side === 'SHORT').length}</span></span>
        <span className="text-gray-500">Total P&L: <span className={pnlColor(totals.unrealizedPnl + totals.realizedPnl)}>{fmtUsd(totals.unrealizedPnl + totals.realizedPnl)}</span></span>
      </div>
    </div>
  );
}
