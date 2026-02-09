import type { ReactNode } from 'react';
import { cn } from './utils';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center py-12 px-4',
            className
        )}>
            {icon && (
                <div className="text-text-muted mb-4 opacity-50">
                    {icon}
                </div>
            )}
            <h3 className="text-sm font-medium text-text mb-1">{title}</h3>
            {description && (
                <p className="text-xs text-text-secondary max-w-xs">{description}</p>
            )}
            {action && (
                <Button
                    variant="primary"
                    size="sm"
                    onClick={action.onClick}
                    className="mt-4"
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}
