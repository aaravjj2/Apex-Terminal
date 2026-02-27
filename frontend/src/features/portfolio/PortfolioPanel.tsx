// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

interface Position {
  symbol: string;
  qty: number;
  avg_price: number;
  current_price: number;
}

interface PortfolioData {
  equity: number;
  cash: number;
  buying_power: number;
  positions: Position[];
}

const MOCK_DATA: PortfolioData = {
  equity: 142384.56,
  cash: 28412.33,
  buying_power: 56824.66,
  positions: [
    { symbol: 'AAPL', qty: 100, avg_price: 171.50, current_price: 185.20 },
    { symbol: 'NVDA', qty: 50, avg_price: 420.00, current_price: 785.40 },
    { symbol: 'TSLA', qty: -30, avg_price: 250.00, current_price: 208.50 },
    { symbol: 'SPY', qty: 200, avg_price: 448.10, current_price: 471.30 },
  ],
};

import React, { useState, useEffect, useCallback } from 'react';

export function PortfolioPanel({ embedded }: { embedded?: boolean }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [sortKey, setSortKey] = useState<'symbol' | 'pnl' | 'value'>('value');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen || embedded) fetchData();
  }, [isOpen, embedded, fetchData]);

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

  const sortedPositions = [...(data?.positions ?? [])].sort((a, b) => {
    if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol);
    if (sortKey === 'pnl') return ((b.current_price - b.avg_price) * b.qty) - ((a.current_price - a.avg_price) * a.qty);
    if (sortKey === 'value') return (Math.abs(b.current_price * b.qty)) - (Math.abs(a.current_price * a.qty));
    return 0;
  });

  const totalPnl = data?.positions.reduce((s, p) => s + (p.current_price - p.avg_price) * p.qty, 0) ?? 0;
  const totalMktVal = data?.positions.reduce((s, p) => s + p.current_price * p.qty, 0) ?? 0;

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>PF</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>PORTFOLIO</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={fetchData} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 8px', color: loading ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>{loading ? '...' : 'â†º'}</button>
          {!embedded && <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 8px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>âœ•</button>}
        </div>
      </div>

      {/* Equity summary */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#0e0e0e' }}>
        <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>TOTAL EQUITY</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: MONO, marginBottom: 6 }}>{data ? fmt(data.equity) : '---'}</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'CASH', val: data?.cash, col: BLUE },
            { label: 'BUY PWR', val: data?.buying_power, col: GREEN },
            { label: 'PNL', val: totalPnl, col: totalPnl >= 0 ? GREEN : RED, signed: true },
            { label: 'MKT VAL', val: totalMktVal, col: TEXT },
          ].map(({ label, val, col, signed }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 11, fontFamily: MONO, color: col, fontWeight: 600 }}>
                {val != null ? `${signed && val > 0 ? '+' : ''}${fmt(val)}` : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
        {(['symbol', 'value', 'pnl'] as const).map(k => (
          <button key={k} onClick={() => setSortKey(k)} style={{
            background: sortKey === k ? '#1a1a1a' : 'transparent', border: `1px solid ${sortKey === k ? AMBER : BORDER}`,
            borderRadius: 2, padding: '2px 6px', color: sortKey === k ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'pointer',
          }}>{k.toUpperCase()}</button>
        ))}
      </div>

      {/* Positions */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selectedPos ? '0 0 55%' : 1, overflow: 'auto' }}>
          {!data && !loading && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE }}>No portfolio data</div>}
          {loading && <div style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {/* Column headers */}
          {data && data.positions.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '70px 50px 80px 80px 80px 80px', padding: '5px 14px', fontSize: 9, color: SUBTLE, borderBottom: `1px solid ${BORDER}`, letterSpacing: 1 }}>
              <span>SYMBOL</span><span style={{ textAlign: 'right' }}>QTY</span>
              <span style={{ textAlign: 'right' }}>AVG</span><span style={{ textAlign: 'right' }}>PRICE</span>
              <span style={{ textAlign: 'right' }}>MKT VAL</span><span style={{ textAlign: 'right' }}>P&L</span>
            </div>
          )}
          {sortedPositions.map(p => {
            const pnl = (p.current_price - p.avg_price) * p.qty;
            const pnlPct = ((p.current_price - p.avg_price) / p.avg_price) * 100;
            const pnlCol = pnl >= 0 ? GREEN : RED;
            const mktVal = p.current_price * p.qty;
            const isSelected = selectedPos?.symbol === p.symbol;
            return (
              <div
                key={p.symbol}
                onClick={() => setSelectedPos(prev => prev?.symbol === p.symbol ? null : p)}
                style={{
                  display: 'grid', gridTemplateColumns: '70px 50px 80px 80px 80px 80px',
                  padding: '8px 14px', borderBottom: `1px solid ${BORDER}`,
                  background: isSelected ? '#1a1400' : 'transparent',
                  cursor: 'pointer', borderLeft: `3px solid ${isSelected ? AMBER : 'transparent'}`,
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#141414'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div>
                  <div style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>{p.symbol}</div>
                  <div style={{ fontSize: 9, color: p.qty > 0 ? GREEN : RED }}>{p.qty > 0 ? 'LONG' : 'SHORT'}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, fontFamily: MONO, color: TEXT, alignSelf: 'center' }}>{Math.abs(p.qty)}</div>
                <div style={{ textAlign: 'right', fontSize: 11, fontFamily: MONO, color: SUBTLE, alignSelf: 'center' }}>${p.avg_price.toFixed(2)}</div>
                <div style={{ textAlign: 'right', fontSize: 11, fontFamily: MONO, color: TEXT, alignSelf: 'center' }}>${p.current_price.toFixed(2)}</div>
                <div style={{ textAlign: 'right', fontSize: 11, fontFamily: MONO, color: TEXT, alignSelf: 'center' }}>${Math.abs(mktVal).toFixed(2)}</div>
                <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, color: pnlCol, fontWeight: 600 }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</div>
                  <div style={{ fontSize: 9, color: pnlCol }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedPos && (
          <div style={{ flex: '0 0 45%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>POSITION DETAIL</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700 }}>{selectedPos.symbol}</div>
              </div>
              <button onClick={() => setSelectedPos(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {(() => {
              const pnl = (selectedPos.current_price - selectedPos.avg_price) * selectedPos.qty;
              const pnlPct = ((selectedPos.current_price - selectedPos.avg_price) / selectedPos.avg_price) * 100;
              const pnlCol = pnl >= 0 ? GREEN : RED;
              return (
                <>
                  {[
                    { label: 'DIRECTION', val: selectedPos.qty > 0 ? 'LONG' : 'SHORT', col: selectedPos.qty > 0 ? GREEN : RED },
                    { label: 'QUANTITY', val: Math.abs(selectedPos.qty), col: TEXT },
                    { label: 'AVG PRICE', val: `$${selectedPos.avg_price.toFixed(2)}`, col: SUBTLE === '#555' ? TEXT : SUBTLE },
                    { label: 'CURRENT', val: `$${selectedPos.current_price.toFixed(2)}`, col: TEXT },
                    { label: 'MKT VALUE', val: fmt(Math.abs(selectedPos.current_price * selectedPos.qty)), col: TEXT },
                    { label: 'UNREALIZED P&L', val: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, col: pnlCol },
                    { label: 'P&L %', val: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`, col: pnlCol },
                  ].map(({ label, val, col }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                      <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                      <span style={{ color: col, fontFamily: MONO, fontWeight: 600 }}>{String(val)}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
                    <button style={{ flex: 1, background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '5px 0', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>BUY MORE</button>
                    <button style={{ flex: 1, background: RED + '22', border: `1px solid ${RED}`, borderRadius: 3, padding: '5px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>CLOSE</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return panelContent;

  return (
    <>
      <button onClick={() => setIsOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        background: isOpen ? AMBER + '22' : '#181818', border: `1px solid ${isOpen ? AMBER : BORDER}`, borderRadius: 3,
        color: isOpen ? AMBER : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
      }}>â—ˆ PORTFOLIO</button>
      {isOpen && (
        <div style={{
          position: 'absolute', top: 40, right: 0, width: 540, height: 480,
          zIndex: 100, boxShadow: '0 8px 40px rgba(0,0,0,0.8)', border: `1px solid ${BORDER}`,
        }}>
          {panelContent}
        </div>
      )}
    </>
  );
}
