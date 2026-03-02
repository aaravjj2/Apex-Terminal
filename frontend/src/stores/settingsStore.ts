import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThemeId = 'dark' | 'light' | 'bloomberg' | 'monokai' | 'solarized' | 'custom';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  positive: string;
  negative: string;
  warning: string;
  info: string;
  chartBackground: string;
  chartGrid: string;
  chartCrosshair: string;
  chartUpCandle: string;
  chartDownCandle: string;
  chartVolume: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
  spacing: number;
}

export type ChartTypeDefault = 'candlestick' | 'ohlc' | 'line' | 'area' | 'heikinAshi' | 'hollowCandle';

export type NumberFormat = 'standard' | 'compact' | 'scientific' | 'accounting';
export type DateFormatStyle = 'iso' | 'us' | 'eu' | 'relative';

export interface ChartDefaults {
  chartType: ChartTypeDefault;
  timeframe: string;
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  showLegend: boolean;
  autoScale: boolean;
  logScale: boolean;
  defaultIndicators: string[];
  upColor: string;
  downColor: string;
  lineColor: string;
  areaColor: string;
  volumeUpColor: string;
  volumeDownColor: string;
}

export interface TradingDefaults {
  defaultOrderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  defaultTimeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  defaultQuantity: number;
  quantityStep: number;
  confirmOrders: boolean;
  confirmCancellations: boolean;
  showBracketByDefault: boolean;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  soundOnFill: boolean;
  soundOnReject: boolean;
  showPositionOnChart: boolean;
  showOrdersOnChart: boolean;
}

export interface AlertDefaults {
  defaultSound: string;
  defaultVolume: number;
  popupEnabled: boolean;
  popupDuration: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  defaultFrequency: 'once' | 'every_time' | 'once_per_bar';
  groupAlerts: boolean;
}

export interface DisplayPreferences {
  numberFormat: NumberFormat;
  dateFormat: DateFormatStyle;
  timezone: string;
  locale: string;
  decimalPlaces: number;
  thousandsSeparator: string;
  use24HourTime: boolean;
  showMilliseconds: boolean;
  compactNumbers: boolean;
}

