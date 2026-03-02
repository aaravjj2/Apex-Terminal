import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CriteriaField =
  | 'price' | 'change' | 'changePct' | 'volume' | 'avgVolume' | 'relVolume'
  | 'marketCap' | 'pe' | 'forwardPe' | 'eps' | 'epsGrowth'
  | 'revenue' | 'revenueGrowth' | 'profitMargin' | 'operatingMargin'
  | 'roe' | 'roa' | 'debtToEquity' | 'currentRatio' | 'quickRatio'
  | 'dividendYield' | 'payoutRatio' | 'beta' | 'rsi14' | 'rsi7'
  | 'sma20' | 'sma50' | 'sma200' | 'ema12' | 'ema26'
  | 'atr' | 'macd' | 'macdSignal' | 'macdHistogram'
  | 'bbUpper' | 'bbLower' | 'stochK' | 'stochD'
  | 'adx' | 'obv' | 'mfi' | 'cci' | 'williamsR'
  | 'high52w' | 'low52w' | 'pctFrom52wHigh' | 'pctFrom52wLow'
  | 'avgTrueRange' | 'volatility30d' | 'shortInterest' | 'institutionalOwnership'
  | 'insiderOwnership' | 'analystRating' | 'priceTarget' | 'earningsDate'
  | 'sector' | 'industry' | 'country' | 'exchange' | 'assetType';

export type CriteriaOperator =
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'between' | 'not_between'
  | 'above_sma' | 'below_sma' | 'crossing_up' | 'crossing_down'
  | 'in' | 'not_in' | 'contains';

export interface ScreenCriteria {
  id: string;
  field: CriteriaField;
  operator: CriteriaOperator;
  value: number | string;
  secondaryValue?: number | string;
  enabled: boolean;
}

export interface ScreenResult {
  symbol: string;
  name: string;
  values: Record<CriteriaField, number | string | null>;
  matchScore: number;
  rank: number;
}

export type UniverseType =
  | 'sp500' | 'nasdaq100' | 'djia' | 'russell2000' | 'russell3000'
  | 'nyse' | 'nasdaq' | 'amex' | 'otc'
  | 'etf' | 'crypto' | 'forex' | 'futures'
  | 'largeCap' | 'midCap' | 'smallCap' | 'microCap'
  | 'custom';

export interface ScreenConfig {
  universe: UniverseType;
  customUniverse: string[];
  criteria: ScreenCriteria[];
  sortField: CriteriaField;
  sortDirection: 'asc' | 'desc';
  limit: number;
}

export interface SavedScreen {
  id: string;
  name: string;
  description: string;
  config: ScreenConfig;
  category: string;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  resultCount: number | null;
}

export interface ScannerConfig {
  screenId: string;
  intervalMs: number;
  enabled: boolean;
  alertOnNew: boolean;
  alertOnRemoved: boolean;
  maxAlerts: number;
}

export interface ScannerResult {
  timestamp: number;
  added: string[];
  removed: string[];
  total: number;
  symbols: string[];
}

// ─── Built-in Screens ───────────────────────────────────────────────────────

