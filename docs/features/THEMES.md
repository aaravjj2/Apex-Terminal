# Theme Customization

Dark, light, and midnight themes with CSS custom properties, design tokens, custom theme creation, live preview, and automatic dark mode switching.

## Table of Contents

- [Overview](#overview)
- [Built-in Themes](#built-in-themes)
- [CSS Custom Properties](#css-custom-properties)
- [Design Tokens](#design-tokens)
- [Custom Theme Creation](#custom-theme-creation)
- [Theme Preview](#theme-preview)
- [Auto Dark Mode](#auto-dark-mode)
- [Chart Theming](#chart-theming)
- [Store Integration](#store-integration)

## Overview

The theme system (`lib/platform/theme.ts`) provides a comprehensive visual customization layer for the entire Apex Terminal interface. Themes control colors, typography, spacing, border radii, shadows, and chart colors through a unified token system.

```typescript
import { ThemeManager } from '@/lib/platform/theme';
import { useTheme } from '@/hooks/useTheme';

const { currentTheme, setTheme, createCustomTheme } = useTheme();
```

## Built-in Themes

Three production-ready themes ship by default:

### Dark (default)

Deep charcoal backgrounds optimized for extended screen time. High contrast text with muted secondary elements reduces eye strain in low-light trading environments.

### Light

Clean white backgrounds with subtle gray accents for well-lit environments. Maintains strong contrast ratios for readability under direct lighting.

### Midnight

Ultra-dark theme with deep navy/black backgrounds and vibrant accent colors. Designed for multi-monitor setups in dark rooms where maximum contrast aids rapid information scanning.

```typescript
type BuiltinTheme = 'dark' | 'light' | 'midnight';

setTheme('midnight');
```

## CSS Custom Properties

All theme values flow through CSS custom properties for instant switching without re-renders:

```css
:root[data-theme="dark"] {
  /* Backgrounds */
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d27;
  --bg-tertiary: #242836;
  --bg-elevated: #2a2e3d;
  --bg-overlay: rgba(0, 0, 0, 0.6);

  /* Text */
  --text-primary: #e5e7eb;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --text-inverse: #0f1117;

  /* Accents */
  --accent-primary: #3b82f6;
  --accent-secondary: #8b5cf6;
  --accent-success: #10b981;
  --accent-danger: #ef4444;
  --accent-warning: #f59e0b;

  /* Market Colors */
  --color-bullish: #10b981;
  --color-bearish: #ef4444;
  --color-neutral: #6b7280;
  --color-volume: #3b82f680;

  /* Borders & Shadows */
  --border-primary: #2a2e3d;
  --border-subtle: #1f2330;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.8125rem;
  --font-size-base: 0.875rem;

  /* Spacing */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

Components reference these properties via Tailwind utilities or direct CSS — theme switches are instantaneous with zero JavaScript overhead.

## Design Tokens

Structured token system that maps semantic meanings to visual values:

```typescript
interface ThemeTokens {
  colors: {
    bg: { primary: string; secondary: string; tertiary: string; elevated: string };
    text: { primary: string; secondary: string; muted: string };
    accent: { primary: string; secondary: string; success: string; danger: string; warning: string };
    market: { bullish: string; bearish: string; neutral: string; volume: string };
    border: { primary: string; subtle: string };
  };
  typography: {
    fontFamily: { sans: string; mono: string };
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
    lineHeight: Record<string, string>;
  };
  spacing: {
    panelGap: string;
    contentPadding: string;
    sectionGap: string;
  };
  effects: {
    shadow: Record<string, string>;
    radius: Record<string, string>;
    blur: Record<string, string>;
  };
}
```

Tokens enforce consistency — components never hardcode color values, always referencing tokens.

## Custom Theme Creation

Build custom themes by extending a base theme:

```typescript
const customTheme = createCustomTheme({
  name: 'Ocean',
  base: 'dark',
  overrides: {
    colors: {
      bg: { primary: '#0a1628', secondary: '#0f2035', tertiary: '#163050' },
      accent: { primary: '#06b6d4', secondary: '#0891b2' },
      market: { bullish: '#22d3ee', bearish: '#f43f5e' },
    },
    effects: {
      radius: { sm: '6px', md: '10px', lg: '14px' },
    },
  },
});

ThemeManager.registerTheme(customTheme);
setTheme('ocean');
```

Only overridden values change — everything else inherits from the base theme.

## Theme Preview

Live preview custom themes before applying:

```typescript
const { previewTheme, applyPreview, cancelPreview } = useTheme();

previewTheme({
  name: 'preview',
  base: 'dark',
  overrides: {
    colors: {
      accent: { primary: '#f59e0b' },
    },
  },
});
// UI updates immediately with preview theme
// Changes are temporary until explicitly applied

applyPreview();   // save and persist
// or
cancelPreview();  // revert to previous theme
```

The preview mode injects temporary CSS properties that revert cleanly on cancellation.

## Auto Dark Mode

Automatic theme switching based on system preference or time of day:

```typescript
interface AutoThemeConfig {
  enabled: boolean;
  mode: 'system' | 'scheduled';
  lightTheme: string;
  darkTheme: string;
  schedule?: {
    lightStart: '07:00';
    darkStart: '19:00';
    timezone: string;
  };
}

ThemeManager.configureAutoSwitch({
  enabled: true,
  mode: 'system',              // follows OS dark mode preference
  lightTheme: 'light',
  darkTheme: 'midnight',
});
```

System mode uses `prefers-color-scheme` media query with a `matchMedia` listener for instant response. Scheduled mode uses time-based switching with configurable transition times.

## Chart Theming

Chart-specific theme properties for lightweight-charts integration:

```typescript
interface ChartTheme {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  crosshairColor: string;
  candleUp: string;
  candleDown: string;
  wickUp: string;
  wickDown: string;
  volumeUp: string;
  volumeDown: string;
  indicatorColors: string[];   // palette for overlaid indicators
  annotationColor: string;
}

const chartTheme = ThemeManager.getChartTheme();
// Maps current theme tokens to lightweight-charts color options
```

Chart colors automatically update on theme change. The indicator color palette provides 10 visually distinct colors for simultaneously displayed indicators.

## Store Integration

The `settingsStore` theme slice manages theme persistence:

```typescript
interface ThemeState {
  currentTheme: string;
  customThemes: Record<string, ThemeDefinition>;
  autoSwitch: AutoThemeConfig;
  setTheme: (themeId: string) => void;
  createCustomTheme: (theme: ThemeDefinition) => void;
  deleteCustomTheme: (themeId: string) => void;
  configureAutoSwitch: (config: AutoThemeConfig) => void;
  exportTheme: (themeId: string) => string;     // JSON string
  importTheme: (json: string) => void;
}
```

Custom themes export as JSON for sharing. Theme preferences persist in the settings store and sync across tabs.
