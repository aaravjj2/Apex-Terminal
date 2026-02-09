import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-1 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
                    {
                        'bg-brand text-white hover:bg-brand-hover shadow-sm hover:shadow-glow-brand': variant === 'primary',
                        'bg-element-bg text-text hover:bg-border border border-border hover:border-border-active': variant === 'secondary',
                        'hover:bg-element-bg text-text-secondary hover:text-text': variant === 'ghost',
                        'bg-down/10 text-down hover:bg-down/20 border border-down/20': variant === 'danger',
                        'bg-up/10 text-up hover:bg-up/20 border border-up/20': variant === 'success',
                        'border border-border text-text-secondary hover:text-text hover:border-border-active hover:bg-element-bg/50': variant === 'outline',

                        'h-7 px-3 text-xs gap-1.5': size === 'sm',
                        'h-9 px-4 text-sm gap-2': size === 'md',
                        'h-11 px-6 text-base gap-2.5': size === 'lg',
                        'h-8 w-8 p-0': size === 'icon',
                    },
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