export interface PerformanceSettings {
  enableAnimations: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  enableTransitions: boolean;
  enableBlur: boolean;
  enableShadows: boolean;
  maxVisibleCandles: number;
  chartRenderQuality: 'low' | 'medium' | 'high';
  dataThrottleMs: number;
  maxConcurrentStreams: number;
  enableHardwareAcceleration: boolean;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface LayoutPreferences {
  sidebarPosition: 'left' | 'right';
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  headerVisible: boolean;
  footerVisible: boolean;
  statusBarVisible: boolean;
  toolbarPosition: 'top' | 'left' | 'right';
  compactMode: boolean;
  panelBorders: boolean;
  tabPosition: 'top' | 'bottom';
}

export interface DataPreferences {
  autoRefresh: boolean;
  refreshIntervalMs: number;
  preloadTimeframes: string[];
  maxCachedBars: number;
  enableWebSocket: boolean;
  reconnectOnDisconnect: boolean;
  dataQualityAlerts: boolean;
}

export interface KeyboardShortcut {
  id: string;
  action: string;
  keys: string;
  category: string;
  enabled: boolean;
  isCustom: boolean;
}

// ─── Theme Presets ──────────────────────────────────────────────────────────

const THEME_PRESETS: Record<ThemeId, ThemeConfig> = {
  dark: {
    id: 'dark', name: 'Dark',
    colors: {
      background: '#131722', surface: '#1E222D', surfaceHover: '#2A2E39',
      border: '#363A45', text: '#D1D4DC', textSecondary: '#787B86', textMuted: '#4C525E',
      accent: '#2962FF', accentHover: '#1E53E5',
      positive: '#26A69A', negative: '#EF5350', warning: '#FF9800', info: '#2196F3',
      chartBackground: '#131722', chartGrid: '#1C2030', chartCrosshair: '#758696',
      chartUpCandle: '#26A69A', chartDownCandle: '#EF5350', chartVolume: 'rgba(76,175,80,0.3)',
    },
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13, borderRadius: 4, spacing: 4,
  },
  light: {
    id: 'light', name: 'Light',
    colors: {
      background: '#FFFFFF', surface: '#F8F9FA', surfaceHover: '#E9ECEF',
      border: '#DEE2E6', text: '#131722', textSecondary: '#6C757D', textMuted: '#ADB5BD',
      accent: '#2962FF', accentHover: '#1E53E5',
      positive: '#089981', negative: '#F23645', warning: '#FF9800', info: '#2196F3',
      chartBackground: '#FFFFFF', chartGrid: '#F0F3FA', chartCrosshair: '#9598A1',
      chartUpCandle: '#089981', chartDownCandle: '#F23645', chartVolume: 'rgba(38,166,154,0.3)',
    },
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13, borderRadius: 4, spacing: 4,
  },
  bloomberg: {
    id: 'bloomberg', name: 'Bloomberg',
    colors: {
      background: '#000000', surface: '#0A0A0A', surfaceHover: '#1A1A1A',
      border: '#333333', text: '#FF8C00', textSecondary: '#CCCCCC', textMuted: '#666666',
      accent: '#FF6600', accentHover: '#FF8C00',
      positive: '#00FF00', negative: '#FF0000', warning: '#FFFF00', info: '#00BFFF',
      chartBackground: '#000000', chartGrid: '#1A1A1A', chartCrosshair: '#666666',
      chartUpCandle: '#00FF00', chartDownCandle: '#FF0000', chartVolume: 'rgba(0,255,0,0.2)',
    },
    fontFamily: '"Lucida Console", "Courier New", monospace',
    fontSize: 12, borderRadius: 0, spacing: 2,
  },
  monokai: {
    id: 'monokai', name: 'Monokai',
    colors: {
      background: '#272822', surface: '#2D2E27', surfaceHover: '#3E3D32',
      border: '#49483E', text: '#F8F8F2', textSecondary: '#A6A69C', textMuted: '#75715E',
      accent: '#A6E22E', accentHover: '#B6F23E',
      positive: '#A6E22E', negative: '#F92672', warning: '#E6DB74', info: '#66D9EF',
      chartBackground: '#272822', chartGrid: '#3E3D32', chartCrosshair: '#75715E',
      chartUpCandle: '#A6E22E', chartDownCandle: '#F92672', chartVolume: 'rgba(166,226,46,0.2)',
    },
    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
    fontSize: 13, borderRadius: 3, spacing: 4,
  },
  solarized: {
    id: 'solarized', name: 'Solarized Dark',
    colors: {
      background: '#002B36', surface: '#073642', surfaceHover: '#0A4050',
      border: '#586E75', text: '#839496', textSecondary: '#657B83', textMuted: '#586E75',
      accent: '#268BD2', accentHover: '#2AA1E8',
      positive: '#859900', negative: '#DC322F', warning: '#B58900', info: '#2AA198',
      chartBackground: '#002B36', chartGrid: '#073642', chartCrosshair: '#586E75',
      chartUpCandle: '#859900', chartDownCandle: '#DC322F', chartVolume: 'rgba(133,153,0,0.25)',
    },
    fontFamily: '"Source Code Pro", "Fira Code", monospace',
    fontSize: 13, borderRadius: 4, spacing: 4,
  },
  custom: {
    id: 'custom', name: 'Custom',
    colors: {
      background: '#131722', surface: '#1E222D', surfaceHover: '#2A2E39',
      border: '#363A45', text: '#D1D4DC', textSecondary: '#787B86', textMuted: '#4C525E',
      accent: '#2962FF', accentHover: '#1E53E5',
      positive: '#26A69A', negative: '#EF5350', warning: '#FF9800', info: '#2196F3',
      chartBackground: '#131722', chartGrid: '#1C2030', chartCrosshair: '#758696',
      chartUpCandle: '#26A69A', chartDownCandle: '#EF5350', chartVolume: 'rgba(76,175,80,0.3)',
    },
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13, borderRadius: 4, spacing: 4,
  },
};

// ─── Default Shortcuts ──────────────────────────────────────────────────────

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'ks1', action: 'Toggle Crosshair', keys: 'Alt+C', category: 'Chart', enabled: true, isCustom: false },
  { id: 'ks2', action: 'Zoom In', keys: 'Ctrl+=', category: 'Chart', enabled: true, isCustom: false },
  { id: 'ks3', action: 'Zoom Out', keys: 'Ctrl+-', category: 'Chart', enabled: true, isCustom: false },
  { id: 'ks4', action: 'Fit Screen', keys: 'Ctrl+Shift+F', category: 'Chart', enabled: true, isCustom: false },
  { id: 'ks5', action: 'Toggle Volume', keys: 'Alt+V', category: 'Chart', enabled: true, isCustom: false },
  { id: 'ks6', action: 'Undo Drawing', keys: 'Ctrl+Z', category: 'Drawing', enabled: true, isCustom: false },
  { id: 'ks7', action: 'Redo Drawing', keys: 'Ctrl+Y', category: 'Drawing', enabled: true, isCustom: false },
  { id: 'ks8', action: 'Delete Drawing', keys: 'Delete', category: 'Drawing', enabled: true, isCustom: false },
  { id: 'ks9', action: 'Trend Line', keys: 'Alt+T', category: 'Drawing', enabled: true, isCustom: false },
  { id: 'ks10', action: 'Horizontal Line', keys: 'Alt+H', category: 'Drawing', enabled: true, isCustom: false },
  { id: 'ks11', action: 'Buy Market', keys: 'Shift+B', category: 'Trading', enabled: true, isCustom: false },
  { id: 'ks12', action: 'Sell Market', keys: 'Shift+S', category: 'Trading', enabled: true, isCustom: false },
  { id: 'ks13', action: 'Cancel All Orders', keys: 'Ctrl+Shift+X', category: 'Trading', enabled: true, isCustom: false },
  { id: 'ks14', action: 'Flatten Position', keys: 'Ctrl+Shift+F', category: 'Trading', enabled: true, isCustom: false },
  { id: 'ks15', action: 'Command Palette', keys: 'Ctrl+K', category: 'Navigation', enabled: true, isCustom: false },
  { id: 'ks16', action: 'Symbol Search', keys: 'Ctrl+/', category: 'Navigation', enabled: true, isCustom: false },
  { id: 'ks17', action: 'Toggle Sidebar', keys: 'Ctrl+B', category: 'Navigation', enabled: true, isCustom: false },
  { id: 'ks18', action: 'Next Timeframe', keys: 'Alt+Right', category: 'Navigation', enabled: true, isCustom: false },
  { id: 'ks19', action: 'Previous Timeframe', keys: 'Alt+Left', category: 'Navigation', enabled: true, isCustom: false },
  { id: 'ks20', action: 'Screenshot', keys: 'Ctrl+Shift+S', category: 'General', enabled: true, isCustom: false },
];

