import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  /** Icon element rendered before the title */
  icon?: ReactNode;
  /** Badges / pills rendered after the title (alias: badge) */
  status?: ReactNode;
  /** Alias for status */
  badge?: ReactNode;
  /** Primary action button (right side) */
  action?: ReactNode;
  /** Alias for action */
  actions?: ReactNode;
  /** Secondary actions (right side, before primary) */
  secondaryActions?: ReactNode;
  /** data-testid override — defaults to `page-header` */
  'data-testid'?: string;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, subtitle, icon, status, badge, action, actions, secondaryActions, ...props }, ref) => {
    const resolvedStatus = status ?? badge;
    const resolvedAction = action ?? actions;
    return (
      <header
        ref={ref}
        data-testid={props['data-testid'] ?? 'page-header'}
        className={cn(
          'flex items-center justify-between px-5 py-3 border-b border-border bg-panel-bg shrink-0 min-h-[52px]',
          className,
        )}
        {...props}
      >
        {/* Left: icon + title + subtitle + badges */}
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="shrink-0 text-brand">{icon}</div>}
          <h1 className="text-base font-semibold text-text truncate">{title}</h1>
          {subtitle && (
            <span className="text-xs text-text-muted hidden sm:inline truncate">{subtitle}</span>
          )}
          {resolvedStatus && <div className="flex items-center gap-1.5 shrink-0">{resolvedStatus}</div>}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions}
          {resolvedAction}
        </div>
      </header>
    );
  },
);
PageHeader.displayName = 'PageHeader';
