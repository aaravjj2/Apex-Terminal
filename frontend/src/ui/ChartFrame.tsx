import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface ChartFrameProps extends HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
    toolbar?: ReactNode;
    legend?: ReactNode;
    height?: string | number;
    loading?: boolean;
    empty?: boolean;
    emptyMessage?: string;
    'data-testid'?: string;
}

export function ChartFrame({
    title,
    subtitle,
    toolbar,
    legend,
    height = 300,
    loading,
    empty,
    emptyMessage = 'No data available',
    children,
    className,
    'data-testid': testId,
    ...props
}: ChartFrameProps) {
    return (
        <div
            className={cn(
                'flex flex-col bg-element-bg border border-border rounded-lg overflow-hidden',
                className
            )}
            data-testid={testId}
            {...props}
        >
            {(title || toolbar) && (
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                    <div>
                        {title && (
                            <h3 className="text-sm font-medium text-text">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
                </div>
            )}
            <div
                className="relative flex-1 p-4"
                style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
            >
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : empty ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
                        {emptyMessage}
                    </div>
                ) : (
                    children
                )}
            </div>
            {legend && (
                <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-text-secondary">
                    {legend}
                </div>
            )}
        </div>
    );
}
