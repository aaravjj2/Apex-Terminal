/**
 * UI2 Button Component
 * Professional button with variants and states
 */

import React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  testId?: string;
  className?: string;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  testId,
  className = '',
  fullWidth = false,
}: ButtonProps) {
  const sizeStyles = {
    sm: {
      padding: '4px 10px',
      fontSize: '12px',
      gap: '4px',
    },
    md: {
      padding: '6px 12px',
      fontSize: '13px',
      gap: '6px',
    },
    lg: {
      padding: '10px 16px',
      fontSize: '14px',
      gap: '8px',
    },
  };

  const variantStyles = {
    primary: {
      background: 'var(--ui2-brand-primary)',
      color: 'var(--ui2-text-inverse)',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'var(--ui2-bg-elevated)',
      color: 'var(--ui2-text-primary)',
      border: '1px solid var(--ui2-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ui2-text-secondary)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'var(--ui2-danger)',
      color: 'var(--ui2-text-inverse)',
      border: '1px solid transparent',
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testId}
      data-variant={variant}
      data-size={size}
      className={`ui2-btn ui2-btn-${variant} ${className}`}
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--ui2-radius-md)',
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        transition: 'all var(--ui2-transition-fast)',
        position: 'relative',
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span>{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span>{icon}</span>}
        </>
      )}
    </button>
  );
}

// Add spin animation to global styles (in ui2-tokens.css)
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('ui2-btn-animations')) {
  style.id = 'ui2-btn-animations';
  document.head.appendChild(style);
}
