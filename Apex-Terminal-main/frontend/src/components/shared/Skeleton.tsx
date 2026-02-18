/**
 * Skeleton - Loading skeleton component (v1.17)
 * Provides consistent loading states across the app
 */

import { cn } from '../../ui/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rect', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-element-bg/50';
  
  const variantClasses = {
    text: 'h-4 rounded',
    rect: 'rounded',
    circle: 'rounded-full',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
      data-testid="skeleton"
      aria-busy="true"
      aria-live="polite"
    />
  );
}

// Skeleton variants for common use cases
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} data-testid="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '80%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" data-testid="skeleton-table">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} variant="text" width="100%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={`${rowIndex}-${colIndex}`} variant="text" width="100%" />
          ))}
        </div>
      ))}
    </div>
  );
}
