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
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
    'data-testid'?: string;
}

export function EmptyState({ icon, title, description, action, secondaryAction, className, 'data-testid': testId }: EmptyStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center py-16 px-6',
            className
        )} data-testid={testId}>
            {icon && (
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-element-bg border border-border mb-5 text-text-muted">
                    {icon}
                </div>
            )}
            <h3 className="text-base font-semibold text-text mb-1.5">{title}</h3>
            {description && (
                <p className="text-sm text-text-secondary max-w-sm leading-relaxed">{description}</p>
            )}
            {(action || secondaryAction) && (
                <div className="flex items-center gap-3 mt-5">
                    {action && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={secondaryAction.onClick}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
