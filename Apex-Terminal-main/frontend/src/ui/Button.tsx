import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
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
                    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
                    {
                        'bg-brand text-white hover:bg-brand-hover active:bg-brand/80 shadow-sm hover:shadow': variant === 'primary',
                        'bg-element-bg text-text border border-border hover:bg-border hover:border-border-active shadow-xs': variant === 'secondary',
                        'hover:bg-element-bg text-text-secondary hover:text-text': variant === 'ghost',
                        'bg-down/10 text-down hover:bg-down/20 active:bg-down/30 border border-down/30 hover:border-down/40 shadow-xs': variant === 'danger',
                        'bg-up/10 text-up hover:bg-up/20 active:bg-up/30 border border-up/30 hover:border-up/40 shadow-xs': variant === 'success',

                        'h-8 px-3 text-xs gap-1.5 rounded-md': size === 'sm',
                        'h-10 px-4 text-sm gap-2': size === 'md',
                        'h-12 px-6 text-base gap-2': size === 'lg',
                        'h-10 w-10 p-0': size === 'icon',
                    },
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
