// Platform Theme System - Design Tokens & Multi-Theme Support

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryMuted: string;
  secondary: string;
  secondaryHover: string;
  secondaryActive: string;
  secondaryMuted: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  surfaceOverlay: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  border: string;
  borderHover: string;
  borderFocus: string;
  borderError: string;
  error: string;
  errorBg: string;
  errorHover: string;
  warning: string;
  warningBg: string;
  warningHover: string;
  success: string;
  successBg: string;
  successHover: string;
  info: string;
  infoBg: string;
  infoHover: string;
  accent: string;
  accentHover: string;
  link: string;
  linkHover: string;
  focus: string;
  selection: string;
  scrollbar: string;
  scrollbarHover: string;
  divider: string;
}

export interface ThemeFinancial {
  positive: string;
  positiveBg: string;
  negative: string;
  negativeBg: string;
  neutral: string;
  neutralBg: string;
  bid: string;
  bidBg: string;
  ask: string;
  askBg: string;
  spread: string;
  volumeUp: string;
  volumeDown: string;
  highPrice: string;
  lowPrice: string;
}

export interface ThemeChart {
  candleUp: string;
  candleDown: string;
  candleUpWick: string;
  candleDownWick: string;
  candleUpBorder: string;
  candleDownBorder: string;
  gridLines: string;
  gridText: string;
  crosshair: string;
  crosshairLabel: string;
  crosshairLabelBg: string;
  selectionHighlight: string;
  watermark: string;
  axisLine: string;
  volumeUp: string;
  volumeDown: string;
  indicatorLine1: string;
  indicatorLine2: string;
  indicatorLine3: string;
  indicatorLine4: string;
  indicatorLine5: string;
  indicatorLine6: string;
  overbought: string;
  oversold: string;
  bollingerBand: string;
  bollingerFill: string;
  drawingLine: string;
  drawingFill: string;
  drawingText: string;
  drawingHandle: string;
  alertLine: string;
  orderLine: string;
  positionLine: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontFamilyHeading: string;
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSize2xl: string;
  fontSize3xl: string;
  fontSize4xl: string;
  fontWeightLight: number;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightSemibold: number;
  fontWeightBold: number;
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;
  letterSpacingTight: string;
  letterSpacingNormal: string;
  letterSpacingWide: string;
}

export interface ThemeSpacing {
  px: string;
  '0': string;
  '0.5': string;
  '1': string;
  '1.5': string;
  '2': string;
  '2.5': string;
  '3': string;
  '4': string;
  '5': string;
  '6': string;
  '8': string;
  '10': string;
  '12': string;
  '16': string;
  '20': string;
  '24': string;
  '32': string;
}

export interface ThemeShadows {
  none: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  outline: string;
  glow: string;
}

export interface ThemeBorders {
  none: string;
  thin: string;
  medium: string;
  thick: string;
}

