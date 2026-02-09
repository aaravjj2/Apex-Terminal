import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'error' | 'info' | 'replay' | 'paper' | 'backtest';
    size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', size = 'md', ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center rounded font-medium uppercase tracking-wider",
                    {
                        // Sizes
                        'px-1 py-0.5 text-[9px]': size === 'sm',
                        'px-1.5 py-0.5 text-[10px]': size === 'md',

                        // Variants
                        'bg-element-bg text-text-secondary': variant === 'default',
                        'border border-border text-text-secondary': variant === 'outline',
                        'bg-up/10 text-up': variant === 'success',
                        'bg-warn/10 text-warn': variant === 'warning',
                        'bg-down/10 text-down': variant === 'error',
                        'bg-brand/10 text-brand': variant === 'info',

                        // Mode variants
                        'bg-replay-bg text-replay': variant === 'replay',
                        'bg-paper-bg text-paper': variant === 'paper',
                        'bg-backtest-bg text-backtest': variant === 'backtest',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);

Badge.displayName = 'Badge';
