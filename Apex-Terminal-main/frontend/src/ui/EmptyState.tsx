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
    illustrated?: boolean;
    className?: string;
    'data-testid'?: string;
}

export function EmptyState({ 
    icon, 
    title, 
    description, 
    action, 
    secondaryAction,
    illustrated = false,
    className, 
    'data-testid': testId 
}: EmptyStateProps) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center py-12 px-6',
            className
        )} data-testid={testId}>
            {icon && (
                <div className={cn(
                    "flex items-center justify-center rounded-2xl mb-4",
                    illustrated ? "w-24 h-24 bg-gradient-to-br from-brand/20 to-brand/5 border-2 border-brand/20" : "w-16 h-16 bg-element-bg border border-border",
                    "text-text-muted"
                )}>
                    {icon}
                </div>
            )}
            <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-text-secondary max-w-sm leading-relaxed">{description}</p>
            )}
            {(action || secondaryAction) && (
                <div className="flex items-center gap-3 mt-6">
                    {action && (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={action.onClick}
                            data-testid={testId ? `${testId}-primary-action` : undefined}
                        >
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="ghost"
                            size="md"
                            onClick={secondaryAction.onClick}
                            data-testid={testId ? `${testId}-secondary-action` : undefined}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