export interface ThemeRadii {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface ThemeTransitions {
  none: string;
  fast: string;
  normal: string;
  slow: string;
  spring: string;
}

export interface ThemeZIndex {
  hide: number;
  base: number;
  dropdown: number;
  sticky: number;
  fixed: number;
  overlay: number;
  modal: number;
  popover: number;
  toast: number;
  tooltip: number;
  max: number;
}

export interface ComponentTokens {
  button: {
    height: string;
    heightSm: string;
    heightLg: string;
    paddingX: string;
    borderRadius: string;
    fontSize: string;
  };
  input: {
    height: string;
    paddingX: string;
    borderRadius: string;
    fontSize: string;
    bg: string;
    border: string;
    focusBorder: string;
    placeholderColor: string;
  };
  card: {
    bg: string;
    border: string;
    borderRadius: string;
    padding: string;
    shadow: string;
  };
  panel: {
    bg: string;
    headerBg: string;
    border: string;
    borderRadius: string;
    headerHeight: string;
  };
  table: {
    headerBg: string;
    rowBg: string;
    rowAltBg: string;
    rowHoverBg: string;
    borderColor: string;
    cellPadding: string;
  };
  modal: {
    bg: string;
    overlayBg: string;
    borderRadius: string;
    shadow: string;
    maxWidth: string;
    padding: string;
  };
  tooltip: {
    bg: string;
    text: string;
    borderRadius: string;
    padding: string;
    fontSize: string;
    maxWidth: string;
  };
  badge: {
    height: string;
    paddingX: string;
    borderRadius: string;
    fontSize: string;
  };
  tag: {
    height: string;
    paddingX: string;
    borderRadius: string;
    fontSize: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  financial: ThemeFinancial;
  chart: ThemeChart;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  borders: ThemeBorders;
  radii: ThemeRadii;
  transitions: ThemeTransitions;
  zIndex: ThemeZIndex;
  components: ComponentTokens;
}

// --- Shared Tokens ---

const baseTypography: ThemeTypography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMono: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, monospace',
  fontFamilyHeading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeXs: '0.625rem',
  fontSizeSm: '0.75rem',
  fontSizeMd: '0.8125rem',
  fontSizeLg: '0.9375rem',
  fontSizeXl: '1.125rem',
  fontSize2xl: '1.5rem',
  fontSize3xl: '1.875rem',
  fontSize4xl: '2.25rem',
  fontWeightLight: 300,
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
  letterSpacingTight: '-0.025em',
  letterSpacingNormal: '0',
  letterSpacingWide: '0.025em',
};

const baseSpacing: ThemeSpacing = {
  px: '1px',
  '0': '0',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
  '32': '128px',
};

const baseBorders: ThemeBorders = {
  none: 'none',
  thin: '1px solid',
  medium: '2px solid',
  thick: '3px solid',
};

const baseRadii: ThemeRadii = {
  none: '0',
  sm: '2px',
  md: '4px',
  lg: '6px',
  xl: '8px',
  '2xl': '12px',
  full: '9999px',
};

const baseTransitions: ThemeTransitions = {
  none: 'none',
  fast: '100ms ease',
  normal: '200ms ease',
  slow: '350ms ease',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const baseZIndex: ThemeZIndex = {
  hide: -1,
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  toast: 700,
  tooltip: 800,
  max: 9999,
};

// --- Built-in Themes ---

export const bloombergDarkTheme: Theme = {
  id: 'bloomberg-dark',
  name: 'Bloomberg Terminal',
  isDark: true,
  colors: {
    primary: '#FF6600', primaryHover: '#FF7A1A', primaryActive: '#E65C00', primaryMuted: '#FF660033',
    secondary: '#FF9900', secondaryHover: '#FFB347', secondaryActive: '#E68A00', secondaryMuted: '#FF990033',
    background: '#000000', backgroundAlt: '#0A0A0A', surface: '#1A1A1A', surfaceHover: '#242424',
    surfaceActive: '#2E2E2E', surfaceOverlay: '#000000E6', text: '#FF6600', textSecondary: '#CCCCCC',
    textTertiary: '#888888', textDisabled: '#555555', textInverse: '#000000', border: '#333333',
    borderHover: '#555555', borderFocus: '#FF6600', borderError: '#FF3333', error: '#FF3333',
    errorBg: '#FF333320', errorHover: '#FF4D4D', warning: '#FFD700', warningBg: '#FFD70020',
    warningHover: '#FFE033', success: '#00CC00', successBg: '#00CC0020', successHover: '#00E600',
    info: '#3399FF', infoBg: '#3399FF20', infoHover: '#4DA6FF', accent: '#FF6600', accentHover: '#FF7A1A',
    link: '#FF6600', linkHover: '#FF9900', focus: '#FF660080', selection: '#FF660040',
    scrollbar: '#333333', scrollbarHover: '#555555', divider: '#222222',
  },
  financial: {
    positive: '#00CC00', positiveBg: '#00CC0015', negative: '#FF3333', negativeBg: '#FF333315',
    neutral: '#CCCCCC', neutralBg: '#CCCCCC15', bid: '#3399FF', bidBg: '#3399FF15',
    ask: '#FF6633', askBg: '#FF663315', spread: '#FFD700', volumeUp: '#00CC0060',
    volumeDown: '#FF333360', highPrice: '#00CC00', lowPrice: '#FF3333',
  },
  chart: {
    candleUp: '#00CC00', candleDown: '#FF3333', candleUpWick: '#00CC00', candleDownWick: '#FF3333',
    candleUpBorder: '#00CC00', candleDownBorder: '#FF3333', gridLines: '#1A1A1A', gridText: '#666666',
    crosshair: '#FF6600', crosshairLabel: '#000000', crosshairLabelBg: '#FF6600',
    selectionHighlight: '#FF660030', watermark: '#111111', axisLine: '#333333',
    volumeUp: '#00CC0040', volumeDown: '#FF333340',
    indicatorLine1: '#3399FF', indicatorLine2: '#FF6600', indicatorLine3: '#FFD700',
    indicatorLine4: '#CC33FF', indicatorLine5: '#00CCCC', indicatorLine6: '#FF3399',
    overbought: '#FF333340', oversold: '#00CC0040', bollingerBand: '#3399FF60',
    bollingerFill: '#3399FF10', drawingLine: '#FF6600', drawingFill: '#FF660020',
    drawingText: '#FF6600', drawingHandle: '#FF6600', alertLine: '#FFD700',
    orderLine: '#3399FF', positionLine: '#CC33FF',
  },
  typography: { ...baseTypography, fontFamily: '"Bloomberg Mono", "SF Mono", "Fira Mono", monospace' },
  spacing: baseSpacing, shadows: { none: 'none', xs: '0 1px 2px #00000080', sm: '0 2px 4px #00000080', md: '0 4px 8px #000000A0', lg: '0 8px 16px #000000A0', xl: '0 16px 32px #000000C0', '2xl': '0 24px 48px #000000C0', inner: 'inset 0 2px 4px #00000080', outline: '0 0 0 3px #FF660040', glow: '0 0 20px #FF660040' },
  borders: baseBorders, radii: { none: '0', sm: '1px', md: '2px', lg: '3px', xl: '4px', '2xl': '6px', full: '9999px' },
  transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '28px', heightSm: '22px', heightLg: '34px', paddingX: '12px', borderRadius: '2px', fontSize: '0.75rem' },
    input: { height: '28px', paddingX: '8px', borderRadius: '2px', fontSize: '0.75rem', bg: '#0A0A0A', border: '#333333', focusBorder: '#FF6600', placeholderColor: '#555555' },
    card: { bg: '#111111', border: '#222222', borderRadius: '2px', padding: '12px', shadow: '0 1px 3px #00000060' },
    panel: { bg: '#0A0A0A', headerBg: '#111111', border: '#222222', borderRadius: '0', headerHeight: '28px' },
    table: { headerBg: '#111111', rowBg: '#0A0A0A', rowAltBg: '#0F0F0F', rowHoverBg: '#1A1A1A', borderColor: '#222222', cellPadding: '4px 8px' },
    modal: { bg: '#111111', overlayBg: '#000000E0', borderRadius: '2px', shadow: '0 8px 32px #000000C0', maxWidth: '560px', padding: '16px' },
    tooltip: { bg: '#222222', text: '#FF6600', borderRadius: '2px', padding: '4px 8px', fontSize: '0.6875rem', maxWidth: '240px' },
    badge: { height: '18px', paddingX: '6px', borderRadius: '2px', fontSize: '0.625rem' },
    tag: { height: '22px', paddingX: '8px', borderRadius: '2px', fontSize: '0.6875rem' },
  },
};

