/**
 * useLocalStorage.ts
 * Persistent settings hook with JSON serialization/deserialization,
 * cross-tab sync via storage events, expiration/TTL support,
 * migration/versioning, and TypeScript generic type safety.
 * Also includes useSessionStorage, usePersistentState, and
 * a higher-level useUserPreferences hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Core useLocalStorage ─────────────────────────────────────────────────────

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: {
    serialize?: (val: T) => string;
    deserialize?: (val: string) => T;
    onError?: (err: unknown) => void;
    syncAcrossTabs?: boolean;
  } = {}
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError = console.error,
    syncAcrossTabs = true,
  } = options;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? deserialize(item) : initialValue;
    } catch (err) {
      onError(err);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setStoredValue(prev => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        localStorage.setItem(key, serialize(next));
        return next;
      });
    } catch (err) {
      onError(err);
    }
  }, [key, serialize, onError]);

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (err) {
      onError(err);
    }
  }, [key, initialValue, onError]);

  // Cross-tab synchronization
  useEffect(() => {
    if (!syncAcrossTabs) return;
    const handler = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== localStorage) return;
      try {
        if (e.newValue === null) { setStoredValue(initialValue); return; }
        setStoredValue(deserialize(e.newValue));
      } catch (err) {
        onError(err);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, initialValue, deserialize, onError, syncAcrossTabs]);

  return [storedValue, setValue, remove];
}

// ─── useSessionStorage ────────────────────────────────────────────────────────

export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  const remove = useCallback(() => {
    sessionStorage.removeItem(key);
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, remove];
}

// ─── Versioned / Migratable Storage ──────────────────────────────────────────

export interface VersionedData<T> {
  version: number;
  data: T;
  savedAt: number;
}

export function useVersionedLocalStorage<T>(
  key: string,
  currentVersion: number,
  initialValue: T,
  migrate?: (oldVersion: number, oldData: any) => T
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      const versioned: VersionedData<any> = JSON.parse(raw);
      if (versioned.version === currentVersion) return versioned.data;
      if (migrate) return migrate(versioned.version, versioned.data);
      return initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback((val: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof val === 'function' ? (val as (p: T) => T)(prev) : val;
      try {
        const versioned: VersionedData<T> = { version: currentVersion, data: next, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(versioned));
      } catch {}
      return next;
    });
  }, [key, currentVersion]);

  return [value, set];
}

// ─── TTL Storage ──────────────────────────────────────────────────────────────

export function useTTLStorage<T>(key: string, ttlMs: number, initialValue: T) {
  interface WithTTL { value: T; expiresAt: number; }

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      const { value: v, expiresAt }: WithTTL = JSON.parse(raw);
      if (Date.now() > expiresAt) { localStorage.removeItem(key); return initialValue; }
      return v;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback((val: T) => {
    setValue(val);
    try {
      const withTTL: WithTTL = { value: val, expiresAt: Date.now() + ttlMs };
      localStorage.setItem(key, JSON.stringify(withTTL));
    } catch {}
  }, [key, ttlMs]);

  const clear = useCallback(() => { localStorage.removeItem(key); setValue(initialValue); }, [key, initialValue]);

  return [value, set, clear] as const;
}

// ─── Debounced Write ──────────────────────────────────────────────────────────

export function useDebouncedLocalStorage<T>(key: string, initialValue: T, debounceMs = 500) {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback((val: T | ((prev: T) => T)) => {
    setValueRaw(prev => {
      const next = typeof val === 'function' ? (val as (p: T) => T)(prev) : val;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      }, debounceMs);
      return next;
    });
  }, [key, debounceMs]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [value, setValue] as const;
}

// ─── User Preferences ────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: 'dark' | 'light';
  colorScheme: 'bloomberg' | 'apex' | 'custom';
  fontSize: number;
  fontFamily: string;
  compactMode: boolean;
  showPercentages: boolean;
  showAbsoluteValues: boolean;
  defaultCurrency: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  hotkeysEnabled: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoRefreshInterval: number;
  defaultChartType: 'candlestick' | 'line' | 'area' | 'bar';
  defaultTimeframe: string;
  showPreMarket: boolean;
  showPostMarket: boolean;
  showVolume: boolean;
  showEarnings: boolean;
  showDividends: boolean;
  showSplits: boolean;
  dashboardLayout: string;
  pinnedSymbols: string[];
  recentSearches: string[];
  customColors: Record<string, string>;
  panelSettings: Record<string, any>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  colorScheme: 'bloomberg',
  fontSize: 13,
  fontFamily: 'JetBrains Mono, Consolas, monospace',
  compactMode: false,
  showPercentages: true,
  showAbsoluteValues: true,
  defaultCurrency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  hotkeysEnabled: true,
  notificationsEnabled: true,
  soundEnabled: false,
  autoRefreshInterval: 5000,
  defaultChartType: 'candlestick',
  defaultTimeframe: '1D',
  showPreMarket: true,
  showPostMarket: true,
  showVolume: true,
  showEarnings: true,
  showDividends: true,
  showSplits: true,
  dashboardLayout: 'default',
  pinnedSymbols: ['SPY', 'QQQ', 'BTC-USD'],
  recentSearches: [],
  customColors: {},
  panelSettings: {},
};

export function useUserPreferences() {
  const [prefs, setPrefs, resetPrefs] = useLocalStorage<UserPreferences>(
    'apex_user_prefs',
    DEFAULT_PREFERENCES,
    { syncAcrossTabs: true }
  );

  const updatePref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }, [setPrefs]);

  const updatePrefs = useCallback((update: Partial<UserPreferences>) => {
    setPrefs(prev => ({ ...prev, ...update }));
  }, [setPrefs]);

  const addPinnedSymbol = useCallback((ticker: string) => {
    setPrefs(prev => ({
      ...prev,
      pinnedSymbols: prev.pinnedSymbols.includes(ticker)
        ? prev.pinnedSymbols
        : [...prev.pinnedSymbols, ticker],
    }));
  }, [setPrefs]);

  const removePinnedSymbol = useCallback((ticker: string) => {
    setPrefs(prev => ({ ...prev, pinnedSymbols: prev.pinnedSymbols.filter(t => t !== ticker) }));
  }, [setPrefs]);

  const addRecentSearch = useCallback((query: string) => {
    setPrefs(prev => ({
      ...prev,
      recentSearches: [query, ...prev.recentSearches.filter(q => q !== query)].slice(0, 20),
    }));
  }, [setPrefs]);

  const setPanelSetting = useCallback((panelId: string, key: string, value: any) => {
    setPrefs(prev => ({
      ...prev,
      panelSettings: {
        ...prev.panelSettings,
        [panelId]: { ...(prev.panelSettings[panelId] ?? {}), [key]: value },
      },
    }));
  }, [setPrefs]);

  const reset = useCallback(() => setPrefs(DEFAULT_PREFERENCES), [setPrefs]);

  return {
    prefs,
    updatePref,
    updatePrefs,
    addPinnedSymbol,
    removePinnedSymbol,
    addRecentSearch,
    setPanelSetting,
    reset,
  };
}

// ─── Storage Usage ────────────────────────────────────────────────────────────

export function useStorageInfo() {
  const [info, setInfo] = useState({ used: 0, quota: 5242880, percent: 0 });

  useEffect(() => {
    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? '';
        used += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
      }
      setInfo({ used, quota: 5_242_880, percent: (used / 5_242_880) * 100 });
    } catch {}
  }, []);

  return info;
}

export default useLocalStorage;
