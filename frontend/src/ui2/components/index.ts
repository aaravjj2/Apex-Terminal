/**
 * UI2 Component Exports
 * Barrel file for importing all UI2 components
 */

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { DataTable } from './DataTable';
export type { DataTableProps, ColumnDef } from './DataTable';

export { Pill } from './Pill';
export type { PillProps } from './Pill';

export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { ChartFrame } from './ChartFrame';
export type { ChartFrameProps } from './ChartFrame';

export { BottomDock } from './BottomDock';
export type { BottomDockProps, BottomDockTab } from './BottomDock';

export { RightSidebar } from './RightSidebar';
export type { RightSidebarProps } from './RightSidebar';

export { CommandPalette } from './CommandPalette';
export type { CommandItem } from './CommandPalette';

export { KPIStrip } from './KPIStrip';
export type { KPIItem } from './KPIStrip';

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, BadgeVariant } from './StatusBadge';

export { ActionButton } from './ActionButton';
export type { ActionButtonProps } from './ActionButton';

export { ErrorBoundary } from './ErrorBoundary';

export { ProgressBar, ConfidenceBar } from './ProgressBar';
export type { ProgressBarProps, ConfidenceBarProps } from './ProgressBar';

export { InsightsPanel } from './InsightsPanel';
export type { InsightsPanelProps, Insight, InsightAction } from './InsightsPanel';

// Re-export DataTable formatting utilities
export { formatValue, formatPnL, formatPercent } from './DataTable';

export { MarketTape } from './MarketTape';
export { OrderTicket } from './OrderTicket';
export { MonitorGrid } from './MonitorGrid';

// W103 — Standardization components
export { PageShellUI2 } from './PageShellUI2';
export type { PageShellUI2Props, PageStatus } from './PageShellUI2';

export { DataTableUI2 } from './DataTableUI2';
export type { DataTableUI2Props, ColumnDefUI2 } from './DataTableUI2';
