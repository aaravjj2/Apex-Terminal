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

const API_BASE = '/api/v1';

interface WatchlistItem {
  symbol: string;
  added_at: string;
  notes: string;
  price?: number;
  change?: number;
  change_pct?: number;
  volume?: number;
  market_cap?: number;
}

interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  created_at: string;
}

const SymbolRow: React.FC<{
  item: WatchlistItem;
  idx: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}> = ({ item, idx, selected, onSelect, onRemove }) => {
  const [hov, setHov] = React.useState(false);
  const chg = item.change ?? 0;
  const chgPct = item.change_pct ?? 0;
  const col = chg >= 0 ? GREEN : RED;
  return (
    <tr
      data-testid={`watchlist-symbol-${idx}`}
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: `1px solid ${BORDER}`,
        background: selected ? '#1a2a1a' : hov ? '#141414' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <td style={{ padding: '6px 10px', color: AMBER, fontFamily: MONO, fontWeight: 600 }}>{item.symbol}</td>
      <td style={{ padding: '6px 10px', textAlign: 'right', color: TEXT, fontFamily: MONO }}>
        {item.price != null ? `$${item.price.toFixed(2)}` : '--'}
      </td>
      <td style={{ padding: '6px 10px', textAlign: 'right', color: col, fontFamily: MONO, fontSize: 11 }}>
        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}
      </td>
      <td style={{ padding: '6px 10px', textAlign: 'right', color: col, fontFamily: MONO, fontSize: 11 }}>
        {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
      </td>
      <td style={{ padding: '6px 10px', textAlign: 'right', color: SUBTLE, fontSize: 10 }}>
        {item.volume != null ? (item.volume >= 1e6 ? `${(item.volume / 1e6).toFixed(1)}M` : item.volume.toLocaleString()) : '--'}
      </td>
      <td style={{ padding: '6px 10px', color: SUBTLE, fontSize: 10 }}>
        {item.notes || '--'}
      </td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 9, color: SUBTLE }}>
        {item.added_at?.slice(0, 10)}
      </td>
      <td style={{ padding: '6px 4px' }}>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 12, padding: '1px 4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = RED)}
          onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)}
        >âœ•</button>
      </td>
    </tr>
  );
};

/**
 * Bloomberg WL â€” Watchlist Manager
 */
import React, { useState, useEffect, useCallback } from 'react';

