/**
 * DataTableUI2 — W103 enhanced data table
 * Toolbar with search, column filter, export (CSV).
 * Virtualization for large lists (windowed rendering).
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

export interface ColumnDefUI2<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface DataTableUI2Props<T = Record<string, unknown>> {
  columns: ColumnDefUI2<T>[];
  data: T[];
  keyField?: string;
  /** Enables virtualized rendering (row height required) */
  virtualize?: boolean;
  rowHeight?: number;
  visibleRows?: number;
  onRowClick?: (row: T, index: number) => void;
  testId?: string;
  exportFileName?: string;
  /** Page title shown in toolbar */
  title?: string;
  loading?: boolean;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc' | null;

// ─── CSV export helper ────────────────────────────────────────────────────────

function toCSV<T>(columns: ColumnDefUI2<T>[], data: T[]): string {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = (row as Record<string, unknown>)[c.key];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(filename: string, data: string) {
  const blob = new Blob([data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTableUI2<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id',
  virtualize = false,
  rowHeight = 36,
  visibleRows = 20,
  onRowClick,
  testId = 'data-table-ui2',
  exportFileName = 'export.csv',
  title,
  loading = false,
  emptyMessage = 'No rows to display.',
}: DataTableUI2Props<T>) {
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(columns.map(c => c.key)));
  const [showColFilter, setShowColFilter] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeCols = useMemo(() => columns.filter(c => visibleCols.has(c.key)), [columns, visibleCols]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return data;
    const q = searchText.toLowerCase();
    return data.filter(row =>
      columns.some(c => String((row as Record<string, unknown>)[c.key] ?? '').toLowerCase().includes(q))
    );
  }, [data, searchText, columns]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av === bv) return 0;
      const cmp = av! < bv! ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = useCallback((key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
  }, [sortKey, sortDir]);

  const handleExport = useCallback(() => {
    downloadCSV(exportFileName, toCSV(activeCols, sorted));
  }, [activeCols, sorted, exportFileName]);

  // Virtualization
  const totalH = sorted.length * rowHeight;
  const startIdx = virtualize ? Math.floor(scrollTop / rowHeight) : 0;
  const endIdx = virtualize ? Math.min(sorted.length, startIdx + visibleRows + 2) : sorted.length;
  const visibleData = sorted.slice(startIdx, endIdx);

  return (
    <div data-testid={testId} style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Toolbar */}
      <div
        data-testid="data-table-toolbar"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #334155', background: '#0F172A', flexWrap: 'wrap' }}
      >
        {title && <span style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 14, marginRight: 4 }}>{title}</span>}

        <input
          data-testid="data-table-search-input"
          type="text"
          placeholder="Search…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ flex: 1, minWidth: 140, background: '#1E293B', border: '1px solid #334155', borderRadius: 6, padding: '5px 10px', color: '#E2E8F0', fontSize: 13, outline: 'none' }}
        />

        <button
          data-testid="data-table-col-filter-btn"
          onClick={() => setShowColFilter(v => !v)}
          title="Toggle columns"
          style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 6, padding: '5px 10px', color: '#94A3B8', cursor: 'pointer', fontSize: 12 }}
        >
          Columns
        </button>

        <button
          data-testid="data-table-export-btn"
          onClick={handleExport}
          title="Export CSV"
          style={{ background: '#1E3A5F', border: '1px solid #1D4ED8', borderRadius: 6, padding: '5px 10px', color: '#93C5FD', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          Export CSV
        </button>

        <span style={{ color: '#475569', fontSize: 12, marginLeft: 'auto' }}>
          {filtered.length} / {data.length} rows
        </span>
      </div>

      {/* Column visibility filter dropdown */}
      {showColFilter && (
        <div
          data-testid="data-table-col-filter-panel"
          style={{ padding: '10px 14px', borderBottom: '1px solid #334155', background: '#0F172A', display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {columns.map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#CBD5E1' }}>
              <input
                type="checkbox"
                checked={visibleCols.has(c.key)}
                onChange={() => {
                  const next = new Set(visibleCols);
                  next.has(c.key) ? next.delete(c.key) : next.add(c.key);
                  setVisibleCols(next);
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div data-testid="data-table-loading" style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>
      ) : sorted.length === 0 ? (
        <div data-testid="data-table-empty" style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>{emptyMessage}</div>
      ) : (
        <div
          ref={scrollRef}
          data-testid="data-table-scroll"
          style={virtualize ? { overflowY: 'auto', height: visibleRows * rowHeight } : {}}
          onScroll={virtualize ? e => setScrollTop((e.target as HTMLElement).scrollTop) : undefined}
        >
          <div style={virtualize ? { height: totalH, position: 'relative' } : {}}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155' }}>
                  {activeCols.map(col => (
                    <th
                      key={col.key}
                      style={{ padding: '8px 12px', textAlign: col.align || 'left', fontSize: 11, color: '#64748B', fontWeight: 600, cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none', width: col.width }}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label}
                      {col.sortable && sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody
                data-testid="data-table-rows"
                style={virtualize ? { position: 'absolute', top: startIdx * rowHeight, width: '100%' } : {}}
              >
                {visibleData.map((row, relIdx) => {
                  const absIdx = startIdx + relIdx;
                  const key = String((row as Record<string, unknown>)[keyField] ?? absIdx);
                  return (
                    <tr
                      key={key}
                      data-testid={`data-table-row-${absIdx}`}
                      onClick={() => onRowClick?.(row, absIdx)}
                      style={{ borderTop: absIdx > 0 ? '1px solid #1E293B' : undefined, cursor: onRowClick ? 'pointer' : 'default' }}
                    >
                      {activeCols.map(col => (
                        <td key={col.key} style={{ padding: '7px 12px', fontSize: 13, color: '#CBD5E1', textAlign: col.align || 'left' }}>
                          {col.render ? col.render((row as Record<string, unknown>)[col.key], row, absIdx) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTableUI2;
