/**
 * useMediaQuery.ts
 * Responsive design hook with media query matching, breakpoint detection,
 * and responsive value selector for conditional rendering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

// ─── Default Breakpoints ───────────────────────────────────────────────────────

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536,
};

// ─── useMediaQuery ─────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ─── useBreakpoint ─────────────────────────────────────────────────────────────

export function useBreakpoint(breakpoints: Partial<BreakpointConfig> = {}): {
  current: Breakpoint;
  isAbove: (bp: Breakpoint) => boolean;
  isBelow: (bp: Breakpoint) => boolean;
  isBetween: (lower: Breakpoint, upper: Breakpoint) => boolean;
  matches: Record<Breakpoint, boolean>;
  width: number;
} {
  const bp = { ...DEFAULT_BREAKPOINTS, ...breakpoints };

  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const current = useMemo((): Breakpoint => {
    const entries: [Breakpoint, number][] = [['2xl', bp['2xl']], ['xl', bp.xl], ['lg', bp.lg], ['md', bp.md], ['sm', bp.sm], ['xs', bp.xs]];
    return entries.find(([, val]) => width >= val)?.[0] ?? 'xs';
  }, [width, bp]);

  const matches = useMemo((): Record<Breakpoint, boolean> => ({
    xs: width >= bp.xs, sm: width >= bp.sm, md: width >= bp.md,
    lg: width >= bp.lg, xl: width >= bp.xl, '2xl': width >= bp['2xl'],
  }), [width, bp]);

  const isAbove = useCallback((target: Breakpoint) => width >= bp[target], [width, bp]);
  const isBelow = useCallback((target: Breakpoint) => width < bp[target], [width, bp]);
  const isBetween = useCallback((lower: Breakpoint, upper: Breakpoint) =>
    width >= bp[lower] && width < bp[upper], [width, bp]);

  return { current, isAbove, isBelow, isBetween, matches, width };
}

// ─── useResponsiveValue ────────────────────────────────────────────────────────

export function useResponsiveValue<T>(values: Partial<Record<Breakpoint, T>>, fallback: T): T {
  const { current } = useBreakpoint();

  return useMemo(() => {
    const order: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIdx = order.indexOf(current);
    for (let i = currentIdx; i < order.length; i++) {
      if (values[order[i]] !== undefined) return values[order[i]]!;
    }
    return fallback;
  }, [current, values, fallback]);
}

export default useMediaQuery;
