/**
 * useDebounce.ts
 * Debounce utilities: useDebounce for values, useDebouncedCallback for
 * functions, with configurable delay and cancel/flush support.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

// ─── useDebounce (value) ───────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

// ─── useDebouncedCallback (function) ───────────────────────────────────────────

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = 300
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const debounced = useMemo(() => {
    const fn = (...args: Parameters<T>) => {
      pendingArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const savedArgs = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (savedArgs) callbackRef.current(...savedArgs);
      }, delayMs);
    };

    fn.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingArgsRef.current = null;
    };

    fn.flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const savedArgs = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (savedArgs) callbackRef.current(...savedArgs);
    };

    fn.isPending = () => timerRef.current !== null;

    return fn as DebouncedFunction<T>;
  }, [delayMs]);

  return debounced;
}

export default useDebounce;
