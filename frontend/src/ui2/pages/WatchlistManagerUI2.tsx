/**
 * WatchlistManagerUI2.tsx — Bloomberg MOST / TradingView Watchlist
 * ================================================================
 * Multi-watchlist manager with:
 * - Multiple named watchlists
 * - Real-time quote tiles with mini sparklines
 * - Drag-and-drop reorder (simulated)
 * - Symbol search / add with autocomplete
 * - Alert integration per symbol
 * - Custom columns & grouping
 * - Canvas portfolio heat strip
 * - Bloomberg dark theme
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLiveQuotes } from '../lib/liveQuoteStore';

// ── Theme ────────────────────────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Watchlist types ──────────────────────────────────────────────────────────
interface WatchlistSymbol {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  pe: number;
  divYield: number;
  high52w: number;
  low52w: number;
  sparkline: number[];
  alert?: { type: 'above' | 'below'; price: number };
  notes?: string;
}

interface Watchlist {
  id: string;
  name: string;
  icon: string;
  symbols: WatchlistSymbol[];
  createdAt: string;
  color: string;
}

/** Placeholder row — prices filled by live API poll. */
function skeletonSym(symbol: string, name: string): WatchlistSymbol {
  return {
    symbol,
    name,
    price: 0,
    change: 0,
    changePct: 0,
    volume: 0,
    marketCap: 0,
    pe: 0,
    divYield: 0,
    high52w: 0,
    low52w: 0,
    sparkline: Array(40).fill(0),
  };
}