export const tradingViewDarkTheme: Theme = {
  id: 'tradingview-dark',
  name: 'TradingView Dark',
  isDark: true,
  colors: {
    primary: '#2962FF', primaryHover: '#1E53E5', primaryActive: '#1848CC', primaryMuted: '#2962FF33',
    secondary: '#787B86', secondaryHover: '#9598A1', secondaryActive: '#6A6D78', secondaryMuted: '#787B8633',
    background: '#131722', backgroundAlt: '#1E222D', surface: '#1E222D', surfaceHover: '#2A2E39',
    surfaceActive: '#363A45', surfaceOverlay: '#131722E6', text: '#D1D4DC', textSecondary: '#787B86',
    textTertiary: '#4C525E', textDisabled: '#363A45', textInverse: '#131722', border: '#2A2E39',
    borderHover: '#434651', borderFocus: '#2962FF', borderError: '#F23645', error: '#F23645',
    errorBg: '#F2364520', errorHover: '#FF4A5C', warning: '#FF9800', warningBg: '#FF980020',
    warningHover: '#FFB74D', success: '#26A69A', successBg: '#26A69A20', successHover: '#2EBD9F',
    info: '#2962FF', infoBg: '#2962FF20', infoHover: '#4080FF', accent: '#2962FF', accentHover: '#1E53E5',
    link: '#2962FF', linkHover: '#4080FF', focus: '#2962FF80', selection: '#2962FF40',
    scrollbar: '#2A2E39', scrollbarHover: '#434651', divider: '#2A2E39',
  },
  financial: {
    positive: '#26A69A', positiveBg: '#26A69A15', negative: '#EF5350', negativeBg: '#EF535015',
    neutral: '#787B86', neutralBg: '#787B8615', bid: '#26A69A', bidBg: '#26A69A15',
    ask: '#EF5350', askBg: '#EF535015', spread: '#FF9800', volumeUp: '#26A69A50',
    volumeDown: '#EF535050', highPrice: '#26A69A', lowPrice: '#EF5350',
  },
  chart: {
    candleUp: '#26A69A', candleDown: '#EF5350', candleUpWick: '#26A69A', candleDownWick: '#EF5350',
    candleUpBorder: '#26A69A', candleDownBorder: '#EF5350', gridLines: '#1E222D', gridText: '#787B86',
    crosshair: '#9598A1', crosshairLabel: '#131722', crosshairLabelBg: '#9598A1',
    selectionHighlight: '#2962FF30', watermark: '#1E222D', axisLine: '#2A2E39',
    volumeUp: '#26A69A40', volumeDown: '#EF535040',
    indicatorLine1: '#2962FF', indicatorLine2: '#FF6D00', indicatorLine3: '#AB47BC',
    indicatorLine4: '#00BCD4', indicatorLine5: '#FF5252', indicatorLine6: '#4CAF50',
    overbought: '#EF535030', oversold: '#26A69A30', bollingerBand: '#2962FF50',
    bollingerFill: '#2962FF10', drawingLine: '#2962FF', drawingFill: '#2962FF20',
    drawingText: '#D1D4DC', drawingHandle: '#2962FF', alertLine: '#FF9800',
    orderLine: '#2962FF', positionLine: '#AB47BC',
  },
  typography: baseTypography, spacing: baseSpacing,
  shadows: { none: 'none', xs: '0 1px 2px #00000040', sm: '0 2px 4px #00000060', md: '0 4px 8px #00000060', lg: '0 8px 16px #00000080', xl: '0 16px 32px #00000080', '2xl': '0 24px 48px #000000A0', inner: 'inset 0 2px 4px #00000040', outline: '0 0 0 3px #2962FF40', glow: '0 0 16px #2962FF30' },
  borders: baseBorders, radii: baseRadii, transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '34px', heightSm: '28px', heightLg: '40px', paddingX: '16px', borderRadius: '4px', fontSize: '0.8125rem' },
    input: { height: '34px', paddingX: '12px', borderRadius: '4px', fontSize: '0.8125rem', bg: '#131722', border: '#2A2E39', focusBorder: '#2962FF', placeholderColor: '#4C525E' },
    card: { bg: '#1E222D', border: '#2A2E39', borderRadius: '6px', padding: '16px', shadow: '0 2px 8px #00000040' },
    panel: { bg: '#131722', headerBg: '#1E222D', border: '#2A2E39', borderRadius: '4px', headerHeight: '36px' },
    table: { headerBg: '#1E222D', rowBg: '#131722', rowAltBg: '#1A1E2A', rowHoverBg: '#2A2E39', borderColor: '#2A2E39', cellPadding: '6px 12px' },
    modal: { bg: '#1E222D', overlayBg: '#131722E0', borderRadius: '8px', shadow: '0 12px 40px #00000080', maxWidth: '600px', padding: '24px' },
    tooltip: { bg: '#363A45', text: '#D1D4DC', borderRadius: '4px', padding: '6px 10px', fontSize: '0.75rem', maxWidth: '280px' },
    badge: { height: '20px', paddingX: '8px', borderRadius: '4px', fontSize: '0.6875rem' },
    tag: { height: '24px', paddingX: '10px', borderRadius: '4px', fontSize: '0.75rem' },
  },
};

