/**
 * Card Component - v1.51
 * Professional-grade card/panel component with consistent styling
 */

import React from 'react';
import { cn } from './utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  interactive?: boolean;
}

const VARIANT_STYLES = {
  default: 'bg-[var(--card-bg)] border-[var(--card-border)]',
  elevated: 'bg-[var(--card-bg)] border-[var(--card-border)] shadow-[var(--shadow-md)]',
  outline: 'bg-transparent border-[var(--border-default)]',
  ghost: 'bg-transparent border-transparent',
};

const PADDING_STYLES = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hover = false,
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'rounded-[var(--card-radius)] border',
          'transition-colors duration-[var(--duration-150)]',
          
          // Variant styles
          VARIANT_STYLES[variant],
          
          // Padding
          PADDING_STYLES[padding],
          
          // Hover effect
          hover && 'hover:border-[var(--border-strong)]',
          
          // Interactive (clickable)
          interactive && 'cursor-pointer hover:bg-[var(--bg-hover)]',
          
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card subcomponents for structured layouts
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 mb-4', className)}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)] leading-tight">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-1 leading-snug">
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-[var(--border-subtle)]', className)} {...props}>
      {children}
    </div>
  );
}
