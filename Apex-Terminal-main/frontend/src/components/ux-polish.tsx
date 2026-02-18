/**
 * UX Polish Components (v1.11 Objective E)
 * ==========================================
 * Shared components for improved UX:
 * - Loading skeletons
 * - Empty states
 * - Severity banners
 * - Chart legend toggles
 */

import React from 'react';

// ─── Loading Skeletons ──────────────────────────────────────────────────────

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 20, className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded ${className}`}
      style={{ width, height }}
      data-testid="skeleton-loading"
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" data-testid="skeleton-table">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} height={32} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={`cell-${rowIdx}-${colIdx}`} height={24} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 border border-border rounded bg-panel-bg space-y-3" data-testid="skeleton-card">
      <Skeleton width="40%" height={24} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={`line-${i}`} width={i === lines - 1 ? '60%' : '100%'} height={16} />
      ))}
    </div>
  );
}

// ─── Empty States ───────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    testId?: string;
  };
  testId?: string;
}

export function EmptyState({ icon, title, description, action, testId = 'empty-state' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid={testId}>
      {icon && <div className="mb-4 text-text-secondary opacity-50">{icon}</div>}
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary mb-4 max-w-md">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          data-testid={action.testId || 'empty-state-action'}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Severity Banners ───────────────────────────────────────────────────────

export type BannerSeverity = 'info' | 'success' | 'warn' | 'error';

export interface BannerProps {
  severity: BannerSeverity;
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  testId?: string;
}

const severityStyles: Record<BannerSeverity, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-300 dark:border-blue-700',
    icon: 'ℹ️',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-300 dark:border-green-700',
    icon: '✅',
  },
  warn: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-300 dark:border-yellow-700',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-300 dark:border-red-700',
    icon: '❌',
  },
};

export function Banner({ severity, title, message, dismissible, onDismiss, testId = 'banner' }: BannerProps) {
  const styles = severityStyles[severity];

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded ${styles.bg} ${styles.border}`}
      data-testid={testId}
      data-severity={severity}
    >
      <span className="text-xl flex-shrink-0">{styles.icon}</span>
      <div className="flex-1">
        {title && <div className="font-semibold text-text mb-1">{title}</div>}
        <div className="text-sm text-text-secondary">{message}</div>
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="text-text-secondary hover:text-text transition-colors"
          data-testid={`${testId}-dismiss`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Chart Legend Toggle ────────────────────────────────────────────────────

export interface LegendToggleProps {
  series: Array<{ id: string; label: string; color: string; visible: boolean }>;
  onChange: (id: string, visible: boolean) => void;
  testId?: string;
}

export function ChartLegendToggle({ series, onChange, testId = 'chart-legend-toggle' }: LegendToggleProps) {
  return (
    <div className="flex flex-wrap gap-2 p-2 border border-border rounded" data-testid={testId}>
      {series.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id, !item.visible)}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition-opacity ${
            item.visible ? 'opacity-100' : 'opacity-40'
          }`}
          data-testid={`${testId}-${item.id}`}
        >
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-text">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Deterministic Chart Wrapper ────────────────────────────────────────────

export interface DeterministicChartWrapperProps {
  children: React.ReactNode;
  disableAnimations?: boolean;
  testId?: string;
}

export function DeterministicChartWrapper({
  children,
  disableAnimations = false,
  testId = 'chart-wrapper',
}: DeterministicChartWrapperProps) {
  const style = disableAnimations
    ? {
        animation: 'none !important',
        animationDuration: '0s !important',
        transition: 'none !important',
        transitionDuration: '0s !important',
      }
    : {};

  return (
    <div data-testid={testId} style={style as React.CSSProperties}>
      {children}
    </div>
  );
}
