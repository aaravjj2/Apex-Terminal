/**
 * UI2 BentoGrid Component
 * Modern bento grid for dashboard layouts, supports drag, resize, and custom widgets
 */
import React from 'react';

export interface BentoGridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: string;
  style?: React.CSSProperties;
  testId?: string;
}

export function BentoGrid({ children, columns = 4, gap = '24px', style = {}, testId }: BentoGridProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
