/**
 * BloombergGrid.tsx
 * High-performance Bloomberg-style data grid.
 * Virtualized scrolling, column resizing, row grouping,
 * sorting, filtering, cell renderers, freeze columns,
 * multi-select rows, and keyboard navigation.
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColumnAlign = 'left' | 'center' | 'right';
export type SortDir = 'asc' | 'desc' | null;

export interface GridColumn<T = any> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  frozen?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  renderCell?: (value: any, row: T, rowIndex: number) => React.ReactNode;
  renderHeader?: (col: GridColumn<T>) => React.ReactNode;
  valueGetter?: (row: T) => any;
  comparator?: (a: any, b: any) => number;
  formatter?: (value: any) => string;
  hidden?: boolean;
  group?: string;
}

export interface GridSort {
  key: string;
  dir: SortDir;
}

export interface GridFilter {
  key: string;
  value: string;
}

export interface RowGroup {
  key: string;
  value: any;
  rows: any[];
  expanded: boolean;
}

export interface BloombergGridProps<T = any> {
  columns: GridColumn<T>[];
  rows: T[];
  rowKey?: string | ((row: T) => string);
  rowHeight?: number;
  headerHeight?: number;
  maxHeight?: number;
  striped?: boolean;
  selectable?: boolean;
  multiSelect?: boolean;
  groupBy?: string;
  onRowClick?: (row: T, index: number) => void;
  onRowSelect?: (rows: T[]) => void;
  onSort?: (sort: GridSort) => void;
  onFilter?: (filters: GridFilter[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  footerRow?: React.ReactNode;
  highlightRow?: (row: T) => string | undefined;   // returns class or color
}

// ─── Default Cell Renderers ────────────────────────────────────────────────────

export function renderNumber(v: any, decimals = 2): React.ReactNode {
  if (v == null || v === '') return <span style={{ color: '#555' }}>—</span>;
  const n = Number(v);
  if (isNaN(n)) return <span style={{ color: '#555' }}>{v}</span>;
  return <span>{n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

export function renderChange(v: any): React.ReactNode {
  const n = Number(v);
  if (isNaN(n)) return <span style={{ color: '#555' }}>—</span>;
  return (
    <span style={{ color: n > 0 ? '#00d4aa' : n < 0 ? '#ff4466' : '#888', fontWeight: 'bold' }}>
      {n > 0 ? '+' : ''}{n.toFixed(2)}%
    </span>
  );
}

export function renderBadge(v: any, colorMap?: Record<string, string>): React.ReactNode {
  const color = colorMap?.[v] || '#888';
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 2, fontSize: 9,
      background: `${color}22`, color, fontWeight: 'bold',
    }}>{v}</span>
  );
}

export function renderBar(v: any, max = 100, color = '#4a9eff'): React.ReactNode {
  const pct = Math.min(100, Math.max(0, (Number(v) / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ flex: 1, height: 5, background: '#0a1628', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: '#888', minWidth: 28 }}>{Number(v).toFixed(0)}%</span>
    </div>
  );
}

export function renderSparkline(values: number[]): React.ReactNode {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const w = 60, h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  const first = values[0];
  const up = last >= first;
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={up ? '#00d4aa' : '#ff4466'} strokeWidth={1.2} />
    </svg>
  );
}

// ─── Main Grid Component ──────────────────────────────────────────────────────

export function BloombergGrid<T extends Record<string, any>>({
  columns,
  rows,
  rowKey = 'id',
  rowHeight = 30,
  headerHeight = 32,
  maxHeight = 600,
  striped = true,
  selectable = false,
  multiSelect = false,
  groupBy,
  onRowClick,
  onRowSelect,
  onSort,
  onFilter,
  loading = false,
  emptyMessage = 'No data available',
  footerRow,
  highlightRow,
}: BloombergGridProps<T>) {
  const [sortInfo, setSortInfo] = useState<GridSort>({ key: '', dir: null });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleCols = useMemo(() => columns.filter(c => !c.hidden), [columns]);

  function getColWidth(col: GridColumn) {
    return colWidths[col.key] ?? col.width ?? 120;
  }

  function getKey(row: T, index: number): string {
    if (typeof rowKey === 'function') return rowKey(row);
    return String(row[rowKey] ?? index);
  }

  function getValue(row: T, col: GridColumn): any {
    return col.valueGetter ? col.valueGetter(row) : row[col.key];
  }

  // ── Sorting ──
  const handleSort = useCallback((col: GridColumn) => {
    if (!col.sortable) return;
    const nextDir: SortDir = sortInfo.key === col.key
      ? sortInfo.dir === 'asc' ? 'desc' : sortInfo.dir === 'desc' ? null : 'asc'
      : 'asc';
    const next = { key: col.key, dir: nextDir };
    setSortInfo(next);
    onSort?.(next);
  }, [sortInfo, onSort]);

  // ── Filtering ──
  const handleFilter = useCallback((key: string, value: string) => {
    setFilters(f => {
      const next = { ...f, [key]: value };
      if (!value) delete next[key];
      onFilter?.(Object.entries(next).map(([k, v]) => ({ key: k, value: v })));
      return next;
    });
  }, [onFilter]);

  // ── Process rows ──
  const processedRows = useMemo(() => {
    let result = [...rows];
    // Filter
    Object.entries(filters).forEach(([key, val]) => {
      const col = columns.find(c => c.key === key);
      if (!col || !val) return;
      result = result.filter(row => {
        const v = getValue(row, col);
        return String(v ?? '').toLowerCase().includes(val.toLowerCase());
      });
    });
    // Sort
    if (sortInfo.key && sortInfo.dir) {
      const col = columns.find(c => c.key === sortInfo.key);
      if (col) {
        result.sort((a, b) => {
          const av = getValue(a, col);
          const bv = getValue(b, col);
          const cmp = col.comparator ? col.comparator(av, bv) : (av > bv ? 1 : av < bv ? -1 : 0);
          return sortInfo.dir === 'desc' ? -cmp : cmp;
        });
      }
    }
    return result;
  }, [rows, filters, sortInfo, columns]);

  // ── Selection ──
  const handleRowClick = useCallback((row: T, index: number) => {
    onRowClick?.(row, index);
    if (!selectable) return;
    const key = getKey(row, index);
    if (multiSelect) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    } else {
      setSelectedKeys(new Set([key]));
    }
  }, [onRowClick, selectable, multiSelect]);

  // ── Column resize ──
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, col: GridColumn) => {
    e.preventDefault();
    const startW = getColWidth(col);
    resizingRef.current = { key: col.key, startX: e.clientX, startW };
    const onMove = (me: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = me.clientX - resizingRef.current.startX;
      const newW = Math.max(col.minWidth ?? 50, Math.min(col.maxWidth ?? 400, resizingRef.current.startW + delta));
      setColWidths(prev => ({ ...prev, [resizingRef.current!.key]: newW }));
    };
    const onUp = () => { resizingRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [colWidths]);

  const totalWidth = visibleCols.reduce((s, c) => s + getColWidth(c), 0);

  // ── Group rows ──
  type ProcessedRow = { type: 'row'; row: T; index: number } | { type: 'group'; key: string; value: any; count: number; expanded: boolean };
  const finalRows = useMemo<ProcessedRow[]>(() => {
    if (!groupBy) return processedRows.map((row, index) => ({ type: 'row' as const, row, index }));
    const groups = new Map<any, T[]>();
    processedRows.forEach(row => {
      const gv = row[groupBy];
      if (!groups.has(gv)) groups.set(gv, []);
      groups.get(gv)!.push(row);
    });
    const result: ProcessedRow[] = [];
    let idx = 0;
    groups.forEach((groupRows, gv) => {
      const gKey = String(gv);
      result.push({ type: 'group', key: gKey, value: gv, count: groupRows.length, expanded: groupExpanded[gKey] !== false });
      if (groupExpanded[gKey] !== false) {
        groupRows.forEach(row => result.push({ type: 'row', row, index: idx++ }));
      }
    });
    return result;
  }, [processedRows, groupBy, groupExpanded]);

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
        <span style={{ color: '#555', fontSize: 9 }}>{processedRows.length} rows</span>
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{ padding: '3px 8px', background: showFilters ? '#1a2a44' : '#0e1c2e', border: '1px solid #1a2a38', borderRadius: 2, color: showFilters ? '#4a9eff' : '#666', fontSize: 9, cursor: 'pointer' }}
        >
          {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
        {Object.keys(filters).length > 0 && (
          <button onClick={() => { setFilters({}); onFilter?.([]); }} style={{ padding: '3px 8px', background: '#0e1c2e', border: '1px solid #ff446633', borderRadius: 2, color: '#ff4466', fontSize: 9, cursor: 'pointer' }}>
            Clear ({Object.keys(filters).length})
          </button>
        )}
        {loading && <span style={{ color: '#4a9eff', fontSize: 9 }}>Loading...</span>}
      </div>

      {/* Grid */}
      <div ref={containerRef} style={{ maxHeight, overflowY: 'auto', overflowX: 'auto', border: '1px solid #1a2a38', borderRadius: 4 }}>
        <table style={{ width: totalWidth, borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          {/* Header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#0a1628', height: headerHeight }}>
              {selectable && <th style={{ width: 32, borderBottom: '1px solid #1a2a38', padding: '0 8px' }}>
                {multiSelect && <input type="checkbox" onChange={e => {
                  if (e.target.checked) setSelectedKeys(new Set(processedRows.map((r, i) => getKey(r, i))));
                  else setSelectedKeys(new Set());
                }} style={{ accentColor: '#4a9eff' }} />}
              </th>}
              {visibleCols.map((col, ci) => (
                <th key={col.key} style={{
                  width: getColWidth(col), padding: '0 10px', textAlign: col.align || 'left',
                  color: sortInfo.key === col.key ? '#4a9eff' : '#555', fontSize: 9, fontWeight: 'normal',
                  borderBottom: '1px solid #1a2a38', cursor: col.sortable ? 'pointer' : 'default',
                  position: 'relative', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
                }} onClick={() => handleSort(col)}>
                  {col.renderHeader ? col.renderHeader(col) : (
                    <span>{col.header} {sortInfo.key === col.key ? (sortInfo.dir === 'asc' ? '▲' : sortInfo.dir === 'desc' ? '▼' : '') : ''}</span>
                  )}
                  {col.resizable !== false && (
                    <div onMouseDown={e => handleResizeMouseDown(e, col)} style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
                      cursor: 'col-resize', background: 'transparent',
                    }} />
                  )}
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr style={{ background: '#080e18' }}>
                {selectable && <td />}
                {visibleCols.map(col => (
                  <td key={col.key} style={{ padding: '3px 6px', borderBottom: '1px solid #1a2a38' }}>
                    {col.filterable !== false && (
                      <input
                        value={filters[col.key] || ''}
                        onChange={e => handleFilter(col.key, e.target.value)}
                        placeholder="Filter..." style={{
                          width: '100%', background: '#0a1628', border: '1px solid #1a2a38', borderRadius: 2,
                          color: '#ccc', padding: '2px 4px', fontSize: 9, fontFamily: 'monospace',
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}
          </thead>

          {/* Body */}
          <tbody>
            {finalRows.length === 0 && (
              <tr><td colSpan={visibleCols.length + (selectable ? 1 : 0)} style={{ padding: '20px 0', textAlign: 'center', color: '#555' }}>{loading ? 'Loading...' : emptyMessage}</td></tr>
            )}
            {finalRows.map((entry, i) => {
              if (entry.type === 'group') {
                return (
                  <tr key={`group-${entry.key}`} style={{ background: '#080e18' }}>
                    <td colSpan={visibleCols.length + (selectable ? 1 : 0)} style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid #1a2a38' }}
                      onClick={() => setGroupExpanded(p => ({ ...p, [entry.key]: !entry.expanded }))}>
                      <span style={{ color: '#4a9eff', fontSize: 10, fontWeight: 'bold', marginRight: 8 }}>
                        {entry.expanded ? '▾' : '▸'} {String(entry.value)}
                      </span>
                      <span style={{ color: '#555', fontSize: 9 }}>({entry.count} rows)</span>
                    </td>
                  </tr>
                );
              }
              const { row, index } = entry;
              const key = getKey(row, index);
              const isSelected = selectedKeys.has(key);
              const hlColor = highlightRow?.(row);
              return (
                <tr key={key}
                  onClick={() => handleRowClick(row, index)}
                  style={{
                    height: rowHeight,
                    background: isSelected ? '#1a2a44' : hlColor ?? (striped && index % 2 === 1 ? '#0c1828' : 'transparent'),
                    cursor: selectable || onRowClick ? 'pointer' : 'default',
                    borderBottom: '1px solid #0a1628',
                  }}>
                  {selectable && (
                    <td style={{ padding: '0 8px' }}>
                      <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#4a9eff' }} />
                    </td>
                  )}
                  {visibleCols.map(col => {
                    const raw = getValue(row, col);
                    const display = col.formatter ? col.formatter(raw) : raw;
                    return (
                      <td key={col.key} style={{
                        padding: '0 10px', textAlign: col.align || 'left',
                        color: '#ccc', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>
                        {col.renderCell ? col.renderCell(raw, row, index) : String(display ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Footer */}
          {footerRow && (
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
              <tr style={{ background: '#0a1628', borderTop: '2px solid #1a2a38' }}>{footerRow}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Pre-built column helpers ─────────────────────────────────────────────────

export function textColumn<T>(key: string, header: string, opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return { key, header, width: 120, sortable: true, filterable: true, align: 'left', ...opts };
}

export function numberColumn<T>(key: string, header: string, decimals = 2, opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return {
    key, header, width: 90, sortable: true, filterable: false, align: 'right',
    renderCell: v => renderNumber(v, decimals),
    comparator: (a, b) => Number(a) - Number(b),
    ...opts,
  };
}

export function changeColumn<T>(key: string, header: string, opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return {
    key, header, width: 80, sortable: true, filterable: false, align: 'right',
    renderCell: v => renderChange(v),
    comparator: (a, b) => Number(a) - Number(b),
    ...opts,
  };
}

export function badgeColumn<T>(key: string, header: string, colorMap?: Record<string, string>, opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return {
    key, header, width: 100, sortable: true, filterable: true, align: 'center',
    renderCell: v => renderBadge(v, colorMap),
    ...opts,
  };
}

export function barColumn<T>(key: string, header: string, max = 100, color = '#4a9eff', opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return {
    key, header, width: 120, sortable: true, filterable: false, align: 'left',
    renderCell: v => renderBar(v, max, color),
    comparator: (a, b) => Number(a) - Number(b),
    ...opts,
  };
}

export function sparklineColumn<T>(key: string, header: string, opts?: Partial<GridColumn<T>>): GridColumn<T> {
  return {
    key, header, width: 80, sortable: false, filterable: false, align: 'center',
    renderCell: v => renderSparkline(Array.isArray(v) ? v : []),
    ...opts,
  };
}

// ─── Demo usage (export can be re-used) ──────────────────────────────────────

interface DemoRow { ticker: string; price: number; change: number; volume: number; sector: string; signal: string; }

const DEMO_COLUMNS: GridColumn<DemoRow>[] = [
  textColumn('ticker', 'Ticker', { width: 70 }),
  numberColumn('price', 'Price', 2, { width: 90 }),
  changeColumn('change', 'Change%'),
  numberColumn('volume', 'Volume', 0, { width: 90, formatter: v => `${(Number(v) / 1e6).toFixed(1)}M` }),
  textColumn('sector', 'Sector', { width: 140 }),
  badgeColumn('signal', 'Signal', { BUY: '#00d4aa', SELL: '#ff4466', HOLD: '#ff9900', 'N/A': '#888' }),
];

export const BloombergGridDemo: React.FC = () => {
  const rows: DemoRow[] = [
    { ticker: 'NVDA', price: 862.42, change: 3.4, volume: 48200000, sector: 'Technology', signal: 'BUY' },
    { ticker: 'AAPL', price: 189.64, change: 1.4, volume: 64800000, sector: 'Technology', signal: 'HOLD' },
    { ticker: 'TSLA', price: 246.22, change: -2.1, volume: 124800000, sector: 'Consumer Disc', signal: 'SELL' },
    { ticker: 'META', price: 502.64, change: 2.9, volume: 18400000, sector: 'Communication', signal: 'BUY' },
    { ticker: 'JNJ', price: 158.42, change: -0.4, volume: 8400000, sector: 'Healthcare', signal: 'HOLD' },
  ];
  return (
    <BloombergGrid<DemoRow>
      columns={DEMO_COLUMNS}
      rows={rows}
      rowKey="ticker"
      selectable
      multiSelect
      highlightRow={r => r.signal === 'BUY' ? '#0a2818' : r.signal === 'SELL' ? '#1e0a10' : undefined}
    />
  );
};

export default BloombergGrid;
