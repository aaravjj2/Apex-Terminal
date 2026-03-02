import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WatchlistQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  bid: number;
  ask: number;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  avgVolume: number;
  high52w: number;
  low52w: number;
  timestamp: number;
  exchange: string;
  assetType: string;
}

export type ColumnKey =
  | 'symbol' | 'name' | 'price' | 'change' | 'changePct'
  | 'volume' | 'marketCap' | 'high' | 'low' | 'open'
  | 'previousClose' | 'bid' | 'ask' | 'pe' | 'eps'
  | 'dividendYield' | 'avgVolume' | 'high52w' | 'low52w'
  | 'exchange' | 'assetType';

export interface WatchlistColumn {
  key: ColumnKey;
  label: string;
  visible: boolean;
  width: number;
  align: 'left' | 'center' | 'right';
  format: 'number' | 'currency' | 'percent' | 'compact' | 'text';
}

export interface SortConfig {
  field: ColumnKey;
  direction: 'asc' | 'desc';
}

export interface Watchlist {
  id: string;
  name: string;
  description: string;
  symbols: string[];
  columns: WatchlistColumn[];
  sort: SortConfig;
  color: string;
  icon: string;
  isPinned: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Default Columns ────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: WatchlistColumn[] = [
  { key: 'symbol', label: 'Symbol', visible: true, width: 80, align: 'left', format: 'text' },
  { key: 'name', label: 'Name', visible: true, width: 140, align: 'left', format: 'text' },
  { key: 'price', label: 'Last', visible: true, width: 80, align: 'right', format: 'currency' },
  { key: 'change', label: 'Chg', visible: true, width: 70, align: 'right', format: 'currency' },
  { key: 'changePct', label: 'Chg%', visible: true, width: 70, align: 'right', format: 'percent' },
  { key: 'volume', label: 'Vol', visible: true, width: 80, align: 'right', format: 'compact' },
  { key: 'marketCap', label: 'Mkt Cap', visible: true, width: 90, align: 'right', format: 'compact' },
  { key: 'high', label: 'High', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'low', label: 'Low', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'open', label: 'Open', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'previousClose', label: 'Prev', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'bid', label: 'Bid', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'ask', label: 'Ask', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'pe', label: 'P/E', visible: true, width: 60, align: 'right', format: 'number' },
  { key: 'eps', label: 'EPS', visible: false, width: 60, align: 'right', format: 'currency' },
  { key: 'dividendYield', label: 'Div%', visible: false, width: 60, align: 'right', format: 'percent' },
  { key: 'avgVolume', label: 'Avg Vol', visible: false, width: 80, align: 'right', format: 'compact' },
  { key: 'high52w', label: '52W H', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'low52w', label: '52W L', visible: false, width: 80, align: 'right', format: 'currency' },
  { key: 'exchange', label: 'Exch', visible: false, width: 70, align: 'center', format: 'text' },
  { key: 'assetType', label: 'Type', visible: false, width: 60, align: 'center', format: 'text' },
];

const WATCHLIST_COLORS = ['#2962FF', '#FF6D00', '#00C853', '#D500F9', '#FF1744', '#00B8D4', '#FFD600', '#795548'];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultWatchlist(name: string, symbols: string[], isDefault = false, color?: string): Watchlist {
  const now = Date.now();
  return {
    id: generateId('wl'),
    name,
    description: '',
    symbols,
    columns: JSON.parse(JSON.stringify(DEFAULT_COLUMNS)),
    sort: { field: 'symbol', direction: 'asc' },
    color: color ?? WATCHLIST_COLORS[0],
    icon: 'list',
    isPinned: isDefault,
    isDefault,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Store State ────────────────────────────────────────────────────────────

interface WatchlistStoreState {
  watchlists: Record<string, Watchlist>;
  watchlistOrder: string[];
  activeWatchlistId: string | null;
  quoteCache: Record<string, WatchlistQuote>;
  searchQuery: string;
  searchResults: string[];
  isSearching: boolean;
}

interface WatchlistStoreActions {
  createWatchlist: (name: string, symbols?: string[], color?: string) => string;
  deleteWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  updateWatchlistDescription: (id: string, description: string) => void;
  duplicateWatchlist: (id: string) => string | null;
  setActiveWatchlist: (id: string) => void;
  pinWatchlist: (id: string) => void;
  unpinWatchlist: (id: string) => void;
  reorderWatchlists: (order: string[]) => void;

  addSymbol: (watchlistId: string, symbol: string) => void;
  addSymbols: (watchlistId: string, symbols: string[]) => void;
  removeSymbol: (watchlistId: string, symbol: string) => void;
  reorderSymbol: (watchlistId: string, fromIndex: number, toIndex: number) => void;
  moveSymbolToWatchlist: (fromWatchlistId: string, toWatchlistId: string, symbol: string) => void;
  clearWatchlist: (id: string) => void;

  updateQuote: (symbol: string, quote: Partial<WatchlistQuote>) => void;
  updateQuotes: (quotes: { symbol: string; data: Partial<WatchlistQuote> }[]) => void;
  clearQuoteCache: () => void;

  setColumnVisibility: (watchlistId: string, columnKey: ColumnKey, visible: boolean) => void;
  setColumnWidth: (watchlistId: string, columnKey: ColumnKey, width: number) => void;
  reorderColumns: (watchlistId: string, columns: WatchlistColumn[]) => void;
  resetColumns: (watchlistId: string) => void;
  setSort: (watchlistId: string, field: ColumnKey, direction?: 'asc' | 'desc') => void;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: string[]) => void;
  clearSearch: () => void;

  importWatchlist: (data: { name: string; symbols: string[] }) => string;
  exportWatchlist: (id: string) => { name: string; symbols: string[] } | null;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const defaultWL = createDefaultWatchlist('My Watchlist', ['NVDA', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'QQQ'], true);
const techWL = createDefaultWatchlist('Tech', ['NVDA', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOGL', 'CRM', 'ADBE', 'ORCL'], false, '#00C853');
const indicesWL = createDefaultWatchlist('Indices & ETFs', ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'GLD', 'TLT', 'XLK', 'XLF'], false, '#FF6D00');

export const useWatchlistStore = create<WatchlistStoreState & WatchlistStoreActions>()(
  persist(
    immer((set, get) => ({
      watchlists: {
        [defaultWL.id]: defaultWL,
        [techWL.id]: techWL,
        [indicesWL.id]: indicesWL,
      },
      watchlistOrder: [defaultWL.id, techWL.id, indicesWL.id],
      activeWatchlistId: defaultWL.id,
      quoteCache: {},
      searchQuery: '',
      searchResults: [],
      isSearching: false,

      createWatchlist: (name, symbols, color) => {
        const idx = get().watchlistOrder.length;
        const wl = createDefaultWatchlist(name, symbols ?? [], false, color ?? WATCHLIST_COLORS[idx % WATCHLIST_COLORS.length]);
        set((s) => {
          s.watchlists[wl.id] = wl;
          s.watchlistOrder.push(wl.id);
          s.activeWatchlistId = wl.id;
        });
        return wl.id;
      },

      deleteWatchlist: (id) => {
        set((s) => {
          if (s.watchlists[id]?.isDefault) return;
          delete s.watchlists[id];
          s.watchlistOrder = s.watchlistOrder.filter((wid) => wid !== id);
          if (s.activeWatchlistId === id) {
            s.activeWatchlistId = s.watchlistOrder[0] ?? null;
          }
        });
      },

      renameWatchlist: (id, name) => {
        set((s) => {
          if (s.watchlists[id]) { s.watchlists[id].name = name; s.watchlists[id].updatedAt = Date.now(); }
        });
      },

      updateWatchlistDescription: (id, description) => {
        set((s) => {
          if (s.watchlists[id]) { s.watchlists[id].description = description; s.watchlists[id].updatedAt = Date.now(); }
        });
      },

      duplicateWatchlist: (id) => {
        const source = get().watchlists[id];
        if (!source) return null;
        const wl = createDefaultWatchlist(`${source.name} (copy)`, [...source.symbols], false, source.color);
        wl.columns = JSON.parse(JSON.stringify(source.columns));
        set((s) => {
          s.watchlists[wl.id] = wl;
          s.watchlistOrder.push(wl.id);
        });
        return wl.id;
      },

      setActiveWatchlist: (id) => {
        set((s) => {
          if (s.watchlists[id]) s.activeWatchlistId = id;
        });
      },

      pinWatchlist: (id) => {
        set((s) => { if (s.watchlists[id]) s.watchlists[id].isPinned = true; });
      },

      unpinWatchlist: (id) => {
        set((s) => { if (s.watchlists[id]) s.watchlists[id].isPinned = false; });
      },

      reorderWatchlists: (order) => {
        set((s) => {
          s.watchlistOrder = order.filter((id) => s.watchlists[id]);
        });
      },

      addSymbol: (watchlistId, symbol) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl || wl.symbols.includes(symbol)) return;
          wl.symbols.push(symbol);
          wl.updatedAt = Date.now();
        });
      },

      addSymbols: (watchlistId, symbols) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          for (const sym of symbols) {
            if (!wl.symbols.includes(sym)) wl.symbols.push(sym);
          }
          wl.updatedAt = Date.now();
        });
      },

      removeSymbol: (watchlistId, symbol) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          wl.symbols = wl.symbols.filter((sym) => sym !== symbol);
          wl.updatedAt = Date.now();
        });
      },

      reorderSymbol: (watchlistId, fromIndex, toIndex) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          const [moved] = wl.symbols.splice(fromIndex, 1);
          wl.symbols.splice(toIndex, 0, moved);
          wl.updatedAt = Date.now();
        });
      },

      moveSymbolToWatchlist: (fromId, toId, symbol) => {
        set((s) => {
          const from = s.watchlists[fromId];
          const to = s.watchlists[toId];
          if (!from || !to) return;
          from.symbols = from.symbols.filter((sym) => sym !== symbol);
          if (!to.symbols.includes(symbol)) to.symbols.push(symbol);
          from.updatedAt = Date.now();
          to.updatedAt = Date.now();
        });
      },

      clearWatchlist: (id) => {
        set((s) => {
          if (s.watchlists[id]) { s.watchlists[id].symbols = []; s.watchlists[id].updatedAt = Date.now(); }
        });
      },

      updateQuote: (symbol, quote) => {
        set((s) => {
          const existing = s.quoteCache[symbol];
          if (existing) {
            Object.assign(existing, quote, { timestamp: Date.now() });
          } else {
            s.quoteCache[symbol] = {
              symbol, name: '', price: 0, change: 0, changePct: 0, volume: 0,
              marketCap: 0, high: 0, low: 0, open: 0, previousClose: 0,
              bid: 0, ask: 0, pe: null, eps: null, dividendYield: null,
              avgVolume: 0, high52w: 0, low52w: 0, timestamp: Date.now(),
              exchange: '', assetType: 'stock', ...quote,
            } as WatchlistQuote;
          }
        });
      },

      updateQuotes: (quotes) => {
        set((s) => {
          for (const { symbol, data } of quotes) {
            const existing = s.quoteCache[symbol];
            if (existing) {
              Object.assign(existing, data, { timestamp: Date.now() });
            } else {
              s.quoteCache[symbol] = {
                symbol, name: '', price: 0, change: 0, changePct: 0, volume: 0,
                marketCap: 0, high: 0, low: 0, open: 0, previousClose: 0,
                bid: 0, ask: 0, pe: null, eps: null, dividendYield: null,
                avgVolume: 0, high52w: 0, low52w: 0, timestamp: Date.now(),
                exchange: '', assetType: 'stock', ...data,
              } as WatchlistQuote;
            }
          }
        });
      },

      clearQuoteCache: () => set((s) => { s.quoteCache = {}; }),

      setColumnVisibility: (watchlistId, columnKey, visible) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          const col = wl.columns.find((c) => c.key === columnKey);
          if (col) col.visible = visible;
        });
      },

      setColumnWidth: (watchlistId, columnKey, width) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          const col = wl.columns.find((c) => c.key === columnKey);
          if (col) col.width = width;
        });
      },

      reorderColumns: (watchlistId, columns) => {
        set((s) => {
          if (s.watchlists[watchlistId]) s.watchlists[watchlistId].columns = columns;
        });
      },

      resetColumns: (watchlistId) => {
        set((s) => {
          if (s.watchlists[watchlistId]) {
            s.watchlists[watchlistId].columns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
          }
        });
      },

      setSort: (watchlistId, field, direction) => {
        set((s) => {
          const wl = s.watchlists[watchlistId];
          if (!wl) return;
          if (wl.sort.field === field && !direction) {
            wl.sort.direction = wl.sort.direction === 'asc' ? 'desc' : 'asc';
          } else {
            wl.sort = { field, direction: direction ?? 'asc' };
          }
        });
      },

      setSearchQuery: (query) => set((s) => { s.searchQuery = query; s.isSearching = query.length > 0; }),
      setSearchResults: (results) => set((s) => { s.searchResults = results; s.isSearching = false; }),
      clearSearch: () => set((s) => { s.searchQuery = ''; s.searchResults = []; s.isSearching = false; }),

      importWatchlist: (data) => {
        return get().createWatchlist(data.name, data.symbols);
      },

      exportWatchlist: (id) => {
        const wl = get().watchlists[id];
        if (!wl) return null;
        return { name: wl.name, symbols: [...wl.symbols] };
      },
    })),
    {
      name: 'tv-watchlists',
      partialize: (state) => ({
        watchlists: state.watchlists,
        watchlistOrder: state.watchlistOrder,
        activeWatchlistId: state.activeWatchlistId,
      }),
    },
  ),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectActiveWatchlist = (s: WatchlistStoreState) =>
  s.activeWatchlistId ? s.watchlists[s.activeWatchlistId] ?? null : null;

