import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';

interface ErrorStateProps {
    title?: string;
    message: string;
    icon?: ReactNode;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    message,
    icon,
    onRetry,
    retryLabel = 'Try Again',
    className
}: ErrorStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center py-12 px-4',
            className
        )}>
            <div className="text-down mb-4">
                {icon || <AlertTriangle size={40} />}
            </div>
            <h3 className="text-sm font-medium text-text mb-1">{title}</h3>
            <p className="text-xs text-text-secondary max-w-xs mb-4">{message}</p>
            {onRetry && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                    className="gap-2"
                >
                    <RefreshCw size={14} />
                    {retryLabel}
                </Button>
            )}
        </div>
    );
}

// Inline error for form fields etc
interface InlineErrorProps {
    message: string;
    className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
    return (
        <p className={cn('text-xs text-down flex items-center gap-1', className)}>
            <AlertTriangle size={12} />
            {message}
        </p>
    );
}