export const tradingViewLightTheme: Theme = {
  id: 'tradingview-light',
  name: 'TradingView Light',
  isDark: false,
  colors: {
    primary: '#2962FF', primaryHover: '#1E53E5', primaryActive: '#1848CC', primaryMuted: '#2962FF20',
    secondary: '#787B86', secondaryHover: '#6A6D78', secondaryActive: '#5D606B', secondaryMuted: '#787B8620',
    background: '#FFFFFF', backgroundAlt: '#F0F3FA', surface: '#F0F3FA', surfaceHover: '#E5E8EF',
    surfaceActive: '#D8DBE2', surfaceOverlay: '#FFFFFFEE', text: '#131722', textSecondary: '#787B86',
    textTertiary: '#9598A1', textDisabled: '#B2B5BE', textInverse: '#FFFFFF', border: '#E0E3EB',
    borderHover: '#C8CBD2', borderFocus: '#2962FF', borderError: '#F23645', error: '#F23645',
    errorBg: '#F2364510', errorHover: '#D62B3A', warning: '#FF9800', warningBg: '#FF980010',
    warningHover: '#E68A00', success: '#26A69A', successBg: '#26A69A10', successHover: '#1E8E83',
    info: '#2962FF', infoBg: '#2962FF10', infoHover: '#1E53E5', accent: '#2962FF', accentHover: '#1E53E5',
    link: '#2962FF', linkHover: '#1E53E5', focus: '#2962FF60', selection: '#2962FF20',
    scrollbar: '#D8DBE2', scrollbarHover: '#C8CBD2', divider: '#E0E3EB',
  },
  financial: {
    positive: '#26A69A', positiveBg: '#26A69A10', negative: '#EF5350', negativeBg: '#EF535010',
    neutral: '#787B86', neutralBg: '#787B8610', bid: '#26A69A', bidBg: '#26A69A10',
    ask: '#EF5350', askBg: '#EF535010', spread: '#FF9800', volumeUp: '#26A69A30',
    volumeDown: '#EF535030', highPrice: '#26A69A', lowPrice: '#EF5350',
  },
  chart: {
    candleUp: '#26A69A', candleDown: '#EF5350', candleUpWick: '#26A69A', candleDownWick: '#EF5350',
    candleUpBorder: '#26A69A', candleDownBorder: '#EF5350', gridLines: '#F0F3FA', gridText: '#787B86',
    crosshair: '#787B86', crosshairLabel: '#FFFFFF', crosshairLabelBg: '#787B86',
    selectionHighlight: '#2962FF20', watermark: '#F0F3FA', axisLine: '#E0E3EB',
    volumeUp: '#26A69A30', volumeDown: '#EF535030',
    indicatorLine1: '#2962FF', indicatorLine2: '#FF6D00', indicatorLine3: '#AB47BC',
    indicatorLine4: '#00BCD4', indicatorLine5: '#FF5252', indicatorLine6: '#4CAF50',
    overbought: '#EF535020', oversold: '#26A69A20', bollingerBand: '#2962FF40',
    bollingerFill: '#2962FF08', drawingLine: '#2962FF', drawingFill: '#2962FF15',
    drawingText: '#131722', drawingHandle: '#2962FF', alertLine: '#FF9800',
    orderLine: '#2962FF', positionLine: '#AB47BC',
  },
  typography: baseTypography, spacing: baseSpacing,
  shadows: { none: 'none', xs: '0 1px 2px #0000000D', sm: '0 2px 4px #0000001A', md: '0 4px 8px #0000001A', lg: '0 8px 16px #00000026', xl: '0 16px 32px #0000001A', '2xl': '0 24px 48px #00000026', inner: 'inset 0 2px 4px #0000000D', outline: '0 0 0 3px #2962FF30', glow: '0 0 16px #2962FF20' },
  borders: baseBorders, radii: baseRadii, transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '34px', heightSm: '28px', heightLg: '40px', paddingX: '16px', borderRadius: '4px', fontSize: '0.8125rem' },
    input: { height: '34px', paddingX: '12px', borderRadius: '4px', fontSize: '0.8125rem', bg: '#FFFFFF', border: '#E0E3EB', focusBorder: '#2962FF', placeholderColor: '#9598A1' },
    card: { bg: '#FFFFFF', border: '#E0E3EB', borderRadius: '6px', padding: '16px', shadow: '0 2px 8px #0000000D' },
    panel: { bg: '#FFFFFF', headerBg: '#F0F3FA', border: '#E0E3EB', borderRadius: '4px', headerHeight: '36px' },
    table: { headerBg: '#F0F3FA', rowBg: '#FFFFFF', rowAltBg: '#F8F9FD', rowHoverBg: '#F0F3FA', borderColor: '#E0E3EB', cellPadding: '6px 12px' },
    modal: { bg: '#FFFFFF', overlayBg: '#131722B0', borderRadius: '8px', shadow: '0 12px 40px #00000026', maxWidth: '600px', padding: '24px' },
    tooltip: { bg: '#131722', text: '#FFFFFF', borderRadius: '4px', padding: '6px 10px', fontSize: '0.75rem', maxWidth: '280px' },
    badge: { height: '20px', paddingX: '8px', borderRadius: '4px', fontSize: '0.6875rem' },
    tag: { height: '24px', paddingX: '10px', borderRadius: '4px', fontSize: '0.75rem' },
  },
};

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  isDark: true,
  colors: {
    primary: '#FFFF00', primaryHover: '#FFFF33', primaryActive: '#CCCC00', primaryMuted: '#FFFF0033',
    secondary: '#00FFFF', secondaryHover: '#33FFFF', secondaryActive: '#00CCCC', secondaryMuted: '#00FFFF33',
    background: '#000000', backgroundAlt: '#0A0A0A', surface: '#111111', surfaceHover: '#1A1A1A',
    surfaceActive: '#222222', surfaceOverlay: '#000000F0', text: '#FFFFFF', textSecondary: '#EEEEEE',
    textTertiary: '#CCCCCC', textDisabled: '#666666', textInverse: '#000000', border: '#FFFFFF',
    borderHover: '#FFFF00', borderFocus: '#FFFF00', borderError: '#FF0000', error: '#FF0000',
    errorBg: '#FF000030', errorHover: '#FF3333', warning: '#FFFF00', warningBg: '#FFFF0030',
    warningHover: '#FFFF33', success: '#00FF00', successBg: '#00FF0030', successHover: '#33FF33',
    info: '#00FFFF', infoBg: '#00FFFF30', infoHover: '#33FFFF', accent: '#FFFF00', accentHover: '#FFFF33',
    link: '#00FFFF', linkHover: '#FFFF00', focus: '#FFFF00', selection: '#FFFF0040',
    scrollbar: '#666666', scrollbarHover: '#999999', divider: '#FFFFFF',
  },
  financial: {
    positive: '#00FF00', positiveBg: '#00FF0020', negative: '#FF0000', negativeBg: '#FF000020',
    neutral: '#FFFFFF', neutralBg: '#FFFFFF15', bid: '#00FFFF', bidBg: '#00FFFF20',
    ask: '#FF6600', askBg: '#FF660020', spread: '#FFFF00', volumeUp: '#00FF0050',
    volumeDown: '#FF000050', highPrice: '#00FF00', lowPrice: '#FF0000',
  },
  chart: {
    candleUp: '#00FF00', candleDown: '#FF0000', candleUpWick: '#00FF00', candleDownWick: '#FF0000',
    candleUpBorder: '#00FF00', candleDownBorder: '#FF0000', gridLines: '#333333', gridText: '#FFFFFF',
    crosshair: '#FFFF00', crosshairLabel: '#000000', crosshairLabelBg: '#FFFF00',
    selectionHighlight: '#FFFF0040', watermark: '#111111', axisLine: '#FFFFFF',
    volumeUp: '#00FF0050', volumeDown: '#FF000050',
    indicatorLine1: '#00FFFF', indicatorLine2: '#FFFF00', indicatorLine3: '#FF00FF',
    indicatorLine4: '#00FF00', indicatorLine5: '#FF6600', indicatorLine6: '#6666FF',
    overbought: '#FF000040', oversold: '#00FF0040', bollingerBand: '#00FFFF60',
    bollingerFill: '#00FFFF15', drawingLine: '#FFFF00', drawingFill: '#FFFF0020',
    drawingText: '#FFFFFF', drawingHandle: '#FFFF00', alertLine: '#FF6600',
    orderLine: '#00FFFF', positionLine: '#FF00FF',
  },
  typography: baseTypography, spacing: baseSpacing,
  shadows: { none: 'none', xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none', outline: '0 0 0 3px #FFFF00', glow: '0 0 4px #FFFF00' },
  borders: { none: 'none', thin: '2px solid', medium: '3px solid', thick: '4px solid' },
  radii: baseRadii, transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '36px', heightSm: '30px', heightLg: '42px', paddingX: '16px', borderRadius: '4px', fontSize: '0.875rem' },
    input: { height: '36px', paddingX: '12px', borderRadius: '4px', fontSize: '0.875rem', bg: '#000000', border: '#FFFFFF', focusBorder: '#FFFF00', placeholderColor: '#999999' },
    card: { bg: '#111111', border: '#FFFFFF', borderRadius: '4px', padding: '16px', shadow: 'none' },
    panel: { bg: '#000000', headerBg: '#111111', border: '#FFFFFF', borderRadius: '0', headerHeight: '38px' },
    table: { headerBg: '#111111', rowBg: '#000000', rowAltBg: '#0A0A0A', rowHoverBg: '#1A1A1A', borderColor: '#FFFFFF', cellPadding: '8px 12px' },
    modal: { bg: '#111111', overlayBg: '#000000F0', borderRadius: '4px', shadow: 'none', maxWidth: '600px', padding: '24px' },
    tooltip: { bg: '#FFFF00', text: '#000000', borderRadius: '4px', padding: '6px 10px', fontSize: '0.8125rem', maxWidth: '280px' },
    badge: { height: '22px', paddingX: '8px', borderRadius: '4px', fontSize: '0.75rem' },
    tag: { height: '26px', paddingX: '10px', borderRadius: '4px', fontSize: '0.8125rem' },
  },
};

