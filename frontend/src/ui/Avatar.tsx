import { type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
    name?: string;
    src?: string;
    size?: 'sm' | 'md' | 'lg';
    status?: 'online' | 'offline' | 'busy' | 'away';
    'data-testid'?: string;
}

export function Avatar({
    name,
    src,
    size = 'md',
    status,
    className,
    'data-testid': testId,
    ...props
}: AvatarProps) {
    const initials = name
        ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const sizeStyles = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
    };

    const statusColors = {
        online: 'bg-up',
        offline: 'bg-text-muted',
        busy: 'bg-down',
        away: 'bg-warn',
    };

    return (
        <div className={cn('relative inline-flex', className)} data-testid={testId} {...props}>
            <div className={cn(
                'rounded-full flex items-center justify-center font-medium bg-brand-muted text-brand',
                sizeStyles[size]
            )}>
                {src ? (
                    <img src={src} alt={name || ''} className="rounded-full w-full h-full object-cover" />
                ) : (
                    initials
                )}
            </div>
            {status && (
                <span className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-panel-bg',
                    statusColors[status]
                )} />
            )}
        </div>
    );
}
