import { cn } from './utils';

export interface ProgressBarProps {
    value: number;
    max?: number;
    variant?: 'brand' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    label?: string;
    className?: string;
    'data-testid'?: string;
}

export function ProgressBar({
    value,
    max = 100,
    variant = 'brand',
    size = 'md',
    showLabel,
    label,
    className,
    'data-testid': testId,
}: ProgressBarProps) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));

    const barColors = {
        brand: 'bg-brand',
        success: 'bg-up',
        warning: 'bg-warn',
        danger: 'bg-down',
    };

    const trackSizes = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    return (
        <div className={cn('flex flex-col gap-1', className)} data-testid={testId}>
            {(showLabel || label) && (
                <div className="flex items-center justify-between text-xs">
                    {label && <span className="text-text-secondary">{label}</span>}
                    {showLabel && <span className="text-text-muted tabular-nums">{Math.round(pct)}%</span>}
                </div>
            )}
            <div className={cn('w-full rounded-full bg-element-bg overflow-hidden', trackSizes[size])}>
                <div
                    className={cn('h-full rounded-full transition-all duration-300', barColors[variant])}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
