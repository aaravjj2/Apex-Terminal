import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from './utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon?: ReactNode;
    variant?: 'default' | 'brand' | 'success' | 'danger' | 'warning';
    size?: 'sm' | 'md';
    'data-testid'?: string;
}

export function StatCard({
    label,
    value,
    change,
    changeLabel,
    icon,
    variant = 'default',
    size = 'md',
    className,
    'data-testid': testId,
    ...props
}: StatCardProps) {
    const isPositive = change !== undefined && change > 0;
    const isNegative = change !== undefined && change < 0;
    const isNeutral = change !== undefined && change === 0;

    const accentColors = {
        default: 'border-l-border-active',
        brand: 'border-l-brand',
        success: 'border-l-up',
        danger: 'border-l-down',
        warning: 'border-l-warn',
    };

    return (
        <div
            className={cn(
                'flex flex-col justify-between rounded-lg bg-element-bg border border-border border-l-2 transition-colors hover:border-border-active',
                accentColors[variant],
                size === 'sm' ? 'p-3 gap-1.5' : 'p-4 gap-2',
                className
            )}
            data-testid={testId}
            {...props}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary font-medium uppercase tracking-wider">{label}</span>
                {icon && <span className="text-text-muted">{icon}</span>}
            </div>
            <div className="flex items-end gap-2">
                <span className={cn(
                    'font-semibold tabular-nums tracking-tight',
                    size === 'sm' ? 'text-lg' : 'text-2xl'
                )}>
                    {value}
                </span>
                {change !== undefined && (
                    <span className={cn(
                        'flex items-center gap-0.5 text-xs font-medium pb-0.5',
                        isPositive && 'text-up',
                        isNegative && 'text-down',
                        isNeutral && 'text-text-muted'
                    )}>
                        {isPositive && <TrendingUp size={12} />}
                        {isNegative && <TrendingDown size={12} />}
                        {isNeutral && <Minus size={12} />}
                        {isPositive && '+'}{change}%
                        {changeLabel && <span className="text-text-muted ml-1">{changeLabel}</span>}
                    </span>
                )}
            </div>
        </div>
    );
}
