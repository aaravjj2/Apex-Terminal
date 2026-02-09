import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="text-xs font-medium text-text-secondary block">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "flex h-8 w-full rounded border border-border bg-background px-3 py-1 text-sm text-text transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-down focus-visible:ring-down",
                        className
                    )}
                    {...props}
                />
                {error && (
                    <span className="text-[10px] text-down block">{error}</span>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';