const DEFAULT_WATCHLISTS: Watchlist[] = [
  {
    id: 'tech-mega',
    name: 'Tech Megacaps',
    icon: '💻',
    color: '#3b82f6',
    createdAt: '2024-01-15',
    symbols: [
      skeletonSym('AAPL', 'Apple Inc'),
      skeletonSym('MSFT', 'Microsoft Corp'),
      skeletonSym('GOOGL', 'Alphabet Inc'),
      skeletonSym('AMZN', 'Amazon.com'),
      skeletonSym('NVDA', 'NVIDIA Corp'),
      skeletonSym('META', 'Meta Platforms'),
      skeletonSym('TSLA', 'Tesla Inc'),
    ],
  },
  {
    id: 'fin-leaders',
    name: 'Financial Leaders',
    icon: '🏦',
    color: '#10b981',
    createdAt: '2024-02-01',
    symbols: [
      skeletonSym('JPM', 'JPMorgan Chase'),
      skeletonSym('BAC', 'Bank of America'),
      skeletonSym('GS', 'Goldman Sachs'),
      skeletonSym('MS', 'Morgan Stanley'),
      skeletonSym('V', 'Visa Inc'),
      skeletonSym('MA', 'Mastercard'),
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: '🏥',
    color: '#f59e0b',
    createdAt: '2024-02-15',
    symbols: [
      skeletonSym('UNH', 'UnitedHealth'),
      skeletonSym('JNJ', 'Johnson & Johnson'),
      skeletonSym('LLY', 'Eli Lilly'),
      skeletonSym('PFE', 'Pfizer Inc'),
      skeletonSym('ABBV', 'AbbVie Inc'),
      skeletonSym('MRK', 'Merck & Co'),
      skeletonSym('TMO', 'Thermo Fisher'),
    ],
  },
  {
    id: 'high-div',
    name: 'High Dividend',
    icon: '💰',
    color: '#8b5cf6',
    createdAt: '2024-03-01',
    symbols: [
      skeletonSym('T', 'AT&T Inc'),
      skeletonSym('VZ', 'Verizon'),
      skeletonSym('XOM', 'Exxon Mobil'),
      skeletonSym('CVX', 'Chevron Corp'),
      skeletonSym('KO', 'Coca-Cola'),
      skeletonSym('PEP', 'PepsiCo'),
    ],
  },
  {
    id: 'custom-1',
    name: 'My Positions',
    icon: '📊',
    color: '#ec4899',
    createdAt: '2024-03-15',
    symbols: [
      skeletonSym('AAPL', 'Apple Inc'),
      skeletonSym('NVDA', 'NVIDIA Corp'),
      skeletonSym('AMD', 'AMD Inc'),
      skeletonSym('COST', 'Costco'),
      skeletonSym('NFLX', 'Netflix'),
    ],
  },
];

// ── Symbol lookup for add ────────────────────────────────────────────────────
const ALL_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc' },
  { symbol: 'MSFT', name: 'Microsoft Corp' },
  { symbol: 'GOOGL', name: 'Alphabet Inc' },
  { symbol: 'AMZN', name: 'Amazon.com' },
  { symbol: 'NVDA', name: 'NVIDIA Corp' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'TSLA', name: 'Tesla Inc' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'V', name: 'Visa Inc' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'HD', name: 'Home Depot' },
  { symbol: 'AVGO', name: 'Broadcom Inc' },
  { symbol: 'PFE', name: 'Pfizer Inc' },
  { symbol: 'COST', name: 'Costco' },
  { symbol: 'ABT', name: 'Abbott Labs' },
  { symbol: 'CVX', name: 'Chevron Corp' },
  { symbol: 'KO', name: 'Coca-Cola' },
  { symbol: 'PEP', name: 'PepsiCo' },
  { symbol: 'TMO', name: 'Thermo Fisher' },
  { symbol: 'BAC', name: 'Bank of America' },
  { symbol: 'ABBV', name: 'AbbVie Inc' },
  { symbol: 'CRM', name: 'Salesforce' },
  { symbol: 'AMD', name: 'AMD Inc' },
  { symbol: 'ORCL', name: 'Oracle Corp' },
  { symbol: 'NKE', name: 'Nike Inc' },
  { symbol: 'MRK', name: 'Merck & Co' },
  { symbol: 'DIS', name: 'Walt Disney' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'ADBE', name: 'Adobe Inc' },
  { symbol: 'INTC', name: 'Intel Corp' },
  { symbol: 'GS', name: 'Goldman Sachs' },
  { symbol: 'MS', name: 'Morgan Stanley' },
  { symbol: 'QCOM', name: 'Qualcomm' },
  { symbol: 'T', name: 'AT&T Inc' },
  { symbol: 'VZ', name: 'Verizon' },
  { symbol: 'WMT', name: 'Walmart' },
  { symbol: 'SHOP', name: 'Shopify' },
  { symbol: 'SQ', name: 'Block Inc' },
  { symbol: 'SNOW', name: 'Snowflake' },
  { symbol: 'PLTR', name: 'Palantir' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'UBER', name: 'Uber Tech' },
  { symbol: 'ABNB', name: 'Airbnb' },
  { symbol: 'CAT', name: 'Caterpillar' },
];

// ── Sparkline canvas ─────────────────────────────────────────────────────────
function MiniSparkline({ data, positive, width = 60, height = 20 }: { data: number[]; positive: boolean; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || data.length < 2) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    ctx.beginPath();
    ctx.strokeStyle = positive ? GREEN : RED;
    ctx.lineWidth = 1;
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - mn) / rng) * (height - 2) - 1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data, positive, width, height]);
  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Heat strip canvas ────────────────────────────────────────────────────────
function HeatStrip({ symbols, width = 600 }: { symbols: WatchlistSymbol[]; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = 28;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || symbols.length === 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const total = symbols.reduce((a, s) => a + s.marketCap, 0);
    let x = 0;
    symbols.forEach(s => {
      const w = (s.marketCap / total) * width;
      const intensity = Math.min(Math.abs(s.changePct) / 5, 1);
      if (s.changePct >= 0) {
        ctx.fillStyle = `rgba(38,166,154,${0.2 + intensity * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(239,83,80,${0.2 + intensity * 0.6})`;
      }
      ctx.fillRect(x, 0, w - 1, height);
      if (w > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.symbol, x + w / 2, height / 2 + 3);
      }
      x += w;
    });
  }, [symbols, width]);

  return <canvas ref={ref} style={{ width, height, borderRadius: 3 }} />;
}

