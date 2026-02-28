/**
 * BloombergPanel.tsx
 * Reusable Bloomberg-style base panel container for Apex Terminal.
 * Provides consistent header, toolbar, tabs, status bar, and layout patterns.
 */

import React, { useState, useCallback, useEffect, useRef, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BloombergPanelTab {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface BloombergPanelAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'default' | 'primary' | 'danger';
}

export interface BloombergPanelStatus {
  type: 'live' | 'delayed' | 'static' | 'error' | 'loading';
  message?: string;
  timestamp?: Date;
}

export interface BloombergPanelProps {
  title: string;
  subtitle?: string;
  icon?: string;
  tabs?: BloombergPanelTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: BloombergPanelAction[];
  status?: BloombergPanelStatus;
  onRefresh?: () => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  children?: ReactNode;
  className?: string;
  headerChildren?: ReactNode;
  footerChildren?: ReactNode;
  resizable?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  minHeight?: number;
  maxHeight?: number;
  fullscreenable?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BloombergPanelStatus['type'], string> = {
  live: '#00d4aa',
  delayed: '#ffcc00',
  static: '#888',
  error: '#ff4444',
  loading: '#88ccff',
};

const STATUS_ICONS: Record<BloombergPanelStatus['type'], string> = {
  live: '◉',
  delayed: '○',
  static: '◎',
  error: '⚠',
  loading: '⟳',
};

// ─── StatusIndicator ──────────────────────────────────────────────────────────

interface StatusIndicatorProps {
  status: BloombergPanelStatus;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const color = STATUS_COLORS[status.type];
  const icon = STATUS_ICONS[status.type];
  return (
    <div className="bloomberg-status" style={{ color }}>
      <span className={`bloomberg-status__icon${status.type === 'live' ? ' bloomberg-status__icon--pulse' : ''}`}>
        {icon}
      </span>
      <span className="bloomberg-status__type">{status.type.toUpperCase()}</span>
      {status.message && <span className="bloomberg-status__message">{status.message}</span>}
      {status.timestamp && (
        <span className="bloomberg-status__time">{status.timestamp.toLocaleTimeString()}</span>
      )}
    </div>
  );
};

// ─── TabBar ───────────────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: BloombergPanelTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabChange }) => (
  <div className="bloomberg-tabbar" role="tablist">
    {tabs.map(tab => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={activeTab === tab.id}
        className={`bloomberg-tab${activeTab === tab.id ? ' bloomberg-tab--active' : ''}${tab.disabled ? ' bloomberg-tab--disabled' : ''}`}
        onClick={() => !tab.disabled && onTabChange(tab.id)}
        disabled={tab.disabled}
      >
        {tab.icon && <span className="bloomberg-tab__icon">{tab.icon}</span>}
        <span className="bloomberg-tab__label">{tab.label}</span>
        {tab.badge !== undefined && (
          <span className="bloomberg-tab__badge">{tab.badge}</span>
        )}
      </button>
    ))}
  </div>
);

// ─── ActionBar ────────────────────────────────────────────────────────────────

interface ActionBarProps {
  actions: BloombergPanelAction[];
}

const ActionBar: React.FC<ActionBarProps> = ({ actions }) => (
  <div className="bloomberg-actions">
    {actions.map(action => (
      <button
        key={action.id}
        className={`bloomberg-action bloomberg-action--${action.variant || 'default'}${action.disabled ? ' bloomberg-action--disabled' : ''}`}
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.tooltip}
      >
        <span className="bloomberg-action__icon">{action.icon}</span>
        {action.label && <span className="bloomberg-action__label">{action.label}</span>}
      </button>
    ))}
  </div>
);

// ─── LoadingOverlay ───────────────────────────────────────────────────────────

const LoadingOverlay: React.FC = () => (
  <div className="bloomberg-loading">
    <div className="bloomberg-loading__spinner">
      <svg viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#1a2332" strokeWidth="3" />
        <path d="M 20 4 A 16 16 0 0 1 36 20" fill="none" stroke="#00d4aa" strokeWidth="3" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.8s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
    <div className="bloomberg-loading__text">Loading...</div>
  </div>
);

