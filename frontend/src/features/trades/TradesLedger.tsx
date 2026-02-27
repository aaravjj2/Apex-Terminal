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

interface Trade {
  id: string;
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  commission: number;
  timestamp: string;
  pnl?: number;
}

const COLS = ['TIME', 'SYMBOL', 'SIDE', 'QTY', 'PRICE', 'GROSS', 'COMM', 'NET', 'ID'] as const;
type SortCol = typeof COLS[number];

import React, { useState, useEffect, useCallback } from 'react';

export function TradesLedger({ embedded }: { embedded?: boolean }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('TIME');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [hovRow, setHovRow] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/portfolio/orders?status=filled');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const orders = await res.json();
      setTrades(orders.map((o: Record<string, unknown>) => ({
        id: o.id,
        order_id: o.client_order_id || o.id,
        symbol: o.symbol,
        side: o.side,
        quantity: o.filled_qty ?? o.quantity,
        price: o.filled_price ?? o.limit_price ?? 0,
        commission: 0,
        timestamp: o.filled_at || o.submitted_at,
        pnl: undefined,
      })));
    } catch (e) {
      console.error('Failed to fetch trades:', e);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen || embedded) fetchTrades();
  }, [isOpen, embedded, fetchTrades]);

  const exportCSV = () => {
    const headers = ['ID', 'Time', 'Symbol', 'Side', 'Qty', 'Price', 'Comm'];
    const rows = trades.map(t => [t.id, t.timestamp, t.symbol, t.side, t.quantity, t.price, t.commission]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades.csv';
    a.click();
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const filtered = trades
    .filter(t => !filterSymbol || t.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
    .filter(t => filterSide === 'all' || t.side === filterSide)
    .sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'TIME':    cmp = (a.timestamp || '').localeCompare(b.timestamp || ''); break;
        case 'SYMBOL':  cmp = a.symbol.localeCompare(b.symbol); break;
        case 'SIDE':    cmp = a.side.localeCompare(b.side); break;
        case 'QTY':     cmp = a.quantity - b.quantity; break;
        case 'PRICE':   cmp = a.price - b.price; break;
        case 'GROSS':   cmp = (a.quantity * a.price) - (b.quantity * b.price); break;
        case 'COMM':    cmp = a.commission - b.commission; break;
        case 'NET':     cmp = (a.quantity * a.price - a.commission) - (b.quantity * b.price - b.commission); break;
        default: cmp = 0;
      }
      return sortAsc ? cmp : -cmp;
    });

  const totalGross = filtered.reduce((s, t) => s + t.quantity * t.price, 0);
  const totalComm = filtered.reduce((s, t) => s + t.commission, 0);
  const totalNet = totalGross - totalComm;
  const buyCount = filtered.filter(t => t.side === 'buy').length;
  const sellCount = filtered.filter(t => t.side === 'sell').length;
  const symbols = [...new Set(trades.map(t => t.symbol))];

  const btnBase: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3,
    padding: '3px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 10,
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
  };

  const ledgerBody = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>TL</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>TRADES LEDGER</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ ...btnBase, color: BLUE, borderColor: BLUE + '44' }}>
            ↓ CSV
          </button>
          <button
            onClick={fetchTrades}
            style={{ ...btnBase, color: loading ? AMBER : SUBTLE }}
          >
            {loading ? 'LOADING...' : '↺ REFRESH'}
          </button>
          {!embedded && (
            <button onClick={() => setIsOpen(false)} style={{ ...btnBase, color: RED, borderColor: RED + '44' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 24 }}>
        {[
          { label: 'TRADES', val: filtered.length, col: TEXT },
          { label: 'BUYS', val: buyCount, col: GREEN },
          { label: 'SELLS', val: sellCount, col: RED },
          { label: 'GROSS', val: `$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col: BLUE },
          { label: 'COMM', val: `$${totalComm.toFixed(2)}`, col: SUBTLE },
          { label: 'NET', val: `$${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col: totalNet >= 0 ? GREEN : RED },
        ].map(({ label, val, col }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 13, fontFamily: MONO, color: col, fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          placeholder="Filter symbol..."
          style={{
            background: BG, border: `1px solid ${BORDER}`, borderRadius: 3,
            padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 140,
          }}
          list="tl-symbols"
        />
        <datalist id="tl-symbols">
          {symbols.map(s => <option key={s} value={s} />)}
        </datalist>
        {(['all', 'buy', 'sell'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterSide(s)}
            style={{
              ...btnBase,
              color: filterSide === s ? (s === 'buy' ? GREEN : s === 'sell' ? RED : AMBER) : SUBTLE,
              borderColor: filterSide === s ? (s === 'buy' ? GREEN : s === 'sell' ? RED : AMBER) + '88' : BORDER,
              background: filterSide === s ? (s === 'buy' ? GREEN : s === 'sell' ? RED : AMBER) + '15' : 'transparent',
            }}
          >
            {s}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: SUBTLE }}>{filtered.length} of {trades.length}</span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        <div style={{ flex: selectedTrade ? '0 0 65%' : '1 1 auto', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
            <thead style={{ position: 'sticky', top: 0, background: PANEL, zIndex: 1 }}>
              <tr>
                {COLS.map(col => (
                  <th
                    key={col}
                    onClick={() => col !== 'ID' && handleSort(col as SortCol)}
                    style={{
                      padding: '6px 10px', textAlign: col === 'ID' ? 'left' : 'right',
                      color: sortCol === col ? AMBER : SUBTLE,
                      fontWeight: 600, fontSize: 9, letterSpacing: 1,
                      borderBottom: `1px solid ${BORDER}`,
                      cursor: col !== 'ID' ? 'pointer' : 'default',
                      userSelect: 'none',
                      ...(col === 'TIME' || col === 'SYMBOL' || col === 'SIDE' ? { textAlign: 'left' } : {}),
                    }}
                  >
                    {col} {sortCol === col ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: SUBTLE }}>
                    {trades.length === 0 ? 'No filled trades' : 'No matching trades'}
                  </td>
                </tr>
              )}
              {!loading && filtered.map(t => {
                const gross = t.quantity * t.price;
                const net = gross - t.commission;
                const isSelected = selectedTrade?.id === t.id;
                const isHov = hovRow === t.id;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTrade(prev => prev?.id === t.id ? null : t)}
                    onMouseEnter={() => setHovRow(t.id)}
                    onMouseLeave={() => setHovRow(null)}
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background: isSelected ? '#1a2a1a' : isHov ? '#151515' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '5px 10px', color: SUBTLE, textAlign: 'left' }}>
                      {t.timestamp ? new Date(t.timestamp).toLocaleString() : '--'}
                    </td>
                    <td style={{ padding: '5px 10px', color: AMBER, fontWeight: 600, textAlign: 'left' }}>{t.symbol}</td>
                    <td style={{ padding: '5px 10px', color: t.side === 'buy' ? GREEN : RED, fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>
                      {t.side}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: TEXT }}>{t.quantity.toLocaleString()}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: TEXT }}>${t.price.toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: BLUE }}>${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: SUBTLE }}>${t.commission.toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', color: net >= 0 ? GREEN : RED, fontWeight: 600 }}>
                      ${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '5px 10px', color: SUBTLE, fontSize: 9, textAlign: 'left', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: PANEL }}>
                <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                  <td colSpan={3} style={{ padding: '5px 10px', fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>TOTAL ({filtered.length})</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: TEXT, fontSize: 11, fontWeight: 600 }}>
                    {filtered.reduce((s, t) => s + t.quantity, 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '5px 10px' }} />
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: BLUE, fontSize: 11, fontWeight: 600 }}>
                    ${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: SUBTLE, fontSize: 11 }}>${totalComm.toFixed(2)}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: totalNet >= 0 ? GREEN : RED, fontSize: 11, fontWeight: 700 }}>
                    ${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Trade detail panel */}
        {selectedTrade && (
          <div style={{ flex: '0 0 35%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>TRADE DETAIL</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selectedTrade.symbol}</div>
              </div>
              <button onClick={() => setSelectedTrade(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {[
              { label: 'ORDER ID', val: selectedTrade.order_id },
              { label: 'TRADE ID', val: selectedTrade.id },
              { label: 'SIDE', val: selectedTrade.side.toUpperCase(), col: selectedTrade.side === 'buy' ? GREEN : RED },
              { label: 'QUANTITY', val: selectedTrade.quantity.toLocaleString() },
              { label: 'PRICE', val: `$${selectedTrade.price.toFixed(4)}` },
              { label: 'GROSS', val: `$${(selectedTrade.quantity * selectedTrade.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col: BLUE },
              { label: 'COMMISSION', val: `$${selectedTrade.commission.toFixed(4)}` },
              { label: 'NET', val: `$${(selectedTrade.quantity * selectedTrade.price - selectedTrade.commission).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col: GREEN },
              { label: 'TIMESTAMP', val: selectedTrade.timestamp ? new Date(selectedTrade.timestamp).toLocaleString() : '--' },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col || TEXT, fontFamily: MONO, fontWeight: col ? 600 : 400 }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, height: 1, background: BORDER }} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, padding: '6px 0', color: AMBER, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                COPY ID
              </button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '6px 0', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                EXPORT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return ledgerBody;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', background: isOpen ? AMBER + '22' : '#181818',
          border: `1px solid ${isOpen ? AMBER : BORDER}`, borderRadius: 3,
          color: isOpen ? AMBER : TEXT, fontFamily: MONO, fontSize: 11, cursor: 'pointer', letterSpacing: 1,
        }}
      >
        ≡ TRADES
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 360,
          zIndex: 50, boxShadow: '0 -4px 32px rgba(0,0,0,0.8)',
          borderTop: `1px solid ${BORDER}`,
        }}>
          {ledgerBody}
        </div>
      )}
    </>
  );
}

export default TradesLedger;