export const nordTheme: Theme = {
  id: 'nord',
  name: 'Nord',
  isDark: true,
  colors: {
    primary: '#88C0D0', primaryHover: '#8FBCBB', primaryActive: '#81A1C1', primaryMuted: '#88C0D033',
    secondary: '#81A1C1', secondaryHover: '#88C0D0', secondaryActive: '#5E81AC', secondaryMuted: '#81A1C133',
    background: '#2E3440', backgroundAlt: '#3B4252', surface: '#3B4252', surfaceHover: '#434C5E',
    surfaceActive: '#4C566A', surfaceOverlay: '#2E3440E6', text: '#ECEFF4', textSecondary: '#D8DEE9',
    textTertiary: '#4C566A', textDisabled: '#434C5E', textInverse: '#2E3440', border: '#4C566A',
    borderHover: '#5E6A7E', borderFocus: '#88C0D0', borderError: '#BF616A', error: '#BF616A',
    errorBg: '#BF616A20', errorHover: '#D08770', warning: '#EBCB8B', warningBg: '#EBCB8B20',
    warningHover: '#D08770', success: '#A3BE8C', successBg: '#A3BE8C20', successHover: '#B4D09C',
    info: '#81A1C1', infoBg: '#81A1C120', infoHover: '#88C0D0', accent: '#B48EAD', accentHover: '#C49EBD',
    link: '#88C0D0', linkHover: '#8FBCBB', focus: '#88C0D080', selection: '#88C0D030',
    scrollbar: '#4C566A', scrollbarHover: '#5E6A7E', divider: '#4C566A',
  },
  financial: {
    positive: '#A3BE8C', positiveBg: '#A3BE8C15', negative: '#BF616A', negativeBg: '#BF616A15',
    neutral: '#D8DEE9', neutralBg: '#D8DEE915', bid: '#88C0D0', bidBg: '#88C0D015',
    ask: '#D08770', askBg: '#D0877015', spread: '#EBCB8B', volumeUp: '#A3BE8C40',
    volumeDown: '#BF616A40', highPrice: '#A3BE8C', lowPrice: '#BF616A',
  },
  chart: {
    candleUp: '#A3BE8C', candleDown: '#BF616A', candleUpWick: '#A3BE8C', candleDownWick: '#BF616A',
    candleUpBorder: '#A3BE8C', candleDownBorder: '#BF616A', gridLines: '#3B4252', gridText: '#4C566A',
    crosshair: '#D8DEE9', crosshairLabel: '#2E3440', crosshairLabelBg: '#D8DEE9',
    selectionHighlight: '#88C0D030', watermark: '#3B4252', axisLine: '#4C566A',
    volumeUp: '#A3BE8C40', volumeDown: '#BF616A40',
    indicatorLine1: '#88C0D0', indicatorLine2: '#D08770', indicatorLine3: '#B48EAD',
    indicatorLine4: '#EBCB8B', indicatorLine5: '#A3BE8C', indicatorLine6: '#81A1C1',
    overbought: '#BF616A30', oversold: '#A3BE8C30', bollingerBand: '#88C0D050',
    bollingerFill: '#88C0D010', drawingLine: '#88C0D0', drawingFill: '#88C0D020',
    drawingText: '#ECEFF4', drawingHandle: '#88C0D0', alertLine: '#EBCB8B',
    orderLine: '#81A1C1', positionLine: '#B48EAD',
  },
  typography: baseTypography, spacing: baseSpacing,
  shadows: { none: 'none', xs: '0 1px 2px #00000020', sm: '0 2px 4px #00000030', md: '0 4px 8px #00000030', lg: '0 8px 16px #00000040', xl: '0 16px 32px #00000040', '2xl': '0 24px 48px #00000050', inner: 'inset 0 2px 4px #00000020', outline: '0 0 0 3px #88C0D040', glow: '0 0 16px #88C0D020' },
  borders: baseBorders, radii: baseRadii, transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '34px', heightSm: '28px', heightLg: '40px', paddingX: '16px', borderRadius: '4px', fontSize: '0.8125rem' },
    input: { height: '34px', paddingX: '12px', borderRadius: '4px', fontSize: '0.8125rem', bg: '#2E3440', border: '#4C566A', focusBorder: '#88C0D0', placeholderColor: '#4C566A' },
    card: { bg: '#3B4252', border: '#4C566A', borderRadius: '6px', padding: '16px', shadow: '0 2px 8px #00000030' },
    panel: { bg: '#2E3440', headerBg: '#3B4252', border: '#4C566A', borderRadius: '4px', headerHeight: '36px' },
    table: { headerBg: '#3B4252', rowBg: '#2E3440', rowAltBg: '#353B49', rowHoverBg: '#434C5E', borderColor: '#4C566A', cellPadding: '6px 12px' },
    modal: { bg: '#3B4252', overlayBg: '#2E3440E0', borderRadius: '8px', shadow: '0 12px 40px #00000060', maxWidth: '600px', padding: '24px' },
    tooltip: { bg: '#4C566A', text: '#ECEFF4', borderRadius: '4px', padding: '6px 10px', fontSize: '0.75rem', maxWidth: '280px' },
    badge: { height: '20px', paddingX: '8px', borderRadius: '4px', fontSize: '0.6875rem' },
    tag: { height: '24px', paddingX: '10px', borderRadius: '4px', fontSize: '0.75rem' },
  },
};

