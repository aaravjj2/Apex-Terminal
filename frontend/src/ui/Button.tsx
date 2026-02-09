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
                    'inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50 disabled:pointer-events-none',
                    {
                        'bg-brand text-white hover:bg-brand/90': variant === 'primary',
                        'bg-element-bg text-text hover:bg-border': variant === 'secondary',
                        'hover:bg-border text-text-secondary hover:text-text': variant === 'ghost',
                        'bg-down/10 text-down hover:bg-down/20': variant === 'danger',
                        'bg-up/10 text-up hover:bg-up/20': variant === 'success',

                        'h-7 px-3 text-xs': size === 'sm',
                        'h-9 px-4 text-sm': size === 'md',
                        'h-11 px-6 text-base': size === 'lg',
                        'h-8 w-8 p-0': size === 'icon',
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