// ─── Store State ────────────────────────────────────────────────────────────

interface SettingsStoreState {
  theme: ThemeConfig;
  customThemeColors: ThemeColors | null;

  chartDefaults: ChartDefaults;
  tradingDefaults: TradingDefaults;
  alertDefaults: AlertDefaults;
  displayPreferences: DisplayPreferences;
  performanceSettings: PerformanceSettings;
  accessibilitySettings: AccessibilitySettings;
  layoutPreferences: LayoutPreferences;
  dataPreferences: DataPreferences;
  keyboardShortcuts: KeyboardShortcut[];

  settingsVersion: number;
  lastSavedAt: number;
}

interface SettingsStoreActions {
  setTheme: (themeId: ThemeId) => void;
  setCustomThemeColor: (key: keyof ThemeColors, value: string) => void;
  setThemeFontFamily: (fontFamily: string) => void;
  setThemeFontSize: (fontSize: number) => void;
  setThemeBorderRadius: (radius: number) => void;

  updateChartDefaults: (updates: Partial<ChartDefaults>) => void;
  updateTradingDefaults: (updates: Partial<TradingDefaults>) => void;
  updateAlertDefaults: (updates: Partial<AlertDefaults>) => void;
  updateDisplayPreferences: (updates: Partial<DisplayPreferences>) => void;
  updatePerformanceSettings: (updates: Partial<PerformanceSettings>) => void;
  updateAccessibilitySettings: (updates: Partial<AccessibilitySettings>) => void;
  updateLayoutPreferences: (updates: Partial<LayoutPreferences>) => void;
  updateDataPreferences: (updates: Partial<DataPreferences>) => void;

