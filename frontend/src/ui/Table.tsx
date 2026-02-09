import type { ReactNode } from 'react';
import { cn } from './utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Types
export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
    render?: (row: T, index: number) => ReactNode;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (row: T, index: number) => string;
    sortColumn?: string;
    sortDirection?: SortDirection;
    onSort?: (column: string) => void;
    onRowClick?: (row: T, index: number) => void;
    selectedKey?: string;
    isLoading?: boolean;
    emptyMessage?: string;
    className?: string;
    compact?: boolean;
}

export function Table<T>({
    columns,
    data,
    keyExtractor,
    sortColumn,
    sortDirection,
    onSort,
    onRowClick,
    selectedKey,
    isLoading,
    emptyMessage = 'No data available',
    className,
    compact = false,
}: TableProps<T>) {
    const renderSortIcon = (col: Column<T>) => {
        if (!col.sortable) return null;

        if (sortColumn === col.key) {
            return sortDirection === 'asc'
                ? <ArrowUp size={12} />
                : <ArrowDown size={12} />;
        }
        return <ArrowUpDown size={12} className="opacity-30" />;
    };

    return (
        <div className={cn('overflow-auto', className)}>
            <table className="w-full text-sm">
                {/* Header */}
                <thead className="sticky top-0 bg-panel-bg z-10">
                    <tr className="border-b border-border">
                        {columns.map(col => (
                            <th
                                key={col.key}
                                onClick={() => col.sortable && onSort?.(col.key)}
                                style={{ width: col.width }}
                                className={cn(
                                    'text-left font-medium text-text-secondary',
                                    compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2',
                                    col.sortable && 'cursor-pointer hover:text-text',
                                    col.align === 'center' && 'text-center',
                                    col.align === 'right' && 'text-right'
                                )}
                            >
                                <span className="inline-flex items-center gap-1">
                                    {col.header}
                                    {renderSortIcon(col)}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Body */}
                <tbody>
                    {isLoading ? (
                        // Skeleton rows
                        Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-border/50">
                                {columns.map(col => (
                                    <td key={col.key} className={compact ? 'px-2 py-1.5' : 'px-3 py-2'}>
                                        <div className="skeleton h-4 rounded" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="text-center text-text-secondary py-8"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => {
                            const rowKey = keyExtractor(row, i);
                            const isSelected = selectedKey === rowKey;

                            return (
                                <tr
                                    key={rowKey}
                                    onClick={() => onRowClick?.(row, i)}
                                    className={cn(
                                        'border-b border-border/50 transition-colors',
                                        onRowClick && 'cursor-pointer hover:bg-element-bg',
                                        isSelected && 'bg-brand/10'
                                    )}
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            className={cn(
                                                'text-text',
                                                compact ? 'px-2 py-1.5' : 'px-3 py-2',
                                                col.align === 'center' && 'text-center',
                                                col.align === 'right' && 'text-right'
                                            )}
                                        >
                                            {col.render
                                                ? col.render(row, i)
                                                : (row as Record<string, unknown>)[col.key] as ReactNode
                                            }
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
