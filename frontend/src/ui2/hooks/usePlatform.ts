/**
 * usePlatform — React hook wiring lib/platform → ALL pages
 *
 * Provides: theme management, keyboard shortcuts, accessibility settings,
 * i18n/locale, permissions, layout persistence, notifications, user preferences,
 * performance monitoring, feature flags, command palette integration.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
// ── Lib stubs (self-contained mode) ──
type ThemeConfig = any;
type ShortcutBinding = any;
type A11yConfig = any;
type Locale = any;
type Permission = any;
type PlatformConfig = any;
const ThemeManager = class { constructor(..._a: any[]) {} } as any;
const KeyboardShortcuts = class { constructor(..._a: any[]) {} } as any;
const AccessibilityManager = class { constructor(..._a: any[]) {} } as any;
const I18nManager = class { constructor(..._a: any[]) {} } as any;
const PermissionManager = class { constructor(..._a: any[]) {} } as any;


// ── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  border0: string;
  border1: string;
  border2: string;
  text0: string;
  text1: string;
  text2: string;
  text3: string;
  brand: string;
  brandHover: string;
  up: string;
  dn: string;
  warning: string;
  error: string;
  info: string;
}

export interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  monoFont: string;
  borderRadius: number;
  spacing: number;
  density: 'compact' | 'comfortable' | 'spacious';
  chartColors: string[];
}

export interface ShortcutDef {
  id: string;
  keys: string;           // e.g. "Ctrl+Shift+P"
  description: string;
  category: string;
  action: string;
  enabled: boolean;
  isCustom: boolean;
}

export interface A11ySettings {
  screenReaderMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  focusIndicator: boolean;
  announceChanges: boolean;
  keyboardNavigation: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: { decimal: string; thousands: string };
  currency: string;
}

export interface LayoutConfig {
  sidebarWidth: number;
  rightPanelWidth: number;
  topBarHeight: number;
  statusBarHeight: number;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  activeTab: string;
  pinnedTabs: string[];
  panelSizes: Record<string, number>;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  email: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration: number;
  maxVisible: number;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: { label: string; handler: string };
}

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface PerformanceMetrics {
  fps: number;
  memory: number;
  renderTime: number;
  lastUpdate: number;
}

export interface PlatformState {
  /** Theme */
  theme: ThemeState;
  /** Keyboard shortcuts */
  shortcuts: ShortcutDef[];
  /** Accessibility */
  accessibility: A11ySettings;
  /** Locale */
  locale: LocaleInfo;
  /** Available locales */
  availableLocales: LocaleInfo[];
  /** Layout */
  layout: LayoutConfig;
  /** Notification settings */
  notificationSettings: NotificationSettings;
  /** Active notifications */
  notifications: Notification[];
  /** Unread count */
  unreadCount: number;
  /** Feature flags */
  featureFlags: FeatureFlag[];
  /** Performance */
  performance: PerformanceMetrics;
  /** Command palette open */
  commandPaletteOpen: boolean;
  /** Full screen */
  isFullScreen: boolean;
  /** Connection status */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  /** User preferences dirty */
  isDirty: boolean;
}

export interface PlatformActions {
  // ── Theme ────
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (key: keyof ThemeColors, value: string) => void;
  setFontSize: (size: number) => void;
  setDensity: (density: ThemeState['density']) => void;
  resetTheme: () => void;

  // ── Shortcuts ────
  registerShortcut: (def: Omit<ShortcutDef, 'isCustom'>) => void;
  updateShortcut: (id: string, keys: string) => void;
  removeShortcut: (id: string) => void;
  enableShortcut: (id: string, enabled: boolean) => void;
  resetShortcuts: () => void;
  getShortcutsByCategory: () => Map<string, ShortcutDef[]>;

  // ── Accessibility ────
  setAccessibility: (settings: Partial<A11ySettings>) => void;
  toggleScreenReader: () => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  setColorBlindMode: (mode: A11ySettings['colorBlindMode']) => void;
  setA11yFontSize: (size: A11ySettings['fontSize']) => void;