  setShortcutKeys: (shortcutId: string, keys: string) => void;
  toggleShortcut: (shortcutId: string) => void;
  addCustomShortcut: (action: string, keys: string, category: string) => string;
  removeCustomShortcut: (shortcutId: string) => void;
  resetShortcuts: () => void;
  getShortcutByAction: (action: string) => KeyboardShortcut | undefined;

  exportSettings: () => string;
  importSettings: (json: string) => boolean;
  resetToDefaults: () => void;
  resetSection: (section: 'chart' | 'trading' | 'alert' | 'display' | 'performance' | 'accessibility' | 'layout' | 'data') => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CHART: ChartDefaults = {
  chartType: 'candlestick',
  timeframe: '1D',
  showVolume: true,
  showGrid: true,
  showCrosshair: true,
  showLegend: true,
  autoScale: true,
  logScale: false,
  defaultIndicators: [],
  upColor: '#26A69A',
  downColor: '#EF5350',
  lineColor: '#2962FF',
  areaColor: 'rgba(41,98,255,0.1)',
  volumeUpColor: 'rgba(38,166,154,0.3)',
  volumeDownColor: 'rgba(239,83,80,0.3)',
};

const DEFAULT_TRADING: TradingDefaults = {
  defaultOrderType: 'LIMIT',
  defaultTimeInForce: 'DAY',
  defaultQuantity: 100,
  quantityStep: 1,
  confirmOrders: true,
  confirmCancellations: false,
  showBracketByDefault: false,
  defaultStopLossPercent: 2,
  defaultTakeProfitPercent: 4,
  soundOnFill: true,
  soundOnReject: true,
  showPositionOnChart: true,
  showOrdersOnChart: true,
};

const DEFAULT_ALERT: AlertDefaults = {
  defaultSound: 'chime',
  defaultVolume: 0.7,
  popupEnabled: true,
  popupDuration: 5000,
  emailEnabled: false,
  pushEnabled: false,
  defaultFrequency: 'once',
  groupAlerts: true,
};

const DEFAULT_DISPLAY: DisplayPreferences = {
  numberFormat: 'standard',
  dateFormat: 'us',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: navigator.language ?? 'en-US',
  decimalPlaces: 2,
  thousandsSeparator: ',',
  use24HourTime: false,
  showMilliseconds: false,
  compactNumbers: true,
};

const DEFAULT_PERFORMANCE: PerformanceSettings = {
  enableAnimations: true,
  animationSpeed: 'normal',
  enableTransitions: true,
  enableBlur: true,
  enableShadows: true,
  maxVisibleCandles: 500,
  chartRenderQuality: 'high',
  dataThrottleMs: 100,
  maxConcurrentStreams: 10,
  enableHardwareAcceleration: true,
};

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  fontSize: 'medium',
  keyboardNavigation: true,
  focusIndicators: true,
  colorBlindMode: 'none',
};

const DEFAULT_LAYOUT: LayoutPreferences = {
  sidebarPosition: 'right',
  sidebarCollapsed: false,
  sidebarWidth: 320,
  headerVisible: true,
  footerVisible: true,
  statusBarVisible: true,
  toolbarPosition: 'left',
  compactMode: false,
  panelBorders: true,
  tabPosition: 'top',
};

