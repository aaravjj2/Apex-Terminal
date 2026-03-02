/**
 * useTheme.ts
 * Theme management hook with theme switching, custom theme creation,
 * CSS variable injection, system preference detection, color utilities,
 * and contrast ratio checking for accessibility.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  up: string;
  down: string;
  unchanged: string;
  chartBackground: string;
  chartGrid: string;
  chartCrosshair: string;
  chartText: string;
}

export interface Theme {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: ThemeColors;
  borderRadius: string;
  fontFamily: string;
  monoFontFamily: string;
  fontSize: number;
  spacing: number;
  custom?: boolean;
}

export interface UseThemeOptions {
  storageKey?: string;
  defaultTheme?: string;
  onThemeChange?: (theme: Theme) => void;
}

// ─── Built-in Themes ───────────────────────────────────────────────────────────

const THEMES: Record<string, Theme> = {
  bloomberg: {
    id: 'bloomberg', name: 'Bloomberg Dark', mode: 'dark',
    colors: {
      primary: '#ff8c00', secondary: '#1a1a2e', accent: '#ff6600',
      background: '#000000', surface: '#0d0d1a', surfaceHover: '#1a1a2e',
      border: '#2a2a3e', text: '#e8e8e8', textSecondary: '#b0b0b0', textMuted: '#666680',
      success: '#00c087', error: '#ff4976', warning: '#ffb700', info: '#3b82f6',
      up: '#00c087', down: '#ff4976', unchanged: '#888888',
      chartBackground: '#000000', chartGrid: '#1a1a2e', chartCrosshair: '#555555', chartText: '#9ca3af',
    },
    borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif',
    monoFontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13, spacing: 4,
  },
  apex: {
    id: 'apex', name: 'Apex Terminal', mode: 'dark',
    colors: {
      primary: '#6366f1', secondary: '#0f172a', accent: '#8b5cf6',
      background: '#0a0a0f', surface: '#111827', surfaceHover: '#1f2937',
      border: '#374151', text: '#f9fafb', textSecondary: '#d1d5db', textMuted: '#6b7280',
      success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
      up: '#10b981', down: '#ef4444', unchanged: '#6b7280',
      chartBackground: '#0a0a0f', chartGrid: '#1e293b', chartCrosshair: '#475569', chartText: '#94a3b8',
    },
    borderRadius: '6px', fontFamily: 'Inter, system-ui, sans-serif',
    monoFontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13, spacing: 4,
  },
  light: {
    id: 'light', name: 'Light Mode', mode: 'light',
    colors: {
      primary: '#2563eb', secondary: '#f1f5f9', accent: '#7c3aed',
      background: '#ffffff', surface: '#f8fafc', surfaceHover: '#f1f5f9',
      border: '#e2e8f0', text: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8',
      success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb',
      up: '#16a34a', down: '#dc2626', unchanged: '#71717a',
      chartBackground: '#ffffff', chartGrid: '#f1f5f9', chartCrosshair: '#94a3b8', chartText: '#475569',
    },
    borderRadius: '6px', fontFamily: 'Inter, system-ui, sans-serif',
    monoFontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 13, spacing: 4,
  },
  midnight: {
    id: 'midnight', name: 'Midnight Blue', mode: 'dark',
    colors: {
      primary: '#60a5fa', secondary: '#0c1222', accent: '#818cf8',
      background: '#060a14', surface: '#0c1222', surfaceHover: '#162036',
      border: '#1e3050', text: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b',
      success: '#34d399', error: '#f87171', warning: '#fbbf24', info: '#60a5fa',
      up: '#34d399', down: '#f87171', unchanged: '#64748b',
      chartBackground: '#060a14', chartGrid: '#0f1b2e', chartCrosshair: '#334155', chartText: '#94a3b8',
    },
    borderRadius: '8px', fontFamily: 'Inter, system-ui, sans-serif',
    monoFontFamily: 'Fira Code, monospace', fontSize: 13, spacing: 4,
  },
};

// ─── Color Utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.replace('#', '').match(/.{2}/g);
  if (!match || match.length < 3) return null;
  return [parseInt(match[0], 16), parseInt(match[1], 16), parseInt(match[2], 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return 0;
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG(fgColor: string, bgColor: string, level: 'AA' | 'AAA' = 'AA', largeText = false): boolean {
  const ratio = getContrastRatio(fgColor, bgColor);
  if (level === 'AAA') return largeText ? ratio >= 4.5 : ratio >= 7;
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb[0] + (255 - rgb[0]) * amount,
    rgb[1] + (255 - rgb[1]) * amount,
    rgb[2] + (255 - rgb[2]) * amount,
  );
}

export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount));
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(options: UseThemeOptions = {}) {
  const {
    storageKey = 'apex_theme',
    defaultTheme = 'bloomberg',
    onThemeChange,
  } = options;

  const [themeId, setThemeId] = useState<string>(() => {
    try { return localStorage.getItem(`${storageKey}_id`) ?? defaultTheme; } catch { return defaultTheme; }
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(`${storageKey}_mode`) as ThemeMode) ?? 'dark'; } catch { return 'dark'; }
  });
  const [customThemes, setCustomThemes] = useState<Map<string, Theme>>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}_custom`);
      if (stored) {
        const arr: Theme[] = JSON.parse(stored);
        return new Map(arr.map(t => [t.id, t]));
      }
    } catch {}
    return new Map();
  });

  const systemDarkRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      systemDarkRef.current = e.matches;
      if (themeMode === 'system') {
        const resolved = e.matches ? 'bloomberg' : 'light';
        setThemeId(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeMode]);

  const allThemes = useMemo(() => {
    const combined = new Map(Object.entries(THEMES));
    customThemes.forEach((t, id) => combined.set(id, t));
    return combined;
  }, [customThemes]);

  const currentTheme = useMemo((): Theme => {
    if (themeMode === 'system') {
      return allThemes.get(systemDarkRef.current ? 'bloomberg' : 'light') ?? THEMES.bloomberg;
    }
    return allThemes.get(themeId) ?? THEMES.bloomberg;
  }, [themeId, themeMode, allThemes]);

  // ── CSS Variable Injection ──

  useEffect(() => {
    const root = document.documentElement;
    const { colors } = currentTheme;

    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    root.style.setProperty('--border-radius', currentTheme.borderRadius);
    root.style.setProperty('--font-family', currentTheme.fontFamily);
    root.style.setProperty('--mono-font-family', currentTheme.monoFontFamily);
    root.style.setProperty('--font-size', `${currentTheme.fontSize}px`);
    root.style.setProperty('--spacing', `${currentTheme.spacing}px`);

    root.setAttribute('data-theme', currentTheme.id);
    root.setAttribute('data-theme-mode', currentTheme.mode);

    onThemeChange?.(currentTheme);
  }, [currentTheme, onThemeChange]);

  // ── Persistence ──

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_id`, themeId);
      localStorage.setItem(`${storageKey}_mode`, themeMode);
    } catch {}
  }, [themeId, themeMode, storageKey]);

  // ── Theme API ──

  const switchTheme = useCallback((id: string) => {
    setThemeId(id);
    setThemeMode(allThemes.get(id)?.mode === 'light' ? 'light' : 'dark');
  }, [allThemes]);

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    if (mode === 'light') setThemeId('light');
    else if (mode === 'dark') setThemeId(prev => THEMES[prev]?.mode === 'dark' ? prev : 'bloomberg');
  }, []);

  const createTheme = useCallback((theme: Omit<Theme, 'custom'>): Theme => {
    const newTheme: Theme = { ...theme, custom: true };
    setCustomThemes(prev => {
      const next = new Map(prev).set(theme.id, newTheme);
      try { localStorage.setItem(`${storageKey}_custom`, JSON.stringify(Array.from(next.values()))); } catch {}
      return next;
    });
    return newTheme;
  }, [storageKey]);

  const deleteCustomTheme = useCallback((id: string) => {
    setCustomThemes(prev => {
      const next = new Map(prev);
      next.delete(id);
      try { localStorage.setItem(`${storageKey}_custom`, JSON.stringify(Array.from(next.values()))); } catch {}
      return next;
    });
    if (themeId === id) setThemeId(defaultTheme);
  }, [storageKey, themeId, defaultTheme]);

  const getColor = useCallback((key: keyof ThemeColors): string => {
    return currentTheme.colors[key];
  }, [currentTheme]);

  const isDark = currentTheme.mode === 'dark';

  const availableThemes = useMemo(() => Array.from(allThemes.values()), [allThemes]);

  return {
    theme: currentTheme,
    themeId, themeMode, isDark,
    availableThemes,
    switchTheme, setMode,
    createTheme, deleteCustomTheme,
    getColor,
    getContrastRatio, meetsWCAG: (fg: string, bg: string) => meetsWCAG(fg, bg),
    lighten, darken, withAlpha,
  };
}

export default useTheme;