const BUILT_IN_SCREENS: Omit<SavedScreen, 'id'>[] = [
  {
    name: 'Unusual Volume', description: 'Stocks with volume > 3x average',
    category: 'Volume',
    config: {
      universe: 'sp500', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'relVolume', operator: 'gt', value: 3, enabled: true },
        { id: 'c2', field: 'price', operator: 'gt', value: 5, enabled: true },
      ],
      sortField: 'relVolume', sortDirection: 'desc', limit: 50,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
  {
    name: 'Oversold Bounce', description: 'RSI < 30 with positive momentum',
    category: 'Momentum',
    config: {
      universe: 'sp500', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'rsi14', operator: 'lt', value: 30, enabled: true },
        { id: 'c2', field: 'changePct', operator: 'gt', value: 0, enabled: true },
        { id: 'c3', field: 'volume', operator: 'gt', value: 500000, enabled: true },
      ],
      sortField: 'rsi14', sortDirection: 'asc', limit: 25,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
  {
    name: 'Golden Cross', description: 'SMA 50 crossing above SMA 200',
    category: 'Technical',
    config: {
      universe: 'russell2000', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'sma50', operator: 'crossing_up', value: 0, secondaryValue: 'sma200', enabled: true },
        { id: 'c2', field: 'volume', operator: 'gt', value: 100000, enabled: true },
      ],
      sortField: 'changePct', sortDirection: 'desc', limit: 50,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
  {
    name: 'Value Stocks', description: 'Low P/E, high dividend yield, strong balance sheet',
    category: 'Fundamental',
    config: {
      universe: 'sp500', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'pe', operator: 'lt', value: 15, enabled: true },
        { id: 'c2', field: 'dividendYield', operator: 'gt', value: 2, enabled: true },
        { id: 'c3', field: 'debtToEquity', operator: 'lt', value: 1, enabled: true },
        { id: 'c4', field: 'roe', operator: 'gt', value: 10, enabled: true },
      ],
      sortField: 'dividendYield', sortDirection: 'desc', limit: 30,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
  {
    name: 'Growth Momentum', description: 'High EPS growth with price momentum',
    category: 'Growth',
    config: {
      universe: 'nasdaq100', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'epsGrowth', operator: 'gt', value: 20, enabled: true },
        { id: 'c2', field: 'revenueGrowth', operator: 'gt', value: 15, enabled: true },
        { id: 'c3', field: 'price', operator: 'above_sma', value: 50, enabled: true },
      ],
      sortField: 'epsGrowth', sortDirection: 'desc', limit: 25,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
  {
    name: 'Breakout Watch', description: 'Near 52-week highs with volume',
    category: 'Technical',
    config: {
      universe: 'sp500', customUniverse: [],
      criteria: [
        { id: 'c1', field: 'pctFrom52wHigh', operator: 'gte', value: -3, enabled: true },
        { id: 'c2', field: 'relVolume', operator: 'gt', value: 1.5, enabled: true },
        { id: 'c3', field: 'changePct', operator: 'gt', value: 0.5, enabled: true },
      ],
      sortField: 'pctFrom52wHigh', sortDirection: 'desc', limit: 30,
    },
    isBuiltIn: true, createdAt: 0, updatedAt: 0, lastRunAt: null, resultCount: null,
  },
];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function initBuiltInScreens(): Record<string, SavedScreen> {
  const screens: Record<string, SavedScreen> = {};
  for (const s of BUILT_IN_SCREENS) {
    const id = generateId('scr');
    screens[id] = { ...s, id };
  }
  return screens;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface ScreeningStoreState {
  activeConfig: ScreenConfig;
  results: ScreenResult[];
  isRunning: boolean;
  lastRunAt: number | null;
  error: string | null;

  savedScreens: Record<string, SavedScreen>;
  activeScreenId: string | null;

  scanners: Record<string, ScannerConfig>;
  scannerResults: Record<string, ScannerResult[]>;

  categories: string[];
  selectedCategory: string | null;
  searchQuery: string;
}

interface ScreeningStoreActions {
  addCriteria: (criteria: Omit<ScreenCriteria, 'id'>) => string;
  removeCriteria: (criteriaId: string) => void;
  updateCriteria: (criteriaId: string, updates: Partial<ScreenCriteria>) => void;
  toggleCriteria: (criteriaId: string) => void;
  clearCriteria: () => void;
  reorderCriteria: (fromIndex: number, toIndex: number) => void;

  setUniverse: (universe: UniverseType) => void;
  setCustomUniverse: (symbols: string[]) => void;
  setSortField: (field: CriteriaField) => void;
  toggleSortDirection: () => void;
  setLimit: (limit: number) => void;

  runScreen: () => Promise<void>;
  cancelScreen: () => void;

  saveScreen: (name: string, description?: string, category?: string) => string;
  loadScreen: (screenId: string) => void;
  updateSavedScreen: (screenId: string, updates: Partial<Omit<SavedScreen, 'id' | 'isBuiltIn'>>) => void;
  deleteSavedScreen: (screenId: string) => void;
  duplicateSavedScreen: (screenId: string) => string | null;

  startScanner: (screenId: string, intervalMs?: number) => string;
  stopScanner: (scannerId: string) => void;
  updateScannerConfig: (scannerId: string, updates: Partial<ScannerConfig>) => void;
  addScannerResult: (scannerId: string, result: ScannerResult) => void;
  clearScannerResults: (scannerId: string) => void;

  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useScreeningStore = create<ScreeningStoreState & ScreeningStoreActions>()(
  immer((set, get) => ({
    activeConfig: {
      universe: 'sp500',
      customUniverse: [],
      criteria: [],
      sortField: 'changePct',
      sortDirection: 'desc',
      limit: 50,
    },
    results: [],
    isRunning: false,
    lastRunAt: null,
    error: null,
    savedScreens: initBuiltInScreens(),
    activeScreenId: null,
    scanners: {},
    scannerResults: {},
    categories: ['Volume', 'Momentum', 'Technical', 'Fundamental', 'Growth', 'Custom'],
    selectedCategory: null,
    searchQuery: '',

    addCriteria: (criteria) => {
      const id = generateId('crit');
      set((s) => {
        s.activeConfig.criteria.push({ ...criteria, id });
      });
      return id;
    },

    removeCriteria: (criteriaId) => {
      set((s) => {
        s.activeConfig.criteria = s.activeConfig.criteria.filter((c) => c.id !== criteriaId);
      });
    },

    updateCriteria: (criteriaId, updates) => {
      set((s) => {
        const criteria = s.activeConfig.criteria.find((c) => c.id === criteriaId);
        if (criteria) Object.assign(criteria, updates);
      });
    },

    toggleCriteria: (criteriaId) => {
      set((s) => {
        const criteria = s.activeConfig.criteria.find((c) => c.id === criteriaId);
        if (criteria) criteria.enabled = !criteria.enabled;
      });
    },

    clearCriteria: () => {
      set((s) => {
        s.activeConfig.criteria = [];
      });
    },

    reorderCriteria: (fromIndex, toIndex) => {
      set((s) => {
        const [moved] = s.activeConfig.criteria.splice(fromIndex, 1);
        s.activeConfig.criteria.splice(toIndex, 0, moved);
      });
    },

    setUniverse: (universe) => set((s) => { s.activeConfig.universe = universe; }),
    setCustomUniverse: (symbols) => set((s) => { s.activeConfig.customUniverse = symbols; s.activeConfig.universe = 'custom'; }),
    setSortField: (field) => set((s) => { s.activeConfig.sortField = field; }),
    toggleSortDirection: () => set((s) => { s.activeConfig.sortDirection = s.activeConfig.sortDirection === 'asc' ? 'desc' : 'asc'; }),
    setLimit: (limit) => set((s) => { s.activeConfig.limit = Math.max(1, Math.min(500, limit)); }),

    runScreen: async () => {
      set((s) => { s.isRunning = true; s.error = null; });

      const { activeConfig } = get();
      const enabledCriteria = activeConfig.criteria.filter((c) => c.enabled);

      // Simulated screening - in production this would call the screening API
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));

        const mockSymbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'JPM', 'V', 'UNH',
          'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'PYPL', 'ADBE', 'CRM', 'NFLX'];
        const count = Math.min(activeConfig.limit, mockSymbols.length);

        const results: ScreenResult[] = mockSymbols.slice(0, count).map((sym, i) => ({
          symbol: sym,
          name: sym,
          values: enabledCriteria.reduce((acc, c) => {
            acc[c.field] = Math.random() * 100;
            return acc;
          }, {} as Record<CriteriaField, number | string | null>),
          matchScore: 100 - i * (100 / count),
          rank: i + 1,
        }));

        set((s) => {
          s.results = results;
          s.isRunning = false;
          s.lastRunAt = Date.now();
          if (s.activeScreenId && s.savedScreens[s.activeScreenId]) {
            s.savedScreens[s.activeScreenId].lastRunAt = Date.now();
            s.savedScreens[s.activeScreenId].resultCount = results.length;
          }
        });
      } catch (err) {
        set((s) => {
          s.isRunning = false;
          s.error = err instanceof Error ? err.message : 'Screen failed';
        });
      }
    },

    cancelScreen: () => set((s) => { s.isRunning = false; }),

    saveScreen: (name, description, category) => {
      const id = generateId('scr');
      const { activeConfig } = get();
      const now = Date.now();
      set((s) => {
        s.savedScreens[id] = {
          id,
          name,
          description: description ?? '',
          config: JSON.parse(JSON.stringify(activeConfig)),
          category: category ?? 'Custom',
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
          lastRunAt: null,
          resultCount: null,
        };
        s.activeScreenId = id;
      });
      return id;
    },

    loadScreen: (screenId) => {
      set((s) => {
        const screen = s.savedScreens[screenId];
        if (!screen) return;
        s.activeConfig = JSON.parse(JSON.stringify(screen.config));
        s.activeScreenId = screenId;
        s.results = [];
      });
    },

    updateSavedScreen: (screenId, updates) => {
      set((s) => {
        const screen = s.savedScreens[screenId];
        if (!screen || screen.isBuiltIn) return;
        Object.assign(screen, updates, { updatedAt: Date.now() });
      });
    },

    deleteSavedScreen: (screenId) => {
      set((s) => {
        if (s.savedScreens[screenId]?.isBuiltIn) return;
        delete s.savedScreens[screenId];
        if (s.activeScreenId === screenId) s.activeScreenId = null;
      });
    },

    duplicateSavedScreen: (screenId) => {
      const source = get().savedScreens[screenId];
      if (!source) return null;
      return get().saveScreen(`${source.name} (copy)`, source.description, source.category);
    },

    startScanner: (screenId, intervalMs) => {
      const id = generateId('scan');
      set((s) => {
        s.scanners[id] = {
          screenId,
          intervalMs: intervalMs ?? 60_000,
          enabled: true,
          alertOnNew: true,
          alertOnRemoved: false,
          maxAlerts: 100,
        };
        s.scannerResults[id] = [];
      });
      return id;
    },

    stopScanner: (scannerId) => {
      set((s) => {
        if (s.scanners[scannerId]) s.scanners[scannerId].enabled = false;
      });
    },

    updateScannerConfig: (scannerId, updates) => {
      set((s) => {
        if (s.scanners[scannerId]) Object.assign(s.scanners[scannerId], updates);
      });
    },

    addScannerResult: (scannerId, result) => {
      set((s) => {
        if (!s.scannerResults[scannerId]) s.scannerResults[scannerId] = [];
        const maxHistory = s.scanners[scannerId]?.maxAlerts ?? 100;
        s.scannerResults[scannerId].unshift(result);
        if (s.scannerResults[scannerId].length > maxHistory) {
          s.scannerResults[scannerId] = s.scannerResults[scannerId].slice(0, maxHistory);
        }
      });
    },

    clearScannerResults: (scannerId) => {
      set((s) => {
        if (s.scannerResults[scannerId]) s.scannerResults[scannerId] = [];
      });
    },

    setSelectedCategory: (category) => set((s) => { s.selectedCategory = category; }),
    setSearchQuery: (query) => set((s) => { s.searchQuery = query; }),
  })),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectSavedScreensList = (s: ScreeningStoreState) => Object.values(s.savedScreens);

export const selectBuiltInScreens = (s: ScreeningStoreState) =>
  Object.values(s.savedScreens).filter((sc) => sc.isBuiltIn);

export const selectUserScreens = (s: ScreeningStoreState) =>
  Object.values(s.savedScreens).filter((sc) => !sc.isBuiltIn);

export const selectScreensByCategory = (category: string) => (s: ScreeningStoreState) =>
  Object.values(s.savedScreens).filter((sc) => sc.category === category);

export const selectFilteredScreens = (s: ScreeningStoreState) => {
  let screens = Object.values(s.savedScreens);
  if (s.selectedCategory) screens = screens.filter((sc) => sc.category === s.selectedCategory);
  if (s.searchQuery) {
    const q = s.searchQuery.toLowerCase();
    screens = screens.filter((sc) =>
      sc.name.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q),
    );
  }
  return screens;
};

export const selectActiveScanners = (s: ScreeningStoreState) =>
  Object.values(s.scanners).filter((sc) => sc.enabled);

export const selectEnabledCriteria = (s: ScreeningStoreState) =>
  s.activeConfig.criteria.filter((c) => c.enabled);

export const selectResultCount = (s: ScreeningStoreState) => s.results.length;
