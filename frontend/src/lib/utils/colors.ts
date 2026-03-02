// ============================================================================
// Types
// ============================================================================

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }
export interface RGBA extends RGB { a: number }

export interface ColorScale {
  name: string;
  colors: string[];
  type: 'sequential' | 'diverging' | 'qualitative';
}

// ============================================================================
// Color Palettes
// ============================================================================

export const PALETTES = {
  bloomberg: {
    bg: '#0B0E11',
    surface: '#1C2127',
    border: '#2D333B',
    text: '#E6EDF3',
    textSecondary: '#8B949E',
    accent: '#FF8700',
    positive: '#3FB950',
    negative: '#F85149',
    neutral: '#8B949E',
    info: '#58A6FF',
    warning: '#D29922',
    chart: ['#FF8700', '#58A6FF', '#3FB950', '#F85149', '#D29922', '#BC8CFF',
            '#39D2C0', '#F778BA', '#79C0FF', '#FFA657', '#7EE787', '#FF7B72'],
  },
  tradingview: {
    bg: '#131722',
    surface: '#1E222D',
    border: '#2A2E39',
    text: '#D1D4DC',
    textSecondary: '#787B86',
    accent: '#2962FF',
    positive: '#26A69A',
    negative: '#EF5350',
    neutral: '#787B86',
    info: '#2196F3',
    warning: '#FF9800',
    chart: ['#2962FF', '#26A69A', '#EF5350', '#FF9800', '#AB47BC', '#42A5F5',
            '#66BB6A', '#FFA726', '#EC407A', '#7E57C2', '#26C6DA', '#D4E157'],
  },
  light: {
    bg: '#FFFFFF',
    surface: '#F8F9FA',
    border: '#E1E4E8',
    text: '#24292F',
    textSecondary: '#57606A',
    accent: '#0969DA',
    positive: '#1A7F37',
    negative: '#CF222E',
    neutral: '#57606A',
    info: '#0550AE',
    warning: '#9A6700',
    chart: ['#0969DA', '#1A7F37', '#CF222E', '#9A6700', '#8250DF', '#0550AE',
            '#116329', '#A40E26', '#7D4E00', '#6639BA', '#023B95', '#0E4429'],
  },
  dark: {
    bg: '#0D1117',
    surface: '#161B22',
    border: '#30363D',
    text: '#C9D1D9',
    textSecondary: '#8B949E',
    accent: '#58A6FF',
    positive: '#3FB950',
    negative: '#F85149',
    neutral: '#8B949E',
    info: '#58A6FF',
    warning: '#D29922',
    chart: ['#58A6FF', '#3FB950', '#F85149', '#D29922', '#BC8CFF', '#79C0FF',
            '#7EE787', '#FF7B72', '#FFA657', '#D2A8FF', '#39D2C0', '#F778BA'],
  },
  highContrast: {
    bg: '#000000',
    surface: '#111111',
    border: '#444444',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    accent: '#1AEBFF',
    positive: '#00FF41',
    negative: '#FF0040',
    neutral: '#CCCCCC',
    info: '#1AEBFF',
    warning: '#FFD700',
    chart: ['#1AEBFF', '#00FF41', '#FF0040', '#FFD700', '#FF69B4', '#00CED1',
            '#ADFF2F', '#FF6347', '#7B68EE', '#FF8C00', '#32CD32', '#FF1493'],
  },
} as const;

export type PaletteName = keyof typeof PALETTES;

// ============================================================================
// Diverging Color Scales
// ============================================================================

export const DIVERGING_SCALES: Record<string, ColorScale> = {
  redGreen: {
    name: 'Red-Green',
    type: 'diverging',
    colors: ['#FF1744', '#FF5252', '#FF8A80', '#E0E0E0', '#B9F6CA', '#69F0AE', '#00E676'],
  },
  blueOrange: {
    name: 'Blue-Orange',
    type: 'diverging',
    colors: ['#0D47A1', '#1976D2', '#64B5F6', '#E0E0E0', '#FFB74D', '#F57C00', '#E65100'],
  },
  purpleGreen: {
    name: 'Purple-Green',
    type: 'diverging',
    colors: ['#6A1B9A', '#9C27B0', '#CE93D8', '#E0E0E0', '#A5D6A7', '#4CAF50', '#2E7D32'],
  },
};

export const SEQUENTIAL_SCALES: Record<string, ColorScale> = {
  blues: {
    name: 'Blues',
    type: 'sequential',
    colors: ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1976D2', '#1565C0', '#0D47A1'],
  },
  greens: {
    name: 'Greens',
    type: 'sequential',
    colors: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32'],
  },
  reds: {
    name: 'Reds',
    type: 'sequential',
    colors: ['#FFEBEE', '#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828'],
  },
  heat: {
    name: 'Heat',
    type: 'sequential',
    colors: ['#000033', '#000088', '#0000FF', '#00AAFF', '#00FF00', '#AAFF00', '#FFFF00', '#FFAA00', '#FF0000'],
  },
};

