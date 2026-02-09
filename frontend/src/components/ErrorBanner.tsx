/**
 * Error Banner Component - Standardized error UI
 * Supports severity levels: info, warn, error
 * Collapsible details section
 */

import { useState } from 'react';
import { X, ChevronDown, ChevronUp, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ErrorSeverity = 'info' | 'warn' | 'error';

interface ErrorBannerProps {
  severity: ErrorSeverity;
  message: string;
  details?: string;
  onDismiss?: () => void;
  testId?: string;
}

export function ErrorBanner({ severity, message, details, onDismiss, testId }: ErrorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  };

  const severityIcons = {
    info: <Info size={18} className="flex-shrink-0" />,
    warn: <AlertTriangle size={18} className="flex-shrink-0" />,
    error: <AlertCircle size={18} className="flex-shrink-0" />,
  };

  const severityLabels = {
    info: 'INFO',
    warn: 'WARNING',
    error: 'ERROR',
  };

  return (
    <div
      className={`border rounded-lg p-4 ${severityStyles[severity]} transition-opacity animate-fade-in`}
      data-testid={testId || `error-banner-${severity}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {severityIcons[severity]}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
              {severityLabels[severity]}
            </span>
          </div>
          
          <p className="text-sm font-medium">{message}</p>

          {details && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
              data-testid={`${testId || 'error-banner'}-toggle-details`}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isExpanded ? 'Hide' : 'Show'} technical details
            </button>
          )}

          {details && isExpanded && (
            <div 
              className="mt-3 p-3 bg-white/50 rounded border border-current/20"
              data-testid={`${testId || 'error-banner'}-details`}
            >
              <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-48">
{details}
              </pre>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            data-testid={`${testId || 'error-banner'}-dismiss`}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
