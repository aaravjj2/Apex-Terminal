import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'info' | 'warning' | 'error' | 'success' | 'brand';
    icon?: ReactNode;
    action?: ReactNode;
    dismissible?: boolean;
    onDismiss?: () => void;
    'data-testid'?: string;
}

export function Banner({
    variant = 'info',
    icon,
    action,
    dismissible,
    onDismiss,
    children,
    className,
    'data-testid': testId,
    ...props
}: BannerProps) {
    const variantStyles = {
        info: 'bg-brand/8 border-brand/20 text-brand',
        warning: 'bg-warn/8 border-warn/20 text-warn',
        error: 'bg-down/8 border-down/20 text-down',
        success: 'bg-up/8 border-up/20 text-up',
        brand: 'bg-brand/8 border-brand/20 text-brand',
    };

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-2.5 border rounded-lg text-sm',
                variantStyles[variant],
                className
            )}
            data-testid={testId}
            role="status"
            {...props}
        >
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="flex-1">{children}</span>
            {action && <span className="shrink-0">{action}</span>}
            {dismissible && (
                <button
                    onClick={onDismiss}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Dismiss"
                >
                    ×
                </button>
            )}
        </div>
    );
}
