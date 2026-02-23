/**
 * UI2 DataTable Component
 * Dense tabular data display for positions, orders, trades, backtests
 * With formatting helpers, badge support, and action buttons
 */

import React from 'react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, rowIndex: number) => React.ReactNode;
  className?: string;
  format?: 'number' | 'currency' | 'percent' | 'date' | 'time' | 'datetime';
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: string;
  onRowClick?: (row: T, index: number) => void;
  selectedRowKey?: string | number;
  highlightRowKey?: string | number | null;
  density?: 'compact' | 'normal';
  testId?: string;
  striped?: boolean;
}

/* ─────────────────────────────────────────────────────────────── */
/* Formatting Utilities */
/* ─────────────────────────────────────────────────────────────── */

export function formatValue(value: any, format?: string): string {
  // Handle null/undefined/NaN
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
    return '—';
  }

  if (format === 'number') {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  if (format === 'percent') {
    return `${(Number(value) * 100).toFixed(2)}%`;
  }

  if (format === 'date') {
    return new Date(value).toLocaleDateString();
  }

  if (format === 'time') {
    return new Date(value).toLocaleTimeString();
  }

  if (format === 'datetime') {
    return new Date(value).toLocaleString();
  }

  return String(value);
}

export function formatPnL(value: number | null | undefined): {
  text: string;
  color: string;
} {
  if (value === null || value === undefined || isNaN(value)) {
    return { text: '—', color: 'var(--ui2-text-muted)' };
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  if (value > 0) {
    return { text: `+${formatted}`, color: 'var(--ui2-positive)' };
  } else if (value < 0) {
    return { text: formatted, color: 'var(--ui2-negative)' };
  } else {
    return { text: formatted, color: 'var(--ui2-text-muted)' };
  }
}

export function formatPercent(value: number | null | undefined): {
  text: string;
  color: string;
} {
  if (value === null || value === undefined || isNaN(value)) {
    return { text: '—', color: 'var(--ui2-text-muted)' };
  }

  const percent = (value * 100).toFixed(2);
  const text = value > 0 ? `+${percent}%` : `${percent}%`;

  if (value > 0) {
    return { text, color: 'var(--ui2-positive)' };
  } else if (value < 0) {
    return { text, color: 'var(--ui2-negative)' };
  } else {
    return { text: '0.00%', color: 'var(--ui2-text-muted)' };
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* DataTable Component */
/* ─────────────────────────────────────────────────────────────── */

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  selectedRowKey,
  highlightRowKey,
  density = 'compact',
  testId,
  striped = false,
}: DataTableProps<T>) {
  const rowHeight = density === 'compact' ? '32px' : '40px';

  return (
    <div
      data-testid={testId}
      className="ui2-scrollable"
      style={{
        width: '100%',
        overflow: 'auto',
        borderRadius: 'var(--ui2-radius-md)',
        border: '1px solid var(--ui2-border)',
      }}
    >
      <table
        className="ui2-tabular"
        style={{ width: '100%', borderCollapse: 'collapse' }}
      >
        <thead>
          <tr
            style={{
              background: 'var(--ui2-bg-elevated)',
              borderBottom: '1px solid var(--ui2-border)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.className}
                style={{
                  padding: '8px 12px',
                  textAlign: col.align || 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--ui2-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--ui2-text-muted)',
                  fontSize: '13px',
                }}
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const rowKey = row[keyField] ?? rowIndex;
              const isSelected = selectedRowKey === rowKey;
              const isHighlighted = highlightRowKey !== null && highlightRowKey !== undefined && String(highlightRowKey) === String(rowKey);
              const isEvenRow = rowIndex % 2 === 0;

              // Determine background color
              let bgColor = 'transparent';
              if (isHighlighted) {
                bgColor = 'var(--ui2-accent, #1a6b3a22)';
              } else if (isSelected) {
                bgColor = 'var(--ui2-bg-selected)';
              } else if (striped && !isEvenRow) {
                bgColor = 'var(--ui2-bg-sunken)';
              }

              return (
                <tr
                  key={rowKey}
                  data-testid={`${testId}-row-${rowIndex}`}
                  data-row-key={String(rowKey)}
                  data-highlighted={isHighlighted ? 'true' : undefined}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  style={{
                    height: rowHeight,
                    background: bgColor,
                    borderBottom: '1px solid var(--ui2-border-subtle)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background var(--ui2-transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--ui2-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = bgColor;
                    }
                  }}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    let rendered: React.ReactNode;

                    if (col.render) {
                      rendered = col.render(value, row, rowIndex);
                    } else if (col.format) {
                      rendered = formatValue(value, col.format);
                    } else {
                      // Default: handle null/undefined/NaN
                      rendered =
                        value === null || value === undefined || (typeof value === 'number' && isNaN(value))
                          ? '—'
                          : String(value);
                    }

                    return (
                      <td
                        key={col.key}
                        className={col.className}
                        style={{
                          padding: '8px 12px',
                          textAlign: col.align || 'left',
                          fontSize: '13px',
                          color: 'var(--ui2-text-primary)',
                        }}
                      >
                        {rendered}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
