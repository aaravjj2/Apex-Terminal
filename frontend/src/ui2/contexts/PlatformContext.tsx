/**
 * PlatformContext — global platform state: theme, layout, shortcuts,
 * accessibility, locale, notifications, feature flags.
 */
import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg0: string; bg1: string; bg2: string; bg3: string; bg4: string;
  border0: string; border1: string; border2: string;
  text0: string; text1: string; text2: string; text3: string;
  brand: string; brandHover: string; brandActive: string;
  up: string; dn: string;
  warning: string; error: string; info: string; success: string;
}

export interface LayoutState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  headerHeight: number;
  statusBarHeight: number;
  fullscreen: boolean;
  activeTab: string;
  pinnedTabs: string[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: { label: string; callback: () => void };
  timeout?: number;
}

export interface PlatformContextState {
  theme: ThemeMode;
  colors: ThemeColors;
  layout: LayoutState;
  notifications: Notification[];
  unreadCount: number;
  locale: string;
  fontSize: number;
  fontFamily: string;
  accessibility: {
    screenReader: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
    colorBlindMode: string;
  };
  featureFlags: Record<string, boolean>;
  isCompact: boolean;
}

export interface PlatformContextActions {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLayout: (updates: Partial<LayoutState>) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  toggleFullscreen: () => void;
  setActiveTab: (tab: string) => void;
  pinTab: (tab: string) => void;
  unpinTab: (tab: string) => void;
  notify: (type: Notification['type'], title: string, message: string, action?: Notification['action']) => string;
  dismissNotification: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  setLocale: (locale: string) => void;
  setFontSize: (size: number) => void;
  setAccessibility: (key: string, value: boolean | string) => void;
  setFeatureFlag: (flag: string, enabled: boolean) => void;
  setCompact: (compact: boolean) => void;
}

type Ctx = [PlatformContextState, PlatformContextActions];

const PlatformCtx = createContext<Ctx | null>(null);

// ── Theme Colors ─────────────────────────────────────────────────────────────

const DARK_COLORS: ThemeColors = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', border2: '#363A45',
  text0: '#D1D4DC', text1: '#B2B5BE', text2: '#787B86', text3: '#4C525E',
  brand: '#2962FF', brandHover: '#1E53E5', brandActive: '#1848CC',
  up: '#26A69A', dn: '#EF5350',
  warning: '#FF9800', error: '#F44336', info: '#2196F3', success: '#4CAF50',
};

const LIGHT_COLORS: ThemeColors = {
  bg0: '#FFFFFF', bg1: '#F8F9FD', bg2: '#F0F3FA', bg3: '#E0E3EB', bg4: '#D1D4DC',
  border0: '#E0E3EB', border1: '#D1D4DC', border2: '#B2B5BE',
  text0: '#131722', text1: '#2A2E39', text2: '#787B86', text3: '#9598A1',
  brand: '#2962FF', brandHover: '#1E53E5', brandActive: '#1848CC',
  up: '#089981', dn: '#F23645',
  warning: '#FF9800', error: '#F44336', info: '#2196F3', success: '#4CAF50',
};

// ── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'apex_platform_state';

