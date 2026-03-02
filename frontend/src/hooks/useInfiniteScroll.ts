/**
 * useInfiniteScroll.ts
 * Intersection Observer-based infinite scroll hook with configurable threshold,
 * loading/error states, reset/refresh, and reverse scroll mode for chat-like UIs.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  reverse?: boolean;
  initialLoad?: boolean;
  loadMoreDelay?: number;
}

export interface UseInfiniteScrollReturn {
  sentinelRef: (node: HTMLElement | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  reset: () => void;
  refresh: () => void;
  retry: () => void;
  setHasMore: (hasMore: boolean) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useInfiniteScroll(
  loadMore: (page: number) => Promise<boolean | void>,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const {
    threshold = 0,
    rootMargin = '200px',
    enabled = true,
    reverse = false,
    initialLoad = true,
    loadMoreDelay = 0,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLElement | null>(null);
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  const doLoad = useCallback(async (pageNum: number) => {
    if (isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      if (loadMoreDelay > 0) await new Promise(r => setTimeout(r, loadMoreDelay));

      const scrollContainer = containerRef.current;
      const prevScrollHeight = reverse && scrollContainer ? scrollContainer.scrollHeight : 0;

      const result = await loadMore(pageNum);

      if (!mountedRef.current) return;

      if (result === false) {
        setHasMore(false);
      } else {
        setPage(p => p + 1);
      }

      if (reverse && scrollContainer) {
        requestAnimationFrame(() => {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop += newScrollHeight - prevScrollHeight;
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(String(err));
      }
    } finally {
      if (mountedRef.current) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [loadMore, hasMore, reverse, loadMoreDelay]);

  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!enabled || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoadingRef.current && hasMore) {
          doLoad(page);
        }
      },
      {
        root: containerRef.current,
        rootMargin,
        threshold,
      }
    );

    if (sentinelNodeRef.current) {
      observerRef.current.observe(sentinelNodeRef.current);
    }
  }, [enabled, hasMore, page, doLoad, rootMargin, threshold]);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current && sentinelNodeRef.current) {
      observerRef.current.unobserve(sentinelNodeRef.current);
    }
    sentinelNodeRef.current = node;
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    setupObserver();
    return () => {
      observerRef.current?.disconnect();
    };
  }, [setupObserver]);

  useEffect(() => {
    mountedRef.current = true;
    if (initialLoad && enabled && hasMore && page === 0) {
      doLoad(0);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setPage(0);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  const refresh = useCallback(() => {
    reset();
    requestAnimationFrame(() => doLoad(0));
  }, [reset, doLoad]);

  const retry = useCallback(() => {
    setError(null);
    doLoad(page);
  }, [doLoad, page]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return {
    sentinelRef,
    containerRef,
    isLoading,
    error,
    hasMore,
    page,
    reset,
    refresh,
    retry,
    setHasMore,
  };
}

export default useInfiniteScroll;
