/**
 * UI2 Panel Component
 * Professional panel contract: header (title+actions+status), body, consistent states
 * Bloomberg Terminal-grade panel structure
 */

import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  status?: React.ReactNode;  // Status badges or indicators
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'bordered';
  testId?: string;
  className?: string;
  headerDivider?: boolean;
}

export function Panel({
  children,
  title,
  subtitle,
  actions,
  status,
  padding = 'md',
  variant = 'default',
  testId,
  className = '',
  headerDivider = true,
}: PanelProps) {
  const paddingMap = {
    none: '0',
    sm: 'var(--ui2-space-3)',
    md: 'var(--ui2-space-4)',
    lg: 'var(--ui2-space-6)',
  };

  const variantStyles = {
    default: {
      background: 'var(--ui2-bg-panel)',
      border: '1px solid var(--ui2-border)',
    },
    elevated: {
      background: 'var(--ui2-bg-elevated)',
      border: '1px solid var(--ui2-border-subtle)',
      boxShadow: 'var(--ui2-shadow-sm)',
    },
    bordered: {
      background: 'var(--ui2-bg-sunken)',
      border: '1px solid var(--ui2-border-strong)',
    },
  };

  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        ...variantStyles[variant],
        borderRadius: 'var(--ui2-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      {(title || actions || status) && (
        <div
          data-testid={testId ? `${testId}-header` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--ui2-space-4)',
            borderBottom: headerDivider ? '1px solid var(--ui2-border-subtle)' : 'none',
            gap: 'var(--ui2-space-4)',
          }}
        >
          {/* Title section */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--ui2-text-primary)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--ui2-text-secondary)',
                  margin: '2px 0 0 0',
                  lineHeight: 1.3,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Status badges */}
          {status && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--ui2-space-2)',
              }}
            >
              {status}
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--ui2-space-2)',
              }}
            >
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Panel Body */}
      <div
        data-testid={testId ? `${testId}-body` : undefined}
        style={{
          padding: paddingMap[padding],
        }}
      >
        {children}
      </div>
    </div>
  );
}