// ============================================================================
// Color Conversion
// ============================================================================

export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360; s /= 100; l /= 100;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

// ============================================================================
// Color Operations
// ============================================================================

export function alphaBlend(fg: RGBA, bg: RGB): RGB {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}

export function colorInterpolate(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1), c2 = hexToRgb(color2);
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t,
  });
}

export function multiColorInterpolate(colors: string[], t: number): string {
  const n = colors.length - 1;
  const idx = Math.min(Math.floor(t * n), n - 1);
  const localT = t * n - idx;
  return colorInterpolate(colors[idx], colors[idx + 1], localT);
}

export function lighten(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  hsl.l = Math.min(100, hsl.l + amount);
  return hslToHex(hsl);
}

export function darken(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  hsl.l = Math.max(0, hsl.l - amount);
  return hslToHex(hsl);
}

export function setAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return hex.replace(/^#([a-f\d]{6})$/i, `#$1${a}`);
}

// ============================================================================
// WCAG Contrast Ratio
// ============================================================================

function relativeLuminance({ r, g, b }: RGB): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(hexToRgb(color1));
  const l2 = relativeLuminance(hexToRgb(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG_AA(foreground: string, background: string, largeText = false): boolean {
  const ratio = contrastRatio(foreground, background);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

export function meetsWCAG_AAA(foreground: string, background: string, largeText = false): boolean {
  const ratio = contrastRatio(foreground, background);
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

// ============================================================================
// Heat Map Colors
// ============================================================================

export function heatMapColor(value: number, min: number, max: number, scale = SEQUENTIAL_SCALES.heat): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return multiColorInterpolate(scale.colors, t);
}

export function performanceColor(value: number, theme: PaletteName = 'tradingview'): string {
  const palette = PALETTES[theme];
  if (value > 0) return palette.positive;
  if (value < 0) return palette.negative;
  return palette.neutral;
}

export function performanceColorGradient(
  value: number,
  maxAbsValue: number,
  theme: PaletteName = 'tradingview'
): string {
  const palette = PALETTES[theme];
  const t = Math.min(1, Math.abs(value) / maxAbsValue);
  if (value > 0) return colorInterpolate(palette.neutral, palette.positive, t);
  if (value < 0) return colorInterpolate(palette.neutral, palette.negative, t);
  return palette.neutral;
}

// ============================================================================
// Sector & Asset Class Colors
// ============================================================================

export const SECTOR_COLORS: Record<string, string> = {
  Technology: '#2196F3',
  Healthcare: '#4CAF50',
  Financials: '#FF9800',
  'Consumer Discretionary': '#E91E63',
  'Consumer Staples': '#8BC34A',
  Energy: '#F44336',
  Industrials: '#607D8B',
  Materials: '#795548',
  'Real Estate': '#9C27B0',
  Utilities: '#00BCD4',
  'Communication Services': '#3F51B5',
};

export const ASSET_CLASS_COLORS: Record<string, string> = {
  Equity: '#2196F3',
  'Fixed Income': '#4CAF50',
  Commodity: '#FF9800',
  Currency: '#9C27B0',
  Crypto: '#F44336',
  'Real Estate': '#795548',
  Alternative: '#607D8B',
  Cash: '#9E9E9E',
};

// ============================================================================
// Chart Series Colors
// ============================================================================

export function getChartSeriesColor(index: number, theme: PaletteName = 'tradingview'): string {
  const colors = PALETTES[theme].chart;
  return colors[index % colors.length];
}

export function generateDistinctColors(count: number, saturation = 70, lightness = 55): string[] {
  const colors: string[] = [];
  const goldenAngle = 137.508;
  for (let i = 0; i < count; i++) {
    const hue = (i * goldenAngle) % 360;
    colors.push(hslToHex({ h: hue, s: saturation, l: lightness }));
  }
  return colors;
}

// ============================================================================
// Accessibility-Safe Colors
// ============================================================================

export const COLORBLIND_SAFE = {
  qualitative: ['#0077BB', '#33BBEE', '#009988', '#EE7733', '#CC3311', '#EE3377', '#BBBBBB', '#000000'],
  diverging: ['#0077BB', '#33BBEE', '#BBDDEE', '#EEEEEE', '#FFDDCC', '#EE7733', '#CC3311'],
  sequential: ['#FFFFDD', '#EEDD88', '#BBCC33', '#77AADD', '#4477AA', '#114477'],
};

export function getAccessibleColor(
  baseColor: string,
  background: string,
  minContrast = 4.5
): string {
  let color = baseColor;
  const bgLum = relativeLuminance(hexToRgb(background));
  const adjustFn = bgLum > 0.5 ? darken : lighten;

  for (let i = 0; i < 20; i++) {
    if (contrastRatio(color, background) >= minContrast) return color;
    color = adjustFn(color, 5);
  }
  return bgLum > 0.5 ? '#000000' : '#FFFFFF';
}
