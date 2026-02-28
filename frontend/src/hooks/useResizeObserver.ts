/**
 * useResizeObserver.ts
 * Element size tracking hook using ResizeObserver API.
 * Supports entry box model (content-box, border-box, device-pixel-content-box),
 * debounced/throttled callbacks, multiple elements, and percentage-based sizing.
 * Also includes useElementSize, usePanelResize, and useResponsiveBreakpoints.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ElementSize {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
}

export type BoxModel = 'content-box' | 'border-box' | 'device-pixel-content-box';

export interface ResizeEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  contentBoxSize: ReadonlyArray<ResizeObserverSize>;
}

export interface UseResizeObserverOptions {
  box?: BoxModel;
  debounce?: number;
  throttle?: number;
  initial?: ElementSize;
}

// ─── Core Hook ────────────────────────────────────────────────────────────────

export function useResizeObserver<T extends Element = HTMLDivElement>(
  options: UseResizeObserverOptions = {}
): [React.RefCallback<T>, ElementSize] {
  const { box = 'content-box', debounce: debounceMs, throttle: throttleMs, initial } = options;

  const [size, setSize] = useState<ElementSize>(initial ?? {
    width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0,
  });

  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallRef = useRef<number>(0);

  const updateSize = useCallback((entry: ResizeObserverEntry) => {
    const rect = entry.contentRect;
    const borderBox = entry.borderBoxSize?.[0];
    const contentBox = entry.contentBoxSize?.[0];

    let w: number, h: number;
    if (box === 'border-box' && borderBox) {
      w = borderBox.inlineSize;
      h = borderBox.blockSize;
    } else if (box === 'device-pixel-content-box' && contentBox) {
      w = contentBox.inlineSize * devicePixelRatio;
      h = contentBox.blockSize * devicePixelRatio;
    } else {
      w = rect.width;
      h = rect.height;
    }

    setSize({
      width: w, height: h,
      top: rect.top, left: rect.left,
      right: rect.right, bottom: rect.bottom,
      x: rect.x, y: rect.y,
    });
  }, [box]);

  const handleEntry = useCallback((entry: ResizeObserverEntry) => {
    if (debounceMs) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => updateSize(entry), debounceMs);
    } else if (throttleMs) {
      const now = Date.now();
      if (now - lastCallRef.current >= throttleMs) {
        lastCallRef.current = now;
        updateSize(entry);
      }
    } else {
      updateSize(entry);
    }
  }, [updateSize, debounceMs, throttleMs]);

  const ref = useCallback((el: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    elementRef.current = el;
    if (!el) return;

    // Snapshot initial size
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, x: rect.x, y: rect.y });

    observerRef.current = new ResizeObserver(entries => {
      for (const entry of entries) handleEntry(entry);
    });
    observerRef.current.observe(el, { box });
  }, [box, handleEntry]);

  useEffect(() => () => {
    observerRef.current?.disconnect();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return [ref, size];
}

// ─── useElementSize ───────────────────────────────────────────────────────────

export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(ref.current);
    setSize({ width: ref.current.clientWidth, height: ref.current.clientHeight });
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}

// ─── useContainerQuery ────────────────────────────────────────────────────────

type BreakpointMap = Record<string, number>;

export function useContainerQuery<T extends HTMLElement = HTMLDivElement>(
  breakpoints: BreakpointMap = { sm: 480, md: 768, lg: 1024, xl: 1280 }
) {
  const { ref, width, height } = useElementSize<T>();

  const matches = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const [name, threshold] of Object.entries(breakpoints)) {
      result[name] = width >= threshold;
    }
    return result;
  }, [width, JSON.stringify(breakpoints)]);

  const activeBreakpoint = useMemo(() => {
    const sorted = Object.entries(breakpoints).sort(([, a], [, b]) => b - a);
    return sorted.find(([, threshold]) => width >= threshold)?.[0] ?? 'xs';
  }, [width, JSON.stringify(breakpoints)]);

  return { ref, width, height, matches, activeBreakpoint };
}

// ─── useWindowSize ────────────────────────────────────────────────────────────

export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return size;
}

// ─── useResponsiveBreakpoints ─────────────────────────────────────────────────

const SCREEN_BREAKPOINTS = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

export function useResponsiveBreakpoints() {
  const { width } = useWindowSize();
  const bp = useMemo(() => {
    const matches: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(SCREEN_BREAKPOINTS)) {
      matches[key] = width >= value;
    }
    return matches;
  }, [width]);

  const current = useMemo(() => {
    const entries = Object.entries(SCREEN_BREAKPOINTS).sort(([, a], [, b]) => b - a);
    return entries.find(([, threshold]) => width >= threshold)?.[0] ?? 'xs';
  }, [width]);

  return { ...bp, current, width };
}

// ─── usePanelResize ───────────────────────────────────────────────────────────

export interface PanelResizeOptions {
  direction: 'horizontal' | 'vertical' | 'both';
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  onResize?: (size: number) => void;
}

export function usePanelResize(options: PanelResizeOptions) {
  const { direction, minSize = 100, maxSize = 2000, defaultSize = 300, onResize } = options;
  const [size, setSize] = useState(defaultSize);
  const isResizingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(defaultSize);

  const startResize = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isResizingRef.current = true;
    const pos = 'touches' in e ? e.touches[0] : e;
    startPosRef.current = direction === 'horizontal' ? pos.clientX : pos.clientY;
    startSizeRef.current = size;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      const movePos = 'touches' in moveEvent ? moveEvent.touches[0] : moveEvent as MouseEvent;
      const current = direction === 'horizontal' ? movePos.clientX : movePos.clientY;
      const delta = current - startPosRef.current;
      const newSize = Math.max(minSize, Math.min(maxSize, startSizeRef.current + delta));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleEnd = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove as any);
    window.addEventListener('touchend', handleEnd);
  }, [direction, minSize, maxSize, size, onResize]);

  const resetSize = useCallback(() => setSize(defaultSize), [defaultSize]);

  return { size, startResize, resetSize, isResizing: isResizingRef.current };
}

// ─── useChartDimensions ───────────────────────────────────────────────────────

export interface ChartDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

export function useChartDimensions<T extends HTMLElement = HTMLDivElement>(
  marginConfig: Partial<{ top: number; right: number; bottom: number; left: number }> = {}
): [React.RefCallback<T>, ChartDimensions] {
  const margin = { top: 20, right: 30, bottom: 40, left: 60, ...marginConfig };
  const [ref, size] = useResizeObserver<T>({ debounce: 50 });

  const dims: ChartDimensions = useMemo(() => ({
    width: size.width,
    height: size.height,
    innerWidth: Math.max(0, size.width - margin.left - margin.right),
    innerHeight: Math.max(0, size.height - margin.top - margin.bottom),
    margin,
  }), [size.width, size.height, margin.top, margin.right, margin.bottom, margin.left]);

  return [ref, dims];
}

// ─── Import React ─────────────────────────────────────────────────────────────
import React from 'react';

export default useResizeObserver;
