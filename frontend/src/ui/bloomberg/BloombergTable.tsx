/**
 * BloombergTable.tsx
 * Reusable Bloomberg-style sortable data table component for Apex Terminal.
 * Supports column sorting, column resizing, row selection, pagination, filtering, and custom cell renderers.
 */

import React, {
  useState, useCallback, useMemo, useRef, useEffect, ReactNode, CSSProperties,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;
export type ColumnAlign = 'left' | 'center' | 'right';
export type ColumnVariant = 'default' | 'number' | 'percent' | 'currency' | 'badge' | 'sparkline' | 'change';

export interface BloombergTableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  accessor: (row: T, index?: number) => unknown;
  align?: ColumnAlign;
  variant?: ColumnVariant;
  width?: number | string;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  frozen?: boolean;
  hidden?: boolean;
  cellClassName?: string | ((value: unknown, row: T) => string);
  cellStyle?: CSSProperties | ((value: unknown, row: T) => CSSProperties);
  render?: (value: unknown, row: T, index: number) => ReactNode;
  headerTooltip?: string;
  colorScale?: (value: unknown, row: T) => string | undefined;
}

export interface BloombergTableProps<T = Record<string, unknown>> {
  columns: BloombergTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string | number;
  caption?: string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  sortable?: boolean;
  defaultSortKey?: string;
  defaultSortDirection?: SortDirection;
  externalSort?: boolean;
  onSortChange?: (key: string, direction: SortDirection) => void;
  selectable?: boolean;
  selectedKeys?: (string | number)[];
  onSelectionChange?: (keys: (string | number)[]) => void;
  multiSelect?: boolean;
  paginated?: boolean;
  pageSize?: number;
  totalRows?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  filterable?: boolean;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  stickyHeader?: boolean;
  zebra?: boolean;
  compact?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string;
  rowStyle?: (row: T, index: number) => CSSProperties;
  headerChildren?: ReactNode;
  footerSummary?: (data: T[]) => ReactNode;
  columnResizable?: boolean;
}

// ─── Utility Formatters ───────────────────────────────────────────────────────

