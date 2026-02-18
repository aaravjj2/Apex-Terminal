import { cn } from './utils';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'degraded';

interface StatusIndicatorProps {
    status: ConnectionStatus;
    label?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

const statusConfig: Record<ConnectionStatus, { color: string; pulse: boolean; text: string }> = {
    connected: { color: 'bg-up', pulse: false, text: 'Connected' },
    connecting: { color: 'bg-warn', pulse: true, text: 'Connecting...' },
    disconnected: { color: 'bg-text-secondary', pulse: false, text: 'Disconnected' },
    error: { color: 'bg-down', pulse: false, text: 'Error' },
    degraded: { color: 'bg-warn', pulse: false, text: 'Degraded' },
};

export function StatusIndicator({
    status,
    label,
    showLabel = true,
    size = 'md',
    className
}: StatusIndicatorProps) {
    const config = statusConfig[status];

    return (
        <div className={cn('inline-flex items-center gap-1.5', className)}>
            <span
                className={cn(
                    'rounded-full shrink-0',
                    config.color,
                    config.pulse && 'animate-pulse',
                    {
                        'w-1.5 h-1.5': size === 'sm',
                        'w-2 h-2': size === 'md',
                    }
                )}
            />
            {showLabel && (
                <span className={cn(
                    'text-text-secondary',
                    {
                        'text-xxs': size === 'sm',
                        'text-xs': size === 'md',
                    }
                )}>
                    {label || config.text}
                </span>
            )}
        </div>
    );
}
