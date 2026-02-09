import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    tooltip: string;
    variant?: 'default' | 'primary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isActive?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, tooltip, variant = 'default', size = 'md', isActive, className, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                title={tooltip}
                disabled={disabled}
                className={cn(
                    'inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500/50',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    {
                        // Variants
                        'bg-element-bg text-text-secondary hover:text-text hover:bg-border': variant === 'default' && !isActive,
                        'bg-brand text-white hover:bg-brand-hover': variant === 'primary',
                        'text-text-secondary hover:text-text hover:bg-element-bg': variant === 'ghost' && !isActive,
                        'text-down hover:bg-down/10': variant === 'danger',

                        // Active state
                        'bg-brand/10 text-brand border border-brand/20': isActive,

                        // Sizes
                        'h-7 w-7': size === 'sm',
                        'h-8 w-8': size === 'md',
                        'h-10 w-10': size === 'lg',
                    },
                    className
                )}
                {...props}
            >
                {icon}
            </button>
        );
    }
);

IconButton.displayName = 'IconButton';