function formatCell(value: unknown, variant: ColumnVariant): string {
  if (value === null || value === undefined) return '—';
  switch (variant) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(value);
    case 'percent':
      return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : String(value);
    case 'currency':
      return typeof value === 'number' ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value);
    case 'change':
      return typeof value === 'number' ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%` : String(value);
    default:
      return String(value);
  }
}

function getChangeColor(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined;
  return value > 0.001 ? '#00d4aa' : value < -0.001 ? '#ff4444' : '#888';
}

// ─── SortIcon ─────────────────────────────────────────────────────────────────

const SortIcon: React.FC<{ direction: SortDirection }> = ({ direction }) => (
  <span className="bloomberg-table__sort-icon" aria-hidden>
    {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
  </span>
);

// ─── FilterRow ────────────────────────────────────────────────────────────────

interface FilterRowProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const FilterRow: React.FC<FilterRowProps> = ({ value, onChange, placeholder = 'Filter...' }) => (
  <div className="bloomberg-table__filter-row">
    <span className="bloomberg-table__filter-icon">⊘</span>
    <input
      type="text"
      className="bloomberg-table__filter-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label="Filter table"
    />
    {value && (
      <button className="bloomberg-table__filter-clear" onClick={() => onChange('')}>✕</button>
    )}
  </div>
);

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  pageSize: number;
  totalRows: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, pageSize, totalRows }) => {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);
  const pages = useMemo(() => {
    const p: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i);
    } else {
      p.push(1);
      if (currentPage > 3) p.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) p.push(i);
      if (currentPage < totalPages - 2) p.push('...');
      p.push(totalPages);
    }
    return p;
  }, [currentPage, totalPages]);

  return (
    <div className="bloomberg-table__pagination">
      <span className="bloomberg-table__page-info">{start}–{end} of {totalRows}</span>
      <div className="bloomberg-table__page-buttons">
        <button disabled={currentPage === 1} onClick={() => onPageChange(1)}>«</button>
        <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>‹</button>
        {pages.map((p, i) =>
          p === '...' ? <span key={`dots_${i}`} className="bloomberg-table__dots">…</span> :
          <button
            key={p}
            className={currentPage === p ? 'bloomberg-table__page-btn--active' : ''}
            onClick={() => onPageChange(p as number)}
          >{p}</button>
        )}
        <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>›</button>
        <button disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>»</button>
      </div>
    </div>
  );
};

// ─── Sparkline Cell ──────────────────────────────────────────────────────────

const SparklineCell: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#00d4aa' }) => {
  if (!data || data.length < 2) return <span>—</span>;
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const W = 60; const H = 20; const pad = 2;
  const xStep = (W - pad * 2) / (data.length - 1);
  const yScale = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const pts = data.map((v, i) => `${pad + i * xStep},${yScale(v)}`).join(' L ');
  const clr = data[data.length - 1] >= data[0] ? '#00d4aa' : '#ff4444';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <path d={`M ${pts}`} fill="none" stroke={clr} strokeWidth="1.5" />
    </svg>
  );
};

// ─── Main BloombergTable ─────────────────────────────────────────────────────

function BloombergTable<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  caption,
  loading = false,
  error = null,
  emptyMessage = 'No data available',
  sortable = true,
  defaultSortKey,
  defaultSortDirection = null,
  externalSort = false,
  onSortChange,
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  multiSelect = false,
  paginated = false,
  pageSize: propPageSize = 25,
  totalRows: propTotalRows,
  currentPage: controlledCurrentPage,
  onPageChange,
  filterable = false,
  filterValue: controlledFilterValue,
  onFilterChange,
  stickyHeader = true,
  zebra = true,
  compact = false,
  hoverable = true,
  bordered = false,
  className = '',
  onRowClick,
  onRowDoubleClick,
  rowClassName,
  rowStyle,
  headerChildren,
  footerSummary,
}: BloombergTableProps<T>): JSX.Element {

  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDirection);
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<(string | number)[]>([]);
  const [internalFilter, setInternalFilter] = useState('');
  const [internalPage, setInternalPage] = useState(1);

  const selectedKeys = controlledSelectedKeys ?? internalSelectedKeys;
  const filterValue = controlledFilterValue ?? internalFilter;
  const currentPage = controlledCurrentPage ?? internalPage;

  const visibleColumns = useMemo(() => columns.filter(c => !c.hidden), [columns]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    if (!sortable) return;
    const col = columns.find(c => c.key === key);
    if (!col || col.sortable === false) return;
    const newDir: SortDirection = sortKey === key ? (sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc') : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSortChange?.(key, newDir);
  }, [sortable, columns, sortKey, sortDir, onSortChange]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((v: string) => {
    if (!controlledFilterValue) setInternalFilter(v);
    if (!controlledCurrentPage) setInternalPage(1);
    onFilterChange?.(v);
  }, [controlledFilterValue, controlledCurrentPage, onFilterChange]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleRowSelect = useCallback((key: string | number, row: T) => {
    if (!selectable) return;
    let next: (string | number)[];
    if (multiSelect) {
      next = selectedKeys.includes(key) ? selectedKeys.filter(k => k !== key) : [...selectedKeys, key];
    } else {
      next = selectedKeys.includes(key) ? [] : [key];
    }
    if (!controlledSelectedKeys) setInternalSelectedKeys(next);
    onSelectionChange?.(next);
  }, [selectable, multiSelect, selectedKeys, controlledSelectedKeys, onSelectionChange]);

  // ── Process data ──────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!filterable || !filterValue) return data;
    const lower = filterValue.toLowerCase();
    return data.filter(row =>
      visibleColumns.some(col => {
        const v = col.accessor(row);
        return v !== null && v !== undefined && String(v).toLowerCase().includes(lower);
      })
    );
  }, [data, filterable, filterValue, visibleColumns]);

  const sortedData = useMemo(() => {
    if (externalSort || !sortKey || !sortDir) return filteredData;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, externalSort, sortKey, sortDir, columns]);

  const pageSize = propPageSize;
  const totalRows = propTotalRows ?? sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const pagedData = useMemo(() => {
    if (!paginated) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [paginated, sortedData, currentPage, pageSize]);

  const handlePageChange = useCallback((p: number) => {
    if (!controlledCurrentPage) setInternalPage(p);
    onPageChange?.(p);
  }, [controlledCurrentPage, onPageChange]);

  // ── Render cell ───────────────────────────────────────────────────────────
  const renderCell = useCallback((col: BloombergTableColumn<T>, row: T, idx: number): ReactNode => {
    const raw = col.accessor(row, idx);
    if (col.render) return col.render(raw, row, idx);

    const variant = col.variant || 'default';

    if (variant === 'sparkline') {
      return <SparklineCell data={raw as number[]} />;
    }

    let cellStyle: CSSProperties = {};
    if (variant === 'change') {
      cellStyle = { color: getChangeColor(raw) ?? '#888', fontWeight: 'bold' };
    } else if (col.colorScale) {
      const c = col.colorScale(raw, row);
      if (c) cellStyle = { color: c };
    }

    const extra = typeof col.cellStyle === 'function' ? col.cellStyle(raw, row) : col.cellStyle;
    if (extra) Object.assign(cellStyle, extra);

    const extraClass = typeof col.cellClassName === 'function' ? col.cellClassName(raw, row) : col.cellClassName;

    return (
      <span className={`cell-content${extraClass ? ` ${extraClass}` : ''}`} style={cellStyle}>
        {formatCell(raw, variant)}
      </span>
    );
  }, []);

  return (
    <div
      className={`bloomberg-table-container${compact ? ' bloomberg-table-container--compact' : ''}${bordered ? ' bloomberg-table-container--bordered' : ''} ${className}`}
    >
      {/* ── Table Header Controls ───── */}
      {(filterable || caption || headerChildren) && (
        <div className="bloomberg-table__controls">
          {caption && <div className="bloomberg-table__caption">{caption}</div>}
          {headerChildren}
          {filterable && (
            <FilterRow value={filterValue} onChange={handleFilterChange} />
          )}
        </div>
      )}

      {/* ── Error ──────────────────── */}
      {error && (
        <div className="bloomberg-table__error">⚠ {error}</div>
      )}

      {/* ── Table ──────────────────── */}
      <div className="bloomberg-table__scroll-wrapper">
        <table
          className={`bloomberg-table${stickyHeader ? ' bloomberg-table--sticky-header' : ''}${zebra ? ' bloomberg-table--zebra' : ''}${hoverable ? ' bloomberg-table--hoverable' : ''}`}
          role="grid"
          aria-busy={loading}
        >
          <thead>
            <tr>
              {selectable && multiSelect && (
                <th className="bloomberg-table__th bloomberg-table__th--select">
                  <input
                    type="checkbox"
                    onChange={e => {
                      const next = e.target.checked ? pagedData.map((r, i) => rowKey(r, i)) : [];
                      if (!controlledSelectedKeys) setInternalSelectedKeys(next);
                      onSelectionChange?.(next);
                    }}
                    checked={pagedData.length > 0 && pagedData.every((r, i) => selectedKeys.includes(rowKey(r, i)))}
                  />
                </th>
              )}
              {visibleColumns.map(col => {
                const isSorted = sortKey === col.key;
                const canSort = sortable && col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    className={`bloomberg-table__th bloomberg-table__th--${col.align || 'left'}${col.frozen ? ' bloomberg-table__th--frozen' : ''}${canSort ? ' bloomberg-table__th--sortable' : ''}`}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    onClick={() => canSort && handleSort(col.key)}
                    title={col.headerTooltip}
                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className="bloomberg-table__th-label">{col.header}</span>
                    {canSort && <SortIcon direction={isSorted ? sortDir : null} />}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="bloomberg-table__loading-cell">
                  <div className="bloomberg-table__loading-spinner">⟳ Loading...</div>
                </td>
              </tr>
            ) : pagedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="bloomberg-table__empty-cell">
                  {emptyMessage}
                </td>
              </tr>
            ) : pagedData.map((row, rowIdx) => {
              const key = rowKey(row, rowIdx);
              const isSelected = selectedKeys.includes(key);
              const extraRowClass = rowClassName?.(row, rowIdx) ?? '';
              const extraRowStyle = rowStyle?.(row, rowIdx);
              return (
                <tr
                  key={key}
                  className={`bloomberg-table__tr${isSelected ? ' bloomberg-table__tr--selected' : ''} ${extraRowClass}`}
                  style={extraRowStyle}
                  onClick={() => {
                    handleRowSelect(key, row);
                    onRowClick?.(row, rowIdx);
                  }}
                  onDoubleClick={() => onRowDoubleClick?.(row, rowIdx)}
                  aria-selected={isSelected}
                  role="row"
                >
                  {selectable && multiSelect && (
                    <td className="bloomberg-table__td bloomberg-table__td--select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(key, row)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td
                      key={col.key}
                      className={`bloomberg-table__td bloomberg-table__td--${col.align || 'left'}${col.frozen ? ' bloomberg-table__td--frozen' : ''}`}
                    >
                      {renderCell(col, row, rowIdx)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

          {footerSummary && (
            <tfoot>
              <tr className="bloomberg-table__summary-row">
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)}>
                  {footerSummary(sortedData)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Pagination ─────────────── */}
      {paginated && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={pageSize}
          totalRows={totalRows}
        />
      )}
    </div>
  );
}

export default BloombergTable;

// ─── Pre-built Column Factories ──────────────────────────────────────────────

export function symbolColumn<T>(accessor: (row: T) => string, color?: string): BloombergTableColumn<T> {
  return {
    key: 'symbol',
    header: 'Symbol',
    accessor,
    align: 'left',
    width: 80,
    render: (value) => (
      <span className="cell-symbol" style={{ color: color || '#00aaff' }}>{String(value)}</span>
    ),
  };
}

export function changeColumn<T>(
  key: string,
  header: string,
  accessor: (row: T) => number,
): BloombergTableColumn<T> {
  return {
    key,
    header,
    accessor,
    align: 'right',
    variant: 'change',
    sortable: true,
    colorScale: (v) => {
      const n = v as number;
      return n > 0.001 ? '#00d4aa' : n < -0.001 ? '#ff4444' : '#888';
    },
  };
}

export function percentColumn<T>(
  key: string,
  header: string,
  accessor: (row: T) => number,
): BloombergTableColumn<T> {
  return {
    key,
    header,
    accessor,
    align: 'right',
    variant: 'percent',
    sortable: true,
  };
}

export function currencyColumn<T>(
  key: string,
  header: string,
  accessor: (row: T) => number,
): BloombergTableColumn<T> {
  return {
    key,
    header,
    accessor,
    align: 'right',
    variant: 'currency',
    sortable: true,
  };
}

export function sparklineColumn<T>(
  key: string,
  header: string,
  accessor: (row: T) => number[],
): BloombergTableColumn<T> {
  return {
    key,
    header,
    accessor,
    align: 'center',
    variant: 'sparkline',
    sortable: false,
    width: 80,
  };
}