  // ── Locale ────
  setLocale: (code: string) => void;
  formatNumber: (value: number, decimals?: number) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (date: Date | number) => string;
  formatPercent: (value: number) => string;

  // ── Layout ────
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setActiveTab: (tab: string) => void;
  pinTab: (tab: string) => void;
  unpinTab: (tab: string) => void;
  setPanelSize: (panel: string, size: number) => void;
  resetLayout: () => void;

  // ── Notifications ────
  notify: (type: Notification['type'], title: string, message: string, action?: Notification['action']) => void;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;

  // ── Feature Flags ────
  isFeatureEnabled: (id: string) => boolean;
  toggleFeature: (id: string) => void;

  // ── Command Palette ────
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // ── Misc ────
  toggleFullScreen: () => void;
  setConnectionStatus: (status: PlatformState['connectionStatus']) => void;
  savePreferences: () => void;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const DARK_THEME: ThemeColors = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', border2: '#363A45',
  text0: '#D1D4DC', text1: '#B2B5BE', text2: '#787B86', text3: '#4C525E',
  brand: '#2962FF', brandHover: '#1E53E5',
  up: '#26A69A', dn: '#EF5350',
  warning: '#FF9800', error: '#F44336', info: '#2196F3',
};

const LIGHT_THEME: ThemeColors = {
  bg0: '#FFFFFF', bg1: '#F8F9FD', bg2: '#F0F3FA', bg3: '#E0E3EB', bg4: '#CCD0D9',
  border0: '#E0E3EB', border1: '#CCD0D9', border2: '#B8BCCA',
  text0: '#131722', text1: '#2A2E39', text2: '#787B86', text3: '#B2B5BE',
  brand: '#2962FF', brandHover: '#1E53E5',
  up: '#089981', dn: '#F23645',
  warning: '#FF9800', error: '#F44336', info: '#2196F3',
};

const CHART_COLORS = ['#2962FF', '#FF6D00', '#00C853', '#AA00FF', '#FF1744', '#00B8D4', '#FFD600', '#F50057', '#00E676', '#651FFF'];

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'cmd-palette', keys: 'Ctrl+Shift+P', description: 'Open Command Palette', category: 'General', action: 'toggleCommandPalette', enabled: true, isCustom: false },
  { id: 'search', keys: 'Ctrl+K', description: 'Search', category: 'General', action: 'search', enabled: true, isCustom: false },
  { id: 'fullscreen', keys: 'F11', description: 'Toggle Fullscreen', category: 'General', action: 'toggleFullScreen', enabled: true, isCustom: false },
  { id: 'new-tab', keys: 'Ctrl+T', description: 'New Tab', category: 'Navigation', action: 'newTab', enabled: true, isCustom: false },
  { id: 'close-tab', keys: 'Ctrl+W', description: 'Close Tab', category: 'Navigation', action: 'closeTab', enabled: true, isCustom: false },
  { id: 'prev-tab', keys: 'Ctrl+Shift+Tab', description: 'Previous Tab', category: 'Navigation', action: 'prevTab', enabled: true, isCustom: false },
  { id: 'next-tab', keys: 'Ctrl+Tab', description: 'Next Tab', category: 'Navigation', action: 'nextTab', enabled: true, isCustom: false },
  { id: 'toggle-sidebar', keys: 'Ctrl+B', description: 'Toggle Sidebar', category: 'Layout', action: 'toggleSidebar', enabled: true, isCustom: false },
  { id: 'toggle-right', keys: 'Ctrl+Shift+B', description: 'Toggle Right Panel', category: 'Layout', action: 'toggleRightPanel', enabled: true, isCustom: false },
  { id: 'buy', keys: 'Shift+B', description: 'Place Buy Order', category: 'Trading', action: 'buy', enabled: true, isCustom: false },
  { id: 'sell', keys: 'Shift+S', description: 'Place Sell Order', category: 'Trading', action: 'sell', enabled: true, isCustom: false },
  { id: 'flatten', keys: 'Ctrl+Shift+F', description: 'Flatten All Positions', category: 'Trading', action: 'flattenAll', enabled: true, isCustom: false },
  { id: 'trendline', keys: 'Alt+T', description: 'Draw Trend Line', category: 'Drawing', action: 'trendline', enabled: true, isCustom: false },
  { id: 'hline', keys: 'Alt+H', description: 'Draw Horizontal Line', category: 'Drawing', action: 'horizontalLine', enabled: true, isCustom: false },
  { id: 'fib', keys: 'Alt+F', description: 'Draw Fib Retracement', category: 'Drawing', action: 'fibRetracement', enabled: true, isCustom: false },
  { id: 'undo', keys: 'Ctrl+Z', description: 'Undo', category: 'Edit', action: 'undo', enabled: true, isCustom: false },
  { id: 'redo', keys: 'Ctrl+Y', description: 'Redo', category: 'Edit', action: 'redo', enabled: true, isCustom: false },
  { id: 'screenshot', keys: 'Ctrl+Shift+S', description: 'Take Screenshot', category: 'General', action: 'screenshot', enabled: true, isCustom: false },
  { id: 'settings', keys: 'Ctrl+,', description: 'Open Settings', category: 'General', action: 'settings', enabled: true, isCustom: false },
  { id: 'alerts', keys: 'Alt+A', description: 'Open Alerts', category: 'General', action: 'alerts', enabled: true, isCustom: false },
];

