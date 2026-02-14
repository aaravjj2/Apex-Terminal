import { type ReactNode } from 'react';
import { cn } from './utils';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export interface BannerProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
  'data-testid'?: string;
}

const variantConfig = {
  info: { icon: Info, bg: 'bg-brand/10 border-brand/30', text: 'text-brand' },
  success: { icon: CheckCircle, bg: 'bg-up/10 border-up/30', text: 'text-up' },
  warning: { icon: AlertTriangle, bg: 'bg-warn/10 border-warn/30', text: 'text-warn' },
  error: { icon: XCircle, bg: 'bg-down/10 border-down/30', text: 'text-down' },
} as const;

export function Banner({ variant = 'info', children, onDismiss, className, ...props }: BannerProps) {
  const cfg = variantConfig[variant];
  const Icon = cfg.icon;

  return (
    <div
      data-testid={props['data-testid'] ?? 'banner'}
      className={cn(
        'flex items-center gap-2.5 px-4 py-2.5 text-sm border rounded',
        cfg.bg,
        className,
      )}
      role="status"
    >
      <Icon size={16} className={cn(cfg.text, 'shrink-0')} />
      <div className="flex-1 min-w-0 text-text">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-text-muted hover:text-text transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
