import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'error' | 'info' | 'replay' | 'paper' | 'backtest' | 'brand';
    size?: 'sm' | 'md' | 'lg';
    dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', size = 'md', dot, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center rounded-md font-medium uppercase tracking-wider",
                    {
                        // Sizes
                        'px-1 py-0.5 text-[9px] gap-1': size === 'sm',
                        'px-1.5 py-0.5 text-[10px] gap-1.5': size === 'md',
                        'px-2 py-1 text-[11px] gap-1.5': size === 'lg',

                        // Variants
                        'bg-element-bg text-text-secondary': variant === 'default',
                        'border border-border text-text-secondary': variant === 'outline',
                        'bg-up/10 text-up': variant === 'success',
                        'bg-warn/10 text-warn': variant === 'warning',
                        'bg-down/10 text-down': variant === 'error',
                        'bg-brand/10 text-brand': variant === 'info',
                        'bg-brand/15 text-brand': variant === 'brand',

                        // Mode variants
                        'bg-replay-bg text-replay': variant === 'replay',
                        'bg-paper-bg text-paper': variant === 'paper',
                        'bg-backtest-bg text-backtest': variant === 'backtest',
                    },
                    className
                )}
                {...props}
            >
                {dot && (
                    <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        variant === 'success' && 'bg-up',
                        variant === 'warning' && 'bg-warn',
                        variant === 'error' && 'bg-down',
                        variant === 'info' && 'bg-brand',
                        variant === 'brand' && 'bg-brand',
                        variant === 'default' && 'bg-text-muted',
                        variant === 'outline' && 'bg-text-muted',
                        variant === 'replay' && 'bg-replay',
                        variant === 'paper' && 'bg-paper',
                        variant === 'backtest' && 'bg-backtest',
                    )} />
                )}
                {props.children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';