const LOCALES: LocaleInfo[] = [
  { code: 'en-US', name: 'English (US)', nativeName: 'English', direction: 'ltr', dateFormat: 'MM/DD/YYYY', numberFormat: { decimal: '.', thousands: ',' }, currency: 'USD' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English', direction: 'ltr', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: '.', thousands: ',' }, currency: 'GBP' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', direction: 'ltr', dateFormat: 'DD.MM.YYYY', numberFormat: { decimal: ',', thousands: '.' }, currency: 'EUR' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', direction: 'ltr', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: ',', thousands: ' ' }, currency: 'EUR' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', direction: 'ltr', dateFormat: 'YYYY/MM/DD', numberFormat: { decimal: '.', thousands: ',' }, currency: 'JPY' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', dateFormat: 'YYYY-MM-DD', numberFormat: { decimal: '.', thousands: ',' }, currency: 'CNY' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', direction: 'ltr', dateFormat: 'YYYY.MM.DD', numberFormat: { decimal: '.', thousands: ',' }, currency: 'KRW' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: '.', thousands: ',' }, currency: 'SAR' },
  { code: 'pt-BR', name: 'Portuguese (BR)', nativeName: 'Português', direction: 'ltr', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: ',', thousands: '.' }, currency: 'BRL' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', direction: 'ltr', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: ',', thousands: '.' }, currency: 'EUR' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', dateFormat: 'DD/MM/YYYY', numberFormat: { decimal: '.', thousands: ',' }, currency: 'INR' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', direction: 'ltr', dateFormat: 'DD.MM.YYYY', numberFormat: { decimal: ',', thousands: ' ' }, currency: 'RUB' },
];

const DEFAULT_FEATURES: FeatureFlag[] = [
  { id: 'dark_pools', name: 'Dark Pool Routing', enabled: true, description: 'Route orders through dark pools for reduced market impact' },
  { id: 'ai_signals', name: 'AI Trade Signals', enabled: true, description: 'ML-powered trade signal generation' },
  { id: 'social_trading', name: 'Social Trading', enabled: true, description: 'View and copy trades from other users' },
  { id: 'crypto_defi', name: 'DeFi Integration', enabled: true, description: 'Access decentralized finance protocols' },
  { id: 'advanced_charts', name: 'Advanced Chart Types', enabled: true, description: 'Renko, P&F, Kagi, Footprint charts' },
  { id: 'options_chain', name: 'Live Options Chain', enabled: true, description: 'Real-time options chain with Greeks' },
  { id: 'algo_trading', name: 'Algorithmic Trading', enabled: true, description: 'TWAP, VWAP, Iceberg algo execution' },
  { id: 'risk_analytics', name: 'Risk Analytics', enabled: true, description: 'Advanced risk metrics and stress testing' },
  { id: 'beta_features', name: 'Beta Features', enabled: false, description: 'Enable experimental features' },
  { id: 'performance_mode', name: 'Performance Mode', enabled: false, description: 'Reduce animations and effects for better FPS' },
];

