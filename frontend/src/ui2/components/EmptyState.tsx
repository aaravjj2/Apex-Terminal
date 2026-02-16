/**
 * UI2 EmptyState Component
 * Graceful empty state display with icon/message
 */

import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  testId?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            marginBottom: '16px',
            opacity: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--ui2-bg-elevated)',
            color: 'var(--ui2-text-muted)',
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--ui2-text-primary)',
          margin: '0 0 8px 0',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--ui2-text-secondary)',
            margin: '0 0 20px 0',
            maxWidth: '400px',
          }}
        >
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
