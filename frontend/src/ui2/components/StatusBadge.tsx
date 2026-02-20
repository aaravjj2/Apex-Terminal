/**
 * UI2 StatusBadge Component
 * Professional status badges for orders, positions, insights, etc.
 */

import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'queued'
  | 'working'
  | 'filled'
  | 'rejected'
  | 'canceled';

export interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  testId?: string;
}

export function StatusBadge({ variant, children, icon, testId }: StatusBadgeProps) {
  const className = `ui2-badge ui2-badge-${variant}`;

  return (
    <span className={className} data-testid={testId}>
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}