let notifCounter = 0;

const DEFAULT_LAYOUT: LayoutConfig = {
  sidebarWidth: 52,
  rightPanelWidth: 320,
  topBarHeight: 40,
  statusBarHeight: 24,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  activeTab: 'chart',
  pinnedTabs: ['chart', 'portfolio', 'orders'],
  panelSizes: { chart: 60, orderBook: 20, positions: 20 },
};

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: PlatformState = {
  theme: {
    mode: 'dark',
    colors: DARK_THEME,
    fontSize: 13,
    fontFamily: 'Inter, -apple-system, sans-serif',
    monoFont: 'JetBrains Mono, Menlo, monospace',
    borderRadius: 4,
    spacing: 4,
    density: 'comfortable',
    chartColors: CHART_COLORS,
  },
  shortcuts: DEFAULT_SHORTCUTS,
  accessibility: {
    screenReaderMode: false,
    highContrast: false,
    reducedMotion: false,
    focusIndicator: true,
    announceChanges: false,
    keyboardNavigation: true,
    fontSize: 'medium',
    colorBlindMode: 'none',
  },
  locale: LOCALES[0],
  availableLocales: LOCALES,
  layout: DEFAULT_LAYOUT,
  notificationSettings: {
    enabled: true,
    sound: true,
    desktop: false,
    email: false,
    position: 'top-right',
    duration: 5000,
    maxVisible: 5,
  },
  notifications: [],
  unreadCount: 0,
  featureFlags: DEFAULT_FEATURES,
  performance: { fps: 60, memory: 0, renderTime: 0, lastUpdate: Date.now() },
  commandPaletteOpen: false,
  isFullScreen: false,
  connectionStatus: 'connected',
  isDirty: false,
};

