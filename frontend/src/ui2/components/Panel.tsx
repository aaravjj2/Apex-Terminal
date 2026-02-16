/**
 * UI2 Panel Component
 * Card-style container for content sections
 */

import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  testId?: string;
  className?: string;
}

export function Panel({
  children,
  title,
  subtitle,
  actions,
  padding = 'md',
  testId,
  className = '',
}: PanelProps) {
  const paddingClass = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }[padding];

  return (
    <div
      data-testid={testId}
      className={`rounded-lg border ${className}`}
      style={{
        background: 'var(--ui2-bg-panel)',
        borderColor: 'var(--ui2-border)',
      }}
    >
      {(title || actions) && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--ui2-border-subtle)' }}
        >
          <div>
            {title && (
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--ui2-text-primary)' }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--ui2-text-secondary)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </div>
  );
}
