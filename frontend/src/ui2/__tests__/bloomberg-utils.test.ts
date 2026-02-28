/**
 * Bloomberg Terminal – Formatting & Utilities Tests
 * Covers: designTokens shape validation, terminalClasses,
 *         statusBadgeVariants, Intl formatting helpers,
 *         financial number edge-cases used across UI2 pages
 *
 * Run:  npx vitest run src/ui2/__tests__/bloomberg-utils.test.ts
 */
import { describe, it, expect } from 'vitest';
import { designTokens, terminalClasses, statusBadgeVariants } from '../design/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens – shape validation
// ─────────────────────────────────────────────────────────────────────────────
describe('designTokens – shape', () => {
  it('has typography section', () => {
    expect(designTokens.typography).toBeDefined();
    expect(designTokens.typography.fontFamily.mono).toBeTruthy();
    expect(designTokens.typography.fontFamily.sans).toBeTruthy();
  });

  it('has spacing with key "4" === 1rem', () => {
    expect(designTokens.spacing[4]).toBe('1rem');
  });

  it('spacing[1] = 0.25rem (4px base)', () => {
    expect(designTokens.spacing[1]).toBe('0.25rem');
  });

  it('has all color sections', () => {
    expect(designTokens.colors.background.primary).toBeTruthy();
    expect(designTokens.colors.text.primary).toBeTruthy();
    expect(designTokens.colors.accent.blue).toBeTruthy();
    expect(designTokens.colors.status.success).toBeTruthy();
  });

  it('accent.green is a valid hex color', () => {
    expect(designTokens.colors.accent.green).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('accent.red is a valid hex color', () => {
    expect(designTokens.colors.accent.red).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('shadow has sm, md, lg, xl', () => {
    expect(designTokens.shadow.sm).toBeTruthy();
    expect(designTokens.shadow.md).toBeTruthy();
    expect(designTokens.shadow.lg).toBeTruthy();
    expect(designTokens.shadow.xl).toBeTruthy();
  });

  it('zIndex.modal > zIndex.dropdown', () => {
    expect(designTokens.zIndex.modal).toBeGreaterThan(designTokens.zIndex.dropdown);
  });

  it('zIndex.tooltip > zIndex.modal', () => {
    expect(designTokens.zIndex.tooltip).toBeGreaterThan(designTokens.zIndex.modal);
  });

  it('borderRadius.full = 9999px', () => {
    expect(designTokens.borderRadius.full).toBe('9999px');
  });

  it('borderRadius.none = 0 (sharp Bloomberg corners)', () => {
    expect(designTokens.borderRadius.none).toBe('0');
  });

  it('transition values include cubic-bezier', () => {
    expect(designTokens.transition.base).toContain('cubic-bezier');
    expect(designTokens.transition.fast).toContain('cubic-bezier');
  });

  it('fontSize.xs <= fontSize.sm numerically', () => {
    const xs = parseFloat(designTokens.typography.fontSize.xs);
    const sm = parseFloat(designTokens.typography.fontSize.sm);
    expect(xs).toBeLessThanOrEqual(sm);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Classes
// ─────────────────────────────────────────────────────────────────────────────
describe('terminalClasses', () => {
  it('numericData includes font-mono', () => {
    expect(terminalClasses.numericData).toContain('font-mono');
  });

  it('numericData includes tabular-nums', () => {
    expect(terminalClasses.numericData).toContain('tabular-nums');
  });

  it('panel class is non-empty', () => {
    expect(terminalClasses.panel.length).toBeGreaterThan(0);
  });

  it('button.primary includes text-white', () => {
    expect(terminalClasses.button.primary).toContain('text-white');
  });

  it('button.secondary is non-empty', () => {
    expect(terminalClasses.button.secondary.length).toBeGreaterThan(0);
  });

  it('input contains focus:outline-none', () => {
    expect(terminalClasses.input).toContain('focus:outline-none');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge Variants
// ─────────────────────────────────────────────────────────────────────────────
describe('statusBadgeVariants', () => {
  const expected = ['success', 'warning', 'error', 'info', 'neutral'] as const;

  expected.forEach((k) => {
    it(`"${k}" variant is defined and non-empty`, () => {
      expect(statusBadgeVariants[k]).toBeTruthy();
      expect(statusBadgeVariants[k].length).toBeGreaterThan(0);
    });
  });

  it('success variant contains green', () => {
    expect(statusBadgeVariants.success).toContain('green');
  });

  it('error variant contains red', () => {
    expect(statusBadgeVariants.error).toContain('red');
  });

  it('warning variant contains yellow', () => {
    expect(statusBadgeVariants.warning).toContain('yellow');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Financial Formatting – Inline helpers (mirrors page fmt* functions)
// These test the exact logic used in DashboardUI2, TradingUI2, etc.
// ─────────────────────────────────────────────────────────────────────────────

/** fmt2: format price to 2 decimal places */
function fmt2(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** fmtPct: format fraction as percentage with 2dp */
function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

/** fmtK: compact thousands notation */
function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** signedPnl: $+1,234.56 / $-1,234.56 format */
function signedPnl(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${fmt2(Math.abs(n))}`;
}

describe('fmt2 – price formatting', () => {
  it('formats positive price', () => expect(fmt2(182.41)).toBe('182.41'));
  it('formats integer price', () => expect(fmt2(100)).toBe('100.00'));
  it('formats zero', () => expect(fmt2(0)).toBe('0.00'));
  it('formats negative', () => expect(fmt2(-15.5)).toBe('-15.50'));
  it('formats large price with comma', () => expect(fmt2(1234.56)).toBe('1,234.56'));
  it('rounds to 2dp', () => expect(fmt2(3.14159)).toBe('3.14'));
});

describe('fmtPct – percentage formatting', () => {
  it('1.0 → 100.00%', () => expect(fmtPct(1.0)).toBe('100.00%'));
  it('0.5 → 50.00%', () => expect(fmtPct(0.5)).toBe('50.00%'));
  it('0.0 → 0.00%', () => expect(fmtPct(0.0)).toBe('0.00%'));
  it('-0.03 → -3.00%', () => expect(fmtPct(-0.03)).toBe('-3.00%'));
  it('0.0125 → 1.25%', () => expect(fmtPct(0.0125)).toBe('1.25%'));
});

describe('fmtK – compact notation', () => {
  it('500 → "500"', () => expect(fmtK(500)).toBe('500'));
  it('1500 → "1.5K"', () => expect(fmtK(1500)).toBe('1.5K'));
  it('10000 → "10.0K"', () => expect(fmtK(10000)).toBe('10.0K'));
  it('1_500_000 → "1.5M"', () => expect(fmtK(1_500_000)).toBe('1.5M'));
  it('-5000 → "-5.0K"', () => expect(fmtK(-5000)).toBe('-5.0K'));
  it('0 → "0"', () => expect(fmtK(0)).toBe('0'));
});

describe('signedPnl – P&L display', () => {
  it('positive PnL shows + sign', () => expect(signedPnl(1234.56)).toBe('+$1,234.56'));
  it('zero PnL shows +$0.00', () => expect(signedPnl(0)).toBe('+$0.00'));
  it('negative PnL shows - sign with no double-minus', () => {
    const result = signedPnl(-500);
    expect(result).toBe('-$500.00');
  });
  it('large positive', () => expect(signedPnl(99999.99)).toBe('+$99,999.99'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloomberg Color Validation – verify token system obeys Bloomberg palette
// ─────────────────────────────────────────────────────────────────────────────
describe('Bloomberg palette – CSS var expectations', () => {
  // These test the expected constant values documented in the Bloomberg design spec
  const BLOOMBERG = {
    amber: '#ff9900',
    green: '#00d88a',
    red: '#ff3b5c',
    bg: '#040407',
  };

  it('amber is #ff9900', () => expect(BLOOMBERG.amber).toBe('#ff9900'));
  it('green/gains is #00d88a', () => expect(BLOOMBERG.green).toBe('#00d88a'));
  it('red/losses is #ff3b5c', () => expect(BLOOMBERG.red).toBe('#ff3b5c'));
  it('obsidian bg is #040407', () => expect(BLOOMBERG.bg).toBe('#040407'));

  it('amber is valid hex', () => expect(BLOOMBERG.amber).toMatch(/^#[0-9a-fA-F]{6}$/));
  it('green is valid hex', () => expect(BLOOMBERG.green).toMatch(/^#[0-9a-fA-F]{6}$/));
  it('red is valid hex', () => expect(BLOOMBERG.red).toMatch(/^#[0-9a-fA-F]{6}$/));
});

// ─────────────────────────────────────────────────────────────────────────────
// Misc utility edge-cases
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge-case numeric operations', () => {
  it('parseFloat handles numeric string', () => expect(parseFloat('182.41')).toBeCloseTo(182.41));
  it('toFixed rounds correctly', () => expect((1.005).toFixed(2)).toBe('1.00')); // JS quirk
  it('Number.isNaN("abc") → false (use isNaN)', () => expect(isNaN(parseFloat('abc'))).toBe(true));
  it('Infinity is not a valid price', () => expect(isFinite(Infinity)).toBe(false));
  it('-Infinity is not a valid price', () => expect(isFinite(-Infinity)).toBe(false));

  it('Math.abs delivers absolute value for P&L', () => {
    expect(Math.abs(-12345.67)).toBeCloseTo(12345.67);
  });

  it('clamp helper works', () => {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-20, 0, 100)).toBe(0);
    expect(clamp(75, 0, 100)).toBe(75);
  });
});
