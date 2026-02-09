import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export type AppMode = 'LIVE' | 'REPLAY' | 'BACKTEST' | 'PAPER';

export interface ModeBadgeProps extends HTMLAttributes<HTMLDivElement> {
    mode: AppMode;
    size?: 'sm' | 'md';
}

const modeConfig: Record<AppMode, { label: string; className: string }> = {
    LIVE: {
        label: 'LIVE',
        className: 'bg-live-bg text-live border-live/20',
    },
    REPLAY: {
        label: 'REPLAY',
        className: 'bg-replay-bg text-replay border-replay/20',
    },
    BACKTEST: {
        label: 'BACKTEST',
        className: 'bg-backtest-bg text-backtest border-backtest/20',
    },
    PAPER: {
        label: 'PAPER',
        className: 'bg-paper-bg text-paper border-paper/20',
    },
};

export const ModeBadge = forwardRef<HTMLDivElement, ModeBadgeProps>(
    ({ mode, size = 'md', className, ...props }, ref) => {
        const config = modeConfig[mode];

        return (
            <div
                ref={ref}
                className={cn(
                    'inline-flex items-center font-semibold uppercase tracking-wider border rounded',
                    config.className,
                    {
                        'px-1.5 py-0.5 text-[9px]': size === 'sm',
                        'px-2 py-1 text-[10px]': size === 'md',
                    },
                    className
                )}
                {...props}
            >
                {config.label}
            </div>
        );
    }
);

ModeBadge.displayName = 'ModeBadge';
