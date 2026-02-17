/**
 * UI2 Design Tokens - Wave 12 v1.114
 * Terminal-grade design system tokens for consistent styling
 */

export const designTokens = {
  // Typography - Terminal Feel
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", "Source Code Pro", Menlo, Monaco, Consolas, monospace',
    },
    fontSize: {
      xs: '0.6875rem',    // 11px
      sm: '0.8125rem',    // 13px
      base: '0.875rem',   // 14px
      md: '0.9375rem',    // 15px
      lg: '1rem',         // 16px
      xl: '1.125rem',     // 18px
      '2xl': '1.25rem',   // 20px
      '3xl': '1.5rem',    // 24px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing - 4px base unit
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
  },

  // Colors - Terminal Dark Theme
  colors: {
    background: {
      primary: '#0a0a0a',      // Main bg
      secondary: '#121212',    // Elevated panels
      tertiary: '#1a1a1a',     // Cards/sections
      hover: '#1f1f1f',        // Hover states
    },
    border: {
      primary: '#262626',      // Main borders
      secondary: '#333333',    // Subtle dividers
      hover: '#404040',        // Hover borders
    },
    text: {
      primary: '#e5e5e5',      // Main text
      secondary: '#a3a3a3',    // Muted text
      tertiary: '#737373',     // Disabled/placeholder
      bold: '#ffffff',         // Emphasis
    },
    accent: {
      blue: '#3b82f6',
      green: '#10b981',
      red: '#ef4444',
      yellow: '#f59e0b',
      purple: '#8b5cf6',
      orange: '#f97316',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      neutral: '#6b7280',
    },
  },

  // Shadows - Subtle depth
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.25)',
  },

  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    full: '9999px',
  },

  // Transitions
  transition: {
    fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Z-Index layers
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modal: 40,
    popover: 50,
    tooltip: 60,
    toast: 70,
  },
} as const;

// Terminal-specific utility classes
export const terminalClasses = {
  // Tabular numbers for numeric data
  numericData: 'font-mono tabular-nums tracking-tight',
  
  // Panel with terminal feel
  panel: 'bg-neutral-900 border border-neutral-800 rounded-lg shadow-md',
  
  // Header with consistent styling
  pageHeader: 'flex items-center justify-between px-6 py-4 border-b border-neutral-800',
  
  // Section header
  sectionHeader: 'text-sm font-semibold text-neutral-100 mb-3',
  
  // Status badge base styles
  badge: 'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
  
  // Button variants
  button: {
    primary: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors',
    secondary: 'px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors',
    ghost: 'px-3 py-1.5 hover:bg-neutral-800 text-neutral-300 rounded font-medium transition-colors',
  },
  
  // Input field
  input: 'px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors',
  
  // Table row
  tableRow: 'hover:bg-neutral-800/50 border-b border-neutral-800/50 transition-colors',
} as const;

// Status badge variants
export const statusBadgeVariants = {
  success: 'bg-green-950/30 border border-green-900/50 text-green-400',
  warning: 'bg-yellow-950/30 border border-yellow-900/50 text-yellow-400',
  error: 'bg-red-950/30 border border-red-900/50 text-red-400',
  info: 'bg-blue-950/30 border border-blue-900/50 text-blue-400',
  neutral: 'bg-neutral-800/50 border border-neutral-700 text-neutral-400',
} as const;

// Motion preferences
export const motionPreferences = {
  // Respects user's reduced motion preference
  checkReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  
  // Animation duration based on preference
  duration: (base: number) => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : base;
  },
} as const;
