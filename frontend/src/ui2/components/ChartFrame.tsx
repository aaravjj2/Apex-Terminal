/**
 * UI2 ChartFrame Component
 * Placeholder frame for chart regions (no real charting yet)
 */

import React from 'react';
import { Skeleton } from './Skeleton';

export interface ChartFrameProps {
  title?: string;
  height?: string | number;
  showSkeleton?: boolean;
  testId?: string;
  children?: React.ReactNode;
}

export function ChartFrame({
  title,
  height = '400px',
  showSkeleton = false,
  testId,
  children,
}: ChartFrameProps) {
  return (
    <div
      data-testid={testId}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'var(--ui2-bg-panel)',
        border: '1px solid var(--ui2-border)',
        borderRadius: 'var(--ui2-radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--ui2-border)',
            background: 'var(--ui2-bg-elevated)',
          }}
        >
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ui2-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h4>
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        {showSkeleton ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton height="40%" />
            <Skeleton height="60%" />
          </div>
        ) : children ? (
          children
        ) : (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--ui2-text-muted)',
              fontSize: '13px',
            }}
          >
            Chart placeholder
          </div>
        )}
      </div>
    </div>
  );
}
