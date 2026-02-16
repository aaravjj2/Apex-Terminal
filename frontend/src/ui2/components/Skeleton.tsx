/**
 * UI2 Skeleton Component
 * Loading placeholder for content
 */

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rect' | 'circle';
  testId?: string;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '16px',
  variant = 'text',
  testId,
  className = '',
}: SkeletonProps) {
  const variantStyles = {
    text: {
      borderRadius: 'var(--ui2-radius-sm)',
    },
    rect: {
      borderRadius: 'var(--ui2-radius-md)',
    },
    circle: {
      borderRadius: '50%',
    },
  };

  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'var(--ui2-bg-elevated)',
        ...variantStyles[variant],
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// CSS animation (add to ui2-tokens.css)
export const skeletonAnimation = `
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
`;
