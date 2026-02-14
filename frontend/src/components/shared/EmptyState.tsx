/**
 * EmptyState - Actionable empty state component (v1.17)
 * Shows when no data is available with optional action
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '../../ui/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    testId?: string;
  };
  className?: string;
  testId?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  className,
  testId = 'empty-state'
}: EmptyStateProps) {
  return (
    <div 
      className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
      data-testid={testId}
    >
      {Icon && (
        <div className="mb-4 text-text-secondary" data-testid={`${testId}-icon`}>
          <Icon size={48} />
        </div>
      )}
      
      <h3 
        className="text-lg font-medium text-text mb-2"
        data-testid={`${testId}-title`}
      >
        {title}
      </h3>
      
      {description && (
        <p 
          className="text-sm text-text-secondary max-w-md mb-4"
          data-testid={`${testId}-description`}
        >
          {description}
        </p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-brand text-white rounded hover:bg-brand/90 transition-colors"
          data-testid={action.testId || `${testId}-action`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
