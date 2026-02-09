import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex flex-col bg-panel-bg border border-border rounded overflow-hidden", className)}
            {...props}
        />
    )
);
Panel.displayName = 'Panel';

export const PanelHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center justify-between px-3 h-10 border-b border-border bg-panel-bg shrink-0", className)}
            {...props}
        />
    )
);
PanelHeader.displayName = 'PanelHeader';

export const PanelContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex-1 overflow-auto p-3", className)}
            {...props}
        />
    )
);
PanelContent.displayName = 'PanelContent';
