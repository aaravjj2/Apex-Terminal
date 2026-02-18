import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface KPIStripProps extends HTMLAttributes<HTMLDivElement> {
    'data-testid'?: string;
}

export function KPIStrip({ children, className, 'data-testid': testId, ...props }: KPIStripProps) {
    return (
        <div
            className={cn(
                'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4',
                className
            )}
            data-testid={testId}
            {...props}
        >
            {children}
        </div>
    );
}

export interface KPIItemProps {
    label: string;
    value: string | number;
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon?: ReactNode;
    className?: string;
    'data-testid'?: string;
}

export function KPIItem({
    label,
    value,
    subValue,
    trend,
    icon,
    className,
    'data-testid': testId,
}: KPIItemProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-1 px-3 py-2.5 rounded-lg bg-element-bg/50 border border-border/50',
                className
            )}
            data-testid={testId}
        >
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</span>
            <div className="flex items-center gap-2">
                {icon && <span className="text-text-secondary">{icon}</span>}
                <span className={cn(
                    'text-base font-semibold tabular-nums',
                    trend === 'up' && 'text-up',
                    trend === 'down' && 'text-down',
                    !trend && 'text-text'
                )}>
                    {value}
                </span>
            </div>
            {subValue && (
                <span className="text-[10px] text-text-muted tabular-nums">{subValue}</span>
            )}
        </div>
    );
}
