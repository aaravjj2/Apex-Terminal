/**
 * useScreener.ts
 * Stock screener hook with criteria-based filtering, real-time result updates,
 * universe management, sort/filter, saved screens, and change alerts.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ScreenerOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between' | 'in' | 'not_in' | 'contains';
export type ScreenerFieldType = 'number' | 'string' | 'boolean';
export type SortDirection = 'asc' | 'desc';

export interface ScreenerCriteria {
  id: string;
  field: string;
  operator: ScreenerOperator;
  value: number | string | boolean;
  value2?: number;
  fieldType: ScreenerFieldType;
  enabled: boolean;
}

export interface ScreenerUniverse {
  id: string;
  name: string;
  symbols?: string[];
  exchange?: string;
  marketCap?: { min?: number; max?: number };
  sector?: string[];
  country?: string;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  pe: number;
  eps: number;
  beta: number;
  dividend: number;
  high52w: number;
  low52w: number;
  rsi14: number;
  sma50: number;
  sma200: number;
  [key: string]: any;
}

export interface SavedScreen {
  id: string;
  name: string;
  description?: string;
  criteria: ScreenerCriteria[];
  universe: ScreenerUniverse;
  sortBy?: string;
  sortDir?: SortDirection;
  createdAt: number;
  updatedAt: number;
}

export interface ScreenerSort {
  field: string;
  direction: SortDirection;
}

export interface UseScreenerOptions {
  apiUrl?: string;
  refreshIntervalMs?: number;
  onResultsChange?: (added: string[], removed: string[]) => void;
  onError?: (error: string) => void;
  mockMode?: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_STOCKS: ScreenerResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 2.9e12, price: 189.64, change: 2.31, changePct: 1.23, volume: 52e6, avgVolume: 48e6, pe: 29.5, eps: 6.42, beta: 1.2, dividend: 0.96, high52w: 199.62, low52w: 143.90, rsi14: 58, sma50: 185, sma200: 175 },
  { symbol: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software', marketCap: 3.1e12, price: 412.88, change: 5.22, changePct: 1.28, volume: 22e6, avgVolume: 20e6, pe: 35.1, eps: 11.76, beta: 0.9, dividend: 3.0, high52w: 420.82, low52w: 309.45, rsi14: 62, sma50: 400, sma200: 370 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors', marketCap: 2.1e12, price: 862.42, change: 15.88, changePct: 1.88, volume: 40e6, avgVolume: 45e6, pe: 65.2, eps: 13.23, beta: 1.7, dividend: 0.16, high52w: 974.0, low52w: 373.56, rsi14: 71, sma50: 800, sma200: 650 },
  { symbol: 'AMZN', name: 'Amazon.com Inc', exchange: 'NASDAQ', sector: 'Consumer Cyclical', industry: 'Internet Retail', marketCap: 1.9e12, price: 184.22, change: -1.05, changePct: -0.57, volume: 35e6, avgVolume: 38e6, pe: 58.3, eps: 3.16, beta: 1.15, dividend: 0, high52w: 189.77, low52w: 118.35, rsi14: 45, sma50: 180, sma200: 160 },
  { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet Content', marketCap: 1.3e12, price: 502.64, change: 8.44, changePct: 1.71, volume: 15e6, avgVolume: 18e6, pe: 25.8, eps: 19.48, beta: 1.3, dividend: 2.0, high52w: 531.49, low52w: 274.38, rsi14: 67, sma50: 480, sma200: 400 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet Content', marketCap: 2.0e12, price: 164.42, change: 1.12, changePct: 0.69, volume: 25e6, avgVolume: 22e6, pe: 24.3, eps: 6.76, beta: 1.05, dividend: 0.8, high52w: 170.39, low52w: 120.21, rsi14: 55, sma50: 158, sma200: 145 },
  { symbol: 'TSLA', name: 'Tesla Inc', exchange: 'NASDAQ', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', marketCap: 780e9, price: 246.22, change: -4.55, changePct: -1.82, volume: 90e6, avgVolume: 95e6, pe: 72.1, eps: 3.41, beta: 2.0, dividend: 0, high52w: 299.29, low52w: 152.37, rsi14: 42, sma50: 260, sma200: 230 },
  { symbol: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banks', marketCap: 570e9, price: 196.55, change: 0.88, changePct: 0.45, volume: 8e6, avgVolume: 10e6, pe: 11.8, eps: 16.66, beta: 1.1, dividend: 4.6, high52w: 200.94, low52w: 143.46, rsi14: 60, sma50: 190, sma200: 170 },
  { symbol: 'V', name: 'Visa Inc', exchange: 'NYSE', sector: 'Financial Services', industry: 'Credit Services', marketCap: 570e9, price: 281.33, change: 1.92, changePct: 0.69, volume: 6e6, avgVolume: 7e6, pe: 30.5, eps: 9.22, beta: 0.95, dividend: 2.08, high52w: 290.96, low52w: 235.0, rsi14: 57, sma50: 275, sma200: 260 },
  { symbol: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', sector: 'Energy', industry: 'Oil & Gas', marketCap: 440e9, price: 106.88, change: -0.55, changePct: -0.51, volume: 12e6, avgVolume: 14e6, pe: 12.4, eps: 8.62, beta: 0.8, dividend: 3.76, high52w: 120.70, low52w: 95.77, rsi14: 48, sma50: 108, sma200: 105 },
];

// ─── Criteria Evaluation ───────────────────────────────────────────────────────

function evaluateCriteria(item: ScreenerResult, criteria: ScreenerCriteria): boolean {
  if (!criteria.enabled) return true;
  const val = item[criteria.field];
  if (val === undefined) return false;

  switch (criteria.operator) {
    case '>': return (val as number) > (criteria.value as number);
    case '>=': return (val as number) >= (criteria.value as number);
    case '<': return (val as number) < (criteria.value as number);
    case '<=': return (val as number) <= (criteria.value as number);
    case '==': return val === criteria.value;
    case '!=': return val !== criteria.value;
    case 'between': return (val as number) >= (criteria.value as number) && (val as number) <= (criteria.value2 ?? Infinity);
    case 'in': return Array.isArray(criteria.value) ? (criteria.value as any).includes(val) : String(val).includes(String(criteria.value));
    case 'not_in': return Array.isArray(criteria.value) ? !(criteria.value as any).includes(val) : !String(val).includes(String(criteria.value));
    case 'contains': return String(val).toLowerCase().includes(String(criteria.value).toLowerCase());
    default: return true;
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useScreener(options: UseScreenerOptions = {}) {
  const {
    apiUrl = '/api/screener',
    refreshIntervalMs = 30000,
    onResultsChange,
    onError,
    mockMode = true,
  } = options;

  const [criteria, setCriteria] = useState<ScreenerCriteria[]>([]);
  const [universe, setUniverse] = useState<ScreenerUniverse>({ id: 'all', name: 'All Stocks' });
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [sort, setSort] = useState<ScreenerSort>({ field: 'marketCap', direction: 'desc' });
  const [filterText, setFilterText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previousSymbolsRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let data: ScreenerResult[];

      if (mockMode) {
        await new Promise(r => setTimeout(r, 200));
        data = MOCK_STOCKS.map(s => ({
          ...s,
          price: s.price * (1 + (Math.random() - 0.5) * 0.01),
          change: s.change + (Math.random() - 0.5) * 0.5,
          volume: s.volume + Math.floor((Math.random() - 0.5) * 1e6),
        }));
      } else {
        const res = await fetch(`${apiUrl}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria, universe }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }

      const filtered = data.filter(item =>
        criteria.every(c => evaluateCriteria(item, c))
      );

      const currentSymbols = new Set(filtered.map(r => r.symbol));
      const prevSymbols = previousSymbolsRef.current;
      if (prevSymbols.size > 0) {
        const added = [...currentSymbols].filter(s => !prevSymbols.has(s));
        const removed = [...prevSymbols].filter(s => !currentSymbols.has(s));
        if (added.length > 0 || removed.length > 0) onResultsChange?.(added, removed);
      }
      previousSymbolsRef.current = currentSymbols;

      setResults(filtered);
    } catch (err) {
      const msg = `Screen execution failed: ${err}`;
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, criteria, universe, mockMode, onResultsChange, onError]);

  const sortedResults = useMemo(() => {
    let items = [...results];
    if (filterText) {
      const lower = filterText.toLowerCase();
      items = items.filter(r => r.symbol.toLowerCase().includes(lower) || r.name.toLowerCase().includes(lower));
    }
    items.sort((a, b) => {
      const va = a[sort.field], vb = b[sort.field];
      const cmp = typeof va === 'number' ? (va as number) - (vb as number) : String(va).localeCompare(String(vb));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [results, sort, filterText]);

  const addCriteria = useCallback((criterion: Omit<ScreenerCriteria, 'id'>) => {
    setCriteria(prev => [...prev, { ...criterion, id: `crit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);
  }, []);

  const removeCriteria = useCallback((id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCriteria = useCallback((id: string, updates: Partial<ScreenerCriteria>) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const toggleCriteria = useCallback((id: string) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  }, []);

  const clearCriteria = useCallback(() => setCriteria([]), []);

  const saveScreen = useCallback((name: string, description?: string) => {
    const screen: SavedScreen = {
      id: `scr-${Date.now().toString(36)}`, name, description,
      criteria: [...criteria], universe: { ...universe },
      sortBy: sort.field, sortDir: sort.direction,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    setSavedScreens(prev => [...prev, screen]);
    try { localStorage.setItem('apex_screens', JSON.stringify([...savedScreens, screen])); } catch {}
    return screen;
  }, [criteria, universe, sort, savedScreens]);

  const loadScreen = useCallback((screen: SavedScreen) => {
    setCriteria(screen.criteria);
    setUniverse(screen.universe);
    if (screen.sortBy) setSort({ field: screen.sortBy, direction: screen.sortDir ?? 'desc' });
  }, []);

  const deleteScreen = useCallback((id: string) => {
    setSavedScreens(prev => {
      const next = prev.filter(s => s.id !== id);
      try { localStorage.setItem('apex_screens', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('apex_screens');
      if (stored) setSavedScreens(JSON.parse(stored));
    } catch {}
  }, []);

  const startAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setInterval(execute, refreshIntervalMs);
  }, [execute, refreshIntervalMs]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAutoRefresh(), [stopAutoRefresh]);

  return {
    results: sortedResults,
    rawResults: results,
    criteria, universe, sort, filterText,
    isLoading, error, savedScreens,
    execute,
    addCriteria, removeCriteria, updateCriteria, toggleCriteria, clearCriteria,
    setUniverse, setSort, setFilterText,
    saveScreen, loadScreen, deleteScreen,
    startAutoRefresh, stopAutoRefresh,
  };
}

export default useScreener;