// ─── ErrorBanner ──────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  error: string;
  onDismiss?: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => (
  <div className="bloomberg-error" role="alert">
    <span className="bloomberg-error__icon">⚠</span>
    <span className="bloomberg-error__message">{error}</span>
    {onDismiss && (
      <button className="bloomberg-error__dismiss" onClick={onDismiss} aria-label="Dismiss error">✕</button>
    )}
  </div>
);

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResize: (dy: number) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize }) => {
  const dragStartY = useRef<number | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;

    const onMouseMove = (e: MouseEvent) => {
      if (dragStartY.current !== null) {
        onResize(e.clientY - dragStartY.current);
        dragStartY.current = e.clientY;
      }
    };
    const onMouseUp = () => {
      dragStartY.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [onResize]);

  return (
    <div className="bloomberg-resize-handle" onMouseDown={onMouseDown} role="separator" aria-label="Resize panel" />
  );
};

// ─── Main BloombergPanel ──────────────────────────────────────────────────────

export const BloombergPanel: React.FC<BloombergPanelProps> = ({
  title,
  subtitle,
  icon,
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  actions = [],
  status,
  onRefresh,
  loading = false,
  error = null,
  onDismissError,
  children,
  className = '',
  headerChildren,
  footerChildren,
  resizable = false,
  collapsible = false,
  defaultCollapsed = false,
  minHeight = 200,
  maxHeight = 1200,
  fullscreenable = false,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<string>(tabs?.[0]?.id || '');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [fullscreen, setFullscreen] = useState(false);
  const [height, setHeight] = useState(400);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabChange = useCallback((id: string) => {
    if (!controlledActiveTab) setInternalActiveTab(id);
    onTabChange?.(id);
  }, [controlledActiveTab, onTabChange]);

  const handleResize = useCallback((dy: number) => {
    setHeight(prev => Math.max(minHeight, Math.min(maxHeight, prev + dy)));
  }, [minHeight, maxHeight]);

  const toggleCollapsed = useCallback(() => setCollapsed(prev => !prev), []);
  const toggleFullscreen = useCallback(() => setFullscreen(prev => !prev), []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const refreshAction: BloombergPanelAction | null = onRefresh ? {
    id: '__refresh',
    label: '',
    icon: '⟳',
    onClick: () => { onRefresh(); },
    disabled: loading,
    tooltip: 'Refresh data',
  } : null;

  const allActions = [...actions, ...(refreshAction ? [refreshAction] : [])];

  const finalStatus: BloombergPanelStatus = status ?? (loading
    ? { type: 'loading', message: 'Fetching...' }
    : error
    ? { type: 'error', message: error }
    : { type: 'live', timestamp: new Date() });

  return (
    <div
      ref={panelRef}
      className={`bloomberg-panel${collapsed ? ' bloomberg-panel--collapsed' : ''}${fullscreen ? ' bloomberg-panel--fullscreen' : ''} ${className}`}
      style={resizable && !fullscreen ? { height } : undefined}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div className="bloomberg-panel__header">
        <div className="bloomberg-panel__title-group">
          {icon && <span className="bloomberg-panel__icon">{icon}</span>}
          <div className="bloomberg-panel__titles">
            <span className="bloomberg-panel__title">{title}</span>
            {subtitle && <span className="bloomberg-panel__subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="bloomberg-panel__header-right">
          {headerChildren}
          <StatusIndicator status={finalStatus} />
          {allActions.length > 0 && <ActionBar actions={allActions} />}
          {collapsible && (
            <button
              className="bloomberg-collapse-btn"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▼' : '▲'}
            </button>
          )}
          {fullscreenable && (
            <button
              className="bloomberg-fullscreen-btn"
              onClick={toggleFullscreen}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? '⊡' : '⊞'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      {tabs && tabs.length > 0 && !collapsed && (
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* ── Error ──────────────────────────────────────── */}
      {error && !collapsed && (
        <ErrorBanner error={error} onDismiss={onDismissError} />
      )}

      {/* ── Content ────────────────────────────────────── */}
      {!collapsed && (
        <div className="bloomberg-panel__content" role="tabpanel">
          {loading && <LoadingOverlay />}
          {children}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────── */}
      {footerChildren && !collapsed && (
        <div className="bloomberg-panel__footer">{footerChildren}</div>
      )}

      {/* ── Resize Handle ──────────────────────────────── */}
      {resizable && !collapsed && <ResizeHandle onResize={handleResize} />}
    </div>
  );
};

// ─── BloombergPanelGrid ───────────────────────────────────────────────────────

export interface BloombergPanelGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export const BloombergPanelGrid: React.FC<BloombergPanelGridProps> = ({
  children,
  columns = 2,
  className = '',
}) => (
  <div className={`bloomberg-panel-grid bloomberg-panel-grid--cols-${columns} ${className}`}>
    {children}
  </div>
);

// ─── BloombergSection ────────────────────────────────────────────────────────

export interface BloombergSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  actions?: ReactNode;
}

export const BloombergSection: React.FC<BloombergSectionProps> = ({
  title,
  children,
  className = '',
  collapsible = false,
  defaultExpanded = true,
  actions,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={`bloomberg-section ${className}`}>
      <div className="bloomberg-section__header">
        <span className="bloomberg-section__title">{title}</span>
        <div className="bloomberg-section__header-right">
          {actions}
          {collapsible && (
            <button
              className="bloomberg-section__toggle"
              onClick={() => setExpanded(p => !p)}
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>
      {expanded && <div className="bloomberg-section__content">{children}</div>}
    </div>
  );
};

// ─── BloombergMetricCard ──────────────────────────────────────────────────────

export interface BloombergMetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  changePeriod?: string;
  color?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const BloombergMetricCard: React.FC<BloombergMetricCardProps> = ({
  label,
  value,
  subValue,
  change,
  changePeriod,
  color,
  icon,
  size = 'md',
  onClick,
}) => {
  const changeColor = change !== undefined ? (change > 0 ? '#00d4aa' : change < 0 ? '#ff4444' : '#888') : undefined;

  return (
    <div
      className={`bloomberg-metric-card bloomberg-metric-card--${size}${onClick ? ' bloomberg-metric-card--clickable' : ''}`}
      onClick={onClick}
      style={color ? { borderTopColor: color } : undefined}
    >
      {icon && <div className="bloomberg-metric-card__icon">{icon}</div>}
      <div className="bloomberg-metric-card__label">{label}</div>
      <div className="bloomberg-metric-card__value" style={color ? { color } : undefined}>{value}</div>
      {subValue && <div className="bloomberg-metric-card__sub">{subValue}</div>}
      {change !== undefined && (
        <div className="bloomberg-metric-card__change" style={{ color: changeColor }}>
          {change > 0 ? '▲' : change < 0 ? '▼' : '─'}
          {Math.abs(change * 100).toFixed(2)}%
          {changePeriod && <span className="bloomberg-metric-card__period"> ({changePeriod})</span>}
        </div>
      )}
    </div>
  );
};

// ─── BloombergTooltip ────────────────────────────────────────────────────────

export interface BloombergTooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const BloombergTooltip: React.FC<BloombergTooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="bloomberg-tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`bloomberg-tooltip bloomberg-tooltip--${position}`}>
          {content}
        </div>
      )}
    </div>
  );
};

// ─── BloombergBadge ──────────────────────────────────────────────────────────

export interface BloombergBadgeProps {
  label: string;
  color?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md';
  icon?: string;
}

export const BloombergBadge: React.FC<BloombergBadgeProps> = ({
  label,
  color = '#00d4aa',
  variant = 'outline',
  size = 'sm',
  icon,
}) => (
  <span
    className={`bloomberg-badge bloomberg-badge--${variant} bloomberg-badge--${size}`}
    style={{
      color,
      borderColor: variant === 'outline' ? `${color}66` : undefined,
      backgroundColor: variant === 'solid' ? color : variant === 'ghost' ? `${color}22` : undefined,
    }}
  >
    {icon && <span className="bloomberg-badge__icon">{icon}</span>}
    {label}
  </span>
);

// ─── BloombergDivider ────────────────────────────────────────────────────────

export const BloombergDivider: React.FC<{ label?: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`bloomberg-divider ${className}`}>
    {label && <span className="bloomberg-divider__label">{label}</span>}
  </div>
);

// ─── BloombergKeyValue ───────────────────────────────────────────────────────

export interface BloombergKeyValueProps {
  items: { label: string; value: string | number | ReactNode; color?: string }[];
  className?: string;
  columns?: 1 | 2 | 3;
}

export const BloombergKeyValue: React.FC<BloombergKeyValueProps> = ({ items, className = '', columns = 1 }) => (
  <div className={`bloomberg-kv bloomberg-kv--cols-${columns} ${className}`}>
    {items.map((item, i) => (
      <div key={i} className="bloomberg-kv__item">
        <span className="bloomberg-kv__label">{item.label}</span>
        <span className="bloomberg-kv__value" style={item.color ? { color: item.color } : undefined}>
          {item.value}
        </span>
      </div>
    ))}
  </div>
);

// ─── BloombergSparkline ──────────────────────────────────────────────────────

export interface BloombergSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}

export const BloombergSparkline: React.FC<BloombergSparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = '#00d4aa',
  showArea = true,
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const xStep = (width - pad * 2) / (data.length - 1);
  const yScale = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const pts = data.map((v, i) => `${pad + i * xStep},${yScale(v)}`);
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `${pathD} L ${pad + (data.length - 1) * xStep},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="bloomberg-sparkline">
      {showArea && (
        <path d={areaD} fill={`${color}22`} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// ─── BloombergProgress ───────────────────────────────────────────────────────

export interface BloombergProgressProps {
  value: number; // 0-100
  max?: number;
  color?: string;
  label?: string;
  showValue?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const BloombergProgress: React.FC<BloombergProgressProps> = ({
  value,
  max = 100,
  color = '#00d4aa',
  label,
  showValue = true,
  size = 'sm',
}) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bloomberg-progress bloomberg-progress--${size}`}>
      {label && <div className="bloomberg-progress__label">{label}</div>}
      <div className="bloomberg-progress__track">
        <div
          className="bloomberg-progress__fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showValue && <div className="bloomberg-progress__value" style={{ color }}>{value.toFixed(0)}</div>}
    </div>
  );
};

// ─── BloombergAlert ──────────────────────────────────────────────────────────

export interface BloombergAlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const ALERT_COLORS = {
  info: '#88ccff',
  success: '#00d4aa',
  warning: '#ffcc00',
  error: '#ff4444',
};

const ALERT_ICONS = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export const BloombergAlert: React.FC<BloombergAlertProps> = ({
  type,
  title,
  message,
  onDismiss,
  className = '',
}) => {
  const color = ALERT_COLORS[type];
  return (
    <div
      className={`bloomberg-alert bloomberg-alert--${type} ${className}`}
      style={{ borderLeftColor: color }}
      role="alert"
    >
      <span className="bloomberg-alert__icon" style={{ color }}>{ALERT_ICONS[type]}</span>
      <div className="bloomberg-alert__content">
        {title && <div className="bloomberg-alert__title" style={{ color }}>{title}</div>}
        <div className="bloomberg-alert__message">{message}</div>
      </div>
      {onDismiss && (
        <button className="bloomberg-alert__dismiss" onClick={onDismiss}>✕</button>
      )}
    </div>
  );
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export default BloombergPanel;
