import { cn } from './utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export function Skeleton({
    className,
    variant = 'rectangular',
    width,
    height
}: SkeletonProps) {
    return (
        <div
            className={cn(
                'skeleton',
                {
                    'rounded': variant === 'rectangular',
                    'rounded-full': variant === 'circular',
                    'rounded h-4': variant === 'text',
                },
                className
            )}
            style={{ width, height }}
        />
    );
}

// Pre-built skeleton layouts
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    className={i === lines - 1 ? 'w-3/4' : 'w-full'}
                />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b border-border">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonChart({ className }: { className?: string }) {
    return (
        <div className={cn('relative', className)}>
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-end justify-around p-4 gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="skeleton w-2 rounded-t"
                        style={{ height: `${30 + Math.random() * 50}%` }}
                    />
                ))}
            </div>
        </div>
    );
}
