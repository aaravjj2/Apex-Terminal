// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const RECENT_DEFAULT = ['AAPL', 'MSFT', 'SPY', 'QQQ', 'NVDA', 'TSLA'];

const SEARCH_DB = [
  { symbol: 'AAPL', description: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'MSFT', description: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'GOOGL', description: 'Alphabet Inc. Class A', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'AMZN', description: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'EQUITY', sector: 'CONSUMER' },
  { symbol: 'TSLA', description: 'Tesla Inc.', exchange: 'NASDAQ', type: 'EQUITY', sector: 'AUTO' },
  { symbol: 'NVDA', description: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'META', description: 'Meta Platforms Inc.', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'AMD', description: 'Advanced Micro Devices', exchange: 'NASDAQ', type: 'EQUITY', sector: 'TECH' },
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE', type: 'ETF', sector: 'INDEX' },
  { symbol: 'QQQ', description: 'Invesco QQQ Trust', exchange: 'NASDAQ', type: 'ETF', sector: 'INDEX' },
  { symbol: 'IWM', description: 'iShares Russell 2000 ETF', exchange: 'NYSE', type: 'ETF', sector: 'INDEX' },
  { symbol: 'GLD', description: 'SPDR Gold Shares', exchange: 'NYSE', type: 'ETF', sector: 'COMMODITY' },
  { symbol: 'BTC/USD', description: 'Bitcoin / US Dollar', exchange: 'CRYPTO', type: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ETH/USD', description: 'Ethereum / US Dollar', exchange: 'CRYPTO', type: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'NFLX', description: 'Netflix Inc.', exchange: 'NASDAQ', type: 'EQUITY', sector: 'MEDIA' },
  { symbol: 'JPM', description: 'JPMorgan Chase & Co.', exchange: 'NYSE', type: 'EQUITY', sector: 'FINANCE' },
  { symbol: 'GS', description: 'Goldman Sachs Group Inc.', exchange: 'NYSE', type: 'EQUITY', sector: 'FINANCE' },
  { symbol: 'VIX', description: 'CBOE Volatility Index', exchange: 'CBOE', type: 'INDEX', sector: 'VOLATILITY' },
  { symbol: 'ES1!', description: 'E-mini S&P 500 Futures', exchange: 'CME', type: 'FUTURES', sector: 'INDEX' },
  { symbol: 'NQ1!', description: 'Nasdaq 100 Futures', exchange: 'CME', type: 'FUTURES', sector: 'INDEX' },
];

const TYPE_COLORS: Record<string, string> = {
  EQUITY: BLUE, ETF: GREEN, CRYPTO: AMBER, INDEX: PURPLE, FUTURES: RED, FOREX: TEXT,
};

const EXCHANGE_COLORS: Record<string, string> = {
  NASDAQ: BLUE, NYSE: GREEN, CRYPTO: AMBER, CBOE: PURPLE, CME: RED,
};

import React, { useState, useEffect, useRef } from 'react';

interface SymbolSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
}

export function SymbolSearchModal({ open, onClose, onSelect }: SymbolSearchModalProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [recentSymbols] = useState<string[]>(RECENT_DEFAULT);
  const [hovered, setHovered] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTypeFilter('ALL');
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const types = ['ALL', ...Array.from(new Set(SEARCH_DB.map(s => s.type)))];
  const filtered = query
    ? SEARCH_DB.filter(s =>
        (s.symbol.toLowerCase().includes(query.toLowerCase()) ||
          s.description.toLowerCase().includes(query.toLowerCase())) &&
        (typeFilter === 'ALL' || s.type === typeFilter)
      )
    : [];

  const handleSelect = (sym: string) => {
    onSelect(sym);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 520, maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6,
        boxShadow: '0 20px 60px rgba(0,0,0,0.9)', fontFamily: MONO,
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>SS</span>
          <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>SYMBOL SEARCH</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 18 }}>âœ•</button>
        </div>

        {/* Search input */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: '6px 10px' }}>
            <span style={{ color: AMBER, fontSize: 14 }}>â—Ž</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              placeholder="Search symbol or company name..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: TEXT, fontFamily: MONO, fontSize: 13, letterSpacing: 1,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 14 }}>âœ•</button>
            )}
          </div>
        </div>

        {/* Type filters */}
        <div style={{ padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {types.map(t => {
            const col = t === 'ALL' ? TEXT : TYPE_COLORS[t] || SUBTLE;
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                background: active ? col + '22' : 'transparent',
                border: `1px solid ${active ? col : BORDER}`, borderRadius: 2,
                padding: '2px 8px', color: active ? col : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer',
              }}>{t}</button>
            );
          })}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {!query && (
            <div style={{ padding: '10px 16px' }}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 2, marginBottom: 8 }}>RECENT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {recentSymbols.map(sym => (
                  <button
                    key={sym}
                    onClick={() => handleSelect(sym)}
                    style={{
                      padding: '4px 12px', background: '#181818',
                      border: `1px solid ${BORDER}`, borderRadius: 3,
                      color: TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = AMBER; (e.currentTarget as HTMLButtonElement).style.color = AMBER; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = TEXT; }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: SUBTLE }}>No symbols found for "{query}"</div>
          )}

          {query && filtered.length > 0 && filtered.map(item => {
            const isHov = hovered === item.symbol;
            const typCol = TYPE_COLORS[item.type] || SUBTLE;
            const exchCol = EXCHANGE_COLORS[item.exchange] || SUBTLE;
            return (
              <button
                key={item.symbol}
                onClick={() => handleSelect(item.symbol)}
                onMouseEnter={() => setHovered(item.symbol)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 16px', background: isHov ? '#161616' : 'transparent',
                  border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 4,
                  background: typCol + '22', border: `1px solid ${typCol}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: typCol, fontFamily: MONO, flexShrink: 0,
                }}>
                  {item.symbol[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: MONO, letterSpacing: 1 }}>{item.symbol}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', background: exchCol + '22', border: `1px solid ${exchCol}44`, borderRadius: 8, color: exchCol }}>{item.exchange}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', background: typCol + '22', border: `1px solid ${typCol}44`, borderRadius: 8, color: typCol }}>{item.type}</span>
                  </div>
                  <div style={{ fontSize: 10, color: SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                </div>
                <div style={{ fontSize: 9, color: SUBTLE }}>{item.sector}</div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>ESC to close</span>
          <span style={{ fontSize: 9, color: SUBTLE }}>â†µ to select</span>
        </div>
      </div>
    </div>
  );
}