const DEFAULT_DATA: DataPreferences = {
  autoRefresh: true,
  refreshIntervalMs: 1_000,
  preloadTimeframes: ['1D', '1h', '5m'],
  maxCachedBars: 10_000,
  enableWebSocket: true,
  reconnectOnDisconnect: true,
  dataQualityAlerts: true,
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStoreState & SettingsStoreActions>()(
  persist(
    immer((set, get) => ({
      theme: THEME_PRESETS.dark,
      customThemeColors: null,
      chartDefaults: DEFAULT_CHART,
      tradingDefaults: DEFAULT_TRADING,
      alertDefaults: DEFAULT_ALERT,
      displayPreferences: DEFAULT_DISPLAY,
      performanceSettings: DEFAULT_PERFORMANCE,
      accessibilitySettings: DEFAULT_ACCESSIBILITY,
      layoutPreferences: DEFAULT_LAYOUT,
      dataPreferences: DEFAULT_DATA,
      keyboardShortcuts: DEFAULT_SHORTCUTS,
      settingsVersion: 1,
      lastSavedAt: Date.now(),

      setTheme: (themeId) => {
        set((s) => {
          if (themeId === 'custom' && s.customThemeColors) {
            s.theme = { ...THEME_PRESETS.custom, colors: s.customThemeColors };
          } else {
            s.theme = { ...THEME_PRESETS[themeId] };
          }
          s.lastSavedAt = Date.now();
        });
      },

      setCustomThemeColor: (key, value) => {
        set((s) => {
          if (!s.customThemeColors) s.customThemeColors = { ...s.theme.colors };
          s.customThemeColors[key] = value;
          if (s.theme.id === 'custom') s.theme.colors[key] = value;
          s.lastSavedAt = Date.now();
        });
      },

      setThemeFontFamily: (fontFamily) => set((s) => { s.theme.fontFamily = fontFamily; s.lastSavedAt = Date.now(); }),
      setThemeFontSize: (fontSize) => set((s) => { s.theme.fontSize = Math.max(10, Math.min(20, fontSize)); s.lastSavedAt = Date.now(); }),
      setThemeBorderRadius: (radius) => set((s) => { s.theme.borderRadius = Math.max(0, Math.min(16, radius)); s.lastSavedAt = Date.now(); }),

      updateChartDefaults: (updates) => set((s) => { Object.assign(s.chartDefaults, updates); s.lastSavedAt = Date.now(); }),
      updateTradingDefaults: (updates) => set((s) => { Object.assign(s.tradingDefaults, updates); s.lastSavedAt = Date.now(); }),
      updateAlertDefaults: (updates) => set((s) => { Object.assign(s.alertDefaults, updates); s.lastSavedAt = Date.now(); }),
      updateDisplayPreferences: (updates) => set((s) => { Object.assign(s.displayPreferences, updates); s.lastSavedAt = Date.now(); }),
      updatePerformanceSettings: (updates) => set((s) => { Object.assign(s.performanceSettings, updates); s.lastSavedAt = Date.now(); }),
      updateAccessibilitySettings: (updates) => set((s) => { Object.assign(s.accessibilitySettings, updates); s.lastSavedAt = Date.now(); }),
      updateLayoutPreferences: (updates) => set((s) => { Object.assign(s.layoutPreferences, updates); s.lastSavedAt = Date.now(); }),
      updateDataPreferences: (updates) => set((s) => { Object.assign(s.dataPreferences, updates); s.lastSavedAt = Date.now(); }),

      setShortcutKeys: (shortcutId, keys) => {
        set((s) => {
          const sc = s.keyboardShortcuts.find((k) => k.id === shortcutId);
          if (sc) { sc.keys = keys; sc.isCustom = true; }
          s.lastSavedAt = Date.now();
        });
      },

      toggleShortcut: (shortcutId) => {
        set((s) => {
          const sc = s.keyboardShortcuts.find((k) => k.id === shortcutId);
          if (sc) sc.enabled = !sc.enabled;
          s.lastSavedAt = Date.now();
        });
      },

      addCustomShortcut: (action, keys, category) => {
        const id = `ks_${Date.now()}`;
        set((s) => {
          s.keyboardShortcuts.push({ id, action, keys, category, enabled: true, isCustom: true });
          s.lastSavedAt = Date.now();
        });
        return id;
      },

      removeCustomShortcut: (shortcutId) => {
        set((s) => {
          const idx = s.keyboardShortcuts.findIndex((k) => k.id === shortcutId && k.isCustom);
          if (idx !== -1) s.keyboardShortcuts.splice(idx, 1);
          s.lastSavedAt = Date.now();
        });
      },

      resetShortcuts: () => set((s) => { s.keyboardShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)); s.lastSavedAt = Date.now(); }),

      getShortcutByAction: (action) => {
        return get().keyboardShortcuts.find((k) => k.action === action && k.enabled);
      },

      exportSettings: () => {
        const state = get();
        return JSON.stringify({
          version: state.settingsVersion,
          theme: state.theme,
          customThemeColors: state.customThemeColors,
          chartDefaults: state.chartDefaults,
          tradingDefaults: state.tradingDefaults,
          alertDefaults: state.alertDefaults,
          displayPreferences: state.displayPreferences,
          performanceSettings: state.performanceSettings,
          accessibilitySettings: state.accessibilitySettings,
          layoutPreferences: state.layoutPreferences,
          dataPreferences: state.dataPreferences,
          keyboardShortcuts: state.keyboardShortcuts,
        }, null, 2);
      },

      importSettings: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data.version) return false;
          set((s) => {
            if (data.theme) s.theme = data.theme;
            if (data.customThemeColors) s.customThemeColors = data.customThemeColors;
            if (data.chartDefaults) Object.assign(s.chartDefaults, data.chartDefaults);
            if (data.tradingDefaults) Object.assign(s.tradingDefaults, data.tradingDefaults);
            if (data.alertDefaults) Object.assign(s.alertDefaults, data.alertDefaults);
            if (data.displayPreferences) Object.assign(s.displayPreferences, data.displayPreferences);
            if (data.performanceSettings) Object.assign(s.performanceSettings, data.performanceSettings);
            if (data.accessibilitySettings) Object.assign(s.accessibilitySettings, data.accessibilitySettings);
            if (data.layoutPreferences) Object.assign(s.layoutPreferences, data.layoutPreferences);
            if (data.dataPreferences) Object.assign(s.dataPreferences, data.dataPreferences);
            if (data.keyboardShortcuts) s.keyboardShortcuts = data.keyboardShortcuts;
            s.lastSavedAt = Date.now();
          });
          return true;
        } catch {
          return false;
        }
      },

      resetToDefaults: () => {
        set((s) => {
          s.theme = THEME_PRESETS.dark;
          s.customThemeColors = null;
          s.chartDefaults = { ...DEFAULT_CHART };
          s.tradingDefaults = { ...DEFAULT_TRADING };
          s.alertDefaults = { ...DEFAULT_ALERT };
          s.displayPreferences = { ...DEFAULT_DISPLAY };
          s.performanceSettings = { ...DEFAULT_PERFORMANCE };
          s.accessibilitySettings = { ...DEFAULT_ACCESSIBILITY };
          s.layoutPreferences = { ...DEFAULT_LAYOUT };
          s.dataPreferences = { ...DEFAULT_DATA };
          s.keyboardShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
          s.lastSavedAt = Date.now();
        });
      },

      resetSection: (section) => {
        set((s) => {
          switch (section) {
            case 'chart': s.chartDefaults = { ...DEFAULT_CHART }; break;
            case 'trading': s.tradingDefaults = { ...DEFAULT_TRADING }; break;
            case 'alert': s.alertDefaults = { ...DEFAULT_ALERT }; break;
            case 'display': s.displayPreferences = { ...DEFAULT_DISPLAY }; break;
            case 'performance': s.performanceSettings = { ...DEFAULT_PERFORMANCE }; break;
            case 'accessibility': s.accessibilitySettings = { ...DEFAULT_ACCESSIBILITY }; break;
            case 'layout': s.layoutPreferences = { ...DEFAULT_LAYOUT }; break;
            case 'data': s.dataPreferences = { ...DEFAULT_DATA }; break;
          }
          s.lastSavedAt = Date.now();
        });
      },
    })),
    {
      name: 'tv-settings',
      version: 1,
    },
  ),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectTheme = (s: SettingsStoreState) => s.theme;
export const selectThemeColors = (s: SettingsStoreState) => s.theme.colors;
export const selectChartDefaults = (s: SettingsStoreState) => s.chartDefaults;
export const selectTradingDefaults = (s: SettingsStoreState) => s.tradingDefaults;
export const selectAlertDefaults = (s: SettingsStoreState) => s.alertDefaults;
export const selectDisplayPreferences = (s: SettingsStoreState) => s.displayPreferences;
export const selectPerformanceSettings = (s: SettingsStoreState) => s.performanceSettings;
export const selectAccessibility = (s: SettingsStoreState) => s.accessibilitySettings;
export const selectLayoutPreferences = (s: SettingsStoreState) => s.layoutPreferences;

export const selectShortcutsByCategory = (category: string) => (s: SettingsStoreState) =>
  s.keyboardShortcuts.filter((k) => k.category === category);

export const selectEnabledShortcuts = (s: SettingsStoreState) =>
  s.keyboardShortcuts.filter((k) => k.enabled);

export const selectIsDarkTheme = (s: SettingsStoreState) =>
  s.theme.id === 'dark' || s.theme.id === 'bloomberg' || s.theme.id === 'monokai' || s.theme.id === 'solarized';

export { THEME_PRESETS };
