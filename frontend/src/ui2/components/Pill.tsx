/**
 * UI2 Pill Component
 * Badge/status indicator for compact metadata display
 */

import React from 'react';

export interface PillProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'muted';
  size?: 'xs' | 'sm' | 'md';
  testId?: string;
  className?: string;
}

export function Pill({
  children,
  variant = 'default',
  size = 'sm',
  testId,
  className = '',
}: PillProps) {
  const variantStyles = {
    default: {
      background: 'var(--ui2-bg-elevated)',
      color: 'var(--ui2-text-primary)',
      border: '1px solid var(--ui2-border)',
    },
    success: {
      background: 'rgba(16, 185, 129, 0.15)',
      color: 'var(--ui2-success)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.15)',
      color: 'var(--ui2-danger)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.15)',
      color: 'var(--ui2-warning)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    },
    info: {
      background: 'rgba(59, 130, 246, 0.15)',
      color: 'var(--ui2-info)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    },
    muted: {
      background: 'transparent',
      color: 'var(--ui2-text-muted)',
      border: '1px solid var(--ui2-border-subtle)',
    },
  };

  const sizeStyles = {
    xs: {
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: 'var(--ui2-radius-sm)',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
    sm: {
      fontSize: '11px',
      padding: '3px 8px',
      borderRadius: 'var(--ui2-radius-sm)',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
    md: {
      fontSize: '12px',
      padding: '4px 10px',
      borderRadius: 'var(--ui2-radius-md)',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
  };

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
