import { type ReactNode } from 'react';
import { cn } from './utils';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    badge?: ReactNode;
    actions?: ReactNode;
    className?: string;
    'data-testid'?: string;
}

export function PageHeader({
    title,
    subtitle,
    icon,
    badge,
    actions,
    className,
    'data-testid': testId,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-between px-6 py-4 border-b border-border bg-panel-bg shrink-0',
                className
            )}
            data-testid={testId}
        >
            <div className="flex items-center gap-3">
                {icon && (
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted text-brand">
                        {icon}
                    </div>
                )}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold text-text tracking-tight">{title}</h1>
                        {badge}
                    </div>
                    {subtitle && (
                        <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
