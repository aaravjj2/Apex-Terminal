/**
 * DataTable Component - v1.51
 * Professional-grade data table with sticky headers, sorting, and numeric column alignment
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from './utils';

export interface Column<T = any> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
  sortable?: boolean;
  width?: string | number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string | number;
  onSort?: (key: string, direction: 'asc' | 'desc' | null) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  emptyMessage?: string;
  loading?: boolean;
  compact?: boolean;
  hover?: boolean;
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<T = any>({
  columns,
  data,
  keyExtractor = (_, index) => index,
  onSort,
  sortKey,
  sortDirection,
  emptyMessage = 'No data available',
  loading = false,
  compact = false,
  hover = true,
  stickyHeader = true,
  className,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    
    let newDirection: 'asc' | 'desc' | null = 'asc';
    if (sortKey === column.key) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
    }
    
    onSort(column.key, newDirection);
  };

  return (
    <div className={cn('overflow-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn(
                  'text-left font-semibold text-[var(--text-secondary)]',
                  'text-[var(--text-xs)] uppercase tracking-wide',
                  'bg-[var(--table-header-bg)] border-b border-[var(--table-border)]',
                  compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.numeric && 'text-right font-mono',
                  stickyHeader && 'sticky top-0 z-10',
                  column.sortable && 'cursor-pointer select-none hover:text-[var(--text-primary)]'
                )}
                onClick={() => column.sortable && handleSort(column)}
              >
                <div className="flex items-center gap-2 justify-between">
                  <span>{column.header}</span>
                  {column.sortable && (
                    <span className="flex-shrink-0">
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : sortDirection === 'desc' ? (
                          <ArrowDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} className="opacity-30" />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-30" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-8 text-[var(--text-tertiary)]"
              >
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-8 text-[var(--text-tertiary)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                className={cn(
                  'border-b border-[var(--table-border)]',
                  hover && 'hover:bg-[var(--table-row-hover)]',
                  'transition-colors duration-75'
                )}
              >
                {columns.map((column) => {
                  const value = (row as any)[column.key];
                  const content = column.render ? column.render(value, row, index) : value;
                  
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        'text-[var(--text-sm)] text-[var(--text-primary)]',
                        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.numeric && 'text-right font-mono tabular-nums'
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
