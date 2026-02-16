/**
 * UI2 DataTable Component
 * Dense tabular data display for positions, orders, trades, backtests
 */

import React from 'react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, rowIndex: number) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: string;
  onRowClick?: (row: T, index: number) => void;
  selectedRowKey?: string | number;
  density?: 'compact' | 'normal';
  testId?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  selectedRowKey,
  density = 'compact',
  testId,
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

              return (
                <tr
                  key={rowKey}
                  data-testid={`${testId}-row-${rowIndex}`}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  style={{
                    height: rowHeight,
                    background: isSelected
                      ? 'var(--ui2-bg-selected)'
                      : 'transparent',
                    borderBottom: '1px solid var(--ui2-border-subtle)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--ui2-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const rendered = col.render
                      ? col.render(value, row, rowIndex)
                      : value;

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