export function WatchlistPanel() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<WatchlistItem | null>(null);
  const [sortKey, setSortKey] = useState<'symbol' | 'change_pct' | 'price' | 'volume'>('symbol');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showAddList, setShowAddList] = useState(false);
  const [hovList, setHovList] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/watchlists`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setWatchlists(Array.isArray(data) ? data : []);
        if (data.length > 0 && !selected) setSelected(data[0].id);
      })
      .catch(() => setWatchlists([]))
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const active = watchlists.find(w => w.id === selected);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filteredItems = (active?.items ?? [])
    .filter(i => !search || i.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'symbol':     cmp = a.symbol.localeCompare(b.symbol); break;
        case 'change_pct': cmp = (a.change_pct ?? 0) - (b.change_pct ?? 0); break;
        case 'price':      cmp = (a.price ?? 0) - (b.price ?? 0); break;
        case 'volume':     cmp = (a.volume ?? 0) - (b.volume ?? 0); break;
      }
      return sortAsc ? cmp : -cmp;
    });

  const totalVal = filteredItems.reduce((s, i) => s + (i.price ?? 0), 0);
  const gainers = filteredItems.filter(i => (i.change_pct ?? 0) > 0).length;
  const losers = filteredItems.filter(i => (i.change_pct ?? 0) < 0).length;

  const thStyle = (key: typeof sortKey): React.CSSProperties => ({
    padding: '5px 10px', fontSize: 9, letterSpacing: 1, fontWeight: 600,
    color: sortKey === key ? AMBER : SUBTLE, cursor: 'pointer',
    borderBottom: `1px solid ${BORDER}`, textAlign: 'right',
    userSelect: 'none',
  });

  return (
    <div
      data-testid="watchlist-panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, fontFamily: MONO, color: TEXT }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>WL</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>WATCHLIST MANAGER</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowAddList(s => !s)} style={{
            background: showAddList ? AMBER + '22' : 'transparent', border: `1px solid ${showAddList ? AMBER : BORDER}`,
            borderRadius: 2, padding: '3px 10px', color: showAddList ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1,
          }}>+ LIST</button>
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer' }}>â†º</button>
        </div>
      </div>

      {/* Add list bar */}
      {showAddList && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 8 }}>
          <input
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            placeholder="New watchlist name..."
            style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none' }}
          />
          <button style={{ background: AMBER + '22', border: `1px solid ${AMBER}`, borderRadius: 3, padding: '4px 12px', color: AMBER, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
            CREATE
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Watchlist sidebar */}
        <div style={{ width: 160, borderRight: `1px solid ${BORDER}`, overflow: 'auto', background: PANEL }}>
          <div style={{ padding: '8px 10px', fontSize: 9, color: SUBTLE, letterSpacing: 1, borderBottom: `1px solid ${BORDER}` }}>
            LISTS ({watchlists.length})
          </div>
          {loading && <div style={{ padding: 10, color: AMBER, fontSize: 11 }}>LOADING...</div>}
          {!loading && watchlists.length === 0 && (
            <div data-testid="watchlist-empty" style={{ padding: 16, color: SUBTLE, fontSize: 11, textAlign: 'center' }}>No watchlists</div>
          )}
          {watchlists.map(w => (
            <div
              key={w.id}
              data-testid={`watchlist-tab-${w.id}`}
              onClick={() => { setSelected(w.id); setSelectedSymbol(null); }}
              onMouseEnter={() => setHovList(w.id)}
              onMouseLeave={() => setHovList(null)}
              style={{
                padding: '8px 10px',
                borderBottom: `1px solid ${BORDER}`,
                background: selected === w.id ? AMBER + '18' : hovList === w.id ? '#151515' : 'transparent',
                cursor: 'pointer',
                borderLeft: selected === w.id ? `3px solid ${AMBER}` : '3px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ fontSize: 12, color: selected === w.id ? AMBER : TEXT, fontWeight: selected === w.id ? 600 : 400 }}>{w.name}</div>
              <div style={{ fontSize: 10, color: SUBTLE, marginTop: 2 }}>{w.items.length} symbols</div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {active && (
            <>
              {/* Summary + search bar */}
              <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>SYMBOLS</div>
                    <div style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>{filteredItems.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>GAINERS</div>
                    <div style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{gainers}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>LOSERS</div>
                    <div style={{ fontSize: 12, color: RED, fontWeight: 600 }}>{losers}</div>
                  </div>
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter..."
                  style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 120 }}
                />
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <input
                    value={newSymbol}
                    onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                    placeholder="ADD SYMBOL"
                    style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px', color: TEXT, fontFamily: MONO, fontSize: 11, outline: 'none', width: 100, textTransform: 'uppercase' }}
                  />
                  <button style={{ background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '4px 10px', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                    + ADD
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
                <div style={{ flex: selectedSymbol ? '0 0 65%' : '1 1 auto', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
                    <thead style={{ position: 'sticky', top: 0, background: PANEL, zIndex: 1 }}>
                      <tr>
                        <th onClick={() => handleSort('symbol')} style={{ ...thStyle('symbol'), textAlign: 'left', padding: '5px 10px' }}>SYMBOL {sortKey === 'symbol' ? (sortAsc ? 'â–²' : 'â–¼') : ''}</th>
                        <th onClick={() => handleSort('price')} style={thStyle('price')}>PRICE {sortKey === 'price' ? (sortAsc ? 'â–²' : 'â–¼') : ''}</th>
                        <th onClick={() => handleSort('change_pct')} style={thStyle('change_pct')}>CHG {sortKey === 'change_pct' ? (sortAsc ? 'â–²' : 'â–¼') : ''}</th>
                        <th onClick={() => handleSort('change_pct')} style={thStyle('change_pct')}>CHG% {sortKey === 'change_pct' ? (sortAsc ? 'â–²' : 'â–¼') : ''}</th>
                        <th onClick={() => handleSort('volume')} style={thStyle('volume')}>VOL {sortKey === 'volume' ? (sortAsc ? 'â–²' : 'â–¼') : ''}</th>
                        <th style={{ ...thStyle('symbol'), textAlign: 'left' }}>NOTES</th>
                        <th style={thStyle('symbol')}>ADDED</th>
                        <th style={{ width: 24 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: SUBTLE }}>
                            {active.items.length === 0 ? 'No symbols in watchlist' : 'No matching symbols'}
                          </td>
                        </tr>
                      )}
                      {filteredItems.map((item, i) => (
                        <SymbolRow
                          key={item.symbol}
                          item={item}
                          idx={i}
                          selected={selectedSymbol?.symbol === item.symbol}
                          onSelect={() => setSelectedSymbol(prev => prev?.symbol === item.symbol ? null : item)}
                          onRemove={() => { /* remove logic */ }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedSymbol && (
                  <div style={{ flex: '0 0 35%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>SYMBOL DETAIL</div>
                        <div style={{ fontSize: 16, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selectedSymbol.symbol}</div>
                      </div>
                      <button onClick={() => setSelectedSymbol(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
                    </div>
                    {[
                      { label: 'PRICE', val: selectedSymbol.price != null ? `$${selectedSymbol.price.toFixed(2)}` : '--' },
                      { label: 'CHANGE', val: selectedSymbol.change != null ? `${selectedSymbol.change >= 0 ? '+' : ''}${selectedSymbol.change.toFixed(2)}` : '--', col: (selectedSymbol.change ?? 0) >= 0 ? GREEN : RED },
                      { label: 'CHG %', val: selectedSymbol.change_pct != null ? `${selectedSymbol.change_pct >= 0 ? '+' : ''}${selectedSymbol.change_pct.toFixed(2)}%` : '--', col: (selectedSymbol.change_pct ?? 0) >= 0 ? GREEN : RED },
                      { label: 'VOLUME', val: selectedSymbol.volume != null ? selectedSymbol.volume.toLocaleString() : '--' },
                      { label: 'ADDED', val: selectedSymbol.added_at?.slice(0, 10) || '--' },
                      { label: 'NOTES', val: selectedSymbol.notes || '--' },
                    ].map(({ label, val, col }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                        <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                        <span style={{ color: col || TEXT, fontFamily: MONO, fontWeight: col ? 600 : 400 }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                      <button style={{ flex: 1, background: GREEN + '22', border: `1px solid ${GREEN}`, borderRadius: 3, padding: '6px 0', color: GREEN, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                        BUY
                      </button>
                      <button style={{ flex: 1, background: RED + '22', border: `1px solid ${RED}`, borderRadius: 3, padding: '6px 0', color: RED, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                        SELL
                      </button>
                      <button style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '6px 0', color: SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                        CHART
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {!active && !loading && (
            <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
              Select a watchlist
            </div>
          )}
        </div>
      </div>
      <div data-testid="watchlist-panel-ready" />
    </div>
  );
}

export default WatchlistPanel;