export const draculaTheme: Theme = {
  id: 'dracula',
  name: 'Dracula',
  isDark: true,
  colors: {
    primary: '#BD93F9', primaryHover: '#CAA6FF', primaryActive: '#A67CE6', primaryMuted: '#BD93F933',
    secondary: '#6272A4', secondaryHover: '#7283B5', secondaryActive: '#516193', secondaryMuted: '#6272A433',
    background: '#282A36', backgroundAlt: '#21222C', surface: '#44475A', surfaceHover: '#4E5270',
    surfaceActive: '#585C78', surfaceOverlay: '#282A36E6', text: '#F8F8F2', textSecondary: '#BFBFB6',
    textTertiary: '#6272A4', textDisabled: '#44475A', textInverse: '#282A36', border: '#44475A',
    borderHover: '#6272A4', borderFocus: '#BD93F9', borderError: '#FF5555', error: '#FF5555',
    errorBg: '#FF555520', errorHover: '#FF6E6E', warning: '#F1FA8C', warningBg: '#F1FA8C20',
    warningHover: '#F4FB9F', success: '#50FA7B', successBg: '#50FA7B20', successHover: '#6BFB92',
    info: '#8BE9FD', infoBg: '#8BE9FD20', infoHover: '#A1EDFD', accent: '#FF79C6', accentHover: '#FF92D0',
    link: '#8BE9FD', linkHover: '#BD93F9', focus: '#BD93F980', selection: '#BD93F930',
    scrollbar: '#44475A', scrollbarHover: '#6272A4', divider: '#44475A',
  },
  financial: {
    positive: '#50FA7B', positiveBg: '#50FA7B15', negative: '#FF5555', negativeBg: '#FF555515',
    neutral: '#F8F8F2', neutralBg: '#F8F8F215', bid: '#8BE9FD', bidBg: '#8BE9FD15',
    ask: '#FFB86C', askBg: '#FFB86C15', spread: '#F1FA8C', volumeUp: '#50FA7B40',
    volumeDown: '#FF555540', highPrice: '#50FA7B', lowPrice: '#FF5555',
  },
  chart: {
    candleUp: '#50FA7B', candleDown: '#FF5555', candleUpWick: '#50FA7B', candleDownWick: '#FF5555',
    candleUpBorder: '#50FA7B', candleDownBorder: '#FF5555', gridLines: '#343746', gridText: '#6272A4',
    crosshair: '#F8F8F2', crosshairLabel: '#282A36', crosshairLabelBg: '#F8F8F2',
    selectionHighlight: '#BD93F930', watermark: '#2D2F3B', axisLine: '#44475A',
    volumeUp: '#50FA7B40', volumeDown: '#FF555540',
    indicatorLine1: '#8BE9FD', indicatorLine2: '#FFB86C', indicatorLine3: '#FF79C6',
    indicatorLine4: '#BD93F9', indicatorLine5: '#F1FA8C', indicatorLine6: '#50FA7B',
    overbought: '#FF555530', oversold: '#50FA7B30', bollingerBand: '#BD93F950',
    bollingerFill: '#BD93F910', drawingLine: '#BD93F9', drawingFill: '#BD93F920',
    drawingText: '#F8F8F2', drawingHandle: '#BD93F9', alertLine: '#F1FA8C',
    orderLine: '#8BE9FD', positionLine: '#FF79C6',
  },
  typography: baseTypography, spacing: baseSpacing,
  shadows: { none: 'none', xs: '0 1px 2px #00000030', sm: '0 2px 4px #00000040', md: '0 4px 8px #00000040', lg: '0 8px 16px #00000060', xl: '0 16px 32px #00000060', '2xl': '0 24px 48px #00000080', inner: 'inset 0 2px 4px #00000030', outline: '0 0 0 3px #BD93F940', glow: '0 0 16px #BD93F930' },
  borders: baseBorders, radii: baseRadii, transitions: baseTransitions, zIndex: baseZIndex,
  components: {
    button: { height: '34px', heightSm: '28px', heightLg: '40px', paddingX: '16px', borderRadius: '6px', fontSize: '0.8125rem' },
    input: { height: '34px', paddingX: '12px', borderRadius: '6px', fontSize: '0.8125rem', bg: '#282A36', border: '#44475A', focusBorder: '#BD93F9', placeholderColor: '#6272A4' },
    card: { bg: '#44475A', border: '#6272A4', borderRadius: '8px', padding: '16px', shadow: '0 2px 8px #00000040' },
    panel: { bg: '#282A36', headerBg: '#44475A', border: '#6272A4', borderRadius: '6px', headerHeight: '36px' },
    table: { headerBg: '#44475A', rowBg: '#282A36', rowAltBg: '#2D303E', rowHoverBg: '#44475A', borderColor: '#6272A4', cellPadding: '6px 12px' },
    modal: { bg: '#44475A', overlayBg: '#282A36E0', borderRadius: '10px', shadow: '0 12px 40px #00000080', maxWidth: '600px', padding: '24px' },
    tooltip: { bg: '#6272A4', text: '#F8F8F2', borderRadius: '6px', padding: '6px 10px', fontSize: '0.75rem', maxWidth: '280px' },
    badge: { height: '20px', paddingX: '8px', borderRadius: '6px', fontSize: '0.6875rem' },
    tag: { height: '24px', paddingX: '10px', borderRadius: '6px', fontSize: '0.75rem' },
  },
};