export function usePlatform(): [PlatformState, PlatformActions] {
  const [state, setState] = useState<PlatformState>(INITIAL_STATE);

  // Theme
  const setThemeMode = useCallback((mode: ThemeMode) => {
    const colors = mode === 'light' ? LIGHT_THEME : DARK_THEME;
    setState(prev => ({ ...prev, theme: { ...prev.theme, mode, colors }, isDirty: true }));
  }, []);

  const setThemeColor = useCallback((key: keyof ThemeColors, value: string) => {
    setState(prev => ({ ...prev, theme: { ...prev.theme, colors: { ...prev.theme.colors, [key]: value } }, isDirty: true }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, theme: { ...prev.theme, fontSize: size }, isDirty: true }));
  }, []);

  const setDensity = useCallback((density: ThemeState['density']) => {
    const spacing = density === 'compact' ? 2 : density === 'spacious' ? 8 : 4;
    setState(prev => ({ ...prev, theme: { ...prev.theme, density, spacing }, isDirty: true }));
  }, []);

  const resetTheme = useCallback(() => {
    setState(prev => ({ ...prev, theme: INITIAL_STATE.theme, isDirty: true }));
  }, []);

  // Shortcuts
  const registerShortcut = useCallback((def: Omit<ShortcutDef, 'isCustom'>) => {
    setState(prev => ({
      ...prev,
      shortcuts: prev.shortcuts.some(s => s.id === def.id) ? prev.shortcuts : [...prev.shortcuts, { ...def, isCustom: true }],
    }));
  }, []);

  const updateShortcut = useCallback((id: string, keys: string) => {
    setState(prev => ({ ...prev, shortcuts: prev.shortcuts.map(s => s.id === id ? { ...s, keys } : s), isDirty: true }));
  }, []);

  const removeShortcut = useCallback((id: string) => {
    setState(prev => ({ ...prev, shortcuts: prev.shortcuts.filter(s => s.id !== id || !s.isCustom) }));
  }, []);

  const enableShortcut = useCallback((id: string, enabled: boolean) => {
    setState(prev => ({ ...prev, shortcuts: prev.shortcuts.map(s => s.id === id ? { ...s, enabled } : s) }));
  }, []);

  const resetShortcuts = useCallback(() => {
    setState(prev => ({ ...prev, shortcuts: DEFAULT_SHORTCUTS }));
  }, []);

  const getShortcutsByCategory = useCallback((): Map<string, ShortcutDef[]> => {
    const map = new Map<string, ShortcutDef[]>();
    state.shortcuts.forEach(s => {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    });
    return map;
  }, [state.shortcuts]);

  // Accessibility
  const setAccessibility = useCallback((settings: Partial<A11ySettings>) => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, ...settings }, isDirty: true }));
  }, []);

  const toggleScreenReader = useCallback(() => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, screenReaderMode: !prev.accessibility.screenReaderMode } }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, highContrast: !prev.accessibility.highContrast } }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, reducedMotion: !prev.accessibility.reducedMotion } }));
  }, []);

  const setColorBlindMode = useCallback((mode: A11ySettings['colorBlindMode']) => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, colorBlindMode: mode } }));
  }, []);

  const setA11yFontSize = useCallback((size: A11ySettings['fontSize']) => {
    setState(prev => ({ ...prev, accessibility: { ...prev.accessibility, fontSize: size } }));
  }, []);

  // Locale
  const setLocale = useCallback((code: string) => {
    const locale = LOCALES.find(l => l.code === code);
    if (locale) setState(prev => ({ ...prev, locale, isDirty: true }));
  }, []);

  const formatNumber = useCallback((value: number, decimals = 2): string => {
    const { decimal, thousands } = state.locale.numberFormat;
    const parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return parts.join(decimal);
  }, [state.locale]);

  const formatCurrency = useCallback((value: number, currency?: string): string => {
    const cur = currency || state.locale.currency;
    return `${cur} ${formatNumber(value)}`;
  }, [state.locale, formatNumber]);

  const formatDate = useCallback((date: Date | number): string => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString(state.locale.code);
  }, [state.locale]);

  const formatPercent = useCallback((value: number): string => {
    return `${formatNumber(value, 2)}%`;
  }, [formatNumber]);

  // Layout
  const setSidebarWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, sidebarWidth: width } }));
  }, []);

  const setRightPanelWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, rightPanelWidth: width } }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, sidebarCollapsed: !prev.layout.sidebarCollapsed } }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, rightPanelCollapsed: !prev.layout.rightPanelCollapsed } }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, activeTab: tab } }));
  }, []);

  const pinTab = useCallback((tab: string) => {
    setState(prev => prev.layout.pinnedTabs.includes(tab) ? prev : ({
      ...prev, layout: { ...prev.layout, pinnedTabs: [...prev.layout.pinnedTabs, tab] },
    }));
  }, []);

  const unpinTab = useCallback((tab: string) => {
    setState(prev => ({
      ...prev, layout: { ...prev.layout, pinnedTabs: prev.layout.pinnedTabs.filter(t => t !== tab) },
    }));
  }, []);

  const setPanelSize = useCallback((panel: string, size: number) => {
    setState(prev => ({ ...prev, layout: { ...prev.layout, panelSizes: { ...prev.layout.panelSizes, [panel]: size } } }));
  }, []);

  const resetLayout = useCallback(() => {
    setState(prev => ({ ...prev, layout: DEFAULT_LAYOUT }));
  }, []);

  // Notifications
  const notify = useCallback((type: Notification['type'], title: string, message: string, action?: Notification['action']) => {
    const notif: Notification = { id: `notif_${++notifCounter}`, type, title, message, timestamp: Date.now(), read: false, action };
    setState(prev => ({
      ...prev,
      notifications: [notif, ...prev.notifications].slice(0, 100),
      unreadCount: prev.unreadCount + 1,
    }));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
      unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
    }));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setState(prev => {
      const n = prev.notifications.find(x => x.id === id);
      if (!n || n.read) return prev;
      return {
        ...prev,
        notifications: prev.notifications.map(x => x.id === id ? { ...x, read: true } : x),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      };
    });
  }, []);

  const markAllRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [], unreadCount: 0 }));
  }, []);

  const setNotificationSettings = useCallback((settings: Partial<NotificationSettings>) => {
    setState(prev => ({ ...prev, notificationSettings: { ...prev.notificationSettings, ...settings }, isDirty: true }));
  }, []);

  // Feature flags
  const isFeatureEnabled = useCallback((id: string): boolean => {
    return state.featureFlags.find(f => f.id === id)?.enabled ?? false;
  }, [state.featureFlags]);

  const toggleFeature = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      featureFlags: prev.featureFlags.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f),
    }));
  }, []);

  // Command palette
  const openCommandPalette = useCallback(() => setState(prev => ({ ...prev, commandPaletteOpen: true })), []);
  const closeCommandPalette = useCallback(() => setState(prev => ({ ...prev, commandPaletteOpen: false })), []);
  const toggleCommandPalette = useCallback(() => setState(prev => ({ ...prev, commandPaletteOpen: !prev.commandPaletteOpen })), []);

  // Misc
  const toggleFullScreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullScreen: !prev.isFullScreen }));
  }, []);

  const setConnectionStatus = useCallback((status: PlatformState['connectionStatus']) => {
    setState(prev => ({ ...prev, connectionStatus: status }));
  }, []);

  const savePreferences = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: false }));
  }, []);

  const actions: PlatformActions = useMemo(() => ({
    setThemeMode, setThemeColor, setFontSize, setDensity, resetTheme,
    registerShortcut, updateShortcut, removeShortcut, enableShortcut, resetShortcuts, getShortcutsByCategory,
    setAccessibility, toggleScreenReader, toggleHighContrast, toggleReducedMotion, setColorBlindMode, setA11yFontSize,
    setLocale, formatNumber, formatCurrency, formatDate, formatPercent,
    setSidebarWidth, setRightPanelWidth, toggleSidebar, toggleRightPanel,
    setActiveTab, pinTab, unpinTab, setPanelSize, resetLayout,
    notify, dismissNotification, markAsRead, markAllRead, clearNotifications, setNotificationSettings,
    isFeatureEnabled, toggleFeature,
    openCommandPalette, closeCommandPalette, toggleCommandPalette,
    toggleFullScreen, setConnectionStatus, savePreferences,
  }), [
    setThemeMode, setThemeColor, setFontSize, setDensity, resetTheme,
    registerShortcut, updateShortcut, removeShortcut, enableShortcut, resetShortcuts, getShortcutsByCategory,
    setAccessibility, toggleScreenReader, toggleHighContrast, toggleReducedMotion, setColorBlindMode, setA11yFontSize,
    setLocale, formatNumber, formatCurrency, formatDate, formatPercent,
    setSidebarWidth, setRightPanelWidth, toggleSidebar, toggleRightPanel,
    setActiveTab, pinTab, unpinTab, setPanelSize, resetLayout,
    notify, dismissNotification, markAsRead, markAllRead, clearNotifications, setNotificationSettings,
    isFeatureEnabled, toggleFeature,
    openCommandPalette, closeCommandPalette, toggleCommandPalette,
    toggleFullScreen, setConnectionStatus, savePreferences,
  ]);

  return [state, actions];
}