// ── View modes ───────────────────────────────────────────────────────────────
type ViewMode = 'table' | 'tiles' | 'compact';

// ── Live price hook ───────────────────────────────────────────────────────────
/**
 * Live prices via WebSocket-backed liveQuoteStore (REST fallback inside).
 */
function useWatchlistPrices(symbols: string[]) {
  const map = useLiveQuotes(symbols.slice(0, 20));
  const out: Record<string, { price: number; change: number; changePct: number }> = {};
  for (const [sym, q] of Object.entries(map)) {
    out[sym] = { price: q.price, change: q.change, changePct: q.changePct };
  }
  return out;
}

export default function WatchlistManagerUI2() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(DEFAULT_WATCHLISTS);
  const [activeWLId, setActiveWLId] = useState(DEFAULT_WATCHLISTS[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [addInput, setAddInput] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [sortKey, setSortKey] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const addInputRef = useRef<HTMLInputElement>(null);

  const activeWL = useMemo(() => watchlists.find(w => w.id === activeWLId), [watchlists, activeWLId]);
  const symbols = activeWL?.symbols || [];

  // Fetch live prices from the API; falls back to the random values in WatchlistSymbol
  const livePrices = useWatchlistPrices(symbols.map(s => s.symbol));

  // ── Autocomplete suggestions ──
  const suggestions = useMemo(() => {
    if (!addInput) return [];
    const q = addInput.toUpperCase();
    const existing = new Set(symbols.map(s => s.symbol));
    return ALL_SYMBOLS
      .filter(s => !existing.has(s.symbol) && (s.symbol.includes(q) || s.name.toUpperCase().includes(q)))
      .slice(0, 8);
  }, [addInput, symbols]);

  // ── Sorted symbols ──
  const sortedSymbols = useMemo(() => {
    return [...symbols].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [symbols, sortKey, sortDir]);

  // ── Stats ──
  const stats = useMemo(() => {
    if (symbols.length === 0) return { totalMcap: 0, avgChange: 0, gainers: 0, losers: 0 };
    return {
      totalMcap: symbols.reduce((a, s) => a + s.marketCap, 0),
      avgChange: symbols.reduce((a, s) => a + s.changePct, 0) / symbols.length,
      gainers: symbols.filter(s => s.changePct >= 0).length,
      losers: symbols.filter(s => s.changePct < 0).length,
    };
  }, [symbols]);

  // ── Add symbol ──
  const addSymbol = useCallback((sym: { symbol: string; name: string }) => {
    setWatchlists(prev => prev.map(w =>
      w.id === activeWLId
        ? { ...w, symbols: [...w.symbols, skeletonSym(sym.symbol, sym.name)] }
        : w
    ));
    setAddInput('');
    setShowAddDropdown(false);
  }, [activeWLId]);

  // ── Remove symbol ──
  const removeSymbol = useCallback((symbol: string) => {
    setWatchlists(prev => prev.map(w =>
      w.id === activeWLId
        ? { ...w, symbols: w.symbols.filter(s => s.symbol !== symbol) }
        : w
    ));
  }, [activeWLId]);

  // ── Create new watchlist ──
  const createWatchlist = useCallback(() => {
    const id = `wl-${Date.now()}`;
    const newWL: Watchlist = {
      id,
      name: 'New Watchlist',
      icon: '⭐',
      color: '#6366f1',
      createdAt: new Date().toISOString().slice(0, 10),
      symbols: [],
    };
    setWatchlists(prev => [...prev, newWL]);
    setActiveWLId(id);
  }, []);

  // ── Delete watchlist ──
  const deleteWatchlist = useCallback((id: string) => {
    setWatchlists(prev => {
      const next = prev.filter(w => w.id !== id);
      if (activeWLId === id && next.length > 0) setActiveWLId(next[0].id);
      return next;
    });
  }, [activeWLId]);

  // ── Rename watchlist ──
  const finishRename = useCallback(() => {
    if (editingName && editNameVal.trim()) {
      setWatchlists(prev => prev.map(w =>
        w.id === editingName ? { ...w, name: editNameVal.trim() } : w
      ));
    }
    setEditingName(null);
  }, [editingName, editNameVal]);

  // ── Set alert ──
  const setAlert = useCallback(() => {
    if (!alertModal || !alertPrice) return;
    setWatchlists(prev => prev.map(w =>
      w.id === activeWLId
        ? {
          ...w,
          symbols: w.symbols.map(s =>
            s.symbol === alertModal
              ? { ...s, alert: { type: alertType, price: parseFloat(alertPrice) } }
              : s
          ),
        }
        : w
    ));
    setAlertModal(null);
    setAlertPrice('');
  }, [activeWLId, alertModal, alertPrice, alertType]);

  // ── Move symbol ──
  const moveSymbol = useCallback((symbol: string, direction: 'up' | 'down') => {
    setWatchlists(prev => prev.map(w => {
      if (w.id !== activeWLId) return w;
      const idx = w.symbols.findIndex(s => s.symbol === symbol);
      if (idx < 0) return w;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= w.symbols.length) return w;
      const next = [...w.symbols];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return { ...w, symbols: next };
    }));
  }, [activeWLId]);

  // ── Handle sort ──
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }, [sortKey]);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* ── Left: Watchlist list ── */}
      <div style={{
        width: 200,
        background: PANEL,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 10, textTransform: 'uppercase' }}>
            WATCHLISTS
          </span>
          <button
            style={{
              background: 'transparent',
              border: `1px solid ${AMBER}`,
              color: AMBER,
              padding: '2px 6px',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: '"Roboto Mono", monospace',
            }}
            onClick={createWatchlist}
          >
            + NEW
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {watchlists.map(wl => (
            <div
              key={wl.id}
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${BORDER}`,
                background: activeWLId === wl.id ? 'rgba(245,166,35,0.08)' : 'transparent',
                cursor: 'pointer',
                borderLeft: `3px solid ${activeWLId === wl.id ? wl.color : 'transparent'}`,
              }}
              onClick={() => setActiveWLId(wl.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingName === wl.id ? (
                  <input
                    style={{
                      background: '#0d0d0d',
                      border: `1px solid ${AMBER}`,
                      borderRadius: 2,
                      color: TEXT,
                      padding: '1px 4px',
                      fontSize: 10,
                      fontFamily: '"Roboto Mono", monospace',
                      width: 100,
                      outline: 'none',
                    }}
                    value={editNameVal}
                    onChange={e => setEditNameVal(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={e => e.key === 'Enter' && finishRename()}
                    autoFocus
                  />
                ) : (
                  <span
                    style={{ color: activeWLId === wl.id ? AMBER : TEXT, fontSize: 10 }}
                    onDoubleClick={() => { setEditingName(wl.id); setEditNameVal(wl.name); }}
                  >
                    {wl.icon} {wl.name}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ color: MUTED, fontSize: 9 }}>{wl.symbols.length}</span>
                  {watchlists.length > 1 && (
                    <span
                      style={{ color: RED, fontSize: 9, cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); deleteWatchlist(wl.id); }}
                    >
                      ✕
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick stats at bottom */}
        <div style={{
          padding: '8px 12px',
          borderTop: `1px solid ${BORDER}`,
          fontSize: 9,
        }}>
          <div style={{ color: MUTED, marginBottom: 4 }}>TOTAL WATCHLISTS: {watchlists.length}</div>
          <div style={{ color: MUTED }}>
            TOTAL SYMBOLS: {watchlists.reduce((a, w) => a + w.symbols.length, 0)}
          </div>
        </div>
      </div>

      {/* ── Right: Active watchlist ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          background: PANEL,
          borderBottom: `1px solid ${BORDER}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: AMBER, fontWeight: 700, fontSize: 12 }}>
            {activeWL?.icon} {activeWL?.name}
          </span>
          <span style={{ color: MUTED, fontSize: 10 }}>{symbols.length} symbols</span>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginLeft: 16 }}>
            <span style={{ fontSize: 9, color: MUTED }}>
              MCap: <span style={{ color: TEXT }}>${(stats.totalMcap / 1000).toFixed(1)}T</span>
            </span>
            <span style={{ fontSize: 9, color: MUTED }}>
              Avg Chg: <span style={{ color: stats.avgChange >= 0 ? GREEN : RED }}>
                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
              </span>
            </span>
            <span style={{ fontSize: 9, color: GREEN }}>▲ {stats.gainers}</span>
            <span style={{ fontSize: 9, color: RED }}>▼ {stats.losers}</span>
          </div>

          {/* View mode */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['table', 'tiles', 'compact'] as ViewMode[]).map(m => (
              <button
                key={m}
                style={{
                  background: viewMode === m ? 'rgba(245,166,35,0.15)' : 'transparent',
                  border: `1px solid ${viewMode === m ? AMBER : BORDER}`,
                  color: viewMode === m ? AMBER : MUTED,
                  padding: '3px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 9,
                  fontFamily: '"Roboto Mono", monospace',
                  textTransform: 'uppercase',
                }}
                onClick={() => setViewMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Add symbol */}
          <div style={{ position: 'relative' }}>
            <input
              ref={addInputRef}
              style={{
                background: '#0d0d0d',
                border: `1px solid ${BORDER}`,
                borderRadius: 3,
                color: TEXT,
                padding: '4px 10px',
                fontSize: 10,
                fontFamily: '"Roboto Mono", monospace',
                width: 150,
                outline: 'none',
              }}
              placeholder="+ Add symbol..."
              value={addInput}
              onChange={e => { setAddInput(e.target.value.toUpperCase()); setShowAddDropdown(true); }}
              onFocus={() => setShowAddDropdown(true)}
              onBlur={() => setTimeout(() => setShowAddDropdown(false), 200)}
            />
            {showAddDropdown && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: '0 0 3px 3px',
                zIndex: 100,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                {suggestions.map(s => (
                  <div
                    key={s.symbol}
                    style={{
                      padding: '4px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                    onMouseDown={() => addSymbol(s)}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,166,35,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <span style={{ color: AMBER, fontSize: 10 }}>{s.symbol}</span>
                    <span style={{ color: MUTED, fontSize: 9 }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Heat strip */}
        {symbols.length > 0 && (
          <div style={{
            padding: '6px 16px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
          }}>
            <HeatStrip symbols={symbols} width={900} />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {viewMode === 'table' && (
            <>
              {/* Table header */}
              <div style={{
                display: 'flex',
                borderBottom: `2px solid ${BORDER}`,
                position: 'sticky',
                top: 0,
                background: BG,
                zIndex: 1,
              }}>
                {[
                  { key: 'symbol', label: 'SYMBOL', w: 70 },
                  { key: 'name', label: 'NAME', w: 130 },
                  { key: 'price', label: 'PRICE', w: 75 },
                  { key: 'changePct', label: 'CHG%', w: 65 },
                  { key: 'volume', label: 'VOL M', w: 60 },
                  { key: 'marketCap', label: 'MCAP $B', w: 70 },
                  { key: 'pe', label: 'P/E', w: 50 },
                  { key: 'divYield', label: 'DIV%', w: 50 },
                  { key: 'sparkline', label: 'CHART', w: 70 },
                  { key: 'actions', label: '', w: 80 },
                ].map(col => (
                  <div
                    key={col.key}
                    style={{
                      width: col.w,
                      minWidth: col.w,
                      padding: '6px',
                      color: sortKey === col.key ? AMBER : MUTED,
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: col.key !== 'sparkline' && col.key !== 'actions' ? 'pointer' : 'default',
                      textAlign: ['price', 'changePct', 'volume', 'marketCap', 'pe', 'divYield'].includes(col.key) ? 'right' : 'left',
                      textTransform: 'uppercase',
                    }}
                    onClick={() => col.key !== 'sparkline' && col.key !== 'actions' && handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && <span style={{ marginLeft: 2 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                ))}
              </div>
              {/* Table body */}
              {sortedSymbols.map((s, i) => {
                // Use live API price/change when available; fall back to the
                // random value that was generated when the symbol was added.
                const live = livePrices[s.symbol];
                const displayPrice = live?.price && live.price > 0 ? live.price : s.price;
                const displayChange = live?.change ?? s.change;
                const displayChangePct = live?.changePct ?? s.changePct;
                const priceLabel = displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : '…';
                return (
                <div
                  key={s.symbol}
                  style={{
                    display: 'flex',
                    borderBottom: `1px solid ${BORDER}`,
                    background: selectedSymbol === s.symbol ? 'rgba(245,166,35,0.08)' : i % 2 === 0 ? PANEL : BG,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedSymbol(s.symbol)}
                >
                  <div style={{ width: 70, minWidth: 70, padding: '5px 6px', color: AMBER, fontWeight: 600 }}>{s.symbol}</div>
                  <div style={{ width: 130, minWidth: 130, padding: '5px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{s.name}</div>
                  <div style={{ width: 75, minWidth: 75, padding: '5px 6px', textAlign: 'right' }}>{priceLabel}</div>
                  <div style={{
                    width: 65, minWidth: 65, padding: '5px 6px', textAlign: 'right',
                    color: displayChangePct >= 0 ? GREEN : RED,
                  }}>
                    {displayChangePct >= 0 ? '+' : ''}{displayChangePct.toFixed(2)}%
                  </div>
                  <div style={{ width: 60, minWidth: 60, padding: '5px 6px', textAlign: 'right', fontSize: 10 }}>{s.volume.toFixed(1)}M</div>
                  <div style={{ width: 70, minWidth: 70, padding: '5px 6px', textAlign: 'right', fontSize: 10 }}>{s.marketCap}B</div>
                  <div style={{ width: 50, minWidth: 50, padding: '5px 6px', textAlign: 'right', fontSize: 10 }}>{s.pe.toFixed(1)}</div>
                  <div style={{ width: 50, minWidth: 50, padding: '5px 6px', textAlign: 'right', fontSize: 10 }}>{s.divYield.toFixed(2)}%</div>
                  <div style={{ width: 70, minWidth: 70, padding: '3px 6px' }}>
                    <MiniSparkline data={s.sparkline} positive={displayChangePct >= 0} />
                  </div>
                  <div style={{ width: 80, minWidth: 80, padding: '3px 4px', display: 'flex', gap: 2, alignItems: 'center' }}>
                    <button
                      style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 9, padding: '2px' }}
                      onClick={e => { e.stopPropagation(); moveSymbol(s.symbol, 'up'); }}
                      title="Move up"
                    >▲</button>
                    <button
                      style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 9, padding: '2px' }}
                      onClick={e => { e.stopPropagation(); moveSymbol(s.symbol, 'down'); }}
                      title="Move down"
                    >▼</button>
                    <button
                      style={{ background: 'transparent', border: 'none', color: AMBER, cursor: 'pointer', fontSize: 9, padding: '2px' }}
                      onClick={e => { e.stopPropagation(); setAlertModal(s.symbol); setAlertPrice(displayPrice.toFixed(2)); }}
                      title="Set alert"
                    >🔔</button>
                    {s.alert && (
                      <span style={{ color: GREEN, fontSize: 8 }} title={`Alert ${s.alert.type} $${s.alert.price}`}>
                        ●
                      </span>
                    )}
                    <button
                      style={{ background: 'transparent', border: 'none', color: RED, cursor: 'pointer', fontSize: 9, padding: '2px' }}
                      onClick={e => { e.stopPropagation(); removeSymbol(s.symbol); }}
                      title="Remove"
                    >✕</button>
                  </div>
                </div>
                ); })}
            </>
          )}

          {viewMode === 'tiles' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
              padding: 12,
            }}>
              {sortedSymbols.map(s => (
                <div
                  key={s.symbol}
                  style={{
                    background: PANEL,
                    border: `1px solid ${selectedSymbol === s.symbol ? AMBER : BORDER}`,
                    borderRadius: 4,
                    padding: 12,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${s.changePct >= 0 ? GREEN : RED}`,
                  }}
                  onClick={() => setSelectedSymbol(s.symbol)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: AMBER, fontWeight: 700, fontSize: 12 }}>{s.symbol}</span>
                    <span style={{ color: s.changePct >= 0 ? GREEN : RED, fontSize: 11 }}>
                      {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ color: MUTED, fontSize: 9, marginBottom: 8 }}>{s.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>${s.price.toFixed(2)}</div>
                  <MiniSparkline data={s.sparkline} positive={s.changePct >= 0} width={170} height={30} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: MUTED }}>
                    <span>Vol: {s.volume.toFixed(1)}M</span>
                    <span>MCap: {s.marketCap}B</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: MUTED }}>
                    <span>P/E: {s.pe.toFixed(1)}</span>
                    <span>Div: {s.divYield.toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button
                      style={{ background: 'transparent', border: `1px solid ${AMBER}`, color: AMBER, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', fontSize: 8 }}
                      onClick={e => { e.stopPropagation(); setAlertModal(s.symbol); setAlertPrice(s.price.toFixed(2)); }}
                    >ALERT</button>
                    <button
                      style={{ background: 'transparent', border: `1px solid ${RED}`, color: RED, padding: '2px 6px', borderRadius: 2, cursor: 'pointer', fontSize: 8 }}
                      onClick={e => { e.stopPropagation(); removeSymbol(s.symbol); }}
                    >DEL</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'compact' && (
            <div style={{ padding: 8 }}>
              {sortedSymbols.map((s, i) => (
                <div
                  key={s.symbol}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    borderBottom: `1px solid ${BORDER}`,
                    background: i % 2 === 0 ? PANEL : BG,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedSymbol(s.symbol)}
                >
                  <span style={{ color: AMBER, width: 50, fontWeight: 600, fontSize: 10 }}>{s.symbol}</span>
                  <span style={{ flex: 1, color: MUTED, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ width: 70, textAlign: 'right', fontSize: 10 }}>${s.price.toFixed(2)}</span>
                  <span style={{
                    width: 60, textAlign: 'right', fontSize: 10,
                    color: s.changePct >= 0 ? GREEN : RED,
                  }}>
                    {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                  </span>
                  <MiniSparkline data={s.sparkline} positive={s.changePct >= 0} width={50} height={16} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Alert modal ── */}
      {alertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
          onClick={() => setAlertModal(null)}
        >
          <div style={{
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: 20,
            width: 320,
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              🔔 SET ALERT — {alertModal}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['above', 'below'] as const).map(t => (
                <button
                  key={t}
                  style={{
                    flex: 1,
                    background: alertType === t ? (t === 'above' ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)') : 'transparent',
                    border: `1px solid ${alertType === t ? (t === 'above' ? GREEN : RED) : BORDER}`,
                    color: alertType === t ? (t === 'above' ? GREEN : RED) : MUTED,
                    padding: '6px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontFamily: '"Roboto Mono", monospace',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => setAlertType(t)}
                >
                  {t === 'above' ? '▲' : '▼'} Price {t}
                </button>
              ))}
            </div>
            <input
              style={{
                background: '#0d0d0d',
                border: `1px solid ${BORDER}`,
                borderRadius: 3,
                color: TEXT,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: '"Roboto Mono", monospace',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
              type="number"
              value={alertPrice}
              onChange={e => setAlertPrice(e.target.value)}
              placeholder="Price level..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  background: 'rgba(38,166,154,0.2)',
                  border: `1px solid ${GREEN}`,
                  color: GREEN,
                  padding: '8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: '"Roboto Mono", monospace',
                }}
                onClick={setAlert}
              >
                SET ALERT
              </button>
              <button
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                  padding: '8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: '"Roboto Mono", monospace',
                }}
                onClick={() => setAlertModal(null)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
