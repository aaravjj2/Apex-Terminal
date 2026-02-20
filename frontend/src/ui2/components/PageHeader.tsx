/**
 * UI2 PageHeader Component
 * Consistent header across all workspace pages
 */

import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  testId = 'ui2-page-header',
}: PageHeaderProps) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        borderColor: 'var(--ui2-border)',
        background: 'var(--ui2-bg-elevated)',
      }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md"
            style={{ background: 'var(--ui2-brand-subtle)' }}
          >
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-base font-semibold"
              style={{ color: 'var(--ui2-text-primary)' }}
            >
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p
              className="text-xs mt-0.5"
              style={{ color: 'var(--ui2-text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