export const selectWatchlistsInOrder = (s: WatchlistStoreState) =>
  s.watchlistOrder.map((id) => s.watchlists[id]).filter(Boolean);

export const selectPinnedWatchlists = (s: WatchlistStoreState) =>
  s.watchlistOrder.map((id) => s.watchlists[id]).filter((wl) => wl?.isPinned);

export const selectActiveWatchlistQuotes = (s: WatchlistStoreState): WatchlistQuote[] => {
  const wl = s.activeWatchlistId ? s.watchlists[s.activeWatchlistId] : null;
  if (!wl) return [];
  return wl.symbols.map((sym) => s.quoteCache[sym]).filter(Boolean) as WatchlistQuote[];
};

export const selectSortedActiveQuotes = (s: WatchlistStoreState): WatchlistQuote[] => {
  const wl = s.activeWatchlistId ? s.watchlists[s.activeWatchlistId] : null;
  if (!wl) return [];
  const quotes = wl.symbols.map((sym) => s.quoteCache[sym]).filter(Boolean) as WatchlistQuote[];
  const { field, direction } = wl.sort;
  return quotes.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return direction === 'asc' ? cmp : -cmp;
  });
};

export const selectQuote = (symbol: string) => (s: WatchlistStoreState) =>
  s.quoteCache[symbol] ?? null;

export const selectVisibleColumns = (watchlistId: string) => (s: WatchlistStoreState) =>
  s.watchlists[watchlistId]?.columns.filter((c) => c.visible) ?? [];

export const selectWatchlistSymbolCount = (id: string) => (s: WatchlistStoreState) =>
  s.watchlists[id]?.symbols.length ?? 0;