// --- Theme Registry ---

const builtInThemes: Theme[] = [
  bloombergDarkTheme, tradingViewDarkTheme, tradingViewLightTheme,
  highContrastTheme, nordTheme, draculaTheme,
];

// --- Theme Engine ---

export class ThemeEngine {
  private static STORAGE_KEY = 'platform_theme';
  private static CUSTOM_KEY = 'platform_custom_themes';
  private currentTheme: Theme;
  private customThemes: Theme[] = [];
  private listeners = new Set<(theme: Theme) => void>();
  private styleElement: HTMLStyleElement | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private syncWithSystem = false;

  constructor(defaultThemeId?: string) {
    this.customThemes = this.loadCustomThemes();
    const storedId = this.loadStoredThemeId();
    const id = storedId || defaultThemeId || 'tradingview-dark';
    this.currentTheme = this.findTheme(id) || tradingViewDarkTheme;
    this.applyTheme();
  }

  private loadStoredThemeId(): string | null {
    try { return localStorage.getItem(ThemeEngine.STORAGE_KEY); } catch { return null; }
  }

  private persistThemeId(id: string): void {
    try { localStorage.setItem(ThemeEngine.STORAGE_KEY, id); } catch { /* noop */ }
  }

  private loadCustomThemes(): Theme[] {
    try {
      const raw = localStorage.getItem(ThemeEngine.CUSTOM_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private persistCustomThemes(): void {
    try { localStorage.setItem(ThemeEngine.CUSTOM_KEY, JSON.stringify(this.customThemes)); } catch { /* noop */ }
  }

  private findTheme(id: string): Theme | undefined {
    return builtInThemes.find(t => t.id === id) || this.customThemes.find(t => t.id === id);
  }

  getTheme(): Theme { return this.currentTheme; }

  getAllThemes(): Theme[] { return [...builtInThemes, ...this.customThemes]; }

  setTheme(id: string): void {
    const theme = this.findTheme(id);
    if (!theme) throw new Error(`Theme "${id}" not found`);
    this.currentTheme = theme;
    this.persistThemeId(id);
    this.applyTheme();
    this.listeners.forEach(fn => fn(this.currentTheme));
  }

  registerTheme(theme: Theme): void {
    const idx = this.customThemes.findIndex(t => t.id === theme.id);
    if (idx >= 0) this.customThemes[idx] = theme;
    else this.customThemes.push(theme);
    this.persistCustomThemes();
  }

  removeCustomTheme(id: string): void {
    this.customThemes = this.customThemes.filter(t => t.id !== id);
    this.persistCustomThemes();
    if (this.currentTheme.id === id) this.setTheme('tradingview-dark');
  }

  createCustomTheme(name: string, baseThemeId: string, overrides: Partial<DeepPartial<Theme>>): Theme {
    const base = this.findTheme(baseThemeId) || tradingViewDarkTheme;
    const custom: Theme = deepMerge(structuredClone(base), overrides) as Theme;
    custom.id = `custom-${Date.now()}`;
    custom.name = name;
    this.registerTheme(custom);
    return custom;
  }

  enableSystemSync(): void {
    if (this.syncWithSystem) return;
    this.syncWithSystem = true;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaHandler = (e) => {
      this.setTheme(e.matches ? 'tradingview-dark' : 'tradingview-light');
    };
    this.mediaQuery.addEventListener('change', this.mediaHandler);
    this.setTheme(this.mediaQuery.matches ? 'tradingview-dark' : 'tradingview-light');
  }

  disableSystemSync(): void {
    if (!this.syncWithSystem) return;
    this.syncWithSystem = false;
    if (this.mediaQuery && this.mediaHandler) {
      this.mediaQuery.removeEventListener('change', this.mediaHandler);
    }
    this.mediaQuery = null;
    this.mediaHandler = null;
  }

  onChange(callback: (theme: Theme) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private applyTheme(): void {
    const vars = generateCSSVariables(this.currentTheme);
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'platform-theme';
      document.head.appendChild(this.styleElement);
    }
    this.styleElement.textContent = `:root {\n${vars}\n}`;
    document.documentElement.setAttribute('data-theme', this.currentTheme.id);
    document.documentElement.setAttribute('data-theme-mode', this.currentTheme.isDark ? 'dark' : 'light');
  }

  destroy(): void {
    this.disableSystemSync();
    this.styleElement?.remove();
    this.listeners.clear();
  }
}

// --- CSS Variable Generation ---

function flattenTokens(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${camelToKebab(key)}` : camelToKebab(key);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, varName));
    } else {
      result[varName] = String(value);
    }
  }
  return result;
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
}

export function generateCSSVariables(theme: Theme): string {
  const { id, name, isDark, ...tokens } = theme;
  void id; void name; void isDark;
  const flat = flattenTokens(tokens as unknown as Record<string, unknown>, '-theme');
  return Object.entries(flat)
    .map(([key, value]) => `  -${key}: ${value};`)
    .join('\n');
}

export function getThemeVar(path: string): string {
  return `var(--theme-${path.split('.').map(camelToKebab).join('-')})`;
}

// --- Theme Interpolation ---

export function interpolateThemeColors(
  from: ThemeColors,
  to: ThemeColors,
  t: number
): ThemeColors {
  const result = {} as ThemeColors;
  const keys = Object.keys(from) as (keyof ThemeColors)[];
  for (const key of keys) {
    result[key] = interpolateColor(from[key], to[key], t);
  }
  return result;
}

function interpolateColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHexOrRgb(a);
  const [r2, g2, b2] = parseHexOrRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function parseHexOrRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.length === 4
      ? color.slice(1).split('').map(c => c + c).join('')
      : color.slice(1, 7);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m = color.match(/(\d+)/g);
  return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}

export function animateThemeTransition(
  engine: ThemeEngine,
  toThemeId: string,
  durationMs = 300
): Promise<void> {
  return new Promise(resolve => {
    const fromColors = { ...engine.getTheme().colors };
    engine.setTheme(toThemeId);
    const toColors = { ...engine.getTheme().colors };

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const interpolated = interpolateThemeColors(fromColors, toColors, eased);

      const root = document.documentElement;
      for (const [key, value] of Object.entries(interpolated)) {
        root.style.setProperty(`--theme-colors-${camelToKebab(key)}`, value);
      }

      if (t < 1) requestAnimationFrame(step);
      else {
        for (const key of Object.keys(interpolated)) {
          root.style.removeProperty(`--theme-colors-${camelToKebab(key)}`);
        }
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

// --- Helpers ---

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<DeepPartial<T>>): T {
  for (const key in source) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object') {
      target[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>) as T[typeof key];
    } else if (sv !== undefined) {
      (target as Record<string, unknown>)[key] = sv;
    }
  }
  return target;
}
