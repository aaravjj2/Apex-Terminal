/**
 * useVirtualList.ts  
 * High-performance virtualization hook for rendering large lists and tables
 * without performance degradation. Supports fixed and variable row heights,
 * overscan buffer, scroll restoration, windowed rendering,
 * and programmatic scrolling to items by index.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
  end: number;
  key: string | number;
}

export interface VirtualListOptions<T> {
  items: T[];
  estimateSize?: (index: number) => number;
  overscan?: number;
  getKey?: (item: T, index: number) => string | number;
  scrollingDelay?: number;
}

export interface VirtualListResult<T> {
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
  startIndex: number;
  endIndex: number;
  visibleItems: T[];
  scrollOffset: number;
}

// ─── Size Cache ───────────────────────────────────────────────────────────────

class SizeCache {
  private cache = new Map<number, number>();
  private estimator: (index: number) => number;
  private count: number;
  private totalEstimated: number = -1;

  constructor(count: number, estimator: (index: number) => number) {
    this.count = count;
    this.estimator = estimator;
  }

  getSize(index: number): number {
    return this.cache.get(index) ?? this.estimator(index);
  }

  setMeasured(index: number, size: number) {
    this.totalEstimated = -1;
    this.cache.set(index, size);
  }

  getOffset(targetIndex: number): number {
    let offset = 0;
    for (let i = 0; i < targetIndex; i++) offset += this.getSize(i);
    return offset;
  }

  getTotalSize(): number {
    if (this.totalEstimated !== -1) return this.totalEstimated;
    let total = 0;
    for (let i = 0; i < this.count; i++) total += this.getSize(i);
    this.totalEstimated = total;
    return total;
  }

  update(count: number, estimator: (index: number) => number) {
    this.count = count;
    this.estimator = estimator;
    this.totalEstimated = -1;
  }
}

// ─── Core Hook ────────────────────────────────────────────────────────────────

export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListResult<T> {
  const {
    items,
    estimateSize = () => 40,
    overscan = 5,
    getKey = (_, index) => index,
    scrollingDelay = 150,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const sizeCache = useRef<SizeCache>(new SizeCache(items.length, estimateSize));

  // Update cache when items change
  useEffect(() => {
    sizeCache.current.update(items.length, estimateSize);
  }, [items.length, estimateSize]);

  // Observe container resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight || 600);
    return () => ro.disconnect();
  }, []);

  // Scroll handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollOffset(el.scrollTop);
        setIsScrolling(true);
        if (scrollingTimerRef.current) clearTimeout(scrollingTimerRef.current);
        scrollingTimerRef.current = setTimeout(() => setIsScrolling(false), scrollingDelay);
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollingDelay]);

  const totalSize = useMemo(() => sizeCache.current.getTotalSize(), [items.length, scrollOffset]);

  // Binary search for first visible index
  const startIndex = useMemo(() => {
    let lo = 0, hi = items.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const offset = sizeCache.current.getOffset(mid);
      if (offset < scrollOffset) lo = mid + 1; else hi = mid - 1;
    }
    return Math.max(0, lo - 1 - overscan);
  }, [items.length, scrollOffset, overscan]);

  const endIndex = useMemo(() => {
    const bottom = scrollOffset + containerHeight;
    let offset = sizeCache.current.getOffset(startIndex);
    let i = startIndex;
    while (i < items.length && offset < bottom) {
      offset += sizeCache.current.getSize(i);
      i++;
    }
    return Math.min(items.length - 1, i + overscan);
  }, [items.length, scrollOffset, containerHeight, overscan, startIndex]);

  const virtualItems = useMemo<VirtualItem[]>(() => {
    const result: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const size = sizeCache.current.getSize(i);
      const start = sizeCache.current.getOffset(i);
      result.push({ index: i, start, size, end: start + size, key: getKey(items[i], i) });
    }
    return result;
  }, [startIndex, endIndex, items, getKey]);

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex + 1), [items, startIndex, endIndex]);

  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    const el = containerRef.current;
    if (!el) return;

    const itemOffset = sizeCache.current.getOffset(index);
    const itemSize = sizeCache.current.getSize(index);
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;

    let target = viewTop;
    switch (align) {
      case 'start': target = itemOffset; break;
      case 'end': target = itemOffset - el.clientHeight + itemSize; break;
      case 'center': target = itemOffset - el.clientHeight / 2 + itemSize / 2; break;
      case 'auto':
        if (itemOffset < viewTop) target = itemOffset;
        else if (itemOffset + itemSize > viewBottom) target = itemOffset + itemSize - el.clientHeight;
        break;
    }
    el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, []);

  return {
    virtualItems,
    totalSize,
    scrollToIndex,
    containerRef,
    isScrolling,
    startIndex,
    endIndex,
    visibleItems,
    scrollOffset,
  };
}

// ─── Fixed Row Height (Optimized) ────────────────────────────────────────────

export function useFixedVirtualList<T>(items: T[], rowHeight: number, overscan = 5) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', h, { passive: true });
    return () => el.removeEventListener('scroll', h);
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(items.length - 1, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const totalHeight = items.length * rowHeight;

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex + 1), [items, startIndex, endIndex]);
  const offsetTop = startIndex * rowHeight;

  const scrollToIndex = useCallback((index: number) => {
    containerRef.current?.scrollTo({ top: index * rowHeight, behavior: 'smooth' });
  }, [rowHeight]);

  return { containerRef, visibleItems, startIndex, endIndex, totalHeight, offsetTop, scrollToIndex };
}

// ─── Virtual Table Columns ────────────────────────────────────────────────────

export interface VirtualColumn<T> {
  key: keyof T | string;
  header: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  frozen?: boolean;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export function useVirtualTable<T extends Record<string, any>>(
  data: T[],
  columns: VirtualColumn<T>[],
  rowHeight = 36
) {
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const filteredData = useMemo(() => {
    if (!filterText) return data;
    const lower = filterText.toLowerCase();
    return data.filter(row =>
      columns.some(col => String(row[col.key as keyof T] ?? '').toLowerCase().includes(lower))
    );
  }, [data, filterText, columns]);

  const sortedData = useMemo(() => {
    if (!sortState) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = a[sortState.key], bv = b[sortState.key];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortState.direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortState]);

  const virtualList = useFixedVirtualList(sortedData, rowHeight);

  const toggleSort = useCallback((key: string) => {
    setSortState(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  const toggleRow = useCallback((index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedRows(new Set(sortedData.map((_, i) => i))), [sortedData]);
  const clearSelection = useCallback(() => setSelectedRows(new Set()), []);

  const totalWidth = useMemo(() => columns.reduce((s, c) => s + c.width, 0), [columns]);

  return {
    ...virtualList,
    data: sortedData,
    columns,
    sortState,
    filterText,
    selectedRows,
    totalWidth,
    toggleSort,
    setFilterText,
    toggleRow,
    selectAll,
    clearSelection,
  };
}

// ─── Import React ──────────────────────────────────────────────────────────────
import React from 'react';

export default useVirtualList;
