import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface ChartFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** Chart title shown top-left */
  title?: string;
  /** Optional toolbar (filters, toggles) rendered in the header */
  toolbar?: ReactNode;
  /** Minimum height in px; default 200 */
  minHeight?: number;
  /** data-testid override — defaults to "chart-frame" */
  'data-testid'?: string;
}

/**
 * Consistent wrapper for all chart / visualization panels.
 * Provides a standard background, border, header bar, and stable sizing.
 *
 * Disables pointer-events during E2E to prevent tooltip flicker in screenshots.
 */
export const ChartFrame = forwardRef<HTMLDivElement, ChartFrameProps>(
  ({ className, title, toolbar, minHeight = 200, children, ...props }, ref) => (
    <div
      ref={ref}
      data-testid={props['data-testid'] ?? 'chart-frame'}
      className={cn(
        'flex flex-col bg-panel-bg border border-border rounded overflow-hidden',
        className,
      )}
      style={{ minHeight }}
      {...props}
    >
      {(title || toolbar) && (
        <div className="flex items-center justify-between px-3 h-9 border-b border-border shrink-0">
          {title && (
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              {title}
            </span>
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="flex-1 relative">{children}</div>
    </div>
  ),
);
ChartFrame.displayName = 'ChartFrame';
