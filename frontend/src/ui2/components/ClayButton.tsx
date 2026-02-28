/**
 * UI2 ClayButton Component
 * Claymorphism button for playful UI
 */
import React from 'react';

export interface ClayButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  testId?: string;
}

export function ClayButton({ children, onClick, style = {}, testId }: ClayButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, #e2e2e2, #ffffff)',
        boxShadow: '8px 8px 24px #d1d1d1, -8px -8px 24px #ffffff',
        borderRadius: '12px',
        border: 'none',
        padding: '16px 32px',
        fontWeight: 600,
        fontSize: '16px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
