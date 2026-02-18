/**
 * SeverityBanner - Info/Warning/Error banner component (v1.17)
 * Displays contextual messages with appropriate styling
 */

import { Info, AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { cn } from '../../ui/utils';

type Severity = 'info' | 'warning' | 'error' | 'success';

interface SeverityBannerProps {
  severity: Severity;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
  testId?: string;
}

const severityConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-900 dark:text-amber-100',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-900 dark:text-red-100',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-900 dark:text-green-100',
    iconColor: 'text-green-600 dark:text-green-400',
  },
};

export function SeverityBanner({
  severity,
  title,
  message,
  onDismiss,
  className,
  testId = 'severity-banner',
}: SeverityBannerProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 border rounded',
        config.bgColor,
        config.borderColor,
        className
      )}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div className={cn('flex-shrink-0', config.iconColor)} data-testid={`${testId}-icon`}>
        <Icon size={20} />
      </div>
      
      <div className="flex-1 min-w-0">
        {title && (
          <h4 
            className={cn('font-medium mb-1', config.textColor)}
            data-testid={`${testId}-title`}
          >
            {title}
          </h4>
        )}
        <p 
          className={cn('text-sm', config.textColor)}
          data-testid={`${testId}-message`}
        >
          {message}
        </p>
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('flex-shrink-0 hover:opacity-70 transition-opacity', config.iconColor)}
          data-testid={`${testId}-dismiss`}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
