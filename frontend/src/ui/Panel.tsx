import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'raised' | 'ghost';
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
    ({ className, variant = 'default', ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "flex flex-col rounded-md overflow-hidden",
                {
                    'bg-panel-bg border border-border': variant === 'default',
                    'bg-surface-raised border border-border shadow-card': variant === 'raised',
                    'bg-transparent': variant === 'ghost',
                },
                className
            )}
            {...props}
        />
    )
);
Panel.displayName = 'Panel';

export const PanelHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center justify-between px-4 h-11 border-b border-border bg-panel-bg shrink-0", className)}
            {...props}
        />
    )
);
PanelHeader.displayName = 'PanelHeader';

export const PanelContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex-1 overflow-auto p-4", className)}
            {...props}
        />
    )
);
PanelContent.displayName = 'PanelContent';

export const PanelFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-panel-bg shrink-0", className)}
            {...props}
        />
    )
);
PanelFooter.displayName = 'PanelFooter';
