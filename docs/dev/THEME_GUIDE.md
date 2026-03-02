# Theme Guide

Adding and customizing themes in Apex Terminal.

## Table of Contents

- [Theme Architecture](#theme-architecture)
- [Token Structure](#token-structure)
- [Adding a New Theme](#adding-a-new-theme)
- [Chart Theme Integration](#chart-theme-integration)
- [Component Theme Variants](#component-theme-variants)
- [Using the useTheme Hook](#using-the-usetheme-hook)
- [Testing Theme Changes](#testing-theme-changes)
- [Conventions](#conventions)
- [Do's and Don'ts](#dos-and-donts)

## Theme Architecture

Themes are defined in `frontend/src/lib/platform/theme.ts` and applied via CSS custom properties on the `:root` element. The flow:

1. **Theme definition** — a plain object mapping token names to values.
2. **Theme store** — `settingsStore` persists the active theme name.
3. **useTheme hook** — reads the active theme, applies CSS variables, provides a setter.
4. **Components** — consume tokens via Tailwind classes or `var(--token)`.

```
theme.ts (definitions) → settingsStore (persistence) → useTheme (application) → CSS vars → UI
```

## Token Structure

Tokens are organized by category. Each theme must provide all tokens:

```typescript
export interface ThemeTokens {
  // Backgrounds
  bgPrimary: string;        // Main app background
  bgSecondary: string;      // Panel/card background
  bgTertiary: string;       // Nested elements, inputs
  bgHover: string;          // Hover state background
  bgActive: string;         // Active/selected background

  // Text
  textPrimary: string;      // Main content text
  textSecondary: string;    // Muted/label text
  textTertiary: string;     // Disabled/hint text
  textAccent: string;       // Links, active tabs

  // Borders
  borderPrimary: string;    // Panel borders
  borderSecondary: string;  // Subtle dividers
  borderFocus: string;      // Focus ring color

  // Semantic
  bullish: string;          // Green — price up, profit
  bearish: string;          // Red — price down, loss
  warning: string;          // Yellow — alerts, cautions
  info: string;             // Blue — informational

  // Chart-specific
  chartBg: string;
  chartGrid: string;
  chartCrosshair: string;
  chartText: string;
  chartUpCandle: string;
  chartDownCandle: string;
  chartUpWick: string;
  chartDownWick: string;
  chartVolumeUp: string;
  chartVolumeDown: string;
}
```

## Adding a New Theme

1. Open `frontend/src/lib/platform/theme.ts`.
2. Add a new theme object implementing `ThemeTokens`:

```typescript
export const midnightTheme: ThemeTokens = {
  bgPrimary: '#0a0a1a',
  bgSecondary: '#12122a',
  bgTertiary: '#1a1a3a',
  bgHover: '#22224a',
  bgActive: '#2a2a5a',

  textPrimary: '#e0e0f0',
  textSecondary: '#8888aa',
  textTertiary: '#555577',
  textAccent: '#6366f1',

  borderPrimary: '#2a2a4a',
  borderSecondary: '#1e1e3e',
  borderFocus: '#6366f1',

  bullish: '#10b981',
  bearish: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  chartBg: '#0a0a1a',
  chartGrid: '#1a1a3a',
  chartCrosshair: '#6366f1',
  chartText: '#8888aa',
  chartUpCandle: '#10b981',
  chartDownCandle: '#ef4444',
  chartUpWick: '#10b981',
  chartDownWick: '#ef4444',
  chartVolumeUp: 'rgba(16,185,129,0.3)',
  chartVolumeDown: 'rgba(239,68,68,0.3)',
};
```

3. Register it in the theme map:

```typescript
export const THEMES: Record<string, ThemeTokens> = {
  dark: darkTheme,
  light: lightTheme,
  midnight: midnightTheme,  // ← new theme
};
```

4. The `useTheme` hook applies tokens as CSS custom properties automatically:

```typescript
function applyTheme(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${camelToKebab(key)}`, value);
  }
}
```

## Chart Theme Integration

When the theme changes, chart colors must update too. The chart store's `DEFAULT_SETTINGS` reads from theme tokens:

```typescript
import { useTheme } from '@/hooks/useTheme';

function ChartContainer({ chartId }: { chartId: string }) {
  const { tokens } = useTheme();
  const updateSettings = useChartStore((s) => s.updateChartSettings);

  useEffect(() => {
    updateSettings(chartId, {
      backgroundColor: tokens.chartBg,
      gridColor: tokens.chartGrid,
      upColor: tokens.chartUpCandle,
      downColor: tokens.chartDownCandle,
      crosshairColor: tokens.chartCrosshair,
      textColor: tokens.chartText,
    });
  }, [tokens, chartId, updateSettings]);
}
```

For lightweight-charts, apply options on the chart instance:

```typescript
chart.applyOptions({
  layout: { background: { color: tokens.chartBg }, textColor: tokens.chartText },
  grid: {
    vertLines: { color: tokens.chartGrid },
    horzLines: { color: tokens.chartGrid },
  },
  crosshair: { vertLine: { color: tokens.chartCrosshair }, horzLine: { color: tokens.chartCrosshair } },
});
```

## Component Theme Variants

Components consume theme tokens through CSS variables in Tailwind:

```css
/* In global CSS or Tailwind config */
:root {
  --bg-primary: #131722;
  --text-primary: #d1d4dc;
}
```

```typescript
// In Tailwind v4 config, map tokens to utility classes
<div className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
  ...
</div>
```

For components with theme-dependent logic:

```typescript
const { themeName } = useTheme();
const chartWatermark = themeName === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)';
```

## Using the useTheme Hook

```typescript
import { useTheme } from '@/hooks/useTheme';

function SettingsPanel() {
  const { themeName, tokens, setTheme, availableThemes } = useTheme();

  return (
    <div>
      <label>Theme</label>
      <select value={themeName} onChange={(e) => setTheme(e.target.value)}>
        {availableThemes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div style={{ backgroundColor: tokens.bgPrimary, color: tokens.textPrimary }}>
        Preview
      </div>
    </div>
  );
}
```

## Testing Theme Changes

1. **Visual regression** — After adding a theme, take screenshots of key pages and compare.
2. **Contrast check** — Verify all text/background combos meet WCAG AA (4.5:1).
3. **Unit test** — Ensure all themes provide every token:

```typescript
import { describe, it, expect } from 'vitest';
import { THEMES, type ThemeTokens } from '@/lib/platform/theme';

const requiredKeys: (keyof ThemeTokens)[] = [
  'bgPrimary', 'bgSecondary', 'textPrimary', 'bullish', 'bearish',
  'chartBg', 'chartUpCandle', 'chartDownCandle',
];

describe('themes', () => {
  for (const [name, tokens] of Object.entries(THEMES)) {
    it(`${name} theme has all required tokens`, () => {
      for (const key of requiredKeys) {
        expect(tokens[key], `Missing ${key} in ${name}`).toBeDefined();
      }
    });
  }
});
```

## Conventions

- Token names are camelCase in TypeScript, kebab-case as CSS properties.
- All colors use hex (`#131722`) or rgba for transparency.
- Chart colors live under `chart*` prefix to separate from UI colors.
- Theme files should not import React — they are pure data.

## Do's and Don'ts

**Do:**
- Add all tokens when creating a new theme — the TypeScript interface enforces this
- Test themes with both small and large datasets visible
- Use CSS variables for any color that should change with the theme
- Keep chart theme in sync by re-applying options when tokens change

**Don't:**
- Hardcode hex colors in component files — use tokens or CSS variables
- Mix theme tokens with Tailwind's default color palette in the same element
- Create theme-specific CSS files — one set of variables handles all themes
- Forget to update chart instances when the theme changes