function loadPersistedState(): Partial<PlatformContextState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function persistState(state: Partial<PlatformContextState>): void {
  try {
    const { notifications, ...rest } = state as any;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch { /* ignore */ }
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarOpen: true,
  sidebarWidth: 52,
  rightPanelOpen: false,
  rightPanelWidth: 300,
  bottomPanelOpen: false,
  bottomPanelHeight: 200,
  headerHeight: 48,
  statusBarHeight: 24,
  fullscreen: false,
  activeTab: 'trading',
  pinnedTabs: ['trading', 'dashboard', 'portfolio'],
};

const DEFAULT_FLAGS: Record<string, boolean> = {
  darkPool: true,
  algoTrading: true,
  socialTrading: true,
  optionsFlow: true,
  cryptoDefi: true,
  aiAutopilot: true,
  multiChart: true,
  riskDesk: true,
  advancedBacktest: true,
  bloombergTerminal: true,
};

export function PlatformProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(() => loadPersistedState(), []);

  const [theme, setThemeState] = useState<ThemeMode>((persisted as any).theme || 'dark');
  const [layout, setLayoutState] = useState<LayoutState>({ ...DEFAULT_LAYOUT, ...(persisted as any).layout });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [locale, setLocaleState] = useState<string>((persisted as any).locale || 'en-US');
  const [fontSize, setFontSizeState] = useState<number>((persisted as any).fontSize || 13);
  const [fontFamily] = useState('Inter, -apple-system, sans-serif');
  const [accessibility, setAccessibilityState] = useState({
    screenReader: false,
    highContrast: false,
    reducedMotion: false,
    colorBlindMode: 'none',
    ...(persisted as any).accessibility,
  });
  const [featureFlags, setFeatureFlagsState] = useState<Record<string, boolean>>({
    ...DEFAULT_FLAGS,
    ...(persisted as any).featureFlags,
  });
  const [isCompact, setIsCompact] = useState<boolean>((persisted as any).isCompact || false);

  const colors = useMemo(() => theme === 'dark' ? DARK_COLORS : LIGHT_COLORS, [theme]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Persist on changes
  useEffect(() => {
    persistState({ theme, layout, locale, fontSize, accessibility, featureFlags, isCompact } as any);
  }, [theme, layout, locale, fontSize, accessibility, featureFlags, isCompact]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = colors.bg0;
    document.body.style.color = colors.text0;
  }, [theme, colors]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(t => t === 'dark' ? 'light' : 'dark'), []);

  const setLayout = useCallback((updates: Partial<LayoutState>) => {
    setLayoutState(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleSidebar = useCallback(() => setLayoutState(l => ({ ...l, sidebarOpen: !l.sidebarOpen })), []);
  const toggleRightPanel = useCallback(() => setLayoutState(l => ({ ...l, rightPanelOpen: !l.rightPanelOpen })), []);
  const toggleBottomPanel = useCallback(() => setLayoutState(l => ({ ...l, bottomPanelOpen: !l.bottomPanelOpen })), []);
  const toggleFullscreen = useCallback(() => setLayoutState(l => ({ ...l, fullscreen: !l.fullscreen })), []);

  const setActiveTab = useCallback((tab: string) => setLayoutState(l => ({ ...l, activeTab: tab })), []);
  const pinTab = useCallback((tab: string) => setLayoutState(l => ({
    ...l,
    pinnedTabs: l.pinnedTabs.includes(tab) ? l.pinnedTabs : [...l.pinnedTabs, tab],
  })), []);
  const unpinTab = useCallback((tab: string) => setLayoutState(l => ({
    ...l,
    pinnedTabs: l.pinnedTabs.filter(t => t !== tab),
  })), []);

  const notify = useCallback((type: Notification['type'], title: string, message: string, action?: Notification['action']): string => {
    const id = `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const notification: Notification = {
      id, type, title, message,
      timestamp: Date.now(),
      read: false,
      action,
      timeout: type === 'error' ? 0 : 5000,
    };
    setNotifications(prev => [notification, ...prev].slice(0, 100));

    // Auto-dismiss
    if (notification.timeout && notification.timeout > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, notification.timeout);
    }

    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const setLocale = useCallback((l: string) => setLocaleState(l), []);
  const setFontSize = useCallback((s: number) => setFontSizeState(Math.max(10, Math.min(24, s))), []);

  const setAccessibility = useCallback((key: string, value: boolean | string) => {
    setAccessibilityState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFeatureFlag = useCallback((flag: string, enabled: boolean) => {
    setFeatureFlagsState(prev => ({ ...prev, [flag]: enabled }));
  }, []);

  const setCompact = useCallback((compact: boolean) => setIsCompact(compact), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      if (ctrl && e.key === '\\') { e.preventDefault(); toggleRightPanel(); }
      if (ctrl && e.key === '`') { e.preventDefault(); toggleBottomPanel(); }
      if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
      if (ctrl && e.shiftKey && e.key === 'D') { e.preventDefault(); toggleTheme(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, toggleRightPanel, toggleBottomPanel, toggleFullscreen, toggleTheme]);

  const state: PlatformContextState = {
    theme, colors, layout, notifications, unreadCount,
    locale, fontSize, fontFamily, accessibility, featureFlags, isCompact,
  };

  const actions: PlatformContextActions = useMemo(() => ({
    setTheme, toggleTheme, setLayout, toggleSidebar, toggleRightPanel,
    toggleBottomPanel, toggleFullscreen, setActiveTab, pinTab, unpinTab,
    notify, dismissNotification, markAllRead, clearNotifications,
    setLocale, setFontSize, setAccessibility, setFeatureFlag, setCompact,
  }), [setTheme, toggleTheme, setLayout, toggleSidebar, toggleRightPanel,
       toggleBottomPanel, toggleFullscreen, setActiveTab, pinTab, unpinTab,
       notify, dismissNotification, markAllRead, clearNotifications,
       setLocale, setFontSize, setAccessibility, setFeatureFlag, setCompact]);

  return React.createElement(PlatformCtx.Provider, { value: [state, actions] as Ctx }, children);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePlatformContext(): Ctx {
  const ctx = useContext(PlatformCtx);
  if (!ctx) throw new Error('usePlatformContext must be used within PlatformProvider');
  return ctx;
}

export default PlatformProvider;
