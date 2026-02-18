import { type ReactNode } from 'react';
import { cn } from './utils';

export interface SegmentedControlItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  'data-testid'?: string;
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  'data-testid'?: string;
}

/**
 * iOS-style segmented control / toggle group.
 * Use for mutually exclusive filter switches (e.g. "All | Calls | Puts").
 */
export function SegmentedControl({
  items,
  value,
  onValueChange,
  size = 'md',
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      data-testid={props['data-testid'] ?? 'segmented-control'}
      className={cn(
        'inline-flex items-center rounded bg-background border border-border overflow-hidden',
        className,
      )}
      role="radiogroup"
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            role="radio"
            aria-checked={isActive}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            data-testid={item['data-testid']}
            className={cn(
              'transition-colors font-medium whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              isActive
                ? 'bg-element-bg text-text border-r border-l border-border first:border-l-0 last:border-r-0'
                : 'text-text-muted hover:text-text-secondary border-r border-border last:border-r-0',
              item.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
