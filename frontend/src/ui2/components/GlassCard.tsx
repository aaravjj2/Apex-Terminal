/**
 * UI2 GlassCard Component
 * Glassmorphism card for modern UI panels
 */
import React from 'react';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  testId?: string;
}

export function GlassCard({ children, style = {}, testId }: GlassCardProps) {
  return (
    <div
      data-testid={testId}
      style={{
        background: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        padding: '32px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
